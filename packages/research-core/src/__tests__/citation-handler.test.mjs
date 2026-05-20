import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CitationHandler,
  formatSourcesForCitations,
  validateCitations,
} from '../synthesis/CitationHandler.ts';
import { MockLLMProvider } from '../testing/MockLLMProvider.ts';

const sources = [
  {
    index: 1,
    title: 'Source A',
    url: 'https://example.com/a',
    snippet: 'Snippet A',
    sourceEngine: 'mock',
  },
  {
    index: 2,
    title: 'Source B',
    url: 'https://example.com/b',
    sourceEngine: 'mock',
  },
];

test('formatSourcesForCitations uses the prompt citation format', () => {
  assert.equal(
    formatSourcesForCitations(sources),
    '[1] Source A (https://example.com/a)\nSnippet A\n\n[2] Source B (https://example.com/b)',
  );
});

test('formatSourcesForCitations handles empty sources', () => {
  assert.equal(formatSourcesForCitations([]), 'No sources collected.');
});

test('validateCitations keeps valid citations and removes invalid citations', () => {
  const result = validateCitations('Alpha [1], bad [99], beta [2], repeat [1].', sources);

  assert.equal(result.text, 'Alpha [1], bad , beta [2], repeat [1].');
  assert.deepEqual(result.validCitations, [1, 2]);
  assert.deepEqual(result.invalidCitations, [99]);
});

test('CitationHandler.synthesize validates provider output', async () => {
  const llm = new MockLLMProvider({
    responses: [{ content: 'Answer cites [1] and invalid [42].' }],
  });
  const handler = new CitationHandler(llm);

  const result = await handler.synthesize({
    question: 'What matters?',
    sources,
  });

  assert.equal(result.rawText, 'Answer cites [1] and invalid [42].');
  assert.equal(result.text, 'Answer cites [1] and invalid .');
  assert.deepEqual(result.validCitations, [1]);
  assert.deepEqual(result.invalidCitations, [42]);
  assert.match(llm.getRequests()[0].messages[1].content, /Available sources:/);
});

test('CitationHandler.synthesize includes previous answer when provided', async () => {
  const llm = new MockLLMProvider({
    responses: [{ content: 'Refined answer [2].' }],
  });
  const handler = new CitationHandler(llm);

  await handler.synthesize({
    question: 'What matters?',
    sources,
    previousAnswer: 'Draft answer.',
  });

  assert.match(llm.getRequests()[0].messages[1].content, /Previous draft:\nDraft answer\./);
});
