# LOGOS Engine — Arquitetura TUI-first MVP

## 1. Decisão central

O LOGOS Engine é uma ferramenta **local-first, Git-native, TUI-first**, implementada como **single package modular** com TypeScript. O agente LOGOS é um workflow determinístico de documentação apoiado por LLM — não um agent runtime genérico.

```txt
LOGOS TUI (Ink + React)
  ↓
LOGOS Application Layer (use cases + interview state machine)
  ↓
LOGOS Core (schemas, graph, validators, completeness, phases)
  ↓
LOGOS LLM (transport + structured output + retry + validation)
  ↓
OpenAI-compatible provider
```

O LLM **não governa o fluxo**. Ele retorna estruturas validadas. O Core aplica transições.

A UI é uma TUI própria (Ink), operando sobre documentos, fases, validações, artefatos e execução derivada.

---

## 2. Visão macro

```txt
┌──────────────────────────────────────────────────────────────┐
│                        src/tui                               │
│  LOGOS TUI: navegação, comandos, status, revisão, diffs       │
│  (Ink screens + components + tui-store)                       │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                     src/interview                            │
│  State machine: perguntar → transcrever → avaliar →         │
│  sintetizar → canonical answer → avançar                     │
│  (governed by Core, assisted by LLM)                          │
└───────────────┬──────────────────────────┬───────────────────┘
                │                          │
┌───────────────▼──────────────┐ ┌─────────▼───────────────────┐
│        src/core              │ │       src/llm                │
│  schemas, loaders, graph,    │ │  generateStructuredOutput()  │
│  validators, completeness,   │ │  generateText()              │
│  phases, documents           │ │  retry, validation, config   │
└───────────────┬──────────────┘ └─────────┬───────────────────┘
                │                          │
┌───────────────▼──────────────┐ ┌─────────▼───────────────────┐
│    src/renderers              │ │    src/prompts               │
│  markdown, html, agent packs  │ │  assessAnswer,              │
│                               │ │  synthesizeCanonicalAnswer,  │
│                               │ │  detectConflict,             │
│                               │ │  generateDocumentDraft       │
└───────────────┬──────────────┘ └─────────────────────────────┘
                │
┌───────────────▼──────────────┐
│     src/executive            │
│  Executive compiler +        │
│  adapters (GitHub, Notion,   │
│  Markdown, HTML, Agent Pack) │
└──────────────────────────────┘

Infraestrutura transversal:
┌──────────────────────────────────────────────────────────────┐
│  src/fs          src/shared        src/cli                    │
│  atomic write,   Result<T>,        Commander commands,        │
│  safe path,      Brand<ID>,        command registry           │
│  YAML/JSONL      LogosError                                 │
└──────────────────────────────────────────────────────────────┘
```

Regra estrutural do LOGOS:

```txt
YAML / Markdown = fonte canônica
CanonicalAnswerRecord = material de origem para geração
JSON = modelo executivo portável (Executive Plan)
HTML = camada de entendimento humano
Agent Packs = prompts de execução para agentes externos
```

---

## 3. Estrutura de pastas do repositório LOGOS Engine

Reflete o estado real do MVP single package modular:

