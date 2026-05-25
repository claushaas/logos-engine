# LOGOS Agent Lifecycle and Answer Traceability Spec

**Status:** Draft 1  
**Scope:** LOGOS Engine / Agent Lifecycle / Interview State Machine / Answer Persistence  
**Audience:** product, engineering, agent-runtime implementation, documentation compiler  
**Canonical purpose:** define how the LOGOS agent conducts documentation interviews, evaluates answers, persists conversation history, synthesizes final answers, and preserves traceability from user input to generated documentation.

---

## 1. Purpose

This specification defines the expected lifecycle of the LOGOS agent during structured documentation interviews.

It covers:

- how the agent initializes a conversation;
- how it prepares the first documentation question;
- how it receives and records user messages;
- how it evaluates whether a response is sufficient;
- how it requests complements when necessary;
- how it advances through the question queue;
- how it reacts when all questions are exhausted;
- how it offers document generation;
- how every message and answer must be persisted;
- how generated documentation must remain traceable to original user input.

The LOGOS agent must not behave as a free-form chat assistant. It must behave as a structured interviewer, semantic evaluator, conflict reconciler, and documentation compiler.

---

## 2. Core Principle

The LOGOS agent operates over documentation questions. Each question exists to gather enough semantic material to produce a specific part of a canonical document.

The central lifecycle is:

```txt
ask
→ receive
→ persist verbatim
→ assess
→ complement or advance
→ synthesize final answer
→ record canonical answer
→ repeat
→ summarize
→ offer generation
→ generate
→ validate
→ review
→ save
```

The agent must never generate canonical documentation directly from unstructured conversation without an intermediate canonical answer layer.

Correct flow:

```txt
verbatim transcript
  ↓
canonical answer records
  ↓
generated document draft
  ↓
validated canonical document
```

Incorrect flow:

```txt
raw chat
  ↓
final documentation
```

---

## 3. Primary Data Layers

The system must persist two distinct interview data layers.

### 3.1 Verbatim Transcript Log

The verbatim transcript log is the complete and faithful record of all messages exchanged during the interview.

It includes:

- all user messages;
- all agent messages;
- agent questions;
- follow-up questions;
- reformulations;
- summaries;
- assessment explanations;
- conflict resolution prompts;
- generation offers;
- user approvals;
- user rejections;
- relevant system events;
- relevant tool calls and tool results, when they affect documentation decisions.

The transcript exists to preserve the origin of every documentation decision.

Requirements:

- every message must be persisted before semantic assessment occurs;
- messages must be saved verbatim;
- the transcript must be append-only;
- no previous transcript message may be rewritten or deleted during normal operation;
- later corrections must create new transcript entries and answer revisions.

### 3.2 Canonical Answer Records

Canonical Answer Records are final, consolidated answers to documentation questions.

A canonical answer is not necessarily a single user message. It may be synthesized from:

- the user’s initial response;
- follow-up clarifications;
- corrections;
- conflict resolutions;
- agent refinements;
- explicit user approvals;
- implicit acceptance under configured policy.

Canonical answers are the direct source material for generated documents.

Requirements:

- every documentation question must have zero or one active canonical answer version;
- canonical answers must reference source transcript message IDs;
- canonical answers must be versioned;
- revisions must preserve previous versions;
- a canonical answer may be final, provisional, hypothesis, skipped, not applicable, or conflicted.

---

## 4. State Machine Overview

The agent lifecycle should be implemented as an explicit state machine.

```txt
SESSION_INITIALIZING
  ↓
CONTEXT_LOADING
  ↓
INTERVIEW_READY
  ↓
ASKING_QUESTION
  ↓
WAITING_FOR_ANSWER
  ↓
TRANSCRIBING_MESSAGE
  ↓
ASSESSING_ANSWER
  ├─ needs complement → ASKING_FOLLOW_UP → WAITING_FOR_ANSWER
  ├─ insufficient     → REFORMULATING_QUESTION → WAITING_FOR_ANSWER
  ├─ conflict         → RECONCILING_CONFLICT → WAITING_FOR_ANSWER
  ├─ user override    → HANDLING_USER_OVERRIDE
  └─ sufficient       → SYNTHESIZING_FINAL_ANSWER
                           ↓
                     FINALIZING_ANSWER
                           ↓
                RECORDING_CANONICAL_ANSWER
                           ↓
                     ADVANCING_QUEUE
                           ↓
          ASKING_QUESTION | INTERVIEW_COMPLETE
                           ↓
                    OFFER_GENERATION
                           ↓
        GENERATING_DOCUMENTS | REVIEWING_ANSWERS | WAITING_USER_DECISION
                           ↓
                   GENERATION_COMPLETE
```

