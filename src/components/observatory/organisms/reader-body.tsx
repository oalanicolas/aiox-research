import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode, type RefObject } from "react"
import dynamic from "next/dynamic"
import { ArrowLeftRight, ChevronDown, ExternalLink, Trophy } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import YAML from "yaml"
import { cn } from "@/lib/utils"
import { LightScrollArea } from "../molecules/light-scroll-area"
import { ScatterChart, type ScatterPoint } from "../molecules/scatter-chart"
import { TaxonomyList, type TaxonomyItem } from "../molecules/taxonomy-list"
import { TimelineChart, type TimelinePoint } from "../molecules/timeline-chart"
import { markdownComponents } from "../foundations/markdown-components"
import type {
  ObservatoryCliff,
  ObservatoryCategoricalWinner,
  ObservatoryData,
  ObservatoryDecisionNode,
  ObservatoryDocument,
  ObservatoryEditorsNote,
  ObservatoryGapItem,
  ObservatoryMatrix,
  ObservatoryMatrixRow,
  ObservatoryPersona,
  ObservatoryPlayer,
  ObservatoryPlayerProfile,
  ObservatoryRunSummary,
  ObservatoryScoreDimension,
  ObservatoryMetric,
  ObservatorySource_Entry,
  ObservatoryTco,
  ObservatoryTiebreaker,
  ObservatoryTypeSpecific,
} from "../foundations/types"
import type { ObservatorySource, ReaderMode } from "../foundations/constants"
import { coverageNumeric, formatBytes, statusKeyFromRaw } from "../foundations/utils"
import { DISPLAY_FONT, MONO_FONT, SANS_FONT, SERIF_FONT, observatoryDarkThemeVars } from "../foundations/theme"

const MatrixView = dynamic(() => import("./matrix-view").then((mod) => mod.MatrixView), {
  loading: () => <ReportLoader label="Matrix" />,
})
const CoverageView = dynamic(() => import("./coverage-view").then((mod) => mod.CoverageView), {
  loading: () => <ReportLoader label="Coverage" />,
})
const WeightsView = dynamic(() => import("./weights-view").then((mod) => mod.WeightsView), {
  loading: () => <ReportLoader label="Weights" />,
})
const BenchOverviewView = dynamic(() => import("./bench-overview-view").then((mod) => mod.BenchOverviewView), {
  loading: () => <ReportLoader label="Overview" />,
})
const DuelView = dynamic(() => import("./duel-view").then((mod) => mod.DuelView), {
  loading: () => <ReportLoader label="Comparativo" />,
})
const DocsView = dynamic(() => import("./docs-view").then((mod) => mod.DocsView), {
  loading: () => <ReportLoader label="Docs" />,
})
const BenchCuriosityView = dynamic(() => import("./bench-cross-views").then((mod) => mod.BenchCuriosityView), {
  loading: () => <ReportLoader label="Perguntas" />,
})
const BenchWavesView = dynamic(() => import("./bench-cross-views").then((mod) => mod.BenchWavesView), {
  loading: () => <ReportLoader label="Waves" />,
})
const SinkraMapReport = dynamic(() => import("./sinkra-map-report").then((mod) => mod.SinkraMapReport), {
  loading: () => <ReportLoader label="SINKRA Map" dark />,
})
const SinkraFlowReport = dynamic(() => import("./sinkra-map-report").then((mod) => mod.SinkraFlowReport), {
  loading: () => <ReportLoader label="Fluxo" dark />,
})
const SinkraAutomationReport = dynamic(() => import("./sinkra-map-report").then((mod) => mod.SinkraAutomationReport), {
  loading: () => <ReportLoader label="Automação" dark />,
})
const SinkraGovernanceReport = dynamic(() => import("./sinkra-map-report").then((mod) => mod.SinkraGovernanceReport), {
  loading: () => <ReportLoader label="Governança" dark />,
})
const SinkraAccountabilityReport = dynamic(() => import("./sinkra-map-report").then((mod) => mod.SinkraAccountabilityReport), {
  loading: () => <ReportLoader label="RACI" dark />,
})
const SinkraGapsReport = dynamic(() => import("./sinkra-map-report").then((mod) => mod.SinkraGapsReport), {
  loading: () => <ReportLoader label="Gaps" dark />,
})
const SinkraEvidenceReport = dynamic(() => import("./sinkra-map-report").then((mod) => mod.SinkraEvidenceReport), {
  loading: () => <ReportLoader label="Evidências" dark />,
})

/* Organism — reader body. Routes between modes:
 *   - document  → markdown (default for all sources)
 *   - matrix    → grid of ScoreCells (bench)
 *   - personas  → grid of PersonaCards (bench)
 *   - tco       → TCO scenarios table (bench/product)
 *   - decision  → decision tree + tiebreakers + cliffs (bench) */
export function ReaderBody({
  source = "research",
  mode = "document",
  content,
  file,
  bodyRef,
  documents,
  matrix,
  scoreDimensions,
  scoreMetrics,
  runs,
  personas,
  tco,
  tiebreakers,
  cliffs,
  decisionTree,
  categorical,
  gapItems,
  editorsNote,
  playerProfiles,
  topSources,
  researchPlayers,
  sourceSummary,
  typeSpecific,
  benchCuriosity,
  benchWaves,
}: {
  source?: ObservatorySource
  mode?: ReaderMode
  content: string
  file?: string
  bodyRef: RefObject<HTMLDivElement | null>
  documents?: ObservatoryDocument[]
  matrix?: ObservatoryMatrix | null
  scoreDimensions?: ObservatoryScoreDimension[]
  scoreMetrics?: ObservatoryMetric[]
  runs?: ObservatoryRunSummary[]
  personas?: ObservatoryPersona[]
  tco?: ObservatoryTco | null
  tiebreakers?: ObservatoryTiebreaker[]
  cliffs?: ObservatoryCliff[]
  decisionTree?: ObservatoryDecisionNode[]
  categorical?: ObservatoryCategoricalWinner[]
  gapItems?: ObservatoryGapItem[]
  editorsNote?: ObservatoryEditorsNote | null
  playerProfiles?: ObservatoryPlayerProfile[]
  topSources?: ObservatorySource_Entry[]
  researchPlayers?: ObservatoryPlayer[]
  sourceSummary?: string[]
  typeSpecific?: ObservatoryTypeSpecific
  benchCuriosity?: ObservatoryData["curiosity"]
  benchWaves?: ObservatoryData["waves"]
}) {
  const benchReport = (children: ReactNode) =>
    source === "bench" || source === "demo" ? <BenchReportShell>{children}</BenchReportShell> : children
  const researchLabels = researchDashboardLabels(documents ?? [])

  if (mode === "overview") {
    return <OverviewView runs={runs ?? []} />
  }
  if (mode === "map") {
    if (source === "bench" || source === "demo") {
      /* Overview = 1-pager strict (verdict + score card + actions + provenance).
         Replaces the previous BenchMapReport which duplicated content from
         Matriz/Comparativo/Personas/Decisão. See DOCTRINE-decision-in-one-click.md. */
      return (
        <BenchOverviewView
          runs={runs ?? []}
          matrix={matrix ?? null}
          personas={personas ?? []}
          playerProfiles={playerProfiles ?? []}
          gapItems={gapItems ?? []}
          sourceCount={topSources?.length ?? 0}
        />
      )
    }
    if (source === "research") {
      return (
        <ResearchMapReport
          runs={runs ?? []}
          documents={documents ?? []}
          sources={topSources ?? []}
          players={researchPlayers ?? []}
          sourceSummary={sourceSummary ?? []}
          labels={researchLabels}
        />
      )
    }
    return <SinkraMapReport sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "slides") {
    if (source === "bench" || source === "demo") {
      return (
        <BenchSlidesReport
          runs={runs ?? []}
          documents={documents ?? []}
          matrix={matrix ?? null}
          scoreDimensions={scoreDimensions ?? []}
          personas={personas ?? []}
          tco={tco ?? null}
          cliffs={cliffs ?? []}
          categorical={categorical ?? []}
          gapItems={gapItems ?? []}
          playerProfiles={playerProfiles ?? []}
          typeSpecific={typeSpecific ?? {}}
        />
      )
    }
    return (
      <OperationalSlidesReport
        source={source ?? "research"}
        runs={runs ?? []}
        documents={documents ?? []}
        sourceSummary={sourceSummary ?? []}
        topSources={topSources ?? []}
        researchPlayers={researchPlayers ?? []}
        sinkra={typeSpecific?.sinkra}
      />
    )
  }
  if (mode === "curiosity" && source === "research") {
    return <ResearchCuriosityReport documents={documents ?? []} />
  }
  if (mode === "recommendations" && source === "research") {
    return <ResearchRecommendationsReport documents={documents ?? []} labels={researchLabels} />
  }
  if (mode === "evidence" && source === "research") {
    return <ResearchEvidenceReport runs={runs ?? []} documents={documents ?? []} sources={topSources ?? []} sourceSummary={sourceSummary ?? []} />
  }
  if (mode === "evidence" && (source === "bench" || source === "demo")) {
    return (
      <BenchEvidenceReport
        documents={documents ?? []}
        matrix={matrix ?? null}
        scoreDimensions={scoreDimensions ?? []}
        gapItems={gapItems ?? []}
        playerProfiles={playerProfiles ?? []}
      />
    )
  }
  if (mode === "roadmap" && (source === "bench" || source === "demo")) {
    return (
      <BenchRoadmapReport
        runs={runs ?? []}
        documents={documents ?? []}
        matrix={matrix ?? null}
        scoreDimensions={scoreDimensions ?? []}
        categorical={categorical ?? []}
        gapItems={gapItems ?? []}
        cliffs={cliffs ?? []}
        playerProfiles={playerProfiles ?? []}
      />
    )
  }
  if (mode === "waves" && source === "research") {
    return <ResearchWavesReport runs={runs ?? []} documents={documents ?? []} />
  }
  if (mode === "flow") {
    return <SinkraFlowReport sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "automation") {
    return <SinkraAutomationReport sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "governance") {
    return <SinkraGovernanceReport sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "accountability") {
    return <SinkraAccountabilityReport sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "gaps") {
    return <SinkraGapsReport sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "evidence") {
    return <SinkraEvidenceReport sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "sources") {
    return <SourcesView sources={topSources ?? []} sourceSummary={sourceSummary ?? []} />
  }
  if (mode === "players") {
    return <ResearchPlayersView players={researchPlayers ?? []} documents={documents ?? []} labels={researchLabels} />
  }
  if (mode === "score") {
    return <BenchScoreReport dimensions={scoreDimensions ?? []} scoreMetrics={scoreMetrics ?? []} matrix={matrix ?? null} playerProfiles={playerProfiles ?? []} />
  }
  if (mode === "matrix" && matrix) {
    return benchReport(<MatrixView matrix={matrix} playerProfiles={playerProfiles ?? []} personas={personas ?? []} />)
  }
  if (mode === "duel" && matrix) {
    /* DuelView (org.) is URL-state aware (?compare=a,b) and uses live weighted totals.
       BenchDuelReport (inline above) is the legacy report-shell version kept for ref. */
    return benchReport(<DuelView matrix={matrix} playerProfiles={playerProfiles ?? []} personas={personas ?? []} />)
  }
  if (mode === "personas") {
    return <BenchPersonasReport personas={personas ?? []} playerProfiles={playerProfiles ?? []} matrix={matrix ?? null} />
  }
  if (mode === "tco" && tco) {
    return <BenchTcoReport tco={tco} />
  }
  if (mode === "coverage") {
    return benchReport(
      <CoverageView
        typeSpecific={typeSpecific ?? {}}
        playerProfiles={playerProfiles ?? []}
      />,
    )
  }
  if (mode === "decision") {
    return <BenchDecisionReport decisionTree={decisionTree ?? []} tiebreakers={tiebreakers ?? []} cliffs={cliffs ?? []} categorical={categorical ?? []} editorsNote={editorsNote ?? null} playerProfiles={playerProfiles ?? []} />
  }
  /* Cross-poll bench-only: curiosity + waves vêm de sidecar files (curiosity-queue.yaml +
     execution-log.jsonl). Research-mode tem renderers próprios mais acima que comem
     documents[]. Aqui usamos os organisms bench-cross-views com dados tipados. */
  if (mode === "curiosity" && (source === "bench" || source === "demo")) {
    return benchReport(<BenchCuriosityView curiosity={benchCuriosity ?? []} />)
  }
  if (mode === "waves" && (source === "bench" || source === "demo")) {
    return benchReport(<BenchWavesView waves={benchWaves ?? []} />)
  }
  if (mode === "weights" && matrix) {
    return benchReport(
      <WeightsView
        matrix={matrix}
        personas={personas ?? []}
        playerProfiles={playerProfiles ?? []}
      />,
    )
  }
  if (mode === "workflow") {
    return <SinkraWorkflowView sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "tasks") {
    return <SinkraTasksView sinkra={typeSpecific?.sinkra} />
  }
  if (mode === "gates") {
    return <SinkraGatesView sinkra={typeSpecific?.sinkra} />
  }

  /* Default: document (markdown) */
  if (file && isStructuredArtifact(file)) {
    return <StructuredArtifactView file={file} content={content} bodyRef={bodyRef} />
  }

  /* DocsView (AIOX Dash v2 pattern) — file panel + toolbar + typed body.
     Used when documents[] is populated (bench/demo/research with run files).
     Falls back to bare ReactMarkdown when no documents list exists. */
  const activeRun = runs?.find((run) => run.active) ?? runs?.[0]
  const sourceRoot = source === "research" ? "docs/research" : source === "sinkra-maps" ? "docs/sinkra-maps" : "docs/bench"
  if (file && documents && documents.length > 0 && activeRun) {
    return (
      <DocsView
        documents={documents}
        selectedFile={file}
        content={content}
        sourceRoot={sourceRoot}
        runSlug={activeRun.slug}
        bodyRef={bodyRef}
      />
    )
  }

  return (
    <LightScrollArea ref={bodyRef} className="flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 sm:pb-14 sm:pt-6 lg:px-10 lg:pb-16 lg:pt-7">
      <article className="mx-auto w-full min-w-0 max-w-[720px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </article>
    </LightScrollArea>
  )
}

function BenchReportShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="aiox-report-dark flex min-h-0 flex-1 bg-[var(--report-bg)] text-[var(--report-text)]"
      style={observatoryDarkThemeVars}
    >
      {children}
    </div>
  )
}

function benchScoreGap(row: ObservatoryMatrixRow): number {
  if (row.cells.length < 2) return 0
  const scores = row.cells.map((cell) => cell.score).filter((score) => Number.isFinite(score))
  return scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0
}

function benchEvidenceTotal(matrix: ObservatoryMatrix | null, scoreDimensions: ObservatoryScoreDimension[]) {
  if (matrix) {
    return matrix.rows.reduce(
      (total, row) => total + row.cells.filter((cell) => cell.notes || cell.source || cell.confidence).length,
      0,
    )
  }
  return scoreDimensions.filter((dimension) => dimension.evidence).length
}

function benchEvidenceCapacity(matrix: ObservatoryMatrix | null, scoreDimensions: ObservatoryScoreDimension[]) {
  if (matrix) return matrix.rows.length * matrix.players.length
  return scoreDimensions.length
}

function benchReadinessLabel(score: number) {
  if (score >= 85) return "pronto"
  if (score >= 70) return "competitivo"
  if (score >= 50) return "parcial"
  return "frágil"
}

function benchReadinessTone(score: number) {
  if (score >= 85) return "text-[#d1ff00]"
  if (score >= 70) return "text-[#f5b340]"
  return "text-[#ef4444]"
}

function benchScoreStatus(score: number) {
  if (score >= 90) return "forte"
  if (score >= 75) return "bom"
  if (score >= 55) return "alerta"
  return "fraco"
}

function benchArtifactKind(file: string) {
  if (/score|matrix|dash|json|ya?ml/i.test(file)) return "dados"
  if (/recommend|roadmap|gap|follow|decision/i.test(file)) return "ação"
  if (/source|evidence|citation|inventory/i.test(file)) return "prova"
  return "doc"
}

function BenchMapReport({
  runs,
  documents,
  matrix,
  scoreDimensions,
  personas,
  tco,
  cliffs,
  categorical,
  gapItems,
  playerProfiles,
  typeSpecific,
}: {
  runs: ObservatoryRunSummary[]
  documents: ObservatoryDocument[]
  matrix: ObservatoryMatrix | null
  scoreDimensions: ObservatoryScoreDimension[]
  personas: ObservatoryPersona[]
  tco: ObservatoryTco | null
  cliffs: ObservatoryCliff[]
  categorical: ObservatoryCategoricalWinner[]
  gapItems: ObservatoryGapItem[]
  playerProfiles: ObservatoryPlayerProfile[]
  typeSpecific: ObservatoryTypeSpecific
}) {
  const activeRun = runs.find((run) => run.active) ?? runs[0]
  const verdict = benchVerdict(matrix, scoreDimensions, activeRun)
  const biggestGaps = matrix ? [...matrix.rows].sort((a, b) => benchScoreGap(b) - benchScoreGap(a)).slice(0, 5) : []
  const playerCount = matrix?.players.length ?? playerProfiles.length
  const dimensionCount = matrix?.rows.length ?? scoreDimensions.length
  const scenarioCount = personas.length + (tco?.scenarios.length ?? 0)
  const evidenceCount = benchEvidenceTotal(matrix, scoreDimensions)
  const evidenceCapacity = benchEvidenceCapacity(matrix, scoreDimensions)
  const evidencePct = Math.round((evidenceCount / Math.max(1, evidenceCapacity)) * 100)
  const dataDocs = documents.filter((doc) => benchArtifactKind(doc.file) === "dados")
  const actionDocs = documents.filter((doc) => benchArtifactKind(doc.file) === "ação")
  const proofDocs = documents.filter((doc) => benchArtifactKind(doc.file) === "prova")
  const hasRoadmapSignal = actionDocs.length > 0 || gapItems.length > 0 || cliffs.length > 0
  const risks = [
    ...gapItems.map((gap) => ({ title: gap.title, body: gap.rationale, meta: [gap.priority, gap.complexity].filter(Boolean).join(" · ") })),
    ...cliffs.map((cliff) => ({ title: `${displayBenchPlayer(cliff.player, playerProfiles)} pode quebrar`, body: cliff.impact, meta: cliff.trigger })),
  ].filter((item) => item.title).slice(0, 6)
  const tldrCards = buildBenchTldrCards({
    verdict,
    playerCount,
    dimensionCount,
    evidencePct,
    biggestGaps,
    gapItems,
    categorical,
    documents,
  })
  const roadmapItems = buildBenchRoadmapItems({ gapItems, biggestGaps, categorical, playerProfiles })
  const metaLearnings = buildBenchMetaLearnings({
    matrix,
    scoreDimensions,
    gapItems,
    categorical,
    evidencePct,
    hasRoadmapSignal,
  })

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <section className="aiox-report-hero">
          <div className="aiox-report-hero__main">
            <p className="aiox-report-eyebrow">Mapa do benchmark</p>
            <h2 className="aiox-report-title aiox-safe-text">{activeRun?.displayTitle ?? "Benchmark"}</h2>
            <p className="aiox-report-copy">
              Leitura executiva da comparação: vencedor, distância real, dimensões que explicam a decisão e riscos antes de transformar o bench em escolha.
            </p>
            <div className="mt-6 grid gap-px bg-[var(--report-rule-soft)] sm:grid-cols-4">
              <ResearchDarkMetric label="Players" value={String(playerCount || "—")} />
              <ResearchDarkMetric label="Dimensões" value={String(dimensionCount || "—")} />
              <ResearchDarkMetric label="Evidências" value={String(evidenceCount || "—")} />
              <ResearchDarkMetric label="Cenários" value={String(scenarioCount || "—")} />
            </div>
          </div>
          <aside className="aiox-report-hero__aside">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] opacity-65" style={{ fontFamily: MONO_FONT }}>decisão</p>
              <div className="aiox-safe-text mt-2 text-[42px] font-black leading-none tracking-[-0.055em]" style={{ fontFamily: DISPLAY_FONT }}>
                {verdict.leader}
              </div>
              <p className="mt-4 text-[15px] font-black leading-[1.46]">{verdict.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-black/18">
              <ResearchLightMetric label="Score" value={verdict.score} />
              <ResearchLightMetric label="Gap" value={verdict.gap} />
              <ResearchLightMetric label="Runner" value={verdict.runner} />
              <ResearchLightMetric label="Status" value={verdict.status} />
            </div>
          </aside>
        </section>

        <BenchVerdictBar
          status={verdict.status}
          narrative={verdict.summary}
          action={hasRoadmapSignal ? "Transformar gaps em plano de absorção" : "Validar lacunas antes de decidir"}
          priority={evidencePct >= 70 ? "alta confiança" : "evidência parcial"}
        />

        <BenchTldrPanel cards={tldrCards} />

        <div className="mt-6 grid gap-8">
          <ResearchStorySection
            step="01"
            title="Tese competitiva em três atos"
            copy="A referência funciona porque não começa em tabela: ela primeiro conta onde estamos, qual ação muda o jogo e qual estado queremos alcançar."
          >
            <BenchThreeActsPanel
              current={`${gapItems.length || biggestGaps.length} tensões`}
              action={roadmapItems.length > 0 ? `${roadmapItems.slice(0, 3).length} ações imediatas` : "validar evidências"}
              destination={verdict.leader}
              currentBody={risks[0]?.body || "A decisão ainda precisa ser lida contra contexto, evidência e custo de adoção."}
              actionBody={roadmapItems[0]?.roi || "Gerar follow-up com gaps, won't-fix e critérios de decisão explícitos."}
              destinationBody={`${verdict.summary} Use a matriz para saber onde a recomendação muda.`}
            />
          </ResearchStorySection>

          <ResearchStorySection
            step="02"
            title="Por que esse player vence"
            copy="Comece pela diferença entre líder e alternativa mais próxima. Se o gap é pequeno, o benchmark deve ser lido como empate técnico e não como ranking absoluto."
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <BenchScoreboardPanel matrix={matrix} playerProfiles={playerProfiles} />
              <BenchWinReasons rows={biggestGaps} playerProfiles={playerProfiles} />
            </div>
          </ResearchStorySection>

          <ResearchStorySection
            step="03"
            title="Quão pronto cada player está"
            copy="A referência usa readiness bars para mostrar maturidade sem exigir leitura da matriz inteira. Aqui o score consolidado vira sinal operacional."
          >
            <BenchReadinessPanel matrix={matrix} playerProfiles={playerProfiles} />
          </ResearchStorySection>

          <ResearchStorySection
            step="04"
            title="Onde a decisão muda"
            copy="Dimensões com maior distância são as que tornam os players não intercambiáveis. Elas devem guiar debate, compra ou roadmap."
          >
            <BenchDecisionHeatmap matrix={matrix} scoreDimensions={scoreDimensions} playerProfiles={playerProfiles} />
          </ResearchStorySection>

          <ResearchStorySection
            step="05"
            title="Como o score foi composto"
            copy="Um score único sem decomposição vira ruído. A quebra por dimensão mostra quais pesos ou categorias precisam ser questionados antes de aceitar o veredito."
          >
            <BenchScoreBreakdown matrix={matrix} scoreDimensions={scoreDimensions} playerProfiles={playerProfiles} />
          </ResearchStorySection>

          <ResearchStorySection
            step="06"
            title="Quando a recomendação deixa de valer"
            copy="Riscos, cliffs e gaps mostram as condições nas quais o vencedor deixa de ser a melhor escolha para um contexto específico."
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="riscos" title="Limites da decisão" meta={`${risks.length}`} />
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  {risks.length > 0 ? risks.map((risk, index) => (
                    <article key={`${risk.title}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                        {risk.meta || `risco ${index + 1}`}
                      </div>
                      <h3 className="aiox-safe-text mt-2 text-[18px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{risk.title}</h3>
                      <p className="mt-3 line-clamp-3 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{risk.body || "Sem racional estruturado."}</p>
                    </article>
                  )) : (
                    <div className="border border-[#f5f4e7]/10 bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">Nenhum gap ou cliff estruturado neste bench.</div>
                  )}
                </div>
              </section>
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="categorias" title="Vitórias categóricas" meta={`${categorical.length}`} />
                <div className="grid gap-2 p-4">
                  {categorical.slice(0, 6).map((item, index) => (
                    <div key={`${item.dimension}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-3">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                        {displayBenchPlayer(item.winner, playerProfiles)} vence
                      </div>
                      <div className="aiox-safe-text mt-1 text-[15px] font-black text-[#f5f4e7]">{item.dimension}</div>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-[#f5f4e7]/55">{item.note}</p>
                    </div>
                  ))}
                  {categorical.length === 0 && <div className="text-[13px] text-[#f5f4e7]/50">Sem vitórias categóricas estruturadas.</div>}
                </div>
              </section>
            </div>
          </ResearchStorySection>

          <ResearchStorySection
            step="07"
            title="O que este bench ensina para o próximo"
            copy="A referência tem uma camada meta muito útil: hipóteses confirmadas, falhas, achados emergentes e anti-patterns. Aqui geramos essa leitura automaticamente a partir dos dados disponíveis."
          >
            <BenchMetaLearningPanel learnings={metaLearnings} />
          </ResearchStorySection>

          <ResearchStorySection
            step="08"
            title="Quais artefatos sustentam o bench"
            copy="O mapa executivo termina com materialidade: dados, prova e ação. Se alguma categoria está vazia, o próximo bench deve gerar esse artefato explicitamente."
          >
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="artefatos" title="Dados, prova e ação" meta={`${documents.length}`} />
              <BenchArtifactGrid documents={documents} dataDocs={dataDocs} proofDocs={proofDocs} actionDocs={actionDocs} />
            </section>
          </ResearchStorySection>
        </div>
      </article>
    </LightScrollArea>
  )
}

function BenchEvidenceReport({
  documents,
  matrix,
  scoreDimensions,
  gapItems,
  playerProfiles,
}: {
  documents: ObservatoryDocument[]
  matrix: ObservatoryMatrix | null
  scoreDimensions: ObservatoryScoreDimension[]
  gapItems: ObservatoryGapItem[]
  playerProfiles: ObservatoryPlayerProfile[]
}) {
  const cells = matrix?.rows.flatMap((row) => row.cells.map((cell) => ({ row, cell }))) ?? []
  const withNotes = cells.filter(({ cell }) => cell.notes || cell.source)
  const weakCells = cells.filter(({ cell }) => !cell.notes && !cell.source).slice(0, 8)
  const confidenceGroups = countBy(cells, ({ cell }) => cell.confidence || "sem confiança")
  const dimensionsWithEvidence = scoreDimensions.filter((dimension) => dimension.evidence)

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="evidências"
          title="O que sustenta a comparação"
          copy="Esta aba separa score de prova: notas por célula, fontes citadas, confiança declarada e lacunas que reduzem a segurança da decisão."
          accentValue={String(withNotes.length)}
          accentLabel="células com prova"
          metrics={[
            ["Células", cells.length],
            ["Gaps", gapItems.length],
            ["Docs", documents.length],
          ]}
        />

        <div className="mt-6 grid gap-8">
          <ResearchStorySection
            step="01"
            title="Densidade de evidência"
            copy="Antes de confiar no ranking, veja quantas dimensões têm justificativa, fonte ou confiança declarada."
          >
            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="confiança" title="Distribuição" meta={`${Object.keys(confidenceGroups).length} grupos`} />
                <div className="grid gap-3 p-4">
                  {confidenceGroups.map(([label, count]) => (
                    <ResearchBar key={label} label={humanizeResearchLabel(label)} value={Math.round((count / Math.max(1, cells.length)) * 100)} />
                  ))}
                </div>
              </section>
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="notas" title="Evidência por dimensão" meta={`${withNotes.length}`} />
                <div className="grid gap-px bg-[#f5f4e7]/10 p-px md:grid-cols-2">
                  {withNotes.slice(0, 10).map(({ row, cell }, index) => (
                    <article key={`${row.id}-${cell.player}-${index}`} className="min-w-0 bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                        {displayBenchPlayer(cell.player, playerProfiles)} · {cell.confidence || "sem confiança"}
                      </div>
                      <h3 className="aiox-safe-text mt-2 text-[17px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{row.label}</h3>
                      <p className="mt-3 line-clamp-3 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{cell.notes || cell.source}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </ResearchStorySection>

          <ResearchStorySection
            step="02"
            title="Onde a comparação ainda está fraca"
            copy="Células sem nota ou fonte precisam ser lidas com cautela. Elas são candidatas para uma nova rodada de bench."
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="lacunas" title="Células sem evidência" meta={`${weakCells.length}`} />
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  {weakCells.map(({ row, cell }, index) => (
                    <div key={`${row.id}-${cell.player}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5b340]" style={{ fontFamily: MONO_FONT }}>{displayBenchPlayer(cell.player, playerProfiles)}</div>
                      <div className="aiox-safe-text mt-2 text-[16px] font-black text-[#f5f4e7]">{row.label}</div>
                      <p className="mt-2 text-[13px] text-[#f5f4e7]/55">Score {cell.score}; falta nota, fonte ou citação estruturada.</p>
                    </div>
                  ))}
                  {weakCells.length === 0 && <div className="border border-[#f5f4e7]/10 bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">Todas as células carregadas têm algum sinal de evidência.</div>}
                </div>
              </section>
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="scorecard" title="Justificativas" meta={`${dimensionsWithEvidence.length}`} />
                <div className="grid gap-2 p-4">
                  {dimensionsWithEvidence.slice(0, 8).map((dimension, index) => (
                    <div key={`${dimension.name}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-3">
                      <div className="aiox-safe-text text-[15px] font-black text-[#f5f4e7]">{dimension.name}</div>
                      <p className="mt-1 line-clamp-3 text-[12.5px] leading-[1.45] text-[#f5f4e7]/58">{dimension.evidence}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ResearchStorySection>

          <ResearchStorySection
            step="03"
            title="Arquivos que materializam o benchmark"
            copy="Use esta seção para saber se a comparação veio de dash estruturado, scorecard, matrizes, inventários e relatórios complementares."
          >
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="artefatos" title="Documentos e dados" meta={`${documents.length}`} />
              <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <span key={doc.file} className="border border-[#f5f4e7]/12 bg-[#050505] px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-[#f5f4e7]/50" style={{ fontFamily: MONO_FONT }}>
                    {doc.file}
                  </span>
                ))}
              </div>
            </section>
          </ResearchStorySection>
        </div>
      </article>
    </LightScrollArea>
  )
}

function BenchRoadmapReport({
  runs,
  documents,
  matrix,
  scoreDimensions,
  categorical,
  gapItems,
  cliffs,
  playerProfiles,
}: {
  runs: ObservatoryRunSummary[]
  documents: ObservatoryDocument[]
  matrix: ObservatoryMatrix | null
  scoreDimensions: ObservatoryScoreDimension[]
  categorical: ObservatoryCategoricalWinner[]
  gapItems: ObservatoryGapItem[]
  cliffs: ObservatoryCliff[]
  playerProfiles: ObservatoryPlayerProfile[]
}) {
  const activeRun = runs.find((run) => run.active) ?? runs[0]
  const biggestGaps = matrix ? [...matrix.rows].sort((a, b) => benchScoreGap(b) - benchScoreGap(a)).slice(0, 5) : []
  const roadmapItems = buildBenchRoadmapItems({ gapItems, biggestGaps, categorical, playerProfiles })
  const verdict = benchVerdict(matrix, scoreDimensions, activeRun)
  const actionDocs = documents.filter((doc) => benchArtifactKind(doc.file) === "ação")
  const riskCount = gapItems.length + cliffs.length

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="roadmap"
          title="Do benchmark para execução"
          copy="Esta aba transforma diferença competitiva em sequência de ação: o que corrigir agora, o que vira aposta estratégica e o que deve ser marcado como decisão consciente."
          accentValue={String(roadmapItems.length)}
          accentLabel="ações sugeridas"
          metrics={[
            ["Riscos", riskCount],
            ["Docs de ação", actionDocs.length],
            ["Vencedor", verdict.leader],
          ]}
        />

        <div className="mt-6 grid gap-8">
          <ResearchStorySection
            step="01"
            title="Waves de absorção"
            copy="W1 deve resolver clareza e confiança; W2 ataca gaps estruturais; W3 transforma vantagem ou escolha de não competir em posicionamento."
          >
            <BenchRoadmapPanel items={roadmapItems} />
          </ResearchStorySection>

          <ResearchStorySection
            step="02"
            title="Sprints possíveis"
            copy="A mesma lista pode ser executada por caminho rápido ou caminho estratégico. Isso evita transformar todo gap em urgência."
          >
            <BenchSprintBundles items={roadmapItems} />
          </ResearchStorySection>

          <ResearchStorySection
            step="03"
            title="Gaps e cliffs que justificam o plano"
            copy="A execução só faz sentido quando está amarrada a uma evidência de risco, perda ou diferença operacional."
          >
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="risk register" title="Riscos acionáveis" meta={`${riskCount}`} />
              <div className="grid gap-px bg-[#f5f4e7]/10 p-px">
                {riskCount > 0 ? [...gapItems.map((gap) => ({
                  label: gap.priority || "gap",
                  title: gap.title,
                  body: gap.rationale,
                  meta: gap.complexity,
                })), ...cliffs.map((cliff) => ({
                  label: "cliff",
                  title: `${displayBenchPlayer(cliff.player, playerProfiles)} deixa de servir`,
                  body: cliff.impact,
                  meta: cliff.trigger,
                }))].slice(0, 10).map((item, index) => (
                  <article key={`${item.title}-${index}`} className="grid gap-3 bg-[#050505] p-4 lg:grid-cols-[58px_minmax(0,1fr)_220px] lg:items-start">
                    <div className="text-[26px] font-black leading-none tracking-[-0.05em] text-[#f5b340]" style={{ fontFamily: DISPLAY_FONT }}>{String(index + 1).padStart(2, "0")}</div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5b340]" style={{ fontFamily: MONO_FONT }}>{item.label}</div>
                      <h3 className="aiox-safe-text mt-1 text-[18px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{item.title}</h3>
                      <p className="mt-2 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{item.body || "Sem racional estruturado."}</p>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42 lg:text-right" style={{ fontFamily: MONO_FONT }}>{item.meta || "sem meta"}</div>
                  </article>
                )) : (
                  <div className="bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">
                    Este bench não trouxe gaps ou cliffs estruturados. O roadmap foi derivado das maiores diferenças da matriz.
                  </div>
                )}
              </div>
            </section>
          </ResearchStorySection>
        </div>
      </article>
    </LightScrollArea>
  )
}

type BenchSlide = {
  kicker: string
  title: string
  body: string
  accent?: string
  accentLabel?: string
  metrics?: Array<[string, string | number]>
  bullets?: string[]
  footer?: string
  tone?: "lime" | "warning" | "error"
}

function OperationalSlidesReport({
  source,
  runs,
  documents,
  sourceSummary,
  topSources,
  researchPlayers,
  sinkra,
}: {
  source: ObservatorySource
  runs: ObservatoryRunSummary[]
  documents: ObservatoryDocument[]
  sourceSummary: string[]
  topSources: ObservatorySource_Entry[]
  researchPlayers: ObservatoryPlayer[]
  sinkra?: ObservatoryTypeSpecific["sinkra"]
}) {
  const activeRun = runs.find((run) => run.active) ?? runs[0]
  const title = sinkra?.processName || activeRun?.displayTitle || activeRun?.title || "Deck"
  const sourceLabel = source === "sinkra-maps" ? "SINKRA slides" : "Research slides"
  const deckMark = source === "sinkra-maps" ? "S" : "R"
  const mainDocs = documents.filter((doc) => !/sources\.yaml|execution-log\.jsonl/i.test(doc.file))
  const reportDoc =
    mainDocs.find((doc) => /report|readme|overview|map/i.test(doc.file)) ??
    mainDocs[0]
  const actionDoc =
    mainDocs.find((doc) => /recommend|action|quick-win|roadmap|task/i.test(doc.file)) ??
    mainDocs[1]
  const evidenceDoc =
    mainDocs.find((doc) => /source|evidence|metric|score|gate|state/i.test(doc.file)) ??
    mainDocs[2]
  const scoreValue = sinkra?.score.score === null || sinkra?.score.score === undefined ? activeRun?.coverage : sinkra?.score.score
  const coveragePresent = sinkra?.artifactCoverage.filter((item) => item.present).length ?? 0
  const slides = useMemo<BenchSlide[]>(() => {
    const docSlides = mainDocs.slice(0, 4).map((doc, index) => ({
      kicker: `artefato ${String(index + 1).padStart(2, "0")}`,
      title: markdownTitle(doc.content) || humanizeResearchLabel(doc.file.replace(/\.[^.]+$/, "")),
      body: markdownSummary(doc.content),
      accent: formatBytes(doc.bytes),
      accentLabel: doc.phase || "arquivo",
      tone: "lime" as const,
      bullets: extractMarkdownListItems(doc.content, ["Próximos Passos", "Next Steps", "Ações", "Recommendations"]).slice(0, 5),
      footer: doc.file,
    }))
    if (source === "sinkra-maps") {
      return [
        {
          kicker: "abertura",
          title,
          body: "Deck operacional gerado a partir do mapa SINKRA. Use para apresentar processo, workflow, governança, riscos e próximos movimentos sem abrir todos os YAMLs.",
          accent: scoreValue === undefined || scoreValue === "" ? "—" : String(scoreValue),
          accentLabel: "score",
          metrics: [
            ["workflow", sinkra?.workflows.length ?? 0],
            ["tasks", sinkra?.tasks.length ?? 0],
            ["gates", sinkra?.gates.length ?? 0],
            ["artefatos", documents.length],
          ],
          footer: sinkra?.score.result || activeRun?.status,
        },
        {
          kicker: "fluxo",
          title: "Como o trabalho se move",
          body: "Resumo do workflow e das fases do processo para alinhar sequência operacional, dependências e pontos de decisão.",
          accent: String(sinkra?.processPhases.length || sinkra?.workflows.length || 0),
          accentLabel: "fases",
            bullets: (sinkra?.processPhases ?? []).slice(0, 6).map((phase, index) => `${index + 1}. ${phase.name}: ${phase.observed}`),
        },
        {
          kicker: "governança",
          title: "Controles e qualidade",
          body: "Mostra quais gates e critérios sustentam a execução. Útil para discussão de prontidão antes de delegar ou automatizar.",
          accent: String(sinkra?.gates.length ?? 0),
          accentLabel: "gates",
          tone: (sinkra?.gates.length ?? 0) > 0 ? "lime" : "warning",
            bullets: (sinkra?.gates ?? []).slice(0, 6).map((gate) => `${gate.id}: ${gate.name} · ${gate.threshold}`),
        },
        {
          kicker: "riscos",
          title: "Onde o mapa ainda precisa de atenção",
          body: "Gaps, compliance e cobertura de artefatos indicam o que pode quebrar a execução ou reduzir confiança.",
            accent: String((sinkra?.gaps.length ?? 0) + (sinkra?.compliance.blockingIssues.length ?? 0)),
          accentLabel: "sinais",
          tone: (sinkra?.gaps.length ?? 0) > 0 ? "warning" : "lime",
          bullets: [
            ...(sinkra?.gaps ?? []).slice(0, 3).map((gap) => `${gap.id}: ${gap.title}`),
              ...(sinkra?.compliance.blockingIssues ?? []).slice(0, 3).map((risk) => `${risk.id}: ${risk.title}`),
          ],
        },
        {
          kicker: "cobertura",
          title: "Materialidade do pacote",
          body: "Antes de usar o mapa como fonte operacional, valide quantos artefatos críticos existem e quais ainda estão ausentes.",
          accent: `${coveragePresent}/${sinkra?.artifactCoverage.length ?? 0}`,
          accentLabel: "artefatos presentes",
          metrics: [
            ["domínios", sinkra?.domains.length ?? 0],
            ["deps", sinkra?.dependencies.nodes.length ?? 0],
            ["raci", sinkra?.accountability.length ?? 0],
            ["docs", documents.length],
          ],
          bullets: (sinkra?.artifactCoverage ?? []).slice(0, 6).map((item) => `${item.label}: ${item.present ? "presente" : "ausente"}`),
        },
        ...docSlides.slice(0, 2),
      ]
    }
    return buildResearchSlides({
      activeRun,
      documents,
      mainDocs,
      reportDoc,
      actionDoc,
      evidenceDoc,
      sourceSummary,
      topSources,
      researchPlayers,
      title,
    })
  }, [activeRun, coveragePresent, documents.length, evidenceDoc?.content, mainDocs, reportDoc?.content, actionDoc?.content, actionDoc?.file, researchPlayers.length, scoreValue, sinkra, source, sourceSummary, title, topSources])

  return <SlideDeckView deckLabel={sourceLabel} deckMark={deckMark} slides={slides} activeSlug={activeRun?.slug} />
}

function buildResearchSlides({
  activeRun,
  documents,
  mainDocs,
  reportDoc,
  actionDoc,
  evidenceDoc,
  sourceSummary,
  topSources,
  researchPlayers,
  title,
}: {
  activeRun?: ObservatoryRunSummary
  documents: ObservatoryDocument[]
  mainDocs: ObservatoryDocument[]
  reportDoc?: ObservatoryDocument
  actionDoc?: ObservatoryDocument
  evidenceDoc?: ObservatoryDocument
  sourceSummary: string[]
  topSources: ObservatorySource_Entry[]
  researchPlayers: ObservatoryPlayer[]
  title: string
}): BenchSlide[] {
  const docMap = new Map(documents.map((doc) => [doc.file, doc]))
  const queryDoc = findResearchDoc(mainDocs, /query|prompt|brief|pergunta/i)
  const readmeDoc = docMap.get("README.md") ?? reportDoc
  const recommendationsDoc = actionDoc ?? findResearchDoc(mainDocs, /recommend|action|quick-win|roadmap|follow/i)
  const architectureDoc = docMap.get("04-architecture-blueprint.md") ?? findResearchDoc(mainDocs, /architecture|blueprint|arquitet/i)
  const implementationDoc = docMap.get("05-implementation-plan.md") ?? findResearchDoc(mainDocs, /implementation|plano|roadmap/i)
  const metrics = asDisplayRecord(parseOptionalArtifact(docMap.get("metrics.yaml")))
  const actionPlan = asDisplayRecord(parseOptionalArtifact(docMap.get("action-plan.yaml")))
  const decisionLedger = asDisplayRecord(parseOptionalArtifact(docMap.get("decision-ledger.yaml")))
  const claimsLedger = asDisplayRecord(parseOptionalArtifact(docMap.get("claims.yaml")))
  const riskRegister = asDisplayRecord(parseOptionalArtifact(docMap.get("risk-register.yaml")))
  const pipelineState = asDisplayRecord(parseOptionalArtifact(docMap.get("pipeline-state.yaml")))
  const graph = asDisplayRecord(parseOptionalArtifact(docMap.get("research-graph.json")))
  const curiosity = asDisplayRecord(parseOptionalArtifact(docMap.get("curiosity_queue.yaml")))
  const metricDecision = asDisplayRecord(recordValue(metrics, "decision"))
  const actionPlanDecision = asDisplayRecord(recordValue(actionPlan, "decision"))
  const actionPlanItems = arrayValue(actionPlan, "actions").map((item) => asDisplayRecord(item))
  const roadmapItems = arrayValue(actionPlan, "roadmap").map((item) => asDisplayRecord(item))
  const decisions = arrayValue(decisionLedger, "decisions").map((item) => asDisplayRecord(item))
  const claims = arrayValue(claimsLedger, "claims").map((item) => asDisplayRecord(item))
  const risks = arrayValue(riskRegister, "risks").map((item) => asDisplayRecord(item))
  const graphNodes = arrayValue(graph, "nodes").map((item) => asDisplayRecord(item))
  const graphEdges = researchGraphEdges(graph)
  const questions = arrayValue(curiosity, "questions").map((item) => asDisplayRecord(item))
  const highQuestions = questions.filter((question) => stringValue(question, "priority", "").toUpperCase() === "HIGH")
  const phases = arrayValue(pipelineState, "phases").map((item) => asDisplayRecord(item))
  const waves = arrayValue(pipelineState, "waves").map((item) => asDisplayRecord(item))

  const queryText =
    extractMarkdownSection(queryDoc?.content ?? "", ["Pergunta", "Query Original", "Pergunta Original", "Briefing"]) ||
    markdownSummary(queryDoc?.content ?? "")
  const queryEvolution = extractMarkdownListItems(queryDoc?.content ?? "", ["Evolução da Pergunta", "Camadas", "Contexto Local"]).slice(0, 5)
  const tldr =
    extractMarkdownSection(readmeDoc?.content ?? "", ["TL;DR", "Resumo Executivo", "Executive Summary", "Síntese Executiva", "1. Síntese Executiva", "Conclusão", "Decisão"]) ||
    extractMarkdownSection(reportDoc?.content ?? "", ["TL;DR", "Resumo Executivo", "Executive Summary", "Síntese Executiva", "1. Síntese Executiva", "Conclusão", "Decisão"]) ||
    sentenceSummary(markdownSummary(reportDoc?.content ?? readmeDoc?.content ?? ""), 320)
  const decision =
    stringValue(actionPlanDecision, "recommendation", "") ||
    stringValue(actionPlanDecision, "summary", "") ||
    stringValue(metricDecision, "summary", "") ||
    stringValue(metricDecision, "selected_option", "") ||
    extractMarkdownSection(readmeDoc?.content ?? "", ["Veredito", "Decisão Arquitetural", "Próximo Comando Sugerido"]) ||
    extractMarkdownSection(recommendationsDoc?.content ?? "", ["Decisão Recomendada", "Decisão", "Veredito"]) ||
    extractMarkdownSection(reportDoc?.content ?? "", ["Decisão", "Veredito", "Conclusão", "4. Matriz de Decisão", "5. Arquitetura Recomendada"])
  const selectedDecision = decisions.find((item) => /selected|accepted/i.test(stringValue(item, "status", ""))) ?? decisions[0]
  const architecture = extractMarkdownSection(architectureDoc?.content ?? "", ["Arquitetura Recomendada", "Arquitetura", "Blueprint", "Contrato Mínimo de Estado"]) ||
    extractMarkdownSection(reportDoc?.content ?? "", ["5. Arquitetura Recomendada", "Arquitetura Recomendada", "Contrato Mínimo de Estado"])
  const architectureBullets = uniqueMeaningful([
    ...decisions.slice(0, 4).map((item) => `${stringValue(item, "id", "DEC")}: ${stringValue(item, "decision", "Decisão")} → ${stringValue(item, "consequence", "consequência não registrada")}`),
    ...extractMarkdownListItems(architectureDoc?.content ?? "", ["Arquitetura Recomendada", "Contrato Mínimo de Estado", "Componentes", "Blueprint"]),
  ], 6)
  const nextSteps = uniqueMeaningful([
    ...actionPlanItems.map((item) => `${stringValue(item, "priority", "P?")}: ${stringValue(item, "title", "Ação")} · ${stringValue(item, "status", "status")}`),
    ...roadmapItems.map((item) => `${stringValue(item, "phase", "fase")}: ${stringValue(item, "title", "Ação")} · ${stringValue(item, "status", "status")}`),
    ...arrayValue(pipelineState, "next_actions").map((item) => String(item)),
    ...extractMarkdownListItems(implementationDoc?.content ?? recommendationsDoc?.content ?? "", ["Próximos Passos", "Next Steps", "Ações", "Recommendations", "Implementation Roadmap", "Action Plan", "Roadmap"]),
    ...splitOperationalChecklist(extractMarkdownSection(recommendationsDoc?.content ?? "", ["Próximos Passos", "Next Steps"])),
  ], 7)
  const claimBullets = uniqueMeaningful(claims.slice(0, 5).map((claim) => {
    const implication = stringValue(claim, "implication", "")
    return `${stringValue(claim, "id", "CL")}: ${stringValue(claim, "claim", "Claim")} ${implication ? `→ ${implication}` : ""}`
  }), 5)
  const evidenceBullets =
    claimBullets.length > 0
      ? claimBullets
      : topSources.length > 0
        ? topSources.slice(0, 5).map((sourceItem) => sourceItem.title || sourceItem.url)
        : graphNodes.slice(0, 5).map((node) => `${stringValue(node, "type", "node")}: ${stringValue(node, "label", stringValue(node, "id", "sinal"))}`)
  const questionBullets = highQuestions.length > 0
    ? highQuestions.slice(0, 5).map((question) => `${stringValue(question, "id", "Q")}: ${stringValue(question, "question", "Pergunta aberta")}`)
    : questions.slice(0, 5).map((question) => `${stringValue(question, "id", "Q")}: ${stringValue(question, "question", "Pergunta aberta")}`)
  const riskBullets = uniqueMeaningful([
    ...risks.slice(0, 5).map((risk) => `${stringValue(risk, "id", "R")}: ${stringValue(risk, "risk", "Risco")} · mitigação: ${stringValue(risk, "mitigation", "não registrada")}`),
    ...questionBullets,
  ], 6)
  const artifactBullets = mainDocs.slice(0, 7).map((doc) => `${doc.file} · ${formatBytes(doc.bytes)}`)
  const status = stringValue(pipelineState, "status", stringValue(metrics, "status", activeRun?.status ?? "—"))
  const runtimeContract = stringValue(pipelineState, "runtime_contract", stringValue(metrics, "runtime_contract", "—"))
  const coverageScore = stringValue(pipelineState, "coverage_score", stringValue(metrics, "coverage_score", activeRun?.coverage ?? "—"))
  const integrityScore = stringValue(pipelineState, "integrity_score", stringValue(metrics, "integrity_score", "—"))
  const citationVerified = stringValue(pipelineState, "citation_verified", stringValue(metrics, "citation_verified", "—"))
  const actionDecisionTitle = stringValue(actionPlanDecision, "title", stringValue(selectedDecision, "decision", "Decisão principal"))
  const actionDecisionSummary = stringValue(actionPlanDecision, "summary", decision)
  const acceptedDecisions = decisions.filter((item) => /accepted|selected/i.test(stringValue(item, "status", ""))).length
  const highRisks = risks.filter((risk) => /high|alta/i.test(stringValue(risk, "severity", ""))).length
  const completedPhases = phases.filter((phase) => /completed/i.test(stringValue(phase, "status", ""))).length
  const completedWaves = waves.filter((wave) => /completed/i.test(stringValue(wave, "status", ""))).length

  return compactSlides([
    {
      kicker: "briefing",
      title,
      body: sentenceSummary(queryText || tldr, 340),
      accent: coverageScore,
      accentLabel: "score",
      metrics: [
        ["arquivos", documents.length],
        ["fontes", topSources.length || activeRun?.sources || 0],
        ["waves", completedWaves || activeRun?.waves || 0],
        ["status", status],
      ],
      bullets: uniqueMeaningful(queryEvolution.length > 0 ? queryEvolution : sourceSummary, 5),
      footer: queryDoc?.file ?? activeRun?.schema,
    },
    {
      kicker: "veredito",
      title: actionDecisionTitle,
      body: sentenceSummary(actionDecisionSummary || tldr, 360),
      accent: stringValue(actionPlanDecision, "confidence", stringValue(selectedDecision, "confidence", status)),
      accentLabel: "confiança",
      tone: /parcial|missing|fail|erro/i.test(`${activeRun?.status ?? ""}`) ? "warning" : "lime",
      bullets: uniqueMeaningful([
        ...extractMarkdownListItems(readmeDoc?.content ?? "", ["Veredito", "TL;DR", "Decisão Arquitetural"]).slice(0, 4),
        ...extractMarkdownListItems(reportDoc?.content ?? "", ["1. Síntese Executiva", "4. Matriz de Decisão", "5. Arquitetura Recomendada"]).slice(0, 4),
      ], 5),
      footer: readmeDoc?.file ?? reportDoc?.file,
    },
    {
      kicker: "arquitetura",
      title: runtimeContract !== "—" ? runtimeContract : "Modelo operacional recomendado",
      body: sentenceSummary(architecture || decision, 360),
      accent: String(acceptedDecisions || decisions.length || "—"),
      accentLabel: "decisões",
      bullets: architectureBullets,
      footer: architectureDoc?.file ?? "decision-ledger.yaml",
    },
    {
      kicker: "evidência",
      title: "Por que acreditar nesta leitura",
      body: claims.length > 0
        ? "A prova útil não é uma lista de links: são claims rastreados para artefatos, implicações e lacunas explícitas."
        : graphNodes.length > 0
          ? "A conclusão está ancorada em um grafo de artefatos, fontes e sinais extraídos do run."
          : "A conclusão está ancorada nos documentos e fontes preservados pelo run.",
      accent: claims.length > 0 ? String(claims.length) : topSources.length > 0 ? String(topSources.length) : String(graphNodes.length || documents.length),
      accentLabel: claims.length > 0 ? "claims" : topSources.length > 0 ? "fontes" : graphNodes.length > 0 ? "nós" : "docs",
      metrics: [
        ["claims", claims.length],
        ["grafo", graphNodes.length],
        ["relações", graphEdges.length],
        ["citação", citationVerified],
      ],
      bullets: evidenceBullets,
      footer: docMap.has("claims.yaml") ? "claims.yaml" : evidenceDoc?.file ?? "evidence layer",
    },
    {
      kicker: "risco",
      title: stringValue(asDisplayRecord(recordValue(riskRegister, "summary")), "top_risk", "O que ainda pode quebrar"),
      body: stringValue(asDisplayRecord(recordValue(riskRegister, "summary")), "mitigation_strategy", "Use o registro de riscos e a curiosity queue para reduzir incerteza antes de transformar pesquisa em implementação."),
      accent: String(highRisks || risks.length || highQuestions.length || questions.length),
      accentLabel: risks.length > 0 ? "riscos" : "perguntas",
      tone: highRisks > 0 || highQuestions.length > 0 ? "warning" : "lime",
      bullets: riskBullets.length > 0 ? riskBullets : artifactBullets.slice(0, 5),
      footer: docMap.has("risk-register.yaml") ? "risk-register.yaml" : docMap.has("curiosity_queue.yaml") ? "curiosity_queue.yaml" : "artifact review",
    },
    {
      kicker: "plano",
      title: "O que fazer agora",
      body: "Transforme a pesquisa em decisão executável: ADR primeiro, contrato de estado depois, smoke mission antes de qualquer skill de produção.",
      accent: String(nextSteps.length || actionPlanItems.length),
      accentLabel: "próximas ações",
      tone: nextSteps.length > 0 ? "lime" : "warning",
      metrics: [
        ["ações", actionPlanItems.length],
        ["roadmap", roadmapItems.length],
        ["fases", completedPhases || phases.length],
        ["integridade", integrityScore],
      ],
      bullets: nextSteps.length > 0 ? nextSteps : artifactBullets,
      footer: actionDoc?.file ?? implementationDoc?.file ?? "action-plan.yaml",
    },
  ])
}

function compactSlides(slides: BenchSlide[]) {
  return slides.filter((slide) => {
    const hasBody = cleanMarkdownText(slide.body, 80).length > 12
    const hasBullets = (slide.bullets ?? []).some((bullet) => cleanMarkdownText(bullet, 80).length > 8)
    const hasMetrics = (slide.metrics ?? []).some(([, value]) => String(value).trim() !== "" && String(value).trim() !== "0")
    return hasBody || hasBullets || hasMetrics
  })
}

function uniqueMeaningful(items: string[], limit = 6) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const clean = cleanMarkdownText(item, 360)
    if (!clean || clean.length < 8) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(clean)
    if (result.length >= limit) break
  }
  return result
}