```txt
logos-engine/
├── src/
│   ├── cli/
│   │   ├── main.ts                  # entrypoint CLI
│   │   ├── command-registry.ts
│   │   └── commands/
│   │       ├── init.ts
│   │       ├── status.ts
│   │       ├── validate.ts
│   │       ├── interview.ts
│   │       ├── generate.ts
│   │       └── compile.ts
│   │
│   ├── tui/
│   │   ├── state/
│   │   │   ├── tui-state.ts
│   │   │   └── tui-actions.ts
│   │   └── (screens + components)
│   │
│   ├── core/
│   │   ├── project/
│   │   │   ├── load-project.ts
│   │   │   ├── project-manifest.ts
│   │   │   ├── project-graph.ts
│   │   │   └── project-status.ts
│   │   ├── schema/
│   │   │   ├── docs.schema.ts
│   │   │   ├── phase.schema.ts
│   │   │   ├── document.schema.ts
│   │   │   ├── executive.schema.ts
│   │   │   └── validate-schema.ts
│   │   ├── documents/
│   │   │   ├── parse-markdown.ts
│   │   │   ├── extract-sections.ts
│   │   │   ├── validate-document.ts
│   │   │   ├── document-completeness.ts
│   │   │   └── document-patch.ts
│   │   ├── phases/
│   │   │   ├── phase-registry.ts
│   │   │   ├── phase-completeness.ts
│   │   │   └── phase-dependencies.ts
│   │   ├── diagnostics/
│   │   │   ├── Diagnostic.ts
│   │   │   ├── severity.ts
│   │   │   └── format-diagnostics.ts
│   │   └── index.ts
│   │
│   ├── interview/
│   │   ├── transcript/
│   │   │   ├── TranscriptMessage.ts
│   │   │   ├── TranscriptStore.ts
│   │   │   ├── append-transcript-message.ts
│   │   │   └── export-transcript-markdown.ts
│   │   ├── questions/
│   │   │   ├── interview-question.ts
│   │   │   ├── load-questions.ts
│   │   │   └── question-queue.ts
│   │   ├── answers/
│   │   │   ├── CanonicalAnswerRecord.ts
│   │   │   ├── assess-answer.ts
│   │   │   ├── AnswerAssessment.ts
│   │   │   ├── synthesize-final-answer.ts
│   │   │   ├── finalize-answer.ts
│   │   │   └── revise-answer.ts
│   │   ├── decisions/
│   │   │   ├── DocumentationDecision.ts
│   │   │   ├── record-decision.ts
│   │   │   └── trace-decision-sources.ts
│   │   ├── state-machine/
│   │   │   ├── interview-state.ts
│   │   │   ├── interview-events.ts
│   │   │   ├── transition-interview-state.ts
│   │   │   └── guards.ts
│   │   ├── trace/
│   │   │   ├── build-answer-trace.ts
│   │   │   ├── build-document-trace.ts
│   │   │   └── verify-trace-completeness.ts
│   │   ├── generation-readiness/
│   │   │   └── get-generation-readiness.ts
│   │   └── index.ts
│   │
│   ├── llm/
│   │   ├── client.ts                    # LlmClient interface + createLlmClient factory
│   │   ├── config.ts                    # loadLlmConfig, validateLlmConfig, .env loading
│   │   ├── types.ts                     # shared LLM types (placeholder)
│   │   ├── generate-text.ts             # raw text completion (exceção, não regra)
│   │   ├── generate-json.ts             # prompt-based JSON (legado)
│   │   ├── generate-structured-output.ts # ★ PRIMITIVO CENTRAL para LLM estruturado
│   │   ├── retry-policy.ts              # withRetry, isRetryable, backoff
│   │   ├── response-validation.ts       # ValidationOutcome, validateAgainstSchema
│   │   └── index.ts                     # barrel público
│   │
│   ├── prompts/
│   │   ├── assess-answer.prompt.ts
│   │   ├── synthesize-canonical-answer.prompt.ts
│   │   ├── detect-conflict.prompt.ts
│   │   ├── resolve-conflict.prompt.ts
│   │   ├── generate-document.prompt.ts
│   │   ├── review-document.prompt.ts
│   │   ├── compile-executive.prompt.ts
│   │   └── index.ts
│   │
│   ├── renderers/
│   │   ├── markdown/
│   │   │   ├── render-document.ts
│   │   │   ├── render-implementation-plan.ts
│   │   │   └── render-validation-report.ts
│   │   ├── html/
│   │   │   ├── html-shell.ts
│   │   │   ├── render-project-dashboard.ts
│   │   │   ├── render-phase-map.ts
│   │   │   └── render-executive-overview.ts
│   │   ├── agent-pack/
│   │   │   ├── render-agent-pack-index.ts
│   │   │   ├── render-implementation-prompt.ts
│   │   │   └── render-review-prompt.ts
│   │   └── index.ts
│   │
│   ├── executive/
│   │   ├── compiler/
│   │   │   ├── compile-executive-plan.ts
│   │   │   ├── derive-milestones.ts
│   │   │   ├── derive-initiatives.ts
│   │   │   ├── derive-execution-items.ts
│   │   │   └── trace-sources.ts
│   │   ├── adapters/
│   │   │   ├── github-issues-adapter.ts
│   │   │   ├── notion-adapter.ts
│   │   │   ├── markdown-adapter.ts
│   │   │   ├── html-adapter.ts
│   │   │   └── agent-pack-adapter.ts
│   │   ├── schema/
│   │   │   └── executive-plan.schema.ts
│   │   └── index.ts
│   │
│   ├── fs/
│   │   ├── project-fs.ts
│   │   ├── safe-path.ts
│   │   ├── atomic-write.ts
│   │   ├── read-yaml.ts
│   │   └── write-jsonl.ts
│   │
│   └── shared/
│       ├── errors/
│       │   ├── LogosError.ts
│       │   └── invariant.ts
│       ├── types/
│       │   ├── Brand.ts
│       │   └── Result.ts
│       ├── utils/
│       │   ├── id.ts
│       │   ├── date.ts
│       │   └── json.ts
│       └── index.ts
│
├── templates/          # templates de documentos e fases
├── profiles/           # perfis de projeto
├── examples/           # projetos de exemplo
├── docs/               # documentação da engine
├── tests/              # testes unitários e de integração
├── package.json        # single package (sem workspaces)
├── tsconfig.json
├── vitest.config.ts
├── biome.json
└── README.md
```

