# Implement Step 3.4 — Implement node lifecycle transition validation

You are implementing Step 3.4 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 3.4
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 3.4, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 3.4;
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

Implement **only** Step 3.4. Do **not** implement later roadmap steps.

## Objective

Implement the complete lifecycle state machine: validate every possible transition, reject invalid ones, and apply valid ones.

## Why This Step Exists

Lifecycle transitions are the core of the state engine. Every allowed action, prompt state, and document readiness evaluation depends on the current lifecycle. Invalid transitions must be rejected before they corrupt state.

## Required Inputs

- `docs/04-node-lifecycle-and-question-state.md` §6-7 — valid and invalid transitions
- `docs/13-prototypes.md` §1.2 — lifecycle transition matrix

## Relevant Docs

- `docs/04-node-lifecycle-and-question-state.md`
- `docs/02-state-engine-canonical-spec.md`
- `docs/13-prototypes.md` Part 1 (State Inventory)

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 3.3 (node selection).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/state-engine/node-lifecycle.ts`:
   - `isValidTransition(from: NodeLifecycle, to: NodeLifecycle): boolean`
   - `applyLifecycleTransition(state, nodeId, newLifecycle): StateEngineResult`
   - Define the complete transition matrix as a lookup table.
2. Valid transitions (from spec):
   ```
   not_started → active
   active → answered, needs_clarification, needs_refinement, ready_for_synthesis
   answered → needs_clarification, needs_refinement, ready_for_synthesis
   needs_clarification → active, deferred
   needs_refinement → active, deferred, ready_for_synthesis
   ready_for_synthesis → synthesized
   synthesized → accepted, active (reopen/edit), deferred
   accepted → active (reopen)
   any non-final → deferred
   any non-final → blocked
   blocked → active (when blocker resolved), not_started (auto-resolve)
   ```
3. Invalid transitions that must be rejected:
   ```
   not_started → accepted
   needs_clarification → accepted
   needs_refinement → accepted
   blocked → accepted (without resolving dependency)
   accepted → synthesized (without reopen)
   synthesized → document export (without acceptance)
   ```

## Files / Areas Likely Affected

- `src/state-engine/node-lifecycle.ts` (new)
- `src/state-engine/state-engine.ts` (update)

## Acceptance Criteria

- All valid transitions from the spec are accepted.
- All invalid transitions are rejected with descriptive errors.
- Transition application updates `node.lifecycle`, `updatedAt`, and recomputes `allowedActions`.
- Guard: lifecycle transition must be paired with the correct event/intent.

## Tests / Validation

- **Transition matrix test:** For every combination of `from × to`, verify expected validity.
- Unit test: `not_started → active` succeeds.
- Unit test: `not_started → accepted` fails.
- Unit test: `synthesized → accepted` succeeds.
- Unit test: `synthesized → export` (without accept) fails.
- Unit test: `blocked → accepted` fails.

## Dependencies

- Step 3.3 — Node selection

## Implementation Constraints

- Preserve module boundaries.
- This is the most critical state engine logic — ensure exhaustive test coverage.
- Do not add features not requested.

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

