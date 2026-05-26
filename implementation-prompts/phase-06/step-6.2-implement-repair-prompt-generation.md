# Implement Step 6.2 — Implement repair prompt generation

You are implementing Step 6.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 6.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 6.2;
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

Implement **only** Step 6.2.

## Objective

When `AgentTurnOutput` fails validation, generate a repair prompt that includes the original request, the validation errors, and instructions to regenerate.

## Why This Step Exists

LLM outputs will sometimes fail validation. The repair loop allows the system to recover without user intervention, as long as the LLM can produce a valid output on retry.

## Required Inputs

- `docs/05-prompt-orchestration-spec.md` §11
- `docs/architecture/05-llm-integration-architecture.md` §7

## Relevant Docs

- `docs/05-prompt-orchestration-spec.md`
- `docs/architecture/05-llm-integration-architecture.md`

## Tasks

1. Create `src/validation/repair-prompt.ts`:
   - `buildRepairPrompt(originalRequest: LlmRequest, errors: ValidationError[]): LlmRequest`
   - Includes original system prompt, messages, and schema.
   - Adds repair instructions: "Your previous output failed validation. Fix these errors: ..."
   - Lists specific validation errors with clear descriptions.
   - Does not re-ask the original task; only asks for structural repair.
2. Implement retry limit (default: 3 attempts).
3. On final failure, return `repair_failed` error with diagnostics.

## Files / Areas Likely Affected

- `src/validation/repair-prompt.ts` (new)

## Acceptance Criteria

- Repair prompt includes original context and error details.
- Retry loop stops after N attempts.
- Final failure produces a recoverable error, not a crash.

## Tests / Validation

- Unit test: repair prompt contains error messages.
- Unit test: retry counter increments.
- Unit test: max retries exceeded → error returned.

## Dependencies

- Step 6.1 — AgentTurnOutput validator

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
