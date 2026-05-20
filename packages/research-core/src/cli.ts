import { pathToFileURL } from 'node:url';

import { AgentLoop } from './agent/AgentLoop.ts';
import { SearchResultsCollector } from './collector/Collector.ts';
import { SearxngSearchEngine } from './engines/searxng.ts';
import { assertEnginePolicyAllowed } from './engines/policy.ts';
import { emitGoldArtifacts } from './output/GoldAdapter.ts';
import { MockLLMProvider } from './testing/MockLLMProvider.ts';
import { MockSearchEngine } from './testing/MockSearchEngine.ts';
import { createFetchUrlTool } from './tools/fetch-url.ts';
import { createWebSearchTool } from './tools/web-search.ts';
import { validateCitations } from './synthesis/CitationHandler.ts';
import type { GoldAdapterResult } from './output/GoldAdapter.ts';
import type { SearchEngine, Source, SourceInput } from './types.ts';
import type { ResearchMetrics } from './observability/metrics.ts';
import type { EnginePolicyMode } from './engines/policy.ts';

export type ResearchCoreFixtureDepth = 'standard' | 'sinkra-dr-40';

export interface ResearchCoreCliOptions {
  query: string;
  engine: 'mock' | 'searxng';
  mode: EnginePolicyMode;
  searxngUrl?: string;
  maxIterations: number;
  goldOutputDir?: string;
  goldSlug?: string;
  fixtureDepth?: ResearchCoreFixtureDepth;
}

export interface ResearchCoreCliResult {
  markdown: string;
  answer: string;
  rawAnswer: string;
  sources: Source[];
  completionReason: string;
  invalidCitations: number[];
  engine: string;
  mode: EnginePolicyMode;
  runtimeMetrics: ResearchMetrics;
  goldArtifacts?: GoldAdapterResult;
}

export function parseResearchCoreCliArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
): ResearchCoreCliOptions {
  const positional: string[] = [];
  let engine: ResearchCoreCliOptions['engine'] = env.SEARXNG_BASE_URL ? 'searxng' : 'mock';
  let mode: EnginePolicyMode = parseEnginePolicyMode(env.RESEARCH_ENGINE_MODE || 'public');
  let searxngUrl = env.SEARXNG_BASE_URL;
  let maxIterations = 4;
  let goldOutputDir: string | undefined;
  let goldSlug: string | undefined;
  let fixtureDepth: ResearchCoreFixtureDepth = 'standard';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--engine') {
      const value = argv[++index];
      if (value !== 'mock' && value !== 'searxng') {
        throw new Error(`Unsupported engine: ${value}`);
      }
      engine = value;
      continue;
    }

    if (arg === '--searxng-url') {
      searxngUrl = argv[++index];
      continue;
    }

    if (arg === '--mode') {
      mode = parseEnginePolicyMode(argv[++index]);
      continue;
    }

    if (arg === '--max-iterations') {
      const value = Number.parseInt(argv[++index], 10);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('max-iterations must be a positive integer');
      }
      maxIterations = value;
      continue;
    }

    if (arg === '--gold-output-dir') {
      goldOutputDir = argv[++index];
      if (!goldOutputDir) {
        throw new Error('gold-output-dir requires a path');
      }
      continue;
    }

    if (arg === '--gold-slug') {
      goldSlug = argv[++index];
      if (!goldSlug) {
        throw new Error('gold-slug requires a value');
      }
      continue;
    }

    if (arg === '--fixture-depth') {
      fixtureDepth = parseFixtureDepth(argv[++index]);
      continue;
    }

    if (arg === '--sinkra-dr-40') {
      fixtureDepth = 'sinkra-dr-40';
      continue;
    }

    positional.push(arg);
  }

  const options: ResearchCoreCliOptions = {
    query: positional.join(' ').trim() || 'Research core fixture query',
    engine,
    mode,
    searxngUrl,
    maxIterations,
    fixtureDepth,
  };

  if (goldOutputDir) options.goldOutputDir = goldOutputDir;
  if (goldSlug) options.goldSlug = goldSlug;

  return options;
}

