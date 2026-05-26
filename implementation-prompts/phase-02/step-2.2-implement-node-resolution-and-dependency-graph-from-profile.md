# Implement Step 2.2 — Implement node resolution and dependency graph from profile

You are implementing Step 2.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 2.2
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 2.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 2.2;
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

Implement **only** Step 2.2. Do **not** implement later roadmap steps.

## Objective

Given a loaded `LogosProfile`, compute the dependency graph: which nodes depend on which, which nodes are unlocked by which, and the topological order.

## Why This Step Exists

The state engine needs to know node dependencies to determine blocked states, recommend next nodes, and validate prerequisite chains. The sidebar needs the tree structure.

## Required Inputs

- `docs/04-node-lifecycle-and-question-state.md` §10 — `NodeDependencyState`
- `docs/10-profile-and-node-schema-spec.md` §6 — `NodeDefinition.dependencies`

## Relevant Docs

- `docs/04-node-lifecycle-and-question-state.md`
- `docs/10-profile-and-node-schema-spec.md`
- `docs/13-prototypes.md` — Flow F (Blocked Node)

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 2.1 (profile loader).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/profiles/dependency-graph.ts`:
   - `buildDependencyGraph(profile: LogosProfile): NodeDependencyGraph`
   - `getDependencies(nodeId: NodeId): NodeId[]`
   - `getDependents(nodeId: NodeId): NodeId[]`
   - `getTopologicalOrder(): NodeId[]`
   - `detectCycles(): NodeId[][]` — return any circular dependency chains.
2. Create `src/profiles/node-tree.ts`:
   - `buildNodeTree(profile: LogosProfile): NodeTree` — nested `Phase → Document → Node` structure.
   - Used by the sidebar render model.

## Files / Areas Likely Affected

- `src/profiles/dependency-graph.ts` (new)
- `src/profiles/node-tree.ts` (new)

## Acceptance Criteria

- Dependency graph correctly resolves `requiredNodeIds` and `recommendedNodeIds`.
- Circular dependencies are detected and reported.
- Topological order respects dependency constraints.
- Node tree preserves phase/document grouping from profile.

## Tests / Validation

- Unit test: simple linear dependency chain.
- Unit test: node with multiple prerequisites.
- Unit test: node that unlocks multiple dependents.
- Unit test: circular dependency detection.
- Unit test: cycle-free graph returns empty cycles array.

## Dependencies

- Step 2.1 — Profile loader

## Implementation Constraints

- Preserve module boundaries.
- Keep the implementation minimal.
- Do not add features not requested.
- Do not weaken existing tests.
- This is a **Phase 2 checkpoint**.

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
 Note: this completes Phase 2.
