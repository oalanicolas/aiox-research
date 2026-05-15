import "server-only"

import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { resolveDashPath } from "./workspace-root.server"

export type BenchDocument = {
  id: string
  file: string
  phase: string
  bytes: number
  content: string
  truncated: boolean
}

export type BenchRunSummary = {
  slug: string
  title: string
  date: string
  type: string
  score: string
  subjects: string[]
  files: number
  hasMetadata: boolean
  hasScorecard: boolean
  hasDeep: boolean
  active: boolean
  /* Status inference helpers — read from bench-output-dash.json when present. */
  dashMatrixRows: number
  dashCoverage: string
}

export type BenchMetric = {
  label: string
  value: string
}

export type BenchScoreDimension = {
  name: string
  weight: string
  winner: string
  delta: string
  evidence: string
  scores: BenchMetric[]
}

export type BenchMatrixRow = {
  category: string
  dimension: string
  values: BenchMetric[]
  parity: string
  notes: string
}

export type BenchGapItem = {
  id: string
  title: string
  priority: string
  complexity: string
  rationale: string
}

export type BenchScoreboardCell = {
  player: string
  dimension: string
  score: number
  confidence: string
  notes: string
  source: string
}

export type BenchScoreboardRow = {
  id: string
  label: string
  weight: string
  cells: BenchScoreboardCell[]
}

export type BenchScoreboard = {
  players: string[]
  rows: BenchScoreboardRow[]
  totals: BenchMetric[]
  method: string
}

export type BenchPersonaRanking = {
  rank: number
  player: string
  score: number
  delta: string
}

export type BenchPersona = {
  id: string
  label: string
  sub: string
  weights: number[]
  totals: BenchMetric[]
  ranking: BenchPersonaRanking[]
  winner: string
  runner: string
  delta: number | null
  verdict: string
  tiebreaker: string
}

export type BenchPlayerProfile = {
  key: string
  name: string
  category: string
  type: string
  license: string
  origin: string
  years: number | null
  versionEvaluated: string
  versionReleaseDate: string
  vendorUrl: string
  repoUrl: string
  techScore: number | null
  neutralScore: number | null
  color: string
  letter: string
  tag: string
  stats: Record<string, unknown>
}

export type BenchCategoricalWinner = {
  dimension: string
  winner: string
  loser: string
  note: string
}

export type BenchTiebreaker = {
  id: string
  q: string
  yes: string
  no: string
}

export type BenchCliff = {
  player: string
  trigger: string
  impact: string
}

export type BenchDecisionNode = {
  q: string
  yes: string
  no: string
}

export type BenchTcoRow = {
  player: string
  setup: string
  low: number | null
  high: number | null
  baseline: boolean
}

export type BenchTcoScenario = {
  id: string
  label: string
  unit: string
  rows: BenchTcoRow[]
}

export type BenchTco = {
  currency: string
  unit: string
  scenarios: BenchTcoScenario[]
}

export type BenchCoverageStackEntry = {
  combo: string
  coverage: number
  players: string[]
  synergy: number | null
  ideal: boolean
}

export type BenchThreeAxisPoint = {
  id: string
  x: number
  y: number
  z: number
  label: string
}

export type BenchThreeAxis = {
  axes: [string, string, string]
  points: BenchThreeAxisPoint[]
}

export type BenchKnowledgeIcebergEntry = {
  id: string
  code: number
  yaml: number
  md: number
  total: number
  ratio: number
}

export type BenchTypeSpecific = {
  codebase?: {
    coverageStack: BenchCoverageStackEntry[]
    threeAxis: BenchThreeAxis | null
    knowledgeIceberg: BenchKnowledgeIcebergEntry[]
  }
  product?: Record<string, unknown>
  llm?: Record<string, unknown>
}

export type BenchEditorsNote = {
  title: string
  byline: string
  date: string
  paragraphs: string[]
}

export type BenchDuelDetail = {
  id: string
  a: string
  b: string
  verdict: string
  winsA: string[]
  winsB: string[]
  ties: string[]
}

export type BenchDashboardData = {
  stats: {
    totalRuns: number
    withScorecard: number
    withMetadata: number
    withDeep: number
  }
  runs: BenchRunSummary[]
  selectedRun: BenchRunSummary
  documents: BenchDocument[]
  selectedDocument: BenchDocument
  scoreMetrics: BenchMetric[]
  metadataMetrics: BenchMetric[]
  battleSummary: BenchMetric[]
  scoreDimensions: BenchScoreDimension[]
  matrixRows: BenchMatrixRow[]
  gapItems: BenchGapItem[]
  scoreboard?: BenchScoreboard
  personas: BenchPersona[]
  // Rich blocks (canonical schema). Empty arrays / null when the bench doesn't produce them.
  players: BenchPlayerProfile[]
  shortTitle: string
  method: string
  confidenceBreakdown: string
  narrative: string
  categorical: BenchCategoricalWinner[]
  tiebreakers: BenchTiebreaker[]
  cliffs: BenchCliff[]
  decisionTree: BenchDecisionNode[]
  tco: BenchTco | null
  typeSpecific: BenchTypeSpecific
  editorsNote: BenchEditorsNote | null
  duels: BenchDuelDetail[]
}

const CONTENT_LIMIT = 40000
const DASH_OUTPUT_FILE = "bench-output-dash.json"

function prettifySlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase()
      if (["AIOX", "OSS", "URL", "AI", "UX", "UI"].includes(upper)) return upper
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(" ")
}

function extractHeading(markdown: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

function formatValue(value: unknown, fallback = "--") {
  if (value === null || value === undefined || value === "") return fallback
  return String(value)
}

async function listFilesDeep(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const result: string[] = []

  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...await listFilesDeep(full, rel))
    } else if (/\.(md|json|mmd)$/i.test(entry.name)) {
      result.push(rel)
    }
  }

  return result.sort((a, b) => {
    const priority = (file: string) => {
      if (/^(README|INDEX)\.md$/i.test(file)) return 0
      if (/executive-report/i.test(file)) return 1
      if (/scorecard/i.test(file)) return 2
      if (/comparison|matrix/i.test(file)) return 3
      if (/gap/i.test(file)) return 4
      if (/battle-card/i.test(file)) return 5
      if (file.startsWith("deep/")) return 8
      return 6
    }
    return priority(a) - priority(b) || a.localeCompare(b)
  })
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"))
  } catch {
    return null
  }
}

