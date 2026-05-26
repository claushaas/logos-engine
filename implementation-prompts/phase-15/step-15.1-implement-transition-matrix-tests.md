# Implement Step 15.1 — Implement transition matrix tests

You are implementing Step 15.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 15.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 15.1;
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

Implement **only** Step 15.1.

## Objective

Create a comprehensive test suite that validates every valid lifecycle transition and rejects every invalid one. Use a transition matrix approach.

## Why This Step Exists

The lifecycle state machine is the core of the system. Exhaustive transition testing prevents regression in the most critical logic.

## Required Inputs

- `docs/04-node-lifecycle-and-question-state.md` §6-7
- `docs/architecture/09-testing-architecture.md` §5

## Relevant Docs

- `docs/04-node-lifecycle-and-question-state.md`
- `docs/architecture/09-testing-architecture.md`
- `docs/13-prototypes.md` §1.2

## Tasks

1. Create `tests/state-engine/transition-matrix.test.ts`:
   - For each `from` lifecycle × `to` lifecycle combination (10 × 10 = 100 combinations):
     - Assert expected validity (valid or invalid).
   - Use a test table approach for maintainability.
2. Cover edge cases:
   - `blocked → not_started` when dependency resolved.
   - `deferred → active` via resume.
   - `synthesized → accepted` (valid).
   - `synthesized → accepted` after user accept event only.
3. Ensure all invalid transitions from `04-node-lifecycle-and-question-state.md` §7 are tested.

## Files / Areas Likely Affected

- `tests/state-engine/transition-matrix.test.ts` (new)

## Acceptance Criteria

- 100 lifecycle transition combinations tested.
- All documented valid transitions pass.
- All documented invalid transitions are rejected.
- Tests run without LLM credentials (pure state engine).

## Tests / Validation

- This step IS the test implementation.

## Dependencies

- Step 3.4 — Lifecycle transitions

## Implementation Constraints

- Do not add features not requested. Tests must run without LLM credentials.

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
