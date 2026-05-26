# 08 — Error Handling and Recovery

## 1. Purpose

This document defines how the LOGOS Engine handles runtime errors, invalid states, failed LLM calls, persistence failures, validation errors, and recoverable UI states.

---

## 2. Error Handling Thesis

```txt
Errors must be explicit, recoverable when possible, and never silently corrupt state.
```

---

## 3. Error Categories

```txt
- validation errors;
- invalid state errors;
- LLM provider errors;
- structured output errors;
- persistence errors;
- profile/schema errors;
- materialization errors;
- TUI rendering errors;
- export errors.
```

---

## 4. Runtime Error Model

```ts
type RuntimeError = {
  code: string
  category: RuntimeErrorCategory
  message: string
  recoverable: boolean
  userFacingMessage?: string
  details?: Record<string, unknown>
}
```

---

## 5. Validation Errors

Examples:

```txt
- LLM output does not match schema;
- proposed lifecycle transition is invalid;
- suggested actions are not allowed;
- canonical answer lacks sourceMessageIds;
- document materialization references missing nodes.
```

Handling:

```txt
- reject invalid output;
- do not mutate state;
- run repair loop if LLM output related;
- surface diagnostic if repair fails.
```

---

## 6. Invalid State Errors

Examples:

```txt
- activeNodeId references missing node;
- accepted node has no canonical answer;
- canonical answer is accepted and stale;
- selectedProfileId is missing while activeNodeId is set.
```

Handling:

```txt
- repair if deterministic and safe;
- otherwise enter error mode with recovery action;
- persist diagnostic event.
```

Safe repairs:

```txt
- clear invalid activeNodeId;
- mark canonical answer stale;
- recompute allowed actions;
- recompute document readiness.
```

Unsafe repairs:

```txt
- invent missing canonical answer;
- accept node automatically;
- delete messages silently;
- change profile without user action.
```

---

## 7. LLM Provider Errors

Examples:

```txt
- timeout;
- network failure;
- provider unavailable;
- rate limited;
- invalid API key;
- malformed provider response.
```

Handling:

```txt
- retry when safe;
- fallback provider if configured;
- keep user message persisted;
- do not append failed assistant message;
- allow manual retry.
```

---

## 8. Persistence Errors

Examples:

```txt
- snapshot write fails;
- event append fails;
- migration fails;
- artifact write fails;
- permission denied.
```

Handling:

```txt
- do not confirm saved state if persistence failed;
- keep in-memory state marked unsaved;
- offer retry/export recovery if possible;
- prevent destructive operations until persistence recovers.
```

---

## 9. Materialization Errors

Examples:

```txt
- required node missing;
- stale source node;
- invalid materialization rule;
- output path unavailable;
- unsupported format.
```

Handling:

```txt
- show blocked export reason;
- link to missing/stale source nodes;
- avoid generating partial final artifacts unless explicitly preview mode.
```

---

## 10. User-Facing Error Style

TUI errors should be precise and actionable.

Good:

```txt
This document cannot be exported yet. Two required nodes are missing: Core Thesis and Central Tension.
```

Bad:

```txt
Something went wrong.
```

---

## 11. Recovery Actions

Possible recovery actions:

```txt
- retry;
- reopen node;
- open missing prerequisite;
- regenerate canonical answer;
- clear invalid active node;
- export recovery bundle;
- restore previous snapshot;
- open diagnostics.
```

---

## 12. Diagnostics

Diagnostics should include:

```txt
- error code;
- category;
- affected session/node/document;
- safe recovery actions;
- timestamp;
- provider details only when relevant and safe.
```

---

## 13. Non-Negotiable Rules

```txt
- Never silently discard user messages.
- Never accept a node as an error recovery shortcut.
- Never generate final documents from stale source data.
- Never hide validation failures that block state mutation.
- Always prefer recoverable explicit state over silent corruption.
```
