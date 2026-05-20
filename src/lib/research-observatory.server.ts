import "server-only"

import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import YAML from "yaml"
import type { ReaderMode } from "@/components/observatory/foundations/types"
import { EmptyObservatorySourceError } from "./observatory-errors.server"
import { resolveDashPath } from "./workspace-root.server"

export type ResearchDocument = {
  id: string
  file: string
  phase: string
  status: "present" | "missing"
  bytes: number
  content: string
  truncated: boolean
}

export type InferredFlags = {
  date?: boolean
  topic?: boolean
  display_title?: boolean
  category?: boolean
  coverage_score?: boolean
  sources_total?: boolean
  decision?: boolean
  status?: boolean
}

export type CategorySlug =
  | "ai-agents"
  | "ai-tools"
  | "ux-ui"
  | "harness"
  | "content"
  | "devops"
  | "database"
  | "business"
  | "frontend"
  | "knowledge"
  | "other"

// Ordem de exibição dos grupos no painel — por relevância no Sinkra Hub.
export const CATEGORY_ORDER: CategorySlug[] = [
  "ai-agents",
  "ai-tools",
  "harness",
  "ux-ui",
  "frontend",
  "content",
  "devops",
  "database",
  "business",
  "knowledge",
  "other",
]

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  "ai-agents": "AI Agents",
  "ai-tools": "AI Tools",
  "ux-ui": "UX/UI",
  "harness": "Harness",
  "content": "Content",
  "devops": "DevOps",
  "database": "Database",
  "business": "Business",
  "frontend": "Frontend",
  "knowledge": "Knowledge",
  "other": "Other",
}

export type SourceEntry = {
  id: string
  url: string
  title: string
  date: string
  credibility: "HIGH" | "MEDIUM" | "LOW"
  multiplier: number
  flags: string[]
}

export type PlayerEntry = {
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
  section: string | null
}

export type ResearchRunSummary = {
  slug: string
  title: string
  displayTitle: string
  category: CategorySlug
  date: string
  status: string
  coverage: string
  integrity: string
  freshness: string
  waves: number
  sources: string
  files: number
  sampleFiles: string[]
  schema: string
  hasCore: boolean
  hasMetrics: boolean
  hasState: boolean
  hasLog: boolean
  hasSources: boolean
  active: boolean
  inferred: InferredFlags
  runtimeRunIds: string[]
}

export type ResearchObservatoryData = {
  stats: {
    totalRuns: number
    completeCore: number
    withMetrics: number
    withState: number
    withLog: number
    withSources: number
  }
  runs: ResearchRunSummary[]
  selectedRun: ResearchRunSummary
  documents: ResearchDocument[]
  selectedDocument: ResearchDocument
  sourceSummary: string[]
  topSources: SourceEntry[]
  players: PlayerEntry[]
}

type IndexEntry = {
  category?: CategorySlug | null
  coverage_score?: number | string | null
  date?: string | null
  decision?: string | null
  display_title?: string | null
  integrity_score?: number | string | null
  slug: string
  sources_total?: number | string | null
  status?: string | null
  stop_reason?: string | null
  topic?: string | null
  waves?: number | null
  inferred?: InferredFlags | null
}

type MetricsSummary = {
  coverage_score?: number | string | null
  integrity_score?: number | string | null
  date?: string | null
  status?: string | null
  sources_total?: number | string | null
  waves?: number | null
}

const CORE_FILES = ["README.md", "00-query-original.md", "01-deep-research-prompt.md", "02-research-report.md", "03-recommendations.md"]
const CONTENT_LIMIT = 30000
const DISPLAY_TITLE_MAX = 60
const RESEARCH_CACHE_TTL_MS = 5_000
const LEGACY_PARALLEL_SUFFIX = /-(claude|codex|gemini|opencode|byok|consolidado)$/

let summaryCache:
  | {
      root: string
      expiresAt: number
      summaries: ResearchRunSummary[]
    }
  | null = null

type SavedWorkbenchRun = {
  runId: string
  outputKey: string
  queryKey: string
}

let savedWorkbenchRunsCache:
  | {
      root: string
      expiresAt: number
      runs: SavedWorkbenchRun[]
    }
  | null = null