function findResearchDoc(documents: ObservatoryDocument[], pattern: RegExp) {
  return documents.find((doc) => pattern.test(`${doc.file} ${doc.phase} ${markdownTitle(doc.content)}`))
}

function SlideDeckView({
  deckLabel,
  deckMark,
  slides,
  activeSlug,
}: {
  deckLabel: string
  deckMark: string
  slides: BenchSlide[]
  activeSlug?: string
}) {
  const [current, setCurrent] = useState(0)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const slide = slides[current] ?? slides[0]
  const progress = Math.round(((current + 1) / Math.max(1, slides.length)) * 100)

  useEffect(() => {
    setCurrent(0)
    setOverviewOpen(false)
  }, [activeSlug])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault()
        setCurrent((value) => Math.min(slides.length - 1, value + 1))
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault()
        setCurrent((value) => Math.max(0, value - 1))
      }
      if (event.key === "m" || event.key === "M") {
        event.preventDefault()
        setOverviewOpen((value) => !value)
      }
      if (event.key === "Escape") setOverviewOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [slides.length])

  if (!slide) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-[#050505] p-8 text-center text-[#f5f4e7]/55">
        Sem conteúdo suficiente para gerar slides deste artefato.
      </div>
    )
  }

  return (
    <div className="aiox-report-dark flex min-h-0 flex-1 flex-col bg-[#050505] text-[#f5f4e7]" style={observatoryDarkThemeVars}>
      <div className="h-1 bg-[#f5f4e7]/10">
        <div className="h-full bg-[#d1ff00] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#f5f4e7]/12 bg-[#050505] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#d1ff00] text-[15px] font-black text-[#231d05]" style={{ fontFamily: DISPLAY_FONT }}>
            {deckMark}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] uppercase tracking-[0.18em] text-[#f5f4e7]/50" style={{ fontFamily: MONO_FONT }}>
              {deckLabel}
            </div>
            <div className="truncate text-[12px] uppercase tracking-[0.12em] text-[#f5f4e7]/32" style={{ fontFamily: MONO_FONT }}>
              {slide.title}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOverviewOpen((value) => !value)}
            className="cursor-pointer border border-[#f5f4e7]/18 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/62 transition-colors hover:border-[#d1ff00] hover:text-[#d1ff00]"
            style={{ fontFamily: MONO_FONT }}
          >
            Mapa
          </button>
          <div className="min-w-[72px] text-right text-[12px] uppercase tracking-[0.14em] text-[#f5f4e7]/50" style={{ fontFamily: MONO_FONT }}>
            <span className="font-black text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>{String(current + 1).padStart(2, "0")}</span>
            <span className="mx-2 text-[#f5f4e7]/25">/</span>
            {String(slides.length).padStart(2, "0")}
          </div>
        </div>
      </header>
      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <button
          type="button"
          aria-label="Slide anterior"
          disabled={current === 0}
          onClick={() => setCurrent((value) => Math.max(0, value - 1))}
          className="absolute left-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border border-[#f5f4e7]/18 bg-[#0f0f11]/90 text-[26px] text-[#f5f4e7] transition-colors hover:border-[#d1ff00] hover:bg-[#d1ff00] hover:text-[#231d05] disabled:pointer-events-none disabled:opacity-20 lg:flex"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Próximo slide"
          disabled={current === slides.length - 1}
          onClick={() => setCurrent((value) => Math.min(slides.length - 1, value + 1))}
          className="absolute right-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border border-[#f5f4e7]/18 bg-[#0f0f11]/90 text-[26px] text-[#f5f4e7] transition-colors hover:border-[#d1ff00] hover:bg-[#d1ff00] hover:text-[#231d05] disabled:pointer-events-none disabled:opacity-20 lg:flex"
        >
          ›
        </button>

        {overviewOpen && (
          <div className="absolute inset-0 z-20 overflow-auto bg-[#050505]/95 p-4 backdrop-blur sm:p-8">
            <div className="mx-auto max-w-[1280px]">
              <div className="mb-5 flex items-end justify-between gap-4 border-b border-[#f5f4e7]/12 pb-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>mapa de slides</div>
                  <h2 className="mt-2 text-[34px] font-black leading-none tracking-[-0.05em]" style={{ fontFamily: DISPLAY_FONT }}>Navegação do deck</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOverviewOpen(false)}
                  className="cursor-pointer border border-[#f5f4e7]/18 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/62 hover:border-[#d1ff00] hover:text-[#d1ff00]"
                  style={{ fontFamily: MONO_FONT }}
                >
                  fechar
                </button>
              </div>
              <div className="grid gap-px bg-[#f5f4e7]/10 p-px sm:grid-cols-2 xl:grid-cols-4">
                {slides.map((item, index) => (
                  <button
                    key={`${item.kicker}-${item.title}`}
                    type="button"
                    onClick={() => {
                      setCurrent(index)
                      setOverviewOpen(false)
                    }}
                    className={cn(
                      "min-h-[180px] cursor-pointer bg-[#0f0f11] p-5 text-left transition-colors hover:bg-[#161618]",
                      index === current && "bg-[#d1ff00] text-[#231d05] hover:bg-[#d1ff00]",
                    )}
                  >
                    <div className={cn("text-[10px] uppercase tracking-[0.14em]", index === current ? "text-[#231d05]/58" : "text-[#d1ff00]")} style={{ fontFamily: MONO_FONT }}>
                      {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")} · {item.kicker}
                    </div>
                    <div className="aiox-safe-text mt-4 text-[22px] font-black leading-tight tracking-[-0.04em]" style={{ fontFamily: DISPLAY_FONT }}>{item.title}</div>
                    <p className={cn("mt-3 line-clamp-3 text-[13px] leading-[1.5]", index === current ? "text-[#231d05]/72" : "text-[#f5f4e7]/54")}>{item.body}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <LightScrollArea className="flex-1" viewportClassName="px-6 py-8 sm:px-10 lg:px-20 lg:py-14" fadeColor="#050505">
          <article className="mx-auto grid min-h-[calc(100vh-190px)] max-w-[1420px] content-center gap-8">
            <div className="grid gap-10 xl:grid-cols-[minmax(0,1.2fr)_420px] xl:items-center">
              <section>
                <div className="mb-6 flex items-center gap-4 text-[11px] uppercase tracking-[0.2em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                  <span className="h-px w-10 bg-[#d1ff00]" />
                  {slide.kicker}
                </div>
                <h1 className="aiox-safe-text text-[clamp(42px,6vw,86px)] font-black leading-[0.92] tracking-[-0.065em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                  {slide.title}
                </h1>
                <p className="mt-7 max-w-[980px] text-[clamp(18px,1.55vw,25px)] leading-[1.5] text-[#f5f4e7]/62">
                  {slide.body}
                </p>
                {slide.bullets && slide.bullets.length > 0 && (
                  <div className="mt-10 grid gap-4">
                    {slide.bullets.slice(0, 6).map((bullet, index) => (
                      <div key={`${bullet}-${index}`} className="grid grid-cols-[46px_minmax(0,1fr)] gap-4 border-t border-[#f5f4e7]/12 pt-4">
                        <div className="text-[28px] font-black leading-none tracking-[-0.05em] text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <p className="text-[clamp(15px,1.1vw,20px)] font-bold leading-[1.45] text-[#f5f4e7]/82">{bullet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <aside className="grid gap-px bg-[#f5f4e7]/10 p-px">
                <div className={cn(
                  "min-h-[230px] p-7",
                  slide.tone === "error" ? "bg-[#ef4444] text-[#f5f4e7]" : slide.tone === "warning" ? "bg-[#f5b340] text-[#231d05]" : "bg-[#d1ff00] text-[#231d05]",
                )}>
                  <div className="text-[11px] uppercase tracking-[0.16em] opacity-65" style={{ fontFamily: MONO_FONT }}>
                    {slide.accentLabel ?? "sinal"}
                  </div>
                  <div className="aiox-safe-text mt-5 text-[clamp(48px,5vw,82px)] font-black leading-[0.92] tracking-[-0.07em]" style={{ fontFamily: DISPLAY_FONT }}>
                    {slide.accent ?? "—"}
                  </div>
                </div>
                {slide.metrics && slide.metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-px bg-[#f5f4e7]/10">
                    {slide.metrics.slice(0, 6).map(([label, value]) => (
                      <div key={label} className="bg-[#0f0f11] p-5">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{label}</div>
                        <div className="aiox-safe-text mt-2 text-[28px] font-black leading-none tracking-[-0.045em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {slide.footer && (
                  <div className="bg-[#0f0f11] p-5 text-[15px] font-bold leading-[1.45] text-[#f5f4e7]/72">
                    {slide.footer}
                  </div>
                )}
              </aside>
            </div>
          </article>
        </LightScrollArea>
      </main>
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#f5f4e7]/12 bg-[#0f0f11] px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42 sm:px-6" style={{ fontFamily: MONO_FONT }}>
        <div className="truncate">Próximo: <span className="text-[#f5f4e7]/70">{slides[current + 1]?.title ?? "fim do deck"}</span></div>
        <div className="hidden gap-4 md:flex">
          <span>← → navegar</span>
          <span>M mapa</span>
          <span>ESC fechar mapa</span>
        </div>
      </footer>
    </div>
  )
}

function BenchSlidesReport({
  runs,
  documents,
  matrix,
  scoreDimensions,
  personas,
  tco,
  cliffs,
  categorical,
  gapItems,
  playerProfiles,
  typeSpecific,
}: {
  runs: ObservatoryRunSummary[]
  documents: ObservatoryDocument[]
  matrix: ObservatoryMatrix | null
  scoreDimensions: ObservatoryScoreDimension[]
  personas: ObservatoryPersona[]
  tco: ObservatoryTco | null
  cliffs: ObservatoryCliff[]
  categorical: ObservatoryCategoricalWinner[]
  gapItems: ObservatoryGapItem[]
  playerProfiles: ObservatoryPlayerProfile[]
  typeSpecific: ObservatoryTypeSpecific
}) {
  const activeRun = runs.find((run) => run.active) ?? runs[0]
  const verdict = benchVerdict(matrix, scoreDimensions, activeRun)
  const biggestGaps = useMemo(
    () => matrix ? [...matrix.rows].sort((a, b) => benchScoreGap(b) - benchScoreGap(a)).slice(0, 5) : [],
    [matrix],
  )
  const evidenceCount = benchEvidenceTotal(matrix, scoreDimensions)
  const evidenceCapacity = benchEvidenceCapacity(matrix, scoreDimensions)
  const evidencePct = Math.round((evidenceCount / Math.max(1, evidenceCapacity)) * 100)
  const roadmapItems = useMemo(
    () => buildBenchRoadmapItems({ gapItems, biggestGaps, categorical, playerProfiles }),
    [biggestGaps, categorical, gapItems, playerProfiles],
  )
  const tldrCards = useMemo(
    () => buildBenchTldrCards({
      verdict,
      playerCount: matrix?.players.length ?? playerProfiles.length,
      dimensionCount: matrix?.rows.length ?? scoreDimensions.length,
      evidencePct,
      biggestGaps,
      gapItems,
      categorical,
      documents,
    }),
    [biggestGaps, categorical, documents, evidencePct, gapItems, matrix?.players.length, matrix?.rows.length, playerProfiles.length, verdict],
  )
  const slides = useMemo<BenchSlide[]>(() => {
    const productRecord = typeSpecific.product && typeof typeSpecific.product === "object" ? typeSpecific.product : {}
    const rawStoryline: unknown[] = Array.isArray(productRecord.slide_storyline) ? productRecord.slide_storyline : []
    const customStoryline = rawStoryline
          .filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            kicker: String(item.kicker ?? "storyline"),
            title: String(item.title ?? ""),
            body: String(item.body ?? ""),
            accent: String(item.accent ?? ""),
            accentLabel: String(item.accent_label ?? ""),
            tone: /warning|error|lime/.test(String(item.tone ?? "")) ? String(item.tone) as BenchSlide["tone"] : "lime",
            bullets: Array.isArray(item.bullets) ? item.bullets.map((bullet) => String(bullet)).filter(Boolean).slice(0, 6) : [],
            metrics: Array.isArray(item.metrics)
              ? item.metrics
                  .filter((metric): metric is unknown[] => Array.isArray(metric) && metric.length >= 2)
                  .map((metric) => [String(metric[0]), String(metric[1])] as [string, string])
              : undefined,
          }))
          .filter((item) => item.title && item.body)
    const topGap = biggestGaps[0]
    const leadingActions = roadmapItems.slice(0, 3)
    const ranking = matrix?.totals
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((total, index) => `${index + 1}. ${displayBenchPlayer(total.player, playerProfiles)} · ${formatBenchNumber(total.score)}`) ?? []
    const scenarioBullets = uniqueMeaningful([
      ...personas.slice(0, 3).map((persona) => `${persona.label}: ${persona.winner || "sem vencedor explícito"}`),
      ...(tco?.scenarios ?? []).slice(0, 3).map((scenario) => {
        const winner = [...scenario.rows]
          .filter((row) => row.low !== null || row.high !== null)
          .sort((a, b) => ((a.low ?? a.high ?? 0) + (a.high ?? a.low ?? 0)) - ((b.low ?? b.high ?? 0) + (b.high ?? b.low ?? 0)))[0]
        return `${scenario.label}: ${winner ? displayBenchPlayer(winner.player, playerProfiles) : "sem vencedor explícito"} vence por TCO`
      }),
      ...cliffs.slice(0, 3).map((cliff) => `${displayBenchPlayer(cliff.player, playerProfiles)}: ${cliff.trigger}`),
    ], 6)
    const gapBullets = uniqueMeaningful(biggestGaps.slice(0, 5).map((row) => {
      const winner = [...row.cells].sort((a, b) => b.score - a.score)[0]
      return `${row.label}: gap ${formatBenchNumber(benchScoreGap(row))}${winner ? ` · líder: ${displayBenchPlayer(winner.player, playerProfiles)}` : ""}`
    }), 5)
    const decisionBullets = uniqueMeaningful(tldrCards.slice(1, 5).map((card) => `${card.label}: ${card.value} — ${card.sub}`), 5)
    return compactSlides([
      ...customStoryline,
      {
        kicker: "abertura",
        title: verdict.status === "empate" ? "Empate técnico: decisão condicional" : `${verdict.leader} lidera o benchmark`,
        body: verdict.summary,
        accent: verdict.leader,
        accentLabel: "recomendação",
        tone: verdict.status === "empate" ? "warning" : "lime",
        metrics: [
          ["players", matrix?.players.length ?? playerProfiles.length],
          ["dimensões", matrix?.rows.length ?? scoreDimensions.length],
          ["evidência", `${evidencePct}%`],
          ["arquivos", documents.length],
        ],
        footer: activeRun?.displayTitle ?? "Benchmark",
      },
      {
        kicker: "decisão",
        title: "O que muda na escolha",
        body: topGap
          ? `A escolha deve ser julgada principalmente por ${topGap.label}; é a dimensão que mais separa os players neste bench.`
          : "A matriz ainda não trouxe distância suficiente para transformar a comparação em escolha final sem nova evidência.",
        accent: verdict.gap,
        accentLabel: "gap para o runner-up",
        tone: verdict.status === "empate" ? "warning" : "lime",
        bullets: decisionBullets,
      },
      ranking.length > 0 ? {
        kicker: "ranking",
        title: "Quem lidera e por quanto",
        body: "Ranking só é útil se mostrar magnitude: liderança pequena vira empate técnico; liderança ampla vira direção de escolha.",
        accent: verdict.score,
        accentLabel: "score do líder",
        metrics: [
          ["líder", verdict.leader],
          ["runner", verdict.runner],
          ["status", verdict.status],
        ],
        bullets: ranking,
      } : null,
      topGap ? {
        kicker: "tensão",
        title: `A decisão muda em ${topGap.label}`,
        body: "A maior distância entre players é o melhor ponto para debate: é onde a comparação deixa de ser intercambiável.",
        accent: formatBenchNumber(benchScoreGap(topGap)),
        accentLabel: "maior diferença",
        tone: benchScoreGap(topGap) > 25 ? "warning" : "lime",
        bullets: gapBullets,
      } : null,
      leadingActions.length > 0 ? {
        kicker: "ação",
        title: "O que fazer depois do bench",
        body: "Roadmap enxuto para transformar comparação em decisão operacional. As ações vêm dos gaps, cliffs e maiores diferenças da matriz.",
        accent: String(roadmapItems.length),
        accentLabel: "ações sugeridas",
        tone: "lime",
        bullets: leadingActions.map((item) => `${item.wave}: ${item.title} — ${item.roi}`),
      } : null,
      evidenceCapacity > 0 ? {
        kicker: "confiança",
        title: evidencePct >= 70 ? "Evidência suficiente para decisão" : "Evidência ainda limita a decisão",
        body: evidencePct >= 70
          ? "A cobertura permite usar o benchmark como base de priorização, mantendo revisão pontual dos gaps mais sensíveis."
          : "Antes de vender a conclusão, aumente a materialidade: células sem prova reduzem confiança e podem mudar o veredito.",
        accent: `${evidencePct}%`,
        accentLabel: "cobertura de evidência",
        tone: evidencePct >= 70 ? "lime" : evidencePct >= 40 ? "warning" : "error",
        metrics: [
          ["células com prova", evidenceCount],
          ["capacidade", evidenceCapacity],
          ["docs", documents.length],
          ["gaps", gapItems.length],
        ],
        bullets: documents.slice(0, 5).map((doc) => doc.file),
      } : null,
      scenarioBullets.length > 0 ? {
        kicker: "cenários",
        title: "Quando a recomendação muda",
        body: "Personas, TCO e cliffs dizem em quais contextos o vencedor geral pode não ser a escolha correta.",
        accent: String(scenarioBullets.length),
        accentLabel: "cenários úteis",
        tone: cliffs.length > 0 ? "warning" : "lime",
        bullets: scenarioBullets,
      } : null,
      {
        kicker: "handoff",
        title: "Resumo para decisão",
        body: "Use o líder como hipótese, a maior lacuna como pergunta crítica e o roadmap como próximo movimento verificável.",
        accent: verdict.leader,
        accentLabel: "hipótese de escolha",
        tone: "lime",
        bullets: uniqueMeaningful([
          `Escolha provável: ${verdict.leader}`,
          `Pergunta crítica: ${topGap?.label ?? "validar matriz e evidências"}`,
          `Próximo movimento: ${roadmapItems[0]?.title ?? "rodar aprofundamento do bench"}`,
          ...documents.slice(0, 3).map((doc) => `Abrir: ${doc.file}`),
        ], 6),
      },
    ].filter(Boolean) as BenchSlide[])
  }, [activeRun?.displayTitle, biggestGaps, cliffs, documents, evidenceCapacity, evidenceCount, evidencePct, gapItems.length, matrix, personas, playerProfiles, roadmapItems, scoreDimensions.length, tco?.scenarios, tldrCards, typeSpecific.product, verdict])
  const [current, setCurrent] = useState(0)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const slide = slides[current] ?? slides[0]
  const progress = Math.round(((current + 1) / Math.max(1, slides.length)) * 100)

  useEffect(() => {
    setCurrent(0)
    setOverviewOpen(false)
  }, [activeRun?.slug])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault()
        setCurrent((value) => Math.min(slides.length - 1, value + 1))
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault()
        setCurrent((value) => Math.max(0, value - 1))
      }
      if (event.key === "m" || event.key === "M") {
        event.preventDefault()
        setOverviewOpen((value) => !value)
      }
      if (event.key === "Escape") {
        setOverviewOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [slides.length])

  return (
    <div className="aiox-report-dark flex min-h-0 flex-1 flex-col bg-[#050505] text-[#f5f4e7]" style={observatoryDarkThemeVars}>
      <div className="h-1 bg-[#f5f4e7]/10">
        <div className="h-full bg-[#d1ff00] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#f5f4e7]/12 bg-[#050505] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#d1ff00] text-[15px] font-black text-[#231d05]" style={{ fontFamily: DISPLAY_FONT }}>
            B
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] uppercase tracking-[0.18em] text-[#f5f4e7]/50" style={{ fontFamily: MONO_FONT }}>
              Bench slides · {activeRun?.displayTitle ?? "benchmark"}
            </div>
            <div className="truncate text-[12px] uppercase tracking-[0.12em] text-[#f5f4e7]/32" style={{ fontFamily: MONO_FONT }}>
              {slide?.title}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOverviewOpen((value) => !value)}
            className="cursor-pointer border border-[#f5f4e7]/18 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/62 transition-colors hover:border-[#d1ff00] hover:text-[#d1ff00]"
            style={{ fontFamily: MONO_FONT }}
          >
            Mapa
          </button>
          <div className="min-w-[72px] text-right text-[12px] uppercase tracking-[0.14em] text-[#f5f4e7]/50" style={{ fontFamily: MONO_FONT }}>
            <span className="font-black text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>{String(current + 1).padStart(2, "0")}</span>
            <span className="mx-2 text-[#f5f4e7]/25">/</span>
            {String(slides.length).padStart(2, "0")}
          </div>
        </div>
      </header>
      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <button
          type="button"
          aria-label="Slide anterior"
          disabled={current === 0}
          onClick={() => setCurrent((value) => Math.max(0, value - 1))}
          className="absolute left-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border border-[#f5f4e7]/18 bg-[#0f0f11]/90 text-[26px] text-[#f5f4e7] transition-colors hover:border-[#d1ff00] hover:bg-[#d1ff00] hover:text-[#231d05] disabled:pointer-events-none disabled:opacity-20 lg:flex"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Próximo slide"
          disabled={current === slides.length - 1}
          onClick={() => setCurrent((value) => Math.min(slides.length - 1, value + 1))}
          className="absolute right-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border border-[#f5f4e7]/18 bg-[#0f0f11]/90 text-[26px] text-[#f5f4e7] transition-colors hover:border-[#d1ff00] hover:bg-[#d1ff00] hover:text-[#231d05] disabled:pointer-events-none disabled:opacity-20 lg:flex"
        >
          ›
        </button>

        {overviewOpen && (
          <div className="absolute inset-0 z-20 overflow-auto bg-[#050505]/95 p-4 backdrop-blur sm:p-8">
            <div className="mx-auto max-w-[1280px]">
              <div className="mb-5 flex items-end justify-between gap-4 border-b border-[#f5f4e7]/12 pb-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>mapa de slides</div>
                  <h2 className="mt-2 text-[34px] font-black leading-none tracking-[-0.05em]" style={{ fontFamily: DISPLAY_FONT }}>Navegação do deck</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOverviewOpen(false)}
                  className="cursor-pointer border border-[#f5f4e7]/18 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/62 hover:border-[#d1ff00] hover:text-[#d1ff00]"
                  style={{ fontFamily: MONO_FONT }}
                >
                  fechar
                </button>
              </div>
              <div className="grid gap-px bg-[#f5f4e7]/10 p-px sm:grid-cols-2 xl:grid-cols-4">
                {slides.map((item, index) => (
                  <button
                    key={`${item.kicker}-${item.title}`}
                    type="button"
                    onClick={() => {
                      setCurrent(index)
                      setOverviewOpen(false)
                    }}
                    className={cn(
                      "min-h-[180px] cursor-pointer bg-[#0f0f11] p-5 text-left transition-colors hover:bg-[#161618]",
                      index === current && "bg-[#d1ff00] text-[#231d05] hover:bg-[#d1ff00]",
                    )}
                  >
                    <div className={cn("text-[10px] uppercase tracking-[0.14em]", index === current ? "text-[#231d05]/58" : "text-[#d1ff00]")} style={{ fontFamily: MONO_FONT }}>
                      {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")} · {item.kicker}
                    </div>
                    <div className="aiox-safe-text mt-4 text-[22px] font-black leading-tight tracking-[-0.04em]" style={{ fontFamily: DISPLAY_FONT }}>{item.title}</div>
                    <p className={cn("mt-3 line-clamp-3 text-[13px] leading-[1.5]", index === current ? "text-[#231d05]/72" : "text-[#f5f4e7]/54")}>{item.body}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <LightScrollArea className="flex-1" viewportClassName="px-6 py-8 sm:px-10 lg:px-20 lg:py-14" fadeColor="#050505">
          <article className="mx-auto grid min-h-[calc(100vh-190px)] max-w-[1420px] content-center gap-8">
            <div className="grid gap-10 xl:grid-cols-[minmax(0,1.2fr)_420px] xl:items-center">
              <section>
                <div className="mb-6 flex items-center gap-4 text-[11px] uppercase tracking-[0.2em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                  <span className="h-px w-10 bg-[#d1ff00]" />
                  {slide?.kicker}
                </div>
                <h1 className="aiox-safe-text text-[clamp(42px,6vw,86px)] font-black leading-[0.92] tracking-[-0.065em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                  {slide?.title}
                </h1>
                <p className="mt-7 max-w-[980px] text-[clamp(18px,1.55vw,25px)] leading-[1.5] text-[#f5f4e7]/62">
                  {slide?.body}
                </p>
                {slide?.bullets && slide.bullets.length > 0 && (
                  <div className="mt-10 grid gap-4">
                    {slide.bullets.slice(0, 6).map((bullet, index) => (
                      <div key={`${bullet}-${index}`} className="grid grid-cols-[46px_minmax(0,1fr)] gap-4 border-t border-[#f5f4e7]/12 pt-4">
                        <div className="text-[28px] font-black leading-none tracking-[-0.05em] text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <p className="text-[clamp(15px,1.1vw,20px)] font-bold leading-[1.45] text-[#f5f4e7]/82">{bullet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <aside className="grid gap-px bg-[#f5f4e7]/10 p-px">
                <div className={cn(
                  "min-h-[230px] p-7",
                  slide?.tone === "error" ? "bg-[#ef4444] text-[#f5f4e7]" : slide?.tone === "warning" ? "bg-[#f5b340] text-[#231d05]" : "bg-[#d1ff00] text-[#231d05]",
                )}>
                  <div className="text-[11px] uppercase tracking-[0.16em] opacity-65" style={{ fontFamily: MONO_FONT }}>
                    {slide?.accentLabel ?? "sinal"}
                  </div>
                  <div className="aiox-safe-text mt-5 text-[clamp(48px,5vw,82px)] font-black leading-[0.92] tracking-[-0.07em]" style={{ fontFamily: DISPLAY_FONT }}>
                    {slide?.accent ?? "—"}
                  </div>
                </div>
                {slide?.metrics && slide.metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-px bg-[#f5f4e7]/10">
                    {slide.metrics.slice(0, 6).map(([label, value]) => (
                      <div key={label} className="bg-[#0f0f11] p-5">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{label}</div>
                        <div className="aiox-safe-text mt-2 text-[28px] font-black leading-none tracking-[-0.045em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {slide?.footer && (
                  <div className="bg-[#0f0f11] p-5 text-[15px] font-bold leading-[1.45] text-[#f5f4e7]/72">
                    {slide.footer}
                  </div>
                )}
              </aside>
            </div>
          </article>
        </LightScrollArea>
      </main>
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#f5f4e7]/12 bg-[#0f0f11] px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42 sm:px-6" style={{ fontFamily: MONO_FONT }}>
        <div className="truncate">Próximo: <span className="text-[#f5f4e7]/70">{slides[current + 1]?.title ?? "fim do deck"}</span></div>
        <div className="hidden gap-4 md:flex">
          <span>← → navegar</span>
          <span>M mapa</span>
          <span>ESC fechar mapa</span>
        </div>
      </footer>
    </div>
  )
}

function BenchVerdictBar({
  status,
  narrative,
  action,
  priority,
}: {
  status: string
  narrative: string
  action: string
  priority: string
}) {
  const isWarning = /parcial|empate|evidência/i.test(`${status} ${priority}`)
  return (
    <section className={cn(
      "mt-6 border p-5 md:p-6",
      isWarning
        ? "border-[#f5b340]/55 bg-[#f5b340]/[0.045]"
        : "border-[#d1ff00]/30 bg-[#111113]",
    )}>
      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)_260px] md:items-center">
        <div>
          <div className={cn("text-[10px] uppercase tracking-[0.16em]", isWarning ? "text-[#f5b340]" : "text-[#d1ff00]")} style={{ fontFamily: MONO_FONT }}>
            veredito
          </div>
          <div className={cn("mt-1 text-[28px] font-black leading-none tracking-[-0.045em]", isWarning ? "text-[#f5b340]" : "text-[#d1ff00]")} style={{ fontFamily: DISPLAY_FONT }}>
            {status}
          </div>
        </div>
        <p className="text-[15px] leading-[1.55] text-[#f5f4e7]/78">{narrative}</p>
        <div className="md:text-right">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>{priority}</div>
          <div className="mt-1 text-[15px] font-black leading-tight text-[#f5f4e7]">{action}</div>
        </div>
      </div>
    </section>
  )
}

type BenchTldrCard = {
  label: string
  value: string
  sub: string
  tone?: "lime" | "warning" | "error"
}

type BenchRoadmapItem = {
  rank: number
  title: string
  roi: string
  source: string
  effort: string
  wave: "W1" | "W2" | "W3"
  tone: "lime" | "warning" | "flare"
}

function buildBenchTldrCards({
  verdict,
  playerCount,
  dimensionCount,
  evidencePct,
  biggestGaps,
  gapItems,
  categorical,
  documents,
}: {
  verdict: ReturnType<typeof benchVerdict>
  playerCount: number
  dimensionCount: number
  evidencePct: number
  biggestGaps: ObservatoryMatrixRow[]
  gapItems: ObservatoryGapItem[]
  categorical: ObservatoryCategoricalWinner[]
  documents: ObservatoryDocument[]
}): BenchTldrCard[] {
  const topGap = biggestGaps[0]
  const topGapScore = topGap ? benchScoreGap(topGap) : 0
  return [
    {
      label: "Veredito",
      value: verdict.leader,
      sub: verdict.summary,
      tone: verdict.status === "empate" ? "warning" : "lime",
    },
    {
      label: "Gap crítico",
      value: topGap ? formatBenchNumber(topGapScore) : "—",
      sub: topGap ? topGap.label : "Sem dimensão crítica detectada.",
      tone: topGapScore >= 30 ? "error" : topGapScore >= 12 ? "warning" : "lime",
    },
    {
      label: "Escopo",
      value: `${playerCount} × ${dimensionCount}`,
      sub: "players por dimensões avaliadas.",
    },
    {
      label: "Prova",
      value: `${evidencePct}%`,
      sub: "cobertura de evidência estruturada.",
      tone: evidencePct >= 70 ? "lime" : evidencePct >= 40 ? "warning" : "error",
    },
    {
      label: "Gaps",
      value: String(gapItems.length),
      sub: gapItems.length > 0 ? "itens que podem virar roadmap." : "nenhum gap estruturado.",
      tone: gapItems.length > 0 ? "warning" : "lime",
    },
    {
      label: "Materialidade",
      value: String(documents.length),
      sub: `${categorical.length} vitórias categóricas; ${documents.length} arquivos.`,
    },
  ]
}

function BenchTldrPanel({ cards }: { cards: BenchTldrCard[] }) {
  return (
    <section className="mt-6 border-y border-[#d1ff00]/35 bg-[#111113] py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-[#f5f4e7]/10 pb-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
          bench em 60 segundos
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
          decisão · risco · evidência · ação
        </div>
      </div>
      <div className="grid gap-px bg-[#f5f4e7]/10 p-px sm:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => (
          <article key={card.label} className="min-h-[142px] bg-[#0f0f11] p-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
              {card.label}
            </div>
            <div className={cn(
              "aiox-safe-text mt-3 text-[28px] font-black leading-none tracking-[-0.055em] text-[#f5f4e7]",
              card.tone === "lime" && "text-[#d1ff00]",
              card.tone === "warning" && "text-[#f5b340]",
              card.tone === "error" && "text-[#ef4444]",
            )} style={{ fontFamily: DISPLAY_FONT }}>
              {card.value}
            </div>
            <p className="mt-3 line-clamp-3 text-[12.5px] leading-[1.4] text-[#f5f4e7]/52">{card.sub}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function BenchThreeActsPanel({
  current,
  action,
  destination,
  currentBody,
  actionBody,
  destinationBody,
}: {
  current: string
  action: string
  destination: string
  currentBody: string
  actionBody: string
  destinationBody: string
}) {
  const acts = [
    { label: "estado", title: "Agora", value: current, body: currentBody, tone: "border-[#ef4444] text-[#ef4444]" },
    { label: "movimento", title: "Próxima ação", value: action, body: actionBody, tone: "border-[#d1ff00] text-[#d1ff00]" },
    { label: "destino", title: "Tese", value: destination, body: destinationBody, tone: "border-[#d1ff00] text-[#d1ff00]" },
  ]
  return (
    <section className="aiox-panel bg-[#0f0f11] p-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_54px_1fr_54px_1fr]">
        {acts.map((act, index) => (
          <Fragment key={act.label}>
            <article className={cn("min-h-[230px] border-t-2 bg-[#050505] p-5", act.tone)}>
              <div className="text-[10px] uppercase tracking-[0.16em] text-current" style={{ fontFamily: MONO_FONT }}>{act.label}</div>
              <h3 className="mt-2 text-[24px] font-black leading-none tracking-[-0.04em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{act.title}</h3>
              <div className="aiox-safe-text mt-6 text-[30px] font-black leading-none tracking-[-0.055em] text-current" style={{ fontFamily: DISPLAY_FONT }}>{act.value}</div>
              <p className="mt-4 text-[13px] leading-[1.55] text-[#f5f4e7]/56">{act.body}</p>
            </article>
            {index < acts.length - 1 && (
              <div className="hidden items-center justify-center bg-[#050505] text-[#d1ff00] lg:flex">
                <span className="text-[28px] font-black" style={{ fontFamily: DISPLAY_FONT }}>→</span>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  )
}

function buildBenchRoadmapItems({
  gapItems,
  biggestGaps,
  categorical,
  playerProfiles,
}: {
  gapItems: ObservatoryGapItem[]
  biggestGaps: ObservatoryMatrixRow[]
  categorical: ObservatoryCategoricalWinner[]
  playerProfiles: ObservatoryPlayerProfile[]
}): BenchRoadmapItem[] {
  const fromGaps = gapItems.slice(0, 6).map((gap, index): BenchRoadmapItem => ({
    rank: index + 1,
    title: gap.title,
    roi: gap.rationale || "Resolver este gap aumenta confiança da decisão.",
    source: gap.priority || "gap",
    effort: gap.complexity || (index < 3 ? "curto" : "médio"),
    wave: index < 3 ? "W1" : "W2",
    tone: index < 3 ? "lime" : "warning",
  }))
  const fromMatrix = biggestGaps.slice(0, 5).map((row, index): BenchRoadmapItem => {
    const winner = [...row.cells].sort((a, b) => b.score - a.score)[0]
    return {
      rank: fromGaps.length + index + 1,
      title: `Revalidar ${row.label}`,
      roi: winner ? `${displayBenchPlayer(winner.player, playerProfiles)} vence com gap ${formatBenchNumber(benchScoreGap(row))}; decidir se é vantagem estratégica ou gap a absorver.` : "Dimensão com distância relevante entre players.",
      source: row.id,
      effort: index < 2 ? "1-2h" : "3-4h",
      wave: index < 2 ? "W1" : "W2",
      tone: index < 2 ? "lime" : "warning",
    }
  })
  const fromCategorical = categorical.slice(0, 3).map((item, index): BenchRoadmapItem => ({
    rank: fromGaps.length + fromMatrix.length + index + 1,
    title: `Explorar vitória em ${item.dimension}`,
    roi: item.note || `${displayBenchPlayer(item.winner, playerProfiles)} tem vantagem categórica sobre ${displayBenchPlayer(item.loser, playerProfiles)}.`,
    source: displayBenchPlayer(item.winner, playerProfiles),
    effort: "estratégico",
    wave: "W3",
    tone: "flare",
  }))
  return [...fromGaps, ...fromMatrix, ...fromCategorical].slice(0, 10).map((item, index) => ({ ...item, rank: index + 1 }))
}

function BenchRoadmapPanel({ items }: { items: BenchRoadmapItem[] }) {
  const waves = [
    { key: "W1", label: "Agora", color: "#d1ff00" },
    { key: "W2", label: "Depois", color: "#f5b340" },
    { key: "W3", label: "Estratégico", color: "#d96a3f" },
  ] as const
  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="roadmap" title="Waves recomendadas" meta={`${items.length} ações`} />
      <div className="p-5">
        <div className="mb-5 grid gap-px bg-[#f5f4e7]/10 p-px sm:grid-cols-3">
          {waves.map((wave) => {
            const count = items.filter((item) => item.wave === wave.key).length
            return (
              <div key={wave.key} className="bg-[#050505] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>{wave.key} · {wave.label}</div>
                <div className="mt-2 text-[30px] font-black leading-none tracking-[-0.05em]" style={{ fontFamily: DISPLAY_FONT, color: wave.color }}>{count}</div>
              </div>
            )
          })}
        </div>
        <div className="grid gap-px bg-[#f5f4e7]/10 p-px">
          {items.length > 0 ? items.map((item) => (
            <div key={`${item.rank}-${item.title}`} className="grid gap-3 bg-[#050505] p-4 lg:grid-cols-[52px_minmax(0,1fr)_110px_92px_72px] lg:items-center">
              <div className={cn("text-[28px] font-black leading-none tracking-[-0.05em]", item.tone === "lime" ? "text-[#d1ff00]" : item.tone === "warning" ? "text-[#f5b340]" : "text-[#d96a3f]")} style={{ fontFamily: DISPLAY_FONT }}>
                {String(item.rank).padStart(2, "0")}
              </div>
              <div className="min-w-0">
                <div className="aiox-safe-text text-[16px] font-black text-[#f5f4e7]">{item.title}</div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] text-[#f5f4e7]/52">{item.roi}</p>
              </div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{item.source}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/54" style={{ fontFamily: MONO_FONT }}>{item.effort}</div>
              <div className={cn("border px-2 py-1 text-center text-[10px] uppercase tracking-[0.12em]", item.tone === "lime" ? "border-[#d1ff00]/30 text-[#d1ff00]" : item.tone === "warning" ? "border-[#f5b340]/35 text-[#f5b340]" : "border-[#d96a3f]/35 text-[#d96a3f]")} style={{ fontFamily: MONO_FONT }}>
                {item.wave}
              </div>
            </div>
          )) : (
            <div className="bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">Sem gaps ou diferenças suficientes para montar roadmap.</div>
          )}
        </div>
      </div>
    </section>
  )
}

function BenchSprintBundles({ items }: { items: BenchRoadmapItem[] }) {
  const quick = items.filter((item) => item.wave === "W1").slice(0, 3)
  const strategic = items.filter((item) => item.wave !== "W1").slice(0, 3)
  const bundles = [
    {
      name: "Sprint rápido",
      tag: "recomendado",
      hours: `${Math.max(quick.length, 1) * 2}h`,
      rationale: "Corrige os pontos que mais aumentam clareza ou confiança sem redesenhar a estratégia.",
      items: quick,
      featured: true,
    },
    {
      name: "Sprint estratégico",
      tag: "categoria",
      hours: `${Math.max(strategic.length, 1) * 4}h`,
      rationale: "Transforma vantagens e gaps do bench em diferenciação explícita ou decisão de won't-fix.",
      items: strategic,
      featured: false,
    },
  ]
  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="sprints" title="Pacotes de execução" meta="2 caminhos" />
      <div className="grid gap-4 p-4">
        {bundles.map((bundle) => (
          <article key={bundle.name} className={cn("border bg-[#050505] p-4", bundle.featured ? "border-[#d1ff00]/40" : "border-[#f5f4e7]/10")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{bundle.tag}</div>
                <h3 className="mt-1 text-[24px] font-black leading-none tracking-[-0.04em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{bundle.name}</h3>
              </div>
              <div className="text-[32px] font-black leading-none tracking-[-0.05em] text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>{bundle.hours}</div>
            </div>
            <p className="mt-4 text-[13px] leading-[1.5] text-[#f5f4e7]/56">{bundle.rationale}</p>
            <div className="mt-4 grid gap-2">
              {bundle.items.length > 0 ? bundle.items.map((item) => (
                <div key={`${bundle.name}-${item.rank}`} className="grid grid-cols-[42px_minmax(0,1fr)_56px] gap-3 border border-[#f5f4e7]/10 bg-[#101010] p-3">
                  <span className="text-[12px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>#{String(item.rank).padStart(2, "0")}</span>
                  <span className="truncate text-[13px] font-black text-[#f5f4e7]">{item.title}</span>
                  <span className="text-right text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>{item.effort}</span>
                </div>
              )) : (
                <div className="border border-[#f5f4e7]/10 bg-[#101010] p-3 text-[13px] text-[#f5f4e7]/50">Sem itens suficientes.</div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function BenchReadinessPanel({ matrix, playerProfiles }: { matrix: ObservatoryMatrix | null; playerProfiles: ObservatoryPlayerProfile[] }) {
  const totals = matrix ? [...matrix.totals].sort((a, b) => b.score - a.score) : []
  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="readiness" title="Maturidade por player" meta={`${totals.length} players`} />
      <div className="grid gap-px bg-[#f5f4e7]/10 p-px">
        {totals.length > 0 ? totals.map((total, index) => {
          const label = benchReadinessLabel(total.score)
          return (
            <div key={total.player} className="grid gap-4 bg-[#050505] p-4 lg:grid-cols-[220px_84px_minmax(0,1fr)_220px] lg:items-center">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                  #{String(index + 1).padStart(2, "0")}
                </div>
                <div className="aiox-safe-text mt-1 text-[18px] font-black text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                  {displayBenchPlayer(total.player, playerProfiles)}
                </div>
              </div>
              <div className={cn("text-[30px] font-black leading-none tracking-[-0.05em]", benchReadinessTone(total.score))} style={{ fontFamily: DISPLAY_FONT }}>
                {formatBenchNumber(total.score)}
              </div>
              <div className="h-2 border border-[#f5f4e7]/10 bg-[#101010]">
                <div
                  className={cn("h-full", total.score >= 85 ? "bg-[#d1ff00]" : total.score >= 70 ? "bg-[#f5b340]" : "bg-[#ef4444]")}
                  style={{ width: `${Math.max(3, Math.min(100, total.score))}%` }}
                />
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/42 lg:text-right" style={{ fontFamily: MONO_FONT }}>
                {label}
              </div>
            </div>
          )
        }) : (
          <div className="bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">Sem totais consolidados para gerar readiness.</div>
        )}
      </div>
    </section>
  )
}

function BenchScoreBreakdown({
  matrix,
  scoreDimensions,
  playerProfiles,
}: {
  matrix: ObservatoryMatrix | null
  scoreDimensions: ObservatoryScoreDimension[]
  playerProfiles: ObservatoryPlayerProfile[]
}) {
  if (matrix) {
    const rows = [...matrix.rows].sort((a, b) => benchScoreGap(b) - benchScoreGap(a))
    return (
      <section className="aiox-panel bg-[#0f0f11]">
        <ResearchPanelHead eyebrow="score breakdown" title="Peso, gap e vencedor" meta={`${rows.length} dimensões`} />
        <div className="grid gap-px bg-[#f5f4e7]/10 p-px">
          {rows.map((row) => {
            const sorted = [...row.cells].sort((a, b) => b.score - a.score)
            const leader = sorted[0]
            const gap = benchScoreGap(row)
            const status = benchScoreStatus(leader?.score ?? 0)
            return (
              <div key={row.id} className="grid gap-4 bg-[#050505] p-4 lg:grid-cols-[minmax(0,1fr)_72px_minmax(180px,0.8fr)_86px] lg:items-center">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                    {row.id} · peso {Math.round((row.weight || 0) * 100)}%
                  </div>
                  <div className="aiox-safe-text mt-1 text-[16px] font-black text-[#f5f4e7]">{row.label}</div>
                </div>
                <div className="text-right text-[24px] font-black leading-none text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                  {formatBenchNumber(leader?.score ?? 0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                    <span>{leader ? displayBenchPlayer(leader.player, playerProfiles) : "—"}</span>
                    <span>gap {formatBenchNumber(gap)}</span>
                  </div>
                  <div className="mt-2 h-1.5 border border-[#f5f4e7]/10 bg-[#101010]">
                    <div className="h-full bg-[#d1ff00]" style={{ width: `${Math.max(3, Math.min(100, leader?.score ?? 0))}%` }} />
                  </div>
                </div>
                <div className={cn(
                  "border px-2 py-1 text-center text-[10px] uppercase tracking-[0.12em]",
                  status === "forte" || status === "bom"
                    ? "border-[#d1ff00]/30 text-[#d1ff00]"
                    : status === "alerta"
                      ? "border-[#f5b340]/35 text-[#f5b340]"
                      : "border-[#ef4444]/35 text-[#ef4444]",
                )} style={{ fontFamily: MONO_FONT }}>
                  {status}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="scorecard" title="Score por dimensão" meta={`${scoreDimensions.length}`} />
      <div className="grid gap-px bg-[#f5f4e7]/10 p-px">
        {scoreDimensions.map((dimension, index) => (
          <div key={`${dimension.name}-${index}`} className="grid gap-3 bg-[#050505] p-4 lg:grid-cols-[minmax(0,1fr)_100px_120px] lg:items-center">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{dimension.weight || "peso —"}</div>
              <div className="aiox-safe-text mt-1 text-[16px] font-black text-[#f5f4e7]">{dimension.name}</div>
            </div>
            <div className="text-[13px] font-black text-[#d1ff00] lg:text-right">{dimension.winner || "—"}</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42 lg:text-right" style={{ fontFamily: MONO_FONT }}>{dimension.delta || "delta —"}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BenchArtifactGrid({
  documents,
  dataDocs,
  proofDocs,
  actionDocs,
}: {
  documents: ObservatoryDocument[]
  dataDocs: ObservatoryDocument[]
  proofDocs: ObservatoryDocument[]
  actionDocs: ObservatoryDocument[]
}) {
  const groups = [
    { label: "Dados", docs: dataDocs, copy: "score, matrix, YAML/JSON e arquivos estruturados" },
    { label: "Prova", docs: proofDocs, copy: "fontes, evidências, citações e inventários" },
    { label: "Ação", docs: actionDocs, copy: "gaps, recomendações, roadmap e follow-up" },
    { label: "Docs", docs: documents.filter((doc) => benchArtifactKind(doc.file) === "doc"), copy: "relatórios e leitura humana" },
  ]
  return (
    <div className="grid gap-px bg-[#f5f4e7]/10 p-px md:grid-cols-2 xl:grid-cols-4">
      {groups.map((group) => (
        <div key={group.label} className="min-w-0 bg-[#050505] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{group.label}</div>
              <p className="mt-1 text-[12px] leading-[1.4] text-[#f5f4e7]/45">{group.copy}</p>
            </div>
            <div className="text-[30px] font-black leading-none text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{group.docs.length}</div>
          </div>
          <div className="mt-4 grid gap-2">
            {group.docs.slice(0, 5).map((doc) => (
              <span key={doc.file} className="truncate border border-[#f5f4e7]/10 bg-[#101010] px-2 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/50" style={{ fontFamily: MONO_FONT }}>
                {doc.file}
              </span>
            ))}
            {group.docs.length === 0 && <span className="text-[12px] text-[#f5f4e7]/35">Ausente neste bench.</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function buildBenchMetaLearnings({
  matrix,
  scoreDimensions,
  gapItems,
  categorical,
  evidencePct,
  hasRoadmapSignal,
}: {
  matrix: ObservatoryMatrix | null
  scoreDimensions: ObservatoryScoreDimension[]
  gapItems: ObservatoryGapItem[]
  categorical: ObservatoryCategoricalWinner[]
  evidencePct: number
  hasRoadmapSignal: boolean
}) {
  const topPlayer = matrix ? [...matrix.totals].sort((a, b) => b.score - a.score)[0]?.player : mostFrequent(scoreDimensions.map((dimension) => dimension.winner).filter(Boolean))
  const categoryWins = categorical.length
  const matrixShape = matrix ? `${matrix.players.length} players × ${matrix.rows.length} dimensões` : `${scoreDimensions.length} dimensões de scorecard`
  return [
    {
      label: "Confirmado",
      tone: "text-[#d1ff00]",
      title: "Heatmap é o instrumento central",
      body: `A forma mais clara de ler o bench é comparar dimensões lado a lado. Este bench tem ${matrixShape}.`,
      action: "manter matriz visual como primeira prova da decisão",
    },
    {
      label: "Falhou",
      tone: "text-[#ef4444]",
      title: "Score sozinho não explica escolha",
      body: topPlayer ? `${topPlayer} lidera, mas a decisão só fica defensável quando gaps, riscos e evidências aparecem juntos.` : "Sem líder consolidado, o score isolado perde força.",
      action: "sempre gerar veredito, gap e racional por dimensão",
    },
    {
      label: "Emergente",
      tone: "text-[#f5b340]",
      title: "Bench precisa virar roadmap",
      body: hasRoadmapSignal ? `${gapItems.length} gaps e sinais de ação foram detectados.` : "Ainda faltam artefatos de ação para transformar comparação em execução.",
      action: "gerar backlog de absorção ou won't-fix explícito",
    },
    {
      label: "Anti-pattern",
      tone: "text-[#f5f4e7]/62",
      title: "Relatório genérico empobrece o bench",
      body: `${evidencePct}% de cobertura de evidência e ${categoryWins} vitórias categóricas precisam aparecer visualmente, não escondidas em docs.`,
      action: "usar evidência, heatmap e meta-aprendizado em todo bench",
    },
  ]
}

function BenchMetaLearningPanel({
  learnings,
}: {
  learnings: Array<{ label: string; tone: string; title: string; body: string; action: string }>
}) {
  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="meta" title="Aprendizado do benchmark" meta={`${learnings.length} lentes`} />
      <div className="grid gap-px bg-[#f5f4e7]/10 p-px lg:grid-cols-2">
        {learnings.map((learning, index) => (
          <article key={learning.label} className="bg-[#050505] p-5">
            <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3">
              <div className={cn("text-[28px] font-black leading-none tracking-[-0.05em]", learning.tone)} style={{ fontFamily: DISPLAY_FONT }}>
                {String(index + 1)}
              </div>
              <div className="min-w-0">
                <div className={cn("text-[10px] uppercase tracking-[0.14em]", learning.tone)} style={{ fontFamily: MONO_FONT }}>{learning.label}</div>
                <h3 className="aiox-safe-text mt-1 text-[19px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{learning.title}</h3>
                <p className="mt-3 text-[13px] leading-[1.55] text-[#f5f4e7]/58">{learning.body}</p>
                <div className="mt-4 border-l border-[#d1ff00]/45 pl-3 text-[12.5px] font-black leading-[1.45] text-[#f5f4e7]">
                  {learning.action}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function BenchScoreReport({
  dimensions,
  scoreMetrics,
  matrix,
  playerProfiles,
}: {
  dimensions: ObservatoryScoreDimension[]
  scoreMetrics: ObservatoryMetric[]
  matrix: ObservatoryMatrix | null
  playerProfiles: ObservatoryPlayerProfile[]
}) {
  const strongest = matrix ? [...matrix.rows].sort((a, b) => benchScoreGap(b) - benchScoreGap(a)).slice(0, 6) : []
  const leader = matrix ? [...matrix.totals].sort((a, b) => b.score - a.score)[0] : null

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="score"
          title="Score sem esconder o racional"
          copy="A aba Score agora separa métrica, peso, gap e evidência. O objetivo é explicar por que o número existe, não repetir o ranking."
          accentValue={leader ? formatBenchNumber(leader.score) : String(scoreMetrics[0]?.value ?? "—")}
          accentLabel={leader ? displayBenchPlayer(leader.player, playerProfiles) : "score"}
          metrics={[
            ["Dimensões", dimensions.length || matrix?.rows.length || 0],
            ["Métricas", scoreMetrics.length],
            ["Gaps fortes", strongest.length],
          ]}
        />

        <div className="mt-6 grid gap-8">
          <ResearchStorySection step="01" title="Score breakdown" copy="Leia primeiro as dimensões com maior distância: elas são as que realmente explicam a decisão.">
            <BenchScoreBreakdown matrix={matrix} scoreDimensions={dimensions} playerProfiles={playerProfiles} />
          </ResearchStorySection>

          <ResearchStorySection step="02" title="Justificativas do scorecard" copy="Quando existe scorecard textual, ele aparece como evidência compacta por dimensão.">
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="evidence" title="Racional por dimensão" meta={`${dimensions.length}`} />
              <div className="grid gap-px bg-[#f5f4e7]/10 p-px md:grid-cols-2">
                {dimensions.map((dimension, index) => (
                  <article key={`${dimension.name}-${index}`} className="bg-[#050505] p-4">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                      {dimension.winner || "sem vencedor"} · {dimension.weight || "peso —"}
                    </div>
                    <h3 className="aiox-safe-text mt-2 text-[18px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{dimension.name}</h3>
                    <p className="mt-2 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{dimension.evidence || "Sem evidência estruturada."}</p>
                  </article>
                ))}
                {dimensions.length === 0 && <div className="bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">Sem scorecard textual estruturado.</div>}
              </div>
            </section>
          </ResearchStorySection>
        </div>
      </article>
    </LightScrollArea>
  )
}

function BenchPersonasReport({
  personas,
  playerProfiles,
  matrix,
}: {
  personas: ObservatoryPersona[]
  playerProfiles: ObservatoryPlayerProfile[]
  matrix: ObservatoryMatrix | null
}) {
  const winners = countBy(personas, (persona) => displayBenchPlayer(persona.winner, playerProfiles))
  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="personas"
          title="Quem muda a decisão"
          copy="Personas devem responder em quais contextos o vencedor geral deixa de ser óbvio. Cada cenário precisa mostrar vencedor, runner e critério de desempate."
          accentValue={String(personas.length)}
          accentLabel="cenários"
          metrics={[
            ["Vencedores", winners.length],
            ["Players", matrix?.players.length ?? 0],
            ["Com desempate", personas.filter((p) => p.tiebreaker).length],
          ]}
        />
        <div className="mt-6 grid gap-8">
          <ResearchStorySection step="01" title="Mapa de cenários" copy="Cada card mostra o que a persona prioriza e qual player vence nesse recorte.">
            <div className="grid gap-px bg-[#f5f4e7]/10 p-px lg:grid-cols-2">
              {personas.map((persona) => (
                <article key={persona.id} className="bg-[#050505] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{persona.id}</div>
                      <h3 className="aiox-safe-text mt-1 text-[24px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{persona.label}</h3>
                      <p className="mt-2 text-[13px] leading-[1.5] text-[#f5f4e7]/52">{persona.sub || persona.verdict}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/40" style={{ fontFamily: MONO_FONT }}>vence</div>
                      <div className="mt-1 text-[22px] font-black leading-none text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>{displayBenchPlayer(persona.winner, playerProfiles)}</div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2">
                    {persona.ranking.slice(0, 4).map((rank) => (
                      <div key={`${persona.id}-${rank.player}`} className="grid grid-cols-[36px_minmax(0,1fr)_72px] items-center gap-3 border border-[#f5f4e7]/10 bg-[#101010] p-3">
                        <span className="text-[12px] uppercase tracking-[0.12em] text-[#f5f4e7]/36" style={{ fontFamily: MONO_FONT }}>{rank.rank}</span>
                        <span className="truncate text-[14px] font-black text-[#f5f4e7]">{displayBenchPlayer(rank.player, playerProfiles)}</span>
                        <span className="text-right text-[20px] font-black text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{formatBenchNumber(rank.score)}</span>
                      </div>
                    ))}
                  </div>
                  {(persona.job || persona.decisiveDimensions.length > 0) && (
                    <div className="mt-4 grid gap-3 border border-[#f5f4e7]/10 bg-[#0b0b0b] p-3">
                      {persona.job && (
                        <p className="text-[12px] leading-[1.5] text-[#f5f4e7]/62">
                          <span className="font-black text-[#f5f4e7]">Job: </span>{persona.job}
                        </p>
                      )}
                      {persona.decisiveDimensions.length > 0 && (
                        <div className="grid gap-1.5">
                          {persona.decisiveDimensions.slice(0, 4).map((dimension) => (
                            <div key={`${persona.id}-${dimension.id}`} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3">
                              <span className="truncate text-[11px] text-[#f5f4e7]/52">{dimension.label}</span>
                              <span className="text-right text-[11px] uppercase tracking-[0.1em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{formatBenchNumber(dimension.weight)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {(persona.mustHave.length > 0 || persona.antiGoals.length > 0) && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {persona.mustHave.length > 0 && (
                        <div className="border border-[#d1ff00]/20 bg-[#d1ff00]/5 p-3">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>must-have</div>
                          <p className="mt-2 text-[12px] leading-[1.45] text-[#f5f4e7]/62">{persona.mustHave.slice(0, 4).join(" · ")}</p>
                        </div>
                      )}
                      {persona.antiGoals.length > 0 && (
                        <div className="border border-[#f5b340]/20 bg-[#f5b340]/5 p-3">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5b340]" style={{ fontFamily: MONO_FONT }}>anti-goals</div>
                          <p className="mt-2 text-[12px] leading-[1.45] text-[#f5f4e7]/62">{persona.antiGoals.slice(0, 3).join(" · ")}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {persona.tiebreaker && <p className="mt-4 border-l border-[#d1ff00]/45 pl-3 text-[13px] leading-[1.5] text-[#f5f4e7]/62">{persona.tiebreaker}</p>}
                </article>
              ))}
            </div>
          </ResearchStorySection>
        </div>
      </article>
    </LightScrollArea>
  )
}

function BenchDuelReport({
  matrix,
  playerProfiles,
}: {
  matrix: ObservatoryMatrix
  playerProfiles: ObservatoryPlayerProfile[]
}) {
  const totalsByPlayer = useMemo(() => {
    const map = new Map<string, number>()
    for (const total of matrix.totals) map.set(total.player, total.score)
    return map
  }, [matrix.totals])
  const players = useMemo(
    () => [...matrix.players].sort((a, b) => (totalsByPlayer.get(b) ?? 0) - (totalsByPlayer.get(a) ?? 0)),
    [matrix.players, totalsByPlayer],
  )
  const [left, setLeft] = useState(players[0] ?? "")
  const [right, setRight] = useState(players[1] ?? players[0] ?? "")

  useEffect(() => {
    setLeft(players[0] ?? "")
    setRight(players[1] ?? players[0] ?? "")
  }, [players])

  const profileByKey = useMemo(() => new Map(playerProfiles.map((profile) => [profile.key, profile])), [playerProfiles])
  const playerName = (key: string) => displayBenchPlayer(key, playerProfiles)
  const duelPlayerName = (key: string) => playerName(key).replace(/[_-]+/g, " ")
  const playerColor = (key: string) => key === right ? "#3b82f6" : "#ef4444"
  const playerMeta = (key: string) => {
    const profile = profileByKey.get(key)
    return [profile?.category, profile?.license, profile?.tag].filter(Boolean).join(" · ") || key
  }

  const selectLeft = (next: string) => {
    setLeft(next)
    if (next === right) {
      setRight(players.find((player) => player !== next) ?? next)
    }
  }
  const selectRight = (next: string) => {
    setRight(next)
    if (next === left) {
      setLeft(players.find((player) => player !== next) ?? next)
    }
  }
  const swapPlayers = () => {
    setLeft(right)
    setRight(left)
  }

  const duel = useMemo(() => {
    const rows = matrix.rows
      .map((row) => {
        const leftCell = row.cells.find((cell) => cell.player === left)
        const rightCell = row.cells.find((cell) => cell.player === right)
        const leftScore = leftCell?.score ?? 0
        const rightScore = rightCell?.score ?? 0
        const delta = leftScore - rightScore
        const winner = delta === 0 ? "tie" : delta > 0 ? left : right
        return {
          row,
          leftScore,
          rightScore,
          delta,
          winner,
          note: delta >= 0 ? leftCell?.notes || leftCell?.source : rightCell?.notes || rightCell?.source,
          leftNote: leftCell?.notes || leftCell?.source || "",
          rightNote: rightCell?.notes || rightCell?.source || "",
        }
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    const leftWins = rows.filter((row) => row.winner === left)
    const rightWins = rows.filter((row) => row.winner === right)
    const ties = rows.filter((row) => row.winner === "tie")
    const totalLeft = totalsByPlayer.get(left) ?? rows.reduce((sum, row) => sum + row.leftScore, 0)
    const totalRight = totalsByPlayer.get(right) ?? rows.reduce((sum, row) => sum + row.rightScore, 0)
    const leader = totalLeft === totalRight ? "tie" : totalLeft > totalRight ? left : right
    return {
      rows,
      leftWins,
      rightWins,
      ties,
      totalLeft,
      totalRight,
      gap: Math.abs(totalLeft - totalRight),
      leader,
      decisiveRows: rows.filter((row) => Math.abs(row.delta) > 0).slice(0, 6),
    }
  }, [left, matrix.rows, right, totalsByPlayer])
  const strongestDriver = duel.decisiveRows[0]
  const totalWinCount = Math.max(1, matrix.rows.length)
  const leftWinPct = (duel.leftWins.length / totalWinCount) * 100
  const tiePct = (duel.ties.length / totalWinCount) * 100
  const rightWinPct = (duel.rightWins.length / totalWinCount) * 100
  const leftStrong = formatDuelStrongDimensions(duel.leftWins)
  const rightStrong = formatDuelStrongDimensions(duel.rightWins)
  const scaledTotalLeft = scaleDuelTotal(duel.totalLeft)
  const scaledTotalRight = scaleDuelTotal(duel.totalRight)
  const scaledGap = Math.abs(scaledTotalLeft - scaledTotalRight)

  if (players.length < 2 || !left || !right || left === right) {
    return (
      <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
        <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
          <ResearchCompactIntro
            eyebrow="duelo"
            title="Benchmark sem duelo suficiente"
            copy="O modo duelo precisa de pelo menos dois players com células comparáveis na matriz."
            accentValue={String(players.length)}
            accentLabel="players"
            metrics={[
              ["Players", players.length],
              ["Dimensões", matrix.rows.length],
            ]}
          />
        </article>
      </LightScrollArea>
    )
  }

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="pb-12 pt-0" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell max-w-none" style={observatoryDarkThemeVars}>
        <div className="aiox-duel-toolbar">
          <div className="aiox-duel-toolbar-label">
            duelo
          </div>
          <div className="aiox-duel-picker min-w-0 flex-wrap">
            <BenchDuelToolbarSelect
              side="A"
              value={left}
              players={players}
              disabledPlayer={right}
              playerProfiles={playerProfiles}
              onChange={selectLeft}
            />
            <div className="aiox-duel-picker-vs grid place-items-center">
              VS
            </div>
            <BenchDuelToolbarSelect
              side="B"
              value={right}
              players={players}
              disabledPlayer={left}
              playerProfiles={playerProfiles}
              onChange={selectRight}
            />
          </div>
          <button
            type="button"
            onClick={swapPlayers}
            className="aiox-duel-swap inline-flex items-center gap-2 transition-colors hover:border-[#d1ff00] hover:text-[#d1ff00]"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            inverter
          </button>
          <div className="aiox-duel-toolbar-right">
            <span>rounds <strong className="ml-1 text-[#f5f4e7]">{matrix.rows.length}</strong></span>
            <span>score <strong className="ml-1 text-[#f5f4e7]">{formatDuelScore(scaledTotalLeft)}</strong> <span className="text-[#d1ff00]">vs</span> <strong className="ml-1 text-[#f5f4e7]">{formatDuelScore(scaledTotalRight)}</strong></span>
            <span>gap <strong className="ml-1 text-[#d1ff00]">{formatDuelScore(scaledGap)}</strong></span>
            <span>conf <strong className="ml-1 text-[#d1ff00]">alta</strong></span>
          </div>
        </div>

        <div className="aiox-duel-titlebar">
          <div className="inline-flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f5f4e7]/40" style={{ fontFamily: MONO_FONT }}>
            <span className="text-[#d1ff00]">Duelo</span>
            <span className="text-[#f5f4e7]/24">·</span>
            <span>Head-to-head</span>
            <span className="text-[#f5f4e7]/24">·</span>
            <span>{matrix.rows.length} dimensões</span>
          </div>
          <h1 className="m-0 mt-2 text-[28px] font-black uppercase leading-none tracking-[-0.025em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
            Duelo
          </h1>
        </div>

        <section className="aiox-duel-arena">
          <div className="aiox-duel-arena-grid">
            <BenchDuelArenaPlayer
              side="left"
              label="P01 · Player A"
              value={left}
              playerProfiles={playerProfiles}
              color={playerColor(left)}
              meta={playerMeta(left)}
              score={duel.totalLeft}
              displayScore={scaledTotalLeft}
              wins={duel.leftWins.length}
              gap={scaledTotalLeft - scaledTotalRight}
              strongDimensions={leftStrong}
              dimensions={matrix.rows.length}
              active={duel.leader === left}
              displayName={duelPlayerName(left)}
            />
            <div className="aiox-vs-blade">
              <span className="aiox-vs-badge">
                Round {String(matrix.rows.length).padStart(2, "0")}/{String(matrix.rows.length).padStart(2, "0")}
              </span>
              <span className="aiox-vs-mark">
                VS
              </span>
              <span className="aiox-vs-delta">
                Δ +{formatDuelScore(scaledGap)}
              </span>
            </div>
            <BenchDuelArenaPlayer
              side="right"
              label="P02 · Player B"
              value={right}
              playerProfiles={playerProfiles}
              color={playerColor(right)}
              meta={playerMeta(right)}
              score={duel.totalRight}
              displayScore={scaledTotalRight}
              wins={duel.rightWins.length}
              gap={scaledTotalRight - scaledTotalLeft}
              strongDimensions={rightStrong}
              dimensions={matrix.rows.length}
              active={duel.leader === right}
              displayName={duelPlayerName(right)}
            />
          </div>
        </section>
        <div>
          <BenchDuelWinStrip
            leftLabel={duelPlayerName(left)}
            rightLabel={duelPlayerName(right)}
            leftColor={playerColor(left)}
            rightColor={playerColor(right)}
            rows={duel.rows}
            leftWins={duel.leftWins.length}
            rightWins={duel.rightWins.length}
            ties={duel.ties.length}
            leftPct={leftWinPct}
            rightPct={rightWinPct}
            tiePct={tiePct}
          />
        </div>

        <section className="aiox-duel-section">
          <BenchDuelSectionHead
            ord="01"
            title={<>Round<br />by round</>}
            copy="Cada dimensão é um round. Quanto maior o gap, mais decisiva — e menos intercambiáveis os players. Olhe primeiro para os rounds com maior delta."
          />
          <div className="aiox-duel-rounds-grid">
              {duel.decisiveRows.map((item) => {
                const rowLeader = item.winner === "tie" ? "empate" : item.winner === left ? left : right
                const isRightWinner = item.winner !== "tie" && item.winner === right
                return (
                  <article key={`${left}-${right}-${item.row.id}`} className={cn("aiox-duel-round-card", Math.abs(item.delta) >= 12 && "standout")}>
                    <div className="aiox-duel-rc-head">
                      <div className="aiox-duel-rc-meta">
                        <span className="aiox-duel-rc-eyebrow">
                          <b>R{String(duel.rows.indexOf(item) + 1).padStart(2, "0")}</b> · {item.row.id} · Peso {formatBenchNumber(item.row.weight)}
                        </span>
                        <h3 className="aiox-duel-rc-title aiox-safe-text">
                          {item.row.label}
                        </h3>
                      </div>
                      <span className={cn("aiox-duel-rc-verdict", isRightWinner && "b", item.winner === "tie" && "tie")}>
                        {rowLeader === "empate" ? "Empate" : `${duelPlayerName(rowLeader)} +${formatDuelScore(scaleDuelTotal(Math.abs(item.delta)))}`}
                      </span>
                    </div>
                    <div className="aiox-duel-rc-bars">
                      <BenchDuelScoreBar side="a" label={duelPlayerName(left)} value={item.leftScore} />
                      <BenchDuelScoreBar side="b" label={duelPlayerName(right)} value={item.rightScore} />
                    </div>
                    {item.note && <p className="aiox-duel-rc-note">{item.note}</p>}
                  </article>
                )
              })}
          </div>
        </section>

        <section className="aiox-duel-section">
          <BenchDuelSectionHead
            ord="02"
            title={<>Matriz<br />de features</>}
            copy={`${duel.rows.length} dimensões comparadas lado a lado. ✓ presente · score consolidado · vencedor à direita. Use para auditar antes de comprar ou substituir.`}
          />
          <div className="aiox-duel-fmx-wrap">
            <div className="aiox-duel-fmx-head">
              <span className="cell">Feature</span>
              <span className="cell plyr"><span className="dot" />{duelPlayerName(left)}</span>
              <span className="cell plyr"><span className="dot b" />{duelPlayerName(right)}</span>
              <span className="cell win">Vence</span>
            </div>
            <div className="aiox-duel-fmx-cat">
              <span className="id">C01</span>
              Dimensões
              <span className="count"><b>{duel.rows.length}</b> features</span>
            </div>
              {duel.rows.map((item) => {
                const winner = item.winner === "tie" ? "empate" : duelPlayerName(item.winner)
                const leftWinsRow = item.delta > 0
                const rightWinsRow = item.delta < 0
                return (
                  <div key={`${left}-${right}-all-${item.row.id}`} className="aiox-duel-fmx-row">
                    <div className="lab">
                      <span className="nm">{item.row.label}</span>
                      <span className="sub">{item.row.id} · peso {formatBenchNumber(item.row.weight)}</span>
                    </div>
                    <BenchDuelMatrixCell side="a" score={item.leftScore} active={leftWinsRow} />
                    <BenchDuelMatrixCell side="b" score={item.rightScore} active={rightWinsRow} />
                    <div className={cn("winner", leftWinsRow && "a", rightWinsRow && "b")}>
                      {winner}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      </article>
    </LightScrollArea>
  )
}

function BenchDuelSelect({
  label,
  value,
  players,
  disabledPlayer,
  playerProfiles,
  totalsByPlayer,
  onChange,
  compact = false,
}: {
  label: string
  value: string
  players: string[]
  disabledPlayer: string
  playerProfiles: ObservatoryPlayerProfile[]
  totalsByPlayer: Map<string, number>
  onChange: (value: string) => void
  compact?: boolean
}) {
  const selectedProfile = playerProfiles.find((profile) => profile.key === value)
  return (
    <label className="block min-w-0">
      {!compact && (
        <span className="mb-3 block text-[10px] uppercase tracking-[0.16em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
          {label}
        </span>
      )}
      <div className="relative border border-[#f5f4e7]/14 bg-[#0f0f11] transition-colors focus-within:border-[#d1ff00]/70">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1" style={{ background: selectedProfile?.color ?? "#d1ff00" }} />
        <div className="grid grid-cols-[minmax(0,1fr)_88px_28px] items-center gap-3 px-4 py-4">
          <div className="min-w-0">
            <select
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className={cn(
                "w-full min-w-0 appearance-none bg-transparent pr-2 font-black leading-none tracking-[-0.04em] text-[#f5f4e7] outline-none",
                compact ? "text-[22px]" : "text-[24px]",
              )}
              style={{ fontFamily: DISPLAY_FONT }}
            >
              {players.map((player) => (
                <option key={player} value={player} disabled={player === disabledPlayer}>
                  {displayBenchPlayer(player, playerProfiles)}
                </option>
              ))}
            </select>
            <div className="mt-2 truncate text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/32" style={{ fontFamily: MONO_FONT }}>
              {[selectedProfile?.category, selectedProfile?.license, selectedProfile?.tag].filter(Boolean).join(" · ") || value}
            </div>
          </div>
          <div className="border-l border-[#f5f4e7]/10 pl-3 text-right">
            <div className="text-[9px] uppercase tracking-[0.12em] text-[#f5f4e7]/32" style={{ fontFamily: MONO_FONT }}>score</div>
            <div className="mt-1 text-[24px] font-black leading-none text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
              {formatBenchNumber(totalsByPlayer.get(value) ?? 0)}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-[#f5f4e7]/36" />
        </div>
      </div>
    </label>
  )
}

function BenchDuelSectionHead({
  ord,
  title,
  copy,
}: {
  ord: string
  title: ReactNode
  copy: string
}) {
  return (
    <div className="aiox-duel-section-head">
      <span className="text-[56px] font-black leading-none tracking-[-0.04em] text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>
        {ord}
      </span>
      <h2 className="m-0 text-[clamp(32px,3.4vw,42px)] font-black uppercase leading-none tracking-[-0.03em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
        {title}
      </h2>
      <p className="m-0 pt-2 text-[14px] leading-[1.55] text-[#f5f4e7]/62" style={{ fontFamily: SANS_FONT }}>
        {copy}
      </p>
    </div>
  )
}

function BenchDuelMatrixCell({
  side,
  score,
  active,
}: {
  side: "a" | "b"
  score: number
  active: boolean
}) {
  return (
    <div className={cn("pcell", active && "win", side)}>
      <span className="aiox-duel-fmx-mark yes">✓</span>
      <span className="val">
        {formatDuelScore(scaleDuelTotal(score))}
      </span>
    </div>
  )
}

function BenchDuelToolbarSelect({
  side,
  value,
  players,
  disabledPlayer,
  playerProfiles,
  onChange,
}: {
  side: "A" | "B"
  value: string
  players: string[]
  disabledPlayer: string
  playerProfiles: ObservatoryPlayerProfile[]
  onChange: (value: string) => void
}) {
  const cleanName = displayBenchPlayer(value, playerProfiles).replace(/[_-]+/g, " ")
  return (
    <label className="aiox-duel-side">
      <span className={cn("aiox-duel-side-dot", side === "B" && "b")} />
      <span>{cleanName}</span>
      <span className="aiox-duel-side-arr">▾</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="aiox-duel-side-select"
        aria-label={`Selecionar player ${side}`}
      >
        {players.map((player) => (
          <option key={player} value={player} disabled={player === disabledPlayer}>
            {displayBenchPlayer(player, playerProfiles).replace(/[_-]+/g, " ")}
          </option>
        ))}
      </select>
    </label>
  )
}

function BenchDuelArenaPlayer({
  side,
  label,
  value,
  playerProfiles,
  color,
  meta,
  score,
  displayScore,
  wins,
  gap,
  strongDimensions,
  dimensions,
  active,
  displayName,
}: {
  side: "left" | "right"
  label: string
  value: string
  playerProfiles: ObservatoryPlayerProfile[]
  color: string
  meta: string
  score: number
  displayScore: number
  wins: number
  gap: number
  strongDimensions: string
  dimensions: number
  active: boolean
  displayName: string
}) {
  const alignRight = side === "right"
  const profile = playerProfiles.find((item) => item.key === value)
  const tagline = [profile?.type, profile?.origin, profile?.category, profile?.tag].filter(Boolean).join(" · ") || meta
  const role = active ? "Vencedor" : score >= 0 ? "Runner-up" : "Challenger"
  return (
    <section className={cn("aiox-duel-corner", alignRight ? "right" : "left", active && "winner")} style={{ "--duel-player-color": color } as CSSProperties}>
      <span className="aiox-duel-corner-tag">
          <span className="opacity-70">{label.replace(/ · .+$/, "")}</span> · {role}
      </span>
      <h2 className="aiox-duel-corner-name aiox-safe-text">
        {displayName}
      </h2>
      <span className="aiox-duel-corner-handle">
        {meta}
      </span>
      <p className="aiox-duel-corner-tagline">
        {tagline}
      </p>
      <div className="aiox-duel-corner-score">
        <span className="aiox-duel-score-num">
          {formatDuelScore(displayScore)}
        </span>
        <span className="aiox-duel-score-unit">
          score
        </span>
      </div>
      <div className={cn("aiox-duel-corner-stats", alignRight && "right")}>
        <div className="aiox-duel-cs-cell">
          <div className="aiox-duel-cs-k">Rounds</div>
          <div className="aiox-duel-cs-v player">{wins}</div>
        </div>
        <div className="aiox-duel-cs-cell">
          <div className="aiox-duel-cs-k">Gap médio</div>
          <div className="aiox-duel-cs-v">{gap > 0 ? "+" : ""}{formatDuelScore(dimensions > 0 ? gap / dimensions : gap)}</div>
        </div>
        <div className="aiox-duel-cs-cell">
          <div className="aiox-duel-cs-k">Dim. fortes</div>
          <div className="aiox-duel-cs-v">{strongDimensions}</div>
        </div>
      </div>
    </section>
  )
}

function BenchDuelWinStrip({
  leftLabel,
  rightLabel,
  leftColor,
  rightColor,
  rows,
  leftWins,
  rightWins,
  ties,
  leftPct,
  rightPct,
  tiePct,
}: {
  leftLabel: string
  rightLabel: string
  leftColor: string
  rightColor: string
  rows: Array<{
    row: ObservatoryMatrixRow
    leftScore: number
    rightScore: number
    delta: number
    winner: string
  }>
  leftWins: number
  rightWins: number
  ties: number
  leftPct: number
  rightPct: number
  tiePct: number
}) {
  return (
    <div className="aiox-duel-scoreboard">
      <div className={cn("aiox-duel-sb-side left", leftWins >= rightWins && "lead")}>
        <span className="aiox-duel-sb-k">{leftLabel} · vence</span>
        <span className="aiox-duel-sb-v">{leftWins} · {rightWins}</span>
      </div>
      <div className="aiox-duel-sb-rounds overflow-x-auto">
        <div className="flex min-w-max flex-1">
          {rows.map((item, index) => {
            const leftWidth = Math.max(4, Math.min(96, item.leftScore))
            const rightWidth = Math.max(4, Math.min(96, item.rightScore))
            const winner = item.winner === "tie" ? "empate" : item.delta > 0 ? leftLabel : rightLabel
            return (
              <button key={`${item.row.id}-${index}`} type="button" className={cn("aiox-duel-sb-round", item.delta > 0 ? "wina" : item.delta < 0 ? "winb" : "tie")}>
                <span className="aiox-duel-rid">R{String(index + 1).padStart(2, "0")} · {item.row.id}</span>
                <span className="aiox-duel-bar2">
                  <span className="l" style={{ "--w": `${leftWidth}%` } as CSSProperties} />
                  <span className="r" style={{ "--w": `${rightWidth}%` } as CSSProperties} />
                </span>
                <span className={cn("aiox-duel-rwin", item.delta > 0 ? "a" : item.delta < 0 ? "b" : "tie")}>{winner}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className={cn("aiox-duel-sb-side right", rightWins > leftWins && "lead")}>
        <span className="aiox-duel-sb-k">{rightLabel} · vence</span>
        <span className="aiox-duel-sb-v">{rightWins} · {leftWins}</span>
      </div>
    </div>
  )
}

function BenchDuelPlayerPanel({
  align,
  color,
  name,
  meta,
  score,
  wins,
  dimensions,
  active,
}: {
  align: "left" | "right"
  color: string
  name: string
  meta: string
  score: number
  wins: number
  dimensions: number
  active: boolean
}) {
  return (
    <section className={cn("relative overflow-hidden bg-[#0f0f11] p-5", align === "right" && "text-right")}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      {active && (
        <div className={cn(
          "absolute top-4 flex items-center gap-1 border border-[#d1ff00]/45 bg-[#d1ff00] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#050505]",
          align === "right" ? "left-4" : "right-4",
        )} style={{ fontFamily: MONO_FONT }}>
          <Trophy className="h-3 w-3" />
          líder
        </div>
      )}
      <div className={cn("flex items-center gap-3", align === "right" && "justify-end")}>
        {align === "left" && <span className="h-3 w-3 shrink-0" style={{ background: color }} />}
        <h3 className="aiox-safe-text text-[30px] font-black leading-none tracking-[-0.055em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
          {name}
        </h3>
        {align === "right" && <span className="h-3 w-3 shrink-0" style={{ background: color }} />}
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{meta}</p>
      <div className="mt-8 text-[68px] font-black leading-none tracking-[-0.07em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
        {formatBenchNumber(score)}
      </div>
      <div className={cn("mt-4 grid grid-cols-2 gap-px bg-[#f5f4e7]/10", active && "outline outline-1 outline-[#d1ff00]/50")}>
        <ResearchDarkMetric label="vitórias" value={`${wins}/${dimensions}`} />
        <ResearchDarkMetric label="status" value={active ? "líder" : "challenger"} />
      </div>
    </section>
  )
}

function BenchDuelScoreBar({
  side,
  label,
  value,
}: {
  side: "a" | "b"
  label: string
  value: number
}) {
  return (
    <div className={cn("aiox-duel-rc-bar", side)}>
      <span className="lbl">{label}</span>
      <span className="tr" style={{ "--w": `${Math.max(0, Math.min(100, value))}%` } as CSSProperties} />
      <span className="v">{formatBenchNumber(value)}</span>
    </div>
  )
}

function BenchTcoReport({ tco }: { tco: ObservatoryTco }) {
  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="tco"
          title="Custo como cenário de decisão"
          copy="TCO não deve ser uma tabela financeira solta: ele mostra quando o barato fica caro e quando o custo inicial compra velocidade ou segurança."
          accentValue={String(tco.scenarios.length)}
          accentLabel={`${tco.currency} · ${tco.unit || "cenários"}`}
          metrics={[
            ["Cenários", tco.scenarios.length],
            ["Moeda", tco.currency],
            ["Unidade", tco.unit || "—"],
          ]}
        />
        <div className="mt-6 grid gap-8">
          <ResearchStorySection step="01" title="Faixas de custo" copy="Compare intervalos, não apenas ponto único. Baseline aparece como referência de leitura.">
            <div className="grid gap-5 xl:grid-cols-2">
              {tco.scenarios.map((scenario) => (
                <section key={scenario.id} className="aiox-panel bg-[#0f0f11]">
                  <ResearchPanelHead eyebrow={scenario.id} title={scenario.label} meta={scenario.unit || tco.unit} />
                  <div className="grid gap-px bg-[#f5f4e7]/10 p-px">
                    {scenario.rows.map((row) => {
                      const high = row.high ?? row.low ?? 0
                      const low = row.low ?? high
                      const max = Math.max(1, ...scenario.rows.map((item) => item.high ?? item.low ?? 0))
                      return (
                        <div key={`${scenario.id}-${row.player}`} className="grid gap-3 bg-[#050505] p-4 lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] lg:items-center">
                          <div className="min-w-0">
                            <div className="truncate text-[16px] font-black text-[#f5f4e7]">{row.player}</div>
                            {row.baseline && <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>baseline</div>}
                          </div>
                          <div className="text-[18px] font-black text-[#f5f4e7] lg:text-right" style={{ fontFamily: DISPLAY_FONT }}>{formatBenchMoney(low, high, tco.currency)}</div>
                          <div className="h-2 border border-[#f5f4e7]/10 bg-[#101010]">
                            <div className={cn("h-full", row.baseline ? "bg-[#d1ff00]" : "bg-[#f5b340]")} style={{ width: `${Math.max(3, Math.min(100, (high / max) * 100))}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </ResearchStorySection>
        </div>
      </article>
    </LightScrollArea>
  )
}

function BenchDecisionReport({
  decisionTree,
  tiebreakers,
  cliffs,
  categorical,
  editorsNote,
  playerProfiles,
}: {
  decisionTree: ObservatoryDecisionNode[]
  tiebreakers: ObservatoryTiebreaker[]
  cliffs: ObservatoryCliff[]
  categorical: ObservatoryCategoricalWinner[]
  editorsNote: ObservatoryEditorsNote | null
  playerProfiles: ObservatoryPlayerProfile[]
}) {
  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="decisão"
          title="Regras para não usar o vencedor errado"
          copy="A decisão boa não é o ranking médio: é saber quais perguntas mudam a escolha, quais cliffs invalidam a recomendação e quais vitórias são categóricas."
          accentValue={String(decisionTree.length + tiebreakers.length + cliffs.length + categorical.length)}
          accentLabel="sinais de decisão"
          metrics={[
            ["Árvore", decisionTree.length],
            ["Desempates", tiebreakers.length],
            ["Cliffs", cliffs.length],
          ]}
        />
        <div className="mt-6 grid gap-8">
          <ResearchStorySection step="01" title="Perguntas que mudam a escolha" copy="Use essas bifurcações antes de aceitar a matriz como resposta final.">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="decision tree" title="Árvore de decisão" meta={`${decisionTree.length}`} />
                <div className="grid gap-px bg-[#f5f4e7]/10 p-px">
                  {decisionTree.map((node, index) => (
                    <article key={`${node.q}-${index}`} className="bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>Q{String(index + 1).padStart(2, "0")}</div>
                      <h3 className="aiox-safe-text mt-1 text-[18px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{node.q}</h3>
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        <div className="border border-[#d1ff00]/25 bg-[#101010] p-3 text-[13px] text-[#f5f4e7]/62"><strong className="text-[#d1ff00]">Sim:</strong> {node.yes}</div>
                        <div className="border border-[#f5b340]/25 bg-[#101010] p-3 text-[13px] text-[#f5f4e7]/62"><strong className="text-[#f5b340]">Não:</strong> {node.no}</div>
                      </div>
                    </article>
                  ))}
                  {decisionTree.length === 0 && <div className="bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">Sem árvore de decisão estruturada.</div>}
                </div>
              </section>
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="cliffs" title="Quando quebra" meta={`${cliffs.length}`} />
                <div className="grid gap-3 p-4">
                  {cliffs.length > 0 ? cliffs.map((cliff, index) => (
                    <article key={`${cliff.player}-${index}`} className="border border-[#ef4444]/25 bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#ef4444]" style={{ fontFamily: MONO_FONT }}>{displayBenchPlayer(cliff.player, playerProfiles)}</div>
                      <h3 className="aiox-safe-text mt-2 text-[16px] font-black text-[#f5f4e7]">{cliff.trigger}</h3>
                      <p className="mt-2 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{cliff.impact}</p>
                    </article>
                  )) : (
                    <div className="border border-[#f5f4e7]/10 bg-[#050505] p-4 text-[13px] text-[#f5f4e7]/52">
                      Sem cliffs estruturados neste bench.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </ResearchStorySection>

          <ResearchStorySection step="02" title="Vitórias categóricas e desempates" copy="Esses itens são mais úteis que média quando o contexto do usuário é específico.">
            <div className="grid gap-5 xl:grid-cols-2">
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="categorias" title="Vitórias categóricas" meta={`${categorical.length}`} />
                <div className="grid gap-3 p-4">
                  {categorical.length > 0 ? categorical.map((item, index) => (
                    <div key={`${item.dimension}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{displayBenchPlayer(item.winner, playerProfiles)} vence</div>
                      <div className="aiox-safe-text mt-1 text-[18px] font-black text-[#f5f4e7]">{item.dimension}</div>
                      <p className="mt-2 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{item.note}</p>
                    </div>
                  )) : (
                    <div className="border border-[#f5f4e7]/10 bg-[#050505] p-4 text-[13px] text-[#f5f4e7]/52">
                      Sem vitórias categóricas explícitas. Use Matriz e Score para identificar drivers.
                    </div>
                  )}
                </div>
              </section>
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="tie-breakers" title="Critérios de desempate" meta={`${tiebreakers.length}`} />
                <div className="grid gap-3 p-4">
                  {tiebreakers.length > 0 ? tiebreakers.map((item, index) => (
                    <div key={`${item.q}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                      <div className="aiox-safe-text text-[17px] font-black text-[#f5f4e7]">{item.q}</div>
                      <div className="mt-3 grid gap-2 text-[13px] text-[#f5f4e7]/58">
                        <span><strong className="text-[#d1ff00]">Sim:</strong> {item.yes}</span>
                        <span><strong className="text-[#f5b340]">Não:</strong> {item.no}</span>
                      </div>
                    </div>
                  )) : !editorsNote && (
                    <div className="border border-[#f5f4e7]/10 bg-[#050505] p-4 text-[13px] text-[#f5f4e7]/52">
                      Sem critérios de desempate estruturados.
                    </div>
                  )}
                  {editorsNote && (
                    <div className="border border-[#d1ff00]/25 bg-[#101010] p-4">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{editorsNote.byline}</div>
                      <div className="mt-1 text-[17px] font-black text-[#f5f4e7]">{editorsNote.title}</div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </ResearchStorySection>
        </div>
      </article>
    </LightScrollArea>
  )
}

function benchVerdict(matrix: ObservatoryMatrix | null, scoreDimensions: ObservatoryScoreDimension[], activeRun?: ObservatoryRunSummary) {
  if (matrix && matrix.totals.length > 0) {
    const sorted = [...matrix.totals].sort((a, b) => b.score - a.score)
    const leader = sorted[0]
    const runner = sorted[1]
    const gap = leader && runner ? leader.score - runner.score : 0
    return {
      leader: leader?.player ?? "Indefinido",
      runner: runner?.player ?? "—",
      score: leader ? formatBenchNumber(leader.score) : "—",
      gap: runner ? formatBenchNumber(gap) : "—",
      status: Math.abs(gap) < 1 ? "empate" : "decisão",
      summary: runner
        ? `${leader.player} lidera por ${formatBenchNumber(gap)} ponto(s) sobre ${runner.player}.`
        : "Score consolidado sem runner estruturado.",
    }
  }
  const winners = scoreDimensions.map((dimension) => dimension.winner).filter(Boolean)
  const topWinner = mostFrequent(winners)
  return {
    leader: topWinner || activeRun?.displayTitle || "Indefinido",
    runner: "—",
    score: activeRun?.coverage || "—",
    gap: "—",
    status: activeRun?.status || "parcial",
    summary: topWinner ? `${topWinner} aparece como vencedor mais recorrente no scorecard.` : "Bench sem matriz consolidada.",
  }
}

function BenchScoreboardPanel({ matrix, playerProfiles }: { matrix: ObservatoryMatrix | null; playerProfiles: ObservatoryPlayerProfile[] }) {
  const sorted = matrix ? [...matrix.totals].sort((a, b) => b.score - a.score) : []
  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="ranking" title="Score consolidado" meta={`${sorted.length} players`} />
      <div className="grid gap-px bg-[#f5f4e7]/10">
        {sorted.length > 0 ? sorted.map((total, index) => {
          const max = Math.max(1, sorted[0]?.score ?? 1)
          return (
            <div key={total.player} className="grid gap-3 bg-[#050505] p-4 md:grid-cols-[42px_minmax(0,1fr)_80px] md:items-center">
              <div className="text-[30px] font-black leading-none text-[#f5f4e7]/22" style={{ fontFamily: DISPLAY_FONT }}>{String(index + 1).padStart(2, "0")}</div>
              <div className="min-w-0">
                <div className="aiox-safe-text text-[20px] font-black text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{displayBenchPlayer(total.player, playerProfiles)}</div>
                <div className="mt-2 h-2 bg-[#f5f4e7]/10">
                  <div className="h-full bg-[#d1ff00]" style={{ width: `${Math.max(3, Math.min(100, (total.score / max) * 100))}%` }} />
                </div>
              </div>
              <div className="text-[30px] font-black leading-none text-[#f5f4e7] md:text-right" style={{ fontFamily: DISPLAY_FONT }}>{formatBenchNumber(total.score)}</div>
            </div>
          )
        }) : <div className="bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">Sem score consolidado.</div>}
      </div>
    </section>
  )
}

function BenchWinReasons({ rows, playerProfiles }: { rows: ObservatoryMatrixRow[]; playerProfiles: ObservatoryPlayerProfile[] }) {
  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="drivers" title="Dimensões que explicam" meta={`${rows.length}`} />
      <div className="grid gap-3 p-4">
        {rows.length > 0 ? rows.map((row, index) => {
          const sorted = [...row.cells].sort((a, b) => b.score - a.score)
          const leader = sorted[0]
          const runner = sorted[1]
          const gap = leader && runner ? leader.score - runner.score : 0
          return (
            <article key={row.id} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                  D{index + 1} · gap {formatBenchNumber(gap)}
                </div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{leader ? displayBenchPlayer(leader.player, playerProfiles) : "—"}</div>
              </div>
              <h3 className="aiox-safe-text mt-2 text-[19px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{row.label}</h3>
              <p className="mt-2 line-clamp-2 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{leader?.notes || leader?.source || "Sem nota estruturada."}</p>
            </article>
          )
        }) : <div className="border border-[#f5f4e7]/10 bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">Sem dimensões ranqueáveis.</div>}
      </div>
    </section>
  )
}

function BenchDecisionHeatmap({
  matrix,
  scoreDimensions,
  playerProfiles,
}: {
  matrix: ObservatoryMatrix | null
  scoreDimensions: ObservatoryScoreDimension[]
  playerProfiles: ObservatoryPlayerProfile[]
}) {
  if (matrix) {
    return (
      <section className="aiox-panel bg-[#0f0f11]">
        <ResearchPanelHead eyebrow="heatmap" title="Mapa de decisão" meta={`${matrix.rows.length} dimensões`} />
        <div className="overflow-x-auto p-4">
          <div className="grid min-w-[920px] border border-[#f5f4e7]/10" style={{ gridTemplateColumns: `220px repeat(${matrix.players.length}, minmax(150px, 1fr))` }}>
            <div className="bg-[#151515] p-3 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>dimensão</div>
            {matrix.players.map((player) => (
              <div key={player} className="border-l border-[#f5f4e7]/10 bg-[#151515] p-3 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
                {displayBenchPlayer(player, playerProfiles)}
              </div>
            ))}
            {matrix.rows.map((row) => {
              const winner = [...row.cells].sort((a, b) => b.score - a.score)[0]
              return (
                <Fragment key={row.id}>
                  <div className="border-t border-[#f5f4e7]/10 bg-[#101010] p-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/32" style={{ fontFamily: MONO_FONT }}>{row.id} · peso {Math.round((row.weight || 0) * 100)}</div>
                    <div className="aiox-safe-text mt-1 text-[15px] font-black text-[#f5f4e7]">{row.label}</div>
                  </div>
                  {matrix.players.map((player) => {
                    const cell = row.cells.find((item) => item.player === player)
                    const score = cell?.score ?? 0
                    const isWinner = cell?.player === winner?.player
                    return (
                      <div key={`${row.id}-${player}`} className={cn("border-l border-t border-[#f5f4e7]/10 p-3", isWinner ? "bg-[#d1ff00] text-[#050505]" : "bg-[#050505] text-[#f5f4e7]")}>
                        <div className="text-[28px] font-black leading-none tracking-[-0.05em]" style={{ fontFamily: DISPLAY_FONT }}>{formatBenchNumber(score)}</div>
                        <div className={cn("mt-2 h-1.5", isWinner ? "bg-[#050505]/18" : "bg-[#f5f4e7]/10")}>
                          <div className={cn("h-full", isWinner ? "bg-[#050505]" : "bg-[#f5f4e7]")} style={{ width: `${Math.max(3, Math.min(100, score))}%` }} />
                        </div>
                        <p className={cn("mt-2 line-clamp-2 text-[12px] leading-[1.35]", isWinner ? "text-[#050505]/70" : "text-[#f5f4e7]/52")}>{cell?.notes || cell?.confidence || "—"}</p>
                      </div>
                    )
                  })}
                </Fragment>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="scorecard" title="Dimensões do score" meta={`${scoreDimensions.length}`} />
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {scoreDimensions.map((dimension, index) => (
          <div key={`${dimension.name}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{dimension.winner || "sem vencedor"}</div>
            <h3 className="aiox-safe-text mt-2 text-[18px] font-black text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{dimension.name}</h3>
            <p className="mt-2 line-clamp-3 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{dimension.evidence}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function displayBenchPlayer(key: string, profiles: ObservatoryPlayerProfile[]) {
  return profiles.find((profile) => profile.key === key || profile.name === key)?.name ?? key
}

function formatBenchNumber(value: number) {
  if (!Number.isFinite(value)) return "—"
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "")
}

function scaleDuelTotal(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.abs(value) > 100 ? value / 100 : value
}

function formatDuelScore(value: number) {
  if (!Number.isFinite(value)) return "0"
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  if (abs >= 100) return `${sign}${String(Math.round(abs)).slice(0, 3)}`
  if (abs >= 10) return `${sign}${abs.toFixed(1).replace(/\.0$/, "")}`
  return `${sign}${abs.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")}`
}

function formatDuelStrongDimensions(rows: Array<{ row: ObservatoryMatrixRow }>) {
  const labels = rows
    .slice(0, 2)
    .map((item) => item.row.label || humanizeResearchLabel(item.row.id))
    .filter(Boolean)
  return labels.length > 0 ? labels.join(" · ") : "—"
}

function formatBenchMoney(low: number, high: number, currency: string) {
  const prefix = currency ? `${currency} ` : ""
  const fmt = (value: number) => Number.isFinite(value) ? value.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—"
  return low === high ? `${prefix}${fmt(low)}` : `${prefix}${fmt(low)}–${fmt(high)}`
}

function mostFrequent(values: string[]) {
  const counts = values.reduce((map, value) => {
    map.set(value, (map.get(value) ?? 0) + 1)
    return map
  }, new Map<string, number>())
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
}

function ReportLoader({ label, dark = true }: { label: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 items-center justify-center border-t border-[var(--rule-soft)]",
        dark && "bg-[var(--aiox-dark,#050505)] text-[var(--aiox-cream-alt,#f5f4e7)]",
      )}
    >
      <div className="grid gap-2 text-center">
        <div
          className={cn(
            "mx-auto h-1.5 w-20 overflow-hidden bg-[var(--ink-faint)]",
            dark && "bg-[rgba(245,244,231,0.10)]",
          )}
        >
          <div className="h-full w-1/2 animate-pulse bg-[var(--lime-ink)]" />
        </div>
        <div
          className={cn(
            "text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]",
            dark && "text-[rgba(245,244,231,0.45)]",
          )}
          style={{ fontFamily: MONO_FONT }}
        >
          Carregando {label}
        </div>
      </div>
    </div>
  )
}

function ResearchMapReport({
  runs,
  documents,
  sources,
  players,
  sourceSummary,
  labels,
}: {
  runs: ObservatoryRunSummary[]
  documents: ObservatoryDocument[]
  sources: ObservatorySource_Entry[]
  players: ObservatoryPlayer[]
  sourceSummary: string[]
  labels: ResearchDashboardLabels
}) {
  const activeRun = runs.find((run) => run.active) ?? runs[0]
  const docMap = new Map(documents.map((doc) => [doc.file, doc]))
  const metrics = asDisplayRecord(parseOptionalArtifact(docMap.get("metrics.yaml")))
  const pipeline = asDisplayRecord(parseOptionalArtifact(docMap.get("pipeline-state.yaml")))
  const actionPlan = asDisplayRecord(parseOptionalArtifact(docMap.get("action-plan.yaml")))
  const graph = asDisplayRecord(parseOptionalArtifact(docMap.get("research-graph.json")))
  const researchContract = asDisplayRecord(parseOptionalArtifact(docMap.get("research-contract.json")))
  const dashboardManifest = asDisplayRecord(parseOptionalArtifact(docMap.get("dashboard-manifest.yaml")))
  const matrices = asDisplayRecord(parseOptionalArtifact(docMap.get("matrices.yaml")))
  const curiosity = asDisplayRecord(parseOptionalArtifact(docMap.get("curiosity_queue.yaml")))
  const uxPatterns = asDisplayRecord(parseOptionalArtifact(docMap.get("ux-patterns.yaml")))
  const events = parseJsonl(docMap.get("execution-log.jsonl")?.content ?? "")

  const breakdown = asDisplayRecord(recordValue(metrics, "coverage_breakdown"))
  const phaseRows = researchPhaseRows(recordValue(pipeline, "phases"))
  const questions = mergeResearchQuestions(curiosity)
  const matrixItems = arrayValue(matrices, "matrices").map((item) => asDisplayRecord(item))
  const patterns = arrayValue(uxPatterns, "patterns").map((item) => asDisplayRecord(item))
  const graphNodes = arrayValue(graph, "nodes").map((item) => asDisplayRecord(item))
  const graphEdges = researchGraphEdges(graph)
  const manifestTabs = asDisplayRecord(recordValue(dashboardManifest, "tabs"))
  const qualityBars = asDisplayRecord(recordValue(dashboardManifest, "quality_bars"))
  const contractDecision = asDisplayRecord(recordValue(researchContract, "decision_context"))
  const contractTaxonomy = asDisplayRecord(recordValue(researchContract, "taxonomy"))
  const contractRubric = asDisplayRecord(recordValue(researchContract, "rubric_model"))
  const contractEvidence = asDisplayRecord(recordValue(researchContract, "evidence_model"))
  const contractCategories = arrayValue(contractTaxonomy, "categories")
  const contractCriteria = arrayValue(contractRubric, "dimensions_or_criteria")
  const contractEvidenceItems = arrayValue(contractEvidence, "primary_evidence")
  const highPriorityQuestions = questions.filter((q) => stringValue(q, "priority", "").toUpperCase() === "HIGH")
  const highCredibilitySources = sources.filter((source) => source.credibility === "HIGH")
  const coverage = numberValue(metrics, "coverage_score") ?? coverageNumeric(activeRun?.coverage) ?? 0
  const integrity = numberValue(metrics, "integrity_score") ?? coverageNumeric(activeRun?.integrity) ?? 0
  const decision = researchDecisionTitle(actionPlan, metrics, activeRun?.status ?? "—")
  const stopReason = researchDecisionSummary(actionPlan, metrics)

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <section className="aiox-report-hero">
          <div className="aiox-report-hero__main">
            <p className="aiox-report-eyebrow">
              Mapa da pesquisa
            </p>
            <h2 className="aiox-report-title aiox-safe-text">
              {activeRun?.displayTitle ?? "Pesquisa"}
            </h2>
            <p className="aiox-report-copy">
              Painel visual da pesquisa selecionada: score, fases, evidências, perguntas abertas e artefatos que sustentam a decisão.
            </p>
            {Object.keys(researchContract).length > 0 && (
              <div className="mt-5 grid gap-px bg-[var(--report-rule-soft)] sm:grid-cols-3">
                <ResearchDarkMetric label="Tipo" value={humanizeResearchLabel(stringValue(researchContract, "research_kind", "custom research"))} />
                <ResearchDarkMetric label="Método" value={humanizeResearchLabel(stringValue(contractRubric, "method_family", "custom"))} />
                <ResearchDarkMetric label="Modo" value={humanizeResearchLabel(stringValue(contractDecision, "decision_mode", "custom"))} />
              </div>
            )}
            <div className="mt-6 grid gap-px bg-[var(--report-rule-soft)] sm:grid-cols-4">
              <ResearchDarkMetric label="Cobertura" value={String(coverage || activeRun?.coverage || "—")} />
              <ResearchDarkMetric label="Integridade" value={String(integrity || activeRun?.integrity || "—")} />
              <ResearchDarkMetric label="Fontes" value={String(sources.length || activeRun?.sources || "—")} />
              <ResearchDarkMetric label="Waves" value={String(activeRun?.waves ?? "—")} />
            </div>
          </div>
          <aside className="aiox-report-hero__aside">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] opacity-65" style={{ fontFamily: MONO_FONT }}>
                decisão
              </p>
              <div className="aiox-safe-text mt-2 text-[42px] font-black leading-none tracking-[-0.055em]" style={{ fontFamily: DISPLAY_FONT }}>
                {decision}
              </div>
              <p className="mt-4 text-[15px] font-black leading-[1.46]">{stopReason}</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-black/18">
              <ResearchLightMetric label="Artefatos" value={String(documents.length)} />
              <ResearchLightMetric label={labels.matrices} value={String(matrixItems.length)} />
              <ResearchLightMetric label="Questões P1" value={String(highPriorityQuestions.length)} />
              <ResearchLightMetric label={labels.players} value={String(players.length)} />
            </div>
          </aside>
        </section>

        <div className="mt-6 grid gap-8">
          <ResearchStorySection
            step="01"
            title="Como a pesquisa chegou até aqui"
            copy="Primeiro leia o caminho de execução: fases concluídas, eventos relevantes e cobertura alcançada. Isso responde se a pesquisa tem base suficiente para confiar no veredito."
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
              <section className="aiox-panel bg-[#0f0f11]">
            <ResearchPanelHead eyebrow="pipeline" title="Fases e execução" meta={`${phaseRows.length} fases · ${events.length} eventos`} />
            <div className="grid gap-px bg-[#f5f4e7]/10 md:grid-cols-2">
              {phaseRows.map((phase, index) => (
                <div key={phase.id} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 bg-[#050505] p-4">
                  <span className="text-[24px] font-black leading-none text-[#f5f4e7]/25" style={{ fontFamily: DISPLAY_FONT }}>{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <div className="aiox-safe-text text-[15px] font-black text-[#f5f4e7]">{phase.label}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{phase.id}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{phase.status}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {events.slice(0, 8).map((event, index) => (
                <div key={`${stringValue(event, "ts", String(index))}-${index}`} className="grid gap-3 border border-[#f5f4e7]/10 bg-[#050505] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/45" style={{ fontFamily: MONO_FONT }}>{stringValue(event, "ts", "—").replace("T", " ").replace("Z", "")}</div>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{researchEventStatus(event)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="aiox-safe-text text-[14px] font-black text-[#f5f4e7]">{humanizeResearchLabel(stringValue(event, "phase", "evento"))}</div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] text-[#f5f4e7]/58">{researchEventSummary(event)}</p>
                  </div>
                </div>
              ))}
            </div>
              </section>

              <section className="aiox-panel bg-[#0f0f11]">
            <ResearchPanelHead eyebrow="coverage" title="Breakdown" meta={`${coverage}/100`} />
            <ResearchRadarPanel
              score={coverage}
              items={Object.entries(breakdown).map(([key, value]) => ({
                label: humanizeResearchLabel(key),
                value: normalizeResearchScore(value),
              }))}
            />
              </section>
            </div>
          </ResearchStorySection>

          {(Object.keys(manifestTabs).length > 0 || Object.keys(qualityBars).length > 0) && (
            <ResearchStorySection
              step="02"
              title="Readiness do dashboard"
              copy="O manifesto mostra se cada aba tem artefatos suficientes e transforma score em completude visual auditável."
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                {Object.keys(manifestTabs).length > 0 && (
                  <section className="aiox-panel bg-[#0f0f11]">
                    <ResearchPanelHead eyebrow="manifest" title="Status por aba" meta={`${Object.keys(manifestTabs).length} abas`} />
                    <div className="grid gap-px bg-[#f5f4e7]/10 p-px md:grid-cols-2">
                      {Object.entries(manifestTabs).map(([tab, raw]) => {
                        const item = asDisplayRecord(raw)
                        return (
                          <article key={tab} className="bg-[#050505] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                                {humanizeResearchLabel(tab)}
                              </span>
                              <span className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                                {stringValue(item, "status", "status n/a")}
                              </span>
                            </div>
                            <p className="mt-3 text-[14px] font-black leading-[1.35] text-[#f5f4e7]">
                              {stringValue(item, "expected_value", "Sem valor esperado declarado.")}
                            </p>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )}

                {Object.keys(qualityBars).length > 0 && (
                  <section className="aiox-panel bg-[#0f0f11]">
                    <ResearchPanelHead eyebrow="quality bars" title="Score visual" meta="manifest" />
                    <div className="grid gap-3 p-4">
                      {Object.entries(qualityBars).map(([label, raw]) => (
                        <ResearchBar key={label} label={humanizeResearchLabel(label)} value={normalizeResearchScore(raw)} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </ResearchStorySection>
          )}

          {Object.keys(researchContract).length > 0 && (
            <ResearchStorySection
              step={Object.keys(manifestTabs).length > 0 || Object.keys(qualityBars).length > 0 ? "03" : "02"}
              title="Contrato da pesquisa"
              copy="Este bloco explica como a pesquisa deve ser lida: tipo, decisão, unidade de análise, critérios e evidências que sustentam o valor do dashboard."
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="aiox-panel bg-[#0f0f11]">
                  <ResearchPanelHead eyebrow="research contract" title={humanizeResearchLabel(stringValue(researchContract, "research_kind", "custom research"))} meta={stringValue(contractRubric, "method_family", "custom")} />
                  <div className="grid gap-px bg-[#f5f4e7]/10 md:grid-cols-2">
                    <div className="bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>decisão primária</div>
                      <p className="mt-2 text-[15px] font-black leading-[1.42] text-[#f5f4e7]">{stringValue(contractDecision, "primary_decision", stringValue(researchContract, "objective", "Sem decisão declarada."))}</p>
                    </div>
                    <div className="bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>unidade de análise</div>
                      <p className="mt-2 text-[15px] font-black leading-[1.42] text-[#f5f4e7]">{stringValue(contractTaxonomy, "unit_of_analysis", "Sem unidade declarada.")}</p>
                    </div>
                    <div className="bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>semântica do score</div>
                      <p className="mt-2 text-[13px] leading-[1.5] text-[#f5f4e7]/62">{stringValue(contractRubric, "score_semantics", "Sem semântica declarada.")}</p>
                    </div>
                    <div className="bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>regra de saturação</div>
                      <p className="mt-2 text-[13px] leading-[1.5] text-[#f5f4e7]/62">{stringValue(contractRubric, "pass_or_saturation_rule", "Sem regra declarada.")}</p>
                    </div>
                  </div>
                </section>

                <section className="aiox-panel bg-[#0f0f11]">
                  <ResearchPanelHead eyebrow="taxonomy" title="Critérios e evidências" meta={`${contractCategories.length} categorias`} />
                  <div className="grid gap-4 p-4">
                    <ResearchTokenList label="Categorias" items={contractCategories} empty="Sem categorias declaradas." />
                    <ResearchTokenList label="Critérios" items={contractCriteria} empty="Sem critérios declarados." />
                    <ResearchTokenList label="Evidências" items={contractEvidenceItems} empty="Sem evidências primárias declaradas." />
                  </div>
                </section>
              </div>
            </ResearchStorySection>
          )}

          <ResearchStorySection
            step={Object.keys(researchContract).length > 0 ? (Object.keys(manifestTabs).length > 0 || Object.keys(qualityBars).length > 0 ? "04" : "03") : (Object.keys(manifestTabs).length > 0 || Object.keys(qualityBars).length > 0 ? "03" : "02")}
            title="O que a descoberta revelou"
            copy="Aqui ficam os aprendizados de produto: gaps, padrões e oportunidades que transformam dados brutos em decisão de design ou engenharia."
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="matrices" title={labels.matrices} meta={`${matrixItems.length} quadros`} />
                <ResearchMatrixHeatmap matrices={matrixItems} />
              </section>

              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="patterns" title="Padrões úteis" meta={`${patterns.length}`} />
                <div className="grid gap-3 p-4">
                  {patterns.slice(0, 6).map((pattern, index) => (
                    <div key={stringValue(pattern, "id", stringValue(pattern, "name"))} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 border border-[#f5f4e7]/10 bg-[#050505] p-3">
                      <span className="text-[22px] font-black leading-none text-[#f5f4e7]/20" style={{ fontFamily: DISPLAY_FONT }}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="aiox-safe-text text-[15px] font-black text-[#f5f4e7]">{stringValue(pattern, "name")}</div>
                        <p className="mt-1 line-clamp-3 text-[12.5px] leading-[1.45] text-[#f5f4e7]/58">{stringValue(pattern, "description")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ResearchStorySection>

          <ResearchStorySection
            step={Object.keys(researchContract).length > 0 ? (Object.keys(manifestTabs).length > 0 || Object.keys(qualityBars).length > 0 ? "05" : "04") : (Object.keys(manifestTabs).length > 0 || Object.keys(qualityBars).length > 0 ? "04" : "03")}
            title="O que ainda precisa ser decidido"
            copy="Feche o mapa olhando para perguntas abertas e cobertura de artefatos. Se algo aqui estiver fraco, a próxima ação deve nascer na aba Ações."
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="open questions" title="Dúvidas que movem a próxima wave" meta={`${highPriorityQuestions.length} P1`} />
                <div className="grid gap-3 p-4 md:grid-cols-3">
                  {(highPriorityQuestions.length > 0 ? highPriorityQuestions : questions).slice(0, 6).map((question, index) => (
                    <div key={`${stringValue(question, "id", "q")}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                        {stringValue(question, "id", `Q${index + 1}`)}
                      </div>
                      <h3 className="aiox-safe-text mt-2 text-[18px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                        {stringValue(question, "question", "Pergunta aberta")}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-[13px] leading-[1.5] text-[#f5f4e7]/58">
                        {stringValue(question, "next_action", stringValue(question, "why_it_matters", ""))}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {sourceSummary.length > 0 && (
                <section className="aiox-panel bg-[#0f0f11]">
                  <ResearchPanelHead eyebrow="artifact index" title="Arquivos de suporte" meta={`${sourceSummary.length}`} />
                  <div className="grid gap-2 p-4">
                    {sourceSummary.slice(0, 8).map((item) => (
                      <span key={item} className="border border-[#f5f4e7]/12 bg-[#050505] px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-[#f5f4e7]/50" style={{ fontFamily: MONO_FONT }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </ResearchStorySection>
        </div>
      </article>
    </LightScrollArea>
  )
}

function ResearchEvidenceReport({
  runs,
  documents,
  sources,
  sourceSummary,
}: {
  runs: ObservatoryRunSummary[]
  documents: ObservatoryDocument[]
  sources: ObservatorySource_Entry[]
  sourceSummary: string[]
}) {
  const activeRun = runs.find((run) => run.active) ?? runs[0]
  const docMap = new Map(documents.map((doc) => [doc.file, doc]))
  const metrics = asDisplayRecord(parseOptionalArtifact(docMap.get("metrics.yaml")))
  const graph = asDisplayRecord(parseOptionalArtifact(docMap.get("research-graph.json")))
  const graphNodes = arrayValue(graph, "nodes").map((item) => asDisplayRecord(item))
  const graphEdges = researchGraphEdges(graph)
  const claims = arrayValue(asDisplayRecord(parseOptionalArtifact(docMap.get("claims.yaml"))), "claims").map((item) => asDisplayRecord(item))
  const validationChecks = arrayValue(asDisplayRecord(parseOptionalArtifact(docMap.get("validation-report.yaml"))), "checks").map((item) => asDisplayRecord(item))
  const highCredibilitySources = sources.filter((source) => source.credibility === "HIGH")
  const mediumCredibilitySources = sources.filter((source) => source.credibility === "MEDIUM")
  const lowCredibilitySources = sources.filter((source) => source.credibility === "LOW")
  const sourceMetrics = asDisplayRecord(recordValue(metrics, "sources"))
  const freshness = stringValue(sourceMetrics, "freshness_ratio", activeRun?.extras?.freshness ? String(activeRun.extras.freshness) : "—")
  const topSignals = graphNodes
    .filter((node) => /source|metric|graph|report|recommend|wave/i.test(`${stringValue(node, "type", "")} ${stringValue(node, "id", "")}`))
    .slice(0, 9)

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="evidências"
          title="O que sustenta a conclusão"
          copy="Esta aba separa prova de narrativa: qualidade das fontes, relação entre artefatos e sinais usados para confiar ou questionar a decisão da pesquisa."
          accentValue={String(sources.length)}
          accentLabel="fontes"
          metrics={[
            ["Alta confiança", highCredibilitySources.length],
            ["Nós", graphNodes.length],
            ["Links", graphEdges.length],
          ]}
        />

        <div className="mt-6 grid gap-8">
          <ResearchStorySection
            step="01"
            title="Qualidade da base consultada"
            copy="Antes de olhar conclusões, confira se as fontes têm confiança suficiente e se a pesquisa não depende de evidência fraca."
          >
            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="confiança" title="Distribuição das fontes" meta={`${highCredibilitySources.length}/${sources.length} alta`} />
                <ResearchDonutPanel
                  total={sources.length}
                  segments={[
                    { label: "Alta", value: highCredibilitySources.length, color: "#d1ff00" },
                    { label: "Média", value: mediumCredibilitySources.length, color: "#f5b340" },
                    { label: "Baixa", value: lowCredibilitySources.length, color: "#5c5c5c" },
                  ]}
                />
                <div className="grid gap-px bg-[#f5f4e7]/10 sm:grid-cols-2">
                  <ResearchDarkMetric label="Recência" value={freshness} />
                  <ResearchDarkMetric label="Fontes" value={String(sources.length)} />
                </div>
              </section>

              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="fontes" title="Principais referências" meta={`${sources.length}`} />
                <div className="grid gap-px bg-[#f5f4e7]/10 p-px lg:grid-cols-2">
                  {sources.slice(0, 8).map((source, index) => (
                    <article key={source.id || source.url || String(index)} className="min-w-0 bg-[#050505] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                          {source.credibility || "fonte"} · {source.multiplier || "—"}
                        </div>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="grid h-8 w-8 shrink-0 place-items-center border border-[#f5f4e7]/12 text-[#f5f4e7]/55 transition-colors hover:border-[#d1ff00] hover:text-[#d1ff00]"
                            title="Abrir fonte"
                          >
                            <ExternalLink size={14} strokeWidth={1.8} />
                          </a>
                        )}
                      </div>
                      <h3 className="aiox-safe-text mt-3 text-[18px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                        {source.title || source.id || "Fonte sem título"}
                      </h3>
                      {source.flags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {source.flags.slice(0, 4).map((flag) => (
                            <span key={flag} className="border border-[#f5f4e7]/10 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[#f5f4e7]/44" style={{ fontFamily: MONO_FONT }}>
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </ResearchStorySection>

          <ResearchStorySection
            step="02"
            title="Como os artefatos se conectam"
            copy="O grafo mostra a trilha de evidência: de query e waves até relatório, métricas, fontes e decisões derivadas."
          >
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="grafo" title="Mapa de sinais" meta={`${graphNodes.length} nós · ${graphEdges.length} links`} />
              <div className="border-b border-[#f5f4e7]/10 p-4">
                <ResearchArtifactDag nodes={graphNodes} edges={graphEdges} />
              </div>
              <div className="grid gap-px bg-[#f5f4e7]/10 p-px md:grid-cols-2 xl:grid-cols-3">
                {(topSignals.length > 0 ? topSignals : graphNodes).slice(0, 9).map((node, index) => (
                  <article key={`${stringValue(node, "id", "node")}-${index}`} className="min-w-0 bg-[#050505] p-4">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                      {stringValue(node, "type", `sinal ${index + 1}`)}
                    </div>
                    <h3 className="aiox-safe-text mt-2 text-[18px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                      {stringValue(node, "label", stringValue(node, "id", "Sinal"))}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-[13px] leading-[1.5] text-[#f5f4e7]/58">
                      {shortPreview(recordValue(node, "summary") ?? recordValue(node, "description") ?? recordValue(node, "evidence"), 180)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </ResearchStorySection>

          {(claims.length > 0 || validationChecks.length > 0) && (
            <ResearchStorySection
              step="03"
              title="Claims e validação"
              copy="Claims transformam conclusões em unidades verificáveis. Checks mostram o que foi validado mecanicamente antes da decisão."
            >
              <div className="grid gap-5 xl:grid-cols-2">
                {claims.length > 0 && (
                  <section className="aiox-panel bg-[#0f0f11]">
                    <ResearchPanelHead eyebrow="claims" title="Claims verificáveis" meta={`${claims.length}`} />
                    <div className="grid gap-3 p-4">
                      {claims.slice(0, 8).map((claim, index) => (
                        <article key={stableRecordKey(claim, index, ["id", "claim"])} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                              {stringValue(claim, "id", `CL-${index + 1}`)}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                              {stringValue(claim, "confidence", "confidence n/a")}
                            </span>
                          </div>
                          <p className="mt-3 text-[16px] font-black leading-[1.35] text-[#f5f4e7]">
                            {stringValue(claim, "claim", "Claim sem texto.")}
                          </p>
                          <p className="mt-3 text-[13px] leading-[1.5] text-[#f5f4e7]/58">
                            {stringValue(claim, "implication", "Sem implicação estruturada.")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {validationChecks.length > 0 && (
                  <section className="aiox-panel bg-[#0f0f11]">
                    <ResearchPanelHead eyebrow="validation" title="Checks estruturais" meta={`${validationChecks.length}`} />
                    <div className="grid gap-3 p-4">
                      {validationChecks.slice(0, 8).map((check, index) => (
                        <article key={stableRecordKey(check, index, ["id", "check", "name"])} className="grid gap-3 border border-[#f5f4e7]/10 bg-[#050505] p-4 sm:grid-cols-[110px_minmax(0,1fr)]">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                            {stringValue(check, "status", "status n/a")}
                          </div>
                          <div className="min-w-0">
                            <div className="aiox-safe-text text-[16px] font-black leading-tight text-[#f5f4e7]">
                              {stringValue(check, "id", stringValue(check, "name", `Check ${index + 1}`))}
                            </div>
                            <p className="mt-1 text-[13px] leading-[1.45] text-[#f5f4e7]/58">
                              {stringValue(check, "message", stringValue(check, "summary", "Sem mensagem estruturada."))}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </ResearchStorySection>
          )}

          {sourceSummary.length > 0 && (
            <ResearchStorySection
              step={claims.length > 0 || validationChecks.length > 0 ? "04" : "03"}
              title="Quais arquivos materializam a prova"
              copy="Use este bloco para checar rapidamente se os artefatos que deveriam existir estão presentes no run."
            >
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="artefatos" title="Estado dos arquivos" meta={`${sourceSummary.length}`} />
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sourceSummary.map((item) => (
                    <span key={item} className="border border-[#f5f4e7]/12 bg-[#050505] px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-[#f5f4e7]/50" style={{ fontFamily: MONO_FONT }}>
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            </ResearchStorySection>
          )}
        </div>
      </article>
    </LightScrollArea>
  )
}

function ResearchCuriosityReport({ documents }: { documents: ObservatoryDocument[] }) {
  const docMap = new Map(documents.map((doc) => [doc.file, doc]))
  const curiosity = asDisplayRecord(parseOptionalArtifact(docMap.get("curiosity_queue.yaml")))
  const questions = arrayValue(curiosity, "questions").map((item) => asDisplayRecord(item))
  const high = questions.filter((q) => stringValue(q, "priority", "").toUpperCase() === "HIGH")
  const medium = questions.filter((q) => stringValue(q, "priority", "").toUpperCase() === "MEDIUM")
  const low = questions.filter((q) => stringValue(q, "priority", "").toUpperCase() === "LOW")
  const groups = [
    { key: "HIGH", label: "Alta prioridade", items: high, color: "#d1ff00" },
    { key: "MEDIUM", label: "Boa aposta", items: medium, color: "#f5b340" },
    { key: "LOW", label: "Explorar depois", items: low, color: "#f5f4e7" },
  ]
  const orderedQuestions = [...high, ...medium, ...low]

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="curiosity backlog"
          title="Perguntas que ainda podem mudar a decisão"
          copy="Hipóteses, dúvidas e próximos testes em uma fila de investigação. Aqui o foco é decidir o que vale virar próxima wave."
          accentValue={String(questions.length)}
          accentLabel="perguntas abertas"
          metrics={[
            ["Alta", high.length],
            ["Média", medium.length],
            ["Baixa", low.length],
          ]}
        />

        <div className="mt-5 grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="aiox-panel bg-[#0f0f11]">
            <ResearchPanelHead eyebrow="priority" title="Fila" meta={`${questions.length}`} />
            <div className="grid gap-px bg-[#f5f4e7]/10">
              {groups.map((group) => (
                <div key={group.key} className="bg-[#050505] p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
                      {group.label}
                    </div>
                    <div className="text-[32px] font-black leading-none tracking-[-0.055em]" style={{ fontFamily: DISPLAY_FONT, color: group.color }}>
                      {group.items.length}
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 bg-[#f5f4e7]/10">
                    <div
                      className="h-full"
                      style={{
                        width: `${questions.length ? Math.max(8, Math.round((group.items.length / questions.length) * 100)) : 0}%`,
                        background: group.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="aiox-panel bg-[#0f0f11]">
            <ResearchPanelHead eyebrow="questions" title="Backlog de investigação" meta={`${orderedQuestions.length} itens`} />
            <div className="grid gap-3 p-4 xl:grid-cols-2">
              {orderedQuestions.length === 0 && (
                <div className="border border-[#f5f4e7]/10 bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/50">
                  Nenhuma pergunta estruturada neste run.
                </div>
              )}
              {orderedQuestions.map((question, index) => {
                const priority = stringValue(question, "priority", "LOW").toUpperCase()
                const group = groups.find((item) => item.key === priority) ?? groups[2]
                return (
                  <article key={`${stringValue(question, "id", "q")}-${index}`} className="grid gap-4 border border-[#f5f4e7]/10 bg-[#050505] p-4 md:grid-cols-[110px_minmax(0,1fr)]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO_FONT, color: group.color }}>
                        {stringValue(question, "id", `Q${index + 1}`)}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38 md:hidden" style={{ fontFamily: MONO_FONT }}>
                        {group.label}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="hidden text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38 md:block" style={{ fontFamily: MONO_FONT }}>
                        {group.label} · {stringValue(question, "category", "investigação")}
                      </div>
                      <h3 className="aiox-safe-text mt-1 text-[20px] font-black leading-[1.05] tracking-[-0.035em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                        {stringValue(question, "question")}
                      </h3>
                      <p className="mt-3 text-[14px] leading-[1.55] text-[#f5f4e7]/62">
                        {stringValue(question, "why_it_matters", "Sem justificativa estruturada.")}
                      </p>
                      <div className="mt-4 border-t border-[#f5f4e7]/10 pt-3">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>
                          próximo movimento
                        </div>
                        <p className="mt-1 text-[13px] leading-[1.45] text-[#f5f4e7]/72">
                          {stringValue(question, "next_action", "Definir teste ou fonte para a próxima wave.")}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </article>
    </LightScrollArea>
  )
}

function ResearchRecommendationsReport({ documents, labels }: { documents: ObservatoryDocument[]; labels: ResearchDashboardLabels }) {
  const docMap = new Map(documents.map((doc) => [doc.file, doc]))
  const recommendationsDoc =
    documents.find((doc) => doc.phase === "recommend" && /recommend/i.test(doc.file)) ??
    docMap.get("03-recommendations.md")
  const quickWinsDoc = docMap.get("quick-wins.md")
  const actionPlan = asDisplayRecord(parseOptionalArtifact(docMap.get("action-plan.yaml")))
  const riskRegister = asDisplayRecord(parseOptionalArtifact(docMap.get("risk-register.yaml")))
  const decisionLedger = asDisplayRecord(parseOptionalArtifact(docMap.get("decision-ledger.yaml")))
  const followupDocs = documents.filter((doc) => /followup|follow-up|deepening|decision/i.test(doc.file))
  const curiosity = asDisplayRecord(parseOptionalArtifact(docMap.get("curiosity_queue.yaml")))
  const questions = arrayValue(curiosity, "questions").map((item) => asDisplayRecord(item))
  const highQuestions = questions.filter((q) => stringValue(q, "priority", "").toUpperCase() === "HIGH")
  const actionDecision = asDisplayRecord(recordValue(actionPlan, "decision"))
  const actionRows = arrayValue(actionPlan, "actions").map((item) => asDisplayRecord(item))
  const roadmapRows = arrayValue(actionPlan, "roadmap").map((item) => asDisplayRecord(item))
  const riskRows = arrayValue(riskRegister, "risks").map((item) => asDisplayRecord(item))
  const decisionRows = arrayValue(decisionLedger, "decisions").map((item) => asDisplayRecord(item))

  const recommendationText = recommendationsDoc?.content ?? ""
  const decision = extractMarkdownSection(recommendationText, ["Decisão Recomendada", "Decisão", "Veredito"])
  const nextSteps = extractMarkdownSection(recommendationText, ["Próximos Passos", "Next Steps"])
  const decisionSummary = stringValue(actionDecision, "summary", sentenceSummary(decision, 170))
  const decisionTitle = stringValue(actionDecision, "title", decisionSummary)
  const nextStepItems = actionRows.length > 0
    ? actionRows.map((action) => stringValue(action, "title", "")).filter(Boolean)
    : extractMarkdownListItems(recommendationText, ["Próximos Passos", "Next Steps"])
  const fallbackNextStepItems = splitOperationalChecklist(nextSteps)
  const antiPatterns = riskRows.length > 0
    ? riskRows.map((risk) => [
        stringValue(risk, "risk", stringValue(risk, "title", "Risco")),
        stringValue(risk, "severity", "—"),
        stringValue(risk, "mitigation", stringValue(risk, "trigger", "")),
      ])
    : extractMarkdownTable(recommendationText, ["Anti-Patterns", "O que NÃO fazer"]).slice(0, 6)
  const roadmap = roadmapRows.length > 0
    ? roadmapRows.map((item) => [
        stringValue(item, "phase", stringValue(item, "horizon", "Fase")),
        stringValue(item, "title", "Marco"),
        stringValue(item, "outcome", stringValue(item, "priority", "")),
        stringValue(item, "effort", ""),
        stringValue(item, "status", ""),
      ])
    : extractMarkdownTable(recommendationText, ["Implementation Roadmap", "Roadmap"]).slice(0, 7)
  const mapping = extractMarkdownTable(recommendationText, ["Mapping para o Projeto"]).slice(0, 6)
  const quickWins = actionRows.length > 0
    ? actionRows.map((action) => [
        stringValue(action, "id", "Ação"),
        stringValue(action, "title", "Ação"),
        stringValue(action, "priority", "—"),
        stringValue(action, "owner_hint", stringValue(action, "owner", "")),
        stringValue(action, "status", ""),
        stringValue(action, "rationale", stringValue(action, "evidence", "")),
      ]).slice(0, 6)
    : extractMarkdownTable(quickWinsDoc?.content ?? recommendationText, ["Quick Wins", "Resumo"]).slice(0, 6)
  const followupCards = followupDocs.slice(0, 5).map((doc) => ({
    file: doc.file,
    title: markdownTitle(doc.content) || humanizeResearchLabel(doc.file.replace(/\.[^.]+$/, "")),
    summary: markdownSummary(doc.content),
  }))

  const totalActions = (actionRows.length || roadmap.length + quickWins.length) + highQuestions.length

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="action plan"
          title={labels.actions}
          copy="Transforma os documentos de recomendação, quick wins, follow-ups e dúvidas abertas em uma visão operacional para decidir o que fazer agora."
          accentValue={String(totalActions)}
          accentLabel={`${labels.actions.toLowerCase()} detectadas`}
          metrics={[
            ["Roadmap", roadmap.length],
            [`${labels.actions} YAML`, actionRows.length],
            ["P1 abertas", highQuestions.length],
          ]}
        />

        <div className="mt-6 grid gap-8">
          <ResearchStorySection
            step="01"
            title="Decisão antes de tarefa"
            copy="Comece pelo veredito e pelo próximo movimento. Essa seção deve responder se a pesquisa pede construir, aprofundar ou pausar."
          >
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="decision" title="Decisão recomendada" meta={actionRows.length > 0 ? "action-plan.yaml" : recommendationsDoc?.file ?? "recomendações"} />
              <div className="grid gap-px bg-[#f5f4e7]/10 lg:grid-cols-[minmax(0,1fr)_420px]">
                <div className="bg-[#050505] p-5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                    resumo
                  </div>
                  {decisionTitle && decisionTitle !== decisionSummary && (
                    <div className="aiox-safe-text mt-3 text-[18px] font-black leading-tight text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>
                      {decisionTitle}
                    </div>
                  )}
                  <p className="aiox-safe-text mt-3 max-w-[900px] text-[28px] font-black leading-[1.08] tracking-[-0.045em] text-[#f5f4e7] sm:text-[36px]" style={{ fontFamily: DISPLAY_FONT }}>
                    {decisionSummary || "Sem decisão recomendada estruturada neste run."}
                  </p>
                  {decision && decision !== decisionSummary && (
                    <p className="mt-5 max-w-[980px] text-[15px] leading-[1.6] text-[#f5f4e7]/58">
                      {sentenceSummary(decision.replace(decisionSummary, ""), 260)}
                    </p>
                  )}
                </div>
                <div className="bg-[#d1ff00] p-5 text-[#050505]">
                  <div className="text-[10px] uppercase tracking-[0.14em] opacity-65" style={{ fontFamily: MONO_FONT }}>
                    checklist
                  </div>
                  <div className="mt-3 grid gap-3">
                    {(nextStepItems.length > 0 ? nextStepItems : fallbackNextStepItems).slice(0, 5).map((item, index) => (
                      <div key={`${item}-${index}`} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
                        <span className="mt-0.5 grid h-4 w-4 place-items-center border border-[#050505]/45 text-[10px] font-black" style={{ fontFamily: MONO_FONT }}>
                          {index + 1}
                        </span>
                        <p className="text-[14px] font-black leading-[1.38]">{item}</p>
                      </div>
                    ))}
                    {nextStepItems.length === 0 && fallbackNextStepItems.length === 0 && (
                      <p className="text-[14px] font-black leading-[1.38]">Converter achados em ação priorizada.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </ResearchStorySection>

          {quickWins.length > 0 && (
            <ResearchStorySection
              step="02"
              title="O que executar primeiro"
              copy="Quick wins ficam separados do roadmap para evitar misturar oportunidade rápida com plano de implementação maior."
            >
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="roi-first" title="Ações rápidas" meta={`${quickWins.length}`} />
                <div className="grid gap-3 p-4 lg:grid-cols-2">
                  {quickWins.map((row, index) => (
                    <ResearchActionCard
                      key={`${row[0]}-${index}`}
                      index={index + 1}
                      title={row[1] ?? row[0] ?? `Ação ${index + 1}`}
                      meta={[row[2], row[3], row[4]].filter(Boolean).join(" · ")}
                      body={row.at(-1) ?? ""}
                      accent={index === 0}
                    />
                  ))}
                </div>
              </section>
            </ResearchStorySection>
          )}

          {roadmap.length > 0 && (
            <ResearchStorySection
              step="03"
              title="Como avançar sem perder contexto"
              copy="O roadmap vira uma sequência legível, não uma tabela solta. Cada linha precisa mostrar intenção, justificativa e esforço/status."
            >
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="roadmap" title="Sequência de execução" meta={`${roadmap.length} fases`} />
                <div className="grid gap-px bg-[#f5f4e7]/10">
                  {roadmap.map((row, index) => (
                    <div key={`${row[0]}-${index}`} className="grid gap-3 bg-[#050505] p-4 md:grid-cols-[58px_minmax(0,1fr)_160px]">
                      <div className="text-[34px] font-black leading-none text-[#f5f4e7]/22" style={{ fontFamily: DISPLAY_FONT }}>
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="min-w-0">
                        <div className="aiox-safe-text text-[18px] font-black leading-tight text-[#f5f4e7]">{row[1] ?? row[0]}</div>
                        <p className="mt-1 line-clamp-2 text-[13.5px] leading-[1.45] text-[#f5f4e7]/62">{row[2] ?? row[3] ?? ""}</p>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00] md:text-right" style={{ fontFamily: MONO_FONT }}>
                        {[row[3], row[4]].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </ResearchStorySection>
          )}

          {(mapping.length > 0 || highQuestions.length > 0 || antiPatterns.length > 0 || decisionRows.length > 0) && (
            <ResearchStorySection
              step="04"
              title="Impacto, riscos e decisões"
              copy="Antes de transformar a pesquisa em backlog, veja o que muda no produto, quais decisões sustentam o plano, quais perguntas ainda seguram a decisão e quais riscos precisam de mitigação."
            >
              <div className="grid gap-5 xl:grid-cols-4">
                {mapping.length > 0 && (
                  <section className="aiox-panel bg-[#0f0f11]">
                    <ResearchPanelHead eyebrow="produto" title="Mudanças" meta={`${mapping.length}`} />
                    <div className="grid gap-3 p-4">
                      {mapping.slice(0, 5).map((row, index) => (
                        <div key={`${row[0]}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                            {row[0] ?? `item ${index + 1}`}
                          </div>
                          <p className="mt-2 text-[14px] font-black leading-[1.35] text-[#f5f4e7]">{row[2] ?? row[1]}</p>
                          <p className="mt-2 line-clamp-3 text-[12.5px] leading-[1.45] text-[#f5f4e7]/58">{row[3] ?? row.at(-1)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {decisionRows.length > 0 && (
                  <section className="aiox-panel bg-[#0f0f11]">
                    <ResearchPanelHead eyebrow="ledger" title="Decisões" meta={`${decisionRows.length}`} />
                    <div className="grid gap-3 p-4">
                      {decisionRows.slice(0, 5).map((decision, index) => (
                        <div key={stableRecordKey(decision, index, ["id", "decision"])} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                              {stringValue(decision, "id", `DEC-${index + 1}`)}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
                              {stringValue(decision, "status", "status n/a")}
                            </span>
                          </div>
                          <p className="mt-2 text-[14px] font-black leading-[1.35] text-[#f5f4e7]">
                            {stringValue(decision, "decision", "Decisão sem texto.")}
                          </p>
                          <p className="mt-2 line-clamp-3 text-[12.5px] leading-[1.45] text-[#f5f4e7]/58">
                            {stringValue(decision, "consequence", "Sem consequência estruturada.")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {highQuestions.length > 0 && (
                  <section className="aiox-panel bg-[#0f0f11]">
                    <ResearchPanelHead eyebrow="risco" title="Perguntas P1" meta={`${highQuestions.length}`} />
                    <div className="grid gap-3 p-4">
                      {highQuestions.slice(0, 5).map((question, index) => (
                        <ResearchActionCard
                          key={`${stringValue(question, "id", "q")}-${index}`}
                          index={index + 1}
                          title={stringValue(question, "question")}
                          meta={stringValue(question, "category", "investigação")}
                          body={stringValue(question, "next_action", stringValue(question, "why_it_matters", ""))}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {antiPatterns.length > 0 && (
                  <section className="aiox-panel bg-[#0f0f11]">
                    <ResearchPanelHead eyebrow={riskRows.length > 0 ? "risks" : "evitar"} title={riskRows.length > 0 ? "Riscos" : "Fora de escopo"} meta={`${antiPatterns.length}`} />
                    <div className="grid gap-2 p-4">
                      {antiPatterns.map((row, index) => (
                        <div key={`${row[0]}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-3">
                          <div className="aiox-safe-text text-[15px] font-black text-[#f5f4e7]">{row[0] ?? `Anti-pattern ${index + 1}`}</div>
                          <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] text-[#f5f4e7]/58">{[row[1], row[2]].filter(Boolean).join(" · ")}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </ResearchStorySection>
          )}

          {followupCards.length > 0 && (
            <ResearchStorySection
              step="05"
              title="Aprofundamentos disponíveis"
              copy="Follow-ups ficam no fim porque são material de suporte. Eles servem para explicar a evolução da decisão, não para competir com o plano principal."
            >
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="follow-up" title="Aprofundamentos relacionados" meta={`${followupCards.length}`} />
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  {followupCards.map((doc) => (
                    <div key={doc.file} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{doc.file}</div>
                      <div className="aiox-safe-text mt-2 text-[18px] font-black leading-tight text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                        {doc.title}
                      </div>
                      <p className="mt-2 line-clamp-3 text-[13px] leading-[1.5] text-[#f5f4e7]/58">{doc.summary}</p>
                    </div>
                  ))}
                </div>
              </section>
            </ResearchStorySection>
          )}
        </div>
      </article>
    </LightScrollArea>
  )
}

function ResearchActionCard({
  index,
  title,
  meta,
  body,
  accent = false,
}: {
  index: number
  title: string
  meta?: string
  body?: string
  accent?: boolean
}) {
  return (
    <article className={cn("border p-4", accent ? "border-[#d1ff00] bg-[#d1ff00] text-[#050505]" : "border-[#f5f4e7]/10 bg-[#050505] text-[#f5f4e7]")}>
      <div className="flex items-start justify-between gap-4">
        <span className={cn("text-[10px] uppercase tracking-[0.12em]", accent ? "text-[#050505]/55" : "text-[#d1ff00]")} style={{ fontFamily: MONO_FONT }}>
          {String(index).padStart(2, "0")}
        </span>
        {meta && (
          <span className={cn("max-w-[45%] truncate text-right text-[10px] uppercase tracking-[0.12em]", accent ? "text-[#050505]/55" : "text-[#f5f4e7]/38")} style={{ fontFamily: MONO_FONT }}>
            {meta}
          </span>
        )}
      </div>
      <h3 className="aiox-safe-text mt-3 text-[20px] font-black leading-[1.06] tracking-[-0.035em]" style={{ fontFamily: DISPLAY_FONT }}>
        {title}
      </h3>
      {body && <p className={cn("mt-3 line-clamp-3 text-[13px] leading-[1.5]", accent ? "text-[#050505]/72" : "text-[#f5f4e7]/62")}>{body}</p>}
    </article>
  )
}

function ResearchWavesReport({ runs, documents }: { runs: ObservatoryRunSummary[]; documents: ObservatoryDocument[] }) {
  const activeRun = runs.find((run) => run.active) ?? runs[0]
  const waveDocs = documents.filter((doc) => doc.phase === "wave" || /wave/i.test(doc.file))
  const events = parseJsonl(documents.find((doc) => doc.file === "execution-log.jsonl")?.content ?? "")
  const waveEvents = events.filter((event) => /wave|follow|deep|aprofund/i.test(`${stringValue(event, "phase", "")} ${stringValue(event, "action", "")} ${stringValue(event, "notes", "")}`))
  const timeline = waveDocs.map((doc, index) => ({
    index,
    file: doc.file,
    title: markdownTitle(doc.content) || humanizeResearchLabel(doc.file.replace(/\.[^.]+$/, "")),
    summary: markdownSummary(doc.content),
    bytes: doc.bytes,
  }))

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="deepening waves"
          title="Como a pesquisa evoluiu"
          copy="Linha do tempo das ondas de aprofundamento e sinais do log de execução. Use para entender o que já foi refinado e onde ainda falta nova rodada."
          accentValue={String(activeRun?.waves ?? waveDocs.length)}
          accentLabel="waves detectadas"
          metrics={[
            ["Docs", waveDocs.length],
            ["Eventos", waveEvents.length || events.length],
          ]}
        />

        <div className="mt-5">
          <ResearchWaveFlow timeline={timeline} events={waveEvents.length > 0 ? waveEvents : events} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="aiox-panel bg-[#0f0f11]">
            <ResearchPanelHead eyebrow="timeline" title="Ondas de aprofundamento" meta={`${timeline.length} documentos`} />
            <div className="relative grid gap-4 p-5">
              <div className="absolute bottom-5 left-[34px] top-5 w-px bg-[#f5f4e7]/12" />
              {timeline.length === 0 && (
                <div className="border border-[#f5f4e7]/10 bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/55">
                  Nenhum documento de wave foi encontrado neste run.
                </div>
              )}
              {timeline.map((wave) => (
                <article key={wave.file} className="relative grid gap-3 pl-12">
                  <div className="absolute left-[21px] top-1.5 h-7 w-7 border border-[#d1ff00] bg-[#050505] text-center text-[11px] font-black leading-7 text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                    {String(wave.index + 1).padStart(2, "0")}
                  </div>
                  <div className="border border-[#f5f4e7]/10 bg-[#050505] p-5">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>{wave.file}</div>
                    <h3 className="aiox-safe-text mt-2 text-[28px] font-black leading-[1.02] tracking-[-0.04em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                      {wave.title}
                    </h3>
                    <p className="mt-3 max-w-[900px] text-[15px] leading-[1.58] text-[#f5f4e7]/66">{wave.summary}</p>
                    <div className="mt-4 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>
                      {formatBytes(wave.bytes)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="aiox-panel bg-[#0f0f11]">
            <ResearchPanelHead eyebrow="execution log" title="Sinais de execução" meta={`${waveEvents.length || events.length} eventos`} />
            <div className="grid gap-3 p-4">
              {(waveEvents.length > 0 ? waveEvents : events).slice(0, 12).map((event, index) => (
                <div key={`${stringValue(event, "ts", String(index))}-${index}`} className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                    {stringValue(event, "phase", `evento ${index + 1}`)}
                  </div>
                  <p className="mt-2 text-[14px] leading-[1.48] text-[#f5f4e7]/70">
                    {stringValue(event, "notes", stringValue(event, "action", "Evento registrado."))}
                  </p>
                  <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>
                    {stringValue(event, "ts", "sem timestamp")} · {stringValue(event, "status", "—")}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </article>
    </LightScrollArea>
  )
}

function parseOptionalArtifact(doc?: ObservatoryDocument): unknown {
  if (!doc) return {}
  if (/\.jsonl$/i.test(doc.file)) return parseJsonl(doc.content)
  return parseStructured(doc.file, doc.content) ?? {}
}

type ResearchDashboardLabels = {
  players: string
  matrices: string
  actions: string
  rubric: string
}

const DEFAULT_RESEARCH_LABELS: ResearchDashboardLabels = {
  players: "Players",
  matrices: "Matrizes",
  actions: "Ações",
  rubric: "Rubrica",
}

function researchDashboardLabels(documents: ObservatoryDocument[]): ResearchDashboardLabels {
  const docMap = new Map(documents.map((doc) => [doc.file, doc]))
  const profile = asDisplayRecord(parseOptionalArtifact(docMap.get("research-profile.yaml")))
  const labels = asDisplayRecord(recordValue(profile, "dashboard_labels"))
  return {
    players: stringValue(labels, "players", DEFAULT_RESEARCH_LABELS.players),
    matrices: stringValue(labels, "matrices", DEFAULT_RESEARCH_LABELS.matrices),
    actions: stringValue(labels, "actions", DEFAULT_RESEARCH_LABELS.actions),
    rubric: stringValue(labels, "rubric", DEFAULT_RESEARCH_LABELS.rubric),
  }
}

function parseJsonl(content: string): Array<Record<string, unknown>> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line)
        return isRecord(parsed) ? parsed : {}
      } catch {
        return {}
      }
    })
    .filter((item) => Object.keys(item).length > 0)
}

function ResearchRadarPanel({
  score,
  items,
}: {
  score: number
  items: Array<{ label: string; value: number }>
}) {
  const plotted = items.length >= 3
    ? items.slice(0, 8)
    : [
        { label: "Fundamentos", value: 0 },
        { label: "Implementação", value: 0 },
        { label: "Comparação", value: 0 },
        { label: "Práticas", value: 0 },
        { label: "Mundo real", value: 0 },
      ]
  const cx = 180
  const cy = 180
  const radius = 118
  const points = plotted.map((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / plotted.length
    const ratio = Math.max(0, Math.min(100, item.value)) / 100
    return {
      item,
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
      ax: cx + Math.cos(angle) * radius,
      ay: cy + Math.sin(angle) * radius,
      lx: cx + Math.cos(angle) * (radius + 34),
      ly: cy + Math.sin(angle) * (radius + 34),
    }
  })
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ")

  return (
    <div className="grid gap-5 p-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="grid place-items-center border border-[#f5f4e7]/10 bg-[#050505] p-3">
        <svg viewBox="0 0 360 360" className="h-[320px] w-full max-w-[360px]" role="img" aria-label="Radar de coverage">
          {[0.25, 0.5, 0.75, 1].map((ring) => (
            <circle key={ring} cx={cx} cy={cy} r={radius * ring} fill="none" stroke="rgba(245,244,231,0.12)" strokeWidth="1" />
          ))}
          {points.map((point) => (
            <line key={`${point.item.label}-axis`} x1={cx} y1={cy} x2={point.ax} y2={point.ay} stroke="rgba(245,244,231,0.10)" strokeWidth="1" />
          ))}
          <polygon points={polygon} fill="rgba(209,255,0,0.22)" stroke="#d1ff00" strokeWidth="2" />
          {points.map((point) => (
            <g key={point.item.label}>
              <circle cx={point.x} cy={point.y} r="4.5" fill={point.item.value >= 80 ? "#d1ff00" : point.item.value >= 60 ? "#f5b340" : "#ef4444"} />
              <text
                x={point.lx}
                y={point.ly}
                textAnchor={point.lx < cx ? "end" : point.lx > cx ? "start" : "middle"}
                dominantBaseline="middle"
                fill="rgba(245,244,231,0.58)"
                fontSize="10"
                fontFamily="monospace"
              >
                {shortPreview(point.item.label, 14)}
              </text>
            </g>
          ))}
          <text x={cx} y={cy - 3} textAnchor="middle" fill="#f5f4e7" fontSize="42" fontWeight="900" fontFamily={DISPLAY_FONT}>
            {score || "--"}
          </text>
          <text x={cx} y={cy + 22} textAnchor="middle" fill="rgba(245,244,231,0.42)" fontSize="10" fontFamily={MONO_FONT} letterSpacing="0.14em">
            COVERAGE
          </text>
        </svg>
      </div>
      <div className="grid content-start gap-3">
        {plotted.map((item) => (
          <ResearchBar key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  )
}

function ResearchDonutPanel({
  total,
  segments,
}: {
  total: number
  segments: Array<{ label: string; value: number; color: string }>
}) {
  const safeTotal = Math.max(1, total)
  let cursor = 0
  const gradient = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const start = cursor
      const end = cursor + (segment.value / safeTotal) * 360
      cursor = end
      return `${segment.color} ${start}deg ${end}deg`
    })
    .join(", ")

  return (
    <div className="grid gap-5 p-4">
      <div className="grid place-items-center">
        <div className="grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient || "rgba(245,244,231,0.08) 0deg 360deg"})` }}>
          <div className="grid h-28 w-28 place-items-center rounded-full bg-[#0f0f11]">
            <div className="text-center">
              <div className="text-[42px] font-black leading-none tracking-[-0.055em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{total}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>fontes</div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        {segments.map((segment) => (
          <div key={segment.label} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 text-[11px] uppercase tracking-[0.11em] text-[#f5f4e7]/48" style={{ fontFamily: MONO_FONT }}>
            <span className="h-3 w-3" style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <span className="font-black text-[#f5f4e7]">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResearchArtifactDag({
  nodes,
  edges,
}: {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
}) {
  const visibleNodes = nodes.slice(0, 16)
  const positions = new Map<string, { x: number; y: number }>()
  const columns = [
    visibleNodes.filter((node) => /root|query|prompt/i.test(stringValue(node, "type", "") + stringValue(node, "id", ""))),
    visibleNodes.filter((node) => /report|wave|recommend/i.test(stringValue(node, "type", "") + stringValue(node, "id", ""))),
    visibleNodes.filter((node) => /follow|status|metric|source|graph|curiosity|evolving|artifact/i.test(stringValue(node, "type", "") + stringValue(node, "id", ""))),
  ]
  const assigned = new Set(columns.flat().map((node) => stringValue(node, "id", "")))
  columns[2].push(...visibleNodes.filter((node) => !assigned.has(stringValue(node, "id", ""))))
  columns.forEach((column, colIndex) => {
    const x = 80 + colIndex * 210
    const gap = 300 / Math.max(1, column.length)
    column.forEach((node, index) => {
      positions.set(stringValue(node, "id", `node-${colIndex}-${index}`), { x, y: 45 + gap * index + gap / 2 })
    })
  })

  return (
    <div className="overflow-x-auto border border-[#f5f4e7]/10 bg-[#050505]">
      <svg viewBox="0 0 560 390" className="min-h-[320px] min-w-[560px] w-full" role="img" aria-label="Grafo dos artefatos da pesquisa">
        {edges.slice(0, 28).map((edge, index) => {
          const edgeFrom = graphEdgeFrom(edge)
          const edgeTo = graphEdgeTo(edge)
          const from = positions.get(edgeFrom)
          const to = positions.get(edgeTo)
          if (!from || !to) return null
          const relation = graphEdgeRelation(edge)
          const color = /follow|spawn/i.test(relation) ? "#0099ff" : /checkpoint|wave/i.test(relation) ? "#f5b340" : "#d1ff00"
          return (
            <line
              key={`${edgeFrom}-${edgeTo}-${relation}-${index}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth="1.4"
              strokeOpacity="0.62"
              strokeDasharray={/checkpoint|deriv/i.test(relation) ? "4 4" : undefined}
            />
          )
        })}
        {visibleNodes.map((node, index) => {
          const id = stringValue(node, "id", `node-${index}`)
          const pos = positions.get(id) ?? { x: 40, y: 40 }
          const type = stringValue(node, "type", "artifact")
          const fill = /root/i.test(type) ? "#f5f4e7" : /wave|follow/i.test(id + type) ? "#f5b340" : /source|graph|metric|curiosity/i.test(id + type) ? "#0099ff" : "#d1ff00"
          return (
            <g key={id}>
              <circle cx={pos.x} cy={pos.y} r={/report/i.test(id + type) ? 14 : 9} fill={fill} stroke="#050505" strokeWidth="2" />
              <text x={pos.x + 14} y={pos.y + 4} fill="rgba(245,244,231,0.78)" fontSize="10" fontFamily={MONO_FONT}>
                {shortPreview(id, 18)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ResearchWaveFlow({
  timeline,
  events,
}: {
  timeline: Array<{ index: number; file: string; title: string; summary: string; bytes: number }>
  events: Array<Record<string, unknown>>
}) {
  const nodes = [
    { label: "Query", value: "início", tone: "#f5f4e7" },
    { label: "Prompt", value: "escopo", tone: "#d1ff00" },
    ...timeline.slice(0, 4).map((wave) => ({ label: `Wave ${wave.index + 1}`, value: shortPreview(wave.title, 20), tone: "#f5b340" })),
    { label: "Decisão", value: events.some((event) => /stop/i.test(stringValue(event, "notes", "") + stringValue(event, "status", ""))) ? "STOP" : "avaliar", tone: "#d1ff00" },
    { label: "Ações", value: "síntese", tone: "#0099ff" },
  ]

  return (
    <section className="aiox-panel bg-[#0f0f11]">
      <ResearchPanelHead eyebrow="flow" title="Loop da pesquisa" meta={`${timeline.length} waves`} />
      <div className="overflow-x-auto p-4">
        <div className="grid min-w-[760px] grid-flow-col auto-cols-fr items-center gap-3">
          {nodes.map((node, index) => (
            <div key={`${node.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_24px] items-center gap-3 last:grid-cols-1">
              <div className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
                <div className="text-[10px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO_FONT, color: node.tone }}>
                  {String(index + 1).padStart(2, "0")} · {node.label}
                </div>
                <div className="aiox-safe-text mt-2 text-[20px] font-black leading-none tracking-[-0.04em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                  {node.value}
                </div>
              </div>
              {index < nodes.length - 1 && <div className="h-px bg-[#d1ff00]/55" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ResearchDecisionRubricPanel({ rubric, labels }: { rubric: Record<string, unknown>; labels: ResearchDashboardLabels }) {
  const status = stringValue(rubric, "status", "missing")
  const applicability = asDisplayRecord(recordValue(rubric, "applicability"))
  const model = asDisplayRecord(recordValue(rubric, "model"))
  const dimensions = arrayValue(rubric, "dimensions").map((item) => asDisplayRecord(item))
  const categories = arrayValue(rubric, "categories").map((item) => asDisplayRecord(item))
  const presets = arrayValue(rubric, "presets").map((item) => asDisplayRecord(item))
  const players = arrayValue(rubric, "players").map((item) => asDisplayRecord(item))
  const rankings = asDisplayRecord(recordValue(rubric, "rankings"))
  const baselineRanking = arrayValue(rankings, "equal").map((item) => asDisplayRecord(item)).slice(0, 6)
  const top = baselineRanking[0]

  if (status === "missing" || Object.keys(rubric).length === 0) {
    return (
      <section className="aiox-panel mt-5 bg-[#0f0f11]">
        <ResearchPanelHead eyebrow="rubrica" title={labels.rubric} meta="não gerada" />
        <div className="border-t border-[#f5f4e7]/10 bg-[#050505] p-5 text-[14px] leading-[1.55] text-[#f5f4e7]/58">
          Este run ainda não tem `decision-rubric.yaml`. A pesquisa pode listar {labels.players.toLowerCase()}, mas não consegue recalcular ranking por critérios de decisão.
        </div>
      </section>
    )
  }

  return (
    <section className="aiox-panel mt-5 bg-[#0f0f11]">
      <ResearchPanelHead
        eyebrow="rubrica"
        title={labels.rubric}
        meta={status === "applicable" ? `${players.length} itens · ${presets.length} presets` : status}
      />
      <div className="grid gap-px bg-[#f5f4e7]/10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="bg-[#050505] p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                {status === "applicable" ? "aplicável" : "não aplicável"}
              </div>
              <h3 className="aiox-safe-text mt-2 text-[30px] font-black leading-none tracking-[-0.045em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                {top ? `${stringValue(top, "player_name", "Sem líder")} lidera no baseline` : "Sem ranking calculável"}
              </h3>
              <p className="mt-3 max-w-[760px] text-[14px] leading-[1.55] text-[#f5f4e7]/62">
                {stringValue(model, "purpose", `A Rubrica transforma ${labels.players.toLowerCase()} detectados pela pesquisa em ranking ponderado por critérios.`)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-[#f5f4e7]/10">
              <ResearchDarkMetric label="Dimensões" value={String(dimensions.length)} />
              <ResearchDarkMetric label="Categorias" value={String(categories.length)} />
              <ResearchDarkMetric label="Presets" value={String(presets.length)} />
              <ResearchDarkMetric label="Claims" value={String(numberValue(applicability, "claim_count") ?? 0)} />
            </div>
          </div>

          {baselineRanking.length > 0 && (
            <div className="mt-5 grid gap-2">
              {baselineRanking.map((row) => {
                const score = Math.max(0, Math.min(100, numberValue(row, "score") ?? 0))
                return (
                  <div key={`${stringValue(row, "player_id", "")}-${stringValue(row, "rank", "")}`} className="grid gap-3 border border-[#f5f4e7]/10 bg-[#101010] p-3 md:grid-cols-[42px_minmax(0,1fr)_72px_minmax(120px,0.32fr)] md:items-center">
                    <div className="text-[24px] font-black leading-none tracking-[-0.05em] text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>
                      {String(numberValue(row, "rank") ?? 0).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <div className="aiox-safe-text text-[17px] font-black leading-tight text-[#f5f4e7]">{stringValue(row, "player_name", "Player")}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/34" style={{ fontFamily: MONO_FONT }}>preset baseline · pesos iguais</div>
                    </div>
                    <div className="text-[22px] font-black text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{score.toFixed(1)}</div>
                    <div className="h-2 border border-[#f5f4e7]/10 bg-[#050505]">
                      <div className="h-full bg-[#d1ff00]" style={{ width: `${score}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {status !== "applicable" && (
            <div className="mt-5 border border-[#f5b340]/25 bg-[#15110a] p-4 text-[13px] leading-[1.5] text-[#f5f4e7]/68">
              Motivo: {stringValue(applicability, "reason", "requires_at_least_two_included_players")}. O artefato continua válido para provar que a pesquisa não tinha comparação suficiente.
            </div>
          )}
        </div>

        <aside className="grid content-start gap-px bg-[#f5f4e7]/10">
          <div className="bg-[#050505] p-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>dimensões</div>
            <div className="mt-3 grid gap-2">
              {dimensions.slice(0, 6).map((dimension) => (
                <div key={stringValue(dimension, "id", stringValue(dimension, "name", ""))} className="border border-[#f5f4e7]/10 bg-[#101010] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{stringValue(dimension, "id", "D")}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/34" style={{ fontFamily: MONO_FONT }}>{stringValue(dimension, "category", "C")}</span>
                  </div>
                  <div className="aiox-safe-text mt-1 text-[15px] font-black leading-tight text-[#f5f4e7]">{stringValue(dimension, "name", "Dimensão")}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#050505] p-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>presets</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <span key={stringValue(preset, "key", stringValue(preset, "name", ""))} className="border border-[#f5f4e7]/12 bg-[#101010] px-2 py-1 text-[10px] uppercase tracking-[0.11em] text-[#f5f4e7]/58" style={{ fontFamily: MONO_FONT }}>
                  {stringValue(preset, "name", "Preset")}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function ResearchPlayerQuadrant({ players }: { players: ObservatoryPlayer[] }) {
  const included = players.filter((player) => !player.excluded).slice(0, 18)
  const categories = Array.from(new Set(included.map((player) => player.category ?? "outros")))
  const plotted = included.map((player, index) => {
    const tier = player.tier ?? 3
    const categoryIndex = Math.max(0, categories.indexOf(player.category ?? "outros"))
    return {
      player,
      x: 18 + ((categoryIndex + 1) / Math.max(1, categories.length + 1)) * 70 + (index % 3) * 3,
      y: tier === 1 ? 82 - (index % 4) * 4 : tier === 2 ? 58 - (index % 3) * 5 : 34 - (index % 3) * 4,
      color: tier === 1 ? "#d1ff00" : tier === 2 ? "#0099ff" : "#f5b340",
    }
  })

  return (
    <div className="relative h-[360px] border border-[#f5f4e7]/10 bg-[#050505]">
      <div className="absolute inset-x-0 top-1/2 border-t border-[#f5f4e7]/10" />
      <div className="absolute inset-y-0 left-1/2 border-l border-[#f5f4e7]/10" />
      <div className="absolute left-3 top-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>baixo fit</div>
      <div className="absolute right-3 top-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>sweet spot</div>
      <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>explorar</div>
      <div className="absolute bottom-3 right-3 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>maduro</div>
      {plotted.map(({ player, x, y, color }) => (
        <div
          key={player.id || player.name}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-[#050505]"
          style={{ left: `${x}%`, top: `${100 - y}%`, background: color }}
          title={`${player.name} · ${player.category ?? "sem categoria"}`}
        />
      ))}
    </div>
  )
}

function ResearchMatrixHeatmap({ matrices }: { matrices: Array<Record<string, unknown>> }) {
  const matrix = matrices
    .filter((item) => arrayValue(item, "cells").length > 0)
    .sort((a, b) => arrayValue(b, "cells").length - arrayValue(a, "cells").length)[0]
  if (!matrix) {
    return (
      <div className="p-4">
        <div className="border border-[#f5f4e7]/10 bg-[#050505] p-5 text-[14px] text-[#f5f4e7]/50">
          Nenhuma matriz estruturada encontrada neste run.
        </div>
      </div>
    )
  }

  const columns = arrayValue(matrix, "columns").map((item) => String(item)).filter(Boolean)
  const rows = arrayValue(matrix, "cells").map((item) => asDisplayRecord(item)).slice(0, 11)
  const [labelColumn, ...valueColumns] = columns.length > 0 ? columns : ["Item"]
  const visibleColumns = valueColumns.slice(0, 3)
  const maxRows = Math.max(1, numberValue(matrix, "row_count") ?? rows.length)

  return (
    <div className="p-4">
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="border border-[#f5f4e7]/10 bg-[#050505] p-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
            matriz principal
          </div>
          <h4 className="aiox-safe-text mt-2 text-[22px] font-black leading-tight tracking-[-0.035em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
            {stringValue(matrix, "title", "Matriz extraída")}
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[#f5f4e7]/10">
          <ResearchDarkMetric label="Linhas" value={String(rows.length)} />
          <ResearchDarkMetric label="Colunas" value={String(columns.length)} />
        </div>
      </div>

      <div className="overflow-x-auto border border-[#f5f4e7]/10 bg-[#050505]">
        <div
          className="grid min-w-[920px]"
          style={{
            gridTemplateColumns: `220px repeat(${Math.max(1, visibleColumns.length)}, minmax(190px, 1fr))`,
          }}
        >
          <div className="border-b border-r border-[#f5f4e7]/10 bg-[#151515] p-3 text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
            {labelColumn}
          </div>
          {visibleColumns.map((column) => (
            <div key={column} className="border-b border-r border-[#f5f4e7]/10 bg-[#151515] p-3 text-[10px] uppercase tracking-[0.14em] text-[#f5f4e7]/42 last:border-r-0" style={{ fontFamily: MONO_FONT }}>
              {humanizeResearchLabel(column)}
            </div>
          ))}

          {rows.map((row, rowIndex) => {
            const phase = stringValue(row, labelColumn, stringValue(row, columns[0], `Linha ${rowIndex + 1}`))
            return (
              <Fragment key={`${phase}-${rowIndex}`}>
                <div className="border-r border-t border-[#f5f4e7]/10 bg-[#101010] p-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/32" style={{ fontFamily: MONO_FONT }}>
                    {String(rowIndex + 1).padStart(2, "0")} / {maxRows}
                  </div>
                  <div className="aiox-safe-text mt-1 text-[16px] font-black leading-tight text-[#f5f4e7]">
                    {phase}
                  </div>
                </div>
                {visibleColumns.map((column) => {
                  const text = stringValue(row, column, "—")
                  const tone = matrixTone(column, text)
                  return (
                    <div key={`${phase}-${column}`} className="border-r border-t border-[#f5f4e7]/10 p-3 last:border-r-0" style={{ background: tone.bg }}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="h-2.5 w-2.5" style={{ background: tone.accent }} />
                        <span className="text-[9px] uppercase tracking-[0.12em] text-[#f5f4e7]/34" style={{ fontFamily: MONO_FONT }}>
                          {tone.label}
                        </span>
                      </div>
                      <p className="aiox-safe-text text-[13px] font-bold leading-[1.35] text-[#f5f4e7]/82">
                        {shortPreview(text, 150)}
                      </p>
                    </div>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function matrixTone(column: string, text: string) {
  const sample = `${column} ${text}`.toLowerCase()
  if (/gap|risco|falta|não|pouca|nenhum|teatro|baixo roi|corrigir/.test(sample)) {
    return { label: "gap", bg: "#150b0b", accent: "#ef4444" }
  }
  if (/prior|benchmark|inspiração|paper|fonte|arxiv/.test(sample)) {
    return { label: "referência", bg: "#071019", accent: "#0099ff" }
  }
  if (/alto|p0|p1|recomend|adotar|quick|valor/.test(sample)) {
    return { label: "ação", bg: "#111113", accent: "#d1ff00" }
  }
  return { label: "sinal", bg: "#0b0b0b", accent: "#f5b340" }
}

function ResearchStorySection({
  step,
  title,
  copy,
  children,
}: {
  step: string
  title: string
  copy: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4">
      <header className="grid gap-4 border-t border-[#f5f4e7]/14 pt-5 lg:grid-cols-[92px_minmax(0,0.9fr)_minmax(280px,0.7fr)] lg:items-start">
        <div className="text-[42px] font-black leading-none tracking-[-0.055em] text-[#d1ff00]" style={{ fontFamily: DISPLAY_FONT }}>
          {step}
        </div>
        <h3 className="aiox-safe-text text-[30px] font-black leading-[0.98] tracking-[-0.05em] text-[#f5f4e7] sm:text-[38px]" style={{ fontFamily: DISPLAY_FONT }}>
          {title}
        </h3>
        <p className="max-w-[640px] text-[15px] leading-[1.55] text-[#f5f4e7]/60">
          {copy}
        </p>
      </header>
      {children}
    </section>
  )
}

function ResearchPanelHead({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return (
    <header className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--report-rule-soft)] bg-[var(--report-surface-3)] p-5">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--report-accent)]" style={{ fontFamily: MONO_FONT }}>{eyebrow}</p>
        <h3 className="aiox-safe-text mt-1 text-[26px] font-black leading-none tracking-[-0.045em] text-[var(--report-text)]" style={{ fontFamily: DISPLAY_FONT }}>
          {title}
        </h3>
      </div>
      {meta && <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--report-dim)]" style={{ fontFamily: MONO_FONT }}>{meta}</span>}
    </header>
  )
}

function ResearchCompactIntro({
  eyebrow,
  title,
  copy,
  accentValue,
  accentLabel,
  metrics,
}: {
  eyebrow: string
  title: string
  copy: string
  accentValue: string
  accentLabel: string
  metrics: Array<[string, string | number]>
}) {
  return (
    <section className="grid min-w-0 overflow-hidden border border-[var(--report-rule)] bg-[var(--report-surface)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)]">
      <div className="min-w-0 p-5 sm:p-6">
        <p className="aiox-report-eyebrow">{eyebrow}</p>
        <div className="mt-2 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.7fr)] xl:items-end">
          <h2 className="aiox-safe-text text-[30px] font-black leading-[0.98] tracking-[-0.05em] text-[var(--report-text)] sm:text-[38px]" style={{ fontFamily: DISPLAY_FONT }}>
            {title}
          </h2>
          <p className="max-w-[640px] text-[14px] leading-[1.58] text-[var(--report-text-2)]">{copy}</p>
        </div>
      </div>
      <aside className="grid grid-cols-[110px_minmax(0,1fr)] gap-px bg-[var(--report-rule-soft)] lg:grid-cols-[128px_minmax(0,1fr)]">
        <div className="grid content-center bg-[var(--report-accent)] p-4 text-[var(--report-on-accent)]">
          <div className="text-[42px] font-black leading-none tracking-[-0.055em]" style={{ fontFamily: DISPLAY_FONT }}>{accentValue}</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO_FONT }}>{accentLabel}</div>
        </div>
        <div className="grid bg-[var(--report-bg)] sm:grid-cols-3 lg:grid-cols-1">
          {metrics.map(([label, value]) => (
            <div key={label} className="border-b border-[var(--report-rule-soft)] p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b lg:border-r-0">
              <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--report-dim)]" style={{ fontFamily: MONO_FONT }}>{label}</div>
              <div className="mt-1 text-[22px] font-black leading-none text-[var(--report-text)]" style={{ fontFamily: DISPLAY_FONT }}>{value}</div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  )
}

function ResearchDarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[var(--report-bg)] p-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--report-dim)]" style={{ fontFamily: MONO_FONT }}>{label}</div>
      <div className="aiox-safe-text mt-1 text-[28px] font-black leading-none tracking-[-0.045em] text-[var(--report-text)]" style={{ fontFamily: DISPLAY_FONT }}>{value}</div>
    </div>
  )
}

function ResearchLightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[var(--report-accent)] p-3 text-[var(--report-on-accent)]">
      <div className="text-[9px] uppercase tracking-[0.12em] opacity-60" style={{ fontFamily: MONO_FONT }}>{label}</div>
      <div className="aiox-safe-text mt-1 text-[22px] font-black leading-none" style={{ fontFamily: DISPLAY_FONT }}>{value}</div>
    </div>
  )
}

function ResearchTokenList({ label, items, empty }: { label: string; items: unknown[]; empty: string }) {
  const values = items.map((item) => displayString(item, "")).filter(Boolean).slice(0, 8)
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{label}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((item) => (
            <span key={item} className="max-w-full truncate border border-[#f5f4e7]/12 bg-[#050505] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/58" style={{ fontFamily: MONO_FONT }}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] leading-[1.5] text-[#f5f4e7]/50">{empty}</p>
      )}
    </div>
  )
}

function ResearchBar({ label, value }: { label: string; value: number }) {
  const width = Math.max(3, Math.min(100, value))
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-[10px] uppercase tracking-[0.11em] text-[var(--report-dim)]" style={{ fontFamily: MONO_FONT }}>
        <span className="truncate">{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2.5 bg-[var(--report-rule-soft)]">
        <div className="h-full bg-[var(--report-accent)]" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function humanizeResearchLabel(raw: string) {
  return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function markdownTitle(content: string) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ""
}

function markdownSummary(content: string) {
  const text = content
    .split("\n")
    .filter((line) => !/^#/.test(line.trim()))
    .join(" ")
    .replace(/[`*_>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > 280 ? `${text.slice(0, 280).trim()}…` : text || "Sem resumo textual estruturado neste artefato."
}

function extractMarkdownSection(content: string, headings: string[]) {
  for (const heading of headings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = content.match(new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"))
    if (!match?.[1]) continue
    return cleanMarkdownText(match[1], 520)
  }
  return ""
}

function extractMarkdownTable(content: string, headings: string[]): string[][] {
  const section = extractRawMarkdownSection(content, headings)
  if (!section) return []
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\|.+\|$/.test(line))
  if (lines.length < 2) return []
  return lines
    .slice(2)
    .map((line) =>
      line
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cleanMarkdownText(cell, 180)),
    )
    .filter((row) => row.some(Boolean))
}

function extractMarkdownListItems(content: string, headings: string[]) {
  const section = extractRawMarkdownSection(content, headings)
  if (!section) return []
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => cleanMarkdownText(line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""), 180))
    .filter(Boolean)
}

function extractRawMarkdownSection(content: string, headings: string[]) {
  for (const heading of headings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = content.match(new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"))
    if (match?.[1]) return match[1]
  }
  return ""
}

function sentenceSummary(value: string, max = 180) {
  const text = cleanMarkdownText(value, max * 2)
  if (text.length <= max) return text
  const sentence = text.match(/^(.{40,}?[.!?])\s/)?.[1]
  if (sentence && sentence.length <= max) return sentence
  return `${text.slice(0, max).replace(/[,;:\s]+$/g, "").trim()}…`
}

function splitOperationalChecklist(value: string) {
  const text = cleanMarkdownText(value, 900)
  if (!text) return []
  const explicit = text
    .split(/\s+-\s+/)
    .map((item) => cleanMarkdownText(item, 170))
    .filter((item) => item.length > 0)
  if (explicit.length > 1) return explicit
  return text
    .split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((item) => cleanMarkdownText(item, 170))
    .filter((item) => item.length > 0)
}

function cleanMarkdownText(value: string, max = 240) {
  const text = value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#]+/g, "")
    .replace(/^-+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > max ? `${text.slice(0, max).trim()}…` : text
}

function isStructuredArtifact(file: string) {
  return /\.(ya?ml|json)$/i.test(file)
}

function parseStructured(file: string, content: string): unknown {
  try {
    if (/\.json$/i.test(file)) return JSON.parse(content)
    return YAML.parse(content)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function scalarPreview(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return `${value.length} items`
  if (isRecord(value)) return `${Object.keys(value).length} fields`
  return String(value)
}

function shortPreview(value: unknown, max = 96): string {
  const text = scalarPreview(value).replace(/\s+/g, " ").trim()
  return text.length > max ? `${text.slice(0, max).trim()}…` : text
}

function topLevelEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.map((item, index) => [String(index + 1).padStart(2, "0"), item])
  if (isRecord(value)) return Object.entries(value)
  return [["value", value]]
}

type StructuredShape = { fields: number; arrays: number; objects: number; scalars: number }

function countShape(value: unknown): StructuredShape {
  if (Array.isArray(value)) {
    return value.reduce(
      (acc: StructuredShape, item) => {
        const c = countShape(item)
        return {
          fields: acc.fields + c.fields,
          arrays: acc.arrays + c.arrays,
          objects: acc.objects + c.objects,
          scalars: acc.scalars + c.scalars,
        }
      },
      { fields: 0, arrays: 1, objects: 0, scalars: 0 } satisfies StructuredShape,
    )
  }
  if (isRecord(value)) {
    return Object.values(value).reduce(
      (acc: StructuredShape, item) => {
        const c = countShape(item)
        return {
          fields: acc.fields + c.fields,
          arrays: acc.arrays + c.arrays,
          objects: acc.objects + c.objects,
          scalars: acc.scalars + c.scalars,
        }
      },
      { fields: Object.keys(value).length, arrays: 0, objects: 1, scalars: 0 } satisfies StructuredShape,
    )
  }
  return { fields: 0, arrays: 0, objects: 0, scalars: 1 }
}

function StructuredArtifactView({
  file,
  content,
  bodyRef,
}: {
  file: string
  content: string
  bodyRef: RefObject<HTMLDivElement | null>
}) {
  const parsed = parseStructured(file, content)
  const parseFailed = parsed === null && content.trim() !== "null"
  const entries = topLevelEntries(parsed)
  const shape = countShape(parsed)
  const format = /\.json$/i.test(file) ? "JSON" : "YAML"
  const semanticReport = renderStructuredArtifactReport(file, parsed)

  if (parseFailed) {
    return (
      <LightScrollArea ref={bodyRef} className="flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-10">
        <article className="mx-auto w-full min-w-0 max-w-[960px]">
          <SinkraHeader eyebrow={`${format} artifact`} title={file} meta={["parse warning", `${content.length} chars`]} />
          <pre className="overflow-x-auto border border-[var(--rule)] bg-[var(--ink)] p-5 text-[12px] leading-[1.6] text-[var(--paper)]" style={{ fontFamily: MONO_FONT }}>
            {content}
          </pre>
        </article>
      </LightScrollArea>
    )
  }

  return (
    <LightScrollArea ref={bodyRef} className="flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <article className="mx-auto w-full min-w-0 max-w-[1280px]">
        <SinkraHeader
          eyebrow={`${format} artifact`}
          title={file}
          meta={[`${entries.length} top-level`, `${shape.fields} fields`, `${shape.arrays} arrays`, `${shape.objects} objects`]}
        />

        <div className="mb-5 grid gap-px bg-[var(--rule)] sm:grid-cols-4">
          <MetricTile label="Fields" value={String(shape.fields)} />
          <MetricTile label="Arrays" value={String(shape.arrays)} />
          <MetricTile label="Objects" value={String(shape.objects)} />
          <MetricTile label="Scalars" value={String(shape.scalars)} />
        </div>

        {semanticReport ?? (
          <div className="grid gap-4">
            {entries.map(([key, value]) => (
              <StructuredSection key={key} name={key} value={value} />
            ))}
          </div>
        )}
      </article>
    </LightScrollArea>
  )
}

function recordValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined
}

function arrayValue(value: unknown, key: string): unknown[] {
  const next = recordValue(value, key)
  return Array.isArray(next) ? next : []
}

function stringValue(value: unknown, key: string, fallback = "—") {
  const next = recordValue(value, key)
  return displayString(next, fallback)
}

function displayString(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    const values = value.map((item) => displayString(item, "")).filter(Boolean)
    return values.length > 0 ? values.join(", ") : fallback
  }
  if (isRecord(value)) {
    for (const key of ["title", "name", "label", "summary", "decision", "status", "type", "research_kind", "method_family", "id"]) {
      const candidate = displayString(value[key], "")
      if (candidate) return candidate
    }
  }
  return fallback
}

function booleanValue(value: unknown, key: string) {
  return Boolean(recordValue(value, key))
}

function numberValue(value: unknown, key: string): number | null {
  const next = Number(recordValue(value, key))
  return Number.isFinite(next) ? next : null
}

function normalizeResearchScore(value: unknown): number {
  const next = Number(value)
  if (!Number.isFinite(next)) return 0
  const normalized = next > 0 && next <= 1 ? next * 100 : next
  return Math.round(Math.max(0, Math.min(100, normalized)))
}

function mergeResearchQuestions(curiosity: Record<string, unknown>): Array<Record<string, unknown>> {
  const seen = new Set<string>()
  return [...arrayValue(curiosity, "questions"), ...arrayValue(curiosity, "items")]
    .map((item) => asDisplayRecord(item))
    .filter((item) => {
      const id = stringValue(item, "id", stringValue(item, "question", ""))
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
}

function researchPhaseRows(value: unknown): Array<{ id: string; label: string; status: string }> {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const row = asDisplayRecord(item)
      const id = stringValue(row, "id", `phase-${index + 1}`)
      return {
        id,
        label: humanizeResearchLabel(stringValue(row, "name", id)),
        status: stringValue(row, "status", "—"),
      }
    })
  }
  return Object.entries(asDisplayRecord(value)).map(([id, rawStatus]) => ({
    id,
    label: humanizeResearchLabel(id),
    status: typeof rawStatus === "string" || typeof rawStatus === "number" ? String(rawStatus) : stringValue(asDisplayRecord(rawStatus), "status", "—"),
  }))
}

function researchDecisionTitle(actionPlan: Record<string, unknown>, metrics: Record<string, unknown>, fallback: string) {
  const actionDecision = asDisplayRecord(recordValue(actionPlan, "decision"))
  const metricsDecision = asDisplayRecord(recordValue(metrics, "decision"))
  return stringValue(actionDecision, "title", stringValue(metricsDecision, "summary", fallback))
}

function researchDecisionSummary(actionPlan: Record<string, unknown>, metrics: Record<string, unknown>) {
  const actionDecision = asDisplayRecord(recordValue(actionPlan, "decision"))
  const metricsDecision = asDisplayRecord(recordValue(metrics, "decision"))
  return stringValue(actionDecision, "summary", stringValue(metricsDecision, "selected_option", stringValue(metrics, "stop_reason", "Sem stop reason estruturado.")))
}

function researchGraphEdges(graph: Record<string, unknown>): Array<Record<string, unknown>> {
  return [...arrayValue(graph, "edges"), ...arrayValue(graph, "links")]
    .map((item) => asDisplayRecord(item))
    .filter((edge, index, edges) => {
      const from = graphEdgeFrom(edge)
      const to = graphEdgeTo(edge)
      if (!from || !to) return false
      const key = `${from}::${to}::${graphEdgeRelation(edge)}`
      return edges.findIndex((candidate) => `${graphEdgeFrom(candidate)}::${graphEdgeTo(candidate)}::${graphEdgeRelation(candidate)}` === key) === index
    })
}

function graphEdgeFrom(edge: Record<string, unknown>) {
  return stringValue(edge, "from", stringValue(edge, "source", ""))
}

function graphEdgeTo(edge: Record<string, unknown>) {
  return stringValue(edge, "to", stringValue(edge, "target", ""))
}

function graphEdgeRelation(edge: Record<string, unknown>) {
  return stringValue(edge, "relation", stringValue(edge, "type", ""))
}

function stableRecordKey(record: Record<string, unknown>, index: number, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(record, key, "")
    if (value) return `${key}:${value}:${index}`
  }
  return `record:${index}`
}

function researchEventStatus(event: Record<string, unknown>) {
  return stringValue(event, "status", stringValue(event, "event", "registrado"))
}

function researchEventSummary(event: Record<string, unknown>) {
  return stringValue(event, "summary", stringValue(event, "notes", stringValue(event, "action", stringValue(event, "event", "Evento registrado."))))
}

function renderStructuredArtifactReport(file: string, parsed: unknown): ReactNode | null {
  if (!isRecord(parsed)) return null
  if (/workflow_definition\.ya?ml$/i.test(file)) return <WorkflowArtifactReport data={parsed} />
  if (/task_definitions\.ya?ml$/i.test(file)) return <TasksArtifactReport data={parsed} />
  if (/quality_gates\.ya?ml$/i.test(file)) return <QualityGatesArtifactReport data={parsed} />
  if (/score_card\.ya?ml$/i.test(file)) return <ScoreCardArtifactReport data={parsed} />
  if (/research-contract\.json$/i.test(file)) return <ResearchContractArtifactReport data={parsed} />
  if (/(process_map|domain_map|dependency_graph)\.ya?ml$/i.test(file)) return <MapArtifactReport file={file} data={parsed} />
  return null
}

function ResearchContractArtifactReport({ data }: { data: Record<string, unknown> }) {
  const decisionContext = asDisplayRecord(recordValue(data, "decision_context"))
  const taxonomy = asDisplayRecord(recordValue(data, "taxonomy"))
  const rubric = asDisplayRecord(recordValue(data, "rubric_model"))
  const evidence = asDisplayRecord(recordValue(data, "evidence_model"))
  const stopRules = asDisplayRecord(recordValue(data, "stop_rules"))
  const thresholds = asDisplayRecord(recordValue(data, "thresholds"))
  const categories = arrayValue(taxonomy, "categories")
  const criteria = arrayValue(rubric, "dimensions_or_criteria")
  const primaryEvidence = arrayValue(evidence, "primary_evidence")
  const stopWhen = arrayValue(stopRules, "stop_when")
  const doNotStopWhen = arrayValue(stopRules, "do_not_stop_when")

  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Kind", humanizeResearchLabel(stringValue(data, "research_kind", "custom research"))],
          ["Method", humanizeResearchLabel(stringValue(rubric, "method_family", "custom"))],
          ["Profile", humanizeResearchLabel(stringValue(decisionContext, "profile_type", "—"))],
          ["Generated", stringValue(data, "generated_at", "—")],
        ]}
      />

      <section className="border border-[var(--rule)] bg-[var(--paper)]">
        <header className="border-b border-[var(--rule)] bg-[var(--paper-alt)] p-4">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            local contract
          </div>
          <h3 className="mt-1 text-[24px] font-black tracking-[-0.04em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
            {humanizeResearchLabel(stringValue(data, "research_kind", "Research contract"))}
          </h3>
        </header>
        <div className="grid gap-px bg-[var(--rule)] md:grid-cols-2">
          <ReportTextBlock label="Objetivo" value={recordValue(data, "objective")} />
          <ReportTextBlock label="Decisão primária" value={recordValue(decisionContext, "primary_decision")} />
          <ReportTextBlock label="Unidade de análise" value={recordValue(taxonomy, "unit_of_analysis")} />
          <ReportTextBlock label="Semântica do score" value={recordValue(rubric, "score_semantics")} />
          <ReportTextBlock label="Regra de saturação" value={recordValue(rubric, "pass_or_saturation_rule")} />
          <ReportTextBlock label="Fraqueza conhecida" value={recordValue(evidence, "known_weakness")} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="border border-[var(--rule)] bg-[var(--paper)] p-4">
          <h3 className="text-[20px] font-black tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
            Taxonomia e rubrica
          </h3>
          <div className="mt-4 grid gap-4">
            <DependencyPills label="Categorias" values={categories} />
            <DependencyPills label="Critérios" values={criteria} />
            <DependencyPills label="Evidências primárias" values={primaryEvidence} />
          </div>
        </section>

        <section className="border border-[var(--rule)] bg-[var(--paper)] p-4">
          <h3 className="text-[20px] font-black tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
            Stop rules
          </h3>
          <div className="mt-4 grid gap-4">
            <DependencyPills label="Stop when" values={stopWhen} />
            <DependencyPills label="Do not stop when" values={doNotStopWhen} />
          </div>
        </section>
      </div>

      <StructuredSection name="thresholds" value={thresholds} />
    </div>
  )
}

function WorkflowArtifactReport({ data }: { data: Record<string, unknown> }) {
  const workflows = arrayValue(data, "workflows").map((item, index) => ({ item: asDisplayRecord(item), index }))
  const stepCount = workflows.reduce((total, { item }) => total + arrayValue(item, "steps").length, 0)

  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Process", stringValue(data, "process_name")],
          ["Version", stringValue(data, "version")],
          ["Workflows", String(workflows.length)],
          ["Steps", String(stepCount)],
        ]}
      />
      {workflows.map(({ item, index }) => {
        const steps = arrayValue(item, "steps")
        return (
          <section key={`${stringValue(item, "workflow_id", "workflow")}-${index}`} className="border border-[var(--rule)] bg-[var(--paper)]">
            <header className="grid gap-4 border-b border-[var(--rule)] bg-[var(--paper-alt)] p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  {stringValue(item, "workflow_id")} · {stringValue(item, "layer", "layer")}
                </div>
                <h3 className="mt-1 text-[24px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {stringValue(item, "name", `Workflow ${index + 1}`)}
                </h3>
                <p className="mt-2 max-w-[900px] whitespace-pre-line text-[14px] leading-[1.55] text-[var(--ink-2)]">
                  {shortPreview(recordValue(item, "description"), 420)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-[var(--rule)]">
                <MetricTile label="Trigger" value={stringValue(item, "trigger")} />
                <MetricTile label="Steps" value={String(steps.length)} />
                <MetricTile label="Frequency" value={stringValue(item, "frequency")} wide />
              </div>
            </header>
            <div className="divide-y divide-[var(--rule-soft)]">
              {steps.slice(0, 18).map((raw, stepIndex) => {
                const step = asDisplayRecord(raw)
                return (
                  <div key={`${stringValue(step, "step_id", "step")}-${stepIndex}`} className="grid gap-3 px-4 py-3 md:grid-cols-[52px_minmax(0,1fr)_132px]">
                    <div className="text-[12px] tabular-nums text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {String(stepIndex + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <strong className="block truncate text-[14px] text-[var(--ink)]">{stringValue(step, "name", stringValue(step, "task_id", "Step"))}</strong>
                      <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                        {stringValue(step, "phase_id", "phase")} · {stringValue(step, "task_id", "task")}
                      </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)] md:text-right" style={{ fontFamily: MONO_FONT }}>
                      {stringValue(step, "executor_type")}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TasksArtifactReport({ data }: { data: Record<string, unknown> }) {
  const tasks = arrayValue(data, "tasks").map((item) => asDisplayRecord(item))
  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Process", stringValue(data, "process_name")],
          ["Tasks", String(tasks.length)],
          ["Contract", stringValue(asDisplayRecord(recordValue(data, "task_anatomy_contract")), "validation_result")],
          ["Version", stringValue(data, "version")],
        ]}
      />
      <div className="overflow-x-auto border border-[var(--rule)] bg-[var(--paper)]">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[minmax(260px,1.7fr)_110px_110px_80px_80px_minmax(180px,1fr)] border-b border-[var(--rule)] bg-[var(--paper-alt)] px-4 py-3 text-[10px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            <span>Task</span><span>Layer</span><span>Executor</span><span>Inputs</span><span>Outputs</span><span>Checks</span>
          </div>
          {tasks.slice(0, 40).map((task) => {
            const post = asDisplayRecord(recordValue(task, "post_conditions"))
            return (
              <div key={stringValue(task, "task")} className="grid grid-cols-[minmax(260px,1.7fr)_110px_110px_80px_80px_minmax(180px,1fr)] items-center border-b border-[var(--rule-soft)] px-4 py-3 last:border-b-0">
                <strong className="min-w-0 truncate text-[13px] text-[var(--ink)]">{stringValue(task, "task")}</strong>
                <span className="text-[12px] text-[var(--ink-2)]">{stringValue(task, "atomic_layer")}</span>
                <span className="text-[12px] text-[var(--ink-2)]">{stringValue(task, "responsavel_type")}</span>
                <span className="text-[18px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{arrayValue(task, "entrada").length}</span>
                <span className="text-[18px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{arrayValue(task, "saida").length}</span>
                <span className="truncate text-[12px] text-[var(--ink-2)]">
                  {arrayValue(task, "pre_conditions").length + arrayValue(post, "conditions").length} conditions
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function QualityGatesArtifactReport({ data }: { data: Record<string, unknown> }) {
  const gates = arrayValue(data, "quality_gates").map((item) => asDisplayRecord(item))
  const axiomas = asDisplayRecord(recordValue(data, "meta_axiomas"))
  const dimensions = arrayValue(axiomas, "dimensions").map((item) => asDisplayRecord(item))
  const vetoCount = gates.filter((gate) => booleanValue(gate, "veto_power")).length

  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Gates", String(gates.length)],
          ["Veto", String(vetoCount)],
          ["Compliance", stringValue(axiomas, "compliance_score")],
          ["Result", stringValue(axiomas, "result")],
        ]}
      />
      {dimensions.length > 0 && (
        <section className="border border-[var(--rule)] bg-[var(--paper)] p-4">
          <h3 className="text-[20px] font-black tracking-[-0.03em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>Meta axiomas</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {dimensions.map((dimension) => {
              const score = numberValue(dimension, "score") ?? 0
              const threshold = numberValue(dimension, "threshold") ?? 0
              return (
                <div key={stringValue(dimension, "id")} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate text-[13px] text-[var(--ink)]">{stringValue(dimension, "name")}</strong>
                    <span className="text-[12px] font-black tabular-nums text-[var(--ink)]">{score.toFixed(1)}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-[var(--paper-deep)]">
                    <div className={cn("h-full", score >= threshold ? "bg-[var(--lime-fill)]" : "bg-[var(--warning-ink)]")} style={{ width: `${Math.max(0, Math.min(100, score * 10))}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {gates.map((gate) => (
          <section key={stringValue(gate, "gate_id")} className="border border-[var(--rule)] bg-[var(--paper)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  {stringValue(gate, "gate_id")} · {stringValue(gate, "type", "gate")}
                </div>
                <h3 className="mt-1 text-[18px] font-black leading-tight tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {stringValue(gate, "name")}
                </h3>
              </div>
              {booleanValue(gate, "veto_power") && (
                <span className="border border-[var(--lime-ink)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--lime-ink)]" style={{ fontFamily: MONO_FONT }}>
                  veto
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-px bg-[var(--rule)]">
              <MetricTile label="Executor" value={stringValue(gate, "executor")} />
              <MetricTile label="Threshold" value={stringValue(gate, "threshold")} />
              <MetricTile label="Criteria" value={String(arrayValue(gate, "criteria").length)} />
            </div>
            <p className="mt-3 text-[13px] leading-[1.5] text-[var(--ink-2)]">{stringValue(gate, "position")}</p>
          </section>
        ))}
      </div>
    </div>
  )
}

function ScoreCardArtifactReport({ data }: { data: Record<string, unknown> }) {
  const overall = asDisplayRecord(recordValue(data, "overall"))
  const dimensions = arrayValue(asDisplayRecord(recordValue(data, "meta_axiomas")), "dimensions")
    .concat(arrayValue(data, "dimensions"))
    .map((item) => asDisplayRecord(item))
  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Score", stringValue(overall, "score", stringValue(data, "compliance_score"))],
          ["Result", stringValue(overall, "result", stringValue(data, "result"))],
          ["Gate", stringValue(data, "quality_gate")],
          ["Dimensions", String(dimensions.length)],
        ]}
      />
      {dimensions.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {dimensions.map((dimension, index) => {
            const score = numberValue(dimension, "score")
            const threshold = numberValue(dimension, "threshold")
            return (
              <section key={`${stringValue(dimension, "name", "dimension")}-${index}`} className="border border-[var(--rule)] bg-[var(--paper)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate text-[17px] font-black tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {stringValue(dimension, "name", stringValue(dimension, "id", "Dimension"))}
                  </h3>
                  <span className="text-[18px] font-black tabular-nums text-[var(--ink)]">{score === null ? "—" : score}</span>
                </div>
                {score !== null && (
                  <div className="mt-3 h-2 bg-[var(--paper-deep)]">
                    <div className={cn("h-full", threshold === null || score >= threshold ? "bg-[var(--lime-fill)]" : "bg-[var(--warning-ink)]")} style={{ width: `${Math.max(0, Math.min(100, score > 10 ? score : score * 10))}%` }} />
                  </div>
                )}
                <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  threshold {threshold ?? "—"} · {stringValue(dimension, "status")}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <StructuredSection name="score_card" value={data} />
      )}
    </div>
  )
}

function MapArtifactReport({ file, data }: { file: string; data: Record<string, unknown> }) {
  if (/process_map\.ya?ml$/i.test(file)) return <ProcessMapArtifactReport data={data} />
  if (/domain_map\.ya?ml$/i.test(file)) return <DomainMapArtifactReport data={data} />
  if (/dependency_graph\.ya?ml$/i.test(file)) return <DependencyGraphArtifactReport data={data} />

  const mainEntries = Object.entries(data).filter(([, value]) => Array.isArray(value) || isRecord(value))
  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Process", stringValue(data, "process_name", stringValue(data, "domain", "—"))],
          ["Version", stringValue(data, "version")],
          ["Artifact", file.replace(/\.ya?ml$/i, "")],
          ["Sections", String(mainEntries.length)],
        ]}
      />
      <div className="grid gap-4">
        {mainEntries.slice(0, 10).map(([key, value]) => (
          <StructuredSection key={key} name={key} value={value} />
        ))}
      </div>
    </div>
  )
}

function ProcessMapArtifactReport({ data }: { data: Record<string, unknown> }) {
  const phases = arrayValue(data, "phases").map((item) => asDisplayRecord(item))
  const totalPainPoints = phases.reduce((total, phase) => total + arrayValue(phase, "pain_points").length, 0)
  const driftCount = phases.filter((phase) => {
    const drift = stringValue(phase, "drift_delta", "")
    return /drift|major|gap|inconsist/i.test(drift)
  }).length

  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Process", stringValue(data, "process_name")],
          ["Type", stringValue(data, "type")],
          ["Phases", String(phases.length)],
          ["Pain points", String(totalPainPoints)],
        ]}
      />
      <section className="grid gap-px border border-[var(--rule)] bg-[var(--rule)] lg:grid-cols-3">
        <ReportCallout label="Evidence base" value={shortPreview(recordValue(data, "evidence_base"), 260)} />
        <ReportCallout label="Mapped by" value={stringValue(data, "mapped_by")} />
        <ReportCallout label="Drift phases" value={`${driftCount} de ${phases.length}`} />
      </section>
      <div className="grid gap-4">
        {phases.map((phase, index) => {
          const painPoints = arrayValue(phase, "pain_points")
          const drift = stringValue(phase, "drift_delta", "")
          const hasDrift = /drift|major|gap|inconsist/i.test(drift)
          return (
            <section key={stringValue(phase, "phase_id", `phase-${index}`)} className="border border-[var(--rule)] bg-[var(--paper)]">
              <header className="grid gap-4 border-b border-[var(--rule)] bg-[var(--paper-alt)] p-4 lg:grid-cols-[76px_minmax(0,1fr)_120px]">
                <div className="text-[22px] font-black tabular-nums text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    {stringValue(phase, "phase_id")} · {stringValue(phase, "executor_type")}
                  </div>
                  <h3 className="mt-1 text-[22px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {stringValue(phase, "name")}
                  </h3>
                </div>
                <span className={cn("h-fit border px-2 py-1 text-center text-[9px] uppercase tracking-[0.12em]", hasDrift ? "border-[var(--warning-ink)] text-[var(--warning-ink)]" : "border-[var(--lime-ink)] text-[var(--lime-ink)]")} style={{ fontFamily: MONO_FONT }}>
                  {hasDrift ? "drift" : "stable"}
                </span>
              </header>
              <div className="grid gap-px bg-[var(--rule-soft)] lg:grid-cols-3">
                <ReportTextBlock label="Declared" value={recordValue(phase, "declared_protocol")} />
                <ReportTextBlock label="Observed" value={recordValue(phase, "observed_behavior")} />
                <ReportTextBlock label="Delta" value={recordValue(phase, "drift_delta")} />
              </div>
              {painPoints.length > 0 && (
                <div className="border-t border-[var(--rule)] p-4">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    Pain points
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {painPoints.map((point, pointIndex) => (
                      <div key={`${pointIndex}-${shortPreview(point, 24)}`} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] px-3 py-2 text-[13px] leading-[1.45] text-[var(--ink-2)]">
                        {shortPreview(point, 180)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function DomainMapArtifactReport({ data }: { data: Record<string, unknown> }) {
  const entries = arrayValue(data, "domain_mapping").map((item) => asDisplayRecord(item))
  const byDomain = entries.reduce((map, entry) => {
    const domain = stringValue(entry, "domain", "Unclassified")
    const current = map.get(domain) ?? []
    current.push(entry)
    map.set(domain, current)
    return map
  }, new Map<string, Record<string, unknown>[]>())
  const gapCount = entries.filter((entry) => stringValue(entry, "gap_closed", "") !== "").length
  const typeCount = new Set(entries.map((entry) => stringValue(entry, "type", "standard"))).size

  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Mapping", stringValue(data, "domain_mapping_name")],
          ["Items", String(entries.length)],
          ["Domains", String(byDomain.size)],
          ["Gaps closed", String(gapCount)],
        ]}
      />
      <section className="grid gap-px border border-[var(--rule)] bg-[var(--rule)] lg:grid-cols-3">
        <ReportCallout label="Type" value={stringValue(data, "type")} />
        <ReportCallout label="Designed by" value={stringValue(data, "designed_by")} />
        <ReportCallout label="Item types" value={String(typeCount)} />
      </section>
      <div className="grid gap-5">
        {Array.from(byDomain.entries()).map(([domain, items]) => (
          <section key={domain} className="border border-[var(--rule)] bg-[var(--paper)]">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] bg-[var(--paper-alt)] p-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  SINKRA domain
                </p>
                <h3 className="mt-1 text-[24px] font-black tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {domain}
                </h3>
              </div>
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                {items.length} items
              </span>
            </header>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {items.slice(0, 18).map((entry) => (
                <article key={stringValue(entry, "task_id")} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-3">
                  <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    {stringValue(entry, "task_id")} · {stringValue(entry, "hierarchy_level", "level")}
                  </div>
                  <h4 className="mt-1 line-clamp-2 text-[15px] font-black leading-tight text-[var(--ink)]">
                    {stringValue(entry, "task_name")}
                  </h4>
                  <p className="mt-2 line-clamp-3 text-[12px] leading-[1.45] text-[var(--ink-2)]">
                    {shortPreview(recordValue(entry, "justification"), 220)}
                  </p>
                  {stringValue(entry, "gap_closed", "") && (
                    <div className="mt-3 inline-flex border border-[var(--lime-ink)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--lime-ink)]" style={{ fontFamily: MONO_FONT }}>
                      {stringValue(entry, "gap_closed")}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function DependencyGraphArtifactReport({ data }: { data: Record<string, unknown> }) {
  const graph = asDisplayRecord(recordValue(data, "graph"))
  const nodes = arrayValue(graph, "nodes").map((item) => asDisplayRecord(item))
  const roots = arrayValue(graph, "roots")
  const leaves = arrayValue(graph, "leaves")
  const loops = nodes.filter((node) => booleanValue(node, "loop_edge"))
  const validation = asDisplayRecord(recordValue(data, "dag_validation"))

  return (
    <div className="grid gap-5">
      <StructuredSummaryStrip
        items={[
          ["Graph", stringValue(graph, "type", stringValue(data, "type"))],
          ["Nodes", String(nodes.length)],
          ["Roots", String(roots.length)],
          ["Leaves", String(leaves.length)],
        ]}
      />
      <section className="grid gap-px border border-[var(--rule)] bg-[var(--rule)] lg:grid-cols-4">
        <ReportCallout label="Validated" value={stringValue(data, "validated")} />
        <ReportCallout label="Strict DAG" value={stringValue(validation, "strict_dag_without_runtime_loop_edges")} />
        <ReportCallout label="Guarded loops" value={stringValue(validation, "runtime_loop_edges_are_guarded")} />
        <ReportCallout label="Loop edges" value={String(loops.length)} />
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-[var(--rule)] bg-[var(--paper)]">
          <header className="border-b border-[var(--rule)] bg-[var(--paper-alt)] p-4">
            <h3 className="text-[22px] font-black tracking-[-0.03em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
              Dependency lanes
            </h3>
          </header>
          <div className="divide-y divide-[var(--rule-soft)]">
            {nodes.slice(0, 42).map((node, index) => {
              const depends = arrayValue(node, "depends_on")
              const feeds = arrayValue(node, "feeds_into")
              return (
                <div key={stringValue(node, "task_id", `node-${index}`)} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <strong className="block truncate text-[13px] text-[var(--ink)]">{stringValue(node, "task_id")}</strong>
                    {booleanValue(node, "loop_edge") && (
                      <span className="mt-1 inline-flex border border-[var(--warning-ink)] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[var(--warning-ink)]" style={{ fontFamily: MONO_FONT }}>
                        loop
                      </span>
                    )}
                  </div>
                  <DependencyPills label="Depends on" values={depends} />
                  <DependencyPills label="Feeds into" values={feeds} />
                </div>
              )
            })}
          </div>
        </section>
        <aside className="grid gap-4 content-start">
          <DependencyList title="Roots" values={roots} />
          <DependencyList title="Leaves" values={leaves} />
          <StructuredSection name="validation_notes" value={recordValue(validation, "notes")} />
        </aside>
      </div>
    </div>
  )
}

function ReportCallout({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--paper)] p-4">
      <div className="text-[9px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        {label}
      </div>
      <div className="mt-1 text-[13px] font-bold leading-[1.45] text-[var(--ink)]">
        {value || "—"}
      </div>
    </div>
  )
}

function ReportTextBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="bg-[var(--paper)] p-4">
      <div className="mb-2 text-[9px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        {label}
      </div>
      <p className="whitespace-pre-line text-[13px] leading-[1.5] text-[var(--ink-2)]">
        {shortPreview(value, 520)}
      </p>
    </div>
  )
}

function DependencyPills({ label, values }: { label: string; values: unknown[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.length > 0 ? values.slice(0, 6).map((value) => (
          <span key={String(value)} className="max-w-full truncate border border-[var(--rule-soft)] bg-[var(--paper-alt)] px-2 py-1 text-[11px] text-[var(--ink-2)]">
            {String(value)}
          </span>
        )) : (
          <span className="text-[12px] text-[var(--ink-3)]">—</span>
        )}
      </div>
    </div>
  )
}

function DependencyList({ title, values }: { title: string; values: unknown[] }) {
  return (
    <section className="border border-[var(--rule)] bg-[var(--paper)] p-4">
      <h3 className="text-[18px] font-black tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
        {title}
      </h3>
      <div className="mt-3 grid gap-1.5">
        {values.map((value) => (
          <div key={String(value)} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] px-2 py-1.5 text-[12px] text-[var(--ink-2)]">
            {String(value)}
          </div>
        ))}
      </div>
    </section>
  )
}

function StructuredSummaryStrip({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-px bg-[var(--rule)] sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <MetricTile key={label} label={label} value={value || "—"} />
      ))}
    </div>
  )
}

function asDisplayRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function StructuredSection({ name, value }: { name: string; value: unknown }) {
  const rows = Array.isArray(value)
    ? value.slice(0, 12).map((item, index) => [String(index + 1).padStart(2, "0"), item] as [string, unknown])
    : isRecord(value)
      ? Object.entries(value).slice(0, 18)
      : [["value", value] as [string, unknown]]
  const total = Array.isArray(value) ? value.length : isRecord(value) ? Object.keys(value).length : 1

  return (
    <section className="border border-[var(--rule)] bg-[var(--paper)]">
      <header className="grid gap-3 border-b border-[var(--rule)] bg-[var(--paper-alt)] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            {Array.isArray(value) ? "array" : isRecord(value) ? "object" : typeof value}
          </div>
          <h3 className="mt-1 truncate text-[20px] font-black tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
            {name}
          </h3>
        </div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
          {total} item{total === 1 ? "" : "s"}
        </div>
      </header>
      <div className="divide-y divide-[var(--rule-soft)]">
        {rows.map(([key, rowValue]) => (
          <div key={key} className="grid gap-3 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
              {key}
            </div>
            <ValuePreview value={rowValue} />
          </div>
        ))}
      </div>
      {total > rows.length && (
        <footer className="border-t border-[var(--rule-soft)] px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
          + {total - rows.length} itens ocultos
        </footer>
      )}
    </section>
  )
}

function ValuePreview({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.slice(0, 8).map((item, index) => (
          <span key={`${index}-${shortPreview(item, 24)}`} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] px-2 py-1 text-[12px] text-[var(--ink-2)]">
            {shortPreview(item, 42)}
          </span>
        ))}
        {value.length > 8 && <span className="px-2 py-1 text-[12px] text-[var(--ink-3)]">+{value.length - 8}</span>}
      </div>
    )
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).slice(0, 8)
    return (
      <div className="grid gap-1.5 md:grid-cols-2">
        {entries.map(([key, item]) => (
          <div key={key} className="min-w-0 border border-[var(--rule-soft)] bg-[var(--paper-alt)] px-2 py-1.5">
            <div className="truncate text-[9px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>{key}</div>
            <div className="truncate text-[12px] text-[var(--ink)]">{shortPreview(item, 72)}</div>
          </div>
        ))}
      </div>
    )
  }

  return <div className="text-[14px] leading-[1.55] text-[var(--ink)]">{shortPreview(value, 220)}</div>
}

function SinkraWorkflowView({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const workflows = sinkra?.workflows ?? []
  return (
    <LightScrollArea className="flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <article className="mx-auto w-full min-w-0 max-w-[1320px]">
        <SinkraHeader eyebrow="SINKRA workflow" title={sinkra?.processName || "Workflow"} meta={[`${workflows.length} workflows`, `${workflows.reduce((total, wf) => total + wf.steps.length, 0)} steps`, sinkra?.mode || "structured"]} />
        <div className="grid gap-5">
          {workflows.map((workflow) => (
            <section key={workflow.id} className="border border-[var(--rule)] bg-[var(--paper)]">
              <div className="grid gap-4 border-b border-[var(--rule)] bg-[var(--paper-alt)] p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    {workflow.id} · {workflow.layer || "layer"}
                  </div>
                  <h3 className="mt-1 text-[24px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {workflow.name}
                  </h3>
                  {workflow.description && (
                    <p className="mt-2 max-w-[900px] text-[14px] leading-[1.55] text-[var(--ink-2)]">
                      {workflow.description}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-px bg-[var(--rule)] text-[10px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO_FONT }}>
                  <MetricTile label="Trigger" value={workflow.trigger || "—"} />
                  <MetricTile label="Steps" value={String(workflow.steps.length)} />
                  <MetricTile label="Freq." value={workflow.frequency || "—"} wide />
                </div>
              </div>
              <div className="grid">
                {workflow.steps.map((step, index) => (
                  <div key={step.id} className="grid grid-cols-[46px_minmax(0,1fr)_96px] gap-4 border-b border-[var(--rule-soft)] px-4 py-3 last:border-b-0">
                    <div className="text-[12px] tabular-nums text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <strong className="text-[14px] text-[var(--ink)]">{step.name}</strong>
                        <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                          {step.phase || "phase"} · {step.task || "task"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                      {step.executor || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </LightScrollArea>
  )
}

function SinkraTasksView({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const tasks = sinkra?.tasks ?? []
  return (
    <LightScrollArea className="flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <article className="mx-auto w-full min-w-0 max-w-[1280px]">
        <SinkraHeader eyebrow="SINKRA task anatomy" title="Tasks" meta={[`${tasks.length} tasks`, sinkra?.version ? `v${sinkra.version}` : "version —"]} />
        <div className="overflow-x-auto border border-[var(--rule)] bg-[var(--paper)]">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[minmax(180px,1.5fr)_110px_100px_80px_80px_90px] border-b border-[var(--rule)] bg-[var(--paper-alt)] px-4 py-3 text-[10px] uppercase tracking-[0.13em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
              <span>Task</span><span>Layer</span><span>Executor</span><span>Inputs</span><span>Outputs</span><span>Checks</span>
            </div>
            {tasks.map((task) => (
              <div key={task.id} className="grid grid-cols-[minmax(180px,1.5fr)_110px_100px_80px_80px_90px] items-center border-b border-[var(--rule-soft)] px-4 py-3 last:border-b-0">
                <strong className="min-w-0 truncate text-[13px] text-[var(--ink)]">{task.id}</strong>
                <span className="text-[12px] text-[var(--ink-2)]">{task.layer || "—"}</span>
                <span className="text-[12px] text-[var(--ink-2)]">{task.executor || "—"}</span>
                <span className="text-[18px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{task.inputCount}</span>
                <span className="text-[18px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>{task.outputCount}</span>
                <span className="text-[12px] text-[var(--ink-2)]">{task.preconditions + task.postconditions}</span>
              </div>
            ))}
          </div>
        </div>
      </article>
    </LightScrollArea>
  )
}

function SinkraGatesView({ sinkra }: { sinkra?: ObservatoryTypeSpecific["sinkra"] }) {
  const gates = sinkra?.gates ?? []
  return (
    <LightScrollArea className="flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <article className="mx-auto w-full min-w-0 max-w-[1280px]">
        <SinkraHeader eyebrow="SINKRA quality gates" title="Gates" meta={[`${gates.length} gates`, sinkra?.score.result || "result —", sinkra?.score.score === null ? "score —" : `score ${sinkra?.score.score}`]} />
        <div className="grid gap-3 lg:grid-cols-2">
          {gates.map((gate) => (
            <section key={gate.id} className="border border-[var(--rule)] bg-[var(--paper)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                    {gate.id} · {gate.type || "gate"}
                  </div>
                  <h3 className="mt-1 text-[18px] font-black leading-tight tracking-[-0.025em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {gate.name}
                  </h3>
                </div>
                {gate.veto && (
                  <span className="border border-[var(--lime-ink)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--lime-ink)]" style={{ fontFamily: MONO_FONT }}>
                    veto
                  </span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-px bg-[var(--rule)]">
                <MetricTile label="Executor" value={gate.executor || "—"} />
                <MetricTile label="Threshold" value={gate.threshold} />
                <MetricTile label="Criteria" value={String(gate.criteriaCount)} />
              </div>
              {gate.position && (
                <p className="mt-3 text-[13px] leading-[1.5] text-[var(--ink-2)]">{gate.position}</p>
              )}
            </section>
          ))}
        </div>
      </article>
    </LightScrollArea>
  )
}

function SinkraHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string[] }) {
  return (
    <header className="mb-6 border-b border-[var(--rule)] pb-5">
      <p className="mb-2 text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        {eyebrow}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[28px] font-black leading-none tracking-[-0.04em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
          {title}
        </h2>
        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
          {meta.filter(Boolean).map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
    </header>
  )
}

function MetricTile({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("bg-[var(--paper)] px-3 py-2", wide && "col-span-2")}>
      <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-bold normal-case tracking-[0] text-[var(--ink)]">{value}</div>
    </div>
  )
}

function ScoreView({
  dimensions,
  scoreMetrics,
}: {
  dimensions: ObservatoryScoreDimension[]
  scoreMetrics: Array<{ label: string; value: string }>
}) {
  const compactWeight = (weight: string, index: number) => {
    const numeric = Number(weight)
    if (Number.isFinite(numeric)) {
      return numeric > 1 ? `${Math.round(numeric)}%` : `${Math.round(numeric * 100)}%`
    }
    return weight || `D${index + 1}`
  }

  return (
    <LightScrollArea className="flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 sm:pb-14 sm:pt-6 lg:px-8 lg:pb-16">
      <article className="mx-auto w-full min-w-0 max-w-[1280px]">
        <header className="mb-6 border-b border-[var(--rule)] pb-5">
          <p
            className="mb-2 text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-3)]"
            style={{ fontFamily: MONO_FONT }}
          >
            Bench scorecard
          </p>
          <h2
            className="text-[22px] font-black leading-none tracking-[-0.04em] text-[var(--ink)] sm:text-[26px] lg:text-[30px]"
            style={{ fontFamily: DISPLAY_FONT }}
          >
            Scorecard
          </h2>
        </header>

        {dimensions.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {dimensions.map((dimension, index) => {
              const scores = dimension.scores
                .map((score) => ({ ...score, numeric: Number(score.value) }))
                .filter((score) => Number.isFinite(score.numeric))
                .sort((a, b) => b.numeric - a.numeric)
              const winner = dimension.winner && dimension.winner !== "--" ? dimension.winner : scores[0]?.label
              return (
                <section key={`${dimension.name}-${index}`} className="min-w-0 border border-[var(--rule)] bg-[var(--paper)] p-4">
                  <div
                    className="mb-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    <span>{compactWeight(dimension.weight, index)}</span>
                    <span className="truncate text-right">
                      {winner ? `winner · ${winner}` : dimension.delta}
                    </span>
                  </div>
                  <h3 className="text-[19px] font-black leading-tight tracking-[-0.035em] text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                    {dimension.name}
                  </h3>
                  {dimension.evidence && (
                    <p className="mt-2 line-clamp-2 text-[14px] italic leading-[1.45] text-[var(--ink-2)]" style={{ fontFamily: SERIF_FONT }}>
                      {dimension.evidence}
                    </p>
                  )}
                  <div className="mt-4 space-y-2.5">
                    {scores.length > 0 ? (
                      scores.map((score, scoreIndex) => (
                        <div
                          key={`${dimension.name}-${score.label}`}
                          className="grid grid-cols-[88px_minmax(0,1fr)_40px] items-center gap-2 sm:grid-cols-[110px_minmax(0,1fr)_42px] sm:gap-3"
                        >
                          <span className="truncate text-[12px] font-bold text-[var(--ink)]">
                            {score.label}
                          </span>
                          <span className="h-2 bg-[var(--paper-deep)]">
                            <span
                              className={cn(
                                "block h-full",
                                scoreIndex === 0 ? "bg-[var(--lime-fill)]" : "bg-[var(--ink)]",
                              )}
                              style={{ width: `${Math.max(0, Math.min(100, score.numeric))}%` }}
                            />
                          </span>
                          <span className="text-right text-[15px] font-black text-[var(--ink)]">
                            {score.numeric}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        className="border-t border-[var(--rule-soft)] pt-3 text-[13px] italic leading-[1.45] text-[var(--ink-3)]"
                        style={{ fontFamily: SERIF_FONT }}
                      >
                        Sem scores numéricos estruturados nesta dimensão.
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scoreMetrics.map((metric) => (
              <div key={metric.label} className="border border-[var(--rule-soft)] bg-[var(--paper-alt)] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
                  {metric.label}
                </div>
                <div className="mt-1 text-[22px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </LightScrollArea>
  )
}

function OverviewView({ runs }: { runs: ObservatoryRunSummary[] }) {
  const statusCounts = countBy(runs, (run) => run.status || "unknown")
  const schemaCounts = countBy(runs, (run) => run.schema || "unknown")
  const readinessRows = runs.slice(0, 18).map((run) => {
    const extras = run.extras ?? {}
    return {
      slug: run.slug,
      title: run.displayTitle,
      cells: [
        Boolean(extras.hasCore),
        Boolean(extras.hasMetrics),
        Boolean(extras.hasState),
        Boolean(extras.hasLog),
        Boolean(extras.hasSources),
      ],
    }
  })
  const datedRuns = [...runs].sort((a, b) => a.date.localeCompare(b.date))
  const maxSources = Math.max(1, ...runs.map((run) => Number(run.sources) || 0))
  const maxFiles = Math.max(1, ...runs.map((run) => run.files || 0))
  const completed = runs.filter((run) => /complete|completed/i.test(run.status)).length
  const rich = runs.filter((run) => {
    const extras = run.extras ?? {}
    return extras.hasCore && extras.hasMetrics && extras.hasState && extras.hasSources
  }).length

  /* Cut 06 — Trust: coverage × integrity */
  const scatterPoints: ScatterPoint[] = runs
    .map((run) => {
      const cov = coverageNumeric(run.coverage)
      const integ = coverageNumeric(run.integrity)
      if (cov == null || integ == null) return null
      return {
        x: cov,
        y: integ,
        label: run.displayTitle.slice(0, 14),
        highlight: integ >= 0.85,
      }
    })
    .filter((p): p is ScatterPoint => p !== null)
  const aboveThreshold = scatterPoints.filter((p) => p.highlight).length

  /* Cut 07 — Cadence: timeline. Filter runs without parseable dates
   * (bench corpus can emit `date: ""` when metadata is missing). */
  const timelinePoints: TimelinePoint[] = runs
    .filter((run) => run.date && !Number.isNaN(new Date(run.date).getTime()))
    .map((run) => ({
      date: run.date,
      label: run.displayTitle.slice(0, 14),
      statusKey: statusKeyFromRaw(run.status),
    }))

  /* Cut 08 — Stop-reason taxonomy */
  const stopReasonCategories: Array<{ cat: string; it: string; desc: string; pattern: RegExp }> = [
    {
      cat: "Halted before report",
      it: "pipeline stalled",
      desc: "Query and prompt were generated, then the run stalled. No synthesis ever happened.",
      pattern: /apenas prompt|sem report|parou após prompt|prompt prontos/i,
    },
    {
      cat: "Synthesis without metrics",
      it: "unverified",
      desc: "Report exists on disk but the integrity score was never computed. Citations cannot be vouched for.",
      pattern: /métricas não escritas|métricas ausentes|state ausente|missing metric/i,
    },
    {
      cat: "Complete & consolidated",
      it: "validated",
      desc: "Core artifacts present, metrics computed, readiness flags green. Citeable in production.",
      pattern: /core completo|métricas consolidadas|validados|deep research consolidado|métricas validadas|sem follow-up necessário|recommendations entregues|pronto para revisão/i,
    },
    {
      cat: "Schema-legacy",
      it: "pre-v2",
      desc: "Written under the old contract. Migration is mechanical but unscheduled.",
      pattern: /schema legado|legacy|migração para v2/i,
    },
  ]
  /* Classify each run into EXACTLY ONE category (first pattern that matches wins).
   * Then count occurrences per category — guarantees Σ counts ≤ total. */
  function classifyRun(run: ObservatoryRunSummary): number {
    const reason = String(run.extras?.stopReason ?? run.status ?? "")
    for (let i = 0; i < stopReasonCategories.length; i += 1) {
      if (stopReasonCategories[i].pattern.test(reason)) return i
    }
    /* Fallback by status key when no pattern matches */
    const sk = statusKeyFromRaw(run.status)
    if (sk === "completed") return 2 /* Complete & consolidated */
    if (sk === "partial") return 0   /* Halted before report */
    if (sk === "legacy") return 3    /* Schema-legacy */
    if (sk === "missing") return 1   /* Synthesis without metrics */
    return -1                         /* Unclassified */
  }
  const taxonomyCounts = new Array(stopReasonCategories.length).fill(0)
  for (const run of runs) {
    const idx = classifyRun(run)
    if (idx >= 0) taxonomyCounts[idx] += 1
  }
  const taxonomyItems: TaxonomyItem[] = stopReasonCategories.map((c, i) => ({
    cat: c.cat,
    it: c.it,
    count: taxonomyCounts[i],
    desc: c.desc,
  }))

  return (
    <LightScrollArea className="flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 sm:pb-14 sm:pt-6 lg:px-10 lg:pb-16 lg:pt-7">
      <article className="mx-auto w-full min-w-0 max-w-[1260px]">
        <header className="mb-6 grid gap-4 border-b border-[var(--rule)] pb-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p
              className="mb-2 text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-3)]"
              style={{ fontFamily: MONO_FONT }}
            >
              Research corpus
            </p>
            <h2
              className="text-[24px] font-black leading-none tracking-[-0.045em] text-[var(--ink)] sm:text-[28px] lg:text-[34px]"
              style={{ fontFamily: DISPLAY_FONT }}
            >
              Visão geral das pesquisas
            </h2>
            <p
              className="mt-3 max-w-3xl text-[16px] italic leading-[1.55] text-[var(--ink-3)]"
              style={{ fontFamily: SERIF_FONT }}
            >
              Um mapa rápido de status, profundidade, contrato de saída e densidade de evidência do corpus em
              `docs/research`.
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-px border border-[var(--rule)] bg-[var(--rule)] text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: MONO_FONT }}
          >
            {[
              ["runs", runs.length],
              ["complete", completed],
              ["rich", rich],
              ["span", `${datedRuns[0]?.date ?? "--"} → ${datedRuns.at(-1)?.date ?? "--"}`],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--paper-alt)] p-3">
                <div className="text-[var(--ink-3)]">{label}</div>
                <div className="mt-1 text-[16px] font-black text-[var(--ink)]">{value}</div>
              </div>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          <OverviewPanel className="col-span-12 lg:col-span-4" eyebrow="Cut 01" title="Status">
            <Bars data={statusCounts} total={runs.length} />
          </OverviewPanel>
          <OverviewPanel className="col-span-12 lg:col-span-4" eyebrow="Cut 02" title="Schemas">
            <Bars data={schemaCounts} total={runs.length} />
          </OverviewPanel>
          <OverviewPanel className="col-span-12 lg:col-span-4" eyebrow="Cut 03" title="Wave depth">
            <Bars
              data={countBy(runs, (run) => (run.waves >= 3 ? "3+ waves" : `${run.waves || 0} waves`))}
              total={runs.length}
            />
          </OverviewPanel>

          <OverviewPanel className="col-span-12 xl:col-span-7" eyebrow="Cut 04" title="Readiness">
            <div className="space-y-1">
              <div
                className="grid grid-cols-[minmax(0,1fr)_repeat(5,34px)] gap-1 text-[9px] uppercase tracking-[0.1em] text-[var(--ink-3)]"
                style={{ fontFamily: MONO_FONT }}
              >
                <span>run</span>
                {["core", "met", "state", "log", "src"].map((label) => (
                  <span key={label} className="text-center">{label}</span>
                ))}
              </div>
              {readinessRows.map((row) => (
                <div
                  key={row.slug}
                  className="grid grid-cols-[minmax(0,1fr)_repeat(5,34px)] gap-1"
                >
                  <span
                    className="truncate text-[11px] text-[var(--ink-2)]"
                    style={{ fontFamily: MONO_FONT }}
                    title={row.title}
                  >
                    {row.title}
                  </span>
                  {row.cells.map((on, index) => (
                    <span
                      key={`${row.slug}-${index}`}
                      className={cn("h-5 border border-[var(--rule-soft)]", on ? "bg-[var(--ink)]" : "bg-[var(--paper-deep)]")}
                    />
                  ))}
                </div>
              ))}
            </div>
          </OverviewPanel>

          <OverviewPanel className="col-span-12 xl:col-span-5" eyebrow="Cut 05" title="Sources × files">
            <div className="relative h-[250px] border border-[var(--rule-soft)] bg-[var(--paper-alt)]">
              {runs.map((run) => {
                const x = ((Number(run.sources) || 0) / maxSources) * 88 + 4
                const y = 92 - ((run.files || 0) / maxFiles) * 84
                const size = Math.max(6, Math.min(18, 6 + run.waves * 3))
                return (
                  <span
                    key={run.slug}
                    className="absolute rounded-full border border-[var(--ink)] bg-[var(--lime-ink)]"
                    title={`${run.displayTitle}: ${run.sources} fontes, ${run.files} arquivos`}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      width: size,
                      height: size,
                      opacity: /complete|completed/i.test(run.status) ? 0.9 : 0.45,
                    }}
                  />
                )
              })}
              <span
                className="absolute bottom-2 left-3 text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                style={{ fontFamily: MONO_FONT }}
              >
                fontes →
              </span>
              <span
                className="absolute left-3 top-2 text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                style={{ fontFamily: MONO_FONT }}
              >
                arquivos ↑
              </span>
            </div>
          </OverviewPanel>

          <OverviewPanel className="col-span-12 xl:col-span-8" eyebrow="Cut 06" title="Trust · coverage × integrity">
            {scatterPoints.length > 0 ? (
              <div className="h-[260px]">
                <ScatterChart points={scatterPoints} threshold={0.85} thresholdLabel="trust threshold · 0.85" />
              </div>
            ) : (
              <p
                className="px-2 py-4 text-[12.5px] italic text-[var(--ink-3)]"
                style={{ fontFamily: SERIF_FONT }}
              >
                Nenhuma run tem ambos coverage e integrity numéricos.
              </p>
            )}
            <div
              className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] tracking-[0.08em] text-[var(--ink-3)]"
              style={{ fontFamily: MONO_FONT }}
            >
              <span>
                <strong className="text-[var(--ink)]">{scatterPoints.length}</strong>/{runs.length} reportáveis
              </span>
              <span>
                <strong className="text-[var(--ink)]">{aboveThreshold}</strong> acima do threshold
              </span>
            </div>
          </OverviewPanel>

          <OverviewPanel className="col-span-12 xl:col-span-4" eyebrow="Cut 07" title="Stop reasons">
            <TaxonomyList items={taxonomyItems} total={runs.length} />
          </OverviewPanel>

          <OverviewPanel className="col-span-12" eyebrow="Cut 08" title="Cadence · timeline">
            <div className="h-[220px]">
              <TimelineChart points={timelinePoints} />
            </div>
            <div
              className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] tracking-[0.08em] text-[var(--ink-3)]"
              style={{ fontFamily: MONO_FONT }}
            >
              <span>
                span <strong className="text-[var(--ink)]">{datedRuns[0]?.date ?? "—"}</strong> →{" "}
                <strong className="text-[var(--ink)]">{datedRuns.at(-1)?.date ?? "—"}</strong>
              </span>
              <span>
                <strong className="text-[var(--ink)]">{runs.length}</strong> runs
              </span>
            </div>
          </OverviewPanel>
        </div>
      </article>
    </LightScrollArea>
  )
}

function OverviewPanel({
  eyebrow,
  title,
  className,
  children,
}: {
  eyebrow: string
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("border border-[var(--rule)] bg-[var(--paper)] p-4", className)}>
      <div
        className="mb-3 flex items-baseline justify-between border-b border-[var(--rule-soft)] pb-2 text-[10px] uppercase tracking-[0.15em] text-[var(--ink-3)]"
        style={{ fontFamily: MONO_FONT }}
      >
        <span>{eyebrow}</span>
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

function Bars({ data, total }: { data: Array<[string, number]>; total: number }) {
  return (
    <div className="space-y-3">
      {data.map(([label, value]) => (
        <div key={label}>
          <div
            className="mb-1 flex justify-between gap-3 text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]"
            style={{ fontFamily: MONO_FONT }}
          >
            <span className="truncate">{label}</span>
            <span>{value}</span>
          </div>
          <div className="h-2 bg-[var(--paper-deep)]">
            <div
              className="h-full bg-[var(--ink)]"
              style={{ width: `${total === 0 ? 0 : Math.max(4, (value / total) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Array<[string, number]> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFor(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function SourcesView({
  sources,
  sourceSummary,
}: {
  sources: ObservatorySource_Entry[]
  sourceSummary: string[]
}) {
  const high = sources.filter((source) => source.credibility === "HIGH")
  const dated = sources.filter((source) => source.date && source.date !== "—")
  const flagged = sources.filter((source) => source.flags.length > 0)
  const hosts = countBy(sources, (source) => sourceHost(source.url)).slice(0, 8)

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="evidence system"
          title="Fontes que sustentam a pesquisa"
          copy="Qualidade, variedade e concentração da base empírica. A ação principal é abrir rapidamente a fonte externa quando precisar auditar."
          accentValue={String(sources.length)}
          accentLabel="fontes indexadas"
          metrics={[
            ["High", high.length],
            ["Com data", dated.length],
            ["Flags", flagged.length],
          ]}
        />

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="aiox-panel bg-[#0f0f11]">
            <ResearchPanelHead eyebrow="source register" title="Registro de evidências" meta={`${high.length}/${sources.length} high`} />
            <div className="grid gap-px bg-[#f5f4e7]/10 p-px md:grid-cols-2">
              {sources.map((source, index) => (
                <article key={source.id || source.url || `${source.title}-${index}`} className="grid min-w-0 gap-3 bg-[#050505] p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/28" style={{ fontFamily: MONO_FONT }}>{String(index + 1).padStart(2, "0")}</span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>{source.credibility || "—"}</span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>{sourceHost(source.url)}</span>
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group mt-2 block cursor-pointer text-[#f5f4e7] transition-colors hover:text-[#d1ff00]"
                    >
                      <h3 className="aiox-safe-text text-[20px] font-black leading-[1.08] tracking-[-0.035em]" style={{ fontFamily: DISPLAY_FONT }}>
                        {source.title || source.url}
                      </h3>
                      <span className="mt-2 block truncate text-[12px] text-[#f5f4e7]/45 transition-colors group-hover:text-[#d1ff00]/70">
                        {source.url}
                      </span>
                    </a>
                    {source.flags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {source.flags.slice(0, 4).map((flag) => (
                          <span key={flag} className="border border-[#f5f4e7]/12 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#f5f4e7]/55" style={{ fontFamily: MONO_FONT }}>
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#f5f4e7]/10 pt-3">
                    {typeof source.multiplier === "number" ? (
                      <span className="text-[22px] font-black leading-none text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>{source.multiplier}x</span>
                    ) : (
                      <span />
                    )}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="aiox-report-icon-button"
                      title="Abrir fonte"
                      aria-label={`Abrir fonte: ${source.title || source.url}`}
                    >
                      <ExternalLink size={15} strokeWidth={1.8} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="grid content-start gap-6">
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="credibilidade" title="Distribuição" meta={`${Math.round((high.length / Math.max(1, sources.length)) * 100)}% high`} />
              <ResearchDonutPanel
                total={sources.length}
                segments={[
                  { label: "High", value: high.length, color: "#d1ff00" },
                  { label: "Medium", value: sources.filter((source) => source.credibility === "MEDIUM").length, color: "#f5b340" },
                  { label: "Low", value: sources.filter((source) => source.credibility === "LOW").length, color: "#5c5c5c" },
                ]}
              />
            </section>
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="domains" title="Mix de fontes" meta={`${hosts.length} domínios`} />
              <div className="grid gap-3 p-4">
                {hosts.map(([host, count]) => (
                  <ResearchBar key={host} label={host} value={Math.round((count / Math.max(1, sources.length)) * 100)} />
                ))}
              </div>
            </section>
            {sourceSummary.length > 0 && (
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="summary" title="Leitura rápida" meta={`${sourceSummary.length} sinais`} />
                <div className="grid gap-2 p-4">
                  {sourceSummary.slice(0, 8).map((item) => (
                    <div key={item} className="border border-[#f5f4e7]/10 bg-[#050505] p-3 text-[13px] leading-[1.5] text-[#f5f4e7]/68">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </article>
    </LightScrollArea>
  )
}

function ResearchPlayersView({ players, documents, labels }: { players: ObservatoryPlayer[]; documents: ObservatoryDocument[]; labels: ResearchDashboardLabels }) {
  const docMap = new Map(documents.map((doc) => [doc.file, doc]))
  const decisionRubric = asDisplayRecord(parseOptionalArtifact(docMap.get("decision-rubric.yaml")))
  const tiers = [1, 2, 3] as const
  const included = players.filter((player) => !player.excluded)
  const excluded = players.filter((player) => player.excluded)
  const untiered = players.filter((player) => player.tier == null)
  const categories = countBy(players, (player) => player.category ?? "sem categoria").slice(0, 8)
  const tierMeaningFromData = (tier: 1 | 2 | 3, fallback: string) =>
    included.find((player) => player.tier === tier && player.tierMeaning)?.tierMeaning ?? fallback
  const tierMeta = {
    1: {
      label: "Tier 1",
      title: "Usar agora",
      meaning: tierMeaningFromData(1, "Peças primárias para construir a solução."),
    },
    2: {
      label: "Tier 2",
      title: "Aprender / copiar padrão",
      meaning: tierMeaningFromData(2, "Referências que informam a arquitetura, mas não são o centro."),
    },
    3: {
      label: "Tier 3",
      title: "Monitorar / adiar",
      meaning: tierMeaningFromData(3, "Contexto secundário, útil só se o escopo crescer."),
    },
  } as const
  const tierOne = included.filter((player) => player.tier === 1)
  const highFit = included.filter((player) => player.fit?.toLowerCase() === "high")
  const primaryAction = tierOne[0]?.action ?? tierOne[0]?.insight ?? "Definir qual player vira ação no roadmap."

  return (
    <LightScrollArea className="aiox-report-dark flex-1" viewportClassName="px-4 pb-12 pt-5 sm:px-6 lg:px-8" fadeColor="var(--report-bg)" style={observatoryDarkThemeVars}>
      <article className="aiox-report-shell" style={observatoryDarkThemeVars}>
        <ResearchCompactIntro
          eyebrow="market map"
          title={`${labels.players}, categorias e exclusões`}
          copy="Mapa compacto de quem entrou, quem saiu e quais categorias dominam a pesquisa. A leitura deve explicar o recorte, não virar catálogo."
          accentValue={String(players.length)}
          accentLabel={`${labels.players.toLowerCase()} detectados`}
          metrics={[
            ["Incluídos", included.length],
            ["Excluídos", excluded.length],
            ["Categorias", categories.length],
          ]}
        />

        <section className="aiox-panel mt-5 bg-[#0f0f11]">
          <ResearchPanelHead eyebrow="how to read" title="Como esta aba gera decisão" meta={`${tierOne.length} peças centrais`} />
          <div className="grid gap-px bg-[#f5f4e7]/10 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div className="bg-[#050505] p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
                leitura operacional
              </div>
              <p className="mt-3 max-w-[980px] text-[18px] font-black leading-[1.28] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
                {tierMeta[1].meaning} {tierMeta[2].meaning} {tierMeta[3].meaning}
              </p>
              <p className="mt-3 max-w-[900px] text-[14px] leading-[1.55] text-[#f5f4e7]/62">
                Para este run, o insight não é apenas “quem existe”; é quais itens entram na decisão, quais viram referência e quais devem ficar fora do plano principal.
              </p>
            </div>
            <div className="bg-[#d1ff00] p-5 text-[#050505]">
              <div className="text-[10px] uppercase tracking-[0.14em] opacity-65" style={{ fontFamily: MONO_FONT }}>
                próxima decisão
              </div>
              <p className="mt-3 text-[18px] font-black leading-[1.3]">{primaryAction}</p>
              <div className="mt-4 grid grid-cols-2 gap-px bg-[#050505]/20 text-[11px] uppercase tracking-[0.1em]" style={{ fontFamily: MONO_FONT }}>
                <div className="bg-[#d1ff00] py-2">high fit</div>
                <div className="bg-[#d1ff00] py-2 text-right">{highFit.length}</div>
              </div>
            </div>
          </div>
        </section>

        <ResearchDecisionRubricPanel rubric={decisionRubric} labels={labels} />

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="aiox-panel bg-[#0f0f11]">
            <ResearchPanelHead eyebrow="tiers" title={labels.players} meta={`${included.length} incluídos`} />
            <div className="border-b border-[#f5f4e7]/10 p-4">
              <ResearchPlayerQuadrant players={players} />
            </div>
            <div className="grid gap-px bg-[#f5f4e7]/10 p-px xl:grid-cols-3">
          {tiers.map((tier) => {
            const tierPlayers = players.filter((player) => player.tier === tier)
            const meta = tierMeta[tier]
            return (
              <section key={tier} className="min-w-0 bg-[#050505]">
                <div
                  className="border-b border-[#f5f4e7]/10 px-4 py-3"
                  style={{ fontFamily: MONO_FONT }}
                >
                  <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.16em] text-[#f5f4e7]/42">
                    <span>{meta.label} · {meta.title}</span>
                    <span>{tierPlayers.length}</span>
                  </div>
                  <p className="mt-1 text-[11px] normal-case leading-[1.35] tracking-normal text-[#f5f4e7]/45" style={{ fontFamily: SANS_FONT }}>
                    {meta.meaning}
                  </p>
                </div>
                <div className="grid gap-3 p-4">
                  {tierPlayers.length === 0 && (
                    <div className="text-[13px] text-[#f5f4e7]/45">Sem players neste tier.</div>
                  )}
                  {tierPlayers.map((player, index) => (
                    <ResearchPlayerCompactRow key={player.id || player.name} player={player} index={index} />
                  ))}
                </div>
              </section>
            )
          })}
            </div>
          </section>

          <aside className="grid content-start gap-6">
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="categories" title="Categorias" meta={`${categories.length}`} />
              <div className="grid gap-3 p-4">
                {categories.map(([category, count]) => (
                  <ResearchBar key={category} label={category} value={Math.round((count / Math.max(1, players.length)) * 100)} />
                ))}
              </div>
            </section>
          {untiered.length > 0 && (
              <section className="aiox-panel bg-[#0f0f11]">
                <ResearchPanelHead eyebrow="untiered" title="Sem tier" meta={`${untiered.length}`} />
                <div className="grid gap-3 p-4">
                {untiered.slice(0, 8).map((player) => (
                      <ResearchPlayerCompactRow key={player.id || player.name} player={player} />
                  ))}
              </div>
            </section>
          )}
          {excluded.length > 0 && (
            <section className="aiox-panel bg-[#0f0f11]">
              <ResearchPanelHead eyebrow="excluded" title="Descartados" meta={`${excluded.length}`} />
              <div className="grid gap-2 p-4">
                {excluded.slice(0, 8).map((player) => (
                  <div key={player.id || player.name} className="border border-[#f5f4e7]/10 bg-[#050505] p-3">
                    <div className="aiox-safe-text text-[15px] font-black text-[#f5f4e7]">{player.name}</div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-[#f5f4e7]/55">{player.exclusionReason ?? "Sem motivo estruturado."}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          </aside>
        </div>
      </article>
    </LightScrollArea>
  )
}

function ResearchPlayerCard({ player, index = 0 }: { player: ObservatoryPlayer; index?: number }) {
  return (
    <article className={cn("min-w-0 border bg-[#050505] p-4", player.excluded ? "border-[#f5f4e7]/10 opacity-55" : "border-[#f5f4e7]/14")}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
          {player.number || String(index + 1).padStart(2, "0")}
        </span>
        <span className="max-w-[160px] truncate text-right text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/38" style={{ fontFamily: MONO_FONT }}>
          {player.category ?? "sem categoria"}
        </span>
      </div>
      <h3 className="aiox-safe-text mt-3 text-[22px] font-black leading-[1.05] tracking-[-0.035em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
        {player.name}
      </h3>
      {player.whatItDoes && (
        <p className="mt-3 line-clamp-3 text-[13px] leading-[1.5] text-[#f5f4e7]/64">{player.whatItDoes}</p>
      )}
      {player.insight && (
        <p className="mt-3 border-t border-[#f5f4e7]/10 pt-3 text-[13px] leading-[1.5] text-[#d1ff00]/82">{player.insight}</p>
      )}
      {player.sourceTitle && (
        <div className="mt-4 text-[10px] uppercase tracking-[0.12em] text-[#f5f4e7]/34" style={{ fontFamily: MONO_FONT }}>
          {player.sourceTitle}
        </div>
      )}
    </article>
  )
}

function ResearchPlayerCompactRow({ player, index = 0 }: { player: ObservatoryPlayer; index?: number }) {
  return (
    <article className={cn("min-w-0 border border-[#f5f4e7]/10 bg-[#050505] p-3", player.excluded && "opacity-55")}>
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#d1ff00]" style={{ fontFamily: MONO_FONT }}>
          {player.number || String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <h3 className="aiox-safe-text text-[18px] font-black leading-[1.05] tracking-[-0.035em] text-[#f5f4e7]" style={{ fontFamily: DISPLAY_FONT }}>
              {player.name}
            </h3>
            <span className="max-w-[130px] shrink-0 truncate text-right text-[9px] uppercase tracking-[0.12em] text-[#f5f4e7]/35" style={{ fontFamily: MONO_FONT }}>
              {player.category ?? "sem categoria"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {player.fit && (
              <span className={cn(
                "border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]",
                player.fit.toLowerCase() === "high"
                  ? "border-[#d1ff00]/55 text-[#d1ff00]"
                  : "border-[#f5f4e7]/12 text-[#f5f4e7]/42",
              )} style={{ fontFamily: MONO_FONT }}>
                fit {player.fit}
              </span>
            )}
            {player.role && (
              <span className="border border-[#f5f4e7]/12 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#f5f4e7]/42" style={{ fontFamily: MONO_FONT }}>
                {player.role}
              </span>
            )}
          </div>
          {player.action && (
            <p className="mt-2 border-l border-[#d1ff00]/65 pl-2 text-[12.5px] font-bold leading-[1.42] text-[#d1ff00]/82">
              {player.action}
            </p>
          )}
          {(player.insight || player.whatItDoes) && (
            <p className="mt-2 line-clamp-2 text-[12.5px] leading-[1.45] text-[#f5f4e7]/62">
              {player.insight ?? player.whatItDoes}
            </p>
          )}
          {player.excluded && (
            <p className="mt-2 line-clamp-2 text-[12px] leading-[1.4] text-[#f5b340]/75">
              {player.exclusionReason ?? "Excluído do recorte."}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url || "sem domínio"
  }
}
