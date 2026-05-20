export const RESEARCH_METHODS = [
  {
    id: "mapping",
    label: "MAPEAMENTO",
    description: "Workflow wf-deep-research: classifica a pergunta, monta plano, ativa especialistas e sintetiza mapa de território.",
    workflow: {
      id: "wf-deep-research",
      name: "Deep Research Pipeline",
      path: "squads/research/workflows/wf-deep-research.yaml",
      outputRoot: "docs/research/{slug}",
    },
    skill: {
      name: "research-chief",
      label: "Research Chief",
      path: ".claude/skills/research-chief/SKILL.md",
      invocation: "/research-chief",
    },
    primaryAgent: "dr-orchestrator",
    taskFiles: [
      "squads/research/tasks/classify-research-query.md",
      "squads/research/tasks/formulate-pico-question.md",
      "squads/research/tasks/select-review-methodology.md",
      "squads/research/tasks/design-research-plan.md",
      "squads/research/tasks/synthesize-final-report.md",
    ],
    directive:
      "Execute como mapeamento pelo workflow wf-deep-research. Classifique a pergunta em UC-001~004, monte diagnóstico Sackett/Booth/Creswell, ative especialistas relevantes e entregue mapa de território antes de decidir.",
    requiredArtifacts: [
      "taxonomia do domínio com categorias e subcategorias",
      "mapa de players/alternativas com sinais, maturidade e lacunas",
      "perguntas abertas e trilhas recomendadas de aprofundamento",
    ],
  },
  {
    id: "benchmark",
    label: "BENCHMARK",
    description: "Workflow bench-comparison-pipeline: detecta tipo, inventaria players, gera matriz, score, gaps, battle card e dash.",
    workflow: {
      id: "bench-comparison-pipeline",
      name: "Universal Benchmark Comparison Pipeline",
      path: "squads/research/workflows/bench-comparison-pipeline.yaml",
      outputRoot: "docs/bench/{slug}",
    },
    skill: {
      name: "research-bench",
      label: "Bench Analyst",
      path: ".claude/skills/research-bench/SKILL.md",
      invocation: "/research-bench",
    },
    primaryAgent: "bench-analyst",
    taskFiles: [
      "squads/research/tasks/bench-detect.md",
      "squads/research/tasks/bench-inventory.md",
      "squads/research/tasks/bench-matrix.md",
      "squads/research/tasks/bench-score.md",
      "squads/research/tasks/bench-gap.md",
      "squads/research/tasks/bench-report.md",
      "squads/research/tasks/emit-bench-dash.md",
    ],
    directive:
      "Execute como benchmark real pelo bench-comparison-pipeline. Detecte o tipo da comparação, inventarie cada player, carregue dimension pack, gere matriz ponderada, score, gap analysis, battle card e bench-output-dash.json.",
    requiredArtifacts: [
      "lista de players/alternativas comparadas e razão de inclusão",
      "matriz ponderada com critérios, pesos, scores e evidência por célula",
      "bench-output-dash.json, relatório executivo, battle card, gaps, trade-offs, cliffs, TCO/riscos quando aplicável e recomendação por cenário",
    ],
  },
  {
    id: "tech",
    label: "TECH",
    description: "Skill /tech-research: 7 moléculas, multi-wave search, coverage gate, citation gate, extractors e validator.",
    workflow: {
      id: "tech-research-pipeline",
      name: "Tech Research Pipeline",
      path: "squads/research/workflows/tech-research/tech-research-pipeline.yaml",
      outputRoot: "docs/research/{slug}",
    },
    skill: {
      name: "tech-research",
      label: "Tech Research",
      path: ".agents/skills/tech-research/SKILL.md",
      invocation: "/tech-research",
    },
    primaryAgent: "tech-research-agent",
    taskFiles: [
      "squads/research/workflows/tech-research/phase-0-auto-clarify.yaml",
      "squads/research/workflows/tech-research/phase-3-execute-research.yaml",
      "squads/research/workflows/tech-research/phase-3-5-evaluate-coverage.yaml",
      "squads/research/workflows/tech-research/phase-4-5-verify-citations.yaml",
      "squads/research/workflows/tech-research/phase-5-document.yaml",
    ],
    directive:
      "Execute pela skill /tech-research e seu tech-research-pipeline. Foque arquitetura, maturidade, DX, performance, segurança, custos operacionais, riscos de integração e implicações de implementação.",
    requiredArtifacts: [
      "mapa técnico de arquitetura, dependências e integração",
      "trade-offs de engenharia com riscos, mitigação e esforço",
      "recomendação técnica com critérios de adoção, bloqueios e provas necessárias",
    ],
  },
  {
    id: "market",
    label: "MERCADO",
    description: "Workflow wf-competitive-intel: Gilad + Higgins + Klein para mercado, concorrência, OSINT, sinais e riscos.",
    workflow: {
      id: "wf-competitive-intel",
      name: "Competitive Intelligence Pipeline",
      path: "squads/research/workflows/wf-competitive-intel.yaml",
      outputRoot: "docs/research/{slug}",
    },
    skill: {
      name: "research-chief",
      label: "Research Chief",
      path: ".claude/skills/research-chief/SKILL.md",
      invocation: "/research-chief",
    },
    primaryAgent: "gilad + bench-analyst",
    taskFiles: [
      "squads/research/tasks/analyze-competitive-intelligence.md",
      "squads/research/tasks/investigate-osint.md",
      "squads/research/tasks/analyze-decision-patterns.md",
      "squads/research/tasks/audit-evidence-reliability.md",
      "squads/research/tasks/synthesize-final-report.md",
    ],
    directive:
      "Execute como inteligência de mercado pelo wf-competitive-intel. Priorize Key Intelligence Topics, OSINT, concorrentes, early warning, blind spots, sinais de demanda, canais, pricing e riscos estratégicos.",
    requiredArtifacts: [
      "segmentos/ICP e sinais de demanda",
      "concorrentes/substitutos, posicionamento, pricing e canais",
      "oportunidades, riscos de mercado, timing e recomendações comerciais",
    ],
  },
] as const

export type ResearchMethodId = (typeof RESEARCH_METHODS)[number]["id"]

const LEGACY_RESEARCH_METHOD_IDS: Record<string, ResearchMethodId> = {
  landscape: "mapping",
  evidence: "mapping",
  "tech-eval": "tech",
  product: "market",
}