const sourcesCache = new Map<string, { expiresAt: number; entries: SourceEntry[] }>()
const playersCache = new Map<string, { expiresAt: number; entries: PlayerEntry[] }>()

function prettifySlug(slug: string) {
  return slug
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.toUpperCase() === "AIOX" ? "AIOX" : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function canonicalParallelSlug(slug: string) {
  return slug.replace(LEGACY_PARALLEL_SUFFIX, "")
}

function shouldHideLegacyParallelSlug(slug: string, slugs: Set<string>) {
  const canonical = canonicalParallelSlug(slug)
  return canonical !== slug && slugs.has(canonical)
}

function shouldHideInternalValidationRun(slug: string) {
  return /(?:^|-)gold-[a-z0-9-]+-profile-fixture$/.test(slug) || /(?:^|-)research-core-launcher-smoke$/.test(slug)
}

function extractHeading(markdown: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
  return heading ? heading.replace(/^Research:\s*/i, "") : null
}

function extractDate(slug: string) {
  return slug.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "undated"
}

function formatValue(value: unknown, fallback = "--") {
  if (value === null || value === undefined || value === "") {
    return fallback
  }

  return String(value)
}

function inferCoverageScore({
  files,
  hasCore,
  hasMetrics,
  hasState,
  hasLog,
  hasSources,
  waves,
}: {
  files: string[]
  hasCore: boolean
  hasMetrics: boolean
  hasState: boolean
  hasLog: boolean
  hasSources: boolean
  waves: number
}) {
  const corePresent = CORE_FILES.filter((file) => files.includes(file)).length
  let score = 45 + Math.round((corePresent / CORE_FILES.length) * 22)

  if (hasCore) score += 8
  if (hasMetrics) score += 5
  if (hasState) score += 5
  if (hasSources) score += 6
  if (hasLog) score += 3
  score += Math.min(6, Math.max(0, waves))
  score += Math.min(5, Math.floor(Math.max(0, files.length - CORE_FILES.length) / 3))

  return Math.max(50, Math.min(88, score))
}

// Fallback derivation when _index.json doesn't carry display_title (older runs).
// Mirrors the heuristic in research_kb_index.py / derive_display_title.
function deriveDisplayTitleFallback(input: string): string {
  const topic = input.trim().replace(/^`+|`+$/g, "")
  if (!topic) return input
  if (topic.length <= DISPLAY_TITLE_MAX) return topic
  const delimiters = [",", ":", " — ", " – ", " - "]
  for (const delim of delimiters) {
    const idx = topic.indexOf(delim)
    if (idx > 0) {
      const short = topic.slice(0, idx).trim()
      if (short.length >= 15 && short.length <= DISPLAY_TITLE_MAX) {
        return short
      }
    }
  }
  const truncated = topic.slice(0, DISPLAY_TITLE_MAX).replace(/\s+\S*$/, "")
  return `${truncated || topic.slice(0, DISPLAY_TITLE_MAX)}…`
}

function phaseForFile(file: string) {
  if (file === "README.md") return "overview"
  if (file.startsWith("00-")) return "query"
  if (file.startsWith("01-")) return "prompt"
  if (file.startsWith("02-")) return "report"
  if (file.startsWith("03-")) return "recommend"
  if (file.includes("wave")) return "wave"
  if (file.includes("follow") || /^\d{2}-/.test(file)) return "follow-up"
  if (file.endsWith(".yaml") || file.endsWith(".yml")) return "metadata"
  if (file.endsWith(".jsonl") || file.endsWith(".json")) return "log"
  return "artifact"
}

function schemaForRun({
  hasCore,
  hasMetrics,
  hasState,
  hasLog,
  waves,
}: {
  hasCore: boolean
  hasMetrics: boolean
  hasState: boolean
  hasLog: boolean
  waves: number
}) {
  if (hasCore && hasMetrics && hasState && hasLog && waves > 5) return "rich"
  if (hasCore && hasMetrics && hasState) return "full"
  if (hasCore && !hasMetrics) return "missing metrics"
  if (hasCore) return "legacy"
  return "partial"
}

function sampleRunFiles(files: string[]) {
  const priority = [
    "README.md",
    "02-research-report.md",
    "03-recommendations.md",
    "metrics.yaml",
    "sources.yaml",
    "pipeline-state.yaml",
    "execution-log.jsonl",
  ]
  const prioritized = priority.filter((file) => files.includes(file))
  const remaining = files.filter((file) => !prioritized.includes(file))
  return [...prioritized, ...remaining].slice(0, 10)
}

async function readIndex(researchRoot: string) {
  try {
    const raw = await readFile(path.join(researchRoot, "_index.json"), "utf8")
    const parsed = JSON.parse(raw) as { entries?: IndexEntry[] }
    return new Map((parsed.entries ?? []).map((entry) => [entry.slug, entry]))
  } catch {
    return new Map<string, IndexEntry>()
  }
}

async function listRunFiles(runPath: string) {
  const files: string[] = []

  async function walk(currentPath: string, prefix: string, depth: number) {
    const entries = await readdir(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isFile()) {
        files.push(relativePath)
        continue
      }
      if (entry.isDirectory() && depth < 3) {
        await walk(path.join(currentPath, entry.name), relativePath, depth + 1)
      }
    }
  }

  await walk(runPath, "", 0)
  return files.sort((a, b) => a.localeCompare(b))
}

