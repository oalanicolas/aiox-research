import "server-only"

import { existsSync } from "node:fs"
import path from "node:path"

const ROOT_MARKERS = ["docs", "apps"] as const

function normalizeRoot(candidate: string) {
  return path.resolve(candidate.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? "~"))
}

function hasWorkspaceMarker(candidate: string) {
  return ROOT_MARKERS.every((marker) => existsSync(path.join(candidate, marker)))
}

export function getDashWorkspaceRoot(startPath = process.cwd()) {
  const configuredRoot = process.env.AIOX_RESEARCH_ROOT?.trim() || process.env.AIOX_DASH_ROOT?.trim()
  if (configuredRoot) return normalizeRoot(configuredRoot)

  let cursor = normalizeRoot(startPath)
  for (let i = 0; i < 8; i += 1) {
    if (hasWorkspaceMarker(cursor)) return cursor
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }

  return normalizeRoot(startPath)
}

export function resolveDashPath(...segments: string[]) {
  return path.join(getDashWorkspaceRoot(), ...segments)
}
