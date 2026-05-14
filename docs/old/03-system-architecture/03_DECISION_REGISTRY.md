# Decision Registry

## Purpose

The decision registry is the central source of truth for LOGOS Engine.

It stores what has been decided, assumed, proposed, or left unknown.

## Why Decisions Matter

Documents can be edited. Questions can be answered differently over time. Assumptions can expire.

The registry provides continuity and traceability.

## Decision Statuses

### unknown

No meaningful answer exists.

### assumed

The user has accepted this temporarily for planning.

### proposed

The system suggested a possible decision, but the user has not confirmed it.

### confirmed

The user explicitly accepted this decision.

### deprecated

The decision was replaced or is no longer relevant.

## Required Fields

Each decision should include:

- id;
- title;
- value;
- status;
- confidence;
- source answers;
- affected documents;
- dependency links;
- timestamps.

## Example

```json
{
  "id": "technical.offline_first",
  "title": "Offline-first strategy",
  "value": true,
  "status": "confirmed",
  "confidence": "high",
  "sourceAnswerIds": ["answer_001"],
  "impacts": [
    "technical.sync_strategy",
    "technical.local_storage",
    "testing.offline_resilience"
  ],
  "affectedDocuments": [
    "docs/06-architecture/ARCHITECTURE.md",
    "docs/08-testing/TESTING_STRATEGY.md"
  ]
}
```

## Rule

Never overwrite a confirmed decision silently.

If a user changes a confirmed decision, LOGOS Engine should:

1. record the change;
2. identify affected documents;
3. identify affected downstream decisions;
4. recommend regeneration or review.