async function readMetricsSummary(runPath: string, hasMetrics: boolean): Promise<MetricsSummary> {
  if (!hasMetrics) return {}

  try {
    const raw = await readFile(path.join(runPath, "metrics.yaml"), "utf8")
    const parsed = YAML.parse(raw)
    const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
    const sources = record.sources && typeof record.sources === "object" ? record.sources as Record<string, unknown> : {}
    const waves = Array.isArray(record.waves) ? record.waves.length : Number(record.waves)

    return {
      coverage_score: record.coverage_score as MetricsSummary["coverage_score"],
      integrity_score: record.integrity_score as MetricsSummary["integrity_score"],
      date: record.date as MetricsSummary["date"],
      status: record.status as MetricsSummary["status"],
      sources_total: sources.total as MetricsSummary["sources_total"],
      waves: Number.isFinite(waves) ? waves : null,
    }
  } catch {
    return {}
  }
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value)
  return null
}

async function buildRunSummary(runPath: string, slug: string, indexEntry?: IndexEntry): Promise<ResearchRunSummary> {
  const files = await listRunFiles(runPath)
  const hasCore = CORE_FILES.every((file) => files.includes(file))
  const hasMetrics = files.includes("metrics.yaml")
  const hasState = files.includes("pipeline-state.yaml")
  const hasLog = files.includes("execution-log.jsonl")
  const hasSources = files.includes("sources.yaml")
  const metrics = await readMetricsSummary(runPath, hasMetrics)
  const indexedWaves = numericValue(indexEntry?.waves)
  const waves = indexedWaves ?? metrics.waves ?? files.filter((file) => file.includes("wave") && file.endsWith(".md")).length
  const readme = files.includes("README.md") ? await readFile(path.join(runPath, "README.md"), "utf8") : ""
  const title = indexEntry?.topic ?? extractHeading(readme) ?? prettifySlug(slug)
  const displayTitle = indexEntry?.display_title ?? deriveDisplayTitleFallback(title)
  const freshness = hasSources ? await readFreshnessRatio(path.join(runPath, "sources.yaml")) : "--"
  const runtimeRunIds = await readRuntimeRunIds(runPath, files, slug, title)
  const category: CategorySlug = (indexEntry?.category as CategorySlug | undefined) ?? "other"
  const explicitCoverage = formatValue(indexEntry?.coverage_score ?? metrics.coverage_score)
  const inferredCoverage = inferCoverageScore({
    files,
    hasCore,
    hasMetrics,
    hasState,
    hasLog,
    hasSources,
    waves: Number(waves ?? 0),
  })
  const inferred = {
    ...(indexEntry?.inferred ?? {}),
    ...(explicitCoverage === "--" ? { coverage_score: true } : {}),
  }

  return {
    slug,
    title,
    displayTitle,
    category,
    date: indexEntry?.date ?? metrics.date ?? extractDate(slug),
    status: indexEntry?.status ?? metrics.status ?? indexEntry?.decision ?? (hasCore ? "indexed" : "partial"),
    coverage: explicitCoverage === "--" ? String(inferredCoverage) : explicitCoverage,
    integrity: formatValue(indexEntry?.integrity_score ?? metrics.integrity_score),
    freshness,
    waves: Number(waves ?? 0),
    sources: formatValue(indexEntry?.sources_total ?? metrics.sources_total),
    files: files.length,
    sampleFiles: sampleRunFiles(files),
    schema: schemaForRun({ hasCore, hasMetrics, hasState, hasLog, waves: Number(waves ?? 0) }),
    hasCore,
    hasMetrics,
    hasState,
    hasLog,
    hasSources,
    active: false,
    inferred,
    runtimeRunIds,
  }
}

