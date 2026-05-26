# 11 — Architecture Decision Records

## 1. Purpose

This document defines how architecture decisions should be recorded for the LOGOS Engine.

Architecture decisions must be explicit because the system has several tempting failure modes: becoming a form app, letting the LLM own state, treating HTML as canonical source, or over-engineering too early.

---

## 2. ADR Thesis

```txt
A decision not recorded is a decision likely to be reopened accidentally.
```

---

## 3. ADR Folder

Recommended structure:

```txt
architecture/adr/
  0001-use-conversation-first-tui.md
  0002-use-deterministic-state-engine.md
  0003-use-node-scoped-conversations.md
  0004-use-structured-llm-output.md
  0005-use-markdown-as-canonical-output.md
  0006-use-html-as-derived-artifact.md
```

---

## 4. ADR Template

```md
# ADR-[number] — [Decision Title]

## Status

Proposed / Accepted / Superseded / Deprecated

## Context

What problem, tension, or uncertainty led to this decision?

## Decision

What decision was made?

## Consequences

What becomes easier, harder, enabled, or constrained?

## Alternatives Considered

What options were rejected?

## Trade-offs

What are the explicit costs of this decision?

## Follow-up Actions

What must be updated or implemented because of this decision?
```

---

## 5. Initial ADRs Required

The project should start with these ADRs:

```txt
ADR-0001 — Use conversation-first TUI
ADR-0002 — Use deterministic state engine
ADR-0003 — Use activeNodeId as runtime focus
ADR-0004 — Use node-scoped conversations
ADR-0005 — Separate raw conversation from canonical answers
ADR-0006 — Use structured LLM output
ADR-0007 — Prevent LLM from mutating state directly
ADR-0008 — Generate documents from accepted canonical answers
ADR-0009 — Use Markdown as canonical textual output
ADR-0010 — Use HTML only as derived artifact
ADR-0011 — Start as modular monolith
ADR-0012 — Require mock LLM provider for tests
```

---

## 6. Example ADR

```md
# ADR-0002 — Use Deterministic State Engine

## Status

Accepted

## Context

The LOGOS Engine must provide a conversational user experience without becoming unpredictable or dependent on free-form LLM behavior. The user should interact naturally, but the system must know which node is active, which actions are valid, when a node is complete, and when documents can be generated.

## Decision

Use a deterministic state engine to own runtime state, node lifecycle, allowed actions, transition guards, prompt state, and document readiness.

## Consequences

The TUI can remain conversational while runtime behavior remains auditable. LLM output must be validated before state mutation. More upfront schema work is required.

## Alternatives Considered

- Let the LLM manage conversation state.
- Use static forms.
- Use a simple global chat transcript.

## Trade-offs

This adds implementation complexity, but prevents the product from becoming either too rigid or too chaotic.

## Follow-up Actions

- Implement state engine module.
- Add transition matrix tests.
- Add structured output validation.
```

---

## 7. ADR Rules

```txt
- Record decisions that affect module boundaries.
- Record decisions that affect source of truth.
- Record decisions that reject tempting alternatives.
- Update ADR status when superseded.
- Do not rewrite history silently.
```

---

## 8. Non-Negotiable Rules

```txt
- Conversation-first TUI must be an ADR.
- Deterministic state engine must be an ADR.
- HTML as derived artifact must be an ADR.
- LLM cannot mutate state must be an ADR.
- Modular monolith first must be an ADR.
```