function getAtPath(input: unknown, pathParts: string[]) {
  let cursor = input
  for (const part of pathParts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return cursor
}

function collectNumbers(input: unknown): number[] {
  if (typeof input === "number" && Number.isFinite(input)) return [input]
  if (Array.isArray(input)) return input.flatMap(collectNumbers)
  if (input && typeof input === "object") {
    return Object.entries(input as Record<string, unknown>).flatMap(([key, value]) => {
      if (/weight|loc|files|count|stars|contributors/i.test(key)) return []
      return collectNumbers(value)
    })
  }
  return []
}

function inferScore(scorecard: unknown, metadata: unknown, files: string[]) {
  const explicit =
    getAtPath(scorecard, ["scorecard", "weighted_totals"]) ??
    getAtPath(scorecard, ["weighted_totals"]) ??
    getAtPath(scorecard, ["consolidated_scorecard"]) ??
    getAtPath(metadata, ["sinkra_hub_coverage", "coverage_pct"])

  const numbers = collectNumbers(explicit)
  if (numbers.length > 0) {
    const score = Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length)
    return String(Math.max(0, Math.min(99, score)))
  }

  let score = 58
  if (files.some((file) => /scorecard\.json$/i.test(file))) score += 12
  if (files.some((file) => /metadata\.json$/i.test(file))) score += 8
  if (files.some((file) => /executive-report/i.test(file))) score += 8
  if (files.some((file) => /comparison|matrix/i.test(file))) score += 6
  if (files.some((file) => file.startsWith("deep/"))) score += 6
  return String(Math.min(88, score))
}

function extractMetadataMetrics(metadata: unknown): BenchMetric[] {
  if (!metadata || typeof metadata !== "object") return []

  const benchmark = (metadata as Record<string, unknown>).benchmark
  const coverage = (metadata as Record<string, unknown>).sinkra_hub_coverage
  const subjectA = (metadata as Record<string, unknown>).subject_a
  const subjectB = (metadata as Record<string, unknown>).subject_b
  const metrics: BenchMetric[] = []

  if (benchmark && typeof benchmark === "object") {
    const b = benchmark as Record<string, unknown>
    metrics.push(
      { label: "Date", value: formatValue(b.date) },
      { label: "Type", value: formatValue(b.type) },
      { label: "Depth", value: formatValue(b.depth) },
    )
  }

  if (subjectA && typeof subjectA === "object") {
    metrics.push({ label: "Subject A", value: formatValue((subjectA as Record<string, unknown>).name) })
  }
  if (subjectB && typeof subjectB === "object") {
    metrics.push({ label: "Subject B", value: formatValue((subjectB as Record<string, unknown>).name) })
  }
  if (coverage && typeof coverage === "object") {
    metrics.push({ label: "Coverage", value: formatValue((coverage as Record<string, unknown>).coverage_pct) })
  }

  return metrics.filter((item) => item.value !== "--")
}

function extractScoreMetrics(scorecard: unknown): BenchMetric[] {
  if (!scorecard || typeof scorecard !== "object") return []

  const root = (scorecard as Record<string, unknown>).scorecard ?? scorecard
  if (!root || typeof root !== "object") return []
  const record = root as Record<string, unknown>
  const totals = [
    record.weighted_totals,
    record.coding_focused_totals,
    record.autonomy_focused_totals,
    record.consolidated_totals,
  ].filter(Boolean)

  const metrics: BenchMetric[] = []
  for (const total of totals) {
    if (!total || typeof total !== "object") continue
    for (const [key, value] of Object.entries(total as Record<string, unknown>)) {
      if (typeof value === "number" || typeof value === "string") {
        if (key === "notes") continue
        metrics.push({ label: key.replace(/_/g, " "), value: formatValue(value) })
      }
    }
  }

  const dimensions = record.dimensions
  if (Array.isArray(dimensions)) {
    metrics.unshift({ label: "Dimensions", value: String(dimensions.length) })
  }

  return metrics.slice(0, 10)
}

function scoreLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function cleanDimensionWinner(rawWinner: unknown, scores: BenchMetric[]) {
  const winner = formatValue(rawWinner, "mixed")
  if (winner === "--" || winner === "mixed") return winner

  const normalizedWinner = winner.toLowerCase()
  const matchedScore = scores.find((score) =>
    normalizedWinner.startsWith(score.label.toLowerCase()),
  )
  return matchedScore?.label ?? winner.replace(/\s*\(.+\)\s*$/, "")
}

function extractScoreDimensions(scorecard: unknown): BenchScoreDimension[] {
  if (!scorecard || typeof scorecard !== "object") return []

  const root = (scorecard as Record<string, unknown>).scorecard ?? scorecard
  if (!root || typeof root !== "object") return []

  const dimensions = (root as Record<string, unknown>).dimensions
  if (!Array.isArray(dimensions)) return []

  return dimensions
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => {
      const scores = Object.entries(item)
        .flatMap(([key, value]) => {
          if (
            [
              "id",
              "name",
              "weight",
              "delta",
              "winner",
              "winner_in_dim",
              "evidence",
              "notes",
            ].includes(key)
          ) {
            return []
          }

          if (value && typeof value === "object" && !Array.isArray(value)) {
            const nestedScore = (value as Record<string, unknown>).score
            if (typeof nestedScore === "number" || typeof nestedScore === "string") {
              return [{ label: scoreLabel(key), value: formatValue(nestedScore) }]
            }
            return []
          }

          if (typeof value === "number") return [{ label: scoreLabel(key), value: formatValue(value) }]
          return []
        })

      return {
        name: formatValue(item.name, "Dimension"),
        weight: formatValue(item.weight),
        winner: cleanDimensionWinner(item.winner ?? item.winner_in_dim, scores),
        delta: formatValue(item.delta),
        evidence: formatValue(item.evidence ?? item.notes ?? item.winner_in_dim, ""),
        scores,
      }
    })
}

