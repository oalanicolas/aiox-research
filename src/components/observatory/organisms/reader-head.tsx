"use client"

import { useState } from "react"
import { Check, Clipboard, FolderOpen, ScrollText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Pager } from "../molecules/pager"
import type { ObservatorySource, ReaderMode } from "../foundations/constants"
import { DISPLAY_FONT, MONO_FONT } from "../foundations/theme"
import { formatBytes } from "../foundations/utils"
import type { ObservatoryRunSummary } from "../foundations/types"

const MODE_LABELS: Record<ReaderMode, string> = {
  document: "Doc",
  overview: "Overview",
  map: "Map",
  slides: "Slides",
  roadmap: "Roadmap",
  recommendations: "Ações",
  curiosity: "Perguntas",
  waves: "Waves",
  sources: "Fontes",
  players: "Players",
  score: "Score",
  matrix: "Matriz",
  duel: "Duelo",
  personas: "Personas",
  tco: "TCO",
  coverage: "Cobertura",
  decision: "Decisão",
  weights: "Pesos",
  workflow: "Workflow",
  tasks: "Tasks",
  gates: "Gates",
  flow: "Fluxo",
  automation: "Automação",
  governance: "Governança",
  accountability: "RACI",
  gaps: "Gaps",
  evidence: "Evidências",
}

/* Bench/Demo label overrides — narrative labels for the decision UI.
   Order in the nav comes from adapters (bench.ts availableModes push order),
   not from this map. See apps/research/DOCTRINE-decision-in-one-click.md §"6 atos". */
const BENCH_MODE_LABELS: Partial<Record<ReaderMode, string>> = {
  map: "Overview",
  matrix: "Matriz",
  duel: "Comparativo",
  weights: "Pesos",
  personas: "Personas",
  evidence: "Evidências",
  roadmap: "Execução",
  decision: "Decisão",
  waves: "Waves",
  curiosity: "Perguntas",
  slides: "Slides",
  document: "Docs",
}

const SINKRA_MODE_HELP: Partial<Record<ReaderMode, string>> = {
  map: "overview executivo",
  flow: "jornada operacional",
  automation: "decisões de automação",
  governance: "controles e gates",
  accountability: "papéis e donos",
  gaps: "bloqueios reais",
  evidence: "provas do mapa",
  document: "artefatos fonte",
}

