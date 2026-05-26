# 03 — Module Boundaries

## 1. Purpose

This document defines strict module boundaries for the LOGOS Engine.

Its purpose is to prevent architectural drift, especially the common failure mode where the TUI, prompt logic, state transitions, and persistence become entangled.

---

## 2. Boundary Thesis

```txt
Each module owns one kind of decision.
No module may silently take over another module's responsibility.
```

---

## 3. Proposed Module Map

```txt
app/
  tui/
  application/
  state-engine/
  conversation-runtime/
  prompt-orchestration/
  llm/
  validation/
  materialization/
  persistence/
  profiles/
  outputs/
  diagnostics/
```

---

## 4. TUI Module

Owns:

```txt
- terminal layout;
- render components;
- keyboard/input handling;
- action display;
- visible conversation rendering.
```

May call:

```txt
- application use cases only.
```

Must not call:

```txt
- LLM adapter;
- persistence adapter directly;
- prompt registry directly;
- state mutation functions directly.
```

---

## 5. Application Module

Owns:

```txt
- use case orchestration;
- command handling;
- coordination between state, prompts, persistence, materializer;
- render snapshot return.
```

May call:

```txt
- state engine;
- prompt orchestration;
- persistence;
- materialization;
- diagnostics.
```

Must not own:

```txt
- UI rendering;
- low-level provider calls;
- schema definitions that belong to domain.
```

---

## 6. State Engine Module

Owns:

```txt
- runtime state;
- lifecycle transitions;
- allowed actions;
- guards;
- invariant enforcement;
- document readiness computation.
```

May depend on:

```txt
- pure types;
- profile definitions;
- schema contracts.
```

Must not depend on:

```txt
- TUI;
- LLM provider;
- persistence implementation;
- file system;
- terminal libraries.
```

---

## 7. Conversation Runtime Module

Owns:

```txt
- node-scoped message management;
- message append rules;
- conversation summaries;
- source message references;
- canonical answer source traceability.
```

Must not:

```txt
- decide node acceptance;
- generate prompts directly;
- export documents.
```

---

## 8. Prompt Orchestration Module

Owns:

```txt
- prompt registry;
- prompt selection;
- prompt assembly;
- context budgeting;
- repair prompt creation;
- output schema attachment.
```

Must not:

```txt
- mutate runtime state;
- persist sessions;
- decide final lifecycle transitions;
- render user interface.
```

---

## 9. LLM Module

Owns:

```txt
- provider interface;
- model invocation;
- timeout/retry at provider boundary;
- raw provider response normalization.
```

Must return:

```txt
- raw or normalized candidate structured output.
```

Must not:

```txt
- apply state transitions;
- decide accepted actions;
- write to persistence directly.
```

---

## 10. Validation Module

Owns:

```txt
- AgentTurnOutput validation;
- schema validation;
- transition intent validation;
- canonical answer validation;
- document materialization input validation.
```

Must be used before:

```txt
- applying LLM output;
- storing canonical drafts;
- exporting outputs.
```

---

## 11. Materialization Module

Owns:

```txt
- document assembly;
- partial previews;
- stale source marking;
- Markdown output;
- HTML artifact output;
- agent pack output.
```

Must only consume:

```txt
- accepted non-stale canonical answers;
- materialization rules;
- document metadata.
```

---

## 12. Persistence Module

Owns:

```txt
- storage adapters;
- session snapshots;
- event log;
- migrations;
- artifact metadata.
```

Must not interpret:

```txt
- lifecycle rules;
- prompt state;
- document readiness.
```

---

## 13. Profiles Module

Owns:

```txt
- profile loading;
- phase/document/node definitions;
- profile schema validation;
- materialization rule declarations;
- prompt references.
```

Must not own:

```txt
- runtime progress;
- user messages;
- canonical answers.
```

---

## 14. Dependency Matrix

| Module | May Depend On | Must Not Depend On |
|---|---|---|
| TUI | Application contracts | State internals, LLM, persistence adapters |
| Application | State, prompt, persistence ports, materializer | Terminal rendering internals |
| State Engine | Types, profile definitions | TUI, LLM, FS, DB |
| Prompt Orchestration | State snapshot, profiles, prompt registry | TUI, persistence adapters |
| LLM | Provider SDKs | State mutation, TUI |
| Materialization | Canonical answers, rules | Raw conversation as final source |
| Persistence | Storage libs | Lifecycle rules |

---

## 15. Boundary Tests

Add tests or lint rules to prevent:

```txt
- TUI importing provider adapters;
- state engine importing terminal UI libraries;
- LLM module importing state mutation functions;
- materializer importing raw node messages for final docs;
- persistence importing prompt orchestration.
```

---

## 16. Non-Negotiable Rules

```txt
- The state engine is the only authority for lifecycle transitions.
- The application layer is the only coordinator.
- The TUI is only a renderer and event source.
- The LLM is never an authority over state.
- The materializer never bypasses accepted canonical answers.
```
