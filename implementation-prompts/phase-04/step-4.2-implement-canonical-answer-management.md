# Implement Step 4.2 — Implement canonical answer management

You are implementing Step 4.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 4.2
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 4.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 4.2;
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

Implement **only** Step 4.2. Do **not** implement later roadmap steps.

## Objective

Implement canonical answer creation, staleness marking, acceptance, and source traceability.

## Why This Step Exists

Canonical answers are the clean output of a node's conversation. They must be stored separately from raw messages, tracked for staleness, and linked to source messages.

## Required Inputs

- `docs/03-conversation-runtime-spec.md` §8-9
- `docs/06-agent-turn-contract.md` §5

## Relevant Docs

- `docs/03-conversation-runtime-spec.md`
- `docs/06-agent-turn-contract.md`
- `docs/13-prototypes.md` — State 3.7 (Synthesized)

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 4.1 (message management), Step 3.4 (lifecycle transitions).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/conversation-runtime/canonical-answers.ts`:
   - `setCanonicalAnswerDraft(state, nodeId, draft: CanonicalAnswerDraft): StateEngineResult`
   - `acceptCanonicalAnswer(state, nodeId): StateEngineResult`
   - `markCanonicalAnswerStale(state, nodeId): StateEngineResult`
   - `regenerateCanonicalAnswer(state, nodeId): StateEngineResult` — marks old as stale, allows new draft.
2. Staleness rules (from spec):
   - New user message added → mark stale.
   - User edits canonical answer → mark stale.
   - Node reopened from `accepted` → mark stale.
   - Upstream dependency changes materially → mark stale.
   - Completeness changes from sufficient to weak/missing → mark stale.
3. Guard: can only accept when lifecycle is `synthesized`.
4. Guard: can only generate draft when lifecycle is `ready_for_synthesis` or during `synthesized` regeneration.
5. `acceptedAt` timestamp is set when canonical answer is accepted.

## Files / Areas Likely Affected

- `src/conversation-runtime/canonical-answers.ts` (new)
- `src/conversation-runtime/index.ts`

## Acceptance Criteria

- Draft set correctly with `generatedFromMessageIds`.
- Acceptance sets `accepted: true` and records `acceptedAt`.
- New user message after acceptance marks answer stale.
- Reopening an `accepted` node marks answer stale.
- Accepting when lifecycle is not `synthesized` → error.

## Tests / Validation

- Unit test: set draft → answer appears in node state.
- Unit test: accept → `accepted: true`.
- Unit test: new user message → `stale: true`.
- Unit test: accept in wrong lifecycle → error.
- Unit test: regenerate → old marked stale, new draft assigned.

## Dependencies

- Step 4.1 — Message management
- Step 3.4 — Lifecycle transitions

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

