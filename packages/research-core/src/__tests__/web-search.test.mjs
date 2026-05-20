import assert from 'node:assert/strict';
import test from 'node:test';

import { SearchResultsCollector } from '../collector/Collector.ts';
import { MockSearchEngine } from '../testing/MockSearchEngine.ts';
import { createWebSearchTool } from '../tools/web-search.ts';

test('web_search adds mock engine results to the collector', async () => {
  const collector = new SearchResultsCollector();
  const engine = new MockSearchEngine({
    id: 'mock',
    results: [
      {
        title: 'Result A',
        url: 'https://example.com/a',
        snippet: 'Snippet A',
      },
      {
        title: 'Result B',
        url: 'https://example.com/b',
      },
    ],
  });
  const tool = createWebSearchTool({ collector, engines: [engine], defaultLimit: 1 });

  const output = await tool.execute({ query: 'research runtime' });

  assert.equal(collector.size(), 1);
  assert.match(String(output), /\[1\] Result A \(https:\/\/example.com\/a\)/);
  assert.deepEqual(engine.getQueries().map((entry) => entry.query), ['research runtime']);
});

test('web_search supports multiple engines and preserves sourceEngine', async () => {
  const collector = new SearchResultsCollector();
  const first = new MockSearchEngine({
    id: 'first',
    results: [{ title: 'First', url: 'https://first.example' }],
  });
  const second = new MockSearchEngine({
    id: 'second',
    results: [{ title: 'Second', url: 'https://second.example' }],
  });
  const tool = createWebSearchTool({ collector, engines: [first, second] });

  const output = await tool.execute({ query: 'q', engines: ['first', 'second'] });

  assert.match(String(output), /\[1\] First/);
  assert.match(String(output), /\[2\] Second/);
  assert.deepEqual(
    collector.getAll().map((source) => source.sourceEngine),
    ['first', 'second'],
  );
});

test('web_search returns text errors for unknown engines', async () => {
  const collector = new SearchResultsCollector();
  const engine = new MockSearchEngine({ id: 'known' });
  const tool = createWebSearchTool({ collector, engines: [engine] });

  const output = await tool.execute({ query: 'q', engine: 'missing' });

  assert.equal(collector.size(), 0);
  assert.match(String(output), /unknown engine "missing"/);
});

test('web_search blocks engines disallowed by configured policy before calling engine', async () => {
  const collector = new SearchResultsCollector();
  let called = false;
  const engine = new MockSearchEngine({
    id: 'searxng',
    handler() {
      called = true;
      return [{ title: 'Should not appear', url: 'https://blocked.example' }];
    },
  });
  const tool = createWebSearchTool({
    collector,
    engines: [engine],
    enginePolicy: { mode: 'private' },
  });

  const output = await tool.execute({ query: 'q', engine: 'searxng' });

  assert.equal(called, false);
  assert.equal(collector.size(), 0);
  assert.match(String(output), /engine policy blocked request/);
  assert.match(String(output), /not allowed in mode "private"/);
});

test('web_search returns text errors for engine failures', async () => {
  const collector = new SearchResultsCollector();
  const engine = new MockSearchEngine({
    id: 'broken',
    handler() {
      throw new Error('engine offline');
    },
  });
  const tool = createWebSearchTool({ collector, engines: [engine] });

  const output = await tool.execute({ query: 'q' });

  assert.equal(collector.size(), 0);
  assert.match(String(output), /broken: engine offline/);
});

test('web_search reports missing query without throwing', async () => {
  const collector = new SearchResultsCollector();
  const engine = new MockSearchEngine({ id: 'mock' });
  const tool = createWebSearchTool({ collector, engines: [engine] });

  const output = await tool.execute({});

  assert.equal(output, 'Search failed: query is required.');
});