function extractMatrixRows(matrix: unknown): BenchMatrixRow[] {
  if (!matrix || typeof matrix !== "object") return []

  const root = (matrix as Record<string, unknown>).matrix ?? matrix
  const rows: BenchMatrixRow[] = []

  if (root && typeof root === "object" && Array.isArray((root as Record<string, unknown>).categories)) {
    for (const category of (root as Record<string, unknown>).categories as unknown[]) {
      if (!category || typeof category !== "object") continue
      const categoryRecord = category as Record<string, unknown>
      const items = Array.isArray(categoryRecord.items) ? categoryRecord.items : []
      for (const item of items) {
        if (!item || typeof item !== "object") continue
        const record = item as Record<string, unknown>
        const values = Object.entries(record)
          .filter(([key, value]) => {
            if (["dimension", "feature", "parity", "notes", "evidence", "equivalence"].includes(key)) return false
            return typeof value === "number" || typeof value === "string"
          })
          .map(([key, value]) => ({ label: scoreLabel(key), value: formatValue(value) }))

        rows.push({
          category: formatValue(categoryRecord.name ?? categoryRecord.category, "Matrix"),
          dimension: formatValue(record.dimension ?? record.feature, "Dimension"),
          values,
          parity: formatValue(record.parity ?? record.equivalence),
          notes: formatValue(record.notes),
        })
      }
    }
  }

  if (Array.isArray((root as Record<string, unknown>).matrix)) {
    for (const category of (root as Record<string, unknown>).matrix as unknown[]) {
      if (!category || typeof category !== "object") continue
      const categoryRecord = category as Record<string, unknown>
      const features = Array.isArray(categoryRecord.features) ? categoryRecord.features : []
      for (const feature of features) {
        if (!feature || typeof feature !== "object") continue
        const record = feature as Record<string, unknown>
        const values = Object.entries(record)
          .filter(([key, value]) => /_score$/.test(key) && (typeof value === "number" || typeof value === "string"))
          .map(([key, value]) => ({ label: scoreLabel(key.replace(/_score$/, "")), value: formatValue(value) }))

        rows.push({
          category: formatValue(categoryRecord.category, "Matrix"),
          dimension: formatValue(record.feature ?? record.dimension, "Feature"),
          values,
          parity: formatValue(record.equivalence ?? record.parity),
          notes: formatValue((record.evidence && typeof record.evidence === "object") ? "" : record.evidence),
        })
      }
    }
  }

  return rows.slice(0, 40)
}

function extractGapItems(gapAnalysis: unknown): BenchGapItem[] {
  if (!gapAnalysis || typeof gapAnalysis !== "object") return []

  const items: BenchGapItem[] = []
  for (const [group, value] of Object.entries(gapAnalysis as Record<string, unknown>)) {
    if (!Array.isArray(value) || !/gap/i.test(group)) continue
    for (const item of value) {
      if (!item || typeof item !== "object") continue
      const record = item as Record<string, unknown>
      items.push({
        id: formatValue(record.id, group),
        title: formatValue(record.description ?? record.title ?? record.gap, "Gap"),
        priority: formatValue(record.priority),
        complexity: formatValue(record.absorption_complexity ?? record.complexity),
        rationale: formatValue(record.rationale ?? record.estimated_effort ?? record.recommendation, ""),
      })
    }
  }

  return items.slice(0, 24)
}

function extractBattleSummary({
  selectedRun,
  scoreDimensions,
  matrixRows,
  gapItems,
}: {
  selectedRun: BenchRunSummary
  scoreDimensions: BenchScoreDimension[]
  matrixRows: BenchMatrixRow[]
  gapItems: BenchGapItem[]
}): BenchMetric[] {
  const winners = new Map<string, number>()
  for (const dimension of scoreDimensions) {
    if (dimension.winner && dimension.winner !== "--" && dimension.winner !== "mixed") {
      winners.set(dimension.winner, (winners.get(dimension.winner) ?? 0) + 1)
    }
  }
  const winner = [...winners.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed"

  return [
    { label: "Score", value: selectedRun.score },
    { label: "Winner", value: winner },
    { label: "Dimensions", value: String(scoreDimensions.length || matrixRows.length || "--") },
    { label: "Gaps", value: String(gapItems.length || "--") },
  ]
}

function extractConsolidatedScoreboard(scorecard: unknown): BenchScoreboard | undefined {
  if (!scorecard || typeof scorecard !== "object") return undefined
  const record = scorecard as Record<string, unknown>
  const rawMatrix = record.matrix
  const rawLabels = record.dimension_labels
  if (!rawMatrix || typeof rawMatrix !== "object" || !rawLabels || typeof rawLabels !== "object") return undefined

  const players = Object.keys(rawMatrix as Record<string, unknown>)
  const labels = rawLabels as Record<string, unknown>
  const weights = (record.weights_neutral && typeof record.weights_neutral === "object")
    ? record.weights_neutral as Record<string, unknown>
    : {}
  const dimensions = Object.keys(labels)

  const rows: BenchScoreboardRow[] = dimensions.map((dimension) => {
    const cells = players.map((player) => {
      const playerMatrix = (rawMatrix as Record<string, unknown>)[player]
      const rawCell = playerMatrix && typeof playerMatrix === "object"
        ? (playerMatrix as Record<string, unknown>)[dimension]
        : null
      const cell = rawCell && typeof rawCell === "object" ? rawCell as Record<string, unknown> : {}
      return {
        player,
        dimension,
        score: Number(cell.score ?? 0),
        confidence: formatValue(cell.confidence),
        notes: formatValue(cell.notes, ""),
        source: formatValue(cell.source, ""),
      }
    })

    return {
      id: dimension,
      label: formatValue(labels[dimension], dimension),
      weight: formatValue(weights[dimension]),
      cells,
    }
  })

  const totalsSource = (record.totals_neutral && typeof record.totals_neutral === "object")
    ? record.totals_neutral as Record<string, unknown>
    : {}

  return {
    players,
    rows,
    totals: Object.entries(totalsSource).map(([label, value]) => ({ label, value: formatValue(value) })),
    method: formatValue(record.method, ""),
  }
}

function extractDashScoreboard(dash: unknown): BenchScoreboard | undefined {
  if (!dash || typeof dash !== "object") return undefined
  const matrix = (dash as Record<string, unknown>).matrix
  if (!matrix || typeof matrix !== "object") return undefined
  const record = matrix as Record<string, unknown>
  const players = Array.isArray(record.players) ? record.players.map((player) => formatValue(player)).filter((player) => player !== "--") : []
  const rawRows = Array.isArray(record.rows) ? record.rows : []
  if (players.length === 0 || rawRows.length === 0) return undefined

  const rows: BenchScoreboardRow[] = rawRows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .map((row) => {
      const cells = Array.isArray(row.cells) ? row.cells : []
      return {
        id: formatValue(row.id, "D"),
        label: formatValue(row.label, "Dimension"),
        weight: formatValue(row.weight),
        cells: cells
          .filter((cell): cell is Record<string, unknown> => Boolean(cell && typeof cell === "object"))
          .map((cell) => ({
            player: formatValue(cell.player),
            dimension: formatValue(row.id, "D"),
            score: Number(cell.score ?? 0),
            confidence: formatValue(cell.confidence, ""),
            notes: formatValue(cell.notes, ""),
            source: formatValue(cell.source, ""),
          })),
      }
    })

  const rawTotals = Array.isArray(record.totals) ? record.totals : []
  const totals = rawTotals
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({ label: formatValue(item.player ?? item.label), value: formatValue(item.score ?? item.value) }))

  return {
    players,
    rows,
    totals,
    method: formatValue(record.method, ""),
  }
}