---

## 4. Estrutura gerada dentro de um projeto LOGOS

Quando o usuário roda:

```bash
logos init
```

O projeto alvo recebe:

```txt
my-project/
├── logos.yml
├── docs.yml
├── phases/
│   ├── 01-foundation.yml
│   ├── 02-validation.yml
│   ├── 03-product.yml
│   ├── 04-engineering.yml
│   ├── 05-go-to-market.yml
│   └── 06-operations.yml
├── docs/
│   ├── 01-foundation/
│   │   ├── README.md
│   │   ├── 01-thesis.md
│   │   ├── 02-problem.md
│   │   └── ...
│   ├── 02-validation/
│   ├── 03-product/
│   ├── 04-engineering/
│   ├── 05-go-to-market/
│   └── 06-operations/
├── executive/
│   ├── executive-plan.json
│   ├── executive-plan.schema.json
│   └── exports/
│       ├── markdown/
│       ├── html/
│       ├── github/
│       ├── notion/
│       └── agent-packs/
├── outcomes/
│   ├── html/
│   ├── reports/
│   └── snapshots/
└── .logos/
    ├── interviews/
    │   └── interview_YYYY-MM-DD_HHMMSS/
    │       ├── state.json
    │       ├── transcript.jsonl
    │       ├── transcript.md
    │       ├── canonical-answers.json
    │       ├── answer-revisions.json
    │       ├── conflicts.json
    │       ├── decisions.json
    │       ├── generation-readiness.json
    │       └── generated-drafts/
    │           ├── 01-thesis.draft-001.md
    │           └── 01-thesis.draft-001.trace.json
    ├── sessions/
    ├── cache/
    ├── runs/
    ├── logs/
    └── config.local.json
```

### Regra

O `executive-plan.json` é o modelo executivo portável. O LOGOS não é um task manager — ele compila execução e exporta para ferramentas externas.

---

## 5. Mockups da TUI

### 5.1 Overview

```txt
╭─ LOGOS Engine ───────────────────────────────────────────────╮
│ Project: nomos                         Branch: main           │
│ Root: ~/dev/nomos                      Mode: local            │
├───────────────────────────────────────────────────────────────┤
│ Overview                                                      │
│                                                               │
│  Normative Axis                                               │
│  ┌───────────────────────┬──────────┬────────────┬─────────┐ │
│  │ Phase                 │ Docs     │ Diagnostics│ Action  │ │
│  ├───────────────────────┼──────────┼────────────┼─────────┤ │
│  │ 01 Foundation         │ 7 / 7    │ clean      │ review  │ │
│  │ 02 Validation         │ 8 / 10   │ 2 gaps     │ generate│ │
│  │ 03 Product            │ 5 / 13   │ 8 missing  │ continue│ │
│  │ 04 Engineering        │ 0 / 14   │ not started│ generate│ │
│  │ 05 Go-to-market       │ 0 / 13   │ not started│ generate│ │
│  │ 06 Operations         │ 0 / 14   │ not started│ generate│ │
│  └───────────────────────┴──────────┴────────────┴─────────┘ │
│                                                               │
│  Executive Axis                                               │
│  ┌───────────────────────┬─────────────────────────────────┐  │
│  │ executive-plan.json   │ not compiled                    │  │
│  │ agent packs           │ none                            │  │
│  │ html overview         │ stale / missing                 │  │
│  └───────────────────────┴─────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────┤
│ Next recommended action                                       │
│  Generate missing Validation docs before compiling Executive. │
├───────────────────────────────────────────────────────────────┤
│ [g] generate  [r] review  [v] validate  [e] executive  [?] help│
╰───────────────────────────────────────────────────────────────╯
```

---

### 5.2 Interview — Active Question

```txt
╭─ LOGOS Interview ─────────────────────────────────────────────╮
│ Phase: 01 Foundation       Document: 01 Thesis                │
│ Question: 2 / 5            Status: awaiting answer            │
├───────────────────────────────────────────────────────────────┤
│ Pergunta                                                      │
│ Que tensão principal este projeto tenta resolver?             │
│                                                               │
│ Orientação                                                    │
│ Descreva o conflito real que faz este projeto ser necessário. │
├───────────────────────────────────────────────────────────────┤
│ Resposta atual                                                │
│ _                                                             │
├───────────────────────────────────────────────────────────────┤
│ [enter] send  [skip] skip  [back] previous  [pause] pause     │
╰───────────────────────────────────────────────────────────────╯
```

