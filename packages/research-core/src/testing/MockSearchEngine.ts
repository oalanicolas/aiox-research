import type { SearchEngine, SearchOptions, SourceInput } from '../types';

export interface MockSearchEngineConfig {
  id?: string;
  label?: string;
  results?: SourceInput[];
  handler?: (query: string, options?: SearchOptions) => SourceInput[] | Promise<SourceInput[]>;
}

export class MockSearchEngine implements SearchEngine {
  readonly id: string;
  readonly label: string;

  private readonly results: SourceInput[];
  private readonly handler?: MockSearchEngineConfig['handler'];
  private readonly queries: Array<{ query: string; options?: SearchOptions }> = [];

  constructor(config: MockSearchEngineConfig = {}) {
    this.id = config.id ?? 'mock-search';
    this.label = config.label ?? 'Mock Search';
    this.results = config.results ? cloneSources(config.results) : [];
    this.handler = config.handler;
  }

  async search(query: string, options?: SearchOptions): Promise<SourceInput[]> {
    if (options?.signal?.aborted) {
      throw new Error(`Search aborted for engine ${this.id}`);
    }

    this.queries.push({ query, options });

    const results = this.handler
      ? await this.handler(query, options)
      : this.results.slice(0, options?.limit ?? this.results.length);

    return cloneSources(results);
  }

  getQueries(): Array<{ query: string; options?: SearchOptions }> {
    return this.queries.map((entry) => ({
      query: entry.query,
      options: entry.options ? { ...entry.options } : undefined,
    }));
  }
}

function cloneSources(sources: SourceInput[]): SourceInput[] {
  return sources.map((source) => ({
    ...source,
    authors: source.authors ? [...source.authors] : undefined,
    metadata: source.metadata ? { ...source.metadata } : undefined,
  }));
}