function extractPersonas(scorecard: unknown): BenchPersona[] {
  if (!scorecard || typeof scorecard !== "object") return []
  const personas = (scorecard as Record<string, unknown>).personas
  if (!personas || typeof personas !== "object") return []

  return Object.entries(personas as Record<string, unknown>)
    .map(([id, value]) => {
      const record = value && typeof value === "object" ? value as Record<string, unknown> : {}
      const totalsSource = record.totals && typeof record.totals === "object" ? record.totals as Record<string, unknown> : {}
      const rankingSource = Array.isArray(record.ranking) ? record.ranking : []
      const ranking = rankingSource
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => ({
          rank: Number(item.rank ?? index + 1),
          player: formatValue(item.player),
          score: Number(item.score ?? 0),
          delta: formatValue(item.delta_to_leader ?? item.delta_to_next ?? item.delta, ""),
        }))

      const rawLabel = formatValue(record.label, scoreLabel(id))
      const { cleanLabel, sub: derivedSub } = deriveSubFromLabel(rawLabel)
      const sub = formatValue(record.sub, "") || derivedSub
      const weights = normalizeWeights(record.weights)

      return {
        id,
        label: cleanLabel,
        sub,
        weights,
        totals: Object.entries(totalsSource).map(([label, total]) => ({ label, value: formatValue(total) })),
        ranking,
        winner: ranking[0]?.player ?? "",
        runner: ranking[1]?.player ?? "",
        delta:
          ranking[1] && Number.isFinite(ranking[1].score) && Number.isFinite(ranking[0]?.score)
            ? Number(ranking[1].score) - Number(ranking[0].score)
            : null,
        verdict: formatValue(record.verdict, ""),
        tiebreaker: formatValue(record.tiebreaker, ""),
      }
    })
    .filter((persona) => !isNeutralPersona(persona))
}

function extractScenarioPersonas(scorecard: unknown): BenchPersona[] {
  /* Some benches (chatwoot-vs-zendesk style) carry scenario_adjusted_scores
     instead of full personas[]. Project those into persona shape. */
  if (!scorecard || typeof scorecard !== "object") return []
  const scenarios = (scorecard as Record<string, unknown>).scenario_adjusted_scores
  if (!scenarios || typeof scenarios !== "object") return []

  return Object.entries(scenarios as Record<string, unknown>).map(([id, value]) => {
    const record = value && typeof value === "object" ? value as Record<string, unknown> : {}
    const winner = formatValue(record.winner, "")
    /* Strip "winner" + "note" + "rationale" — rest are player→score entries */
    const playerScores = Object.entries(record)
      .filter(([k]) => k !== "winner" && k !== "note" && k !== "rationale")
      .map(([player, score]) => ({ player, score: Number(score) || 0 }))
      .sort((a, b) => b.score - a.score)

    const ranking = playerScores.map((p, idx) => ({
      rank: idx + 1,
      player: p.player,
      score: p.score,
      delta: idx === 0 ? "" : String((playerScores[0].score - p.score) * -1),
    }))
    const totals = playerScores.map((p) => ({ label: p.player, value: String(p.score) }))

    const rawLabel = scoreLabel(id.replace(/^scenario_/, ""))
    const { cleanLabel, sub } = deriveSubFromLabel(rawLabel)

    return {
      id,
      label: cleanLabel,
      sub,
      weights: [],
      totals,
      ranking,
      winner: ranking[0]?.player ?? "",
      runner: ranking[1]?.player ?? "",
      delta:
        ranking[1] && Number.isFinite(ranking[1].score) && Number.isFinite(ranking[0]?.score)
          ? ranking[1].score - ranking[0].score
          : null,
      verdict: winner,
      tiebreaker: formatValue(record.note ?? record.rationale, ""),
    }
  })
}

function isNeutralPersona(persona: { id: string; label: string }): boolean {
  /* Skip the "neutral" persona — it's just the matrix totals replicated.
     Detectable by id/label that equals "neutral" or contains only that word. */
  const id = persona.id.toLowerCase()
  const label = persona.label.toLowerCase()
  return id === "neutral" || label === "neutral" || label === "neutral baseline"
}

function deriveSubFromLabel(label: string): { cleanLabel: string; sub: string } {
  /* Personas labels often pack context in parentheses:
     "SMB BR e-commerce (5-10 agents, <=1k conv/mes)"
     → cleanLabel: "SMB BR e-commerce"
     → sub: "5-10 agents, <=1k conv/mes" */
  const match = label.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (match) return { cleanLabel: match[1].trim(), sub: match[2].trim() }
  return { cleanLabel: label, sub: "" }
}

function normalizeWeights(weights: unknown): number[] {
  if (Array.isArray(weights)) {
    return (weights as unknown[]).map((w) => Number(w)).filter((w) => Number.isFinite(w))
  }
  if (weights && typeof weights === "object") {
    /* Object form: {"D1": 14, "D2": 8, ...} — preserve insertion order */
    return Object.values(weights as Record<string, unknown>)
      .map((w) => Number(w))
      .filter((w) => Number.isFinite(w))
  }
  return []
}

