# LOGOS Engine MVP — Implementation Roadmap

**Status:** Rascunho 1
**Escopo:** LOGOS Engine MVP — plano de implantação faseado
**Público:** engenharia, implementação
**Propósito canônico:** Guiar a implementação do MVP em fases pequenas e acionáveis, com dependências explícitas, arquivos-alvo, testes obrigatórios e critérios de aceite por etapa.

---

## Como usar este roadmap

Cada fase é autocontida: lista o que implementar, quais arquivos criar/modificar, quais testes escrever, e como verificar que a fase está completa. As fases são sequenciais — cada uma depende das anteriores. Dentro de uma fase, tarefas podem ser paralelizadas se não compartilharem arquivos.

**Regra de ouro:** Nenhuma fase avança sem que os critérios de aceite da fase atual passem.

---

## Phase 0 — Repository Cleanup and Baseline

**Objetivo:** Garantir que o repositório compila, os stubs inúteis são removidos ou documentados, e as ferramentas de qualidade passam limpas.

### Arquivos prováveis

```
package.json                # verificar scripts
tsconfig.json               # verificar strictness
biome.json                  # verificar config
vitest.config.ts            # verificar config
.gitignore                  # verificar cobertura
.env.example                # verificar placeholders
src/core/index.ts           # remover stubs que atrapalham
src/shared/index.ts         # idem
src/executive/index.ts      # idem
src/prompts/index.ts        # idem
src/renderers/index.ts      # idem
src/fs/index.ts             # idem
```

### Implementação

1. Verificar que `pnpm install` funciona limpo
2. Verificar que `pnpm typecheck` passa (corrigir erros de sintaxe em stubs como `docs.schema.ts`)
3. Verificar que `pnpm lint:biome` passa sem erros nos arquivos já implementados
4. Renomear exports inválidos (`docs.schema` → `docsSchema`, etc.) ou envolvê-los em objetos válidos
5. Garantir que `pnpm build` produz `dist/` limpo
6. Garantir que todos os testes scaffold passam (`pnpm test`)

### Testes obrigatórios

- Nenhum novo teste — apenas garantir que os existentes passam

### Critérios de aceite

- ☐ `pnpm check` passa (lint + typecheck + test + build)
- ☐ Nenhum erro de compilação TypeScript
- ☐ Nenhum erro de lint Biome nos arquivos `src/llm/`
- ☐ `.env.example` existe com `LOGOS_LLM_BASE_URL`, `LOGOS_LLM_API_KEY`, `LOGOS_LLM_MODEL`

### Referências

- `LOGOS_PROJECT_STRUCTURE_SPEC.md` — Seção 2 (Repository Structure)
- `LOGOS_MVP_SCOPE_AND_ACCEPTANCE_SPEC.md` — AC-55, AC-56

---

## Phase 1 — Project Structure and Filesystem Safety

**Objetivo:** Implementar `src/fs/` e `src/shared/` — as fundações transversais. Nenhuma dependência de LLM ou entrevista.

### Arquivos prováveis

```
src/shared/errors/LogosError.ts
src/shared/errors/invariant.ts
src/shared/types/Brand.ts
src/shared/types/Result.ts
src/shared/utils/id.ts
src/shared/utils/date.ts
src/shared/utils/json.ts
src/shared/index.ts

src/fs/safe-path.ts
src/fs/atomic-write.ts
src/fs/read-yaml.ts
src/fs/write-jsonl.ts
src/fs/project-fs.ts
src/fs/index.ts

tests/shared/Result.test.ts
tests/shared/LogosError.test.ts
tests/fs/safe-path.test.ts
tests/fs/atomic-write.test.ts
```

### Implementação

1. **`LogosError`** — classe base com `code`, `message`, `cause?`, `context?`
2. **`invariant`** — função `invariant(condition, message)` que lança `LogosError`
3. **`Brand<T, B>`** — tipo opaco para branded types (ex.: `ProjectId`, `QuestionId`)
4. **`Result<T, E>`** — `{ ok: true; data: T }` | `{ ok: false; error: E }` com helpers `success()`, `failure()`
5. **`id()`** — geração de IDs (UUID v4 ou nanoid)
6. **`date()`** — `nowISO()` retorna string ISO 8601
7. **`json()`** — `safeStringify()`, `safeParse()` com mensagens de erro claras
8. **`safePath()`** — resolve path relativo contra projectRoot, rejeita path traversal, normaliza
9. **`atomicWrite()`** — escreve em temp file, fsync, rename; cria `.bak` se target existe
10. **`readYaml()`** — lê e faz parse de YAML com tratamento de erro
11. **`writeJsonl()`** — append uma linha JSON em arquivo; valida que é JSON válido
12. **`project-fs.ts`** — re-exporta os helpers com `ProjectFileSystem` interface

