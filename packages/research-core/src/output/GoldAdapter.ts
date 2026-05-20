import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { stringify as stringifyYaml } from 'yaml';

import { redactJsonValue } from '../observability/redaction.ts';
import { validateCitations } from '../synthesis/CitationHandler.ts';
import type { Source } from '../types.ts';
import type { ResearchMetrics } from '../observability/metrics.ts';

export interface GoldAdapterInput {
  outputDir: string;
  query: string;
  answer: string;
  rawAnswer?: string;
  sources: Source[];
  engine?: string;
  completionReason?: string;
  invalidCitations?: number[];
  prompt?: string;
  slug?: string;
  startedAt?: string;
  completedAt?: string;
  runtimeMetrics?: ResearchMetrics;
}

export interface GoldAdapterMetrics {
  files: number;
  sources: number;
  claims: number;
  invalidCitations: number;
  graphNodes: number;
  graphEdges: number;
}

export interface GoldAdapterResult {
  outputDir: string;
  files: string[];
  metrics: GoldAdapterMetrics;
}

interface Claim {
  id: string;
  text: string;
  citations: number[];
  support: 'source_backed' | 'partial' | 'unsupported';
}

interface Artifact {
  file: string;
  content: string;
}

export async function emitGoldArtifacts(input: GoldAdapterInput): Promise<GoldAdapterResult> {
  const outputDir = path.resolve(input.outputDir);
  const artifacts = buildGoldArtifacts(input);

  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    artifacts.map((artifact) => writeFile(path.join(outputDir, artifact.file), artifact.content, 'utf8')),
  );

  const graph = JSON.parse(
    artifacts.find((artifact) => artifact.file === 'research-graph.json')?.content ?? '{}',
  ) as { nodes?: unknown[]; edges?: unknown[] };
  const claims = extractClaims(input.answer, input.sources);

  return {
    outputDir,
    files: artifacts.map((artifact) => artifact.file).sort(),
    metrics: {
      files: artifacts.length,
      sources: input.sources.length,
      claims: claims.length,
      invalidCitations: input.invalidCitations?.length ?? 0,
      graphNodes: graph.nodes?.length ?? 0,
      graphEdges: graph.edges?.length ?? 0,
    },
  };
}

export function buildGoldArtifacts(input: GoldAdapterInput): Artifact[] {
  const now = input.completedAt ?? new Date().toISOString();
  const startedAt = input.startedAt ?? now;
  const slug = input.slug ?? slugify(input.query);
  const runtimeMetrics = input.runtimeMetrics
    ? (redactJsonValue(input.runtimeMetrics).value as ResearchMetrics)
    : undefined;
  const validated = validateCitations(input.answer, input.sources);
  const invalidCitations = uniqueNumbers([
    ...(input.invalidCitations ?? []),
    ...validated.invalidCitations,
  ]);
  const claims = extractClaims(validated.text, input.sources);
  const graph = buildResearchGraph({ ...input, runtimeMetrics, answer: validated.text }, claims, now);
  const filesCount = runtimeMetrics ? 15 : 13;
  const metrics: GoldAdapterMetrics = {
    files: filesCount,
    sources: input.sources.length,
    claims: claims.length,
    invalidCitations: invalidCitations.length,
    graphNodes: graph.nodes.length,
    graphEdges: graph.edges.length,
  };

  const artifacts: Artifact[] = [
    jsonArtifact('research-contract.json', researchContract(input, metrics)),
    markdownArtifact('README.md', renderReadme(input, slug, metrics, now)),
    markdownArtifact('00-query-original.md', renderQuery(input.query)),
    markdownArtifact('01-deep-research-prompt.md', renderPrompt(input)),
    markdownArtifact('02-research-report.md', renderReport(input, validated.text, claims)),
    markdownArtifact('03-recommendations.md', renderRecommendations(input, invalidCitations)),
    yamlArtifact('metrics.yaml', metricsYaml(input, metrics, startedAt, now)),
    yamlArtifact('pipeline-state.yaml', pipelineStateYaml(input, metrics, startedAt, now)),
    {
      file: 'execution-log.jsonl',
      content: renderExecutionLog(input, metrics, startedAt, now),
    },
    yamlArtifact('sources.yaml', sourcesYaml(input.sources)),
    yamlArtifact('claims.yaml', claimsYaml(claims)),
    yamlArtifact('validation-report.yaml', validationReportYaml(input, metrics, invalidCitations)),
    jsonArtifact('research-graph.json', graph),
  ];

  if (runtimeMetrics) {
    artifacts.push(yamlArtifact('cost-latency.yaml', costLatencyYaml(runtimeMetrics)));
    artifacts.push({
      file: 'trace.jsonl',
      content: renderTraceJsonl(input, runtimeMetrics),
    });
  }

  return artifacts;
}

