# LOGOS Schema and Contracts Spec

**Status:** Rascunho 1
**Escopo:** LOGOS Engine MVP — schemas de dados, validação e contratos de structured output
**Público:** engenharia, implementação
**Propósito canônico:** Formalizar todos os schemas e contratos de dados essenciais para validação runtime, persistência auditável e chamadas a `generateStructuredOutput()`.

---

## 1. Propósito

Esta especificação define todos os schemas de dados do LOGOS Engine MVP. Cada schema existe para um ou mais dos três usos:

1. **Validação runtime do Core** — schemas Zod validam arquivos YAML/Markdown carregados do filesystem e objetos em memória antes de transições de estado.
2. **Persistência auditável** — schemas definem a forma exata dos arquivos em `.logos/interviews/` e `docs/`, garantindo integridade na cadeia de rastreabilidade.
3. **Structured outputs da LLM** — schemas serializados como JSON Schema são passados para `generateStructuredOutput()` em `src/llm/generate-structured-output.ts`, garantindo que o modelo retorne dados que o Core pode consumir deterministicamente.

O arquivo `src/llm/generate-structured-output.ts` **já existe** e aceita:

```ts
generateStructuredOutput<T>(config, {
  messages: LlmMessage[],
  jsonSchema: Record<string, unknown>,   // JSON Schema object
  schemaName: string,                    // nome único para o schema
  schema?: { parse(input: unknown): T }, // validator runtime opcional (Zod)
  strict?: boolean,                      // default: true
  temperature?: number,
  maxTokens?: number,
}): Promise<T>
```

Esta spec define **quais** schemas são passados para essa função em cada ponto de chamada.

---

## 2. Estratégia de Schema

### 2.1 Stack

| Camada | Ferramenta | Uso |
|---|---|---|
| Definição | Zod 4 | Fonte da verdade para tipos TypeScript + validação runtime |
| Serialização | `z.toJSONSchema()` ou manual | Geração de JSON Schema para `generateStructuredOutput()` |
| Validação local | `schema.parse()` / `schema.safeParse()` | Validação de arquivos YAML, JSON e respostas da LLM |
| Tipos TypeScript | `z.infer<typeof schema>` | Tipos exportados para uso em todo o código |

### 2.2 Regra de ouro

```txt
Toda resposta da LLM DEVE ser validada localmente com o mesmo schema
usado como jsonSchema na chamada structured output.

NUNCA confie que o provider retornou o shape correto.
SEMPRE valide com schema.parse() antes de usar o dado.
```

### 2.3 Localização dos schemas

```
src/core/schema/
├── docs.schema.ts            # DocsManifest, PhaseDescriptor, DocumentDescriptor
├── phase.schema.ts           # PhaseDescriptor (re-export)
├── document.schema.ts        # DocumentDescriptor, SectionOutline
├── executive.schema.ts       # ExecutivePlan, ExecutiveItem
├── validate-schema.ts        # validateSchema<T>(schema, data) → Result<T, Diagnostic[]>
└── index.ts                  # barrel

src/interview/
├── transcript/TranscriptMessage.ts    # TranscriptMessage schema
├── questions/interview-question.ts    # InterviewQuestion schema
├── answers/AnswerAssessment.ts        # AnswerAssessment schema
├── answers/CanonicalAnswerRecord.ts   # CanonicalAnswerRecord schema
├── decisions/DocumentationDecision.ts # DocumentationDecision schema
└── generation-readiness/get-generation-readiness.ts  # GenerationReadiness schema

src/core/diagnostics/Diagnostic.ts     # Diagnostic schema
src/core/project/project-status.ts     # ProjectStatus schema
```

---

## 3. Regras de Validação Runtime

### 3.1 O que é validado e quando

| Momento | Schema | Ação em falha |
|---|---|---|
| `logos init` | `LogosProjectManifest`, `DocsManifest`, `PhaseDescriptor` | Abortar com diagnóstico |
| `logos validate` | Todos os schemas canônicos | Reportar `Diagnostic[]` |
| Carregamento de projeto | `LogosProjectManifest`, `DocsManifest`, `PhaseDescriptor` | `Result.err(Diagnostic[])` |
| Antes de transição de estado | `InterviewRunState` | `invariant` — estado corrompido é bug |
| Após `generateStructuredOutput()` | Schema usado na chamada | `Result.err(ValidationIssue[])` |
| Antes de persistir canonical answer | `CanonicalAnswerRecord` | Rejeitar — não persistir |
| Antes de aceitar documento gerado | `GeneratedDocumentDraft` | Mostrar diff + diagnostics |
| Antes de compilar executive | `ExecutivePlan` | Reportar `Diagnostic[]` |

### 3.2 Contrato `validateSchema`

```ts
// src/core/schema/validate-schema.ts
import type { Diagnostic } from "../diagnostics/Diagnostic.js";

function validateSchema<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown } },
  data: unknown,
  context: { filePath: string; schemaName: string },
): { ok: true; data: T } | { ok: false; diagnostics: Diagnostic[] }
```

