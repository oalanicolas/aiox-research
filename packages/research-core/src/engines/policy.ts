export type EnginePolicyMode = 'public' | 'private' | 'premium' | 'research_strict';

export type EngineApiKeyRequirement = boolean | 'optional' | 'depends';
export type EngineVariableRequirement = boolean | 'depends';
export type EngineCostRisk = 'low' | 'medium' | 'high' | 'depends';
export type EngineSsrfSurface = 'none' | 'low' | 'medium' | 'high' | 'depends';
export type EngineRecommendedDefault = 'allow' | 'deny' | 'caution';

export interface EnginePolicyDefinition {
  id: string;
  requiresApiKey: EngineApiKeyRequirement;
  networkRequired: EngineVariableRequirement;
  supportsFullSearch: boolean;
  privateOnlySafe: EngineVariableRequirement;
  costRisk: EngineCostRisk;
  ssrfSurface: EngineSsrfSurface;
  recommendedDefault: EngineRecommendedDefault;
  notes?: string;
}

export interface EnginePolicyModeDefinition {
  description: string;
  allow: string[];
  deny: string[];
}

export interface EnginePolicyRequest {
  mode?: EnginePolicyMode;
  engine?: string;
  engines?: string[];
  configuredEngineKeys?: readonly string[] | Record<string, unknown>;
  workspaceId?: string;
  collectionWorkspaceIds?: Record<string, string>;
  allowModeDefaults?: boolean;
}

export interface EnginePolicyValidationResult {
  ok: boolean;
  mode: EnginePolicyMode;
  engines: string[];
  errors: string[];
  warnings: string[];
}

export interface EnginePolicyCatalog {
  engines: EnginePolicyDefinition[];
  modes: Record<EnginePolicyMode, EnginePolicyModeDefinition>;
}

