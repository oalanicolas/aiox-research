"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { Check, Link2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ObservatoryMatrix,
  ObservatoryMatrixRow,
  ObservatoryPersona,
  ObservatoryPlayerProfile,
} from "../foundations/types"
import { CellDrawer, type CellDrawerData } from "../molecules/cell-drawer"
import { LightScrollArea } from "../molecules/light-scroll-area"
import { DISPLAY_FONT, MONO_FONT, SERIF_FONT } from "../foundations/theme"
import { rankPlayers, useDecisionState } from "../foundations/use-decision-state"

const COMPARE_PALETTE = ["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ec4899", "#94a3b8"]
const SCORE_STRONG_THRESHOLD = 75
const SCORE_PARTIAL_THRESHOLD = 45

function scoreGap(row: ObservatoryMatrixRow): number {
  if (row.cells.length < 2) return 0
  const scores = row.cells.map((c) => c.score)
  return Math.max(...scores) - Math.min(...scores)
}

function formatWeight(weight: number): string {
  if (!Number.isFinite(weight)) return "0"
  return String(Math.round(weight > 1 ? weight : weight * 100))
}

function formatMatrixScore(value: number): string {
  if (!Number.isFinite(value)) return "—"
  if (Math.abs(value) >= 100) return String(Math.round(value))
  if (Math.abs(value) >= 10) return value.toFixed(1).replace(/\.0$/, "")
  return value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")
}

function matrixRowKey(row: ObservatoryMatrixRow, index: number): string {
  return `${row.id || "row"}::${index}`
}

function compactPlayerName(name: string): string {
  const normalized = name.trim()
  const aliases: Record<string, string> = {
    "AIOX Research": "AIOX",
    "AutoResearchClaw": "ARC",
    "GPT-Researcher": "GPT-R",
    "Local Deep Research": "LDR",
    "MiroThinker": "MThink",
    "DeepSearcher": "DSearch",
    "LangChain Open Deep Research": "LC-ODR",
    "Deep Research Bench": "DRB",
    "Jina node-DeepResearch": "Jina",
    "DeepResearcher": "DeepR",
    "LiveDRBench": "LiveDR",
    "Alibaba/Tongyi DeepResearch": "Tongyi",
    "Agent Browser Workspace": "ABW",
    "dzhng/deep-research": "dzhng",
    "nickscamara/open-deep-research": "nick",
    "JigsawStack Deep Research": "JStack",
    "HKUDS Auto-Deep-Research": "HKUDS",
  }
  if (aliases[normalized]) return aliases[normalized]
  if (normalized.length <= 8) return normalized
  return normalized
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 8)
    .toUpperCase()
}

function matrixCategory(row: ObservatoryMatrixRow): { id: string; label: string } {
  if (row.group) {
    const id = row.group
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
    return { id, label: row.group }
  }
  const text = `${row.id} ${row.label} ${row.short ?? ""}`.toLowerCase()
  if (/feature|ux|design|layout|visual|edit|output|export/.test(text)) return { id: "C01", label: "Produto" }
  if (/price|pricing|market|fit|growth|commercial|custo|valor/.test(text)) return { id: "C02", label: "Mercado" }
  if (/integration|support|api|desktop|workflow|ops|plataform|platform/.test(text)) return { id: "C03", label: "Operação" }
  return { id: "C04", label: "Critérios" }
}

function matrixCellIndicator(score: number | null, isWinner: boolean): { mark: string; tone: "yes" | "part" | "no"; label: string } {
  if (score === null || !Number.isFinite(score) || score <= 0) return { mark: "×", tone: "no", label: "ausente" }
  if (isWinner || score >= SCORE_STRONG_THRESHOLD) return { mark: "✓", tone: "yes", label: "forte" }
  if (score >= SCORE_PARTIAL_THRESHOLD) return { mark: "◐", tone: "part", label: "parcial" }
  return { mark: "×", tone: "no", label: "fraco" }
}

function scoringGuideText(guide: Record<string, unknown> | null | undefined, key: string, fallback: string): string {
  const value = guide?.[key]
  return typeof value === "string" && value.trim() ? value : fallback
}

