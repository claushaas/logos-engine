# LOGOS MVP Scope and Acceptance Spec

**Status:** Rascunho 1
**Escopo:** LOGOS Engine MVP — definição de escopo, exclusões e critérios de aceitação
**Público:** produto, engenharia, stakeholders
**Propósito canônico:** Estabelecer o contrato exato do MVP: o que será entregue, o que fica fora, e quais condições bloqueiam a aceitação.

---

## 1. Propósito

Esta especificação define o escopo exato do LOGOS Engine MVP. Ela existe para:

1. Evitar scope creep — tudo que não está aqui está fora do MVP.
2. Alinhar expectativas — stakeholders sabem exatamente o que será entregue.
3. Servir como checklist de aceitação — cada item tem critérios verificáveis.
4. Permitir cortes conscientes — se algo precisar ser adiado, o impacto é visível.

O MVP não é um produto completo. É a menor unidade que **valida o loop central** do LOGOS: inicializar projeto → entrevistar → persistir transcrição → avaliar com LLM → sintetizar resposta canônica → gerar documento → salvar com rastreabilidade.

---

## 2. Tese do MVP

```txt
O LOGOS Engine MVP é um workflow determinístico de documentação apoiado por LLM,
implementado como single package TypeScript, com TUI básica e CLI funcional.

Ele valida que:
  - O loop de entrevista funciona (pergunta → transcrição → avaliação → síntese).
  - A LLM é usada como ferramenta de avaliação semântica, não como chatbot.
  - A cadeia de rastreabilidade é preservada (transcrição → canonical answer → documento).
  - O pipeline de geração produz documentos válidos a partir de respostas canônicas.
  - Schemas e validações mantêm integridade estrutural.

Tudo que não for necessário para validar esses pontos está fora do MVP.
```

### 2.1 Loop central do MVP

```txt
1. init project
     └─ logos init → cria estrutura canônica

2. start interview
     └─ logos interview → carrega fase/doc, inicia máquina de estados

3. ask question → wait for answer
     └─ InterviewScreen exibe pergunta, usuário responde

4. persist transcript verbatim
     └─ Toda mensagem escrita em transcript.jsonl (append-only)

5. assess answer via generateStructuredOutput()
     └─ assessAnswer() chama LLM → retorna AnswerAssessment estruturado

6. synthesize canonical answer
     └─ synthesizeCanonicalAnswer() chama LLM → retorna CanonicalAnswerDraft

7. user confirms → record canonical answer
     └─ CanonicalAnswerRecord persistido em canonical-answers.json

8. advance queue → repeat until interview complete

9. generate document draft
     └─ generateDocumentDraft() chama LLM → retorna GeneratedDocumentDraft

10. validate traceability
      └─ Toda seção referencia canonicalAnswerIds e sourceMessageIds

11. user accepts → save canonical document
      └─ Atomic write em docs/<phase>/<doc>.md
```

---

## 3. No Escopo (In Scope)

### 3.1 Engine e estrutura

| Item | Descrição |
|---|---|
| Single package TypeScript | `logos-engine/` com `src/` modular, sem monorepo |
| Node ≥22, pnpm | Runtime e package manager |
| `src/core/` | Schemas, loaders, validators, graph, completeness — determinístico |
| `src/llm/` | Transporte OpenAI-compatible, `generateStructuredOutput()`, retry, validação |
| `src/interview/` | Máquina de estados completa (19 estados), transcript, canonical answers |
| `src/prompts/` | 7 prompt builders com structured output |
| `src/fs/` | safePath, atomicWrite, readYaml, writeJsonl |
| `src/shared/` | Result, Brand, LogosError, invariant, utils |
| `.env` loading | `process.loadEnvFile()` + `loadLlmConfig()` |

### 3.2 Interface de usuário

| Item | Descrição |
|---|---|
| CLI com Commander | `init`, `status`, `validate`, `interview`, `generate`, `compile` |
| TUI com Ink + React | Overview, Phase, Document, Interview, Review, Executive, Artifacts, Settings |
| Command Palette | `ctrl+p` com acesso a todos os comandos |
| Navegação por teclado | 100% das ações acessíveis por teclado |
| Mockups ASCII | Visuais da spec implementados como telas reais |

