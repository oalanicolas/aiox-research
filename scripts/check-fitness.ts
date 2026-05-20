import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AgentLoop,
  SearchResultsCollector,
  assertSafeFetchUrl,
  buildGoldArtifacts,
  createFetchUrlTool,
  createResearchMetricsRecorder,
  runResearchCoreCli,
  createResearchSubtopicTool,
  MockLLMProvider,
  redactJsonValue,
  redactText,
  validateCitations,
  assertEnginePolicyAllowed,
} from '../packages/research-core/src/index.ts';
import type { LLMResponse, Source, Tool } from '../packages/research-core/src/index.ts';
import type { MockLLMProviderConfig } from '../packages/research-core/src/testing/MockLLMProvider.ts';

interface FitnessCheck {
  id: string;
  name: string;
  run: () => Promise<void> | void;
}

interface FitnessResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
}

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const checks: FitnessCheck[] = [
  {
    id: 'LDR-FF-001',
    name: 'No direct Local Deep Research Python import or vendored runtime dependency',
    run: checkNoDirectLdrImport,
  },
  {
    id: 'LDR-FF-003',
    name: 'Gold runtime artifacts include sources, claims, report, cost-latency and trace',
    run: checkGoldTraceArtifacts,
  },
  {
    id: 'SINKRA-FF-DEPTH-001',
    name: 'Sinkra DR-40 fixture emits 40 sources and 30+ valid citations',
    run: checkSinkraDr40FixtureDepth,
  },
  {
    id: 'LDR-FF-005',
    name: 'Provider credentials are redacted from text and JSON traces',
    run: checkRedaction,
  },
  {
    id: 'SINKRA-FF-CITE-001',
    name: 'Citation indices remain unique under concurrent collector writes',
    run: checkConcurrentCollectorIndices,
  },
  {
    id: 'SINKRA-FF-CITE-002',
    name: 'Citation validation removes references to missing source indices',
    run: checkCitationValidation,
  },
  {
    id: 'SINKRA-FF-CITE-003',
    name: 'findByUrl returns the same source index for normalized duplicate URLs',
    run: checkCollectorDeduplication,
  },
  {
    id: 'SINKRA-FF-AGENT-001',
    name: 'AgentLoop enforces maxIterations',
    run: checkMaxIterations,
  },
  {
    id: 'SINKRA-FF-AGENT-002',
    name: 'AgentLoop detects repeated tool-call loops and forces synthesis',
    run: checkLoopDetection,
  },
  {
    id: 'SINKRA-FF-AGENT-003',
    name: 'research_subtopic depth is capped',
    run: checkSubtopicDepthCap,
  },
  {
    id: 'SINKRA-FF-AGENT-004',
    name: 'AgentLoop timeout produces a timeout completion reason',
    run: checkTimeout,
  },
  {
    id: 'SINKRA-FF-SEC-001',
    name: 'fetch_url routes URL validation through SSRF guard before fetch',
    run: checkFetchUrlSsrfGuard,
  },
  {
    id: 'SINKRA-FF-SEC-003',
    name: 'fetch_url uses AbortController timeout wiring',
    run: checkFetchUrlTimeout,
  },
  {
    id: 'SINKRA-FF-COST-001',
    name: 'Every AgentLoop research returns runtime metrics',
    run: checkRuntimeMetrics,
  },
  {
    id: 'SINKRA-FF-ENG-001',
    name: 'Engine policy supports mode defaults when engines are not declared',
    run: checkEngineModeDefaults,
  },
  {
    id: 'SINKRA-FF-ENG-002',
    name: 'Engine policy blocks engines outside the active mode allowlist',
    run: checkEngineAllowlist,
  },
  {
    id: 'SINKRA-FF-ENG-003',
    name: 'Private mode allows local engines only',
    run: checkPrivateModeLocalOnly,
  },
  {
    id: 'SINKRA-FF-ENG-004',
    name: 'API key engines require tenant config',
    run: checkApiKeyEngines,
  },
  {
    id: 'SINKRA-FF-ENG-005',
    name: 'Collection engines require workspace ownership match',
    run: checkCollectionIsolation,
  },
];

