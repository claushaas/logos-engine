# Implement Step 14.1 — Implement error categorization and diagnostic reporting

You are implementing Step 14.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 14.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 14.1;
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

Implement **only** Step 14.1.

## Objective

Build a unified error handling system that categorizes all errors, produces user-facing messages, suggests recovery actions, and generates diagnostic reports.

## Why This Step Exists

Errors must be explicit and recoverable. Users need clear, actionable messages — not cryptic stack traces.

## Required Inputs

- `docs/architecture/08-error-handling-and-recovery.md`
- `docs/02-state-engine-canonical-spec.md` §13

## Relevant Docs

- `docs/architecture/08-error-handling-and-recovery.md`
- `docs/architecture/02-runtime-architecture.md` §15

## Tasks

1. Create `src/diagnostics/error-categories.ts`:
   - `RuntimeErrorCategory`: `"validation" | "invalid_state" | "llm_provider" | "structured_output" | "persistence" | "profile_schema" | "materialization" | "tui_rendering" | "export"`
   - `RuntimeError` with `code`, `category`, `message`, `recoverable`, `userFacingMessage?`, `details?`
2. Create `src/diagnostics/diagnostic-collector.ts`:
   - Collect `StateDiagnostic[]` during state engine operations.
3. Create `src/diagnostics/recovery-actions.ts`:
   - Map error codes to suggested recovery actions.
   - Recovery actions: `retry`, `reopen_node`, `open_missing_prerequisite`, `regenerate_canonical_answer`, `clear_invalid_active_node`, `export_recovery_bundle`, `restore_previous_snapshot`, `open_settings`.

## Files / Areas Likely Affected

- `src/diagnostics/error-categories.ts` (new)
- `src/diagnostics/diagnostic-collector.ts` (new)
- `src/diagnostics/recovery-actions.ts` (new)
- `src/diagnostics/index.ts` (new)

## Acceptance Criteria

- All errors carry category, code, and user-facing message.
- Diagnostics include recovery actions.
- State engine errors produce diagnostics (not raw exceptions).
- User-facing messages are specific and actionable.

## Tests / Validation

- Unit test: error categorization for each category.
- Unit test: recovery action suggestions for common errors.
- Unit test: diagnostic collection during state engine operation.

## Dependencies

- Step 3.8 — State engine (error-producing operations)

## Implementation Constraints

- Preserve module boundaries. Do not add features not requested.

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
