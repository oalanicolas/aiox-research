import "server-only"

import { existsSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import YAML from "yaml"
import type { ReaderMode } from "@/components/observatory/foundations/types"

export type SinkraMapDocument = {
  id: string
  file: string
  phase: string
  bytes: number
  content: string
  truncated: boolean
}

export type SinkraMapRunSummary = {
  slug: string
  title: string
  date: string
  category: string
  status: string
  score: string
  files: number
  active: boolean
  hasWorkflow: boolean
  hasTasks: boolean
  hasGates: boolean
  hasScore: boolean
  hasProcess: boolean
  hasDeps: boolean
  hasDomain: boolean
  hasObservatory: boolean
  hasAutomation: boolean
  hasRaci: boolean
  hasGaps: boolean
  hasCompliance: boolean
  hasComposition: boolean
  hasTokens: boolean
  hasState: boolean
  hasMetrics: boolean
}

export type SinkraWorkflowStep = {
  id: string
  phase: string
  task: string
  name: string
  executor: string
  outputCount: number
  guardrailCount: number
}

export type SinkraWorkflow = {
  id: string
  name: string
  layer: string
  trigger: string
  frequency: string
  description: string
  steps: SinkraWorkflowStep[]
}

export type SinkraTask = {
  id: string
  layer: string
  executor: string
  inputCount: number
  outputCount: number
  preconditions: number
  postconditions: number
}

export type SinkraGate = {
  id: string
  name: string
  position: string
  type: string
  executor: string
  threshold: string
  veto: boolean
  criteriaCount: number
}

export type SinkraScore = {
  score: number | null
  result: string
  structuralIntegrity: number | null
  qualityGate: string
}

export type SinkraProcessPhase = {
  id: string
  name: string
  executor: string
  drift: string
  observed: string
  painPoints: string[]
  hasDrift: boolean
}

export type SinkraDomainGroup = {
  domain: string
  total: number
  gapClosed: number
  samples: Array<{
    id: string
    name: string
    level: string
    type: string
    gap: string
  }>
}

export type SinkraDependencyNode = {
  id: string
  dependsOn: string[]
  feedsInto: string[]
  loop: boolean
}

export type SinkraDependencyGraph = {
  type: string
  validated: boolean
  roots: string[]
  leaves: string[]
  nodes: SinkraDependencyNode[]
  strictDag: string
  guardedLoops: boolean
}

export type SinkraObservatoryMap = {
  displayName: string
  shortName: string
  kind: string
  headline: string
  narrative: string
  decision: string
  readiness: string
  healthLabel: string
  healthTone: string
  metrics: Array<{ label: string; value: string }>
  lanes: Array<{
    id: string
    title: string
    domain: string
    owner: string
    summary: string
    signal: string
    risk: string
    taskCount: number
  }>
  risks: Array<{
    id: string
    severity: string
    title: string
    evidence: string
    action: string
  }>
  nextActions: Array<{
    priority: string
    title: string
    owner: string
    targetArtifact: string
  }>
  readinessBars: Array<{ label: string; value: number; status: string; note: string }>
  executorMix: Array<{ executor: string; tasks: number; tone: string; role: string; insight: string }>
  gateBoard: Array<{
    id: string
    title: string
    status: string
    severity: string
    veto: boolean
    threshold: string
    owner: string
    blocks: string
  }>
  criticalPath: Array<{ step: string; task: string; executor: string; state: string; note: string }>
  decisionMatrix: Array<{ question: string; answer: string; signal: string }>
}

export type SinkraAutomationSpec = {
  taskId: string
  taskName: string
  executorType: string
  automationType: string
  frequency: string
  impact: string
  automatability: number | null
  standardization: number | null
  checkpointStatus: string
  guardrailsPresent: string[]
  guardrailsMissing: string[]
  dependsOnGaps: string[]
  justification: string
}

export type SinkraAccountabilityRow = {
  taskId: string
  taskName: string
  responsible: string
  responsibleType: string
  accountable: string
  consulted: string[]
  informed: string[]
}

export type SinkraGap = {
  id: string
  title: string
  severity: string
  category: string
  blockers: string[]
  executorTypes: string[]
  impact: string
  resolution: string
  fallback: string
}

export type SinkraComplianceDimension = {
  id: string
  name: string
  score: number | null
  threshold: number | null
  status: string
  rationale: string
}

export type SinkraBlockingIssue = {
  id: string
  title: string
  severity: string
  linkedGate: string
  impact: string
}

export type SinkraExecutionPhase = {
  id: string
  status: string
  agent: string
  durationSeconds: number | null
  artifactCount: number
}

export type SinkraRuntimeMetric = {
  phase: string
  model: string
  costUsd: number | null
  durationSeconds: number | null
  status: string
  outputTokens: number | null
}

export type SinkraScoreBreakdownItem = {
  id: string
  label: string
  score: number | null
  max: number | null
  weight: number | null
  status: string
  findings: string[]
}

export type SinkraCompositionNode = {
  id: string
  name: string
  level: "template" | "organism" | "molecule" | "atom"
  parentId: string
  count: number
}

export type SinkraHandoffPacket = {
  from: string
  to: string
  packet: string
}

export type SinkraTokenFlow = {
  tokenName: string
  tokenValue: string
  type: string
  domain: string
  producedBy: string
  consumedBy: string[]
}

export type SinkraMapStructured = {
  processName: string
  version: string
  mode: string
  workflows: SinkraWorkflow[]
  tasks: SinkraTask[]
  gates: SinkraGate[]
  score: SinkraScore
  processPhases: SinkraProcessPhase[]
  domains: SinkraDomainGroup[]
  dependencies: SinkraDependencyGraph
  observatoryMap: SinkraObservatoryMap | null
  automation: SinkraAutomationSpec[]
  accountability: SinkraAccountabilityRow[]
  gaps: SinkraGap[]
  compliance: {
    status: string
    handoffBlocked: boolean
    currentScore: number | null
    dimensions: SinkraComplianceDimension[]
    blockingIssues: SinkraBlockingIssue[]
    scoreBreakdown: SinkraScoreBreakdownItem[]
    remediationItems: Array<{ priority: string; dimension: string; finding: string; action: string }>
  }
  composition: {
    nodes: SinkraCompositionNode[]
    organismSequence: string[]
    handoffPackets: SinkraHandoffPacket[]
    adjacencyValidation: string
  }
  tokenFlow: {
    tokens: SinkraTokenFlow[]
    finalOutputs: string[]
    taskCountCovered: number
  }
  execution: {
    phases: SinkraExecutionPhase[]
    metrics: SinkraRuntimeMetric[]
  }
  artifactCoverage: Array<{ key: string; label: string; present: boolean }>
}

export type SinkraMapsObservatoryData = {
  stats: {
    totalRuns: number
    withWorkflow: number
    withTasks: number
    withGates: number
    withScore: number
  }
  runs: SinkraMapRunSummary[]
  selectedRun: SinkraMapRunSummary
  documents: SinkraMapDocument[]
  selectedDocument: SinkraMapDocument
  structured: SinkraMapStructured
}

const CONTENT_LIMIT = 50000
const INDEX_CACHE_TTL_MS = 5 * 60_000
const RUN_CACHE_TTL_MS = 5 * 60_000
const INDEX_BUILD_CONCURRENCY = 24
const KEY_FILES = [
  ["observatory_map.yaml", "Observatory"],
  ["composition_map.yaml", "Composition"],
  ["token_assignments.yaml", "Tokens"],
  ["workflow_definition.yaml", "Workflow"],
  ["task_definitions.yaml", "Tasks"],
  ["quality_gates.yaml", "Gates"],
  ["score_card.yaml", "Score"],
  ["process_map.yaml", "Process"],
  ["domain_map.yaml", "Domain"],
  ["dependency_graph.yaml", "Dependencies"],
  ["executor_matrix.yaml", "Executors"],
  ["automation_specs.yaml", "Automation"],
  ["raci_matrix.yaml", "RACI"],
  ["capability_gaps.yaml", "Gaps"],
  ["compliance_score.yaml", "Compliance"],
  ["sinkra-state.json", "State"],
  ["metrics.jsonl", "Metrics"],
] as const

let indexCache:
  | {
      root: string
      expiresAt: number
      slugs: string[]
      summaries: Omit<SinkraMapRunSummary, "active">[]
    }
  | null = null

const runCache = new Map<
  string,
  {
    expiresAt: number
    files: string[]
    documentsMeta: SinkraMapDocument[]
    structured: SinkraMapStructured
  }
>()

const VIEW_FILE_SETS: Partial<Record<ReaderMode, string[]>> = {
  map: [
    "observatory_map.yaml",
    "workflow_definition.yaml",
    "task_definitions.yaml",
    "quality_gates.yaml",
    "score_card.yaml",
    "process_map.yaml",
    "domain_map.yaml",
    "dependency_graph.yaml",
  ],
  flow: [
    "observatory_map.yaml",
    "workflow_definition.yaml",
    "dependency_graph.yaml",
    "composition_map.yaml",
    "token_assignments.yaml",
  ],
  automation: [
    "observatory_map.yaml",
    "task_definitions.yaml",
    "automation_specs.yaml",
    "capability_gaps.yaml",
  ],
  governance: [
    "observatory_map.yaml",
    "quality_gates.yaml",
    "score_card.yaml",
    "compliance_score.yaml",
  ],
  accountability: [
    "observatory_map.yaml",
    "task_definitions.yaml",
    "raci_matrix.yaml",
  ],
  gaps: [
    "observatory_map.yaml",
    "capability_gaps.yaml",
    "compliance_score.yaml",
    "score_card.yaml",
  ],
  evidence: [
    "observatory_map.yaml",
    "sinkra-state.json",
    "metrics.jsonl",
    "score_card.yaml",
  ],
  score: [
    "score_card.yaml",
    "compliance_score.yaml",
  ],
  document: [],
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function findRepoRoot(startPath: string) {
  let cursor = startPath
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(cursor, "outputs", "sinkra-squad"))) return cursor
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
  return path.resolve(startPath, "../..")
}