const COLLECTION_TEMPLATE_ID = 'collection_{id}';
const COLLECTION_ENGINE_PATTERN = /^collection_[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const DEFAULT_ENGINE_POLICY_CATALOG: EnginePolicyCatalog = {
  engines: [
    engine('arxiv', false, true, true, false, 'low', 'low', 'allow', 'Open preprints, rate-limited but free'),
    engine('pubmed', false, true, true, false, 'low', 'low', 'allow', 'NCBI E-utilities, rate-limited 3 req/s'),
    engine('semantic_scholar', 'optional', true, true, false, 'low', 'low', 'allow'),
    engine('openalex', false, true, true, false, 'low', 'low', 'allow'),
    engine('nasa_ads', true, true, true, false, 'low', 'low', 'deny', 'Enable only when tenant key is configured'),
    engine('pubchem', false, true, false, false, 'low', 'low', 'allow', 'Domain-specific chemistry search'),
    engine('zenodo', false, true, true, false, 'low', 'low', 'allow'),
    engine('searxng', false, true, true, true, 'low', 'medium', 'allow', 'SINKRA default when base URL is validated'),
    engine('ddg', false, true, true, false, 'low', 'low', 'allow', 'Aggressive rate limits; fallback only'),
    engine('brave', true, true, true, false, 'medium', 'low', 'deny', 'Enable with tenant key'),
    engine('mojeek', true, true, true, false, 'medium', 'low', 'deny'),
    engine('google_pse', true, true, true, false, 'medium', 'low', 'deny'),
    engine('tavily', true, true, true, false, 'medium', 'low', 'deny', 'AI-powered search with per-query cost'),
    engine('exa', true, true, true, false, 'medium', 'low', 'deny'),
    engine('serpapi', true, true, true, false, 'high', 'low', 'deny'),
    engine('serper', true, true, true, false, 'high', 'low', 'deny'),
    engine('scaleserp', true, true, true, false, 'high', 'low', 'deny'),
    engine('github', 'optional', true, true, false, 'low', 'low', 'allow', 'Without PAT, rate limit is low'),
    engine('stackexchange', 'optional', true, true, false, 'low', 'low', 'allow'),
    engine('elasticsearch', false, true, true, true, 'low', 'high', 'deny', 'Opt-in with validated tenant config'),
    engine('guardian', true, true, true, false, 'low', 'low', 'deny'),
    engine('wikinews', false, true, true, false, 'low', 'low', 'allow'),
    engine('wayback', false, true, true, false, 'low', 'low', 'allow'),
    engine('wikipedia', false, true, true, false, 'low', 'low', 'allow'),
    engine('openlibrary', false, true, false, false, 'low', 'low', 'allow'),
    engine('gutenberg', false, true, false, false, 'low', 'low', 'allow'),
    engine('library', false, false, true, true, 'low', 'none', 'allow', 'Tenant private KB; always isolate by workspace'),
    engine(COLLECTION_TEMPLATE_ID, false, false, true, true, 'low', 'none', 'allow', 'Dynamic private collection engine'),
    engine('paperless', true, false, true, true, 'low', 'high', 'deny', 'Self-hosted Paperless with tenant config'),
    engine('langchain_retriever', 'depends', 'depends', true, 'depends', 'depends', 'depends', 'deny'),
    engine('parallel', false, 'depends', true, false, 'depends', 'depends', 'caution', 'Validate every child engine before allow'),
    engine('auto', false, 'depends', true, false, 'depends', 'depends', 'deny', 'Never allow in private mode'),
    engine('meta', false, 'depends', true, false, 'depends', 'depends', 'deny', 'Requires explicit business allowlist'),
  ],
  modes: {
    public: {
      description: 'Default mode. Web and academic engines allowed.',
      allow: ['searxng', 'arxiv', 'pubmed', 'semantic_scholar', 'openalex', 'wikipedia', 'github', 'ddg'],
      deny: ['auto', 'meta', 'parallel', 'elasticsearch'],
    },
    private: {
      description: 'Confidential mode. Local engines only.',
      allow: ['library', COLLECTION_TEMPLATE_ID],
      deny: ['*'],
    },
    premium: {
      description: 'Tenant with configured premium search keys.',
      allow: ['searxng', 'arxiv', 'pubmed', 'semantic_scholar', 'openalex', 'wikipedia', 'github', 'ddg', 'brave', 'tavily', 'exa', 'serper'],
      deny: ['auto', 'meta'],
    },
    research_strict: {
      description: 'Academic-only mode.',
      allow: ['arxiv', 'pubmed', 'semantic_scholar', 'openalex', 'nasa_ads', 'zenodo'],
      deny: ['*'],
    },
  },
};

export function validateEnginePolicyRequest(
  request: EnginePolicyRequest,
  catalog: EnginePolicyCatalog = DEFAULT_ENGINE_POLICY_CATALOG,
): EnginePolicyValidationResult {
  const mode = request.mode ?? 'public';
  const modeDefinition = catalog.modes[mode];
  const engines = normalizeRequestedEngines(request, modeDefinition);
  const registry = new Map(catalog.engines.map((definition) => [definition.id, definition]));
  const errors: string[] = [];
  const warnings: string[] = [];

  if (engines.length === 0) {
    errors.push('engine policy requires at least one declared engine or a mode default');
  }

  for (const engineId of engines) {
    const definition = resolveEngineDefinition(engineId, registry);

    if (!definition) {
      errors.push(`engine "${engineId}" is not registered in policy catalog`);
      continue;
    }

    if (!isAllowedInMode(engineId, modeDefinition)) {
      errors.push(`engine "${engineId}" is not allowed in mode "${mode}"`);
    }

    if (isExplicitlyDenied(engineId, modeDefinition)) {
      errors.push(`engine "${engineId}" is explicitly denied in mode "${mode}"`);
    }

    if (mode === 'private' && definition.privateOnlySafe !== true) {
      errors.push(`engine "${engineId}" is not private-only safe`);
    }

    if (definition.recommendedDefault === 'caution') {
      warnings.push(`engine "${engineId}" is marked caution by default`);
    }

    if (definition.requiresApiKey === true && !hasEngineKey(engineId, request.configuredEngineKeys)) {
      errors.push(`engine "${engineId}" requires a configured tenant key`);
    }

    if (isCollectionEngineId(engineId)) {
      validateCollectionIsolation(engineId, request, errors);
    }
  }

  return {
    ok: errors.length === 0,
    mode,
    engines,
    errors,
    warnings,
  };
}

export function assertEnginePolicyAllowed(
  request: EnginePolicyRequest,
  catalog: EnginePolicyCatalog = DEFAULT_ENGINE_POLICY_CATALOG,
): EnginePolicyValidationResult {
  const result = validateEnginePolicyRequest(request, catalog);

  if (!result.ok) {
    throw new Error(`engine policy blocked request: ${result.errors.join('; ')}`);
  }

  return result;
}

export function getDefaultEngineIdsForMode(
  mode: EnginePolicyMode,
  catalog: EnginePolicyCatalog = DEFAULT_ENGINE_POLICY_CATALOG,
): string[] {
  return catalog.modes[mode].allow.filter((engineId) => engineId !== COLLECTION_TEMPLATE_ID);
}

export function isCollectionEngineId(engineId: string): boolean {
  return COLLECTION_ENGINE_PATTERN.test(engineId);
}

function engine(
  id: string,
  requiresApiKey: EngineApiKeyRequirement,
  networkRequired: EngineVariableRequirement,
  supportsFullSearch: boolean,
  privateOnlySafe: EngineVariableRequirement,
  costRisk: EngineCostRisk,
  ssrfSurface: EngineSsrfSurface,
  recommendedDefault: EngineRecommendedDefault,
  notes?: string,
): EnginePolicyDefinition {
  return {
    id,
    requiresApiKey,
    networkRequired,
    supportsFullSearch,
    privateOnlySafe,
    costRisk,
    ssrfSurface,
    recommendedDefault,
    ...(notes ? { notes } : {}),
  };
}

function normalizeRequestedEngines(
  request: EnginePolicyRequest,
  modeDefinition: EnginePolicyModeDefinition,
): string[] {
  if (request.engines) {
    return normalizeEngineIds(request.engines);
  }

  if (request.engine) {
    return normalizeEngineIds([request.engine]);
  }

  if (request.allowModeDefaults === false) {
    return [];
  }

  return normalizeEngineIds(modeDefinition.allow.filter((engineId) => engineId !== COLLECTION_TEMPLATE_ID));
}

function normalizeEngineIds(engineIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const engineId of engineIds) {
    const normalized = engineId.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function resolveEngineDefinition(
  engineId: string,
  registry: Map<string, EnginePolicyDefinition>,
): EnginePolicyDefinition | undefined {
  return registry.get(engineId) ?? (isCollectionEngineId(engineId) ? registry.get(COLLECTION_TEMPLATE_ID) : undefined);
}

function isAllowedInMode(engineId: string, modeDefinition: EnginePolicyModeDefinition): boolean {
  return modeDefinition.allow.some((allowed) => allowed === engineId || matchesTemplate(engineId, allowed));
}

function isExplicitlyDenied(engineId: string, modeDefinition: EnginePolicyModeDefinition): boolean {
  return modeDefinition.deny.some((denied) => denied !== '*' && (denied === engineId || matchesTemplate(engineId, denied)));
}

function matchesTemplate(engineId: string, policyId: string): boolean {
  return policyId === COLLECTION_TEMPLATE_ID && isCollectionEngineId(engineId);
}

function hasEngineKey(
  engineId: string,
  configuredEngineKeys: EnginePolicyRequest['configuredEngineKeys'],
): boolean {
  if (!configuredEngineKeys) return false;
  if (Array.isArray(configuredEngineKeys)) {
    return configuredEngineKeys.includes(engineId);
  }
  const keyedConfig = configuredEngineKeys as Record<string, unknown>;
  return Boolean(keyedConfig[engineId]);
}

function validateCollectionIsolation(
  engineId: string,
  request: EnginePolicyRequest,
  errors: string[],
): void {
  if (!request.workspaceId) {
    errors.push(`engine "${engineId}" requires workspaceId for collection isolation`);
    return;
  }

  const collectionWorkspaceId = request.collectionWorkspaceIds?.[engineId];

  if (!collectionWorkspaceId) {
    errors.push(`engine "${engineId}" requires collection workspace ownership metadata`);
    return;
  }

  if (collectionWorkspaceId !== request.workspaceId) {
    errors.push(`engine "${engineId}" belongs to workspace "${collectionWorkspaceId}", not "${request.workspaceId}"`);
  }
}
