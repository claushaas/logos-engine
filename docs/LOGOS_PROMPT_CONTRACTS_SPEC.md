# LOGOS Prompt Contracts Spec

**Status:** Rascunho 1
**Escopo:** LOGOS Engine MVP — builders de prompt e contratos de tarefa semântica
**Público:** engenharia, implementação
**Propósito canônico:** Definir contratos determinísticos para todos os prompts do LOGOS MVP, garantindo que cada chamada LLM seja previsível, validável e rastreável.

---

## 1. Propósito

Esta especificação define o contrato de cada prompt builder do LOGOS Engine. Prompts no LOGOS **não são conversas abertas**. Cada prompt é uma tarefa semântica específica com:

- Tipo de entrada explícito
- Schema de saída estruturado (`jsonSchema` + `schemaName`)
- Instrução de sistema determinística
- Invariantes que a LLM deve respeitar
- Comportamentos proibidos

Toda saída de prompt que afete estado, decisões, respostas canônicas ou documentos gerados DEVE ser consumida via `generateStructuredOutput()`.

---

## 2. Princípios de Design de Prompt

### 2.1 Determinismo

```
O mesmo input DEVE produzir output semanticamente equivalente.
O prompt NÃO DEVE conter aleatoriedade, saudações variáveis ou
linguagem ambígua que incentive variação desnecessária.
```

### 2.2 Separação de responsabilidades

```
O prompt builder (src/prompts/*.prompt.ts):
  - Monta system prompt e user messages
  - Define jsonSchema e schemaName
  - Chama generateStructuredOutput()
  - Retorna o tipo validado

O Core (src/core/, src/interview/):
  - Valida o retorno com schema de domínio
  - Aplica transições de estado
  - Persiste resultados

A LLM:
  - Recebe mensagens + jsonSchema
  - Retorna JSON estruturado que conforma ao schema
  - NUNCA decide transições, salva arquivos ou modifica estado
```

### 2.3 Idioma

```
System prompts são em INGLÊS (idioma comum de instrução para LLMs).
User payloads podem conter conteúdo no idioma do projeto (pt, en, es).
Outputs estruturados seguem o schema — campos textuais preservam
o idioma do conteúdo de entrada.
```

### 2.4 Imutabilidade de mensagens de origem

```
Quando o prompt reference transcript messages ou canonical answers,
ele DEVE incluir os IDs originais (sourceMessageIds, sourceCanonicalAnswerIds)
para que o output preserve a cadeia de rastreabilidade.
```

---

## 3. Requisito de Structured Output

### 3.1 Regra

```
Todo prompt cujo output afete estado da entrevista, respostas canônicas,
documentos gerados ou Executive Plan DEVE:
  1. Definir um jsonSchema compatível com response_format: json_schema
  2. Passar esse schema para generateStructuredOutput()
  3. Incluir um schema Zod correspondente para validação local
```

### 3.2 Contrato do prompt builder com `generateStructuredOutput()`

```ts
// Todo prompt builder segue esta estrutura:
export async function promptTaskName(
  config: LlmClientOptions,
  input: TInput,
): Promise<TOutput> {
  const messages = buildMessages(input);
  const jsonSchema = generateJsonSchema(TOutputZodSchema);

  return generateStructuredOutput(config, {
    messages,
    jsonSchema,
    schemaName: "task_name",        // identificador único
    strict: true,
    schema: TOutputZodSchema,       // validação local
    temperature: 0,
    maxTokens: 1024,
  });
}
```

### 3.3 Schemas de saída por prompt

| Prompt | `schemaName` | Schema Zod | Seção |
|---|---|---|---|
| `assess-answer` | `"answer_assessment"` | `AnswerAssessmentSchema` | 6.1 |
| `synthesize-canonical-answer` | `"canonical_answer_draft"` | `CanonicalAnswerDraftSchema` | 6.2 |
| `detect-conflict` | `"conflict_detection"` | `ConflictDetectionResultSchema` | 6.3 |
| `resolve-conflict` | `"conflict_resolution"` | `ConflictResolutionResultSchema` | 6.4 |
| `generate-document` | `"document_draft"` | `GeneratedDocumentDraftSchema` | 6.5 |
| `review-document` | `"document_patch"` | `DocumentPatchResultSchema` | 6.6 |
| `compile-executive` | `"executive_plan"` | `ExecutivePlanSchema` | 6.7 |

---

## 4. Interface do Prompt Builder

### 4.1 Tipo base

