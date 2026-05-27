# 06 — Agent Turn Contract

## 1. Purpose

This document defines the structured output contract for every LLM-generated turn in the LOGOS Engine.

The agent may speak conversationally, but every turn must also produce structured data so the state engine can validate and apply deterministic transitions.

---

## 2. Core Principle

```txt
The LLM proposes.
The state engine disposes.
```

The LLM never mutates state directly.

---

## 3. Agent Turn Output

```ts
type AgentTurnOutput = {
  userFacingMessage: string

  proposedLifecycle?: NodeLifecycle
  proposedPromptState?: PromptState

  canonicalAnswerDraft?: CanonicalAnswerDraft | null
  completenessEvaluation?: CompletenessState
  extracted?: ExtractedNodeData

  suggestedActions?: NodeAction[]
  transitionIntent?: TransitionIntent | null

  diagnostics?: AgentDiagnostic[]
}
```

---

## 4. User-Facing Message

```ts
type UserFacingMessage = string
```

Rules:

```txt
- Must be appropriate to current prompt state.
- Must ask at most one primary question.
- Must not expose internal schemas.
- Must not claim final acceptance unless state already accepted.
- Must be concise enough for TUI use.
```

---

## 5. Canonical Answer Draft

```ts
type CanonicalAnswerDraft = {
  content: string
  format: "markdown" | "structured"
  generatedAt: string
  generatedFromMessageIds: string[]
  confidence: "low" | "medium" | "high"
}
```

Rules:

```txt
- Must be generated only during synthesis/review-compatible states.
- Must not include unsupported claims.
- Must preserve uncertainty.
- Must reference source message IDs.
```

---

## 6. Extracted Node Data

```ts
type ExtractedNodeData = {
  facts: ExtractedFact[]
  assumptions: ExtractedAssumption[]
  decisions: ExtractedDecision[]
  risks: ExtractedRisk[]
  openQuestions: ExtractedOpenQuestion[]
}
```

Examples:

```ts
type ExtractedFact = {
  content: string
  sourceMessageIds: string[]
}

type ExtractedAssumption = {
  content: string
  confidence: "low" | "medium" | "high"
  sourceMessageIds: string[]
}

type ExtractedDecision = {
  content: string
  explicit: boolean
  sourceMessageIds: string[]
}
```

---

## 7. Completeness Evaluation

```ts
type CompletenessState = {
  complete: boolean
  coverage: Record<string, "missing" | "weak" | "sufficient">
  missing: string[]
  weak: string[]
  blockingIssues: string[]
}
```

Rules:

```txt
- Must evaluate against the node's coverage topics.
- Must distinguish missing from weak.
- Must identify blockers explicitly.
- Must not mark complete if required coverage is missing.
```

---

## 8. Transition Intent

```ts
type TransitionIntent = {
  event:
    | "ASKED_INITIAL"
    | "USER_ANSWER_EVALUATED"
    | "CLARIFICATION_REQUESTED"
    | "REFINEMENT_REQUESTED"
    | "SYNTHESIS_PROPOSED"
    | "REVIEW_REQUESTED"
    | "NODE_BLOCKED"
    | "NODE_READY_FOR_ACCEPTANCE"

  reason: string
}
```

The state engine may accept, reject, or override transition intent.

---

## 9. Suggested Actions

The LLM may suggest actions, but the state engine must filter them.

```ts
type NodeAction =
  | "answer"
  | "accept"
  | "edit"
  | "regenerate"
  | "defer"
  | "reopen"
  | "skip"
  | "continue_next"
  | "mark_as_assumption"
  | "mark_as_decision"
  | "open_prerequisite"
  | "open_document_preview"
```

Rules:

```txt
- Suggested actions must be compatible with lifecycle.
- State engine is final authority.
- TUI renders only state-engine-approved actions.
```

---

## 10. Validation Rules

An agent turn is invalid if:

```txt
- userFacingMessage is empty;
- proposed lifecycle transition is impossible;
- canonical answer is generated in disallowed state;
- accepted state is proposed without user accept action;
- required structured fields are missing;
- completeness contradicts lifecycle;
- suggested actions are impossible for current state.
```

---

## 11. Application Rules

After validation, the state engine applies effects:

```txt
- append assistant message;
- update extracted data;
- update completeness;
- update lifecycle;
- update prompt state;
- store canonical answer draft if present;
- recompute allowed actions;
- recompute document readiness.
```

---

## 12. Non-Negotiable Rules

```txt
- The LLM cannot accept a node.
- The LLM cannot directly export a document.
- The LLM cannot silently skip missing coverage.
- Every canonical draft must be reviewable.
- Every state mutation must go through validation.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — Conversation wireframes showing `AgentTurnOutput` rendered as user-visible agent messages with contextual actions derived from `suggestedActions`.
```
