# Implement Step 13.2 — Implement session event log

You are implementing Step 13.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 13.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 13.2;
- existing implementations related to the step objective;
- exported symbols and types relevant to the step;
- current imports and dependency relationships;
- nearby tests or missing test coverage;
- module boundaries that must not be violated;
- existing utilities that should be reused;
- files that belong to future roadmap steps and should not be touched.

You must produce this summary before implementation:

```md
## Codegraph Discovery Summary
### Relevant Files Found
### Relevant Symbols Found
### Existing Tests Found
### Dependencies / Imports Observed
### Reuse Opportunities
### Boundary Risks
### Files Safe to Edit
### Files Not To Touch
### Greenfield / Migration / Adaptation Assessment
```

Do not edit code until this summary is complete.

## Mandatory Advisor Review

Use `@juicesharp/rpiv-advisor` **before implementation** and **before final report**. Do not mark complete if advisor finds critical issues.

## Scope

Implement **only** Step 13.2.

## Objective

Implement append-only event logging for all meaningful state transitions. Events provide audit trail and enable future replay.

## Why This Step Exists

Events explain how state changed. They are essential for debugging, auditing, and potentially replaying sessions.

## Required Inputs

- `docs/09-session-events-and-persistence.md` §6
- `docs/architecture/04-data-and-persistence-architecture.md` §6

## Relevant Docs

- `docs/09-session-events-and-persistence.md`
- `docs/architecture/04-data-and-persistence-architecture.md`

## Tasks

1. Create `src/persistence/event-log.ts`:
   - `appendEvent(sessionId, event): Promise<Result<void, PersistenceError>>`
   - `getEvents(sessionId): Promise<SessionEvent[]>`
   - `getEventsByType(sessionId, type): Promise<SessionEvent[]>`
   - Store events as JSONL under `sessions/<id>/events.jsonl`.
2. Emit events from the state engine on all significant transitions:
   - `SESSION_CREATED`, `PROFILE_SELECTED`, `NODE_SELECTED`, `USER_MESSAGE_ADDED`, `ASSISTANT_MESSAGE_ADDED`, `NODE_LIFECYCLE_CHANGED`, `CANONICAL_ANSWER_DRAFTED`, `CANONICAL_ANSWER_ACCEPTED`, `CANONICAL_ANSWER_MARKED_STALE`, `NODE_DEFERRED`, `NODE_BLOCKED`, `DOCUMENT_PREVIEW_GENERATED`, `EXPORT_GENERATED`, etc.

## Files / Areas Likely Affected

- `src/persistence/event-log.ts` (new)
- `src/state-engine/dispatch.ts` (update — emit events)

## Acceptance Criteria

- Every lifecycle transition generates an event.
- Every canonical answer change generates an event.
- Events are append-only (no overwrites).
- Events can be queried by type.

## Tests / Validation

- Integration test: run complete flow, verify events logged.
- Unit test: append and read events.
- Unit test: event contains all required fields.

## Dependencies

- Step 13.1 — Snapshot persistence
- Step 1.5 — Session event types

## Implementation Constraints

- Preserve module boundaries. Do not add features not requested.

## Required Commands

```bash
pnpm typecheck
pnpm test
```

## Execution Board Update

Update `implementation-prompts/00-execution-board.md`.

## Required Final Report

Return a final report with:

```md
# Step X.Y Report
## Status
## Files Changed
## Implementation Summary
## Codegraph Discovery Applied
- Codegraph used: yes/no
- Relevant files found:
- Relevant symbols found:
- Existing tests found:
- Boundary risks identified:
- How the implementation used the discovery:
## Acceptance Criteria Check
| Criterion | Status | Notes |
|---|---|---|
## Tests Added / Updated
## Commands Run
## Results
## Advisor Review Applied
- Advisor extension used: `@juicesharp/rpiv-advisor`
- Pre-implementation recommendations:
- Pre-final-review recommendations:
- Changes applied:
- Recommendations intentionally not applied:
## Execution Board Update Recommendation
| Field | Recommended Value |
|---|---|
| Status | 🟡 Needs review / 🔴 Blocked / ⚠️ Needs decision |
| Notes | ... |
| Next Step | Step X.Y — ... |
## Deviations From Roadmap
## Follow-up Required
```