```ts
// src/prompts/types.ts
import type { LlmClientOptions, LlmMessage } from "../llm/client.js";

export interface PromptBuilderInput<TInput> {
  /** Configuração LLM (baseUrl, apiKey, model, retry). */
  config: LlmClientOptions;
  /** Dados de entrada específicos da tarefa. */
  input: TInput;
}

export interface PromptBuilderOutput<TOutput> {
  /** Resultado tipado e validado. */
  data: TOutput;
  /** Mensagens enviadas para a LLM (para logging e snapshot). */
  messages: LlmMessage[];
  /** Uso de tokens reportado pelo provider. */
  usage?: {
    input: number;
    output: number;
    total: number;
  };
}
```

### 4.2 Assinatura comum

```ts
type PromptBuilder<TInput, TOutput> = (
  params: PromptBuilderInput<TInput>,
) => Promise<PromptBuilderOutput<TOutput>>;
```

---

## 5. Invariantes Comuns

### 5.1 Invariantes que TODA LLM deve respeitar

```txt
INV-001  Não inventar fatos.
         Todo fato deve ser extraído do conteúdo de entrada (user messages,
         canonical answers, documentos). Se não há evidência no input,
         o campo deve ser null ou array vazio — nunca fabricado.

INV-002  Distinguir user-provided de agent inference.
         Conteúdo extraído diretamente das mensagens do usuário é "fact"
         ou "decision". Conteúdo inferido ou expandido pelo modelo é
         "assumption", "hypothesis" ou "agentInference".

INV-003  Retornar apenas estrutura.
         Quando chamado via structured output, o modelo NÃO DEVE adicionar
         texto fora do JSON. Nada de "Aqui está o resultado:", markdown
         fences, ou explicações.

INV-004  Nunca aplicar transição de estado.
         O modelo avalia e sugere. Quem decide a transição é o Core.

INV-005  Nunca salvar arquivo.
         O modelo não tem acesso ao filesystem. Outputs são retornados
         em memória para o Core processar.

INV-006  Preservar sourceMessageIds.
         Quando o output reference conteúdo de mensagens, deve incluir
         os IDs originais para rastreabilidade.

INV-007  Explicitar missingSignals.
         Se a resposta do usuário não contém todos os sinais obrigatórios,
         os sinais ausentes DEVEM ser listados explicitamente.

INV-008  Explicitar assumptions e hypotheses.
         Suposições e hipóteses usadas para preencher lacunas DEVEM ser
         declaradas nos campos apropriados, nunca embutidas silenciosamente
         no texto gerado.

INV-009  Explicitar unresolvedQuestions.
         Perguntas que permanecem sem resposta após a síntese DEVEM ser
         listadas, para que o sistema e o usuário saibam o que falta.

INV-010  Respeitar o idioma do conteúdo de entrada.
         Se o conteúdo do usuário está em português, o output textual
         (finalAnswer, markdown, summaries) deve estar em português.
```

### 5.2 Invariantes que o CORE aplica (não a LLM)

```txt
CORE-001  Persistir transcrição antes de avaliar.
CORE-002  Versionar canonical answers.
CORE-003  Validar schema antes de persistir.
CORE-004  Exigir aprovação do usuário para decisões críticas.
CORE-005  Nunca confiar cegamente no output da LLM.
```

---

## 6. Contratos de Prompt

### 6.1 `assess-answer.prompt.ts`

```
taskName:        "assessAnswer"
Arquivo:         src/prompts/assess-answer.prompt.ts
Chamado por:     Interview state machine (estado ASSESSING_ANSWER)
Quando:          Após TRANSCRIBING_MESSAGE — antes de decidir transição
Schema LLM:      AnswerAssessment (discriminated union por status)
schemaName:      "answer_assessment"
Temperatura:     0
MaxTokens:       1024
```

**Input type:**

```ts
interface AssessAnswerInput {
  /** Texto completo da pergunta ativa. */
  question: string;
  /** Sinais semânticos que a resposta deve conter. */
  requiredSignals: string[];
  /** Mensagens do usuário (da transcrição, com IDs). */
  userMessages: { id: string; content: string }[];
  /** Mensagens do agente (pergunta, follow-ups). */
  agentMessages: { id: string; content: string }[];
  /** Resumos de respostas canônicas anteriores neste documento (máx. 3). */
  previousAnswers?: { id: string; summary: string }[];
  /** Número de follow-ups já feitos para esta pergunta. */
  followUpCount: number;
  /** Máximo de follow-ups permitido. */
  maxFollowUps: number;
}
```

**System instruction:**

