# Implement Step 13.3 — Implement session resume with validation and repair

You are implementing Step 13.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 13.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 13.3;
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

Implement **only** Step 13.3.

## Objective

On launch, detect existing sessions, load the latest snapshot, validate runtime state, repair safe inconsistencies, and restore the session.

## Why This Step Exists

Session resume is a core user need. The system must gracefully handle corrupted or stale data.

## Required Inputs

- `docs/09-session-events-and-persistence.md` §10
- `docs/13-prototypes.md` Flow I §4.9

## Relevant Docs

- `docs/09-session-events-and-persistence.md`
- `docs/architecture/04-data-and-persistence-architecture.md` §12
- `docs/13-prototypes.md` §4.9

## Tasks

1. Create `src/persistence/session-resume.ts`:
   - `resumeSession(sessionId?): Promise<Result<LogosRuntimeState, ResumeError>>`
   - If no `sessionId`, load latest session.
   - Load snapshot.
   - Validate `schemaVersion` — run migrations if needed.
   - Validate `activeNodeId` — if references non-existent node, clear it.
   - Validate `selectedProfileId` — if profile not found, prompt to re-select.
   - Validate node states: ensure accepted nodes have canonical answers.
   - Repair safe inconsistencies.
   - Return restored state.
2. On idle screen, show `[Resume Session]` when sessions exist.
3. Implement schema migration:
   - `Migration { from: string; to: string; migrate(data): unknown }`
   - Never silently drop node conversations or accepted answers.

## Files / Areas Likely Affected

- `src/persistence/session-resume.ts` (new)
- `src/persistence/migrations.ts` (new)
- `src/tui/screens/IdleScreen.tsx` (update)

## Acceptance Criteria

- Resume restores active node, profile, and all node states.
- Invalid activeNodeId is cleared with diagnostic.
- Missing profile triggers re-selection.
- Migrations run when schema version changes.
- Conversations are not lost during resume.

## Tests / Validation

- Unit test: resume from valid snapshot.
- Unit test: resume with invalid activeNodeId → repaired.
- Unit test: resume with missing profile → error with recovery.
- Unit test: migration preserves messages and canonical answers.
- E2E harness test: Flow I.

## Dependencies

- Step 13.1 — Snapshot persistence
- Step 13.2 — Event log

## Implementation Constraints

- Preserve module boundaries. Never silently drop data. **Phase 13 checkpoint**.

## Required Commands

```bash
pnpm typecheck
pnpm test
pnpm check
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
