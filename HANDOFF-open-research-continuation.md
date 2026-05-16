# Handoff P1 — Continuar AIOX Research como Open Research Completo

```yaml
artifact:
  id: "2026-05-16-aiox-research-open-research-handoff"
  type: session
  template: handoff-template v3.1
  status: updated
  ttl: P30D
  created: "2026-05-16"
  updated: "2026-05-16"
  scope: intra_processo
  consumed: null
  parent_handoff: "apps/research/HANDOFF-research-compatibility.md"
  from: "Codex"
  to: "Agent:next-session"
```

**Date:** 2026-05-16  
**Owner:** Alan Nicolas  
**Status:** Workbench MVP -> Open Research completo  
**Priority:** P1  
**Scope:** intra_processo  
**Next Agent:** qualquer AI sem contexto prévio
**Latest App Commit:** `328edd4 fix(research): preserve runtime state across refresh`
**Latest Hub Pin:** `edf6c28da chore(research): track aiox research submodule`
**Local Dev URL:** `http://localhost:3001/research` via tmux session `aiox-research`

---

## CRITICAL CONTEXT

### What is this project

`apps/research` é o AIOX Research: um console local-first em Next.js que lê artefatos do workspace e renderiza Observatory views. Durante esta sessão ele deixou de ser apenas um localhost de observabilidade e passou a ter `/research`, uma tela operacional para iniciar pesquisas em paralelo usando CLIs locais e BYOK.

O objetivo de produto agora é fazer o AIOX Research virar um **Open Research**: uma experiência web limpa no estilo AIOX/Open Design, mas para pesquisa profunda, onde o operador escolhe runtimes, executa pesquisas paralelas, acompanha progresso, consolida resultados e abre os artefatos no Observatory.

### The problem in one sentence

**O Workbench já inicia pesquisas, mas ainda não é um Open Research completo porque a execução ainda é log-first, a persistência é mínima e a profundidade do Research Squad precisa ser aplicada e validada end-to-end.**

### The solution in one sentence

**Transformar o Workbench em runtime orchestrator estruturado, com eventos por fase, adapters reais por CLI/BYOK, artefatos ricos compatíveis com `SP-TECH-RESEARCH` e uma UX de pesquisa em andamento que sobreviva a refresh/restart.**

### Key Facts

```yaml
facts:
  - fact: "apps/research é um git submodule em main; não assuma que mudanças no Hub incluem commit do submodule."
    status: ACTIVE
    since: "2026-05-16"
  - fact: "/research já existe e detecta Claude Code, Codex CLI, Gemini CLI, OpenCode e BYOK."
    status: ACTIVE
    since: "2026-05-16"
  - fact: "Uma pesquisa deve ter uma pasta única em docs/research/<YYYY-MM-DD>-<slug>/."
    status: ACTIVE
    since: "2026-05-16"
  - fact: "Outputs por runtime devem ficar em docs/research/<slug>/runtimes/<runtime>/."
    status: ACTIVE
    since: "2026-05-16"
  - fact: "Pastas irmãs com sufixo -claude, -codex ou -gemini foram superadas."
    status: SUPERSEDED
    since: "2026-05-16"
    superseded_by: "layout parallel-runtimes-v1 dentro de uma pasta única"
  - fact: "O prompt agora referencia o pipeline completo SP-TECH-RESEARCH e assets de squads/research."
    status: ACTIVE
    since: "2026-05-16"
  - fact: "Consolidação não fica mais presa na sidebar; ela aparece abaixo da execução somente depois que todos os runtimes terminam ou quando já existe uma consolidação."
    status: ACTIVE
    since: "2026-05-16"
  - fact: "stderr/quota/rate-limit agora aparece na UI do runtime em vez de ficar invisível no log."
    status: ACTIVE
    since: "2026-05-16"
  - fact: "Refresh da página não deve mais apagar acompanhamento do Codex; o estado é reidratado pelo JSON de run e pode recuperar log sidecar quando o JSON estiver parcialmente corrompido."
    status: ACTIVE
    since: "2026-05-16"
  - fact: "Existe script de reparo legado: npm run repair:legacy --workspace=apps/research."
    status: ACTIVE
    since: "2026-05-16"
```