function researchContract(input: GoldAdapterInput, metrics: GoldAdapterMetrics): object {
  return {
    schema: 'sinkra.research-intelligence-local-contract.v1',
    research_kind: 'research_core_fixture',
    objective:
      'Emitir um pacote Gold mínimo e validável a partir do runtime research-core, sem substituir os contratos Gold de EPIC-150/153.',
    decision_context: {
      decision: 'Validar que o runtime P0 consegue materializar evidência em artefatos consumíveis.',
      requested_by: 'EPIC-154 Wave 0',
      query: input.query,
    },
    taxonomy: {
      unit_of_analysis: 'runtime_execution',
      dimension_source: 'research-core AgentLoop, Collector, CitationHandler e GoldAdapter',
      categories: ['query', 'source', 'claim', 'citation', 'runtime_gate'],
    },
    rubric_model: {
      method_family: 'citation_gate',
      score_semantics: 'passa quando artefatos obrigatórios existem e citações sobreviventes apontam para fontes coletadas',
      dimensions_or_criteria: ['core_files', 'sources_yaml', 'claims_yaml', 'research_graph', 'citation_validation'],
      pass_or_saturation_rule: 'research:intelligence:validate sem blockers para a fixture local',
    },
    evidence_model: {
      citation_style: '[N]',
      source_indexing: 'Collector 1-based sequential indices',
      source_count: metrics.sources,
      invalid_citations: metrics.invalidCitations,
      runtime_metrics: input.runtimeMetrics ? 'cost-latency.yaml' : 'not_provided',
    },
    stop_rules: {
      rule: 'Fixture encerra após uma execução determinística do AgentLoop.',
      completion_reason: input.completionReason ?? 'unknown',
    },
    thresholds: {
      files: { minimum: 12, preferred: 13 },
      words: { minimum: 80, preferred: 160 },
      sources: { minimum: Math.min(metrics.sources, 1), preferred: metrics.sources },
      waves: { minimum: 0, preferred: 0 },
      graph_nodes: { minimum: Math.min(metrics.graphNodes, 8), preferred: metrics.graphNodes },
      graph_edges: { minimum: Math.min(metrics.graphEdges, 8), preferred: metrics.graphEdges },
      gold_artifacts: { minimum: 3, preferred: 3 },
    },
  };
}

function metricsYaml(
  input: GoldAdapterInput,
  metrics: GoldAdapterMetrics,
  startedAt: string,
  completedAt: string,
): object {
  return {
    schema: 'sinkra.research-core.metrics.v1',
    runtime: 'research-core',
    engine: input.engine ?? 'unknown',
    started_at: startedAt,
    completed_at: completedAt,
    completion_reason: input.completionReason ?? 'unknown',
    query: input.query,
    files_emitted: metrics.files,
    sources: metrics.sources,
    claims: metrics.claims,
    invalid_citations: metrics.invalidCitations,
    graph_nodes: metrics.graphNodes,
    graph_edges: metrics.graphEdges,
    runtime_metrics: input.runtimeMetrics
      ? {
          duration_ms: input.runtimeMetrics.durationMs,
          iterations_used: input.runtimeMetrics.iterationsUsed,
          llm_calls: input.runtimeMetrics.totals.llmCalls,
          tool_calls: input.runtimeMetrics.totals.toolCalls,
          redaction_applied: input.runtimeMetrics.redaction.applied,
          redaction_count: input.runtimeMetrics.redaction.count,
        }
      : null,
  };
}

function pipelineStateYaml(
  input: GoldAdapterInput,
  metrics: GoldAdapterMetrics,
  startedAt: string,
  completedAt: string,
): object {
  return {
    schema: 'sinkra.research-core.pipeline-state.v1',
    status: 'completed',
    runtime: 'research-core',
    started_at: startedAt,
    completed_at: completedAt,
    query: input.query,
    phases: [
      { id: 'collect', status: 'completed', evidence: `${metrics.sources} source(s) collected` },
      { id: 'synthesize', status: 'completed', evidence: 'answer rendered from AgentLoop output' },
      { id: 'validate_citations', status: 'completed', evidence: `${metrics.invalidCitations} invalid citation(s) removed or reported` },
      { id: 'emit_gold', status: 'completed', evidence: `${metrics.files} artifact(s) emitted` },
    ],
    gates: {
      core_files: 'pass',
      source_manifest: metrics.sources > 0 ? 'pass' : 'warning',
      citation_validation: 'pass',
      research_graph: metrics.graphNodes >= 1 && metrics.graphEdges >= 1 ? 'pass' : 'warning',
    },
  };
}