```txt
You are a semantic evaluator in a structured documentation interview system called LOGOS.

Your task: evaluate whether the user's answer (or sequence of answers + follow-ups)
is sufficient to answer the active documentation question.

Rules:
- Extract facts, decisions, assumptions FROM the user's messages. Do not invent.
- If the answer contains all requiredSignals, return status "sufficient".
- If the answer is useful but lacks one or more requiredSignals AND follow-up limit
  has not been reached, return status "needs_complement" with a specific follow-up question
  that targets ONLY the missing signals.
- If the answer is off-topic or too vague to extract any signals, return status "insufficient"
  with a reformulated question that is more concrete.
- If the answer contradicts a previous canonical answer, return status "conflict" with
  details about the contradiction and resolution options.
- If the user is clearly requesting an action (skip, pause, go back, generate now), return
  status "user_intent_override" with the detected action.
- Confidence: "high" = clear, specific, directly usable. "medium" = usable but needs refinement.
  "low" = vague, provisional, or contradictory.
- Never fabricate facts. If no evidence exists for a signal, list it as missing.
- Output language must match the user's language.
```

**Output JSON Schema:** `AnswerAssessment` (discriminated union — ver `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md`, Seção 7.1)

**Invariantes específicos:**

```txt
- O status "sufficient" só deve ser retornado se TODOS os requiredSignals
  forem capturados OU explicitamente listados como missingSignals vazios.
- O status "needs_complement" só deve ser retornado se followUpCount < maxFollowUps.
- Se followUpCount >= maxFollowUps, deve sugerir "user_intent_override" ou
  "sufficient" com confidence "low".
- O followUpQuestion deve ser UMA pergunta específica, não um parágrafo.
- Conflitos devem referenciar o previousAnswerId.
```

**Forbidden behavior:**

```txt
- NUNCA retornar status "sufficient" com missingSignals não-vazios.
- NUNCA sugerir transição de estado ("go to ASKING_FOLLOW_UP").
- NUNCA gerar texto de documento final.
- NUNCA avaliar mensagens que não foram incluídas no input.
```

**Exemplo de input:**

```json
{
  "question": "Qual é a tese central deste projeto?",
  "requiredSignals": ["project_purpose", "target_outcome"],
  "userMessages": [
    { "id": "msg_001", "content": "Quero criar um sistema que ajude pessoas a tirar ideias da cabeça e transformar em documentação." }
  ],
  "agentMessages": [
    { "id": "msg_000", "content": "Pergunta 1/5 — Tese Central\nQual é a tese central deste projeto?" }
  ],
  "previousAnswers": [],
  "followUpCount": 0,
  "maxFollowUps": 2
}
```

**Exemplo de output:**

```json
{
  "status": "needs_complement",
  "confidence": "medium",
  "capturedSignals": ["project_purpose"],
  "missingSignals": ["target_outcome"],
  "followUpQuestion": "Qual resultado concreto este sistema deve produzir para as pessoas que o usarem?"
}
```

**Validação esperada:**

```txt
1. AnswerAssessmentSchema.parse(output) — validação básica
2. Core verifica: se status === "sufficient", requiredSignals menos
   extractedFacts/Decisions contém todos os sinais
3. Core verifica: se status === "conflict", previousAnswerId existe
   no histórico
```

**Comportamento em erro:**

```txt
- JsonSchema não suportado: fallback para generate-json.ts com prompt-based JSON
- Erro de parse JSON: relançar como "Failed to assess answer"
- Erro de validação: emitir Diagnostic, não transicionar estado,
  oferecer ao usuário: "reformular pergunta" ou "tentar novamente"
```

---

### 6.2 `synthesize-canonical-answer.prompt.ts`

```
taskName:        "synthesizeCanonicalAnswer"
Arquivo:         src/prompts/synthesize-canonical-answer.prompt.ts
Chamado por:     Interview state machine (estado SYNTHESIZING_FINAL_ANSWER)
Quando:          Após ASSESSING_ANSWER retornar "sufficient"
Schema LLM:      CanonicalAnswerDraft
schemaName:      "canonical_answer_draft"
Temperatura:     0
MaxTokens:       2048
```

**Input type:**

```ts
interface SynthesizeCanonicalAnswerInput {
  question: string;
  questionId: string;
  requiredSignals: string[];
  userMessages: { id: string; content: string }[];
  agentMessages: { id: string; content: string }[];
  complementMessages: { id: string; content: string }[];
  assessment: AnswerAssessment;
  documentTitle: string;
  sectionTarget: string;
}
```

**System instruction:**

```txt
You are a documentation synthesizer in a structured documentation interview system called LOGOS.

Your task: synthesize a clear, faithful final answer to a documentation question,
based on the user's messages, follow-ups, and the semantic assessment.

Rules:
- Combine the relevant user messages and clarifications into ONE coherent answer.
- Preserve fidelity to user intent. Do not reinterpret or change the user's meaning.
- Distinguish: facts (user-provided), decisions (user-stated choices), assumptions
  (your inference to fill gaps), hypotheses (speculative), constraints (boundaries),
  openQuestions (what remains unanswered).
- If the confidence from the assessment is "low" or "medium", explain in
  agentRefinement what you added or clarified and why.
- Include sourceMessageIds for traceability.
- List any signals that remain missing in missingSignals.
- The finalAnswer should be in the user's language.
- Output language must match the user's language.
```

