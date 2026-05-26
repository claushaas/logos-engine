# Implement Step 7.1 — Implement MockLlmProvider with fixture-based responses

You are implementing Step 7.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 7.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 7.1;
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

Implement **only** Step 7.1.

## Objective

Build a mock LLM provider that returns predetermined `AgentTurnOutput` fixtures based on node lifecycle, enabling development and testing without real LLM calls.

## Why This Step Exists

The entire TUI and state engine can be prototyped and tested without LLM credentials or network access. This is a non-negotiable requirement from the testing architecture.

## Required Inputs

- `docs/architecture/05-llm-integration-architecture.md` §11
- `docs/13-prototypes.md` §6.7 — mock agent function

## Relevant Docs

- `docs/architecture/05-llm-integration-architecture.md`
- `docs/architecture/09-testing-architecture.md`
- `docs/13-prototypes.md` §6.7

## Tasks

1. Create `src/llm/mock-provider.ts`:
   - `MockLlmProvider` implementing the `LlmProvider` interface.
   - `fixtures: Record<string, AgentTurnOutput>` — keyed by lifecycle state.
   - `generateStructuredOutput(request: LlmRequest): Promise<LlmResponse>` — returns fixture based on node lifecycle detected in request context.
   - Fixture responses for each lifecycle:
     - `not_started` → initial question
     - `active` / `answered` → follow-up question
     - `needs_clarification` → clarification request
     - `needs_refinement` → refinement request
     - `ready_for_synthesis` → canonical answer draft
     - `synthesized` → review prompt
     - `blocked` → blocker explanation
     - `accepted` → confirmation
   - Support for custom fixtures passed in constructor.
2. Implement `setFixture(lifecycle: NodeLifecycle, output: AgentTurnOutput)` for test-specific overrides.

## Files / Areas Likely Affected

- `src/llm/mock-provider.ts` (new)
- `src/llm/index.ts` (update)

## Acceptance Criteria

- Mock provider returns `AgentTurnOutput` for each lifecycle state.
- Fixtures can be overridden per test.
- Mock provider does not make network calls.
- Response includes all required `AgentTurnOutput` fields.

## Tests / Validation

- Unit test: mock returns initial question for `not_started`.
- Unit test: mock returns review prompt for `synthesized`.
- Unit test: custom fixture overrides default.
- Unit test: mock response passes `validateAgentTurnOutput`.

## Dependencies

- Step 6.1 — AgentTurnOutput validator
- Step 1.3 — AgentTurnOutput type

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