### Testes obrigatórios

- `safePath` rejeita `../`, `../../etc/passwd`, caminhos absolutos
- `safePath` normaliza caminhos redundantes
- `atomicWrite` persiste dados corretamente
- `atomicWrite` não corrompe arquivo original em caso de falha
- `Result` success/failure com tipos corretos
- `invariant` lança com mensagem clara

### Critérios de aceite

- ☐ `safePath` cobre todos os casos de path traversal
- ☐ `atomicWrite` usa temp file + fsync + rename
- ☐ `Result<T, E>` funciona com TypeScript strict
- ☐ Todos os exports em `src/shared/index.ts` e `src/fs/index.ts`

### Referências

- `LOGOS_PROJECT_STRUCTURE_SPEC.md` — Seções 10, 11
- `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` — Seção 3.2

---

## Phase 2 — Core Schemas and Validators

**Objetivo:** Implementar todos os schemas Zod 4 do `src/core/schema/` e `src/core/diagnostics/`. Esta fase é 100% determinística — zero LLM.

### Arquivos prováveis

```
src/core/schema/docs.schema.ts
src/core/schema/phase.schema.ts
src/core/schema/document.schema.ts
src/core/schema/executive.schema.ts
src/core/schema/validate-schema.ts
src/core/schema/index.ts

src/core/diagnostics/Diagnostic.ts
src/core/diagnostics/severity.ts
src/core/diagnostics/format-diagnostics.ts

src/core/project/load-project.ts
src/core/project/project-manifest.ts
src/core/project/project-status.ts
src/core/project/project-graph.ts

src/core/documents/parse-markdown.ts
src/core/documents/extract-sections.ts
src/core/documents/validate-document.ts
src/core/documents/document-completeness.ts

src/core/index.ts

tests/core/schema/docs.schema.test.ts
tests/core/schema/validate-schema.test.ts
tests/core/diagnostics/format-diagnostics.test.ts
tests/core/project/load-project.test.ts
tests/core/documents/parse-markdown.test.ts
```

### Implementação

1. **Zod schemas** para `LogosProjectManifest`, `DocsManifest`, `PhaseDescriptor`, `DocumentDescriptor` (ver `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` Seções 5.1–5.4)
2. **`Diagnostic`** — `{ id, severity, category, message, path?, section?, suggestion? }`
3. **`severity`** — enum `"error" | "warning" | "info"`
4. **`format-diagnostics`** — formata `Diagnostic[]` para exibição em CLI/TUI
5. **`validate-schema`** — `validateSchema(schema, data, context)` → `Result<T, Diagnostic[]>`
6. **`load-project`** — carrega `logos.yml`, `docs.yml`, `phases/*.yml` do filesystem, valida cada um
7. **`project-status`** — calcula `ProjectStatus` a partir dos dados carregados
8. **`parse-markdown`** — parseia Markdown em AST (frontmatter + seções)
9. **`extract-sections`** — extrai seções por heading do AST
10. **`validate-document`** — valida documento contra `document.schema`
11. **`document-completeness`** — calcula completude baseada em seções obrigatórias vs. presentes

### Testes obrigatórios

- Cada schema Zod rejeita dados inválidos com mensagens claras
- `validateSchema` retorna `Result` com `Diagnostic[]` em falha
- `loadProject` com fixture YAML válido retorna `LogosProjectManifest`
- `loadProject` com YAML inválido retorna diagnostics
- `parseMarkdown` extrai frontmatter e seções corretamente
- `validateDocument` detecta seções faltantes

### Critérios de aceite

- ☐ Todos os schemas da Seção 5 do `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` implementados
- ☐ `Diagnostic` cobre `error`, `warning`, `info`
- ☐ Testes usam fixtures YAML/Markdown, não dependem de rede
- ☐ Nenhuma chamada LLM em `src/core/`

### Referências

- `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` — Seções 5, 10
- `LOGOS_PROJECT_STRUCTURE_SPEC.md` — Seção 4

---

