"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import type { ObservatoryMatrix, ObservatoryPersona } from "./types"

/* Hook — single source of truth for the decisional state of a bench view.
 *
 * Three URL-persisted dimensions, all optional and additive:
 *   ?persona=<id>    : snap-to-persona preset (lowest priority)
 *   ?w_<rowId>=<int> : per-dimension weight override (highest priority; per slider)
 *   ?players=k1,k2   : visible players subset (anchor never hidden)
 *
 * Returned `weights` is keyed by `row.id`. The integer scale is 0–100,
 * matching what WeightSlider already emits. Baseline weights come from
 * the matrix itself (`row.weight × 100`, rounded).
 *
 * Resolution order, per row:
 *   1. ?w_<rowId>=N   (user explicitly moved that slider)
 *   2. persona.weights[i] if ?persona=ID matches and persona has weights
 *   3. baseline (row.weight × 100)
 *
 * Setting a slider via setWeight(rowId, N):
 *   - writes ?w_<rowId>=N
 *   - leaves ?persona=ID alone (so the user can layer)
 *
 * Setting a persona via setPersona(id):
 *   - writes ?persona=ID
 *   - clears every ?w_* override (start fresh from preset baseline)
 *
 * resetAll() removes ?w_*, ?persona, ?players. Keeps view/sort/etc.
 */

export type DecisionState = {
  weights: Record<string, number>
  baselineWeights: Record<string, number>
  personaActive: ObservatoryPersona | null
  /* Visible-players set. anchor (if known) is always included. */
  visiblePlayers: Set<string>
  hasOverrides: boolean
  /* Active compare-pair (?compare=a,b) — duel-view consumer. null when unset. */
  comparePair: [string, string] | null
  setWeight: (rowId: string, value: number) => void
  setPersona: (id: string | null) => void
  togglePlayer: (key: string) => void
  setVisiblePlayers: (keys: string[]) => void
  setComparePair: (a: string | null, b: string | null) => void
  resetAll: () => void
  permalink: () => string
}

const WEIGHT_PARAM_PREFIX = "w_"
const PERSONA_PARAM = "persona"
const PLAYERS_PARAM = "players"
const COMPARE_PARAM = "compare"
const ANCHOR_DEFAULT = "aiox_research"

/* Cap default da matriz: 20 players por motivo de leitura visual.
   Mesmo benches com >20 (atual: 25) mostram só top-20 por score baseline +
   anchor garantido. User pode desbloquear via bulk-select "Mostrar todos"
   (que escreve ?players= explícito = bypass do cap). */
const DEFAULT_VISIBLE_CAP = 20

function clampWeight(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return Math.round(n)
}

function baselineFromMatrix(matrix: ObservatoryMatrix): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of matrix.rows) {
    const raw = Number(row.weight) || 0
    /* row.weight in the dash is fractional (e.g., 0.0769). Multiply by 100 once.
       Values already >= 1 are treated as percent-of-total integers. */
    out[row.id] = clampWeight(raw <= 1 ? raw * 100 : raw)
  }
  return out
}

function personaWeightsByRowId(
  matrix: ObservatoryMatrix,
  persona: ObservatoryPersona | null,
): Record<string, number> | null {
  if (!persona || !persona.weights || persona.weights.length === 0) return null
  const out: Record<string, number> = {}
  for (let i = 0; i < matrix.rows.length; i += 1) {
    const row = matrix.rows[i]
    const raw = Number(persona.weights[i] ?? 0)
    out[row.id] = clampWeight(raw <= 1 ? raw * 100 : raw)
  }
  return out
}