function extractDashPersonas(dash: unknown): BenchPersona[] {
  if (!dash || typeof dash !== "object") return []
  const personas = (dash as Record<string, unknown>).personas
  if (!Array.isArray(personas)) return []

  return personas
    .filter((persona): persona is Record<string, unknown> => Boolean(persona && typeof persona === "object"))
    .map((persona) => {
      const rawRanking = Array.isArray(persona.ranking) ? persona.ranking : []
      const rawTotals = persona.totals
      const totalsArray: BenchMetric[] = Array.isArray(rawTotals)
        ? rawTotals
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
            .map((item) => ({
              label: formatValue(item.player ?? item.label),
              value: formatValue(item.score ?? item.value),
            }))
        : rawTotals && typeof rawTotals === "object"
        ? Object.entries(rawTotals as Record<string, unknown>).map(([player, score]) => ({
            label: player,
            value: formatValue(score),
          }))
        : []

      const ranking = rawRanking
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, index) => ({
          rank: Number(item.rank ?? index + 1),
          player: formatValue(item.player),
          score: Number(item.score ?? 0),
          delta: formatValue(item.delta_to_leader ?? item.delta_to_next ?? item.delta, ""),
        }))

      /* Derived fields: winner/runner/delta from ranking if not explicit. */
      const winner = formatValue(persona.winner, "") || ranking[0]?.player || ""
      const runner = formatValue(persona.runner, "") || ranking[1]?.player || ""
      const explicitDelta = typeof persona.delta === "number" && Number.isFinite(persona.delta as number)
        ? (persona.delta as number)
        : null
      const derivedDelta =
        ranking[1] && Number.isFinite(ranking[1].score) && Number.isFinite(ranking[0]?.score)
          ? Number(ranking[1].score) - Number(ranking[0].score)
          : null
      const delta = explicitDelta ?? derivedDelta

      const rawLabel = formatValue(persona.label, "Persona")
      const { cleanLabel, sub: derivedSub } = deriveSubFromLabel(rawLabel)
      const sub = formatValue(persona.sub, "") || derivedSub

      return {
        id: formatValue(persona.id, "persona"),
        label: cleanLabel,
        sub,
        weights: normalizeWeights(persona.weights),
        totals: totalsArray,
        ranking,
        winner,
        runner,
        delta,
        verdict: formatValue(persona.verdict, ""),
        tiebreaker: formatValue(persona.tiebreaker, ""),
      }
    })
    .filter((persona) => !isNeutralPersona(persona))
}

function extractDashPlayers(dash: unknown): BenchPlayerProfile[] {
  if (!dash || typeof dash !== "object") return []
  const players = (dash as Record<string, unknown>).players
  if (!Array.isArray(players)) return []
  const playerMeta = (dash as Record<string, unknown>).player_meta
  const metaMap = playerMeta && typeof playerMeta === "object" ? (playerMeta as Record<string, unknown>) : {}

  return players
    .filter((player): player is Record<string, unknown> => Boolean(player && typeof player === "object"))
    .map((player) => {
      const key = formatValue(player.key)
      const inlineMeta = player.meta && typeof player.meta === "object" ? (player.meta as Record<string, unknown>) : {}
      const fallbackMeta = metaMap[key] && typeof metaMap[key] === "object" ? (metaMap[key] as Record<string, unknown>) : {}
      const meta = { ...fallbackMeta, ...inlineMeta }
      const years = typeof player.anos === "number"
        ? player.anos
        : typeof player.years === "number"
        ? player.years
        : null
      const techScore = typeof player.tech_score === "number" && Number.isFinite(player.tech_score) ? player.tech_score : null
      const neutralScore = typeof player.neutral_score === "number" && Number.isFinite(player.neutral_score) ? player.neutral_score : null

      return {
        key,
        name: formatValue(player.name),
        category: formatValue(player.category, ""),
        type: formatValue(player.type, ""),
        license: formatValue(player.license, ""),
        origin: formatValue(player.origin, ""),
        years,
        versionEvaluated: formatValue(player.version_evaluated, ""),
        versionReleaseDate: formatValue(player.version_release_date, ""),
        vendorUrl: formatValue(player.vendor_url, ""),
        repoUrl: formatValue(player.repo_url, ""),
        techScore,
        neutralScore,
        color: formatValue(meta.color, ""),
        letter: formatValue(meta.letter, ""),
        tag: formatValue(meta.tag, ""),
        stats: player.stats && typeof player.stats === "object" ? (player.stats as Record<string, unknown>) : {},
      }
    })
}

function extractDashCategorical(dash: unknown): BenchCategoricalWinner[] {
  if (!dash || typeof dash !== "object") return []
  const categorical = (dash as Record<string, unknown>).categorical
  if (!categorical || typeof categorical !== "object") return []

  return Object.entries(categorical as Record<string, unknown>)
    .filter(([, value]) => Boolean(value && typeof value === "object"))
    .map(([dimension, value]) => {
      const record = value as Record<string, unknown>
      return {
        dimension,
        winner: formatValue(record.winner),
        loser: formatValue(record.loser, ""),
        note: formatValue(record.note, ""),
      }
    })
}

function extractDashTiebreakers(dash: unknown): BenchTiebreaker[] {
  if (!dash || typeof dash !== "object") return []
  const tiebreakers = (dash as Record<string, unknown>).tiebreakers
  if (!Array.isArray(tiebreakers)) return []

  return tiebreakers
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: formatValue(item.id),
      q: formatValue(item.q),
      yes: formatValue(item.yes, ""),
      no: formatValue(item.no, ""),
    }))
}

function extractDashCliffs(dash: unknown): BenchCliff[] {
  if (!dash || typeof dash !== "object") return []
  const cliffs = (dash as Record<string, unknown>).cliffs
  if (!Array.isArray(cliffs)) return []

  return cliffs
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      player: formatValue(item.player),
      trigger: formatValue(item.trigger),
      impact: formatValue(item.impact),
    }))
}

function extractDashDecisionTree(dash: unknown): BenchDecisionNode[] {
  if (!dash || typeof dash !== "object") return []
  const tree = (dash as Record<string, unknown>).decision_tree
  if (!Array.isArray(tree)) return []

  return tree
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      q: formatValue(item.q),
      yes: formatValue(item.yes, ""),
      no: formatValue(item.no, ""),
    }))
}

