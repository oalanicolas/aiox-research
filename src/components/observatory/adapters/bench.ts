import "server-only"

import type {
  BenchDashboardData,
  BenchRunSummary,
} from "@/lib/bench-dashboard.server"
import type {
  ObservatoryAdapterMeta,
  ObservatoryData,
  ObservatoryRunSummary,
  ReaderMode,
} from "../foundations/types"

/* ──────────────────────────────────────────────────────────────────────
   Bench adapter — maps BenchDashboardData → ObservatoryData.
   Pure mapping. No I/O.
   ────────────────────────────────────────────────────────────────────── */

const BENCH_TYPE_ORDER = ["product", "codebase", "technology", "model", "other"] as const

const BENCH_TYPE_LABELS: Record<string, string> = {
  product: "Product",
  codebase: "Codebase",
  technology: "Technology",
  model: "Model",
  other: "Other",
}

export const benchAdapterMeta: ObservatoryAdapterMeta = {
  source: "bench",
  label: "Bench",
  sourceRoot: "docs/bench",
  group: {
    groupKey: (run) => (run.category ?? "other"),
    groupLabel: (key) => BENCH_TYPE_LABELS[key] ?? key,
    groupOrder: BENCH_TYPE_ORDER as unknown as string[],
  },
  formatCoverage: (run) => run.coverage,
  buildDeepenCommand: (run) =>
    `claude && /spy *bench "${run.slug}" "Aprofunde este benchmark: revalide scores, atualize fontes, refine personas e cliffs, e regere bench-output-dash.json em docs/bench/${run.slug}/."`,
}

function mapRun(run: BenchRunSummary): ObservatoryRunSummary {
  /* Status inference uses the actual dash content (rich blocks), not just the
     existence of isolated files. A bench can have NO metadata.json but still
     carry a fully populated bench-output-dash.json with matrix, personas, etc.
     The dash is the source of truth — files are inputs to it. */
  const dashRows = run.dashMatrixRows ?? 0
  const dashCoverage = run.dashCoverage ?? "missing"
  const hasDashRich = dashRows >= 4 && dashCoverage === "structured"
  const hasDashPartial = dashRows > 0 || dashCoverage !== "missing"

  let status: string
  if (hasDashRich) status = "completed"
  else if (hasDashPartial || run.hasScorecard || run.hasMetadata) status = "partial"
  else status = "missing"

  /* Date sanitation: the legacy extractor stamped "undated" as a literal string
     when metadata.json was absent. Treat it as null so the UI renders "—". */
  const rawDate = run.date
  const date = !rawDate || rawDate === "undated" || rawDate === "undefined" ? "" : rawDate

  return {
    slug: run.slug,
    title: run.title,
    displayTitle: run.title,
    date,
    category: run.type,
    schema: "bench-output-dash",
    status,
    coverage: run.score,
    integrity: run.hasDeep ? "deep" : "shallow",
    files: run.files,
    waves: 0,
    sources: 0,
    active: run.active,
    extras: {
      subjects: run.subjects,
      hasMetadata: run.hasMetadata,
      hasScorecard: run.hasScorecard,
      hasDeep: run.hasDeep,
      dashRows,
      dashCoverage,
      dateMissing: !date,
    },
  }
}

function buildGroupBuckets(
  runs: ObservatoryRunSummary[],
): Array<{ key: string; label: string; slugs: string[] }> {
  const map = new Map<string, string[]>()
  for (const run of runs) {
    const key = benchAdapterMeta.group.groupKey(run)
    const list = map.get(key) ?? []
    list.push(run.slug)
    map.set(key, list)
  }
  return benchAdapterMeta.group.groupOrder
    .filter((k) => map.has(k))
    .map((k) => ({
      key: k,
      label: benchAdapterMeta.group.groupLabel(k),
      slugs: map.get(k) ?? [],
    }))
}

