import type { ObservatorySource, ReaderMode } from "./constants"

export type { ReaderMode } from "./constants"

/* ──────────────────────────────────────────────────────────────────────
   ObservatoryData — universal contract returned by every adapter.

   Each corpus (research, bench, sessions, …) implements its own adapter
   that maps its native loader output (e.g. ResearchObservatoryData,
   BenchDashboardData) into this shape.

   The Observatory shell renders the same UI for all sources, branching
   only on optional rich blocks (matrix, personas, tco) when present.
   ────────────────────────────────────────────────────────────────────── */

export type ObservatoryDocument = {
  id: string
  file: string
  phase: string
  bytes: number
  content: string
  truncated: boolean
}

export type ObservatoryRunSummary = {
  slug: string
  title: string
  displayTitle: string
  date: string
  category: string | null         // adapter-specific bucket (CategorySlug for research, bench.type for bench)
  schema: string                  // adapter-defined schema variant (e.g., "deep-research-v3", "3way-codebase-architecture-v1")
  status: string
  coverage: string                // numeric or enum, formatted for display
  integrity: string
  files: number
  waves: number
  sources: number
  active: boolean
  inferred?: Record<string, boolean | undefined>
  /* Source-specific extras: adapters can attach arbitrary metadata
     (e.g., bench: variant, neutral_score; research: stop_reason). */
  extras?: Record<string, unknown>
  runtimeRunIds?: string[]
}

export type ObservatorySource_Entry = {
  id: string
  url: string
  title: string
  date: string
  credibility: string
  multiplier?: number
  flags: string[]
}

export type ObservatoryPlayer = {
  id: string
  number: string
  name: string
  tier: 1 | 2 | 3 | null
  tierMeaning: string | null
  category: string | null
  role: string | null
  fit: string | null
  action: string | null
  whatItDoes: string | null
  whatItDoesNot: string | null
  insight: string | null
  sourceTitle: string | null
  sourceUrl: string | null
  sourceDate: string | null
  excluded: boolean
  exclusionReason: string | null
}

/* ── Bench-specific rich blocks (optional — populated only by bench adapter) ── */

export type ObservatoryMatrixCell = {
  player: string
  score: number
  confidence: string
  notes: string
  source: string
  scoreBreakdown?: Record<string, number> | null
  scoreReason?: string
  scoreEvolution?: number[]
  categoricalWinner?: boolean
}

export type ObservatoryMatrixRow = {
  id: string
  parentId?: string
  label: string
  short?: string
  question?: string
  group?: string
  weight: number
  evidence?: string
  bestPlayer?: string
  bestScore?: number
  cells: ObservatoryMatrixCell[]
}

export type ObservatoryMatrix = {
  players: string[]
  rows: ObservatoryMatrixRow[]
  totals: Array<{ player: string; score: number }>
  method: string
  scoringGuide?: Record<string, unknown> | null
}

export type ObservatoryPersona = {
  id: string
  label: string
  sub: string
  job: string
  mustHave: string[]
  antiGoals: string[]
  decisiveDimensions: Array<{ id: string; label: string; group: string; weight: number }>
  weights: number[]
  totals: Array<{ player: string; score: number }>
  ranking: Array<{ rank: number; player: string; score: number; delta: string }>
  winner: string
  runner: string
  delta: number | null
  verdict: string
  tiebreaker: string
}

export type ObservatoryScoreMetric = {
  label: string
  value: string
}

export type ObservatoryScoreDimension = {
  name: string
  weight: string
  winner: string
  delta: string
  evidence: string
  scores: ObservatoryScoreMetric[]
}

export type ObservatoryTcoRow = {
  player: string
  setup: string
  low: number | null
  high: number | null
  baseline: boolean
}

export type ObservatoryTcoScenario = {
  id: string
  label: string
  unit: string
  rows: ObservatoryTcoRow[]
}

export type ObservatoryTco = {
  currency: string
  unit: string
  scenarios: ObservatoryTcoScenario[]
}

export type ObservatoryTiebreaker = { id: string; q: string; yes: string; no: string }
export type ObservatoryCliff = { player: string; trigger: string; impact: string }
export type ObservatoryDecisionNode = { q: string; yes: string; no: string }
export type ObservatoryCategoricalWinner = { dimension: string; winner: string; loser: string; note: string }
export type ObservatoryGapItem = {
  id: string
  title: string
  priority: string
  complexity: string
  rationale: string
}
export type ObservatoryMetric = { label: string; value: string }

export type ObservatoryEditorsNote = {
  title: string
  byline: string
  date: string
  paragraphs: string[]
}

