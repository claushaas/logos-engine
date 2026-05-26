# 02 — State Engine Canonical Spec

## 1. Purpose

This document defines the deterministic state engine for the LOGOS Engine.

The state engine governs the conversational TUI. It decides what is active, which node is being worked on, which actions are allowed, which prompt state must be used, and when canonical outputs can be generated.

It does not generate prose. It does not decide content quality through intuition. It applies explicit state rules, transition guards, and completeness criteria.

---

## 2. Core Principle

```txt
The user experiences a conversation.
The system operates a deterministic state machine.
```

The TUI renders the state.
The state engine owns the state.
The prompt orchestrator selects the agent behavior.
The LLM produces candidate conversational and structured outputs.
The state engine validates and applies transitions.

---

## 3. State Engine Responsibilities

The state engine is responsible for:

```txt
- Tracking the active node.
- Tracking the selected profile.
- Tracking session mode.
- Tracking each node lifecycle.
- Tracking prompt state per node.
- Tracking allowed actions.
- Validating transitions.
- Evaluating completeness.
- Marking canonical answers as stale.
- Determining document readiness.
- Determining export readiness.
- Preserving node-specific conversations.
```

The state engine is not responsible for:

```txt
- Rendering UI directly.
- Writing user-facing prose.
- Inventing document content.
- Persisting data by itself.
- Calling the LLM by itself.
```

---

## 4. Global Runtime State

```ts
type LogosRuntimeState = {
  sessionId: string
  selectedProfileId: string | null
  activeNodeId: string | null
  mode: SessionMode

  nodeStates: Record<NodeId, NodeRuntimeState>
  documentStates: Record<DocumentId, DocumentRuntimeState>
  exportState: ExportRuntimeState

  globalContext: GlobalContext
  lastActiveNodeId: string | null
  updatedAt: string
}
```

---

## 5. Session Modes

```ts
type SessionMode =
  | "idle"
  | "profile_selection"
  | "structure_overview"
  | "node_focus"
  | "document_preview"
  | "export"
  | "settings"
  | "error"
```

## 5.1 Idle

Condition:

```ts
activeNodeId === null && selectedProfileId === null
```

Purpose:

```txt
The session has not started work on a profile or node.
```

Allowed actions:

```txt
- select_profile
- open_settings
- import_context
```

## 5.2 Structure Overview

Condition:

```ts
activeNodeId === null && selectedProfileId !== null
```

Purpose:

```txt
The user can inspect the selected profile structure and choose where to begin.
```

Allowed actions:

```txt
- select_node
- change_profile
- resume_last_node
- open_settings
- import_context
```

## 5.3 Node Focus

Condition:

```ts
activeNodeId !== null
```

Purpose:

```txt
The user is actively working on one semantic node through conversation.
```

Allowed actions are derived from the active node state.

---

## 6. Active Node Rule

The `activeNodeId` is the primary switch for the TUI.

```txt
activeNodeId === null
→ structural deterministic mode

activeNodeId !== null
→ node-focused conversational mode
```

The state engine must guarantee:

```txt
- An active node belongs to the selected profile.
- The node has a runtime state.
- The node has a schema/profile definition.
- The node has a valid prompt state.
- The TUI can derive render state from it.
```

---

## 7. Node Selection

Selecting a node does not mean answering a static question.

It means:

```txt
1. Set activeNodeId.
2. Load the node runtime state.
3. Evaluate the node lifecycle.
4. Determine prompt state.
5. Determine allowed actions.
6. Generate or render the next appropriate agent intervention.
```

```ts
type SelectNodeEvent = {
  type: "NODE_SELECTED"
  nodeId: NodeId
}
```

Transition:

```txt
structure_overview | node_focus | document_preview
→ node_focus
```

---

## 8. Transition Model

Every transition has:

```ts
type StateTransition = {
  from: string
  to: string
  event: string
  guards: TransitionGuard[]
  effects: TransitionEffect[]
}
```

Transitions must be explicit. The UI must not mutate state directly.

---

## 9. Transition Guards

A guard is a condition that must be true before a transition can occur.

Examples:

```txt
- selectedProfileId is not null
- activeNodeId exists in profile
- node has a canonical answer
- canonical answer is not stale
- required source nodes are accepted
- current action is allowed for node lifecycle
```

---

## 10. Transition Effects

Effects are deterministic state updates.

Examples:

```txt
- set activeNodeId
- set mode
- append message to node conversation
- update node lifecycle
- update prompt state
- generate canonical answer draft
- mark canonical answer stale
- mark node accepted
- recompute document readiness
```

---

## 11. Allowed Actions

Allowed actions must always be computed by the state engine.

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

The TUI may render actions, but must not invent them.

---

## 12. State Engine Output

For every state evaluation, the engine should expose a renderable state snapshot.

```ts
type StateEngineSnapshot = {
  mode: SessionMode
  selectedProfileId: string | null
  activeNodeId: string | null
  activeNodeState: NodeRuntimeState | null
  allowedActions: NodeAction[]
  sidebar: SidebarRenderModel
  mainPanel: MainPanelRenderModel
  diagnostics: StateDiagnostic[]
}
```

---

## 13. Invalid State Handling

The state engine must detect invalid states and repair when safe.

Examples:

```txt
- activeNodeId exists but selectedProfileId is null
- activeNodeId does not exist in selected profile
- node lifecycle is accepted but canonicalAnswer is null
- canonicalAnswer is accepted but stale
- document is exportable but required nodes are missing
```

Repair strategies:

```txt
- clear activeNodeId and enter structure_overview
- mark node as blocked
- mark canonical answer as stale
- recompute document readiness
- surface diagnostic to TUI
```

---

## 14. Non-Negotiable Rules

```txt
- The TUI renders state; it does not own state.
- The LLM proposes outputs; it does not mutate state directly.
- The state engine applies validated transitions.
- Every active node must have isolated conversation state.
- Canonical answers must be distinct from conversation messages.
- Document readiness must derive from accepted node answers.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — State prototypes and flow walkthroughs showing the state engine's session modes, transitions, and allowed actions rendered in the TUI.
```
