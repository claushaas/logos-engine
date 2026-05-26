# Implement Step 10.1 — Implement initial question flow (not_started → active)

You are implementing Step 10.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 10.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 10.1;
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

Implement **only** Step 10.1.

## Objective

Implement the full interaction: user selects a not_started node → agent generates initial question from canonical question → user answers → engine transitions to active.

## Why This Step Exists

This is the entry point for every node's conversation. The initial question must be generated from the canonical question, not a static template.

## Required Inputs

- `docs/13-prototypes.md` §3.3 — not_started state prototype
- Flow A §4.1 step 3

## Relevant Docs

- `docs/13-prototypes.md` §3.3, §4.1
- `docs/05-prompt-orchestration-spec.md` §5.1

## Tasks

1. Wire the `not_started` lifecycle through the full pipeline:
   - Node selected → state engine initializes `NodeRuntimeState` as `not_started`.
   - Prompt orchestrator selects `initial` prompt.
   - LLM (mock or real) generates initial question as `AgentTurnOutput`.
   - State engine validates and applies: assistant message appended, lifecycle → `active`.
   - TUI renders: agent message with initial question, input enabled, actions: answer/skip/ask_for_example.
2. User types answer → dispatch `USER_MESSAGE` → engine evaluates → lifecycle may transition to `answered`, `needs_clarification`, etc.
3. Ensure the initial question paraphrases the canonical question.

## Files / Areas Likely Affected

- `src/application/use-cases/submit-user-message.ts` (new)
- `src/application/use-cases/select-node.ts` (new)
- `src/tui/components/ConversationPanel.tsx`

## Acceptance Criteria

- Selecting a `not_started` node shows the initial question immediately.
- The initial question is specific to the node context.
- Answering moves the node to `active` or beyond.
- Skip action transitions to deferred.

## Tests / Validation

- E2E harness test: not_started → active flow with mock LLM.
- Unit test: initial prompt selection for not_started node.
- Manual TUI walkthrough.

## Dependencies

- Step 7.2 — Conversation harness
- Step 8.3 — Node-focused rendering

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
