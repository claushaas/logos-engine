# LOGOS Engine — Arquitetura TUI-first + Pi SDK

## 1. Decisão central

O LOGOS Engine deve nascer como uma ferramenta **local-first, Git-native, TUI-first**, usando o Pi como runtime agentic por trás.

```txt
LOGOS TUI
  ↓
LOGOS Application Layer
  ↓
LOGOS Core + LOGOS Agent Runtime
  ↓
Pi SDK
  ↓
LLM + tools + skills + session runtime
```

A UI inicial não deve ser uma extensão do Pi. Deve ser uma **TUI própria**, porque o produto precisa operar sobre documentos, fases, validações, artefatos e execução derivada.

O Pi entra como motor. O LOGOS entra como sistema.

---

## 2. Visão macro

```txt
┌────────────────────────────────────────────────────────────┐
│                        apps/tui                            │
│  LOGOS TUI: navegação, comandos, status, revisão, diffs     │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│                    packages/logos-app                      │
│  Casos de uso: init, status, generate, review, validate     │
└───────────────┬──────────────────────────┬─────────────────┘
                │                          │
┌───────────────▼──────────────┐ ┌─────────▼─────────────────┐
│      packages/logos-core     │ │ packages/logos-agent       │
│  schemas, loaders, graph,    │ │ Pi SDK integration,        │
│  validators, compilers       │ │ sessions, prompts, tools   │
└───────────────┬──────────────┘ └─────────┬─────────────────┘
                │                          │
┌───────────────▼──────────────┐ ┌─────────▼─────────────────┐
│ packages/logos-renderers     │ │ packages/logos-tools       │
│ markdown, html, agent packs  │ │ tool contracts exposed     │
└───────────────┬──────────────┘ │ to Pi agent                │
                │                └───────────────────────────┘
┌───────────────▼──────────────┐
│ packages/logos-executive     │
│ Executive JSON + adapters    │
└──────────────────────────────┘
```

Essa arquitetura preserva a regra estrutural do LOGOS:

```txt
YAML / Markdown = fonte canônica
JSON = modelo executivo portável
HTML = camada de entendimento
Agent Packs = execução por agentes
```

---

## 3. Estrutura de pastas do repositório LOGOS Engine