function scoringGuideList(guide: Record<string, unknown> | null | undefined, key: string): Array<Record<string, unknown>> {
  const value = guide?.[key]
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : []
}

/* Organism — Matrix view with narrative header, sticky-first-col,
 * row-winner highlight (lime), cell intelligence panel,
 * and categorical bottom strip (top-5 dimensions with biggest score gap).
 *
 * Decision-in-one-click contract (DOCTRINE-decision-in-one-click.md):
 *   - Player visibility lives in URL via useDecisionState (anchor never hidden).
 *   - Header banner shows preset active + permalink button.
 *   - Totals shown reflect the current weight overrides (matches /weights leaderboard).
 *   - Persona switching from /weights is reflected here without a refresh.
 */
export function MatrixView({
  matrix,
  playerProfiles,
  personas = [],
}: {
  matrix: ObservatoryMatrix
  playerProfiles: ObservatoryPlayerProfile[]
  personas?: ObservatoryPersona[]
}) {
  const players = matrix.players
  const decision = useDecisionState(matrix, personas, { maxVisiblePlayers: 20 })
  const { weights, visiblePlayers, personaActive, hasOverrides, togglePlayer, resetAll, permalink } = decision

  const [selected, setSelected] = useState<{ rowKey: string; player: string } | null>(null)
  const [copied, setCopied] = useState<"link" | null>(null)

  function copyPermalink() {
    if (typeof navigator === "undefined") return
    void navigator.clipboard?.writeText(permalink())
    setCopied("link")
    window.setTimeout(() => setCopied(null), 1500)
  }

  const profileByKey = useMemo(() => {
    const map = new Map<string, ObservatoryPlayerProfile>()
    for (const p of playerProfiles) map.set(p.key, p)
    return map
  }, [playerProfiles])

  /* Totals are now LIVE — they reflect the user's weight overrides (if any) and
     the visible-players subset. This makes the matrix leaderboard agree with the
     /weights view leaderboard. Falls back to matrix.totals when no overrides. */
  const totalsLive = useMemo(
    () => rankPlayers(matrix, weights, visiblePlayers),
    [matrix, weights, visiblePlayers],
  )

  /* Column order keeps the internal reference first, then ranks the remaining
     visible players by the current weighted score. */
  const visiblePlayersList = useMemo(
    () => {
      const anchor = players.find((player) => player === "aiox_research") ?? players[0]
      const ranked = totalsLive.map((entry) => entry.player)
      if (!visiblePlayers.has(anchor)) return ranked
      return [anchor, ...ranked.filter((player) => player !== anchor)]
    },
    [players, totalsLive, visiblePlayers],
  )

  const groupedRows = useMemo(() => {
    const groups: Array<{ id: string; label: string; rows: Array<{ row: ObservatoryMatrixRow; rowIndex: number }> }> = []
    for (const [rowIndex, row] of matrix.rows.entries()) {
      const category = matrixCategory(row)
      let group = groups.find((item) => item.id === category.id)
      if (!group) {
        group = { ...category, rows: [] }
        groups.push(group)
      }
      group.rows.push({ row, rowIndex })
    }
    return groups
  }, [matrix.rows])

  const leader = totalsLive[0]
  const runner = totalsLive[1]
  const leaderGap = leader && runner ? leader.score - runner.score : 0
  const technicalTie = leader && runner ? Math.abs(leaderGap) < 1 : false
  const weightSum = matrix.rows.reduce((sum, row) => sum + (Number.isFinite(row.weight) ? row.weight : 0), 0)
  const cellCount = matrix.rows.reduce((sum, row) => sum + row.cells.filter((cell) => visiblePlayers.has(cell.player)).length, 0)
  const confidenceCounts = matrix.rows.reduce(
    (acc, row) => {
      for (const cell of row.cells.filter((item) => visiblePlayers.has(item.player))) {
        const key = cell.confidence?.toLowerCase()
        if (key === "high") acc.high += 1
        else if (key === "medium") acc.medium += 1
        else if (key === "low") acc.low += 1
      }
      return acc
    },
    { high: 0, medium: 0, low: 0 },
  )

  const isCompactMatrix = false
  const dimensionColumnWidth = 320
  const playerColumnWidth = 140
  const winnerColumnWidth = 100

  const matrixGridStyle = {
    gridTemplateColumns: `${dimensionColumnWidth}px repeat(${visiblePlayersList.length}, ${playerColumnWidth}px) ${winnerColumnWidth}px`,
    minWidth: `${dimensionColumnWidth + visiblePlayersList.length * playerColumnWidth + winnerColumnWidth}px`,
  } as const
  const matrixWrapStyle = {
    minWidth: matrixGridStyle.minWidth,
  } as const

  const colorOf = (_key: string, idx: number) => COMPARE_PALETTE[idx % COMPARE_PALETTE.length]

  const displayName = (key: string) => profileByKey.get(key)?.name ?? key

  function clearSelectionIfHidden(playerKey: string) {
    if (selected?.player === playerKey) setSelected(null)
  }

  function onTogglePlayer(playerKey: string) {
    togglePlayer(playerKey)
    /* If user just hid the currently-selected player, dismiss its drawer.
       Anchor is protected by the hook itself (togglePlayer no-ops). */
    if (visiblePlayers.has(playerKey)) clearSelectionIfHidden(playerKey)
  }

  /* Build CellDrawer data lazily from current selection. */
  const drawerData: CellDrawerData | null = (() => {
    if (!selected) return null
    const row = matrix.rows.find((r, index) => matrixRowKey(r, index) === selected.rowKey)
    const cell = row?.cells.find((c) => c.player === selected.player)
    if (!row || !cell) return null
    const visibleCells = row.cells.filter((c) => visiblePlayers.has(c.player))
    const sorted = [...visibleCells].sort((a, b) => b.score - a.score)
    const rankIndex = sorted.findIndex((c) => c.player === selected.player)
    return {
      player: displayName(selected.player),
      playerColor: colorOf(selected.player, matrix.players.indexOf(selected.player)),
      dimensionId: row.id,
      dimensionLabel: row.label,
      dimensionWeight: row.weight,
      confidence: cell.confidence,
      score: cell.score,
      notes: cell.notes,
      source: cell.source,
      scoreBreakdown: cell.scoreBreakdown,
      scoreReason: cell.scoreReason,
      rowGap: scoreGap(row),
      rank: `${rankIndex + 1}/${visibleCells.length}`,
    }
  })()

  const presetLabel = personaActive
    ? `Preset: ${personaActive.label}${personaActive.sub ? ` · ${personaActive.sub}` : ""}`
    : hasOverrides
    ? "Pesos customizados"
    : "Baseline neutro"

  return (
    <div className="flex min-h-0 flex-1">
      <LightScrollArea className="min-w-0 flex-1" viewportClassName="px-3 pb-12 pt-4 sm:px-5 sm:pb-14 sm:pt-5 lg:px-6 lg:pb-16">
        <div className="aiox-matrix-reader w-full min-w-0">
          <div className="border border-[var(--rule)] bg-[#0f0f11]">
            <div className="grid gap-px bg-[var(--rule)] lg:grid-cols-[minmax(0,1fr)_420px]">
              <section className="bg-[#050505] p-5 sm:p-7">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                  matriz · heatmap · {presetLabel}
                </div>
                <h1 className="mt-3 text-[clamp(34px,5vw,72px)] font-black leading-[0.92] tracking-[-0.07em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {technicalTie ? "Empate técnico" : "Mapa de decisão"}
                </h1>
                <p className="mt-4 max-w-[920px] text-[17px] leading-[1.55] text-[var(--ink-2)]">
                  A matriz mostra onde cada player deixa de ser intercambiável. Olhe primeiro para células em lime: elas são os vencedores por dimensão.
                </p>
                {hasOverrides && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={copyPermalink}
                      className="inline-flex items-center gap-1.5 border border-[var(--rule)] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-2)] transition-colors hover:bg-[var(--paper-alt)] hover:text-[var(--ink)]"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      {copied === "link" ? <Check size={11} /> : <Link2 size={11} />}
                      {copied === "link" ? "Copiado" : "Permalink"}
                    </button>
                    <button
                      type="button"
                      onClick={resetAll}
                      className="inline-flex items-center gap-1.5 border border-[var(--rule)] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      <RotateCcw size={11} />
                      Reset
                    </button>
                  </div>
                )}
              </section>
              <aside className="grid bg-[#0f0f11] text-[10px] uppercase tracking-[0.13em] text-[var(--ink-3)] sm:grid-cols-2 lg:grid-cols-1" style={{ fontFamily: MONO_FONT }}>
                {/* Header KPIs — método omitido: já documentado em
                   "Como esta matriz é medida" no fim da view, com escala,
                   fórmula, weight policy e bandas. Repetir aqui só polui. */}
                {[
                  ["players", `${visiblePlayersList.length}/${players.length}`],
                  ["dimensões", String(matrix.rows.length)],
                  ["líder", leader ? displayName(leader.player) : "—"],
                  ["gap", leaderGap.toFixed(2)],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[1fr_auto] border-b border-[var(--rule)] px-5 py-4 last:border-b-0">
                    <span>{label}</span>
                    <strong className="ml-4 text-right text-[var(--ink)]">{value}</strong>
                  </div>
                ))}
              </aside>
            </div>
          </div>

          <section className="mt-5 border border-[var(--rule)] bg-[#0f0f11]">
            <div className="grid gap-3 border-b border-[var(--rule)] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                  players visíveis · URL persistida
                </div>
                <div className="mt-1 text-[12px] leading-[1.4] text-[var(--ink-3)]">
                  Mini-bar mostra score. Bulk-select abaixo. Anchor sempre visível.
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                {visiblePlayersList.length}/{players.length} ativos
              </div>
            </div>
            {/* Bulk-select buttons */}
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--rule-soft)] px-4 py-2.5">
              {[
                {
                  label: "Top 10 by score",
                  apply: () => {
                    const sortedByScore = [...totalsLive].sort((a, b) => b.score - a.score).slice(0, 10).map((t) => t.player)
                    decision.setVisiblePlayers(sortedByScore)
                  },
                },
                {
                  label: "Anchor + top 5",
                  apply: () => {
                    const top5 = [...totalsLive]
                      .filter((t) => t.player !== "aiox_research")
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 5)
                      .map((t) => t.player)
                    decision.setVisiblePlayers(["aiox_research", ...top5])
                  },
                },
                {
                  label: "OSS apenas",
                  apply: () => {
                    const oss = players.filter((p) => {
                      const profile = profileByKey.get(p)
                      return p !== "aiox_research" && (!profile?.license || /MIT|Apache|GPL|BSD|MPL|open|oss/i.test(profile.license))
                    })
                    decision.setVisiblePlayers(oss.length > 0 ? oss : players)
                  },
                },
                {
                  label: "Top 20",
                  apply: () => decision.setVisiblePlayers(totalsLive.slice(0, 20).map((t) => t.player)),
                },
              ].map((bulk) => (
                <button
                  key={bulk.label}
                  type="button"
                  onClick={bulk.apply}
                  className="inline-flex h-7 items-center gap-1.5 border border-[var(--rule)] bg-transparent px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-2)] transition-colors hover:border-[var(--lime-ink)] hover:bg-[#050505] hover:text-[var(--lime-ink)]"
                  style={{ fontFamily: MONO_FONT }}
                  title={bulk.label}
                >
                  {bulk.label}
                </button>
              ))}
            </div>
            {/* Player chips — flex-wrap com flex-grow:1.
               Estratégia: cada chip tem flex-basis [200px,1fr] (min ideal
               200px, mas estica para preencher o espaço restante da linha).
               Resultado: zero buracos no fim das linhas, todos visíveis sem
               scroll, layout adaptativo a qualquer largura de viewport.
               Sem max-height — todos os 20+ chips ficam na tela. */}
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {visiblePlayersList.map((player) => {
                const idx = players.indexOf(player)
                const active = visiblePlayers.has(player)
                const isAnchor = player === "aiox_research"
                const totalEntry = totalsLive.find((t) => t.player === player)
                const playerScore = totalEntry?.score ?? 0
                const playerRank = totalEntry?.rank ?? 0
                const scorePct = Math.max(2, Math.min(100, playerScore))
                /* Group tier by rank: tier-1 (top 33%), tier-2 (mid), tier-3 (rest) */
                const tier = playerRank <= Math.ceil(players.length / 3) ? 1 : playerRank <= Math.ceil((players.length * 2) / 3) ? 2 : 3
                const tierBorderColor = tier === 1 ? "border-[var(--lime-ink)]/35" : tier === 2 ? "border-[var(--rule)]" : "border-[var(--rule-soft)]"
                const profile = profileByKey.get(player)
                return (
                  <button
                    key={player}
                    type="button"
                    onClick={() => onTogglePlayer(player)}
                    disabled={isAnchor}
                    className={cn(
                      "group relative grid min-h-[40px] min-w-0 gap-1 border px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] transition-all",
                      isAnchor
                        ? "cursor-not-allowed border-[var(--lime-ink)] bg-[#050505] text-[var(--lime-ink)] shadow-[inset_0_-1px_0_var(--lime-ink)]"
                        : active
                        ? `${tierBorderColor} bg-[#050505] text-[var(--ink)] hover:border-[var(--lime-ink)]`
                        : "border-dashed border-[var(--rule-soft)] bg-transparent text-[var(--ink-dim)] opacity-55 hover:opacity-90",
                    )}
                    style={{
                      fontFamily: MONO_FONT,
                      /* flex basis 200px ideal, grow 1 estica até preencher
                         a linha (zero buracos), shrink 0 evita squash. */
                      flex: "1 1 200px",
                    }}
                    title={
                      isAnchor
                        ? `${displayName(player)} (anchor — sempre visível) · score ${playerScore.toFixed(1)} · rank ${playerRank}/${players.length}`
                        : active
                        ? `Ocultar ${displayName(player)} · score ${playerScore.toFixed(1)} · rank ${playerRank}/${players.length}`
                        : `Mostrar ${displayName(player)} · score ${playerScore.toFixed(1)} · rank ${playerRank}/${players.length}`
                    }
                  >
                    <div className="grid grid-cols-[8px_minmax(0,1fr)_28px] items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0" style={{ background: colorOf(player, idx) }} />
                      <span className="truncate text-left">{displayName(player)}</span>
                      <span
                        className="text-right text-[9px] tabular-nums text-[var(--ink-dim)]"
                        style={{ fontFamily: MONO_FONT }}
                      >
                        #{playerRank}
                      </span>
                    </div>
                    {/* Mini-bar score */}
                    <div className="relative h-1 bg-[var(--paper-deep)]">
                      <div
                        className={cn(
                          "absolute left-0 top-0 h-full",
                          isAnchor
                            ? "bg-[var(--lime-ink)]"
                            : tier === 1
                            ? "bg-[var(--lime-ink)]/70"
                            : tier === 2
                            ? "bg-[var(--ink-2)]"
                            : "bg-[var(--ink-dim)]",
                        )}
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-1 text-[8.5px] tracking-[0.08em] text-[var(--ink-dim)]">
                      <span className="truncate">{profile?.license || "—"}</span>
                      <span className="tabular-nums text-[var(--ink-3)]">{playerScore.toFixed(1)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="aiox-matrix-scroll mt-5 min-w-0 overflow-x-auto">
            <div className={cn("aiox-duel-fmx-wrap aiox-map-matrix", isCompactMatrix && "is-compact")} style={matrixWrapStyle}>
              <div className="aiox-duel-fmx-head" style={matrixGridStyle}>
                <span className="cell">Dimensão</span>
                {visiblePlayersList.map((player) => (
                  <button
                    type="button"
                    key={player}
                    className="cell plyr"
                    title={`Ocultar ${displayName(player)}`}
                    onClick={() => onTogglePlayer(player)}
                  >
                    {(() => {
                      const idx = players.indexOf(player)
                      return (
                        <>
                          <span className={cn("dot", idx > 0 && "b")} style={{ background: colorOf(player, idx), boxShadow: idx === 0 ? undefined : "none" }} />
                          <span className="plyr-label">{isCompactMatrix ? compactPlayerName(displayName(player)) : displayName(player)}</span>
                        </>
                      )
                    })()}
                  </button>
                ))}
                <span className="cell win">Vence</span>
              </div>
              {groupedRows.map((group) => (
                <div key={group.id}>
                  <div className="aiox-duel-fmx-cat">
                    <span className="id">{group.id}</span>
                    {group.label}
                    <span className="count"><b>{group.rows.length}</b> dimensões</span>
                  </div>
                  {group.rows.map(({ row, rowIndex }) => {
                    const rowKey = matrixRowKey(row, rowIndex)
                    const visibleCells = row.cells.filter((cell) => visiblePlayers.has(cell.player))
                    if (visibleCells.length === 0) return null
                    const winnerCell = visibleCells.reduce(
                      (best, cell) => (cell.score > best.score ? cell : best),
                      visibleCells[0],
                    )
                    return (
                      <div key={rowKey} className="aiox-duel-fmx-row" style={matrixGridStyle}>
                        <div className="lab">
                          <span className="nm">{row.label}</span>
                          <span className="sub">{row.id} · peso {formatWeight(row.weight ?? 0)}</span>
                          {row.question && <span className="sub normal-case tracking-normal text-[var(--ink-3)]">{row.question}</span>}
                        </div>
                        {visiblePlayersList.map((player) => {
                          const idx = players.indexOf(player)
                          const cell = row.cells.find((item) => item.player === player)
                          const isWinner = cell?.player === winnerCell.player
                          const isSelected = selected?.rowKey === rowKey && selected?.player === player
                          const indicator = matrixCellIndicator(cell?.score ?? null, Boolean(isWinner))
                          return (
                            <button
                              type="button"
                              key={`${rowKey}::${player}`}
                              onClick={() => setSelected(isSelected ? null : { rowKey, player })}
                              className={cn("pcell", isWinner && "win", isSelected && "outline outline-2 outline-[#f5f4e7]")}
                              style={{ "--fmx-accent": colorOf(player, idx) } as CSSProperties}
                            >
                              <span className={cn("aiox-duel-fmx-mark", indicator.tone)}>{indicator.mark}</span>
                              <span className="val">{cell ? formatMatrixScore(cell.score) : "—"}</span>
                              <span className="state">{indicator.label}</span>
                            </button>
                          )
                        })}
                        {winnerCell && (
                          <div className="winner" style={{ "--fmx-accent": colorOf(winnerCell.player, players.indexOf(winnerCell.player)) } as CSSProperties}>
                            {displayName(winnerCell.player)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {matrix.method && (
            <p
              className="mt-6 text-[13px] italic leading-[1.55] text-[var(--ink-3)]"
              style={{ fontFamily: SERIF_FONT }}
            >
              Method · {matrix.method}
            </p>
          )}

          <section className="mt-6 border border-[var(--rule)] bg-[#0f0f11]">
            <div className="border-b border-[var(--rule)] px-5 py-4 sm:px-6">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                transparência da pontuação
              </div>
              <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                Como esta matriz é medida
              </h2>
            </div>
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Escala", scoringGuideText(matrix.scoringGuide, "scale", "0-100 por dimensão/microdimensão.")],
                ["Fórmula", scoringGuideText(matrix.scoringGuide, "formula", "score_total_player = soma(score_da_célula × peso) / soma(pesos).")],
                ["Pesos", scoringGuideText(matrix.scoringGuide, "weight_policy", "Pesos somam 100; dimensões mais críticas recebem maior peso.")],
                ["Interpretação", scoringGuideText(matrix.scoringGuide, "interpretation", "Ranking consolidado é mapa de absorção; use personas e segmentos para decisões justas.")],
              ].map(([title, body]) => (
                <div key={title} className="bg-[#050505] p-5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{title}</div>
                  <p className="mt-2 text-[13px] leading-[1.5] text-[var(--ink-2)]">{body}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-4">
              {[
                ["Players", String(players.length)],
                ["Dimensões", String(matrix.rows.length)],
                ["Células", String(cellCount)],
                ["Soma dos pesos", weightSum.toFixed(2)],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[1fr_auto] bg-[#050505] px-5 py-4 text-[10px] uppercase tracking-[0.13em]" style={{ fontFamily: MONO_FONT }}>
                  <span className="text-[var(--ink-3)]">{label}</span>
                  <strong className="text-[var(--ink)]">{value}</strong>
                </div>
              ))}
            </div>
            <div className="grid gap-px bg-[var(--rule)] lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="bg-[#050505] p-5 sm:p-6">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  bandas de score
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-5">
                  {[
                    ["0-20", "ausente ou intenção"],
                    ["21-49", "fraco/protótipo"],
                    ["50-69", "parcial útil"],
                    ["70-84", "forte com gaps"],
                    ["85-100", "referência de absorção"],
                  ].map(([range, label]) => (
                    <div key={range} className="border border-[var(--rule)] bg-[#0f0f11] p-3">
                      <div className="text-[18px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{range}</div>
                      <div className="mt-1 text-[11px] leading-tight text-[var(--ink-3)]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#050505] p-5 sm:p-6">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  confiança da evidência
                </div>
                <p className="mt-2 text-[13px] leading-[1.5] text-[var(--ink-2)]">
                  {scoringGuideText(matrix.scoringGuide, "evidence_policy", "High = código/docs/testes locais; medium = README/fluxo parcialmente verificado; low = inferência ou sinal indireto.")}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-px bg-[var(--rule)] text-[10px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO_FONT }}>
                  {[
                    ["High", confidenceCounts.high],
                    ["Medium", confidenceCounts.medium],
                    ["Low", confidenceCounts.low],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[#0f0f11] p-3">
                      <div className="text-[var(--ink-3)]">{label}</div>
                      <div className="mt-1 text-[18px] font-black text-[var(--ink)]">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-px bg-[var(--rule)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="bg-[#050505] p-5 sm:p-6">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  score da célula
                </div>
                <p className="mt-2 text-[13px] leading-[1.5] text-[var(--ink-2)]">
                  {scoringGuideText(matrix.scoringGuide, "cell_formula", "score_da_célula = cobertura + profundidade + fidelidade + evidência + absorvibilidade; cada lente vale 0-20.")}
                </p>
                <div className="mt-4 grid gap-px bg-[var(--rule)] sm:grid-cols-5">
                  {scoringGuideList(matrix.scoringGuide, "score_lenses").map((lens) => (
                    <div key={String(lens.id)} className="bg-[#0f0f11] p-3">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        {String(lens.points ?? "0-20")}
                      </div>
                      <div className="mt-1 text-[13px] font-bold leading-tight text-[var(--ink)]">
                        {String(lens.label ?? lens.id)}
                      </div>
                      <p className="mt-2 text-[11px] leading-[1.35] text-[var(--ink-3)]">
                        {String(lens.question ?? "")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#050505] p-5 sm:p-6">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  diferença dentro de 85-100
                </div>
                <div className="mt-4 grid gap-2">
                  {scoringGuideList(matrix.scoringGuide, "reference_band_detail").map((item) => (
                    <div key={String(item.range)} className="grid grid-cols-[76px_1fr] gap-3 border border-[var(--rule)] bg-[#0f0f11] p-3">
                      <div className="text-[18px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                        {String(item.range)}
                      </div>
                      <div className="text-[12px] leading-[1.45] text-[var(--ink-2)]">
                        {String(item.meaning)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </LightScrollArea>
      <CellDrawer selection={drawerData} onDismiss={() => setSelected(null)} />
    </div>
  )
}
