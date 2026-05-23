#!/usr/bin/env node
/**
 * build-research-snapshot
 *
 * Materializes the read-only data the research observatory consumes
 * (docs/research, docs/bench, outputs/sinkra-squad) from the monorepo root
 * into `apps/research/src/data/snapshot/`, so the Next.js build can ship
 * a self-contained app to Vercel without depending on workspace siblings.
 *
 * Pattern mirrors `apps/design/scripts/build-public-data.mjs` (ADR-049 Tier B).
 *
 * Day-1: snapshot is the source. Day-N: `RESEARCH_DATA_SOURCE=api` flips
 * `workspace-root.server.ts` to delegate reads to the remote API at
 * research.aioxsquad.ai, snapshot becomes irrelevant.
 *
 * Idempotent. Safe to run multiple times. Designed for predev/prebuild hooks.
 */

import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const APP_ROOT = path.resolve(__dirname, "..")
const SNAPSHOT_DIR = path.join(APP_ROOT, "src", "data", "snapshot")

// Resolve monorepo root by walking up looking for `apps/` and `docs/`.
function resolveMonorepoRoot() {
  const envRoot = process.env.AIOX_RESEARCH_SNAPSHOT_ROOT?.trim()
  if (envRoot) return path.resolve(envRoot)

  let cursor = APP_ROOT
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(cursor, "apps")) && existsSync(path.join(cursor, "docs"))) {
      return cursor
    }
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }

  throw new Error(
    "build-research-snapshot: could not locate monorepo root (looked for `apps/` + `docs/` markers walking up from " +
      APP_ROOT +
      "). Set AIOX_RESEARCH_SNAPSHOT_ROOT explicitly if running from outside the repo.",
  )
}

// Subtrees to mirror. Each entry: [source path relative to repo root, dest path relative to snapshot dir].
const SUBTREES = [
  ["docs/research", "docs/research"],
  ["docs/bench", "docs/bench"],
  ["outputs/sinkra-squad", "outputs/sinkra-squad"],
]

// Filename patterns to exclude during copy.
const EXCLUDED_FILENAMES = new Set([".DS_Store", "Thumbs.db", ".gitkeep"])
const EXCLUDED_PREFIXES = ["."]
const EXCLUDED_DIRS = new Set(["node_modules", ".git", ".next", ".vercel", ".synapse", "__pycache__"])

function shouldInclude(absPath, stats) {
  const base = path.basename(absPath)
  if (EXCLUDED_FILENAMES.has(base)) return false
  if (stats.isDirectory() && EXCLUDED_DIRS.has(base)) return false
  if (EXCLUDED_PREFIXES.some((prefix) => base.startsWith(prefix) && base !== ".env.example")) return false
  return true
}

async function countTree(dir) {
  let files = 0
  let bytes = 0
  let runs = 0

  if (!existsSync(dir)) return { files, bytes, runs }

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue
    if (EXCLUDED_FILENAMES.has(entry.name)) continue
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue

    if (entry.isDirectory()) {
      runs += 1
      const child = await countTree(path.join(dir, entry.name))
      files += child.files
      bytes += child.bytes
    } else if (entry.isFile()) {
      files += 1
      try {
        const st = await stat(path.join(dir, entry.name))
        bytes += st.size
      } catch {
        // ignore
      }
    }
  }

  return { files, bytes, runs }
}

function formatBytes(n) {
  if (n < 1024) return n + " B"
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB"
  return (n / (1024 * 1024)).toFixed(2) + " MB"
}