```txt
logos-engine/
├── apps/
│   └── tui/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── app/
│       │   │   ├── LogosTuiApp.tsx
│       │   │   ├── keymap.ts
│       │   │   ├── routes.ts
│       │   │   └── tui-store.ts
│       │   ├── screens/
│       │   │   ├── OverviewScreen.tsx
│       │   │   ├── PhaseScreen.tsx
│       │   │   ├── DocumentScreen.tsx
│       │   │   ├── AgentScreen.tsx
│       │   │   ├── ExecutiveScreen.tsx
│       │   │   ├── ArtifactScreen.tsx
│       │   │   └── SettingsScreen.tsx
│       │   ├── components/
│       │   │   ├── AppFrame.tsx
│       │   │   ├── PhaseNavigator.tsx
│       │   │   ├── DocumentList.tsx
│       │   │   ├── DocumentOutline.tsx
│       │   │   ├── StatusPanel.tsx
│       │   │   ├── AgentConsole.tsx
│       │   │   ├── ActivityLog.tsx
│       │   │   ├── DiffPreview.tsx
│       │   │   ├── ValidationPanel.tsx
│       │   │   ├── ArtifactList.tsx
│       │   │   └── CommandPalette.tsx
│       │   └── adapters/
│       │       ├── terminal-size.ts
│       │       ├── clipboard.ts
│       │       └── open-file.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── logos-app/
│   │   ├── src/
│   │   │   ├── use-cases/
│   │   │   │   ├── initProject.ts
│   │   │   │   ├── getProjectStatus.ts
│   │   │   │   ├── generatePhase.ts
│   │   │   │   ├── generateDocument.ts
│   │   │   │   ├── reviewDocument.ts
│   │   │   │   ├── validateProject.ts
│   │   │   │   ├── compileExecutivePlan.ts
│   │   │   │   ├── renderArtifact.ts
│   │   │   │   └── createAgentPack.ts
│   │   │   ├── services/
│   │   │   │   ├── ProjectService.ts
│   │   │   │   ├── DocumentService.ts
│   │   │   │   ├── AgentWorkflowService.ts
│   │   │   │   └── ArtifactService.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── logos-core/
│   │   ├── src/
│   │   │   ├── project/
│   │   │   │   ├── loadProject.ts
│   │   │   │   ├── projectManifest.ts
│   │   │   │   ├── projectGraph.ts
│   │   │   │   └── projectStatus.ts
│   │   │   ├── schema/
│   │   │   │   ├── docs.schema.ts
│   │   │   │   ├── phase.schema.ts
│   │   │   │   ├── document.schema.ts
│   │   │   │   ├── executive.schema.ts
│   │   │   │   └── validateSchema.ts
│   │   │   ├── documents/
│   │   │   │   ├── parseMarkdown.ts
│   │   │   │   ├── extractSections.ts
│   │   │   │   ├── validateDocument.ts
│   │   │   │   ├── documentCompleteness.ts
│   │   │   │   └── documentPatch.ts
│   │   │   ├── phases/
│   │   │   │   ├── phaseRegistry.ts
│   │   │   │   ├── phaseCompleteness.ts
│   │   │   │   └── phaseDependencies.ts
│   │   │   ├── diagnostics/
│   │   │   │   ├── Diagnostic.ts
│   │   │   │   ├── severity.ts
│   │   │   │   └── formatDiagnostics.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── logos-agent/
│   │   ├── src/
│   │   │   ├── runtime/
│   │   │   │   ├── createLogosAgentRuntime.ts
│   │   │   │   ├── LogosAgentSession.ts
│   │   │   │   ├── sessionEvents.ts
│   │   │   │   └── modelSelection.ts
│   │   │   ├── prompts/
│   │   │   │   ├── buildSystemPrompt.ts
│   │   │   │   ├── buildPhasePrompt.ts
│   │   │   │   ├── buildDocumentPrompt.ts
│   │   │   │   ├── buildReviewPrompt.ts
│   │   │   │   └── buildExecutivePrompt.ts
│   │   │   ├── skills/
│   │   │   │   ├── foundation.skill.md
│   │   │   │   ├── validation.skill.md
│   │   │   │   ├── product.skill.md
│   │   │   │   ├── engineering.skill.md
│   │   │   │   ├── go-to-market.skill.md
│   │   │   │   ├── operations.skill.md
│   │   │   │   └── executive.skill.md
│   │   │   ├── events/
│   │   │   │   ├── normalizePiEvent.ts
│   │   │   │   ├── AgentActivityEvent.ts
│   │   │   │   └── eventStore.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── logos-tools/
│   │   ├── src/
│   │   │   ├── registry.ts
│   │   │   ├── definitions/
│   │   │   │   ├── readProjectManifest.tool.ts
│   │   │   │   ├── listPhaseDocuments.tool.ts
│   │   │   │   ├── readCanonicalDocument.tool.ts
│   │   │   │   ├── proposeDocumentPatch.tool.ts
│   │   │   │   ├── writeGeneratedDocument.tool.ts
│   │   │   │   ├── validateDocument.tool.ts
│   │   │   │   ├── validatePhase.tool.ts
│   │   │   │   ├── compileExecutivePlan.tool.ts
│   │   │   │   ├── renderHtmlArtifact.tool.ts
│   │   │   │   └── createAgentPack.tool.ts
│   │   │   ├── policy/
│   │   │   │   ├── fileAccessPolicy.ts
│   │   │   │   ├── writePolicy.ts
│   │   │   │   └── confirmationPolicy.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── logos-renderers/
│   │   ├── src/
│   │   │   ├── markdown/
│   │   │   │   ├── renderDocument.ts
│   │   │   │   ├── renderValidationReport.ts
│   │   │   │   └── renderImplementationPlan.ts
│   │   │   ├── html/
│   │   │   │   ├── renderProjectDashboard.ts
│   │   │   │   ├── renderPhaseMap.ts
│   │   │   │   ├── renderExecutiveOverview.ts
│   │   │   │   └── htmlShell.ts
│   │   │   ├── agent-pack/
│   │   │   │   ├── renderImplementationPrompt.ts
│   │   │   │   ├── renderReviewPrompt.ts
│   │   │   │   └── renderAgentPackIndex.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── logos-executive/
│   │   ├── src/
│   │   │   ├── compiler/
│   │   │   │   ├── compileExecutivePlan.ts
│   │   │   │   ├── deriveMilestones.ts
│   │   │   │   ├── deriveInitiatives.ts
│   │   │   │   ├── deriveExecutionItems.ts
│   │   │   │   └── traceSources.ts
│   │   │   ├── adapters/
│   │   │   │   ├── githubIssuesAdapter.ts
│   │   │   │   ├── notionAdapter.ts
│   │   │   │   ├── markdownAdapter.ts
│   │   │   │   ├── htmlAdapter.ts
│   │   │   │   └── agentPackAdapter.ts
│   │   │   ├── mappings/
│   │   │   │   ├── github-issues.mapping.ts
│   │   │   │   ├── notion.mapping.ts
│   │   │   │   └── agent-pack.mapping.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── logos-fs/
│   │   ├── src/
│   │   │   ├── ProjectFileSystem.ts
│   │   │   ├── LocalProjectFileSystem.ts
│   │   │   ├── safePath.ts
│   │   │   ├── atomicWrite.ts
│   │   │   ├── readYaml.ts
│   │   │   ├── writeYaml.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── logos-testing/
│       ├── src/
│       │   ├── fixtures.ts
│       │   ├── mockAgentRuntime.ts
│       │   ├── mockProjectFs.ts
│       │   └── snapshotUtils.ts
│       └── package.json
│
├── templates/
│   ├── documents/
│   │   ├── foundation/
│   │   ├── validation/
│   │   ├── product/
│   │   ├── engineering/
│   │   ├── go-to-market/
│   │   └── operations/
│   ├── executive/
│   └── artifacts/
│
├── examples/
│   ├── empty-project/
│   ├── nomos-like-project/
│   └── full-cycle-project/
│
├── docs/
│   ├── architecture/
│   ├── decisions/
│   └── development/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
└── README.md
```