## Phase 3 — Interview State Machine with Mock LLM

**Objetivo:** Implementar a máquina de estados da entrevista (`src/interview/`) com LLM mockada. Validar que transições são determinísticas.

### Arquivos prováveis

```
src/interview/state-machine/interview-state.ts
src/interview/state-machine/interview-events.ts
src/interview/state-machine/transition-interview-state.ts
src/interview/state-machine/guards.ts

src/interview/questions/interview-question.ts
src/interview/questions/load-questions.ts
src/interview/questions/question-queue.ts

src/interview/transcript/TranscriptMessage.ts
src/interview/transcript/TranscriptStore.ts
src/interview/transcript/append-transcript-message.ts

src/interview/answers/AnswerAssessment.ts
src/interview/answers/CanonicalAnswerRecord.ts
src/interview/answers/assess-answer.ts          # versão mockada
src/interview/answers/synthesize-final-answer.ts # versão mockada
src/interview/answers/finalize-answer.ts
src/interview/answers/revise-answer.ts

src/interview/decisions/DocumentationDecision.ts
src/interview/decisions/record-decision.ts

src/interview/generation-readiness/get-generation-readiness.ts

src/interview/index.ts

tests/interview/state-machine/transition.test.ts
tests/interview/transcript/transcript-store.test.ts
tests/interview/answers/assess-answer.test.ts
```

### Implementação

1. **`InterviewStateName`** — enum com 19 estados (ver lifecycle spec Seção 4)
2. **`InterviewEvent`** — union type com eventos normalizados (ver TUI UX spec Seção 10)
3. **`transitionInterviewState`** — reducer puro: `(state, event) => newState`
4. **`guards`** — funções booleanas: `canAdvance()`, `canAssess()`, `canSkip()`, etc.
5. **`InterviewQuestion`** — schema Zod (ver schema spec Seção 6.2)
6. **`InterviewQueue`** — gerencia fila: `getCurrent()`, `advance()`, `skip()`, `goBack()`
7. **`TranscriptMessage`** — schema Zod (ver schema spec Seção 6.1)
8. **`TranscriptStore`** — append-only: `append(msg)`, `getByRun(runId)`, `exportMarkdown()`
9. **`AnswerAssessment`** — schema Zod (discriminated union, ver schema spec Seção 7.1)
10. **`CanonicalAnswerRecord`** — schema Zod (ver schema spec Seção 6.5)
11. **`assessAnswer` (mock)** — recebe input, retorna `AnswerAssessment` fixture baseado em heurística simples (ex.: se resposta tem >20 palavras → sufficient, senão → needs_complement)
12. **`synthesizeFinalAnswer` (mock)** — recebe mensagens, retorna `CanonicalAnswerDraft` fixture
13. **`finalizeAnswer`** — aplica política de confiança (high→auto, medium→refinement, low→hypothesis)
14. **`recordDecision`** — cria `DocumentationDecision` e apenda em `decisions.json`
15. **`getGenerationReadiness`** — calcula `GenerationReadiness` do estado atual

### Testes obrigatórios

- Máquina de estados: transição de ASKING_QUESTION → WAITING_FOR_ANSWER → TRANSCRIBING_MESSAGE → ASSESSING_ANSWER funciona
- Mock `assessAnswer` com resposta longa → retorna "sufficient"
- Mock `assessAnswer` com resposta curta → retorna "needs_complement"
- `TranscriptStore` append-only: tentativa de modificar linha lança erro
- `InterviewQueue.advance()` após última pergunta → `INTERVIEW_COMPLETE`
- `skip()` em pergunta obrigatória → `blockedQuestionIds` atualizado
- `goBack()` retorna para pergunta anterior e preserva estado

### Critérios de aceite

- ☐ 19 estados implementados com transições corretas
- ☐ Mock LLM permite testar ciclo completo sem rede
- ☐ TranscriptStore é append-only
- ☐ InterviewQueue gerencia skip, goBack, advance
- ☐ CanonicalAnswerRecord versionamento funciona (previousAnswerId)

### Referências

- `LOGOS_AGENT_LIFECYCLE_SPEC.md` — Seções 4, 5 (estados)
- `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` — Seções 6, 7, 8
- `LOGOS_TUI_UX_SPEC.md` — Seção 6 (fluxo de entrevista)

---

## Phase 4 — Transcript and Canonical Answers Persistence

