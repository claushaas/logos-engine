# Implement Step 8.1 — Implement render snapshot to TUI render model mapping

You are implementing Step 8.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 8.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 8.1;
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

Implement **only** Step 8.1.

## Objective

Map the `StateEngineSnapshot` to the `TuiRenderSnapshot` model consumed by the TUI components. This is a pure transformation layer.

## Why This Step Exists

The state engine produces a domain snapshot. The TUI needs a render-optimized model with labels, status symbols, and layout information. This mapping layer keeps domain and presentation separate.

## Required Inputs

- `docs/08-tui-state-and-rendering-contract.md`
- `docs/architecture/06-tui-rendering-architecture.md`
- `docs/13-prototypes.md` Appendix C — mode → panel content

## Relevant Docs

- `docs/08-tui-state-and-rendering-contract.md`
- `docs/architecture/06-tui-rendering-architecture.md`
- `docs/13-prototypes.md` Part 2 (Component Model), Appendix A-C

## Tasks

1. Create `src/application/render-model-builder.ts`:
   - `buildRenderSnapshot(snapshot: StateEngineSnapshot, profile: LogosProfile): TuiRenderSnapshot`
   - Map `SessionMode` → main panel variant.
   - Build `SidebarRenderModel` from profile phases/documents/nodes + node states.
   - Build `ActionBarRenderModel` from `snapshot.allowedActions`.
   - Build `InputRenderModel`: `enabled` when lifecycle allows text input.
   - Include diagnostics.

## Files / Areas Likely Affected

- `src/application/render-model-builder.ts` (new)

## Acceptance Criteria

- Idle mode → idle panel with welcome and deterministic actions.
- Structure overview → profile summary with node tree in sidebar.
- Node focus → conversation panel, canonical preview, action bar.
- Sidebar nodes have correct status symbols for each lifecycle.
- Action labels match Appendix A from `13-prototypes.md`.

## Tests / Validation

- Snapshot test: idle mode produces expected render model.
- Snapshot test: node_focus with `synthesized` lifecycle produces review actions.
- Snapshot test: blocked node sidebar entry has `disabled: true`.
- Unit test: status symbol mapping.

## Dependencies

- Step 3.8 — State engine snapshot
- Step 2.2 — Node tree

## Implementation Constraints

- Preserve module boundaries. Pure transformation — no state mutation.

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
