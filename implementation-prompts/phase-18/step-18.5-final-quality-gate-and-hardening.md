# Implement Step 18.5 — Final quality gate and hardening

You are implementing Step 18.5 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 18.5, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 18.5;
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

Implement **only** Step 18.5. This is the **final hardening step** — no new features, only fixes and quality gates.

## Objective

Run the full quality gate (`pnpm check`), fix all failures, ensure all tests pass, verify architecture boundaries, and produce a release-ready baseline.

## Why This Step Exists

The project must pass all gates before being considered implementation-complete. This step is the final hardening pass.

## Required Inputs

- All previous steps

## Relevant Docs

- `docs/architecture/09-testing-architecture.md`
- `docs/architecture/10-local-development-and-deployment.md` §12

## Tasks

1. Run `pnpm check`:
   - `pnpm typecheck` → zero errors.
   - `pnpm lint` → zero warnings.
   - `pnpm test` → all tests pass.
2. Verify architecture boundaries:
   - No TUI → LLM direct imports.
   - No state engine → terminal imports.
   - No LLM module → state mutation imports.
3. Verify mock LLM works for all flows.
4. Verify persistence round-trips.
5. Verify all 10 flow prototypes pass.
6. Verify all 13 state snapshots render.
7. Run manual smoke test: complete first-use flow without real LLM.
8. Document any known limitations in a `LIMITATIONS.md`.

## Files / Areas Likely Affected

- `LIMITATIONS.md` (new)
- Various files (fixes)

## Acceptance Criteria

- `pnpm check` exits 0.
- All 10 flow tests pass.
- All 13 state snapshot tests pass.
- Architecture boundaries enforced.
- Mock LLM flow works end-to-end.

## Tests / Validation

- `pnpm check` includes all gates.

## Dependencies

- All previous phases

## Implementation Constraints

- **This is the final checkpoint.** No new features — only fixes.
- Do not add features not requested.
- If critical issues cannot be resolved, document them in `LIMITATIONS.md`.

## Required Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm check
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