**Output JSON Schema:** `CanonicalAnswerDraft` (ver `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md`, Seção 7.2)

**Invariantes específicos:**

```txt
- finalAnswer NUNCA deve conter informações que não estão nas mensagens de origem.
- Se informação foi inferida (não está literalmente nas mensagens), deve aparecer
  em extracted.assumptions ou extracted.hypotheses, não embutida no finalAnswer.
- agentRefinement.applied deve ser true se a síntese adicionou clareza, estrutura
  ou conectores que não estavam nas mensagens originais.
- missingSignals deve ser consistente com o assessment recebido.
```

**Forbidden behavior:**

```txt
- NUNCA adicionar fatos que o usuário não mencionou.
- NUNCA remover conteúdo do usuário por considerá-lo "irrelevante".
- NUNCA alterar o significado de uma afirmação do usuário.
- NUNCA marcar agentRefinement.applied = false se houve qualquer paráfrase.
```

**Exemplo de output:**

```json
{
  "finalAnswer": "O projeto existe para ajudar pessoas a transformar ideias difusas, acumuladas mentalmente, em documentação clara, estruturada e acionável.",
  "confidence": "high",
  "extracted": {
    "facts": ["Usuário quer criar sistema de documentação", "Foco em transformar ideias difusas em documentação"],
    "decisions": [],
    "assumptions": [],
    "hypotheses": ["Documentação estruturada reduz ansiedade de execução"],
    "constraints": [],
    "openQuestions": ["Qual o formato exato da documentação gerada?"]
  },
  "missingSignals": [],
  "agentRefinement": {
    "applied": true,
    "description": "Sintetizou duas mensagens do usuário em uma frase coesa, adicionando conectores.",
    "rationale": "Mensagens originais capturavam a intenção mas estavam fragmentadas."
  }
}
```

---

### 6.3 `detect-conflict.prompt.ts`

```
taskName:        "detectConflict"
Arquivo:         src/prompts/detect-conflict.prompt.ts
Chamado por:     Interview state machine (estado ASSESSING_ANSWER)
Quando:          Antes de sintetizar — verificar se a nova resposta contradiz
                 respostas canônicas anteriores
Schema LLM:      ConflictDetectionResult
schemaName:      "conflict_detection"
Temperatura:     0
MaxTokens:       1024
```

**Input type:**

```ts
interface DetectConflictInput {
  newAnswerDraft: CanonicalAnswerDraft;
  previousAnswers: {
    id: string;
    questionText: string;
    finalAnswer: string;
    answerStatus: string;
  }[];
}
```

**System instruction:**

```txt
You are a conflict detector in a structured documentation interview system called LOGOS.

Your task: detect whether a newly synthesized answer contradicts any previous
canonical answer in the same document.

Rules:
- A contradiction exists when two answers make mutually exclusive claims.
- NOT a contradiction: different aspects of the same topic, different levels of detail,
  complementary information, or evolving decisions (the newer answer supersedes).
- If you find a conflict, describe the contradiction clearly, explain why it matters,
  and suggest resolution options.
- Severity: "critical" = blocks document generation (e.g., contradictory business model).
  "moderate" = creates inconsistency but doesn't block. "minor" = wording or emphasis difference.
- If no conflicts, return hasConflicts: false with empty conflicts array.
- Reference conflictingAnswerId for traceability.
```

**Output JSON Schema:** `ConflictDetectionResult` (ver `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md`, Seção 7.3)

**Exemplo de output (sem conflitos):**

```json
{
  "hasConflicts": false,
  "conflicts": []
}
```

**Exemplo de output (com conflito):**

```json
{
  "hasConflicts": true,
  "conflicts": [
    {
      "conflictingAnswerId": "ans_003",
      "conflictingAnswerSummary": "Projeto será open source e gratuito",
      "newAnswerSummary": "Projeto terá modelo de assinatura SaaS",
      "contradictionDescription": "A resposta anterior afirma que o projeto será gratuito e open source. A nova resposta introduz um modelo de assinatura paga, o que contradiz a afirmação anterior sobre gratuidade.",
      "resolutionQuestion": "Qual modelo de licenciamento é o correto?",
      "resolutionOptions": [
        "O core é open source, mas haverá hosted SaaS pago",
        "O produto deixou de ser open source",
        "A assinatura se aplica apenas a serviços complementares",
        "Ainda é uma decisão em aberto"
      ],
      "severity": "critical"
    }
  ]
}
```

---

### 6.4 `resolve-conflict.prompt.ts`