export const OPENROUTER_CLI_LABEL = "OpenRouter CLI"
export const OPENROUTER_API_BASE_URL = "https://openrouter.ai/api/v1"

export type ResearchCliId = "claude" | "codex" | "gemini" | "research-core" | "byok"

export type ResearchByokConfig = {
  baseUrl: string
  apiKey: string
  model: string
  providerLabel?: string
}

export type ResearchRunRequest = {
  query: string
  cliId: ResearchCliId
  methodId: ResearchMethodId
  depth: "standard" | "deep"
  outputSlug?: string
  byok?: ResearchByokConfig
}

export type ResearchConsolidationRunRequest = {
  query: string
  cliId: ResearchCliId
  methodId: ResearchMethodId
  depth: "standard" | "deep"
  sourceOutputSlugs: string[]
  sourceCliIds: ResearchCliId[]
  outputSlug?: string
}

export type ResearchCliStatus = {
  id: ResearchCliId
  name: string
  bin: string
  available: boolean
  launchSupported: boolean
  version: string | null
  path: string | null
  candidates: ResearchCliCandidateStatus[]
  installHint: string
  launchHint: string
}

export type ResearchCliCandidateStatus = {
  path: string
  ok: boolean
  version: string | null
  error: string | null
}

export type ResearchCliDiscovery = {
  workspaceRoot: string
  generatedAt: string
  clis: ResearchCliStatus[]
}

export type ResearchRunState = {
  runId: string
  cliId: ResearchCliId
  methodId: ResearchMethodId
  query: string
  outputSlug: string
  status: "queued" | "running" | "completed" | "failed"
  startedAt: string
  updatedAt: string
  exitCode: number | null
  log: string
  logPath: string
  filesystem?: ResearchFilesystemSnapshot
}

export type ResearchFilesystemSnapshot = {
  checkedAt: string
  latestActivityAt: string | null
  fileCount: number
  totalBytes: number
  progress: {
    status: "pending" | "running" | "completed" | "failed" | "unknown"
    doneSteps: number
    totalSteps: number
    signals: string[]
    phases?: ResearchPipelinePhaseProgress[]
    currentPhaseId?: string | null
    sourcePath?: string | null
  }
  latestFiles: Array<{
    path: string
    updatedAt: string
    size: number
  }>
  error?: string
}

export type ResearchPipelinePhaseProgress = {
  id: string
  phase: string
  name: string
  status: "pending" | "in_progress" | "completed" | "skipped" | "halted" | "failed" | "unknown"
  checkpoint?: string | null
  verdict?: string | null
}

export type TechResearchCanonicalPhase = {
  id: string
  phase: string
  name: string
  prompt: string
  checkpoint?: "COVERAGE_GATE" | "CITATION_GATE"
  conditional?: boolean
}

export const TECH_RESEARCH_CANONICAL_PHASES: readonly TechResearchCanonicalPhase[] = [
  {
    id: "p00_init",
    phase: "P00",
    name: "Parse Args + Initialize",
    prompt: "capturar query, flags, output_dir, start_epoch e aplicar guardrails antes de pesquisar.",
  },
  {
    id: "p00b_visual_tasks",
    phase: "P00b",
    name: "Create Team + Tasks",
    prompt: "criar mapa visual de tarefas quando o runtime suportar; se não suportar, registrar fases em pipeline-state.yaml.",
  },
  {
    id: "p00c_learning_log",
    phase: "P00c",
    name: "Initialize Incremental Learning Log",
    prompt: "criar .aiox/learning/logs/tech-research/{slug}-{timestamp}.yaml antes de qualquer pesquisa e atualizar em cada fase.",
  },
  {
    id: "p0_auto_clarify",
    phase: "P0",
    name: "Auto-Clarify",
    prompt: "inferir foco, domínio, tecnologias, intenção temporal e product_discovery antes de perguntar qualquer coisa.",
  },
  {
    id: "p1_clarify_fallback",
    phase: "P1",
    name: "Clarify Fallback",
    prompt: "fazer no máximo uma pergunta curta apenas quando P0 não inferir contexto suficiente.",
    conditional: true,
  },
  {
    id: "p15_decompose",
    phase: "P1.5",
    name: "Decompose Query",
    prompt: "quebrar a pergunta em 5-7 subqueries ortogonais, incluindo fundamentos, implementação, trade-offs, melhores práticas, casos reais, devil's advocate e expert-level.",
  },
  {
    id: "p2_generate_prompt",
    phase: "P2",
    name: "Generate Deep Research Prompt",
    prompt: "gerar e salvar 01-deep-research-prompt.md com query, contexto, subqueries, freshness e expectativas de saída.",
  },
  {
    id: "p3_execute_research",
    phase: "P3",
    name: "Execute Research Waves",
    prompt: "executar até 3 ondas com estratégia por fonte, progresso JSONL, fontes oficiais primeiro e fallback documentado.",
  },
  {
    id: "p32_deep_read",
    phase: "P3.2",
    name: "Deep Read Top Sources",
    prompt: "ler fontes prioritárias quando snippets forem insuficientes, usando ETL antes de WebFetch quando aplicável.",
    conditional: true,
  },
  {
    id: "p35_evaluate_coverage",
    phase: "P3.5",
    name: "Evaluate Coverage",
    prompt: "calcular coverage_score, coverage_breakdown, source_quality, new_information_ratio, remaining_gaps e decisão.",
    checkpoint: "COVERAGE_GATE",
  },
  {
    id: "p36_compress_wave",
    phase: "P3.6",
    name: "Compress Wave",
    prompt: "gravar wave-{N}-summary.md e atualizar evolving_report.md; wave 2+ deve usar os summaries como ponte de memória.",
  },
  {
    id: "p37_multi_llm",
    phase: "P3.7",
    name: "Playwright Multi-LLM Deep Research",
    prompt: "acionar escape valve com --deep, REVIEW na wave 3 ou gatilho explícito; degradar apenas quando Playwright não estiver disponível e --deep não for obrigatório.",
    conditional: true,
  },
  {
    id: "p4_synthesize",
    phase: "P4",
    name: "Synthesize + Quick Wins",
    prompt: "sintetizar sem apagar contradições e produzir quick-wins.md com >=3 itens qualificados ou bloco de ausência explícito.",
  },
  {
    id: "p45_verify_citations",
    phase: "P4.5",
    name: "Verify Citations",
    prompt: "verificar claims importantes, URLs, datas e aderência de citações, com loop de correção limitado a 2 tentativas.",
    checkpoint: "CITATION_GATE",
  },
  {
    id: "p50_document_narrative",
    phase: "P5.0",
    name: "Write Narrative Atoms",
    prompt: "materializar README, 00-query, 02-report, 03-recommendations, curiosity_queue, metrics e pipeline-state.",
  },
  {
    id: "p51_run_extractors",
    phase: "P5.1",
    name: "Run Extractor Atoms",
    prompt: "rodar extractors de sources, players, ux-patterns, matrices, execution-log e research-graph para liberar render rich.",
  },
  {
    id: "p5_validate",
    phase: "P5_validate",
    name: "Validate Output",
    prompt: "rodar output_validator.py; se invalidar, HALT e não marcar a pesquisa como concluída.",
  },
  {
    id: "p5b_finalize",
    phase: "P5b",
    name: "Finalize Learning Log + Next Command",
    prompt: "finalizar learning log com outcome, elapsed, gates, quick wins, fontes e sugestão de próximo comando.",
  },
] as const

