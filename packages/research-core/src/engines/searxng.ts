import type { SearchEngine, SearchOptions, SourceInput } from '../types';

interface SearxngResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  publishedDate?: unknown;
  engine?: unknown;
}

interface SearxngResponse {
  results?: SearxngResult[];
}

export interface SearxngSearchEngineConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  defaultLimit?: number;
}

export class SearxngSearchEngine implements SearchEngine {
  readonly id = 'searxng';
  readonly label = 'SearXNG';

  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly defaultLimit: number;

  constructor(config: SearxngSearchEngineConfig) {
    this.baseUrl = new URL(config.baseUrl);
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.defaultLimit = config.defaultLimit ?? 10;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SourceInput[]> {
    const limit = options.limit ?? this.defaultLimit;
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortFromContext = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromContext, { once: true });

    try {
      const response = await this.fetchImpl(url.toString(), {
        headers: {
          accept: 'application/json',
          'user-agent': 'AIOX Research Core/0.1 (+https://sinkra.ai)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SearXNG HTTP ${response.status}`);
      }

      const payload = (await response.json()) as SearxngResponse;
      return (payload.results ?? [])
        .map(mapSearxngResult)
        .filter((source): source is SourceInput => source !== null)
        .slice(0, limit);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromContext);
    }
  }
}

function mapSearxngResult(result: SearxngResult): SourceInput | null {
  if (typeof result.url !== 'string' || result.url.trim().length === 0) {
    return null;
  }

  return {
    title:
      typeof result.title === 'string' && result.title.trim().length > 0
        ? result.title.trim()
        : result.url,
    url: result.url,
    snippet: typeof result.content === 'string' ? result.content : undefined,
    publishedDate: typeof result.publishedDate === 'string' ? result.publishedDate : undefined,
    metadata: {
      searxngEngine: typeof result.engine === 'string' ? result.engine : undefined,
    },
  };
}