```
taskName:        "resolveConflict"
Arquivo:         src/prompts/resolve-conflict.prompt.ts
Chamado por:     Interview state machine (estado RECONCILING_CONFLICT)
Quando:          Após detectConflict retornar hasConflicts: true E o usuário
                 fornecer uma resposta de resolução
Schema LLM:      ConflictResolutionResult
schemaName:      "conflict_resolution"
Temperatura:     0
MaxTokens:       1024
```

**Input type:**

```ts
interface ResolveConflictInput {
  conflict: ConflictRecord;
  userResolutionMessage: { id: string; content: string };
  affectedAnswers: {
    id: string;
    finalAnswer: string;
    needsRevision: boolean;
  }[];
}
```

**System instruction:**

```txt
You are a conflict resolver in a structured documentation interview system called LOGOS.

Your task: process the user's resolution of a documentation conflict and determine
which answers need revision.

Rules:
- Interpret the user's resolution message and determine which answer (or answers)
  should be revised.
- For each affected answer that needs revision, propose a revised finalAnswer
  that incorporates the resolution.
- If the user's resolution is ambiguous, return status "needs_clarification"
  with a specific question.
- If the resolution is clear but changes the meaning significantly, flag it
  as a scope change if it affects multiple documents.
- Preserve source message IDs.
```

**Output JSON Schema:**

```ts
type ConflictResolutionResult = {
  status: "resolved" | "needs_clarification" | "deferred";
  resolutionDescription: string;
  revisedAnswers: {
    answerId: string;
    revisedFinalAnswer: string;
    revisionRationale: string;
  }[];
  clarificationQuestion?: string;
  scopeChangeDetected: boolean;
  scopeChangeDescription?: string;
};
```

---

### 6.5 `generate-document.prompt.ts`

```
taskName:        "generateDocumentDraft"
Arquivo:         src/prompts/generate-document.prompt.ts
Chamado por:     Interview state machine (estado GENERATING_DOCUMENTS) ou
                 CLI: logos generate --doc <id>
Quando:          Após OFFER_GENERATION com acceptance do usuário
Schema LLM:      GeneratedDocumentDraft
schemaName:      "document_draft"
Temperatura:     0.1
MaxTokens:       8192
```

**Input type:**

```ts
interface GenerateDocumentInput {
  documentId: string;
  title: string;
  phaseName: string;
  documentPurpose: string;
  template: string;
  canonicalAnswers: {
    id: string;
    questionId: string;
    questionText: string;
    finalAnswer: string;
    confidence: string;
    extracted: CanonicalAnswerRecord["extracted"];
    sourceMessageIds: string[];
  }[];
  sectionMapping: {
    sectionId: string;
    heading: string;
    sourceQuestionIds: string[];
  }[];
  strictMode: boolean;
}
```

**System instruction:**

```txt
You are a documentation generator in a structured documentation system called LOGOS.

Your task: generate a complete Markdown document from canonical answer records.
Each section of the document is derived from specific canonical answers.

Rules:
- Generate ONE section at a time, following the sectionMapping order.
- For each section, use ONLY the canonical answers mapped to it as source material.
- DO NOT invent content not present in the canonical answers.
- If a section has insufficient source material AND strictMode is false:
  mark it with agentInferences explaining what was inferred.
- If a section has insufficient source material AND strictMode is true:
  emit a completenessWarning explaining what is missing, and leave the
  section with a placeholder: "[MISSING: <explanation>]".
- Every section must include a source trace: which canonicalAnswerIds and
  sourceMessageIds were used.
- Mark assumptions, hypotheses, and agent inferences explicitly in the
  section trace, not in the prose.
- Unresolved questions from canonical answers must be listed in
  unresolvedQuestions at the document level.
- The generated markdown should follow the template structure.
- Output language must match the canonical answers' language.
```

**Output JSON Schema:** `GeneratedDocumentDraft` (ver `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md`, Seção 7.4)

**Invariantes específicos:**

```txt
- NUNCA gerar conteúdo para uma seção sem sourceCanonicalAnswerIds.
- Se strictMode = true e faltam respostas obrigatórias, a seção DEVE
  conter placeholder "[MISSING: ...]", NÃO conteúdo inventado.
- Toda seção DEVE declarar agentInferences separadamente do generatedContent.
- O campo markdown é o documento completo concatenado.
- unresolvedQuestions no nível do documento agrega TODOS os openQuestions
  das respostas canônicas utilizadas.
```

**Exemplo de output (parcial):**