**Objetivo:** Conectar a máquina de estados ao filesystem real. Persistir `transcript.jsonl`, `canonical-answers.json`, `state.json`.

### Arquivos prováveis

```
src/interview/transcript/export-transcript-markdown.ts

src/interview/trace/build-answer-trace.ts
src/interview/trace/build-document-trace.ts
src/interview/trace/verify-trace-completeness.ts

tests/interview/persistence/transcript-persistence.test.ts
tests/interview/persistence/canonical-answers-persistence.test.ts
tests/interview/persistence/state-resume.test.ts
tests/interview/trace/traceability.test.ts
```

### Implementação

1. **`exportTranscriptMarkdown`** — gera `.md` legível do `transcript.jsonl`
2. **Persistência real no `TranscriptStore`** — implementar `append()` com `writeJsonl()` atômico
3. **Persistência real de `canonical-answers.json`** — append de novos registros, versionamento
4. **Persistência de `state.json`** — sobrescrever a cada transição com `atomicWrite`
5. **`buildAnswerTrace`** — dado um `CanonicalAnswerRecord`, retorna as mensagens de origem do transcript
6. **`verifyTraceCompleteness`** — verifica que todos os `sourceMessageIds` referenciados existem

### Testes obrigatórios

- Ciclo completo: entrevista → transcript.jsonl populado → verificar conteúdo
- Retomar entrevista: salvar state.json → recarregar → máquina no estado correto
- Canonical answer versionamento: revisar resposta → novo registro com version++
- Trace: `buildAnswerTrace(ansId)` retorna mensagens corretas do transcript
- Trace: `verifyTraceCompleteness` detecta IDs órfãos

### Critérios de aceite

- ☐ `transcript.jsonl` é append-only e validado linha a linha
- ☐ `canonical-answers.json` persiste com sourceMessageIds
- ☐ Entrevista pausada pode ser retomada de `state.json`
- ☐ Rastreabilidade: toda canonical answer referencia mensagens existentes

### Referências

- `LOGOS_PROJECT_STRUCTURE_SPEC.md` — Seções 5, 8
- `LOGOS_AGENT_LIFECYCLE_SPEC.md` — Seção 3 (Data Layers)

---

## Phase 5 — Structured Output LLM Integration

**Objetivo:** Conectar `generateStructuredOutput()` real (já existente) à máquina de entrevista. Substituir mocks da Phase 3 por chamadas LLM reais.

### Arquivos prováveis

```
src/llm/config.ts              # ✅ já existe — verificar
src/llm/client.ts              # ✅ já existe — verificar
src/llm/generate-text.ts       # ✅ já existe
src/llm/generate-structured-output.ts  # ✅ JÁ EXISTE
src/llm/retry-policy.ts        # ✅ já existe
src/llm/response-validation.ts # ✅ já existe

src/prompts/assess-answer.prompt.ts
src/prompts/synthesize-canonical-answer.prompt.ts
src/prompts/detect-conflict.prompt.ts
src/prompts/resolve-conflict.prompt.ts

tests/llm/generate-structured-output.test.ts
tests/llm/config.test.ts
tests/prompts/assess-answer.test.ts
tests/prompts/synthesize-canonical-answer.test.ts
```

### Implementação

1. **Verificar `generateStructuredOutput()`** — já existe em `src/llm/generate-structured-output.ts`. Garantir que funciona com provider real.
2. **`assess-answer.prompt.ts`** — implementar `assessAnswer(config, input)` que chama `generateStructuredOutput()` com `schemaName: "answer_assessment"`
3. **`synthesize-canonical-answer.prompt.ts`** — implementar `synthesizeCanonicalAnswer(config, input)` → `CanonicalAnswerDraft`
4. **`detect-conflict.prompt.ts`** — implementar `detectConflict(config, input)` → `ConflictDetectionResult`
5. **`resolve-conflict.prompt.ts`** — implementar `resolveConflict(config, input)` → `ConflictResolutionResult`
6. **Substituir mocks** — `assessAnswer` e `synthesizeFinalAnswer` no `src/interview/` agora delegam para os prompts reais quando config está presente, mantendo mock para testes

### Testes obrigatórios

- Mock `generateStructuredOutput` → verificar que `assessAnswer` monta mensagens corretas
- Mock `generateStructuredOutput` → verificar que `synthesizeCanonicalAnswer` inclui sourceMessageIds
- Snapshot de system prompts (ver prompt contracts spec Seção 8)
- `generateStructuredOutput` real com provider: teste manual ou com flag `--e2e`