const results: FitnessResult[] = [];

for (const check of checks) {
  try {
    await check.run();
    results.push({ id: check.id, name: check.name, status: 'PASS' });
  } catch (error) {
    results.push({
      id: check.id,
      name: check.name,
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

for (const result of results) {
  const suffix = result.status === 'FAIL' ? ` - ${result.error}` : '';
  console.log(`${result.status} ${result.id}: ${result.name}${suffix}`);
}

const failed = results.filter((result) => result.status === 'FAIL');
console.log(`\nResearch fitness gates: ${results.length - failed.length}/${results.length} passed`);

if (failed.length > 0) {
  process.exitCode = 1;
}

async function checkNoDirectLdrImport(): Promise<void> {
  const scannedFiles = await listCodeFiles([
    path.join(appRoot, 'packages', 'research-core', 'src'),
    path.join(appRoot, 'src', 'lib'),
    path.join(appRoot, 'scripts'),
  ]);
  const directImportPattern =
    /\b(?:import\s+[^'"]*\s+from\s*|import\s*\(|require\s*\()\s*['"][^'"]*(?:local_deep_research|local-deep-research)[^'"]*['"]/;
  const pythonBridgePattern =
    /\b(?:python|python3|pyodide|child_process|spawn|execFile)\b[\s\S]{0,160}(?:local_deep_research|local-deep-research)/;
  const violations: string[] = [];

  for (const file of scannedFiles) {
    if (file.endsWith(path.join('scripts', 'check-fitness.ts'))) continue;
    const content = await readFile(file, 'utf8');
    if (directImportPattern.test(content) || pythonBridgePattern.test(content)) {
      violations.push(path.relative(appRoot, file));
    }
  }

  assert(
    violations.length === 0,
    `direct Local Deep Research runtime dependency found in ${violations.join(', ')}`,
  );
}

function checkGoldTraceArtifacts(): void {
  const metrics = createSampleMetrics();
  const artifacts = buildGoldArtifacts({
    outputDir: '/tmp/research-core-fitness',
    query: 'fitness gate query',
    answer: 'Research core emits source-backed traces [1].',
    sources: sampleSources(),
    engine: 'mock',
    completionReason: 'natural',
    runtimeMetrics: metrics,
  });
  const files = new Set(artifacts.map((artifact) => artifact.file));

  for (const required of [
    'sources.yaml',
    'claims.yaml',
    '02-research-report.md',
    'cost-latency.yaml',
    'trace.jsonl',
  ]) {
    assert(files.has(required), `missing ${required}`);
  }

  const trace = artifacts.find((artifact) => artifact.file === 'trace.jsonl')?.content ?? '';
  assert(trace.includes('"event":"run_started"'), 'trace.jsonl missing run_started event');
  assert(trace.includes('"event":"run_completed"'), 'trace.jsonl missing run_completed event');
  assert(!/sk-testsecret|raw-password/.test(trace), 'trace.jsonl leaked known secret fixture');
}

async function checkSinkraDr40FixtureDepth(): Promise<void> {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'research-core-dr40-fitness-'));
  const result = await runResearchCoreCli({
    query: 'Sinkra DR-40 fitness gate',
    engine: 'mock',
    mode: 'public',
    maxIterations: 4,
    fixtureDepth: 'sinkra-dr-40',
    goldOutputDir: outputDir,
    goldSlug: 'sinkra-dr-40-fitness',
  });
  const validUniqueCitations = new Set(
    [...result.answer.matchAll(/\[(\d+)\]/g)].map((match) => Number.parseInt(match[1] ?? '', 10)),
  );

  assert.equal(result.sources.length, 40, 'Sinkra DR-40 fixture must collect 40 sources');
  assert(validUniqueCitations.size >= 30, 'Sinkra DR-40 fixture must retain at least 30 unique citations');
  assert.deepEqual(result.invalidCitations, [], 'Sinkra DR-40 fixture must not emit invalid citations');
  assert.equal(result.goldArtifacts?.metrics.sources, 40, 'Gold metrics must preserve source count');
  assert.ok(result.goldArtifacts?.files.includes('sources.yaml'), 'Sinkra DR-40 fixture must emit sources.yaml');
  assert.ok(result.goldArtifacts?.files.includes('claims.yaml'), 'Sinkra DR-40 fixture must emit claims.yaml');
  assert.ok(result.goldArtifacts?.files.includes('cost-latency.yaml'), 'Sinkra DR-40 fixture must emit cost-latency.yaml');
  assert.ok(result.goldArtifacts?.files.includes('trace.jsonl'), 'Sinkra DR-40 fixture must emit trace.jsonl');
}

function checkRedaction(): void {
  const redactedText = redactText(
    'Authorization: Bearer sk-testsecret12345 api_key=sk-othersecret12345 password=raw-password',
  );
  const redactedJson = redactJsonValue({
    safe: 'value',
    api_key: 'sk-testsecret12345',
    nested: {
      password: 'raw-password',
      url: 'https://example.com/?token=raw-token',
    },
  });
  const serialized = `${redactedText.value}\n${JSON.stringify(redactedJson.value)}`;

  assert(!/sk-testsecret12345|sk-othersecret12345|raw-password|raw-token/.test(serialized), 'secret remained after redaction');
  assert(redactedText.report.count >= 3, 'text redaction did not report expected replacements');
  assert(redactedJson.report.count >= 3, 'JSON redaction did not report expected replacements');
}

async function checkConcurrentCollectorIndices(): Promise<void> {
  const collector = new SearchResultsCollector();

  await Promise.all(
    Array.from({ length: 100 }, (_, index) =>
      collector.add(
        [
          {
            title: `Source ${index + 1}`,
            url: `https://example.com/source-${index + 1}`,
            snippet: 'fitness source',
          },
        ],
        'fitness',
      ),
    ),
  );

  const indices = collector.getAll().map((source) => source.index);
  const unique = new Set(indices);

  assert.equal(collector.size(), 100, 'collector did not retain 100 unique sources');
  assert.equal(unique.size, 100, 'collector produced duplicate indices');
  assert.equal(Math.min(...indices), 1, 'collector index sequence should start at 1');
  assert.equal(Math.max(...indices), 100, 'collector index sequence should end at 100');
}

function checkCitationValidation(): void {
  const validation = validateCitations('Valid [1], invalid [99].', sampleSources());

  assert.deepEqual(validation.validCitations, [1], 'valid citation was not retained');
  assert.deepEqual(validation.invalidCitations, [99], 'invalid citation was not reported');
  assert.equal(validation.text, 'Valid [1], invalid .', 'invalid citation was not stripped from text');
}

async function checkCollectorDeduplication(): Promise<void> {
  const collector = new SearchResultsCollector();

  await collector.add(
    [
      {
        title: 'Canonical',
        url: 'HTTPS://Example.com/article/?b=2&a=1#section',
        snippet: 'first',
      },
    ],
    'fitness',
  );
  await collector.add(
    [
      {
        title: 'Duplicate',
        url: 'https://example.com/article?a=1&b=2',
        snippet: 'second',
      },
    ],
    'fitness',
  );

  assert.equal(collector.size(), 1, 'normalized duplicate URL was inserted twice');
  assert.equal(collector.findByUrl('https://example.com/article?b=2&a=1'), 1, 'findByUrl did not return canonical index');
}

async function checkMaxIterations(): Promise<void> {
  const loop = createToolLoop({
    maxIterations: 2,
    loopDetectionWindow: 10,
    handler: (request, index) => {
      if (request.toolChoice === 'none') return { content: 'forced synthesis [1]' };
      return {
        content: `iteration ${index}`,
        toolCalls: [{ id: `call-${index}`, name: 'fitness_tool', args: { index } }],
      };
    },
  });

  const result = await loop.run('repeat until max iterations');

  assert.equal(result.completionReason, 'max_iterations', 'AgentLoop did not stop at max_iterations');
  assert.equal(result.iterationsUsed, 2, 'AgentLoop exceeded configured maxIterations');
}

async function checkLoopDetection(): Promise<void> {
  const loop = createToolLoop({
    maxIterations: 10,
    loopDetectionWindow: 3,
    handler: (request) => {
      if (request.toolChoice === 'none') return { content: 'forced synthesis [1]' };
      return {
        content: 'same tool call',
        toolCalls: [{ id: 'same-call', name: 'fitness_tool', args: { query: 'same' } }],
      };
    },
  });

  const result = await loop.run('detect loop');

  assert.equal(result.completionReason, 'loop_detected', 'AgentLoop did not detect repeated tool calls');
  assert(result.iterationsUsed <= 2, 'loop detection used more iterations than expected');
}

async function checkSubtopicDepthCap(): Promise<void> {
  const collector = new SearchResultsCollector();
  const tool = createResearchSubtopicTool({
    collector,
    maxDepth: 1,
    createLoop: () => {
      throw new Error('subtopic loop should not run at blocked depth');
    },
  });
  const result = await tool.execute({ subtopics: ['blocked child research'], depth: 1 });

  assert.equal(asObject(result).status, 'blocked', 'research_subtopic did not block at maxDepth');
  assert.match(String(asObject(result).error), /maxDepth 1 reached/);
}

async function checkTimeout(): Promise<void> {
  const loop = createToolLoop({
    maxIterations: 5,
    timeoutMs: -1,
    handler: (request): LLMResponse => {
      if (request.toolChoice === 'none') return { content: 'timeout synthesis [1]' };
      return { content: 'should not request tools' };
    },
  });

  const result = await loop.run('timeout immediately');

  assert.equal(result.completionReason, 'timeout', 'AgentLoop timeout did not return timeout reason');
  assert.equal(result.iterationsUsed, 0, 'timeout before provider request should use 0 iterations');
}

async function checkFetchUrlSsrfGuard(): Promise<void> {
  assert.throws(() => assertSafeFetchUrl('http://127.0.0.1/private'), /blocked private address/);

  let fetchCalled = false;
  const tool = createFetchUrlTool({
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response('should not happen', { status: 200 });
    },
  });
  const result = await tool.execute({ url: 'http://localhost/private' });

  assert.match(String(result), /blocked hostname/);
  assert.equal(fetchCalled, false, 'fetch_url called fetchImpl for a blocked URL');
}

async function checkFetchUrlTimeout(): Promise<void> {
  let signalSeen = false;
  const tool = createFetchUrlTool({
    timeoutMs: 100,
    fetchImpl: async (_url, init) => {
      signalSeen = init?.signal instanceof AbortSignal;
      return new Response('<p>ok</p>', { status: 200 });
    },
  });

  await tool.execute({ url: 'https://example.com/ok' });

  assert.equal(signalSeen, true, 'fetch_url did not pass AbortSignal to fetch');
}

async function checkRuntimeMetrics(): Promise<void> {
  const loop = createToolLoop({
    maxIterations: 1,
    handler: () => ({
      content: 'answer without tools [1]',
      usage: {
        inputTokens: 7,
        outputTokens: 5,
        totalTokens: 12,
      },
    }),
  });

  const result = await loop.run('metrics');

  assert.equal(result.metrics.schema, 'sinkra.research-core.runtime-metrics.v1');
  assert.equal(result.metrics.provider, 'fitness-llm');
  assert.equal(result.metrics.totals.llmCalls, 1);
  assert.equal(result.metrics.totals.totalTokens, 12);
  assert.equal(result.metrics.completionReason, 'natural');
}

function checkEngineModeDefaults(): void {
  const result = assertEnginePolicyAllowed({ mode: 'public' });

  assert.deepEqual(result.engines, [
    'searxng',
    'arxiv',
    'pubmed',
    'semantic_scholar',
    'openalex',
    'wikipedia',
    'github',
    'ddg',
  ]);
}

function checkEngineAllowlist(): void {
  assert.doesNotThrow(() =>
    assertEnginePolicyAllowed({
      mode: 'public',
      engines: ['searxng', 'openalex'],
    }),
  );
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'public',
        engine: 'auto',
      }),
    /not allowed|explicitly denied/,
  );
}

