import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { DISPLAY_FONT, MONO_FONT, SERIF_FONT } from "../foundations/theme"

/* Molecule — Cell Drawer fixed at the right edge of the Matrix viewport.
 * Persists context across scroll, unlike the previous inline CellIntelligence.
 * - Empty state shows guidance when nothing is selected.
 * - Populated state mirrors fields from the previous inline panel + adds source/rank/gap meta. */
export type CellDrawerData = {
  player: string
  playerColor?: string
  dimensionId: string
  dimensionLabel: string
  dimensionWeight: number
  confidence: string
  score: number
  notes?: string
  source?: string
  scoreBreakdown?: Record<string, number> | null
  scoreReason?: string
  rowGap: number
  rank: string
}

export function CellDrawer({
  selection,
  onDismiss,
}: {
  selection: CellDrawerData | null
  onDismiss: () => void
}) {
  if (!selection) {
    return null
  }

  return (
    <aside
      className="sticky top-0 hidden h-full min-h-0 w-[300px] shrink-0 overflow-y-auto border-l border-[var(--rule)] bg-[var(--paper)] xl:block"
      role="complementary"
      aria-label="Cell drawer"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--rule)] bg-[var(--paper)] px-4 py-3">
        <span
          className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]"
          style={{ fontFamily: MONO_FONT }}
        >
          Cell intelligence
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="grid h-7 w-7 place-items-center border border-[var(--rule)] text-[var(--ink-3)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
          title="Dismiss"
        >
          <X size={13} strokeWidth={1.75} />
        </button>
      </header>

      <div className="px-4 py-5">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3"
            style={{ background: selection.playerColor || "var(--ink-dim)" }}
          />
          <span
            className="text-[22px] font-black tracking-[-0.04em] text-[var(--ink)]"
            style={{ fontFamily: DISPLAY_FONT }}
          >
            {selection.player}
          </span>
        </div>

        <div
          className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
          style={{ fontFamily: MONO_FONT }}
        >
          {selection.dimensionId} · weight {Math.round(selection.dimensionWeight * 100)} · {selection.confidence || "no"} confidence
        </div>

        <div
          className="mt-4 text-[56px] font-black leading-none tracking-[-0.06em] text-[var(--ink)]"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          {selection.score}
        </div>

        <h3
          className={cn(
            "mt-5 text-[18px] font-black leading-[1.2] tracking-[-0.025em] text-[var(--ink)]",
          )}
          style={{ fontFamily: DISPLAY_FONT }}
        >
          {selection.dimensionLabel}
        </h3>

        {selection.notes && (
          <p
            className="mt-3 text-[13px] italic leading-[1.55] text-[var(--ink-2)]"
            style={{ fontFamily: SERIF_FONT }}
          >
            {selection.notes}
          </p>
        )}

        {selection.scoreReason && (
          <div className="mt-4 border border-[var(--rule)] bg-[var(--paper-alt)] px-3 py-3">
            <div
              className="text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
              style={{ fontFamily: MONO_FONT }}
            >
              por que esta nota
            </div>
            <p className="mt-1 text-[12px] leading-[1.5] text-[var(--ink-2)]">
              {selection.scoreReason}
            </p>
          </div>
        )}

        {selection.scoreBreakdown && (
          <div className="mt-4 grid gap-px border border-[var(--rule)] bg-[var(--rule)]">
            {[
              ["cobertura", selection.scoreBreakdown.coverage],
              ["profundidade", selection.scoreBreakdown.depth],
              ["fidelidade", selection.scoreBreakdown.fidelity],
              ["evidência", selection.scoreBreakdown.evidence],
              ["absorção", selection.scoreBreakdown.absorption],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] bg-[var(--paper-alt)] px-3 py-2">
                <span
                  className="text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {label}
                </span>
                <strong className="text-[12px] text-[var(--ink)]">{Number(value ?? 0)}/20</strong>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid gap-px border border-[var(--rule)] bg-[var(--rule)]">
          {[
            ["source", selection.source || "not mapped"],
            ["row gap", selection.rowGap.toFixed(0)],
            ["rank", selection.rank],
          ].map(([label, value]) => (
            <div key={label} className="bg-[var(--paper-alt)] px-3 py-2">
              <div
                className="text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                style={{ fontFamily: MONO_FONT }}
              >
                {label}
              </div>
              <div className="mt-0.5 break-words text-[12px] font-bold text-[var(--ink)]">
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