```json
{
  "markdown": "# Thesis\n\nEste projeto existe para ajudar pessoas a transformar ideias difusas em documentação clara, estruturada e acionável.\n\n## Problem\n\n[MISSING: Canonical answer for 'problem' question is not yet available.]\n",
  "title": "01-thesis",
  "sections": [
    {
      "sectionId": "## Thesis",
      "heading": "Thesis",
      "generatedContent": "Este projeto existe para ajudar pessoas a transformar ideias difusas em documentação clara, estruturada e acionável.",
      "sourceCanonicalAnswerIds": ["ans_001"],
      "sourceMessageIds": ["msg_001", "msg_003"],
      "assumptionsUsed": [],
      "agentInferences": [],
      "confidence": "high"
    },
    {
      "sectionId": "## Problem",
      "heading": "Problem",
      "generatedContent": "[MISSING: Canonical answer for 'problem' question is not yet available.]",
      "sourceCanonicalAnswerIds": [],
      "sourceMessageIds": [],
      "assumptionsUsed": [],
      "agentInferences": [],
      "confidence": "low"
    }
  ],
  "sourceCanonicalAnswerIds": ["ans_001"],
  "unresolvedQuestions": ["Qual o formato exato da documentação gerada?"],
  "assumptionsUsed": [],
  "agentInferences": [],
  "completenessWarnings": ["Section '## Problem' has no source material."]
}
```

---

### 6.6 `review-document.prompt.ts`

```
taskName:        "reviewDocument"
Arquivo:         src/prompts/review-document.prompt.ts
Chamado por:     TUI (document review mode) ou CLI: logos review --doc <id>
Quando:          Após documento gerado, antes de aceitar como canônico
Schema LLM:      DocumentPatchResult
schemaName:      "document_patch"
Temperatura:     0
MaxTokens:       4096
```

**Input type:**

```ts
interface ReviewDocumentInput {
  documentId: string;
  title: string;
  currentMarkdown: string;
  schema: DocumentDescriptor;
  diagnostics: {
    severity: string;
    message: string;
    section?: string;
  }[];
  canonicalAnswers: {
    id: string;
    finalAnswer: string;
    confidence: string;
  }[];
}
```

**System instruction:**

```txt
You are a document reviewer in a structured documentation system called LOGOS.

Your task: review a generated document draft and propose minimal, actionable patches.

Rules:
- Review for: schema compliance, completeness, clarity, consistency with source answers.
- Each patch must be SPECIFIC: identify the exact section, show original and proposed text.
- Type: "addition" (new content), "modification" (changed content), "deletion" (remove),
  "restructure" (reorder or reorganize).
- DO NOT rewrite the entire document. Propose only targeted improvements.
- If the document is acceptable as-is, return an empty patches array.
- Confidence on each patch: "high" = clear improvement needed, "medium" = suggestion,
  "low" = optional stylistic change.
- Consider the existing diagnostics when proposing patches.
- Output language must match the document's language.
```

**Output JSON Schema:** `DocumentPatchResult` (ver `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md`, Seção 7.5)

**Invariantes específicos:**

```txt
- NUNCA propor um patch que remova conteúdo referenciado por sourceCanonicalAnswerIds
  sem explicar por que o conteúdo de origem é inválido.
- Patches "deletion" só devem ser propostos para conteúdo genuinamente incorreto
  ou duplicado, não para conteúdo que o revisor "discorda".
- rationale DEVE explicar POR QUE a mudança é necessária.
```

---

### 6.7 `compile-executive.prompt.ts`

```
taskName:        "compileExecutivePlanDraft"
Arquivo:         src/prompts/compile-executive.prompt.ts
Chamado por:     CLI: logos compile executive
Quando:          Após documentos canônicos estarem completos e validados
Schema LLM:      ExecutivePlan
schemaName:      "executive_plan"
Temperatura:     0
MaxTokens:       16384
```

**Input type:**

```ts
interface CompileExecutiveInput {
  projectName: string;
  projectPurpose: string;
  docs: {
    path: string;
    phaseId: string;
    title: string;
    content: string;
    diagnostics: { severity: string; message: string }[];
  }[];
  decisions: {
    id: string;
    type: string;
    decision: string;
    rationale: string;
  }[];
  risks: string[];
}
```

**System instruction:**

```txt
You are an executive compiler in a structured documentation system called LOGOS.

Your task: compile canonical documentation into a portable Executive Plan
(roadmap → milestones → initiatives → execution items).

Rules:
- Derive the roadmap structure from the phases defined in the project.
- Each phase becomes at most one milestone (unless the phase is large enough
  to warrant multiple).
- Each milestone contains initiatives derived from the canonical documents
  in that phase.
- Each initiative contains execution items of appropriate types:
  - "task": concrete action
  - "decision": decision to be made
  - "question": question to be answered
  - "risk": risk to monitor
  - "review": review needed
  - "agent_prompt": prompt for external agent
  - "doc_update": documentation update needed
  - "spike": technical investigation
  - "artifact": artifact to produce
- Priority: "critical" (blocks everything), "high" (MVP), "medium" (post-MVP),
  "low" (nice to have).
- Estimated effort: "S" (<1 day), "M" (1-3 days), "L" (1-2 weeks), "XL" (>2 weeks).
- Every execution item must reference sourceCanonicalAnswerIds and sourceMessageIds
  for traceability.
- Dependencies: list IDs of execution items that block this one.
- Diagnostics: report any issues found during compilation (missing docs,
  inconsistent decisions, unaddressed risks).
- Output language must match the documentation's language.
```

