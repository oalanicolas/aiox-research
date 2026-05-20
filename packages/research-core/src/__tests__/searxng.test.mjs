import assert from 'node:assert/strict';
import test from 'node:test';

import { SearxngSearchEngine } from '../engines/searxng.ts';

test('SearxngSearchEngine maps JSON results to SourceInput', async () => {
  let requestedUrl = null;
  let receivedSignal = null;
  const engine = new SearxngSearchEngine({
    baseUrl: 'http://searxng.local:8080',
    fetchImpl: async (url, init) => {
      requestedUrl = url;
      receivedSignal = init.signal;
      return Response.json({
        results: [
          {
            title: 'Result A',
            url: 'https://example.com/a',
            content: 'Snippet A',
            engine: 'duckduckgo',
            publishedDate: '2026-05-19',
          },
          {
            title: 'No URL',
            content: 'skip me',
          },
          {
            url: 'https://example.com/b',
          },
        ],
      });
    },
  });

  const results = await engine.search('research core', { limit: 2 });
  const parsed = new URL(requestedUrl);

  assert.equal(parsed.pathname, '/search');
  assert.equal(parsed.searchParams.get('q'), 'research core');
  assert.equal(parsed.searchParams.get('format'), 'json');
  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.deepEqual(results, [
    {
      title: 'Result A',
      url: 'https://example.com/a',
      snippet: 'Snippet A',
      publishedDate: '2026-05-19',
      metadata: { searxngEngine: 'duckduckgo' },
    },
    {
      title: 'https://example.com/b',
      url: 'https://example.com/b',
      snippet: undefined,
      publishedDate: undefined,
      metadata: { searxngEngine: undefined },
    },
  ]);
});

test('SearxngSearchEngine throws clear errors for non-OK responses', async () => {
  const engine = new SearxngSearchEngine({
    baseUrl: 'https://searxng.example',
    fetchImpl: async () => new Response('nope', { status: 503 }),
  });

  await assert.rejects(() => engine.search('q'), /SearXNG HTTP 503/);
});
