import type {
  Collector,
  LLMProvider,
  LLMResponse,
  ResearchMessage,
  ResearchRuntimeEvent,
  Source,
  Tool,
  ToolCall,
  ToolResult,
} from '../types';
import { createResearchMetricsRecorder } from '../observability/metrics.ts';
import { redactResearchRuntimeEvent } from '../observability/redaction.ts';
import type {
  ResearchMetrics,
  ResearchMetricsRecorder,
  ResearchMetricCompletionReason,
} from '../observability/metrics.ts';
import { ToolRegistry } from './ToolRegistry.ts';

export type AgentLoopCompletionReason = ResearchMetricCompletionReason;

export interface AgentLoopConfig {
  llm: LLMProvider;
  tools: Tool[] | ToolRegistry;
  collector: Collector;
  systemPrompt?: string;
  maxIterations?: number;
  timeoutMs?: number;
  loopDetectionWindow?: number;
  onProgress?: (event: ResearchRuntimeEvent) => void;
}

export interface AgentLoopResult {
  answer: string;
  sources: Source[];
  iterationsUsed: number;
  completionReason: AgentLoopCompletionReason;
  metrics: ResearchMetrics;
}

export class AgentLoop {
  private readonly llm: LLMProvider;
  private readonly registry: ToolRegistry;
  private readonly collector: Collector;
  private readonly systemPrompt: string;
  private readonly maxIterations: number;
  private readonly timeoutMs: number;
  private readonly loopDetectionWindow: number;
  private readonly onProgress?: (event: ResearchRuntimeEvent) => void;

  constructor(config: AgentLoopConfig) {
    this.llm = config.llm;
    this.registry = config.tools instanceof ToolRegistry ? config.tools : new ToolRegistry(config.tools);
    this.collector = config.collector;
    this.systemPrompt = config.systemPrompt ?? defaultResearchSystemPrompt();
    this.maxIterations = config.maxIterations ?? 50;
    this.timeoutMs = config.timeoutMs ?? 30 * 60 * 1000;
    this.loopDetectionWindow = config.loopDetectionWindow ?? 3;
    this.onProgress = config.onProgress;
  }

  async run(query: string): Promise<AgentLoopResult> {
    const startedAt = Date.now();
    const metrics = createResearchMetricsRecorder({ provider: this.llm.id });
    const messages: ResearchMessage[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: query },
    ];
    const recentToolCalls: string[] = [];

    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      if (Date.now() - startedAt > this.timeoutMs) {
        metrics.recordError({
          phase: 'agent_loop',
          message: 'AgentLoop timeout reached before provider request.',
          recoverable: true,
        });
        return this.forceSynthesis(messages, 'timeout', iteration, metrics);
      }

      let response: LLMResponse;
      const providerStartedAt = Date.now();

      try {
        this.emit({
          type: 'provider_request',
          provider: this.llm.id,
          toolsCount: this.registry.definitions().length,
          iteration,
        });
        response = await this.llm.invoke({
          messages,
          tools: this.registry.definitions(),
          toolChoice: 'auto',
        });
        metrics.recordLlmCall({
          provider: this.llm.id,
          phase: 'agent',
          iteration,
          durationMs: Date.now() - providerStartedAt,
          response,
        });
        this.emit({
          type: 'provider_response',
          provider: this.llm.id,
          toolCallsCount: response.toolCalls?.length ?? 0,
          iteration,
        });
      } catch (error) {
        metrics.recordError({
          phase: 'provider',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        });
        return this.complete(
          `Provider error: ${error instanceof Error ? error.message : String(error)}`,
          iteration,
          'provider_error',
          metrics,
        );
      }

      const toolCalls = response.toolCalls ?? [];

      if (toolCalls.length === 0) {
        return this.complete(response.content ?? '', iteration, 'natural', metrics);
      }

      recentToolCalls.push(serializeToolCalls(toolCalls));
      if (recentToolCalls.length > this.loopDetectionWindow) {
        recentToolCalls.shift();
      }