async function clean(targetDir) {
  if (!existsSync(targetDir)) return
  // ENOTEMPTY can fire on macOS when many files are nested deeply (timing
  // issue between rmdir and contents). maxRetries handles it; retryDelay
  // backs off briefly.
  await rm(targetDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

async function copySubtree(repoRoot, [sourceRel, destRel]) {
  const source = path.join(repoRoot, sourceRel)
  const dest = path.join(SNAPSHOT_DIR, destRel)

  if (!existsSync(source)) {
    return { sourceRel, status: "missing", files: 0, bytes: 0, runs: 0 }
  }

  await mkdir(path.dirname(dest), { recursive: true })

  await cp(source, dest, {
    recursive: true,
    dereference: false,
    preserveTimestamps: true,
    filter: (src) => {
      const base = path.basename(src)
      if (EXCLUDED_FILENAMES.has(base)) return false
      if (EXCLUDED_DIRS.has(base)) return false
      if (base.startsWith(".") && base !== ".env.example") return false
      return true
    },
  })

  const counts = await countTree(dest)
  return { sourceRel, status: "copied", ...counts }
}

async function writeManifest(repoRoot, reports) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: "scripts/build-research-snapshot.mjs",
    monorepoRoot: path.relative(APP_ROOT, repoRoot) || ".",
    snapshotDir: path.relative(APP_ROOT, SNAPSHOT_DIR),
    subtrees: reports.map((r) => ({
      source: r.sourceRel,
      status: r.status,
      files: r.files ?? 0,
      runs: r.runs ?? 0,
      bytes: r.bytes ?? 0,
    })),
  }

  await writeFile(
    path.join(SNAPSHOT_DIR, "snapshot.manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  )

  return manifest
}

async function main() {
  const started = Date.now()

  // On Vercel (or any environment that lacks the monorepo), the snapshot must
  // be pre-materialized locally and shipped via .vercelignore whitelist. If a
  // manifest is already present, treat the script as a no-op so the build
  // succeeds without trying to walk up to a monorepo that isn't there.
  const manifestPath = path.join(SNAPSHOT_DIR, "snapshot.manifest.json")
  if (process.env.VERCEL === "1" || process.env.CI === "true") {
    if (existsSync(manifestPath)) {
      console.log("build-research-snapshot: pre-built snapshot detected (CI/Vercel mode). Skipping rebuild.")
      return
    }
    console.error("build-research-snapshot: running in CI/Vercel but no pre-built snapshot found.")
    console.error("  Expected: " + manifestPath)
    console.error("  Run `npm run snapshot` locally and re-deploy.")
    process.exit(2)
  }

  const repoRoot = resolveMonorepoRoot()

  console.log("build-research-snapshot: starting")
  console.log("  app root:    " + path.relative(process.cwd(), APP_ROOT))
  console.log("  monorepo:    " + path.relative(process.cwd(), repoRoot))
  console.log("  destination: " + path.relative(process.cwd(), SNAPSHOT_DIR))

  await clean(SNAPSHOT_DIR)
  await mkdir(SNAPSHOT_DIR, { recursive: true })

  const reports = []
  for (const subtree of SUBTREES) {
    const report = await copySubtree(repoRoot, subtree)
    reports.push(report)
    if (report.status === "copied") {
      console.log(
        "  + " +
          report.sourceRel +
          ": " +
          report.runs +
          " runs, " +
          report.files +
          " files, " +
          formatBytes(report.bytes),
      )
    } else {
      console.log("  - " + report.sourceRel + ": MISSING (skipped)")
    }
  }

  const manifest = await writeManifest(repoRoot, reports)
  const elapsed = ((Date.now() - started) / 1000).toFixed(2)

  const totalFiles = reports.reduce((sum, r) => sum + (r.files ?? 0), 0)
  const totalBytes = reports.reduce((sum, r) => sum + (r.bytes ?? 0), 0)
  console.log(
    "build-research-snapshot: done in " +
      elapsed +
      "s. " +
      totalFiles +
      " files, " +
      formatBytes(totalBytes) +
      " total.",
  )

  if (reports.every((r) => r.status === "missing")) {
    console.error("build-research-snapshot: no source subtrees found. Snapshot is empty.")
    console.error("  Check that the script ran from inside the monorepo or set AIOX_RESEARCH_SNAPSHOT_ROOT.")
    process.exit(2)
  }

  return manifest
}

main().catch((err) => {
  console.error("build-research-snapshot: failed.")
  console.error(err?.stack || err?.message || String(err))
  process.exit(1)
})