### Files to read BEFORE executing

```yaml
mandatory_reading:
  1_understand_product:
    - "apps/research/README.md"
    - "apps/research/HANDOFF-research-compatibility.md"
    - "apps/research/src/components/research/research-workbench.tsx"
  2_understand_runtime:
    - "apps/research/src/lib/research-workbench-contract.ts"
    - "apps/research/src/lib/research-cli.server.ts"
    - "apps/research/src/app/api/research/runs/route.ts"
    - "apps/research/src/app/api/research/runs/[runId]/stream/route.ts"
    - "apps/research/src/app/api/research/consolidations/route.ts"
  3_understand_research_depth:
    - ".agents/skills/tech-research/SKILL.md"
    - "squads/research/workflows/tech-research/tech-research-pipeline.yaml"
    - "squads/research/templates/tech-research/output-structure.md"
    - "squads/research/prompts/tech-research/evaluate.md"
    - "squads/research/prompts/tech-research/verify-citations.md"
  4_understand_observatory:
    - "apps/research/src/lib/research-observatory.server.ts"
    - "apps/research/src/app/observatory/[source]/page.tsx"
```

---

## CONTEXT

### Who is involved

- Alan Nicolas: product owner/operator. Quer design fiel ao AIOX, limpo, com central search e runtime picker estilo Open Design.
- Próximo agente: deve continuar implementação no mesmo workspace, sem reverter mudanças existentes.

### Accountability

```yaml
accountability:
  accountable: "Alan Nicolas"
  scope: review_only
  escalation: medium
```

### Project Structure

```txt
apps/research/
  README.md
  HANDOFF-research-compatibility.md
  HANDOFF-open-research-continuation.md
  src/app/research/page.tsx
  src/app/api/research/{clis,runs,consolidations}/...
  src/components/research/research-workbench.tsx
  src/lib/research-workbench-contract.ts
  src/lib/research-cli.server.ts
  src/lib/research-observatory.server.ts
docs/research/
  <YYYY-MM-DD>-<slug>/
    README.md
    00-query-original.md
    01-deep-research-prompt.md
    02-research-report.md
    03-recommendations.md
    metrics.yaml
    pipeline-state.yaml
    execution-log.jsonl
    sources.yaml
    research-graph.json
    runtimes/<runtime>/
```

### Glossary

| Term | Meaning |
|---|---|
| Open Research | Web workbench para iniciar, acompanhar, consolidar e explorar pesquisas profundas. |
| AIOX Research | App Next.js local-first em `apps/research`. |
| Observatory | Leitor visual de artefatos em `/observatory/<source>`. |
| Research Workbench | Tela `/research` para criar e acompanhar pesquisas. |
| Runtime | Executor de pesquisa: Claude, Codex, Gemini, OpenCode ou BYOK. |
| BYOK | Bring Your Own Key; provider OpenAI-compatible configurado pelo operador. |
| SP-TECH-RESEARCH | Pipeline completo do Research Squad com fases, waves e gates. |
| Coverage gate | Avaliação de cobertura após ondas de pesquisa. |
| Citation gate | Verificação de integridade de citações e claims. |
| Runtime dir | Subpasta `runtimes/<runtime>/` dentro da pesquisa. |
| Consolidation | Etapa que compara runtimes e escreve relatório final no diretório raiz. |
| Rich artifacts | YAML/JSON/Markdown estruturados que alimentam abas do Observatory. |
| SSE | Server-Sent Events usados para atualizar runs em tempo real. |
| Council Mode | Modo em que múltiplas LLMs pesquisam, revisam respostas anonimamente e um chairman sintetiza a decisão. |
| Blind peer review | Revisão em que modelos avaliam `Resposta A/B/C` sem saber qual runtime gerou cada uma. |
| Chairman | Runtime/modelo responsável por sintetizar consenso, dissenso, lacunas e decisão final. |
| Research Program | Arquivo `research-program.md` que define objetivo, budget, critérios e estratégia de uma pesquisa. |
| Scoreboard | Registro estruturado de tentativas, hipóteses, evidências, verdicts e ganhos de cobertura. |

---

## WHAT HAPPENED

### Executive Summary