---

## 4. Estrutura gerada dentro de um projeto LOGOS

Quando o usuário roda:

```bash
logos init
```

O projeto alvo deve receber:

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
│   ├── mappings/
│   │   ├── github-issues.mapping.json
│   │   ├── notion.mapping.json
│   │   └── agent-pack.mapping.json
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
    ├── sessions/
    ├── cache/
    ├── runs/
    ├── logs/
    └── config.local.json
```

### Regra

O `executive-plan.json` é o modelo executivo portável. O LOGOS não deve virar um task manager. Ele deve compilar execução e exportar para ferramentas externas.

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

Essa tela responde:

```txt
Onde estou?
O que existe?
O que falta?
Qual é o próximo passo estrutural?
```

---

### 5.2 Phase Workspace

```txt
╭─ LOGOS Engine ─ Project: nomos ─ Phase: 03 Product ───────────╮
│ Purpose: define what will be built and how it is experienced. │
├───────────────────────┬───────────────────────────────────────┤
│ Documents             │ Phase Diagnostics                     │
│                       │                                       │
│ ✓ 01-product-brief    │ Completeness: 5 / 13                  │
│ ✓ 02-scope            │ Blocking gaps: 3                      │
│ ✓ 03-user-journeys    │                                       │
│ → 04-ux-model         │ Missing required documents:           │
│ · 05-info-architecture│ - 05-information-architecture.md      │
│ · 06-interaction-model│ - 06-interaction-model.md             │
│ · 07-ui-specification │ - 07-ui-specification.md              │
│ · 08-design-system    │                                       │
│ · 09-product-arch     │ Current recommendation:               │
│ · 10-functional-reqs  │ Generate IA + interaction model next. │
│ · 11-non-functional   │                                       │
│ · 12-product-stack    │                                       │
│ · 13-acceptance       │                                       │
├───────────────────────┴───────────────────────────────────────┤
│ Agent Console                                                 │
│ > generate missing interaction model using existing journeys   │
├───────────────────────────────────────────────────────────────┤
│ [enter] open  [space] select  [a] agent  [d] diff  [esc] back  │
╰───────────────────────────────────────────────────────────────╯
```

---

### 5.3 Document Review

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

Fluxo desejado:

```txt
Agent proposes patch
  ↓
