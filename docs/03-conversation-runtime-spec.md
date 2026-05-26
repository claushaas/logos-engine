# 03 — Conversation Runtime Spec

## 1. Purpose

This document defines how conversations work inside the LOGOS Engine.

The LOGOS Engine does not run one undifferentiated global chat. It runs node-scoped conversations, each governed by its own lifecycle, prompt state, canonical answer, completeness evaluation, and extracted semantic data.

---

## 2. Core Principle

```txt
The conversation is local to the active node.
The session is global.
The document is materialized later.
```

A user may navigate non-linearly across nodes. Each node preserves its own conversation history.

---

## 3. Conversation Ownership

Each node owns:

```txt
- its user/assistant messages;
- its canonical answer;
- its extracted facts, assumptions, decisions, risks, and open questions;
- its completeness status;
- its prompt state;
- its allowed actions.
```

The global session owns:

```txt
- selected profile;
- active node;
- document states;
- export state;
- global context;
- event log.
```

---

## 4. Node Conversation Model

```ts
type NodeConversation = {
  nodeId: string
  messages: NodeMessage[]
  summary?: string
  lastUserMessageId?: string
  lastAssistantMessageId?: string
}
```

---

## 5. Message Model

```ts
type NodeMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
  metadata?: NodeMessageMetadata
}

type NodeMessageMetadata = {
  promptId?: string
  promptState?: PromptState
  model?: string
  structuredOutputId?: string
  stateBefore?: string
  stateAfter?: string
}
```

System messages are internal and should not normally be rendered as chat messages in the TUI.

---

## 6. Conversation Turn

A conversation turn happens when the user submits input in node-focused mode.

Flow:

```txt
1. User submits message.
2. Message is appended to active node conversation.
3. Prompt orchestrator builds LLM request from node state.
4. LLM returns structured agent turn output.
5. State engine validates output.
6. State engine applies transition effects.
7. Assistant message is appended to node conversation.
8. TUI re-renders from state snapshot.
```

---

## 7. Conversation Is Not Canonical Content

Raw conversation is not the final documentation.

```txt
conversation = exploratory material
canonicalAnswer = clean answer for one node
document = composition of accepted canonical answers
```

The user may say imprecise, contradictory, or exploratory things. The agent and state engine must transform this into structured, reviewable output.

---

## 8. Canonical Answer Generation

A canonical answer may be generated when the node reaches a state that permits synthesis.

Conditions:

```txt
- enough coverage topics are sufficient;
- no blocking ambiguity remains;
- the current prompt state allows synthesis;
- the LLM output validates against the agent turn contract.
```

Canonical answer generation must record source message IDs.

```ts
type CanonicalAnswer = {
  content: string
  format: "markdown" | "structured"
  generatedAt: string
  generatedFromMessageIds: string[]
  confidence: "low" | "medium" | "high"
  accepted: boolean
  stale: boolean
}
```

---

## 9. Staleness Rules

A canonical answer becomes stale when:

```txt
- user adds new relevant information;
- user edits or corrects previous information;
- node is reopened;
- an upstream dependency changes materially;
- extracted decisions contradict accepted content;
- completeness evaluation changes from sufficient to weak/missing.
```

Stale canonical answers must not be used for final export without regeneration or explicit user acceptance.

---

## 10. Conversation Summaries

For long node conversations, the runtime may maintain a node-level summary.

Rules:

```txt
- Summary must not replace raw messages.
- Summary must cite or reference source message IDs internally.
- Summary is used for prompt compression.
- Canonical answer must still record source message IDs.
```

---

## 11. Global Context Injection

The prompt orchestrator may inject global context into a node conversation.

Examples:

```txt
- project name;
- project summary;
- accepted upstream answers;
- selected profile metadata;
- user preferences;
- unresolved global assumptions.
```

But global context must not erase node-local conversation boundaries.

---

## 12. Non-Linear Navigation

When the user switches nodes:

```txt
- current node conversation is preserved;
- current node lifecycle is preserved;
- activeNodeId changes;
- new node state is loaded;
- agent behavior is derived from the new node state.
```

No node should lose data because another node became active.

---

## 13. Conversation Input Rules

Free-text input is allowed only when the current state allows a user response.

Examples where input is usually allowed:

```txt
- not_started
- active
- needs_clarification
- needs_refinement
- review with edit mode
```

Examples where input may be disabled or redirected:

```txt
- blocked without prerequisite selected
- export mode
- accepted state unless reopened
- document preview unless editing is enabled
```

---

## 14. Agent Message Rules

The assistant message must be appropriate to the node state.

It may be:

```txt
- an initial question;
- a clarification request;
- a refinement request;
- a synthesis proposal;
- a review prompt;
- a blocker explanation;
- a next-step recommendation.
```

It must not:

```txt
- dump all questions at once;
- behave like a static questionnaire;
- mutate state directly;
- claim a node is accepted without user or state confirmation;
- generate final documents from unaccepted answers.
```

---

## 15. Runtime Invariants

```txt
- Every rendered node conversation must belong to activeNodeId.
- Every user message in node-focused mode must be attached to one node.
- Every canonical answer must be generated from node messages.
- Accepted canonical answers must not be stale.
- Documents must not be materialized from raw conversation alone.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — Wireframes showing conversation rendering in each node lifecycle state, including message history, canonical answer preview, and contextual actions.
```
