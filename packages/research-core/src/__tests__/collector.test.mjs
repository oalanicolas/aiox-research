import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SearchResultsCollector,
  normalizeSourceUrl,
} from '../collector/Collector.ts';

test('SearchResultsCollector assigns unique sequential indices with parallel adds', async () => {
  const collector = new SearchResultsCollector();

  await Promise.all(
    Array.from({ length: 100 }, (_, index) =>
      collector.add(
        [
          {
            title: `Source ${index}`,
            url: `https://example.com/${index}`,
            snippet: `Snippet ${index}`,
          },
        ],
        'test',
      ),
    ),
  );

  const sources = collector.getAll();
  assert.equal(sources.length, 100);
  assert.deepEqual(
    sources.map((source) => source.index),
    Array.from({ length: 100 }, (_, index) => index + 1),
  );
});

test('SearchResultsCollector handles variable batches under concurrency', async () => {
  const collector = new SearchResultsCollector();

  await Promise.all([
    collector.add(
      Array.from({ length: 5 }, (_, index) => ({
        title: `A${index}`,
        url: `https://a.example/${index}`,
      })),
      'a',
    ),
    collector.add(
      Array.from({ length: 3 }, (_, index) => ({
        title: `B${index}`,
        url: `https://b.example/${index}`,
      })),
      'b',
    ),
    collector.add(
      Array.from({ length: 7 }, (_, index) => ({
        title: `C${index}`,
        url: `https://c.example/${index}`,
      })),
      'c',
    ),
  ]);

  const sources = collector.getAll();
  assert.equal(sources.length, 15);
  assert.equal(new Set(sources.map((source) => source.index)).size, 15);
});

test('SearchResultsCollector deduplicates canonical URLs and DOI values', async () => {
  const collector = new SearchResultsCollector();

  await collector.add(
    [
      {
        title: 'Canonical',
        url: 'https://EXAMPLE.com/a/?b=2&a=1#section',
        doi: 'https://doi.org/10.1000/ABC',
      },
    ],
    'first',
  );
  await collector.add(
    [
      {
        title: 'Duplicate URL',
        url: 'https://example.com/a?a=1&b=2',
      },
      {
        title: 'Duplicate DOI',
        url: 'https://other.example/paper',
        doi: '10.1000/abc',
      },
    ],
    'second',
  );

  assert.equal(collector.size(), 1);
  assert.equal(collector.findByUrl('https://example.com/a?b=2&a=1'), 1);
  assert.equal(collector.findByDoi('10.1000/abc'), 1);
});

test('SearchResultsCollector returns clones from getAll', async () => {
  const collector = new SearchResultsCollector();

  await collector.add(
    [
      {
        title: 'Source',
        url: 'https://example.com/source',
        authors: ['Ada'],
        metadata: { tier: 'gold' },
      },
    ],
    'test',
  );

  const snapshot = collector.getAll();
  snapshot[0].title = 'Mutated';
  snapshot[0].authors?.push('Grace');
  snapshot[0].metadata = { tier: 'mutated' };

  const current = collector.getAll()[0];
  assert.equal(current.title, 'Source');
  assert.deepEqual(current.authors, ['Ada']);
  assert.deepEqual(current.metadata, { tier: 'gold' });
});

test('SearchResultsCollector formats sources for citation prompts', async () => {
  const collector = new SearchResultsCollector();

  await collector.add(
    [
      {
        title: 'Page A',
        url: 'https://example.com/a',
        snippet: 'Snippet A',
      },
      {
        title: 'Page B',
        url: 'https://example.com/b',
      },
    ],
    'test',
  );

  assert.equal(
    collector.format(),
    '[1] Page A (https://example.com/a)\nSnippet A\n\n[2] Page B (https://example.com/b)',
  );
});

test('SearchResultsCollector reset clears state', async () => {
  const collector = new SearchResultsCollector();

  await collector.add(
    [
      {
        title: 'Source',
        url: 'https://example.com/source',
      },
    ],
    'test',
  );

  collector.reset();

  assert.equal(collector.size(), 0);
  assert.equal(collector.findByUrl('https://example.com/source'), null);
  assert.equal(collector.format(), 'No results.');
});

test('normalizeSourceUrl keeps invalid URLs stable after trimming', () => {
  assert.equal(normalizeSourceUrl(' not-a-url '), 'not-a-url');
});
