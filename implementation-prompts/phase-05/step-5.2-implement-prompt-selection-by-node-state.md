# Implement Step 5.2 — Implement prompt selection by node state

You are implementing Step 5.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 5.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 5.2;
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

Implement **only** Step 5.2.

## Objective

Given a node's lifecycle, prompt state, and profile definition, select the appropriate prompt from the registry.

## Why This Step Exists

Prompt selection is the bridge between deterministic state and LLM instruction. The lifecycle-to-prompt-state mapping must be explicit and testable.

## Required Inputs

- `docs/05-prompt-orchestration-spec.md` §3-5
- `docs/13-prototypes.md` §1.3 — lifecycle → prompt state mapping

## Relevant Docs

- `docs/05-prompt-orchestration-spec.md`
- `docs/13-prototypes.md` §1.3

## Tasks

1. Create `src/prompt-orchestration/prompt-selector.ts`:
   - `selectPrompt(nodeState, nodeDef, profile, registry): PromptDefinition`
   - Lifecycle → PromptState mapping:
     ```
     not_started → initial
     active → follow_up
     answered → follow_up
     needs_clarification → clarification
     needs_refinement → refinement
     ready_for_synthesis → synthesis
     synthesized → review
     accepted → accepted
     blocked → blocked
     deferred → (no prompt)
     ```
   - Lookup in registry with fallback chain.
   - If node has `promptRefs` in its definition, use those overrides.

## Files / Areas Likely Affected

- `src/prompt-orchestration/prompt-selector.ts` (new)

## Acceptance Criteria

- `not_started` node → `initial` prompt selected.
- `synthesized` node → `review` prompt selected.
- `blocked` node → `blocked` prompt selected.
- `deferred` node → no prompt (returns null or special marker).
- Node-specific prompt overrides take precedence over generic.

## Tests / Validation

- Unit test: verify prompt selection for each lifecycle state.
- Unit test: profile-specific prompt overrides generic.
- Unit test: deferred → no prompt.

## Dependencies

- Step 5.1 — Prompt registry
- Step 3.4 — Lifecycle transitions

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
