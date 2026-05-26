# Implement Step 6.3 — Implement AgentTurnOutput application to state

You are implementing Step 6.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 6.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 6.3;
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

Implement **only** Step 6.3.

## Objective

After validation passes, apply the `AgentTurnOutput` to the runtime state: append assistant message, update lifecycle, update prompt state, store canonical answer draft, update completeness, update extracted data, recompute allowed actions.

## Why This Step Exists

This is the "apply effects" step in the runtime pipeline. It translates validated LLM output into deterministic state changes.

## Required Inputs

- `docs/06-agent-turn-contract.md` §11
- `docs/architecture/02-runtime-architecture.md` §8

## Relevant Docs

- `docs/06-agent-turn-contract.md`
- `docs/02-state-engine-canonical-spec.md`

## Tasks

1. Create `src/application/apply-agent-turn.ts`:
   - `applyAgentTurn(state, nodeId, output: AgentTurnOutput): StateEngineResult`
   - Append assistant message with `userFacingMessage` as content and metadata from output.
   - If `proposedLifecycle` is set and valid, transition node lifecycle.
   - If `proposedPromptState` is set, update node prompt state.
   - If `canonicalAnswerDraft` is present, store it.
   - If `completenessEvaluation` is present, merge with existing completeness (LLM evaluation is advisory).
   - If `extracted` is present, merge extracted data.
   - If `transitionIntent` is present, log the intent.
   - Recompute `allowedActions`.
   - Recompute document readiness.
   - Generate and return snapshot.
2. **Important:** The LLM `proposedLifecycle` is treated as a proposal. The state engine guard still validates the transition before applying.

## Files / Areas Likely Affected

- `src/application/apply-agent-turn.ts` (new)
- `src/application/index.ts` (new)

## Acceptance Criteria

- Assistant message is appended to active node conversation.
- Lifecycle is updated only if proposed transition is valid.
- Canonical answer draft is stored if present.
- `allowedActions` and document readiness recompute after application.
- Invalid proposed transitions are caught by guards (not silently applied).

## Tests / Validation

- Integration test: apply valid `AgentTurnOutput` → state updated correctly.
- Integration test: apply output with invalid lifecycle → rejected, error returned.
- Unit test: canonical answer draft stored → appears in node state.
- Unit test: completeness merged correctly.

## Dependencies

- Step 6.1 — Validation
- Step 3.8 — State engine dispatch
- Step 4.2 — Canonical answer management

## Implementation Constraints

- Preserve module boundaries. Do not add features not requested. **Phase 6 checkpoint**.

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
