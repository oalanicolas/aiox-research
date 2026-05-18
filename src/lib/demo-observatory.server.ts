import "server-only"

import type {
  ObservatoryAdapterMeta,
  ObservatoryData,
  ObservatoryDocument,
  ObservatoryGapItem,
  ObservatoryMatrix,
  ObservatoryPersona,
  ObservatoryPlayerProfile,
  ObservatoryRunSummary,
  ObservatoryScoreDimension,
  ObservatoryTco,
} from "@/components/observatory/foundations/types"

const run: ObservatoryRunSummary = {
  slug: "demo-ai-ops-command-center",
  title: "AI Ops Command Center",
  displayTitle: "AI Ops Command Center",
  date: "2026-05-14",
  category: "demo",
  schema: "demo-bench-v1",
  status: "completed",
  coverage: "92",
  integrity: "deep",
  files: 12,
  waves: 3,
  sources: 18,
  active: true,
  extras: {
    subjects: ["AIOX Research", "Legacy BI", "Notion Stack", "Spreadsheet OS"],
    hasMetadata: true,
    hasScorecard: true,
    hasDeep: true,
    dashRows: 8,
    dashCoverage: "structured",
  },
}

const players: ObservatoryPlayerProfile[] = [
  { key: "aiox-research", name: "AIOX Research", category: "operational intelligence", type: "dashboard", license: "private", origin: "Sinkra", years: 1, techScore: 92, neutralScore: 89, color: "#d1ff00", letter: "A", tag: "recommended", repoUrl: "", vendorUrl: "" },
  { key: "legacy-bi", name: "Legacy BI", category: "analytics", type: "warehouse", license: "enterprise", origin: "incumbent", years: 8, techScore: 74, neutralScore: 77, color: "#70a7ff", letter: "B", tag: "stable", repoUrl: "", vendorUrl: "" },
  { key: "notion-stack", name: "Notion Stack", category: "workspace", type: "manual ops", license: "saas", origin: "operator", years: 3, techScore: 68, neutralScore: 71, color: "#f5b340", letter: "N", tag: "manual", repoUrl: "", vendorUrl: "" },
  { key: "spreadsheet-os", name: "Spreadsheet OS", category: "spreadsheet", type: "ad hoc", license: "office", origin: "ops", years: 12, techScore: 53, neutralScore: 58, color: "#ef4444", letter: "S", tag: "legacy", repoUrl: "", vendorUrl: "" },
]

const matrix: ObservatoryMatrix = {
  players: players.map((player) => player.key),
  method: "Demo weighted operational benchmark",
  totals: [
    { player: "aiox-research", score: 92 },
    { player: "legacy-bi", score: 78 },
    { player: "notion-stack", score: 72 },
    { player: "spreadsheet-os", score: 58 },
  ],
  rows: [
    row("D1", "Decisão executiva", 20, [95, 82, 70, 54], "AIOX combina síntese, evidência e ação em uma única narrativa."),
    row("D2", "Evidência rastreável", 18, [91, 86, 66, 48], "Fontes e artefatos ficam ligados ao veredito, não enterrados em docs."),
    row("D3", "Roadmap acionável", 16, [94, 71, 75, 62], "O sistema transforma gaps em waves, sprints e riscos."),
    row("D4", "Apresentação para stakeholders", 14, [96, 69, 64, 45], "Slides executivos reduzem fricção de leitura e aceleram decisão."),
    row("D5", "Automação e atualização", 12, [88, 79, 58, 42], "Dados podem ser regenerados por CLI e re-renderizados no painel."),
    row("D6", "Custo operacional", 8, [84, 70, 76, 82], "Planilhas vencem em custo inicial, mas perdem em coordenação."),
    row("D7", "Escalabilidade entre squads", 7, [90, 81, 62, 51], "Contratos estruturados reduzem variação entre times."),
    row("D8", "Clareza para humano", 5, [93, 68, 72, 60], "O foco é contar a decisão antes de expor a tabela."),
  ],
}