      if (
        recentToolCalls.length === this.loopDetectionWindow &&
        recentToolCalls.every((signature) => signature === recentToolCalls[0])
      ) {
        return this.forceSynthesis(messages, 'loop_detected', iteration, metrics);
      }

      messages.push({ role: 'assistant', content: response.content, toolCalls });

      for (const call of toolCalls) {
        this.emit({ type: 'tool_call', tool: call.name, args: call.args, iteration });
        const toolStartedAt = Date.now();
        let content: string;

        try {
          const result = await this.registry.execute(call.name, call.args, {
            emit: (event) => this.emit(event),
          });
          content = stringifyToolResult(result);
          metrics.recordToolCall({
            tool: call.name,
            iteration,
            durationMs: Date.now() - toolStartedAt,
            status: 'success',
            args: call.args,
            resultSummary: summarizeToolResult(content),
          });
        } catch (error) {
          content = `Tool ${call.name} failed: ${error instanceof Error ? error.message : String(error)}`;
          metrics.recordToolCall({
            tool: call.name,
            iteration,
            durationMs: Date.now() - toolStartedAt,
            status: 'error',
            args: call.args,
            error: content,
          });
          metrics.recordError({
            phase: `tool:${call.name}`,
            message: content,
            recoverable: true,
          });
        }

        this.emit({
          type: 'tool_result',
          tool: call.name,
          resultSummary: summarizeToolResult(content),
          iteration,
        });
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content,
        });
      }
    }

    return this.forceSynthesis(messages, 'max_iterations', this.maxIterations, metrics);
  }

  private async forceSynthesis(
    messages: ResearchMessage[],
    reason: AgentLoopCompletionReason,
    iterationsUsed: number,
    metrics: ResearchMetricsRecorder,
  ): Promise<AgentLoopResult> {
    const providerStartedAt = Date.now();

    try {
      const response = await this.llm.invoke({
        messages: [
          ...messages,
          {
            role: 'user',
            content:
              'Synthesize the research findings now. Use [N] citations only when they reference collected sources.',
          },
        ],
        toolChoice: 'none',
      });
      metrics.recordLlmCall({
        provider: this.llm.id,
        phase: 'synthesis',
        iteration: iterationsUsed,
        durationMs: Date.now() - providerStartedAt,
        response,
      });

      return this.complete(response.content ?? '', iterationsUsed, reason, metrics);
    } catch (error) {
      metrics.recordError({
        phase: 'synthesis',
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      });
      return this.complete(
        `Forced synthesis failed after ${reason}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        iterationsUsed,
        'provider_error',
        metrics,
      );
    }
  }

  private complete(
    answer: string,
    iterationsUsed: number,
    completionReason: AgentLoopCompletionReason,
    metrics: ResearchMetricsRecorder,
  ): AgentLoopResult {
    return {
      answer,
      sources: this.collector.getAll(),
      iterationsUsed,
      completionReason,
      metrics: metrics.complete({
        completionReason,
        iterationsUsed,
        sourcesCollected: this.collector.size(),
      }),
    };
  }

  private emit(event: ResearchRuntimeEvent): void {
    this.onProgress?.(redactResearchRuntimeEvent(event).value);
  }
}

function serializeToolCalls(toolCalls: ToolCall[]): string {
  return toolCalls
    .map((call) => `${call.name}:${JSON.stringify(call.args)}`)
    .join('|');
}

function stringifyToolResult(result: ToolResult): string {
  return typeof result === 'string' ? result : JSON.stringify(result);
}

function summarizeToolResult(result: string): string {
  return result.length <= 160 ? result : `${result.slice(0, 157)}...`;
}

function defaultResearchSystemPrompt(): string {
  return [
    'You are a research agent.',
    'Use tools when needed, stop when you have enough evidence, and cite collected sources with [N].',
  ].join(' ');
}

export default AgentLoop;