export type ObservatoryPlayerProfile = {
  key: string
  name: string
  category: string
  type: string
  license: string
  origin: string
  years: number | null
  techScore: number | null
  neutralScore: number | null
  color: string
  letter: string
  tag: string
  /* Public URLs — repoUrl preferred (GitHub etc); vendorUrl when only vendor site exists.
     Empty string when the bench did not provide one. Consumers should treat both as optional. */
  repoUrl: string
  vendorUrl: string
}

export type ObservatoryCoverageStackEntry = {
  combo: string
  players: string[]
  coverage: number
  ideal: boolean
  synergy: number | null
}

export type ObservatoryThreeAxisPoint = {
  id: string
  label: string
  x: number
  y: number
  z: number
}

export type ObservatoryKnowledgeIcebergItem = {
  id: string
  code: number
  yaml: number
  md: number
  total: number
  ratio: number
}

export type ObservatoryTypeSpecific = {
  codebase?: {
    coverageStack: ObservatoryCoverageStackEntry[]
    threeAxis: {
      axes: string[]
      points: ObservatoryThreeAxisPoint[]
    } | null
    knowledgeIceberg: ObservatoryKnowledgeIcebergItem[]
  }
  product?: Record<string, unknown>
  sinkra?: ObservatorySinkraMap
}

export type ObservatorySinkraWorkflowStep = {
  id: string
  phase: string
  task: string
  name: string
  executor: string
  outputCount: number
  guardrailCount: number
}

export type ObservatorySinkraWorkflow = {
  id: string
  name: string
  layer: string
  trigger: string
  frequency: string
  description: string
  steps: ObservatorySinkraWorkflowStep[]
}

export type ObservatorySinkraTask = {
  id: string
  layer: string
  executor: string
  inputCount: number
  outputCount: number
  preconditions: number
  postconditions: number
}

export type ObservatorySinkraGate = {
  id: string
  name: string
  position: string
  type: string
  executor: string
  threshold: string
  veto: boolean
  criteriaCount: number
}

export type ObservatorySinkraScore = {
  score: number | null
  result: string
  structuralIntegrity: number | null
  qualityGate: string
}

export type ObservatorySinkraProcessPhase = {
  id: string
  name: string
  executor: string
  drift: string
  observed: string
  painPoints: string[]
  hasDrift: boolean
}

