import type { AgentLoop, AgentLoopResult } from '../agent/AgentLoop.ts';
import type { Collector, JsonObject, Tool } from '../types.ts';

export interface ResearchSubtopicArgs extends JsonObject {
  subtopics?: unknown;
  maxWorkers?: unknown;
  depth?: unknown;
}

export interface ResearchSubtopicRunContext {
  subtopic: string;
  index: number;
  depth: number;
  collector: Collector;
  signal?: AbortSignal;
}

export interface ResearchSubtopicToolConfig {
  collector: Collector;
  createLoop: (context: ResearchSubtopicRunContext) => AgentLoop;
  maxWorkers?: number;
  maxDepth?: number;
  maxSubtopics?: number;
}

interface SubtopicRunRecord {
  index: number;
  subtopic: string;
  status: 'fulfilled' | 'rejected';
  answer?: string;
  completionReason?: AgentLoopResult['completionReason'];
  sourcesCount?: number;
  error?: string;
}

export function createResearchSubtopicTool(
  config: ResearchSubtopicToolConfig,
): Tool<ResearchSubtopicArgs> {
  const configuredMaxWorkers = clampPositiveInteger(config.maxWorkers ?? 4, 1, 4);
  const maxDepth = clampPositiveInteger(config.maxDepth ?? 1, 0, 8);
  const maxSubtopics = clampPositiveInteger(config.maxSubtopics ?? 12, 1, 50);

  return {
    name: 'research_subtopic',
    description:
      'Runs bounded parallel research for subtopics with a shared collector and one-level recursion guard.',
    inputSchema: {
      type: 'object',
      properties: {
        subtopics: {
          type: 'array',
          description: 'Subtopic questions to research in parallel.',
          items: { type: 'string' },
        },
        maxWorkers: {
          type: 'number',
          description: 'Optional concurrency limit. Capped at 4.',
        },
        depth: {
          type: 'number',
          description: 'Current recursion depth. Depth must stay below maxDepth.',
        },
      },
      required: ['subtopics'],
      additionalProperties: false,
    },
    async execute(args, context) {
      const subtopics = coerceSubtopics(args.subtopics, maxSubtopics);

      if (subtopics.length === 0) {
        return {
          type: 'research_subtopic_result',
          status: 'failed',
          error: 'research_subtopic failed: subtopics must contain at least one string.',
          subtopics: [],
        };
      }

      const depth = coerceDepth(args.depth);
      if (depth >= maxDepth) {
        return {
          type: 'research_subtopic_result',
          status: 'blocked',
          error: `research_subtopic blocked: maxDepth ${maxDepth} reached.`,
          depth,
          maxDepth,
          subtopics: subtopics.map((subtopic, index) => ({
            index,
            subtopic,
            status: 'rejected',
            error: 'max depth reached',
          })),
        };
      }

      const workerCount = Math.min(
        subtopics.length,
        configuredMaxWorkers,
        clampPositiveInteger(args.maxWorkers, 1, 4),
      );
      const records = await runBoundedSubtopics({
        subtopics,
        workerCount,
        depth: depth + 1,
        collector: config.collector,
        createLoop: config.createLoop,
        signal: context?.signal,
      });
      const completed = records.filter((record) => record.status === 'fulfilled').length;
      const failed = records.length - completed;

      return {
        type: 'research_subtopic_result',
        status: failed === 0 ? 'completed' : completed > 0 ? 'partial' : 'failed',
        depth,
        childDepth: depth + 1,
        maxDepth,
        maxWorkers: workerCount,
        completed,
        failed,
        collectorSize: config.collector.size(),
        subtopics: records,
      };
    },
  };
}

async function runBoundedSubtopics(input: {
  subtopics: string[];
  workerCount: number;
  depth: number;
  collector: Collector;
  createLoop: ResearchSubtopicToolConfig['createLoop'];
  signal?: AbortSignal;
}): Promise<SubtopicRunRecord[]> {
  const records: SubtopicRunRecord[] = new Array(input.subtopics.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < input.subtopics.length) {
      const index = cursor;
      cursor += 1;
      const subtopic = input.subtopics[index];

      if (!subtopic) continue;

      try {
        if (input.signal?.aborted) {
          throw new Error('research_subtopic aborted');
        }

        const loop = input.createLoop({
          subtopic,
          index,
          depth: input.depth,
          collector: input.collector,
          signal: input.signal,
        });
        const result = await loop.run(subtopic);
        records[index] = {
          index,
          subtopic,
          status: 'fulfilled',
          answer: result.answer,
          completionReason: result.completionReason,
          sourcesCount: result.sources.length,
        };
      } catch (error) {
        records[index] = {
          index,
          subtopic,
          status: 'rejected',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  await Promise.allSettled(Array.from({ length: input.workerCount }, () => worker()));

  return records.map((record, index) => {
    if (record) return record;
    return {
      index,
      subtopic: input.subtopics[index] ?? '',
      status: 'rejected',
      error: 'subtopic was not executed',
    };
  });
}

function coerceSubtopics(value: unknown, maxSubtopics: number): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxSubtopics) break;
  }

  return out;
}

function coerceDepth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return clampPositiveInteger(value, 0, 8);
}

function clampPositiveInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return max;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
