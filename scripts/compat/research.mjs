/**
 * Research compatibility module.
 *
 * Port of the legacy Hub-level shim `scripts/research-observatory-compat.mjs`
 * relocated into apps/dash and aligned with the init-observatory pipeline.
 *
 * For each `docs/research/<slug>/` directory present in the workspace we
 * derive — only when supporting signal exists — the following companion
 * artifacts consumed by the Research Observatory adapter:
 *   - sources.yaml          (from Markdown URLs)
 *   - metrics.yaml          (from artifact completeness)
 *   - pipeline-state.yaml   (from artifact presence)
 *   - execution-log.jsonl   (compatibility scan trace)
 *   - research-graph.json   (nodes/edges over files + sources)
 *   - matrices.yaml         (from Markdown tables)
 *   - curiosity_queue.yaml  (from Markdown questions)
 *   - quick-wins.md         (from Markdown action verbs)
 *
 * Additionally maintains an `_index.json` at `docs/research/` so the dash
 * adapter can pick up `display_title`, `category`, etc. with stable schema.
 *
 * All emitted files carry a `generator: scripts/init-observatory.mjs` marker
 * so subsequent runs overwrite their own output without touching files
 * authored by humans or other pipelines.
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  GENERATOR_ID,
  fileExists,
  listChildDirs,
  writeIfAllowed,
} from "./shared.mjs"

/**
 * A research dir is "authorial" when it has explicit, human/CLI-authored body
 * content. In that case the compat script must NOT fabricate metrics /
 * pipeline-state / curiosity stubs over the top of it — the legitimate
 * pipeline (tech-research, etc.) is responsible for those artifacts, and
 * filling them with synthetic numbers violates extraction-no-fallbacks
 * (.claude/rules/extraction-no-fallbacks.md).
 *
 * Heuristic: report body OR readme is meaningfully populated.
 */
const AUTHORIAL_BODY_MIN_BYTES = 800

async function dirHasAuthorialContent(dir, files) {
  const candidates = ["02-research-report.md", "README.md"]
  for (const candidate of candidates) {
    if (!files.includes(candidate)) continue
    try {
      const st = await stat(path.join(dir, candidate))
      if (st.size >= AUTHORIAL_BODY_MIN_BYTES) return true
    } catch {
      // ignore — treat as absent for safety
    }
  }
  return false
}

const CORE_FILES = [
  "README.md",
  "00-query-original.md",
  "01-deep-research-prompt.md",
  "02-research-report.md",
  "03-recommendations.md",
]

const URL_PATTERN = /https?:\/\/[^\s)\]}>"']+/g

function q(value) {
  return JSON.stringify(String(value ?? ""))
}

function slugDate(slug) {
  return slug.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "undated"
}