### 3.3 Fluxos de entrevista

| Item | Descrição |
|---|---|
| Iniciar entrevista | `logos interview [phase] [doc]` ou via TUI |
| Retomar entrevista | Carregar `state.json` e continuar |
| Pergunta única | Uma pergunta por vez, com orientação |
| Resposta do usuário | Input single-line ou multiline (`ctrl+d`) |
| Persistência verbatim | `transcript.jsonl` append-only antes da avaliação |
| Avaliação semântica | `assessAnswer()` → `generateStructuredOutput()` |
| 5 status de avaliação | sufficient, needs_complement, insufficient, conflict, user_intent_override |
| Follow-up | Até `maxFollowUps` (default: 2) |
| Síntese canônica | `synthesizeCanonicalAnswer()` → `generateStructuredOutput()` |
| Confirmação | Modal com diferenciação `[user]` `[agent]` `[infer]` |
| Skip, pause, go back | Handlers de user override |
| Conclusão | OfferGeneration com GenerationReadiness |

### 3.4 Geração de documentos

| Item | Descrição |
|---|---|
| Geração de rascunho | `generateDocumentDraft()` → `generateStructuredOutput()` |
| Template por documento | Templates Markdown em `templates/` |
| Rastreabilidade por seção | `GeneratedDocumentSectionTrace` em `.trace.json` |
| Validação de schema | `document.schema` contra o Markdown gerado |
| Review com patches | `reviewDocument()` → diff → accept/reject |
| Salvamento canônico | Atomic write em `docs/**/*.md` após aceitação |

### 3.5 Validação e diagnósticos

| Item | Descrição |
|---|---|
| `logos validate` | Valida `logos.yml`, `docs.yml`, `phases/*.yml`, `docs/**/*.md` |
| Validação de schema | Zod 4 para todos os schemas canônicos |
| Validação pós-LLM | `schema.parse()` obrigatório após toda chamada `generateStructuredOutput()` |
| Diagnostic | Severity (error/warning/info), category, message, path, suggestion |

### 3.6 Executive (mínimo)

| Item | Descrição |
|---|---|
| `logos compile executive` | Compila `executive-plan.json` dos docs canônicos |
| `logos export agent-packs` | Exporta Agent Packs como Markdown |
| Estrutura básica | Roadmap → Milestone → Initiative → ExecutionItem |

### 3.7 Testes

| Item | Descrição |
|---|---|
| Unit tests | `src/core`, `src/llm`, `src/shared`, `src/fs` |
| Integration tests | `src/interview` (mock LLM), `src/prompts` (snapshots) |
| Mock LLM | `generateStructuredOutput` mockado para retornar fixtures |
| Coverage mínimo | 70% em `src/core`, 60% em `src/llm` |

---

## 4. Fora do Escopo (Out of Scope)

### 4.1 Arquitetura e runtime

| Item | Justificativa |
|---|---|
| Pi SDK / Pi Extension | LOGOS é standalone, não depende de runtime externo |
| Monorepo (`packages/`, `apps/`) | Single package é suficiente para o MVP |
| Browser UI / Web App | TUI-first. Web fica para depois do MVP |
| Cloud backend / API | Local-first. Sincronização remota é pós-MVP |
| Multi-usuário / colaboração | Single user local. Colaboração é pós-MVP |
| Streaming de resposta LLM | MVP usa request/response. Streaming é otimização |
| Multi-modelo / fallback automático | MVP usa um modelo configurado. Fallback é manual |

### 4.2 Funcionalidades