async function readRuntimeRunIds(runPath: string, files: string[], slug: string, title: string): Promise<string[]> {
  const ids = new Set<string>()
  const failed = new Set<string>()

  if (files.includes("execution-log.jsonl")) {
    try {
      const raw = await readFile(path.join(runPath, "execution-log.jsonl"), "utf8")
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const event = JSON.parse(trimmed) as Record<string, unknown>
          const runId = typeof event.run_id === "string" ? event.run_id : typeof event.runId === "string" ? event.runId : ""
          if (!runId) continue
          ids.add(runId)
          if (String(event.event ?? "").includes("failed")) failed.add(runId)
        } catch {
          // Keep log parsing best-effort; malformed lines should not hide the run.
        }
      }
    } catch {
      // Optional observability metadata.
    }
  }

  try {
    const runtimes = await readdir(path.join(runPath, "runtimes"), { withFileTypes: true })
    for (const entry of runtimes) {
      if (!entry.isDirectory()) continue
      const statePath = path.join(runPath, "runtimes", entry.name, "pipeline-state.yaml")
      try {
        const parsed = YAML.parse(await readFile(statePath, "utf8")) as Record<string, unknown> | null
        const runId = typeof parsed?.run_id === "string" ? parsed.run_id : typeof parsed?.runId === "string" ? parsed.runId : ""
        if (runId) ids.add(runId)
      } catch {
        // Runtime state is optional.
      }
    }
  } catch {
    // Older runs do not have a runtimes folder.
  }

  for (const runId of await readSavedWorkbenchRunIds(slug, title)) {
    ids.add(runId)
  }

  return [...ids].filter((id) => !failed.has(id))
}

async function readSavedWorkbenchRunIds(slug: string, title: string): Promise<string[]> {
  const targetSlug = comparableResearchKey(slug)
  const targetTitle = comparableResearchKey(title)
  return (await readSavedWorkbenchRuns())
    .filter((run) => run.outputKey === targetSlug || (targetTitle.length > 12 && run.queryKey === targetTitle))
    .map((run) => run.runId)
}

async function readSavedWorkbenchRuns(): Promise<SavedWorkbenchRun[]> {
  const runsDir = resolveDashPath(".tmp", "aiox-research-runs")
  const now = Date.now()
  if (savedWorkbenchRunsCache && savedWorkbenchRunsCache.root === runsDir && savedWorkbenchRunsCache.expiresAt > now) {
    return savedWorkbenchRunsCache.runs
  }

  const runs: SavedWorkbenchRun[] = []

  try {
    const files = await readdir(runsDir, { withFileTypes: true })
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue
      try {
        const parsed = JSON.parse(await readFile(path.join(runsDir, entry.name), "utf8")) as Record<string, unknown>
        const runId = typeof parsed.runId === "string" ? parsed.runId : ""
        if (!runId || parsed.status === "failed") continue
        const outputSlug = typeof parsed.outputSlug === "string" ? parsed.outputSlug : ""
        const query = typeof parsed.query === "string" ? parsed.query : ""
        runs.push({
          runId,
          outputKey: comparableResearchKey(outputSlug),
          queryKey: comparableResearchKey(query),
        })
      } catch {
        // Saved run state is best-effort observability data.
      }
    }
  } catch {
    // Workbench state may not exist outside local runs.
  }

  savedWorkbenchRunsCache = {
    root: runsDir,
    expiresAt: now + RESEARCH_CACHE_TTL_MS,
    runs,
  }

  return runs
}

