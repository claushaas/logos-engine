# Implement Step 18.1 — Implement remaining flow tests (E-J)

You are implementing Step 18.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 18.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 18.1;
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

Implement **only** Step 18.1. This is a test-only step.

## Objective

Complete the end-to-end flow test suite for Flows E through J (Deferred, Blocked, Document Preview, Export, Resume, Change Profile).

## Why This Step Exists

Comprehensive flow coverage provides regression protection and validates the architecture.

## Required Inputs

- `docs/13-prototypes.md` §4.5-4.10

## Relevant Docs

- `docs/13-prototypes.md` Part 4
- `docs/architecture/09-testing-architecture.md`

## Tasks

1. Complete Flow E test (Deferred Node).
2. Complete Flow F test (Blocked Node).
3. Complete Flow G test (Document Preview).
4. Complete Flow H test (Export).
5. Complete Flow I test (Resume Session).
6. Complete Flow J test (Change Profile).

## Files / Areas Likely Affected

- `tests/flows/flow-e-deferred.test.ts`
- `tests/flows/flow-f-blocked.test.ts`
- `tests/flows/flow-g-document-preview.test.ts`
- `tests/flows/flow-h-export.test.ts`
- `tests/flows/flow-i-resume.test.ts`
- `tests/flows/flow-j-change-profile.test.ts`

## Acceptance Criteria

- All 10 prototype flows pass as automated tests.
- No LLM credentials required.
- Tests run in CI.

## Tests / Validation

- These ARE the tests.

## Dependencies

- Phase 7 (conversation harness), Phase 13 (persistence), Phase 12 (materialization)

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
