# Implement Step 18.3 — Implement diagnostics panel and logging

You are implementing Step 18.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 18.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 18.3;
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

Implement **only** Step 18.3.

## Objective

Add a diagnostics panel to the TUI that shows session-level diagnostics: errors, warnings, stale nodes, blocked exports, and recovery suggestions.

## Why This Step Exists

Users need visibility into system health. Diagnostics provide the "dashboard" view of session state.

## Required Inputs

- `docs/architecture/08-error-handling-and-recovery.md` §12

## Relevant Docs

- `docs/architecture/08-error-handling-and-recovery.md`
- `docs/08-tui-state-and-rendering-contract.md`

## Tasks

1. Create `src/tui/components/DiagnosticsPanel.tsx`:
   - Shows collected `StateDiagnostic[]`.
   - Groups by severity: error, warning, info.
   - Shows affected nodes/documents.
   - Shows suggested recovery actions.
   - Toggle with keyboard shortcut (e.g., Ctrl+D).
2. Wire diagnostics collection into application layer.

## Files / Areas Likely Affected

- `src/tui/components/DiagnosticsPanel.tsx` (new)
- `src/tui/app-shell.tsx` (update)

## Acceptance Criteria

- Diagnostics panel accessible via keyboard shortcut.
- Errors and warnings grouped by severity.
- Recovery actions listed for each diagnostic.
- Panel can be dismissed.

## Tests / Validation

- Snapshot test: diagnostics panel with errors.
- Manual: open diagnostics during session, verify contents.

## Dependencies

- Step 14.1 — Error categorization

## Implementation Constraints

- TUI is a renderer only. Do not add features not requested.

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