function comparableResearchKey(value: string) {
  return canonicalParallelSlug(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function readFreshnessRatio(sourcesYamlPath: string): Promise<string> {
  try {
    const raw = await readFile(sourcesYamlPath, "utf8")
    const parsed = YAML.parse(raw)
    const totals = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).totals : null
    const ratio =
      totals && typeof totals === "object"
        ? Number((totals as Record<string, unknown>).date_coverage_ratio)
        : NaN
    if (!Number.isFinite(ratio)) return "--"
    return `${Math.round(ratio * 100)}%`
  } catch {
    return "--"
  }
}

async function readTopSources(sourcesYamlPath: string, limit = 30): Promise<SourceEntry[]> {
  const cacheKey = `${sourcesYamlPath}:${limit}`
  const cached = sourcesCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.entries

  try {
    const raw = await readFile(sourcesYamlPath, "utf8")
    const credibilityRank: Record<SourceEntry["credibility"], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    const entries = parseSourcesYaml(raw)
      .sort((a, b) => credibilityRank[a.credibility] - credibilityRank[b.credibility])
      .slice(0, limit)
    sourcesCache.set(cacheKey, { expiresAt: Date.now() + RESEARCH_CACHE_TTL_MS, entries })
    return entries
  } catch {
    return []
  }
}

// Parses sources.yaml shape emitted by tech-research/scripts/sources_extractor.py.
function parseSourcesYaml(raw: string): SourceEntry[] {
  const parsed = YAML.parse(raw)
  const rawSources = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).sources : null
  if (!Array.isArray(rawSources)) return []

  return rawSources
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry) => {
      const credibilityRaw = String(entry.credibility ?? "").toUpperCase()
      const credibility: SourceEntry["credibility"] =
        credibilityRaw === "HIGH" || credibilityRaw === "MEDIUM" || credibilityRaw === "LOW"
          ? credibilityRaw
          : "LOW"
      const multiplierValue = entry.multiplier
      const multiplier =
        typeof multiplierValue === "number"
          ? multiplierValue
          : Number.isFinite(Number(multiplierValue))
            ? Number(multiplierValue)
            : 1
      return {
        id: String(entry.id ?? ""),
        url: String(entry.url ?? ""),
        title: String(entry.title ?? ""),
        date: String(entry.date ?? ""),
        credibility,
        multiplier,
        flags: Array.isArray(entry.flags) ? entry.flags.map((flag) => String(flag)) : [],
      }
    })
    .filter((entry) => entry.id)
}

async function readPlayers(playersYamlPath: string): Promise<PlayerEntry[]> {
  const cached = playersCache.get(playersYamlPath)
  if (cached && cached.expiresAt > Date.now()) return cached.entries

  try {
    const raw = await readFile(playersYamlPath, "utf8")
    const entries = parsePlayersYaml(raw)
    playersCache.set(playersYamlPath, { expiresAt: Date.now() + RESEARCH_CACHE_TTL_MS, entries })
    return entries
  } catch {
    return []
  }
}

// Parses players.yaml shape emitted by tech-research/scripts/players_extractor.py.
function parsePlayersYaml(raw: string): PlayerEntry[] {
  const parsed = YAML.parse(raw)
  const root = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  const rawPlayers = root.players
  const tierMeaning = root.tier_meaning && typeof root.tier_meaning === "object"
    ? root.tier_meaning as Record<string, unknown>
    : {}
  if (!Array.isArray(rawPlayers)) return []

  const nullable = (value: unknown): string | null => {
    if (value === null || value === undefined) return null
    const str = String(value).trim()
    return str === "" || str === "null" ? null : str
  }

  return rawPlayers
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .filter((entry) => entry.id && entry.name)
    .map((entry) => {
      const tierValue = Number(entry.tier)
      const tier: PlayerEntry["tier"] =
        tierValue === 1 || tierValue === 2 || tierValue === 3 ? tierValue : null
      return {
        id: String(entry.id),
        number: String(entry.number ?? ""),
        name: String(entry.name),
        tier,
        tierMeaning: tier ? nullable(tierMeaning[String(tier)]) : null,
        category: nullable(entry.category),
        role: nullable(entry.role),
        fit: nullable(entry.fit),
        action: nullable(entry.action),
        whatItDoes: nullable(entry.what_it_does),
        whatItDoesNot: nullable(entry.what_it_does_not),
        insight: nullable(entry.insight),
        sourceTitle: nullable(entry.source_title),
        sourceUrl: nullable(entry.source_url),
        sourceDate: nullable(entry.source_date),
        excluded: Boolean(entry.excluded),
        exclusionReason: nullable(entry.exclusion_reason),
        section: nullable(entry.section),
      }
    })
}