---

## 4. Regras de Schema para Structured Output

Schemas passados para `generateStructuredOutput()` devem seguir regras mais restritivas que schemas de persistência.

### 4.1 Regras obrigatórias

1. **`additionalProperties: false`** — O modelo não deve inventar campos.
2. **Sem `oneOf`/`anyOf`/`allOf` ambíguos** — Prefira discriminated unions com campo `status` ou `type` literal.
3. **Campos ausentes vs. `null`** — Para campos opcionais em structured output, use `type: ["string", "null"]` em vez de omitir o campo. Isso evita ambiguidade entre "campo ausente" e "campo null".
4. **Enums como strings literais** — Use `enum: ["value1", "value2"]`, não `string` genérico.
5. **Nomes explícitos** — Todo schema passado para a LLM deve ter `schemaName` significativo (ex.: `"answer_assessment"`, `"canonical_answer_draft"`).
6. **`strict: true`** — Sempre use `strict: true` para que o provider rejeite outputs fora do schema.

### 4.2 Schemas que vão para a LLM

| Schema | `schemaName` | Chamado por |
|---|---|---|
| `AnswerAssessment` | `"answer_assessment"` | `assessAnswer()` |
| `CanonicalAnswerDraft` | `"canonical_answer_draft"` | `synthesizeCanonicalAnswer()` |
| `ConflictDetectionResult` | `"conflict_detection"` | `detectConflict()` |
| `GeneratedDocumentDraft` | `"document_draft"` | `generateDocumentDraft()` |
| `DocumentPatchResult` | `"document_patch"` | `reviewDocument()` |
| `ExecutivePlan` | `"executive_plan"` | `compileExecutivePlan()` |

### 4.3 Schemas que NÃO vão para a LLM

Schemas de infraestrutura/persistência que o Core gerencia sem LLM:

- `LogosProjectManifest` — YAML definido pelo usuário
- `DocsManifest` — YAML definido pelo template
- `PhaseDescriptor` — YAML definido pelo template
- `TranscriptMessage` — gerado pelo engine, não pela LLM
- `InterviewRunState` — estado interno da máquina
- `DocumentationDecision` — registrado pelo Core
- `Diagnostic` — gerado pelo Core
- `ProjectStatus` — calculado pelo Core

---

## 5. Schemas de Persistência

### 5.1 `LogosProjectManifest`

```
Propósito:     Identidade e metadados do projeto LOGOS.
Arquivo:       logos.yml (YAML)
Validado em:   logos init, logos validate, carregamento de projeto
Structured output: ❌ Não
```

**Campos:**

```ts
type LogosProjectManifest = {
  version: "0.1.0";                        // versão do schema
  project: {
    name: string;                           // nome do projeto (1–64 chars, slug-friendly)
    description?: string;                   // descrição curta (≤ 280 chars)
    language: "pt" | "en" | "es";          // idioma principal
  };
  phases: string[];                         // referências a phases/*.yml (ex.: ["01-foundation"])
  settings?: {
    strictGeneration: boolean;              // default: true — bloquear geração com lacunas
    requireApprovalFor: ("scope_change" | "conflict_resolution" | "generation")[];
                                             // default: ["scope_change", "conflict_resolution"]
    maxFollowUps: number;                   // default: 2
  };
};
```

**Exemplo JSON mínimo:**

```json
{
  "version": "0.1.0",
  "project": {
    "name": "my-project",
    "language": "pt"
  },
  "phases": ["01-foundation"]
}
```

### 5.2 `DocsManifest`

```
Propósito:     Registro de documentos e sua organização em fases.
Arquivo:       docs.yml (YAML)
Validado em:   logos init, logos validate, carregamento de projeto
Structured output: ❌ Não
```

**Campos:**

```ts
type DocsManifest = {
  version: "0.1.0";
  phases: PhaseDocsEntry[];
};

type PhaseDocsEntry = {
  phaseId: string;                          // ex.: "01-foundation"
  phaseName: string;                        // ex.: "Foundation"
  description?: string;
  documents: DocumentDocsEntry[];
};

type DocumentDocsEntry = {
  documentId: string;                       // ex.: "01-thesis"
  title: string;                            // ex.: "Thesis"
  path: string;                             // ex.: "docs/01-foundation/01-thesis.md"
  required: boolean;                        // obrigatório para completude da fase?
  order: number;                            // ordem dentro da fase
  template?: string;                        // caminho para template, se houver
};
```

**Exemplo JSON mínimo:**

```json
{
  "version": "0.1.0",
  "phases": [
    {
      "phaseId": "01-foundation",
      "phaseName": "Foundation",
      "documents": [
        {
          "documentId": "01-thesis",
          "title": "Thesis",
          "path": "docs/01-foundation/01-thesis.md",
          "required": true,
          "order": 1
        }
      ]
    }
  ]
}
```

### 5.3 `PhaseDescriptor`

