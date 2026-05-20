import type { Collector, Source, SourceInput } from '../types';

class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await operation();
    } finally {
      release();
    }
  }
}

export function normalizeSourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();

    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function normalizeDoi(doi: string): string {
  return doi.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

export function canonicalSourceKey(source: Pick<SourceInput, 'url' | 'doi'>): string {
  if (source.doi) {
    return `doi:${normalizeDoi(source.doi)}`;
  }

  return `url:${normalizeSourceUrl(source.url)}`;
}

export class SearchResultsCollector implements Collector {
  private readonly mutex = new AsyncMutex();
  private readonly sources: Source[] = [];
  private readonly indexByUrl = new Map<string, number>();
  private readonly indexByDoi = new Map<string, number>();

  async add(results: SourceInput[], engineName: string): Promise<number> {
    return this.mutex.runExclusive(() => {
      let firstAddedIndex: number | null = null;

      for (const result of results) {
        const normalizedUrl = normalizeSourceUrl(result.url);
        const normalizedDoi = result.doi ? normalizeDoi(result.doi) : null;

        if (this.indexByUrl.has(normalizedUrl)) {
          continue;
        }

        if (normalizedDoi && this.indexByDoi.has(normalizedDoi)) {
          continue;
        }

        const index = this.sources.length + 1;
        const source: Source = {
          ...result,
          url: normalizedUrl,
          doi: normalizedDoi ?? result.doi,
          index,
          sourceEngine: engineName,
        };

        this.sources.push(source);
        this.indexByUrl.set(normalizedUrl, index);

        if (normalizedDoi) {
          this.indexByDoi.set(normalizedDoi, index);
        }

        firstAddedIndex ??= index;
      }

      return firstAddedIndex ?? this.sources.length;
    });
  }

  findByUrl(url: string): number | null {
    return this.indexByUrl.get(normalizeSourceUrl(url)) ?? null;
  }

  findByDoi(doi: string): number | null {
    return this.indexByDoi.get(normalizeDoi(doi)) ?? null;
  }

  getAll(): Source[] {
    return this.sources.map((source) => ({
      ...source,
      authors: source.authors ? [...source.authors] : undefined,
      metadata: source.metadata ? { ...source.metadata } : undefined,
    }));
  }

  size(): number {
    return this.sources.length;
  }

  format(): string {
    if (this.sources.length === 0) {
      return 'No results.';
    }

    return this.sources
      .map((source) => {
        const snippet = source.snippet ? `\n${source.snippet}` : '';
        return `[${source.index}] ${source.title} (${source.url})${snippet}`;
      })
      .join('\n\n');
  }

  reset(): void {
    this.sources.length = 0;
    this.indexByUrl.clear();
    this.indexByDoi.clear();
  }
}
