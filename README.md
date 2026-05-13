# AIOX Dash

Dashboard local para visualizar artefatos operacionais de Research, Bench e SINKRA Maps.

O app foi pensado para funcionar em instalações parciais. Se uma instalação não tiver `docs/` ou `outputs/`, a fonte correspondente simplesmente não aparece no menu.

## Fontes Suportadas

| Fonte | Pasta esperada | Rota | Comportamento |
|---|---|---|---|
| Research | `docs/research` | `/observatory/research` | Leitor de pesquisas em Markdown/YAML/JSON estruturado |
| Bench | `docs/bench` | `/observatory/bench` | Relatórios comparativos, matriz, score, personas, TCO e decisão |
| SINKRA Maps | `outputs/sinkra-squad` | `/observatory/sinkra-maps` | Mapas visuais de processo, fluxo, automação, governança, RACI, gaps e evidências |

## Descoberta Automática

Na inicialização de cada request, o app verifica se estas pastas existem:

```txt
docs/research
docs/bench
outputs/sinkra-squad
```

Regras:

- Se uma pasta não existir, a fonte não aparece no menu superior.
- Se uma rota direta for aberta para uma fonte inexistente, o app retorna `404`.
- `/observatory` redireciona para a primeira fonte disponível.
- Se nenhuma fonte existir, `/observatory` mostra uma tela de configuração vazia.

## Rodando Localmente

```bash
cd apps/dash
npm install
npm run dev -- --port 3001
```

Abra:

```txt
http://localhost:3001/observatory
```

## Estrutura Recomendada Dos Dados

### Research

```txt
docs/research/<slug>/
  README.md
  report.md
  recommendations.md
  metrics.yaml
  sources.yaml
```

### Bench

```txt
docs/bench/<slug>/
  bench-output-dash.json
  README.md
  scorecard.json
  executive-report.md
```

### SINKRA Maps

```txt
outputs/sinkra-squad/<group>/map/<slug>/
  observatory_map.yaml
  workflow_definition.yaml
  task_definitions.yaml
  quality_gates.yaml
  score_card.yaml
  process_map.yaml
  domain_map.yaml
  dependency_graph.yaml
  automation_specs.yaml
  raci_matrix.yaml
  capability_gaps.yaml
  compliance_score.yaml
```

Nenhum arquivo individual é obrigatório. Quanto mais artefatos estruturados existirem, mais visual e completo fica o relatório.

## Performance

O SINKRA Maps pode ter muitos arquivos em `outputs/`. Para reduzir latência:

- o índice de mapeamentos fica em cache em memória por 5 minutos;
- o payload estruturado do mapeamento selecionado fica em cache em memória por 5 minutos;
- o payload estruturado é carregado por aba: `map`, `flow`, `automation`, `governance`, `accountability`, `gaps`, `evidence`, `score` e `document` leem apenas os YAML/JSON necessários para aquela visualização;
- YAML/JSON estruturados da aba ativa são lidos em paralelo;
- o conteúdo bruto de documentos é carregado sob demanda apenas para o arquivo selecionado;
- views pesadas são carregadas com code splitting via `next/dynamic`.

Próximo passo recomendado: materializar um `_index.json` e um `observatory_payload.json` no pipeline que gera os mapeamentos. Isso evita varredura de filesystem e parse de YAML em runtime.

## Build

```bash
npm run build --workspaces=false
npm run typecheck --workspaces=false
```

Em uma instalação limpa, rode `build` antes de `typecheck`: o Next gera `.next/types`, que faz parte do `tsconfig.json`.

## Adaptação Para Outras Instalações

Para usar o app fora do Sinkra Hub:

1. Copie `apps/dash` para o novo monorepo ou app.
2. Preserve o layout relativo das pastas que deseja habilitar.
3. Crie apenas as fontes necessárias. Exemplo: se só quiser SINKRA Maps, crie apenas `outputs/sinkra-squad`.
4. Rode `/observatory`; o menu será montado automaticamente com base no que existir.

Instalações sem `docs/` e sem `outputs/` continuam abrindo normalmente: o app mostra uma tela de estado vazio em `/observatory` em vez de quebrar no loader.
