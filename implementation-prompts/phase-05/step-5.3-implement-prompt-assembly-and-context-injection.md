# Implement Step 5.3 — Implement prompt assembly and context injection

You are implementing Step 5.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 5.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 5.3;
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

Implement **only** Step 5.3.

## Objective

Assemble the final LLM request: combine the selected prompt template with conversation context, node definition, accepted dependencies, and global context, respecting token budget.

## Why This Step Exists

Prompt assembly determines what the LLM sees. Context must be assembled in priority order, with deterministic budget rules, to produce consistent and relevant agent turns.

## Required Inputs

- `docs/05-prompt-orchestration-spec.md` §7-8

## Relevant Docs

- `docs/05-prompt-orchestration-spec.md`
- `docs/architecture/05-llm-integration-architecture.md`

## Tasks

1. Create `src/prompt-orchestration/prompt-assembler.ts`:
   - `assemblePromptRequest(input: PromptAssemblyInput): LlmRequest`
   - Context assembly priority:
     1. Current system instruction (from selected prompt).
     2. Active node definition (`canonicalQuestion`, `coverageTopics`, `sufficiencyCriteria`).
     3. Current lifecycle and prompt state.
     4. Latest user message.
     5. Recent node conversation (last N messages, respecting budget).
     6. Node conversation summary (if conversation is long).
     7. Accepted prerequisite node answers.
     8. Global project context.
     9. Profile metadata.
   - Attach output schema (`AgentTurnOutput` schema reference).
   - Include allowed actions as constraints.
   - Estimate and cap token usage.

## Files / Areas Likely Affected

- `src/prompt-orchestration/prompt-assembler.ts` (new)

## Acceptance Criteria

- Assembled prompt includes system instruction, node definition, and conversation context.
- Context is ordered by priority.
- Output schema reference is attached.
- Token budget is respected (conversation is truncated if needed, with summary fallback).
- Accepted dependency answers are injected in dependency order.

## Tests / Validation

- Unit test: assemble prompt for `not_started` node → includes canonical question.
- Unit test: assemble prompt for `active` node → includes recent messages.
- Unit test: long conversation → includes summary, not full history.
- Unit test: accepted dependencies included when relevant.
- Unit test: output schema reference present.

## Dependencies

- Step 5.2 — Prompt selection
- Step 4.3 — Conversation summary

## Implementation Constraints

- Preserve module boundaries. Do not add features not requested. **Phase 5 checkpoint**.

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