async function listFiles(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((file) => /\.(md|ya?ml|json|jsonl|mmd|svg)$/i.test(file))
    .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b))
}

async function listRunDirs(root: string, rel = "", depth = 0): Promise<string[]> {
  if (depth > 4) return []
  const full = path.join(root, rel)
  const entries = await readdir(full, { withFileTypes: true })
  const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  const hasSignal = KEY_FILES.some(([file]) => fileNames.includes(file)) ||
    fileNames.includes("sinkra-output.yaml") ||
    fileNames.includes("mission-output.yaml")
  const dirs = entries.filter((entry) => entry.isDirectory())
  const nested = (await Promise.all(dirs.map((entry) => listRunDirs(root, path.join(rel, entry.name), depth + 1)))).flat()
  return hasSignal && rel ? [rel, ...nested] : nested
}

function priority(file: string) {
  if (file === "observatory_map.yaml") return -1
  if (file === "sinkra-output.md") return 0
  if (file === "sinkra-output.yaml") return 1
  if (file === "composition_map.yaml") return 2
  if (file === "token_assignments.yaml") return 3
  if (file === "workflow_definition.yaml") return 4
  if (file === "task_definitions.yaml") return 5
  if (file === "quality_gates.yaml") return 6
  if (file === "score_card.yaml") return 7
  if (file === "process_map.yaml") return 8
  if (file === "domain_map.yaml") return 9
  if (file === "dependency_graph.yaml") return 10
  return 20
}

