# Implement Step 0.2 — Define shared primitives and utility types

You are implementing Step 0.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 0.2
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 0.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 0.2;
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

- Your understanding of Step 0.2;
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

- Whether the implementation stayed within Step 0.2;
- Whether acceptance criteria were met;
- Whether tests are sufficient;
- Whether validation gates were run;
- Whether the execution board update recommendation is correct;
- Whether follow-up is required.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 0.2.

Do **not** implement later roadmap steps unless strictly required to make this step compile. If such adaptation is necessary, document it as a deviation.

## Objective

Define foundational types and utilities that all modules depend on: `Result<T, E>`, `Brand<T, B>`, ID generation, date utilities, invariant checks, and the `LogosError` base class.

## Why This Step Exists

These types are the "standard library" of the LOGOS Engine. Every module will use `Result`, branded IDs, and invariants. Defining them first prevents duplication and inconsistent error handling.

## Required Inputs

- Architecture documents that reference `Result` and `Brand` patterns.
- Existing `src/shared/` code.

## Relevant Docs

- `docs/architecture/08-error-handling-and-recovery.md`
- `docs/architecture/03-module-boundaries.md`

## Required Initial Analysis

Before editing code:

1. Inspect the repository structure — focus on `src/shared/`.
2. Locate existing files: `src/shared/types/`, `src/shared/utils/`, `src/shared/errors/`, `src/shared/index.ts`.
3. Identify existing implementation overlap — audit what already exists in shared.
4. Determine whether this step is greenfield, migration, or adaptation — likely **adaptation** of existing shared code.
5. Identify dependencies already implemented — Step 0.1 (structure baseline).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Audit existing `src/shared/` code (`Result.ts`, `Brand.ts`, `id.ts`, `date.ts`, `invariant.ts`, `LogosError.ts`).
2. Ensure `Result<T, E>` is a discriminated union with `ok: true` / `ok: false`.
3. Define branded types for domain IDs: `NodeId`, `DocumentId`, `SessionId`, `ProfileId`, `PromptId`.
4. Define `LogosError` base class with `code`, `category`, `recoverable`, `userFacingMessage`, `details`.
5. Ensure `invariant(condition, message)` throws `LogosError`.
6. Ensure `generateId()` produces stable, sortable IDs.
7. Export all shared types from `src/shared/index.ts`.

## Files / Areas Likely Affected

- `src/shared/types/Result.ts`
- `src/shared/types/Brand.ts`
- `src/shared/utils/id.ts`
- `src/shared/utils/date.ts`
- `src/shared/errors/LogosError.ts`
- `src/shared/errors/invariant.ts`
- `src/shared/index.ts`

## Acceptance Criteria

- `Result` type is a proper discriminated union.
- `NodeId`, `DocumentId`, etc. are distinct branded string types (not assignable to each other).
- `invariant` throws `LogosError` with code and category.
- `generateId()` returns non-colliding, lexicographically sortable strings.
- Unit tests cover all primitives.

## Tests / Validation

- Unit tests for `Result` construction and narrowing.
- Unit tests for `Brand` type identity (TypeScript-level).
- Unit tests for `invariant` throwing behavior.
- Unit tests for `generateId` uniqueness and sortability.
- Unit tests for `LogosError` property access.

## Dependencies

- Step 0.1 — Project structure

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
pnpm test
```

## Execution Board Update

Update or recommend updating `implementation-prompts/00-execution-board.md`.

### Rules

- When starting the step, status should become `🔵 In progress`.
- After implementation and tests, status should become `🟡 Needs review`.
- If blocked, status should become `🔴 Blocked`.
- If a decision is required, status should become `⚠️ Needs decision`.
- Do **not** mark `✅ Done`; that is reserved for human review after merge.

## Required Final Report

Return a final report with:

```md
# Step 0.2 Report
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
| Next Step | Step 0.3 — Establish development gates and CI baseline |
## Deviations From Roadmap
## Follow-up Required
```