```
Propósito:     Metadados e configuração de uma fase.
Arquivo:       phases/<phaseId>.yml (YAML)
Validado em:   logos validate, carregamento de projeto
Structured output: ❌ Não
```

**Campos:**

```ts
type PhaseDescriptor = {
  version: "0.1.0";
  phase: {
    id: string;                             // ex.: "01-foundation"
    name: string;                           // ex.: "Foundation"
    purpose: string;                        // descrição do propósito da fase
    order: number;                          // ordem entre fases
    dependsOn?: string[];                   // phaseIds das quais esta fase depende
  };
  documents: string[];                      // documentIds nesta fase
  templates?: {
    document?: string;                      // template padrão para documentos desta fase
    review?: string;                        // template de revisão
  };
};
```

**Exemplo JSON mínimo:**

```json
{
  "version": "0.1.0",
  "phase": {
    "id": "01-foundation",
    "name": "Foundation",
    "purpose": "Define the core thesis, problem, and audience.",
    "order": 1
  },
  "documents": ["01-thesis", "02-problem", "03-audience"]
}
```

### 5.4 `DocumentDescriptor`

```
Propósito:     Metadados de um documento canônico individual.
Arquivo:       Embutido no Markdown (frontmatter YAML) ou derivado do docs.yml
Validado em:   parseMarkdown, validateDocument
Structured output: ❌ Não
```

**Campos (frontmatter):**

```yaml
---
documentId: "01-thesis"
phaseId: "01-foundation"
title: "Thesis"
status: "draft" | "review" | "canonical"
version: 1
lastGeneratedFrom: "interview_2026-05-25_143000"
updatedAt: "2026-05-25T14:30:00Z"
---
```

---

## 6. Schemas de Entrevista

### 6.1 `TranscriptMessage`

```
Propósito:     Uma entrada individual no log de transcrição literal.
Arquivo:       .logos/interviews/<id>/transcript.jsonl (uma linha JSON por mensagem)
Persistência:  Append-only
Structured output: ❌ Não (gerado pelo engine, não pela LLM)
```

**Campos:**

```ts
type TranscriptMessage = {
  id: string;                               // UUID
  interviewRunId: string;                   // referência à execução da entrevista
  projectId: string;
  phaseId?: string;
  documentId?: string;
  questionId?: string;                      // pergunta ativa quando a mensagem foi recebida

  role: "user" | "agent" | "system";

  content: string;                          // conteúdo literal da mensagem

  source:
    | "user_input"                          // entrada direta do usuário
    | "agent_question"                      // pergunta feita pelo agente
    | "agent_follow_up"                     // pergunta de acompanhamento
    | "agent_assessment"                    // explicação da avaliação
    | "agent_summary"                       // resumo após conclusão
    | "agent_generation_offer"              // oferta de geração
    | "system_event";                       // evento interno do sistema

  createdAt: string;                        // ISO 8601

  metadata?: {
    stateBefore?: string;                   // estado da máquina antes da mensagem
    stateAfter?: string;                    // estado da máquina depois da mensagem
    tokenUsage?: {
      input?: number;
      output?: number;
      total?: number;
    };
  };
};
```

**Exemplo JSON mínimo:**

```json
{
  "id": "msg_001",
  "interviewRunId": "interview_2026-05-25_143000",
  "projectId": "proj_001",
  "phaseId": "01-foundation",
  "documentId": "01-thesis",
  "questionId": "q_001",
  "role": "user",
  "content": "Quero criar um sistema que ajude pessoas a documentar ideias.",
  "source": "user_input",
  "createdAt": "2026-05-25T14:30:00Z",
  "metadata": {
    "stateBefore": "WAITING_FOR_ANSWER",
    "stateAfter": "TRANSCRIBING_MESSAGE"
  }
}
```

### 6.2 `InterviewQuestion`

```
Propósito:     Uma pergunta de documentação no contexto de uma fase e documento.
Arquivo:       Definido em templates ou derivado de docs.yml + phase.yml
Persistência:  Em memória (parte do InterviewQueue)
Structured output: ❌ Não (entrada para a LLM, não saída)
```

**Campos:**

```ts
type InterviewQuestion = {
  id: string;                               // UUID
  phaseId: string;
  documentId: string;
  sectionId?: string;                       // seção alvo no documento

  order: number;                            // ordem dentro do documento
  title: string;                            // título curto (ex.: "Problema")
  question: string;                         // texto completo da pergunta
  helpText?: string;                        // orientação adicional

  required: boolean;                        // resposta obrigatória para completude?

  sufficiencyCriteria: {
    requiredSignals: string[];              // sinais semânticos obrigatórios
    optionalSignals?: string[];             // sinais desejáveis mas não obrigatórios
    insufficientPatterns?: string[];        // padrões de resposta insuficiente
  };

  followUpPolicy: {
    maxFollowUps: number;                   // default: 2
    allowSkip: boolean;                     // default: true
    allowHypothesis: boolean;               // default: true
  };

  generationMapping: {
    targetSections: string[];               // seções do documento que esta resposta alimenta
    extractionHints: string[];              // dicas para extração durante geração
  };
};
```