function phaseForFile(file: string) {
  if (/workflow/i.test(file)) return "workflow"
  if (/task/i.test(file)) return "tasks"
  if (/quality|gate/i.test(file)) return "gates"
  if (/score|compliance/i.test(file)) return "score"
  if (/process|as_is/i.test(file)) return "process"
  if (/domain/i.test(file)) return "domain"
  if (/dependency|dag/i.test(file)) return "dependencies"
  if (/executor|raci/i.test(file)) return "executors"
  if (/handoff/i.test(file)) return "handoff"
  return "artifact"
}

function humanizeSlug(value: string) {
  return value
    .replace(/^\d{8}-\d{6}-/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function compactTitle(value: string) {
  const title = humanizeSlug(value).trim()
  if (title.length <= 64) return title

  return title
    .replace(/\s+—\s+.+$/, "")
    .replace(/\s+-\s+.+$/, "")
    .replace(/\s+Baseado Em.+$/i, "")
    .replace(/\s+Que\s+.+$/i, "")
    .replace(/\s*,\s+.+$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 64)
    .trim()
}

function titleFromSlug(slug: string) {
  const parts = slug.split(path.sep).filter(Boolean)
  const mapIndex = parts.findIndex((part) => part === "map" || part === "validate")
  if (mapIndex > 0) return compactTitle(parts.slice(0, mapIndex).join(" "))
  if (parts[0] === "skill-validations" && parts[1]) return compactTitle(parts[1])
  return compactTitle(parts[0] ?? slug)
}

function categoryFromSlug(slug: string) {
  if (slug.includes(`${path.sep}map${path.sep}`)) return "map"
  if (slug.includes(`${path.sep}validate${path.sep}`)) return "validate"
  if (slug.includes("mission")) return "mission"
  return "process"
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback
  return String(value)
}

function asNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function readYaml(runPath: string, file: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(runPath, file), "utf8")
    return asRecord(YAML.parse(raw))
  } catch {
    return {}
  }
}

async function readJson(runPath: string, file: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(runPath, file), "utf8")
    return asRecord(JSON.parse(raw))
  } catch {
    return {}
  }
}