### Critérios de aceite

- ☐ 4 prompt builders implementados e testados com mock LLM
- ☐ System prompts têm snapshot tests
- ☐ `generateStructuredOutput()` é o ÚNICO primitivo usado para chamadas que afetam estado
- ☐ Validação local com `schema.parse()` ocorre após toda chamada LLM

### Referências

- `LOGOS_LLM_INTEGRATION_SPEC.md` — Seções 4, 6, 9
- `LOGOS_PROMPT_CONTRACTS_SPEC.md` — Seções 6.1–6.4
- `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` — Seções 7.1–7.3

---

## Phase 6 — Prompt Contracts Implementation

**Objetivo:** Implementar os 3 prompts restantes: geração de documento, revisão e compilação executiva.

### Arquivos prováveis

```
src/prompts/generate-document.prompt.ts
src/prompts/review-document.prompt.ts
src/prompts/compile-executive.prompt.ts
src/prompts/index.ts

tests/prompts/generate-document.test.ts
tests/prompts/review-document.test.ts
tests/prompts/compile-executive.test.ts
tests/prompts/__snapshots__/          # snapshots de system prompts
```

### Implementação

1. **`generate-document.prompt.ts`** — `generateDocumentDraft(config, input)` → `GeneratedDocumentDraft`. Usa template + canonical answers.
2. **`review-document.prompt.ts`** — `reviewDocument(config, input)` → `DocumentPatchResult`. Revisa documento existente.
3. **`compile-executive.prompt.ts`** — `compileExecutivePlanDraft(config, input)` → `ExecutivePlan`. Compila de docs canônicos.
4. **Snapshot tests** — todos os 7 system prompts com snapshots em `tests/prompts/__snapshots__/`
5. **Versão de prompt** — cada builder exporta `_PROMPT_VERSION = "0.1.0"`

### Testes obrigatórios

- Mock `generateStructuredOutput` → `generateDocumentDraft` retorna `GeneratedDocumentDraft` fixture
- Mock → `reviewDocument` retorna `DocumentPatchResult` com patches
- Mock → `compileExecutivePlanDraft` retorna `ExecutivePlan`
- Snapshots de system prompts para os 7 builders
- Verificar que `jsonSchema` tem `additionalProperties: false`
- Verificar que `schemaName` segue regex `/^[a-zA-Z0-9_-]{1,64}$/`

### Critérios de aceite

- ☐ 7 prompt builders implementados (4 da Phase 5 + 3 da Phase 6)
- ☐ Todos têm snapshot test de system prompt
- ☐ Todos exportam `_PROMPT_VERSION`
- ☐ Nenhum prompt builder acessa filesystem ou modifica estado

### Referências

- `LOGOS_PROMPT_CONTRACTS_SPEC.md` — Seções 6.5–6.7, 8
- `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` — Seções 7.4, 7.5, 9.1

---

## Phase 7 — CLI Commands

**Objetivo:** Implementar comandos CLI funcionais que orquestram as fases anteriores.

### Arquivos prováveis

```
src/cli/main.ts
src/cli/command-registry.ts
src/cli/commands/init.ts
src/cli/commands/status.ts
src/cli/commands/validate.ts
src/cli/commands/interview.ts
src/cli/commands/generate.ts
src/cli/commands/compile.ts

tests/cli/init.test.ts
tests/cli/status.test.ts
tests/cli/validate.test.ts
```

### Implementação

1. **`init`** — cria estrutura canônica (logos.yml, docs.yml, phases/, docs/, .logos/)
2. **`status`** — carrega projeto, calcula `ProjectStatus`, exibe (formato texto ou JSON)
3. **`validate`** — carrega e valida todos os schemas, reporta `Diagnostic[]`
4. **`interview`** — inicia ou retoma entrevista (usa state machine da Phase 3 + prompts da Phase 5)
5. **`generate`** — gera documento específico via `generateDocumentDraft()`, salva com atomic write
6. **`compile`** — compila `executive-plan.json` via `compileExecutivePlanDraft()`

### Testes obrigatórios

- `logos init` cria estrutura em diretório temp
- `logos status` retorna JSON válido
- `logos validate` reporta erros em fixture inválida
- Comandos funcionam com `--help`

### Critérios de aceite

