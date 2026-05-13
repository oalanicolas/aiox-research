"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  GROUPS,
  type GroupKey,
  QUALITIES,
  type QualityKey,
  SORTS,
  type SortKey,
  STATUSES,
  type StatusKey,
  type ObservatorySource,
  type ReaderMode,
} from "./foundations/constants"
import { observatoryThemeVars, SANS_FONT } from "./foundations/theme"
import {
  coverageNumeric,
  cycleNext,
  formatBytes,
  monthLabel,
  placeholderMarkdown,
  statusKeyFromRaw,
} from "./foundations/utils"
import type {
  ObservatoryData,
  ObservatoryRunSummary,
} from "./foundations/types"
import { CloserStrip } from "./organisms/closer-strip"
import { Footer } from "./organisms/footer"
import { IndexPane } from "./organisms/index-pane"
import { InspectorPane } from "./organisms/inspector-pane"
import { ReaderBody } from "./organisms/reader-body"
import { ReaderHead } from "./organisms/reader-head"
import { Topbar } from "./organisms/topbar"

/* PAGE — Observatory (source-agnostic shell).
 *
 * Renders the same 3-column editorial UI for any corpus (research, bench, …)
 * via an adapter contract (ObservatoryData + ObservatoryAdapterMeta).
 *
 * Layout: 3 columns × dynamic rows
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Topbar (2 rows: brand+source toggle / ticker)            │
 *   ├─────────┬────────────────────────────────────┬───────────┤
 *   │ Index   │ ReaderHead                         │ Inspector │
 *   │ 340px   │ ReaderBody                         │ 320px     │
 *   │         │ CloserStrip (collapsible bottom)   │           │
 *   ├─────────┴────────────────────────────────────┴───────────┤
 *   │ Footer                                                   │
 *   └──────────────────────────────────────────────────────────┘
 */
