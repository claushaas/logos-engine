# Implement Step 3.3 — Implement node selection and deselection

You are implementing Step 3.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 3.3
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 3.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 3.3;
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

Implement **only** Step 3.3. Do **not** implement later roadmap steps.

## Objective

Implement node selection (setting `activeNodeId`) with all guards: node must exist in profile, must not be blocked by unmet dependencies (unless explicitly navigating to blocked node), and must initialize node state if first access.

## Why This Step Exists

Node selection is the primary navigation action. It must correctly handle blocked nodes, preserve existing node state, and recompute session mode.

## Required Inputs

- `docs/02-state-engine-canonical-spec.md` §7
- `docs/04-node-lifecycle-and-question-state.md` §10 — dependency state

## Relevant Docs

- `docs/02-state-engine-canonical-spec.md`
- `docs/04-node-lifecycle-and-question-state.md`
- `docs/13-prototypes.md` — Flow C (sidebar navigation), Flow F (blocked node)

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 3.2 (mode resolution), Step 2.2 (dependency graph).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/state-engine/node-selection.ts`:
   - `selectNode(state, nodeId): StateEngineResult`
   - Guard: profile must be selected.
   - Guard: node must exist in profile.
   - Guard: check dependencies — if blocked, transition node to `blocked` lifecycle (but still allow navigation).
   - If node has no runtime state yet, initialize `NodeRuntimeState` with `lifecycle: "not_started"`.
   - If node already has runtime state, preserve conversation and lifecycle.
   - Set `lastActiveNodeId` to previous `activeNodeId` before changing.
   - Set `activeNodeId` to the new node.
   - Recompute `mode` via `resolveSessionMode`.
2. Implement `deselectNode(state): StateEngineResult`:
   - Sets `activeNodeId` to `null`.
   - Mode returns to `structure_overview`.
   - Current node state is preserved.

## Files / Areas Likely Affected

- `src/state-engine/node-selection.ts` (new)
- `src/state-engine/state-engine.ts` (update)

## Acceptance Criteria

- First selection of a node initializes `NodeRuntimeState.lifecycle` as `"not_started"`.
- Re-selection of a previously worked node preserves its full state.
- Blocked nodes are navigable but open in `blocked` lifecycle.
- Deselection sets `mode` to `structure_overview` and preserves node state.
- `lastActiveNodeId` is updated correctly on navigation.

## Tests / Validation

- Unit test: select node for first time → `not_started`.
- Unit test: select node, work on it, navigate away, navigate back → state preserved.
- Unit test: select node with unmet dependencies → opens as `blocked`.
- Unit test: deselect → returns to `structure_overview`.
- Unit test: select non-existent node → error.

## Dependencies

- Step 3.2 — Mode resolution
- Step 2.2 — Dependency graph

## Implementation Constraints

- Preserve module boundaries.
- Keep the implementation minimal and deterministic.
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