const scoreDimensions: ObservatoryScoreDimension[] = matrix.rows.map((item) => ({
  name: item.label,
  weight: `${item.weight}%`,
  winner: "AIOX Research",
  delta: String(Math.round(Math.max(...item.cells.map((cell) => cell.score)) - item.cells[1].score)),
  evidence: item.cells[0]?.notes ?? "",
  scores: item.cells.map((cell) => ({ label: cell.player, value: String(cell.score) })),
}))

const gapItems: ObservatoryGapItem[] = [
  { id: "G1", title: "Transformar demo em onboarding guiado", priority: "P0", complexity: "M", rationale: "Primeira instalação precisa explicar o valor sem depender de dados do usuário." },
  { id: "G2", title: "Gerar contratos de dados para novos benches", priority: "P0", complexity: "M", rationale: "Slides e roadmap ficam melhores quando gaps, cliffs e evidências são explicitamente produzidos." },
  { id: "G3", title: "Adicionar exportação futura", priority: "P1", complexity: "L", rationale: "Modo apresentação já existe; exportar PPT/PDF seria o próximo passo natural." },
  { id: "G4", title: "Criar presets por tipo de decisão", priority: "P1", complexity: "M", rationale: "Bench de produto, código, modelo e operação pedem narrativas diferentes." },
]

const personas: ObservatoryPersona[] = [
  persona("exec", "C-Level", "Precisa decidir rápido, com risco e custo explícitos.", [35, 25, 20, 20], "aiox-research", "legacy-bi", 14),
  persona("ops", "Operações", "Precisa transformar comparação em backlog e dono.", [20, 35, 30, 15], "aiox-research", "notion-stack", 18),
  persona("finance", "Financeiro", "Precisa entender custo total e risco de retrabalho.", [20, 20, 20, 40], "aiox-research", "spreadsheet-os", 10),
]

const tco: ObservatoryTco = {
  currency: "USD",
  unit: "mês",
  scenarios: [
    {
      id: "solo",
      label: "Operador solo",
      unit: "mês",
      rows: [
        { player: "aiox-research", setup: "CLI + dashboard", low: 120, high: 280, baseline: false },
        { player: "legacy-bi", setup: "BI + manutenção", low: 600, high: 1600, baseline: true },
        { player: "notion-stack", setup: "manual workspace", low: 80, high: 420, baseline: false },
        { player: "spreadsheet-os", setup: "planilhas", low: 20, high: 900, baseline: false },
      ],
    },
  ],
}

const documents: ObservatoryDocument[] = [
  doc("README.md", "doc", "# Demo Bench\n\nEste é um benchmark demonstrativo completo para instalações sem dados reais."),
  doc("bench-output-dash.json", "dados", "{ \"demo\": true, \"matrix\": \"rich\", \"slides\": true }"),
  doc("scorecard.md", "score", "# Scorecard\n\nAIOX Research vence por clareza executiva, evidência e capacidade de gerar ação."),
  doc("roadmap.md", "roadmap", "# Roadmap\n\n1. Onboarding guiado\n2. Contratos de dados\n3. Exportação futura\n4. Presets por tipo de decisão"),
  doc("evidence.md", "evidence", "# Evidências\n\nDemo contém matriz, gaps, personas, TCO, cliffs e slides."),
]

export const demoAdapterMeta: ObservatoryAdapterMeta = {
  source: "demo",
  label: "Demo",
  sourceRoot: "demo",
  group: {
    groupKey: () => "demo",
    groupLabel: () => "Demo",
    groupOrder: ["demo"],
  },
  formatCoverage: (item) => item.coverage,
  buildDeepenCommand: () =>
    `claude && /spy *bench "AIOX Research" "Legacy BI" "Gere um bench real com matrix, gaps, roadmap, evidências, personas, TCO e slides."`,
}