- Criada experiência `/research` com buscador central, seletor Local CLI/BYOK, seleção múltipla de runtimes e botão `Executar`.
- A tela foi alinhada ao design system AIOX e enriquecida com runtime cards, foco de execução, estados e painel de consolidação.
- `research-cli.server.ts` detecta CLIs locais, inicia processos, cria estado de run em `.tmp/aiox-research-runs` e materializa shell em `docs/research/<slug>/`.
- BYOK foi adicionado com base URL, API key e model no navegador; servidor bloqueia upstream localhost/IP privado.
- SSE foi adicionado em `/api/research/runs/[runId]/stream`.
- URL passa a preservar sessão com `?runs=<runIds>&consolidation=<id>`.
- O contrato foi ajustado para uma pasta por pesquisa com subpastas `runtimes/<runtime>/`.
- O prompt agora força a profundidade do `SP-TECH-RESEARCH`, com refs para skill, workflows, prompts, templates e guardrails.
- Foram identificadas duas inspirações externas úteis: `karpathy/autoresearch` para programa + orçamento + scoreboard, e `karpathy/llm-council` para conselho multi-modelo com revisão cega e chairman.
- A tela de pesquisa em andamento foi ajustada para não manter o form principal disponível quando há runs ativos na URL.
- O painel de consolidação saiu da sidebar e agora só aparece quando todos os runtimes terminam ou quando há run de consolidação.
- Erros de runtime, incluindo `stderr`, quota exhaustion, rate limit e tentativas falhas, agora aparecem no card/detalhe do runtime.
- O stream SSE foi aumentado para execuções longas e o estado de run agora usa escrita enfileirada/atômica para reduzir corrupção por concorrência.
- Rodado reparo local de legacy runs: dois grupos antigos foram consolidados em pasta única com `runtimes/<cli>/`, e três estados em `.tmp/aiox-research-runs/` foram reparados.

### Decisions Made

| Decision | Why | Alternatives Rejected |
|---|---|---|
| Uma pasta por pesquisa | Observatory precisa consolidar por tema, não por CLI. | `slug-claude`, `slug-codex`, `slug-gemini`. |
| Runtime isolation em `runtimes/<runtime>/` | Permite paralelismo sem sobrescrever artefatos. | Misturar saídas no root antes da consolidação. |
| BYOK OpenAI-compatible primeiro | Cobre vários providers com um adapter simples. | Adapters nativos Anthropic/Google/Azure agora. |
| Prompt com Research Squad inline | Codex/Gemini/BYOK não ativam skills do mesmo modo que Claude. | Só escrever “use a skill tech-research”. |
| SSE para estado/log | Melhor que polling para execução em andamento. | Polling periódico simples. |
| Council Mode como camada deliberativa | Rodar várias LLMs só em paralelo não basta; é preciso revisão cruzada, dissenso e síntese defensável. | Consolidar por resumo simples ou voto superficial. |

### Lessons Learned

**What worked:**
- Manter o design clean e centralizado melhorou muito a legibilidade.
- Remover duplicidade de “CLI selecionado” reduziu ruído.
- URL-pinned runs resolvem refresh durante execução.

**Mistakes to NOT repeat:**

```yaml
error:
  description: "Criar uma pasta por runtime gerou fragmentação no Observatory."
  root_cause: "O slug inicial incluía o runtime."
  lesson: "O slug é da pesquisa; o runtime é uma subpasta."
error:
  description: "Referenciar a skill tech-research sem contrato inline era fraco."
  root_cause: "Nem todo runtime carrega skills locais."
  lesson: "Prompts enviados pela UI devem conter o protocolo mínimo de profundidade."
```

---

## EXTERNAL REFERENCES AND TRANSFERABLE IDEAS

### Karpathy autoresearch

Reference:

- `https://github.com/karpathy/autoresearch`
- `https://github.com/karpathy/autoresearch/blob/master/program.md`

Transferir para o Open Research:

- `program.md` vira `research-program.md`: a pesquisa tem um programa explícito com objetivo, budget, critérios de parada e superfície permitida.
- Harness fixo: no autoresearch o agente não muda o avaliador; aqui os runtimes não podem mudar `SP-TECH-RESEARCH`, schemas, coverage gate ou citation gate.
- Budget comparável: tempo, ondas, número de fontes ou tokens precisam ser declarados antes da execução.
- Scoreboard: registrar tentativas como `keep | discard | defer`, com hipótese, método, delta de cobertura e motivo.
- Memória de falhas: registrar hipóteses refutadas, queries ruins e fontes fracas em `dead-ends.yaml` ou `deviations.yaml`.

### Karpathy llm-council

Reference:

- `https://github.com/karpathy/llm-council`
- `https://github.com/karpathy/llm-council/blob/master/README.md`
- `https://github.com/karpathy/llm-council/blob/master/CLAUDE.md`

Transferir para o Open Research:

- Stage 1, first opinions: cada runtime gera uma pesquisa/opinião inicial independente.
- Stage 2, blind peer review: cada runtime recebe respostas anônimas `Resposta A/B/C` e avalia por critérios.
- Stage 3, chairman synthesis: um runtime/modelo sintetiza consenso, dissenso, lacunas e decisão.
- Não comprimir dissenso cedo: a síntese deve preservar opinião minoritária forte e claims frágeis.
- Rankings por dimensão: evidência, rastreabilidade, profundidade, novidade, utilidade para decisão e integridade de citação.

### Draft: Council Mode para AIOX Open Research

```txt
/research
  mode:
    - Pesquisa paralela
    - Conselho
    - Conselho + Consolidação

docs/research/<slug>/
  research-program.md
  research-trials.jsonl
  dead-ends.yaml
  council/
    council-config.yaml
    stage-1-first-opinions.md
    stage-2-peer-reviews.yaml
    stage-3-rankings.yaml
    stage-4-chairman-synthesis.md
    dissenting-opinions.md
    council-trace.jsonl
```

Council verdict schema draft:

```yaml
review:
  reviewer_runtime: codex
  anonymized_target: Response B
  scores:
    evidence_quality: 0-10
    source_traceability: 0-10
    reasoning_depth: 0-10
    novelty: 0-10
    decision_usefulness: 0-10
    citation_integrity: 0-10
  verdict: keep | discard | defer
  strongest_claim: "..."
  weakest_claim: "..."
  missing_evidence:
    - "..."
```

Chairman synthesis must output:

- consenso
- dissensos
- opinião minoritária forte
- claims frágeis
- lacunas críticas
- decisão recomendada
- confidence_score
- o que mudaria a conclusão

---

## WHAT IS MISSING

### Latest Implementation Snapshot

```yaml
app_repo:
  path: "apps/research"
  remote: "https://github.com/oalanicolas/aiox-research.git"
  branch: "main"
  latest_commit: "328edd4 fix(research): preserve runtime state across refresh"
hub_repo:
  path: "/Users/oalanicolas/Code/sinkra-hub"
  branch: "oalanicolas"
  relevant_submodule_pin: "edf6c28da chore(research): track aiox research submodule"
server:
  tmux_session: "aiox-research"
  url: "http://localhost:3001/research"
validated:
  - "npm run typecheck --workspace=apps/research"
  - "npm run build --workspace=apps/research"
  - "npm run repair:legacy --workspace=apps/research"
  - "curl -I http://localhost:3001/research"
  - "curl -I http://localhost:3001/observatory/research?slug=<migrated-slug>"
local_migrated_research_dirs:
  - "docs/research/2026-05-16-quero-que-faca-uma-pesquisa-sobre-concorrentes-do-open-design-e-faca-uma/"
  - "docs/research/2026-05-16-sistema-de-busca-no-estilo-andrew-karpathy-de-conselho-de-ias-e-como-pod/"
commit_caveat:
  - "Os artefatos migrados em docs/research/ foram deixados como outputs locais/generated e não foram versionados no Hub."
  - "O submodule apps/research tem .DS_Store não rastreados; não commitar esses arquivos."
```

### Current State vs Desired State

```txt
CURRENT STATE:
/research -> POST run -> spawn CLI/BYOK -> append log -> SSE tail -> files shell
                                        -> runtime raw-output.log
                                        -> manual/LLM-dependent artifacts

DESIRED STATE:
/research or /research/<slug>
  -> orchestrator structured run
  -> per-runtime adapters emit canonical events
  -> UI renders phase/step/source progress
  -> artifacts are written and validated
  -> consolidation produces root report
  -> Observatory opens rich tabs from the same folder
```