function extractDashTco(dash: unknown): BenchTco | null {
  if (!dash || typeof dash !== "object") return null
  const tco = (dash as Record<string, unknown>).tco
  if (!tco || typeof tco !== "object") return null
  const record = tco as Record<string, unknown>
  const scenarios = record.scenarios
  if (!scenarios || typeof scenarios !== "object") return null

  const scenarioList: BenchTcoScenario[] = Object.entries(scenarios as Record<string, unknown>)
    .filter(([, value]) => Boolean(value && typeof value === "object"))
    .map(([id, value]) => {
      const scenarioRecord = value as Record<string, unknown>
      const rows = Array.isArray(scenarioRecord.rows) ? scenarioRecord.rows : []
      return {
        id,
        label: formatValue(scenarioRecord.label, id),
        unit: formatValue(scenarioRecord.unit, ""),
        rows: rows
          .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
          .map((row) => ({
            player: formatValue(row.player),
            setup: formatValue(row.setup, ""),
            low: typeof row.low === "number" && Number.isFinite(row.low) ? row.low : null,
            high: typeof row.high === "number" && Number.isFinite(row.high) ? row.high : null,
            baseline: Boolean(row.baseline),
          })),
      }
    })

  if (scenarioList.length === 0) return null

  return {
    currency: formatValue(record.currency, "USD"),
    unit: formatValue(record.unit, ""),
    scenarios: scenarioList,
  }
}

function extractDashTypeSpecific(dash: unknown): BenchTypeSpecific {
  if (!dash || typeof dash !== "object") return {}
  const block = (dash as Record<string, unknown>).type_specific
  if (!block || typeof block !== "object") return {}
  const record = block as Record<string, unknown>
  const result: BenchTypeSpecific = {}

  if (record.codebase && typeof record.codebase === "object") {
    const codebaseRecord = record.codebase as Record<string, unknown>
    const coverageStackRaw = Array.isArray(codebaseRecord.coverage_stack) ? codebaseRecord.coverage_stack : []
    const knowledgeIcebergRaw = Array.isArray(codebaseRecord.knowledge_iceberg) ? codebaseRecord.knowledge_iceberg : []
    const threeAxisRaw = codebaseRecord.three_axis

    let threeAxis: BenchThreeAxis | null = null
    if (threeAxisRaw && typeof threeAxisRaw === "object") {
      const axesValue = (threeAxisRaw as Record<string, unknown>).axes
      const pointsValue = (threeAxisRaw as Record<string, unknown>).points
      if (Array.isArray(axesValue) && axesValue.length >= 3 && Array.isArray(pointsValue)) {
        threeAxis = {
          axes: [formatValue(axesValue[0]), formatValue(axesValue[1]), formatValue(axesValue[2])] as [string, string, string],
          points: pointsValue
            .filter((point): point is Record<string, unknown> => Boolean(point && typeof point === "object"))
            .map((point) => ({
              id: formatValue(point.id),
              x: Number(point.x ?? 0),
              y: Number(point.y ?? 0),
              z: Number(point.z ?? 0),
              label: formatValue(point.label, ""),
            })),
        }
      }
    }

    result.codebase = {
      coverageStack: coverageStackRaw
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
        .map((entry) => ({
          combo: formatValue(entry.combo),
          coverage: Number(entry.coverage ?? 0),
          players: Array.isArray(entry.players) ? entry.players.map((p) => formatValue(p)) : [],
          synergy: typeof entry.synergy === "number" ? entry.synergy : null,
          ideal: Boolean(entry.ideal),
        })),
      threeAxis,
      knowledgeIceberg: knowledgeIcebergRaw
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
        .map((entry) => ({
          id: formatValue(entry.id),
          code: Number(entry.code ?? 0),
          yaml: Number(entry.yaml ?? 0),
          md: Number(entry.md ?? 0),
          total: Number(entry.total ?? 0),
          ratio: Number(entry.ratio ?? 0),
        })),
    }
  }

  if (record.product && typeof record.product === "object") {
    result.product = record.product as Record<string, unknown>
  }
  if (record.llm && typeof record.llm === "object") {
    result.llm = record.llm as Record<string, unknown>
  }

  return result
}

async function extractEditorsNote(dash: unknown, benchPath: string): Promise<BenchEditorsNote | null> {
  const fromInline = readEditorsNote(dash)
  if (fromInline) return fromInline

  // Try sidecar
  if (dash && typeof dash === "object") {
    const sidecars = (dash as Record<string, unknown>).sidecars
    if (sidecars && typeof sidecars === "object") {
      const sidecarPath = (sidecars as Record<string, unknown>).editors_note
      if (typeof sidecarPath === "string" && sidecarPath.length > 0) {
        const sidecar = await readJson(path.join(benchPath, sidecarPath))
        const fromSidecar = readEditorsNote(sidecar)
        if (fromSidecar) return fromSidecar
      }
    }
  }

  return null
}

function readEditorsNote(source: unknown): BenchEditorsNote | null {
  if (!source || typeof source !== "object") return null
  // Accept both shape: dash.editors_note OR top-level (sidecar)
  const record = source as Record<string, unknown>
  const candidate = record.editors_note && typeof record.editors_note === "object"
    ? (record.editors_note as Record<string, unknown>)
    : record
  const paragraphs = candidate.paragraphs
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return null
  return {
    title: formatValue(candidate.title, ""),
    byline: formatValue(candidate.byline, ""),
    date: formatValue(candidate.date, ""),
    paragraphs: paragraphs.map((p) => formatValue(p, "")).filter((p) => p !== ""),
  }
}

function extractDashDuels(dash: unknown): BenchDuelDetail[] {
  if (!dash || typeof dash !== "object") return []
  const duels = (dash as Record<string, unknown>).duels
  if (!Array.isArray(duels)) return []

  return duels
    .filter((duel): duel is Record<string, unknown> => Boolean(duel && typeof duel === "object"))
    .filter((duel) => typeof duel.a === "string" && typeof duel.b === "string")
    .map((duel) => ({
      id: formatValue(duel.id, `${duel.a}-vs-${duel.b}`),
      a: formatValue(duel.a),
      b: formatValue(duel.b),
      verdict: formatValue(duel.verdict, ""),
      winsA: Array.isArray(duel.winsA) ? duel.winsA.map((w) => formatValue(w)) : [],
      winsB: Array.isArray(duel.winsB) ? duel.winsB.map((w) => formatValue(w)) : [],
      ties: Array.isArray(duel.ties) ? duel.ties.map((w) => formatValue(w)) : [],
    }))
}

