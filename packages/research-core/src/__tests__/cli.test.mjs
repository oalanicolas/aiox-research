import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  parseResearchCoreCliArgs,
  runResearchCoreCli,
} from '../cli.ts';

const require = createRequire(import.meta.url);
const repoRoot = resolve(fileURLToPath(new URL('../../../../../../', import.meta.url)));
const { validateResearch } = require(join(repoRoot, 'scripts/research-intelligence-validate.cjs'));

test('parseResearchCoreCliArgs defaults to mock engine without SEARXNG_BASE_URL', () => {
  assert.deepEqual(parseResearchCoreCliArgs(['hello', 'world'], {}), {
    query: 'hello world',
    engine: 'mock',
    mode: 'public',
    searxngUrl: undefined,
    maxIterations: 4,
    fixtureDepth: 'standard',
  });
});

test('parseResearchCoreCliArgs selects SearXNG from env or flags', () => {
  assert.deepEqual(parseResearchCoreCliArgs(['q'], { SEARXNG_BASE_URL: 'http://localhost:8080' }), {
    query: 'q',
    engine: 'searxng',
    mode: 'public',
    searxngUrl: 'http://localhost:8080',
    maxIterations: 4,
    fixtureDepth: 'standard',
  });
  assert.deepEqual(
    parseResearchCoreCliArgs(
      [
        '--engine',
        'searxng',
        '--searxng-url',
        'http://searxng.local',
        '--mode',
        'premium',
        '--max-iterations',
        '2',
        'q',
      ],
      {},
    ),
    {
      query: 'q',
      engine: 'searxng',
      mode: 'premium',
      searxngUrl: 'http://searxng.local',
      maxIterations: 2,
      fixtureDepth: 'standard',
    },
  );
});

test('parseResearchCoreCliArgs accepts optional Gold output flags', () => {
  assert.deepEqual(
    parseResearchCoreCliArgs(
      ['--gold-output-dir', '/tmp/research-core-gold', '--gold-slug', 'fixture-slug', 'q'],
      {},
    ),
    {
      query: 'q',
      engine: 'mock',
      mode: 'public',
      searxngUrl: undefined,
      maxIterations: 4,
      goldOutputDir: '/tmp/research-core-gold',
      goldSlug: 'fixture-slug',
      fixtureDepth: 'standard',
    },
  );
});

test('parseResearchCoreCliArgs accepts the Sinkra DR-40 fixture depth', () => {
  assert.equal(parseResearchCoreCliArgs(['--fixture-depth', 'sinkra-dr-40', 'q'], {}).fixtureDepth, 'sinkra-dr-40');
  assert.equal(parseResearchCoreCliArgs(['--sinkra-dr-40', 'q'], {}).fixtureDepth, 'sinkra-dr-40');
  assert.throws(() => parseResearchCoreCliArgs(['--fixture-depth', 'unknown', 'q'], {}), /Unsupported fixture depth/);
});

test('runResearchCoreCli emits markdown with sanitized citations and sources', async () => {
  const result = await runResearchCoreCli({
    query: 'research core',
    engine: 'mock',
    mode: 'public',
    maxIterations: 4,
  });

  assert.equal(result.engine, 'mock');
  assert.equal(result.mode, 'public');
  assert.equal(result.sources.length, 1);
  assert.equal(result.runtimeMetrics.totals.toolCalls, 1);
  assert.deepEqual(result.invalidCitations, [999]);
  assert.match(result.answer, /\[1\]/);
  assert.doesNotMatch(result.answer, /\[999\]/);
  assert.match(result.markdown, /^# Research Core Fixture/);
  assert.match(result.markdown, /Removed invalid citation \[999\]/);
});

test('runResearchCoreCli can emit a Gold artifact fixture', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'research-core-cli-gold-'));
  const result = await runResearchCoreCli({
    query: 'research core gold',
    engine: 'mock',
    mode: 'public',
    maxIterations: 4,
    goldOutputDir: outputDir,
    goldSlug: 'research-core-gold',
  });

  assert.equal(result.goldArtifacts?.files.length, 15);
  assert.ok(result.goldArtifacts?.files.includes('sources.yaml'));
  assert.ok(result.goldArtifacts?.files.includes('cost-latency.yaml'));
  assert.ok(result.goldArtifacts?.files.includes('trace.jsonl'));
  assert.ok(result.goldArtifacts?.files.includes('research-contract.json'));
});

test('runResearchCoreCli emits a Sinkra DR-40 Gold fixture with 30+ valid citations', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'research-core-sinkra-dr40-'));
  const result = await runResearchCoreCli({
    query: 'Sinkra DR-40 fixture',
    engine: 'mock',
    mode: 'public',
    maxIterations: 4,
    fixtureDepth: 'sinkra-dr-40',
    goldOutputDir: outputDir,
    goldSlug: 'sinkra-dr-40',
  });

  assert.equal(result.sources.length, 40);
  assert.deepEqual(result.invalidCitations, []);
  assert.equal(uniqueCitationCount(result.answer), 30);
  assert.equal(result.goldArtifacts?.metrics.sources, 40);
  assert.ok((result.goldArtifacts?.metrics.claims ?? 0) >= 10);

  const sourcesYaml = await readFile(join(outputDir, 'sources.yaml'), 'utf8');
  const validation = validateResearch(outputDir);

  assert.match(sourcesYaml, /Sinkra DR-40 Evidence Source 40/);
  assert.equal(validation.ok, true, JSON.stringify(validation.findings, null, 2));
  assert.equal(validation.metrics.sources, 40);
  assert.ok(validation.metrics.goldArtifacts >= 3);
});

test('runResearchCoreCli rejects real engines disallowed by policy before network use', async () => {
  await assert.rejects(
    () =>
      runResearchCoreCli({
        query: 'private research',
        engine: 'searxng',
        mode: 'private',
        searxngUrl: 'https://search.example',
        maxIterations: 1,
      }),
    /engine policy blocked request/,
  );
});

function uniqueCitationCount(text) {
  return new Set([...text.matchAll(/\[(\d+)\]/g)].map((match) => Number.parseInt(match[1], 10))).size;
}