### 5.3 Interview — Canonical Answer Confirmation

```txt
╭─ Canonical Answer Draft ──────────────────────────────────────╮
│ Question: 2 / 5                                               │
│ Confidence: medium                                            │
├───────────────────────────────────────────────────────────────┤
│ Resposta final proposta                                       │
│                                                               │
│ O projeto existe para ajudar pessoas a transformar ideias      │
│ difusas em documentação clara, estruturada e acionável.        │
│                                                               │
│ Source messages: msg_002, msg_004                             │
├───────────────────────────────────────────────────────────────┤
│ [a] accept  [e] edit  [r] answer again  [d] show transcript    │
╰───────────────────────────────────────────────────────────────╯
```

### 5.4 Document Review com Diff

```txt
╭─ Document: docs/03-product/04-ux-model.md ────────────────────╮
│ Status: draft        Schema: valid        Completeness: 82%    │
├───────────────────────┬───────────────────────────────────────┤
│ Outline               │ Current Section                       │
│                       │                                       │
│ ✓ UX Thesis           │ ## Trust Model                        │
│ ✓ Experience Principles│                                      │
│ ✓ Primary UX Paradigm │ The product should disclose when the  │
│ ✓ User Mental Model   │ agent is reasoning, proposing, or     │
│ ! Trust Model         │ executing. It must not blur suggestion│
│ · UX Anti-Patterns    │ and committed state.                  │
│                       │                                       │
│ Diagnostics           │ Agent suggestion:                     │
│ - Missing examples    │ Add explicit distinction between:     │
│ - Weak anti-patterns  │ - draft                               │
│                       │ - proposed patch                      │
│                       │ - accepted canonical state            │
├───────────────────────┴───────────────────────────────────────┤
│ Diff Preview                                                  │
│ + ## UX Anti-Patterns                                         │
│ + - Treating generated drafts as canonical without review.     │
│ + - Hiding unresolved assumptions inside polished prose.        │
├───────────────────────────────────────────────────────────────┤
│ [p] propose patch  [a] accept  [x] reject  [v] validate        │
╰───────────────────────────────────────────────────────────────╯
```

### 5.5 Executive Compiler

```txt
╭─ Executive Compiler ───────────────────────────────────────────╮
│ Source: Normative Axis              Output: executive JSON     │
├───────────────────────┬───────────────────────────────────────┤
│ Roadmap               │ Execution Graph                       │
│                       │                                       │
│ → MVP-001             │ Roadmap                               │
│   Normative core      │  └─ Milestone: Normative Axis Ready   │
│                       │      └─ Initiative: Schema System     │
│ Milestones            │          ├─ TASK-001 Create schemas   │
│ ✓ M-001 Foundation    │          ├─ TASK-002 Validate docs    │
│ · M-002 Product       │          ├─ REVIEW-001 Review gaps    │
│ · M-003 Engineering   │          └─ AGENT-001 Generate prompt │
│                       │                                       │
│ Exports               │ Traceability                          │
│ · GitHub Issues       │ TASK-001 ← docs.yml, phases/*.yml     │
│ · Agent Packs         │ AGENT-001 ← engineering docs          │
│ · HTML Overview       │                                       │
├───────────────────────┴───────────────────────────────────────┤
│ [c] compile  [x] export  [h] render html  [p] agent packs      │
╰───────────────────────────────────────────────────────────────╯
```

---

## 6. Camadas da arquitetura

### 6.1 `src/tui`

Superfície interativa em terminal (Ink + React).

**Faz:**
- Navegação entre telas (overview, phase, document, interview, executive, artifacts)
- Atalhos de teclado
- Renderização textual
- Diff preview
- Console de entrevista

**Não faz:**
- Validar schema diretamente
- Montar prompts
- Chamar LLM diretamente
- Escrever arquivos diretamente
- Conhecer estrutura interna do Executive JSON

### 6.2 `src/interview`

Máquina de estados da entrevista de documentação.

**Faz:**
- Governar transições de estado (ASKING_QUESTION → WAITING_FOR_ANSWER → … → INTERVIEW_COMPLETE)
- Persistir transcrição literal antes de qualquer avaliação
- Gerenciar fila de perguntas
- Avaliar suficiência de respostas (com auxílio do LLM)
- Sintetizar CanonicalAnswerRecords
- Versionar revisões de respostas
- Registrar DocumentationDecisions

**Não faz:**
- Chamar LLM diretamente (delega para funções semânticas em `src/prompts`)
- Gerar documentação final (delega para `src/prompts/generate-document.prompt.ts`)

**Regra crítica:**

```txt
Agente (LLM) recomenda → Core valida → Core aplica transição
```