**Output JSON Schema:** `ExecutivePlan` (ver `LOGOS_SCHEMA_AND_CONTRACTS_SPEC.md`, Seção 9.1)

**Invariantes específicos:**

```txt
- NUNCA criar execution items que não tenham origem em documentos canônicos.
- NUNCA criar milestones para fases que não existem no projeto.
- Iniciativas devem referenciar sourcePhaseId e sourceDocumentIds.
- O campo diagnostics DEVE listar documentos com erros de schema ou lacunas
  que impedem a compilação completa.
```

---

## 7. Exemplos Completos de Fluxo

### 7.1 Fluxo: Pergunta → Resposta → Avaliação → Síntese

```txt
1. Usuário responde pergunta "Qual é a tese central?"
   → Mensagem persistida em transcript.jsonl (msg_001)

2. Core chama assessAnswer(config, { question, requiredSignals, userMessages, ... })
   → Prompt builder monta system + user messages
   → generateStructuredOutput(config, { schemaName: "answer_assessment", ... })
   → Retorna AnswerAssessment { status: "needs_complement", missingSignals: ["target_outcome"], ... }

3. Core transita para ASKING_FOLLOW_UP
   → Agente faz followUpQuestion ao usuário

4. Usuário responde follow-up
   → Mensagem persistida em transcript.jsonl (msg_002)

5. Core chama assessAnswer novamente (agora com followUpCount: 1)
   → Retorna AnswerAssessment { status: "sufficient", confidence: "high", ... }

6. Core transita para SYNTHESIZING_FINAL_ANSWER
   → Chama synthesizeCanonicalAnswer(config, { question, userMessages, assessment, ... })
   → generateStructuredOutput(config, { schemaName: "canonical_answer_draft", ... })
   → Retorna CanonicalAnswerDraft { finalAnswer: "...", ... }

7. Core transita para FINALIZING_ANSWER
   → Mostra rascunho para usuário
   → Usuário aceita

8. Core transita para RECORDING_CANONICAL_ANSWER
   → Persiste CanonicalAnswerRecord em canonical-answers.json
   → sourceMessageIds: ["msg_001", "msg_002"]
```

### 7.2 Fluxo: Geração de Documento

```txt
1. Entrevista concluída para o documento 01-thesis
   → 5 CanonicalAnswerRecords em canonical-answers.json

2. Core chama getGenerationReadiness()
   → Retorna GenerationReadiness { ready: true, mode: "strict" }

3. Usuário solicita geração

4. Core chama generateDocumentDraft(config, { canonicalAnswers, template, ... })
   → generateStructuredOutput(config, { schemaName: "document_draft", ... })
   → Retorna GeneratedDocumentDraft { markdown: "...", sections: [...], ... }

5. Core valida:
   → parseMarkdown(draft.markdown)
   → validateDocument(sections, documentSchema)
   → Se válido: persiste em generated-drafts/01-thesis.draft-001.md

6. Usuário revisa na TUI → solicita review

7. Core chama reviewDocument(config, { currentMarkdown, diagnostics, ... })
   → generateStructuredOutput(config, { schemaName: "document_patch", ... })
   → Retorna DocumentPatchResult { patches: [{ type: "modification", ... }] }

8. TUI mostra diff → Usuário aceita patches

9. Core aplica patches → atomic write em docs/01-foundation/01-thesis.md
   → Documento agora é CANÔNICO
```

---

## 8. Regras de Teste e Snapshot

### 8.1 Testes de prompt builder

```txt
Para cada prompt builder (assess-answer, synthesize-canonical-answer, etc.):

1. Teste de snapshot de mensagens:
   - Dado um input fixture, verificar que buildMessages() retorna
     o array de LlmMessage esperado (snapshot em arquivo).
   - O snapshot DEVE conter system prompt e user messages completos.
   - Se o system prompt mudar, o snapshot QUEBRA — isso é intencional
     (mudanças de prompt devem ser revisadas).

2. Teste de schema:
   - jsonSchema gerado é JSON Schema válido (ajv compile não lança).
   - jsonSchema tem additionalProperties: false.
   - schemaName segue /^[a-zA-Z0-9_-]{1,64}$/.

3. Teste de contrato (mock LLM):
   - Mock generateStructuredOutput para retornar fixture.
   - Chamar o prompt builder com input controlado.
   - Assert que o resultado é processado corretamente.
```