**Exemplo JSON mínimo:**

```json
{
  "id": "q_001",
  "phaseId": "01-foundation",
  "documentId": "01-thesis",
  "order": 1,
  "title": "Tese Central",
  "question": "Qual é a tese central deste projeto? O que ele propõe realizar?",
  "required": true,
  "sufficiencyCriteria": {
    "requiredSignals": ["project_purpose", "target_outcome", "core_conviction"]
  },
  "followUpPolicy": {
    "maxFollowUps": 2,
    "allowSkip": false,
    "allowHypothesis": true
  },
  "generationMapping": {
    "targetSections": ["## Thesis"],
    "extractionHints": ["main_argument", "supporting_premises"]
  }
}
```

### 6.3 `InterviewQueue`

```
Propósito:     Estado atual da fila de perguntas da entrevista.
Persistência:  Em memória + parte de state.json
Structured output: ❌ Não
```

**Campos:**

```ts
type InterviewQueue = {
  scope: "document" | "phase" | "project";
  phaseId: string;
  documentId?: string;
  questions: InterviewQuestion[];
  currentIndex: number;
  completedQuestionIds: string[];
  skippedQuestionIds: string[];
  blockedQuestionIds: string[];             // perguntas cujas dependências não foram respondidas
};
```

### 6.4 `InterviewRunState`

```
Propósito:     Estado completo de uma execução de entrevista para retomada.
Arquivo:       .logos/interviews/<id>/state.json
Persistência:  Sobrescrever a cada transição
Structured output: ❌ Não
```

**Campos:**

```ts
type InterviewRunState = {
  id: string;                               // interview_YYYY-MM-DD_HHMMSS
  projectId: string;
  phaseId: string;
  documentId: string;

  status:
    | "active"
    | "paused"
    | "completed"
    | "generated"
    | "cancelled";

  machineState: InterviewStateName;         // estado atual da máquina (ex.: "ASKING_QUESTION")

  currentQuestionId: string | null;
  questionStates: Record<string, QuestionState>;

  queue: InterviewQueue;

  createdAt: string;                        // ISO 8601
  updatedAt: string;                        // ISO 8601
};

type InterviewStateName =
  | "SESSION_INITIALIZING"
  | "CONTEXT_LOADING"
  | "INTERVIEW_READY"
  | "ASKING_QUESTION"
  | "WAITING_FOR_ANSWER"
  | "TRANSCRIBING_MESSAGE"
  | "ASSESSING_ANSWER"
  | "ASKING_FOLLOW_UP"
  | "REFORMULATING_QUESTION"
  | "RECONCILING_CONFLICT"
  | "SYNTHESIZING_FINAL_ANSWER"
  | "FINALIZING_ANSWER"
  | "RECORDING_CANONICAL_ANSWER"
  | "ADVANCING_QUEUE"
  | "INTERVIEW_COMPLETE"
  | "OFFER_GENERATION"
  | "GENERATING_DOCUMENTS"
  | "WAITING_USER_DECISION"
  | "GENERATION_COMPLETE";

type QuestionState = {
  questionId: string;
  status: "pending" | "asked" | "answered" | "skipped" | "blocked";
  skippedReason?: "unknown" | "deferred" | "not_applicable" | "user_choice";
  canonicalAnswerId?: string;
  askedAt?: string;
  answeredAt?: string;
};
```

### 6.5 `CanonicalAnswerRecord`

```
Propósito:     Resposta final, consolidada e versionada para uma pergunta de documentação.
Arquivo:       .logos/interviews/<id>/canonical-answers.json (array JSON)
Persistência:  Append — revisões criam novos registros com version incrementado
Structured output: ❌ Não (mas o rascunho → CanonicalAnswerDraft é gerado pela LLM)
```

**Campos:**

```ts
type CanonicalAnswerRecord = {
  id: string;                               // UUID
  interviewRunId: string;
  projectId: string;
  phaseId: string;
  documentId: string;
  questionId: string;

  questionText: string;                     // texto da pergunta no momento da resposta

  finalAnswer: string;                      // resposta final sintetizada

  answerStatus:
    | "final"                               // aceita como canônica
    | "provisional"                         // aceita provisoriamente
    | "hypothesis"                          // registrada como hipótese
    | "skipped"                             // explicitamente pulada
    | "not_applicable"                      // não se aplica ao projeto
    | "conflicted";                         // conflito não resolvido

  confidence: "low" | "medium" | "high";

  sourceMessageIds: string[];               // IDs em transcript.jsonl

  derivation: {
    userMessageIds: string[];
    agentMessageIds: string[];
    complementMessageIds: string[];
    conflictResolutionMessageIds: string[];
  };

  extracted: {
    facts: string[];
    decisions: string[];
    assumptions: string[];
    hypotheses: string[];
    constraints: string[];
    openQuestions: string[];
  };

  missingSignals: string[];

  agentRefinement: {
    applied: boolean;
    description: string;
    rationale: string;
  };

  userApproval: {
    status: "explicit" | "implicit" | "not_requested";
    messageId?: string;
    approvedAt?: string;
  };

  revision: {
    version: number;
    previousAnswerId?: string;
    revisionReason?: string;
    revisedAt?: string;
  };

  createdAt: string;
  updatedAt: string;
};
```

