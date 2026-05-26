# Implement Step 1.5 — Define render snapshot, session event, and persistence contracts

You are implementing Step 1.5 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 1.5
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 1.5, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 1.5;
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

Use the advisor **before implementation** to review your plan, scope, risks, and acceptance criteria.

Use the advisor **before final report** to review implementation completeness, test sufficiency, gate results, and execution board update.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 1.5. Do **not** implement later roadmap steps.

## Objective

Define the contracts for TUI render snapshots, session events, and persisted data models.

## Why This Step Exists

The TUI must receive a fully-specified render snapshot. Persistence needs typed event payloads and snapshot shapes. These contracts complete the type system.

## Required Inputs

- `docs/08-tui-state-and-rendering-contract.md`
- `docs/09-session-events-and-persistence.md`
- `docs/architecture/06-tui-rendering-architecture.md`

## Relevant Docs

- `docs/08-tui-state-and-rendering-contract.md`
- `docs/09-session-events-and-persistence.md`
- `docs/architecture/06-tui-rendering-architecture.md`
- `docs/architecture/04-data-and-persistence-architecture.md`
- `docs/architecture/07-contracts-and-schemas.md`

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 1.2 (runtime state), Step 1.4 (document/export state).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/contracts/render-snapshot.ts` with:
   - `TuiRenderSnapshot` with `mode`, `sidebar`, `mainPanel`, `actionBar`/`allowedActions`, `input`, `diagnostics`.
   - `SidebarRenderModel` with `profileTitle?`, `phases` (array of `SidebarPhase`), `activeNodeId`.
   - `SidebarPhase` → `SidebarDocument` → `SidebarNode` with `nodeId`, `title`, `statusSymbol`, `selected`, `disabled`, `reasonIfDisabled?`.
   - `MainPanelRenderModel` as a discriminated union of panel variants.
   - `ActionBarRenderModel` with `actions` array.
   - `InputRenderModel` with `enabled`, `placeholder?`, `submitAction?`, `reasonIfDisabled?`.

2. Create `src/contracts/session-event.ts` with:
   - `SessionEventType` union: all event types from `09-session-events-and-persistence.md` §6.
   - `SessionEvent` with `id`, `sessionId`, `type`, `payload`, `createdAt`.
   - Typed payloads for each event type.

3. Create `src/contracts/persistence.ts` with:
   - `SessionSnapshot` with `sessionId`, `schemaVersion`, `runtimeState`, `savedAt`.
   - `PersistedSession` with `schemaVersion`, `sessionId`, `snapshot`, `events`.
   - `Migration` type with `from`, `to`, `migrate` function.

## Files / Areas Likely Affected

- `src/contracts/render-snapshot.ts` (new)
- `src/contracts/session-event.ts` (new)
- `src/contracts/persistence.ts` (new)
- `src/contracts/index.ts`

## Acceptance Criteria

- `TuiRenderSnapshot` contains all information needed to render any screen.
- `SessionEventType` covers all 17+ event types from the spec.
- Each event payload is typed (not `unknown` at the type level).
- `PersistedSession.schemaVersion` is a required string field.

## Tests / Validation

- TypeScript compilation: construct all render snapshot variants.
- Type narrowing: verify `mainPanel` discriminated union works correctly.

## Dependencies

- Step 1.2 — Runtime state types
- Step 1.4 — Document/export state types

## Implementation Constraints

- Preserve module boundaries.
- Keep the implementation minimal.
- Do not add features not requested.
- Do not weaken existing tests.
- This is a **Phase 1 checkpoint**: all Phase 1 steps should pass typecheck before proceeding to Phase 2.

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
 Note: this completes Phase 1 (Contracts). Recommend checkpoint review before Phase 2.