function extractDashShortFields(dash: unknown): {
  shortTitle: string
  method: string
  confidenceBreakdown: string
  narrative: string
} {
  if (!dash || typeof dash !== "object") {
    return { shortTitle: "", method: "", confidenceBreakdown: "", narrative: "" }
  }
  const benchmark = (dash as Record<string, unknown>).benchmark
  const summary = (dash as Record<string, unknown>).summary
  const benchmarkRecord = benchmark && typeof benchmark === "object" ? (benchmark as Record<string, unknown>) : {}
  const summaryRecord = summary && typeof summary === "object" ? (summary as Record<string, unknown>) : {}
  return {
    shortTitle: formatValue(benchmarkRecord.short_title, ""),
    method: formatValue(benchmarkRecord.method, ""),
    confidenceBreakdown: formatValue(benchmarkRecord.confidence_breakdown, ""),
    narrative: formatValue(summaryRecord.narrative, ""),
  }
}

function extractDashGapItems(dash: unknown): BenchGapItem[] {
  if (!dash || typeof dash !== "object") return []
  const gaps = (dash as Record<string, unknown>).gaps
  if (!Array.isArray(gaps)) return []

  return gaps
    .filter((gap): gap is Record<string, unknown> => Boolean(gap && typeof gap === "object"))
    .map((gap) => ({
      id: formatValue(gap.id, "gap"),
      title: formatValue(gap.title, "Gap"),
      priority: formatValue(gap.priority),
      complexity: formatValue(gap.complexity, ""),
      rationale: formatValue(gap.rationale, ""),
    }))
}

function extractDashMetadataMetrics(dash: unknown): BenchMetric[] {
  if (!dash || typeof dash !== "object") return []
  const benchmark = (dash as Record<string, unknown>).benchmark
  const summary = (dash as Record<string, unknown>).summary
  const metrics: BenchMetric[] = []
  if (benchmark && typeof benchmark === "object") {
    const record = benchmark as Record<string, unknown>
    metrics.push(
      { label: "Date", value: formatValue(record.date) },
      { label: "Type", value: formatValue(record.type) },
      { label: "Variant", value: formatValue(record.variant) },
      { label: "Analyst", value: formatValue(record.analyst) },
    )
  }
  if (summary && typeof summary === "object") {
    const record = summary as Record<string, unknown>
    metrics.push(
      { label: "Winner", value: formatValue(record.winner) },
      { label: "Sources", value: formatValue(record.sources) },
      { label: "Dimensions", value: formatValue(record.dimensions) },
    )
  }
  return metrics.filter((metric) => metric.value !== "--")
}

function metadataSubjects(metadata: unknown, dash?: unknown) {
  /* Multi-source subject extraction with priority:
       1. metadata.subjects[]  (canonical schema)
       2. metadata.subject_a/b/c/d  (legacy 2/3/4-way schemas)
       3. dash.players[]  (built-in fallback when metadata is sparse) */
  if (metadata && typeof metadata === "object") {
    const record = metadata as Record<string, unknown>
    const canonical = record.subjects
    if (Array.isArray(canonical)) {
      const names = canonical
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === "object"))
        .map((s) => formatValue(s.name, ""))
        .filter((n) => n.length > 0)
      if (names.length > 0) return names
    }
    const legacy = [record.subject_a, record.subject_b, record.subject_c, record.subject_d]
      .filter((subject): subject is Record<string, unknown> => Boolean(subject && typeof subject === "object"))
      .map((subject) => formatValue(subject.name, ""))
      .filter((value) => value.length > 0)
    if (legacy.length > 0) return legacy
  }
  if (dash && typeof dash === "object") {
    const players = (dash as Record<string, unknown>).players
    if (Array.isArray(players)) {
      return players
        .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === "object"))
        .map((p) => formatValue(p.name ?? p.key, ""))
        .filter((n) => n.length > 0)
    }
  }
  return [] as string[]
}

async function buildSummary(benchPath: string, slug: string): Promise<BenchRunSummary> {
  const files = await listFilesDeep(benchPath)
  const metadata = await readJson(path.join(benchPath, "metadata.json"))
  const scorecard = await readJson(path.join(benchPath, "scorecard.json"))
  const dash = await readJson(path.join(benchPath, DASH_OUTPUT_FILE))
  const indexFile = files.find((file) => /^(README|INDEX)\.md$/i.test(file) || /executive-report/i.test(file))
  const indexContent = indexFile ? await readFile(path.join(benchPath, indexFile), "utf8") : ""
  const benchmark = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).benchmark : null
  const dashBenchmark = dash && typeof dash === "object" ? (dash as Record<string, unknown>).benchmark : null
  const date = dashBenchmark && typeof dashBenchmark === "object"
    ? formatValue((dashBenchmark as Record<string, unknown>).date, "undated")
    : benchmark && typeof benchmark === "object" ? formatValue((benchmark as Record<string, unknown>).date, "undated") : "undated"
  const type = dashBenchmark && typeof dashBenchmark === "object"
    ? formatValue((dashBenchmark as Record<string, unknown>).type, "benchmark")
    : benchmark && typeof benchmark === "object" ? formatValue((benchmark as Record<string, unknown>).type, "benchmark") : "benchmark"
  const title = dashBenchmark && typeof dashBenchmark === "object"
    ? formatValue((dashBenchmark as Record<string, unknown>).title, prettifySlug(slug))
    : extractHeading(indexContent) ?? prettifySlug(slug)

  const dashMatrix = dash && typeof dash === "object" ? (dash as Record<string, unknown>).matrix : null
  const dashMatrixRows = dashMatrix && typeof dashMatrix === "object" && Array.isArray((dashMatrix as Record<string, unknown>).rows)
    ? ((dashMatrix as Record<string, unknown>).rows as unknown[]).length
    : 0
  const dashSummary = dash && typeof dash === "object" ? (dash as Record<string, unknown>).summary : null
  const dashCoverage = dashSummary && typeof dashSummary === "object"
    ? formatValue((dashSummary as Record<string, unknown>).coverage, "missing")
    : "missing"

  return {
    slug,
    title,
    date,
    type,
    score: inferScore(scorecard, metadata, files),
    subjects: metadataSubjects(metadata, dash),
    files: files.length,
    hasMetadata: files.includes("metadata.json"),
    hasScorecard: files.some((file) => /scorecard\.json$/i.test(file)),
    hasDeep: files.some((file) => file.startsWith("deep/")),
    active: false,
    dashMatrixRows,
    dashCoverage,
  }
}

