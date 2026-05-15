import "server-only"

import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import type { ReaderMode } from "@/components/observatory/foundations/types"
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
  category: string | null
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
  schema: string
  hasCore: boolean
  hasMetrics: boolean
  hasState: boolean
  hasLog: boolean
  hasSources: boolean
  active: boolean
  inferred: InferredFlags
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

const CORE_FILES = ["README.md", "00-query-original.md", "01-deep-research-prompt.md", "02-research-report.md", "03-recommendations.md"]
const CONTENT_LIMIT = 30000
const DISPLAY_TITLE_MAX = 60
const RESEARCH_CACHE_TTL_MS = 5_000

let summaryCache:
  | {
      root: string
      expiresAt: number
      summaries: ResearchRunSummary[]
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
  const entries = await readdir(runPath, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

async function buildRunSummary(runPath: string, slug: string, indexEntry?: IndexEntry): Promise<ResearchRunSummary> {
  const files = await listRunFiles(runPath)
  const hasCore = CORE_FILES.every((file) => files.includes(file))
  const hasMetrics = files.includes("metrics.yaml")
  const hasState = files.includes("pipeline-state.yaml")
  const hasLog = files.includes("execution-log.jsonl")
  const hasSources = files.includes("sources.yaml")
  const waves = indexEntry?.waves ?? files.filter((file) => file.includes("wave") && file.endsWith(".md")).length
  const readme = files.includes("README.md") ? await readFile(path.join(runPath, "README.md"), "utf8") : ""
  const title = indexEntry?.topic ?? extractHeading(readme) ?? prettifySlug(slug)
  const displayTitle = indexEntry?.display_title ?? deriveDisplayTitleFallback(title)
  const freshness = hasSources ? await readFreshnessRatio(path.join(runPath, "sources.yaml")) : "--"
  const category: CategorySlug = (indexEntry?.category as CategorySlug | undefined) ?? "other"
  const explicitCoverage = formatValue(indexEntry?.coverage_score)
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
    date: indexEntry?.date ?? extractDate(slug),
    status: indexEntry?.status ?? indexEntry?.decision ?? (hasCore ? "indexed" : "partial"),
    coverage: explicitCoverage === "--" ? String(inferredCoverage) : explicitCoverage,
    integrity: formatValue(indexEntry?.integrity_score),
    freshness,
    waves: Number(waves ?? 0),
    sources: formatValue(indexEntry?.sources_total),
    files: files.length,
    schema: schemaForRun({ hasCore, hasMetrics, hasState, hasLog, waves: Number(waves ?? 0) }),
    hasCore,
    hasMetrics,
    hasState,
    hasLog,
    hasSources,
    active: false,
    inferred,
  }
}

async function readFreshnessRatio(sourcesYamlPath: string): Promise<string> {
  try {
    const raw = await readFile(sourcesYamlPath, "utf8")
    // Minimal YAML scrape — avoid hard dep on js-yaml in this server module.
    // sources_extractor emits `date_coverage_ratio: 0.775` near totals block.
    const match = raw.match(/date_coverage_ratio:\s*([0-9.]+)/)
    if (!match) return "--"
    const ratio = parseFloat(match[1])
    if (Number.isNaN(ratio)) return "--"
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

// Minimal scanner for sources.yaml shape emitted by tech-research/scripts/sources_extractor.py.
// Returns ordered entries; no external YAML parser required.
function parseSourcesYaml(raw: string): SourceEntry[] {
  const lines = raw.split("\n")
  const entries: SourceEntry[] = []
  let current: Partial<SourceEntry> | null = null
  let inSources = false
  let inFlags = false

  const unquote = (val: string): string => {
    const trimmed = val.trim()
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1)
    }
    return trimmed
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "")
    if (line.startsWith("sources:")) {
      inSources = true
      continue
    }
    if (inSources && line.startsWith("totals:")) {
      if (current && current.id) entries.push(current as SourceEntry)
      current = null
      break
    }
    if (!inSources) continue

    if (line.startsWith("  - id:")) {
      if (current && current.id) entries.push(current as SourceEntry)
      current = { flags: [] }
      const val = unquote(line.slice("  - id:".length))
      current.id = val
      inFlags = false
      continue
    }

    if (!current) continue

    if (line.startsWith("    flags:")) {
      const rest = line.slice("    flags:".length).trim()
      if (rest === "[]") {
        current.flags = []
        inFlags = false
      } else {
        inFlags = true
      }
      continue
    }

    if (inFlags && line.startsWith("      - ")) {
      const flag = unquote(line.slice("      - ".length))
      current.flags = [...(current.flags ?? []), flag]
      continue
    }

    if (line.startsWith("      ") && inFlags) continue
    inFlags = false

    const fieldMatch = line.match(/^ {4}([a-z_]+):\s*(.*)$/)
    if (!fieldMatch) continue

    const [, key, value] = fieldMatch
    const clean = unquote(value)

    switch (key) {
      case "url":
        current.url = clean
        break
      case "title":
        current.title = clean
        break
      case "date":
        current.date = clean
        break
      case "credibility":
        if (clean === "HIGH" || clean === "MEDIUM" || clean === "LOW") {
          current.credibility = clean
        }
        break
      case "multiplier": {
        const n = parseFloat(clean)
        if (!Number.isNaN(n)) current.multiplier = n
        break
      }
      default:
        break
    }
  }

  if (current && current.id) entries.push(current as SourceEntry)
  return entries
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

// Minimal scanner for players.yaml shape emitted by tech-research/scripts/players_extractor.py.
// Skips `additional_sources:` block to avoid recursing; ignores `totals:` section.
function parsePlayersYaml(raw: string): PlayerEntry[] {
  const lines = raw.split("\n")
  const entries: PlayerEntry[] = []
  let current: Partial<PlayerEntry> | null = null
  let inPlayers = false
  let inAdditionalSources = false

  const unquote = (val: string): string => {
    const trimmed = val.trim()
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, " ")
    }
    return trimmed
  }

  const nullable = (val: string): string | null => {
    const clean = unquote(val)
    return clean === "null" || clean === "" ? null : clean
  }

  const finalize = () => {
    if (current && current.id && current.name) {
      entries.push({
        id: current.id,
        number: current.number ?? "",
        name: current.name,
        tier: current.tier ?? null,
        category: current.category ?? null,
        whatItDoes: current.whatItDoes ?? null,
        whatItDoesNot: current.whatItDoesNot ?? null,
        insight: current.insight ?? null,
        sourceTitle: current.sourceTitle ?? null,
        sourceUrl: current.sourceUrl ?? null,
        sourceDate: current.sourceDate ?? null,
        excluded: current.excluded ?? false,
        exclusionReason: current.exclusionReason ?? null,
        section: current.section ?? null,
      })
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "")
    if (line.startsWith("players:")) {
      inPlayers = true
      continue
    }
    if (inPlayers && line.startsWith("totals:")) {
      finalize()
      current = null
      break
    }
    if (!inPlayers) continue

    if (line.startsWith("  - id:")) {
      finalize()
      current = {}
      current.id = unquote(line.slice("  - id:".length))
      inAdditionalSources = false
      continue
    }

    if (!current) continue

    if (line.startsWith("    additional_sources:")) {
      inAdditionalSources = true
      continue
    }
    if (inAdditionalSources) {
      // Skip nested entries until next top-level player field (indent of 4 spaces, not 6+).
      if (line.startsWith("      ") || line.startsWith("    -")) continue
      inAdditionalSources = false
    }

    const fieldMatch = line.match(/^ {4}([a-z_]+):\s*(.*)$/)
    if (!fieldMatch) continue

    const [, key, value] = fieldMatch

    switch (key) {
      case "number":
        current.number = unquote(value)
        break
      case "name":
        current.name = unquote(value)
        break
      case "tier": {
        const n = parseInt(unquote(value), 10)
        if (n === 1 || n === 2 || n === 3) current.tier = n
        break
      }
      case "category":
        current.category = nullable(value)
        break
      case "what_it_does":
        current.whatItDoes = nullable(value)
        break
      case "what_it_does_not":
        current.whatItDoesNot = nullable(value)
        break
      case "insight":
        current.insight = nullable(value)
        break
      case "source_title":
        current.sourceTitle = nullable(value)
        break
      case "source_url":
        current.sourceUrl = nullable(value)
        break
      case "source_date":
        current.sourceDate = nullable(value)
        break
      case "excluded":
        current.excluded = unquote(value) === "true"
        break
      case "exclusion_reason":
        current.exclusionReason = nullable(value)
        break
      case "section":
        current.section = nullable(value)
        break
      default:
        break
    }
  }

  finalize()
  return entries
}

