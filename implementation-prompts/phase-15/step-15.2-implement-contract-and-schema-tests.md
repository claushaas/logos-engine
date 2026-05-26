# Implement Step 15.2 — Implement contract and schema tests

You are implementing Step 15.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 15.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 15.2;
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

Implement **only** Step 15.2.

## Objective

Validate all type contracts with runtime schema checks, fixture validation, and shape assertions.

## Why This Step Exists

TypeScript types provide compile-time safety. Runtime schema tests catch mismatches between docs, types, and actual data shapes.

## Required Inputs

- `docs/architecture/09-testing-architecture.md` §6
- `docs/architecture/07-contracts-and-schemas.md` §13

## Relevant Docs

- `docs/architecture/09-testing-architecture.md`
- `docs/architecture/07-contracts-and-schemas.md`

## Tasks

1. Create `tests/contracts/profile-schema.test.ts` — validate example profiles.
2. Create `tests/contracts/agent-turn-schema.test.ts` — validate mock LLM outputs.
3. Create `tests/contracts/runtime-state-schema.test.ts` — validate state snapshots.
4. Create `tests/contracts/render-snapshot.test.ts` — validate render snapshots.

## Files / Areas Likely Affected

- `tests/contracts/profile-schema.test.ts` (new)
- `tests/contracts/agent-turn-schema.test.ts` (new)
- `tests/contracts/runtime-state-schema.test.ts` (new)
- `tests/contracts/render-snapshot.test.ts` (new)

## Acceptance Criteria

- Valid fixtures pass schema checks.
- Intentionally broken fixtures fail with specific errors.
- All contract types have at least one valid example fixture.

## Tests / Validation

- These ARE the tests.

## Dependencies

- Phase 1 — All contract types

## Implementation Constraints

- Tests must run without LLM credentials.

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
