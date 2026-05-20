import type { CSSProperties } from "react"
import type { Metadata } from "next"
import { getResearchCliDiscovery } from "@/lib/research-cli.server"
import type { ResearchCliStatus } from "@/lib/research-workbench-contract"
import { DISPLAY_FONT, MONO_FONT, SANS_FONT } from "@/components/observatory/foundations/theme"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Status dos CLIs · AIOX Research",
  description: "Diagnóstico real dos runtimes locais usados pelo AIOX Research.",
}

const STATUS_THEME = {
  "--paper": "#050505",
  "--surface": "#0F0F11",
  "--surface-console": "#111113",
  "--ink": "rgb(244, 244, 232)",
  "--ink-2": "rgba(244, 244, 232, 0.70)",
  "--ink-3": "rgba(244, 244, 232, 0.55)",
  "--ink-dim": "rgba(245, 244, 231, 0.40)",
  "--rule": "rgba(156, 156, 156, 0.15)",
  "--lime": "#D1FF00",
  "--blue": "#0099FF",
  "--danger": "#EF4444",
  "--warning": "#F59E0B",
} as CSSProperties

export default async function ResearchRuntimeStatusPage() {
  const discovery = await getResearchCliDiscovery()
  const runnable = discovery.clis.filter((cli) => cli.available && cli.launchSupported).length
  const brokenCandidates = discovery.clis.reduce(
    (total, cli) => total + cli.candidates.filter((candidate) => !candidate.ok).length,
    0,
  )

  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-8 text-[var(--ink)] lg:px-10" style={{ ...STATUS_THEME, fontFamily: SANS_FONT }}>
      <section className="mx-auto grid w-full max-w-[1120px] gap-8">
        <header className="grid gap-6 border border-[var(--rule)] bg-[var(--surface)] p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--lime)]" style={{ fontFamily: MONO_FONT }}>
              AIOX Research · runtime status
            </p>
            <h1 className="mt-3 text-[34px] font-black uppercase leading-none text-[var(--ink)] md:text-[48px]" style={{ fontFamily: DISPLAY_FONT }}>
              CLIs locais
            </h1>
            <p className="mt-4 max-w-[720px] text-[13px] leading-[1.6] text-[var(--ink-2)]">
              Esta página usa a mesma detecção do executor de pesquisa. Se um wrapper existir mas falhar no probe de versão, ele aparece como candidato quebrado e não é usado para rodar pesquisas.
            </p>
          </div>
          <div className="grid min-w-[220px] gap-[1px] bg-[var(--rule)]">
            <Metric label="Workspace" value={compactPath(discovery.workspaceRoot)} />
            <Metric label="Runtimes prontos" value={`${runnable}/${discovery.clis.length}`} />
            <Metric label="Candidatos quebrados" value={String(brokenCandidates)} />
            <Metric label="Detectado em" value={formatTimestamp(discovery.generatedAt)} />
          </div>
        </header>

        <section className="grid gap-[1px] bg-[var(--rule)]">
          {discovery.clis.map((cli) => (
            <RuntimeStatusCard key={cli.id} cli={cli} />
          ))}
        </section>

        <nav className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.14em]" style={{ fontFamily: MONO_FONT }}>
          <a className="border border-[var(--rule)] px-4 py-3 text-[var(--ink-3)] hover:border-[var(--lime)] hover:text-[var(--ink)]" href="/research">
            Voltar para pesquisa
          </a>
          <a className="bg-[var(--lime)] px-4 py-3 font-bold text-black" href="/research/status">
            Redetectar agora
          </a>
        </nav>
      </section>
    </main>
  )
}

function RuntimeStatusCard({ cli }: { cli: ResearchCliStatus }) {
  const health = cli.available ? (cli.launchSupported ? "pronto" : "inventário") : cli.candidates.length > 0 ? "probe falhou" : "não encontrado"
  const statusColor =
    cli.available && cli.launchSupported
      ? "text-[var(--lime)]"
      : cli.candidates.length > 0
        ? "text-[var(--danger)]"
        : "text-[var(--warning)]"

  return (
    <article className="grid gap-5 bg-[var(--surface)] p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          {cli.id}
        </p>
        <h2 className="mt-2 text-[24px] font-black uppercase text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
          {cli.name}
        </h2>
        <p className={`mt-3 text-[10px] font-bold uppercase tracking-[0.14em] ${statusColor}`} style={{ fontFamily: MONO_FONT }}>
          {health}
        </p>
      </div>

      <div className="grid min-w-0 gap-4">
        <div className="grid gap-[1px] bg-[var(--rule)] md:grid-cols-2">
          <Metric label="Versão ativa" value={cli.version ?? "sem versão válida"} />
          <Metric label="Path ativo" value={cli.path ?? "nenhum candidato aprovado"} />
          <Metric label="Launcher" value={cli.launchSupported ? launchCommandFor(cli.id) : cli.launchHint} />
          <Metric label="Instalação" value={cli.available ? "probe OK" : cli.installHint} />
        </div>

        <div className="border border-[var(--rule)] bg-[var(--surface-console)]">
          <div className="border-b border-[var(--rule)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
              Candidatos testados
            </p>
          </div>
          {cli.candidates.length > 0 ? (
            <div className="grid">
              {cli.candidates.map((candidate, index) => (
                <div key={`${candidate.path}-${index}`} className="grid gap-2 border-b border-[var(--rule)] px-4 py-3 last:border-b-0 md:grid-cols-[86px_minmax(0,1fr)]">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-[0.14em] ${candidate.ok ? "text-[var(--lime)]" : "text-[var(--danger)]"}`}
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {candidate.ok ? "ok" : "falhou"}
                  </span>
                  <div className="min-w-0">
                    <p className="break-all text-[11px] text-[var(--ink-2)]" style={{ fontFamily: MONO_FONT }}>
                      {candidate.path}
                    </p>
                    <p className="mt-1 break-words text-[11px] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
                      {candidate.version ?? candidate.error ?? "sem detalhe"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-4 text-[11px] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
              Nenhum executável encontrado no PATH do servidor nem nos diretórios conhecidos.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[var(--paper)] px-4 py-3">
      <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
        {label}
      </p>
      <p className="mt-1 truncate text-[12px] text-[var(--ink)]" title={value} style={{ fontFamily: MONO_FONT }}>
        {value}
      </p>
    </div>
  )
}

function launchCommandFor(cliId: ResearchCliStatus["id"]) {
  if (cliId === "claude") return "claude -p --permission-mode bypassPermissions"
  if (cliId === "codex") return "codex exec --skip-git-repo-check --sandbox workspace-write"
  if (cliId === "gemini") return "gemini --yolo"
  if (cliId === "research-core") return "node --experimental-strip-types apps/research/packages/research-core/src/cli.ts"
  if (cliId === "byok") return "OpenRouter CLI"
  return "launcher não habilitado"
}

function compactPath(value: string) {
  const home = process.env.HOME
  return home ? value.replace(home, "~") : value
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
