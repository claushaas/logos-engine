# 11 — Conversation Quality and Completeness

## 1. Purpose

This document defines how the LOGOS Engine evaluates whether a node conversation has produced enough quality to synthesize a canonical answer.

The system must not accept weak, generic, contradictory, or incomplete answers simply because the user wrote something.

---

## 2. Core Principle

```txt
A response is not complete because it exists.
It is complete when it satisfies the node's semantic purpose.
```

---

## 3. Completeness Dimensions

Completeness is evaluated across:

```txt
- coverage;
- specificity;
- coherence;
- decision clarity;
- assumption visibility;
- contradiction handling;
- document usefulness;
- downstream readiness.
```

---

## 4. Coverage Evaluation

Each node declares coverage topics.

The engine evaluates each topic as:

```txt
missing
weak
sufficient
```

```ts
type CoverageEvaluation = Record<string, "missing" | "weak" | "sufficient">
```

---

## 5. Missing vs Weak

Missing:

```txt
The topic is not addressed at all.
```

Weak:

```txt
The topic is addressed, but too vaguely, generically, or inconsistently to support canonical documentation.
```

Sufficient:

```txt
The topic is addressed clearly enough to support synthesis.
```

---

## 6. Specificity Rules

A node answer is weak when it could apply to many unrelated projects without meaningful change.

Signals of weak specificity:

```txt
- generic claims;
- vague value propositions;
- broad audience descriptions;
- undefined problem;
- solution language without underlying reasoning;
- marketing phrases without operational meaning.
```

---

## 7. Contradiction Handling

Contradictions should not be silently resolved by the agent.

The agent should surface them as decision points.

Example:

```txt
You described the product as fully conversational, but also as a deterministic form system. Which constraint should dominate when these conflict?
```

---

## 8. Assumption Visibility

Unproven claims must be marked as assumptions.

Examples:

```txt
- users want this;
- businesses will pay;
- LLM cost will be acceptable;
- a conversational interface will reduce friction;
- users will complete long documentation sessions.
```

---

## 9. Completeness Output

```ts
type CompletenessState = {
  complete: boolean
  coverage: Record<string, "missing" | "weak" | "sufficient">
  missing: string[]
  weak: string[]
  blockingIssues: string[]
}
```

---

## 10. When to Clarify

Use clarification when:

```txt
- the user's meaning is ambiguous;
- two interpretations would lead to different documents;
- a required distinction is unclear;
- the system cannot safely synthesize.
```

---

## 11. When to Refine

Use refinement when:

```txt
- the meaning is understandable but weak;
- the answer is too generic;
- the statement lacks specificity;
- the answer is not yet useful as documentation;
- the claim needs sharper boundaries.
```

---

## 12. When to Synthesize

Use synthesis when:

```txt
- required coverage topics are sufficient;
- no blocking ambiguity remains;
- weak points are either resolved or explicitly marked;
- a canonical answer would be useful for the document;
- the current lifecycle permits synthesis.
```

---

## 13. When to Block

Use blocked state when:

```txt
- a prerequisite node is required;
- required context is unavailable;
- profile mismatch prevents progress;
- current node depends on a decision not yet made.
```

---

## 14. Quality Gates

Before a node can be accepted:

```txt
- canonical answer exists;
- canonical answer is not stale;
- required coverage is sufficient;
- assumptions are visible;
- open questions are recorded;
- user explicitly accepts.
```

---

## 15. Non-Negotiable Rules

```txt
- Do not treat message existence as completion.
- Do not smooth over contradictions.
- Do not hide assumptions.
- Do not synthesize when ambiguity blocks meaning.
- Do not accept without user confirmation.

## See Also

- [`13-prototypes.md`](./13-prototypes.md) — Clarification (§3.5) and refinement (§3.6) state prototypes showing how the TUI renders weak/ambiguous answers and the agent's targeted interventions. Flow B (§4.2) walks through the complete incomplete-answer → clarification → refinement → synthesis loop.
```
