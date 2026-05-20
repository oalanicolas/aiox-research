import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentLoop } from '../agent/AgentLoop.ts';
import { SearchResultsCollector } from '../collector/Collector.ts';
import { MockLLMProvider } from '../testing/MockLLMProvider.ts';
import {
  redactJsonValue,
  redactResearchRuntimeEvent,
  redactText,
} from '../observability/redaction.ts';

test('redactText removes common provider secrets', () => {
  const redacted = redactText(
    'Authorization: Bearer sk-testsecret12345 api_key=sk-othersecret12345 password=plain',
  );

  assert.doesNotMatch(redacted.value, /sk-testsecret12345/);
  assert.doesNotMatch(redacted.value, /sk-othersecret12345/);
  assert.doesNotMatch(redacted.value, /password=plain/);
  assert.ok(redacted.report.count >= 3);
});

test('redactJsonValue redacts sensitive object keys without mutating input', () => {
  const original = {
    query: 'safe',
    api_key: 'sk-testsecret12345',
    nested: {
      access_token: 'raw-token',
      totalTokens: 42,
    },
  };

  const redacted = redactJsonValue(original);

  assert.equal(original.api_key, 'sk-testsecret12345');
  assert.equal(redacted.value.api_key, '[REDACTED_SECRET]');
  assert.equal(redacted.value.nested.access_token, '[REDACTED_SECRET]');
  assert.equal(redacted.value.nested.totalTokens, 42);
});

test('redactResearchRuntimeEvent sanitizes tool event payloads', () => {
  const redacted = redactResearchRuntimeEvent({
    type: 'tool_call',
    tool: 'fetch_url',
    args: {
      url: 'https://example.com/?api_key=sk-testsecret12345',
      password: 'plain',
    },
    iteration: 0,
  });

  assert.doesNotMatch(JSON.stringify(redacted.value), /sk-testsecret12345|plain/);
  assert.equal(redacted.value.args.password, '[REDACTED_SECRET]');
});

test('AgentLoop returns runtime metrics and redacts emitted events plus tool traces', async () => {
  const collector = new SearchResultsCollector();
  const llm = new MockLLMProvider({
    responses: [
      {
        toolCalls: [
          {
            id: 'leaky-call',
            name: 'leaky_tool',
            args: {
              query: 'safe query',
              api_key: 'sk-testsecret12345',
            },
          },
        ],
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
      },
      {
        content: 'Final answer.',
        usage: {
          inputTokens: 20,
          outputTokens: 7,
          totalTokens: 27,
        },
      },
    ],
  });
  const events = [];
  const loop = new AgentLoop({
    llm,
    collector,
    tools: [
      {
        name: 'leaky_tool',
        description: 'Returns a leaky result for redaction tests.',
        inputSchema: { type: 'object', additionalProperties: true },
        execute() {
          return 'Authorization: Bearer sk-toolsecret12345';
        },
      },
    ],
    onProgress(event) {
      events.push(event);
    },
  });

  const result = await loop.run('question');
  const serializedEvents = JSON.stringify(events);
  const serializedMetrics = JSON.stringify(result.metrics);

  assert.equal(result.metrics.totals.llmCalls, 2);
  assert.equal(result.metrics.totals.toolCalls, 1);
  assert.equal(result.metrics.totals.inputTokens, 30);
  assert.equal(result.metrics.totals.outputTokens, 12);
  assert.equal(result.metrics.totals.totalTokens, 42);
  assert.equal(result.metrics.redaction.applied, true);
  assert.doesNotMatch(serializedEvents, /sk-testsecret12345|sk-toolsecret12345/);
  assert.doesNotMatch(serializedMetrics, /sk-testsecret12345|sk-toolsecret12345/);
});