| Item | Justificativa |
|---|---|
| Integração real com GitHub Issues | Exporta JSON. Integração com API é pós-MVP |
| Integração real com Notion | Exporta JSON. Integração com API é pós-MVP |
| Integração real com Linear/Jira | Pós-MVP |
| HTML artifacts avançados | MVP tem dashboard HTML básico. Avançado é pós-MVP |
| Executive compiler completo | MVP compila estrutura básica. Derivação complexa é pós-MVP |
| Geração multi-documento em lote | MVP gera um documento por vez |
| Editor de Markdown embutido | MVP usa editor externo (`code --wait`) |
| Auto-approve de documentos | MVP exige aprovação explícita para salvar |
| Chat livre com agente | MVP é entrevista estruturada, não chat |
| Skills por fase | Templates cobrem o necessário. Skills são pós-MVP |

### 4.3 Qualidade e operações

| Item | Justificativa |
|---|---|
| CI/CD pipeline completo | MVP tem `pnpm check` local. CI é configurado mas mínimo |
| Telemetria / analytics | Não aplicável ao MVP local-first |
| Documentação de usuário completa | README + docs/. Documentação extensiva é pós-MVP |
| i18n completo | MVP suporta pt e en. i18n framework é pós-MVP |
| Performance benchmarks | MVP valida corretude, não performance |
| Migração de versões de schema | Schema é 0.1.0. Migração é pós-MVP |

---

## 5. Fluxos de Usuário

### 5.1 Fluxo completo: projeto novo até documento canônico

```txt
1. Usuário instala logos-engine
     npm install -g logos-engine
     ou: git clone + pnpm install + pnpm build

2. Usuário inicializa projeto
     cd my-project
     logos init
     → Estrutura criada: logos.yml, docs.yml, phases/, docs/, .logos/

3. Usuário configura LLM
     cp .env.example .env
     → Edita .env com LOGOS_LLM_API_KEY

4. Usuário inicia entrevista
     logos interview 01-foundation 01-thesis
     ou: TUI → Overview → Phase → Document → [i]

5. TUI exibe pergunta 1/5
     "Qual é a tese central deste projeto?"
     Usuário digita resposta → [enter]

6. TUI mostra "Avaliando..."
     → LLM avalia → AnswerAssessment

7. TUI mostra resultado
     Status: sufficient, confidence: high
     → [enter] synthesize

8. TUI mostra rascunho canônico
     Usuário revisa → [a] accept
     → Resposta salva em canonical-answers.json

9. Repete perguntas 2–5

10. Entrevista concluída
      → OfferGeneration: "Gerar documento?"

11. Usuário solicita geração
      → LLM gera rascunho
      → TUI mostra preview

12. Usuário revisa → [r] review
      → LLM propõe patches
      → Usuário aceita/rejeita

13. Usuário aceita documento
      → Atomic write em docs/01-foundation/01-thesis.md
      → Documento canônico salvo
```

### 5.2 Fluxo: retomar entrevista

```txt
1. Usuário pausou entrevista anteriormente
     → state.json preservado em .logos/interviews/<id>/

2. Usuário retoma
     logos interview 01-foundation 01-thesis
     ou: TUI → Document → [i]

3. TUI carrega InterviewRunState
     → "Retomando entrevista. Pergunta 3/5 pendente."
     → Exibe pergunta atual + histórico de respostas

4. Fluxo continua normalmente
```

### 5.3 Fluxo: validar projeto existente

```txt
1. Usuário edita docs manualmente ou importa projeto

2. Usuário valida
     logos validate
     ou: TUI → Overview → [v]

3. TUI/CLI reporta:
     ✓ logos.yml: valid
     ✓ docs.yml: valid
     ⚠ phases/03-product.yml: missing document 07-ui-specification
     ⚠ docs/03-product/04-ux-model.md: schema violation in section "Trust Model"
     ✓ executive/executive-plan.json: valid

4. Usuário corrige issues → valida novamente
```

---

## 6. Fluxos Técnicos

### 6.1 Fluxo de uma chamada LLM