export async function runResearchCoreCli(
  options: ResearchCoreCliOptions,
): Promise<ResearchCoreCliResult> {
  const startedAt = new Date().toISOString();
  const fixtureDepth = options.fixtureDepth ?? 'standard';
  const collector = new SearchResultsCollector();
  const searchEngine = createSearchEngine(options);
  if (options.engine !== 'mock') {
    assertEnginePolicyAllowed({
      mode: options.mode,
      engine: searchEngine.id,
      allowModeDefaults: false,
    });
  }
  const llm = new MockLLMProvider({
    responses: [
      {
        toolCalls: [
          {
            id: 'fixture-search',
            name: 'web_search',
            args: createFixtureSearchArgs(options.query, fixtureDepth),
          },
        ],
      },
      {
        content: createFixtureAnswer(fixtureDepth),
      },
    ],
  });
  const loop = new AgentLoop({
    llm,
    collector,
    tools: [
      createWebSearchTool({
        collector,
        engines: [searchEngine],
        enginePolicy: options.engine === 'mock' ? undefined : { mode: options.mode },
      }),
      createFetchUrlTool(),
    ],
    maxIterations: options.maxIterations,
  });
  const result = await loop.run(options.query);
  const completedAt = new Date().toISOString();
  const citationValidation = validateCitations(result.answer, result.sources);
  const markdown = renderCliMarkdown({
    query: options.query,
    engine: searchEngine.id,
    completionReason: result.completionReason,
    answer: citationValidation.text,
    rawAnswer: result.answer,
    sources: result.sources,
    invalidCitations: citationValidation.invalidCitations,
    mode: options.mode,
  });

  const cliResult: ResearchCoreCliResult = {
    markdown,
    answer: citationValidation.text,
    rawAnswer: result.answer,
    sources: result.sources,
    completionReason: result.completionReason,
    invalidCitations: citationValidation.invalidCitations,
    engine: searchEngine.id,
    mode: options.mode,
    runtimeMetrics: result.metrics,
  };

  if (options.goldOutputDir) {
    cliResult.goldArtifacts = await emitGoldArtifacts({
      outputDir: options.goldOutputDir,
      slug: options.goldSlug,
      query: options.query,
      answer: citationValidation.text,
      rawAnswer: result.answer,
      sources: result.sources,
      invalidCitations: citationValidation.invalidCitations,
      completionReason: result.completionReason,
      engine: searchEngine.id,
      startedAt,
      completedAt,
      runtimeMetrics: result.metrics,
    });
  }

  return cliResult;
}

function parseEnginePolicyMode(value: string | undefined): EnginePolicyMode {
  if (value === 'public' || value === 'private' || value === 'premium' || value === 'research_strict') {
    return value;
  }

  throw new Error(`Unsupported research mode: ${value}`);
}

function parseFixtureDepth(value: string | undefined): ResearchCoreFixtureDepth {
  if (value === 'standard' || value === 'sinkra-dr-40') {
    return value;
  }

  throw new Error(`Unsupported fixture depth: ${value}`);
}

function createSearchEngine(options: ResearchCoreCliOptions): SearchEngine {
  if (options.engine === 'searxng') {
    if (!options.searxngUrl) {
      throw new Error('SearXNG requested but no --searxng-url or SEARXNG_BASE_URL was provided');
    }

    return new SearxngSearchEngine({ baseUrl: options.searxngUrl });
  }

  return new MockSearchEngine({
    id: 'mock',
    label: 'Mock Search',
    results: options.fixtureDepth === 'sinkra-dr-40' ? createSinkraDr40Sources(options.query) : [
      {
        title: 'Research Core Fixture Source',
        url: 'https://example.com/research-core-fixture',
        snippet: `Fixture evidence for: ${options.query}`,
      },
    ],
  });
}