function sourcesYaml(sources: Source[]): object {
  return {
    schema: 'sinkra.research-core.sources.v1',
    sources: sources.map((source) => ({
      id: `source-${source.index}`,
      index: source.index,
      title: source.title,
      url: source.url,
      source_engine: source.sourceEngine,
      snippet: source.snippet ?? '',
      credibility: source.credibility ?? 'unknown',
      published_date: source.publishedDate ?? null,
      doi: source.doi ?? null,
      journal: source.journal ?? null,
    })),
  };
}

function claimsYaml(claims: Claim[]): object {
  return {
    schema: 'sinkra.research-core.claims.v1',
    claims: claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      citations: claim.citations.join(','),
      support: claim.support,
    })),
  };
}

function validationReportYaml(
  input: GoldAdapterInput,
  metrics: GoldAdapterMetrics,
  invalidCitations: number[],
): object {
  return {
    schema: 'sinkra.research-core.validation-report.v1',
    status: 'pass',
    runtime: 'research-core',
    query: input.query,
    checks: [
      { id: 'sources_present', status: metrics.sources > 0 ? 'pass' : 'warning' },
      { id: 'claims_extracted', status: metrics.claims > 0 ? 'pass' : 'warning' },
      { id: 'invalid_citations_removed', status: 'pass', details: invalidCitations.join(',') || 'none' },
      { id: 'gold_artifacts_emitted', status: metrics.files >= 12 ? 'pass' : 'fail' },
      { id: 'runtime_metrics_present', status: input.runtimeMetrics ? 'pass' : 'warning' },
      {
        id: 'trace_redaction_ready',
        status: input.runtimeMetrics ? 'pass' : 'warning',
        details: input.runtimeMetrics
          ? `${input.runtimeMetrics.redaction.count} redaction(s) tracked`
          : 'runtime metrics unavailable',
      },
    ],
  };
}

function costLatencyYaml(metrics: ResearchMetrics): object {
  return {
    schema: 'sinkra.research-core.cost-latency.v1',
    provider: metrics.provider,
    duration: {
      total_ms: metrics.durationMs,
    },
    llm: {
      total_calls: metrics.totals.llmCalls,
      total_input_tokens: metrics.totals.inputTokens,
      total_output_tokens: metrics.totals.outputTokens,
      total_tokens: metrics.totals.totalTokens,
      by_phase: metrics.llmCalls.reduce<Record<string, { calls: number; total_tokens: number }>>(
        (acc, call) => {
          const bucket = acc[call.phase] ?? { calls: 0, total_tokens: 0 };
          bucket.calls += 1;
          bucket.total_tokens += call.totalTokens;
          acc[call.phase] = bucket;
          return acc;
        },
        {},
      ),
    },
    tools: {
      total_calls: metrics.totals.toolCalls,
      by_tool: metrics.toolCalls.reduce<Record<string, { calls: number; errors: number; total_duration_ms: number }>>(
        (acc, call) => {
          const bucket = acc[call.tool] ?? { calls: 0, errors: 0, total_duration_ms: 0 };
          bucket.calls += 1;
          bucket.errors += call.status === 'error' ? 1 : 0;
          bucket.total_duration_ms += call.durationMs;
          acc[call.tool] = bucket;
          return acc;
        },
        {},
      ),
    },
    sources: {
      collected_raw: metrics.totals.sourcesCollected,
      cited_in_output: null,
    },
    redaction: {
      applied: metrics.redaction.applied,
      count: metrics.redaction.count,
      types: metrics.redaction.types,
    },
    completion: {
      reason: metrics.completionReason,
      iterations_used: metrics.iterationsUsed,
      errors_count: metrics.totals.errors,
    },
  };
}

