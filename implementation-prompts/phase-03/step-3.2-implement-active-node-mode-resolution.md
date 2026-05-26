# Implement Step 3.2 — Implement active node mode resolution

You are implementing Step 3.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 3.2
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 3.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 3.2;
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

Implement **only** Step 3.2. Do **not** implement later roadmap steps.

## Objective

Implement the runtime rule that determines whether the session is in structural mode or node-focused mode based on `activeNodeId`.

## Why This Step Exists

The entire TUI behavior depends on the active node switch. If this rule is ambiguous, the renderer will become stateful and violate the architecture.

## Required Inputs

- `docs/02-state-engine-canonical-spec.md` §6
- `LogosRuntimeState`

## Relevant Docs

- `docs/02-state-engine-canonical-spec.md`
- `docs/08-tui-state-and-rendering-contract.md`
- `docs/architecture/02-runtime-architecture.md`
- `docs/architecture/03-module-boundaries.md`

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 3.1 (session initialization).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/state-engine/session-mode.ts`:
   - `resolveSessionMode(state: LogosRuntimeState): SessionMode`
   - Return `"idle"` when `selectedProfileId === null` and `activeNodeId === null`.
   - Return `"structure_overview"` when `selectedProfileId !== null` and `activeNodeId === null`.
   - Return `"node_focus"` when `activeNodeId !== null` (after validation).
   - Validate that `activeNodeId` exists in the profile's node definitions.
   - If `activeNodeId` is invalid, return `"error"` mode with a diagnostic.
2. This function must be pure and deterministic (no side effects).

## Files / Areas Likely Affected

- `src/state-engine/session-mode.ts` (new)
- `src/state-engine/state-engine.ts` (update)

## Acceptance Criteria

- Mode resolution is pure and deterministic.
- Invalid active node does not crash the runtime; enters `error` mode.
- TUI does not implement independent mode logic — it reads `state.mode`.

## Tests / Validation

- Unit test: idle mode (no profile, no node).
- Unit test: structure overview mode (profile, no node).
- Unit test: node focus mode (profile + valid activeNodeId).
- Unit test: error mode (profile + invalid activeNodeId).
- Unit test: mode transitions when profile is changed.

## Dependencies

- Step 3.1 — Session initialization

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

