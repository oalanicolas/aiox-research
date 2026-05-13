import { Fragment, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import {
  FlowPlaybook,
  type PlaybookEdge,
  type PlaybookNode,
  type PlaybookNodeCategory,
} from "../../brandbook-sections/user-flow/flow-playbook"
import {
  FlowMap,
  type FlowMapEdge,
  type FlowMapGroup,
} from "../../brandbook-sections/user-flow/flow-map"
import type { ObservatoryTypeSpecific } from "../foundations/types"
import { DISPLAY_FONT, MONO_FONT } from "../foundations/theme"
import { LightScrollArea } from "../molecules/light-scroll-area"

type Tone = "neutral" | "good" | "warn" | "danger"
type SinkraPilotMap = NonNullable<NonNullable<ObservatoryTypeSpecific["sinkra"]>["observatoryMap"]>
type SinkraCompliance = NonNullable<ObservatoryTypeSpecific["sinkra"]>["compliance"]
type SinkraScoreBreakdownItem = SinkraCompliance["scoreBreakdown"][number]
type SinkraRemediationItem = SinkraCompliance["remediationItems"][number]

const SINKRA_DARK_THEME = {
  "--paper": "var(--aiox-dark, #050505)",
  "--paper-alt": "var(--aiox-surface, #0f0f11)",
  "--paper-deep": "var(--aiox-surface-hover, #171719)",
  "--ink": "var(--aiox-cream-alt, #f5f4e7)",
  "--ink-2": "rgba(245, 244, 231, 0.74)",
  "--ink-3": "rgba(245, 244, 231, 0.48)",
  "--ink-dim": "rgba(245, 244, 231, 0.3)",
  "--ink-faint": "rgba(245, 244, 231, 0.16)",
  "--rule": "var(--aiox-border, rgba(245, 244, 231, 0.13))",
  "--rule-soft": "var(--aiox-border-soft, rgba(245, 244, 231, 0.08))",
  "--rule-strong": "var(--aiox-border-strong, rgba(245, 244, 231, 0.26))",
  "--lime-ink": "var(--aiox-lime, #d1ff00)",
  "--lime-fill": "var(--aiox-lime, #d1ff00)",
  "--warning-ink": "var(--aiox-error, #ef4444)",
} as CSSProperties

function shortText(value: string, max = 180) {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length > max ? `${text.slice(0, max).trim()}...` : text
}

function countBy(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--"
  return value <= 1 ? `${Math.round(value * 100)}%` : `${Math.round(value)}%`
}

function secondsLabel(value: number | null | undefined) {
  if (!value) return "--"
  const minutes = Math.floor(value / 60)
  const seconds = Math.round(value % 60)
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function moneyLabel(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--"
  return `$${value.toFixed(2)}`
}

function numberLabel(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--"
  return new Intl.NumberFormat("pt-BR").format(Math.round(value))
}

function maxMetric(values: Array<number | null | undefined>, fallback = 1) {
  return Math.max(...values.map((value) => value ?? 0), fallback)
}

function remediationEta(priority: string, action: string) {
  const text = `${priority} ${action}`.toLowerCase()
  if (priority === "P0") return "1 semana"
  if (/baseline|scorer|publicador|readiness|projeção/.test(text)) return "2-4 semanas"
  if (priority === "P1") return "30 dias"
  return "próximo ciclo"
}

function remediationWeeks(priority: string, action: string) {
  const text = `${priority} ${action}`.toLowerCase()
  if (priority === "P0") return { start: 1, span: 1, label: "1 sem" }
  if (/baseline|kpi|medição/.test(text)) return { start: 2, span: 4, label: "4 sem" }
  if (/publicador|readiness|worker|scorer|projeção/.test(text)) return { start: 2, span: 3, label: "3 sem" }
  if (priority === "P1") return { start: 2, span: 2, label: "2 sem" }
  return { start: 5, span: 2, label: "2 sem" }
}

function phaseLabel(value: string) {
  return value
    .replace(/^phase\d+-/, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
}

function humanizeProcessLabel(value: string) {
  return value
    .replace(/^atm_/, "")
    .replace(/^org_/, "")
    .replace(/^qg_/, "gate ")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function humanizeSentence(value: string) {
  const text = humanizeProcessLabel(value)
    .replace(/\bAtm\b/g, "")
    .replace(/\bQG\b/g, "Gate")
    .replace(/\s+/g, " ")
    .trim()
  return text || "Etapa sem descrição humana"
}

function summarizeExecutors(values: string[]) {
  const unique = Array.from(new Set(values.filter(Boolean)))
  if (unique.length === 0) return "sem executor"
  if (unique.length <= 2) return unique.join(" + ")
  return `${unique.slice(0, 2).join(" + ")} +${unique.length - 2}`
}

function workflowHumanSignal(outputs: number, controls: number, steps: number) {
  if (outputs === 0) return "Esta etapa ainda não declara uma entrega verificável."
  if (controls === 0) return "Tem entrega, mas ainda falta explicitar o controle de qualidade."
  if (controls >= steps) return "Cada movimento relevante tem algum controle associado."
  return "Há controles declarados, mas nem todos os movimentos estão cobertos."
}

function workflowHumanAttention(outputs: number, controls: number, steps: number) {
  if (outputs === 0) return "Definir qual evidência prova que esta etapa terminou."
  if (controls === 0) return "Adicionar critério de aceite antes de automatizar."
  if (steps > 4) return "Separar decisões humanas de execução repetível."
  return "Validar se a entrega pode ser consumida pela próxima etapa sem contexto oral."
}

function scoreTone(score: number | null | undefined, max: number | null | undefined = 100): Tone {
  if (score === null || score === undefined) return "neutral"
  const ratio = score / Math.max(max ?? 100, 1)
  if (ratio >= 0.9) return "good"
  if (ratio >= 0.75) return "warn"
  return "danger"
}

const ICON_ROUTE = "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"
const ICON_TASK = "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
const ICON_GATE = "M12 2 22 12 12 22 2 12 12 2Z"
const ICON_WAIT = "M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
const ICON_END = "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"

function playbookCategoryForStep(step: SinkraPilotMap["criticalPath"][number], index: number, total: number): PlaybookNodeCategory {
  const text = `${step.step} ${step.task} ${step.note}`.toLowerCase()
  if (index === 0) return "start"
  if (index === total - 1) return "end"
  if (step.state === "risk" || /gate|review|valid|decision|condition|bloque/.test(text)) return "condition"
  if (/wait|handoff|sync|aguard|fila/.test(text)) return "wait"
  return "action"
}

function playbookIcon(category: PlaybookNodeCategory) {
  if (category === "start") return ICON_ROUTE
  if (category === "condition") return ICON_GATE
  if (category === "wait") return ICON_WAIT
  if (category === "end") return ICON_END
  return ICON_TASK
}

function buildJourneyPlaybook(pilot: SinkraPilotMap): { nodes: PlaybookNode[]; edges: PlaybookEdge[]; width: number; height: number } {
  const gapX = 210
  const startX = 64
  const mainY = 190
  const gateY = 64
  const riskY = 322
  const actionY = 470
  const mainNodes: PlaybookNode[] = pilot.criticalPath.map((step, index) => {
    const category = playbookCategoryForStep(step, index, pilot.criticalPath.length)
    return {
      id: `step-${index}`,
      label: shortText(step.step, 28),
      sublabel: shortText(`${step.executor} · ${step.task}`, 34),
      x: startX + index * gapX,
      y: mainY,
      category,
      icon: playbookIcon(category),
      index: `#${index + 1}`,
      active: step.state === "risk" || index === 0,
    }
  })

  const gateNodes: PlaybookNode[] = pilot.gateBoard.slice(0, 5).map((gate, index) => ({
    id: `gate-${index}`,
    label: shortText(gate.title, 26),
    sublabel: shortText(`${gate.status} · ${gate.owner}`, 34),
    x: startX + index * gapX,
    y: gateY,
    category: "condition",
    icon: ICON_GATE,
    index: gate.id,
    active: gate.status !== "PASS" || gate.veto,
  }))

  const riskNodes: PlaybookNode[] = pilot.risks.slice(0, 4).map((risk, index) => ({
    id: `risk-${index}`,
    label: shortText(risk.title, 26),
    sublabel: shortText(`${risk.severity} · bloqueio`, 34),
    x: startX + (index + 0.5) * gapX,
    y: riskY,
    category: "condition",
    icon: ICON_GATE,
    index: risk.id,
    active: true,
  }))

  const actionNodes: PlaybookNode[] = pilot.nextActions.slice(0, 4).map((action, index) => ({
    id: `action-${index}`,
    label: shortText(action.title, 28),
    sublabel: shortText(`${action.owner} · ${action.targetArtifact}`, 34),
    x: startX + (index + 0.5) * gapX,
    y: actionY,
    category: index === pilot.nextActions.length - 1 ? "end" : "action",
    icon: index === pilot.nextActions.length - 1 ? ICON_END : ICON_TASK,
    index: action.priority,
    active: index === 0,
  }))

  const mainEdges: PlaybookEdge[] = pilot.criticalPath.slice(1).map((step, index) => ({
    from: `step-${index}`,
    to: `step-${index + 1}`,
    label: step.state,
  }))

  const gateEdges: PlaybookEdge[] = gateNodes.map((_, index) => ({
    from: `gate-${index}`,
    to: `step-${Math.min(index, Math.max(0, mainNodes.length - 1))}`,
    label: "controls",
  }))

  const riskEdges: PlaybookEdge[] = riskNodes.map((_, index) => ({
    from: `step-${Math.min(index + 1, Math.max(0, mainNodes.length - 1))}`,
    to: `risk-${index}`,
    label: "risk",
  }))

  const actionEdges: PlaybookEdge[] = actionNodes.map((_, index) => ({
    from: riskNodes[index]?.id ?? `step-${Math.min(index + 1, Math.max(0, mainNodes.length - 1))}`,
    to: `action-${index}`,
    label: "fix",
  }))

  const actionChainEdges: PlaybookEdge[] = actionNodes.slice(1).map((_, index) => ({
    from: `action-${index}`,
    to: `action-${index + 1}`,
    label: "then",
  }))

  const nodes = [...gateNodes, ...mainNodes, ...riskNodes, ...actionNodes]
  const edges = [...mainEdges, ...gateEdges, ...riskEdges, ...actionEdges, ...actionChainEdges]

  return {
    nodes,
    edges,
    width: Math.max(1160, startX * 2 + Math.max(pilot.criticalPath.length, pilot.gateBoard.length, pilot.risks.length + 1, pilot.nextActions.length + 1) * gapX),
    height: 580,
  }
}

function buildOperationsFlowMap(pilot: SinkraPilotMap): { groups: FlowMapGroup[]; edges: FlowMapEdge[]; width: number; height: number } {
  const laneGroups: FlowMapGroup[] = pilot.lanes.map((lane, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const items = [
      `${lane.taskCount} tasks`,
      lane.owner,
      shortText(lane.signal, 54),
    ]
    if (lane.risk) items.push(shortText(lane.risk, 54))
    return {
      id: `lane-${index}`,
      label: shortText(lane.title, 28),
      items,
      x: 40 + col * 250,
      y: 70 + row * 190,
      width: 210,
      active: index === 0,
      activeItems: lane.risk ? [2, 3] : [2],
    }
  })

  const gateGroups: FlowMapGroup[] = pilot.gateBoard.slice(0, 3).map((gate, index) => ({
    id: `gate-map-${index}`,
    label: shortText(gate.title, 28),
    items: [
      gate.status,
      gate.owner,
      shortText(gate.blocks, 54),
    ],
    x: 850,
    y: 70 + index * 170,
    width: 220,
    active: gate.status !== "PASS" || gate.veto,
    activeItems: gate.status !== "PASS" ? [0, 2] : [0],
  }))

  const riskGroup: FlowMapGroup | null = pilot.risks.length > 0
    ? {
        id: "risk-map",
        label: "Risk Register",
        items: pilot.risks.slice(0, 5).map((risk) => shortText(`${risk.severity}: ${risk.title}`, 58)),
        x: 590,
        y: 500,
        width: 250,
        active: true,
        activeItems: pilot.risks.map((_, index) => index),
      }
    : null

  const actionGroup: FlowMapGroup | null = pilot.nextActions.length > 0
    ? {
        id: "action-map",
        label: "Action Queue",
        items: pilot.nextActions.slice(0, 5).map((action) => shortText(`${action.priority}: ${action.title}`, 58)),
        x: 850,
        y: 560,
        width: 250,
        active: true,
        activeItems: [0],
      }
    : null

  const groups = [...laneGroups, ...gateGroups, ...(riskGroup ? [riskGroup] : []), ...(actionGroup ? [actionGroup] : [])]
  const laneEdges: FlowMapEdge[] = laneGroups.slice(1).map((_, index) => ({
    from: `lane-${index}`,
    to: `lane-${index + 1}`,
    label: "handoff",
  }))
  const gateEdges: FlowMapEdge[] = gateGroups.map((_, index) => ({
    from: `lane-${Math.min(index, Math.max(0, laneGroups.length - 1))}`,
    to: `gate-map-${index}`,
    label: "controls",
  }))
  const riskEdges: FlowMapEdge[] = riskGroup
    ? laneGroups.slice(0, Math.min(3, laneGroups.length)).map((lane) => ({
        from: lane.id,
        to: "risk-map",
        label: "risk",
      }))
    : []
  const actionEdges: FlowMapEdge[] = riskGroup && actionGroup
    ? [{ from: "risk-map", to: "action-map", label: "fix" }]
    : []

  return {
    groups,
    edges: [...laneEdges, ...gateEdges, ...riskEdges, ...actionEdges],
    width: 1160,
    height: 760,
  }
}

export function SinkraMapReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const phases = sinkra?.processPhases ?? []
  const domains = sinkra?.domains ?? []
  const dependencies = sinkra?.dependencies
  const artifactCoverage = sinkra?.artifactCoverage ?? []
  const pilot = sinkra?.observatoryMap ?? null
  const gates = sinkra?.gates ?? []
  const workflows = sinkra?.workflows ?? []
  const tasks = sinkra?.tasks ?? []
  const score = sinkra?.score.score
  const presentArtifacts = artifactCoverage.filter((item) => item.present).length
  const missingArtifacts = artifactCoverage.filter((item) => !item.present)
  const driftPhases = phases.filter((phase) => phase.hasDrift)
  const stablePhases = phases.length - driftPhases.length
  const vetoGates = gates.filter((gate) => gate.veto)
  const loopNodes = dependencies?.nodes.filter((node) => node.loop) ?? []
  const topDomains = [...domains].sort((a, b) => b.total - a.total)
  const taskLayers = countBy(tasks.map((task) => task.layer || "sem layer"))
  const taskExecutors = countBy(tasks.map((task) => task.executor || "sem executor"))
  const gateTypes = countBy(gates.map((gate) => gate.type || "gate"))
  const hasOperationalData = phases.length > 0 || workflows.length > 0 || tasks.length > 0 || gates.length > 0 || domains.length > 0 || (dependencies?.nodes.length ?? 0) > 0
  const healthTone: Tone = missingArtifacts.length === 0 && driftPhases.length === 0 ? "good" : driftPhases.length > 6 ? "danger" : "warn"
  const healthLabel = pilot?.healthLabel || (!hasOperationalData ? "incompleto" : healthTone === "good" ? "estável" : healthTone === "danger" ? "crítico" : "atenção")

  if (pilot) {
    return (
      <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
        <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
          <ExecutiveDarkDeck pilot={pilot} sinkra={sinkra} />
        </article>
      </LightScrollArea>
    )
  }

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <section className="grid overflow-hidden border border-[#f5f4e7]/16 bg-[#050505] lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-[#10110d] p-6 text-[#f5f4e7] sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#f5f4e7]/62" style={{ fontFamily: MONO_FONT }}>
              SINKRA operational map
            </p>
            <h2 className="mt-3 max-w-[920px] text-[38px] font-black leading-[0.95] tracking-[-0.055em] sm:text-[48px]" style={{ fontFamily: DISPLAY_FONT }}>
              {sinkra?.processName || "Mapa SINKRA"}
            </h2>
            <p className="mt-5 max-w-[780px] text-[16px] leading-[1.62] text-[#f5f4e7]/78">
              Relatório executivo gerado a partir dos artefatos em outputs/sinkra-squad: processo, domínio, dependências, workflow, tasks, gates e score.
            </p>
            <div className="mt-8 grid gap-px bg-[#f5f4e7]/18 sm:grid-cols-4">
              <HeroMetric label="Score" value={score === null || score === undefined ? "--" : String(score)} />
              <HeroMetric label="Resultado" value={sinkra?.score.result || "--"} />
              <HeroMetric label="Versão" value={sinkra?.version || "--"} />
              <HeroMetric label="Modo" value={sinkra?.mode || "--"} />
            </div>
          </div>

          <aside className="grid content-between gap-5 bg-[#d1ff00] p-6 text-[#050505] sm:p-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] opacity-65" style={{ fontFamily: MONO_FONT }}>
                Diagnóstico
              </p>
              <div className="mt-2 text-[44px] font-black leading-none tracking-[-0.055em]" style={{ fontFamily: DISPLAY_FONT }}>
                {healthLabel}
              </div>
              <p className="mt-4 text-[15.5px] font-bold leading-[1.52]">
                {!hasOperationalData
                  ? "Este output tem pouca estrutura para análise operacional. Gere process_map, workflow_definition, task_definitions, quality_gates, domain_map e dependency_graph."
                  : driftPhases.length > 0
                  ? `${driftPhases.length} fases apresentam drift ou dor operacional.`
                  : "Nenhuma fase com drift operacional detectado neste mapeamento."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-[#050505]/18">
              <Signal label="Artefatos" value={`${presentArtifacts}/${artifactCoverage.length}`} tone={missingArtifacts.length === 0 ? "good" : "warn"} />
              <Signal label="Drift" value={String(driftPhases.length)} tone={driftPhases.length === 0 ? "good" : "warn"} />
              <Signal label="Veto gates" value={String(vetoGates.length)} tone={vetoGates.length > 0 ? "warn" : "neutral"} />
              <Signal label="Loops" value={String(loopNodes.length)} tone={loopNodes.length > 0 ? "warn" : "neutral"} />
            </div>
          </aside>
        </section>

        <>
        <section className="mt-6 grid gap-px bg-[var(--rule)] md:grid-cols-2 xl:grid-cols-6">
          <Kpi label="Workflows" value={String(workflows.length)} />
          <Kpi label="Tasks" value={String(tasks.length)} />
          <Kpi label="Gates" value={String(gates.length)} tone={vetoGates.length > 0 ? "warn" : "neutral"} />
          <Kpi label="Domínios" value={String(domains.length)} />
          <Kpi label="Fases OK" value={String(stablePhases)} tone="good" />
          <Kpi label="DAG" value={dependencies?.strictDag || "--"} tone={dependencies?.validated ? "good" : "warn"} />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Process intelligence" title="Drift e dor operacional" meta={`${driftPhases.length} de ${phases.length} fases`} />
            {phases.length > 0 ? (
              <div className="grid">
                {(driftPhases.length > 0 ? driftPhases : phases).slice(0, 10).map((phase, index) => (
                <article key={phase.id} className="grid gap-4 border-t border-[var(--rule-soft)] p-4 lg:grid-cols-[56px_minmax(0,1fr)_116px]">
                  <div className="text-[28px] font-black tabular-nums leading-none text-[var(--ink-dim)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {phase.id} · {phase.executor}
                    </div>
                    <h4 className="mt-1 text-[18px] font-black leading-tight tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                      {phase.name}
                    </h4>
                    <p className="mt-2 text-[13px] leading-[1.52] text-[var(--ink-2)]">
                      {shortText(phase.drift || phase.observed || "Sem drift documentado.", 300)}
                    </p>
                    {phase.painPoints.length > 0 && (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {phase.painPoints.slice(0, 4).map((point) => (
                          <span key={point} className="border-l-2 border-[var(--warning-ink)] bg-[var(--paper-alt)] px-3 py-2 text-[12px] leading-[1.42] text-[var(--ink-2)]">
                            {shortText(point, 110)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <StatusPill tone={phase.hasDrift ? "warn" : "good"} label={phase.hasDrift ? "drift" : "stable"} />
                </article>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="Sem process_map.yaml"
                body="Este run não contém fases AS-IS/TO-BE para analisar drift. Abra outro mapeamento completo ou gere process_map.yaml para habilitar esta leitura."
              />
            )}
          </section>

          <aside className="grid content-start gap-6">
            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Artifact coverage" title="Arquivos do mapa" meta={`${presentArtifacts}/${artifactCoverage.length}`} compact />
              <div className="grid gap-2 p-4">
                {artifactCoverage.map((item) => (
                  <div key={item.key} className={cn("grid grid-cols-[minmax(0,1fr)_78px] items-center gap-3 border px-3 py-2", item.present ? "border-[var(--rule-soft)] bg-[var(--paper-alt)]" : "border-[var(--warning-ink)] bg-[var(--paper)]")}>
                    <span className="truncate text-[13px] font-bold text-[var(--ink)]">{item.label}</span>
                    <span className={cn("text-right text-[9px] uppercase tracking-[0.12em]", item.present ? "text-[var(--lime-ink)]" : "text-[var(--warning-ink)]")} style={{ fontFamily: MONO_FONT }}>
                      {item.present ? "ok" : "faltando"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Dependency graph" title="DAG" meta={dependencies?.type || "--"} compact />
              <div className="grid grid-cols-2 gap-px bg-[var(--rule)]">
                <Signal label="Nodes" value={String(dependencies?.nodes.length ?? 0)} />
                <Signal label="Loops" value={String(loopNodes.length)} tone={loopNodes.length > 0 ? "warn" : "neutral"} />
                <Signal label="Roots" value={String(dependencies?.roots.length ?? 0)} />
                <Signal label="Leaves" value={String(dependencies?.leaves.length ?? 0)} />
              </div>
              {(dependencies?.nodes.length ?? 0) > 0 ? (
                <div className="grid gap-3 p-4">
                  <DependencyColumn title="Roots" values={dependencies?.roots ?? []} />
                  <DependencyColumn title="Leaves" values={dependencies?.leaves ?? []} />
                </div>
              ) : (
                <div className="p-4">
                  <MiniEmpty title="Sem dependency_graph.yaml" />
                </div>
              )}
            </section>
          </aside>
        </div>

        <section className="mt-6 border border-[var(--rule)] bg-[var(--paper)]">
          <SectionHead eyebrow="Execution blueprint" title="Workflow, tasks e gates" meta={`${workflows.length} workflows · ${tasks.length} tasks · ${gates.length} gates`} />
          <div className="grid gap-px bg-[var(--rule)] xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.75fr)_minmax(280px,0.75fr)]">
            <div className="bg-[var(--paper)] p-4">
              <div className="mb-3 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                Workflows
              </div>
              {workflows.length > 0 ? (
                <div className="grid gap-3">
                  {workflows.slice(0, 3).map((workflow) => (
                    <article key={workflow.id} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                            {workflow.id} · {workflow.layer || "layer"}
                          </div>
                          <h4 className="mt-1 truncate text-[18px] font-black tracking-[-0.03em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                            {workflow.name}
                          </h4>
                        </div>
                        <span className="text-[26px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                          {workflow.steps.length}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[12px] leading-[1.45] text-[var(--ink-2)]">
                        {workflow.description || workflow.trigger || "Sem descrição operacional."}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <MiniEmpty title="Sem workflow_definition.yaml" />
              )}
            </div>

            <DistributionPanel title="Tasks por layer" items={taskLayers} empty="Sem task_definitions.yaml" />

            <div className="bg-[var(--paper)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  Quality gates
                </div>
                {vetoGates.length > 0 && (
                  <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>
                    {vetoGates.length} veto
                  </span>
                )}
              </div>
              {gates.length > 0 ? (
                <div className="grid gap-2">
                  {gates.slice(0, 5).map((gate) => (
                    <div key={gate.id} className="grid grid-cols-[minmax(0,1fr)_72px] gap-3 border border-[var(--rule-soft)] bg-[var(--paper-alt)] px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-bold text-[var(--ink)]">{gate.name}</div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                          {gate.id} · {gate.executor || "executor"}
                        </div>
                      </div>
                      <span className={cn("self-center text-right text-[9px] uppercase tracking-[0.1em]", gate.veto ? "text-[var(--warning-ink)]" : "text-[var(--ink-3)]")} style={{ fontFamily: MONO_FONT }}>
                        {gate.veto ? "veto" : gate.threshold}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <MiniEmpty title="Sem quality_gates.yaml" />
              )}
            </div>
          </div>
          {tasks.length > 0 && (
            <div className="grid gap-px border-t border-[var(--rule)] bg-[var(--rule)] md:grid-cols-2">
              <DistributionPanel title="Tasks por executor" items={taskExecutors} compact />
              <DistributionPanel title="Gates por tipo" items={gateTypes} compact empty="Sem gates tipados" />
            </div>
          )}
        </section>

        <section className="mt-6 border border-[var(--rule)] bg-[var(--paper)]">
          <SectionHead eyebrow="Domain topology" title="Distribuição por domínio SINKRA" meta={`${domains.length} domínios`} />
          {topDomains.length > 0 ? (
            <div className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">
              {topDomains.map((domain) => (
              <article key={domain.domain} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-[20px] font-black tracking-[-0.03em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                      {domain.domain}
                    </h4>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {domain.total} items · {domain.gapClosed} gaps fechados
                    </p>
                  </div>
                  <span className="text-[34px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {domain.total}
                  </span>
                </div>
                <div className="mt-4 h-2 bg-[var(--paper-deep)]">
                  <div className="h-full bg-[var(--ink)]" style={{ width: `${Math.min(100, Math.max(8, domain.total * 4))}%` }} />
                </div>
                <div className="mt-4 grid gap-2">
                  {domain.samples.slice(0, 3).map((sample) => (
                    <div key={sample.id} className="border border-[var(--rule-soft)] bg-[var(--paper)] px-3 py-2">
                      <div className="truncate text-[9px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        {sample.id} · {sample.level}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[12px] font-bold leading-tight text-[var(--ink)]">{sample.name}</div>
                    </div>
                  ))}
                </div>
              </article>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="Sem domain_map.yaml"
              body="A topologia por domínio só aparece quando o mapeamento contém domain_map.yaml com domain_mapping."
            />
          )}
        </section>
        </>
      </article>
    </LightScrollArea>
  )
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-[var(--rule-soft)] p-8">
      <div className="max-w-[680px] border border-[var(--warning-ink)] bg-[var(--paper-alt)] p-5">
        <h4 className="text-[20px] font-black tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
          {title}
        </h4>
        <p className="mt-2 text-[14px] leading-[1.55] text-[var(--ink-2)]">{body}</p>
      </div>
    </div>
  )
}

function ExecutiveDarkDeck({ pilot, sinkra }: { pilot: SinkraPilotMap; sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const compliance = sinkra?.compliance
  const scoreBreakdown = compliance?.scoreBreakdown ?? []
  const remediation = compliance?.remediationItems ?? []
  const metrics = sinkra?.execution.metrics ?? []
  const totalCost = metrics.reduce((total, metric) => total + (metric.costUsd ?? 0), 0)
  const totalTokens = metrics.reduce((total, metric) => total + (metric.outputTokens ?? 0), 0)
  const totalDuration = metrics.reduce((total, metric) => total + (metric.durationSeconds ?? 0), 0)
  const maxCost = maxMetric(metrics.map((metric) => metric.costUsd))
  const maxTokens = maxMetric(metrics.map((metric) => metric.outputTokens))
  const maxScore = maxMetric(scoreBreakdown.map((item) => item.score))
  const automation = sinkra?.automation ?? []
  const gaps = sinkra?.gaps ?? []
  const accountability = sinkra?.accountability ?? []
  const domains = sinkra?.domains ?? []
  const artifactCoverage = sinkra?.artifactCoverage ?? []
  const p0 = remediation.find((item) => item.priority === "P0") ?? remediation[0]
  const weakest = [...scoreBreakdown].filter((item) => item.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
  const gatesOk = pilot.gateBoard.filter((gate) => gate.status === "PASS").length
  const totalExecutorTasks = pilot.executorMix.reduce((total, item) => total + item.tasks, 0)
  const blockedReadiness = pilot.readinessBars.filter((bar) => bar.status === "blocked")
  const readyReadiness = pilot.readinessBars.filter((bar) => bar.status === "ready")
  const presentArtifacts = artifactCoverage.filter((item) => item.present).length
  const automationAvg = automation.length > 0
    ? Math.round((automation.reduce((total, item) => total + (item.automatability ?? 0), 0) / automation.length) * 100)
    : null
  const accountabilityCoverage = accountability.length > 0
    ? Math.round((accountability.filter((row) => row.accountable && row.accountable !== "—").length / accountability.length) * 100)
    : null
  const domainGapClosure = domains.length > 0
    ? Math.round((domains.reduce((total, domain) => total + domain.gapClosed, 0) / Math.max(domains.reduce((total, domain) => total + domain.total, 0), 1)) * 100)
    : null
  const vetoActive = Boolean(compliance?.handoffBlocked)
  const criticalRisks = pilot.risks.filter((risk) => /critical|crítico|alta|high/i.test(risk.severity)).length
  const tldrCards = [
    {
      label: "Verdict",
      pin: "VERDICT",
      value: vetoActive ? "VETO" : "OK",
      note: vetoActive ? "Score alto, mas auto_fail bloqueia produção." : "Sem veto operacional.",
      tone: vetoActive ? "danger" as Tone : "good" as Tone,
    },
    {
      label: "Risco P0",
      pin: p0?.priority || "R1",
      value: p0?.priority || "—",
      note: p0?.finding || "Sem P0 registrado.",
      tone: p0 ? "danger" as Tone : "good" as Tone,
    },
    {
      label: "Dim crítica",
      pin: weakest?.id || "DIM",
      value: weakest?.score === null || weakest?.score === undefined ? "--" : String(weakest.score),
      note: weakest?.label || "score breakdown ausente",
      tone: scoreTone(weakest?.score, weakest?.max),
    },
    {
      label: "Economia",
      pin: "RUN",
      value: moneyLabel(totalCost),
      note: `${secondsLabel(totalDuration)} · ${numberLabel(totalTokens)} output tokens`,
      tone: "neutral" as Tone,
    },
    {
      label: "Gates",
      pin: "QG",
      value: `${gatesOk}/${pilot.gateBoard.length}`,
      note: "gates aprovados no board",
      tone: gatesOk === pilot.gateBoard.length ? "good" as Tone : "warn" as Tone,
    },
    {
      label: "Roadmap",
      pin: "P0/P1",
      value: "~5sem",
      note: "P0 + P1 para remover veto",
      tone: "good" as Tone,
    },
  ]

  return (
    <section className="aiox-grid-lines overflow-hidden bg-[#050505] text-[#f5f4e7]">
      <div className="border-b border-[#f5f4e7]/10 px-5 py-5">
        <div className="grid gap-px bg-[#f5f4e7]/10 md:grid-cols-2 xl:grid-cols-6">
          {tldrCards.map((item, index) => (
            <DarkTldr key={item.label} label={`[${String(index + 1).padStart(2, "0")}] · ${item.label}`} value={item.value} note={`${item.pin} · ${item.note}`} tone={item.tone} />
          ))}
        </div>
      </div>
      <div className="grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,1.55fr)_420px]">
        <div className="relative overflow-hidden bg-[#050505] px-6 py-10 sm:px-8 sm:py-14">
          <div className="pointer-events-none absolute -right-8 top-3 text-[90px] font-black leading-none tracking-[-0.08em] text-[#3d3d3d]/35 sm:text-[140px]" style={{ fontFamily: DISPLAY_FONT }}>
            MAP
          </div>
          <div className="relative">
          <div className="mb-5 flex flex-wrap gap-2">
            <DarkPin label="SINKRA QA" />
            <DarkPin label={compliance?.status || "status --"} tone={vetoActive ? "danger" : "good"} />
            <DarkPin label={sinkra?.mode || "greenfield"} />
            <DarkPin label="outputs/sinkra-squad" />
          </div>
          <h3 className="max-w-[1040px] text-[38px] font-black leading-[0.9] tracking-[-0.055em] sm:text-[58px] lg:text-[82px]" style={{ fontFamily: DISPLAY_FONT }}>
            Score {compliance?.currentScore ?? sinkra?.score.score ?? "--"}.<br />
            Verdict <span className="text-[#ef4444]">{vetoActive ? "VETO" : "OK"}</span>.<br />
            <span className="text-[#d1ff00]">{vetoActive ? "Blueprint aprovado, produção não." : "Mapa pronto para operação assistida."}</span>
          </h3>
          <p className="mt-6 max-w-[780px] text-[18px] leading-[1.58] text-[#f5f4e7]/62">
            {pilot.headline || pilot.decision}
          </p>
          </div>
        </div>

        <aside className="aiox-hud-frame grid content-between gap-4 bg-[#101010] p-6 sm:p-8">
          <div className="grid gap-3">
            <DarkStat label="Compliance score" value={`${compliance?.currentScore ?? sinkra?.score.score ?? "--"}/100`} tone={vetoActive ? "warn" : "good"} />
            <DarkStat label="Critical blocker" value={p0?.dimension || "—"} tone={p0 ? "danger" : "good"} />
            <DarkStat label="Pipeline cost" value={moneyLabel(totalCost)} />
            <DarkStat label="Runtime" value={secondsLabel(totalDuration)} />
          </div>
        </aside>
      </div>

      <div className={cn("border-y px-6 py-7 sm:px-8", vetoActive ? "border-[#ef4444] bg-[#120808]" : "border-[#d1ff00]/45 bg-[#071006]")}>
        <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:items-center">
          <div>
            <div className={cn("text-[11px] uppercase tracking-[0.16em]", vetoActive ? "text-[#ef4444]" : "text-[#d1ff00]")} style={{ fontFamily: MONO_FONT }}>
              veredito sinkra qa
            </div>
            <div className={cn("mt-2 text-[34px] font-black leading-none tracking-[-0.045em]", vetoActive ? "text-[#ef4444]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
              {vetoActive ? "NON-COMPLIANT" : "COMPLIANT"}
            </div>
          </div>
          <p className="text-[17px] font-bold leading-[1.62] text-[#f5f4e7]/82">
            {vetoActive
              ? `O mapa tem estrutura, gates e DAG suficientes para ser blueprint, mas não deve ser promovido enquanto ${p0?.dimension || "o bloqueio crítico"} não for resolvido.`
              : "O mapa está pronto para virar operação assistida, desde que os artefatos versionados permaneçam rastreáveis."}
          </p>
          <div className="text-left xl:text-right">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#f5b340]" style={{ fontFamily: MONO_FONT }}>desbloqueio p0</div>
            <div className="mt-2 text-[17px] font-black leading-tight text-[#f5f4e7]">{p0?.action || "Manter gates e evidências versionadas."}</div>
          </div>
        </div>
      </div>

      <div className="border-b border-[#f5f4e7]/10 px-5 py-12">
        <ReportBlockMarker index="00" label="Estado em 3 atos" meta="onde estamos / o que fazer / onde chegaremos" />
        <h3 className="mt-5 max-w-[920px] text-[34px] font-black leading-[0.98] tracking-[-0.045em] text-[#f5f4e7] sm:text-[48px] lg:text-[58px]" style={{ fontFamily: DISPLAY_FONT }}>
          A narrativa do veto <span className="text-[#d1ff00]">em 3 colunas.</span>
        </h3>
        <p className="mt-4 max-w-[760px] text-[17px] leading-[1.62] text-[#f5f4e7]/58">
          Uma leitura executiva para decidir rápido: o que existe, o que bloqueia e qual estado operacional precisamos ver depois da remediação.
        </p>
        <div className="mt-8 grid gap-px bg-[#f5f4e7]/10 lg:grid-cols-[1fr_88px_1fr_88px_1fr]">
          <DarkAct index="01 · AS-IS" title="Onde estamos hoje" stat={vetoActive ? "VETO" : "OK"} body={vetoActive ? "Blueprint forte, mas bloqueado por governança e rastreabilidade produtiva." : "Mapa liberável para operação assistida."} tone={vetoActive ? "danger" : "good"} />
          <DarkBridge label="remediation" />
          <DarkAct index="02 · AÇÃO" title="O que precisa acontecer" stat={String(remediation.length)} body={p0?.action || "Preservar evidência, owners e gates."} tone="warn" />
          <DarkBridge label="~5 semanas" />
          <DarkAct index="03 · TO-BE" title="Para onde isso vai" stat={vetoActive ? "COMPLIANT" : "OPERANDO"} body="Auto-fail removido, readiness rastreável e gates críticos verdes." tone="good" />
        </div>
      </div>

      <div className="grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
        <div className="bg-[#0f0f11] p-5">
          <ReportBlockMarker index="01" label="Axiomas e score" meta={`${criticalRisks} riscos críticos`} />
          <DarkSectionTitle eyebrow="scorecard" title="Critérios que explicam o veto" />
          <div className="mt-5 grid gap-3">
            {scoreBreakdown.map((item) => (
              <DarkScoreRow key={item.id} label={item.label} score={item.score} max={item.max} maxScale={maxScore} findings={item.findings} />
            ))}
          </div>
        </div>

        <div className="bg-[#0f0f11] p-5">
          <DarkSectionTitle eyebrow="custo de execução" title="Custo, tokens e duração" />
          <div className="mt-5 grid gap-4">
            {metrics.map((metric) => (
              <article key={metric.phase} className="aiox-surface-card bg-[#050505] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-[16px] font-black text-[#f5f4e7]">{phaseLabel(metric.phase)}</h4>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/40" style={{ fontFamily: MONO_FONT }}>
                      {metric.model} · {metric.status}
                    </p>
                  </div>
                  <span className="text-[22px] font-black text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>
                    {moneyLabel(metric.costUsd)}
                  </span>
                </div>
                <DarkBar label="cost" value={metric.costUsd ?? 0} max={maxCost} display={moneyLabel(metric.costUsd)} tone="lime" />
                <DarkBar label="tokens" value={metric.outputTokens ?? 0} max={maxTokens} display={numberLabel(metric.outputTokens)} tone="blue" />
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-px border-t border-[#f5f4e7]/10 bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.86fr)]">
        <DarkRadarPanel
          title="Radar de maturidade operacional"
          items={scoreBreakdown}
          emptySchema="score_card.yaml deve declarar dimensões, score, max, status e findings para alimentar este radar."
        />
        <DarkRiskRegister risks={pilot.risks} remediation={remediation} p0={p0} />
      </div>

      <div className="border-y border-[#f5f4e7]/10 px-5 py-12">
        <ReportBlockMarker index="02" label="Inteligência visual" meta="gráficos-alvo para evoluir o mapeamento" />
        <h3 className="mt-5 max-w-[980px] text-[34px] font-black leading-[0.98] tracking-[-0.045em] text-[#f5f4e7] sm:text-[48px] lg:text-[58px]" style={{ fontFamily: DISPLAY_FONT }}>
          O painel deve revelar padrões, <span className="text-[#d1ff00]">não só listar arquivos.</span>
        </h3>
        <p className="mt-4 max-w-[780px] text-[17px] leading-[1.62] text-[#f5f4e7]/58">
          Estes módulos já renderizam com os dados disponíveis e indicam o schema necessário quando o mapeamento ainda não traz a variável. Assim fica claro o que alterar no squad para produzir dashboards melhores.
        </p>
        <div className="mt-8 grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-4">
          <DarkDonut
            label="Compliance"
            value={compliance?.currentScore ?? sinkra?.score.score ?? null}
            suffix="/100"
            status={vetoActive ? "score com veto" : "liberável"}
            tone={vetoActive ? "danger" : "good"}
            schema="score_card.yaml → compliance.current_score"
          />
          <DarkDonut
            label="Automação"
            value={automationAvg}
            suffix="%"
            status={automation.length > 0 ? `${automation.length} specs` : "schema pendente"}
            tone={automationAvg === null ? "warn" : automationAvg >= 75 ? "good" : "warn"}
            schema="automation_specs.yaml → automatability"
          />
          <DarkDonut
            label="Accountability"
            value={accountabilityCoverage}
            suffix="%"
            status={accountability.length > 0 ? `${accountability.length} tasks RACI` : "schema pendente"}
            tone={accountabilityCoverage === null ? "warn" : accountabilityCoverage >= 90 ? "good" : "danger"}
            schema="raci_matrix.yaml → accountable"
          />
          <DarkDonut
            label="Gap closure"
            value={domainGapClosure}
            suffix="%"
            status={domains.length > 0 ? `${domains.length} domínios` : "schema pendente"}
            tone={domainGapClosure === null ? "warn" : domainGapClosure >= 70 ? "good" : "warn"}
            schema="domain_map.yaml → gap_closed"
          />
        </div>
        <div className="grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <DarkQuadrant
            title="Quadrante de automação"
            items={automation.map((item) => ({
              label: item.taskId,
              x: Math.round((item.standardization ?? 0.5) * 100),
              y: Math.round((item.automatability ?? 0.5) * 100),
              tone: item.dependsOnGaps.length > 0 || item.guardrailsMissing.length > 0 ? "danger" : "good",
            }))}
            emptySchema="automation_specs.yaml deve trazer task_id, standardization, automatability, guardrails_missing e depends_on_gaps."
          />
          <DarkRiskHeatmap
            risks={pilot.risks}
            gaps={gaps}
            emptySchema="gap_analysis.yaml + observatory_map.yaml devem classificar severidade, categoria, impacto e ação."
          />
        </div>
        <DarkFunnel
          items={[
            { label: "Artefatos", value: artifactCoverage.length, active: presentArtifacts, schema: "artifactCoverage" },
            { label: "Gates", value: pilot.gateBoard.length, active: gatesOk, schema: "gateBoard.status" },
            { label: "Readiness", value: pilot.readinessBars.length, active: readyReadiness.length, schema: "readiness_bars.status" },
            { label: "Owners", value: accountability.length || pilot.nextActions.length, active: accountability.length > 0 ? Math.round((accountabilityCoverage ?? 0) / 100 * accountability.length) : pilot.nextActions.length, schema: "raci_matrix.yaml" },
            { label: "Release", value: 1, active: vetoActive ? 0 : 1, schema: "compliance.handoff_blocked" },
          ]}
        />
      </div>

      <div className="grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <div className="bg-[#050505] p-5">
          <DarkSectionTitle eyebrow="roadmap de remediação" title="Quando o veto sai" />
          <DarkRoadmapSummary remediation={remediation} vetoActive={vetoActive} />
          <div className="mt-5 overflow-x-auto border border-[#f5f4e7]/10">
            <div className="min-w-[720px]">
            <div className="grid grid-cols-[220px_repeat(7,minmax(56px,1fr))] border-b border-[#f5f4e7]/10 bg-[#161618] text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/45" style={{ fontFamily: MONO_FONT }}>
              <div className="p-3">Ação</div>
              {["Hoje", "S+1", "S+2", "S+3", "S+4", "S+5", "S+6"].map((week) => <div key={week} className="border-l border-[#f5f4e7]/10 p-3 text-center">{week}</div>)}
            </div>
            {remediation.map((item) => {
              const timing = remediationWeeks(item.priority, item.action)
              return (
                <div key={`${item.priority}-${item.dimension}-${item.finding}`} className="grid grid-cols-[220px_minmax(0,1fr)] border-b border-[#f5f4e7]/10 last:border-b-0">
                  <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 p-3">
                    <span className={cn("text-[14px] font-black", item.priority === "P0" ? "text-[#ef4444]" : item.priority === "P1" ? "text-[#f5b340]" : "text-[#d1ff00]")}>{item.priority}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-black text-[#f5f4e7]">{item.dimension}</div>
                      <div className="truncate text-[10px] uppercase tracking-[0.08em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>{remediationEta(item.priority, item.action)}</div>
                    </div>
                  </div>
                  <div className="relative grid grid-cols-7">
                    {Array.from({ length: 7 }).map((_, index) => <div key={index} className="border-l border-[#f5f4e7]/10" />)}
                    <div
                      className={cn("absolute top-1/2 h-7 -translate-y-1/2 px-2 text-[10px] font-black uppercase leading-7 tracking-[0.08em] text-[#231d05]", item.priority === "P0" ? "bg-[#ef4444] text-white" : item.priority === "P1" ? "bg-[#f5b340]" : "bg-[#d1ff00]")}
                      style={{ left: `${(timing.start / 7) * 100}%`, width: `${(timing.span / 7) * 100}%`, fontFamily: MONO_FONT }}
                    >
                      {timing.label}
                    </div>
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        </div>

        <div className="bg-[#050505] p-5">
          <DarkSectionTitle eyebrow="três atos" title="Narrativa do veto" />
          <div className="mt-5 grid gap-3">
            <DarkAct index="01" title="Onde estamos" stat={compliance?.handoffBlocked ? "VETO" : "OK"} body="Score estrutural forte, mas produção bloqueada por governança/tokenização." tone="danger" />
            <DarkAct index="02" title="O que fazer" stat={String(remediation.length)} body={p0?.action || "Executar remediação priorizada."} tone="warn" />
            <DarkAct index="03" title="Onde chegar" stat="S+5" body="P0 + P1 fechados, auto-fail removido e readiness rastreável." tone="good" />
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="bg-[#0f0f11] p-5">
          <DarkSectionTitle eyebrow="matriz de decisão" title="O que o mapa responde" />
          <div className="mt-5 grid gap-3">
            {pilot.decisionMatrix.map((decision) => (
              <article key={decision.question} className="aiox-surface-card grid gap-4 bg-[#050505] p-4 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
                  {decision.question}
                </div>
                <div>
                  <div className="text-[24px] font-black leading-none tracking-[-0.04em] text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>
                    {decision.answer}
                  </div>
                  <p className="mt-2 text-[14px] font-bold leading-[1.5] text-[#f5f4e7]/58">{decision.signal}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="bg-[#0f0f11] p-5">
          <DarkSectionTitle eyebrow="radar de prontidão" title="Onde está pronto e onde bloqueia" />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {pilot.readinessBars.map((bar) => (
              <article key={bar.label} className="aiox-surface-card bg-[#050505] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[16px] font-black text-[#f5f4e7]">{bar.label}</h4>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{bar.status}</p>
                  </div>
                  <span className={cn("text-[32px] font-black leading-none", bar.status === "blocked" ? "text-[#ef4444]" : bar.status === "ready" ? "text-[#d1ff00]" : "text-[#f5b340]")} style={{ fontFamily: DISPLAY_FONT }}>
                    {bar.value}
                  </span>
                </div>
                <div className="mt-4 h-2.5 bg-[#f5f4e7]/8">
                  <div className={cn("h-full", bar.status === "blocked" ? "bg-[#ef4444]" : bar.status === "ready" ? "bg-[#d1ff00]" : "bg-[#f5b340]")} style={{ width: `${Math.max(4, Math.min(100, bar.value))}%` }} />
                </div>
                <p className="mt-3 line-clamp-3 text-[13.5px] leading-[1.45] text-[#f5f4e7]/56">{bar.note}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-px bg-[#f5f4e7]/10">
            <DarkSignal label="Prontos" value={String(readyReadiness.length)} tone="good" />
            <DarkSignal label="Bloqueados" value={String(blockedReadiness.length)} tone={blockedReadiness.length > 0 ? "danger" : "good"} />
          </div>
        </div>
      </div>

      <div className="bg-[#050505] p-5">
        <DarkSectionTitle eyebrow="caminho crítico" title="Sequência mínima para operar" />
        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          {pilot.criticalPath.map((step, index) => (
            <article key={step.task} className="aiox-surface-card p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[24px] font-black leading-none text-[#f5f4e7]/28" style={{ fontFamily: DISPLAY_FONT }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={cn("text-[10px] uppercase tracking-[0.11em]", step.state === "ready" ? "text-[#d1ff00]" : step.state === "risk" ? "text-[#ef4444]" : "text-[#f5f4e7]/55")} style={{ fontFamily: MONO_FONT }}>
                  {step.state}
                </span>
              </div>
              <h4 className="mt-4 text-[18px] font-black leading-tight text-[#f5f4e7]">{step.step}</h4>
              <div className="mt-2 truncate text-[10px] uppercase tracking-[0.09em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                {step.executor} · {step.task}
              </div>
              <p className="mt-3 line-clamp-4 text-[13.5px] leading-[1.45] text-[#f5f4e7]/56">{step.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.75fr)]">
        <div className="bg-[#0f0f11] p-5">
          <DarkSectionTitle eyebrow="mix de execução" title="Carga operacional por executor" />
          <div className="mt-5 h-5 overflow-hidden bg-[#f5f4e7]/8">
            {pilot.executorMix.map((item) => (
              <div
                key={item.executor}
                className={cn("inline-block h-full", item.tone === "warn" ? "bg-[#ef4444]" : item.tone === "good" ? "bg-[#d1ff00]" : "bg-[#f5f4e7]/55")}
                style={{ width: `${Math.max(3, (item.tasks / Math.max(totalExecutorTasks, 1)) * 100)}%` }}
                title={`${item.executor}: ${item.tasks}`}
              />
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pilot.executorMix.map((item) => (
              <article key={item.executor} className="aiox-surface-card bg-[#050505] p-4">
                <div className={cn("text-[42px] font-black leading-none", item.tone === "warn" ? "text-[#ef4444]" : item.tone === "good" ? "text-[#d1ff00]" : "text-[#f5f4e7]")} style={{ fontFamily: DISPLAY_FONT }}>
                  {item.tasks}
                </div>
                <h4 className="mt-3 text-[18px] font-black text-[#f5f4e7]">{item.executor}</h4>
                <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/40" style={{ fontFamily: MONO_FONT }}>{item.role}</p>
                <p className="mt-3 line-clamp-3 text-[13.5px] leading-[1.45] text-[#f5f4e7]/56">{item.insight}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="bg-[#0f0f11] p-5">
          <DarkSectionTitle eyebrow="gates de qualidade" title="Controles de qualidade" />
          <div className="mt-5 grid gap-2">
            {pilot.gateBoard.map((gate) => (
              <article key={gate.id} className={cn("grid grid-cols-[minmax(0,1fr)_74px] gap-3 border p-3", gate.status === "PASS" ? "border-[#d1ff00]/20 bg-[#050505]" : "border-[#ef4444]/35 bg-[#120808]")}>
                <div className="min-w-0">
                  <h4 className="truncate text-[14px] font-black text-[#f5f4e7]">{gate.title}</h4>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                    {gate.id} · {gate.threshold}
                  </p>
                </div>
                <span className={cn("self-center text-right text-[11px] font-black uppercase tracking-[0.1em]", gate.status === "PASS" ? "text-[#d1ff00]" : "text-[#ef4444]")} style={{ fontFamily: MONO_FONT }}>
                  {gate.status}
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
        <div className="bg-[#050505] p-5">
          <DarkSectionTitle eyebrow="linhas operacionais" title="Fluxo executivo do processo" />
          <div className="mt-5 grid gap-3">
            {pilot.lanes.map((lane, index) => (
              <article key={lane.id} className="aiox-surface-card grid gap-4 p-4 md:grid-cols-[52px_minmax(0,1fr)_82px]">
                <div className="text-[28px] font-black leading-none text-[#f5f4e7]/28" style={{ fontFamily: DISPLAY_FONT }}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/40" style={{ fontFamily: MONO_FONT }}>
                    {lane.domain} · {lane.owner}
                  </div>
                  <h4 className="mt-1 text-[20px] font-black leading-tight text-[#f5f4e7]">{lane.title}</h4>
                  <p className="mt-2 text-[14px] leading-[1.5] text-[#f5f4e7]/58">{lane.summary}</p>
                  <p className="mt-3 border-l-2 border-[#d1ff00] pl-3 text-[13.5px] font-bold leading-[1.45] text-[#f5f4e7]/78">{lane.signal}</p>
                </div>
                <div className="text-right">
                  <div className="text-[28px] font-black leading-none text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>{lane.taskCount}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>tasks</div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-px bg-[#f5f4e7]/10">
          <div className="bg-[#0f0f11] p-5">
            <DarkSectionTitle eyebrow="registro de riscos" title="Bloqueios reais" />
            <div className="mt-5 grid gap-3">
              {pilot.risks.map((risk) => (
                <article key={risk.id} className="border border-[#ef4444]/35 bg-[#120808] p-4">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[#ef4444]" style={{ fontFamily: MONO_FONT }}>
                    {risk.id} · {risk.severity}
                  </div>
                  <h4 className="mt-1 text-[17px] font-black leading-tight text-[#f5f4e7]">{risk.title}</h4>
                  <p className="mt-2 text-[13.5px] leading-[1.45] text-[#f5f4e7]/58">{risk.evidence}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="bg-[#0f0f11] p-5">
            <DarkSectionTitle eyebrow="próximas ações" title="Fila de correção" />
            <div className="mt-5 grid gap-2">
              {pilot.nextActions.map((action) => (
                <article key={`${action.priority}-${action.title}`} className="aiox-surface-card grid grid-cols-[48px_minmax(0,1fr)] gap-3 bg-[#050505] p-3">
                  <span className={cn("text-[15px] font-black", action.priority === "P0" ? "text-[#ef4444]" : action.priority === "P1" ? "text-[#f5b340]" : "text-[#d1ff00]")}>{action.priority}</span>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-black leading-tight text-[#f5f4e7]">{action.title}</h4>
                    <p className="mt-1 truncate text-[10px] uppercase tracking-[0.08em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                      {action.owner} · {action.targetArtifact}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PilotExecutiveMap({ pilot, sinkra }: { pilot: SinkraPilotMap; sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const featuredMetrics = pilot.metrics.slice(0, 8)
  const totalExecutorTasks = pilot.executorMix.reduce((total, item) => total + item.tasks, 0)
  const blockedReadiness = pilot.readinessBars.filter((bar) => bar.status === "blocked")
  const readyReadiness = pilot.readinessBars.filter((bar) => bar.status === "ready")
  const passGates = pilot.gateBoard.filter((gate) => gate.status === "PASS")
  const riskGates = pilot.gateBoard.filter((gate) => gate.status !== "PASS")
  const remediation = sinkra?.compliance.remediationItems ?? []
  const p0 = remediation.find((item) => item.priority === "P0") ?? remediation[0]
  const weakestScore = [...(sinkra?.compliance.scoreBreakdown ?? [])]
    .filter((item) => item.score !== null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
  const totalCost = sinkra?.execution.metrics.reduce((total, metric) => total + (metric.costUsd ?? 0), 0) ?? 0
  const totalTokens = sinkra?.execution.metrics.reduce((total, metric) => total + (metric.outputTokens ?? 0), 0) ?? 0
  const tldr = [
    {
      label: "Veredito",
      value: sinkra?.compliance.handoffBlocked ? "VETO" : pilot.readiness || "OK",
      note: sinkra?.compliance.handoffBlocked ? `Score ${sinkra?.compliance.currentScore ?? sinkra?.score.score ?? "--"} alto, mas handoff bloqueado.` : pilot.decision,
      tone: sinkra?.compliance.handoffBlocked ? "warn" as Tone : "good" as Tone,
    },
    {
      label: "P0",
      value: p0?.dimension || "sem P0",
      note: p0?.finding || "Nenhuma correção crítica registrada.",
      tone: p0 ? "warn" as Tone : "good" as Tone,
    },
    {
      label: "Pior dimensão",
      value: weakestScore?.score === null || weakestScore?.score === undefined ? "--" : String(weakestScore.score),
      note: weakestScore ? weakestScore.label : "Score breakdown ausente.",
      tone: scoreTone(weakestScore?.score, weakestScore?.max),
    },
    {
      label: "Economia do run",
      value: moneyLabel(totalCost),
      note: `${numberLabel(totalTokens)} output tokens geraram ${sinkra?.artifactCoverage.filter((item) => item.present).length ?? 0} artefatos-chave.`,
      tone: "neutral" as Tone,
    },
  ]

  return (
    <section className="mt-6 overflow-hidden border border-[var(--ink)] bg-[var(--paper)]">
      <div className="grid gap-px bg-[var(--rule)] xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="bg-[var(--paper)] p-6 sm:p-7">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            Command center · observatory_map.yaml
          </p>
          <h3 className="mt-2 max-w-[900px] text-[32px] font-black leading-[0.98] tracking-[-0.05em] text-[var(--ink)] sm:text-[40px]" style={{ fontFamily: DISPLAY_FONT }}>
            Leitura executiva do mapeamento
          </h3>
          <p className="mt-4 max-w-[860px] text-[16px] leading-[1.62] text-[var(--ink-2)]">
            {pilot.narrative}
          </p>
          <div className="mt-6 grid gap-px bg-[var(--rule)] sm:grid-cols-4">
            {featuredMetrics.slice(0, 4).map((metric) => (
              <MetricTile key={metric.label} label={metric.label.replace(/_/g, " ")} value={metric.value} />
            ))}
          </div>
        </div>

        <aside className="bg-[var(--lime-fill)] p-6 text-[var(--ink)] sm:p-7">
          <p className="text-[11px] uppercase tracking-[0.14em] opacity-65" style={{ fontFamily: MONO_FONT }}>
            Decisão operacional
          </p>
          <div className="mt-2 text-[42px] font-black leading-none tracking-[-0.055em]" style={{ fontFamily: DISPLAY_FONT }}>
            {pilot.readiness || pilot.healthLabel}
          </div>
          <p className="mt-4 text-[16.5px] font-black leading-[1.44]">{pilot.decision}</p>
          <div className="mt-6 grid grid-cols-2 gap-px bg-[var(--ink)]/18">
            <Signal label="Prontos" value={String(readyReadiness.length)} tone="good" />
            <Signal label="Bloqueados" value={String(blockedReadiness.length)} tone={blockedReadiness.length > 0 ? "warn" : "good"} />
            <Signal label="Gates ok" value={`${passGates.length}/${pilot.gateBoard.length}`} tone={riskGates.length === 0 ? "good" : "warn"} />
            <Signal label="Tasks" value={String(totalExecutorTasks)} />
          </div>
        </aside>
      </div>

      <div className="grid gap-px border-t border-[var(--rule)] bg-[var(--rule)] md:grid-cols-2 xl:grid-cols-4">
        {tldr.map((item) => (
          <article key={item.label} className="bg-[var(--paper)] p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
              {item.label}
            </p>
            <div className={cn("mt-2 text-[34px] font-black leading-none tracking-[-0.05em]", toneClass(item.tone))} style={{ fontFamily: DISPLAY_FONT }}>
              {item.value}
            </div>
            <p className="mt-3 text-[14.5px] font-bold leading-[1.48] text-[var(--ink-2)]">{item.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-px border-t border-[var(--rule)] bg-[var(--rule)] lg:grid-cols-3">
        <NarrativeAct
          index="01"
          title="Estado atual"
          body={sinkra?.compliance.handoffBlocked ? "O blueprint está bem decomposto, mas ainda não pode virar operação contínua: a governança veta a promoção por falta de tokenização/accountability explícita." : "O desenho está operacionalmente consistente e sem bloqueio crítico registrado."}
        />
        <NarrativeAct
          index="02"
          title="Ação requerida"
          body={p0 ? `${p0.priority}: ${p0.action}` : "Manter o pacote de evidências, versionar o run e preparar ativação controlada."}
        />
        <NarrativeAct
          index="03"
          title="Estado projetado"
          body="Depois da correção, o painel deve mostrar handoff liberado, score sem auto-fail, gates críticos verdes e contrato de readiness rastreável."
        />
      </div>

      <div className="grid gap-px bg-[var(--rule)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="bg-[var(--paper)] p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                Decision matrix
              </p>
              <h4 className="mt-1 text-[24px] font-black leading-none tracking-[-0.04em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                O que este mapa responde
              </h4>
            </div>
          </div>
          <div className="grid gap-3">
            {pilot.decisionMatrix.map((decision) => (
              <div key={decision.question} className="grid gap-3 border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3 md:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)]">
                <div className="text-[12px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  {decision.question}
                </div>
                <div>
                  <div className="text-[22px] font-black leading-none tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {decision.answer}
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.48] text-[var(--ink-2)]">{decision.signal}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--paper)] p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            Readiness radar
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pilot.readinessBars.map((bar) => (
              <div key={bar.label} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[14.5px] font-black text-[var(--ink)]">{bar.label}</span>
                  <span className={cn("text-[20px] font-black leading-none", bar.status === "blocked" ? "text-[var(--warning-ink)]" : bar.status === "ready" ? "text-[var(--lime-ink)]" : "text-[var(--ink)]")} style={{ fontFamily: DISPLAY_FONT }}>
                    {bar.value}
                  </span>
                </div>
                <div className="h-2 bg-[var(--paper-deep)]">
                  <div className={cn("h-full", bar.status === "blocked" ? "bg-[var(--warning-ink)]" : bar.status === "ready" ? "bg-[var(--lime-ink)]" : "bg-[var(--ink)]")} style={{ width: `${Math.max(4, Math.min(100, bar.value))}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-[1.45] text-[var(--ink-2)]">{bar.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--rule)] bg-[var(--ink)] p-5 text-[var(--paper)]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--paper)]/55" style={{ fontFamily: MONO_FONT }}>
              Critical path
            </p>
            <h4 className="mt-1 text-[26px] font-black leading-none tracking-[-0.04em] text-[var(--paper)]" style={{ fontFamily: DISPLAY_FONT }}>
              Sequência mínima para operar
            </h4>
          </div>
          <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--paper)]/45" style={{ fontFamily: MONO_FONT }}>
            {pilot.criticalPath.length} passos
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-5">
          {pilot.criticalPath.map((step, index) => (
            <article key={step.task} className="border border-[var(--paper)]/18 bg-[var(--paper)]/6 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[20px] font-black leading-none text-[var(--paper)]/45" style={{ fontFamily: DISPLAY_FONT }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={cn("text-[10.5px] uppercase tracking-[0.1em]", step.state === "ready" ? "text-[var(--lime-fill)]" : step.state === "risk" ? "text-[var(--warning-ink)]" : "text-[var(--paper)]/70")} style={{ fontFamily: MONO_FONT }}>
                  {step.state}
                </span>
              </div>
              <h5 className="mt-3 text-[16.5px] font-black leading-tight text-[var(--paper)]">{step.step}</h5>
              <div className="mt-1 truncate text-[10.5px] uppercase tracking-[0.08em] text-[var(--paper)]/45" style={{ fontFamily: MONO_FONT }}>
                {step.executor} · {step.task}
              </div>
              <p className="mt-3 line-clamp-3 text-[13.5px] leading-[1.48] text-[var(--paper)]/72">{step.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-px border-t border-[var(--rule)] bg-[var(--rule)] xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.7fr)]">
        <div className="bg-[var(--paper)] p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            Executor mix
          </p>
          <div className="mt-4 h-3 overflow-hidden bg-[var(--paper-deep)]">
            {pilot.executorMix.map((item) => (
              <div
                key={item.executor}
                className={cn("inline-block h-full", item.tone === "warn" ? "bg-[var(--warning-ink)]" : item.tone === "good" ? "bg-[var(--lime-ink)]" : "bg-[var(--ink)]")}
                style={{ width: `${Math.max(2, (item.tasks / Math.max(totalExecutorTasks, 1)) * 100)}%` }}
                title={`${item.executor}: ${item.tasks}`}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pilot.executorMix.map((item) => (
              <div key={item.executor} className="grid grid-cols-[54px_minmax(0,1fr)] gap-3 border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                <div className={cn("text-[26px] font-black leading-none", item.tone === "warn" ? "text-[var(--warning-ink)]" : item.tone === "good" ? "text-[var(--lime-ink)]" : "text-[var(--ink-dim)]")} style={{ fontFamily: DISPLAY_FONT }}>
                  {item.tasks}
                </div>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-black text-[var(--ink)]">{item.executor}</div>
                  <div className="mt-0.5 truncate text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    {item.role}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-[1.42] text-[var(--ink-2)]">{item.insight}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--paper)] p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            Quality gate board
          </p>
          <div className="mt-4 grid gap-2">
            {pilot.gateBoard.map((gate) => (
              <article key={gate.id} className={cn("grid grid-cols-[minmax(0,1fr)_64px] gap-3 border p-3", gate.status === "FAIL" ? "border-[var(--warning-ink)] bg-[var(--paper-alt)]" : gate.status === "REVIEW" ? "border-[var(--ink)] bg-[var(--paper-alt)]" : "border-[var(--rule-soft)] bg-[var(--paper-alt)]")}>
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-black text-[var(--ink)]">{gate.title}</div>
                  <div className="mt-1 text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    {gate.id} · {gate.threshold}
                  </div>
                </div>
                <div className={cn("text-right text-[11px] font-bold uppercase tracking-[0.1em]", gate.status === "PASS" ? "text-[var(--lime-ink)]" : "text-[var(--warning-ink)]")} style={{ fontFamily: MONO_FONT }}>
                  {gate.status}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-px border-t border-[var(--rule)] bg-[var(--rule)] xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="bg-[var(--paper)] p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                Operating lanes
              </p>
              <h4 className="mt-1 text-[24px] font-black tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                Fluxo executivo do processo
              </h4>
            </div>
            <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
              {pilot.lanes.length} lanes
            </span>
          </div>
          <div className="grid gap-3">
            {pilot.lanes.map((lane, index) => (
              <article key={lane.id} className="grid gap-4 border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-4 md:grid-cols-[46px_minmax(0,1fr)_76px]">
                <div className="text-[26px] font-black leading-none text-[var(--ink-dim)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    {lane.domain} · {lane.owner}
                  </div>
                  <h5 className="mt-1 text-[19px] font-black leading-tight tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {lane.title}
                  </h5>
                  <p className="mt-2 text-[14.5px] leading-[1.52] text-[var(--ink-2)]">{lane.summary}</p>
                  <p className="mt-2 border-l-2 border-[var(--lime-ink)] pl-3 text-[13.5px] font-bold leading-[1.48] text-[var(--ink)]">
                    {lane.signal}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[24px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {lane.taskCount}
                  </div>
                  <div className="mt-1 text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    tasks
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="grid gap-px bg-[var(--rule)]">
          <div className="bg-[var(--paper)] p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
              Risk register
            </p>
            <h4 className="mt-1 text-[24px] font-black tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
              Bloqueios reais
            </h4>
            <div className="mt-4 grid gap-3">
              {pilot.risks.map((risk) => (
                <article key={risk.id} className="border border-[var(--warning-ink)] bg-[var(--paper-alt)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>
                      {risk.id} · {risk.severity}
                    </span>
                  </div>
                  <h5 className="mt-1 text-[16.5px] font-black text-[var(--ink)]">{risk.title}</h5>
                  <p className="mt-2 text-[13.5px] leading-[1.48] text-[var(--ink-2)]">{risk.evidence}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="bg-[var(--paper)] p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
              Próximas ações
            </p>
            <div className="mt-4 grid gap-2">
              {pilot.nextActions.map((action) => (
                <div key={`${action.priority}-${action.title}`} className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                  <span className="text-[14.5px] font-black text-[var(--warning-ink)]">{action.priority}</span>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-bold leading-tight text-[var(--ink)]">{action.title}</div>
                    <div className="mt-1 truncate text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {action.owner} · {action.targetArtifact}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export function SinkraFlowReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const pilot = sinkra?.observatoryMap ?? null
  const workflows = sinkra?.workflows ?? []
  const dependencies = sinkra?.dependencies
  const composition = sinkra?.composition
  const tokenFlow = sinkra?.tokenFlow
  if (!pilot && workflows.length === 0 && (composition?.nodes.length ?? 0) === 0) return <SinkraEmptyReport title="Flow indisponível" />
  const playbook = pilot ? buildJourneyPlaybook(pilot) : null
  const compositionGroups = countBy((composition?.nodes ?? []).map((node) => node.level))
  const tokenTypeGroups = countBy((tokenFlow?.tokens ?? []).map((token) => token.type || "token"))
  const fanOut = [...(dependencies?.nodes ?? [])].sort((a, b) => b.feedsInto.length - a.feedsInto.length).slice(0, 6)
  const fanIn = [...(dependencies?.nodes ?? [])].sort((a, b) => b.dependsOn.length - a.dependsOn.length).slice(0, 6)

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <DeepTabHero
          eyebrow="SINKRA flow"
          title="Fluxo profundo de execução"
          body="A visão de fluxo junta workflows, DAG, gates e handoffs. Ela mostra o caminho crítico, os pontos de controle e onde o processo bifurca ou bloqueia."
          metric={`${dependencies?.nodes.length ?? workflows.reduce((total, workflow) => total + workflow.steps.length, 0)} nodes`}
        />

        <FlowExecutiveStrip
          lanes={pilot?.lanes ?? []}
          workflows={workflows}
          dependencies={dependencies}
          compositionGroups={compositionGroups}
          tokenCount={tokenFlow?.tokens.length ?? 0}
          adjacency={composition?.adjacencyValidation || "--"}
        />

        <FlowHumanBrief
          lanes={pilot?.lanes ?? []}
          workflows={workflows}
          dependencies={dependencies}
          tokenCount={tokenFlow?.tokens.length ?? 0}
        />

        {playbook && (
          <section className="mt-6 border border-[var(--ink)] bg-[var(--paper)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] bg-[var(--paper-alt)] p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                FlowPlaybook · brandbook/flow-diagram
              </p>
              <h3 className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                Gates → caminho → riscos → ações
              </h3>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-[11px] uppercase tracking-[0.1em]" style={{ fontFamily: MONO_FONT }}>
              <span className="border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[var(--ink-3)]">top: gates</span>
              <span className="border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[var(--ink-3)]">mid: path</span>
              <span className="border border-[var(--warning-ink)] bg-[var(--paper)] px-2 py-1 text-[var(--warning-ink)]">low: risk/fix</span>
            </div>
          </div>
          <div className="p-4">
            <FlowPlaybook
              nodes={playbook.nodes}
              edges={playbook.edges}
              canvasWidth={playbook.width}
              canvasHeight={playbook.height}
              theme="dark"
              className="rounded-none border-[var(--rule)]"
            />
          </div>
          </section>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Compositional hierarchy" title="Template → Organism → Molecule → Atom" meta={`${composition?.nodes.length ?? 0} nós`} />
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-4">
              {["template", "organism", "molecule", "atom"].map((level) => (
                <div key={level} className="bg-[var(--paper)] p-5">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{level}</div>
                  <div className="mt-2 text-[42px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {compositionGroups.find((item) => item.label === level)?.value ?? 0}
                  </div>
                  <div className="mt-4 grid gap-2">
                    {(composition?.nodes ?? []).filter((node) => node.level === level).slice(0, 4).map((node) => (
                      <div key={node.id} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] px-3 py-2">
                        <div className="truncate text-[13px] font-black text-[var(--ink)]">{node.name || node.id}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.09em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                          {node.count} filhos/outputs
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Handoff packets" title="Transições formais" compact />
            <div className="grid gap-3 p-4">
              {(composition?.handoffPackets ?? []).map((packet, index) => (
                <article key={`${packet.from}-${packet.to}-${packet.packet}`} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                  <div className="text-[24px] font-black leading-none text-[var(--ink-dim)]" style={{ fontFamily: DISPLAY_FONT }}>{String(index + 1).padStart(2, "0")}</div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-black text-[var(--ink)]">{packet.packet}</div>
                    <div className="mt-1 truncate text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {packet.from} → {packet.to}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Token flow" title="Packets produzidos e consumidos" meta={`${tokenFlow?.taskCountCovered ?? 0} tasks cobertas`} />
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-px bg-[var(--rule)]">
                {(tokenFlow?.tokens ?? []).slice(0, 12).map((token) => (
                  <article key={token.tokenName} className="grid gap-3 bg-[var(--paper)] p-4 md:grid-cols-[minmax(0,1fr)_130px_80px]">
                    <div className="min-w-0">
                      <h4 className="truncate text-[16px] font-black text-[var(--ink)]">{token.tokenValue || token.tokenName}</h4>
                      <p className="mt-1 truncate text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        {token.producedBy} → {token.consumedBy.length} consumidores
                      </p>
                    </div>
                    <span className="truncate text-[12px] font-bold text-[var(--ink-2)]">{token.domain || "sem domínio"}</span>
                    <span className="text-right text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{token.type}</span>
                  </article>
                ))}
              </div>
              <DistributionPanel title="Tipos de token" items={tokenTypeGroups} compact />
            </div>
          </section>

          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Fan-in / fan-out" title="Nós de maior pressão" compact />
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2 xl:grid-cols-1">
              <FanPanel title="Fan-out" items={fanOut.map((node) => ({ label: node.id, value: node.feedsInto.length }))} />
              <FanPanel title="Fan-in" items={fanIn.map((node) => ({ label: node.id, value: node.dependsOn.length }))} />
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Leitura humana do fluxo" title="Como o processo funciona" meta={`${workflows.length} etapas executivas`} />
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2">
              {workflows.map((workflow, index) => {
                const executors = summarizeExecutors(workflow.steps.map((step) => step.executor))
                const outputs = workflow.steps.reduce((total, step) => total + step.outputCount, 0)
                const controls = workflow.steps.reduce((total, step) => total + step.guardrailCount, 0)
                const signal = workflowHumanSignal(outputs, controls, workflow.steps.length)
                const attention = workflowHumanAttention(outputs, controls, workflow.steps.length)
                return (
                  <article key={workflow.id} className="bg-[var(--paper)] p-5">
                    <div className="flex items-start justify-between gap-5">
                      <div className="min-w-0">
                        <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                          etapa {String(index + 1).padStart(2, "0")} · {executors}
                        </div>
                        <h4 className="text-[24px] font-black leading-tight tracking-[-0.04em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                          {workflow.name}
                        </h4>
                        <p className="mt-3 text-[15px] font-bold leading-[1.55] text-[var(--ink-2)]">
                          {workflow.description || `Quando ${workflow.trigger || "o processo avança"}, esta etapa organiza a próxima entrega.`}
                        </p>
                      </div>
                      <span className="text-[52px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                        {workflow.steps.length}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-px bg-[var(--rule)]">
                      <MetricTile label="Dispara" value={humanizeProcessLabel(workflow.trigger || "avanço")} />
                      <MetricTile label="Entregas" value={String(outputs)} />
                      <MetricTile label="Controles" value={String(controls)} />
                    </div>
                    <div className="mt-5 grid gap-3">
                      <div className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-4">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                          Leitura executiva
                        </div>
                        <p className="mt-2 text-[15px] font-black leading-[1.45] text-[var(--ink)]">
                          {signal}
                        </p>
                      </div>
                      <div className="border border-[var(--warning-ink)] bg-[var(--paper)] p-4">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>
                          Atenção humana
                        </div>
                        <p className="mt-2 text-[14.5px] font-bold leading-[1.5] text-[var(--ink)]">
                          {attention}
                        </p>
                      </div>
                    </div>
                    <details className="mt-4 border border-[var(--rule-soft)] bg-[var(--paper-alt)]">
                      <summary className="cursor-pointer px-4 py-3 text-[11px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        Ver ações técnicas traduzidas
                      </summary>
                      <div className="grid gap-2 border-t border-[var(--rule-soft)] p-4">
                        {workflow.steps.map((step) => (
                          <div key={step.id} className="grid gap-2 border border-[var(--rule-soft)] bg-[var(--paper)] p-3 sm:grid-cols-[minmax(0,1fr)_100px]">
                            <span className="text-[14px] font-bold leading-[1.45] text-[var(--ink)]">
                              {humanizeProcessLabel(step.name || step.task)}
                            </span>
                            <span className="text-right text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                              {step.executor || "executor"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Mapa de dependências" title="Onde começa, onde termina e onde pode travar" compact />
            <div className="grid gap-4 p-4">
              <div className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  Começa quando
                </div>
                <h4 className="mt-2 text-[22px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {humanizeProcessLabel(dependencies?.roots[0] ?? workflows[0]?.trigger ?? "Entrada definida")}
                </h4>
              </div>
              <div className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  Termina quando
                </div>
                <h4 className="mt-2 text-[22px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {humanizeProcessLabel(dependencies?.leaves[0] ?? "Contrato de readiness emitido")}
                </h4>
              </div>
              <div className="grid grid-cols-3 gap-px bg-[var(--rule)]">
                <MetricTile label="Entradas" value={String(dependencies?.roots.length ?? 0)} />
                <MetricTile label="Saídas" value={String(dependencies?.leaves.length ?? 0)} />
                <MetricTile label="Passos" value={String(dependencies?.nodes.length ?? workflows.reduce((total, workflow) => total + workflow.steps.length, 0))} />
              </div>
              <div className="border border-[var(--warning-ink)] bg-[var(--paper-alt)] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>
                  Leitura operacional
                </div>
                <p className="mt-2 text-[14.5px] font-bold leading-[1.55] text-[var(--ink)]">
                  Se a entrada principal não estiver clara, todo o fluxo perde rastreabilidade. Se a saída final não for verificável, o processo pode parecer concluído sem estar pronto para operar.
                </p>
              </div>
            </div>
          </section>
        </div>
      </article>
    </LightScrollArea>
  )
}

export function SinkraAutomationReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const automation = sinkra?.automation ?? []
  const executorGroups = countBy(automation.map((item) => item.executorType || "—"))
  const modeGroups = countBy(automation.map((item) => item.automationType || "—"))
  const highAutomation = automation.filter((item) => (item.automatability ?? 0) >= 0.85)
  const blocked = automation.filter((item) => item.dependsOnGaps.length > 0 || item.guardrailsMissing.length > 0)
  const agentReview = automation.filter((item) => (item.automatability ?? 0) >= 0.55 && (item.automatability ?? 0) < 0.85 && item.dependsOnGaps.length === 0)
  const humanOwned = automation.filter((item) => /human/i.test(item.executorType) || (item.automatability ?? 1) < 0.55)

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <DeepTabHero
          eyebrow="SINKRA automation"
          title="O que deve ser humano, agent ou worker"
          body="Esta aba transforma automation_specs e executor_matrix em uma leitura prática: onde automatizar, onde delegar para Agent, onde preservar julgamento humano e quais gaps impedem automação segura."
          metric={automation.length > 0 ? `${highAutomation.length}/${automation.length} high-auto` : "schema"}
        />

        <AutomationDecisionBoard
          highAutomation={highAutomation}
          agentReview={agentReview}
          humanOwned={humanOwned}
          blocked={blocked}
          hasData={automation.length > 0}
        />

        <div className="mt-6 grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-[minmax(0,1fr)_420px]">
          <DarkQuadrant
            title="Mapa de decisão da automação"
            items={automation.map((item) => ({
              label: item.taskId,
              x: Math.round((item.standardization ?? 0.5) * 100),
              y: Math.round((item.automatability ?? 0.5) * 100),
              tone: item.dependsOnGaps.length > 0 || item.guardrailsMissing.length > 0 ? "danger" : (item.automatability ?? 0) >= 0.85 ? "good" : "warn",
            }))}
            emptySchema="automation_specs.yaml deve trazer task_id, standardization, automatability, guardrails_missing e depends_on_gaps."
          />
          <AutomationReadinessPanel automation={automation} blocked={blocked} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Automation matrix" title="Automatabilidade por task" meta={`${automation.length} tasks`} />
            <div className="grid gap-px bg-[var(--rule)]">
              {automation.map((item) => {
                const auto = item.automatability ?? 0
                const std = item.standardization ?? 0
                const tone: Tone = item.dependsOnGaps.length > 0 ? "warn" : auto >= 0.85 ? "good" : "neutral"
                const taskLabel = humanizeSentence(item.taskName || item.taskId)
                return (
                  <article key={item.taskId} className="grid gap-4 bg-[var(--paper)] p-4 lg:grid-cols-[minmax(240px,1fr)_180px_180px]">
                    <div className="min-w-0">
                      <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        {humanizeSentence(item.executorType)} · {humanizeSentence(item.automationType)}
                      </div>
                      <h4 className="mt-1 text-[19px] font-black leading-tight tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                        {taskLabel}
                      </h4>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
                        {item.taskId}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[14px] leading-[1.45] text-[var(--ink-2)]">{item.justification || item.impact}</p>
                      {item.dependsOnGaps.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {item.dependsOnGaps.map((gap) => <Tag key={gap} label={gap} tone="warn" />)}
                        </div>
                      )}
                    </div>
                    <ScoreBar label="Automat." value={auto} tone={tone} />
                    <ScoreBar label="Standard" value={std} tone={std >= 0.8 ? "good" : "warn"} />
                  </article>
                )
              })}
            </div>
          </section>

          <aside className="grid content-start gap-6">
            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Executor mix" title="Distribuição" compact />
              <DistributionPanel title="Por executor" items={executorGroups} compact />
              <DistributionPanel title="Por modo" items={modeGroups} compact />
            </section>
            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Guardrails" title="Pendências" compact />
              <div className="grid gap-3 p-4">
                {blocked.slice(0, 8).map((item) => (
                  <article key={item.taskId} className="border border-[var(--warning-ink)] bg-[var(--paper-alt)] p-3">
                    <h4 className="text-[15px] font-black leading-tight text-[var(--ink)]">{item.taskName}</h4>
                    <p className="mt-2 text-[12.5px] leading-[1.45] text-[var(--ink-2)]">
                      {item.guardrailsMissing.length > 0 ? `${item.guardrailsMissing.length} guardrails faltando` : `Depende de ${item.dependsOnGaps.join(", ")}`}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </article>
    </LightScrollArea>
  )
}

function FlowExecutiveStrip({
  lanes,
  workflows,
  dependencies,
  compositionGroups,
  tokenCount,
  adjacency,
}: {
  lanes: SinkraPilotMap["lanes"]
  workflows: NonNullable<ObservatoryTypeSpecific["sinkra"]>["workflows"]
  dependencies?: NonNullable<ObservatoryTypeSpecific["sinkra"]>["dependencies"]
  compositionGroups: Array<{ label: string; value: number }>
  tokenCount: number
  adjacency: string
}) {
  const steps = lanes.length > 0
    ? lanes.map((lane, index) => ({
        id: lane.id,
        title: humanizeSentence(lane.title),
        meta: `${humanizeSentence(lane.owner)} · ${lane.taskCount} tarefas`,
        body: humanizeSentence(lane.signal || lane.summary),
        value: lane.taskCount,
        tone: lane.risk ? "warn" as Tone : "good" as Tone,
        index,
      }))
    : workflows.flatMap((workflow) => workflow.steps.map((step, index) => ({
        id: `${workflow.id}-${step.id}`,
        title: humanizeSentence(step.name),
        meta: `${humanizeSentence(workflow.name || workflow.id)} · ${humanizeSentence(step.executor)}`,
        body: `${step.outputCount} entregas · ${step.guardrailCount} controles`,
        value: step.outputCount + step.guardrailCount,
        tone: step.guardrailCount > 0 ? "good" as Tone : "warn" as Tone,
        index,
      }))).slice(0, 8)
  const nodes = dependencies?.nodes.length ?? steps.length
  const roots = dependencies?.roots.length ?? 0
  const leaves = dependencies?.leaves.length ?? 0
  return (
    <section className="mt-6 border border-[#f5f4e7]/12 bg-[#050505]">
      <div className="grid gap-px bg-[#f5f4e7]/10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="bg-[#0f0f11] p-5">
          <ReportBlockMarker index="01" label="Jornada operacional" meta={`${steps.length} etapas visualizadas`} />
          <div className="mt-6 overflow-x-auto pb-2">
            <div className="grid min-w-[980px] auto-cols-fr grid-flow-col gap-px bg-[#f5f4e7]/10">
              {steps.slice(0, 8).map((step) => (
                <article key={step.id} className="min-h-[230px] bg-[#050505] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[30px] font-black leading-none text-[#f5f4e7]/28" style={{ fontFamily: DISPLAY_FONT }}>
                      {String(step.index + 1).padStart(2, "0")}
                    </span>
                    <span className={cn("h-2 w-2", step.tone === "good" ? "bg-[#d1ff00]" : "bg-[#f5b340]")} />
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-[20px] font-black leading-tight tracking-[-0.035em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                    {step.title}
                  </h3>
                  <div className="mt-2 truncate text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/40" style={{ fontFamily: MONO_FONT }}>
                    {step.meta}
                  </div>
                  <p className="mt-4 line-clamp-4 text-[13.5px] font-bold leading-[1.48] text-[#f5f4e7]/62">{step.body}</p>
                  <div className="mt-5 h-1.5 bg-[#f5f4e7]/8">
                    <div className={cn("h-full", step.tone === "good" ? "bg-[#d1ff00]" : "bg-[#f5b340]")} style={{ width: `${Math.max(12, Math.min(100, step.value * 12))}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
        <aside className="bg-[#10110d] p-5">
          <DarkSectionTitle eyebrow="Contrato do fluxo" title="O que precisa existir" />
          <div className="mt-5 grid gap-3">
            <DarkStat label="DAG nodes" value={String(nodes)} tone={nodes > 0 ? "good" : "warn"} />
            <DarkStat label="Roots / leaves" value={`${roots}/${leaves}`} />
            <DarkStat label="Tokens" value={String(tokenCount)} tone={tokenCount > 0 ? "good" : "warn"} />
            <DarkStat label="Adjacency" value={adjacency} tone={adjacency === "PASS" ? "good" : "warn"} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-px bg-[#f5f4e7]/10">
            {["template", "organism", "molecule", "atom"].map((level) => (
              <DarkSignal key={level} label={level} value={String(compositionGroups.find((item) => item.label === level)?.value ?? 0)} tone="neutral" />
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}

function FlowHumanBrief({
  lanes,
  workflows,
  dependencies,
  tokenCount,
}: {
  lanes: SinkraPilotMap["lanes"]
  workflows: NonNullable<ObservatoryTypeSpecific["sinkra"]>["workflows"]
  dependencies?: NonNullable<ObservatoryTypeSpecific["sinkra"]>["dependencies"]
  tokenCount: number
}) {
  const laneCount = lanes.length || workflows.length
  const taskCount = lanes.reduce((total, lane) => total + lane.taskCount, 0) ||
    workflows.reduce((total, workflow) => total + workflow.steps.length, 0)
  const roots = dependencies?.roots.length ?? 0
  const leaves = dependencies?.leaves.length ?? 0
  const nodes = dependencies?.nodes.length ?? taskCount
  const cards = [
    {
      title: "Como começa",
      metric: roots > 0 ? `${roots} entrada${roots === 1 ? "" : "s"}` : "entrada pendente",
      body: roots > 0
        ? "O processo tem pontos claros de início. Isso reduz ambiguidade para disparo, triagem e ownership."
        : "Ainda falta declarar quais eventos ou decisões realmente iniciam o fluxo.",
      tone: roots > 0 ? "good" as Tone : "warn" as Tone,
    },
    {
      title: "Como atravessa",
      metric: `${laneCount} blocos · ${nodes} nós`,
      body: taskCount > 0
        ? "A leitura principal deve mostrar a passagem entre etapas, controles e handoffs, não apenas IDs de tasks."
        : "Faltam atividades suficientes para transformar este mapa em jornada operacional.",
      tone: taskCount > 0 ? "good" as Tone : "warn" as Tone,
    },
    {
      title: "Como termina",
      metric: leaves > 0 ? `${leaves} saída${leaves === 1 ? "" : "s"}` : "saída pendente",
      body: tokenCount > 0
        ? "Há pacotes ou evidências que ajudam a provar conclusão e consumo pela próxima etapa."
        : "O próximo ganho é declarar outputs consumíveis: arquivos, decisões, eventos, registros ou gates.",
      tone: leaves > 0 && tokenCount > 0 ? "good" as Tone : "warn" as Tone,
    },
  ]

  return (
    <section className="mt-6 grid gap-px bg-[#f5f4e7]/10 md:grid-cols-3">
      {cards.map((card, index) => (
        <article key={card.title} className="bg-[#0f0f11] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
                leitura humana · {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-[28px] font-black leading-none tracking-[-0.045em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                {card.title}
              </h3>
            </div>
            <span className={cn("text-[11px] uppercase tracking-[0.12em]", card.tone === "good" ? "text-[#d1ff00]" : "text-[#f5b340]")} style={{ fontFamily: MONO_FONT }}>
              {card.metric}
            </span>
          </div>
          <p className="mt-5 text-[15px] font-bold leading-[1.55] text-[#f5f4e7]/68">{card.body}</p>
        </article>
      ))}
    </section>
  )
}

function AutomationDecisionBoard({
  highAutomation,
  agentReview,
  humanOwned,
  blocked,
  hasData,
}: {
  highAutomation: ObservatoryTypeSpecific["sinkra"] extends infer S ? S extends { automation: infer A } ? A extends Array<infer I> ? I[] : never : never : never
  agentReview: ObservatoryTypeSpecific["sinkra"] extends infer S ? S extends { automation: infer A } ? A extends Array<infer I> ? I[] : never : never : never
  humanOwned: ObservatoryTypeSpecific["sinkra"] extends infer S ? S extends { automation: infer A } ? A extends Array<infer I> ? I[] : never : never : never
  blocked: ObservatoryTypeSpecific["sinkra"] extends infer S ? S extends { automation: infer A } ? A extends Array<infer I> ? I[] : never : never : never
  hasData: boolean
}) {
  const columns = [
    { title: "Automatizar agora", tone: "good" as Tone, items: highAutomation, schema: "automatability >= 0.85 sem gaps" },
    { title: "Agent review", tone: "warn" as Tone, items: agentReview, schema: "0.55-0.84 com checkpoint" },
    { title: "Humano dono", tone: "neutral" as Tone, items: humanOwned, schema: "human executor ou baixa automatabilidade" },
    { title: "Bloqueado", tone: "danger" as Tone, items: blocked, schema: "depends_on_gaps ou guardrails_missing" },
  ]
  return (
    <section className="mt-6 border border-[#f5f4e7]/12 bg-[#050505]">
      <div className="p-5">
        <ReportBlockMarker index="01" label="Automation decision board" meta={hasData ? "dados reais de automation_specs.yaml" : "target schema"} />
      </div>
      <div className="grid gap-px bg-[#f5f4e7]/10 xl:grid-cols-4">
        {columns.map((column) => {
          const visible = column.items.slice(0, 4)
          const fallback = !hasData || visible.length === 0
          return (
            <article key={column.title} className="bg-[#0f0f11] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={cn("text-[32px] font-black leading-none tracking-[-0.05em]", column.tone === "danger" ? "text-[#ef4444]" : column.tone === "warn" ? "text-[#f5b340]" : column.tone === "good" ? "text-[#d1ff00]" : "text-[#f5f4e7]")} style={{ fontFamily: DISPLAY_FONT }}>
                    {column.items.length}
                  </div>
                  <h3 className="mt-2 text-[22px] font-black leading-tight tracking-[-0.04em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{column.title}</h3>
                </div>
                {fallback && <SchemaChip label="schema" />}
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.1em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{column.schema}</p>
              <div className="mt-5 grid gap-2">
                {fallback ? (
                  <div className="border border-[#f5b340]/25 bg-[#050505] p-3 text-[13px] font-bold leading-[1.45] text-[#f5f4e7]/60">
                    Gerar campos suficientes para classificar tasks nesta zona.
                  </div>
                ) : visible.map((item) => (
                  <div key={item.taskId} className="border border-[#f5f4e7]/10 bg-[#050505] p-3">
                    <div className="truncate text-[14px] font-black text-[#f5f4e7]">{humanizeSentence(item.taskName || item.taskId)}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.09em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                      {item.taskId} · {pct(item.automatability ?? 0)}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function AutomationReadinessPanel({
  automation,
  blocked,
}: {
  automation: NonNullable<ObservatoryTypeSpecific["sinkra"]>["automation"]
  blocked: NonNullable<ObservatoryTypeSpecific["sinkra"]>["automation"]
}) {
  const guardrailsPresent = automation.reduce((total, item) => total + item.guardrailsPresent.length, 0)
  const guardrailsMissing = automation.reduce((total, item) => total + item.guardrailsMissing.length, 0)
  return (
    <section className="bg-[#0f0f11] p-5">
      <div className="flex items-start justify-between gap-4">
        <DarkSectionTitle eyebrow="Automation readiness" title="Guardrails antes de worker" />
        {automation.length === 0 && <SchemaChip label="schema pendente" />}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-px bg-[#f5f4e7]/10">
        <DarkSignal label="Specs" value={String(automation.length)} tone={automation.length > 0 ? "good" : "warn"} />
        <DarkSignal label="Bloqueadas" value={String(blocked.length)} tone={blocked.length > 0 ? "danger" : "good"} />
        <DarkSignal label="Guardrails OK" value={String(guardrailsPresent)} tone="good" />
        <DarkSignal label="Faltando" value={String(guardrailsMissing)} tone={guardrailsMissing > 0 ? "danger" : "good"} />
      </div>
      <div className="mt-5 grid gap-2">
        {(blocked.length > 0 ? blocked : automation).slice(0, 5).map((item) => (
          <article key={item.taskId} className="border border-[#f5f4e7]/10 bg-[#050505] p-3">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-[14px] font-black leading-tight text-[#f5f4e7]">{humanizeSentence(item.taskName || item.taskId)}</h4>
              <span className={cn("text-[10px] uppercase tracking-[0.1em]", item.guardrailsMissing.length > 0 ? "text-[#ef4444]" : "text-[#d1ff00]")} style={{ fontFamily: MONO_FONT }}>
                {item.guardrailsMissing.length > 0 ? "blocked" : "ready"}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[12.5px] leading-[1.45] text-[#f5f4e7]/52">{item.justification || item.impact}</p>
          </article>
        ))}
        {automation.length === 0 && (
          <p className="border border-[#f5b340]/25 bg-[#050505] p-3 text-[13px] font-bold leading-[1.45] text-[#f5f4e7]/60">
            Esperado: automation_specs.yaml com task_id, executor_type, automation_type, automatability, standardization, checkpoint_status, guardrails_present/missing e depends_on_gaps.
          </p>
        )}
      </div>
    </section>
  )
}

export function SinkraGovernanceReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const gates = sinkra?.gates ?? []
  const compliance = sinkra?.compliance
  const dimensions = compliance?.dimensions ?? []
  const issues = compliance?.blockingIssues ?? []
  const scoreBreakdown = compliance?.scoreBreakdown ?? []
  const vetoGates = gates.filter((gate) => gate.veto)

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <DeepTabHero
          eyebrow="SINKRA governance"
          title="Gates, compliance e veto de produção"
          body="Esta visão separa score estrutural de aprovação operacional. O mapeamento pode estar bem desenhado e ainda assim bloqueado por baseline, accountability ou readiness."
          metric={compliance?.currentScore === null || compliance?.currentScore === undefined ? "--" : String(compliance.currentScore)}
        />
        <section className="mt-6 grid gap-px bg-[var(--rule)] md:grid-cols-4">
          <Kpi label="Status" value={compliance?.status ?? "--"} tone={compliance?.handoffBlocked ? "warn" : "good"} />
          <Kpi label="Gates" value={String(gates.length)} />
          <Kpi label="Veto" value={String(vetoGates.length)} tone={vetoGates.length > 0 ? "warn" : "good"} />
          <Kpi label="Issues" value={String(issues.length)} tone={issues.length > 0 ? "warn" : "good"} />
        </section>

        {scoreBreakdown.length > 0 && (
          <section className="mt-6 border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Score card" title="Por que o score não libera produção" meta={`${scoreBreakdown.length} critérios`} />
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2 xl:grid-cols-3">
              {scoreBreakdown.map((item) => {
                const tone = scoreTone(item.score, item.max)
                const width = ((item.score ?? 0) / Math.max(item.max ?? 100, 1)) * 100
                return (
                  <article key={item.id} className="bg-[var(--paper)] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10.5px] uppercase tracking-[0.11em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                          peso {pct(item.weight ?? 0)}
                        </p>
                        <h4 className="mt-1 text-[20px] font-black capitalize leading-tight tracking-[-0.03em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                          {item.label}
                        </h4>
                      </div>
                      <div className={cn("text-[36px] font-black leading-none", toneClass(tone))} style={{ fontFamily: DISPLAY_FONT }}>
                        {item.score ?? "--"}
                      </div>
                    </div>
                    <div className="mt-4 h-2.5 bg-[var(--paper-deep)]">
                      <div className={cn("h-full", tone === "good" ? "bg-[var(--lime-ink)]" : "bg-[var(--warning-ink)]")} style={{ width: `${Math.max(4, Math.min(100, width))}%` }} />
                    </div>
                    <div className="mt-3 grid gap-2">
                      {item.findings.slice(0, 2).map((finding) => (
                        <p key={finding} className="text-[13.5px] leading-[1.45] text-[var(--ink-2)]">{finding}</p>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Compliance dimensions" title="Score por dimensão" meta={`${dimensions.length} dimensões`} />
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2">
              {dimensions.map((dimension) => (
                <article key={`${dimension.id}-${dimension.name}`} className="bg-[var(--paper)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        {dimension.id} · {dimension.status}
                      </div>
                      <h4 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                        {dimension.name}
                      </h4>
                    </div>
                    <span className={cn("text-[40px] font-black leading-none", dimension.status === "FAIL" ? "text-[var(--warning-ink)]" : "text-[var(--ink)]")} style={{ fontFamily: DISPLAY_FONT }}>
                      {dimension.score ?? "--"}
                    </span>
                  </div>
                  <div className="mt-4 h-2 bg-[var(--paper-deep)]">
                    <div className={cn("h-full", dimension.status === "FAIL" ? "bg-[var(--warning-ink)]" : "bg-[var(--ink)]")} style={{ width: `${Math.max(4, Math.min(100, (dimension.score ?? 0) * 10))}%` }} />
                  </div>
                  <p className="mt-3 line-clamp-3 text-[14px] leading-[1.5] text-[var(--ink-2)]">{dimension.rationale}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="grid content-start gap-6">
            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Blocking issues" title="Bloqueios" compact />
              <div className="grid gap-3 p-4">
                {issues.map((issue) => (
                  <article key={issue.id} className="border border-[var(--warning-ink)] bg-[var(--paper-alt)] p-4">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>
                      {issue.id} · {issue.severity} · {issue.linkedGate}
                    </div>
                    <h4 className="mt-1 text-[18px] font-black leading-tight text-[var(--ink)]">{issue.title}</h4>
                    <p className="mt-2 text-[14px] leading-[1.5] text-[var(--ink-2)]">{issue.impact}</p>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </article>
    </LightScrollArea>
  )
}

export function SinkraAccountabilityReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const rows = sinkra?.accountability ?? []
  if (rows.length === 0) return <SinkraEmptyReport title="Accountability indisponível" />
  const accountableGroups = countBy(rows.map((row) => row.accountable || "—"))
  const responsibleGroups = countBy(rows.map((row) => row.responsibleType || "—"))

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <DeepTabHero
          eyebrow="SINKRA accountability"
          title="RACI e carga de decisão"
          body="A RACI mostra quem executa, quem responde pela decisão e quem precisa ser informado. Aqui fica explícito quando accountability está bem distribuída ou concentrada demais."
          metric={`${rows.length} tasks`}
        />
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="RACI matrix" title="Responsável e accountable por task" meta={`${rows.length} linhas`} />
            <div className="grid gap-px bg-[var(--rule)]">
              {rows.map((row) => (
                <article key={row.taskId} className="grid gap-4 bg-[var(--paper)] p-4 lg:grid-cols-[minmax(240px,1fr)_220px_220px]">
                  <div className="min-w-0">
                    <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{row.taskId}</div>
                    <h4 className="mt-1 text-[18px] font-black leading-tight text-[var(--ink)]">{row.taskName}</h4>
                  </div>
                  <RoleTile label="Responsible" value={row.responsible} sub={row.responsibleType} />
                  <RoleTile label="Accountable" value={row.accountable} sub={`${row.consulted.length} consulted · ${row.informed.length} informed`} />
                </article>
              ))}
            </div>
          </section>
          <aside className="grid content-start gap-6">
            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Load" title="Por accountable" compact />
              <DistributionPanel title="Accountable" items={accountableGroups} compact />
              <DistributionPanel title="Responsible type" items={responsibleGroups} compact />
            </section>
            <section className="border border-[var(--warning-ink)] bg-[var(--paper)] p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>Tokenização</p>
              <h3 className="mt-2 text-[26px] font-black leading-tight tracking-[-0.04em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                RACI não substitui accountability token
              </h3>
              <p className="mt-3 text-[14.5px] leading-[1.55] text-[var(--ink-2)]">
                O relatório aponta RACI coerente, mas a validação exige `accountability_token` explícito para tasks não-Human antes de promover o processo.
              </p>
            </section>
          </aside>
        </div>
      </article>
    </LightScrollArea>
  )
}

export function SinkraGapsReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const gaps = sinkra?.gaps ?? []
  const pilotRisks = sinkra?.observatoryMap?.risks ?? []
  if (gaps.length === 0 && pilotRisks.length === 0) return <SinkraEmptyReport title="Gaps indisponíveis" />
  const severityGroups = countBy(gaps.map((gap) => gap.severity || "—"))
  const categoryGroups = countBy(gaps.map((gap) => gap.category || "—"))
  const executorTypes = Array.from(new Set(gaps.flatMap((gap) => gap.executorTypes))).filter(Boolean).slice(0, 6)
  const severities = Array.from(new Set(gaps.map((gap) => gap.severity || "—"))).slice(0, 5)
  const remediation = sinkra?.compliance.remediationItems ?? []

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <DeepTabHero
          eyebrow="SINKRA gaps"
          title="Lacunas que bloqueiam evolução"
          body="Gaps não são notas de rodapé: eles explicam por que um processo formalmente rico ainda não é operacionalmente seguro."
          metric={`${gaps.length} gaps`}
        />
        <section className="mt-6 grid gap-px bg-[var(--rule)] md:grid-cols-4">
          <Kpi label="Gaps" value={String(gaps.length)} tone={gaps.length > 0 ? "warn" : "good"} />
          <Kpi label="Executores" value={String(executorTypes.length)} />
          <Kpi label="P0/P1" value={String(remediation.filter((item) => item.priority === "P0" || item.priority === "P1").length)} tone="warn" />
          <Kpi label="Riscos" value={String(pilotRisks.length)} tone={pilotRisks.length > 0 ? "warn" : "good"} />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Capability gaps" title="Gap register" meta={`${gaps.length} gaps`} />
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2">
              {gaps.map((gap) => (
                <article key={gap.id} className="bg-[var(--paper)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>
                        {gap.id} · {gap.severity} · {gap.category}
                      </div>
                      <h4 className="mt-1 text-[22px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                        {gap.title}
                      </h4>
                    </div>
                    <span className="text-[30px] font-black text-[var(--warning-ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                      {gap.blockers.length}
                    </span>
                  </div>
                  <p className="mt-3 text-[14px] leading-[1.5] text-[var(--ink-2)]">{gap.impact}</p>
                  <p className="mt-3 border-l-2 border-[var(--lime-ink)] pl-3 text-[14px] font-bold leading-[1.45] text-[var(--ink)]">{gap.resolution}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {gap.blockers.slice(0, 4).map((item) => <Tag key={item} label={item} tone="warn" />)}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <aside className="grid content-start gap-6">
            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Distribution" title="Onde dói" compact />
              <DistributionPanel title="Severidade" items={severityGroups} compact />
              <DistributionPanel title="Categoria" items={categoryGroups} compact />
            </section>
            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Remediation" title="Roadmap" compact />
              <div className="grid gap-3 p-4">
                {remediation.map((item) => (
                  <article key={`${item.priority}-${item.dimension}-${item.finding}`} className="grid grid-cols-[54px_minmax(0,1fr)] gap-3 border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                    <div className="text-[18px] font-black text-[var(--warning-ink)]">{item.priority}</div>
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-black leading-tight text-[var(--ink)]">{item.dimension}</h4>
                      <p className="mt-1 text-[13px] leading-[1.45] text-[var(--ink-2)]">{item.action}</p>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.09em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        ETA: {remediationEta(item.priority, item.action)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>

        {gaps.length > 0 && executorTypes.length > 0 && (
          <section className="mt-6 border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Severity × executor" title="Matriz de impacto" meta={`${executorTypes.length} executores`} />
            <div className="overflow-x-auto p-4">
              <div className="min-w-[720px] border border-[var(--rule)]">
                <div className="grid bg-[var(--paper-alt)]" style={{ gridTemplateColumns: `160px repeat(${executorTypes.length}, minmax(100px, 1fr))` }}>
                  <div className="border-r border-[var(--rule)] p-3 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>Severidade</div>
                  {executorTypes.map((executor) => (
                    <div key={executor} className="border-r border-[var(--rule)] p-3 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] last:border-r-0" style={{ fontFamily: MONO_FONT }}>{executor}</div>
                  ))}
                </div>
                {severities.map((severity) => (
                  <div key={severity} className="grid border-t border-[var(--rule)]" style={{ gridTemplateColumns: `160px repeat(${executorTypes.length}, minmax(100px, 1fr))` }}>
                    <div className="border-r border-[var(--rule)] p-3 text-[15px] font-black text-[var(--ink)]">{severity}</div>
                    {executorTypes.map((executor) => {
                      const count = gaps.filter((gap) => (gap.severity || "—") === severity && gap.executorTypes.includes(executor)).length
                      return (
                        <div key={`${severity}-${executor}`} className={cn("border-r border-[var(--rule)] p-3 text-center text-[24px] font-black last:border-r-0", count > 0 ? "bg-[var(--paper-alt)] text-[var(--warning-ink)]" : "text-[var(--ink-dim)]")} style={{ fontFamily: DISPLAY_FONT }}>
                          {count}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </LightScrollArea>
  )
}

export function SinkraEvidenceReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const phases = sinkra?.execution.phases ?? []
  const metrics = sinkra?.execution.metrics ?? []
  const totalCost = metrics.reduce((total, metric) => total + (metric.costUsd ?? 0), 0)
  const totalDuration = phases.reduce((total, phase) => total + (phase.durationSeconds ?? 0), 0)
  const totalArtifacts = phases.reduce((total, phase) => total + phase.artifactCount, 0)
  const totalOutputTokens = metrics.reduce((total, metric) => total + (metric.outputTokens ?? 0), 0)
  const maxCost = maxMetric(metrics.map((metric) => metric.costUsd))
  const maxTokens = maxMetric(metrics.map((metric) => metric.outputTokens))
  const maxDuration = maxMetric(metrics.map((metric) => metric.durationSeconds))

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <DeepTabHero
          eyebrow="SINKRA evidence"
          title="Linha de execução e prova gerada"
          body="Esta aba mostra como o mapeamento foi produzido: fases, agentes, custo, duração e artefatos. É a trilha de auditoria visual do run."
          metric={`${totalArtifacts} arquivos`}
        />
        <section className="mt-6 grid gap-px bg-[var(--rule)] md:grid-cols-4">
          <Kpi label="Fases" value={String(phases.length)} />
          <Kpi label="Artefatos" value={String(totalArtifacts)} />
          <Kpi label="Duração" value={secondsLabel(totalDuration)} />
          <Kpi label="Custo" value={moneyLabel(totalCost)} />
        </section>
        <section className="mt-6 grid gap-px bg-[var(--rule)] md:grid-cols-4">
          <Kpi label="Output tokens" value={numberLabel(totalOutputTokens)} />
          <Kpi label="Custo/token" value={totalOutputTokens > 0 ? `$${(totalCost / totalOutputTokens).toFixed(5)}` : "--"} />
          <Kpi label="Fase mais cara" value={metrics.slice().sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0))[0]?.phase.replace(/^phase\d+-/, "") ?? "--"} tone="warn" />
          <Kpi label="Fase mais longa" value={metrics.slice().sort((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0))[0]?.phase.replace(/^phase\d+-/, "") ?? "--"} tone="warn" />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Execution timeline" title="Fases do pipeline" meta={`${phases.length} fases`} />
            <div className="grid gap-px bg-[var(--rule)]">
              {phases.map((phase, index) => (
                <article key={phase.id} className="grid gap-4 bg-[var(--paper)] p-4 md:grid-cols-[64px_minmax(0,1fr)_120px]">
                  <span className="text-[30px] font-black leading-none text-[var(--ink-dim)]" style={{ fontFamily: DISPLAY_FONT }}>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {phase.agent} · {phase.status}
                    </div>
                    <h4 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{phase.id.replace(/_/g, " ")}</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-[22px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{secondsLabel(phase.durationSeconds)}</div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{phase.artifactCount} arquivos</div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <aside className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Runtime metrics" title="Custo por fase" compact />
            <div className="grid gap-3 p-4">
              {metrics.map((metric) => (
                <article key={metric.phase} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-[15px] font-black text-[var(--ink)]">{metric.phase}</h4>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{metric.model} · {metric.status}</p>
                    </div>
                    <span className="text-[20px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{moneyLabel(metric.costUsd)}</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <MetricBar label="cost" value={metric.costUsd ?? 0} max={maxCost} display={moneyLabel(metric.costUsd)} tone="warn" />
                    <MetricBar label="tokens" value={metric.outputTokens ?? 0} max={maxTokens} display={numberLabel(metric.outputTokens)} />
                    <MetricBar label="duration" value={metric.durationSeconds ?? 0} max={maxDuration} display={secondsLabel(metric.durationSeconds)} />
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
        <section className="mt-6 border border-[var(--rule)] bg-[var(--paper)]">
          <SectionHead eyebrow="Accumulated runtime" title="Custo e duração acumulados" meta={`${metrics.length} checkpoints`} />
          <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2">
            <CumulativeChart title="Custo acumulado" items={metrics.map((metric) => ({ label: metric.phase.replace(/^phase\d+-/, ""), value: metric.costUsd ?? 0, display: moneyLabel(metric.costUsd) }))} />
            <CumulativeChart title="Duração acumulada" items={metrics.map((metric) => ({ label: metric.phase.replace(/^phase\d+-/, ""), value: metric.durationSeconds ?? 0, display: secondsLabel(metric.durationSeconds) }))} />
          </div>
        </section>
      </article>
    </LightScrollArea>
  )
}

export function SinkraOperationsReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const pilot = sinkra?.observatoryMap ?? null
  if (!pilot) return <SinkraEmptyReport title="Ops indisponível" />

  const totalExecutorTasks = pilot.executorMix.reduce((total, item) => total + item.tasks, 0)
  const flowMap = buildOperationsFlowMap(pilot)

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <DeepTabHero
          eyebrow="SINKRA operations"
          title="Mapa operacional do processo"
          body="Lanes, carga por executor e gates de controle. Esta aba mostra quem executa, onde o trabalho concentra e quais controles travam ou liberam operação."
          metric={`${totalExecutorTasks} tasks`}
        />

        <section className="mt-6 border border-[var(--rule)] bg-[var(--paper)]">
          <SectionHead eyebrow="Executor distribution" title="Carga por tipo de executor" meta={`${pilot.executorMix.length} executores`} />
          <div className="p-5">
            <div className="h-5 overflow-hidden bg-[var(--paper-deep)]">
              {pilot.executorMix.map((item) => (
                <div
                  key={item.executor}
                  className={cn("inline-block h-full", item.tone === "warn" ? "bg-[var(--warning-ink)]" : item.tone === "good" ? "bg-[var(--lime-ink)]" : "bg-[var(--ink)]")}
                  style={{ width: `${Math.max(3, (item.tasks / Math.max(totalExecutorTasks, 1)) * 100)}%` }}
                  title={`${item.executor}: ${item.tasks}`}
                />
              ))}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {pilot.executorMix.map((item) => (
                <article key={item.executor} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-4">
                  <div className={cn("text-[44px] font-black leading-none", item.tone === "warn" ? "text-[var(--warning-ink)]" : item.tone === "good" ? "text-[var(--lime-ink)]" : "text-[var(--ink)]")} style={{ fontFamily: DISPLAY_FONT }}>
                    {item.tasks}
                  </div>
                  <h4 className="mt-3 text-[19px] font-black tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {item.executor}
                  </h4>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{item.role}</p>
                  <p className="mt-3 text-[14px] leading-[1.5] text-[var(--ink-2)]">{item.insight}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 border border-[var(--rule)] bg-[var(--paper)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] bg-[var(--paper-alt)] p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                FlowMap · brandbook/flow-diagram
              </p>
              <h3 className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                Lanes, gates, riscos e fila de ação
              </h3>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-[11px] uppercase tracking-[0.1em]" style={{ fontFamily: MONO_FONT }}>
              <span className="border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[var(--ink-3)]">lanes</span>
              <span className="border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[var(--ink-3)]">controls</span>
              <span className="border border-[var(--warning-ink)] bg-[var(--paper)] px-2 py-1 text-[var(--warning-ink)]">risk/fix</span>
            </div>
          </div>
          <div className="p-4">
            <FlowMap
              groups={flowMap.groups}
              edges={flowMap.edges}
              canvasWidth={flowMap.width}
              canvasHeight={flowMap.height}
              theme="dark"
              className="rounded-none border-[var(--rule)]"
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Operating lanes" title="Lanes acionáveis" meta={`${pilot.lanes.length} lanes`} />
            <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2">
              {pilot.lanes.map((lane, index) => (
                <article key={lane.id} className="bg-[var(--paper)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[32px] font-black leading-none text-[var(--ink-dim)]" style={{ fontFamily: DISPLAY_FONT }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {lane.taskCount} tasks
                    </span>
                  </div>
                  <h4 className="mt-4 text-[22px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {lane.title}
                  </h4>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.09em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    {lane.domain} · {lane.owner}
                  </p>
                  <p className="mt-3 text-[14.5px] leading-[1.52] text-[var(--ink-2)]">{lane.summary}</p>
                  <p className="mt-4 border-l-2 border-[var(--lime-ink)] pl-3 text-[14px] font-bold leading-[1.48] text-[var(--ink)]">{lane.signal}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Gate heatmap" title="Controles operacionais" compact />
            <div className="grid gap-3 p-4">
              {pilot.gateBoard.map((gate) => (
                <article key={gate.id} className={cn("border p-4", gate.status === "PASS" ? "border-[var(--rule-soft)] bg-[var(--paper-alt)]" : "border-[var(--warning-ink)] bg-[var(--paper-alt)]")}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[12px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{gate.id}</span>
                    <span className={cn("text-[12px] font-bold uppercase tracking-[0.1em]", gate.status === "PASS" ? "text-[var(--lime-ink)]" : "text-[var(--warning-ink)]")} style={{ fontFamily: MONO_FONT }}>{gate.status}</span>
                  </div>
                  <h4 className="mt-2 text-[18px] font-black leading-tight text-[var(--ink)]">{gate.title}</h4>
                  <div className="mt-3 grid gap-1 text-[13px] leading-[1.45] text-[var(--ink-2)]">
                    <span><strong>Owner:</strong> {gate.owner}</span>
                    <span><strong>Threshold:</strong> {gate.threshold}</span>
                    <span><strong>Bloqueia:</strong> {gate.blocks}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </article>
    </LightScrollArea>
  )
}

export function SinkraRiskReport({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const pilot = sinkra?.observatoryMap ?? null
  if (!pilot) return <SinkraEmptyReport title="Risks indisponível" />

  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[1440px]" style={SINKRA_DARK_THEME}>
        <DeepTabHero
          eyebrow="SINKRA risk control"
          title="Riscos, bloqueios e plano de ação"
          body="Aprofundamento tático: o que pode quebrar a operação, qual evidência sustenta o risco e qual artefato deve ser atualizado primeiro."
          metric={`${pilot.risks.length} riscos`}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
          <section className="border border-[var(--rule)] bg-[var(--paper)]">
            <SectionHead eyebrow="Risk register" title="Bloqueios priorizados" meta={`${pilot.risks.length} itens`} />
            <div className="grid gap-px bg-[var(--rule)]">
              {pilot.risks.map((risk, index) => (
                <article key={risk.id} className="grid gap-5 bg-[var(--paper)] p-5 md:grid-cols-[76px_minmax(0,1fr)]">
                  <div>
                    <div className="text-[34px] font-black leading-none text-[var(--warning-ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.1em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>
                      {risk.severity}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[24px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                      {risk.title}
                    </h4>
                    <p className="mt-3 text-[15px] leading-[1.55] text-[var(--ink-2)]">{risk.evidence}</p>
                    <div className="mt-4 border-l-2 border-[var(--warning-ink)] bg-[var(--paper-alt)] px-4 py-3 text-[14px] font-bold leading-[1.5] text-[var(--ink)]">
                      {risk.action}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="grid content-start gap-6">
            <section className="border border-[var(--ink)] bg-[var(--lime-fill)] p-5 text-[var(--ink)]">
              <p className="text-[11px] uppercase tracking-[0.14em] opacity-65" style={{ fontFamily: MONO_FONT }}>
                Ação executiva
              </p>
              <h3 className="mt-2 text-[34px] font-black leading-none tracking-[-0.05em]" style={{ fontFamily: DISPLAY_FONT }}>
                Próximos movimentos
              </h3>
              <p className="mt-4 text-[15px] font-bold leading-[1.5]">
                A lista abaixo transforma risco em trabalho rastreável. Cada ação aponta owner e artefato alvo.
              </p>
            </section>

            <section className="border border-[var(--rule)] bg-[var(--paper)]">
              <SectionHead eyebrow="Action plan" title="Fila de correção" compact />
              <div className="grid gap-3 p-4">
                {pilot.nextActions.map((action) => (
                  <article key={`${action.priority}-${action.title}`} className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-4">
                    <span className="text-[18px] font-black text-[var(--warning-ink)]">{action.priority}</span>
                    <div>
                      <h4 className="text-[16px] font-black leading-tight text-[var(--ink)]">{action.title}</h4>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        {action.owner} · {action.targetArtifact}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </article>
    </LightScrollArea>
  )
}

function SinkraEmptyReport({ title }: { title: string }) {
  return (
    <LightScrollArea className="flex-1 bg-[#050505]" viewportClassName="bg-[#050505] px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="#050505">
      <article className="mx-auto w-full min-w-0 max-w-[920px]" style={SINKRA_DARK_THEME}>
        <EmptyPanel title={title} body="Este mapeamento ainda não possui observatory_map.yaml curado para renderizar esta visualização." />
      </article>
    </LightScrollArea>
  )
}

function DeepTabHero({
  eyebrow,
  title,
  body,
  metric,
}: {
  eyebrow: string
  title: string
  body: string
  metric: string
}) {
  return (
    <section className="grid overflow-hidden border border-[#f5f4e7]/16 bg-[#050505] lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="bg-[#10110d] p-6 text-[#f5f4e7] sm:p-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#f5f4e7]/58" style={{ fontFamily: MONO_FONT }}>
          {eyebrow}
        </p>
        <h2 className="mt-3 max-w-[900px] text-[40px] font-black leading-[0.95] tracking-[-0.055em] sm:text-[54px]" style={{ fontFamily: DISPLAY_FONT }}>
          {title}
        </h2>
        <p className="mt-5 max-w-[760px] text-[16px] leading-[1.62] text-[#f5f4e7]/78">{body}</p>
      </div>
      <aside className="grid place-items-center bg-[#d1ff00] p-6 text-center text-[#050505]">
        <p className="text-[11px] uppercase tracking-[0.14em] opacity-65" style={{ fontFamily: MONO_FONT }}>
          visual report
        </p>
        <div className="mt-3 text-[38px] font-black leading-none tracking-[-0.055em]" style={{ fontFamily: DISPLAY_FONT }}>
          {metric}
        </div>
      </aside>
    </section>
  )
}

function NarrativeAct({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <article className="bg-[var(--paper)] p-5">
      <div className="text-[28px] font-black leading-none text-[var(--ink-dim)]" style={{ fontFamily: DISPLAY_FONT }}>{index}</div>
      <h4 className="mt-3 text-[24px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
        {title}
      </h4>
      <p className="mt-3 text-[15px] font-bold leading-[1.55] text-[var(--ink-2)]">{body}</p>
    </article>
  )
}

function DarkPin({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span className={cn(
      "border px-3 py-1.5 text-[10px] uppercase tracking-[0.13em]",
      tone === "danger" ? "border-[#ef4444]/40 text-[#ef4444]" : tone === "good" ? "border-[#d1ff00]/30 text-[#d1ff00]" : "border-[#f5f4e7]/20 text-[#f5f4e7]/60",
    )} style={{ fontFamily: MONO_FONT }}>
      {label}
    </span>
  )
}

function DarkStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#f5f4e7]/10 py-3 last:border-b-0">
      <span className="text-[10px] uppercase tracking-[0.13em] text-[#f5f4e7]/45" style={{ fontFamily: MONO_FONT }}>{label}</span>
      <span className={cn("text-[24px] font-black leading-none tracking-[-0.04em]", tone === "danger" ? "text-[#ef4444]" : tone === "warn" ? "text-[#f5b340]" : tone === "good" ? "text-[#d1ff00]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
        {value}
      </span>
    </div>
  )
}

function ReportBlockMarker({ index, label, meta }: { index: string; label: string; meta: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-[var(--aiox-lime)] pb-3">
      <span className="text-[11px] uppercase tracking-[0.22em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
        [{index}] · {label}
      </span>
      <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
        {meta}
      </span>
    </div>
  )
}

function DarkTldr({ label, value, note, tone = "neutral" }: { label: string; value: string; note: string; tone?: Tone }) {
  return (
    <article className="aiox-surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.13em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>{label}</span>
        <span className={cn("h-1.5 w-1.5 rounded-full", tone === "danger" ? "bg-[#ef4444]" : tone === "warn" ? "bg-[#f5b340]" : tone === "good" ? "bg-[#d1ff00]" : "bg-[#f5f4e7]/35")} />
      </div>
      <div className={cn("mt-4 text-[38px] font-black leading-none tracking-[-0.055em]", tone === "danger" ? "text-[#ef4444]" : tone === "warn" ? "text-[#f5b340]" : tone === "good" ? "text-[#d1ff00]" : "text-[#f5f4e7]")} style={{ fontFamily: DISPLAY_FONT }}>
        {value}
      </div>
      <p className="mt-3 line-clamp-4 text-[13.5px] font-bold leading-[1.48] text-[#f5f4e7]/62">{note}</p>
    </article>
  )
}

function DarkSignal({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="aiox-hud-frame bg-[#050505] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{label}</div>
      <div className={cn("mt-1 text-[24px] font-black leading-none", tone === "danger" ? "text-[#ef4444]" : tone === "warn" ? "text-[#f5b340]" : tone === "good" ? "text-[#d1ff00]" : "text-[#f5f4e7]")} style={{ fontFamily: DISPLAY_FONT }}>
        {value}
      </div>
    </div>
  )
}

function DarkSectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header>
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>◤ {eyebrow}</p>
      <h3 className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
        {title}
      </h3>
    </header>
  )
}

function DarkBridge({ label }: { label: string }) {
  return (
    <div className="grid min-h-[190px] place-items-center bg-[#050505] px-3 text-center">
      <div>
        <div className="text-[34px] font-black leading-none text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>→</div>
        <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function scorePercent(item: SinkraScoreBreakdownItem) {
  return Math.max(0, Math.min(100, ((item.score ?? 0) / Math.max(item.max ?? 100, 1)) * 100))
}

function DarkRadarPanel({
  title,
  items,
  emptySchema,
}: {
  title: string
  items: SinkraScoreBreakdownItem[]
  emptySchema: string
}) {
  const realItems = items.filter((item) => item.score !== null)
  const plotted = realItems.length >= 3
    ? realItems.slice(0, 8)
    : [
        { id: "tokenizacao", label: "Tokenização", score: 58, max: 100, weight: null, status: "schema", findings: ["Declarar dimensões no score_card.yaml."] },
        { id: "gates", label: "Gates", score: 72, max: 100, weight: null, status: "schema", findings: ["Declarar critérios de bloqueio e aceite."] },
        { id: "evidencias", label: "Evidências", score: 46, max: 100, weight: null, status: "schema", findings: ["Conectar evidências aos gates."] },
        { id: "automacao", label: "Automação", score: 64, max: 100, weight: null, status: "schema", findings: ["Declarar tarefas automatizáveis."] },
        { id: "handoff", label: "Handoff", score: 52, max: 100, weight: null, status: "schema", findings: ["Declarar saída operacional."] },
      ] satisfies SinkraScoreBreakdownItem[]
  const cx = 180
  const cy = 180
  const radius = 116
  const points = plotted.map((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / plotted.length
    const ratio = scorePercent(item) / 100
    return {
      item,
      pct: Math.round(ratio * 100),
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
      ax: cx + Math.cos(angle) * radius,
      ay: cy + Math.sin(angle) * radius,
      lx: cx + Math.cos(angle) * (radius + 32),
      ly: cy + Math.sin(angle) * (radius + 32),
    }
  })
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ")

  return (
    <section className="aiox-hud-frame bg-[#050505] p-5">
      <div className="flex items-start justify-between gap-4">
        <DarkSectionTitle eyebrow="Maturity radar" title={title} />
        {realItems.length < 3 && <SchemaChip label="schema parcial" />}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid place-items-center border border-[#f5f4e7]/10 bg-[#0f0f11] p-3">
          <svg viewBox="0 0 360 360" className="h-[320px] w-full max-w-[360px]" role="img" aria-label={title}>
            {[0.25, 0.5, 0.75, 1].map((ring) => (
              <circle key={ring} cx={cx} cy={cy} r={radius * ring} fill="none" stroke="rgba(245,244,231,0.12)" strokeWidth="1" />
            ))}
            {points.map((point) => (
              <line key={`${point.item.id}-axis`} x1={cx} y1={cy} x2={point.ax} y2={point.ay} stroke="rgba(245,244,231,0.10)" strokeWidth="1" />
            ))}
            <polygon points={polygon} fill="rgba(209,255,0,0.24)" stroke="#d1ff00" strokeWidth="2" />
            {points.map((point) => (
              <g key={point.item.id}>
                <circle cx={point.x} cy={point.y} r="4.5" fill={scoreTone(point.item.score, point.item.max) === "danger" ? "#ef4444" : scoreTone(point.item.score, point.item.max) === "warn" ? "#f5b340" : "#d1ff00"} />
                <text x={point.lx} y={point.ly} textAnchor={point.lx < cx ? "end" : point.lx > cx ? "start" : "middle"} dominantBaseline="middle" fill="rgba(245,244,231,0.58)" fontSize="10" fontFamily="monospace">
                  {shortText(point.item.label, 16)}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="grid content-start gap-3">
          {plotted.map((item) => {
            const tone = scoreTone(item.score, item.max)
            const pctValue = scorePercent(item)
            return (
              <article key={item.id} className="aiox-surface-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="truncate text-[16px] font-black text-[#f5f4e7]">{item.label}</h4>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-[1.45] text-[#f5f4e7]/52">{item.findings[0] || "Sem finding detalhado."}</p>
                  </div>
                  <span className={cn("text-[28px] font-black leading-none", tone === "danger" ? "text-[#ef4444]" : tone === "warn" ? "text-[#f5b340]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
                    {item.score ?? "--"}
                  </span>
                </div>
                <div className="mt-3 h-2 bg-[#f5f4e7]/8">
                  <div className={cn("h-full", tone === "danger" ? "bg-[#ef4444]" : tone === "warn" ? "bg-[#f5b340]" : "bg-[#d1ff00]")} style={{ width: `${Math.max(3, pctValue)}%` }} />
                </div>
              </article>
            )
          })}
          {realItems.length < 3 && (
            <p className="border border-[#f5b340]/25 bg-[#f5b340]/8 p-3 text-[12px] font-bold leading-[1.5] text-[#f5b340]">
              {emptySchema}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function DarkRiskRegister({
  risks,
  remediation,
  p0,
}: {
  risks: SinkraPilotMap["risks"]
  remediation: SinkraRemediationItem[]
  p0?: SinkraRemediationItem
}) {
  const visibleRisks = risks.length > 0
    ? risks.slice(0, 5)
    : remediation.slice(0, 5).map((item, index) => ({
        id: `remediation-${index}`,
        title: item.dimension,
        severity: item.priority === "P0" ? "critical" : item.priority === "P1" ? "high" : "medium",
        evidence: item.finding,
        action: item.action,
      }))
  const blockers = visibleRisks.filter((risk) => /critical|high|p0|p1/i.test(risk.severity)).length

  return (
    <section className="aiox-hud-frame bg-[#050505] p-5">
      <div className="flex items-start justify-between gap-4">
        <DarkSectionTitle eyebrow="Risk register" title="Riscos que mudam a decisão" />
        <span className={cn("text-[34px] font-black leading-none", blockers > 0 ? "text-[#ef4444]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
          {blockers}
        </span>
      </div>
      <div className="mt-6 grid gap-3">
        {visibleRisks.map((risk, index) => {
          const danger = /critical|p0/i.test(risk.severity)
          const warn = !danger && /high|p1/i.test(risk.severity)
          return (
            <article key={`${risk.title}-${index}`} className="aiox-surface-card grid gap-4 p-4 md:grid-cols-[96px_minmax(0,1fr)]">
              <div>
                <div className={cn("text-[22px] font-black uppercase leading-none", danger ? "text-[#ef4444]" : warn ? "text-[#f5b340]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
                  {danger ? "P0" : warn ? "P1" : "P2"}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                  {risk.severity}
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="text-[18px] font-black leading-tight text-[#f5f4e7]">{risk.title}</h4>
                <p className="mt-2 text-[14px] leading-[1.52] text-[#f5f4e7]/58">{risk.evidence}</p>
                <div className="mt-3 border-l-2 border-[#d1ff00] pl-3 text-[13px] font-bold leading-[1.5] text-[#d1ff00]">
                  {risk.action || p0?.action || "Declarar ação corretiva e dono operacional."}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function DarkRoadmapSummary({
  remediation,
  vetoActive,
}: {
  remediation: SinkraRemediationItem[]
  vetoActive: boolean
}) {
  const p0Count = remediation.filter((item) => item.priority === "P0").length
  const p1Count = remediation.filter((item) => item.priority === "P1").length
  const p2Count = remediation.length - p0Count - p1Count
  const estimatedWeeks = remediation.reduce((max, item) => {
    const timing = remediationWeeks(item.priority, item.action)
    return Math.max(max, timing.start + timing.span)
  }, 0)

  return (
    <div className="mt-5 grid gap-px bg-[#f5f4e7]/10 sm:grid-cols-4">
      <DarkSignal label="P0 bloqueia" value={String(p0Count)} tone={p0Count > 0 ? "danger" : "good"} />
      <DarkSignal label="P1 estabiliza" value={String(p1Count)} tone={p1Count > 0 ? "warn" : "good"} />
      <DarkSignal label="Backlog P2" value={String(Math.max(0, p2Count))} tone="neutral" />
      <DarkSignal label="ETA realista" value={estimatedWeeks > 0 ? `S+${estimatedWeeks}` : vetoActive ? "definir" : "ok"} tone={vetoActive ? "warn" : "good"} />
    </div>
  )
}

function DarkDonut({
  label,
  value,
  suffix,
  status,
  tone,
  schema,
}: {
  label: string
  value: number | null
  suffix: string
  status: string
  tone: Tone
  schema: string
}) {
  const pctValue = value === null ? 24 : Math.max(0, Math.min(100, value))
  const color = tone === "danger" ? "#ef4444" : tone === "warn" ? "#f5b340" : "#d1ff00"
  return (
    <article className="aiox-surface-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>{label}</div>
          <div className={cn("mt-2 text-[14px] font-black uppercase tracking-[0.08em]", value === null ? "text-[#f5b340]" : "text-[#f5f4e7]/72")} style={{ fontFamily: MONO_FONT }}>
            {status}
          </div>
        </div>
        {value === null && <SchemaChip label="schema" />}
      </div>
      <div className="mt-6 grid place-items-center">
        <div
          className="grid h-36 w-36 place-items-center rounded-full"
          style={{ background: `conic-gradient(${color} ${pctValue * 3.6}deg, rgba(245,244,231,0.08) 0deg)` }}
        >
          <div className="grid h-24 w-24 place-items-center rounded-full bg-[#0f0f11]">
            <div className="text-center">
              <div className={cn("text-[34px] font-black leading-none tracking-[-0.055em]", value === null ? "text-[#f5f4e7]/35" : tone === "danger" ? "text-[#ef4444]" : tone === "warn" ? "text-[#f5b340]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
                {value ?? "--"}
              </div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>{suffix}</div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-5 border-t border-[#f5f4e7]/10 pt-3 text-[11px] uppercase tracking-[0.1em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
        {schema}
      </p>
    </article>
  )
}

function DarkQuadrant({
  title,
  items,
  emptySchema,
}: {
  title: string
  items: Array<{ label: string; x: number; y: number; tone: Tone }>
  emptySchema: string
}) {
  const plotted = items.length > 0
    ? items.slice(0, 10)
    : [
        { label: "schema", x: 35, y: 35, tone: "warn" as Tone },
        { label: "target", x: 78, y: 82, tone: "good" as Tone },
        { label: "blocked", x: 68, y: 42, tone: "danger" as Tone },
      ]
  return (
    <section className="aiox-hud-frame bg-[#0f0f11] p-5">
      <div className="flex items-start justify-between gap-4">
        <DarkSectionTitle eyebrow="automação x padrão" title={title} />
        {items.length === 0 && <SchemaChip label="schema pendente" />}
      </div>
      <div className="relative mt-6 h-[360px] border border-[#f5f4e7]/10 bg-[#050505]">
        <div className="absolute inset-x-0 top-1/2 border-t border-[#f5f4e7]/10" />
        <div className="absolute inset-y-0 left-1/2 border-l border-[#f5f4e7]/10" />
        <div className="absolute left-3 top-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>baixo padrão</div>
        <div className="absolute right-3 top-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>automatizar</div>
        <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>manual</div>
        <div className="absolute bottom-3 right-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>worker-ready</div>
        {plotted.map((item) => (
          <div
            key={`${item.label}-${item.x}-${item.y}`}
            className={cn("absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border", item.tone === "danger" ? "border-[#ef4444] bg-[#ef4444]" : item.tone === "warn" ? "border-[#f5b340] bg-[#f5b340]" : "border-[#d1ff00] bg-[#d1ff00]")}
            style={{ left: `${item.x}%`, top: `${100 - item.y}%` }}
            title={item.label}
          />
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-[1.5] text-[#f5f4e7]/45">{items.length === 0 ? emptySchema : `${items.length} tasks posicionadas por automatabilidade e padronização.`}</p>
    </section>
  )
}

function DarkRiskHeatmap({
  risks,
  gaps,
  emptySchema,
}: {
  risks: SinkraPilotMap["risks"]
  gaps: NonNullable<ObservatoryTypeSpecific["sinkra"]>["gaps"]
  emptySchema: string
}) {
  const severities = ["critical", "high", "medium", "low"]
  const categories = ["governança", "dados", "automação", "processo"]
  const hasData = risks.length > 0 || gaps.length > 0
  return (
    <section className="aiox-hud-frame bg-[#0f0f11] p-5">
      <div className="flex items-start justify-between gap-4">
        <DarkSectionTitle eyebrow="mapa de calor" title="Onde a operação quebra" />
        {!hasData && <SchemaChip label="schema pendente" />}
      </div>
      <div className="mt-6 overflow-x-auto border border-[#f5f4e7]/10">
        <div className="grid min-w-[560px] grid-cols-[110px_repeat(4,minmax(0,1fr))]">
          <div className="bg-[#050505] p-3" />
          {categories.map((category) => (
            <div key={category} className="border-l border-[#f5f4e7]/10 bg-[#050505] p-3 text-center text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/40" style={{ fontFamily: MONO_FONT }}>{category}</div>
          ))}
          {severities.map((severity, row) => (
            <Fragment key={severity}>
              <div key={`${severity}-label`} className="border-t border-[#f5f4e7]/10 bg-[#050505] p-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/45" style={{ fontFamily: MONO_FONT }}>{severity}</div>
              {categories.map((category, col) => {
                const count = hasData
                  ? risks.filter((risk) => risk.severity.toLowerCase().includes(severity)).length + gaps.filter((gap) => gap.severity.toLowerCase().includes(severity) && gap.category.toLowerCase().includes(category.slice(0, 4))).length
                  : Math.max(0, 4 - row - Math.abs(col - 1))
                const hot = count > 2 || (row === 0 && count > 0)
                return (
                  <div key={`${severity}-${category}`} className={cn("min-h-[70px] border-l border-t border-[#f5f4e7]/10 p-3", hot ? "bg-[#ef4444]/22" : count > 0 ? "bg-[#f5b340]/16" : "bg-[#050505]")}>
                    <div className={cn("text-[28px] font-black leading-none", hot ? "text-[#ef4444]" : count > 0 ? "text-[#f5b340]" : "text-[#f5f4e7]/20")} style={{ fontFamily: DISPLAY_FONT }}>
                      {count}
                    </div>
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="mt-4 text-[12px] leading-[1.5] text-[#f5f4e7]/45">{hasData ? "Mapa cruza severidade com categoria para priorizar correção." : emptySchema}</p>
    </section>
  )
}

function DarkFunnel({ items }: { items: Array<{ label: string; value: number; active: number; schema: string }> }) {
  return (
    <section className="aiox-hud-frame bg-[#0f0f11] p-5">
      <DarkSectionTitle eyebrow="funil operacional" title="Da evidência até release" />
      <div className="mt-6 grid gap-3 lg:grid-cols-5">
        {items.map((item, index) => {
          const ratio = item.value > 0 ? item.active / item.value : 0
          const width = Math.max(18, Math.min(100, ratio * 100))
          const blocked = ratio < 1
          return (
            <article key={item.label} className="aiox-surface-card relative bg-[#050505] p-4">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                {String(index + 1).padStart(2, "0")} · {item.label}
              </div>
              <div className={cn("mt-3 text-[32px] font-black leading-none tracking-[-0.05em]", blocked ? "text-[#f5b340]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
                {item.active}/{item.value || "--"}
              </div>
              <div className="mt-4 h-2 bg-[#f5f4e7]/8">
                <div className={cn("h-full", blocked ? "bg-[#f5b340]" : "bg-[#d1ff00]")} style={{ width: `${width}%` }} />
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>
                {item.schema}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function SchemaChip({ label }: { label: string }) {
  return (
    <span className="border border-[#f5b340]/35 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#f5b340]" style={{ fontFamily: MONO_FONT }}>
      {label}
    </span>
  )
}

function DarkScoreRow({
  label,
  score,
  max,
  maxScale,
  findings,
}: {
  label: string
  score: number | null
  max: number | null
  maxScale: number
  findings: string[]
}) {
  const tone = scoreTone(score, max)
  const width = ((score ?? 0) / Math.max(max ?? maxScale, 1)) * 100
  return (
    <article className="aiox-surface-card grid gap-4 bg-[#050505] p-4 lg:grid-cols-[minmax(180px,0.75fr)_80px_minmax(0,1fr)_minmax(220px,1fr)]">
      <div className="min-w-0">
        <h4 className="truncate text-[15px] font-black capitalize text-[#f5f4e7]">{label}</h4>
        <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>{tone === "good" ? "pass" : tone === "warn" ? "review" : "fail"}</p>
      </div>
      <div className={cn("text-[30px] font-black leading-none", tone === "good" ? "text-[#d1ff00]" : tone === "warn" ? "text-[#f5b340]" : "text-[#ef4444]")} style={{ fontFamily: DISPLAY_FONT }}>
        {score ?? "--"}
      </div>
      <div className="self-center">
        <div className="h-3 bg-[#f5f4e7]/8">
          <div className={cn("h-full", tone === "good" ? "bg-[#d1ff00]" : tone === "warn" ? "bg-[#f5b340]" : "bg-[#ef4444]")} style={{ width: `${Math.max(3, Math.min(100, width))}%` }} />
        </div>
      </div>
      <p className="line-clamp-2 text-[13px] leading-[1.45] text-[#f5f4e7]/55">{findings[0] || "Sem finding detalhado."}</p>
    </article>
  )
}

function DarkBar({ label, value, max, display, tone }: { label: string; value: number; max: number; display: string; tone: "lime" | "blue" }) {
  return (
    <div className="mt-2 grid grid-cols-[70px_minmax(0,1fr)_82px] items-center gap-3">
      <span className="text-[9px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{label}</span>
      <div className="h-2 bg-[#f5f4e7]/8">
        <div className={cn("h-full", tone === "lime" ? "bg-[#d1ff00]" : "bg-[#0099ff]")} style={{ width: `${Math.max(2, Math.min(100, (value / Math.max(max, 1)) * 100))}%` }} />
      </div>
      <span className="truncate text-right text-[11px] font-bold text-[#f5f4e7]/58">{display}</span>
    </div>
  )
}

function DarkAct({ index, title, stat, body, tone }: { index: string; title: string; stat: string; body: string; tone: Tone }) {
  return (
    <article className="aiox-surface-card p-5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>Ato {index}</div>
      <div className={cn("mt-2 text-[42px] font-black leading-none tracking-[-0.05em]", tone === "danger" ? "text-[#ef4444]" : tone === "warn" ? "text-[#f5b340]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
        {stat}
      </div>
      <h4 className="mt-3 text-[21px] font-black leading-tight text-[#f5f4e7]">{title}</h4>
      <p className="mt-2 text-[14px] font-bold leading-[1.5] text-[#f5f4e7]/58">{body}</p>
    </article>
  )
}

function FanPanel({ title, items }: { title: string; items: Array<{ label: string; value: number }> }) {
  return (
    <div className="bg-[var(--paper)] p-4">
      <p className="mb-3 text-[11px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{title}</p>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_42px] items-center gap-3">
            <span className="truncate text-[13px] font-bold text-[var(--ink)]">{item.label}</span>
            <span className="text-right text-[22px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricBar({
  label,
  value,
  max,
  display,
  tone = "neutral",
}: {
  label: string
  value: number
  max: number
  display: string
  tone?: Tone
}) {
  return (
    <div className="grid grid-cols-[68px_minmax(0,1fr)_74px] items-center gap-2">
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{label}</span>
      <div className="h-1.5 bg-[var(--paper-deep)]">
        <div className={cn("h-full", tone === "warn" ? "bg-[var(--warning-ink)]" : "bg-[var(--ink)]")} style={{ width: `${Math.max(2, Math.min(100, (value / Math.max(max, 1)) * 100))}%` }} />
      </div>
      <span className="truncate text-right text-[11px] font-bold text-[var(--ink-2)]">{display}</span>
    </div>
  )
}

function CumulativeChart({ title, items }: { title: string; items: Array<{ label: string; value: number; display: string }> }) {
  let running = 0
  const cumulative = items.map((item) => {
    running += item.value
    return { ...item, cumulative: running }
  })
  const max = maxMetric(cumulative.map((item) => item.cumulative))
  return (
    <div className="bg-[var(--paper)] p-5">
      <p className="mb-4 text-[11px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{title}</p>
      <div className="grid gap-3">
        {cumulative.map((item) => (
          <div key={item.label} className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-bold text-[var(--ink)]">{item.label}</span>
              <span className="text-[12px] font-bold text-[var(--ink-2)]">{item.display}</span>
            </div>
            <div className="h-2 bg-[var(--paper-deep)]">
              <div className="h-full bg-[var(--ink)]" style={{ width: `${Math.max(3, Math.min(100, (item.cumulative / max) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniEmpty({ title }: { title: string }) {
  return (
    <div className="border border-[var(--warning-ink)] bg-[var(--paper-alt)] px-3 py-2 text-[13.5px] font-bold text-[var(--warning-ink)]">
      {title}
    </div>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#f5f4e7]/8 p-3">
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-[#f5f4e7]/58" style={{ fontFamily: MONO_FONT }}>{label}</div>
      <div className="mt-1 truncate text-[18px] font-black text-[#f5f4e7]">{value}</div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--paper)] px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        {label}
      </div>
      <div className="mt-1 truncate text-[21px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
        {value}
      </div>
    </div>
  )
}

function Kpi({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="bg-[var(--paper)] p-4">
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{label}</div>
      <div className={cn("mt-1 text-[30px] font-black leading-none tabular-nums", toneClass(tone))} style={{ fontFamily: DISPLAY_FONT }}>
        {value}
      </div>
    </div>
  )
}

function Signal({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="bg-[var(--paper)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{label}</div>
      <div className={cn("mt-0.5 truncate text-[17px] font-black", toneClass(tone))}>{value}</div>
    </div>
  )
}

function SectionHead({ eyebrow, title, meta, compact = false }: { eyebrow: string; title: string; meta?: string; compact?: boolean }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] bg-[var(--paper-alt)]", compact ? "p-4" : "p-5")}>
      <div>
        <p className="text-[11px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{eyebrow}</p>
        <h3 className={cn("mt-1 font-black tracking-[-0.035em] text-[var(--ink)]", compact ? "text-[22px]" : "text-[28px]")} style={{ fontFamily: DISPLAY_FONT }}>
          {title}
        </h3>
      </div>
      {meta && <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{meta}</span>}
    </header>
  )
}

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={cn("h-fit border px-2 py-1 text-center text-[10.5px] uppercase tracking-[0.1em]", borderToneClass(tone))} style={{ fontFamily: MONO_FONT }}>
      {label}
    </span>
  )
}

function DependencyColumn({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{title}</div>
      <div className="grid gap-1.5">
        {values.slice(0, 5).map((value) => (
          <div key={value} className="truncate border border-[var(--rule-soft)] bg-[var(--paper-alt)] px-2 py-1.5 text-[12.5px] text-[var(--ink-2)]">{value}</div>
        ))}
      </div>
    </div>
  )
}

function DistributionPanel({
  title,
  items,
  empty = "Sem dados estruturados",
  compact = false,
}: {
  title: string
  items: Array<{ label: string; value: number }>
  empty?: string
  compact?: boolean
}) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div className={cn("bg-[var(--paper)]", compact ? "p-4" : "p-4")}>
      <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        {title}
      </div>
      {items.length > 0 ? (
        <div className="grid gap-2">
          {items.slice(0, compact ? 5 : 8).map((item) => (
            <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_42px] items-center gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate text-[13.5px] font-bold text-[var(--ink)]">{item.label}</span>
                </div>
                <div className="h-1.5 bg-[var(--paper-deep)]">
                  <div className="h-full bg-[var(--ink)]" style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} />
                </div>
              </div>
              <span className="text-right text-[20px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <MiniEmpty title={empty} />
      )}
    </div>
  )
}

function ScoreBar({ label, value, tone = "neutral" }: { label: string; value: number; tone?: Tone }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{label}</span>
        <span className={cn("text-[24px] font-black leading-none", toneClass(tone))} style={{ fontFamily: DISPLAY_FONT }}>{pct(value)}</span>
      </div>
      <div className="h-2.5 bg-[var(--paper-deep)]">
        <div className={cn("h-full", tone === "good" ? "bg-[var(--lime-ink)]" : tone === "warn" || tone === "danger" ? "bg-[var(--warning-ink)]" : "bg-[var(--ink)]")} style={{ width: `${Math.max(4, Math.min(100, value <= 1 ? value * 100 : value))}%` }} />
      </div>
    </div>
  )
}

function Tag({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span className={cn("border px-2 py-1 text-[10.5px] uppercase tracking-[0.08em]", borderToneClass(tone))} style={{ fontFamily: MONO_FONT }}>
      {label}
    </span>
  )
}

function RoleTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{label}</div>
      <div className="mt-1 line-clamp-2 text-[14px] font-black leading-tight text-[var(--ink)]">{value}</div>
      <div className="mt-2 truncate text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{sub}</div>
    </div>
  )
}

function toneClass(tone: Tone) {
  if (tone === "good") return "text-[var(--lime-ink)]"
  if (tone === "warn") return "text-[var(--warning-ink)]"
  if (tone === "danger") return "text-[var(--warning-ink)]"
  return "text-[var(--ink)]"
}

function borderToneClass(tone: Tone) {
  if (tone === "good") return "border-[var(--lime-ink)] text-[var(--lime-ink)]"
  if (tone === "warn" || tone === "danger") return "border-[var(--warning-ink)] text-[var(--warning-ink)]"
  return "border-[var(--rule-strong)] text-[var(--ink-3)]"
}
