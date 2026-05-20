"use client"

import { useCallback, useMemo, useState, type RefObject } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Copy, FileText, FolderOpen, Moon, Sun } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import type { ObservatoryDocument } from "../foundations/types"
import { LightScrollArea } from "../molecules/light-scroll-area"
import { MONO_FONT, SANS_FONT, observatoryDarkThemeVars } from "../foundations/theme"
import { formatBytes } from "../foundations/utils"

/* Organism — Docs view (Reader mode = "document", bench/research).
 *
 * Visual reference: AIOX Dash v2.html · DOC VIEW + .doc-reader.light
 *
 * Toolbar actions são icon-only (sem text label) por decisão UX de
 * Trinity / aiox-ux-designer skill: 28x28 quadrado, lucide 13px, hover lime
 * em dark e dark-fill em light. Tooltips via title + aria-label.
 *
 * Color tokens (de colors_and_type.css):
 *   --cream         = rgb(244, 244, 232)  → light bg
 *   --cream-alt     = rgb(245, 244, 231)  → toolbar light bg
 *   --cream-deep    = #ecebde             → file panel light bg
 *   --dark          = #050505             → light text primary
 *   --gray-charcoal = #3D3D3D             → light text secondary
 *
 * Light mode policy (espelha .doc-reader.light da referência):
 *   - body bg = cream | text = dark
 *   - h1/h2 = dark | h3 = gray-charcoal
 *   - code = rgba(0,0,0,0.06) bg + dark text (NÃO lime)
 *
 * Decision-in-one-click integration:
 *   - file selection é URL-persistida via ?file=<path>
 *   - light/dark mode preserved via ?doc-theme=light
 */