The LLM may assist with semantic assessment and answer synthesis, but the LOGOS Core must govern state transitions.

---

## 5. Lifecycle States

### 5.1 `SESSION_INITIALIZING`

Occurs when the user starts or resumes a LOGOS interview.

Possible entry commands:

```bash
logos
logos interview
logos generate foundation
logos generate --doc 01-thesis
logos resume
```

Responsibilities:

- identify project root;
- identify target phase, document, or project scope;
- detect whether this is a new or resumed interview;
- load local configuration;
- initialize session metadata;
- prepare runtime services.

Output:

```ts
type SessionContext = {
  projectRoot: string;
  projectId: string;
  mode: "interview" | "generate" | "review" | "resume";
  selectedPhaseId?: string;
  selectedDocumentId?: string;
  activeInterviewId?: string;
};
```

---

### 5.2 `CONTEXT_LOADING`

Occurs after session initialization.

Responsibilities:

- load `logos.yml`;
- load `docs.yml`;
- load `phases/*.yml`;
- load existing canonical documents;
- load existing interview state;
- load previous canonical answers;
- load previous transcript entries;
- detect pending questions;
- detect skipped questions;
- detect unresolved conflicts;
- build the interview queue.

Output:

```ts
type InterviewPlan = {
  phaseId: string;
  documentId: string;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  answeredQuestions: CanonicalAnswerRecord[];
  missingRequiredAnswers: string[];
};
```

---

### 5.3 `INTERVIEW_READY`

Occurs after context is loaded.

Responsibilities:

- determine whether to start, resume, review, or offer generation;
- prepare the first or current active question;
- briefly explain the flow to the user;
- ask exactly one question.

If the interview is new, the agent should explain:

```txt
Vou fazer uma pergunta por vez. Depois de cada resposta, vou avaliar se ela é suficiente para o documento ou se preciso pedir um complemento específico.
```

If the interview is resumed, the agent should indicate where it stopped:

```txt
Retomando a entrevista em 01-foundation / 01-thesis.md.
A próxima pergunta pendente é a pergunta 3/5.
```

---

### 5.4 `ASKING_QUESTION`

Occurs whenever the agent presents an active documentation question.

Question message must include:

- phase or document context;
- current question number;
- total question count;
- question text;
- short orientation;
- optional example or response expectation.

Recommended format:

```txt
Pergunta 2/7 — Problema

Que dor, fricção ou limitação este projeto existe para enfrentar?

Responda em termos concretos: como isso aparece na vida real, para quem aparece e por que as alternativas atuais são insuficientes.
```

Rules:

- ask one active question at a time;
- do not bundle unrelated questions;
- do not generate final documentation during the question loop;
- keep the question focused on the current document or section.

---

### 5.5 `WAITING_FOR_ANSWER`

Occurs after a question has been asked.

Possible user inputs:

- direct answer;
- partial answer;
- vague answer;
- very long answer;
- contradiction;
- request to skip;
- request to pause;
- request to go back;
- request to generate now;
- meta-question;
- scope change.

The system must not assess the user message before persisting it verbatim.

---

### 5.6 `TRANSCRIBING_MESSAGE`

Occurs immediately after receiving user input.

Responsibilities:

- persist the user message verbatim;
- assign message ID;
- associate message with current interview, phase, document, and question;
- record state before assessment.

This state is mandatory.

Correct order:

```txt
receive user message
→ append to transcript
→ assess message
```

Incorrect order:

```txt
receive user message
→ assess message
→ save summary only
```

---

### 5.7 `ASSESSING_ANSWER`

Occurs after the user message has been persisted.

Responsibilities:

- evaluate whether the answer satisfies the active question;
- extract facts, decisions, assumptions, hypotheses, constraints, and open questions;
- detect missing required signals;
- detect conflicts with previous answers;
- classify answer confidence;
- decide whether to advance, complement, reformulate, reconcile, or handle override.

Assessment result:

```ts
type AnswerAssessment =
  | {
      status: "sufficient";
      confidence: "low" | "medium" | "high";
      extractedFacts: string[];
      extractedDecisions: string[];
      extractedAssumptions: string[];
      missingSignals: [];
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
      conflicts: ConflictRecord[];
      reconciliationQuestion: string;
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
    };
```

---

### 5.8 `ASKING_FOLLOW_UP`

Occurs when the answer is useful but incomplete.

The follow-up must be specific and limited to missing signals.

Example:

```txt
Isso já define a direção, mas ainda falta a tensão central.

Complemento:
O que hoje impede essas pessoas de transformar ideias em documentação clara: excesso de informação, falta de método, dificuldade de decisão, dispersão, medo de executar, ou outra coisa?
```

Rules:

- do not repeat the original question unless needed;
- ask only for missing information;
- combine the original answer and complement during reassessment;
- limit follow-up attempts per question.

Recommended limit:

```txt
maxFollowUps = 2
```

After the limit is reached, offer options:

```txt
Ainda não temos material suficiente para fechar esta resposta.

Escolha uma opção:
1. responder com mais detalhe;
2. registrar como hipótese provisória;
3. pular por enquanto;
4. voltar depois.
```

---

### 5.9 `REFORMULATING_QUESTION`

Occurs when the user answer is off-topic or unusable.

Example:

```txt
Isso descreve uma qualidade desejada do produto, mas ainda não descreve o problema que ele resolve.

Vou reformular:
Que situação concreta faz alguém precisar deste projeto antes de existir qualquer solução visual ou técnica?
```

Rules:

- explain briefly why the answer does not satisfy the question;
- reformulate with more concrete guidance;
- preserve the original transcript entry;
- do not mark the question as answered.

---

### 5.10 `RECONCILING_CONFLICT`

Occurs when a new answer contradicts a previous answer or decision.

Example:

```txt
Há uma tensão com uma resposta anterior.

Antes você indicou que o projeto seria open source e gratuito. Agora apareceu um modelo de assinatura SaaS fechada.

Qual das interpretações está correta?

1. O core é open source, mas haverá hosted SaaS pago.
2. O produto deixou de ser open source.
3. A assinatura se aplica apenas a serviços complementares.
4. Ainda é uma decisão em aberto.
```

Rules:

- do not hide contradictions;
- do not resolve critical contradictions without user confirmation;
- conflict resolution must be persisted as a documentation decision;
- affected answers must be revised or marked as open.

---

### 5.11 `SYNTHESIZING_FINAL_ANSWER`

Occurs when the answer is sufficient or sufficient after complement/reconciliation.

Responsibilities:

- synthesize a clear final answer to the documentation question;
- combine the relevant user messages and clarifications;
- preserve fidelity to user intent;
- distinguish fact, decision, hypothesis, assumption, and inference;
- record the source message IDs used;
- produce a canonical answer draft.

Example:

Original user answer:

```txt
Quero criar um sistema que ajude pessoas a tirar ideias da cabeça.
```

Complement:

```txt
O problema é que muita gente trava porque tem tudo misturado mentalmente e não consegue transformar isso em plano claro.
```

Canonical synthesized answer:

```txt
O projeto existe para ajudar pessoas a transformar ideias difusas, acumuladas mentalmente, em documentação clara, estruturada e acionável. A convicção central é que muitos projetos não falham por falta de ideias, mas por falta de um processo que externalize, organize e converta essas ideias em decisões e próximos passos confiáveis.
```

---

### 5.12 `FINALIZING_ANSWER`

Occurs after a canonical answer draft is synthesized.

Responsibilities:

- decide whether the answer can be saved automatically;
- decide whether explicit user approval is required;
- mark low-confidence answers as hypotheses when appropriate;
- require approval for critical decisions;
- prepare the answer for canonical persistence.

Recommended policy:

```txt
If confidence = high:
  save final answer and advance.

If confidence = medium:
  save final answer with agentRefinement.applied = true.

If confidence = low:
  ask whether to register as hypothesis.

If conflict was involved:
  require explicit user approval.

If document is foundational or decision-critical:
  optionally require explicit confirmation before advancing.
```

Possible confirmation message:

```txt
Vou registrar esta resposta final para a pergunta:

“O projeto existe para ajudar pessoas a transformar ideias difusas... ”

Está correto?
1. Sim, avançar
2. Ajustar
3. Responder novamente
```

---

### 5.13 `RECORDING_CANONICAL_ANSWER`

Occurs after the final answer has been accepted under the configured policy.

Responsibilities:

- persist canonical answer record;
- link source transcript messages;
- store extracted semantic fields;
- store confidence;
- store revision version;
- mark active question as answered;
- record documentation decision.

---

### 5.14 `ADVANCING_QUEUE`

Occurs after a canonical answer is recorded or a question is explicitly skipped.

Responsibilities:

- update question state;
- recalculate document completeness;
- identify next question;
- detect whether required questions remain;
- transition to `ASKING_QUESTION` or `INTERVIEW_COMPLETE`.

---

### 5.15 `INTERVIEW_COMPLETE`

Occurs when all required questions in the active scope have been answered, skipped as not applicable, or accepted as provisional.

Responsibilities:

- summarize captured answers;
- list weak points;
- list unresolved questions;
- list skipped required questions, if any;
- calculate generation readiness;
- offer next action.

Example:

```txt
Concluímos as perguntas necessárias para este documento.

Resumo capturado:
- Tese central: ...
- Problema principal: ...
- Público primário: ...
- Tensão central: ...

Ainda há 1 ponto fraco:
- A definição de sucesso está pouco mensurável.

Posso agora:
1. gerar o documento completo;
2. revisar respostas antes de gerar;
3. preencher lacunas primeiro;
4. salvar como rascunho e parar.
```

The agent must offer generation. It must not generate automatically unless the active mode explicitly allows auto-generation.

---

### 5.16 `OFFER_GENERATION`

Occurs after interview completion or when the user asks to generate early.

Responsibilities:

- show generation readiness;
- explain blocking gaps;
- offer generation modes;
- ask for user decision.

Generation modes:

```txt
strict_generation
  generate only if minimum required answers are sufficient.

partial_generation
  generate with explicit gaps.

hypothesis_generation
  generate while marking unresolved assumptions and hypotheses.

skeleton_generation
  generate structure with placeholders.
```

---

### 5.17 `GENERATING_DOCUMENTS`

Occurs after the user requests generation.

Responsibilities:

- load canonical answers;
- load document template;
- load document schema;
- generate draft;
- preserve traceability;
- validate draft;
- produce preview or diff;
- request acceptance before saving canonical document.

Generated document draft must reference:

- canonical answer IDs;
- source transcript message IDs;
- assumptions used;
- unresolved questions;
- agent inferences.

---

## 6. User Override Flows

### 6.1 Skip Question

User input examples:

```txt
pula essa
não sei ainda
vamos deixar para depois
```

Behavior:

- mark question as skipped;
- do not fabricate answer;
- classify skipped reason;
- continue if allowed;
- surface skipped required questions before generation.

```ts
type QuestionState = {
  status: "skipped";
  reason?: "unknown" | "deferred" | "not_applicable" | "user_choice";
};
```

---

### 6.2 Go Back

User input examples:

```txt
volta na anterior
quero mudar a resposta da tese
a resposta anterior ficou errada
```

Behavior:

- locate target question;
- show current canonical answer;
- collect revised answer;
- persist revision;
- preserve previous version;
- recalculate dependencies.

```ts
type AnswerRevision = {
  previousAnswerId: string;
  newAnswerId: string;
  revisionReason?: string;
  changedByUser: true;
  createdAt: string;
};
```

---

### 6.3 Pause Interview

User input examples:

```txt
pausar
continuamos depois
salva e sai
```

Behavior:

- persist state;
- mark interview as paused;
- keep current question pending;
- allow later resume.

---

### 6.4 Cancel Interview

User input examples:

```txt
cancelar
abandona essa entrevista
```

Behavior:

- ask whether to save partial answers;
- persist or discard according to user choice;
- never delete transcript silently;
- return to overview.

---

### 6.5 Generate Early

User input examples:

```txt
gera agora
gera com o que temos
vamos fazer a documentação já
```

Behavior:

- calculate generation readiness;
- explain missing required answers;
- offer partial or strict generation;
- require confirmation before generating.

---

### 6.6 Scope Change

User input examples:

```txt
na verdade não é mais para negócios, é para projetos pessoais
quero mudar de app mobile para CLI
decidi que não será open source
```