```txt
1. Prompt builder monta mensagens
     buildAssessmentMessages({ question, userMessages, ... })
     → LlmMessage[]

2. Gera JSON Schema do schema Zod
     AnswerAssessmentJsonSchema = zodToJsonSchema(AnswerAssessmentSchema)

3. Chama generateStructuredOutput()
     generateStructuredOutput(config, {
       messages,
       jsonSchema: AnswerAssessmentJsonSchema,
       schemaName: "answer_assessment",
       strict: true,
       schema: AnswerAssessmentSchema,
       temperature: 0,
       maxTokens: 1024,
     })

4. generateStructuredOutput internamente:
     a. Monta GenerateTextInput com response_format: json_schema
     b. Chama generateText() → faz POST /v1/chat/completions
        → withRetry() aplica backoff em erros transientes
     c. JSON.parse(result.content)
     d. schema.parse(parsed) → validação local
     e. Retorna T tipado

5. Core recebe T
     a. Valida semanticamente (ex.: status "sufficient" + sinais)
     b. Aplica transição de estado
     c. Loga token usage
```

### 6.2 Fluxo de persistência de transcrição

```txt
1. Usuário envia resposta → InterviewScreen emite evento

2. State machine transita para TRANSCRIBING_MESSAGE

3. TranscriptStore.append({
     id: uuid(),
     interviewRunId,
     role: "user",
     content: rawInput,
     source: "user_input",
     createdAt: now(),
     metadata: { stateBefore, stateAfter }
   })

4. atomicWrite em transcript.jsonl (append)
     → Escreve uma linha JSON
     → Fsync
     → Confirma

5. State machine transita para ASSESSING_ANSWER
     → Só agora a LLM é chamada
```

### 6.3 Fluxo de salvamento canônico

```txt
1. Usuário aceita documento no ReviewScreen

2. Core valida:
     a. parseMarkdown(draft.markdown)
     b. extractSections(ast)
     c. validateDocument(sections, documentSchema)
     → Se inválido: rejeita, mostra diagnostics

3. Core verifica rastreabilidade:
     a. Toda seção tem sourceCanonicalAnswerIds não-vazio?
     b. sourceMessageIds são válidos (existem no transcript)?
     → Se faltando: warning, mas permite salvar (não bloqueia)

4. FS executa atomicWrite:
     a. Escreve em temp file
     b. Fsync temp file
     c. Cria .bak do arquivo atual (se existe)
     d. Rename temp → target
     → Documento salvo em docs/<phase>/<doc>.md

5. Core atualiza status:
     a. DocumentDescriptor.status = "canonical"
     b. Recalcula ProjectStatus
     c. TUI atualiza Overview/Phase/Document
```

---

## 7. Comandos Obrigatórios

### 7.1 CLI

```bash
logos init                          # Inicializa projeto LOGOS
logos status                        # Mostra status do projeto (JSON ou texto)
logos validate                      # Valida schemas e documentos
logos interview [phase] [doc]       # Inicia/retoma entrevista
logos generate --doc <id>           # Gera documento específico
logos review --doc <id>             # Revisa documento com LLM
logos compile executive             # Compila Executive Plan
logos export agent-packs            # Exporta Agent Packs
logos help                          # Ajuda
```

### 7.2 Comandos TUI (Command Palette)

```txt
init                  Initialize new LOGOS project
status                Show project status
validate              Validate all schemas and documents
interview [phase]     Start/resume interview
generate [doc]        Generate documents
review [doc]          Review document with agent
compile executive     Compile Executive Plan
render html           Render HTML outcomes
export github         Export GitHub Issues (JSON)
export agent-packs    Export Agent Packs
open [path]           Open file in external editor
help                  Show help
```

---

## 8. Telas Obrigatórias

| Tela | Prioridade | Descrição |
|---|---|---|
| `OverviewScreen` | P0 | Status do projeto, fases, eixo executivo, navegação principal |
| `PhaseScreen` | P0 | Documentos da fase, diagnósticos, progresso |
| `DocumentScreen` | P0 | Leitura de documento canônico com traceabilidade |
| `InterviewScreen` | P0 | Console de entrevista — pergunta, resposta, avaliação |
| `AnswerAssessmentPanel` | P0 | Resultado da avaliação semântica |
| `CanonicalAnswerModal` | P0 | Confirmação de resposta canônica |
| `ReviewScreen` | P0 | Diff de patches com aceitar/rejeitar |
| `ExecutiveScreen` | P1 | Visualização do Executive Plan |
| `ArtifactScreen` | P1 | Lista de artefatos derivados |
| `SettingsScreen` | P2 | Configurações locais |
| `CommandPalette` | P1 | Acesso rápido a comandos (`ctrl+p`) |