function filesForView(view?: ReaderMode, selectedFile?: string) {
  const files = new Set<string>()
  if (selectedFile) files.add(selectedFile)
  if (!view || view === "document") return null

  files.add("README.md")
  if (view === "map") {
    files.add("metrics.yaml")
    files.add("pipeline-state.yaml")
    files.add("research-graph.json")
    files.add("matrices.yaml")
    files.add("ux-patterns.yaml")
    files.add("execution-log.jsonl")
    return files
  }
  if (view === "curiosity") {
    files.add("curiosity_queue.yaml")
    return files
  }
  if (view === "recommendations") {
    files.add("03-recommendations.md")
    files.add("quick-wins.md")
    files.add("curiosity_queue.yaml")
    files.add("execution-log.jsonl")
    return files
  }
  if (view === "waves") {
    files.add("execution-log.jsonl")
    return files
  }
  if (view === "sources") {
    files.add("sources.yaml")
    return files
  }
  if (view === "players") {
    files.add("players.yaml")
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
  const runSlugs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
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

export async function getResearchObservatoryData(selectedSlug?: string, selectedFile?: string, view?: ReaderMode): Promise<ResearchObservatoryData> {
  const researchRoot = resolveDashPath("docs", "research")
  const index = await readIndex(researchRoot)
  const summaries = await getCachedRunSummaries(researchRoot, index)
  const preferredSlug = selectedSlug && summaries.some((run) => run.slug === selectedSlug)
    ? selectedSlug
    : summaries.find((run) => run.slug === "2026-05-11-visual-deep-research-apps")?.slug ?? summaries[0]?.slug
  const runs = summaries.map((run) => ({ ...run, active: run.slug === preferredSlug }))
  const selectedRun = runs.find((run) => run.slug === preferredSlug) ?? runs[0]
  const documents = selectedRun ? await buildDocuments(path.join(researchRoot, selectedRun.slug), view, selectedFile) : []
  const selectedDocument = documents.find((doc) => doc.file === selectedFile)
    ?? documents.find((doc) => doc.file === "README.md")
    ?? documents.find((doc) => doc.file === "02-research-report.md")
    ?? documents[0]
  const topSources = selectedRun?.hasSources
    ? await readTopSources(path.join(researchRoot, selectedRun.slug, "sources.yaml"))
    : []
  const players = selectedRun
    ? await readPlayers(path.join(researchRoot, selectedRun.slug, "players.yaml"))
    : []

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
      `${selectedRun?.sources ?? "--"} fontes indexadas`,
      `${documents.length} artefatos legíveis`,
      selectedRun?.hasMetrics ? "metrics.yaml presente" : "metrics.yaml ausente",
      selectedRun?.hasState ? "pipeline-state.yaml presente" : "pipeline-state.yaml ausente",
      selectedRun?.hasLog ? "execution-log.jsonl presente" : "execution-log.jsonl ausente",
      selectedRun?.hasSources ? "sources.yaml presente" : "sources.yaml ausente",
      `${selectedRun?.waves ?? 0} waves detectadas`,
    ],
    topSources,
    players,
  }
}