**Exemplo JSON mínimo:**

```json
{
  "id": "ans_001",
  "interviewRunId": "interview_2026-05-25_143000",
  "projectId": "proj_001",
  "phaseId": "01-foundation",
  "documentId": "01-thesis",
  "questionId": "q_001",
  "questionText": "Qual é a tese central deste projeto?",
  "finalAnswer": "O projeto existe para ajudar pessoas a transformar ideias difusas em documentação clara, estruturada e acionável.",
  "answerStatus": "final",
  "confidence": "high",
  "sourceMessageIds": ["msg_001", "msg_003"],
  "derivation": {
    "userMessageIds": ["msg_001"],
    "agentMessageIds": ["msg_002"],
    "complementMessageIds": [],
    "conflictResolutionMessageIds": []
  },
  "extracted": {
    "facts": ["Projeto visa transformar ideias em documentação"],
    "decisions": [],
    "assumptions": [],
    "hypotheses": [],
    "constraints": [],
    "openQuestions": []
  },
  "missingSignals": [],
  "agentRefinement": {
    "applied": true,
    "description": "Sintetizou resposta do usuário com clareza adicional",
    "rationale": "Resposta original estava correta mas difusa"
  },
  "userApproval": {
    "status": "explicit",
    "messageId": "msg_004",
    "approvedAt": "2026-05-25T14:35:00Z"
  },
  "revision": {
    "version": 1
  },
  "createdAt": "2026-05-25T14:35:00Z",
  "updatedAt": "2026-05-25T14:35:00Z"
}
```

---

## 7. Schemas de Tarefa LLM (Structured Outputs)

Estes schemas são passados para `generateStructuredOutput()`. Todos devem seguir as regras da seção 4.

### 7.1 `AnswerAssessment`

```
Propósito:     Resultado da avaliação semântica de uma resposta do usuário.
schemaName:    "answer_assessment"
Chamado por:   assessAnswer() em src/prompts/assess-answer.prompt.ts
Usa strict:    true
Validação:     AnswerAssessmentSchema.parse() após retorno da LLM
```

**Schema (discriminated union por `status`):**

```ts
type AnswerAssessment =
  | {
      status: "sufficient";
      confidence: "low" | "medium" | "high";
      extractedFacts: string[];
      extractedDecisions: string[];
      extractedAssumptions: string[];
      synthesizedSummary: string;
    }
  | {
      status: "needs_complement";
      confidence: "low" | "medium" | "high";
      capturedSignals: string[];
      missingSignals: string[];
      followUpQuestion: string;
    }
  | {
      status: "insufficient";
      reason: string;
      reformulatedQuestion: string;
    }
  | {
      status: "conflict";
      conflicts: {
        previousAnswerId: string;
        previousAnswerSummary: string;
        contradictionDescription: string;
        resolutionQuestion: string;
        resolutionOptions: string[];
      }[];
    }
  | {
      status: "user_intent_override";
      requestedAction:
        | "skip"
        | "pause"
        | "go_back"
        | "generate_now"
        | "change_scope"
        | "review_answers";
      detectedIntent: string;
    };
```

**Exemplo JSON (sufficient):**

```json
{
  "status": "sufficient",
  "confidence": "high",
  "extractedFacts": ["Usuário quer criar sistema de documentação"],
  "extractedDecisions": ["Foco em documentação estruturada"],
  "extractedAssumptions": ["Pessoas têm ideias difusas que precisam de estrutura"],
  "synthesizedSummary": "O projeto visa transformar ideias difusas em documentação clara e estruturada."
}
```

**Exemplo JSON (needs_complement):**

```json
{
  "status": "needs_complement",
  "confidence": "medium",
  "capturedSignals": ["project_purpose"],
  "missingSignals": ["target_audience", "core_tension"],
  "followUpQuestion": "Para quem este projeto é destinado e qual a principal tensão que ele resolve?"
}
```

### 7.2 `CanonicalAnswerDraft`

```
Propósito:     Rascunho de resposta canônica sintetizada pela LLM.
schemaName:    "canonical_answer_draft"
Chamado por:   synthesizeCanonicalAnswer()
Usa strict:    true
```

**Schema:**

```ts
type CanonicalAnswerDraft = {
  finalAnswer: string;                      // resposta final sintetizada
  confidence: "low" | "medium" | "high";
  extracted: {
    facts: string[];
    decisions: string[];
    assumptions: string[];
    hypotheses: string[];
    constraints: string[];
    openQuestions: string[];
  };
  missingSignals: string[];                 // sinais que permanecem ausentes
  agentRefinement: {
    applied: boolean;
    description: string;
    rationale: string;
  };
};
```