export function useDecisionState(
  matrix: ObservatoryMatrix,
  personas: ObservatoryPersona[],
  options?: { anchorKey?: string },
): DecisionState {
  const router = useRouter()
  const searchParams = useSearchParams()
  const anchorKey = options?.anchorKey ?? ANCHOR_DEFAULT

  const baselineWeights = useMemo(() => baselineFromMatrix(matrix), [matrix])

  const personaId = searchParams?.get(PERSONA_PARAM) ?? null
  const personaActive = useMemo(
    () => (personaId ? personas.find((p) => p.id === personaId) ?? null : null),
    [personaId, personas],
  )

  const personaWeights = useMemo(
    () => personaWeightsByRowId(matrix, personaActive),
    [matrix, personaActive],
  )

  const weights = useMemo(() => {
    const out: Record<string, number> = {}
    for (const row of matrix.rows) {
      const override = searchParams?.get(`${WEIGHT_PARAM_PREFIX}${row.id}`)
      if (override !== null && override !== undefined) {
        const parsed = Number(override)
        if (Number.isFinite(parsed)) {
          out[row.id] = clampWeight(parsed)
          continue
        }
      }
      if (personaWeights && personaWeights[row.id] !== undefined) {
        out[row.id] = personaWeights[row.id]
        continue
      }
      out[row.id] = baselineWeights[row.id] ?? 0
    }
    return out
  }, [matrix, searchParams, personaWeights, baselineWeights])

  const visiblePlayers = useMemo(() => {
    const raw = searchParams?.get(PLAYERS_PARAM)
    if (raw) {
      const requested = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((key) => matrix.players.includes(key))
      const set = new Set<string>(requested)
      if (matrix.players.includes(anchorKey)) set.add(anchorKey)
      return set.size > 0 ? set : new Set(matrix.players)
    }
    /* No explicit ?players= → apply DEFAULT_VISIBLE_CAP (20).
       Strategy: take top-N by matrix.totals baseline score, anchor always in.
       When players.length <= cap, show all (no truncation). */
    if (matrix.players.length <= DEFAULT_VISIBLE_CAP) {
      return new Set(matrix.players)
    }
    const totalsRanked = [...matrix.totals]
      .sort((a, b) => b.score - a.score)
      .map((t) => t.player)
    const top = totalsRanked.slice(0, DEFAULT_VISIBLE_CAP)
    const set = new Set<string>(top)
    if (matrix.players.includes(anchorKey)) {
      set.add(anchorKey)
      /* Adding anchor may overflow cap; trim the lowest-ranked non-anchor */
      if (set.size > DEFAULT_VISIBLE_CAP) {
        const trimCandidate = [...totalsRanked].reverse().find((p) => p !== anchorKey && set.has(p))
        if (trimCandidate) set.delete(trimCandidate)
      }
    }
    return set
  }, [searchParams, matrix.players, matrix.totals, anchorKey])

  const hasOverrides = useMemo(() => {
    if (!searchParams) return false
    for (const [key] of searchParams.entries()) {
      if (key.startsWith(WEIGHT_PARAM_PREFIX)) return true
      if (key === PERSONA_PARAM) return true
      if (key === PLAYERS_PARAM) return true
      if (key === COMPARE_PARAM) return true
    }
    return false
  }, [searchParams])

  const comparePair = useMemo<[string, string] | null>(() => {
    const raw = searchParams?.get(COMPARE_PARAM)
    if (!raw) return null
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean)
    if (parts.length !== 2) return null
    const [a, b] = parts
    if (!matrix.players.includes(a) || !matrix.players.includes(b)) return null
    if (a === b) return null
    return [a, b]
  }, [searchParams, matrix.players])

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      mutate(params)
      const qs = params.toString()
      const href = qs ? `?${qs}` : window.location.pathname
      router.replace(href, { scroll: false })
    },
    [router, searchParams],
  )

  const setWeight = useCallback(
    (rowId: string, value: number) => {
      pushParams((params) => {
        const baseline = baselineWeights[rowId] ?? 0
        const target = clampWeight(value)
        /* If user lands back on baseline AND no persona-driven value differs,
           drop the override to keep URL short. */
        const personaTarget = personaWeights?.[rowId]
        const equivalent = target === (personaTarget ?? baseline)
        if (equivalent) params.delete(`${WEIGHT_PARAM_PREFIX}${rowId}`)
        else params.set(`${WEIGHT_PARAM_PREFIX}${rowId}`, String(target))
      })
    },
    [baselineWeights, personaWeights, pushParams],
  )

  const setPersona = useCallback(
    (id: string | null) => {
      pushParams((params) => {
        /* Clear all weight overrides — persona starts a fresh layer. */
        const keys: string[] = []
        for (const [key] of params.entries()) {
          if (key.startsWith(WEIGHT_PARAM_PREFIX)) keys.push(key)
        }
        for (const key of keys) params.delete(key)
        if (id) params.set(PERSONA_PARAM, id)
        else params.delete(PERSONA_PARAM)
      })
    },
    [pushParams],
  )

  const togglePlayer = useCallback(
    (key: string) => {
      if (key === anchorKey) return
      pushParams((params) => {
        const current = new Set(visiblePlayers)
        if (current.has(key)) {
          if (current.size <= 2) return /* always keep at least anchor + one rival */
          current.delete(key)
        } else {
          current.add(key)
        }
        const list = matrix.players.filter((k) => current.has(k))
        if (list.length === matrix.players.length) params.delete(PLAYERS_PARAM)
        else params.set(PLAYERS_PARAM, list.join(","))
      })
    },
    [anchorKey, matrix.players, pushParams, visiblePlayers],
  )

  const setVisiblePlayers = useCallback(
    (keys: string[]) => {
      pushParams((params) => {
        const set = new Set(keys.filter((k) => matrix.players.includes(k)))
        if (matrix.players.includes(anchorKey)) set.add(anchorKey)
        const list = matrix.players.filter((k) => set.has(k))
        if (list.length === 0 || list.length === matrix.players.length) {
          params.delete(PLAYERS_PARAM)
        } else {
          params.set(PLAYERS_PARAM, list.join(","))
        }
      })
    },
    [anchorKey, matrix.players, pushParams],
  )

  const setComparePair = useCallback(
    (a: string | null, b: string | null) => {
      pushParams((params) => {
        if (!a || !b || a === b) {
          params.delete(COMPARE_PARAM)
          return
        }
        if (!matrix.players.includes(a) || !matrix.players.includes(b)) {
          params.delete(COMPARE_PARAM)
          return
        }
        params.set(COMPARE_PARAM, `${a},${b}`)
      })
    },
    [matrix.players, pushParams],
  )

  const resetAll = useCallback(() => {
    pushParams((params) => {
      const remove: string[] = []
      for (const [key] of params.entries()) {
        if (key.startsWith(WEIGHT_PARAM_PREFIX)) remove.push(key)
        if (key === PERSONA_PARAM) remove.push(key)
        if (key === PLAYERS_PARAM) remove.push(key)
        if (key === COMPARE_PARAM) remove.push(key)
      }
      for (const key of remove) params.delete(key)
    })
  }, [pushParams])

  const permalink = useCallback(() => {
    if (typeof window === "undefined") return ""
    return window.location.href
  }, [])

  return {
    weights,
    baselineWeights,
    personaActive,
    visiblePlayers,
    hasOverrides,
    comparePair,
    setWeight,
    setPersona,
    togglePlayer,
    setVisiblePlayers,
    setComparePair,
    resetAll,
    permalink,
  }
}

