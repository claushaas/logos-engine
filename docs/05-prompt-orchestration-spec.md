# 05 — Prompt Orchestration Spec

## 1. Purpose

This document defines how the LOGOS Engine selects and assembles prompts for each agent turn.

The agent must not use one generic prompt for all interactions. Its behavior must be governed by the current session mode, active node, node lifecycle, prompt state, completeness status, and allowed actions.

---

## 2. Core Principle

```txt
The state engine determines the situation.
The prompt orchestrator determines the instruction.
The LLM generates the candidate turn.
The state engine validates the result.
```

---

## 3. Prompt Selection Inputs

Prompt selection uses:

```txt
- selected profile;
- active node definition;
- active node lifecycle;
- active node prompt state;
- node coverage topics;
- node completeness;
- node conversation history;
- accepted upstream node answers;
- allowed actions;
- user message;
- global context.
```

---

## 4. Prompt States

```ts
type PromptState =
  | "initial"
  | "follow_up"
  | "clarification"
  | "refinement"
  | "synthesis"
  | "review"
  | "repair"
  | "blocked"
  | "accepted"
```

---

## 5. Prompt State Meaning

### 5.1 initial

Used when the node has not started.

Agent should:

```txt
- ask one opening question;
- use the canonical question as semantic anchor;
- avoid listing all coverage topics;
- be specific to the node context.
```

### 5.2 follow_up

Used when the node has active conversation but needs continuation.

Agent should:

```txt
- respond to latest user input;
- continue toward completeness;
- ask one targeted follow-up when useful.
```

### 5.3 clarification

Used when ambiguity blocks synthesis.

Agent should:

```txt
- name the ambiguity;
- ask one clarifying question;
- avoid expanding scope.
```

### 5.4 refinement

Used when answer is understandable but weak.

Agent should:

```txt
- explain weakness;
- request sharper, more specific, or more actionable answer;
- provide direction without taking over user intent.
```

### 5.5 synthesis

Used when enough information exists to draft canonical answer.

Agent should:

```txt
- generate canonical answer candidate;
- preserve user intent;
- avoid adding unsupported claims;
- surface assumptions separately.
```

### 5.6 review

Used when canonical answer exists and requires user decision.

Agent should:

```txt
- present the draft;
- invite accept/edit/regenerate/defer;
- not ask a new unrelated question.
```

### 5.7 repair

Used when LLM output fails validation or state is inconsistent.

Agent should:

```txt
- regenerate structured output according to schema;
- avoid user-facing apology unless needed;
- preserve prior content.
```

### 5.8 blocked

Used when a node cannot progress.

Agent should:

```txt
- explain blocker;
- identify prerequisite;
- offer deterministic next action.
```

### 5.9 accepted

Used when node is complete and accepted.

Agent should:

```txt
- confirm accepted state;
- recommend next node or document preview;
- avoid reopening content unless user asks.
```

---

## 6. Prompt Registry

Prompts should be registered by scope and prompt state.

```ts
type PromptRegistry = Record<PromptKey, PromptDefinition>

type PromptKey = `${ProfileId}.${NodeType}.${PromptState}`
```

Example:

```txt
startup.foundation.thesis.initial
startup.foundation.thesis.clarification
startup.foundation.thesis.refinement
startup.foundation.thesis.synthesis
startup.foundation.thesis.review
```

Fallbacks are allowed:

```txt
profile-specific prompt
→ phase/document prompt
→ node-type prompt
→ generic prompt-state prompt
```

---

## 7. Prompt Assembly

A prompt request should include:

```ts
type PromptAssemblyInput = {
  systemInstruction: string
  nodeDefinition: NodeDefinition
  nodeRuntimeState: NodeRuntimeState
  conversationContext: NodeMessage[]
  globalContext: GlobalContext
  acceptedDependencies: CanonicalAnswer[]
  outputSchema: unknown
  allowedActions: NodeAction[]
}
```

---

## 8. Context Budget Rules

Prompt context should be assembled in priority order:

```txt
1. Current system instruction.
2. Active node definition.
3. Current lifecycle and prompt state.
4. Latest user message.
5. Recent node conversation.
6. Node conversation summary, if needed.
7. Accepted prerequisite answers.
8. Global project context.
9. Profile metadata.
```

Do not inject the entire project unless needed.

---

## 9. Structured Output Requirement

Every LLM turn should return structured output.

The user-facing message is only one field.

```ts
type AgentTurnOutput = {
  userFacingMessage: string
  proposedLifecycle?: NodeLifecycle
  proposedPromptState?: PromptState
  canonicalAnswerDraft?: CanonicalAnswerDraft
  extracted?: ExtractedNodeData
  completenessEvaluation?: CompletenessState
  suggestedActions?: NodeAction[]
  transitionIntent?: TransitionIntent
}
```

---

## 10. Prompt Safety and Integrity Rules

Prompts must instruct the agent to:

```txt
- not fabricate user decisions;
- not mark content accepted;
- not silently fill unknowns;
- separate facts, assumptions, decisions, risks, and open questions;
- ask at most one primary question per turn;
- generate synthesis only when prompt state allows it;
- preserve unresolved tensions instead of smoothing them away;
- keep the interaction conversational, not form-like.
```

---

## 11. Repair Flow

If LLM output fails validation:

```txt
1. State engine rejects output.
2. Prompt orchestrator creates repair prompt.
3. LLM regenerates structured output.
4. State engine validates again.
5. If still invalid, TUI shows recoverable error.
```

---

## 12. Non-Negotiable Rules

```txt
- Prompt behavior must derive from state.
- No static questionnaire behavior.
- No prompt may bypass allowed actions.
- No prompt may accept content on behalf of the user.
- All agent turns must be schema-valid before state mutation.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — Agent behavior rendered per prompt state in the state prototypes (§3.3–§3.10), showing how prompt states translate to user-visible agent messages.
```
