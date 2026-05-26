# Implement Step 1.3 — Define NodeMessage, AgentTurnOutput, and conversation contracts

You are implementing Step 1.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 1.3
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 1.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 1.3;
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

You must use the PI advisor extension:

```txt
@juicesharp/rpiv-advisor
```

Use the advisor **before implementation** to review your plan, scope, risks, and acceptance criteria.

Use the advisor **before final report** to review implementation completeness, test sufficiency, gate results, and execution board update.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 1.3. Do **not** implement later roadmap steps.

## Objective

Define the message model, conversation model, and the structured AgentTurnOutput contract that the LLM must produce.

## Why This Step Exists

Messages are the raw material of conversations. `AgentTurnOutput` is the bridge between LLM generation and state engine application. Both must be precisely typed before any runtime code is written.

## Required Inputs

- `docs/03-conversation-runtime-spec.md`
- `docs/06-agent-turn-contract.md`

## Relevant Docs

- `docs/03-conversation-runtime-spec.md`
- `docs/06-agent-turn-contract.md`
- `docs/architecture/07-contracts-and-schemas.md`

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 1.2 (runtime state types).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/contracts/conversation.ts` with:
   - `NodeMessage` with `id`, `role`, `content`, `createdAt`, `metadata?`.
   - `NodeMessageMetadata` with `promptId?`, `promptState?`, `model?`, `structuredOutputId?`, `stateBefore?`, `stateAfter?`.
   - `NodeConversation` with `nodeId`, `messages`, `summary?`, `lastUserMessageId?`, `lastAssistantMessageId?`.

2. Create `src/contracts/agent-turn.ts` with:
   - `AgentTurnOutput` with `userFacingMessage`, `proposedLifecycle?`, `proposedPromptState?`, `canonicalAnswerDraft?`, `completenessEvaluation?`, `extracted?`, `suggestedActions?`, `transitionIntent?`, `diagnostics?`.
   - `TransitionIntent` with `event` (union of transition event names) and `reason`.
   - `AgentDiagnostic` type.

3. Ensure `AgentTurnOutput` fields reference existing types: `NodeLifecycle`, `PromptState`, `CanonicalAnswerDraft`, `CompletenessState`, `ExtractedNodeData`, `NodeAction`.

## Files / Areas Likely Affected

- `src/contracts/conversation.ts` (new)
- `src/contracts/agent-turn.ts` (new)
- `src/contracts/index.ts`

## Acceptance Criteria

- `NodeMessage.role` is `"user" | "assistant" | "system"`.
- `AgentTurnOutput.userFacingMessage` is required (must be non-empty for valid output).
- `AgentTurnOutput.proposedLifecycle` is constrained to `NodeLifecycle` values.
- `TransitionIntent.event` covers all lifecycle-related events.

## Tests / Validation

- TypeScript compilation: construct valid and invalid `AgentTurnOutput` objects.
- Schema validation test: verify that an `AgentTurnOutput` with empty `userFacingMessage` is rejected by a validation function.

## Dependencies

- Step 1.2 — Runtime state types

## Implementation Constraints

- Preserve module boundaries.
- Keep the implementation minimal.
- Do not add features not requested.
- Do not weaken existing tests.

## Required Commands

```bash
pnpm typecheck
pnpm test
```

## Execution Board Update

Update or recommend updating `implementation-prompts/00-execution-board.md`.

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