async function readJsonl(runPath: string, file: string): Promise<unknown[]> {
  try {
    const raw = await readFile(path.join(runPath, file), "utf8")
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch {
    return []
  }
}

function extractSteps(workflow: Record<string, unknown>) {
  return asArray(workflow.steps).map((raw, index) => {
    const step = asRecord(raw)
    const guardrails = asRecord(step.guardrails)
    return {
      id: asString(step.step_id, `s_${String(index + 1).padStart(2, "0")}`),
      phase: asString(step.phase_id, ""),
      task: asString(step.task_id, ""),
      name: asString(step.name, asString(step.task_id, "Step")),
      executor: asString(step.executor_type, "—"),
      outputCount: asArray(step.outputs).length,
      guardrailCount: Object.keys(guardrails).length,
    }
  })
}

function extractAutomationSpecs(automationYaml: Record<string, unknown>): SinkraAutomationSpec[] {
  return asArray(automationYaml.automation_specs).map((raw, index) => {
    const spec = asRecord(raw)
    return {
      taskId: asString(spec.task_id, `task-${index + 1}`),
      taskName: asString(spec.task_name, asString(spec.task_id, `Task ${index + 1}`)),
      executorType: asString(spec.executor_type, "—"),
      automationType: asString(spec.automation_type, "—"),
      frequency: asString(spec.frequency, "—"),
      impact: asString(spec.impact, "—"),
      automatability: asNumber(spec.automatabilidade ?? spec.automatability),
      standardization: asNumber(spec.standardization_score),
      checkpointStatus: asString(spec.checkpoint_status, "—"),
      guardrailsPresent: asArray(spec.guardrails_present).map((item) => asString(item)).filter(Boolean),
      guardrailsMissing: asArray(spec.guardrails_missing).map((item) => asString(item)).filter(Boolean),
      dependsOnGaps: asArray(spec.depends_on_gap_refs).map((item) => asString(item)).filter(Boolean),
      justification: asString(spec.justification, ""),
    }
  })
}

function extractAccountability(raciYaml: Record<string, unknown>): SinkraAccountabilityRow[] {
  return asArray(raciYaml.raci_matrix).map((raw, index) => {
    const row = asRecord(raw)
    return {
      taskId: asString(row.task_id, `task-${index + 1}`),
      taskName: asString(row.task_name, asString(row.task_id, `Task ${index + 1}`)),
      responsible: asString(row.responsible, "—"),
      responsibleType: asString(row.responsible_executor_type, "—"),
      accountable: asString(row.accountable, "—"),
      consulted: asArray(row.consulted).map((item) => asString(item)).filter(Boolean),
      informed: asArray(row.informed).map((item) => asString(item)).filter(Boolean),
    }
  })
}

function extractGaps(gapsYaml: Record<string, unknown>): SinkraGap[] {
  return asArray(gapsYaml.capability_gaps).map((raw, index) => {
    const gap = asRecord(raw)
    return {
      id: asString(gap.gap_id, `GAP-${String(index + 1).padStart(3, "0")}`),
      title: asString(gap.title, "Gap"),
      severity: asString(gap.severity, "—"),
      category: asString(gap.category, "—"),
      blockers: asArray(gap.blocker_for).map((item) => asString(item)).filter(Boolean),
      executorTypes: asArray(gap.affects_executor_types).map((item) => asString(item)).filter(Boolean),
      impact: asString(gap.impact, ""),
      resolution: asString(gap.resolution, ""),
      fallback: asString(gap.fallback_until_resolved, ""),
    }
  })
}

function extractCompliance(complianceYaml: Record<string, unknown>, scoreYaml: Record<string, unknown>) {
  const verdict = asRecord(complianceYaml.verdict)
  const overall = asRecord(scoreYaml.overall)
  const scores = asRecord(scoreYaml.scores)
  return {
    status: asString(verdict.status ?? overall.status, "—"),
    handoffBlocked: Boolean(verdict.handoff_blocked ?? overall.auto_fail),
    currentScore: asNumber(verdict.current_compliance_score ?? overall.score),
    dimensions: asArray(complianceYaml.dimension_results).map((raw) => {
      const dimension = asRecord(raw)
      return {
        id: asString(dimension.id, ""),
        name: asString(dimension.name, "Dimensão"),
        score: asNumber(dimension.score),
        threshold: asNumber(dimension.threshold),
        status: asString(dimension.status, "—"),
        rationale: asString(dimension.rationale, ""),
      }
    }),
    blockingIssues: asArray(complianceYaml.blocking_issues).map((raw) => {
      const issue = asRecord(raw)
      return {
        id: asString(issue.id, ""),
        title: asString(issue.title, "Issue"),
        severity: asString(issue.severity, "—"),
        linkedGate: asString(issue.linked_gate, ""),
        impact: asString(issue.impact, ""),
      }
    }),
    scoreBreakdown: Object.entries(scores).map(([id, raw]) => {
      const score = asRecord(raw)
      return {
        id,
        label: id.replace(/_/g, " "),
        score: asNumber(score.score),
        max: asNumber(score.max),
        weight: asNumber(score.weight),
        status: asString(score.status ?? (asNumber(score.score) === asNumber(score.max) ? "PASS" : "REVIEW"), ""),
        findings: asArray(score.findings).map((item) => asString(item)).filter(Boolean),
      }
    }),
    remediationItems: asArray(scoreYaml.remediation_items).map((raw) => {
      const item = asRecord(raw)
      return {
        priority: asString(item.priority, ""),
        dimension: asString(item.dimension, ""),
        finding: asString(item.finding, ""),
        action: asString(item.action, ""),
      }
    }),
  }
}

function extractComposition(compositionYaml: Record<string, unknown>) {
  const hierarchy = asRecord(compositionYaml.hierarchy)
  const template = asRecord(asArray(hierarchy.templates)[0] ?? hierarchy.template)
  const organisms = asArray(hierarchy.organisms).map((raw) => asRecord(raw))
  const molecules = asArray(hierarchy.molecules).map((raw) => asRecord(raw))
  const atoms = asArray(hierarchy.atoms).map((raw) => asRecord(raw))
  const validation = asRecord(compositionYaml.validation)
  const nodes: SinkraCompositionNode[] = []

  if (Object.keys(template).length > 0) {
    nodes.push({
      id: asString(template.template_id, "template"),
      name: asString(template.name, "Template"),
      level: "template",
      parentId: "",
      count: organisms.length,
    })
  }
  nodes.push(...organisms.map((organism) => ({
    id: asString(organism.organism_id, ""),
    name: asString(organism.name, ""),
    level: "organism" as const,
    parentId: asString(template.template_id, "template"),
    count: asArray(organism.molecules).length,
  })))
  nodes.push(...molecules.map((molecule) => ({
    id: asString(molecule.molecule_id, ""),
    name: asString(molecule.name, ""),
    level: "molecule" as const,
    parentId: asString(molecule.organism_id, ""),
    count: asArray(molecule.atoms).length,
  })))
  nodes.push(...atoms.map((atom) => ({
    id: asString(atom.atom_id, ""),
    name: asString(atom.task_name, asString(atom.task_id, "")),
    level: "atom" as const,
    parentId: asString(atom.molecule_id, ""),
    count: asArray(atom.outputs).length,
  })))

  return {
    nodes: nodes.filter((node) => node.id),
    organismSequence: asArray(compositionYaml.organism_sequence).map((item) => asString(item)).filter(Boolean),
    handoffPackets: asArray(compositionYaml.handoff_packets).map((raw) => {
      const packet = asRecord(raw)
      return {
        from: asString(packet.from, ""),
        to: asString(packet.to, ""),
        packet: asString(packet.packet, ""),
      }
    }),
    adjacencyValidation: asString(validation.adjacency_validation, ""),
  }
}

function extractTokenFlow(tokenYaml: Record<string, unknown>) {
  const coverage = asRecord(tokenYaml.coverage_summary)
  return {
    tokens: asArray(tokenYaml.tokens).map((raw) => {
      const token = asRecord(raw)
      return {
        tokenName: asString(token.token_name, ""),
        tokenValue: asString(token.token_value, ""),
        type: asString(token.token_type, ""),
        domain: asString(token.domain, ""),
        producedBy: asString(token.produced_by, ""),
        consumedBy: asArray(token.consumed_by).map((item) => asString(item)).filter(Boolean),
      }
    }),
    finalOutputs: asArray(tokenYaml.final_output_tokens).map((item) => asString(item)).filter(Boolean),
    taskCountCovered: asNumber(coverage.task_count_covered) ?? 0,
  }
}

function extractExecution(stateJson: Record<string, unknown>, metricsJsonl: unknown[]) {
  const artifacts = asArray(stateJson.artifacts).map((item) => asRecord(item))
  const phases = Object.entries(asRecord(stateJson.phases)).map(([id, raw]) => {
    const phase = asRecord(raw)
    return {
      id,
      status: asString(phase.status, "—"),
      agent: asString(phase.agent, "—"),
      durationSeconds: asNumber(phase.duration_seconds),
      artifactCount: artifacts.filter((artifact) => asString(artifact.phase, "") === id).length,
    }
  })
  const metrics = metricsJsonl.map((raw) => {
    const metric = asRecord(raw)
    return {
      phase: asString(metric.phase, "—"),
      model: asString(metric.model, "—"),
      costUsd: asNumber(metric.cost_usd),
      durationSeconds: asNumber(metric.duration_s),
      status: asString(metric.status, "—"),
      outputTokens: asNumber(metric.output_tokens),
    }
  })
  return { phases, metrics }
}

function hasDriftSignal(raw: string) {
  return /drift|major|gap|inconsist|ausente|missing|skipped|not observed/i.test(raw)
}

function extractProcessPhases(processYaml: Record<string, unknown>): SinkraProcessPhase[] {
  return asArray(processYaml.phases).map((raw, index) => {
    const phase = asRecord(raw)
    const drift = asString(phase.drift_delta, "")
    const painPoints = asArray(phase.pain_points).map((item) => asString(item)).filter(Boolean)
    return {
      id: asString(phase.phase_id, `phase_${String(index + 1).padStart(2, "0")}`),
      name: asString(phase.name, `Phase ${index + 1}`),
      executor: asString(phase.executor_type ?? phase.executor_atual, "—"),
      drift,
      observed: asString(phase.observed_behavior, ""),
      painPoints,
      hasDrift: hasDriftSignal(drift) || painPoints.length > 0,
    }
  })
}

function extractDomains(domainYaml: Record<string, unknown>): SinkraDomainGroup[] {
  const groups = new Map<string, Array<Record<string, unknown>>>()
  for (const raw of asArray(domainYaml.domain_mapping)) {
    const item = asRecord(raw)
    const domain = asString(item.domain, "Unclassified")
    groups.set(domain, [...(groups.get(domain) ?? []), item])
  }

  return Array.from(groups.entries()).map(([domain, items]) => ({
    domain,
    total: items.length,
    gapClosed: items.filter((item) => Boolean(asString(item.gap_closed, ""))).length,
    samples: items.slice(0, 6).map((item) => ({
      id: asString(item.task_id, "—"),
      name: asString(item.task_name, "—"),
      level: asString(item.hierarchy_level, "—"),
      type: asString(item.type, "standard"),
      gap: asString(item.gap_closed, ""),
    })),
  }))
}

function extractDependencies(dependencyYaml: Record<string, unknown>): SinkraDependencyGraph {
  const graph = asRecord(dependencyYaml.graph)
  const validation = asRecord(dependencyYaml.dag_validation)
  return {
    type: asString(graph.type ?? dependencyYaml.type, "DAG"),
    validated: Boolean(graph.validated ?? dependencyYaml.validated),
    roots: asArray(graph.roots).map((item) => asString(item)).filter(Boolean),
    leaves: asArray(graph.leaves).map((item) => asString(item)).filter(Boolean),
    nodes: asArray(graph.nodes).map((raw) => {
      const node = asRecord(raw)
      return {
        id: asString(node.task_id, "—"),
        dependsOn: asArray(node.depends_on).map((item) => asString(item)).filter(Boolean),
        feedsInto: asArray(node.feeds_into).map((item) => asString(item)).filter(Boolean),
        loop: Boolean(node.loop_edge),
      }
    }),
    strictDag: asString(validation.strict_dag_without_runtime_loop_edges, "—"),
    guardedLoops: Boolean(validation.runtime_loop_edges_are_guarded),
  }
}

function extractObservatoryMap(raw: Record<string, unknown>): SinkraObservatoryMap | null {
  if (asString(raw.schema, "") !== "sinkra-observatory-map/v1") return null

  const identity = asRecord(raw.identity)
  const summary = asRecord(raw.executive_summary)
  const health = asRecord(raw.health)
  const metrics = asRecord(raw.metrics)

  return {
    displayName: asString(identity.display_name, "Mapa SINKRA"),
    shortName: asString(identity.short_name, asString(identity.display_name, "Mapa")),
    kind: asString(identity.kind, "mapping"),
    headline: asString(summary.headline, ""),
    narrative: asString(summary.narrative, ""),
    decision: asString(summary.decision, ""),
    readiness: asString(health.readiness, ""),
    healthLabel: asString(health.label, ""),
    healthTone: asString(health.tone, "neutral"),
    metrics: Object.entries(metrics).map(([label, value]) => ({
      label,
      value: asString(value, "—"),
    })),
    lanes: asArray(raw.operational_lanes).map((item) => {
      const lane = asRecord(item)
      return {
        id: asString(lane.id, ""),
        title: asString(lane.title, ""),
        domain: asString(lane.domain, ""),
        owner: asString(lane.owner, ""),
        summary: asString(lane.summary, ""),
        signal: asString(lane.signal, ""),
        risk: asString(lane.risk, ""),
        taskCount: asArray(lane.tasks).length,
      }
    }),
    risks: asArray(raw.risk_register).map((item) => {
      const risk = asRecord(item)
      return {
        id: asString(risk.id, ""),
        severity: asString(risk.severity, ""),
        title: asString(risk.title, ""),
        evidence: asString(risk.evidence, ""),
        action: asString(risk.action, ""),
      }
    }),
    nextActions: asArray(raw.next_actions).map((item) => {
      const action = asRecord(item)
      return {
        priority: asString(action.priority, ""),
        title: asString(action.title, ""),
        owner: asString(action.owner, ""),
        targetArtifact: asString(action.target_artifact, ""),
      }
    }),
    readinessBars: asArray(raw.readiness_bars).map((item) => {
      const bar = asRecord(item)
      return {
        label: asString(bar.label, ""),
        value: asNumber(bar.value) ?? 0,
        status: asString(bar.status, ""),
        note: asString(bar.note, ""),
      }
    }),
    executorMix: asArray(raw.executor_mix).map((item) => {
      const executor = asRecord(item)
      return {
        executor: asString(executor.executor, ""),
        tasks: asNumber(executor.tasks) ?? 0,
        tone: asString(executor.tone, "neutral"),
        role: asString(executor.role, ""),
        insight: asString(executor.insight, ""),
      }
    }),
    gateBoard: asArray(raw.gate_board).map((item) => {
      const gate = asRecord(item)
      return {
        id: asString(gate.id, ""),
        title: asString(gate.title, ""),
        status: asString(gate.status, ""),
        severity: asString(gate.severity, ""),
        veto: Boolean(gate.veto),
        threshold: asString(gate.threshold, ""),
        owner: asString(gate.owner, ""),
        blocks: asString(gate.blocks, ""),
      }
    }),
    criticalPath: asArray(raw.critical_path).map((item) => {
      const step = asRecord(item)
      return {
        step: asString(step.step, ""),
        task: asString(step.task, ""),
        executor: asString(step.executor, ""),
        state: asString(step.state, ""),
        note: asString(step.note, ""),
      }
    }),
    decisionMatrix: asArray(raw.decision_matrix).map((item) => {
      const decision = asRecord(item)
      return {
        question: asString(decision.question, ""),
        answer: asString(decision.answer, ""),
        signal: asString(decision.signal, ""),
      }
    }),
  }
}

function structuredProcessName(...yamls: Array<Record<string, unknown>>) {
  for (const yaml of yamls) {
    const identity = asRecord(yaml.identity)
    const slugCandidate = asString(
      yaml.process_slug ??
        yaml.squad_slug ??
        identity.slug ??
        asRecord(yaml.meta).process_slug ??
        asRecord(yaml.metadata).process_slug,
      "",
    )
    if (slugCandidate) return compactTitle(slugCandidate)

    const candidate = asString(
      identity.display_name ??
        identity.short_name ??
        yaml.display_name ??
        yaml.process_display_name ??
        yaml.short_name ??
        yaml.process_name ??
        yaml.domain_mapping_name ??
        asRecord(yaml.meta).process_name ??
        asRecord(yaml.metadata).process_name ??
        yaml.workflow_name ??
        yaml.name,
      "",
    )
    if (candidate) return compactTitle(candidate)
  }
  return ""
}

async function readStructuredTitle(runPath: string, files: string[], slug: string) {
  const titleSources = [
    "observatory_map.yaml",
    "process_map.yaml",
    "workflow_definition.yaml",
    "task_definitions.yaml",
    "quality_gates.yaml",
    "domain_map.yaml",
    "dependency_graph.yaml",
    "score_card.yaml",
  ]

  for (const file of titleSources) {
    if (!files.includes(file)) continue
    const title = structuredProcessName(await readYaml(runPath, file))
    if (title) return title
  }
  return titleFromSlug(slug)
}

function extractStructured(
  files: string[],
  workflowYaml: Record<string, unknown>,
  tasksYaml: Record<string, unknown>,
  gatesYaml: Record<string, unknown>,
  scoreYaml: Record<string, unknown>,
  processYaml: Record<string, unknown>,
  domainYaml: Record<string, unknown>,
  dependencyYaml: Record<string, unknown>,
  observatoryYaml: Record<string, unknown>,
  automationYaml: Record<string, unknown>,
  raciYaml: Record<string, unknown>,
  gapsYaml: Record<string, unknown>,
  complianceYaml: Record<string, unknown>,
  compositionYaml: Record<string, unknown>,
  tokenYaml: Record<string, unknown>,
  stateJson: Record<string, unknown>,
  metricsJsonl: unknown[],
): SinkraMapStructured {
  const workflows = asArray(workflowYaml.workflows).map((raw, index) => {
    const workflow = asRecord(raw)
    return {
      id: asString(workflow.workflow_id, `WF-${index + 1}`),
      name: asString(workflow.name, "Workflow"),
      layer: asString(workflow.layer, ""),
      trigger: asString(workflow.trigger, ""),
      frequency: asString(workflow.frequency, ""),
      description: asString(workflow.description, ""),
      steps: extractSteps(workflow),
    }
  })

  const tasks = asArray(tasksYaml.tasks).map((raw, index) => {
    const task = asRecord(raw)
    const post = asRecord(task.post_conditions)
    return {
      id: asString(task.task, `task-${index + 1}`),
      layer: asString(task.atomic_layer, ""),
      executor: asString(task.responsavel_type, ""),
      inputCount: asArray(task.entrada).length,
      outputCount: asArray(task.saida).length,
      preconditions: asArray(task.pre_conditions).length,
      postconditions: asArray(post.conditions).length,
    }
  })

  const gates = asArray(gatesYaml.quality_gates).map((raw, index) => {
    const gate = asRecord(raw)
    return {
      id: asString(gate.gate_id, `QG-${index + 1}`),
      name: asString(gate.name, "Gate"),
      position: asString(gate.position, ""),
      type: asString(gate.type, ""),
      executor: asString(gate.executor, ""),
      threshold: asString(gate.threshold, "—"),
      veto: Boolean(gate.veto_power),
      criteriaCount: asArray(gate.criteria).length,
    }
  })

  const overall = asRecord(scoreYaml.overall)
  const score = {
    score: asNumber(overall.score ?? scoreYaml.compliance_score),
    result: asString(overall.result ?? scoreYaml.result ?? scoreYaml.quality_gate, "—"),
    structuralIntegrity: asNumber(overall.structural_integrity),
    qualityGate: asString(scoreYaml.quality_gate, ""),
  }

  const processName = structuredProcessName(
    observatoryYaml,
    processYaml,
    workflowYaml,
    tasksYaml,
    gatesYaml,
    domainYaml,
    dependencyYaml,
    scoreYaml,
  )

  return {
    processName: processName || asString(
      workflowYaml.process_name ??
        tasksYaml.process_name ??
        gatesYaml.process_name ??
        scoreYaml.process_name ??
        processYaml.process_name ??
        domainYaml.domain_mapping_name ??
        dependencyYaml.process_name,
      "",
    ),
    version: asString(workflowYaml.version ?? tasksYaml.version ?? gatesYaml.version ?? processYaml.version ?? dependencyYaml.version, ""),
    mode: asString(workflowYaml.type ?? tasksYaml.type ?? gatesYaml.type ?? processYaml.type ?? dependencyYaml.type, ""),
    workflows,
    tasks,
    gates,
    score,
    processPhases: extractProcessPhases(processYaml),
    domains: extractDomains(domainYaml),
    dependencies: extractDependencies(dependencyYaml),
    observatoryMap: extractObservatoryMap(observatoryYaml),
    automation: extractAutomationSpecs(automationYaml),
    accountability: extractAccountability(raciYaml),
    gaps: extractGaps(gapsYaml),
    compliance: extractCompliance(complianceYaml, scoreYaml),
    composition: extractComposition(compositionYaml),
    tokenFlow: extractTokenFlow(tokenYaml),
    execution: extractExecution(stateJson, metricsJsonl),
    artifactCoverage: KEY_FILES.map(([key, label]) => ({ key, label, present: files.includes(key) })),
  }
}

async function buildDocumentIndex(runPath: string, slug: string, files: string[]): Promise<SinkraMapDocument[]> {
  return Promise.all(
    files.map(async (file) => {
      const full = path.join(runPath, file)
      const st = await stat(full)
      return {
        id: `${slug}/${file}`,
        file,
        phase: phaseForFile(file),
        bytes: st.size,
        content: "",
        truncated: st.size > CONTENT_LIMIT,
      }
    }),
  )
}

async function loadDocumentContent(runPath: string, slug: string, doc: SinkraMapDocument): Promise<SinkraMapDocument> {
  const raw = await readFile(path.join(runPath, doc.file), "utf8")
  return {
    ...doc,
    id: `${slug}/${doc.file}`,
    content: raw.length > CONTENT_LIMIT ? `${raw.slice(0, CONTENT_LIMIT)}\n\n...` : raw,
    truncated: raw.length > CONTENT_LIMIT,
  }
}

function normalizeStructuredView(view: ReaderMode | undefined): ReaderMode {
  return view && view in VIEW_FILE_SETS ? view : "map"
}

function shouldLoadStructuredFile(view: ReaderMode | undefined, file: string) {
  const filesForView = VIEW_FILE_SETS[normalizeStructuredView(view)] ?? VIEW_FILE_SETS.map
  return filesForView?.includes(file) ?? false
}

async function buildRunPayload(root: string, slug: string, view?: ReaderMode) {
  const viewKey = normalizeStructuredView(view)
  const cacheKey = `${root}:${slug}:${viewKey}`
  const now = Date.now()
  const cached = runCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached

  const runPath = path.join(root, slug)
  const files = await listFiles(runPath)
  const documentsMeta = await buildDocumentIndex(runPath, slug, files)
  const [
    workflowYaml,
    tasksYaml,
    gatesYaml,
    scoreYaml,
    processYaml,
    domainYaml,
    dependencyYaml,
    observatoryYaml,
    automationYaml,
    raciYaml,
    gapsYaml,
    complianceYaml,
    compositionYaml,
    tokenYaml,
    stateJson,
    metricsJsonl,
  ] = await Promise.all([
    files.includes("workflow_definition.yaml") && shouldLoadStructuredFile(view, "workflow_definition.yaml") ? readYaml(runPath, "workflow_definition.yaml") : Promise.resolve({}),
    files.includes("task_definitions.yaml") && shouldLoadStructuredFile(view, "task_definitions.yaml") ? readYaml(runPath, "task_definitions.yaml") : Promise.resolve({}),
    files.includes("quality_gates.yaml") && shouldLoadStructuredFile(view, "quality_gates.yaml") ? readYaml(runPath, "quality_gates.yaml") : Promise.resolve({}),
    files.includes("score_card.yaml") && shouldLoadStructuredFile(view, "score_card.yaml") ? readYaml(runPath, "score_card.yaml") : Promise.resolve({}),
    files.includes("process_map.yaml") && shouldLoadStructuredFile(view, "process_map.yaml") ? readYaml(runPath, "process_map.yaml") : Promise.resolve({}),
    files.includes("domain_map.yaml") && shouldLoadStructuredFile(view, "domain_map.yaml") ? readYaml(runPath, "domain_map.yaml") : Promise.resolve({}),
    files.includes("dependency_graph.yaml") && shouldLoadStructuredFile(view, "dependency_graph.yaml") ? readYaml(runPath, "dependency_graph.yaml") : Promise.resolve({}),
    files.includes("observatory_map.yaml") && shouldLoadStructuredFile(view, "observatory_map.yaml") ? readYaml(runPath, "observatory_map.yaml") : Promise.resolve({}),
    files.includes("automation_specs.yaml") && shouldLoadStructuredFile(view, "automation_specs.yaml") ? readYaml(runPath, "automation_specs.yaml") : Promise.resolve({}),
    files.includes("raci_matrix.yaml") && shouldLoadStructuredFile(view, "raci_matrix.yaml") ? readYaml(runPath, "raci_matrix.yaml") : Promise.resolve({}),
    files.includes("capability_gaps.yaml") && shouldLoadStructuredFile(view, "capability_gaps.yaml") ? readYaml(runPath, "capability_gaps.yaml") : Promise.resolve({}),
    files.includes("compliance_score.yaml") && shouldLoadStructuredFile(view, "compliance_score.yaml") ? readYaml(runPath, "compliance_score.yaml") : Promise.resolve({}),
    files.includes("composition_map.yaml") && shouldLoadStructuredFile(view, "composition_map.yaml") ? readYaml(runPath, "composition_map.yaml") : Promise.resolve({}),
    files.includes("token_assignments.yaml") && shouldLoadStructuredFile(view, "token_assignments.yaml") ? readYaml(runPath, "token_assignments.yaml") : Promise.resolve({}),
    files.includes("sinkra-state.json") && shouldLoadStructuredFile(view, "sinkra-state.json") ? readJson(runPath, "sinkra-state.json") : Promise.resolve({}),
    files.includes("metrics.jsonl") && shouldLoadStructuredFile(view, "metrics.jsonl") ? readJsonl(runPath, "metrics.jsonl") : Promise.resolve([]),
  ])

  const payload = {
    expiresAt: now + RUN_CACHE_TTL_MS,
    files,
    documentsMeta,
    structured: extractStructured(
      files,
      workflowYaml,
      tasksYaml,
      gatesYaml,
      scoreYaml,
      processYaml,
      domainYaml,
      dependencyYaml,
      observatoryYaml,
      automationYaml,
      raciYaml,
      gapsYaml,
      complianceYaml,
      compositionYaml,
      tokenYaml,
      stateJson,
      metricsJsonl,
    ),
  }
  runCache.set(cacheKey, payload)
  return payload
}

async function buildSummary(root: string, slug: string): Promise<Omit<SinkraMapRunSummary, "active">> {
  const runPath = path.join(root, slug)
  const files = await listFiles(runPath)
  const st = await stat(runPath)
  const hasWorkflow = files.includes("workflow_definition.yaml")
  const hasTasks = files.includes("task_definitions.yaml")
  const hasGates = files.includes("quality_gates.yaml")
  const hasScore = files.includes("score_card.yaml")
  const hasProcess = files.includes("process_map.yaml")
  const hasDeps = files.includes("dependency_graph.yaml")
  const hasDomain = files.includes("domain_map.yaml")
  const hasObservatory = files.includes("observatory_map.yaml")
  const hasAutomation = files.includes("automation_specs.yaml")
  const hasRaci = files.includes("raci_matrix.yaml")
  const hasGaps = files.includes("capability_gaps.yaml")
  const hasCompliance = files.includes("compliance_score.yaml")
  const hasComposition = files.includes("composition_map.yaml")
  const hasTokens = files.includes("token_assignments.yaml")
  const hasState = files.includes("sinkra-state.json")
  const hasMetrics = files.includes("metrics.jsonl")
  const scoreYaml = hasScore ? await readYaml(runPath, "score_card.yaml") : {}
  const overall = asRecord(scoreYaml.overall)
  const score = asString(overall.score ?? scoreYaml.compliance_score, "--")
  const complete = hasWorkflow && hasTasks && hasGates
  const title = await readStructuredTitle(runPath, files, slug)
  return {
    slug,
    title,
    date: st.mtime.toISOString().slice(0, 10),
    category: categoryFromSlug(slug),
    status: complete ? "completed" : hasWorkflow || hasTasks || hasGates ? "partial" : "legacy",
    score,
    files: files.length,
    hasWorkflow,
    hasTasks,
    hasGates,
    hasScore,
    hasProcess,
    hasDeps,
    hasDomain,
    hasObservatory,
    hasAutomation,
    hasRaci,
    hasGaps,
    hasCompliance,
    hasComposition,
    hasTokens,
    hasState,
    hasMetrics,
  }
}

function mapCompletenessScore(summary: Omit<SinkraMapRunSummary, "active">) {
  return [
    summary.hasWorkflow ? 4 : 0,
    summary.hasTasks ? 4 : 0,
    summary.hasGates ? 4 : 0,
    summary.hasProcess ? 3 : 0,
    summary.hasDomain ? 3 : 0,
    summary.hasDeps ? 3 : 0,
    summary.hasScore ? 1 : 0,
    Math.min(summary.files, 12) / 12,
  ].reduce((total, value) => total + value, 0)
}

function chooseDefaultSlug(summaries: Omit<SinkraMapRunSummary, "active">[]) {
  return [...summaries]
    .sort((a, b) => {
      const qualityDelta = mapCompletenessScore(b) - mapCompletenessScore(a)
      if (qualityDelta !== 0) return qualityDelta
      return b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)
    })[0]?.slug
}