export function mapBenchToObservatory(
  data: BenchDashboardData,
): ObservatoryData {
  const runs = data.runs.map(mapRun)
  const selectedRun = mapRun(data.selectedRun)
  /* Derive which Reader modes are available based on what the dash carries */
  const availableModes: ReaderMode[] = ["map", "slides", "roadmap"]
  const dashMatrix = data.scoreboard
  const hasLegacyMatrix = !dashMatrix && data.matrixRows.length > 0
  const hasScore = data.scoreDimensions.length > 0 || data.scoreMetrics.length > 0
  if (dashMatrix && dashMatrix.rows.length > 0) {
    availableModes.push("evidence")
    availableModes.push("matrix")
    if (dashMatrix.players.length >= 2) availableModes.push("duel")
  }
  if (hasScore) availableModes.push("score")
  if (hasLegacyMatrix) {
    availableModes.push("evidence")
    availableModes.push("matrix")
  }
  if (data.personas.length > 0) availableModes.push("personas")
  if (data.tco && data.tco.scenarios.length > 0) availableModes.push("tco")
  const hasCodebaseCoverage = Boolean(
    data.typeSpecific?.codebase &&
      (data.typeSpecific.codebase.coverageStack.length > 0 ||
        data.typeSpecific.codebase.threeAxis ||
        data.typeSpecific.codebase.knowledgeIceberg.length > 0),
  )
  if (hasCodebaseCoverage) availableModes.push("coverage")
  if (
    data.categorical.length > 0 ||
    data.tiebreakers.length > 0 ||
    data.cliffs.length > 0 ||
    data.decisionTree.length > 0 ||
    data.editorsNote
  ) {
    availableModes.push("decision")
  }
  if (dashMatrix && dashMatrix.rows.length > 0) {
    availableModes.push("weights")
  }
  availableModes.push("document")

  const legacyPlayers = Array.from(
    new Set(data.matrixRows.flatMap((row) => row.values.map((value) => value.label))),
  )
  const legacyTotals = legacyPlayers.map((player) => {
    const scores = data.matrixRows.flatMap((row) =>
      row.values
        .filter((value) => value.label === player)
        .map((value) => parseFloat(value.value))
        .filter((value) => Number.isFinite(value)),
    )
    const score =
      scores.length > 0
        ? scores.reduce((total, value) => total + value, 0) / scores.length
        : 0
    return { player, score }
  })

  /* Map matrix from BenchScoreboard shape into ObservatoryMatrix */
  const matrix = dashMatrix
    ? {
        players: dashMatrix.players,
        rows: dashMatrix.rows.map((row) => ({
          id: row.id,
          label: row.label,
          weight: Number(row.weight) || 0,
          cells: row.cells.map((cell) => ({
            player: cell.player,
            score: cell.score,
            confidence: cell.confidence,
            notes: cell.notes,
            source: cell.source,
          })),
        })),
        totals: dashMatrix.totals.map((t) => ({
          player: t.label,
          score: Number(t.value) || 0,
        })),
        method: dashMatrix.method,
      }
    : data.matrixRows.length > 0
      ? {
          players: legacyPlayers,
          rows: data.matrixRows.map((row, index) => ({
            id: row.category || `R${index + 1}`,
            label: row.dimension,
            weight: 0,
            cells: row.values.map((value) => ({
              player: value.label,
              score: parseFloat(value.value) || 0,
              confidence: row.parity || "",
              notes: row.notes,
              source: row.category,
            })),
          })),
          totals: legacyTotals,
          method: "legacy matrix",
        }
      : null

  return {
    source: "bench",
    sourceRoot: "docs/bench",
    sourceLabel: benchAdapterMeta.label,
    newActionLabel: "Novo Benchmark",
    deepenCommand: benchAdapterMeta.buildDeepenCommand(selectedRun),
    groupBuckets: buildGroupBuckets(runs),
    stats: {
      totalRuns: data.stats.totalRuns,
      withScorecard: data.stats.withScorecard,
      withMetadata: data.stats.withMetadata,
      withDeep: data.stats.withDeep,
    },
    runs,
    selectedRun,
    documents: data.documents,
    selectedDocument: data.selectedDocument,

    /* Sources — bench doesn't have a normalized sources.yaml; expose empty */
    sourceSummary: [],
    topSources: [],
    /* No mentioned-players list in bench (the comparison subjects ARE the players) */
    players: [],

    matrix,
    scoreDimensions: data.scoreDimensions.map((dimension) => ({
      name: dimension.name,
      weight: dimension.weight,
      winner: dimension.winner,
      delta: dimension.delta,
      evidence: dimension.evidence,
      scores: dimension.scores,
    })),
    personas: data.personas.map((p) => ({
      id: p.id,
      label: p.label,
      sub: p.sub,
      weights: p.weights,
      totals: p.totals.map((t) => ({ player: t.label, score: Number(t.value) || 0 })),
      ranking: p.ranking,
      winner: p.winner,
      runner: p.runner,
      delta: p.delta,
      verdict: p.verdict,
      tiebreaker: p.tiebreaker,
    })),
    tco: data.tco,
    tiebreakers: data.tiebreakers,
    cliffs: data.cliffs,
    decisionTree: data.decisionTree,
    categorical: data.categorical,
    gapItems: data.gapItems,
    metadataMetrics: data.metadataMetrics,
    scoreMetrics: data.scoreMetrics,
    editorsNote: data.editorsNote,
    playerProfiles: data.players.map((p) => ({
      key: p.key,
      name: p.name,
      category: p.category,
      type: p.type,
      license: p.license,
      origin: p.origin,
      years: p.years,
      techScore: p.techScore,
      neutralScore: p.neutralScore,
      color: p.color,
      letter: p.letter,
      tag: p.tag,
    })),
    benchmarkMethod: data.method,
    benchmarkConfidence: data.confidenceBreakdown,
    benchmarkNarrative: data.narrative,
    benchmarkShortTitle: data.shortTitle,
    typeSpecific: data.typeSpecific ?? {},

    availableModes,
  }
}