LOGOS validates patch
  ↓
TUI shows diff
  ↓
User accepts/rejects
  ↓
Canonical markdown is updated atomically
```

---

### 5.4 Agent Console

```txt
╭─ Agent Console ────────────────────────────────────────────────╮
│ Context: 03-product / 04-ux-model.md                           │
│ Mode: review                                                   │
├───────────────────────────────────────────────────────────────┤
│ User                                                          │
│   Review this document and propose only minimal structural     │
│   improvements. Do not rewrite good sections.                  │
│                                                               │
│ Agent                                                         │
│   I found 3 actionable issues:                                │
│   1. Trust Model lacks state distinction.                     │
│   2. UX Anti-Patterns is missing.                             │
│   3. Feedback Model has no failure state.                     │
│                                                               │
│ Tool activity                                                 │
│   ✓ read_canonical_document                                   │
│   ✓ validate_document                                         │
│   → propose_document_patch                                    │
├───────────────────────────────────────────────────────────────┤
│ > _                                                            │
├───────────────────────────────────────────────────────────────┤
│ [tab] command palette  [ctrl+j] newline  [esc] back            │
╰───────────────────────────────────────────────────────────────╯
```

---

### 5.5 Executive Axis

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

Essa tela não deve virar task manager. Ela mostra o grafo executivo derivado e permite exportar.

---

### 5.6 Artifacts

```txt
╭─ Artifacts ───────────────────────────────────────────────────╮
│ Generated outputs                                             │
├───────────────────────────────┬──────────────┬───────────────┤
│ Path                          │ Type         │ Status        │
├───────────────────────────────┼──────────────┼───────────────┤
│ outcomes/html/project.html    │ HTML         │ fresh         │
│ executive/executive-plan.json │ JSON         │ fresh         │
│ executive/exports/agent-packs │ Agent Pack   │ stale         │
│ executive/exports/github      │ GitHub Issue │ not generated │
├───────────────────────────────┴──────────────┴───────────────┤
│ Selected: outcomes/html/project.html                          │
│ Source: docs.yml + docs/**/*.md                                │
│ Last generated: 2026-05-24 13:42                               │
│                                                               │
│ Actions: open, regenerate, inspect source, copy path           │
╰───────────────────────────────────────────────────────────────╯
```

---

## 6. Camadas da arquitetura

### 6.1 `apps/tui`

Responsável pela superfície interativa em terminal.

Ela contém:

```txt
- navegação;
- atalhos;
- renderização textual;
- estado de tela;
- seleção de documentos;
- console de agente;
- diff preview;
- status visual.
```

Ela não deve:

```txt
- validar schema diretamente;
- montar prompts;
- chamar Pi SDK diretamente;
- escrever arquivos diretamente;
- conhecer estrutura interna do Executive JSON.
```

Recomendação inicial:

```txt
MVP: Ink
Depois: avaliar @earendil-works/pi-tui se fizer sentido alinhar visualmente com o Pi
```

---

### 6.2 `packages/logos-app`

Camada de aplicação.

Ela orquestra casos de uso sem saber detalhes de terminal, filesystem real ou Pi.

Exemplo:

```ts
await generateDocument({
  projectRoot,
  phaseId: "03-product",
  documentId: "04-ux-model",
  mode: "draft",
});
```

Essa função internamente deve:

```txt
1. carregar projeto;
2. validar pré-condições;
3. montar contexto;
4. chamar logos-agent;
5. receber proposta;
6. validar resultado;
7. gravar patch ou draft;
8. retornar diagnóstico para UI.
```

---

### 6.3 `packages/logos-core`

Núcleo determinístico.

Nada aqui deve chamar LLM.

Contém:

```txt
- parsing de docs.yml;
- parsing de phases/*.yml;
- validação de schema;
- grafo normativo;
- leitura estrutural de Markdown;
- diagnóstico de lacunas;
- cálculo de completude;
- regras canônicas.
```

Regra:

```txt
Se uma função pode ser testada com fixture e snapshot sem rede, ela provavelmente pertence ao logos-core.
```

Exemplos:

```ts
loadProject(root): LogosProject
validatePhase(project, "03-product"): Diagnostic[]
extractDocumentSections(markdown): Section[]
calculateProjectStatus(project): ProjectStatus
```

---

### 6.4 `packages/logos-agent`

Integração com o Pi SDK.

Contém:

```txt
- criação de AgentSession;
- configuração de modelos;
- system prompt do LOGOS;
- skills por fase;
- prompt builders;
- assinatura de eventos;
- normalização de eventos para TUI;
- controle de abort/cancel;
- bridge entre Pi tools e LOGOS tools.
```

Fluxo:

```txt
logos-app
  ↓
logos-agent.createSession()
  ↓
Pi createAgentSession / createAgentSessionRuntime
  ↓
customTools from logos-tools
  ↓
session.prompt(...)
  ↓
event stream normalized
```

Recomendação:

```txt
Use Pi SDK customTools, ResourceLoader customizado, skills carregadas pelo LOGOS e context files controlados pelo LOGOS.
Evite depender de extensão global instalada em ~/.pi.
```

---

### 6.5 `packages/logos-tools`

Ferramentas chamadas pelo agente.

Essas tools são o contrato entre agente e sistema.

Tools mínimas do MVP:

```txt
read_project_manifest
list_phase_documents
read_canonical_document
propose_document_patch
write_generated_document
validate_document
validate_phase
compile_executive_plan
render_html_artifact
create_agent_pack
```

Regra de segurança:

```txt
O agente não deve ter write livre.
```

Ele deve escrever apenas via tools específicas:

```txt
write_generated_document
apply_document_patch
write_executive_plan
write_artifact
```

Cada uma deve ter:

```txt
- path policy;
- schema validation;
- confirmação opcional;
- atomic write;
- backup/snapshot;
- diff preview.
```

---

### 6.6 `packages/logos-renderers`

Renderiza saídas derivadas.

Saídas:

```txt
Markdown
HTML
Agent Packs
Reports
Snapshots
```

Regra:

```txt
Renderers não decidem conteúdo. Eles transformam modelos validados em artefatos.
```

Exemplos:

```txt
ExecutivePlan → executive-overview.html
ExecutiveItem → opencode-task.md
ValidationReport → validation-report.md
ProjectStatus → project-dashboard.html
```

---

### 6.7 `packages/logos-executive`

Compila execução.

Entrada:

```txt
docs.yml
phases/*.yml
docs/**/*.md
diagnostics
decisions
risks
```

Saída:

```txt
executive/executive-plan.json
executive/exports/*
```

Entidades principais:

```txt
Roadmap
Milestone
Workstream
Initiative
Execution Item
Decision
Risk
Artifact
Export Profile
```

Importante:

```txt
Execution Item não é só task.
```

Pode ser:

```txt
decision
question
risk
review
agent_prompt
doc_update
spike
artifact
```

---

### 6.8 `packages/logos-fs`

Acesso seguro ao filesystem.

Contém:

```txt
- safe path resolution;
- leitura YAML/Markdown/JSON;
- escrita atômica;
- snapshots;
- proteção contra escrita fora do projeto;
- normalização de paths;
- backups antes de patch.
```

Filesystem deve ser isolado porque é fonte comum de bugs:

```txt
path traversal
write parcial
arquivo corrompido
encoding errado
mudança fora do root
race condition
```

---

### 6.9 `.logos/`

Estado local não-canônico.

```txt
.logos/
├── sessions/
├── cache/
├── runs/
├── logs/
└── config.local.json
```

Pode conter:

```txt
- histórico de runs;
- cache de contexto;
- sessões do agente;
- logs técnicos;
- preferências locais;
- último documento aberto;
- modelo selecionado.
```

Não pode conter:

```txt
- documentos canônicos;
- executive-plan.json;
- outputs exportáveis;
- decisões normativas permanentes.
```

---

## 7. Fluxos operacionais

### 7.1 `logos init`

```txt
User
  ↓
TUI command
  ↓
logos-app.initProject
  ↓
logos-core creates default manifest structure
  ↓
logos-fs writes docs.yml / phases/*.yml
  ↓
TUI shows project overview
```

---

### 7.2 `logos generate --phase foundation`

```txt
TUI
  ↓
logos-app.generatePhase
  ↓
logos-core loads phase schema
  ↓
logos-agent builds phase prompt
  ↓
Pi AgentSession runs
  ↓
logos-tools read/write/validate docs
  ↓
logos-core validates generated docs
  ↓
TUI shows diff + diagnostics
```

---

### 7.3 Revisão de documento

```txt
Open document
  ↓
Run review
  ↓
Agent reads canonical markdown
  ↓
Agent calls validate_document
  ↓
Agent proposes patch
  ↓
TUI renders diff
  ↓
User accepts/rejects
  ↓
logos-fs atomic write
  ↓
Project status recalculated
```

---

### 7.4 Compilar Executive Axis

```txt
Normative docs
  ↓
logos-core project graph
  ↓
logos-agent derives execution structure
  ↓
logos-executive validates graph
  ↓
executive-plan.json
  ↓
adapters generate exports
```

---

## 8. Comandos CLI/TUI

Mesmo com TUI, manter comandos diretos.

```bash
logos init
logos status
logos validate
logos generate --phase foundation
logos generate --doc docs/03-product/04-ux-model.md
logos review --doc docs/03-product/04-ux-model.md
logos compile executive
logos render html
logos export github
logos export agent-packs
logos serve
```

Motivo:

```txt
TUI é ótima para uso humano.
CLI é melhor para CI, scripts, debug, automação, testes e uso por outros agentes.
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
    | "agent"
    | "executive"
    | "artifacts"
    | "settings";

  selectedPhaseId?: string;
  selectedDocumentId?: string;

  projectStatus?: ProjectStatus;
  diagnostics: Diagnostic[];

  agent: {
    isRunning: boolean;
    mode?: "generate" | "review" | "validate" | "compile";
    activity: AgentActivityEvent[];
    latestDraft?: GeneratedDraft;
    latestPatch?: DocumentPatch;
  };

  artifacts: ArtifactSummary[];
};
```

---

## 10. Eventos normalizados do agente

O Pi emite eventos próprios. O LOGOS deve normalizar para a TUI.

```ts
type AgentActivityEvent =
  | { type: "agent.started"; label: string }
  | { type: "agent.text.delta"; text: string }
  | { type: "tool.started"; toolName: string; input: unknown }
  | { type: "tool.updated"; toolName: string; summary: string }
  | { type: "tool.completed"; toolName: string; ok: boolean }
  | { type: "agent.completed"; result: AgentRunResult }
  | { type: "agent.failed"; error: string };
```

Motivo:

```txt
Não acoplar a TUI diretamente aos tipos do Pi.
```

Isso permite:

```txt
- testar com mock;
- trocar runtime no futuro;
- adicionar segundo agente;
- manter UI estável mesmo se o Pi mudar eventos internos.
```

---

## 11. Políticas de escrita

### Escrita direta proibida

O agente não deve fazer:

```txt
write arbitrary file
edit arbitrary file
bash cat > file
```

### Escrita via contrato

O agente deve fazer:

```txt
propose_document_patch
apply_document_patch
write_generated_document
write_executive_plan
write_artifact
```

Cada tool deve validar:

```txt
- path dentro do projeto;
- arquivo pertence ao espaço LOGOS;
- schema continua válido;
- diff é exibível;
- escrita é atômica;
- backup/snapshot existe;
- usuário aprovou quando necessário.
```

---

## 12. Estratégia de testes

### Unit tests

```txt
logos-core
logos-executive
logos-renderers
logos-fs
```

### Integration tests

```txt
generate document with mock agent
validate project fixture
compile executive plan from fixture
render HTML from executive JSON
create agent pack from execution item
```

### TUI snapshot tests

```txt
OverviewScreen renders project status
PhaseScreen renders missing docs
DocumentScreen renders diagnostics
ExecutiveScreen renders execution graph
```

### Agent tests

No início, usar mock.

```txt
MockAgentRuntime returns known drafts/patches
Assert validators catch invalid output
Assert write policies block unsafe paths
```

---

## 13. MVP em etapas

### Etapa 1 — Core sem agente

```txt
- pnpm workspace
- logos-core
- logos-fs
- schemas
- fixtures
- logos status
- logos validate
```

Critério de aceite:

```txt
Um projeto LOGOS fixture pode ser carregado, validado e diagnosticado.
```

---

### Etapa 2 — TUI read-only

```txt
- OverviewScreen
- PhaseScreen
- DocumentScreen
- ArtifactScreen
- navegação por teclado
```

Critério:

```txt
Abrir um projeto real e navegar docs/fases sem gerar nada.
```

---

### Etapa 3 — Agent runtime com Pi SDK

```txt
- logos-agent
- createAgentSession
- custom tools read-only
- AgentConsole
- event normalization
```

Critério:

```txt
Agente consegue ler manifesto, listar fase e revisar documento sem escrever.
```

---

### Etapa 4 — Patches revisáveis

```txt
- propose_document_patch
- DiffPreview
- accept/reject
- atomic write
- validate after write
```

Critério:

```txt
Nenhuma escrita acontece sem diff e validação.
```

---

### Etapa 5 — Geração de docs

```txt
- generateDocument
- generatePhase
- skills por fase
- templates por documento
```

Critério:

```txt
Gerar Foundation completa com schema válido.
```

---

### Etapa 6 — Executive compiler

```txt
- compileExecutivePlan
- executive schema
- execution graph
- markdown export
- agent pack export
```

Critério:

```txt
Gerar executive-plan.json + agent packs a partir dos docs.
```

---

### Etapa 7 — HTML outcomes

```txt
- project dashboard
- phase map
- executive overview
```

Critério:

```txt
HTML regenerável, com fonte declarada, timestamp e sem edição manual.
```

---

## 14. Decisões técnicas recomendadas

| Área | Recomendação |
|---|---|
| Linguagem | TypeScript |
| Package manager | pnpm workspaces |
| CLI | Commander ou Clipanion |
| TUI MVP | Ink |
| Agent runtime | Pi SDK |
| Tool schemas | typebox |
| Validação | Ajv ou TypeBox compiler |
| YAML | yaml |
| Markdown AST | remark / unified |
| Diffs | diff ou structured-patch |
| Testes | Vitest |
| Snapshots TUI | renderização textual controlada |
| HTML | templates próprios ou React SSR estático |
| Persistência inicial | filesystem local |
| Estado local | `.logos/` |

---

## 15. Fronteiras arquiteturais

### TUI não pode

```txt
- validar schema diretamente;
- montar prompts;
- chamar Pi SDK diretamente;
- escrever arquivos diretamente;
- conhecer estrutura interna do Executive JSON.
```

### Agent não pode

```txt
- escrever fora de tools;
- editar HTML como fonte;
- decidir estado canônico sem validação;
- exportar direto para ferramentas externas sem adapter;
- virar task manager.
```

### Core não pode

```txt
- chamar LLM;
- depender de terminal;
- depender de Pi;
- acessar filesystem diretamente sem porta/adaptador.
```

### Renderers não podem

```txt
- decidir conteúdo;
- corrigir documentação;
- inferir lacunas;
- alterar estado canônico.
```

---

## 16. Recomendação final

A arquitetura mais forte para o LOGOS agora é:

```txt
TUI-first
Local-first
Git-native
Pi SDK-powered
Schema-validated
Patch-based
HTML-output-capable
Executive-compiler, not task-manager
```

A estrutura essencial:

```txt
apps/tui
packages/logos-app
packages/logos-core
packages/logos-agent
packages/logos-tools
packages/logos-renderers
packages/logos-executive
packages/logos-fs
```

O ponto mais importante:

```txt
Não construir uma TUI de chat.
Construir uma TUI de documentação executável.
```

A TUI deve operar sobre:

```txt
fases
documentos
lacunas
validações
patches
artefatos
execução derivada
agente contextual
```

Esse formato preserva a ideia original do LOGOS: tirar ideias da cabeça, estabilizar em documentos canônicos, derivar execução e entregar artefatos que humanos e agentes conseguem usar.