export function getDemoObservatoryData(): ObservatoryData {
  return {
    source: "demo",
    sourceRoot: "demo",
    sourceLabel: "Demo",
    newActionLabel: "Novo Demo",
    deepenCommand: demoAdapterMeta.buildDeepenCommand(run),
    groupBuckets: [{ key: "demo", label: "Demo", slugs: [run.slug] }],
    stats: { totalRuns: 1, withScorecard: 1, withMetadata: 1, withDeep: 1 },
    runs: [run],
    selectedRun: run,
    documents,
    selectedDocument: documents[0],
    sourceSummary: [],
    topSources: [],
    players: [],
    matrix,
    scoreDimensions,
    personas,
    tco,
    tiebreakers: [
      { id: "T1", q: "Precisa apresentar para stakeholder?", yes: "AIOX Research", no: "Notion Stack" },
      { id: "T2", q: "Precisa rastrear evidência?", yes: "AIOX Research", no: "Legacy BI" },
    ],
    cliffs: [
      { player: "spreadsheet-os", trigger: "mais de 2 squads consumindo o dado", impact: "coordenação manual vira gargalo e aumenta risco de decisão desatualizada." },
      { player: "notion-stack", trigger: "precisa de matriz comparativa viva", impact: "bom para escrita, fraco para score, roadmap e slides automáticos." },
    ],
    decisionTree: [
      { q: "A decisão precisa virar ação?", yes: "AIOX Research", no: "Notion Stack" },
      { q: "A audiência é executiva?", yes: "Slides + Map", no: "Doc + Matrix" },
    ],
    categorical: [
      { dimension: "Slides executivos", winner: "aiox-research", loser: "legacy-bi", note: "Modo apresentação reduz tempo de leitura." },
      { dimension: "Custo inicial", winner: "spreadsheet-os", loser: "aiox-research", note: "Planilha custa menos, mas não escala governança." },
      { dimension: "Evidência", winner: "aiox-research", loser: "notion-stack", note: "O painel liga evidência à decisão." },
    ],
    gapItems,
    metadataMetrics: [
      { label: "tipo", value: "demo" },
      { label: "schema", value: "demo-bench-v1" },
    ],
    scoreMetrics: [
      { label: "score", value: "92" },
      { label: "confiança", value: "alta" },
    ],
    editorsNote: {
      title: "Por que este demo existe",
      byline: "AIOX Research",
      date: "2026-05-14",
      paragraphs: ["Este demo mostra o destino visual esperado antes de qualquer instalação ter research, bench ou mapeamentos próprios."],
    },
    playerProfiles: players,
    benchmarkMethod: matrix.method,
    benchmarkConfidence: "alta",
    benchmarkNarrative: "Demo completo para onboarding: map, slides, roadmap, evidências, matriz, duelo, score, personas, TCO e decisão.",
    benchmarkShortTitle: "AI Ops Command Center",
    typeSpecific: {},
    curiosity: [],
    waves: [],
    availableModes: ["map", "slides", "roadmap", "evidence", "matrix", "duel", "score", "personas", "tco", "decision", "document"],
  }
}

function row(id: string, label: string, weight: number, scores: [number, number, number, number], notes: string) {
  const keys = ["aiox-research", "legacy-bi", "notion-stack", "spreadsheet-os"]
  return {
    id,
    label,
    weight,
    cells: keys.map((player, index) => ({
      player,
      score: scores[index] ?? 0,
      confidence: index === 0 ? "alta" : "média",
      notes,
      source: "demo",
      categoricalWinner: index === scores.indexOf(Math.max(...scores)),
    })),
  }
}

function persona(id: string, label: string, sub: string, weights: number[], winner: string, runner: string, delta: number): ObservatoryPersona {
  const totals = matrix.totals.map((item) => ({ player: item.player, score: item.score - (id === "finance" && item.player === "spreadsheet-os" ? -8 : 0) }))
  const ranking = totals
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ rank: index + 1, player: item.player, score: item.score, delta: index === 0 ? "—" : String(Math.round(totals[0].score - item.score)) }))
  return {
    id,
    label,
    sub,
    job: sub,
    mustHave: ["Valor claro", "Baixo risco", "Próximo passo acionável"],
    antiGoals: ["Ranking absoluto sem contexto"],
    decisiveDimensions: [],
    weights,
    totals,
    ranking,
    winner,
    runner,
    delta,
    verdict: `${winner} vence para ${label}.`,
    tiebreaker: "Escolha muda apenas se custo inicial for o critério dominante.",
  }
}

function doc(file: string, phase: string, content: string): ObservatoryDocument {
  return {
    id: `demo/${file}`,
    file,
    phase,
    bytes: content.length,
    content,
    truncated: false,
  }
}
