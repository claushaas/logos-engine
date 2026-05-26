# 02 — Runtime Architecture

## 1. Purpose

This document defines the runtime execution flow of the LOGOS Engine.

It specifies how a user action becomes a state transition, an agent turn, a persisted update, and a TUI render snapshot.

---

## 2. Runtime Thesis

```txt
Every user interaction is processed as an event against deterministic runtime state.
```

The LLM is invoked only inside a controlled runtime pipeline.

---

## 3. Runtime Loop

```txt
TUI Event
  ↓
Application Use Case
  ↓
State Engine Evaluation
  ↓
Prompt Orchestration, if needed
  ↓
LLM Structured Output
  ↓
Validation
  ↓
State Transition
  ↓
Persistence
  ↓
Render Snapshot
  ↓
TUI Render
```

---

## 4. Runtime Actors

```txt
User
TUI Renderer
Application Runtime
State Engine
Prompt Orchestrator
LLM Provider Adapter
Structured Output Validator
Persistence Adapter
Document Materializer
```

---

## 5. Event Classes

```ts
type RuntimeEvent =
  | ProfileEvent
  | NodeEvent
  | ConversationEvent
  | CanonicalAnswerEvent
  | DocumentEvent
  | ExportEvent
  | SettingsEvent
```

---

## 6. Use Case Boundary

Every runtime action should be implemented as a use case.

Examples:

```txt
selectProfile(profileId)
selectNode(nodeId)
submitUserMessage(content)
acceptCanonicalAnswer(nodeId)
editCanonicalAnswer(nodeId, content)
regenerateCanonicalAnswer(nodeId)
deferNode(nodeId, reason)
openDocumentPreview(documentId)
exportOutcome(format)
```

The TUI calls use cases, not low-level modules.

---

## 7. Node Selection Runtime

```txt
User selects node
→ TUI dispatches NODE_SELECTED
→ application validates profile/node relation
→ state engine sets activeNodeId
→ state engine evaluates node lifecycle
→ prompt state is computed
→ allowed actions are computed
→ if node requires an agent message, prompt orchestrator generates it
→ assistant message is appended
→ snapshot is persisted
→ TUI renders node-focused mode
```

---

## 8. User Message Runtime

```txt
User submits message
→ message appended to active node conversation
→ state engine marks node active/answered
→ prompt orchestrator builds state-specific request
→ LLM returns AgentTurnOutput
→ schema validator validates output
→ state engine applies accepted transition
→ canonical draft may be generated
→ events are persisted
→ TUI re-renders active node
```

---

## 9. Canonical Answer Review Runtime

```txt
Node reaches synthesized state
→ canonical answer preview rendered
→ user chooses accept/edit/regenerate/defer
→ state engine validates action
→ accepted answers become document source material
→ document readiness recomputed
```

---

## 10. Document Preview Runtime

```txt
User opens document preview
→ state engine checks document readiness
→ materializer assembles accepted node answers
→ missing/stale source nodes are listed
→ document preview snapshot returned
```

---

## 11. Export Runtime

```txt
User requests export
→ state engine validates export eligibility
→ materializer generates selected output
→ output metadata persisted
→ TUI shows generated artifact path/status
```

---

## 12. Runtime State Snapshot

```ts
type RuntimeSnapshot = {
  mode: SessionMode
  selectedProfileId: string | null
  activeNodeId: string | null
  activeNodeState: NodeRuntimeState | null
  sidebar: SidebarRenderModel
  mainPanel: MainPanelRenderModel
  allowedActions: RuntimeAction[]
  diagnostics: RuntimeDiagnostic[]
}
```

---

## 13. Synchronous vs Asynchronous Work

Initial implementation should keep turn processing synchronous.

Allowed synchronous operations:

```txt
- state evaluation;
- prompt assembly;
- LLM call;
- structured output validation;
- persistence write;
- snapshot generation.
```

Potential future async operations:

```txt
- large HTML artifact generation;
- full project export;
- background document regeneration;
- long-running analysis.
```

For MVP, avoid background complexity unless unavoidable.

---

## 14. Idempotency

Runtime actions that may be retried should include operation IDs.

```ts
type RuntimeCommand = {
  id: string
  type: string
  payload: unknown
  createdAt: string
}
```

Idempotency matters for:

```txt
- LLM retries;
- persistence retries;
- export generation;
- document materialization;
- user action double-submission.
```

---

## 15. Runtime Diagnostics

Diagnostics should be explicit but not noisy.

Examples:

```txt
- invalid activeNodeId repaired;
- canonical answer marked stale;
- LLM output repaired;
- export blocked by missing required node;
- document preview generated with missing sections.
```

---

## 16. Runtime Invariants

```txt
- Every submitted user message must attach to one node when activeNodeId is set.
- Every assistant message must be generated from a known prompt state.
- Every LLM output must validate before state mutation.
- Every accepted node must have non-stale canonical answer.
- Every render must derive from a runtime snapshot.
```