const TECH_RESEARCH_CANONICAL_FILES = [
  "`.claude/skills/tech-research/SKILL.md` — alias estável, regras não negociáveis e protocolo completo.",
  "`squads/research/workflows/tech-research/tech-research-pipeline.yaml` — manifesto fase → persona → artefatos → checkpoints.",
  "`squads/research/checklists/tech-research/guardrails.yaml` — vetoes, constraints, security e boundaries.",
  "`squads/research/data/tech-research/auto-clarification.yaml` — inferência automática de contexto.",
  "`squads/research/data/tech-research/dependencies.yaml` — disponibilidade e preferência de ferramentas.",
  "`squads/research/workflows/tech-research/phase-0-auto-clarify.yaml`",
  "`squads/research/workflows/tech-research/phase-1-clarify.yaml`",
  "`squads/research/workflows/tech-research/phase-1-5-decompose.yaml`",
  "`squads/research/workflows/tech-research/phase-2-generate-prompt.yaml`",
  "`squads/research/workflows/tech-research/phase-3-execute-research.yaml`",
  "`squads/research/workflows/tech-research/phase-3-2-deep-read.yaml`",
  "`squads/research/workflows/tech-research/phase-3-5-evaluate-coverage.yaml`",
  "`squads/research/workflows/tech-research/phase-3-6-compress-wave.yaml`",
  "`squads/research/workflows/tech-research/phase-3-7-playwright-deep-research.yaml`",
  "`squads/research/workflows/tech-research/phase-4-synthesize.yaml`",
  "`squads/research/workflows/tech-research/phase-4-5-verify-citations.yaml`",
  "`squads/research/workflows/tech-research/phase-5-document.yaml`",
  "`squads/research/prompts/tech-research/decompose.md`",
  "`squads/research/prompts/tech-research/evaluate.md`",
  "`squads/research/prompts/tech-research/verify-citations.md`",
  "`squads/research/prompts/tech-research/tool-strategy.md`",
  "`squads/research/prompts/tech-research/executor-matrix.md`",
  "`squads/research/prompts/tech-research/page-extract.md`",
  "`squads/research/prompts/tech-research/playwright-deep-research.md`",
  "`squads/research/templates/tech-research/deep-research-prompt-template.md`",
  "`squads/research/templates/tech-research/output-structure.md`",
  "`squads/research/templates/tech-research/output-structure.yaml`",
] as const

const TECH_RESEARCH_EXTRACTOR_COMMANDS = [
  "python3 squads/research/scripts/tech-research/sources_extractor.py {output_dir}",
  "python3 squads/research/scripts/tech-research/players_extractor.py {output_dir}",
  "python3 squads/research/scripts/tech-research/ux_patterns_extractor.py {output_dir}",
  "python3 squads/research/scripts/tech-research/comparison_matrix_extractor.py {output_dir}",
  "python3 squads/research/scripts/tech-research/logger.py consolidate {output_dir}",
  "python3 squads/research/scripts/tech-research/research_graph.py {output_dir}",
  "python3 squads/research/scripts/tech-research/output_validator.py {output_dir}",
] as const

const TECH_RESEARCH_RUNTIME_PHASES = TECH_RESEARCH_CANONICAL_PHASES.map((phase) => {
  const extras = [phase.checkpoint ? `checkpoint: ${phase.checkpoint}` : "", phase.conditional ? "conditional" : ""]
    .filter(Boolean)
    .join("; ")
  return `[${phase.phase}] ${phase.name}: ${phase.prompt}${extras ? ` (${extras})` : ""}`
})

const TECH_RESEARCH_OUTPUT_CONTRACT = [
  "`README.md` — sumário executivo, escopo, método, principais achados, limitações e próximos passos.",
  "`00-query-original.md` — pergunta original, interpretação do foco, premissas e critérios de sucesso.",
  "`01-deep-research-prompt.md` — prompt/contrato executado e decisões de escopo tomadas pelo runtime.",
  "`02-research-report.md` — relatório principal com achados, evidências, trade-offs, riscos e lacunas.",
  "`03-recommendations.md` — recomendações acionáveis, priorizadas por impacto, esforço e confiança.",
  "`quick-wins.md` — ações de alto valor e baixa fricção, com responsável sugerido quando inferível.",
  "`curiosity_queue.yaml` — perguntas abertas com prioridade, razão e status.",
  "`evolving_report.md` — progresso incremental por onda, incluindo mudanças de hipótese.",
  "`wave-{N}-summary.md` — resumo de cada onda com queries, fontes, aprendizados e gaps restantes.",
  "`metrics.yaml` — coverage_score, integrity_score, confidence_score, waves, source totals, stop_reason e inferências.",
  "`pipeline-state.yaml` — fases executadas, status, timestamps e checkpoints.",
  "`sources.yaml` — fontes com URL, título, data, tipo, credibilidade, claims suportados e notas.",
  "`players.yaml` — projetos/players com categoria, maturidade, sinais, riscos e links.",
  "`ux-patterns.yaml` — padrões de experiência ou operação observados, quando aplicável.",
  "`matrices.yaml` — matrizes comparativas defensáveis; vazio estruturado se não houver dados suficientes.",
  "`execution-log.jsonl` — eventos relevantes em JSONL com timestamp, fase, status e notas.",
  "`research-graph.json` — grafo conectando query, ondas, fontes, claims, players e decisões.",
] as const