Behavior:

- detect impact scope;
- classify affected questions and documents;
- ask user how to apply the change;
- revise previous answers when needed;
- record scope change as documentation decision.

```ts
type ScopeChange = {
  impact: "local" | "document" | "phase" | "project";
  affectedQuestions: string[];
  affectedDocuments: string[];
  requiresReassessment: boolean;
};
```

---

## 7. Data Models

### 7.1 Transcript Message

```ts
type TranscriptMessage = {
  id: string;

  interviewRunId: string;
  projectId: string;
  phaseId?: string;
  documentId?: string;
  questionId?: string;

  role: "user" | "agent" | "system" | "tool";

  content: string;

  contentFormat: "plain_text" | "markdown" | "json" | "tool_result";

  source:
    | "user_input"
    | "agent_question"
    | "agent_follow_up"
    | "agent_assessment"
    | "agent_summary"
    | "agent_generation_offer"
    | "tool_call"
    | "tool_result"
    | "system_event";

  createdAt: string;

  metadata?: {
    stateBefore?: InterviewStateName;
    stateAfter?: InterviewStateName;
    relatedTransitionId?: string;
    toolName?: string;
    modelProvider?: string;
    modelId?: string;
    tokenUsage?: {
      input?: number;
      output?: number;
      total?: number;
    };
  };
};
```

---

### 7.2 Canonical Answer Record

```ts
type CanonicalAnswerRecord = {
  id: string;

  interviewRunId: string;
  projectId: string;
  phaseId: string;
  documentId: string;
  questionId: string;

  questionText: string;

  finalAnswer: string;

  answerStatus:
    | "final"
    | "provisional"
    | "hypothesis"
    | "skipped"
    | "not_applicable"
    | "conflicted";

  confidence: "low" | "medium" | "high";

  sourceMessageIds: string[];

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
    status: "explicit" | "implicit" | "not_requested" | "rejected";
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

---

### 7.3 Interview Question

```ts
type InterviewQuestion = {
  id: string;
  phaseId: string;
  documentId: string;
  sectionId?: string;

  order: number;
  title: string;
  question: string;
  helpText?: string;

  required: boolean;

  sufficiencyCriteria: {
    requiredSignals: string[];
    optionalSignals?: string[];
    insufficientPatterns?: string[];
  };

  followUpPolicy: {
    maxFollowUps: number;
    allowSkip: boolean;
    allowHypothesis: boolean;
  };

  generationMapping: {
    targetSections: string[];
    extractionHints: string[];
  };
};
```

---

### 7.4 Interview Queue

```ts
type InterviewQueue = {
  scope: "document" | "phase" | "project";
  phaseId: string;
  documentId?: string;
  questions: InterviewQuestion[];
  currentIndex: number;
  completedQuestionIds: string[];
  skippedQuestionIds: string[];
  blockedQuestionIds: string[];
};
```

---

### 7.5 Interview Run State

```ts
type InterviewRunState = {
  id: string;
  projectId: string;
  phaseId: string;
  documentId: string;

  status:
    | "active"
    | "paused"
    | "completed"
    | "generated"
    | "cancelled";

  currentQuestionId?: string;
  questionStates: Record<string, QuestionState>;
  answers: CanonicalAnswerRecord[];
  conflicts: ConflictRecord[];
  generatedDrafts: GeneratedDocumentDraft[];
  createdAt: string;
  updatedAt: string;
};
```

---

### 7.6 Documentation Decision

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

---

### 7.7 Generated Document Draft

```ts
type GeneratedDocumentSectionTrace = {
  sectionId: string;
  generatedContent: string;
  sourceCanonicalAnswerIds: string[];
  sourceMessageIds: string[];
  assumptionsUsed: string[];
  agentInferences: string[];
};

type GeneratedDocumentDraft = {
  id: string;
  phaseId: string;
  documentId: string;

  markdown: string;

  sourceCanonicalAnswerIds: string[];
  sourceTranscriptMessageIds: string[];

  sectionTrace: GeneratedDocumentSectionTrace[];

  validation: DocumentValidationResult;

  createdAt: string;
};
```

---

## 8. Persistence Layout

Recommended local structure:

```txt
.logos/
  interviews/
    interview_2026-05-24_135000/
      state.json
      transcript.jsonl
      transcript.md
      canonical-answers.json
      answer-revisions.json
      conflicts.json
      decisions.json
      generation-readiness.json
      generated-drafts/
        01-thesis.draft-001.md
        01-thesis.draft-001.trace.json
