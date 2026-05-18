"use client"

import { cn } from "@/lib/utils"
import { LightScrollArea } from "../molecules/light-scroll-area"
import { DISPLAY_FONT, MONO_FONT, SANS_FONT, SERIF_FONT } from "../foundations/theme"
import type { ObservatoryData } from "../foundations/types"

/* Organisms cross-poll do research-mode para bench-mode (2026-05-18).
 *
 * Bench tem dados de curiosity (curiosity-queue.yaml) e waves
 * (execution-log.jsonl) sidecar files, mas o adapter histórico não os
 * expunha como modes. Esses organisms renderizam os dados tipados
 * propagados via ObservatoryData.curiosity / ObservatoryData.waves.
 *
 * Padrão visual: mesma DNA do bench (matrix/duel/weights) —
 * dark editorial, lime accent, mono labels, display headlines.
 * Não reusa os renderers de research pq eles assumem documents[]
 * markdown shape; aqui temos shape estruturado tipado. */

export type BenchCuriosity = ObservatoryData["curiosity"]
export type BenchWaves = ObservatoryData["waves"]

/* ─── Curiosity ─── */

export function BenchCuriosityView({ curiosity }: { curiosity: BenchCuriosity }) {
  if (curiosity.length === 0) {
    return (
      <div className="flex-1 px-4 pt-5 sm:px-6 sm:pt-6 lg:px-10 lg:pt-7">
        <p
          className="text-[14px] italic text-[var(--ink-3)]"
          style={{ fontFamily: SERIF_FONT }}
        >
          Nenhuma pergunta aberta neste bench.
        </p>
      </div>
    )
  }

  const byPriority = (p: string) => {
    const norm = p.toUpperCase()
    if (norm === "HIGH" || norm === "P1") return 0
    if (norm === "MEDIUM" || norm === "P2") return 1
    return 2
  }
  const sorted = [...curiosity].sort((a, b) => byPriority(a.priority) - byPriority(b.priority))
  const high = sorted.filter((q) => /^(HIGH|P1)$/i.test(q.priority)).length
  const medium = sorted.filter((q) => /^(MEDIUM|P2)$/i.test(q.priority)).length

  return (
    <LightScrollArea
      className="flex-1"
      viewportClassName="px-4 pb-12 pt-5 sm:px-6 sm:pb-14 sm:pt-6 lg:px-10 lg:pb-16 lg:pt-7"
    >
      <div className="mx-auto w-full min-w-0 max-w-[920px]">
        <div
          className="mb-2 flex items-baseline gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--lime-ink)]"
          style={{ fontFamily: MONO_FONT }}
        >
          <span>▸ Perguntas abertas</span>
          <span className="text-[var(--ink-faint)]">·</span>
          <span className="text-[var(--ink-dim)]">{curiosity.length} no total</span>
        </div>
        <h1
          className="text-[clamp(32px,4vw,52px)] font-black leading-[0.95] tracking-[-0.04em] text-[var(--ink)]"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          O que ainda muda a decisão
        </h1>
        <p
          className="mt-3 max-w-[680px] text-[15px] leading-[1.6] text-[var(--ink-2)]"
          style={{ fontFamily: SERIF_FONT }}
        >
          Lacunas com prioridade explícita. Cada uma indica por que importa e a
          próxima ação concreta. {high > 0 && <strong className="text-[var(--lime-ink)]">{high} HIGH</strong>}
          {high > 0 && medium > 0 && " · "}
          {medium > 0 && <strong className="text-[var(--warning-ink)]">{medium} MEDIUM</strong>}.
        </p>

        <div className="mt-7 grid gap-3">
          {sorted.map((q) => (
            <article
              key={q.id}
              className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 border border-[var(--rule)] bg-[var(--paper-alt)] p-5"
            >
              <div className="flex flex-col gap-1.5">
                <span
                  className="text-[10px] font-bold tracking-[0.14em] text-[var(--ink-dim)]"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {q.id}
                </span>
                <PriorityBadge priority={q.priority} />
                {q.category && (
                  <span
                    className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--ink-dim)]"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {q.category}
                  </span>
                )}
              </div>
              <div className="grid gap-3">
                <h3
                  className="text-[18px] font-black leading-[1.3] tracking-[-0.02em] text-[var(--ink)]"
                  style={{ fontFamily: SANS_FONT }}
                >
                  {q.question}
                </h3>
                {q.whyItMatters && (
                  <div>
                    <div
                      className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-dim)]"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      ▸ Por que importa
                    </div>
                    <p
                      className="mt-1 text-[13.5px] italic leading-[1.55] text-[var(--ink-2)]"
                      style={{ fontFamily: SERIF_FONT }}
                    >
                      {q.whyItMatters}
                    </p>
                  </div>
                )}
                {q.nextAction && (
                  <div className="border-l-2 border-[var(--lime-ink)] pl-3">
                    <div
                      className="text-[10px] uppercase tracking-[0.14em] text-[var(--lime-ink)]"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      ▸ Próxima ação
                    </div>
                    <p
                      className="mt-1 text-[13.5px] leading-[1.55] text-[var(--ink)]"
                      style={{ fontFamily: SANS_FONT }}
                    >
                      {q.nextAction}
                    </p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </LightScrollArea>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const norm = priority.toUpperCase()
  const tone =
    norm === "HIGH" || norm === "P1"
      ? "border-[var(--lime-ink)]/40 bg-[var(--lime-ink)]/10 text-[var(--lime-ink)]"
      : norm === "MEDIUM" || norm === "P2"
        ? "border-[var(--warning-ink)]/40 bg-[var(--warning-ink)]/10 text-[var(--warning-ink)]"
        : "border-[var(--rule)] bg-transparent text-[var(--ink-dim)]"
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em]",
        tone,
      )}
      style={{ fontFamily: MONO_FONT }}
    >
      {norm.replace(/^P/, "P")}
    </span>
  )
}