**Exemplo JSON:**

```json
{
  "finalAnswer": "O projeto existe para ajudar pessoas a transformar ideias difusas, acumuladas mentalmente, em documentação clara, estruturada e acionável.",
  "confidence": "high",
  "extracted": {
    "facts": ["Transformar ideias em documentação"],
    "decisions": [],
    "assumptions": ["Ideias difusas são a causa principal de inação"],
    "hypotheses": ["Documentação estruturada reduz ansiedade de execução"],
    "constraints": [],
    "openQuestions": ["Qual o formato exato da documentação?"]
  },
  "missingSignals": [],
  "agentRefinement": {
    "applied": true,
    "description": "Expandiu resposta do usuário com clareza estrutural",
    "rationale": "Resposta original capturava a intenção mas estava vaga"
  }
}
```

### 7.3 `ConflictDetectionResult`

```
Propósito:     Resultado da detecção de conflitos entre respostas.
schemaName:    "conflict_detection"
Chamado por:   detectConflict()
Usa strict:    true
```

**Schema:**

```ts
type ConflictDetectionResult = {
  hasConflicts: boolean;
  conflicts: {
    conflictingAnswerId: string;
    conflictingAnswerSummary: string;
    newAnswerSummary: string;
    contradictionDescription: string;
    resolutionQuestion: string;
    resolutionOptions: string[];
    severity: "critical" | "moderate" | "minor";
  }[];
};
```

### 7.4 `GeneratedDocumentDraft`

```
Propósito:     Rascunho de documento gerado pela LLM a partir de CanonicalAnswerRecords.
schemaName:    "document_draft"
Chamado por:   generateDocumentDraft()
Usa strict:    true
```

**Schema:**

```ts
type GeneratedDocumentDraft = {
  markdown: string;                         // conteúdo completo do documento em Markdown
  title: string;
  sections: GeneratedDocumentSectionTrace[];
  sourceCanonicalAnswerIds: string[];
  unresolvedQuestions: string[];
  assumptionsUsed: string[];
  agentInferences: string[];
  completenessWarnings: string[];
};

type GeneratedDocumentSectionTrace = {
  sectionId: string;                        // ex.: "## Thesis"
  heading: string;
  generatedContent: string;
  sourceCanonicalAnswerIds: string[];
  sourceMessageIds: string[];
  assumptionsUsed: string[];
  agentInferences: string[];
  confidence: "high" | "medium" | "low";
};
```

**Exemplo JSON mínimo:**

```json
{
  "markdown": "# Thesis\n\nEste projeto existe para ajudar pessoas...\n\n## Problem\n\nMuitas pessoas travam porque...\n",
  "title": "01-thesis",
  "sections": [
    {
      "sectionId": "## Thesis",
      "heading": "Thesis",
      "generatedContent": "Este projeto existe para ajudar pessoas a transformar ideias difusas em documentação clara.",
      "sourceCanonicalAnswerIds": ["ans_001"],
      "sourceMessageIds": ["msg_001", "msg_003"],
      "assumptionsUsed": [],
      "agentInferences": [],
      "confidence": "high"
    }
  ],
  "sourceCanonicalAnswerIds": ["ans_001"],
  "unresolvedQuestions": [],
  "assumptionsUsed": [],
  "agentInferences": [],
  "completenessWarnings": []
}
```

### 7.5 `DocumentPatchResult`

```
Propósito:     Patch proposto pela LLM durante revisão de documento.
schemaName:    "document_patch"
Chamado por:   reviewDocument()
Usa strict:    true
```

**Schema:**

```ts
type DocumentPatchResult = {
  patches: {
    sectionId: string;
    sectionHeading: string;
    originalContent: string;
    proposedContent: string;
    rationale: string;
    type: "addition" | "modification" | "deletion" | "restructure";
    confidence: "high" | "medium" | "low";
  }[];
  summary: string;
  issuesFound: number;
  issuesFixed: number;
  warnings: string[];
};
```

---

## 8. Schemas de Decisão e Diagnóstico

### 8.1 `DocumentationDecision`

```
Propósito:     Registro auditável de uma decisão de documentação.
Arquivo:       .logos/interviews/<id>/decisions.json (array JSON)
Persistência:  Append-only
Structured output: ❌ Não
```

**Campos:**

```ts
type DocumentationDecision = {
  id: string;
  type:
    | "answer_finalized"
    | "question_skipped"
    | "conflict_resolved"
    | "scope_changed"
    | "generation_started"
    | "document_accepted"
    | "document_rejected"
    | "document_patched";

  phaseId?: string;
  documentId?: string;
  questionId?: string;

  decision: string;
  rationale: string;

  sourceMessageIds: string[];
  sourceCanonicalAnswerIds?: string[];

  madeBy: "user" | "agent" | "system";
  requiresUserApproval: boolean;
  approvalMessageId?: string;

  createdAt: string;
};
```