function filesForView(view?: ReaderMode, selectedFile?: string) {
  const files = new Set<string>()
  if (selectedFile) files.add(selectedFile)
  if (!view || view === "document") return null

  files.add("README.md")
  if (view === "map") {
    files.add("research-profile.yaml")
    files.add("research-contract.json")
    files.add("metrics.yaml")
    files.add("pipeline-state.yaml")
    files.add("research-graph.json")
    files.add("matrices.yaml")
    files.add("ux-patterns.yaml")
    files.add("action-plan.yaml")
    files.add("dashboard-manifest.yaml")
    files.add("curiosity_queue.yaml")
    files.add("execution-log.jsonl")
    return files
  }
  if (view === "curiosity") {
    files.add("curiosity_queue.yaml")
    return files
  }
  if (view === "recommendations") {
    files.add("research-profile.yaml")
    files.add("03-recommendations.md")
    files.add("quick-wins.md")
    files.add("curiosity_queue.yaml")
    files.add("execution-log.jsonl")
    files.add("action-plan.yaml")
    files.add("risk-register.yaml")
    files.add("decision-ledger.yaml")
    return files
  }
  if (view === "waves") {
    files.add("execution-log.jsonl")
    return files
  }
  if (view === "sources") {
    files.add("sources.yaml")
    files.add("metrics.yaml")
    files.add("research-graph.json")
    return files
  }
  if (view === "evidence") {
    files.add("sources.yaml")
    files.add("metrics.yaml")
    files.add("research-graph.json")
    files.add("claims.yaml")
    files.add("validation-report.yaml")
    return files
  }
  if (view === "players") {
    files.add("research-profile.yaml")
    files.add("players.yaml")
    files.add("decision-rubric.yaml")
    return files
  }
  return files
}

async function buildDocuments(runPath: string, view?: ReaderMode, selectedFile?: string) {
  const files = await listRunFiles(runPath)
  const readableFiles = files.filter((file) => /\.(md|yaml|yml|jsonl|json)$/i.test(file))
  const contentFiles = filesForView(view, selectedFile)

  return Promise.all(
    readableFiles.map(async (file) => {
      const filePath = path.join(runPath, file)
      const shouldReadContent =
        contentFiles === null ||
        contentFiles.has(file) ||
        (view === "recommendations" && (phaseForFile(file) === "recommend" || /quick-win|followup|follow-up/i.test(file))) ||
        (view === "waves" && (phaseForFile(file) === "wave" || /wave/i.test(file)))
      const [raw, fileStat] = await Promise.all([
        shouldReadContent ? readFile(filePath, "utf8") : Promise.resolve(""),
        stat(filePath),
      ])
      const truncated = raw.length > CONTENT_LIMIT
      const content = truncated ? `${raw.slice(0, CONTENT_LIMIT)}\n\n[...conteúdo truncado para preview local...]` : raw

      return {
        id: file,
        file,
        phase: phaseForFile(file),
        status: "present" as const,
        bytes: fileStat.size,
        content,
        truncated,
      }
    }),
  )
}

async function getCachedRunSummaries(researchRoot: string, index: Map<string, IndexEntry>) {
  const now = Date.now()
  if (summaryCache && summaryCache.root === researchRoot && summaryCache.expiresAt > now) {
    return summaryCache.summaries
  }

  const entries = await readdir(researchRoot, { withFileTypes: true })
  const allSlugs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
  const slugSet = new Set(allSlugs)
  const runSlugs = allSlugs
    .filter((slug) => !shouldHideLegacyParallelSlug(slug, slugSet))
    .filter((slug) => !shouldHideInternalValidationRun(slug))
    .sort((a, b) => b.localeCompare(a))
  const summaries = await Promise.all(
    runSlugs.map((slug) => buildRunSummary(path.join(researchRoot, slug), slug, index.get(slug))),
  )
  summaryCache = {
    root: researchRoot,
    expiresAt: now + RESEARCH_CACHE_TTL_MS,
    summaries,
  }
  return summaries
}

