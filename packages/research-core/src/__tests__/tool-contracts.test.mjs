import assert from 'node:assert/strict';
import test from 'node:test';

import { ToolRegistry } from '../agent/ToolRegistry.ts';
import { MockLLMProvider } from '../testing/MockLLMProvider.ts';
import { MockSearchEngine } from '../testing/MockSearchEngine.ts';

const echoTool = {
  name: 'echo',
  description: 'Echoes the input',
  inputSchema: {
    type: 'object',
    properties: {
      value: { type: 'string' },
    },
    required: ['value'],
    additionalProperties: false,
  },
  execute(args) {
    return `echo:${args.value}`;
  },
};

test('ToolRegistry registers, lists and executes tools', async () => {
  const registry = new ToolRegistry([echoTool]);

  assert.equal(registry.has('echo'), true);
  assert.equal(registry.get('missing'), null);
  assert.deepEqual(registry.definitions(), [
    {
      name: 'echo',
      description: 'Echoes the input',
      inputSchema: echoTool.inputSchema,
    },
  ]);
  assert.equal(await registry.execute('echo', { value: 'hello' }), 'echo:hello');
});

test('ToolRegistry blocks duplicate names', () => {
  assert.throws(
    () => new ToolRegistry([echoTool, echoTool]),
    /Tool already registered: echo/,
  );
});

test('ToolRegistry throws for unknown tools', async () => {
  const registry = new ToolRegistry();

  await assert.rejects(
    () => registry.execute('missing', {}),
    /Unknown tool: missing/,
  );
});

test('ToolRegistry definitions are cloned', () => {
  const registry = new ToolRegistry([echoTool]);
  const definitions = registry.definitions();

  definitions[0].inputSchema.properties.value.type = 'number';

  assert.equal(registry.definitions()[0].inputSchema.properties.value.type, 'string');
});

test('MockLLMProvider returns scripted responses and records cloned requests', async () => {
  const provider = new MockLLMProvider({
    responses: [
      {
        content: 'final answer',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      },
    ],
  });

  const request = {
    messages: [{ role: 'user', content: 'question' }],
    tools: [registryToolDefinition()],
    toolChoice: 'auto',
  };

  const response = await provider.invoke(request);
  request.messages[0].content = 'mutated';
  response.content = 'mutated response';

  assert.equal(provider.getRequests()[0].messages[0].content, 'question');
  await assert.rejects(() => provider.invoke(request), /no scripted response left/);
});

test('MockLLMProvider handler can generate deterministic tool calls', async () => {
  const provider = new MockLLMProvider({
    handler: (_request, index) => ({
      toolCalls: [
        {
          id: `call-${index}`,
          name: 'echo',
          args: { value: `v${index}` },
        },
      ],
    }),
  });

  const response = await provider.invoke({ messages: [] });

  assert.deepEqual(response.toolCalls, [
    {
      id: 'call-0',
      name: 'echo',
      args: { value: 'v0' },
    },
  ]);
});

test('MockSearchEngine returns cloned fixture results and records queries', async () => {
  const engine = new MockSearchEngine({
    results: [
      {
        title: 'Result A',
        url: 'https://example.com/a',
        authors: ['Ada'],
        metadata: { rank: 1 },
      },
      {
        title: 'Result B',
        url: 'https://example.com/b',
      },
    ],
  });

  const results = await engine.search('test query', { limit: 1 });
  results[0].title = 'Mutated';
  results[0].authors?.push('Grace');
  results[0].metadata.rank = 999;

  const again = await engine.search('test query');

  assert.equal(again[0].title, 'Result A');
  assert.deepEqual(again[0].authors, ['Ada']);
  assert.deepEqual(again[0].metadata, { rank: 1 });
  assert.deepEqual(engine.getQueries().map((entry) => entry.query), ['test query', 'test query']);
});

function registryToolDefinition() {
  return {
    name: echoTool.name,
    description: echoTool.description,
    inputSchema: echoTool.inputSchema,
  };
}