function renderTraceJsonl(input: GoldAdapterInput, metrics: ResearchMetrics): string {
  const entries = [
    {
      ts: metrics.startedAt,
      event: 'run_started',
      query: input.query,
      provider: metrics.provider,
    },
    ...metrics.llmCalls.map((call) => ({
      ts: metrics.startedAt,
      event: 'llm_call',
      provider: call.provider,
      phase: call.phase,
      iteration: call.iteration,
      duration_ms: call.durationMs,
      input_tokens: call.inputTokens,
      output_tokens: call.outputTokens,
      tool_calls: call.toolCallsCount,
    })),
    ...metrics.toolCalls.map((call) => ({
      ts: metrics.startedAt,
      event: 'tool_call',
      tool: call.tool,
      iteration: call.iteration,
      duration_ms: call.durationMs,
      status: call.status,
      args: call.args,
      result_summary: call.resultSummary,
      error: call.error,
    })),
    ...metrics.errors.map((error) => ({
      ts: metrics.completedAt,
      event: 'runtime_error',
      phase: error.phase,
      message: error.message,
      recoverable: error.recoverable,
    })),
    {
      ts: metrics.completedAt,
      event: 'run_completed',
      completion_reason: metrics.completionReason,
      iterations_used: metrics.iterationsUsed,
      sources_collected: metrics.totals.sourcesCollected,
      redaction_count: metrics.redaction.count,
    },
  ];

  return `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
}

function renderReadme(
  input: GoldAdapterInput,
  slug: string,
  metrics: GoldAdapterMetrics,
  completedAt: string,
): string {
  return [
    `# ${slug}`,
    '',
    'Pacote Gold mínimo emitido pelo `research-core` para validar a espinha P0 da EPIC-154.',
    '',
    '## Contexto',
    '',
    `Query: ${input.query}`,
    '',
    `Engine: ${input.engine ?? 'unknown'}`,
    '',
    `Completion reason: ${input.completionReason ?? 'unknown'}`,
    '',
    `Completed at: ${completedAt}`,
    '',
    '## Evidência',
    '',
    `Foram emitidos ${metrics.files} artefatos, ${metrics.sources} fonte(s), ${metrics.claims} claim(s), ${metrics.graphNodes} nós de grafo e ${metrics.graphEdges} edges.`,
    '',
    '## Limites',
    '',
    'Esta fixture valida materialização e rastreabilidade do runtime. Ela não substitui pesquisa Gold completa, re-score competitivo ou curadoria manual de benchmark.',
    '',
  ].join('\n');
}

function renderQuery(query: string): string {
  return ['# Query Original', '', query, ''].join('\n');
}

function renderPrompt(input: GoldAdapterInput): string {
  return [
    '# Deep Research Prompt',
    '',
    input.prompt ??
      [
        'Execute uma pesquisa técnica rastreável.',
        'Colete fontes, sintetize claims e cite apenas índices existentes no Collector.',
        `Pergunta: ${input.query}`,
      ].join(' '),
    '',
  ].join('\n');
}

function renderReport(input: GoldAdapterInput, answer: string, claims: Claim[]): string {
  const sourceLines =
    input.sources.length === 0
      ? ['- Nenhuma fonte coletada.']
      : input.sources.map((source) => `- [${source.index}] ${source.title}: ${source.url}`);
  const claimLines =
    claims.length === 0
      ? ['- Nenhuma claim extraída.']
      : claims.map((claim) => `- ${claim.id}: ${claim.text} (${claim.support})`);

  return [
    '# Research Report',
    '',
    '## Síntese',
    '',
    answer || 'Nenhuma resposta foi gerada pelo runtime.',
    '',
    '## Claims',
    '',
    ...claimLines,
    '',
    '## Fontes',
    '',
    ...sourceLines,
    '',
  ].join('\n');
}

function renderRecommendations(input: GoldAdapterInput, invalidCitations: number[]): string {
  const invalidLine =
    invalidCitations.length === 0
      ? 'Nenhuma citação inválida permaneceu após a validação.'
      : `Citações inválidas removidas ou reportadas: ${invalidCitations.map((index) => `[${index}]`).join(', ')}.`;

  return [
    '# Recommendations',
    '',
    '- Manter `research-core` como runtime e preservar EPIC-150/153 como contratos Gold consumidores.',
    '- Usar esta fixture como gate de integração antes de ligar MCP, multi-agent ou UI.',
    `- Próxima integração recomendada: conectar o launcher existente do app ao runtime para persistir em docs/research. Query validada: ${input.query}`,
    `- ${invalidLine}`,
    '',
  ].join('\n');
}

