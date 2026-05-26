# Implement Step 1.4 — Define DocumentRuntimeState, ExportRuntimeState, and materialization contracts

You are implementing Step 1.4 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 1.4
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 1.4, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 1.4;
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

Use the advisor **before implementation** to review your plan, scope, risks, and acceptance criteria.

Use the advisor **before final report** to review implementation completeness, test sufficiency, gate results, and execution board update.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 1.4. Do **not** implement later roadmap steps.

## Objective

Define types for document runtime state, export state, materialized document drafts, and generated artifacts.

## Why This Step Exists

Document materialization is a core output path. The document state model defines readiness, staleness, and export eligibility — concepts referenced by the state engine and TUI.

## Required Inputs

- `docs/07-document-materialization-spec.md`
- `docs/09-session-events-and-persistence.md`

## Relevant Docs

- `docs/07-document-materialization-spec.md`
- `docs/architecture/04-data-and-persistence-architecture.md`
- `docs/architecture/07-contracts-and-schemas.md`

## Required Initial Analysis

1. Inspect the repository structure.
2. Locate existing files relevant to this step.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 1.1 (profile types), Step 1.2 (runtime state types).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/contracts/document-state.ts` with:
   - `DocumentStatus` union: `"not_ready" | "partially_ready" | "ready" | "drafted" | "accepted" | "stale"`
   - `DocumentRuntimeState` with `documentId`, `status`, `sourceNodeIds`, `requiredNodeIds`, `optionalNodeIds`, `missingRequiredNodeIds`, `staleSourceNodeIds`, `draft`, `updatedAt`.
   - `MaterializedDocumentDraft` with `documentId`, `content`, `format`, `generatedAt`, `sourceNodeIds`, `missingSections`, `stale`.
   - `DocumentSectionRule` with `sectionId`, `title`, `sourceNodeIds`, `required`.

2. Create `src/contracts/export-state.ts` with:
   - `ExportRuntimeState` type.
   - `GeneratedArtifact` with `id`, `sessionId`, `type`, `path`, `sourceDocumentIds`, `sourceNodeIds`, `generatedAt`, `stale`.

## Files / Areas Likely Affected

- `src/contracts/document-state.ts` (new)
- `src/contracts/export-state.ts` (new)
- `src/contracts/index.ts`

## Acceptance Criteria

- `DocumentRuntimeState.status` correctly represents the 6 states.
- `missingRequiredNodeIds` is typed as `NodeId[]`.
- `MaterializedDocumentDraft.stale` is a boolean flag.
- `GeneratedArtifact.type` is `"markdown" | "html" | "agent_pack"`.

## Tests / Validation

- TypeScript compilation: construct a valid `DocumentRuntimeState` for a partially-ready document.
- Verify discriminated union behavior on `DocumentStatus`.

## Dependencies

- Step 1.1 — Profile types (for `DocumentId`, `NodeId`)
- Step 1.2 — Runtime state types

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