### 8.2 `ConflictRecord`

```
Propósito:     Registro de um conflito detectado entre respostas.
Arquivo:       .logos/interviews/<id>/conflicts.json (array JSON)
Persistência:  Append — resolvidos marcados com resolution
Structured output: ❌ Não (detectado pela LLM, registrado pelo Core)
```

**Campos:**

```ts
type ConflictRecord = {
  id: string;
  interviewRunId: string;
  answerAId: string;                        // primeira resposta conflitante
  answerBId: string;                        // segunda resposta conflitante
  contradictionDescription: string;
  severity: "critical" | "moderate" | "minor";
  resolution: {
    status: "unresolved" | "resolved" | "deferred";
    resolvedAnswerId?: string;
    resolutionDescription?: string;
    userMessageId?: string;
    resolvedAt?: string;
  } | null;
  createdAt: string;
};
```

### 8.3 `GenerationReadiness`

```
Propósito:     Avaliação de prontidão para geração de documento.
Arquivo:       .logos/interviews/<id>/generation-readiness.json
Persistência:  Sobrescrever
Structured output: ❌ Não
```

**Campos:**

```ts
type GenerationReadiness = {
  documentId: string;
  ready: boolean;
  mode: "strict" | "partial" | "hypothesis" | "skeleton";
  requiredAnswers: number;
  completedAnswers: number;
  skippedRequired: string[];                // questionIds obrigatórias puladas
  weakAnswers: {
    questionId: string;
    reason: string;                         // "low_confidence" | "missing_signals" | "conflict"
  }[];
  blockingGaps: string[];                   // descrições de lacunas bloqueadoras
  recommendedAction: "generate" | "fill_gaps" | "review" | "not_ready";
};
```

---

## 9. Schemas Executivos

### 9.1 `ExecutivePlan`

```
Propósito:     Modelo de execução portável compilado dos docs canônicos.
Arquivo:       executive/executive-plan.json
Persistência:  Sobrescrever (regenerável)
Structured output: ✅ Sim (schemaName: "executive_plan")
```

**Schema:**

```ts
type ExecutivePlan = {
  version: "0.1.0";
  generatedAt: string;                      // ISO 8601
  sourceDocs: string[];                     // paths dos documentos de origem
  projectName: string;
  roadmap: Roadmap;
  diagnostics: string[];                    // warnings do compilador
};

type Roadmap = {
  id: string;
  name: string;
  milestones: Milestone[];
};

type Milestone = {
  id: string;
  name: string;
  purpose: string;
  order: number;
  initiatives: Initiative[];
};

type Initiative = {
  id: string;
  name: string;
  purpose: string;
  sourcePhaseId: string;
  sourceDocumentIds: string[];
  executionItems: ExecutionItem[];
};

type ExecutionItem = {
  id: string;
  type:
    | "task"                                // ação concreta
    | "decision"                            // decisão a ser tomada
    | "question"                            // pergunta a ser respondida
    | "risk"                                // risco a ser monitorado
    | "review"                              // revisão necessária
    | "agent_prompt"                        // prompt para agente externo
    | "doc_update"                          // atualização de documentação
    | "spike"                               // investigação técnica
    | "artifact";                           // artefato a ser produzido

  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  estimatedEffort?: "S" | "M" | "L" | "XL";
  sourceCanonicalAnswerIds: string[];
  sourceMessageIds: string[];
  dependencies: string[];                   // IDs de ExecutionItems que bloqueiam este
  assignedMilestoneId: string;
};
```

**Exemplo JSON mínimo:**

```json
{
  "version": "0.1.0",
  "generatedAt": "2026-05-25T15:00:00Z",
  "sourceDocs": ["docs/01-foundation/01-thesis.md"],
  "projectName": "my-project",
  "roadmap": {
    "id": "roadmap_001",
    "name": "MVP",
    "milestones": [
      {
        "id": "m_001",
        "name": "Foundation Ready",
        "purpose": "Normative axis documents are complete and validated.",
        "order": 1,
        "initiatives": [
          {
            "id": "init_001",
            "name": "Schema System",
            "purpose": "Define and validate all LOGOS schemas.",
            "sourcePhaseId": "01-foundation",
            "sourceDocumentIds": ["01-thesis"],
            "executionItems": [
              {
                "id": "ei_001",
                "type": "task",
                "title": "Implement Zod schemas for all canonical types",
                "description": "Create Zod schemas matching the LOGOS Schema Spec.",
                "priority": "critical",
                "estimatedEffort": "M",
                "sourceCanonicalAnswerIds": ["ans_001"],
                "sourceMessageIds": [],
                "dependencies": [],
                "assignedMilestoneId": "m_001"
              }
            ]
          }
        ]
      }
    ]
  },
  "diagnostics": []
}
```

### 9.2 `ArtifactSummary`

```
Propósito:     Registro de um artefato derivado gerado.
Usado em:      TUI Artifacts screen, ProjectStatus
Structured output: ❌ Não
```

**Campos:**

