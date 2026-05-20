import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentLoop } from '../agent/AgentLoop.ts';
import { SearchResultsCollector } from '../collector/Collector.ts';
import { MockLLMProvider } from '../testing/MockLLMProvider.ts';
import { MockSearchEngine } from '../testing/MockSearchEngine.ts';
import { createWebSearchTool } from '../tools/web-search.ts';

test('AgentLoop stops naturally when provider returns content without tool calls', async () => {
  const collector = new SearchResultsCollector();
  const llm = new MockLLMProvider({
    responses: [{ content: 'Final answer.' }],
  });
  const loop = new AgentLoop({
    llm,
    tools: [],
    collector,
  });

  const result = await loop.run('question');

  assert.equal(result.answer, 'Final answer.');
  assert.equal(result.completionReason, 'natural');
  assert.equal(result.iterationsUsed, 0);
  assert.equal(result.metrics.completionReason, 'natural');
  assert.equal(result.metrics.totals.llmCalls, 1);
  assert.equal(result.metrics.totals.toolCalls, 0);
});

test('AgentLoop executes tool calls and continues to final answer', async () => {
  const collector = new SearchResultsCollector();
  const engine = new MockSearchEngine({
    id: 'mock',
    results: [{ title: 'Evidence', url: 'https://example.com/evidence' }],
  });
  const llm = new MockLLMProvider({
    responses: [
      {
        toolCalls: [
          {
            id: 'call-1',
            name: 'web_search',
            args: { query: 'evidence' },
          },
        ],
      },
      { content: 'Final answer with [1].' },
    ],
  });
  const events = [];
  const loop = new AgentLoop({
    llm,
    tools: [createWebSearchTool({ collector, engines: [engine] })],
    collector,
    onProgress(event) {
      events.push(event.type);
    },
  });

  const result = await loop.run('question');

  assert.equal(result.answer, 'Final answer with [1].');
  assert.equal(result.completionReason, 'natural');
  assert.equal(result.sources.length, 1);
  assert.equal(result.metrics.totals.llmCalls, 2);
  assert.equal(result.metrics.totals.toolCalls, 1);
  assert.equal(result.metrics.totals.sourcesCollected, 1);
  assert.deepEqual(events, ['provider_request', 'provider_response', 'tool_call', 'tool_result', 'provider_request', 'provider_response']);
  assert.equal(llm.getRequests()[1].messages.at(-1).role, 'tool');
});

test('AgentLoop forces synthesis after maxIterations', async () => {
  const collector = new SearchResultsCollector();
  const llm = new MockLLMProvider({
    responses: [
      { toolCalls: [{ id: 'call-1', name: 'noop', args: {} }] },
      { toolCalls: [{ id: 'call-2', name: 'noop', args: {} }] },
      { content: 'Forced final.' },
    ],
  });
  const noopTool = {
    name: 'noop',
    description: 'No-op',
    inputSchema: { type: 'object', additionalProperties: false },
    execute() {
      return 'ok';
    },
  };
  const loop = new AgentLoop({
    llm,
    tools: [noopTool],
    collector,
    maxIterations: 2,
  });

  const result = await loop.run('question');

  assert.equal(result.answer, 'Forced final.');
  assert.equal(result.completionReason, 'max_iterations');
  assert.equal(result.iterationsUsed, 2);
});

test('AgentLoop detects repeated tool call loops and forces synthesis', async () => {
  const collector = new SearchResultsCollector();
  const repeated = { id: 'call', name: 'noop', args: { value: 'same' } };
  const llm = new MockLLMProvider({
    responses: [
      { toolCalls: [repeated] },
      { toolCalls: [repeated] },
      { toolCalls: [repeated] },
      { content: 'Loop synthesis.' },
    ],
  });
  const noopTool = {
    name: 'noop',
    description: 'No-op',
    inputSchema: { type: 'object', additionalProperties: true },
    execute() {
      return 'ok';
    },
  };
  const loop = new AgentLoop({
    llm,
    tools: [noopTool],
    collector,
    loopDetectionWindow: 3,
  });

  const result = await loop.run('question');

  assert.equal(result.answer, 'Loop synthesis.');
  assert.equal(result.completionReason, 'loop_detected');
  assert.equal(result.iterationsUsed, 2);
});

test('AgentLoop returns provider_error when provider fails', async () => {
  const collector = new SearchResultsCollector();
  const llm = new MockLLMProvider({
    handler() {
      throw new Error('provider offline');
    },
  });
  const loop = new AgentLoop({
    llm,
    tools: [],
    collector,
  });

  const result = await loop.run('question');

  assert.equal(result.completionReason, 'provider_error');
  assert.match(result.answer, /provider offline/);
});