export function ReaderHead({
  phase,
  runTitle,
  runSlug,
  file,
  bytes,
  sourceRoot,
  fileIdx,
  totalFiles,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onCopy,
  source = "research",
  selectedRun,
  mode = "document",
  availableModes = ["document"],
  onChangeMode,
  benchEyebrow,
}: {
  phase: string
  runTitle: string
  runSlug: string
  file: string
  bytes: number
  sourceRoot: string
  fileIdx: number
  totalFiles: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onCopy: () => void
  source?: ObservatorySource
  selectedRun?: ObservatoryRunSummary
  mode?: ReaderMode
  availableModes?: ReaderMode[]
  onChangeMode?: (mode: ReaderMode) => void
  benchEyebrow?: { scale: string; subtitle?: string }
}) {
  const [copied, setCopied] = useState(false)
  const [openingFolder, setOpeningFolder] = useState(false)
  const [folderStatus, setFolderStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  function handleCopy() {
    onCopy()
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function handleOpenFolder() {
    if (openingFolder) return
    setOpeningFolder(true)
    setFolderStatus(null)
    try {
      const response = await fetch("/api/observatory/open-folder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, slug: runSlug }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? "Não foi possível abrir a pasta.")
      }
      setFolderStatus({ tone: "success", message: "Pasta aberta." })
    } catch (error) {
      console.warn(error)
      setFolderStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível abrir a pasta.",
      })
    } finally {
      setOpeningFolder(false)
    }
  }

  const showSwitcher = availableModes.length > 1 && onChangeMode
  const showFileMeta = mode === "document"
  const modeLabel = getModeLabel(mode, source)
  const isSinkra = source === "sinkra-maps"
  const title = showFileMeta ? file : isSinkra ? runTitle : modeLabel
  const context = (source === "bench" || source === "demo") && benchEyebrow
    ? benchEyebrow.scale
    : isSinkra
      ? SINKRA_MODE_HELP[mode] ?? "mapa operacional"
      : selectedRun?.schema || phase
  const scoreLabel = source === "research" ? "coverage" : "score"
  const path = `${sourceRoot}/${runSlug}/${showFileMeta ? file : "structured-view"}`
  const runtimeRunIds = source === "research" ? selectedRun?.runtimeRunIds ?? [] : []
  const researchLogHref = runtimeRunIds.length > 0 ? `/research?runs=${encodeURIComponent(runtimeRunIds.join(","))}` : ""

  return (
    <div className={cn(
      "shrink-0 border-b border-[var(--rule)] bg-[var(--paper)] px-4 py-3 sm:px-6 lg:px-8",
      isSinkra && !showFileMeta && "py-3 sm:py-4",
    )}>
      <div className="grid gap-3">
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <div
              className="mb-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]"
              style={{ fontFamily: MONO_FONT }}
            >
              <span>{isSinkra ? "SINKRA MAP" : modeLabel}</span>
              <span className="text-[var(--ink-faint)]">·</span>
              <span className="truncate">{context}</span>
              {selectedRun?.coverage && (
                <>
                  <span className="text-[var(--ink-faint)]">·</span>
                  <span>
                    {scoreLabel} <strong className="font-semibold text-[var(--ink)]">{selectedRun.coverage}</strong>
                  </span>
                </>
              )}
            </div>

            <h1
              className={cn(
                "m-0 truncate font-black leading-tight tracking-[-0.03em] text-[var(--ink)]",
                isSinkra && !showFileMeta ? "text-[24px] sm:text-[30px]" : "text-[21px] sm:text-[24px]",
              )}
              style={{ fontFamily: DISPLAY_FONT }}
              title={showFileMeta ? title : runTitle}
            >
              {title}
            </h1>

            {showFileMeta ? (
              <div
                className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] tracking-[0.06em] text-[var(--ink-3)]"
                style={{ fontFamily: MONO_FONT }}
              >
                <span className="truncate text-[var(--ink-dim)]">{path}</span>
                <span className="text-[var(--ink-faint)]">·</span>
                <span>{formatBytes(bytes)}</span>
              </div>
            ) : isSinkra ? (
              <p className="mt-1 max-w-[760px] text-[13px] leading-[1.45] text-[var(--ink-2)]">
                Visão executiva para entender fluxo, risco, automação, governança e evidências sem ler os artefatos brutos.
              </p>
            ) : null}
          </div>

          {(showFileMeta || researchLogHref) && (
            <div className="flex min-w-0 shrink-0 items-center gap-2 xl:justify-end">
              {researchLogHref && (
                <a
                  href={researchLogHref}
                  className="inline-flex h-[var(--dash-control-h)] items-center gap-1.5 border border-[var(--ink-faint)] px-2.5 text-[var(--ink-3)] transition-colors hover:border-[var(--lime-ink)] hover:text-[var(--lime-ink)]"
                  title="Ver log da pesquisa"
                >
                  <ScrollText size={13} strokeWidth={1.75} />
                  <span className="text-[10px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO_FONT }}>
                    Log
                  </span>
                </a>
              )}
              {showFileMeta && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    disabled={openingFolder || source === "demo"}
                    className="inline-flex h-[var(--dash-control-h)] w-[var(--dash-control-h)] items-center justify-center border border-[var(--ink-faint)] text-[var(--ink-3)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-45"
                    title="Abrir pasta do run"
                    aria-label="Abrir pasta do run"
                  >
                    <FolderOpen size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                      "inline-flex h-[var(--dash-control-h)] items-center gap-1.5 border px-2.5 transition-colors",
                      copied
                        ? "border-[var(--lime-ink)] text-[var(--lime-ink)]"
                        : "border-[var(--ink-faint)] text-[var(--ink-3)] hover:border-[var(--ink)] hover:text-[var(--ink)]",
                    )}
                    title="Copiar conteúdo"
                  >
                    {copied ? <Check size={13} strokeWidth={1.75} /> : <Clipboard size={13} strokeWidth={1.75} />}
                    <span className="text-[10px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO_FONT }}>
                      {copied ? "Copiado" : "Copiar"}
                    </span>
                  </button>
                  <Pager
                    index={fileIdx}
                    total={totalFiles}
                    canPrev={canPrev}
                    canNext={canNext}
                    onPrev={onPrev}
                    onNext={onNext}
                    prevTitle="Arquivo anterior (←)"
                    nextTitle="Próximo arquivo (→)"
                  />
                </>
              )}
            </div>
          )}
        </div>
        {showFileMeta && folderStatus && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "w-fit max-w-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em]",
              folderStatus.tone === "success"
                ? "border-[var(--lime-ink)] text-[var(--lime-ink)]"
                : "border-red-400/70 text-red-700",
            )}
            style={{ fontFamily: MONO_FONT }}
          >
            {folderStatus.message}
          </div>
        )}

        <div className="min-w-0">
          {showSwitcher && (
            <div
              role="tablist"
              aria-label="Visualizações da pesquisa"
              className="flex max-w-full min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none]"
            >
              {availableModes.map((m, idx) => {
                const active = m === mode
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => !active && onChangeMode?.(m)}
                    className={cn(
                      "inline-flex h-9 min-w-[114px] shrink-0 cursor-pointer items-center justify-center gap-2.5 border px-3 font-semibold uppercase transition-colors",
                      active
                        ? "border-[var(--lime-ink)] bg-[var(--surface-hover)] text-[var(--lime-ink)] shadow-[inset_0_-1px_0_var(--lime-ink)]"
                        : "border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--rule-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
                    )}
                    style={{ fontFamily: MONO_FONT, fontSize: "11px", letterSpacing: "0.16em" }}
                  >
                    <span
                      className={cn("border-r pr-2 font-bold tabular-nums", active ? "border-[var(--lime-ink)] text-[var(--lime-ink)]" : "border-[var(--rule-soft)] text-[var(--ink-dim)]")}
                      style={{ fontSize: "10px", letterSpacing: "0.1em" }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span>{getModeLabel(m, source)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getModeLabel(mode: ReaderMode, source: ObservatorySource) {
  if (source === "bench" || source === "demo") return BENCH_MODE_LABELS[mode] ?? MODE_LABELS[mode]
  return MODE_LABELS[mode]
}
