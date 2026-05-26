# 01 — System Architecture

## 1. Purpose

This document defines the macro architecture of the LOGOS Engine.

It describes the main system layers, module responsibilities, dependency rules, data flow, runtime boundaries, and architectural constraints required to preserve a conversation-first product governed by deterministic state.

---

## 2. Architecture Thesis

```txt
The LOGOS Engine is not a document editor.
The LOGOS Engine is a conversational runtime that materializes canonical documentation from accepted semantic nodes.
```

The system must therefore be organized around:

```txt
- conversation runtime;
- deterministic state engine;
- prompt orchestration;
- structured LLM output validation;
- node-scoped canonical answers;
- document materialization;
- TUI rendering from state snapshots.
```

---

## 3. Architectural Style

Recommended style:

```txt
Modular monolith with explicit internal boundaries.
```

Rationale:

```txt
- The product is still conceptually fluid.
- Module boundaries are more important than service distribution.
- A distributed architecture would add operational overhead too early.
- Internal ports/adapters preserve future extraction options.
```

Avoid early microservices.

---

## 4. System Context

```txt
User
  ↓
TUI
  ↓
Application Runtime
  ↓
State Engine ─ Prompt Orchestrator ─ LLM Provider Adapter
  ↓                    ↓
Persistence        Structured Output Validator
  ↓
Document Materializer
  ↓
Outputs: Markdown / HTML Artifacts / Agent Packs
```

---

## 5. Primary Layers

```txt
Interface Layer
Application Layer
Domain / State Layer
LLM Orchestration Layer
Persistence Layer
Output Materialization Layer
Infrastructure Adapters
```

---

## 6. Interface Layer

Responsibilities:

```txt
- render TUI state;
- capture user input;
- render contextual actions;
- display node conversations;
- display document previews;
- dispatch user events to the application runtime.
```

Must not:

```txt
- decide lifecycle transitions;
- call LLM providers directly;
- mutate node state directly;
- materialize documents directly;
- invent contextual actions.
```

---

## 7. Application Layer

Responsibilities:

```txt
- receive TUI events;
- coordinate state engine, prompt orchestration, persistence, and materialization;
- execute use cases;
- return render snapshots to the TUI.
```

Example use cases:

```txt
- select profile;
- select node;
- submit user message;
- accept canonical answer;
- regenerate canonical answer;
- open document preview;
- export outcome.
```

---

## 8. Domain / State Layer

Responsibilities:

```txt
- own runtime state model;
- validate transitions;
- compute allowed actions;
- evaluate node lifecycle;
- evaluate document readiness;
- enforce invariants.
```

Must not:

```txt
- render UI;
- call external APIs;
- call LLM providers;
- persist itself directly.
```

---

## 9. LLM Orchestration Layer

Responsibilities:

```txt
- select prompt by state;
- assemble context;
- call provider adapter;
- request structured output;
- run repair loop when validation fails;
- return candidate agent turn output.
```

Must not:

```txt
- apply state transitions directly;
- accept nodes;
- export documents;
- bypass validators.
```

---

## 10. Persistence Layer

Responsibilities:

```txt
- store session snapshots;
- store event log;
- store node messages;
- store canonical answers;
- store generated outputs metadata;
- support schema migrations.
```

Must not:

```txt
- interpret product lifecycle;
- decide state transitions;
- generate canonical content.
```

---

## 11. Output Materialization Layer

Responsibilities:

```txt
- assemble documents from accepted canonical answers;
- generate partial document previews;
- mark missing sections;
- mark stale source sections;
- generate Markdown, HTML artifacts, and agent packs.
```

Must not:

```txt
- use raw conversation as final source;
- ignore stale canonical answers;
- decide node completeness.
```

---

## 12. Dependency Rule

```txt
TUI
→ Application Runtime
→ Domain / State Engine
→ Ports
→ Infrastructure Adapters
```

Allowed dependency direction:

```txt
outer layers depend on inner contracts;
inner layers do not depend on outer implementations.
```

Forbidden:

```txt
TUI → LLM Provider
TUI → Persistence Adapter directly
LLM Provider → State mutation
Document Materializer → Node lifecycle decision
Persistence → Prompt Orchestrator
```

---

## 13. Main Data Flow

```txt
User input
→ TUI event
→ Application use case
→ State snapshot read
→ State engine validates context
→ Prompt orchestrator builds request
→ LLM adapter returns structured output
→ Output validator validates result
→ State engine applies transition
→ Persistence stores snapshot/events
→ TUI renders updated snapshot
```

---

## 14. System Invariants

```txt
- activeNodeId controls conversational focus.
- node conversation belongs to one node.
- canonical answer is separate from raw conversation.
- only accepted non-stale canonical answers can feed final documents.
- TUI renders state; it does not own state.
- LLM proposes; state engine disposes.
```

---

## 15. Architecture Risks

| Risk | Impact | Mitigation |
|---|---:|---|
| TUI becomes a form renderer | High | Enforce conversation-first rendering and node-state prompts |
| LLM mutates state implicitly | High | Structured output validation + state engine transitions |
| Documents become source of truth | High | Keep nodes/canonical answers as runtime truth |
| Prompt logic spreads across UI | Medium | Central prompt registry |
| Persistence model becomes opaque | Medium | Snapshot + event log |
| Architecture over-fragments too early | Medium | Modular monolith first |

---

## 16. Non-Negotiable Rules

```txt
- Keep deterministic control outside the user-facing interaction.
- Preserve strict boundaries between TUI, state engine, LLM orchestration, and persistence.
- Never generate canonical documents directly from unreviewed conversation.
- Never let the LLM be the source of state truth.
```
