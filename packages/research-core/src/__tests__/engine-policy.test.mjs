import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertEnginePolicyAllowed,
  getDefaultEngineIdsForMode,
  isCollectionEngineId,
  validateEnginePolicyRequest,
} from '../engines/policy.ts';

test('public mode allows default public engines and blocks meta engines', () => {
  assert.deepEqual(
    getDefaultEngineIdsForMode('public'),
    ['searxng', 'arxiv', 'pubmed', 'semantic_scholar', 'openalex', 'wikipedia', 'github', 'ddg'],
  );

  const allowed = validateEnginePolicyRequest({
    mode: 'public',
    engines: ['searxng', 'openalex'],
  });
  const blocked = validateEnginePolicyRequest({
    mode: 'public',
    engine: 'auto',
  });

  assert.equal(allowed.ok, true);
  assert.equal(blocked.ok, false);
  assert.match(blocked.errors.join('; '), /not allowed|explicitly denied/);
});

test('private mode allows only local engines and enforces collection isolation', () => {
  assert.equal(isCollectionEngineId('collection_team_docs'), true);
  assert.equal(isCollectionEngineId('collection_'), false);

  assert.doesNotThrow(() =>
    assertEnginePolicyAllowed({
      mode: 'private',
      engine: 'library',
    }),
  );
  assert.doesNotThrow(() =>
    assertEnginePolicyAllowed({
      mode: 'private',
      engine: 'collection_team_docs',
      workspaceId: 'workspace-a',
      collectionWorkspaceIds: {
        collection_team_docs: 'workspace-a',
      },
    }),
  );

  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'private',
        engine: 'searxng',
      }),
    /not allowed in mode "private"/,
  );
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'private',
        engine: 'collection_team_docs',
        workspaceId: 'workspace-a',
        collectionWorkspaceIds: {
          collection_team_docs: 'workspace-b',
        },
      }),
    /not "workspace-a"/,
  );
});

test('premium and research_strict modes require keys for key-gated engines', () => {
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'premium',
        engine: 'brave',
      }),
    /requires a configured tenant key/,
  );
  assert.doesNotThrow(() =>
    assertEnginePolicyAllowed({
      mode: 'premium',
      engine: 'brave',
      configuredEngineKeys: ['brave'],
    }),
  );
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'research_strict',
        engine: 'nasa_ads',
      }),
    /requires a configured tenant key/,
  );
});

test('unknown engines and empty explicit requests fail closed', () => {
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'public',
        engine: 'unknown_engine',
      }),
    /not registered/,
  );
  assert.throws(
    () =>
      assertEnginePolicyAllowed({
        mode: 'public',
        engines: [],
        allowModeDefaults: false,
      }),
    /requires at least one declared engine/,
  );
});
