import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildGoldArtifacts,
  emitGoldArtifacts,
} from '../output/GoldAdapter.ts';

const require = createRequire(import.meta.url);
const repoRoot = resolve(fileURLToPath(new URL('../../../../../../', import.meta.url)));
const { validateResearch } = require(join(repoRoot, 'scripts/research-intelligence-validate.cjs'));

const source = {
  index: 1,
  title: 'Fixture Source',
  url: 'https://example.com/source',
  snippet: 'Fixture evidence',
  sourceEngine: 'mock',
};

const runtimeMetrics = {
  schema: 'sinkra.research-core.runtime-metrics.v1',
  provider: 'mock-llm',
  startedAt: '2026-05-19T12:00:00.000Z',
  completedAt: '2026-05-19T12:00:01.000Z',
  durationMs: 1000,
  completionReason: 'natural',
  iterationsUsed: 1,
  totals: {
    llmCalls: 2,
    toolCalls: 1,
    inputTokens: 30,
    outputTokens: 12,
    totalTokens: 42,
    sourcesCollected: 1,
    errors: 0,
  },
  llmCalls: [
    {
      provider: 'mock-llm',
      phase: 'agent',
      iteration: 0,
      durationMs: 10,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      toolCallsCount: 1,
    },
    {
      provider: 'mock-llm',
      phase: 'agent',
      iteration: 1,
      durationMs: 10,
      inputTokens: 20,
      outputTokens: 7,
      totalTokens: 27,
      toolCallsCount: 0,
    },
  ],
  toolCalls: [
    {
      tool: 'web_search',
      iteration: 0,
      durationMs: 5,
      status: 'success',
      args: { query: 'fixture', api_key: 'sk-testsecret12345' },
      resultSummary: 'Authorization: Bearer sk-othersecret12345',
    },
  ],
  errors: [],
  redaction: {
    applied: true,
    count: 2,
    types: ['api_key', 'bearer_token'],
  },
};

test('buildGoldArtifacts emits research-intelligence core and Gold files', () => {
  const artifacts = buildGoldArtifacts({
    outputDir: '/tmp/research-core-gold',
    query: 'How should research-core emit Gold artifacts?',
    answer: 'GoldAdapter turns validated runtime output into source-backed artifacts [1].',
    sources: [source],
    engine: 'mock',
    completionReason: 'natural',
  });
  const files = artifacts.map((artifact) => artifact.file).sort();

  assert.deepEqual(files, [
    '00-query-original.md',
    '01-deep-research-prompt.md',
    '02-research-report.md',
    '03-recommendations.md',
    'README.md',
    'claims.yaml',
    'execution-log.jsonl',
    'metrics.yaml',
    'pipeline-state.yaml',
    'research-contract.json',
    'research-graph.json',
    'sources.yaml',
    'validation-report.yaml',
  ]);
});

test('buildGoldArtifacts emits redacted runtime cost and trace artifacts when metrics are provided', () => {
  const artifacts = buildGoldArtifacts({
    outputDir: '/tmp/research-core-gold',
    query: 'How should research-core emit runtime observability?',
    answer: 'Runtime metrics should be attached to Gold outputs [1].',
    sources: [source],
    engine: 'mock',
    completionReason: 'natural',
    runtimeMetrics,
  });
  const files = artifacts.map((artifact) => artifact.file).sort();
  const trace = artifacts.find((artifact) => artifact.file === 'trace.jsonl')?.content ?? '';

  assert.equal(files.length, 15);
  assert.ok(files.includes('cost-latency.yaml'));
  assert.ok(files.includes('trace.jsonl'));
  assert.doesNotMatch(trace, /sk-testsecret12345|sk-othersecret12345/);
  assert.match(trace, /REDACTED/);
});

test('emitGoldArtifacts writes a package accepted by research:intelligence:validate', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'research-core-gold-'));
  const result = await emitGoldArtifacts({
    outputDir,
    query: 'Validate GoldAdapter fixture',
    answer: 'The fixture preserves evidence and cites the collected source [1]. Invalid citation [42].',
    sources: [source],
    engine: 'mock',
    completionReason: 'natural',
    invalidCitations: [42],
    runtimeMetrics,
  });

  assert.equal(result.files.length, 15);
  assert.equal(result.metrics.sources, 1);
  assert.ok(result.metrics.graphNodes >= 8);
  assert.ok(result.metrics.graphEdges >= 8);

  const sourcesYaml = await readFile(join(outputDir, 'sources.yaml'), 'utf8');
  assert.match(sourcesYaml, /Fixture Source/);

  const validation = validateResearch(outputDir);
  assert.equal(validation.ok, true, JSON.stringify(validation.findings, null, 2));
  assert.equal(validation.metrics.sources, 1);
  assert.ok(validation.metrics.goldArtifacts >= 3);
});