### Success Criteria

```yaml
success_criteria:
  - "Nova pesquisa cria exatamente uma pasta docs/research/<date>-<slug>/."
  - "Refresh ou reabertura da URL recupera estado e logs sem perder a pesquisa."
  - "Cada runtime emite eventos estruturados por fase, não só texto bruto."
  - "Pelo menos Claude, Codex e Gemini conseguem executar em paralelo quando instalados."
  - "BYOK gera saída útil e salva artifacts mínimos sem vazar chave."
  - "Consolidação lê runtimes/* e escreve README/report/recommendations/metrics/sources/graph no root."
  - "Council Mode salva first opinions, peer reviews anônimos, rankings e chairman synthesis em docs/research/<slug>/council/."
  - "Observatory mostra a pesquisa recém-criada em /observatory/research."
  - "npm run build --workspace=apps/research e npm run typecheck --workspace=apps/research passam."
```

### What was NOT done

```yaml
not_done:
  - "Decidir se os artefatos migrados localmente em docs/research/ devem ser versionados ou tratados apenas como generated outputs."
  - "Trocar log-first por RunOrchestrator com schema canônico de eventos."
  - "Parsear stream-json/NDJSON real de Claude, Codex e Gemini."
  - "Executar extractors do Research Squad após cada run/consolidação."
  - "Persistir índice durável de runs fora de .tmp para sobreviver a cleanup/redeploy; refresh/restart local já está parcialmente coberto por JSON + sidecar log."
  - "Criar rota dedicada /research/<slug> ou /research/runs/<runId>."
  - "Implementar Council Mode com Stage 1/2/3, blind peer review e chairman."
  - "Criar research-program.md, research-trials.jsonl, dead-ends.yaml e council/*."
  - "Adicionar testes unitários para normalização de slug, BYOK URL guard e prompt contract."
  - "Fazer auditoria visual com browser/screenshot."
```

---

## EXECUTION PLAN

### Phase 1: Persistência e Rotas Estáveis

**Objective:** fazer pesquisa em andamento sobreviver a refresh e restart.

- Persistir `run-state.json` ou `runs/<runId>.json` dentro de `docs/research/<slug>/`.
- Definir rota canônica: preferir `/research/<slug>` para a pesquisa e `/research` para nova pesquisa.
- Ao clicar em nova pesquisa, limpar query params e voltar para a tela inicial centralizada.
- Criar loader que reconstrói runs a partir de `docs/research/<slug>/execution-log.jsonl` e runtime summaries.

### Phase 2: Orchestrator Estruturado

**Objective:** substituir log bruto por eventos canônicos.

- Criar tipos `Run`, `RuntimeRun`, `Step`, `RunEvent` ou adaptar o contrato já em `research-workbench-contract.ts`.
- Fazer adapters emitirem `runtime.started`, `step.start`, `step.substep`, `step.done`, `runtime.done`, `runtime.failed`.
- Manter SSE como transporte, mas enviar eventos estruturados e snapshot.
- UI deve renderizar fases do `SP-TECH-RESEARCH`, não só status genérico.

### Phase 3: Adapters Reais e Artifact Pipeline

**Objective:** executar pesquisa profunda de verdade.

- Claude: usar `claude -p --output-format stream-json --verbose` quando disponível e mapear tool_use/tool_result.
- Codex: usar `codex exec --json` quando estável; fallback para log plain.
- Gemini: confirmar `gemini --help` e output JSON atual antes de fixar parser.
- BYOK: pedir resposta em formato estruturado e salvar Markdown/YAML mínimos no runtime dir.
- Rodar scripts de `squads/research/scripts/tech-research/*` após finalização quando possível, com fallback seguro.

### Phase 4: UX Open Research Completa

**Objective:** deixar a tela final polida como produto.

- Separar estado “nova pesquisa” de “pesquisa em andamento”.
- Na pesquisa em andamento, esconder form principal e mostrar apenas contexto, runtimes, timeline, outputs e ações.
- Criar comparador/consolidador com consenso, dissenso, lacunas, fontes e decisão.
- Abrir Observatory diretamente no slug correto.
- Adicionar microcopy PT-BR operator-first, sem marketing vazio.