async function getSinkraMapIndex(root: string): Promise<{
  slugs: string[]
  summaries: Omit<SinkraMapRunSummary, "active">[]
}> {
  const now = Date.now()
  if (indexCache && indexCache.root === root && indexCache.expiresAt > now) {
    return {
      slugs: indexCache.slugs,
      summaries: indexCache.summaries,
    }
  }

  const slugs = await listRunDirs(root)
  const summaries = await mapWithConcurrency(slugs, INDEX_BUILD_CONCURRENCY, (s) => buildSummary(root, s))
  indexCache = {
    root,
    expiresAt: now + INDEX_CACHE_TTL_MS,
    slugs,
    summaries,
  }
  return { slugs, summaries }
}

export async function getSinkraMapsObservatoryData(slug?: string, file?: string, view?: ReaderMode): Promise<SinkraMapsObservatoryData> {
  const repoRoot = findRepoRoot(process.cwd())
  const root = path.join(repoRoot, "outputs", "sinkra-squad")
  const { slugs, summaries } = await getSinkraMapIndex(root)
  const selectedSlug = slug && slugs.includes(slug) ? slug : chooseDefaultSlug(summaries)
  if (!selectedSlug) throw new Error("No SINKRA map outputs found")

  const runs = summaries
    .map((summary) => ({ ...summary, active: summary.slug === selectedSlug }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
  const selectedRun = runs.find((run) => run.slug === selectedSlug) ?? runs[0]
  const runPath = path.join(root, selectedRun.slug)
  const runPayload = await buildRunPayload(root, selectedRun.slug, view)
  const selectedDocumentMeta = runPayload.documentsMeta.find((doc) => doc.file === file) ?? runPayload.documentsMeta[0]
  const selectedDocument = selectedDocumentMeta
    ? await loadDocumentContent(runPath, selectedRun.slug, selectedDocumentMeta)
    : {
        id: selectedRun.slug,
        file: "sinkra-output.md",
        phase: "artifact",
        bytes: 0,
        content: "",
        truncated: false,
      }
  const documents = runPayload.documentsMeta.map((doc) =>
    doc.file === selectedDocument.file ? selectedDocument : doc,
  )

  return {
    stats: {
      totalRuns: runs.length,
      withWorkflow: runs.filter((run) => run.hasWorkflow).length,
      withTasks: runs.filter((run) => run.hasTasks).length,
      withGates: runs.filter((run) => run.hasGates).length,
      withScore: runs.filter((run) => run.hasScore).length,
    },
    runs,
    selectedRun,
    documents,
    selectedDocument,
    structured: runPayload.structured,
  }
}