export async function getRecentResearchRunSummaries(limit = 3): Promise<ResearchRunSummary[]> {
  const researchRoot = resolveDashPath("docs", "research")
  try {
    const index = await readIndex(researchRoot)
    const summaries = await getCachedRunSummaries(researchRoot, index)
    return [...summaries]
      .sort((a, b) => compareRecentResearchRuns(a, b))
      .slice(0, Math.max(0, limit))
  } catch (caught) {
    if (isMissingPathError(caught)) return []
    throw caught
  }
}

export async function getResearchObservatoryData(selectedSlug?: string, selectedFile?: string, view?: ReaderMode): Promise<ResearchObservatoryData> {
  const researchRoot = resolveDashPath("docs", "research")
  const index = await readIndex(researchRoot)
  const summaries = await getCachedRunSummaries(researchRoot, index)
  if (summaries.length === 0) throw new EmptyObservatorySourceError("research")
  const preferredSlug = selectedSlug && summaries.some((run) => run.slug === selectedSlug)
    ? selectedSlug
    : summaries.find((run) => run.slug === "2026-05-11-visual-deep-research-apps")?.slug ?? summaries[0].slug
  const runs = summaries.map((run) => ({ ...run, active: run.slug === preferredSlug }))
  const selectedRun = runs.find((run) => run.slug === preferredSlug) ?? runs[0]
  const documents = await buildDocuments(path.join(researchRoot, selectedRun.slug), view, selectedFile)
  const selectedDocument = documents.find((doc) => doc.file === selectedFile)
    ?? documents.find((doc) => doc.file === "README.md")
    ?? documents.find((doc) => doc.file === "02-research-report.md")
    ?? documents[0]
    ?? {
      id: "empty",
      file: "README.md",
      phase: "overview",
      status: "missing" as const,
      bytes: 0,
      content: "",
      truncated: false,
    }
  const topSources = selectedRun.hasSources
    ? await readTopSources(path.join(researchRoot, selectedRun.slug, "sources.yaml"))
    : []
  const players = await readPlayers(path.join(researchRoot, selectedRun.slug, "players.yaml"))

  return {
    stats: {
      totalRuns: runs.length,
      completeCore: runs.filter((run) => run.hasCore).length,
      withMetrics: runs.filter((run) => run.hasMetrics).length,
      withState: runs.filter((run) => run.hasState).length,
      withLog: runs.filter((run) => run.hasLog).length,
      withSources: runs.filter((run) => run.hasSources).length,
    },
    runs,
    selectedRun,
    documents,
    selectedDocument,
    sourceSummary: [
      `${selectedRun.sources} fontes indexadas`,
      `${documents.length} artefatos legíveis`,
      selectedRun.hasMetrics ? "metrics.yaml presente" : "metrics.yaml ausente",
      selectedRun.hasState ? "pipeline-state.yaml presente" : "pipeline-state.yaml ausente",
      selectedRun.hasLog ? "execution-log.jsonl presente" : "execution-log.jsonl ausente",
      selectedRun.hasSources ? "sources.yaml presente" : "sources.yaml ausente",
      `${selectedRun.waves} waves detectadas`,
    ],
    topSources,
    players,
  }
}

function compareRecentResearchRuns(a: ResearchRunSummary, b: ResearchRunSummary) {
  const dateCompare = sortableResearchDate(b.date).localeCompare(sortableResearchDate(a.date))
  return dateCompare || b.slug.localeCompare(a.slug)
}

function sortableResearchDate(value: string) {
  if (!value || value === "undated" || value === "undefined" || value === "—") return "0000-00-00"
  return value
}

function isMissingPathError(caught: unknown) {
  return Boolean(
    caught &&
      typeof caught === "object" &&
      "code" in caught &&
      ((caught as { code?: unknown }).code === "ENOENT" || (caught as { code?: unknown }).code === "ENOTDIR"),
  )
}