**P0** = MVP bloqueia sem isso. **P1** = MVP incompleto sem isso, mas não bloqueia. **P2** = nice to have, pode ser postergado.

---

## 9. Schemas Obrigatórios

### 9.1 Schemas implementados em Zod 4

| Schema | Arquivo | Prioridade |
|---|---|---|
| `LogosProjectManifest` | `src/core/schema/docs.schema.ts` | P0 |
| `DocsManifest` | `src/core/schema/docs.schema.ts` | P0 |
| `PhaseDescriptor` | `src/core/schema/phase.schema.ts` | P0 |
| `DocumentDescriptor` | `src/core/schema/document.schema.ts` | P0 |
| `TranscriptMessage` | `src/interview/transcript/TranscriptMessage.ts` | P0 |
| `InterviewQuestion` | `src/interview/questions/interview-question.ts` | P0 |
| `InterviewRunState` | `src/interview/state-machine/interview-state.ts` | P0 |
| `CanonicalAnswerRecord` | `src/interview/answers/CanonicalAnswerRecord.ts` | P0 |
| `AnswerAssessment` | `src/interview/answers/AnswerAssessment.ts` | P0 |
| `CanonicalAnswerDraft` | `src/interview/answers/AnswerAssessment.ts` | P0 |
| `ConflictRecord` | `src/interview/decisions/DocumentationDecision.ts` | P1 |
| `DocumentationDecision` | `src/interview/decisions/DocumentationDecision.ts` | P1 |
| `GenerationReadiness` | `src/interview/generation-readiness/` | P1 |
| `GeneratedDocumentDraft` | `src/prompts/generate-document.prompt.ts` | P0 |
| `ExecutivePlan` | `src/executive/schema/executive-plan.schema.ts` | P1 |
| `Diagnostic` | `src/core/diagnostics/Diagnostic.ts` | P0 |
| `ProjectStatus` | `src/core/project/project-status.ts` | P0 |

### 9.2 Schemas usados como structured output

| Schema | `schemaName` | Chamado por |
|---|---|---|
| `AnswerAssessment` | `"answer_assessment"` | `assessAnswer()` |
| `CanonicalAnswerDraft` | `"canonical_answer_draft"` | `synthesizeCanonicalAnswer()` |
| `ConflictDetectionResult` | `"conflict_detection"` | `detectConflict()` |
| `GeneratedDocumentDraft` | `"document_draft"` | `generateDocumentDraft()` |
| `DocumentPatchResult` | `"document_patch"` | `reviewDocument()` |
| `ExecutivePlan` | `"executive_plan"` | `compileExecutivePlan()` |

---

## 10. Testes Obrigatórios

### 10.1 Unit tests

| Módulo | Cobertura mínima | Foco |
|---|---|---|
| `src/core/schema` | 80% | Validação de schemas, parse de YAML/JSON fixture |
| `src/core/documents` | 70% | parseMarkdown, extractSections, validateDocument |
| `src/llm/config` | 80% | loadLlmConfig com env vars mockadas |
| `src/llm/retry-policy` | 90% | withRetry com funções que falham/recuperam |
| `src/llm/response-validation` | 90% | tryParseJson, validateAgainstSchema com fixtures |
| `src/shared` | 80% | Result, Brand, LogosError, invariant |
| `src/fs` | 70% | safePath, atomicWrite |

### 10.2 Integration tests

| Teste | Descrição |
|---|---|
| Estado da entrevista | State machine transita corretamente com AnswerAssessment mockado |
| Transcrição | TranscriptStore append/read ciclo completo |
| Prompt builders | Snapshots de system prompts e mensagens montadas |
| Ciclo completo mockado | init → interview → assess → synthesize → generate → validate (tudo com LLM mockada) |

### 10.3 Testes de contrato (mock LLM)