function phaseForFile(file: string) {
  if (/^(README|INDEX)\.md$/i.test(file)) return "overview"
  if (/executive-report/i.test(file)) return "executive"
  if (/scorecard/i.test(file)) return "score"
  if (/comparison|matrix/i.test(file)) return "matrix"
  if (/gap/i.test(file)) return "gap"
  if (/battle-card/i.test(file)) return "battle"
  if (/metadata/i.test(file)) return "metadata"
  if (file.startsWith("deep/")) return "deep"
  if (/inventory/i.test(file)) return "inventory"
  if (/\.mmd$/i.test(file)) return "diagram"
  return "artifact"
}

async function buildDocuments(benchPath: string, files: string[]): Promise<BenchDocument[]> {
  return Promise.all(files.map(async (file) => {
    const fullPath = path.join(benchPath, file)
    const info = await stat(fullPath)
    const raw = await readFile(fullPath, "utf8")
    return {
      id: file,
      file,
      phase: phaseForFile(file),
      bytes: info.size,
      content: raw.length > CONTENT_LIMIT ? `${raw.slice(0, CONTENT_LIMIT)}\n\n[truncated at ${formatBytes(CONTENT_LIMIT)}]` : raw,
      truncated: raw.length > CONTENT_LIMIT,
    }
  }))
}

export async function getBenchDashboardData(slugParam?: string, fileParam?: string): Promise<BenchDashboardData> {
  const benchRoot = resolveDashPath("docs", "bench")
  const entries = await readdir(benchRoot, { withFileTypes: true })
  const slugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  const summaries = await Promise.all(slugs.map((slug) => buildSummary(path.join(benchRoot, slug), slug)))
  summaries.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))

  const selectedSlug = slugParam && summaries.some((run) => run.slug === slugParam) ? slugParam : summaries[0]?.slug
  const selectedRun = summaries.find((run) => run.slug === selectedSlug) ?? summaries[0]
  if (!selectedRun) {
    throw new Error("No benchmark folders found in docs/bench")
  }
  selectedRun.active = true

  const selectedPath = path.join(benchRoot, selectedRun.slug)
  const files = await listFilesDeep(selectedPath)
  const documents = await buildDocuments(selectedPath, files)
  const preferred = ["executive-report.md", "README.md", "INDEX.md", "scorecard.md", "full-comparison.md"]
  const selectedDocument =
    documents.find((doc) => doc.id === fileParam) ??
    preferred.map((file) => documents.find((doc) => doc.file === file)).find(Boolean) ??
    documents[0]

  const metadata = await readJson(path.join(selectedPath, "metadata.json"))
  const scorecard = await readJson(path.join(selectedPath, "scorecard.json"))
  const dash = await readJson(path.join(selectedPath, DASH_OUTPUT_FILE))
  const consolidatedScorecard = await readJson(path.join(selectedPath, "consolidated-scorecard.json"))
  const matrix = await readJson(path.join(selectedPath, "comparison-matrix.json"))
  const gapAnalysis = await readJson(path.join(selectedPath, "gap-analysis.json"))
  const scoreDimensions = extractScoreDimensions(scorecard)
  const matrixRows = extractMatrixRows(matrix)
  const gapItems = extractDashGapItems(dash).length > 0 ? extractDashGapItems(dash) : extractGapItems(gapAnalysis)
  const scoreboard = extractDashScoreboard(dash) ?? extractConsolidatedScoreboard(consolidatedScorecard)
  /* Personas — try sources in priority order:
       1. dash.personas[] (canonical, schema v2)
       2. consolidated-scorecard.json#personas (rich shape: weights, sub, rationale)
       3. scorecard.json#scenario_adjusted_scores (legacy, projected into persona shape)
     The "neutral" persona is filtered out in each extractor (it's matrix totals). */
  const personasFromDash = extractDashPersonas(dash)
  const personasFromConsolidated = extractPersonas(consolidatedScorecard)
  const personasFromScenarios = extractScenarioPersonas(scorecard)
  const personas =
    personasFromConsolidated.length > 0
      ? personasFromConsolidated
      : personasFromDash.length > 0
      ? personasFromDash
      : personasFromScenarios
  const battleSummary = extractBattleSummary({ selectedRun, scoreDimensions, matrixRows, gapItems })

  const players = extractDashPlayers(dash)
  const categorical = extractDashCategorical(dash)
  const tiebreakers = extractDashTiebreakers(dash)
  const cliffs = extractDashCliffs(dash)
  const decisionTree = extractDashDecisionTree(dash)
  const tco = extractDashTco(dash)
  const typeSpecific = extractDashTypeSpecific(dash)
  const editorsNote = await extractEditorsNote(dash, selectedPath)
  const duels = extractDashDuels(dash)
  const { shortTitle, method, confidenceBreakdown, narrative } = extractDashShortFields(dash)

  return {
    stats: {
      totalRuns: summaries.length,
      withScorecard: summaries.filter((run) => run.hasScorecard).length,
      withMetadata: summaries.filter((run) => run.hasMetadata).length,
      withDeep: summaries.filter((run) => run.hasDeep).length,
    },
    runs: summaries,
    selectedRun,
    documents,
    selectedDocument,
    scoreMetrics: extractScoreMetrics(scorecard),
    metadataMetrics: extractDashMetadataMetrics(dash).length > 0 ? extractDashMetadataMetrics(dash) : extractMetadataMetrics(metadata),
    battleSummary,
    scoreDimensions,
    matrixRows,
    gapItems,
    scoreboard,
    personas,
    players,
    shortTitle,
    method,
    confidenceBreakdown,
    narrative,
    categorical,
    tiebreakers,
    cliffs,
    decisionTree,
    tco,
    typeSpecific,
    editorsNote,
    duels,
  }
}
