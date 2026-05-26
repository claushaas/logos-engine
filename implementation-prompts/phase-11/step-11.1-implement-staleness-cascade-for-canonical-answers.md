# Implement Step 11.1 — Implement staleness cascade for canonical answers

You are implementing Step 11.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 11.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 11.1;
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

Implement **only** Step 11.1.

## Objective

When an upstream node's canonical answer changes, mark all downstream dependent nodes' canonical answers as stale and notify the user.

## Why This Step Exists

Document consistency depends on staleness propagation. If a user changes a foundational thesis, all dependent answers must be reviewed.

## Required Inputs

- `docs/03-conversation-runtime-spec.md` §9
- `docs/02-state-engine-canonical-spec.md` §13

## Relevant Docs

- `docs/03-conversation-runtime-spec.md`
- `docs/07-document-materialization-spec.md` §9

## Tasks

1. Implement `propagateStaleness(state, changedNodeId): StateEngineResult`:
   - Find all nodes that depend on `changedNodeId` (via `dependency-graph.ts`).
   - For each dependent: if it has an accepted canonical answer, mark it stale.
   - Recompute document readiness for affected documents.
   - Generate diagnostic events for each staleness change.
2. Staleness triggers:
   - Node reopened from `accepted`.
   - New user message added to accepted node.
   - Canonical answer edited.
   - Completeness changes from sufficient to weak/missing.

## Files / Areas Likely Affected

- `src/state-engine/staleness.ts` (new)
- `src/state-engine/dispatch.ts` (update — trigger staleness cascade)

## Acceptance Criteria

- Changing an accepted node marks its dependents as stale.
- Staleness propagates transitively through the dependency graph.
- Document readiness recomputes when sources become stale.
- Sidebar reflects stale status.

## Tests / Validation

- Unit test: change upstream → downstream stale.
- Unit test: multiple dependents → all marked stale.
- Unit test: change non-accepted node → no staleness propagation.

## Dependencies

- Step 4.2 — Canonical answer management
- Step 2.2 — Dependency graph

## Implementation Constraints

- Preserve module boundaries. **Phase 11 checkpoint**.

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
