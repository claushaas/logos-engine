# Implement Step 6.1 — Define AgentTurnOutput validation schema

You are implementing Step 6.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 6.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 6.1;
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

Implement **only** Step 6.1.

## Objective

Create a validation function using Zod (already in `package.json`) that validates `AgentTurnOutput` against the contract, including lifecycle transition validity, action validity, and content rules. Note: hand-rolled validators are reserved only for runtime-critical paths if Zod performance becomes an issue.

## Why This Step Exists

Every LLM output must be validated before state mutation. The validator is the gatekeeper that prevents the LLM from corrupting state.

## Required Inputs

- `docs/06-agent-turn-contract.md` §10 — validation rules
- Contract types from Step 1.3

## Relevant Docs

- `docs/06-agent-turn-contract.md`
- `docs/architecture/05-llm-integration-architecture.md`

## Tasks

1. Create `src/validation/agent-turn-validator.ts`:
   - `validateAgentTurnOutput(output: unknown): Result<AgentTurnOutput, ValidationError[]>`
   - Schema-level validation:
     - `userFacingMessage` must be non-empty string.
     - `proposedLifecycle` must be a valid `NodeLifecycle` value.
     - `proposedPromptState` must be a valid `PromptState` value.
     - `canonicalAnswerDraft`, if present, must have required fields.
     - `transitionIntent`, if present, must have `event` and `reason`.
   - Semantic validation:
     - Proposed lifecycle transition must be valid given current node state.
     - `canonicalAnswerDraft` must not be generated in disallowed states.
     - `accepted` lifecycle must not be proposed without explicit user accept event.
     - Suggested actions must be compatible with current/proposed lifecycle.
     - Completeness must not contradict lifecycle.
   - Returns all validation errors (not just the first).

## Files / Areas Likely Affected

- `src/validation/agent-turn-validator.ts` (new)
- `src/validation/index.ts` (new)

## Acceptance Criteria

- Empty `userFacingMessage` → validation error.
- `proposedLifecycle: "accepted"` when current state is `not_started` → validation error.
- `canonicalAnswerDraft` with `proposedLifecycle: "not_started"` → validation error.
- Valid `AgentTurnOutput` passes all checks.
- All validation errors are returned as a list.

## Tests / Validation

- Unit test: valid output passes.
- Unit test: empty message → error.
- Unit test: impossible transition → error.
- Unit test: draft in wrong state → error.
- Unit test: missing required fields → error.
- Unit test: multiple errors reported at once.

## Dependencies

- Step 1.3 — AgentTurnOutput types
- Step 3.4 — Lifecycle transition validation

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
