# Implement Step 1.1 — Define LogosProfile and node definition types

You are implementing Step 1.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 1.1
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 1.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 1.1;
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

Use the advisor to review your understanding of Step 1.1, allowed scope, relevant files, implementation plan, risks, tests, acceptance criteria, and mismatches between roadmap and repo.

Incorporate the advisor's recommendations before editing code.

### Before final report

After implementing, use the advisor again to review implementation scope, acceptance criteria, test sufficiency, gate results, execution board update, and follow-up.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 1.1. Do **not** implement later roadmap steps.

## Objective

Define the TypeScript types for `LogosProfile`, `PhaseDefinition`, `DocumentDefinition`, `NodeDefinition`, and `DocumentMaterializationRule`. These types define the structural map that the runtime navigates.

## Why This Step Exists

The state engine, sidebar, prompt orchestrator, and materializer all depend on profile/node definitions. Without these types, nothing can reference profile structure.

## Required Inputs

- `docs/10-profile-and-node-schema-spec.md` — canonical types
- Existing profile YAML files under `profiles/standard/`

## Relevant Docs

- `docs/10-profile-and-node-schema-spec.md`
- `docs/architecture/07-contracts-and-schemas.md`

## Required Initial Analysis

Before editing code:

1. Inspect the repository structure — look at `src/contracts/` (new directory), `profiles/standard/`.
2. Locate existing files relevant to this step — profile schemas and existing type files.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation — mostly **greenfield** for the contracts module.
5. Identify dependencies already implemented — Step 0.2 (branded IDs).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/contracts/profile.ts` with:
   ```ts
   type LogosProfile = {
     id: ProfileId
     title: string
     description?: string
     version: string
     phases: PhaseDefinition[]
     documents: DocumentDefinition[]
     nodes: NodeDefinition[]
     materializationRules: DocumentMaterializationRule[]
   }
   ```
2. Define `PhaseDefinition` with `id`, `title`, `order`, `purpose`.
3. Define `DocumentDefinition` with `id`, `phaseId`, `title`, `order`, `purpose`, `outputPath`, `requiredNodeIds`, `optionalNodeIds`.
4. Define `NodeDefinition` with `id`, `phaseId`, `documentId`, `title`, `order`, `canonicalQuestion`, `coverageTopics`, `sufficiencyCriteria`, `dependencies`, `promptRefs`, `outputSchemaRef`.
5. Define `DocumentMaterializationRule` with `documentId`, `title`, `outputPath`, `sourceNodeIds`, `requiredNodeIds`, `optionalNodeIds`, `sections`.
6. Export all types with branded IDs.

## Files / Areas Likely Affected

- `src/contracts/profile.ts` (new)
- `src/contracts/index.ts` (new)

## Acceptance Criteria

- `LogosProfile` matches the shape defined in `10-profile-and-node-schema-spec.md`.
- A hand-constructed TypeScript object representing the "Startup" profile (from `13-prototypes.md` wireframes) type-checks.
- `NodeId` and `DocumentId` are distinct branded types; passing a `NodeId` where a `DocumentId` is expected causes a compile error.

## Tests / Validation

- TypeScript compilation test: construct a minimal valid profile object.
- Branded type test: verify `NodeId` ≠ `DocumentId` at the type level.

## Dependencies

- Step 0.2 — Shared primitives (branded IDs)

## Implementation Constraints

- Preserve module boundaries.
- Keep the implementation minimal and directly aligned with this step.
- Do not add features not requested by this step.
- Do not weaken existing tests.
- If the roadmap conflicts with repository reality, document the mismatch and choose the smallest safe adaptation.

## Required Commands

```bash
pnpm typecheck
pnpm test
```

## Execution Board Update

Update or recommend updating `implementation-prompts/00-execution-board.md`.

- Start: `🔵 In progress`
- After implementation: `🟡 Needs review`
- Blocked: `🔴 Blocked`
- Needs decision: `⚠️ Needs decision`
- Do **not** mark `✅ Done`.

## Required Final Report

Return a final report with:

```md
# Step 1.1 Report
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
| Next Step | Step 1.2 — Define LogosRuntimeState and NodeRuntimeState types |
## Deviations From Roadmap
## Follow-up Required
```
