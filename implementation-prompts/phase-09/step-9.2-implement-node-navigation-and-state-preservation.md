# Implement Step 9.2 — Implement node navigation and state preservation

You are implementing Step 9.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 9.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 9.2;
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

Implement **only** Step 9.2.

## Objective

Ensure that navigating between nodes preserves each node's conversation, lifecycle, and canonical answer. Handle deselection and `lastActiveNodeId` tracking.

## Why This Step Exists

Non-linear navigation is a core design principle. Users must be able to jump between nodes without losing work.

## Required Inputs

- `docs/03-conversation-runtime-spec.md` §12
- `docs/13-prototypes.md` Flow C (Sidebar Navigation)

## Relevant Docs

- `docs/03-conversation-runtime-spec.md`
- `docs/13-prototypes.md` §4.3

## Tasks

1. On node selection:
   - Preserve current node state (lifecycle, conversation).
   - Update `lastActiveNodeId`.
   - Set new `activeNodeId`.
   - Load/initialize new node state.
2. On node deselection (escape or "Back to structure"):
   - Clear `activeNodeId`. Mode returns to `structure_overview`.
3. Handle rapid navigation (debounce events).
4. Handle node deletion from profile (edge case):
   - Clear `activeNodeId`. Show error diagnostic.

## Files / Areas Likely Affected

- `src/tui/hooks/use-navigation.ts` (new)
- `src/state-engine/node-selection.ts` (verify preservation)

## Acceptance Criteria

- Navigate from node A to node B → node A state preserved.
- Return to node A → conversation and lifecycle restored exactly.
- Sidebar reflects correct state for all nodes after navigation.
- `lastActiveNodeId` is correct after navigation.

## Tests / Validation

- E2E harness test: Flow C (sidebar navigation).
- Unit test: `selectNode` preserves previous node state.
- Manual: navigate between nodes in TUI.

## Dependencies

- Step 9.1 — Sidebar
- Step 3.3 — Node selection (state engine)

## Implementation Constraints

- TUI is a renderer only. **Phase 9 checkpoint**.

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