export function DocsView({
  documents,
  selectedFile,
  content,
  sourceRoot,
  runSlug,
  bodyRef,
}: {
  documents: ObservatoryDocument[]
  selectedFile: string
  content: string
  sourceRoot: string
  runSlug: string
  bodyRef?: RefObject<HTMLDivElement | null>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const themeParam = searchParams?.get("doc-theme") === "light" ? "light" : "dark"
  const isLight = themeParam === "light"
  const [copied, setCopied] = useState(false)

  const selectFile = useCallback(
    (file: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set("file", file)
      router.push(`?${params.toString()}`, { scroll: true })
    },
    [router, searchParams],
  )

  const toggleTheme = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (isLight) params.delete("doc-theme")
    else params.set("doc-theme", "light")
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams, isLight])

  const copyContent = useCallback(() => {
    if (typeof navigator === "undefined") return
    void navigator.clipboard?.writeText(content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [content])

  const ordered = useMemo(() => orderDocumentsByPriority(documents), [documents])

  const docFiles = ordered.filter((d) => /\.(md|mdx)$/i.test(d.file))
  const dataFiles = ordered.filter((d) => /\.(json|yaml|yml|jsonl)$/i.test(d.file))
  const diagramFiles = ordered.filter((d) => /\.mmd$/i.test(d.file))

  const groups: Array<{ key: string; label: string; items: ObservatoryDocument[] }> = []
  if (docFiles.length) groups.push({ key: "md", label: "Markdown", items: docFiles })
  if (dataFiles.length) groups.push({ key: "data", label: "Data & schemas", items: dataFiles })
  if (diagramFiles.length) groups.push({ key: "diagram", label: "Diagramas", items: diagramFiles })

  const path = `${sourceRoot}/${runSlug}/${selectedFile}`
  const selectedDoc = documents.find((d) => d.file === selectedFile)

  const bgReader = isLight ? "#f4f4e8" : "var(--paper)"
  const bgToolbar = isLight ? "#ecebde" : "var(--paper-deep)"
  const bgPanel = isLight ? "#f4f4e8" : "var(--paper)"
  const bgPanelHeader = isLight ? "#ecebde" : "var(--paper-deep)"
  const bgPanelActive = isLight ? "rgba(0,0,0,0.06)" : "var(--paper-deep)"
  const bgPanelHover = isLight ? "rgba(0,0,0,0.03)" : "var(--paper-alt)"
  const borderColor = isLight ? "rgba(0,0,0,0.12)" : "var(--rule)"
  const borderSoftColor = isLight ? "rgba(0,0,0,0.08)" : "var(--rule-soft)"
  const textPrimary = isLight ? "#050505" : "var(--ink)"
  const textSecondary = isLight ? "#3D3D3D" : "var(--ink-2)"
  const textDim = isLight ? "#696969" : "var(--ink-dim)"
  const textPath = isLight ? "#050505" : "var(--lime-ink)"
  const textOrdActive = isLight ? "#050505" : "var(--lime-ink)"

  return (
    <div
      className="aiox-docs-shell grid min-h-0 flex-1 gap-3 px-3 pb-6 pt-3 sm:gap-4 sm:px-5 sm:pb-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-6 lg:pt-4"
      style={isLight ? undefined : observatoryDarkThemeVars}
    >
      {/* Reader column */}
      <section
        className="flex min-w-0 flex-col border"
        style={{ background: bgReader, borderColor }}
      >
        {/* Toolbar */}
        <header
          className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-2.5"
          style={{ background: bgToolbar, borderColor: borderSoftColor }}
        >
          <div
            className="min-w-0 truncate text-[11px] tracking-[0.06em]"
            style={{ fontFamily: MONO_FONT, color: textPath }}
            title={path}
          >
            {path}
          </div>
          <div className="inline-flex shrink-0 items-center gap-0.5">
            <IconBtn
              onClick={toggleTheme}
              icon={isLight ? <Moon size={13} strokeWidth={1.75} /> : <Sun size={13} strokeWidth={1.75} />}
              title={isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
              ariaLabel={isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
              isLight={isLight}
            />
            <IconBtn
              onClick={copyContent}
              icon={copied ? <Check size={13} strokeWidth={2.25} /> : <Copy size={13} strokeWidth={1.75} />}
              title={copied ? "Copiado" : "Copiar markdown"}
              ariaLabel="Copiar markdown"
              isLight={isLight}
              flashState={copied ? "success" : undefined}
            />
          </div>
        </header>

        {/* Body */}
        <LightScrollArea
          ref={bodyRef}
          className="min-h-0 flex-1"
          viewportClassName="px-6 pb-12 pt-8 sm:px-10 sm:pt-12 lg:px-14"
          fadeColor={bgReader}
          style={{ background: bgReader }}
        >
          <article
            className={cn("aiox-doc-body mx-auto w-full min-w-0 max-w-[760px]", isLight && "is-light")}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={docMdComponents()}>
              {content}
            </ReactMarkdown>
            {selectedDoc?.truncated && (
              <p
                className="mt-10 border-t pt-4 text-[12px] italic"
                style={{
                  borderColor: borderSoftColor,
                  color: textDim,
                  fontFamily: SANS_FONT,
                }}
              >
                Conteúdo truncado em {formatBytes(40000)} para renderização. Veja o arquivo
                bruto em <code>{path}</code>.
              </p>
            )}
          </article>
        </LightScrollArea>
      </section>

      {/* File panel — segue tema do reader pra não quebrar continuidade visual */}
      <aside
        className="hidden flex-col border lg:flex"
        style={{ background: bgPanel, borderColor }}
      >
        <header
          className="flex shrink-0 items-baseline justify-between border-b px-5 py-3"
          style={{ background: bgPanelHeader, borderColor: borderSoftColor }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: textDim, fontFamily: MONO_FONT }}
          >
            <FolderOpen size={11} className="mr-1.5 inline" />
            Arquivos
          </span>
          <span
            className="text-[10px] font-bold tracking-[0.1em]"
            style={{
              color: isLight ? "#050505" : "var(--lime-ink)",
              fontFamily: MONO_FONT,
            }}
          >
            {documents.length}
          </span>
        </header>
        <LightScrollArea className="min-h-0 flex-1" viewportClassName="" fadeColor={bgPanel}>
          {groups.map((group) => (
            <div key={group.key}>
              <div
                className="sticky top-0 z-10 border-b px-5 py-2 text-[9.5px] uppercase tracking-[0.2em]"
                style={{
                  background: bgPanelHeader,
                  borderColor: borderSoftColor,
                  color: textDim,
                  fontFamily: MONO_FONT,
                }}
              >
                {group.label} · {group.items.length}
              </div>
              {group.items.map((doc, idx) => {
                const active = doc.file === selectedFile
                return (
                  <button
                    key={doc.file}
                    type="button"
                    onClick={() => selectFile(doc.file)}
                    className="grid w-full grid-cols-[34px_minmax(0,1fr)_14px] items-center gap-3 border-b px-5 py-3 text-left transition-colors"
                    style={{
                      background: active ? bgPanelActive : "transparent",
                      borderColor: borderSoftColor,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLButtonElement).style.background = bgPanelHover
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"
                    }}
                  >
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{
                        color: active ? textOrdActive : textDim,
                        fontFamily: MONO_FONT,
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <span
                        className="truncate text-[13px] font-semibold"
                        style={{
                          color: active ? textPrimary : textSecondary,
                          fontFamily: SANS_FONT,
                        }}
                      >
                        {prettifyDocTitle(doc.file)}
                      </span>
                      <span
                        className="truncate text-[10.5px]"
                        style={{
                          color: active ? textSecondary : textDim,
                          fontFamily: MONO_FONT,
                        }}
                      >
                        {doc.phase} · {formatBytes(doc.bytes)}
                      </span>
                    </span>
                    <FileText
                      size={12}
                      style={{ color: active ? textOrdActive : textDim }}
                    />
                  </button>
                )
              })}
            </div>
          ))}
        </LightScrollArea>
      </aside>

      <style jsx global>{`
        .aiox-doc-body h1 {
          font-family: var(--font-bb-display), system-ui, sans-serif;
          font-weight: 800;
          font-size: 36px;
          line-height: 1.05;
          letter-spacing: -0.03em;
          color: var(--ink);
          margin: 0 0 18px;
          text-transform: none;
        }
        .aiox-doc-body h2 {
          font-family: var(--font-bb-display), system-ui, sans-serif;
          font-weight: 800;
          font-size: 26px;
          line-height: 1.1;
          letter-spacing: -0.025em;
          color: var(--ink);
          margin: 32px 0 14px;
          text-transform: none;
        }
        .aiox-doc-body h3 {
          font-family: var(--font-bb-mono), ui-monospace, monospace;
          font-weight: 700;
          font-size: 12px;
          color: var(--lime-ink);
          margin: 28px 0 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .aiox-doc-body p {
          font-family: var(--font-bb-sans), system-ui, sans-serif;
          font-size: 15px;
          color: var(--ink-2);
          line-height: 1.7;
          margin: 0 0 16px;
        }
        .aiox-doc-body p strong,
        .aiox-doc-body li strong {
          color: var(--ink);
          font-weight: 600;
        }
        .aiox-doc-body ul {
          margin: 12px 0 18px;
          padding-left: 0;
          list-style: none;
        }
        .aiox-doc-body ul li {
          position: relative;
          padding-left: 22px;
          font-family: var(--font-bb-sans), system-ui, sans-serif;
          font-size: 14.5px;
          color: var(--ink-2);
          line-height: 1.7;
          margin: 6px 0;
        }
        .aiox-doc-body ul li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 12px;
          width: 8px;
          height: 1px;
          background: var(--lime-ink);
        }
        .aiox-doc-body ol {
          margin: 12px 0 18px;
          padding-left: 22px;
        }
        .aiox-doc-body ol li {
          font-family: var(--font-bb-sans), system-ui, sans-serif;
          font-size: 14.5px;
          color: var(--ink-2);
          line-height: 1.7;
          margin: 6px 0;
        }
        .aiox-doc-body code {
          font-family: var(--font-bb-mono), ui-monospace, monospace;
          font-size: 12.5px;
          color: var(--lime-ink);
          background: var(--paper-deep);
          border: 1px solid var(--rule-soft);
          padding: 1px 6px;
        }
        .aiox-doc-body pre {
          margin: 16px 0;
          padding: 16px 18px;
          background: var(--paper-deep);
          border: 1px solid var(--rule-soft);
          overflow-x: auto;
          font-family: var(--font-bb-mono), ui-monospace, monospace;
          font-size: 12.5px;
          line-height: 1.55;
        }
        .aiox-doc-body pre code {
          background: transparent;
          border: 0;
          padding: 0;
          color: var(--ink-2);
        }
        .aiox-doc-body blockquote {
          border-left: 2px solid var(--lime-ink);
          padding-left: 16px;
          margin: 16px 0;
          color: var(--ink-2);
          font-style: italic;
        }
        .aiox-doc-body table {
          border-collapse: collapse;
          margin: 16px 0;
          font-family: var(--font-bb-sans), system-ui, sans-serif;
          font-size: 13px;
          width: 100%;
        }
        .aiox-doc-body th,
        .aiox-doc-body td {
          border: 1px solid var(--rule-soft);
          padding: 8px 12px;
          text-align: left;
        }
        .aiox-doc-body th {
          background: var(--paper-deep);
          font-weight: 600;
          color: var(--ink);
          font-family: var(--font-bb-mono), ui-monospace, monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .aiox-doc-body a {
          color: var(--lime-ink);
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: var(--lime-ink);
          text-decoration-thickness: 1px;
        }
        .aiox-doc-body a:hover {
          background: var(--lime-ink);
          color: #1a1502;
        }
        .aiox-doc-body hr {
          border: 0;
          border-top: 1px solid var(--rule-soft);
          margin: 28px 0 32px;
        }

        /* ─── Light mode (AIOX Dash v2 .doc-reader.light port) ─── */
        .aiox-doc-body.is-light {
          color: #3D3D3D;
        }
        .aiox-doc-body.is-light h1,
        .aiox-doc-body.is-light h2 {
          color: #050505 !important;
        }
        .aiox-doc-body.is-light h3 {
          color: #3D3D3D !important;
          opacity: 0.9;
        }
        .aiox-doc-body.is-light p,
        .aiox-doc-body.is-light ul li,
        .aiox-doc-body.is-light ol li {
          color: #3D3D3D !important;
        }
        .aiox-doc-body.is-light p strong,
        .aiox-doc-body.is-light li strong,
        .aiox-doc-body.is-light p b,
        .aiox-doc-body.is-light li b {
          color: #050505 !important;
        }
        .aiox-doc-body.is-light code {
          background: rgba(0, 0, 0, 0.06) !important;
          color: #050505 !important;
          border: 1px solid rgba(0, 0, 0, 0.12) !important;
          font-weight: 500;
        }
        .aiox-doc-body.is-light pre {
          background: rgba(0, 0, 0, 0.04) !important;
          border: 1px solid rgba(0, 0, 0, 0.10) !important;
        }
        .aiox-doc-body.is-light pre code {
          background: transparent !important;
          border: 0 !important;
          color: #050505 !important;
        }
        .aiox-doc-body.is-light ul li::before {
          background: #050505 !important;
        }
        .aiox-doc-body.is-light a {
          color: #050505 !important;
          text-decoration-color: rgba(0, 0, 0, 0.4) !important;
        }
        .aiox-doc-body.is-light a:hover {
          background: #050505 !important;
          color: #f4f4e8 !important;
        }
        .aiox-doc-body.is-light blockquote {
          border-left-color: #050505 !important;
          color: #3D3D3D !important;
        }
        .aiox-doc-body.is-light table th {
          background: rgba(0, 0, 0, 0.05) !important;
          color: #050505 !important;
          border-color: rgba(0, 0, 0, 0.15) !important;
        }
        .aiox-doc-body.is-light table td {
          color: #3D3D3D !important;
          border-color: rgba(0, 0, 0, 0.10) !important;
        }
        .aiox-doc-body.is-light hr {
          border-top-color: rgba(0, 0, 0, 0.15) !important;
        }
      `}</style>
    </div>
  )
}

/* Icon-only minimal toolbar button (28x28). Light + dark variants.
   Decision: aiox-ux-designer (Trinity) — 13px ícone preserva hierarquia vs
   doc-path mono 11px; hover lime em dark / dark-fill em light mantém tom
   minimalista AIOX. Foco visível via ring-1 sutil. WCAG 1.4.11 + 2.5.5. */
function IconBtn({
  onClick,
  icon,
  title,
  ariaLabel,
  isLight,
  active = false,
  flashState,
}: {
  onClick: () => void
  icon: React.ReactNode
  title: string
  ariaLabel: string
  isLight: boolean
  active?: boolean
  flashState?: "success"
}) {
  const base =
    "inline-flex h-7 w-7 items-center justify-center border transition-[color,background-color,border-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 active:scale-[0.96]"

  const variant = isLight
    ? active || flashState === "success"
      ? "border-[#050505] bg-[#050505] text-[#f4f4e8] focus-visible:ring-[#050505]"
      : "border-[rgba(0,0,0,0.08)] bg-transparent text-[#3D3D3D] hover:border-[rgba(0,0,0,0.25)] hover:text-[#050505] focus-visible:ring-[rgba(0,0,0,0.35)]"
    : active || flashState === "success"
      ? "border-[var(--lime-ink)] bg-[var(--lime-ink)]/15 text-[var(--lime-ink)] focus-visible:ring-[var(--lime-ink)]"
      : "border-[var(--rule-soft)] bg-transparent text-[var(--ink-3)] hover:border-[var(--rule)] hover:text-[var(--lime-ink)] focus-visible:ring-[var(--lime-ink)]"

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active || undefined}
      className={cn(base, variant)}
    >
      <span aria-hidden="true" className="grid place-items-center">
        {icon}
      </span>
    </button>
  )
}

