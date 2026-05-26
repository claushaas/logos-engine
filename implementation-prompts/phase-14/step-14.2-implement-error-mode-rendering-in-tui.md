# Implement Step 14.2 — Implement error mode rendering in TUI

You are implementing Step 14.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 14.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 14.2;
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

Implement **only** Step 14.2.

## Objective

Render error states in the TUI: show the error message, diagnostic details, and recovery action buttons. The TUI must enter `error` mode for unrecoverable situations.

## Required Inputs

- `docs/architecture/08-error-handling-and-recovery.md` §10-11
- `docs/13-prototypes.md` — error mode overview

## Relevant Docs

- `docs/architecture/08-error-handling-and-recovery.md`
- `docs/13-prototypes.md`

## Tasks

1. Create `src/tui/components/ErrorPanel.tsx`:
   - Renders when `mode === "error"`.
   - Shows user-facing error message.
   - Shows diagnostic details (code, category).
   - Shows recovery action buttons.
   - `[Retry]`, `[Reopen Node]`, `[Open Prerequisite]`, `[Export Recovery Bundle]`, `[Restore Previous Snapshot]`, `[Close]`.
2. Wire error mode into the rendering switch in `AppShell`.
3. Error mode should not lose current session state.

## Files / Areas Likely Affected

- `src/tui/components/ErrorPanel.tsx` (new)
- `src/tui/app-shell.tsx` (update)

## Acceptance Criteria

- Error mode renders with clear message and recovery actions.
- User can dismiss error and return to previous mode.
- Recovery actions trigger appropriate state engine events.
- Fatal errors clearly distinguished from recoverable errors.

## Tests / Validation

- Snapshot test: error mode with recoverable error.
- Snapshot test: error mode with fatal error.
- Manual: trigger error mode via invalid state.

## Dependencies

- Step 14.1 — Error categorization
- Step 8.2 — TUI shell

## Implementation Constraints

- TUI is a renderer only. **Phase 14 checkpoint**.

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