### 8.2 Snapshot de system prompts

```txt
tests/prompts/__snapshots__/
├── assess-answer.system.txt
├── synthesize-canonical-answer.system.txt
├── detect-conflict.system.txt
├── resolve-conflict.system.txt
├── generate-document.system.txt
├── review-document.system.txt
└── compile-executive.system.txt
```

Cada arquivo contém o system prompt exato. O teste de snapshot compara
o system prompt gerado com o arquivo. Mudanças no system prompt exigem
atualização consciente do snapshot.

### 8.3 Testes de invariante

```txt
Para cada prompt, testar que:
- O output NUNCA contém texto fora do JSON (se structured output)
- O output referencia sourceMessageIds quando aplicável
- O output declara missingSignals quando status não é "sufficient"
- O output não inventa fatos não presentes no input
```

---

## 9. Versionamento

### 9.1 Versão do prompt

Cada prompt builder deve exportar uma constante de versão:

```ts
export const ASSESS_ANSWER_PROMPT_VERSION = "0.1.0";
```

Mudanças no system prompt que alterem o comportamento semântico exigem bump de versão:

- **Patch** (0.1.x): correção de typo, clarificação menor
- **Minor** (0.x.0): adição de campo opcional ao output schema, nova instrução não-obrigatória
- **Major** (x.0.0): mudança no output schema (campo removido ou tipo alterado), mudança de invariante

### 9.2 Registro de versão no output

O output de cada prompt deve incluir a versão do prompt usado:

```ts
// No AnswerAssessment:
{ status: "...", ..., _promptVersion: "0.1.0" }

// No CanonicalAnswerDraft:
{ finalAnswer: "...", ..., _promptVersion: "0.1.0" }
```

Isso permite auditoria: "esta resposta foi avaliada com a versão X do prompt de avaliação".

---

## 10. Critérios de Aceitação

Uma implementação LOGOS satisfaz esta spec quando:

1. ✅ Os 7 prompt builders existem em `src/prompts/` com os nomes especificados.
2. ✅ Cada prompt builder chama `generateStructuredOutput()` com `jsonSchema`, `schemaName`, `strict: true` e `schema` Zod.
3. ✅ System prompts são determinísticos e imutáveis por chamada (snapshot test).
4. ✅ Nenhum prompt builder acessa filesystem, aplica transição de estado ou modifica estado global.
5. ✅ Todo output inclui `sourceMessageIds` ou `sourceCanonicalAnswerIds` quando referencia conteúdo de origem.
6. ✅ `missingSignals`, `assumptions`, `hypotheses` e `unresolvedQuestions` são explicitados, nunca omitidos.
7. ✅ `agentRefinement.applied` é `true` sempre que o modelo parafraseou ou expandiu conteúdo do usuário.
8. ✅ Snapshot tests cobrem todos os system prompts.
9. ✅ Testes de invariante cobrem: não-invenção de fatos, não-omissão de missingSignals, não-escrita de arquivos.
10. ✅ Cada prompt builder exporta `_PROMPT_VERSION`.
11. ✅ `temperature` e `maxTokens` seguem a tabela da Seção 5.3 da `LOGOS_LLM_INTEGRATION_SPEC.md`.
12. ✅ Nenhum prompt gera documentação final diretamente — apenas rascunhos que passam pelo pipeline de validação e aceitação.

---

## 11. Resumo

```txt
LOGOS Prompt Contracts:

PRINCÍPIO CENTRAL
  Prompts são tarefas semânticas determinísticas, não conversas abertas.

7 PROMPT BUILDERS
  assess-answer               → AnswerAssessment
  synthesize-canonical-answer → CanonicalAnswerDraft
  detect-conflict             → ConflictDetectionResult
  resolve-conflict            → ConflictResolutionResult
  generate-document           → GeneratedDocumentDraft
  review-document             → DocumentPatchResult
  compile-executive           → ExecutivePlan

INVARIANTES UNIVERSAIS (10)
  INV-001  Não inventar fatos
  INV-002  Distinguir user-provided de agent inference
  INV-003  Retornar apenas estrutura (JSON)
  INV-004  Nunca aplicar transição de estado
  INV-005  Nunca salvar arquivo
  INV-006  Preservar sourceMessageIds
  INV-007  Explicitar missingSignals
  INV-008  Explicitar assumptions e hypotheses
  INV-009  Explicitar unresolvedQuestions
  INV-010  Respeitar idioma do conteúdo de entrada

TESTES
  Snapshot de system prompts
  Snapshot de mensagens montadas
  Validação de jsonSchema
  Contrato com mock LLM
  Invariantes (não-invenção, não-omissão)
```