### Phase 5: Council Mode

**Objective:** transformar múltiplas LLMs em deliberação estruturada, não apenas execução paralela.

- Adicionar seletor de modo: `Pesquisa paralela`, `Conselho`, `Conselho + Consolidação`.
- Stage 1: executar first opinions independentes por runtime selecionado.
- Stage 2: anonimizar outputs como `Resposta A/B/C` e pedir peer review por critérios.
- Stage 3: gerar chairman synthesis com consenso, dissenso, opinião minoritária forte, lacunas e decisão.
- Salvar artefatos em `docs/research/<slug>/council/`.
- Mostrar aba `Conselho` no Observatory com first opinions, matriz de revisão, ranking, dissensos e síntese.
- Evitar consenso falso: chairman deve preservar divergências e claims não suportados.

### Files to Create/Modify

**Create:**

| File | Content |
|---|---|
| `apps/research/src/lib/research-orchestrator.server.ts` | Orchestrator, state map, replay/snapshot e persistência. |
| `apps/research/src/lib/research-runtime-events.ts` | Tipos e reducer puro para eventos. |
| `apps/research/src/lib/research-adapters/{claude,codex,gemini,byok}.server.ts` | Adapters isolados por runtime. |
| `apps/research/src/lib/research-council.server.ts` | Orquestra Stage 1/2/3, anonimização, ranking e chairman synthesis. |
| `apps/research/src/lib/research-council-types.ts` | Schemas de first opinion, peer review, ranking e synthesis. |
| `apps/research/src/app/research/[slug]/page.tsx` | Página canônica da pesquisa em andamento. |

**Modify:**

| File | Change |
|---|---|
| `apps/research/src/lib/research-cli.server.ts` | Reduzir responsabilidade para discovery/spawn ou migrar para adapters. |
| `apps/research/src/components/research/research-workbench.tsx` | Consumir snapshot/eventos estruturados e estados de página. |
| `apps/research/src/app/api/research/runs/[runId]/stream/route.ts` | Replay de eventos e snapshot persistido. |
| `apps/research/src/lib/research-observatory.server.ts` | Garantir leitura recursiva de `runtimes/*` e artefatos novos. |
| `apps/research/src/app/api/research/consolidations/route.ts` | Adicionar path de Council Mode/Chairman quando modo conselho estiver ativo. |
| `apps/research/README.md` | Atualizar comandos e contrato conforme novas rotas. |

---

## VETO CONDITIONS

```yaml
veto_conditions:
  V1_NO_SIBLING_RUNTIME_FOLDERS:
    trigger: "Código cria docs/research/<slug>-claude ou similares."
    action: "Parar e corrigir para docs/research/<slug>/runtimes/<runtime>/."
  V2_NO_SECRET_PERSISTENCE:
    trigger: "API key BYOK aparece em arquivo, log, URL ou artifact."
    action: "Remover persistência, redigir logs e revisar proxy."
  V3_NO_FAKE_RESEARCH:
    trigger: "Artifact inventa fonte, número, player ou claim sem evidência."
    action: "Marcar como inferência, lacuna ou remover."
  V4_NO_UNRELATED_REVERT:
    trigger: "Git mostra mudanças existentes não relacionadas."
    action: "Trabalhar ao redor; não reverter sem pedido explícito."
  V5_NO_VALIDATE_YAML_FULL:
    trigger: "Tentação de rodar npm run validate:yaml."
    action: "Não rodar; usar validações focadas. Esse comando pode levar 20+ min."
  V6_NO_FALSE_COUNCIL_CONSENSUS:
    trigger: "Chairman apaga dissensos ou transforma voto majoritário em verdade."
    action: "Preservar consenso, dissenso, opinião minoritária forte e claims frágeis."
```

---

## BOOTSTRAP PROTOCOL

### Self-Verification