```txt
Para cada prompt builder:
  - Mock generateStructuredOutput → retorna fixture
  - Chamar com input controlado
  - Assert output processado corretamente
  - Assert schemaName e jsonSchema passados estão corretos
```

### 10.4 Testes de integridade

| Teste | Descrição |
|---|---|
| Append-only transcript | Tentativa de modificar linha existente → rejeitado |
| Path safety | Path traversal → LogosError |
| Write allowlist | Escrita fora da allowlist → rejeitada |
| Atomic write | Falha no meio da escrita → arquivo original preservado |
| Schema validation pós-LLM | Resposta malformada → ValidationOutcome com issues |

---

## 11. Definição de Pronto (Definition of Done)

### 11.1 Para cada módulo

```txt
☐ Código implementado em src/<module>/
☐ Tipos TypeScript estritos (strict: true)
☐ Testes unitários com coverage mínimo
☐ Biome lint sem erros
☐ tsc --noEmit sem erros
☐ Nenhum console.log solto (usar logging estruturado)
☐ Nenhum segredo hardcoded
```

### 11.2 Para cada prompt builder

```txt
☐ System prompt em inglês, determinístico
☐ jsonSchema com additionalProperties: false
☐ schema Zod correspondente para validação local
☐ Chama generateStructuredOutput() (nunca generateText)
☐ Teste de snapshot do system prompt
☐ Teste de contrato com mock LLM
☐ _PROMPT_VERSION exportado
```

### 11.3 Para cada tela da TUI

```txt
☐ Mockup da spec implementado
☐ Navegação por teclado (100% das ações)
☐ Estados vazio, loading, erro implementados
☐ Footer com atalhos documentados
☐ Não chama LLM diretamente
☐ Não escreve no filesystem diretamente
```

### 11.4 Para o projeto como um todo

```txt
☐ pnpm check passa (lint + typecheck + test + build)
☐ README.md explica instalação e uso básico
☐ .env.example com placeholders seguros
☐ .gitignore cobre .env, .logos/, node_modules/, dist/
☐ Nenhuma dependência de Pi SDK
☐ Nenhum monorepo (pnpm-workspace.yaml apenas raiz)
☐ Teste end-to-end: init → interview → generate → validate (mock LLM)
```

---

## 12. Não-objetivos (Non-goals)

### 12.1 O que o MVP NÃO é

```txt
❌ Um produto completo para uso em produção
❌ Um substituto para documentação escrita por humanos
❌ Um agent runtime autônomo que decide sozinho
❌ Uma plataforma SaaS ou cloud
❌ Um task manager (GitHub Projects, Linear, Jira)
❌ Um editor de Markdown colaborativo
❌ Um gerador de código ou scaffolding tool
❌ Uma extensão do Pi ou de qualquer outro agent runtime
```

### 12.2 O que o MVP NÃO valida

```txt
❌ Performance com projetos grandes (>100 documentos)
❌ Escalabilidade com múltiplos usuários
❌ Robustez de rede (funciona offline? latência alta?)
❌ Segurança contra ataques (path traversal, injeção)
❌ Acessibilidade completa (leitores de tela, alto contraste)
❌ Compatibilidade com Windows (foco inicial: macOS/Linux)
```

---

## 13. Matriz de Critérios de Aceitação

### 13.1 Inicialização de projeto

| # | Critério | Status |
|---|---|---|
| AC-01 | `logos init` cria `logos.yml`, `docs.yml`, `phases/`, `docs/`, `executive/`, `outcomes/`, `.logos/` | ☐ |
| AC-02 | `logos.yml` passa em `LogosProjectManifestSchema.parse()` | ☐ |
| AC-03 | `docs.yml` passa em `DocsManifestSchema.parse()` | ☐ |
| AC-04 | Estrutura de diretórios criada com permissões corretas | ☐ |
| AC-05 | Segunda execução de `logos init` detecta projeto existente e aborta ou pergunta | ☐ |

### 13.2 Ciclo de vida da entrevista