function checkPrivateModeLocalOnly(): void {
  assert.doesNotThrow(() =>
    assertEnginePolicyAllowed({
      mode: 'private',
      engine: 'library',
    }),
  );
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'private',
        engine: 'searxng',
      }),
    /not allowed in mode "private"/,
  );
}

function checkApiKeyEngines(): void {
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'premium',
        engine: 'brave',
      }),
    /requires a configured tenant key/,
  );
  assert.doesNotThrow(() =>
    assertEnginePolicyAllowed({
      mode: 'premium',
      engine: 'brave',
      configuredEngineKeys: ['brave'],
    }),
  );
}

function checkCollectionIsolation(): void {
  assert.doesNotThrow(() =>
    assertEnginePolicyAllowed({
      mode: 'private',
      engine: 'collection_valid',
      workspaceId: 'workspace-a',
      collectionWorkspaceIds: {
        collection_valid: 'workspace-a',
      },
    }),
  );
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'private',
        engine: 'collection_valid',
        workspaceId: 'workspace-a',
        collectionWorkspaceIds: {
          collection_valid: 'workspace-b',
        },
      }),
    /not "workspace-a"/,
  );
}

function createToolLoop(input: {
  handler: NonNullable<MockLLMProviderConfig['handler']>;
  maxIterations?: number;
  timeoutMs?: number;
  loopDetectionWindow?: number;
}): AgentLoop {
  const collector = new SearchResultsCollector();
  const tool: Tool = {
    name: 'fitness_tool',
    description: 'Fitness gate test tool.',
    inputSchema: { type: 'object', additionalProperties: true },
    async execute() {
      await collector.add(sampleSources(), 'fitness');
      return 'fitness tool result [1]';
    },
  };

  return new AgentLoop({
    llm: new MockLLMProvider({ id: 'fitness-llm', handler: input.handler }),
    collector,
    tools: [tool],
    maxIterations: input.maxIterations,
    timeoutMs: input.timeoutMs,
    loopDetectionWindow: input.loopDetectionWindow,
  });
}