const MAX_RESEARCH_TOPIC_SLUG_LENGTH = 44

export function normalizeResearchMethodId(value: unknown): ResearchMethodId {
  if (isResearchMethodId(value)) return value
  if (typeof value === "string" && value in LEGACY_RESEARCH_METHOD_IDS) return LEGACY_RESEARCH_METHOD_IDS[value]
  return "mapping"
}

export function methodById(methodId: string): (typeof RESEARCH_METHODS)[number] {
  const normalizedMethodId = normalizeResearchMethodId(methodId)
  return RESEARCH_METHODS.find((method) => method.id === normalizedMethodId) ?? RESEARCH_METHODS[0]
}

export function slugifyResearchTopic(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return truncateSlug(normalized, MAX_RESEARCH_TOPIC_SLUG_LENGTH) || "research-run"
}

export function normalizeResearchRunRequest(input: Partial<ResearchRunRequest>): ResearchRunRequest {
  const query = typeof input.query === "string" ? input.query.trim() : ""
  const cliId = isResearchCliId(input.cliId) ? input.cliId : "claude"
  const methodId = resolveResearchMethodId(input.methodId, query)
  const depth = "deep"
  const outputSlug = typeof input.outputSlug === "string" ? input.outputSlug.trim() : ""
  const byok = normalizeResearchByokConfig(input.byok)
  const normalizedSlug = normalizeDatedResearchSlug(outputSlug || slugifyResearchTopic(query))

  return {
    query,
    cliId,
    methodId,
    depth,
    outputSlug: normalizedSlug,
    ...(byok ? { byok } : {}),
  }
}

export function normalizeResearchConsolidationRunRequest(
  input: Partial<ResearchConsolidationRunRequest>,
): ResearchConsolidationRunRequest {
  const query = typeof input.query === "string" ? input.query.trim() : ""
  const cliId = isResearchCliId(input.cliId) ? input.cliId : "claude"
  const methodId = resolveResearchMethodId(input.methodId, query)
  const depth = "deep"
  const sourceOutputSlugs = Array.isArray(input.sourceOutputSlugs)
    ? input.sourceOutputSlugs.filter((slug): slug is string => typeof slug === "string").map((slug) => slug.trim()).filter(Boolean)
    : []
  const sourceCliIds = Array.isArray(input.sourceCliIds)
    ? input.sourceCliIds.filter(isResearchCliId)
    : []
  const outputSlug = typeof input.outputSlug === "string" ? input.outputSlug.trim() : ""

  return {
    query,
    cliId,
    methodId,
    depth,
    sourceOutputSlugs,
    sourceCliIds,
    outputSlug: normalizeDatedResearchSlug(outputSlug || slugifyResearchTopic(query)),
  }
}

export function buildResearchCliInput(request: ResearchRunRequest, workspaceRoot: string) {
  const outputSlug = normalizeDatedResearchSlug(request.outputSlug || slugifyResearchTopic(request.query))
  const args = formatResearchSkillArgs(request, outputSlug)
  if (request.cliId === "claude") {
    return `${methodById(request.methodId).skill.invocation} ${args}`
  }
  if (request.cliId === "codex") {
    return buildMethodSkillInvocation(request, workspaceRoot, outputSlug, "codex")
  }
  if (request.cliId === "research-core") {
    return buildResearchCoreRuntimePrompt(request, outputSlug)
  }

  return buildResearchFallbackPrompt(request)
}

function buildResearchCoreRuntimePrompt(request: ResearchRunRequest, outputSlug: string) {
  const method = methodById(request.methodId)
  return [
    "Execute pelo runtime local `research-core`.",
    "",
    `Pergunta de pesquisa: ${request.query}`,
    `Modo solicitado no Workbench: ${method.label} — ${method.description}`,
    `Diretório Gold canônico: docs/research/${outputSlug}`,
    "",
    "Contrato do runtime:",
    "- Rodar AgentLoop + search mock/SearXNG quando configurado.",
    "- Validar citações com `CitationHandler`.",
    "- Emitir pacote Gold mínimo via `GoldAdapter`.",
    "- Não declarar pesquisa Gold completa quando estiver usando fixture/mock.",
  ].join("\n")
}

function buildMethodSkillInvocation(
  request: ResearchRunRequest,
  workspaceRoot: string,
  outputSlug: string,
  runtime: Extract<ResearchCliId, "claude" | "codex">,
) {
  const method = methodById(request.methodId)
  const skillPath = `${workspaceRoot.replace(/\/+$/g, "")}/${method.skill.path}`
  const args = formatResearchSkillArgs(request, outputSlug)
  const runtimeDir = `docs/research/${outputSlug}/runtimes/${request.cliId}`
  const canonicalOutput = method.workflow.outputRoot.replace("{slug}", outputSlug)
  const invocationLine =
    runtime === "claude"
      ? `Ative a skill \`${method.skill.invocation}\` (${method.skill.label}) e execute este pacote de argumentos.`
      : `Execute a skill local \`${method.skill.name}\` carregando o arquivo ${skillPath}.`

  return [
    invocationLine,
    "",
    "Argumentos/briefing:",
    "",
    "```txt",
    args,
    "```",
    "",
    "Use a ativação real de skill/workflow; não responda livremente e não copie apenas uma checklist para o prompt.",
    `Skill canônica: ${method.skill.path}`,
    `Workflow canônico: ${method.workflow.path}`,
    `Agente primário: ${method.primaryAgent}`,
    `Saída canônica do modo: ${canonicalOutput}`,
    `Pasta de monitoramento do AIOX Research: docs/research/${outputSlug}`,
    `Runtime desta execução: ${runtimeDir}`,
    "",
    "Tarefas/contratos que precisam ser carregados quando existirem:",
    ...method.taskFiles.map((file) => `- ${file}`),
    "",
    "Se a skill, o workflow ou qualquer arquivo operacional obrigatório não puder ser carregado, aplique HALT com o motivo exato; não improvise outro workflow.",
    "",
    "Contexto do launcher local:",
    `- AIOX_RESEARCH_METHOD=${method.id}`,
    `- AIOX_RESEARCH_SKILL=${method.skill.name}`,
    `- AIOX_RESEARCH_WORKFLOW=${method.workflow.id}`,
    `- AIOX_RESEARCH_OUTPUT_SLUG=${outputSlug}`,
    `- AIOX_RESEARCH_OUTPUT_DIR=${runtimeDir}`,
    `- AIOX_RESEARCH_MONITOR_DIR=docs/research/${outputSlug}`,
    `- AIOX_RESEARCH_CANONICAL_OUTPUT_DIR=${canonicalOutput}`,
    `- AIOX_RESEARCH_RUNTIME_DIR=${runtimeDir}`,
  ].join("\n")
}