### 6.3 `src/core`

Núcleo determinístico. **Nada aqui chama LLM.**

**Faz:**
- Parsing de `logos.yml`, `docs.yml`, `phases/*.yml`
- Validação de schema (Zod)
- Grafo normativo do projeto
- Leitura estrutural de Markdown
- Diagnóstico de lacunas
- Cálculo de completude
- Regras canônicas

**Regra de ouro:**

```txt
Se uma função pode ser testada com fixture e snapshot sem rede,
ela pertence ao src/core.
```

### 6.4 `src/llm`

Camada de transporte e validação para o provider OpenAI-compatible.

**Primitivo central:**

```ts
// src/llm/generate-structured-output.ts
generateStructuredOutput<T>(config, input): Promise<T>
```

Toda chamada LLM que afete estado, decisões, respostas canônicas, documentos gerados ou Executive Plan **deve** usar `generateStructuredOutput()`. Esse primitivo usa `response_format: { type: "json_schema", … }` nativo da API para output garantido.

**Primitivo de exceção:**

```ts
// src/llm/generate-text.ts
generateText(config, input): Promise<GenerateTextOutput>
```

Usado apenas para texto não decisório (ex.: explicações para o usuário, resumos de transcrição já persistidos) ou quando o texto está encapsulado dentro de um envelope estruturado validado.

**Demais módulos:**

| Módulo | Papel |
|---|---|
| `config.ts` | `loadLlmConfig()` lê `.env` + `LOGOS_LLM_*` env vars |
| `client.ts` | `LlmClient` interface + `createLlmClient()` factory (camada de transporte/config) |
| `retry-policy.ts` | `withRetry()`, backoff exponencial com jitter |
| `response-validation.ts` | `ValidationOutcome<T>`, `validateAgainstSchema()`, nunca lança exceção |
| `generate-json.ts` | Prompt-based JSON (legado — preferir `generateStructuredOutput`) |

**Não criamos:**
- `LlmClient` abstrato pesado
- `OpenAiCompatibleClient` paralelo
- Runtime agentic genérico

### 6.5 `src/prompts`

Funções semânticas que montam mensagens e chamam `generateStructuredOutput()`.

Cada prompt builder retorna mensagens determinísticas. A chamada LLM é delegada a funções semânticas que usam o primitivo central.

**Funções semânticas:**

```txt
assessAnswer(messages, question)      → AnswerAssessment
synthesizeCanonicalAnswer(messages)    → CanonicalAnswerDraft
detectConflict(messages, history)      → ConflictRecord[]
generateDocumentDraft(answers, tmpl)   → GeneratedDocumentDraft
reviewDocument(markdown, schema)       → DocumentPatch[]
compileExecutivePlan(docs, graph)      → ExecutivePlan
```

Todas internamente chamam `generateStructuredOutput()` com schema JSON validado.

### 6.6 `src/renderers`

Transforma modelos validados em artefatos.

**Saídas:**
- Markdown (documentos, reports)
- HTML (dashboard, phase map, executive overview)
- Agent Packs (prompts de implementação e revisão)

**Regra:** Renderers não decidem conteúdo. Transformam dados validados em formato de saída.

### 6.7 `src/executive`

Compilador do Eixo Executivo.

**Entrada:** `docs.yml`, `phases/*.yml`, `docs/**/*.md`, diagnostics, decisions, risks

**Saída:** `executive-plan.json` + exports (GitHub Issues, Notion, Markdown, HTML, Agent Packs)

**Entidades:** Roadmap, Milestone, Workstream, Initiative, ExecutionItem, Decision, Risk, Artifact, ExportProfile

**Execution Item não é só task.** Pode ser: decision, question, risk, review, agent_prompt, doc_update, spike, artifact.

### 6.8 `src/fs`

Acesso seguro ao filesystem local.

**Faz:** safe path resolution, leitura YAML/Markdown/JSON/JSONL, escrita atômica, snapshots, proteção contra path traversal.

### 6.9 `src/shared`

Utilitários transversais: `Result<T, E>`, `Brand<ID>`, `LogosError`, `invariant`, `id()`, `date()`, `json()`.

### 6.10 `src/cli`

Comandos CLI (Commander). A TUI é a interface principal, mas CLI é essencial para CI, scripts, debug, automação, testes e uso por outros agentes.

---

## 7. Fluxos operacionais

### 7.1 `logos init`

```txt
User
  ↓
CLI command (init.ts) ou TUI
  ↓
Core: cria estrutura default (logos.yml, docs.yml, phases/*.yml, docs/*/)
  ↓
FS: atomic write
  ↓
TUI: mostra project overview
```

### 7.2 Interview (fluxo completo)

