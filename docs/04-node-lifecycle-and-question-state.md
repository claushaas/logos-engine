# 04 — Node Lifecycle and Question State

## 1. Purpose

This document defines the lifecycle of a node in the LOGOS Engine.

A node is the runtime unit behind what the user may perceive as a question, topic, section, or semantic unit. Nodes are selected through the TUI sidebar and worked through conversation.

---

## 2. Why Node Instead of Question

The internal term should be `node`, not `question`, because the unit of work may be:

```txt
- a question;
- a topic;
- a principle;
- a risk;
- a decision;
- a document section;
- a semantic unit;
- a validation target;
- a requirement.
```

The user-facing language may still say “question” when appropriate.

---

## 3. Node Runtime State

```ts
type NodeRuntimeState = {
  nodeId: string
  lifecycle: NodeLifecycle
  conversation: NodeMessage[]
  canonicalAnswer: CanonicalAnswer | null
  completeness: CompletenessState
  extracted: ExtractedNodeData
  promptState: PromptState
  allowedActions: NodeAction[]
  dependencies: NodeDependencyState
  updatedAt: string
}
```

---

## 4. Lifecycle States

```ts
type NodeLifecycle =
  | "not_started"
  | "active"
  | "answered"
  | "needs_clarification"
  | "needs_refinement"
  | "ready_for_synthesis"
  | "synthesized"
  | "accepted"
  | "deferred"
  | "blocked"
```

---

## 5. State Definitions

### 5.1 not_started

The node has no meaningful conversation yet.

Expected behavior:

```txt
- Agent generates first contextual question.
- Canonical question is used as semantic anchor.
- User can answer, skip, or ask for example.
```

### 5.2 active

The node is currently being worked on.

Expected behavior:

```txt
- User and agent exchange messages.
- Engine extracts semantic data.
- Completeness is evaluated after each turn.
```

### 5.3 answered

The user has provided an answer, but the engine has not yet determined final adequacy.

Expected behavior:

```txt
- Engine evaluates answer.
- Agent may follow up, clarify, refine, or synthesize.
```

### 5.4 needs_clarification

The answer has ambiguity that blocks synthesis.

Expected behavior:

```txt
- Agent states the ambiguity.
- Agent asks one targeted clarification question.
```

### 5.5 needs_refinement

The answer is understandable but too weak, generic, incomplete, or imprecise.

Expected behavior:

```txt
- Agent identifies the weakness.
- Agent asks for a sharper version.
```

### 5.6 ready_for_synthesis

The node has enough information to produce a canonical answer.

Expected behavior:

```txt
- Prompt orchestrator uses synthesis prompt.
- LLM generates canonical answer draft.
```

### 5.7 synthesized

A canonical answer exists but has not been accepted.

Expected behavior:

```txt
- TUI shows canonical answer preview.
- User can accept, edit, regenerate, defer, or reopen.
```

### 5.8 accepted

The canonical answer has been accepted and may be used for document materialization.

Expected behavior:

```txt
- Node is considered valid source material.
- User can reopen if needed.
```

### 5.9 deferred

The user intentionally postponed the node.

Expected behavior:

```txt
- Node remains visible in sidebar.
- System can recommend other viable nodes.
```

### 5.10 blocked

The node cannot progress because prerequisite information is missing.

Expected behavior:

```txt
- TUI shows blocker reason.
- System recommends prerequisite node or input.
```

---

## 6. Lifecycle Transitions

Common transitions:

```txt
not_started → active
active → answered
answered → needs_clarification
answered → needs_refinement
answered → ready_for_synthesis
needs_clarification → active
needs_refinement → active
ready_for_synthesis → synthesized
synthesized → accepted
synthesized → active
accepted → active
any non-final state → deferred
blocked → active when blocker resolved
```

---

## 7. Invalid Transitions

Invalid transitions include:

```txt
not_started → accepted
needs_clarification → accepted
needs_refinement → accepted
blocked → accepted
accepted → synthesized without reopening
synthesized → document export without acceptance
```

---

## 8. Allowed Actions by Lifecycle

```txt
not_started:
  - answer
  - skip
  - ask_for_example

active:
  - answer
  - defer
  - mark_as_assumption
  - mark_as_decision

needs_clarification:
  - answer
  - defer
  - open_prerequisite

needs_refinement:
  - answer
  - defer
  - ask_for_example

synthesized:
  - accept
  - edit
  - regenerate
  - defer
  - reopen

accepted:
  - continue_next
  - reopen
  - open_document_preview

blocked:
  - open_prerequisite
  - defer
```

---

## 9. Completion State

Completeness is separate from lifecycle.

```ts
type CompletenessState = {
  complete: boolean
  coverage: Record<string, "missing" | "weak" | "sufficient">
  missing: string[]
  weak: string[]
  blockingIssues: string[]
}
```

A node may have a lifecycle of `answered` but still be incomplete.

---

## 10. Dependency State

```ts
type NodeDependencyState = {
  requiredNodeIds: string[]
  blockedBy: string[]
  unlocks: string[]
}
```

If required dependencies are missing, node selection should open the node as `blocked` or show a dependency warning.

---

## 11. Non-Negotiable Rules

```txt
- Node lifecycle must be explicit.
- Prompt state must derive from lifecycle and completeness.
- Accepted nodes require non-stale canonical answers.
- Deferred nodes are not failures.
- Blocked nodes must explain the blocker.
- The user must be able to reopen accepted nodes.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — State prototypes (Part 3, §3.3–§3.10) with wireframes for each node lifecycle rendered in the TUI, including allowed actions and state transitions.
```