/* ─── Waves Timeline ─── */

export function BenchWavesView({ waves }: { waves: BenchWaves }) {
  if (waves.length === 0) {
    return (
      <div className="flex-1 px-4 pt-5 sm:px-6 sm:pt-6 lg:px-10 lg:pt-7">
        <p
          className="text-[14px] italic text-[var(--ink-3)]"
          style={{ fontFamily: SERIF_FONT }}
        >
          Nenhum execution-log.jsonl encontrado neste bench.
        </p>
      </div>
    )
  }

  /* Group by phase for visual rhythm */
  const phases: Array<{ key: string; events: typeof waves }> = []
  for (const event of waves) {
    const last = phases[phases.length - 1]
    if (!last || last.key !== event.phase) phases.push({ key: event.phase, events: [event] })
    else last.events.push(event)
  }

  /* Total elapsed */
  const tsFirst = waves.find((w) => w.ts)?.ts
  const tsLast = [...waves].reverse().find((w) => w.ts)?.ts
  const elapsed = tsFirst && tsLast ? humanizeDelta(tsFirst, tsLast) : ""

  return (
    <LightScrollArea
      className="flex-1"
      viewportClassName="px-4 pb-12 pt-5 sm:px-6 sm:pb-14 sm:pt-6 lg:px-10 lg:pb-16 lg:pt-7"
    >
      <div className="mx-auto w-full min-w-0 max-w-[1000px]">
        <div
          className="mb-2 flex flex-wrap items-baseline gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--lime-ink)]"
          style={{ fontFamily: MONO_FONT }}
        >
          <span>▸ Timeline de execução</span>
          <span className="text-[var(--ink-faint)]">·</span>
          <span className="text-[var(--ink-dim)]">
            {waves.length} eventos · {phases.length} fases{elapsed && ` · ${elapsed}`}
          </span>
        </div>
        <h1
          className="text-[clamp(32px,4vw,52px)] font-black leading-[0.95] tracking-[-0.04em] text-[var(--ink)]"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          Como esse bench foi construído
        </h1>
        <p
          className="mt-3 max-w-[680px] text-[15px] leading-[1.6] text-[var(--ink-2)]"
          style={{ fontFamily: SERIF_FONT }}
        >
          Sequência auditável de eventos por fase. Mostra onde houve correção
          de rota, descoberta, validação ou ponto de saturação.
        </p>

        <ol className="mt-7 grid gap-6">
          {phases.map((phase) => (
            <li key={phase.key} className="border-l-2 border-[var(--rule)] pl-5">
              <div
                className="mb-3 flex items-baseline gap-3 text-[11px] uppercase tracking-[0.18em] text-[var(--lime-ink)]"
                style={{ fontFamily: MONO_FONT }}
              >
                <span>{phase.key}</span>
                <span className="text-[var(--ink-dim)]">· {phase.events.length} eventos</span>
              </div>
              <ul className="grid gap-2.5">
                {phase.events.map((ev, idx) => (
                  <li
                    key={`${phase.key}-${idx}-${ev.ts}`}
                    className="grid grid-cols-[86px_72px_minmax(0,1fr)] items-baseline gap-3"
                  >
                    <span
                      className="text-[10px] tabular-nums text-[var(--ink-dim)]"
                      style={{ fontFamily: MONO_FONT }}
                      title={ev.ts}
                    >
                      {shortTime(ev.ts)}
                    </span>
                    <EventChip event={ev.event} wave={ev.wave} />
                    <span
                      className="text-[13.5px] leading-[1.55] text-[var(--ink-2)]"
                      style={{ fontFamily: SANS_FONT }}
                    >
                      {ev.summary}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </LightScrollArea>
  )
}

function EventChip({ event, wave }: { event: string; wave: number | null }) {
  const norm = event.toLowerCase()
  const tone =
    /complete|completed|saturation|success|done/.test(norm)
      ? "border-[var(--lime-ink)]/40 text-[var(--lime-ink)]"
      : /fail|error|correction|veto|halt/.test(norm)
        ? "border-[var(--warning-ink)]/40 text-[var(--warning-ink)]"
        : /start|started|begin|opened/.test(norm)
          ? "border-[var(--ink-2)]/40 text-[var(--ink-2)]"
          : "border-[var(--rule)] text-[var(--ink-3)]"
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.1em]",
        tone,
      )}
      style={{ fontFamily: MONO_FONT }}
      title={wave !== null ? `Wave ${wave} · ${event}` : event}
    >
      {wave !== null ? `W${wave}` : event.slice(0, 8)}
    </span>
  )
}

function shortTime(iso: string): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(11, 16)
    return d.toTimeString().slice(0, 5)
  } catch {
    return iso.slice(11, 16) || "—"
  }
}

function humanizeDelta(from: string, to: string): string {
  try {
    const a = new Date(from).getTime()
    const b = new Date(to).getTime()
    if (Number.isNaN(a) || Number.isNaN(b)) return ""
    const diffMs = Math.abs(b - a)
    const min = Math.round(diffMs / 60000)
    if (min < 60) return `${min} min`
    const hrs = Math.floor(min / 60)
    const rem = min % 60
    return rem ? `${hrs}h${String(rem).padStart(2, "0")}` : `${hrs}h`
  } catch {
    return ""
  }
}