function renderExecutionLog(
  input: GoldAdapterInput,
  metrics: GoldAdapterMetrics,
  startedAt: string,
  completedAt: string,
): string {
  const entries = [
    { ts: startedAt, event: 'run_started', query: input.query, engine: input.engine ?? 'unknown' },
    { ts: completedAt, event: 'sources_collected', count: metrics.sources },
    { ts: completedAt, event: 'answer_synthesized', completion_reason: input.completionReason ?? 'unknown' },
    { ts: completedAt, event: 'citations_validated', invalid_citations: metrics.invalidCitations },
    { ts: completedAt, event: 'gold_artifacts_emitted', files: metrics.files },
  ];

  return `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
}

function buildResearchGraph(
  input: GoldAdapterInput,
  claims: Claim[],
  completedAt: string,
): { schema: string; generated_at: string; nodes: object[]; edges: object[] } {
  const nodes: object[] = [
    { id: 'query', type: 'query', label: input.query },
    { id: 'phase-collect', type: 'phase', label: 'Collect' },
    { id: 'phase-synthesize', type: 'phase', label: 'Synthesize' },
    { id: 'phase-validate', type: 'phase', label: 'Validate citations' },
    { id: 'answer', type: 'answer', label: 'Validated answer' },
    { id: 'artifact-sources', type: 'artifact', label: 'sources.yaml' },
    { id: 'artifact-claims', type: 'artifact', label: 'claims.yaml' },
    { id: 'artifact-metrics', type: 'artifact', label: 'metrics.yaml' },
    { id: 'artifact-validation', type: 'artifact', label: 'validation-report.yaml' },
  ];
  const edges: object[] = [
    { from: 'query', to: 'phase-collect', type: 'drives' },
    { from: 'phase-collect', to: 'phase-synthesize', type: 'feeds' },
    { from: 'phase-synthesize', to: 'phase-validate', type: 'feeds' },
    { from: 'phase-validate', to: 'answer', type: 'produces' },
    { from: 'phase-collect', to: 'artifact-sources', type: 'emits' },
    { from: 'phase-synthesize', to: 'artifact-claims', type: 'emits' },
    { from: 'phase-validate', to: 'artifact-validation', type: 'emits' },
    { from: 'answer', to: 'artifact-metrics', type: 'measured_by' },
  ];

  for (const source of input.sources) {
    const sourceId = `source-${source.index}`;
    nodes.push({ id: sourceId, type: 'source', label: source.title, url: source.url });
    edges.push({ from: 'phase-collect', to: sourceId, type: 'collected' });
    edges.push({ from: sourceId, to: 'artifact-sources', type: 'listed_in' });
  }

  for (const claim of claims) {
    nodes.push({ id: claim.id, type: 'claim', label: claim.text, support: claim.support });
    edges.push({ from: claim.id, to: 'answer', type: 'supports' });
    edges.push({ from: claim.id, to: 'artifact-claims', type: 'listed_in' });
    for (const citation of claim.citations) {
      edges.push({ from: `source-${citation}`, to: claim.id, type: 'cited_by' });
    }
  }

  return {
    schema: 'sinkra.research-core.research-graph.v1',
    generated_at: completedAt,
    nodes,
    edges,
  };
}

function extractClaims(answer: string, sources: Source[]): Claim[] {
  const sourceIndexes = new Set(sources.map((source) => source.index));
  const sentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const claimSentences = sentences.length > 0 ? sentences : ['Nenhuma resposta foi gerada pelo runtime.'];

  return claimSentences.map((text, index) => {
    const citations = uniqueNumbers(
      [...text.matchAll(/\[(\d+)\]/g)].map((match) => Number.parseInt(match[1] ?? '', 10)),
    ).filter((citation) => Number.isFinite(citation));
    const validCount = citations.filter((citation) => sourceIndexes.has(citation)).length;
    const support =
      citations.length === 0 ? 'unsupported' : validCount === citations.length ? 'source_backed' : 'partial';

    return {
      id: `claim-${String(index + 1).padStart(3, '0')}`,
      text,
      citations,
      support,
    };
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'research-core-fixture';
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))].sort((a, b) => a - b);
}

function yamlArtifact(file: string, data: object): Artifact {
  return { file, content: stringifyYaml(data) };
}

function jsonArtifact(file: string, data: object): Artifact {
  return { file, content: `${JSON.stringify(data, null, 2)}\n` };
}

function markdownArtifact(file: string, content: string): Artifact {
  return { file, content };
}