/* Pure helper — recomputes a player's weighted score under a given weight map.
 * Mirrors the existing weightedScore in weights-view.tsx but exported so every
 * organism (matrix totals, personas, decision) can converge on the same math. */
export function weightedScore(
  matrix: ObservatoryMatrix,
  player: string,
  weights: Record<string, number>,
): number {
  let sum = 0
  let total = 0
  for (const row of matrix.rows) {
    const weight = weights[row.id] ?? 0
    const cell = row.cells.find((c) => c.player === player)
    if (!cell || weight <= 0) continue
    sum += cell.score * weight
    total += weight
  }
  return total > 0 ? sum / total : 0
}

/* Pure helper — ranks all players under the supplied weights.
 * Returns scores sorted desc. Players hidden via `visiblePlayers` are omitted. */
export function rankPlayers(
  matrix: ObservatoryMatrix,
  weights: Record<string, number>,
  visiblePlayers?: Set<string>,
): Array<{ player: string; score: number; rank: number }> {
  const eligible = visiblePlayers
    ? matrix.players.filter((p) => visiblePlayers.has(p))
    : matrix.players
  const scored = eligible
    .map((player) => ({ player, score: weightedScore(matrix, player, weights) }))
    .sort((a, b) => b.score - a.score)
  return scored.map((entry, i) => ({ ...entry, rank: i + 1 }))
}
