# Implement Step 16.1 — Implement CLI/TUI entry point and command routing

You are implementing Step 16.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 16.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 16.1;
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

Implement **only** Step 16.1.

## Objective

Build the `logos` CLI entry point that starts the TUI, handles command-line arguments, and routes to appropriate screens.

## Why This Step Exists

Users need a single entry point to launch the LOGOS Engine.

## Required Inputs

- `docs/architecture/10-local-development-and-deployment.md`
- Existing CLI code in `src/cli/`

## Relevant Docs

- `docs/architecture/10-local-development-and-deployment.md`
- `README.md`

## Tasks

1. Create/update `src/cli/main.ts`:
   - Parse command-line arguments: `--profile`, `--session`, `--mock`, `--data-dir`.
   - Initialize persistence layer.
   - Detect existing sessions.
   - Initialize state engine.
   - Mount TUI with Ink.
2. Support commands via environment variables:
   - `LOGOS_USE_MOCK_LLM=true` → use mock provider.
   - `LOGOS_DATA_DIR` → set persistence directory.
   - `LOGOS_PROFILE_DIR` → set profile directory.
3. Wire the application layer between state engine and TUI.

## Files / Areas Likely Affected

- `src/cli/main.ts` (update)
- `src/application/runtime.ts` (new — wires everything together)

## Acceptance Criteria

- `logos` starts the TUI.
- `logos --mock` runs with mock LLM provider.
- `logos --profile startup` pre-selects a profile.
- `logos --session <id>` resumes a session.
- Exit on SIGINT/SIGTERM with auto-save.

## Tests / Validation

- CLI smoke test: `logos --help` prints usage.
- CLI smoke test: `logos --mock` starts and renders idle screen.
- Manual: run TUI, navigate, exit.

## Dependencies

- Step 13.1 — Persistence
- Step 8.2 — TUI shell
- Step 7.1 — Mock provider

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
