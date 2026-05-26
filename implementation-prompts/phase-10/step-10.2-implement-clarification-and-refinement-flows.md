# Implement Step 10.2 — Implement clarification and refinement flows

You are implementing Step 10.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 10.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 10.2;
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

Implement **only** Step 10.2.

## Objective

Implement the clarification (needs_clarification) and refinement (needs_refinement) interaction paths: agent identifies issue, asks targeted question, user responds, engine re-evaluates.

## Why This Step Exists

These are the quality gates that prevent weak or ambiguous answers from reaching synthesis. Flow B in the prototypes validates this path.

## Required Inputs

- `docs/13-prototypes.md` §3.5-3.6 — clarification and refinement state prototypes
- Flow B §4.2

## Relevant Docs

- `docs/13-prototypes.md` §3.5, §3.6, §4.2
- `docs/11-conversation-quality-and-completeness.md`

## Tasks

1. Implement `needs_clarification` flow:
   - Engine detects ambiguity → lifecycle → `needs_clarification`.
   - Prompt orchestrator selects `clarification` prompt.
   - Agent names the ambiguity, asks one targeted question.
   - User answers → engine re-evaluates.
   - After 3+ clarifications without resolution → suggest deferring or marking as assumption.
2. Implement `needs_refinement` flow:
   - Engine detects weak/generic answer → lifecycle → `needs_refinement`.
   - Prompt orchestrator selects `refinement` prompt.
   - Agent identifies weakness, requests sharper version.
   - After 3+ refinement rounds → offer to accept as-is with low confidence.
3. Both flows preserve conversation context from earlier turns.

## Files / Areas Likely Affected

- `src/state-engine/node-lifecycle.ts` (update)
- `src/application/use-cases/submit-user-message.ts`

## Acceptance Criteria

- Clarification state renders correctly: `?` symbol, agent names ambiguity.
- Refinement state renders correctly: `△` symbol, agent identifies weakness.
- User response is evaluated and may resolve to `active` or progress.
- After 3 failures, system offers fallback options.

## Tests / Validation

- E2E harness test: Flow B.
- Unit test: completeness triggers `needs_clarification` on contradictory input.
- Unit test: completeness triggers `needs_refinement` on generic input.

## Dependencies

- Step 10.1 — Initial question flow
- Step 3.6 — Completeness evaluation

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