function formatResearchSkillArgs(request: ResearchRunRequest, outputSlug: string) {
  const flags = [
    request.methodId === "tech" && request.depth === "deep" ? "--deep" : "",
    request.methodId === "tech" ? "--yolo" : "",
  ].filter(Boolean)

  return [JSON.stringify(buildModeScopedQuery(request, outputSlug)), ...flags].join(" ")
}

function buildModeScopedQuery(request: ResearchRunRequest, outputSlug: string) {
  const method = methodById(request.methodId)
  const runtimeDir = `docs/research/${outputSlug}/runtimes/${request.cliId}`
  const canonicalOutput = method.workflow.outputRoot.replace("{slug}", outputSlug)
  return [
    request.query,
    "",
    `Modo AIOX Research: ${method.label}.`,
    `Skill canônica: ${method.skill.name} (${method.skill.path}).`,
    `Workflow canônico: ${method.workflow.id} (${method.workflow.path}).`,
    `Saída canônica esperada: ${canonicalOutput}.`,
    `Pasta de monitoramento do launcher: docs/research/${outputSlug}.`,
    `Runtime desta CLI: ${runtimeDir}.`,
    `Agente primário: ${method.primaryAgent}.`,
    method.directive,
    "Persistência: não crie placeholders no root da pesquisa. Escreva estado real desta CLI no runtime; o root só recebe artefatos consolidados ou artefatos reais após validação.",
    "Tarefas/contratos obrigatórios deste modo:",
    ...method.taskFiles.map((file) => `- ${file}`),
    "Artefatos obrigatórios deste modo:",
    ...method.requiredArtifacts.map((artifact) => `- ${artifact}`),
  ].join("\n")
}

function buildWorkflowContractLines(method: ReturnType<typeof methodById>, outputSlug: string) {
  return [
    `- Modo AIOX: ${method.label}`,
    `- Skill canônica: ${method.skill.name} (${method.skill.path})`,
    `- Workflow canônico: ${method.workflow.id} (${method.workflow.path})`,
    `- Agente primário: ${method.primaryAgent}`,
    `- Saída canônica do modo: ${method.workflow.outputRoot.replace("{slug}", outputSlug)}`,
    "- Tarefas/contratos obrigatórios:",
    ...method.taskFiles.map((file) => `  - ${file}`),
  ]
}

function methodOutputContract(method: ReturnType<typeof methodById>) {
  if (method.id === "mapping") {
    return [
      "`README.md` — sumário executivo do território pesquisado, escopo, método, achados e limitações.",
      "`00-query-original.md` — pergunta original, interpretação, premissas e critérios de sucesso.",
      "`02-research-report.md` — mapa do domínio com taxonomia, players, alternativas, padrões e lacunas.",
      "`03-recommendations.md` — trilhas recomendadas de aprofundamento e próximos passos por prioridade.",
      "`sources.yaml` — fontes com URL, título, data quando houver, tipo, credibilidade e claims suportados.",
      "`players.yaml` — players/alternativas com categoria, maturidade, sinais, riscos e links.",
      "`matrices.yaml` — matriz de território, comparação ou priorização quando defensável.",
      "`metrics.yaml` — cobertura, confiança, lacunas e stop_reason.",
      "`pipeline-state.yaml` — fases do workflow, status, timestamps e checkpoints.",
      "`research-graph.json` — grafo conectando query, fontes, players, lacunas e decisões.",
    ]
  }

  if (method.id === "benchmark") {
    return [
      "`docs/bench/{slug}/bench-output-dash.json` — projeção canônica consumida pelo dashboard de Bench.",
      "`docs/bench/{slug}/metadata.json` — sujeitos, tipo detectado, fontes e método de benchmark.",
      "`docs/bench/{slug}/bench-report.md` — relatório executivo comparativo.",
      "`docs/bench/{slug}/bench-matrix.md` e/ou `bench-matrix.json` — matriz ponderada com evidência por célula.",
      "`docs/bench/{slug}/bench-scores.md` e/ou `bench-scores.json` — score quantitativo por dimensão.",
      "`docs/bench/{slug}/gap-analysis.md` — lacunas, riscos, absorção e próximos passos.",
      "`docs/bench/{slug}/battle-card.md` — resumo operacional para decisão rápida.",
      "`docs/research/{slug}/runtimes/<runtime>/` — espelho de monitoramento do Workbench com logs e estado.",
    ]
  }

  if (method.id === "market") {
    return [
      "`02-research-report.md` — relatório de inteligência de mercado com concorrentes, sinais, riscos e oportunidades.",
      "`03-recommendations.md` — recomendações comerciais priorizadas por impacto, confiança e timing.",
      "`sources.yaml` — fontes de mercado/OSINT com credibilidade e claims suportados.",
      "`players.yaml` — concorrentes, substitutos, posicionamento, pricing e canais.",
      "`matrices.yaml` — matriz de concorrência, ameaças e early-warning quando defensável.",
      "`metrics.yaml` — cobertura, confiança, lacunas e stop_reason.",
      "`pipeline-state.yaml` — fases do workflow e checkpoints.",
    ]
  }

  return TECH_RESEARCH_OUTPUT_CONTRACT
}

function writeScopeRule(method: ReturnType<typeof methodById>, outputSlug: string, runtimeDir: string) {
  if (method.id === "benchmark") {
    return `- Escreva artefatos de monitoramento em \`${runtimeDir}/\` e a projeção canônica em \`${method.workflow.outputRoot.replace("{slug}", outputSlug)}/\`; não escreva fora desses dois escopos.`
  }
  return `- Não escreva fora de \`${runtimeDir}/\`, exceto se precisar apenas ler artefatos raiz da pesquisa.`
}

