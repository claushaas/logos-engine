# Implement Step 1.2 — Define LogosRuntimeState and NodeRuntimeState types

You are implementing Step 1.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 1.2
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 1.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 1.2;
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

### Before implementation

Use the advisor to review your understanding of Step 1.2, allowed scope, relevant files, implementation plan, risks, tests, acceptance criteria, and mismatches between roadmap and repo.

Incorporate the advisor's recommendations before editing code.

### Before final report

After implementing, use the advisor again to review implementation scope, acceptance criteria, test sufficiency, gate results, execution board update, and follow-up.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 1.2. Do **not** implement later roadmap steps.

## Objective

Define the full runtime state types: `LogosRuntimeState`, `NodeRuntimeState`, `NodeLifecycle`, `PromptState`, `CanonicalAnswer`, `CompletenessState`, and `ExtractedNodeData`.

## Why This Step Exists

These are the most referenced types in the system. The state engine, application layer, persistence, and TUI all depend on them.

## Required Inputs

- `docs/02-state-engine-canonical-spec.md` — `LogosRuntimeState`, session modes
- `docs/04-node-lifecycle-and-question-state.md` — `NodeRuntimeState`, lifecycles
- `docs/11-conversation-quality-and-completeness.md` — `CompletenessState`

## Relevant Docs

- `docs/02-state-engine-canonical-spec.md`
- `docs/03-conversation-runtime-spec.md`
- `docs/04-node-lifecycle-and-question-state.md`
- `docs/11-conversation-quality-and-completeness.md`
- `docs/architecture/07-contracts-and-schemas.md`

## Required Initial Analysis

Before editing code:

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 1.1 (Profile types).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/contracts/runtime-state.ts` with:
   - `SessionMode` union: `"idle" | "profile_selection" | "structure_overview" | "node_focus" | "document_preview" | "export" | "settings" | "error"`
   - `LogosRuntimeState` with all fields as specified in `02-state-engine-canonical-spec.md` §4.
   - `GlobalContext` with project name, summary, preferences.

2. Create `src/contracts/node-state.ts` with:
   - `NodeLifecycle` union: `"not_started" | "active" | "answered" | "needs_clarification" | "needs_refinement" | "ready_for_synthesis" | "synthesized" | "accepted" | "deferred" | "blocked"`
   - `PromptState` union: `"initial" | "follow_up" | "clarification" | "refinement" | "synthesis" | "review" | "repair" | "blocked" | "accepted"`
   - `NodeRuntimeState` with all fields.
   - `NodeAction` union: all 14 actions.
   - `NodeDependencyState` with `requiredNodeIds`, `blockedBy`, `unlocks`.

3. Create `src/contracts/canonical-answer.ts` with `CanonicalAnswer` and `CanonicalAnswerDraft` types.

4. Create `src/contracts/completeness.ts` with `CompletenessState` and `ExtractedNodeData`.

## Files / Areas Likely Affected

- `src/contracts/runtime-state.ts` (new)
- `src/contracts/node-state.ts` (new)
- `src/contracts/canonical-answer.ts` (new)
- `src/contracts/completeness.ts` (new)
- `src/contracts/index.ts`

## Acceptance Criteria

- `LogosRuntimeState` has all required fields: `sessionId`, `selectedProfileId`, `activeNodeId`, `mode`, `nodeStates`, `documentStates`, `exportState`, `globalContext`, `lastActiveNodeId`, `updatedAt`.
- `NodeRuntimeState` has `nodeId`, `lifecycle`, `conversation`, `canonicalAnswer`, `completeness`, `extracted`, `promptState`, `allowedActions`, `dependencies`, `updatedAt`.
- `NodeLifecycle` includes all 10 states.
- `NodeAction` includes all 14 allowed actions.

## Tests / Validation

- TypeScript compilation: construct a minimal valid `LogosRuntimeState` with an empty session.
- Type narrowing: verify that `lifecycle === "accepted"` narrows the type correctly.
- Schema validation: verify that each lifecycle has a defined set of mapped actions.

## Dependencies

- Step 1.1 — Profile types (for `NodeId`, `DocumentId`, `ProfileId`)

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