```yaml
verification:
  - question: "Qual é a unidade canônica de uma pesquisa?"
    expected: "docs/research/<YYYY-MM-DD>-<slug>/"
    if_wrong: "Re-read CRITICAL CONTEXT and VETO V1."
  - question: "Onde fica a saída individual de cada runtime?"
    expected: "docs/research/<slug>/runtimes/<runtime>/"
    if_wrong: "Re-read Key Facts."
  - question: "A tela de pesquisa em andamento deve mostrar o form livre?"
    expected: "Não; deve focar na pesquisa atual e usar /research para nova pesquisa."
    if_wrong: "Re-read Phase 4."
  - question: "Qual profundidade mínima o prompt deve exigir?"
    expected: "SP-TECH-RESEARCH com decomposição, waves, coverage gate, synthesis, citation gate e documentação."
    if_wrong: "Re-read mandatory research files."
  - question: "Qual é a diferença entre pesquisa paralela e Council Mode?"
    expected: "Pesquisa paralela gera saídas independentes; Council Mode adiciona revisão cega, ranking e chairman synthesis."
    if_wrong: "Re-read EXTERNAL REFERENCES AND TRANSFERABLE IDEAS."
```

### First Command

```bash
git -C apps/research status --short
```

### Restart Local Server

```bash
tmux kill-session -t aiox-research
tmux new-session -d -s aiox-research "zsh -lc 'cd /Users/oalanicolas/Code/sinkra-hub && npm run dev --workspace=apps/research -- --port 3001'"
```

### Valid Questions

- “Você quer migrar as pastas antigas separadas por runtime agora ou só garantir o layout em novas pesquisas?”
- “A rota canônica deve ser `/research/<slug>` ou `/research/runs/<runId>`?”
- “Quais providers BYOK devem virar presets oficiais além de OpenAI-compatible genérico?”
- “No Council Mode, o chairman deve ser selecionado pelo operador ou escolhido automaticamente pelo sistema?”

### Invalid Questions

- “O AIOX Research deve continuar criando uma pasta por CLI?” Não; isso foi superado.
- “Posso salvar API key BYOK em arquivo?” Não.
- “Posso fazer uma resposta rasa de LLM?” Não para o Workbench; o contrato é Research Squad.
- “Council Mode é só média das respostas?” Não; é revisão cega, ranking por critério, dissenso preservado e chairman synthesis.

---

## CONCRETE EXAMPLE

Quando o operador pesquisa “concorrentes do Open Design” com Claude, Codex e Gemini:

```txt
docs/research/2026-05-16-concorrentes-do-open-design/
  README.md
  00-query-original.md
  01-deep-research-prompt.md
  02-research-report.md
  03-recommendations.md
  metrics.yaml
  pipeline-state.yaml
  sources.yaml
  research-graph.json
  execution-log.jsonl
  runtimes/
    claude/
      prompt.md
      runtime-summary.md
      raw-output.log
      wave-1-summary.md
      sources.yaml
    codex/
      prompt.md
      runtime-summary.md
      raw-output.log
    gemini/
      prompt.md
      runtime-summary.md
      raw-output.log
```

A consolidação deve ler os três runtime dirs, comparar consenso/dissenso, verificar fontes, atualizar os arquivos raiz e abrir:

```txt
/observatory/research?slug=2026-05-16-concorrentes-do-open-design
```

---

## CURRENT VALIDATION

```yaml
validated_on: "2026-05-16"
commands:
  - command: "npm run build --workspace=apps/research"
    result: pass
  - command: "npm run typecheck --workspace=apps/research"
    result: pass
  - command: "npm run repair:legacy --workspace=apps/research"
    result: pass
    output_summary: "groups=2, runtimeDirsCopied=6, consolidatedDirsCopied=1, rootFilesCreated=38, runStatesRepaired=3"
  - command: "curl -I http://localhost:3001/research"
    result: pass
    output_summary: "HTTP 200"
  - command: "curl -I http://localhost:3001/observatory/research?slug=<migrated-slug>"
    result: pass
    output_summary: "HTTP 200"
notes:
  - "typecheck antes do build pode falhar se .next/types ainda não existir; o README já documenta rodar build antes."
  - "Não foi feita auditoria visual com browser nesta última etapa."
  - "A UI agora mostra stderr/quota/rate-limit, mas ainda falta uma visual QA formal com screenshot diff."
```