export function Observatory({
  data,
  availableSources,
  basePath = "/observatory",
}: {
  data: ObservatoryData
  availableSources?: Array<[ObservatorySource, string]>
  basePath?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  /* ── URL-as-state for shareable filters ── */
  const sort = ((searchParams?.get("sort") as SortKey | null) ?? "recent") as SortKey
  const statusF = ((searchParams?.get("status") as StatusKey | null) ?? "all") as StatusKey
  const group = ((searchParams?.get("group") as GroupKey | null) ?? "category") as GroupKey
  const quality = ((searchParams?.get("quality") as QualityKey | null) ?? "all") as QualityKey
  const requestedView = searchParams?.get("view") as ReaderMode | null
  const urlMode = requestedView && data.availableModes.includes(requestedView) ? requestedView : null

  /* ── Local UI state ── */
  const [query, setQuery] = useState("")
  const [prevRunSlug, setPrevRunSlug] = useState<string>(data.selectedRun.slug)
  const [selectedFile, setSelectedFile] = useState<string>(data.selectedDocument.file)
  const [mode, setMode] = useState<ReaderMode>(() => urlMode ?? defaultReaderMode(data))
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [copiedNew, setCopiedNew] = useState(false)
  const [copiedDeepen, setCopiedDeepen] = useState(false)
  const [viewport, setViewport] = useState<"sm" | "md" | "lg">("lg")

  const readerBodyRef = useRef<HTMLDivElement | null>(null)
  const indexListRef = useRef<HTMLDivElement | null>(null)

  /* scroll reader to top when file changes */
  useEffect(() => {
    readerBodyRef.current?.scrollTo({ top: 0 })
  }, [selectedFile, data.selectedRun.slug])

  /* Viewport tracking — drives auto-collapse of side panes on narrow screens.
     Breakpoints align with Tailwind: sm < 768, md < 1280, lg >= 1280. */
  useEffect(() => {
    function syncViewport() {
      const w = window.innerWidth
      if (w < 768) setViewport("sm")
      else if (w < 1280) setViewport("md")
      else setViewport("lg")
    }
    syncViewport()
    window.addEventListener("resize", syncViewport)
    return () => window.removeEventListener("resize", syncViewport)
  }, [])

  useEffect(() => {
    /* Honor user prefs on lg+. Force-collapse only on narrow viewports — they
       cannot fit the tri-pane shell legibly. */
    const storedLeft = window.localStorage.getItem("aiox.observatory.leftCollapsed") === "true"
    const storedRight = window.localStorage.getItem("aiox.observatory.rightCollapsed") === "true"
    setLeftCollapsed(storedLeft)
    setRightCollapsed(storedRight)
  }, [])

  useEffect(() => {
    /* On viewport narrowing, collapse both panes so the reader gets the
       breathing room a dashboard needs. User can still toggle.
       viewport is an external system (window.innerWidth) — pre-existing
       effects in this file already follow the same pattern. */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (viewport === "sm") {
      setLeftCollapsed(true)
      setRightCollapsed(true)
    } else if (viewport === "md") {
      setRightCollapsed(true)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [viewport])

  useEffect(() => {
    /* Only persist user-driven collapse decisions on lg viewports. Narrow-driven
       auto-collapse should not leak into the preferred desktop state. */
    if (viewport !== "lg") return
    window.localStorage.setItem("aiox.observatory.leftCollapsed", String(leftCollapsed))
  }, [leftCollapsed, viewport])

  useEffect(() => {
    if (viewport !== "lg") return
    window.localStorage.setItem("aiox.observatory.rightCollapsed", String(rightCollapsed))
  }, [rightCollapsed, viewport])

  useEffect(() => {
    if (data.selectedRun.slug === prevRunSlug) return
    setPrevRunSlug(data.selectedRun.slug)
    setSelectedFile(data.selectedDocument.file)
    setMode(urlMode ?? defaultReaderMode(data))
  }, [data.availableModes, data.selectedDocument.file, data.selectedRun.slug, prevRunSlug, urlMode])

  useEffect(() => {
    if (urlMode && urlMode !== mode) {
      setMode(urlMode)
      return
    }
    if (data.availableModes.includes(mode)) return
    setMode(defaultReaderMode(data))
  }, [data.availableModes, mode, urlMode])

  const selectedDocument = useMemo(
    () => data.documents.find((d) => d.file === selectedFile) ?? data.selectedDocument,
    [data.documents, data.selectedDocument, selectedFile],
  )

  const selectedContent = useMemo(() => {
    const c = selectedDocument.content?.trim() ?? ""
    if (c.length > 0) return selectedDocument.content
    return placeholderMarkdown(
      data.selectedRun.title,
      data.selectedRun.slug,
      selectedDocument.file,
      selectedDocument.phase,
      formatBytes(selectedDocument.bytes),
      data.selectedRun.schema,
      data.selectedRun.status,
      data.sourceRoot,
    )
  }, [selectedDocument, data.selectedRun, data.sourceRoot])

  /* ── filter / sort / group ── */
  const visibleRuns = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = data.runs.filter((r) => {
      if (!q) return true
      return `${r.slug} ${r.title} ${r.schema} ${r.status}`.toLowerCase().includes(q)
    })
    if (statusF !== "all") list = list.filter((r) => statusKeyFromRaw(r.status) === statusF)
    if (quality !== "all") {
      list = list.filter((r) => qualityClass(r) === quality)
    }
    const sorted = [...list]
    if (sort === "recent") sorted.sort((a, b) => b.date.localeCompare(a.date))
    if (sort === "oldest") sorted.sort((a, b) => a.date.localeCompare(b.date))
    if (sort === "coverage") {
      sorted.sort((a, b) => (coverageNumeric(b.coverage) ?? -1) - (coverageNumeric(a.coverage) ?? -1))
    }
    if (sort === "alpha") sorted.sort((a, b) => a.title.localeCompare(b.title))
    return sorted
  }, [data.runs, query, statusF, sort, quality])

  /* Server pre-resolved category buckets (label + slug order).
     For category grouping, we honor that order; for month/status, we compute locally. */
  const categoryBucketLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const b of data.groupBuckets) map.set(b.key, b.label)
    return map
  }, [data.groupBuckets])

  const categoryOrder = useMemo(
    () => data.groupBuckets.map((b) => b.key),
    [data.groupBuckets],
  )

  const groupedRuns = useMemo<Array<[string, ObservatoryRunSummary[]]>>(() => {
    if (group === "none") return [["__all", visibleRuns]]
    const map = new Map<string, ObservatoryRunSummary[]>()
    for (const r of visibleRuns) {
      let key: string
      if (group === "status") key = statusKeyFromRaw(r.status)
      else if (group === "category") key = (r.category ?? "other") as string
      else key = monthLabel(r.date)
      const bucket = map.get(key) ?? []
      bucket.push(r)
      map.set(key, bucket)
    }
    if (group === "category") {
      return categoryOrder
        .filter((c) => map.has(c))
        .map((c) => [c, map.get(c) ?? []] as [string, ObservatoryRunSummary[]])
    }
    return Array.from(map.entries())
  }, [visibleRuns, group, categoryOrder])

  /* ── file-level pager ── */
  const artifactDocs = useMemo(
    () => data.documents.filter((d) => d.file !== "sources.yaml"),
    [data.documents],
  )
  const fileIdx = artifactDocs.findIndex((d) => d.file === selectedFile)
  const canPrevFile = fileIdx > 0
  const canNextFile = fileIdx >= 0 && fileIdx < artifactDocs.length - 1

  /* Selecting a file always switches Reader to Document mode — picking a file
     only makes sense if you want to read it. Prevents the silent UX where the
     selection updates but the active mode (e.g. Matrix) hides the document. */
  const selectFile = useCallback(
    (file: string) => {
      setSelectedFile(file)
      setMode("document")
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set("file", file)
      params.set("view", "document")
      router.push(`${basePath}/${data.source}?${params.toString()}`)
    },
    [basePath, data.source, router, searchParams],
  )

  const navigateFile = useCallback(
    (dir: -1 | 1) => {
      const next = artifactDocs[fileIdx + dir]
      if (!next) return
      selectFile(next.file)
    },
    [artifactDocs, fileIdx, selectFile],
  )

  /* ── url helpers ── */
  const pushUrl = useCallback(
    (updates: {
      slug?: string
      sort?: SortKey
      status?: StatusKey
      group?: GroupKey
      quality?: QualityKey
      source?: ObservatorySource
      view?: ReaderMode
    }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      if (updates.slug !== undefined) params.set("slug", updates.slug)
      if (updates.sort !== undefined) params.set("sort", updates.sort)
      if (updates.status !== undefined) params.set("status", updates.status)
      if (updates.group !== undefined) params.set("group", updates.group)
      if (updates.quality !== undefined) params.set("quality", updates.quality)
      if (updates.view !== undefined) params.set("view", updates.view)
      if (updates.source !== undefined) {
        /* Source switch — navigate to /{basePath}/{source}. Reset slug/file. */
        router.push(`${basePath}/${updates.source}`)
        return
      }
      router.push(`${basePath}/${data.source}?${params.toString()}`)
    },
    [router, searchParams, basePath, data.source],
  )

  const changeMode = useCallback(
    (nextMode: ReaderMode) => {
      setMode(nextMode)
      pushUrl({ view: nextMode })
    },
    [pushUrl],
  )

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === "INPUT" || tag === "TEXTAREA"
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        document.getElementById("observatory-search-input")?.focus()
        return
      }
      if (inField) return
      if (e.key === "ArrowLeft" && canPrevFile) {
        e.preventDefault()
        navigateFile(-1)
      }
      if (e.key === "ArrowRight" && canNextFile) {
        e.preventDefault()
        navigateFile(1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [canPrevFile, canNextFile, navigateFile])

  /* ── scroll active row into view ── */
  useEffect(() => {
    const wrap = indexListRef.current
    if (!wrap) return
    const el = wrap.querySelector<HTMLElement>(`[data-slug="${CSS.escape(data.selectedRun.slug)}"]`)
    if (!el) return
    const er = el.getBoundingClientRect()
    const wr = wrap.getBoundingClientRect()
    if (er.top < wr.top + 60 || er.bottom > wr.bottom - 20) {
      wrap.scrollTop += er.top - wr.top - 80
    }
  }, [data.selectedRun.slug])

  /* ── readiness (derived from extras when present) ── */
  const corePhases = useMemo(() => {
    if (data.source === "research") {
      const extras = data.selectedRun.extras ?? {}
      return [
        { label: "Query", key: "query", on: data.documents.some((d) => d.file.startsWith("00-")) },
        { label: "Prompt", key: "prompt", on: data.documents.some((d) => d.file.startsWith("01-")) },
        { label: "Report", key: "report", on: data.documents.some((d) => d.file.startsWith("02-")) },
        { label: "Recomm.", key: "recommend", on: data.documents.some((d) => d.file.startsWith("03-")) },
        { label: "Waves", key: "waves", on: data.selectedRun.waves > 0 },
      ]
    }
    if (data.source === "sinkra-maps") {
      return [
        { label: "Map", key: "map", on: data.availableModes.includes("map") },
        { label: "Flow", key: "flow", on: data.availableModes.includes("flow") },
        { label: "Auto", key: "automation", on: data.availableModes.includes("automation") },
        { label: "Gov", key: "governance", on: data.availableModes.includes("governance") },
        { label: "RACI", key: "accountability", on: data.availableModes.includes("accountability") },
        { label: "Gaps", key: "gaps", on: data.availableModes.includes("gaps") },
        { label: "Evidence", key: "evidence", on: data.availableModes.includes("evidence") },
      ]
    }
    return [
      { label: "Meta", key: "meta", on: data.documents.some((d) => /metadata\.json/i.test(d.file)) },
      { label: "Score", key: "score", on: data.documents.some((d) => /scorecard/i.test(d.file)) },
      { label: "Matrix", key: "matrix", on: data.matrix !== null },
      { label: "Personas", key: "personas", on: data.personas.length > 0 },
      { label: "TCO", key: "tco", on: data.tco !== null },
    ]
  }, [data])

  const stopNote = data.selectedRun.status || "—"

  function copyCommand(command: string, onDone: (value: boolean) => void) {
    void navigator.clipboard?.writeText(command)
    onDone(true)
    window.setTimeout(() => onDone(false), 1800)
  }

  function onCopyNew() {
    const command =
      data.source === "bench"
        ? `claude && /spy *bench "<player-a>" "<player-b>" "Compare estes players e gere bench-output-dash.json em ${data.sourceRoot}/<slug>/."`
        : data.source === "sinkra-maps"
          ? `claude && *map "<processo-ou-missão>" "Mapeie com SINKRA e gere workflow_definition.yaml, task_definitions.yaml, quality_gates.yaml e score_card.yaml em ${data.sourceRoot}/<slug>/."`
        : `claude && /tech-research "<tema da pesquisa>" "Gere uma pesquisa completa em ${data.sourceRoot}/ com README, report, recommendations, metrics e sources."`
    copyCommand(command, setCopiedNew)
  }

  function onCopyDeepen() {
    copyCommand(data.deepenCommand, setCopiedDeepen)
  }

  const showDocCompanions = data.source !== "sinkra-maps" || mode === "document"
  const compactShell = viewport === "sm"
  const showSidePanes = !compactShell
  const showBottomCompanion = showDocCompanions && !compactShell

  return (
    <main
      className="grid h-[100dvh] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[var(--paper)] text-[var(--ink)]"
      style={{ ...observatoryThemeVars, fontFamily: SANS_FONT, fontSize: 14, lineHeight: 1.55 }}
    >
      <Topbar
        source={data.source}
        brandLabel={data.sourceLabel}
        newActionLabel={data.newActionLabel}
        selectedSlug={data.selectedRun.slug}
        selectedTitle={data.selectedRun.displayTitle}
        selectedDate={data.selectedRun.date}
        selectedSchema={data.selectedRun.schema}
        availableSources={availableSources}
        onChangeSource={(next) => pushUrl({ source: next })}
        onCopyNew={onCopyNew}
        onCopyDeepen={onCopyDeepen}
        copiedNew={copiedNew}
        copiedDeepen={copiedDeepen}
        onList={() => router.push(`${basePath}/${data.source}`)}
      />

      <div
        className={cn(
          "grid min-h-0 overflow-hidden",
          compactShell && "grid-cols-[minmax(0,1fr)]",
          /* Pane sizes scale with viewport: tighter on md (1024-1280px),
             full on lg+. Sm viewports always collapse both via effect above. */
          !compactShell && !showDocCompanions && leftCollapsed && "grid-cols-[32px_minmax(0,1fr)]",
          !compactShell && !showDocCompanions && !leftCollapsed &&
            "grid-cols-[var(--dash-sidebar-w-md)_minmax(0,1fr)] xl:grid-cols-[var(--dash-sidebar-w)_minmax(0,1fr)]",
          !compactShell && showDocCompanions && leftCollapsed && rightCollapsed && "grid-cols-[32px_minmax(0,1fr)_32px]",
          !compactShell && showDocCompanions && leftCollapsed && !rightCollapsed &&
            "grid-cols-[32px_minmax(0,1fr)_var(--dash-inspector-w-md)] xl:grid-cols-[32px_minmax(0,1fr)_var(--dash-inspector-w)]",
          !compactShell && showDocCompanions && !leftCollapsed && rightCollapsed &&
            "grid-cols-[var(--dash-sidebar-w-md)_minmax(0,1fr)_32px] xl:grid-cols-[var(--dash-sidebar-w)_minmax(0,1fr)_32px]",
          !compactShell && showDocCompanions && !leftCollapsed && !rightCollapsed &&
            "grid-cols-[var(--dash-sidebar-w-md)_minmax(0,1fr)_var(--dash-inspector-w-md)] xl:grid-cols-[var(--dash-sidebar-w)_minmax(0,1fr)_var(--dash-inspector-w)]",
        )}
      >
        {showSidePanes && (
          leftCollapsed ? (
            <CollapsedRail
              side="left"
              label="Index"
              onClick={() => setLeftCollapsed(false)}
            />
          ) : (
            <div className="relative h-full min-h-0 overflow-hidden">
              <IndexPane
                sourceLabel={data.sourceLabel}
                totalRuns={data.stats.totalRuns}
                query={query}
                onQueryChange={setQuery}
                sort={sort}
                statusF={statusF}
                group={group}
                onCycleSort={() => pushUrl({ sort: cycleNext(SORTS, sort) })}
                onCycleStatus={() => pushUrl({ status: cycleNext(STATUSES, statusF) })}
                onCycleGroup={() => pushUrl({ group: cycleNext(GROUPS, group) })}
                quality={quality}
                onCycleQuality={() => pushUrl({ quality: cycleNext(QUALITIES, quality) })}
                visibleRuns={visibleRuns}
                groupedRuns={groupedRuns}
                selectedSlug={data.selectedRun.slug}
                onSelectRun={(slug) => pushUrl({ slug })}
                listRef={indexListRef}
                categoryLabels={categoryBucketLabels}
              />
              <CollapseButton
                side="left"
                title="Encolher índice"
                onClick={() => setLeftCollapsed(true)}
              />
            </div>
          )
        )}

        <section className="flex min-h-0 flex-col overflow-hidden">
          <ReaderHead
            phase={selectedDocument.phase}
            runTitle={data.selectedRun.title}
            runSlug={data.selectedRun.slug}
            file={selectedDocument.file}
            bytes={selectedDocument.bytes}
            sourceRoot={data.sourceRoot}
            fileIdx={fileIdx}
            totalFiles={artifactDocs.length}
            canPrev={canPrevFile}
            canNext={canNextFile}
            onPrev={() => navigateFile(-1)}
            onNext={() => navigateFile(1)}
            onCopy={() => navigator.clipboard?.writeText(selectedContent)}
            source={data.source}
            selectedRun={data.selectedRun}
            mode={mode}
            availableModes={data.availableModes}
            onChangeMode={changeMode}
            benchEyebrow={
              data.source === "bench" && data.matrix
                ? {
                    scale: `${data.matrix.players.length} players × ${data.matrix.rows.length} dim`,
                    subtitle: data.benchmarkShortTitle || data.benchmarkMethod || undefined,
                  }
                : undefined
            }
          />
          <ReaderBody
            source={data.source}
            mode={mode}
            content={selectedContent}
            file={selectedDocument.file}
            bodyRef={readerBodyRef}
            matrix={data.matrix}
            scoreDimensions={data.scoreDimensions}
            scoreMetrics={data.scoreMetrics}
            runs={data.runs}
            personas={data.personas}
            tco={data.tco}
            tiebreakers={data.tiebreakers}
            cliffs={data.cliffs}
            decisionTree={data.decisionTree}
            categorical={data.categorical}
            editorsNote={data.editorsNote}
            playerProfiles={data.playerProfiles}
            topSources={data.topSources}
            researchPlayers={data.players}
            sourceSummary={data.sourceSummary}
            typeSpecific={data.typeSpecific}
          />
          {showBottomCompanion && (
            <CloserStrip
              artifactDocs={artifactDocs}
              selectedFile={selectedFile}
              onSelectFile={selectFile}
              selectedRun={data.selectedRun}
              corePhases={corePhases}
              stopNote={stopNote}
            />
          )}
        </section>

        {showDocCompanions && showSidePanes && (
          rightCollapsed ? (
            <CollapsedRail
              side="right"
              label="Inspector"
              onClick={() => setRightCollapsed(false)}
            />
          ) : (
            <div className="relative h-full min-h-0 overflow-hidden">
              <CollapseButton
                side="right"
                title="Encolher inspetor"
                onClick={() => setRightCollapsed(true)}
              />
              <InspectorPane
                artifactDocs={artifactDocs}
                selectedFile={selectedFile}
                onSelectFile={selectFile}
                topSources={data.topSources}
                players={data.players}
                personas={data.personas}
                tco={data.tco}
                tiebreakers={data.tiebreakers}
                cliffs={data.cliffs}
                decisionTree={data.decisionTree}
                categorical={data.categorical}
                gapItems={data.gapItems}
                editorsNote={data.editorsNote}
                playerProfiles={data.playerProfiles}
                availableModes={data.availableModes}
              />
            </div>
          )
        )}
      </div>

      <Footer sourceLabel={data.sourceLabel} sourceRoot={data.sourceRoot} />

      <style>{`
        @keyframes cleanPulse {
          0%   { box-shadow: 0 0 0 0 rgba(110,139,0,0.45); }
          70%  { box-shadow: 0 0 0 8px rgba(110,139,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(110,139,0,0); }
        }
      `}</style>
    </main>
  )
}

