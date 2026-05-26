# Implement Step 3.7 — Implement document readiness computation

You are implementing Step 3.7 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 3.7
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 3.7, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 3.7;
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

Implement **only** Step 3.7. Do **not** implement later roadmap steps.

## Objective

Implement the function that evaluates whether a document is ready for materialization, partially ready, or not ready, given the state of its source nodes.

## Why This Step Exists

Document readiness gates materialization and export. The sidebar and document preview panel depend on this evaluation.

## Required Inputs

- `docs/07-document-materialization-spec.md` §5
- `docs/13-prototypes.md` §1.4 — document states

## Relevant Docs

- `docs/07-document-materialization-spec.md`
- `docs/02-state-engine-canonical-spec.md`
- `docs/architecture/02-runtime-architecture.md`

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 3.4 (lifecycle transitions), Step 3.6 (completeness).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/state-engine/document-readiness.ts`:
   - `computeDocumentReadiness(documentId: DocumentId, state: LogosRuntimeState, profile: LogosProfile): DocumentRuntimeState`
   - A document is `"ready"` when all `requiredNodeIds` are accepted and have non-stale canonical answers.
   - A document is `"partially_ready"` when at least one source node is accepted but some required nodes are missing.
   - A document is `"not_ready"` when no source nodes are accepted.
   - A document becomes `"stale"` when any accepted source node's canonical answer is stale.
   - Populates `missingRequiredNodeIds` and `staleSourceNodeIds`.
2. Recompute document readiness after:
   - Any node transitions to `accepted`.
   - Any node transitions from `accepted` to `active` (reopen).
   - Any canonical answer is marked stale.
   - Any canonical answer is regenerated.

## Files / Areas Likely Affected

- `src/state-engine/document-readiness.ts` (new)
- `src/state-engine/state-engine.ts` (update — trigger recomputation)

## Acceptance Criteria

- Document with all required nodes accepted → `ready`.
- Document with one accepted, one missing → `partially_ready`, with correct `missingRequiredNodeIds`.
- Document with no accepted nodes → `not_ready`.
- Document with stale source → `stale`.
- Readiness recomputes automatically on node state changes.

## Tests / Validation

- Unit test: all required accepted → ready.
- Unit test: partially accepted → partially_ready.
- Unit test: none accepted → not_ready.
- Unit test: stale source → stale.
- Unit test: recomputation after accept event.

## Dependencies

- Step 3.4 — Lifecycle transitions
- Step 3.6 — Completeness evaluation

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