```txt
logos interview
  ↓
Interview state machine: SESSION_INITIALIZING → CONTEXT_LOADING
  ↓
INTERVIEW_READY: carrega fase/doc, constrói question queue
  ↓
ASKING_QUESTION: exibe pergunta atual
  ↓
WAITING_FOR_ANSWER: aguarda input do usuário
  ↓
TRANSCRIBING_MESSAGE: persiste mensagem verbatim no transcript.jsonl
  ↓
ASSESSING_ANSWER:
  ├─ Prompt builder (assess-answer.prompt.ts) monta mensagens
  ├─ generateStructuredOutput(…, AnswerAssessment schema) chama LLM
  ├─ Core recebe AnswerAssessment estruturado
  └─ Core decide transição: → ASKING_FOLLOW_UP | SYNTHESIZING | REFORMULATING | RECONCILING
  ↓
SYNTHESIZING_FINAL_ANSWER:
  ├─ Prompt builder (synthesize-canonical-answer.prompt.ts)
  ├─ generateStructuredOutput(…, CanonicalAnswerDraft schema)
  └─ Core armazena rascunho
  ↓
FINALIZING_ANSWER: exibe para confirmação (conforme política de confiança)
  ↓
RECORDING_CANONICAL_ANSWER: persiste CanonicalAnswerRecord + traceabilidade
  ↓
ADVANCING_QUEUE: atualiza fila → ASKING_QUESTION ou INTERVIEW_COMPLETE
  ↓
OFFER_GENERATION: calcula prontidão, oferece modos de geração
  ↓
GENERATING_DOCUMENTS:
  ├─ generate-document.prompt.ts monta template + canonical answers
  ├─ generateStructuredOutput(…, GeneratedDocumentDraft schema)
  ├─ Core valida rascunho contra document.schema
  └─ TUI mostra diff → usuário aceita/rejeita
```

### 7.3 `logos generate --phase foundation`

```txt
TUI ou CLI
  ↓
Core: carrega phase schema, canonical answers, templates
  ↓
Prompts: generate-document.prompt.ts monta mensagens
  ↓
LLM: generateStructuredOutput() → GeneratedDocumentDraft
  ↓
Core: valida draft contra document.schema
  ↓
TUI: mostra diff + diagnostics
  ↓
Usuário: accept/reject → FS atomic write → status recalculado
```

### 7.4 `logos compile executive`

```txt
Normative docs + diagnostics
  ↓
Core: project graph
  ↓
Prompts: compile-executive.prompt.ts
  ↓
LLM: generateStructuredOutput() → ExecutivePlan
  ↓
Executive: valida executive-plan.schema, deriva milestones/initiatives
  ↓
executive-plan.json
  ↓
Adapters: geram exports (GitHub Issues, Agent Packs, HTML, Markdown)
```

---

## 8. Comandos CLI/TUI

```bash
logos init                          # inicializa projeto LOGOS
logos status                        # status do projeto
logos validate                      # valida schemas + docs
logos interview                     # inicia/retoma entrevista
logos generate --phase foundation   # gera docs de uma fase
logos generate --doc 01-thesis      # gera documento específico
logos review --doc 01-thesis        # revisa documento
logos compile executive             # compila Executive Plan
logos render html                   # renderiza HTML outcomes
logos export github                 # exporta GitHub Issues
logos export agent-packs            # exporta Agent Packs
```

---

## 9. Modelo de estado da TUI

```ts
type TuiState = {
  projectRoot: string;
  currentScreen:
    | "overview"
    | "phase"
    | "document"
    | "interview"
    | "executive"
    | "artifacts"
    | "settings";

  selectedPhaseId?: string;
  selectedDocumentId?: string;

  projectStatus?: ProjectStatus;
  diagnostics: Diagnostic[];

  interview: {
    state: InterviewStateName;
    currentQuestion?: InterviewQuestion;
    currentAnswerDraft?: CanonicalAnswerRecord;
    progress: { answered: number; total: number };
  };

  executive: {
    plan?: ExecutivePlan;
    exports: ExportSummary[];
  };

  artifacts: ArtifactSummary[];
};
```

---

## 10. Eventos normalizados da entrevista

A máquina de estados emite eventos normalizados que a TUI consome:

```ts
type InterviewEvent =
  | { type: "interview.started"; phaseId: string; documentId: string }
  | { type: "question.asked"; question: InterviewQuestion; index: number; total: number }
  | { type: "answer.received"; messageId: string }
  | { type: "assessment.completed"; assessment: AnswerAssessment }
  | { type: "follow_up.asked"; question: string }
  | { type: "canonical.draft_ready"; draft: CanonicalAnswerRecord }
  | { type: "canonical.confirmed"; answerId: string }
  | { type: "queue.advanced"; completed: number; remaining: number }
  | { type: "interview.completed"; summary: InterviewSummary }
  | { type: "generation.ready"; readiness: GenerationReadiness }
  | { type: "draft.generated"; draft: GeneratedDocumentDraft }
  | { type: "draft.accepted"; documentId: string }
  | { type: "draft.rejected"; documentId: string; reason?: string };
```