export function buildResearchFallbackPrompt(request: ResearchRunRequest) {
  const method = methodById(request.methodId)
  const depthText = request.depth === "deep" ? "profunda, com múltiplas ondas" : "objetiva e suficiente"
  const outputSlug = normalizeDatedResearchSlug(request.outputSlug || slugifyResearchTopic(request.query))
  const runtimeDir = `docs/research/${outputSlug}/runtimes/${request.cliId}`
  const runtimeCapability =
    request.cliId === "byok"
      ? [
          "Capacidade do runtime: OpenRouter CLI sem ferramentas locais.",
          "- Este runtime não consegue ler arquivos do workspace nem escrever artefatos diretamente; trate como execução degradada.",
          "- Produza um dossiê Markdown completo no stdout e marque `execution_capability: degraded_byok_no_workspace_tools` em qualquer bloco de métricas.",
          "- Não declare que scripts, extractors, validator ou arquivos locais foram executados.",
        ]
      : [
          "Capacidade do runtime: CLI local com acesso ao workspace.",
          "- Carregue os arquivos canônicos da skill/squad no início de cada fase, conforme a lista abaixo.",
          "- Se um arquivo operacional obrigatório não puder ser lido por completo, aplique HALT com `partial_read_failure`; não continue com execução inventada.",
          "- Atualize `pipeline-state.yaml` e o learning log a cada fase iniciada/concluída.",
        ]

  return [
    `FALLBACK DEGRADADO: este runtime não oferece ativação local de skills. Não trate este modo como equivalente à execução real de \`${method.skill.invocation}\` via CLI.`,
    `Execute esta pesquisa pelo workflow canônico \`${method.workflow.id}\` do squad \`squads/research\`.`,
    "Esta não é uma resposta rápida: percorra o pipeline fase a fase, com checkpoints, learning log, extractors e validator quando o runtime tiver ferramentas locais.",
    "",
    `Pergunta de pesquisa: ${request.query}`,
    `Modo: ${method.label} — ${method.description}`,
    `Diretiva do modo: ${method.directive}`,
    `Profundidade: ${depthText}`,
    `Pasta de monitoramento da pesquisa: docs/research/${outputSlug}/`,
    `Saída canônica do modo: ${method.workflow.outputRoot.replace("{slug}", outputSlug)}`,
    `Runtime desta execução: ${request.cliId}`,
    `Diretório obrigatório deste runtime: ${runtimeDir}/`,
    "",
    "Contrato workflow/skill:",
    ...buildWorkflowContractLines(method, outputSlug),
    "",
    ...runtimeCapability,
    "",
    "Contrato de persistência:",
    "- Existe UMA pasta por pesquisa. Não crie pastas irmãs com sufixo de CLI/LLM.",
    `- Grave os artefatos desta execução em \`${runtimeDir}/\`.`,
    ...(method.id === "benchmark" ? [`- Materialize também o pacote canônico em \`${method.workflow.outputRoot.replace("{slug}", outputSlug)}/\`.`] : []),
    `- Se \`${runtimeDir}/\` já contiver artefatos de uma tentativa anterior, leia-os primeiro e continue do primeiro passo incompleto ou inconsistente; não recomece do zero sem necessidade.`,
    "- Não sobrescreva artefatos de outros runtimes.",
    "- O AIOX Research materializa apenas estado oculto em `.aiox-state/`; o root deve ficar reservado para consolidação ou artefatos reais confirmados.",
    "",
    buildTechResearchRuntimeProtocol(request.depth, runtimeDir, request.methodId),
    "",
    "Artefatos adicionais obrigatórios deste modo:",
    ...method.requiredArtifacts.map((artifact) => `- ${artifact}`),
    "",
    "Contrato de saída desejado:",
    ...methodOutputContract(method).map((atom) => `- ${atom.replaceAll("{slug}", outputSlug)}`),
    "",
    "Regras:",
    "- Não implemente código de produto nesta execução.",
    writeScopeRule(method, outputSlug, runtimeDir),
    "- Não invente fontes, números ou players; marque inferências explicitamente.",
    "- Se uma ferramenta de busca/web não estiver disponível neste runtime, documente a limitação, use fontes locais disponíveis e reduza confidence_score.",
    "- Se coverage_score ficar abaixo de 50 após as ondas possíveis, entregue com caveat explícito em vez de forçar conclusão.",
    "- Use PT-BR com acentuação correta.",
    "- Ao terminar, informe o caminho da subpasta do runtime e os arquivos estruturados que ficaram ausentes.",
  ].join("\n")
}

