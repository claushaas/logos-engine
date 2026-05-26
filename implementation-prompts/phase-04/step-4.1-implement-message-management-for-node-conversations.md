# Implement Step 4.1 — Implement message management for node conversations

You are implementing Step 4.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 4.1
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 4.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 4.1;
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

Use the advisor **before implementation** and **before final report**.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 4.1. Do **not** implement later roadmap steps.

## Objective

Implement functions to append messages to a node's conversation, retrieve conversation history, and manage message metadata.

## Why This Step Exists

Node-scoped conversations are the fundamental data container for all user and agent interactions. The state engine needs these functions to record turns.

## Required Inputs

- `docs/03-conversation-runtime-spec.md` §4-5
- Contract types from Step 1.3

## Relevant Docs

- `docs/03-conversation-runtime-spec.md`
- `docs/13-prototypes.md`

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap — existing `src/interview/` directory.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 1.3 (message types), Step 3.8 (state engine dispatch).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/conversation-runtime/messages.ts`:
   - `appendUserMessage(state, nodeId, content): StateEngineResult`
   - `appendAssistantMessage(state, nodeId, content, metadata): StateEngineResult`
   - `appendSystemMessage(state, nodeId, content): StateEngineResult`
   - `getConversation(state, nodeId): NodeMessage[]`
   - `getRecentMessages(state, nodeId, limit: number): NodeMessage[]`
2. Update `lastUserMessageId` and `lastAssistantMessageId` on append.
3. Guard: user messages can only be added in node-focused mode with `activeNodeId === nodeId`.
4. Guard: assistant messages record `promptState` and `promptId` in metadata.

## Files / Areas Likely Affected

- `src/conversation-runtime/messages.ts` (new)
- `src/conversation-runtime/index.ts` (new)

## Acceptance Criteria

- User messages are appended with role `"user"`, timestamp, and unique ID.
- Assistant messages include metadata: `promptId`, `promptState`, `structuredOutputId`.
- `getConversation` returns messages in chronological order.
- Appending to a non-active node is rejected.

## Tests / Validation

- Unit test: append user message → appears in conversation.
- Unit test: append assistant message with metadata → metadata preserved.
- Unit test: append to non-active node → error.
- Unit test: `getRecentMessages(limit: 3)` returns last 3 messages.
- Unit test: message IDs are unique and sortable.

## Dependencies

- Step 1.3 — Message types
- Step 3.8 — State engine dispatch

## Implementation Constraints

- Preserve module boundaries.
- Do not add features not requested.

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