| # | Critério | Status |
|---|---|---|
| AC-06 | `logos interview` inicia máquina de estados: SESSION_INITIALIZING → CONTEXT_LOADING → INTERVIEW_READY → ASKING_QUESTION | ☐ |
| AC-07 | InterviewScreen exibe uma pergunta por vez, com progresso (N/M) | ☐ |
| AC-08 | Resposta do usuário é escrita em `transcript.jsonl` antes da avaliação | ☐ |
| AC-09 | `assessAnswer()` chama `generateStructuredOutput()` com `schemaName: "answer_assessment"` | ☐ |
| AC-10 | AnswerAssessment com status "sufficient" transita para SYNTHESIZING_FINAL_ANSWER | ☐ |
| AC-11 | AnswerAssessment com status "needs_complement" transita para ASKING_FOLLOW_UP | ☐ |
| AC-12 | AnswerAssessment com status "insufficient" transita para REFORMULATING_QUESTION | ☐ |
| AC-13 | AnswerAssessment com status "conflict" transita para RECONCILING_CONFLICT | ☐ |
| AC-14 | Follow-up limitado a `maxFollowUps` (default: 2) | ☐ |
| AC-15 | Skip, pause, go_back funcionam como user overrides | ☐ |
| AC-16 | Entrevista pode ser retomada de `state.json` | ☐ |

### 13.3 Persistência de transcrição

| # | Critério | Status |
|---|---|---|
| AC-17 | `transcript.jsonl` é append-only — linhas existentes nunca são modificadas | ☐ |
| AC-18 | Cada linha é um JSON válido conforme `TranscriptMessageSchema` | ☐ |
| AC-19 | `sourceMessageIds` em CanonicalAnswerRecord referenciam IDs válidos no transcript | ☐ |
| AC-20 | `transcript.md` é gerado como export legível | ☐ |

### 13.4 Síntese de resposta canônica

| # | Critério | Status |
|---|---|---|
| AC-21 | `synthesizeCanonicalAnswer()` chama `generateStructuredOutput()` com `schemaName: "canonical_answer_draft"` | ☐ |
| AC-22 | CanonicalAnswerModal diferencia `[user]`, `[agent]`, `[infer]` | ☐ |
| AC-23 | Usuário pode aceitar, editar ou regenerar a resposta | ☐ |
| AC-24 | `CanonicalAnswerRecord` é persistido em `canonical-answers.json` com `sourceMessageIds` | ☐ |
| AC-25 | Revisões criam novo registro com `previousAnswerId` e `version` incrementado | ☐ |

### 13.5 Validação de structured output

| # | Critério | Status |
|---|---|---|
| AC-26 | Toda chamada `generateStructuredOutput()` inclui `strict: true` | ☐ |
| AC-27 | Todo `jsonSchema` passado tem `additionalProperties: false` | ☐ |
| AC-28 | Toda resposta da LLM é validada com `schema.parse()` antes de uso | ☐ |
| AC-29 | Falha de validação produz `ValidationIssue[]` estruturados, não mensagem genérica | ☐ |
| AC-30 | `generateStructuredOutputSafe()` retorna `ValidationOutcome` sem lançar exceção | ☐ |

### 13.6 Geração de documento

| # | Critério | Status |
|---|---|---|
| AC-31 | `generateDocumentDraft()` chama `generateStructuredOutput()` com `schemaName: "document_draft"` | ☐ |
| AC-32 | `GeneratedDocumentDraft` contém `markdown` completo + `sections[]` com `sourceCanonicalAnswerIds` | ☐ |
| AC-33 | Seção sem source material em modo strict gera placeholder `[MISSING: ...]` | ☐ |
| AC-34 | `reviewDocument()` chama `generateStructuredOutput()` com `schemaName: "document_patch"` | ☐ |
| AC-35 | ReviewScreen mostra diff por patch com aceitar/rejeitar | ☐ |
| AC-36 | Documento aceito é salvo via atomic write em `docs/<phase>/<doc>.md` | ☐ |
| AC-37 | Backup `.bak` é criado antes de sobrescrever documento existente | ☐ |

### 13.7 Escritas no filesystem