- ☐ 6 comandos CLI implementados e testados
- ☐ Todos usam `src/core/` e `src/prompts/` — sem lógica duplicada
- ☐ `logos interview` funciona com mock LLM (modo `--mock` ou config de teste)

### Referências

- `LOGOS_MVP_SCOPE_AND_ACCEPTANCE_SPEC.md` — Seção 7
- `LOGOS_ENGINE_TUI_FIRST_ARCHITECTURE.md` — Seção 8

---

## Phase 8 — TUI MVP

**Objetivo:** Implementar a TUI com Ink + React. Todas as telas P0 + Command Palette.

### Arquivos prováveis

```
src/tui/main.tsx
src/tui/app/LogosTuiApp.tsx
src/tui/app/tui-store.ts
src/tui/app/keymap.ts
src/tui/app/routes.ts

src/tui/screens/OverviewScreen.tsx
src/tui/screens/PhaseScreen.tsx
src/tui/screens/DocumentScreen.tsx
src/tui/screens/InterviewScreen.tsx
src/tui/screens/ExecutiveScreen.tsx
src/tui/screens/ArtifactScreen.tsx

src/tui/components/AppFrame.tsx
src/tui/components/StatusPanel.tsx
src/tui/components/DiffPreview.tsx
src/tui/components/ValidationPanel.tsx
src/tui/components/CommandPalette.tsx

src/tui/state/tui-state.ts
src/tui/state/tui-actions.ts

tests/tui/screens/overview.test.tsx
tests/tui/screens/interview.test.tsx
tests/tui/components/diff-preview.test.tsx
```

### Implementação

1. **`tui-store`** — estado global da TUI (`TuiState` conforme spec), actions, reducer
2. **`AppFrame`** — layout base: header, conteúdo, footer com atalhos
3. **`OverviewScreen`** — tabela de fases com status, eixo executivo, próxima ação recomendada
4. **`PhaseScreen`** — lista de documentos com ícones de estado, diagnósticos
5. **`DocumentScreen`** — visualização Markdown com header (status, versão, fontes)
6. **`InterviewScreen`** — pergunta, campo de resposta, estado loading, follow-up
7. **`AnswerAssessmentPanel`** — resultado da avaliação com sinais capturados/ausentes
8. **`CanonicalAnswerModal`** — rascunho com diferenciação `[user]` `[agent]` `[infer]`
9. **`ReviewScreen`** — diff de patches com navegação e accept/reject
10. **`ExecutiveScreen`** — roadmap, milestones, execution items
11. **`ArtifactScreen`** — lista de artefatos com status (fresh/stale/not gen)
12. **`CommandPalette`** — filtro por texto, comandos disponíveis
13. **`keymap`** — todos os atalhos documentados na spec

### Testes obrigatórios

- Ink snapshot tests: cada tela renderiza sem crash com estado fixture
- Navegação: `enter` na fase → PhaseScreen, `esc` → Overview
- InterviewScreen: fluxo de pergunta → resposta → avaliação → canonical answer (mock)

### Critérios de aceite

- ☐ 9 telas P0 + Command Palette implementadas
- ☐ Navegação 100% por teclado
- ☐ Footer com atalhos em cada tela
- ☐ Estados de loading e erro implementados
- ☐ TUI NUNCA chama LLM ou escreve no filesystem diretamente

### Referências

- `LOGOS_TUI_UX_SPEC.md` — Seções 3, 4, 5
- `LOGOS_MVP_SCOPE_AND_ACCEPTANCE_SPEC.md` — Seção 8

---

## Phase 9 — Document Generation and Traceability

**Objetivo:** Implementar pipeline completo de geração de documento: prompt → LLM → validação → rascunho → trace.

### Arquivos prováveis

```
src/core/documents/document-patch.ts
src/interview/generation-readiness/get-generation-readiness.ts  # integrar com real
src/interview/trace/build-document-trace.ts

tests/integration/generate-document.test.ts
tests/integration/traceability.test.ts
```

### Implementação

1. **Pipeline de geração** — orquestrar: `generateDocumentDraft()` → `validateDocument()` → salvar rascunho em `generated-drafts/`
2. **`document-patch`** — aplicar `DocumentPatch` em Markdown preservando estrutura
3. **`buildDocumentTrace`** — dado `GeneratedDocumentDraft`, construir `GeneratedDocumentSectionTrace[]`
4. **Integração com TUI** — ReviewScreen funcional com diff de patches
5. **Atomic write canônico** — após aceitação, salvar em `docs/<phase>/<doc>.md` com `.bak`

