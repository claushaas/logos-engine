# Implement Step 3.1 — Implement session initialization and profile selection

You are implementing Step 3.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 3.1
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 3.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 3.1;
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

Implement **only** Step 3.1. Do **not** implement later roadmap steps.

## Objective

Implement the state engine operations to initialize a new session, set the selected profile, and compute the resulting `SessionMode`.

## Why This Step Exists

Session initialization is the entry point for all runtime behavior. The state engine must produce a valid initial state before any other operation.

## Required Inputs

- `docs/02-state-engine-canonical-spec.md` §4-5
- Contract types from Phase 1

## Relevant Docs

- `docs/02-state-engine-canonical-spec.md`
- `docs/architecture/02-runtime-architecture.md`

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 1.2 (runtime state types), Step 2.1 (profile loader).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/state-engine/state-engine.ts`:
   - `createSession(): LogosRuntimeState` — returns an `idle` session.
   - `selectProfile(state, profileId): StateEngineResult` — sets `selectedProfileId`, loads profile structure, transitions to `structure_overview`.
   - `changeProfile(state, profileId): StateEngineResult` — replaces profile, resets node states.
   - Guard: cannot select a profile if none exists.
   - Guard: cannot select a node without a selected profile.
2. Implement `StateEngineResult` as `{ ok: true; state: LogosRuntimeState } | { ok: false; error: string; diagnostics: StateDiagnostic[] }`.
3. Create `StateEngineEvent` union for all events.

## Files / Areas Likely Affected

- `src/state-engine/state-engine.ts` (new)
- `src/state-engine/types.ts` (new)
- `src/state-engine/index.ts` (new)

## Acceptance Criteria

- `createSession()` returns `mode: "idle"`, `activeNodeId: null`, `selectedProfileId: null`.
- After `selectProfile`, `mode` is `"structure_overview"` and `selectedProfileId` is set.
- Selecting a node without a selected profile returns an error.
- State engine is a pure function (or returns new state, doesn't mutate input).

## Tests / Validation

- Unit test: `createSession()` produces valid initial state.
- Unit test: `selectProfile` with valid profile ID.
- Unit test: `selectProfile` with invalid profile ID → error.
- Unit test: attempting `selectNode` before `selectProfile` → error.

## Dependencies

- Step 1.2 — Runtime state types
- Step 2.1 — Profile loader

## Implementation Constraints

- Preserve module boundaries.
- State engine must be a pure function.
- Do not add features not requested.
- Do not weaken existing tests.

## Required Commands

```bash
pnpm typecheck
pnpm test
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