| # | Critério | Status |
|---|---|---|
| AC-38 | `safePath()` rejeita caminhos que escapam do projeto | ☐ |
| AC-39 | Escrita fora da allowlist é rejeitada | ☐ |
| AC-40 | `atomicWrite()` usa temp file + fsync + rename | ☐ |
| AC-41 | Toda ação de escrita na TUI mostra confirmação com path e tipo de operação | ☐ |

### 13.8 Interação da TUI

| # | Critério | Status |
|---|---|---|
| AC-42 | OverviewScreen mostra fases com status, docs, diagnósticos | ☐ |
| AC-43 | PhaseScreen lista documentos com estado (✓, →, ·, !) | ☐ |
| AC-44 | InterviewScreen mostra pergunta, progresso, status, campo de resposta | ☐ |
| AC-45 | Estados de loading têm indicador visual | ☐ |
| AC-46 | Estados de erro oferecem opções de recuperação | ☐ |
| AC-47 | Navegação 100% por teclado com atalhos documentados | ☐ |
| AC-48 | Command Palette (`ctrl+p`) funciona em qualquer tela | ☐ |

### 13.9 Comandos CLI

| # | Critério | Status |
|---|---|---|
| AC-49 | `logos init` funciona | ☐ |
| AC-50 | `logos status` retorna JSON válido com ProjectStatus | ☐ |
| AC-51 | `logos validate` retorna Diagnostic[] | ☐ |
| AC-52 | `logos interview` inicia/retoma entrevista | ☐ |
| AC-53 | `logos generate --doc <id>` gera documento | ☐ |
| AC-54 | `logos compile executive` gera executive-plan.json | ☐ |

### 13.10 Testes

| # | Critério | Status |
|---|---|---|
| AC-55 | `pnpm typecheck` passa sem erros | ☐ |
| AC-56 | `pnpm lint:biome` passa sem erros | ☐ |
| AC-57 | `pnpm test` passa com coverage mínimo | ☐ |
| AC-58 | Teste end-to-end: init → interview → generate → validate (mock LLM) | ☐ |
| AC-59 | Nenhum teste depende de rede ou LLM real | ☐ |

### 13.11 Segurança e configuração

| # | Critério | Status |
|---|---|---|
| AC-60 | `.env` está no `.gitignore` | ☐ |
| AC-61 | Nenhuma API key hardcoded no código | ☐ |
| AC-62 | `LOGOS_LLM_API_KEY` nunca aparece em logs | ☐ |
| AC-63 | `.env.example` existe com placeholders seguros | ☐ |

---

## 14. Resumo

```txt
LOGOS MVP:

NO ESCOPO (in scope)
  ✅ Single package TypeScript
  ✅ CLI (init, status, validate, interview, generate, compile)
  ✅ TUI básica (9+ telas, navegação por teclado)
  ✅ Interview state machine (19 estados, transcript append-only)
  ✅ canonical-answers.json com versionamento
  ✅ generateStructuredOutput() como primitivo central
  ✅ 7 prompt builders com structured output
  ✅ Geração de 1 documento com rastreabilidade
  ✅ Review com patches e diff
  ✅ Atomic write com backup
  ✅ Schemas Zod 4 para validação
  ✅ Mock LLM para testes
  ✅ Executive compiler básico
  ✅ Agent Pack export

FORA DO ESCOPO (out of scope)
  ❌ Pi SDK / extensão Pi
  ❌ Monorepo (packages/, apps/)
  ❌ Browser UI / web app
  ❌ Cloud backend / API
  ❌ Colaboração multi-usuário
  ❌ Integração real com GitHub/Notion
  ❌ Streaming de LLM
  ❌ Multi-modelo / fallback automático
  ❌ Chat livre com agente
  ❌ Editor de Markdown embutido
  ❌ i18n completo
  ❌ CI/CD complexo

CRITÉRIOS DE ACEITAÇÃO
  63 critérios em 11 categorias
  P0 (bloqueia MVP): AC-01 a AC-41, AC-49 a AC-63
  P1 (importante mas não bloqueia): AC-42 a AC-48
```