---

## 11. Persistência e rastreabilidade

### 11.1 Cadeia de custódia semântica

```txt
Transcrição literal (transcript.jsonl)
  ↓
CanonicalAnswerRecord (canonical-answers.json)
  ↓
GeneratedDocumentDraft (generated-drafts/*.md + *.trace.json)
  ↓
Documento canônico validado (docs/**/*.md)
```

### 11.2 Regras de integridade

| # | Regra |
|---|---|
| 1 | Toda mensagem do usuário deve ser persistida **verbatim antes** de qualquer avaliação semântica |
| 2 | Transcript é **append-only** — entradas nunca são editadas ou excluídas |
| 3 | Respostas canônicas são **versionadas** — revisões criam novos registros |
| 4 | Documentos derivam de **CanonicalAnswerRecords**, não de chat bruto |
| 5 | Toda decisão de documentação deve ser **rastreável** a IDs de transcrição |
| 6 | Decisões críticas exigem **confirmação explícita** do usuário |
| 7 | Inferência do agente deve ser **rotulada** como `agent_inference` |
| 8 | Lacunas não resolvidas devem **sobreviver** nos diagnósticos, readiness, trace e review |

### 11.3 Layout de persistência

```txt
.logos/
  interviews/
    interview_2026-05-25_143000/
      state.json                    # InterviewRunState
      transcript.jsonl              # append-only, verbatim
      transcript.md                 # export legível
      canonical-answers.json        # CanonicalAnswerRecord[]
      answer-revisions.json         # histórico de revisões
      conflicts.json                # ConflictRecord[]
      decisions.json                # DocumentationDecision[]
      generation-readiness.json
      generated-drafts/
        01-thesis.draft-001.md
        01-thesis.draft-001.trace.json
```

---

## 12. Políticas de escrita

### Escrita proibida

O sistema **nunca** deve permitir:
- Escrita arbitrária fora do projeto
- Edição de transcrição
- Sobrescrita de resposta canônica sem versionamento
- Geração de documento sem rastreabilidade

### Escrita via contrato

Toda escrita segue:
- Path dentro do projeto (validado por `safePath`)
- Schema validation antes e depois
- Atomic write
- Backup/snapshot automático
- Diff preview quando aplicável
- Confirmação do usuário para decisões críticas

---

## 13. Estratégia de testes

### Unit tests

```txt
src/core        → schemas, validators, completeness, graph
src/executive   → compiler, adapters
src/renderers   → markdown, html, agent packs
src/fs          → safe path, atomic write
src/shared      → Result, Brand, LogosError
```

### Integration tests

```txt
src/interview   → state machine transitions (mock LLM)
src/prompts     → prompt builders (snapshot de mensagens)
src/llm         → retry, validation, config loading
```

### Testes com mock de LLM

```txt
Mock generateStructuredOutput retorna fixtures conhecidos
Assert validators catch invalid output
Assert state machine transitions are deterministic
Assert traceability chains are complete
```

### TUI snapshot tests

```txt
OverviewScreen renderiza project status
PhaseScreen renderiza missing docs
InterviewScreen renderiza pergunta ativa
ExecutiveScreen renderiza execution graph
```

---

## 14. MVP em etapas

### Etapa 1 — Core deterministico

```txt
src/core funcional:
  - schemas (docs, phase, document, executive) em Zod
  - loadProject, validateSchema, calculateStatus
  - parseMarkdown, extractSections

src/fs funcional:
  - safePath, atomicWrite, readYaml

CLI: logos init, logos status, logos validate
```

**Critério:** Projeto fixture pode ser carregado, validado e diagnosticado.

### Etapa 2 — LLM transport + structured output

```txt
src/llm funcional:
  - config.ts (loadLlmConfig, .env)
  - generate-text.ts (raw text — exceção)
  - generate-structured-output.ts (★ primitivo central)
  - retry-policy.ts (withRetry, backoff)
  - response-validation.ts (ValidationOutcome)
  - client.ts (LlmClient interface + factory)

src/prompts funcional:
  - assess-answer.prompt.ts
  - synthesize-canonical-answer.prompt.ts
  - generate-document.prompt.ts
```

**Critério:** `generateStructuredOutput()` funciona com provider OpenAI-compatible real.

### Etapa 3 — Interview state machine