### Testes obrigatórios

- Ciclo completo mockado: canonical answers → generate → validate → trace → save
- Trace: seções geradas referenciam `sourceCanonicalAnswerIds` corretos
- Patch: aplicar `DocumentPatch` → Markdown atualizado corretamente
- Atomic write: falha simulada → original preservado

### Critérios de aceite

- ☐ Documento gerado a partir de CanonicalAnswerRecords
- ☐ Toda seção tem `sourceCanonicalAnswerIds` e `sourceMessageIds`
- ☐ `[MISSING: ...]` placeholder em seções sem fonte (modo strict)
- ☐ Salvamento canônico é atômico com backup

### Referências

- `LOGOS_PROMPT_CONTRACTS_SPEC.md` — Seção 6.5
- `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` — Seção 7.4
- `LOGOS_PROJECT_STRUCTURE_SPEC.md` — Seção 11

---

## Phase 10 — Review/Patch Flow

**Objetivo:** Implementar fluxo completo de revisão com patches revisáveis.

### Arquivos prováveis

```
src/prompts/review-document.prompt.ts   # refinar com mais contexto
tests/integration/review-document.test.ts
```

### Implementação

1. **`reviewDocument` integrado** — prompt builder recebe `currentMarkdown` + `diagnostics` + `canonicalAnswers`
2. **TUI ReviewScreen funcional** — diff visual, navegação entre patches, accept/reject individual e em lote
3. **Aplicação de patches** — após aceitação, `document-patch.ts` aplica mudanças e salva

### Testes obrigatórios

- Mock `reviewDocument` → patches aplicados → Markdown atualizado
- ReviewScreen renderiza diff com cores/símbolos
- Accept all / reject all funcionam

### Critérios de aceite

- ☐ ReviewScreen funcional com navegação por patches
- ☐ Accept/reject individual e em lote
- ☐ Patch aplicado atualiza documento canônico

---

## Phase 11 — Executive Compiler Minimal

**Objetivo:** Implementar compilador executivo mínimo: `executive-plan.json` + Agent Pack export.

### Arquivos prováveis

```
src/executive/compiler/compile-executive-plan.ts
src/executive/compiler/derive-milestones.ts
src/executive/compiler/derive-initiatives.ts
src/executive/compiler/derive-execution-items.ts
src/executive/compiler/trace-sources.ts

src/executive/adapters/agent-pack-adapter.ts
src/executive/adapters/markdown-adapter.ts

src/executive/schema/executive-plan.schema.ts

tests/executive/compile-executive-plan.test.ts
tests/executive/agent-pack-adapter.test.ts
```

### Implementação

1. **`compileExecutivePlan`** — chama `compileExecutivePlanDraft()` (prompt) → valida com `ExecutivePlanSchema` → salva em `executive/executive-plan.json`
2. **`deriveMilestones`** — deriva milestones das fases do projeto
3. **`deriveInitiatives`** — deriva iniciativas dos documentos canônicos
4. **`deriveExecutionItems`** — deriva execution items com tipos (task, decision, risk, etc.)
5. **`agent-pack-adapter`** — exporta Agent Packs como Markdown a partir de execution items do tipo `agent_prompt`
6. **`markdown-adapter`** — exporta plano de implementação como Markdown

### Testes obrigatórios

- `compileExecutivePlan` com fixture de docs → `executive-plan.json` válido
- Agent Pack export gera Markdown com estrutura esperada

### Critérios de aceite

- ☐ `logos compile executive` gera `executive-plan.json` válido
- ☐ `logos export agent-packs` gera Agent Packs
- ☐ Execution items referenciam `sourceCanonicalAnswerIds`

### Referências

- `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md` — Seção 9
- `LOGOS_PROMPT_CONTRACTS_SPEC.md` — Seção 6.7

---

## Phase 12 — HTML and Agent Pack Derived Outputs

**Objetivo:** Implementar renderers de HTML e Agent Pack.

### Arquivos prováveis

```
src/renderers/html/html-shell.ts
src/renderers/html/render-project-dashboard.ts
src/renderers/html/render-phase-map.ts
src/renderers/html/render-executive-overview.ts

src/renderers/agent-pack/render-agent-pack-index.ts
src/renderers/agent-pack/render-implementation-prompt.ts
src/renderers/agent-pack/render-review-prompt.ts

src/renderers/markdown/render-document.ts
src/renderers/markdown/render-validation-report.ts

tests/renderers/html/dashboard.test.ts
tests/renderers/agent-pack/pack.test.ts
```