function titleFromSlug(slug) {
  return slug
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => (part.toUpperCase() === "AIOX" ? "AIOX" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
}

async function readDocs(dir, files) {
  const markdownFiles = files.filter((file) => /\.(md|markdown)$/i.test(file))
  return Promise.all(
    markdownFiles.map(async (file) => ({
      file,
      content: await readFile(path.join(dir, file), "utf8"),
    })),
  )
}

function markdownTitle(docs, slug) {
  for (const doc of docs) {
    const match = doc.content.match(/^#\s+(.+)$/m)
    if (match?.[1]) return match[1].trim().replace(/^Research:\s*/i, "")
  }
  return titleFromSlug(slug)
}

function existingCoverage(files, hasSources, waves) {
  const corePresent = CORE_FILES.filter((file) => files.includes(file)).length
  let score = 45 + Math.round((corePresent / CORE_FILES.length) * 22)
  if (corePresent === CORE_FILES.length) score += 8
  if (files.includes("metrics.yaml")) score += 5
  if (files.includes("pipeline-state.yaml")) score += 5
  if (hasSources) score += 6
  if (files.includes("execution-log.jsonl")) score += 3
  score += Math.min(6, Math.max(0, waves))
  score += Math.min(5, Math.floor(Math.max(0, files.length - CORE_FILES.length) / 3))
  return Math.max(50, Math.min(88, score))
}

function parseSourcesCount(raw) {
  const sourceEntries = raw.match(/^  - id:/gm)?.length ?? 0
  const high = raw.match(/credibility:\s*HIGH/g)?.length ?? 0
  const medium = raw.match(/credibility:\s*MEDIUM/g)?.length ?? 0
  const dated = raw.match(/date:\s*["']?(?!unknown|—|null|$)[^"'\n]+/g)?.length ?? 0
  return { total: sourceEntries, high, medium, dated }
}

function sourceCredibility(url) {
  let host
  try {
    host = new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return { credibility: "MEDIUM", multiplier: 1.0 }
  }
  if (/\.(gov|edu)$/.test(host) || /(^|\.)github\.com$|(^|\.)arxiv\.org$|(^|\.)docs\.github\.com$/.test(host)) {
    return { credibility: "HIGH", multiplier: 1.2 }
  }
  if (/docs|developer|dev|openai|anthropic|vercel|nextjs|react|mozilla|w3|ietf/.test(host)) {
    return { credibility: "HIGH", multiplier: 1.2 }
  }
  return { credibility: "MEDIUM", multiplier: 1.0 }
}

function extractSources(docs) {
  const found = new Map()
  for (const doc of docs) {
    for (const match of doc.content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
      const url = match[2].replace(/[.,;:]+$/, "")
      if (!found.has(url)) found.set(url, { title: match[1].trim(), url, files: new Set([doc.file]) })
      else found.get(url).files.add(doc.file)
    }
    for (const match of doc.content.matchAll(URL_PATTERN)) {
      const url = match[0].replace(/[.,;:]+$/, "")
      if (!found.has(url)) found.set(url, { title: "", url, files: new Set([doc.file]) })
      else found.get(url).files.add(doc.file)
    }
  }
  return [...found.values()]
    .filter((entry) => {
      try {
        const parsed = new URL(entry.url)
        return Boolean(parsed.hostname)
      } catch {
        return false
      }
    })
    .slice(0, 80)
    .map((entry, index) => {
      const host = new URL(entry.url).hostname.replace(/^www\./, "")
      const scored = sourceCredibility(entry.url)
      return {
        id: `S${String(index + 1).padStart(3, "0")}`,
        title: entry.title || host,
        url: entry.url,
        credibility: scored.credibility,
        multiplier: scored.multiplier,
        files: [...entry.files],
      }
    })
}

function sourceYaml(slug, sources) {
  const high = sources.filter((source) => source.credibility === "HIGH").length
  const medium = sources.filter((source) => source.credibility === "MEDIUM").length
  return [
    "# Generated from URLs explicitly present in Markdown. inferred: true",
    `generator: ${GENERATOR_ID}`,
    `research_id: ${q(slug)}`,
    "inferred: true",
    "sources:",
    ...sources.flatMap((source) => [
      `  - id: ${q(source.id)}`,
      `    url: ${q(source.url)}`,
      `    title: ${q(source.title)}`,
      "    date: unknown",
      `    credibility: ${source.credibility}`,
      `    multiplier: ${source.multiplier}`,
      "    flags:",
      "      - inferred_from_markdown_url",
      ...source.files.map((file) => `      - ${q(`cited_in:${file}`)}`),
    ]),
    "totals:",
    `  total: ${sources.length}`,
    `  high_credibility: ${high}`,
    `  medium_credibility: ${medium}`,
    "  low_credibility: 0",
    "  with_dates: 0",
    "  date_coverage_ratio: 0",
    "",
  ].join("\n")
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/\s+/g, " "))
}

function nearestHeading(lines, index) {
  for (let i = index; i >= 0; i -= 1) {
    const match = lines[i].match(/^#{1,4}\s+(.+)$/)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function extractTables(docs) {
  const matrices = []
  for (const doc of docs) {
    const lines = doc.content.split("\n")
    for (let i = 0; i < lines.length - 1; i += 1) {
      if (!/^\s*\|.+\|\s*$/.test(lines[i]) || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue
      const heading = nearestHeading(lines, i) ?? `Tabela extraida de ${doc.file}`
      const columns = splitTableRow(lines[i])
      const rows = []
      let j = i + 2
      while (j < lines.length && /^\s*\|.+\|\s*$/.test(lines[j])) {
        const cells = splitTableRow(lines[j])
        if (cells.length) {
          const row = {}
          columns.forEach((column, index) => {
            row[column || `col_${index + 1}`] = cells[index] ?? ""
          })
          rows.push(row)
        }
        j += 1
      }
      if (columns.length > 0 && rows.length > 0) {
        matrices.push({ title: heading, source_file: doc.file, columns, cells: rows.slice(0, 30) })
      }
      i = j
    }
  }
  return matrices.slice(0, 20)
}

function yamlInline(value) {
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return q(value)
}

function yamlValue(value, indent) {
  const pad = " ".repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return " []"
    return `\n${value.map((item) => `${pad}- ${yamlInline(item)}`).join("\n")}`
  }
  if (value && typeof value === "object") {
    return `\n${Object.entries(value)
      .map(([key, val]) => `${pad}${q(key)}: ${yamlInline(val)}`)
      .join("\n")}`
  }
  return ` ${yamlInline(value)}`
}

function matricesYaml(slug, matrices) {
  return [
    "# Generated from Markdown tables. inferred: true",
    `generator: ${GENERATOR_ID}`,
    `research_id: ${q(slug)}`,
    "inferred: true",
    "matrices:",
    ...matrices.map((matrix, index) => [
      `  - id: ${q(`M${String(index + 1).padStart(3, "0")}`)}`,
      `    title: ${q(matrix.title)}`,
      `    source_file: ${q(matrix.source_file)}`,
      `    row_count: ${matrix.cells.length}`,
      `    columns:${yamlValue(matrix.columns, 6)}`,
      `    cells:${yamlValue(matrix.cells, 6)}`,
    ].join("\n")),
    "",
  ].join("\n")
}

function extractQuestions(docs) {
  const questions = []
  const questionLines = []
  for (const doc of docs) {
    for (const line of doc.content.split("\n")) {
      const clean = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim()
      if (clean.includes("?") && clean.length >= 18 && clean.length <= 240) {
        questionLines.push({ file: doc.file, question: clean.replace(/\*\*/g, "") })
      }
    }
  }
  for (const item of questionLines.slice(0, 12)) {
    questions.push({
      question: item.question,
      file: item.file,
      priority: /risco|critico|critica|bloque|p0|p1|high|alto/i.test(item.question) ? "HIGH" : "MEDIUM",
    })
  }
  if (questions.length === 0) {
    questions.push({
      question: "Quais lacunas desta pesquisa exigem nova wave antes de transformar recomendacoes em backlog?",
      file: "derived",
      priority: "MEDIUM",
    })
  }
  return questions
}

function curiosityYaml(slug, questions) {
  return [
    "# Generated from explicit Markdown questions when available; fallback question is marked as inferred. inferred: true",
    `generator: ${GENERATOR_ID}`,
    'schema_version: "1.0"',
    `research_id: ${q(slug)}`,
    `created_at: ${q(`${slugDate(slug)}T00:00:00Z`)}`,
    "inferred: true",
    "questions:",
    ...questions.map((item, index) => [
      `  - id: ${q(`CQ-${String(index + 1).padStart(3, "0")}`)}`,
      `    question: ${q(item.question)}`,
      "    status: open",
      `    priority: ${item.priority}`,
      `    why_it_matters: ${q(item.file === "derived" ? "Pergunta de controle gerada porque nenhum backlog explicito foi encontrado." : `Pergunta extraida de ${item.file}.`)}`,
      `    next_action: ${q("Validar em follow-up research antes de converter em story.")}`,
      `    source_file: ${q(item.file)}`,
      "    inferred: true",
    ].join("\n")),
    "resolved_questions: []",
    "discarded_questions: []",
    "",
  ].join("\n")
}

function extractQuickWins(docs) {
  const recommendationDocs = docs.filter((doc) => /recommend|quick|README/i.test(doc.file))
  const items = []
  for (const doc of recommendationDocs.length ? recommendationDocs : docs) {
    const lines = doc.content.split("\n")
    for (const line of lines) {
      const match = line.match(/^\s*(?:[-*]|\d+\.)\s+(.{12,220})$/)
      if (!match?.[1]) continue
      const text = match[1].replace(/\*\*/g, "").trim()
      if (/^(http|fonte|source)/i.test(text)) continue
      if (/implementar|criar|adotar|validar|mapear|priorizar|migrar|usar|rodar|corrigir|documentar|extrair|automatizar/i.test(text)) {
        items.push({ action: text, file: doc.file })
      }
    }
  }
  return items.slice(0, 8)
}

function quickWinsMd(slug, title, items) {
  const rows = items.length
    ? items.map((item, index) => `| QW-${String(index + 1).padStart(3, "0")} | ${item.action.replace(/\|/g, "\\|")} | S/M | ${item.file} | inferred |`)
    : ["| QW-001 | Revisar a pesquisa e decidir se ha base suficiente para criar story ou abrir follow-up. | S | documentos existentes | inferred |"]
  return [
    `# Quick Wins — ${title}`,
    "",
    `> Gerado por compatibilizacao do Research Observatory (generator: \`${GENERATOR_ID}\`).`,
    "> As acoes sao derivadas de listas/recomendacoes existentes; itens sem fonte direta estao marcados como `inferred`.",
    "",
    "| ID | Acao | Effort | Evidencia | Status |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    `Research run: \`${slug}\`  `,
    `Generated by: \`${GENERATOR_ID}\``,
    "",
  ].join("\n")
}

function phaseStatus(files, waves) {
  return {
    auto_clarify: files.includes("00-query-original.md") ? "completed" : "not_evidenced",
    decompose: files.includes("01-deep-research-prompt.md") ? "completed" : "not_evidenced",
    generate_prompt: files.includes("01-deep-research-prompt.md") ? "completed" : "not_evidenced",
    execute_research: files.includes("02-research-report.md") || waves > 0 ? "completed" : "partial_or_not_evidenced",
    evaluate_coverage: files.includes("metrics.yaml") ? "completed" : "inferred_from_artifacts",
    compress_wave: waves > 0 ? "completed" : "not_evidenced",
    synthesize: files.includes("02-research-report.md") ? "completed" : "partial_or_not_evidenced",
    verify_citations: files.includes("sources.yaml") ? "completed_or_imported" : "not_evidenced",
    document: files.some((file) => file.endsWith(".md")) ? "completed" : "not_evidenced",
  }
}

function pipelineYaml(slug, title, files, waves) {
  const phases = phaseStatus(files, waves)
  return [
    "# Generated from artifact presence. inferred: true",
    `generator: ${GENERATOR_ID}`,
    `pipeline_id: ${q(slug.replace(/^\d{4}-\d{2}-\d{2}-/, ""))}`,
    "status: completed_or_imported",
    `date: ${slugDate(slug)}`,
    `query: ${q(title)}`,
    "inferred: true",
    "phases:",
    ...Object.entries(phases).map(([phase, status]) => `  ${phase}: ${status}`),
    `output_dir: docs/research/${slug}`,
    "notes:",
    "  - Artefato gerado para compatibilidade visual com o Research Observatory.",
    "  - Status de fase derivado por presenca de arquivos, nao por log original.",
    "",
  ].join("\n")
}

function metricsYaml(slug, files, sources, existingSources, waves) {
  const sourceStats = existingSources ?? {
    total: sources.length,
    high: sources.filter((source) => source.credibility === "HIGH").length,
    medium: sources.filter((source) => source.credibility === "MEDIUM").length,
    dated: 0,
  }
  const hasSources = sourceStats.total > 0
  const coverage = existingCoverage(files, hasSources, waves)
  const corePresent = CORE_FILES.filter((file) => files.includes(file)).length
  const integrity = hasSources
    ? Math.min(88, 58 + Math.round((sourceStats.high / Math.max(1, sourceStats.total)) * 22) + Math.min(8, sourceStats.dated))
    : Math.max(45, 52 + corePresent * 4)
  const freshnessRatio = sourceStats.total ? Math.round((sourceStats.dated / sourceStats.total) * 100) : 0
  return [
    "# Generated from artifact completeness and explicit source files. inferred fields are not original research scores.",
    `generator: ${GENERATOR_ID}`,
    `pipeline_id: ${q(slug.replace(/^\d{4}-\d{2}-\d{2}-/, ""))}`,
    `date: ${slugDate(slug)}`,
    `coverage_score: ${coverage} # inferred from artifact completeness`,
    "coverage_breakdown:",
    `  core_documents: ${Math.round((corePresent / CORE_FILES.length) * 100)}`,
    `  structured_artifacts: ${Math.round((files.filter((file) => /\.(ya?ml|jsonl?|csv)$/i.test(file)).length / 8) * 100)}`,
    `  evidence_files: ${hasSources ? 80 : 35}`,
    `  waves: ${Math.min(100, waves * 25)}`,
    `  recommendations: ${files.some((file) => /recommend|quick-win/i.test(file)) ? 80 : 35}`,
    "  current_state: 60",
    `integrity_score: ${integrity} # inferred from source artifacts and citation availability`,
    "sources:",
    `  total: ${sourceStats.total}`,
    `  high_credibility: ${sourceStats.high}`,
    `  medium_credibility: ${sourceStats.medium}`,
    `  with_dates: ${sourceStats.dated}`,
    `  freshness_ratio: ${freshnessRatio}%`,
    `waves: ${waves}`,
    "decision: needs_followup",
    'stop_reason: "Compatibilizacao inferida: revisar lacunas antes de transformar em execucao."',
    "inferred:",
    "  coverage_score: true",
    "  integrity_score: true",
    "  decision: true",
    "  stop_reason: true",
    "",
  ].join("\n")
}

function executionLog(slug, files, waves) {
  const ts = `${slugDate(slug)}T00:00:00Z`
  const events = [
    { ts, phase: "import_existing_artifacts", status: "completed", notes: "Research run discovered in docs/research.", generator: GENERATOR_ID },
    { ts, phase: "compatibility_scan", status: "completed", artifacts: files, generator: GENERATOR_ID },
  ]
  for (let i = 1; i <= waves; i += 1) {
    events.push({ ts, phase: `wave_${i}`, status: "completed_or_imported", notes: `wave-${i} artifact detected.`, generator: GENERATOR_ID })
  }
  events.push({ ts, phase: "observatory_compatibility", status: "completed", generator: GENERATOR_ID })
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`
}

function fileType(file) {
  if (file === "README.md") return "overview"
  if (file.startsWith("00-")) return "query"
  if (file.startsWith("01-")) return "prompt"
  if (file.startsWith("02-")) return "report"
  if (file.startsWith("03-")) return "recommendations"
  if (/wave/i.test(file)) return "wave"
  if (/follow|^\d{2}-/.test(file)) return "followup"
  if (/source/.test(file)) return "sources"
  if (/metric/.test(file)) return "metrics"
  if (/curiosity/.test(file)) return "curiosity"
  return "artifact"
}

async function graphJson(slug, dir, files, sources) {
  const nodes = [{ id: "root", type: "root", slug, path: "." }]
  const edges = []
  for (const file of files.filter((file) => /\.(md|ya?ml|jsonl?|csv)$/i.test(file))) {
    const id = file.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")
    const type = fileType(file)
    const st = await stat(path.join(dir, file))
    nodes.push({ id, type, file, size_bytes: st.size, exists: true, inferred: false })
    edges.push({ from: "root", relation: "contains", to: id })
  }
  for (const source of sources.slice(0, 20)) {
    nodes.push({ id: source.id, type: "source", label: source.title, url: source.url, credibility: source.credibility, inferred: true })
    edges.push({ from: "root", relation: "cites", to: source.id })
  }
  const ids = new Set(nodes.map((node) => node.id))
  const chain = ["00-query-original", "01-deep-research-prompt", "02-research-report", "03-recommendations"]
  for (let i = 0; i < chain.length - 1; i += 1) {
    if (ids.has(chain[i]) && ids.has(chain[i + 1])) edges.push({ from: chain[i], relation: "produces", to: chain[i + 1] })
  }
  return `${JSON.stringify({ generator: GENERATOR_ID, inferred: true, node_count: nodes.length, edge_count: edges.length, nodes, edges }, null, 2)}\n`
}

function classifyCategory(title, slug) {
  const text = `${title} ${slug}`.toLowerCase()
  if (/agent|orchestrat|llm runner|swarm/.test(text)) return "ai-agents"
  if (/openai|anthropic|claude|gpt|model|gemini|ai gateway/.test(text)) return "ai-tools"
  if (/ux|ui|design system|landing|figma|tailwind|shadcn/.test(text)) return "ux-ui"
  if (/claude code|cli|harness|hook|skill|slash|prompt/.test(text)) return "harness"
  if (/seo|content|brief|article|blog|writing/.test(text)) return "content"
  if (/devops|ci\/cd|deploy|github actions|infra/.test(text)) return "devops"
  if (/supabase|postgres|sqlite|database|schema|migration/.test(text)) return "database"
  if (/strategy|business|monet|pricing|offer|market/.test(text)) return "business"
  if (/next\.js|next 16|react|component|frontend|webpack|turbopack/.test(text)) return "frontend"
  if (/knowledge|vault|graph|note|mind|memory/.test(text)) return "knowledge"
  return "other"
}

function indexJson(entries) {
  const payload = {
    generator: GENERATOR_ID,
    schema_version: "1.0",
    inferred: true,
    entries,
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

/**
 * Process all `docs/research/<slug>/` directories and emit derived artifacts.
 *
 * @param {string} researchRoot absolute path to docs/research
 * @returns {Promise<{ scanned: number; touched: Array<{ slug: string; written: string[] }>; indexEntries: number }>}
 */
export async function processResearchRoot(researchRoot) {
  const slugs = await listChildDirs(researchRoot)
  const report = []
  const indexEntries = []

  for (const slug of slugs) {
    const dir = path.join(researchRoot, slug)
    let files = (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
    const docs = await readDocs(dir, files)
    if (docs.length === 0) continue

    const title = markdownTitle(docs, slug)
    const sourcesFromMarkdown = extractSources(docs)
    const waves = files.filter((file) => /wave/i.test(file) && /\.(md|jsonl)$/i.test(file)).length
    const written = []

    if (!files.includes("sources.yaml") && sourcesFromMarkdown.length > 0) {
      const status = await writeIfAllowed(path.join(dir, "sources.yaml"), sourceYaml(slug, sourcesFromMarkdown))
      if (status !== "skipped") written.push(`sources.yaml:${status}`)
      files = (await readdir(dir, { withFileTypes: true }))
        .filter((entry) => entry.isFile()).map((entry) => entry.name).sort()
    }

    const existingSources = files.includes("sources.yaml")
      ? parseSourcesCount(await readFile(path.join(dir, "sources.yaml"), "utf8"))
      : null
    const tables = extractTables(docs)
    const quickWins = extractQuickWins(docs)
    const questions = extractQuestions(docs)

    const slot = async (file, content) => {
      const status = await writeIfAllowed(path.join(dir, file), content)
      if (status !== "skipped") written.push(`${file}:${status}`)
    }

    /* When the research dir is authorial (real CLI/human body), only emit
       non-destructive auxiliary artifacts (sources.yaml, research-graph.json,
       matrices.yaml when tables exist). Skip the synthetic numeric stubs
       (metrics.yaml, pipeline-state.yaml, execution-log.jsonl,
       curiosity_queue.yaml, quick-wins.md) — those would either fabricate
       coverage/integrity scores or downgrade real findings to inferred
       placeholders, both of which violate extraction-no-fallbacks. */
    const authorial = await dirHasAuthorialContent(dir, files)
    if (!authorial) {
      await slot("metrics.yaml", metricsYaml(slug, files, sourcesFromMarkdown, existingSources, waves))
      await slot("pipeline-state.yaml", pipelineYaml(slug, title, files, waves))
      await slot("execution-log.jsonl", executionLog(slug, files, waves))
    }
    files = (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile()).map((entry) => entry.name).sort()
    await slot("research-graph.json", await graphJson(slug, dir, files, sourcesFromMarkdown))
    if (tables.length > 0) await slot("matrices.yaml", matricesYaml(slug, tables))
    if (!authorial) {
      await slot("curiosity_queue.yaml", curiosityYaml(slug, questions))
      await slot("quick-wins.md", quickWinsMd(slug, title, quickWins))
    }

    report.push({ slug, written })
    indexEntries.push({
      slug,
      topic: title,
      display_title: title.length > 60 ? `${title.slice(0, 57).trim()}...` : title,
      category: classifyCategory(title, slug),
      date: slugDate(slug),
      status: "indexed",
      coverage_score: null,
      integrity_score: null,
      decision: null,
      sources_total: sourcesFromMarkdown.length || (existingSources?.total ?? null),
      waves,
      inferred: {
        category: true,
        display_title: !title || title.length > 60,
        coverage_score: true,
      },
    })
  }

  if (indexEntries.length > 0) {
    const indexPath = path.join(researchRoot, "_index.json")
    const status = await writeIfAllowed(indexPath, indexJson(indexEntries))
    if (status !== "skipped") {
      report.push({ slug: "_index.json", written: [`_index.json:${status}`] })
    }
  }

  return {
    scanned: slugs.length,
    touched: report.filter((item) => item.written.length > 0),
    indexEntries: indexEntries.length,
  }
}

// Allow direct invocation for ad-hoc testing without going through init-observatory.
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2] ?? path.resolve("docs/research")
  processResearchRoot(target)
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2))
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      process.exit(1)
    })
}

// satisfy linter; keep writeFile import used in case future extensions need it
void writeFile
