# Implement Step 3.6 — Implement completeness evaluation

You are implementing Step 3.6 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 3.6
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 3.6, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 3.6;
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

Implement **only** Step 3.6. Do **not** implement later roadmap steps.

## Objective

Implement the logic that evaluates whether a node's conversation has produced sufficient quality to synthesize a canonical answer.

## Why This Step Exists

Completeness evaluation determines when `answered` can transition to `ready_for_synthesis`, and when `ready_for_synthesis` has sufficient coverage. Without it, the engine cannot decide when to synthesize.

## Required Inputs

- `docs/11-conversation-quality-and-completeness.md`
- `docs/04-node-lifecycle-and-question-state.md` §9

## Relevant Docs

- `docs/11-conversation-quality-and-completeness.md`
- `docs/04-node-lifecycle-and-question-state.md`
- `docs/06-agent-turn-contract.md` §7

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 3.4 (lifecycle transitions).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/state-engine/completeness.ts`:
   - `evaluateCompleteness(nodeState: NodeRuntimeState, nodeDef: NodeDefinition): CompletenessState`
   - For each `coverageTopic` in `nodeDef`, evaluate as `"missing" | "weak" | "sufficient"`.
   - A topic is `"missing"` if not addressed at all.
   - A topic is `"weak"` if addressed vaguely or generically.
   - A topic is `"sufficient"` if addressed with specificity.
   - `complete` is `true` only when all required topics are `"sufficient"` and there are no `blockingIssues`.
2. Implement specificity heuristics:
   - Generic claims → weak
   - Vague value propositions → weak
   - Undefined problem → weak
   - Solution language without reasoning → weak
3. Contradiction detection: flag contradictory statements as `blockingIssues`.
4. Initially, this function may use simple heuristics (keyword matching, length checks). The LLM-assisted evaluation will enhance accuracy in later phases.

## Files / Areas Likely Affected

- `src/state-engine/completeness.ts` (new)
- `src/state-engine/state-engine.ts` (update — use completeness in transition guards)

## Acceptance Criteria

- Empty conversation → all topics `"missing"`, `complete: false`.
- Conversation covers all topics with specific content → all topics `"sufficient"`, `complete: true`.
- Contradictory statements generate `blockingIssues`.
- `ready_for_synthesis` transition guard uses completeness check.

## Tests / Validation

- Unit test: empty node → not complete.
- Unit test: complete coverage → `complete: true`.
- Unit test: missing one topic → `complete: false` with topic listed in `missing`.
- Unit test: contradiction → `blockingIssues` populated.
- Call `evaluateCompleteness` from transition guard: verify `answered → ready_for_synthesis` is blocked when incomplete.

## Dependencies

- Step 3.4 — Lifecycle transitions

## Implementation Constraints

- Preserve module boundaries.
- Start with simple heuristics; LLM enhancement comes later.
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

