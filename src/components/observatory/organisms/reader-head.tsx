"use client"

import { useState } from "react"
import { Check, Clipboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { Pager } from "../molecules/pager"
import type { ObservatorySource, ReaderMode } from "../foundations/constants"
import { DISPLAY_FONT, MONO_FONT } from "../foundations/theme"
import { formatBytes } from "../foundations/utils"
import type { ObservatoryRunSummary } from "../foundations/types"

const MODE_LABELS: Record<ReaderMode, string> = {
  document: "Doc",
  overview: "Overview",
  map: "Mapa",
  sources: "Fontes",
  players: "Players",
  score: "Score",
  matrix: "Matrix",
  duel: "Duel",
  personas: "Personas",
  tco: "TCO",
  coverage: "Coverage",
  decision: "Decision",
  weights: "Weights",
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

  function handleCopy() {
    onCopy()
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const showSwitcher = availableModes.length > 1 && onChangeMode
  const showFileMeta = mode === "document"
  const modeLabel = MODE_LABELS[mode]
  const isSinkra = source === "sinkra-maps"
  const title = showFileMeta ? file : isSinkra ? runTitle : modeLabel
  const context = source === "bench" && benchEyebrow
    ? benchEyebrow.scale
    : isSinkra
      ? SINKRA_MODE_HELP[mode] ?? "mapa operacional"
      : selectedRun?.schema || phase
  const path = `${sourceRoot}/${runSlug}/${showFileMeta ? file : "structured-view"}`

  return (
    <div className={cn(
      "shrink-0 border-b border-[var(--rule)] bg-[var(--paper)] px-4 py-3 sm:px-6 lg:px-8",
      isSinkra && !showFileMeta && "py-3 sm:py-4",
    )}>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
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
                  score <strong className="font-semibold text-[var(--ink)]">{selectedRun.coverage}</strong>
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

        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 xl:justify-end">
          {showSwitcher && (
            <div className={cn(
              "flex max-w-full gap-px overflow-x-auto border border-[var(--rule)] bg-[var(--rule)] p-px [scrollbar-width:none]",
              isSinkra && "sm:gap-1 sm:border-0 sm:bg-transparent sm:p-0",
            )}>
              {availableModes.map((m, idx) => {
                const active = m === mode
                const help = isSinkra ? SINKRA_MODE_HELP[m] : null
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => !active && onChangeMode?.(m)}
                    className={cn(
                      "h-[var(--dash-control-h)] shrink-0 cursor-pointer px-2.5 text-[10px] uppercase tracking-[0.12em] transition-colors",
                      isSinkra && "h-auto min-h-[42px] px-3 py-2 text-left",
                      active
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "bg-[var(--paper-alt)] text-[var(--ink-3)] hover:bg-[var(--paper)] hover:text-[var(--ink)]",
                    )}
                    style={{ fontFamily: MONO_FONT }}
                  >
                    <span className="flex items-baseline gap-1.5">
                      <span className={cn("text-[9px] tabular-nums", active ? "text-[var(--paper)]/55" : "text-[var(--ink-faint)]")}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span>{MODE_LABELS[m]}</span>
                    </span>
                    {help && (
                      <span className={cn("mt-0.5 hidden text-[9px] normal-case tracking-[0] sm:block", active ? "text-[var(--paper)]/62" : "text-[var(--ink-dim)]")}>
                        {help}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {showFileMeta && (
            <>
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
      </div>
    </div>
  )
}
