import assert from 'node:assert/strict';
import test from 'node:test';

import { assertSafeFetchUrl } from '../security/ssrf-validator.ts';
import { createFetchUrlTool, extractReadableText } from '../tools/fetch-url.ts';

test('assertSafeFetchUrl blocks unsafe destinations', () => {
  assert.throws(() => assertSafeFetchUrl('file:///etc/passwd'), /blocked protocol/);
  assert.throws(() => assertSafeFetchUrl('http://localhost:3000'), /blocked hostname/);
  assert.throws(() => assertSafeFetchUrl('http://127.0.0.1'), /blocked private address/);
  assert.throws(() => assertSafeFetchUrl('http://10.0.0.5'), /blocked private address/);
  assert.throws(() => assertSafeFetchUrl('http://192.168.0.1'), /blocked private address/);
  assert.throws(() => assertSafeFetchUrl('http://172.16.0.1'), /blocked private address/);
  assert.throws(() => assertSafeFetchUrl('http://[::1]'), /blocked private address/);
});

test('extractReadableText strips scripts, styles and tags', () => {
  const text = extractReadableText(`
    <html>
      <style>.x { color: red; }</style>
      <script>alert("x")</script>
      <body><h1>Title &amp; More</h1><p>Hello&nbsp;world.</p></body>
    </html>
  `);

  assert.equal(text, 'Title & More Hello world.');
});

test('fetch_url fetches HTML through injected fetch implementation', async () => {
  let receivedSignal = null;
  const tool = createFetchUrlTool({
    timeoutMs: 100,
    fetchImpl: async (_url, init) => {
      receivedSignal = init.signal;
      return new Response('<h1>Title</h1><p>Body &amp; text.</p>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    },
  });

  const output = await tool.execute({ url: 'https://example.com/page', focus: 'pricing' });

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.match(String(output), /Fetched https:\/\/example.com\/page/);
  assert.match(String(output), /Focus: pricing/);
  assert.match(String(output), /Title Body & text\./);
});

test('fetch_url returns text errors for blocked URLs without calling fetch', async () => {
  const tool = createFetchUrlTool({
    fetchImpl: async () => {
      throw new Error('should not be called');
    },
  });

  const output = await tool.execute({ url: 'http://localhost/private' });

  assert.match(String(output), /blocked hostname/);
});

test('fetch_url returns text errors for HTTP failures and missing URL', async () => {
  const tool = createFetchUrlTool({
    fetchImpl: async () => new Response('nope', { status: 404 }),
  });

  assert.match(String(await tool.execute({ url: 'https://example.com/missing' })), /HTTP 404/);
  assert.equal(await tool.execute({}), 'Fetch failed: url is required.');
});