export function buildResearchConsolidationPrompt(request: ResearchConsolidationRunRequest) {
  const method = methodById(request.methodId)
  const depthText = request.depth === "deep" ? "profunda, reconciliando divergências" : "objetiva, reconciliando achados principais"
  const outputSlug = normalizeDatedResearchSlug(request.outputSlug || slugifyResearchTopic(request.query))
  const sourceList = Array.from(new Set(request.sourceOutputSlugs))
    .map((slug) => normalizeDatedResearchSlug(slug))
    .map((slug) => `- Diretório raiz: \`docs/research/${slug}/\` com subpastas \`runtimes/*/\``)
    .join("\n")
  const cliList = request.sourceCliIds.length > 0 ? request.sourceCliIds.join(", ") : "CLIs paralelos selecionados"

  return [
    `Consolide pesquisas paralelas já geradas no workspace atual usando o workflow canônico \`${method.workflow.id}\` do squad \`squads/research\`.`,
    "Esta etapa não é uma resposta rápida: ela deve reconciliar os runtimes, verificar evidência, preservar dissensos e emitir o formato canônico do modo.",
    "Carregue os arquivos canônicos do squad quando disponíveis; se um arquivo operacional obrigatório estiver ausente, documente a degradação ou aplique HALT quando isso comprometer a validade.",
    "",
    `Pergunta original: ${request.query}`,
    `Modo base: ${method.label} — ${method.description}`,
    `Diretiva do modo: ${method.directive}`,
    `Profundidade da consolidação: ${depthText}`,
    `Runtimes comparados: ${cliList}`,
    `Diretório raiz de monitoramento: docs/research/${outputSlug}/`,
    `Saída canônica do modo: ${method.workflow.outputRoot.replace("{slug}", outputSlug)}`,
    "",
    "Contrato workflow/skill:",
    ...buildWorkflowContractLines(method, outputSlug),
    "",
    "Fontes internas obrigatórias:",
    sourceList || "- Nenhum diretório de origem informado; interrompa e reporte o problema.",
    "",
    "Tarefa:",
    "- Leia os artefatos em `runtimes/*/` antes de escrever a consolidação.",
    "- Compare convergências, divergências, lacunas, fontes fortes/fracas e decisões conflitantes.",
    ...method.requiredArtifacts.map((artifact) => `- Preserve no consolidado: ${artifact}.`),
    "- Pontue cobertura por runtime e no consolidado usando os thresholds inline: target 85, approve >= 70, review 50-70, veto/caveat abaixo de 50.",
    "- Separe fonte confirmada, inferência e claim não suportado; não trate ausência de evidência como evidência positiva.",
    `- Grave o resultado consolidado nos arquivos raiz de \`docs/research/${outputSlug}/\`.`,
    ...(method.id === "benchmark" ? [`- Gere/atualize também a projeção canônica em \`${method.workflow.outputRoot.replace("{slug}", outputSlug)}/\`.`] : []),
    "",
    "Contrato de saída no diretório raiz:",
    ...methodOutputContract(method).map((atom) => `- ${atom.replaceAll("{slug}", outputSlug)}`),
    "",
    "Regras:",
    "- Não rode uma nova pesquisa externa se as fontes internas forem suficientes; só navegue se houver lacuna crítica.",
    "- Não implemente código de produto nesta execução.",
    method.id === "benchmark"
      ? `- Não escreva fora de \`docs/research/${outputSlug}/\` e \`${method.workflow.outputRoot.replace("{slug}", outputSlug)}/\`.`
      : `- Não escreva fora de \`docs/research/${outputSlug}/\`.`,
    "- Não invente fontes, números ou players; marque inferências explicitamente.",
    "- Preserve dissensos entre runtimes; não trate um runtime como autoridade por padrão.",
    "- metrics.yaml deve incluir coverage_score, integrity_score, confidence_score, source_runs e stop_reason.",
    "- Use PT-BR com acentuação correta.",
    "- Ao terminar, informe quais divergências permaneceram abertas.",
  ].join("\n")
}

function buildTechResearchRuntimeProtocol(depth: ResearchRunRequest["depth"], runtimeDir: string, methodId: ResearchMethodId) {
  const method = methodById(methodId)
  const canonicalFileLines =
    method.id === "tech"
      ? TECH_RESEARCH_CANONICAL_FILES
      : [
          "`squads/research/config.yaml` — roteamento do squad research e agentes disponíveis.",
          `\`${method.skill.path}\` — skill canônica do modo ${method.label}.`,
          `\`${method.workflow.path}\` — workflow canônico do modo ${method.label}.`,
          ...method.taskFiles.map((file) => `\`${file}\``),
        ]
  const workflowPhaseLines =
    method.id === "tech"
      ? ["- Execute as fases do pipeline `SP-TECH-RESEARCH` nesta ordem:", ...TECH_RESEARCH_RUNTIME_PHASES.map((phase) => `  - ${phase}`)]
      : [
          `- Execute o workflow \`${method.workflow.id}\` na ordem declarada em \`${method.workflow.path}\`.`,
          "- Não substitua este modo por `/tech-research` apenas porque existe um protocolo inline.",
          method.id === "benchmark"
            ? "- BENCHMARK deve usar profile `full` quando não houver restrição explícita: detectar tipo, inventariar sujeitos, matriz, score, gaps, deep dive, relatório, battle card, dash e quality gate."
            : "- Preserve os agentes, tarefas, checkpoints e handoffs declarados no workflow do modo.",
        ]
  const validationLines =
    method.id === "tech"
      ? [
          "- Scripts determinísticos obrigatórios em P5.1/P5_validate quando ferramentas locais existirem:",
          ...TECH_RESEARCH_EXTRACTOR_COMMANDS.map((command) => `  - ${command.replace("{output_dir}", runtimeDir)}`),
        ]
      : method.id === "benchmark"
        ? [
            "- Validação BENCHMARK obrigatória: gere JSON + Markdown e valide `bench-output-dash.json` contra o contrato real do Observatory antes do score final.",
            "- Carregue `apps/research/src/lib/bench-dashboard.server.ts`, `squads/research/tasks/emit-bench-dash.md`, `squads/research/data/bench-output-formats.yaml`, `squads/research/data/bench-skeleton.md` e `squads/research/checklists/bench-quality-checklist.md` antes de emitir o dash.",
            "- Não confunda o arquivo de entrada com o tipo interno: `bench-output-dash.json` é a projeção lida do disco; `BenchDashboardData`/`stats`/`runs`/`selectedRun` é shape de retorno do servidor.",
            "- `/observatory/bench` renderiza a partir de JSON/MD/MMD lidos no diretório do bench. YAMLs são sidecars de auditoria/contrato, não podem ser citados como fonte de preenchimento visual salvo se o código do app os parsear.",
            "- Antes do scoring, emita triagem de fontes: quais arquivos são fonte de players, contexto, inválidos ou estruturados vazios; não derive players de YAML vazio sem fallback explícito.",
            "- Se o usuário pedir benchmark profundo, Gold, absorption, landscape, slides-creator-like ou renderização em `/observatory/bench`, rode `npm run bench:gold:validate -- {slug}` e corrija todos os blockers antes de declarar pronto.",
            "- Invariantes de renderização: `players[].key`, `matrix.players[]` e `matrix.rows[].cells[].player` devem usar os mesmos IDs; `summary.players` deve bater com `players.length`; total de células deve ser `matrix.rows.length * players.length`.",
            "- Invariantes de identidade: folder slug, `MANIFEST.slug`, `bench-contract.slug`, `metadata.canonical.bench.id` e `bench-output-dash.json.benchmark.slug` devem coincidir.",
            "- Invariantes de artefato: todos os `.json` sob o diretório do bench devem parsear; `MANIFEST.json` deve listar os artefatos materiais; benches codebase/absorption devem verificar cada `local_clone`/`local_path` antes de pontuar.",
            "- Invariantes de decisão Gold: `bench-output-dash.json` deve trazer `source_summary[]`, `categorical{}`, `tiebreakers[]`, `cliffs[]` e `decision_tree[]`; uma matriz completa sem esses blocos não é dashboard-ready.",
            "- Não declare 100%, Gold ou dashboard-ready sem `bench:gold:validate` PASS e `npm run validate:yaml:changed` PASS.",
          ]
        : [
            "- Validação obrigatória: auditabilidade de fontes, lacunas explícitas, bias check e síntese compatível com o workflow canônico do modo.",
            "- Se houver scripts/templates específicos nas tarefas carregadas, execute-os antes de marcar o workflow como concluído.",
          ]
  const depthRules =
    method.id === "tech"
      ? depth === "deep"
        ? [
            "- Modo deep: complete até 3 ondas de pesquisa sempre que houver gaps materiais; se parar antes, justifique com coverage_score >= 80 ou falta real de ferramentas/fontes.",
            "- Modo deep: P3.7 é obrigatório quando --deep foi solicitado, quando COVERAGE_GATE fica em REVIEW na wave 3 ou quando houver gatilho explícito multi-perspectiva.",
          ]
        : [
            "- Modo standard: execute pelo menos uma onda e nunca pule o COVERAGE_GATE; uma segunda onda é obrigatória quando houver gap de alta prioridade.",
            "- Modo standard: pode parar cedo apenas com coverage_score >= 70, source_quality defensável e stop_reason explícito.",
          ]
      : [
          "- Profundidade fixa: execute o workflow canônico completo do modo, sem reduzir para resposta resumida.",
          method.id === "benchmark"
            ? "- BENCHMARK deve operar como comparação completa: inventário, matriz, pesos, scores, gaps, battle card, relatório e dash."
            : "- Execute investigação suficiente para sustentar taxonomia, players, sinais, lacunas, fontes e recomendações do modo.",
          "- Pare cedo apenas quando o próprio workflow declarar critério de suficiência, com coverage_score e stop_reason explícitos.",
        ]

  return [
    "Protocolo obrigatório de execução:",
    `- Fonte de verdade: skill \`${method.skill.invocation}\` + workflow \`${method.workflow.path}\`.`,
    "- O prompt inline abaixo é uma checklist de execução, não substitui os arquivos canônicos quando eles estiverem disponíveis no workspace.",
    "- Carregue cada arquivo operacional por completo na entrada da respectiva fase e registre `LOADED: {path} ({line_count} lines)` no log/artefatos.",
    "- Arquivos canônicos que devem ser usados conforme a fase:",
    ...canonicalFileLines.map((file) => `  - ${file}`),
    ...workflowPhaseLines,
    `- Modo AIOX: ${method.label}. ${method.directive}`,
    "- Requisitos específicos do modo:",
    ...method.requiredArtifacts.map((artifact) => `  - ${artifact}`),
    ...depthRules,
    "- COVERAGE_GATE: APPROVE quando coverage_score >= 70; REVIEW quando 50-69; VETO quando < 50 após max_waves=3.",
    "- CITATION_GATE: APPROVE quando verified_ratio >= 0.85 e unsupported_count == 0; REVIEW quando verified_ratio >= 0.85 com claims residuais; VETO quando verified_ratio < 0.85 após 2 tentativas.",
    ...validationLines,
    "- Classifique fontes por credibilidade: official docs, papers, maintainer/core team, GitHub repo, issues, blogs conhecidos, vendor marketing e baixa qualidade.",
    "- `sources.yaml` precisa conter URL, título, data quando houver, tipo, credibilidade, claims suportados e notas de uso.",
    "- `metrics.yaml` precisa conter coverage_score, coverage_breakdown, integrity_score, citation_verified, gate verdicts, waves, totais de fontes e stop_reason.",
    "- `pipeline-state.yaml` precisa listar todas as fases canônicas com status `pending|in_progress|completed|skipped|halted|failed`, timestamps e checkpoint verdicts.",
    `- \`.aiox/learning/logs/${method.skill.name}/*.yaml\` precisa ser inicializado antes de P0 e atualizado a cada fase, exceto em runtimes degradados sem escrita local.`,
    "- `research-graph.json` deve conectar query, waves, fontes, claims, players e decisões quando houver sinal defensável.",
    `- Todos os outputs deste runtime devem ficar em \`${runtimeDir}/\`; exemplos de código são permitidos apenas como documentação dentro dos Markdown desta pasta.`,
  ].join("\n")
}