function createSampleMetrics() {
  const recorder = createResearchMetricsRecorder({
    provider: 'fitness-llm',
    startedAt: new Date('2026-05-19T00:00:00.000Z'),
  });

  recorder.recordLlmCall({
    provider: 'fitness-llm',
    phase: 'agent',
    iteration: 0,
    durationMs: 12,
    response: {
      content: 'tool use',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  });
  recorder.recordToolCall({
    tool: 'web_search',
    iteration: 0,
    durationMs: 8,
    status: 'success',
    args: { query: 'fitness', api_key: 'sk-testsecret12345' },
    resultSummary: 'Authorization: Bearer sk-testsecret67890',
  });

  return recorder.complete({
    completionReason: 'natural',
    iterationsUsed: 1,
    sourcesCollected: 1,
  });
}

function sampleSources(): Source[] {
  return [
    {
      index: 1,
      title: 'Fitness Source',
      url: 'https://example.com/fitness-source',
      snippet: 'Evidence for fitness checks.',
      sourceEngine: 'fitness',
    },
  ];
}

async function listCodeFiles(roots: string[]): Promise<string[]> {
  const files: string[] = [];
  const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
  const ignoredDirs = new Set(['node_modules', '.next', 'dist', 'build', 'coverage']);

  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) await visit(absolute);
        continue;
      }

      if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
        files.push(absolute);
      }
    }
  }

  for (const root of roots) {
    await visit(root);
  }

  return files;
}

function asObject(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === 'object', 'expected object result');
  return value as Record<string, unknown>;
}