```ts
type ArtifactSummary = {
  path: string;                             // caminho relativo ao projeto
  type: "html" | "markdown" | "json" | "agent_pack" | "github_issue";
  status: "fresh" | "stale" | "not_generated";
  sourcePaths: string[];
  generatedAt?: string;
  regenerable: boolean;
};
```

---

## 10. Schemas de Diagnóstico

### 10.1 `Diagnostic`

```
Propósito:     Um diagnóstico de validação, lacuna ou erro.
Usado em:      Core validation, TUI status, CLI output
Structured output: ❌ Não
```

**Campos:**

```ts
type Diagnostic = {
  id: string;
  severity: "error" | "warning" | "info";
  category: "schema" | "completeness" | "traceability" | "generation" | "executive";
  message: string;
  path?: string;                            // caminho do arquivo relacionado
  section?: string;                         // seção do documento relacionada
  suggestion?: string;                      // ação recomendada
};
```

### 10.2 `ProjectStatus`

```
Propósito:     Status completo do projeto para a TUI.
Calculado por: Core (não LLM)
Structured output: ❌ Não
```

**Campos:**

```ts
type ProjectStatus = {
  projectName: string;
  projectRoot: string;
  phases: PhaseStatus[];
  executive: {
    compiled: boolean;
    lastCompiledAt?: string;
    stale: boolean;
    exportTargets: { target: string; status: "fresh" | "stale" | "missing" }[];
  };
  artifacts: ArtifactSummary[];
  diagnostics: Diagnostic[];
};

type PhaseStatus = {
  phaseId: string;
  name: string;
  order: number;
  documents: {
    total: number;
    completed: number;
    missing: number;
  };
  completeness: number;                     // 0–100
  blockingGaps: string[];
};
```

---

## 11. Versionamento e Migração

### 11.1 Política de versão

Todo schema canônico carrega um campo `version: "0.1.0"`. O Core deve:

1. Verificar a versão ao carregar.
2. Rejeitar schemas com versão maior que a suportada (futuro).
3. Aceitar schemas com versão menor e aplicar migração (se definida).

### 11.2 Migração

```ts
// src/core/schema/migrate.ts
type SchemaMigration = {
  from: string;
  to: string;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
};

const MIGRATIONS: SchemaMigration[] = [
  // Exemplo futuro:
  // { from: "0.1.0", to: "0.2.0", migrate: (d) => ({ ...d, newField: "default" }) },
];
```

Para o MVP (`0.1.0`), não há migrações. A política existe para ser preenchida quando o schema evoluir.

### 11.3 Breaking changes

Mudanças que exigem nova versão major:

- Remoção de campo obrigatório
- Mudança de tipo de campo
- Mudança de enum (remoção de valor)

Mudanças compatíveis (minor):

- Adição de campo opcional
- Adição de valor a enum

---

## 12. Critérios de Aceitação

Uma implementação LOGOS satisfaz esta spec quando:

1. ✅ Todo schema listado nas seções 5–10 está definido em Zod 4.
2. ✅ Schemas de structured output (seção 7) podem ser serializados para JSON Schema com `additionalProperties: false` e `strict: true`.
3. ✅ `generateStructuredOutput()` é chamado com o `schemaName` e `jsonSchema` corretos para cada tarefa LLM.
4. ✅ Toda resposta de `generateStructuredOutput()` é validada com `schema.parse()` antes de uso.
5. ✅ `logos validate` reporta `Diagnostic[]` para violações de schema em arquivos canônicos.
6. ✅ `transcript.jsonl` é validado linha a linha como `TranscriptMessage` na leitura.
7. ✅ `CanonicalAnswerRecord` versionamento funciona: revisões criam novos registros com `previousAnswerId`.
8. ✅ `AnswerAssessment` (discriminated union) transita a máquina de estados corretamente para cada `status`.
9. ✅ `ExecutivePlan` é regenerável e passa em `executive.schema` validation.
10. ✅ Nenhum schema de structured output depende de `oneOf`/`anyOf` ambíguo.

---

## 13. Resumo

```txt
LOGOS schemas servem três propósitos:

1. VALIDAÇÃO RUNTIME (Zod)
   - Arquivos YAML/JSON do projeto
   - Respostas da LLM (nunca confiar cegamente)
   - Estado da máquina de entrevista

2. PERSISTÊNCIA AUDITÁVEL
   - transcript.jsonl (append-only)
   - canonical-answers.json (versionado)
   - decisions.json (append-only)
   - state.json (snapshot para resume)

3. STRUCTURED OUTPUTS (JSON Schema → generateStructuredOutput)
   - AnswerAssessment (discriminated union)
   - CanonicalAnswerDraft
   - ConflictDetectionResult
   - GeneratedDocumentDraft
   - DocumentPatchResult
   - ExecutivePlan

Regra de ouro:
  Mesmo schema usado no jsonSchema da chamada LLM
  DEVE ser usado no parse() de validação local.
  NUNCA confie no provider.
```