```

### 8.1 `transcript.jsonl`

The append-only structured source of truth for conversation history.

### 8.2 `transcript.md`

Human-readable export of the transcript.

### 8.3 `canonical-answers.json`

The structured list of final answers per documentation question.

### 8.4 `decisions.json`

A structured log of documentation decisions and their source message IDs.

### 8.5 `generated-drafts/*.trace.json`

Trace metadata connecting generated document sections to canonical answers and verbatim source messages.

---

## 9. Sufficiency Policy

A response is sufficient only when all of the following are true:

```txt
- it contains the minimum required semantic signals;
- it can be synthesized into a final answer;
- it has identifiable verbatim source messages;
- it has no unresolved conflicts;
- it can be classified with confidence;
- it can be stored as a canonical answer record.
```

Sufficiency statuses:

```txt
sufficient
  The response contains the minimum required signals.

needs_complement
  The response is useful but lacks one or more required signals.

insufficient
  The response does not answer the question in a usable way.

conflict
  The response contradicts previous material.

defer
  The user explicitly does not want to answer now.

not_applicable
  The question does not apply to the project.
```

Confidence levels:

```txt
high
  clear, specific, and directly usable.

medium
  usable but requires agent refinement.

low
  weak, vague, or provisional; should be marked as hypothesis or require confirmation.
```

---

## 10. Traceability Requirements

### 10.1 Canonical Answer Traceability

Every canonical answer must reference:

- source user messages;
- source agent messages when relevant;
- complement messages;
- conflict resolution messages;
- approval messages when explicit approval occurs.

### 10.2 Documentation Traceability

Every generated document must reference:

- canonical answer IDs;
- transcript message IDs;
- unresolved questions;
- assumptions;
- agent inferences;
- validation result.

### 10.3 Section-Level Traceability

Every generated section should reference the canonical answers used to produce it.

If a section is generated without sufficient source material, it must be marked as:

```txt
agent_inference
```

or:

```txt
missing_source
```

In strict mode, `missing_source` blocks canonical saving.

---

## 11. Agent Behavior Rules

The agent must:

- ask one question at a time;
- persist every message before assessment;
- evaluate whether the answer is sufficient;
- ask for specific complements when needed;
- explicitly surface contradictions;
- synthesize final answers per question;
- distinguish user-provided content from agent inference;
- preserve traceability;
- offer generation only after readiness evaluation;
- generate documents from canonical answers, not raw chat;
- request approval before critical decisions.

The agent must not:

- silently skip missing signals;
- accept vague answers as complete;
- generate documentation before enough material exists unless partial generation is explicitly chosen;
- overwrite canonical answers without revision records;
- edit transcript entries;
- hide unresolved assumptions inside polished prose;
- treat its own inference as user decision.

---

## 12. LOGOS Core vs Agent Responsibilities

### 12.1 LOGOS Core Responsibilities

The LOGOS Core governs:

- interview state;
- question queue;
- persistence;
- schema validation;
- completeness calculation;
- transition rules;
- generation readiness;
- traceability checks;
- canonical answer versioning.

### 12.2 Agent Runtime Responsibilities

The agent assists with:

- semantic assessment;
- answer synthesis;
- follow-up question generation;
- conflict detection;
- draft generation;
- document review;
- patch proposals.

### 12.3 Critical Rule

The agent may recommend transitions, but LOGOS Core applies them.

```txt
Agent says: sufficient
Core validates: criteria and traceability are satisfied
Then: advance
```

---

## 13. Required Package

The architecture should include a dedicated package:

```txt
packages/logos-interview/
```

Recommended structure:

```txt
packages/logos-interview/
  src/
    transcript/
      TranscriptStore.ts
      appendTranscriptMessage.ts
      exportTranscriptMarkdown.ts

    answers/
      CanonicalAnswerRecord.ts
      synthesizeFinalAnswer.ts
      finalizeAnswer.ts
      reviseAnswer.ts

    decisions/
      DocumentationDecision.ts
      recordDecision.ts
      traceDecisionSources.ts

    state/
      InterviewState.ts
      transitionInterviewState.ts
      persistInterviewState.ts

    trace/
      buildAnswerTrace.ts
      buildDocumentTrace.ts
      verifyTraceCompleteness.ts

    queue/
      InterviewQueue.ts
      advanceQueue.ts
      getCurrentQuestion.ts

    assessment/
      assessAnswer.ts
      detectMissingSignals.ts
      detectConflicts.ts
      calculateSufficiency.ts
```

---

## 14. TUI Requirements

The TUI must expose interview state clearly.

It should show:

- current phase;
- current document;
- current question;
- question progress;
- answer status;
- missing signals;
- detected conflicts;
- generation readiness;
- current canonical answer draft when applicable.

### 14.1 Active Question Mockup

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

### 14.2 Partial Answer Mockup

```txt
╭─ Answer Assessment ───────────────────────────────────────────╮
│ Status: needs complement                                      │
│ Captured: project direction                                   │
│ Missing: central tension                                      │
├───────────────────────────────────────────────────────────────┤
│ Complemento necessário                                       │
│ O que hoje impede o usuário de resolver isso bem com as        │
│ alternativas existentes?                                      │
╰───────────────────────────────────────────────────────────────╯
```

### 14.3 Final Answer Confirmation Mockup

```txt
╭─ Canonical Answer Draft ──────────────────────────────────────╮
│ Question: 1 / 5                                               │
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

### 14.4 Interview Complete Mockup

```txt
╭─ Interview Complete ──────────────────────────────────────────╮
│ Document: 01-thesis.md                                        │
│ Required answers: complete                                    │
│ Weak points: 1                                                │
├───────────────────────────────────────────────────────────────┤
│ Resumo capturado                                              │
│ - Tese central: ...                                           │
│ - Tensão: ...                                                 │
│ - Promessa essencial: ...                                     │
│                                                               │
│ Próxima ação                                                  │
│ 1. Generate document                                          │
│ 2. Review answers                                             │
│ 3. Fill weak points                                           │
│ 4. Save and stop                                              │
╰───────────────────────────────────────────────────────────────╯
```

---

## 15. Integrity Rules

### Rule 1 — Verbatim First

Every user message must be persisted verbatim before any semantic assessment.

### Rule 2 — Transcript Is Append-Only

Transcript entries must not be edited or deleted during normal operation.

### Rule 3 — Answers Are Versioned

Canonical answer revisions create new records and preserve previous versions.

### Rule 4 — Documents Derive From Canonical Answers

Documents must be generated from canonical answers, not directly from raw chat.

### Rule 5 — Every Documentation Decision Must Be Traceable

Every relevant decision must reference transcript message IDs and/or canonical answer IDs.

### Rule 6 — Critical Decisions Require Confirmation

Critical decisions include:

- scope changes;
- conflict resolutions;
- target audience definition;
- business model definition;
- anti-scope boundaries;
- generation acceptance;
- canonical document acceptance.

### Rule 7 — Agent Inference Must Be Labeled

Agent-generated interpretation must not be presented as user-provided fact.

### Rule 8 — Gaps Must Survive

Unresolved gaps must appear in:

- diagnostics;
- generation readiness;
- generated draft trace;
- review panel.

---

## 16. Minimal MVP Acceptance Criteria

The first implementation of this lifecycle is acceptable only if it can:

1. start a document interview;
2. ask one question at a time;
3. persist all user and agent messages verbatim;
4. assess answer sufficiency;
5. request complement when needed;
6. synthesize final answer per question;
7. persist canonical answer records with source message IDs;
8. advance through the question queue;
9. detect interview completion;
10. offer document generation;
11. generate a draft from canonical answers;
12. validate traceability before saving;
13. preserve transcript and answer revisions across resume.

---

## 17. Summary

The LOGOS agent lifecycle must be treated as a deterministic interview system supported by an LLM, not as a free-form chat.

The key architectural distinction is:

```txt
Transcript Log
  complete verbatim origin

Canonical Answer Records
  refined final answers per question

Generated Documentation
  artifact derived from canonical answers
```

This gives LOGOS a semantic chain of custody:

```txt
message
→ answer
→ decision
→ document
→ executive output
```

Without this chain, generated documentation may look coherent but cannot be audited. With this chain, every documentation decision can be traced back to the exact user and agent messages that produced it.
