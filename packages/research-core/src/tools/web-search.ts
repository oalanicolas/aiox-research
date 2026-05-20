import type { Collector, JsonObject, SearchEngine, Tool } from '../types';
import { assertEnginePolicyAllowed } from '../engines/policy.ts';
import type { EnginePolicyRequest } from '../engines/policy.ts';

export interface WebSearchArgs extends JsonObject {
  query?: unknown;
  engine?: unknown;
  engines?: unknown;
  limit?: unknown;
}

export interface WebSearchToolConfig {
  collector: Collector;
  engines: SearchEngine[];
  defaultEngineId?: string;
  defaultLimit?: number;
  enginePolicy?: Omit<EnginePolicyRequest, 'engine' | 'engines'>;
}

export function createWebSearchTool(config: WebSearchToolConfig): Tool<WebSearchArgs> {
  const engineById = new Map(config.engines.map((engine) => [engine.id, engine]));

  return {
    name: 'web_search',
    description: 'Searches the web using configured engines and stores results in the shared collector.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query.',
        },
        engine: {
          type: 'string',
          description: 'Optional single engine id.',
        },
        engines: {
          type: 'array',
          description: 'Optional engine ids to search in order.',
          items: { type: 'string' },
        },
        limit: {
          type: 'number',
          description: 'Optional max results per engine.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    async execute(args, context) {
      const query = coerceQuery(args.query);

      if (!query) {
        return 'Search failed: query is required.';
      }

      const selectedEngineIds = selectEngineIds(args, config.defaultEngineId, config.engines);
      const limit = coerceLimit(args.limit, config.defaultLimit);
      const errors: string[] = [];
      let added = 0;

      if (config.enginePolicy) {
        try {
          assertEnginePolicyAllowed({
            ...config.enginePolicy,
            engines: selectedEngineIds,
            allowModeDefaults: false,
          });
        } catch (error) {
          return `Search failed for "${query}": ${
            error instanceof Error ? error.message : String(error)
          }.`;
        }
      }

      for (const engineId of selectedEngineIds) {
        const engine = engineById.get(engineId);

        if (!engine) {
          errors.push(`unknown engine "${engineId}"`);
          continue;
        }

        try {
          const results = await engine.search(query, {
            limit,
            signal: context?.signal,
          });
          const before = config.collector.size();
          await config.collector.add(results, engine.id);
          added += config.collector.size() - before;
        } catch (error) {
          errors.push(`${engine.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (added === 0 && errors.length > 0) {
        return `Search failed for "${query}": ${errors.join('; ')}.`;
      }

      const suffix = errors.length > 0 ? `\n\nWarnings: ${errors.join('; ')}.` : '';
      return `${config.collector.format()}${suffix}`;
    },
  };
}

function coerceQuery(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function coerceLimit(value: unknown, fallback = 10): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function selectEngineIds(
  args: WebSearchArgs,
  defaultEngineId: string | undefined,
  engines: SearchEngine[],
): string[] {
  if (Array.isArray(args.engines)) {
    const ids = args.engines.filter((engine): engine is string => typeof engine === 'string');
    if (ids.length > 0) {
      return ids;
    }
  }

  if (typeof args.engine === 'string' && args.engine.trim().length > 0) {
    return [args.engine.trim()];
  }

  if (defaultEngineId) {
    return [defaultEngineId];
  }

  return engines.length > 0 ? [engines[0].id] : [];
}
