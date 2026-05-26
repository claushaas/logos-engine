# Implement Step 3.8 — Implement state engine event dispatch and snapshot generation

You are implementing Step 3.8 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 3.8
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 3.8, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 3.8;
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

You must use the PI advisor extension:

```txt
@juicesharp/rpiv-advisor
```

Use the advisor **before implementation** and **before final report**.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 3.8. This is a wiring/unification step. Do **not** implement new sub-modules beyond dispatch and snapshot.

## Objective

Wire all state engine operations into a unified `dispatch(event)` interface that takes a `LogosEvent`, applies guards and effects, and returns a `StateEngineResult` with a render snapshot.

## Why This Step Exists

The application layer and TUI need a single entry point for all state mutations. The `dispatch` pattern ensures every mutation passes through guards and validation.

## Required Inputs

- `docs/02-state-engine-canonical-spec.md` §12 — `StateEngineSnapshot`
- `docs/13-prototypes.md` Part 5 — State Engine Contract Summary

## Relevant Docs

- `docs/02-state-engine-canonical-spec.md`
- `docs/13-prototypes.md` §5.1-5.4
- `docs/architecture/02-runtime-architecture.md`

## Required Initial Analysis

1. Inspect the repository structure — all state engine sub-modules.
2. Locate existing files: `src/state-engine/*`.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Steps 3.1-3.7 (all state engine sub-modules).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/state-engine/dispatch.ts`:
   - `dispatch(state: LogosRuntimeState, event: LogosEvent, profile: LogosProfile): StateEngineResult`
   - Route event by `event.type` to the appropriate handler.
   - Apply guards before effects.
   - Apply effects (state changes).
   - Recompute `mode`, `allowedActions`, document readiness.
   - Generate `StateEngineSnapshot` for the TUI.
2. Implement `StateEngineSnapshot` builder:
   - `buildSnapshot(state: LogosRuntimeState, profile: LogosProfile): StateEngineSnapshot`
   - Includes `mode`, `selectedProfileId`, `activeNodeId`, `activeNodeState`, `allowedActions`, `sidebar`, `mainPanel`, `diagnostics`.
3. All state engine functions from previous steps should be callable through `dispatch`.

## Files / Areas Likely Affected

- `src/state-engine/dispatch.ts` (new)
- `src/state-engine/snapshot-builder.ts` (new)
- `src/state-engine/index.ts` (update — export `dispatch` as primary API)

## Acceptance Criteria

- `dispatch(state, { type: "SELECT_NODE", nodeId: "..." }, profile)` returns an updated state and snapshot.
- Invalid events (e.g., SELECT_NODE without profile) return `ok: false` with diagnostics.
- Snapshot includes all fields required for TUI rendering.
- `dispatch` is a pure function (returns new state, no side effects).

## Tests / Validation

- Integration test: full createSession → selectProfile → selectNode → userMessage flow.
- Unit test: invalid event returns error.
- Snapshot test: verify snapshot shape matches `TuiRenderSnapshot` contract.
- Test snapshot after each major event type.

## Dependencies

- Steps 3.1-3.7 — All state engine sub-modules

## Implementation Constraints

- Preserve module boundaries.
- `dispatch` must be a pure function.
- This is a **Phase 3 checkpoint** — the complete state engine must pass all tests.

## Required Commands

```bash
pnpm typecheck
pnpm test
pnpm check
```

## Execution Board Update

Update or recommend updating `implementation-prompts/00-execution-board.md`.

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
 Note: this completes Phase 3 (State Engine).