### Implementação

1. **HTML renderers** — transformam `ProjectStatus` + `ExecutivePlan` em HTML
2. **Agent Pack renderers** — transformam `ExecutionItem[]` em prompts Markdown
3. **Markdown renderers** — exportam documentos e relatórios de validação

### Testes obrigatórios

- Snapshot tests: HTML output para fixture conhecida
- Agent Pack output contém instruções esperadas

### Critérios de aceite

- ☐ `logos render html` gera HTML válido
- ☐ HTML declara fonte e timestamp
- ☐ Agent Packs são gerados como Markdown

---

## Phase 13 — Quality Gates and Release Readiness

**Objetivo:** Garantir que o MVP está pronto para uso e demonstração.

### Atividades

1. **`pnpm check`** — lint + typecheck + test + build passam limpos
2. **Test coverage** — verificar thresholds (70% core, 60% llm)
3. **End-to-end test** — fluxo completo com mock LLM: init → interview → generate → validate
4. **Manual smoke test** — rodar com LLM real e verificar loop completo
5. **README** — instruções de instalação, configuração e uso
6. **CHANGELOG** — versão 0.1.0 com features implementadas
7. **`.gitignore` audit** — `.env`, `.logos/`, `node_modules/`, `dist/` cobertos
8. **Dependency audit** — sem vulnerabilidades conhecidas (`pnpm audit`)
9. **Bundle size** — verificar que `dist/` é razoável
10. **Cross-platform smoke test** — macOS e Linux (Windows opcional)

### Critérios de aceite

- ☐ `pnpm check` passa sem erros
- ☐ Test coverage atende thresholds
- ☐ End-to-end test passa (mock LLM)
- ☐ Manual smoke test com LLM real (1 documento, 3 perguntas)
- ☐ README cobre: install, config, init, interview, generate
- ☐ CHANGELOG lista features do 0.1.0
- ☐ `package.json` version: `0.1.0`

---

## Resumo de dependências entre fases

```txt
Phase 0  ── Cleanup (sem dependências)
Phase 1  ── FS + Shared (depende de Phase 0)
Phase 2  ── Core Schemas (depende de Phase 1)
Phase 3  ── State Machine + Mock LLM (depende de Phase 2)
Phase 4  ── Persistence (depende de Phase 3)
Phase 5  ── LLM Prompts 1–4 (depende de Phase 4, usa generateStructuredOutput existente)
Phase 6  ── LLM Prompts 5–7 (depende de Phase 5)
Phase 7  ── CLI (depende de Phase 6)
Phase 8  ── TUI (depende de Phase 7)
Phase 9  ── Document Generation (depende de Phase 8)
Phase 10 ── Review/Patch (depende de Phase 9)
Phase 11 ── Executive Compiler (depende de Phase 9)
Phase 12 ── HTML/Agent Pack (depende de Phase 11)
Phase 13 ── Quality Gates (depende de todas as anteriores)
```

**Fases paralelizáveis:**

- Phase 11 e Phase 12 podem começar após Phase 9 (não dependem da TUI de review)
- Phase 8 (TUI) pode começar esqueleto após Phase 4 (usando mocks), mas precisa de Phase 6 para integração real

---

## Estimativa de esforço

| Fase | Descrição | Esforço estimado |
|---|---|---|
| Phase 0 | Cleanup | 0.5 dia |
| Phase 1 | FS + Shared | 1 dia |
| Phase 2 | Core Schemas | 2 dias |
| Phase 3 | State Machine + Mock LLM | 3 dias |
| Phase 4 | Persistence | 1.5 dias |
| Phase 5 | LLM Prompts 1–4 | 2 dias |
| Phase 6 | LLM Prompts 5–7 | 1.5 dias |
| Phase 7 | CLI | 1 dia |
| Phase 8 | TUI | 4 dias |
| Phase 9 | Document Generation | 2 dias |
| Phase 10 | Review/Patch | 1.5 dias |
| Phase 11 | Executive | 1.5 dias |
| Phase 12 | HTML/Agent Pack | 1 dia |
| Phase 13 | Quality Gates | 1 dia |

**Total estimado:** ~23 dias de engineering para MVP completo.