function createFixtureAnswer(depth: ResearchCoreFixtureDepth): string {
  if (depth !== 'sinkra-dr-40') {
    return 'Research core fixture completed with source-backed evidence [1]. Invalid fixture citation [999].';
  }

  return [
    'Sinkra DR-40 confirms that the runtime can collect a production-depth evidence set before synthesis [1] [2] [3].',
    'The fixture keeps source indexing stable across breadth expansion and downstream Gold artifact emission [4] [5] [6].',
    'Citation validation preserves only collected source indices and leaves no unsupported references in the final answer [7] [8] [9].',
    'The evidence manifest is deep enough for reviewer sampling across process, policy, cost, and traceability concerns [10] [11] [12].',
    'The claims layer remains source-backed when the answer spans multiple independent sections of the same execution [13] [14] [15].',
    'Runtime observability keeps cost, latency, iteration, and tool-call signals attached to the emitted Gold package [16] [17] [18].',
    'The fixture models research governance with explicit boundaries instead of importing or vendoring Local Deep Research internals [19] [20] [21].',
    'The generated graph preserves links between query, collection, claims, citations, and validation artifacts [22] [23] [24].',
    'The package gives PM and QA a deterministic executive-readiness gate before any portfolio re-score is accepted [25] [26] [27].',
    'The same run can be replayed locally as a smoke fixture with at least thirty valid unique citations [28] [29] [30].',
  ].join(' ');
}

function createFixtureSearchArgs(query: string, depth: ResearchCoreFixtureDepth): { query: string; limit?: number } {
  if (depth !== 'sinkra-dr-40') {
    return { query };
  }

  return { query, limit: 40 };
}

function createSinkraDr40Sources(query: string): SourceInput[] {
  return Array.from({ length: 40 }, (_, index) => {
    const sourceNumber = index + 1;
    const padded = String(sourceNumber).padStart(2, '0');

    return {
      title: `Sinkra DR-40 Evidence Source ${padded}`,
      url: `https://example.com/sinkra-dr-40/source-${padded}`,
      snippet: `Production-depth fixture evidence ${padded} for: ${query}`,
      credibility: sourceNumber <= 30 ? 'high' : 'medium',
      publishedDate: '2026-05-19',
      authors: ['Sinkra Research Core Fixture'],
      metadata: {
        fixture: 'sinkra-dr-40',
        sourceNumber,
      },
    };
  });
}

function renderCliMarkdown(result: {
  query: string;
  engine: string;
  mode: EnginePolicyMode;
  completionReason: string;
  answer: string;
  rawAnswer: string;
  sources: Source[];
  invalidCitations: number[];
}): string {
  const sourceLines =
    result.sources.length === 0
      ? '- No sources collected.'
      : result.sources.map((source) => `- [${source.index}] ${source.title} — ${source.url}`);
  const warningLines =
    result.invalidCitations.length === 0
      ? ['- None.']
      : result.invalidCitations.map((index) => `- Removed invalid citation [${index}].`);

  return [
    '# Research Core Fixture',
    '',
    `- Query: ${result.query}`,
    `- Engine: ${result.engine}`,
    `- Mode: ${result.mode}`,
    `- Completion reason: ${result.completionReason}`,
    '',
    '## Answer',
    '',
    result.answer,
    '',
    '## Sources',
    '',
    ...sourceLines,
    '',
    '## Citation Warnings',
    '',
    ...warningLines,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  try {
    const result = await runResearchCoreCli(parseResearchCoreCliArgs(process.argv.slice(2)));
    process.stdout.write(result.markdown);
    if (result.goldArtifacts) {
      process.stdout.write(`\n## Gold Artifacts\n\n- Output dir: ${result.goldArtifacts.outputDir}\n`);
      process.stdout.write(`- Files emitted: ${result.goldArtifacts.files.length}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
