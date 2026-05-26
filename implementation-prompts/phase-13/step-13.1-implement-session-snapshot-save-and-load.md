# Implement Step 13.1 — Implement session snapshot save and load

You are implementing Step 13.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 13.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 13.1;
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

Implement **only** Step 13.1.

## Objective

Implement local persistence: save the full `LogosRuntimeState` as a JSON snapshot after each completed turn, and load it on session start.

## Why This Step Exists

Without persistence, the user loses all work on exit. Snapshots enable fast resume without replaying events.

## Required Inputs

- `docs/09-session-events-and-persistence.md`
- `docs/architecture/04-data-and-persistence-architecture.md`

## Relevant Docs

- `docs/09-session-events-and-persistence.md`
- `docs/architecture/04-data-and-persistence-architecture.md`

## Tasks

1. Create `src/persistence/snapshot-store.ts`:
   - `saveSnapshot(sessionId, state): Promise<Result<void, PersistenceError>>`
   - `loadSnapshot(sessionId): Promise<Result<SessionSnapshot, PersistenceError>>`
   - `listSessions(): Promise<SessionSummary[]>` — list available sessions.
   - Store snapshots as JSON files under `sessions/` directory.
   - Include `schemaVersion` in every snapshot.
2. Auto-save after each completed agent turn.
3. Save on SIGINT/SIGTERM.
4. Atomic writes: write to temp file, then rename.

## Files / Areas Likely Affected

- `src/persistence/snapshot-store.ts` (new)
- `src/persistence/index.ts` (new)

## Acceptance Criteria

- Snapshot saved after agent turn.
- Snapshot loaded on session start.
- Multiple sessions can be listed.
- Corrupted snapshot → error with recovery options.
- Atomic write prevents partial saves.

## Tests / Validation

- Unit test: save and load snapshot round-trip.
- Unit test: list sessions returns correct IDs.
- Unit test: load corrupted snapshot → error.
- Unit test: atomic write (temp file + rename).

## Dependencies

- Step 3.8 — State engine dispatch (snapshot generation)

## Implementation Constraints

- Preserve module boundaries. Persistence must not interpret runtime rules.

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
