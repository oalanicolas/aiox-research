import "server-only"

import type {
  SinkraMapsObservatoryData,
  SinkraMapRunSummary,
} from "@/lib/sinkra-maps-observatory.server"
import type {
  ObservatoryAdapterMeta,
  ObservatoryData,
  ObservatoryRunSummary,
  ReaderMode,
} from "../foundations/types"

const SINKRA_GROUP_ORDER = ["map", "process", "mission", "validate", "other"] as const

const SINKRA_GROUP_LABELS: Record<string, string> = {
  map: "Mapeamentos",
  process: "Processos",
  mission: "Missões",
  validate: "Validações",
  other: "Outros",
}

export const sinkraMapsAdapterMeta: ObservatoryAdapterMeta = {
  source: "sinkra-maps",
  label: "SINKRA Maps",
  sourceRoot: "outputs/sinkra-squad",
  group: {
    groupKey: (run) => run.category ?? "other",
    groupLabel: (key) => SINKRA_GROUP_LABELS[key] ?? key,
    groupOrder: SINKRA_GROUP_ORDER as unknown as string[],
  },
  formatCoverage: (run) => run.coverage,
  buildDeepenCommand: (run) =>
    `claude && *map "${run.slug}" "Aprofunde este mapeamento SINKRA: revalide workflow, tasks, gates, dependências, score_card e gere artefatos estruturados atualizados em outputs/sinkra-squad/${run.slug}/."`,
}

function mapRun(run: SinkraMapRunSummary): ObservatoryRunSummary {
  return {
    slug: run.slug,
    title: run.title,
    displayTitle: run.title,
    date: run.date,
    category: run.category,
    schema: "sinkra-map",
    status: run.status,
    coverage: run.score,
    integrity: run.hasWorkflow && run.hasTasks && run.hasGates ? "structured" : "partial",
    files: run.files,
    waves: 0,
    sources: 0,
    active: run.active,
    extras: {
      hasWorkflow: run.hasWorkflow,
      hasTasks: run.hasTasks,
      hasGates: run.hasGates,
      hasScore: run.hasScore,
      hasProcess: run.hasProcess,
      hasDeps: run.hasDeps,
      hasDomain: run.hasDomain,
      hasObservatory: run.hasObservatory,
      hasAutomation: run.hasAutomation,
      hasRaci: run.hasRaci,
      hasGaps: run.hasGaps,
      hasCompliance: run.hasCompliance,
      hasComposition: run.hasComposition,
      hasTokens: run.hasTokens,
      hasState: run.hasState,
      hasMetrics: run.hasMetrics,
    },
  }
}

function buildGroupBuckets(
  runs: ObservatoryRunSummary[],
): Array<{ key: string; label: string; slugs: string[] }> {
  const map = new Map<string, string[]>()
  for (const run of runs) {
    const key = sinkraMapsAdapterMeta.group.groupKey(run)
    const list = map.get(key) ?? []
    list.push(run.slug)
    map.set(key, list)
  }
  return sinkraMapsAdapterMeta.group.groupOrder
    .filter((key) => map.has(key))
    .map((key) => ({
      key,
      label: sinkraMapsAdapterMeta.group.groupLabel(key),
      slugs: map.get(key) ?? [],
    }))
}

export function mapSinkraMapsToObservatory(
  data: SinkraMapsObservatoryData,
): ObservatoryData {
  const runs = data.runs.map(mapRun)
  const selectedRun = mapRun(data.selectedRun)
  const extras = selectedRun.extras ?? {}
  const modes: ReaderMode[] = ["map"]
  if (extras.hasWorkflow || extras.hasDeps || extras.hasComposition || extras.hasTokens) modes.push("flow")
  if (extras.hasAutomation) modes.push("automation")
  if (extras.hasGates || extras.hasCompliance || extras.hasScore) modes.push("governance")
  if (extras.hasRaci) modes.push("accountability")
  if (extras.hasGaps || extras.hasObservatory) modes.push("gaps")
  if (extras.hasState || extras.hasMetrics) modes.push("evidence")
  modes.push("document")
  if (!extras.hasObservatory && (extras.hasScore || data.structured.artifactCoverage.length > 0)) {
    modes.push("score")
  }

  return {
    source: "sinkra-maps",
    sourceRoot: sinkraMapsAdapterMeta.sourceRoot,
    sourceLabel: sinkraMapsAdapterMeta.label,
    newActionLabel: "Novo Mapeamento",
    deepenCommand: sinkraMapsAdapterMeta.buildDeepenCommand(selectedRun),
    groupBuckets: buildGroupBuckets(runs),
    stats: {
      totalRuns: data.stats.totalRuns,
      withWorkflow: data.stats.withWorkflow,
      withTasks: data.stats.withTasks,
      withGates: data.stats.withGates,
      withScore: data.stats.withScore,
    },
    runs,
    selectedRun,
    documents: data.documents,
    selectedDocument: data.selectedDocument,
    sourceSummary: [],
    topSources: [],
    players: [],
    matrix: null,
    scoreDimensions: [],
    personas: [],
    tco: null,
    tiebreakers: [],
    cliffs: [],
    decisionTree: [],
    categorical: [],
    gapItems: [],
    metadataMetrics: [
      { label: "workflow", value: String(data.structured.workflows.length) },
      { label: "tasks", value: String(data.structured.tasks.length) },
      { label: "gates", value: String(data.structured.gates.length) },
      { label: "score", value: data.structured.score.score === null ? "—" : String(data.structured.score.score) },
    ],
    scoreMetrics: data.structured.artifactCoverage.map((item) => ({
      label: item.label,
      value: item.present ? "presente" : "ausente",
    })),
    editorsNote: null,
    playerProfiles: [],
    benchmarkMethod: data.structured.mode,
    benchmarkConfidence: data.structured.score.result,
    benchmarkNarrative: data.structured.processName,
    benchmarkShortTitle: data.structured.processName || selectedRun.displayTitle,
    typeSpecific: {
      sinkra: {
        processName: data.structured.processName,
        version: data.structured.version,
        mode: data.structured.mode,
        workflows: data.structured.workflows,
        tasks: data.structured.tasks,
        gates: data.structured.gates,
        score: data.structured.score,
        processPhases: data.structured.processPhases,
        domains: data.structured.domains,
        dependencies: data.structured.dependencies,
        observatoryMap: data.structured.observatoryMap,
        automation: data.structured.automation,
        accountability: data.structured.accountability,
        gaps: data.structured.gaps,
        compliance: data.structured.compliance,
        composition: data.structured.composition,
        tokenFlow: data.structured.tokenFlow,
        execution: data.structured.execution,
        artifactCoverage: data.structured.artifactCoverage,
      },
    },
    availableModes: modes,
  }
}
