# Implement Step 3.5 — Implement allowed actions computation

You are implementing Step 3.5 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 3.5
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 3.5, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 3.5;
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

Implement **only** Step 3.5. Do **not** implement later roadmap steps.

## Objective

Given a node's lifecycle, compute the set of allowed `NodeAction` values. This is a pure function with no side effects.

## Why This Step Exists

The TUI must render only actions approved by the state engine. Hardcoding action-to-lifecycle rules in render components would violate the architecture.

## Required Inputs

- `docs/04-node-lifecycle-and-question-state.md` §8 — allowed actions by lifecycle
- `docs/13-prototypes.md` §1.6 and Appendix A — action-label mapping

## Relevant Docs

- `docs/04-node-lifecycle-and-question-state.md`
- `docs/08-tui-state-and-rendering-contract.md`
- `docs/13-prototypes.md` §1.6

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 1.2 (`NodeAction` and `NodeLifecycle` types).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/state-engine/allowed-actions.ts`:
   - `getAllowedActions(lifecycle: NodeLifecycle): NodeAction[]`
   - Pure function mapping lifecycle to action set.
2. Action map:
   ```
   not_started → [answer, skip, ask_for_example]
   active → [answer, defer, mark_as_assumption, mark_as_decision]
   answered → [answer, defer, mark_as_assumption, mark_as_decision]
   needs_clarification → [answer, defer, open_prerequisite]
   needs_refinement → [answer, defer, ask_for_example]
   ready_for_synthesis → []  (automatic transition)
   synthesized → [accept, edit, regenerate, defer, reopen]
   accepted → [continue_next, reopen, open_document_preview]
   deferred → [resume, continue_next]
   blocked → [open_prerequisite, defer]
   ```
3. Create `isActionAllowed(lifecycle, action): boolean`.

## Files / Areas Likely Affected

- `src/state-engine/allowed-actions.ts` (new)

## Acceptance Criteria

- Every lifecycle returns a non-overlapping, correct set of actions.
- `accept` is only available in `synthesized` state.
- `reopen` is available in `synthesized` and `accepted`.
- `continue_next` is available in `accepted` and `deferred`.

## Tests / Validation

- Unit test: verify action set for each lifecycle state.
- Unit test: verify `accept` is NOT in `active` action set.
- Unit test: verify `answer` is in `not_started`, `active`, `answered`, `needs_clarification`, `needs_refinement`.

## Dependencies

- Step 1.2 — `NodeAction` and `NodeLifecycle` types

## Implementation Constraints

- Preserve module boundaries.
- Pure function — no side effects.
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

