# Implement Step 4.3 — Implement conversation summary generation

You are implementing Step 4.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 4.3
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 4.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 4.3;
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

Implement **only** Step 4.3. Do **not** implement later roadmap steps.

## Objective

Implement a deterministic function that produces a node-level conversation summary for prompt compression in long conversations.

## Why This Step Exists

Long conversations consume context window budget. A summary allows the prompt orchestrator to include relevant context without exceeding token limits.

## Required Inputs

- `docs/03-conversation-runtime-spec.md` §10
- `docs/05-prompt-orchestration-spec.md` §8 — context budget

## Relevant Docs

- `docs/03-conversation-runtime-spec.md`
- `docs/05-prompt-orchestration-spec.md`

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 4.1 (message management).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/conversation-runtime/summarizer.ts`:
   - `summarizeConversation(messages: NodeMessage[]): string`
   - Extract key points: facts, decisions, assumptions mentioned.
   - Do not replace raw messages; summary is supplementary.
   - Reference source message IDs in summary text.
   - Keep summary concise (target ~200 tokens worth of text).

## Files / Areas Likely Affected

- `src/conversation-runtime/summarizer.ts` (new)

## Acceptance Criteria

- Summary is shorter than original conversation.
- Summary mentions extracted facts and decisions.
- Raw messages remain intact and accessible.

## Tests / Validation

- Unit test: generate summary from multi-turn conversation.
- Unit test: summary length < 50% of conversation length.
- Unit test: summary includes reference to key claim from messages.

## Dependencies

- Step 4.1 — Message management

## Implementation Constraints

- Preserve module boundaries.
- This is a **Phase 4 checkpoint**.

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
 Note: this completes Phase 4.