```txt
src/interview funcional:
  - TranscriptStore, TranscriptMessage
  - CanonicalAnswerRecord, AnswerAssessment
  - State machine (17 estados)
  - Question queue
  - Traceabilidade

CLI: logos interview
```

**Critério:** Entrevista completa: pergunta → resposta → avaliação → canonical answer → avanço.

### Etapa 4 — TUI read-only + interview

```txt
src/tui funcional:
  - OverviewScreen, PhaseScreen, DocumentScreen
  - InterviewScreen com state machine ao vivo
  - Navegação por teclado
  - DiffPreview
```

**Critério:** Navegar projeto real, conduzir entrevista completa via TUI.

### Etapa 5 — Geração de documentos + review

```txt
Geração via generate-document.prompt.ts
Review com propose_document_patch
Diff → accept/reject → atomic write
CLI: logos generate, logos review
```

**Critério:** Gerar documento canônico completo a partir de CanonicalAnswers, revisar com patch.

### Etapa 6 — Executive compiler

```txt
src/executive funcional:
  - compile-executive-plan.ts
  - Adapters (GitHub Issues, Notion, Markdown, HTML, Agent Pack)

CLI: logos compile executive, logos export
```

**Critério:** Gerar executive-plan.json + Agent Packs a partir dos docs canônicos.

### Etapa 7 — Renderers + outcomes

```txt
src/renderers funcional:
  - HTML dashboard, phase map, executive overview
  - Agent Pack implementation prompts

CLI: logos render html
```

**Critério:** HTML regenerável com fonte declarada, timestamp e sem edição manual.

---

## 15. Decisões técnicas recomendadas

| Área | Decisão |
|---|---|
| Linguagem | TypeScript (strict, NodeNext) |
| Runtime | Node ≥22 |
| Package manager | pnpm |
| Estrutura | Single package modular (`src/`) |
| CLI | Commander |
| TUI | Ink + React |
| Validação | Zod 4 (schemas + parse) |
| LLM | OpenAI-compatible (`response_format: json_schema`) |
| YAML | `yaml` |
| Testes | Vitest |
| Lint/Format | Biome |
| Persistência | Filesystem local (`.logos/`) |
| Transcript | JSONL append-only |
| Estado local | `.logos/` directory |

---

## 16. Fronteiras arquiteturais

### `src/tui` não pode
- Validar schema diretamente
- Chamar LLM diretamente
- Escrever arquivos diretamente
- Conhecer estrutura interna do Executive JSON

### `src/prompts` + `src/llm` não podem
- Decidir transições de estado
- Escrever arquivos
- Alterar estado canônico sem validação do Core
- Tratar inferência como decisão do usuário

### `src/core` não pode
- Chamar LLM
- Depender de terminal
- Acessar filesystem diretamente sem `src/fs`

### `src/renderers` não podem
- Decidir conteúdo
- Corrigir documentação
- Inferir lacunas
- Alterar estado canônico

---

## 17. Recomendação final

A arquitetura do LOGOS Engine MVP é:

```txt
TUI-first
Local-first
Git-native
Single package modular
OpenAI-compatible (generateStructuredOutput)
State-machine-driven (interview)
Transcript-verbatim (transcript.jsonl append-only)
Canonical-answer-based (documentos derivam de CanonicalAnswerRecords)
Patch-based (diffs revisáveis)
Structured-output-first (response_format: json_schema)
Executive-compiler (não task manager)
```

A estrutura essencial:

```txt
src/
  cli/         → comandos scriptáveis
  tui/         → interface de terminal (Ink)
  core/        → schemas, validators, graph, determinístico
  interview/   → state machine, transcript, canonical answers
  llm/         → transporte, structured output, retry, validation
  prompts/     → funções semânticas (assess, synthesize, detect, generate, compile)
  renderers/   → markdown, html, agent packs
  executive/   → compiler + adapters
  fs/          → safe filesystem access
  shared/      → Result, Brand, errors, utils
```

O ponto mais importante:

```txt
Não construímos uma TUI de chat.
Não construímos um agent runtime genérico.
Construímos uma TUI de documentação executável,
apoiada por LLM para tarefas semânticas,
governada por uma máquina de estados determinística,
com cadeia de custódia completa da transcrição ao documento canônico.
```

A TUI opera sobre:

```txt
fases
documentos
perguntas
avaliações
respostas canônicas
lacunas
validações
patches
artefatos
execução derivada
```

Esse formato preserva a ideia original do LOGOS: externalizar ideias, estabilizá-las em documentos canônicos, derivar execução e entregar artefatos que humanos e agentes conseguem usar — com rastreabilidade completa de cada decisão até a mensagem que a produziu.
