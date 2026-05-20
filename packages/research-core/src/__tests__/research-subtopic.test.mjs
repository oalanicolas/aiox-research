import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import { AgentLoop } from '../agent/AgentLoop.ts';
import { SearchResultsCollector } from '../collector/Collector.ts';
import { MockLLMProvider } from '../testing/MockLLMProvider.ts';
import { MockSearchEngine } from '../testing/MockSearchEngine.ts';
import { createResearchSubtopicTool } from '../tools/research-subtopic.ts';
import { createWebSearchTool } from '../tools/web-search.ts';

test('research_subtopic runs bounded parallel loops with a shared collector', async () => {
  const collector = new SearchResultsCollector();
  let active = 0;
  let peak = 0;
  const queries = [];
  const tool = createResearchSubtopicTool({
    collector,
    maxWorkers: 2,
    createLoop({ subtopic, index, collector: sharedCollector }) {
      const engine = new MockSearchEngine({
        id: `mock-${index}`,
        async handler(query) {
          active += 1;
          peak = Math.max(peak, active);
          queries.push(query);
          await delay(10);
          active -= 1;
          return [
            {
              title: `Source for ${query}`,
              url: `https://example.com/${query}`,
              snippet: `Evidence for ${query}`,
            },
          ];
        },
      });
      const llm = new MockLLMProvider({
        responses: [
          {
            toolCalls: [
              {
                id: `search-${index}`,
                name: 'web_search',
                args: { query: subtopic },
              },
            ],
          },
          { content: `Answer for ${subtopic}.` },
        ],
      });

      return new AgentLoop({
        llm,
        collector: sharedCollector,
        tools: [createWebSearchTool({ collector: sharedCollector, engines: [engine] })],
        maxIterations: 2,
      });
    },
  });

  const output = await tool.execute({
    subtopics: ['alpha', 'beta', 'gamma', 'delta'],
    maxWorkers: 2,
  });

  assert.equal(output.status, 'completed');
  assert.equal(output.completed, 4);
  assert.equal(output.failed, 0);
  assert.equal(output.maxWorkers, 2);
  assert.ok(peak <= 2, `expected peak concurrency <= 2, got ${peak}`);
  assert.equal(collector.size(), 4);
  assert.deepEqual(queries.sort(), ['alpha', 'beta', 'delta', 'gamma']);
  assert.deepEqual(
    output.subtopics.map((entry) => entry.subtopic),
    ['alpha', 'beta', 'gamma', 'delta'],
  );
});

test('research_subtopic blocks recursion at maxDepth', async () => {
  const collector = new SearchResultsCollector();
  let createLoopCalls = 0;
  const tool = createResearchSubtopicTool({
    collector,
    maxDepth: 1,
    createLoop() {
      createLoopCalls += 1;
      throw new Error('should not run');
    },
  });

  const output = await tool.execute({
    subtopics: ['nested'],
    depth: 1,
  });

  assert.equal(output.status, 'blocked');
  assert.match(output.error, /maxDepth 1 reached/);
  assert.equal(createLoopCalls, 0);
  assert.equal(collector.size(), 0);
});

test('research_subtopic returns partial results when a subtopic fails', async () => {
  const collector = new SearchResultsCollector();
  const tool = createResearchSubtopicTool({
    collector,
    createLoop({ subtopic }) {
      if (subtopic === 'bad') {
        throw new Error('subtopic failed');
      }

      return new AgentLoop({
        llm: new MockLLMProvider({ responses: [{ content: `Answer for ${subtopic}.` }] }),
        collector,
        tools: [],
      });
    },
  });

  const output = await tool.execute({ subtopics: ['good', 'bad', 'also-good'] });

  assert.equal(output.status, 'partial');
  assert.equal(output.completed, 2);
  assert.equal(output.failed, 1);
  assert.deepEqual(
    output.subtopics.map((entry) => entry.status),
    ['fulfilled', 'rejected', 'fulfilled'],
  );
  assert.match(output.subtopics[1].error, /subtopic failed/);
});

test('research_subtopic caps maxWorkers at four', async () => {
  const collector = new SearchResultsCollector();
  const tool = createResearchSubtopicTool({
    collector,
    maxWorkers: 9,
    createLoop({ subtopic }) {
      return new AgentLoop({
        llm: new MockLLMProvider({ responses: [{ content: `Answer for ${subtopic}.` }] }),
        collector,
        tools: [],
      });
    },
  });

  const output = await tool.execute({
    subtopics: ['a', 'b', 'c', 'd', 'e'],
    maxWorkers: 99,
  });

  assert.equal(output.status, 'completed');
  assert.equal(output.maxWorkers, 4);
  assert.equal(output.completed, 5);
});
