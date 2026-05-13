"use client"

import { type CSSProperties } from "react"
import { Check, List, MessageSquarePlus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { OBSERVATORY_SOURCES, type ObservatorySource } from "../foundations/constants"
import { DISPLAY_FONT, MONO_FONT } from "../foundations/theme"

/* Organism — header em 2 linhas (top: brand+source toggle+actions, bottom: ticker integrado).
 * Source-agnostic: title and CTA labels come from props. */
export function Topbar({
  source,
  brandLabel,
  newActionLabel,
  selectedSlug,
  selectedTitle,
  selectedDate,
  selectedSchema,
  availableSources = OBSERVATORY_SOURCES,
  onChangeSource,
  onCopyNew,
  onCopyDeepen,
  onList,
  copiedNew = false,
  copiedDeepen = false,
}: {
  source: ObservatorySource
  brandLabel: string                       // e.g. "Research" or "Bench"
  newActionLabel: string                   // e.g. "Nova Pesquisa" / "Novo Benchmark"
  selectedSlug: string
  selectedTitle: string
  selectedDate: string
  selectedSchema: string
  availableSources?: Array<[ObservatorySource, string]>
  onChangeSource: (next: ObservatorySource) => void
  onCopyNew: () => void
  onCopyDeepen: () => void
  onList: () => void
  copiedNew?: boolean
  copiedDeepen?: boolean
}) {
  const topbarVars = {
    "--top-paper": "var(--aiox-dark, #050505)",
    "--top-paper-alt": "var(--aiox-surface, #0f0f11)",
    "--top-ink": "var(--aiox-cream-alt, #f5f4e7)",
    "--top-ink-3": "rgba(245, 244, 231, 0.48)",
    "--top-ink-dim": "rgba(245, 244, 231, 0.34)",
    "--top-ink-faint": "rgba(245, 244, 231, 0.18)",
    "--top-rule": "rgba(245, 244, 231, 0.13)",
    "--top-rule-soft": "rgba(245, 244, 231, 0.08)",
    "--top-lime": "var(--aiox-lime, #d1ff00)",
    "--top-on-lime": "var(--aiox-dark, #050505)",
  } as CSSProperties

  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--top-rule)] bg-[var(--top-paper)]"
      style={topbarVars}
    >
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-3 overflow-hidden">
          <img
            src="/logo/AIOX-White.svg"
            alt="AIOX"
            className="h-5 w-auto shrink-0"
          />
          <span className="hidden h-4 w-px shrink-0 bg-[var(--top-rule)] lg:block" />
          <div className="min-w-0">
            <h1
              className="truncate text-[12px] font-black uppercase leading-none tracking-[0.02em] text-[var(--top-ink)]"
              style={{ fontFamily: DISPLAY_FONT }}
            >
              Dash
            </h1>
            <span
              className="mt-0.5 hidden truncate text-[8px] uppercase tracking-[0.18em] text-[var(--top-ink-3)] sm:block"
              style={{ fontFamily: MONO_FONT }}
            >
              {source === "sinkra-maps" ? "Operational maps" : brandLabel}
            </span>
          </div>
        </div>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-0 overflow-x-auto [scrollbar-width:none]">
          {/* Source segmented toggle — dynamic across all registered sources */}
          <div
            className="flex shrink-0 items-center"
            style={{ gridTemplateColumns: `repeat(${availableSources.length}, minmax(0, 1fr))` }}
          >
            {availableSources.map(([key, label]) => {
              const active = key === source
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !active && onChangeSource(key)}
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap border-l border-[var(--top-rule)] px-3 text-[9px] uppercase tracking-[0.12em] transition-colors sm:px-4",
                    active
                      ? "bg-[rgba(209,255,0,0.05)] text-[var(--top-lime)]"
                      : "bg-transparent text-[var(--top-ink-3)] hover:bg-[rgba(245,244,231,0.03)] hover:text-[var(--top-ink)]",
                  )}
                  style={{ fontFamily: MONO_FONT }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={onCopyNew}
            title={`Copiar comando CLI: ${newActionLabel}`}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap border-l border-[var(--top-rule)] px-3 text-[9px] uppercase tracking-[0.12em] transition-colors sm:px-4",
              copiedNew
                ? "bg-transparent text-[var(--top-lime)]"
                : "bg-transparent text-[var(--top-ink-3)] hover:bg-[rgba(245,244,231,0.03)] hover:text-[var(--top-ink)]",
            )}
            style={{ fontFamily: MONO_FONT }}
          >
            {copiedNew ? <Check size={14} strokeWidth={1.75} /> : <Plus size={14} strokeWidth={1.75} />}
            <span className="hidden md:inline">{copiedNew ? "Copiado" : newActionLabel}</span>
          </button>

          <button
            type="button"
            onClick={onCopyDeepen}
            title="Copia um comando CLI para aprofundar o item selecionado"
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap border-l border-[var(--top-rule)] px-3 text-[9px] uppercase tracking-[0.12em] transition-colors sm:px-4",
              copiedDeepen
                ? "bg-transparent text-[var(--top-lime)]"
                : "bg-transparent text-[var(--top-ink-3)] hover:bg-[rgba(245,244,231,0.03)] hover:text-[var(--top-ink)]",
            )}
            style={{ fontFamily: MONO_FONT }}
          >
            {copiedDeepen ? <Check size={14} strokeWidth={1.75} /> : <MessageSquarePlus size={14} strokeWidth={1.75} />}
            <span className="hidden md:inline">{copiedDeepen ? "Copiado" : "Aprofundar"}</span>
          </button>

          <button
            type="button"
            onClick={onList}
            title="Listar"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap border-l border-[var(--top-rule)] bg-transparent px-3 text-[9px] uppercase tracking-[0.12em] text-[var(--top-ink-3)] transition-colors hover:bg-[rgba(245,244,231,0.03)] hover:text-[var(--top-ink)] sm:px-4"
            style={{ fontFamily: MONO_FONT }}
          >
            <List size={14} strokeWidth={1.75} />
            <span className="hidden md:inline">Listar</span>
          </button>
        </nav>
      </div>

      <div
        className="flex min-h-8 items-center gap-x-3 overflow-hidden border-t border-[var(--top-rule-soft)] px-4 text-[9px] uppercase tracking-[0.16em] text-[var(--top-ink-dim)] sm:gap-x-5 sm:px-6"
        style={{ fontFamily: MONO_FONT }}
      >
        <span className="flex min-w-0 items-center gap-2 text-[var(--top-ink)]">
          <span className="relative inline-block h-1.5 w-1.5 shrink-0 bg-[var(--top-lime)] [animation:cleanPulse_2.2s_ease-out_infinite]" />
          <span className="truncate">{source === "sinkra-maps" ? "Mapa" : "Selecionado"} · {selectedTitle}</span>
        </span>
        <span className="hidden text-[var(--top-ink-faint)] sm:inline">/</span>
        <span className={cn("hidden min-w-0 truncate sm:inline", source === "sinkra-maps" && "lg:inline")}>
          slug · <strong className="font-medium text-[var(--top-ink)]">{selectedSlug}</strong>
        </span>
        <span className="hidden text-[var(--top-ink-faint)] md:inline">/</span>
        <span className={cn("hidden shrink-0 md:inline", source === "sinkra-maps" && "hidden xl:inline")}>
          schema · <strong className="font-medium text-[var(--top-ink)]">{selectedSchema}</strong>
        </span>
        <span className="ml-auto shrink-0">{selectedDate}</span>
      </div>
    </header>
  )
}
