# 09 — Testing Architecture

## 1. Purpose

This document defines how the LOGOS Engine should be tested.

The system depends on deterministic state transitions and non-deterministic LLM outputs. Testing must isolate those concerns.

---

## 2. Testing Thesis

```txt
Test deterministic state exhaustively.
Test LLM integration through schemas, mocks, fixtures, and contract gates.
```

---

## 3. Test Layers

```txt
Unit tests
Integration tests
Contract tests
TUI rendering tests
Persistence tests
Materialization tests
LLM mock tests
End-to-end flow tests
```

---

## 4. Unit Tests

Focus:

```txt
- state engine transitions;
- allowed action computation;
- lifecycle guards;
- completeness evaluation helpers;
- document readiness computation;
- stale canonical answer rules.
```

Required examples:

```txt
- not_started → active;
- active → needs_clarification;
- ready_for_synthesis → synthesized;
- synthesized → accepted;
- accepted → reopened;
- blocked node cannot be accepted;
- stale accepted answer blocks export.
```

---

## 5. Transition Matrix Tests

Create a matrix of valid and invalid transitions.

```txt
from lifecycle
+ event/action
+ guards
= expected lifecycle or rejection
```

This is mandatory for confidence.

---

## 6. Contract Tests

Validate:

```txt
- AgentTurnOutput schema;
- LogosProfile schema;
- NodeRuntimeState schema;
- DocumentMaterializationRule schema;
- TuiRenderSnapshot shape;
- SessionEvent payloads.
```

---

## 7. Prompt Orchestration Tests

Use mock data to validate:

```txt
- prompt selected by node lifecycle;
- correct fallback prompt chosen;
- context assembled in correct priority;
- output schema attached;
- repair prompt produced after validation failure.
```

Do not call real LLM in normal CI.

---

## 8. LLM Mock Tests

Use fixtures for:

```txt
- initial question;
- clarification request;
- refinement request;
- synthesis output;
- invalid structured output;
- repair output;
- provider timeout.
```

---

## 9. TUI Rendering Tests

Validate render snapshots:

```txt
- idle mode shows profile actions;
- structure overview shows node tree;
- active node highlights sidebar node;
- conversation panel shows active node messages only;
- action bar shows only state-approved actions;
- blocked node shows prerequisite action;
- document preview shows missing/stale sections.
```

Snapshot tests may be useful for terminal wireframes.

---

## 10. Persistence Tests

Validate:

```txt
- session snapshot save/load;
- event append;
- resume with valid activeNodeId;
- resume with invalid activeNodeId repair;
- migration preserves node messages;
- accepted canonical answers persist;
- generated artifact metadata persists.
```

---

## 11. Materialization Tests

Validate:

```txt
- document generated from accepted nodes;
- missing required nodes are listed;
- stale source nodes block final export;
- partial preview is allowed;
- raw conversation is not used as final source.
```

---

## 12. End-to-End Flow Tests

Minimum E2E flows:

```txt
1. First use flow.
2. Incomplete answer → clarification → refinement → synthesis → accept.
3. Sidebar navigation preserves node conversations.
4. Review/edit/regenerate canonical answer.
5. Deferred node.
6. Blocked node opens prerequisite.
7. Document preview from accepted nodes.
8. Export blocked by stale source.
9. Resume session.
```

---

## 13. CI Gates

Minimum gates:

```txt
- typecheck;
- lint;
- unit tests;
- transition matrix tests;
- schema/contract tests;
- mock E2E tests.
```

Optional later:

```txt
- real provider smoke test behind manual flag;
- performance checks;
- artifact generation checks.
```

---

## 14. Non-Negotiable Rules

```txt
- CI must not require real LLM credentials.
- State engine must be testable without TUI.
- TUI must be testable without LLM.
- Materializer must be testable with fixture canonical answers.
- Invalid LLM output must never mutate state in tests or production.
```
