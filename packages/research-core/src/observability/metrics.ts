import type { JsonObject, LLMResponse } from '../types.ts';
import { redactJsonValue, redactText } from './redaction.ts';

export type ResearchMetricCompletionReason =
  | 'natural'
  | 'max_iterations'
  | 'loop_detected'
  | 'timeout'
  | 'provider_error';

export type ResearchMetricPhase = 'agent' | 'synthesis';

export interface LlmCallMetric {
  provider: string;
  phase: ResearchMetricPhase;
  iteration: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolCallsCount: number;
}

export interface ToolCallMetric {
  tool: string;
  iteration: number;
  durationMs: number;
  status: 'success' | 'error';
  args: JsonObject;
  resultSummary?: string;
  error?: string;
}

export interface ResearchRuntimeErrorMetric {
  phase: string;
  message: string;
  recoverable: boolean;
}

export interface ResearchMetrics {
  schema: 'sinkra.research-core.runtime-metrics.v1';
  provider: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  completionReason: ResearchMetricCompletionReason;
  iterationsUsed: number;
  totals: {
    llmCalls: number;
    toolCalls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    sourcesCollected: number;
    errors: number;
  };
  llmCalls: LlmCallMetric[];
  toolCalls: ToolCallMetric[];
  errors: ResearchRuntimeErrorMetric[];
  redaction: {
    applied: boolean;
    count: number;
    types: string[];
  };
}

export interface ResearchMetricsRecorder {
  recordLlmCall(input: {
    provider: string;
    phase: ResearchMetricPhase;
    iteration: number;
    durationMs: number;
    response?: LLMResponse;
    toolCallsCount?: number;
  }): void;
  recordToolCall(input: {
    tool: string;
    iteration: number;
    durationMs: number;
    status: 'success' | 'error';
    args: JsonObject;
    resultSummary?: string;
    error?: string;
  }): void;
  recordError(input: {
    phase: string;
    message: string;
    recoverable: boolean;
  }): void;
  complete(input: {
    completionReason: ResearchMetricCompletionReason;
    iterationsUsed: number;
    sourcesCollected: number;
  }): ResearchMetrics;
}

export function createResearchMetricsRecorder(input: {
  provider: string;
  startedAt?: Date;
}): ResearchMetricsRecorder {
  const startedAtDate = input.startedAt ?? new Date();
  const startedEpoch = startedAtDate.getTime();
  const llmCalls: LlmCallMetric[] = [];
  const toolCalls: ToolCallMetric[] = [];
  const errors: ResearchRuntimeErrorMetric[] = [];
  const redactionTypes = new Set<string>();
  let redactionCount = 0;

  function trackRedaction(report: { count: number; types: string[] }): void {
    redactionCount += report.count;
    for (const type of report.types) {
      redactionTypes.add(type);
    }
  }

  return {
    recordLlmCall(callInput) {
      const usage = callInput.response?.usage ?? {};
      llmCalls.push({
        provider: callInput.provider,
        phase: callInput.phase,
        iteration: callInput.iteration,
        durationMs: Math.max(0, Math.round(callInput.durationMs)),
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        toolCallsCount: callInput.toolCallsCount ?? callInput.response?.toolCalls?.length ?? 0,
      });
    },

    recordToolCall(toolInput) {
      const redactedArgs = redactJsonValue(toolInput.args);
      const redactedResult = toolInput.resultSummary ? redactText(toolInput.resultSummary) : undefined;
      const redactedError = toolInput.error ? redactText(toolInput.error) : undefined;

      trackRedaction(redactedArgs.report);
      if (redactedResult) trackRedaction(redactedResult.report);
      if (redactedError) trackRedaction(redactedError.report);

      const metric: ToolCallMetric = {
        tool: toolInput.tool,
        iteration: toolInput.iteration,
        durationMs: Math.max(0, Math.round(toolInput.durationMs)),
        status: toolInput.status,
        args: redactedArgs.value,
      };
      if (redactedResult?.value) metric.resultSummary = redactedResult.value;
      if (redactedError?.value) metric.error = redactedError.value;
      toolCalls.push(metric);
    },

    recordError(errorInput) {
      const redacted = redactText(errorInput.message);
      trackRedaction(redacted.report);
      errors.push({
        phase: errorInput.phase,
        message: redacted.value,
        recoverable: errorInput.recoverable,
      });
    },

    complete(completeInput) {
      const completedAtDate = new Date();
      const inputTokens = llmCalls.reduce((sum, call) => sum + call.inputTokens, 0);
      const outputTokens = llmCalls.reduce((sum, call) => sum + call.outputTokens, 0);
      const totalTokens = llmCalls.reduce((sum, call) => sum + call.totalTokens, 0);

      return {
        schema: 'sinkra.research-core.runtime-metrics.v1',
        provider: input.provider,
        startedAt: startedAtDate.toISOString(),
        completedAt: completedAtDate.toISOString(),
        durationMs: Math.max(0, completedAtDate.getTime() - startedEpoch),
        completionReason: completeInput.completionReason,
        iterationsUsed: completeInput.iterationsUsed,
        totals: {
          llmCalls: llmCalls.length,
          toolCalls: toolCalls.length,
          inputTokens,
          outputTokens,
          totalTokens,
          sourcesCollected: completeInput.sourcesCollected,
          errors: errors.length,
        },
        llmCalls: [...llmCalls],
        toolCalls: toolCalls.map((call) => ({ ...call, args: { ...call.args } })),
        errors: [...errors],
        redaction: {
          applied: redactionCount > 0,
          count: redactionCount,
          types: [...redactionTypes].sort(),
        },
      };
    },
  };
}
