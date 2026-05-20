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
  options?: { anchorKey?: string; maxVisiblePlayers?: number },
): DecisionState {
  const router = useRouter()
  const searchParams = useSearchParams()
  const anchorKey = options?.anchorKey ?? ANCHOR_DEFAULT
  const maxVisiblePlayers = options?.maxVisiblePlayers

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

  const baselineRankedPlayers = useMemo(() => {
    const ranked = [...matrix.totals]
      .sort((a, b) => b.score - a.score)
      .map((t) => t.player)
      .filter((key) => matrix.players.includes(key))
    return [...ranked, ...matrix.players.filter((key) => !ranked.includes(key))]
  }, [matrix.players, matrix.totals])

  const capVisibleSet = useCallback(
    (input: Set<string>) => {
      if (!maxVisiblePlayers || input.size <= maxVisiblePlayers) return input
      const capped = new Set<string>()
      if (matrix.players.includes(anchorKey) && input.has(anchorKey)) capped.add(anchorKey)
      for (const player of baselineRankedPlayers) {
        if (capped.size >= maxVisiblePlayers) break
        if (input.has(player)) capped.add(player)
      }
      return capped.size > 0 ? capped : new Set(baselineRankedPlayers.slice(0, maxVisiblePlayers))
    },
    [anchorKey, baselineRankedPlayers, matrix.players, maxVisiblePlayers],
  )

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
      return set.size > 0 ? capVisibleSet(set) : capVisibleSet(new Set(matrix.players))
    }
    return capVisibleSet(new Set(matrix.players))
  }, [searchParams, matrix.players, anchorKey, baselineRankedPlayers, capVisibleSet])

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
        const capped = capVisibleSet(current)
        const list = matrix.players.filter((k) => capped.has(k))
        if (list.length === matrix.players.length) params.delete(PLAYERS_PARAM)
        else params.set(PLAYERS_PARAM, list.join(","))
      })
    },
    [anchorKey, capVisibleSet, matrix.players, pushParams, visiblePlayers],
  )

  const setVisiblePlayers = useCallback(
    (keys: string[]) => {
      pushParams((params) => {
        const set = new Set(keys.filter((k) => matrix.players.includes(k)))
        if (matrix.players.includes(anchorKey)) set.add(anchorKey)
        const capped = capVisibleSet(set)
        const list = matrix.players.filter((k) => capped.has(k))
        const defaultTop20 = capVisibleSet(new Set(matrix.players))
        const isDefaultTop20 = list.length === defaultTop20.size && list.every((key) => defaultTop20.has(key))
        if (list.length === 0 || isDefaultTop20) {
          params.delete(PLAYERS_PARAM)
        } else {
          params.set(PLAYERS_PARAM, list.join(","))
        }
      })
    },
    [anchorKey, capVisibleSet, matrix.players, pushParams],
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