function prettifyDocTitle(filename: string): string {
  const stem = filename.replace(/.*\//, "").replace(/\.[^.]+$/, "")
  const lower = stem.toLowerCase()
  if (lower === "readme") return "README"
  if (lower === "index") return "Index"
  if (lower === "license") return "License"
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAdr\b/i, "ADR")
    .replace(/\bYaml\b/i, "YAML")
    .replace(/\bJson\b/i, "JSON")
    .replace(/\bUx\b/i, "UX")
    .replace(/\bUi\b/i, "UI")
}

function orderDocumentsByPriority(docs: ObservatoryDocument[]): ObservatoryDocument[] {
  const priority = (file: string) => {
    if (/^(README|INDEX)\.md$/i.test(file)) return 0
    if (/executive-report/i.test(file)) return 1
    if (/scorecard|comparison|matrix/i.test(file)) return 2
    if (/decision|action-plan|roadmap/i.test(file)) return 3
    if (/sources|claims|risk|evidence/i.test(file)) return 4
    if (/playbook|battle/i.test(file)) return 5
    if (file.startsWith("deep/")) return 6
    if (/\.mmd$/i.test(file)) return 7
    if (/\.(json|yaml|yml)$/i.test(file)) return 8
    return 9
  }
  return [...docs].sort((a, b) => priority(a.file) - priority(b.file) || a.file.localeCompare(b.file))
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function withoutDocNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const { node: _node, ...rest } = props
  return rest
}

function docMdComponents(): Record<string, any> {
  return {
    h1: (props: any) => <h1 {...withoutDocNode(props)} />,
    h2: (props: any) => <h2 {...withoutDocNode(props)} />,
    h3: (props: any) => <h3 {...withoutDocNode(props)} />,
    p: (props: any) => <p {...withoutDocNode(props)} />,
    ul: (props: any) => <ul {...withoutDocNode(props)} />,
    ol: (props: any) => <ol {...withoutDocNode(props)} />,
    li: (props: any) => <li {...withoutDocNode(props)} />,
    code: (props: any) => <code {...withoutDocNode(props)} />,
    pre: (props: any) => <pre {...withoutDocNode(props)} />,
    blockquote: (props: any) => <blockquote {...withoutDocNode(props)} />,
    table: (props: any) => <table {...withoutDocNode(props)} />,
    a: (props: any) => {
      const rest = withoutDocNode(props)
      return (
      <a
        target={String(rest.href || "").startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        {...rest}
      />
      )
    },
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
