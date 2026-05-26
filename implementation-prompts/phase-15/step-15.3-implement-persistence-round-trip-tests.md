# Implement Step 15.3 — Implement persistence round-trip tests

You are implementing Step 15.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 15.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 15.3;
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

Implement **only** Step 15.3. This is a test-only step.

## Objective

Test save → load → resume cycles, migration preservation, and corrupted data recovery.

## Why This Step Exists

Persistence bugs can silently lose user work. Round-trip tests verify that state survives the save/load cycle.

## Tasks

1. Create `tests/persistence/snapshot-roundtrip.test.ts` — save and load full session.
2. Create `tests/persistence/event-log.test.ts` — append and read events.
3. Create `tests/persistence/resume-repair.test.ts` — test repair scenarios.
4. Create `tests/persistence/migration.test.ts` — test migration preservation.

## Acceptance Criteria

- Snapshot round-trip preserves all state fields.
- Events are append-only and ordered.
- Invalid state is repaired on resume.
- Migrations don't drop data.

## Dependencies

- Phase 13 — Persistence

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