function isResearchCliId(value: unknown): value is ResearchCliId {
  return value === "claude" || value === "codex" || value === "gemini" || value === "research-core" || value === "byok"
}

function isResearchMethodId(value: unknown): value is ResearchMethodId {
  return RESEARCH_METHODS.some((method) => method.id === value)
}

function resolveResearchMethodId(value: unknown, query: string): ResearchMethodId {
  const normalized = normalizeResearchMethodId(value)
  const explicit = typeof value === "string" && (isResearchMethodId(value) || value in LEGACY_RESEARCH_METHOD_IDS)
  if (explicit && normalized !== "mapping") return normalized
  return inferBenchmarkIntent(query) ? "benchmark" : normalized
}

function inferBenchmarkIntent(query: string) {
  const normalized = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return /\b(bench|benchmark|comparativo|comparacao|comparar|versus|vs\.?|ranking|rankear|score|pontuacao)\b/.test(normalized) ||
    /\btop\s*\d+\b/.test(normalized)
}

function normalizeResearchByokConfig(input: unknown): ResearchByokConfig | null {
  if (!input || typeof input !== "object") return null
  const record = input as Partial<ResearchByokConfig>
  const apiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : ""
  const model = typeof record.model === "string" ? record.model.trim() : ""

  if (!apiKey && !model) return null

  return {
    baseUrl: OPENROUTER_API_BASE_URL,
    apiKey,
    model,
    providerLabel: OPENROUTER_CLI_LABEL,
  }
}

function normalizeDatedResearchSlug(slug: string) {
  const match = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/)
  if (match) return `${match[1]}-${slugifyResearchTopic(match[2] ?? "")}`
  return `${new Date().toISOString().slice(0, 10)}-${slugifyResearchTopic(slug)}`
}

function truncateSlug(slug: string, maxLength: number) {
  if (slug.length <= maxLength) return slug
  const parts = slug.split("-")
  const kept: string[] = []
  for (const part of parts) {
    const next = [...kept, part].join("-")
    if (next.length > maxLength) break
    kept.push(part)
  }
  return kept.length > 0 ? kept.join("-") : slug.slice(0, maxLength).replace(/-+$/g, "")
}
