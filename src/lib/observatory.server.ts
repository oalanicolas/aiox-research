import "server-only"

import { existsSync, statSync } from "node:fs"
import path from "node:path"
import {
  benchAdapterMeta,
  mapBenchToObservatory,
} from "@/components/observatory/adapters/bench"
import {
  mapResearchToObservatory,
  researchAdapterMeta,
} from "@/components/observatory/adapters/research"
import {
  mapSinkraMapsToObservatory,
  sinkraMapsAdapterMeta,
} from "@/components/observatory/adapters/sinkra-maps"
import type {
  ObservatoryAdapterMeta,
  ObservatoryData,
} from "@/components/observatory/foundations/types"
import { getBenchDashboardData } from "./bench-dashboard.server"
import { getResearchObservatoryData } from "./research-observatory.server"
import { getSinkraMapsObservatoryData } from "./sinkra-maps-observatory.server"

/* ──────────────────────────────────────────────────────────────────────
   Observatory loader — single entry point.

   getObservatoryData({source, slug?, file?}) dispatches to the corresponding
   native loader (research, bench, sinkra-maps) and maps the result
   through the adapter.

   Add a new corpus by:
     1. Implementing a native loader (e.g., src/lib/adr-observatory.server.ts)
     2. Implementing an adapter under src/components/observatory/adapters/
     3. Registering the source below.
   ────────────────────────────────────────────────────────────────────── */

export type ObservatorySource = "research" | "bench" | "sinkra-maps"

export const OBSERVATORY_SOURCE_LABELS: Array<[ObservatorySource, string]> = [
  ["research", "Research"],
  ["bench", "Bench"],
  ["sinkra-maps", "SINKRA Maps"],
]

export type ObservatoryLoaderParams = {
  source: ObservatorySource
  slug?: string
  file?: string
}

export type ObservatoryLoaderResult = {
  data: ObservatoryData
  meta: ObservatoryAdapterMeta
}

function findWorkspaceRoot(startPath: string) {
  let cursor = startPath
  for (let i = 0; i < 8; i += 1) {
    if (
      existsSync(path.join(cursor, "apps")) ||
      existsSync(path.join(cursor, "docs")) ||
      existsSync(path.join(cursor, "outputs"))
    ) {
      return cursor
    }
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
  return path.resolve(startPath, "../..")
}

function isDirectory(targetPath: string) {
  try {
    return statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}

export function getAvailableObservatorySources(): Array<[ObservatorySource, string]> {
  const root = findWorkspaceRoot(process.cwd())
  const sourcePaths: Record<ObservatorySource, string> = {
    research: path.join(root, "docs", "research"),
    bench: path.join(root, "docs", "bench"),
    "sinkra-maps": path.join(root, "outputs", "sinkra-squad"),
  }
  return OBSERVATORY_SOURCE_LABELS.filter(([source]) => isDirectory(sourcePaths[source]))
}

export function isObservatorySourceAvailable(source: ObservatorySource) {
  return getAvailableObservatorySources().some(([available]) => available === source)
}

export async function getObservatoryData(
  params: ObservatoryLoaderParams,
): Promise<ObservatoryLoaderResult> {
  if (!isObservatorySourceAvailable(params.source)) {
    throw new Error(`Observatory source unavailable: ${params.source}`)
  }

  switch (params.source) {
    case "research": {
      const native = await getResearchObservatoryData(params.slug, params.file)
      return { data: mapResearchToObservatory(native), meta: researchAdapterMeta }
    }
    case "bench": {
      const native = await getBenchDashboardData(params.slug, params.file)
      return { data: mapBenchToObservatory(native), meta: benchAdapterMeta }
    }
    case "sinkra-maps": {
      const native = await getSinkraMapsObservatoryData(params.slug, params.file)
      return { data: mapSinkraMapsToObservatory(native), meta: sinkraMapsAdapterMeta }
    }
    default: {
      const exhaustive: never = params.source
      throw new Error(`Unknown observatory source: ${String(exhaustive)}`)
    }
  }
}

export const OBSERVATORY_ADAPTERS: Record<ObservatorySource, ObservatoryAdapterMeta> = {
  research: researchAdapterMeta,
  bench: benchAdapterMeta,
  "sinkra-maps": sinkraMapsAdapterMeta,
}
