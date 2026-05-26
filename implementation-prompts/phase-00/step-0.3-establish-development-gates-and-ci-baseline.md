# Implement Step 0.3 — Establish development gates and CI baseline

You are implementing Step 0.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 0.3
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 0.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 0.3;
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

### Before implementation

Use the advisor to review:

- Your understanding of Step 0.3;
- The allowed scope;
- Relevant files found in the repository;
- Your implementation plan;
- Risks of implementing future steps accidentally;
- Risks of violating module boundaries;
- Required tests;
- Acceptance criteria;
- Mismatches between roadmap assumptions and repository reality.

Incorporate the advisor's recommendations before editing code.

### Before final report

After implementing and before final response, use the advisor again to review:

- Whether the implementation stayed within Step 0.3;
- Whether acceptance criteria were met;
- Whether tests are sufficient;
- Whether validation gates were run;
- Whether the execution board update recommendation is correct;
- Whether follow-up is required.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 0.3.

Do **not** implement later roadmap steps unless strictly required to make this step compile. If such adaptation is necessary, document it as a deviation.

## Objective

Configure pre-commit hooks, CI scripts, and quality gates that enforce architecture boundaries, type safety, and test coverage from day one.

## Why This Step Exists

Architecture drift is the primary risk. Catching boundary violations at commit time prevents the codebase from becoming entangled as it grows.

## Required Inputs

- `package.json` scripts
- `biome.json`
- `vitest.config.ts`

## Relevant Docs

- `docs/architecture/09-testing-architecture.md`
- `docs/architecture/10-local-development-and-deployment.md`
- `docs/architecture/11-architecture-decision-records.md`

## Required Initial Analysis

Before editing code:

1. Inspect the repository structure — focus on config files.
2. Locate existing files: `package.json`, `biome.json`, `vitest.config.ts`, `.github/`, `CONTRIBUTING.md`.
3. Identify existing implementation overlap — existing `package.json` already has `check`, `typecheck`, `lint`, `test` scripts.
4. Determine whether this step is greenfield, migration, or adaptation — **adaptation**: enhance existing gates.
5. Identify dependencies already implemented — Steps 0.1, 0.2.
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Add `pnpm check` script: `pnpm typecheck && pnpm lint && pnpm test`.
2. Configure Vitest with coverage thresholds (aim for ≥80% on state engine, ≥60% overall initially).
3. Add `pnpm lint:boundaries` script using dependency-cruiser or eslint-plugin-import to enforce module boundary rules.
4. Document the quality gate in `CONTRIBUTING.md`.
5. Verify `pnpm check` passes on the baseline code.
6. Add a `pnpm check:ci` script that runs in CI with stricter settings.

## Files / Areas Likely Affected

- `package.json` (scripts)
- `vitest.config.ts`
- `biome.json`
- `.github/workflows/` (if CI configs exist)
- `CONTRIBUTING.md`

## Acceptance Criteria

- `pnpm check` passes on the Phase 0 baseline.
- Boundary lint catches `tui/` importing from `llm/provider.ts` directly.
- Coverage reports are generated.
- Pre-commit hook or CI step runs `pnpm check`.

## Tests / Validation

- Verify boundary lint rule catches a deliberate violation.
- `pnpm check` exits 0 on clean code, non-zero on type/lint/test failure.

## Dependencies

- Step 0.1 — Project structure
- Step 0.2 — Shared primitives

## Implementation Constraints

- Preserve module boundaries.
- Keep the implementation minimal and directly aligned with this step.
- Do not add features not requested by this step.
- Do not weaken existing tests.
- Do not remove existing behavior unless required by this step.
- If the roadmap conflicts with repository reality, document the mismatch and choose the smallest safe adaptation.

## Required Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm check
```

## Execution Board Update

Update or recommend updating `implementation-prompts/00-execution-board.md`.

### Rules

- When starting the step, status should become `🔵 In progress`.
- After implementation and tests, status should become `🟡 Needs review`.
- If blocked, status should become `🔴 Blocked`.
- If a decision is required, status should become `⚠️ Needs decision`.
- Do **not** mark `✅ Done`; that is reserved for human review after merge.
- This is a **Phase 0 checkpoint**: all Phase 0 steps should be reviewed before proceeding to Phase 1.

## Required Final Report

Return a final report with:

```md
# Step 0.3 Report
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
| Notes | Phase 0 checkpoint |
| Next Step | Step 1.1 — Define LogosProfile and node definition types |
## Deviations From Roadmap
## Follow-up Required
```