export type ObservatorySinkraDomainGroup = {
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

export type ObservatorySinkraDependencyNode = {
  id: string
  dependsOn: string[]
  feedsInto: string[]
  loop: boolean
}

export type ObservatorySinkraDependencyGraph = {
  type: string
  validated: boolean
  roots: string[]
  leaves: string[]
  nodes: ObservatorySinkraDependencyNode[]
  strictDag: string
  guardedLoops: boolean
}

export type ObservatorySinkraObservatoryMap = {
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

export type ObservatorySinkraAutomationSpec = {
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

export type ObservatorySinkraAccountabilityRow = {
  taskId: string
  taskName: string
  responsible: string
  responsibleType: string
  accountable: string
  consulted: string[]
  informed: string[]
}

export type ObservatorySinkraGap = {
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

export type ObservatorySinkraComplianceDimension = {
  id: string
  name: string
  score: number | null
  threshold: number | null
  status: string
  rationale: string
}

export type ObservatorySinkraBlockingIssue = {
  id: string
  title: string
  severity: string
  linkedGate: string
  impact: string
}

export type ObservatorySinkraExecutionPhase = {
  id: string
  status: string
  agent: string
  durationSeconds: number | null
  artifactCount: number
}

export type ObservatorySinkraRuntimeMetric = {
  phase: string
  model: string
  costUsd: number | null
  durationSeconds: number | null
  status: string
  outputTokens: number | null
}

export type ObservatorySinkraScoreBreakdownItem = {
  id: string
  label: string
  score: number | null
  max: number | null
  weight: number | null
  status: string
  findings: string[]
}

export type ObservatorySinkraCompositionNode = {
  id: string
  name: string
  level: "template" | "organism" | "molecule" | "atom"
  parentId: string
  count: number
}

export type ObservatorySinkraHandoffPacket = {
  from: string
  to: string
  packet: string
}

export type ObservatorySinkraTokenFlow = {
  tokenName: string
  tokenValue: string
  type: string
  domain: string
  producedBy: string
  consumedBy: string[]
}

export type ObservatorySinkraMap = {
  processName: string
  version: string
  mode: string
  workflows: ObservatorySinkraWorkflow[]
  tasks: ObservatorySinkraTask[]
  gates: ObservatorySinkraGate[]
  score: ObservatorySinkraScore
  processPhases: ObservatorySinkraProcessPhase[]
  domains: ObservatorySinkraDomainGroup[]
  dependencies: ObservatorySinkraDependencyGraph
  observatoryMap: ObservatorySinkraObservatoryMap | null
  automation: ObservatorySinkraAutomationSpec[]
  accountability: ObservatorySinkraAccountabilityRow[]
  gaps: ObservatorySinkraGap[]
  compliance: {
    status: string
    handoffBlocked: boolean
    currentScore: number | null
    dimensions: ObservatorySinkraComplianceDimension[]
    blockingIssues: ObservatorySinkraBlockingIssue[]
    scoreBreakdown: ObservatorySinkraScoreBreakdownItem[]
    remediationItems: Array<{ priority: string; dimension: string; finding: string; action: string }>
  }
  composition: {
    nodes: ObservatorySinkraCompositionNode[]
    organismSequence: string[]
    handoffPackets: ObservatorySinkraHandoffPacket[]
    adjacencyValidation: string
  }
  tokenFlow: {
    tokens: ObservatorySinkraTokenFlow[]
    finalOutputs: string[]
    taskCountCovered: number
  }
  execution: {
    phases: ObservatorySinkraExecutionPhase[]
    metrics: ObservatorySinkraRuntimeMetric[]
  }
  artifactCoverage: Array<{ key: string; label: string; present: boolean }>
}

/* ── Unified Observatory data shape ── */

export type ObservatoryStats = Record<string, number>

export type ObservatoryData = {
  source: ObservatorySource              // discriminant
  sourceRoot: string                     // "docs/research" or "docs/bench" — for placeholders/URLs
  sourceLabel: string                    // "Research" or "Bench" — pre-resolved for client
  newActionLabel: string                 // "Nova Pesquisa" / "Novo Benchmark" — pre-resolved for client
  deepenCommand: string                  // CLI command for the selected run — pre-resolved for client
  /* Pre-resolved group buckets for category grouping (server-resolved to avoid
     crossing function boundaries into the Client Component). */
  groupBuckets: Array<{ key: string; label: string; slugs: string[] }>
  stats: ObservatoryStats
  runs: ObservatoryRunSummary[]
  selectedRun: ObservatoryRunSummary
  documents: ObservatoryDocument[]
  selectedDocument: ObservatoryDocument

  /* Universal optional blocks (populated when the adapter has the signal) */
  sourceSummary: string[]
  topSources: ObservatorySource_Entry[]
  players: ObservatoryPlayer[]           // mentioned/cited players (research-style)

  /* Bench-rich optional blocks */
  matrix: ObservatoryMatrix | null
  scoreDimensions: ObservatoryScoreDimension[]
  personas: ObservatoryPersona[]
  tco: ObservatoryTco | null
  tiebreakers: ObservatoryTiebreaker[]
  cliffs: ObservatoryCliff[]
  decisionTree: ObservatoryDecisionNode[]
  categorical: ObservatoryCategoricalWinner[]
  gapItems: ObservatoryGapItem[]
  metadataMetrics: ObservatoryMetric[]
  scoreMetrics: ObservatoryMetric[]
  editorsNote: ObservatoryEditorsNote | null
  playerProfiles: ObservatoryPlayerProfile[]   // bench-style protagonists (players[].meta enriched)
  benchmarkMethod: string
  benchmarkConfidence: string
  benchmarkNarrative: string
  benchmarkShortTitle: string
  typeSpecific: ObservatoryTypeSpecific

  /* Cross-poll from research-mode: curiosity questions + execution log waves.
     Populated by bench adapter when sidecar files exist. */
  curiosity: Array<{
    id: string
    category: string
    question: string
    priority: string
    whyItMatters: string
    nextAction: string
  }>
  waves: Array<{
    ts: string
    phase: string
    wave: number | null
    event: string
    summary: string
  }>

  /* Discover which Reader modes the UI should expose */
  availableModes: ReaderMode[]
}

/* ── Group + label resolution lives in the adapter ── */

export type ObservatoryGroupResolver = {
  /* Map a run's raw category to a stable group key */
  groupKey: (run: ObservatoryRunSummary) => string
  /* Display label for a group key */
  groupLabel: (key: string) => string
  /* Preferred order of group keys */
  groupOrder: string[]
}

export type ObservatoryAdapterMeta = {
  source: ObservatorySource
  label: string                          // "Research" / "Bench"
  sourceRoot: string                     // "docs/research"
  /* Display strategy for category column / grouping */
  group: ObservatoryGroupResolver
  /* Coverage formatter — research uses numeric, bench uses enum + breakdown */
  formatCoverage: (run: ObservatoryRunSummary) => string
  /* CLI deepen command builder */
  buildDeepenCommand: (run: ObservatoryRunSummary) => string
}