function CollapseButton({
  side,
  title,
  onClick,
}: {
  side: "left" | "right"
  title: string
  onClick: () => void
}) {
  const Icon = side === "left" ? PanelLeftClose : PanelRightClose
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "absolute z-30 grid h-7 w-7 place-items-center border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]",
        side === "left" ? "right-2 top-3" : "right-2 top-14",
      )}
    >
      <Icon size={14} strokeWidth={1.75} />
    </button>
  )
}

function CollapsedRail({
  side,
  label,
  onClick,
}: {
  side: "left" | "right"
  label: string
  onClick: () => void
}) {
  const Icon = side === "left" ? PanelLeftOpen : PanelRightOpen
  return (
    <button
      type="button"
      title={`Abrir ${label}`}
      onClick={onClick}
      className={cn(
        "flex min-h-0 items-start justify-center border-[var(--rule)] bg-[var(--paper-alt)] pt-3 text-[var(--ink-3)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]",
        side === "left" ? "border-r" : "border-l",
      )}
    >
      <Icon size={15} strokeWidth={1.75} />
    </button>
  )
}

function qualityClass(run: ObservatoryRunSummary): QualityKey {
  const extras = run.extras ?? {}

  /* No artifacts at all → no-data */
  if (run.files === 0) return "no-data"

  /* Bench signal: dash matrix with structured coverage = rich */
  const dashRows = Number(extras.dashRows ?? 0)
  const dashCoverage = String(extras.dashCoverage ?? "missing")
  if (dashRows >= 4 && dashCoverage === "structured") return "rich"

  /* Research signal: full core + metrics + state + sources = rich */
  if (extras.hasCore && extras.hasMetrics && extras.hasState && extras.hasSources) return "rich"

  /* SINKRA map signal: core structured artifacts exist */
  if (extras.hasWorkflow && extras.hasTasks && extras.hasGates) return "rich"

  /* Bench signal: scorecard + deep = rich (fallback) */
  if (extras.hasScorecard && extras.hasDeep) return "rich"

  /* Partial signals → shallow */
  if (dashRows > 0) return "shallow"

  /* Metadata-only (file present but nothing populated) */
  if ((extras.hasMetadata && !extras.hasScorecard) || extras.hasScore) return "metadata-only"

  return "shallow"
}

function defaultReaderMode(data: ObservatoryData): ReaderMode {
  if (data.source === "bench") {
    /* Bench prioritizes visual impact: Matrix first, then richer modes,
       finally fall back to document. */
    const priority: ReaderMode[] = ["matrix", "score", "personas", "duel", "tco", "coverage", "decision", "weights"]
    for (const m of priority) {
      if (data.availableModes.includes(m)) return m
    }
    return data.availableModes[0] ?? "document"
  }
  if (data.source === "sinkra-maps") {
    return data.availableModes.includes("map") ? "map" : data.availableModes[0] ?? "document"
  }
  return data.availableModes.includes("document") ? "document" : data.availableModes[0] ?? "document"
}
