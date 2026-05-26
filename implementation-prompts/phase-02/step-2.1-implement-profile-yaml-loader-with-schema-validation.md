# Implement Step 2.1 — Implement profile YAML loader with schema validation

You are implementing Step 2.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 2.1
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 2.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 2.1;
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

Implement **only** Step 2.1. Do **not** implement later roadmap steps.

## Objective

Implement a module that loads profile YAML/JSON files, validates them against the `LogosProfile` schema, and returns a typed result.

## Why This Step Exists

Before the state engine can initialize, it needs valid profile data. The loader is a prerequisite for profile selection, sidebar rendering, and node resolution.

## Required Inputs

- `docs/10-profile-and-node-schema-spec.md`
- Existing profile YAML files under `profiles/standard/`
- Contract types from Step 1.1

## Relevant Docs

- `docs/10-profile-and-node-schema-spec.md`
- `docs/architecture/07-contracts-and-schemas.md`
- `docs/architecture/10-local-development-and-deployment.md`

## Required Initial Analysis

1. Inspect the repository structure — existing `profiles/standard/` directory, `src/core/project/`, `src/core/schema/`.
2. Locate existing files relevant to this step — profile loading code may exist in `src/core/`.
3. Identify existing implementation overlap.
4. Determine whether this step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented — Step 1.1 (profile types).
6. Identify blockers or mismatches.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. Create `src/profiles/profile-loader.ts`:
   - `loadProfile(path: string): Result<LogosProfile, LoadError>`
   - Reads YAML/JSON, parses, validates structure.
   - Validates that all `NodeDefinition.documentId` references exist in `documents[]`.
   - Validates that `DocumentMaterializationRule.sourceNodeIds` reference existing nodes.
   - Validates that `requiredNodeIds` and `optionalNodeIds` are subsets of `sourceNodeIds`.
2. Create `src/profiles/profile-registry.ts`:
   - `listProfiles(): ProfileId[]` — scans profile directory.
   - `getProfile(id: ProfileId): Result<LogosProfile, LoadError>`
3. Handle errors: missing files, invalid YAML, schema violations, missing references.

## Files / Areas Likely Affected

- `src/profiles/profile-loader.ts` (new)
- `src/profiles/profile-registry.ts` (new)
- `src/profiles/index.ts` (new)

## Acceptance Criteria

- A valid YAML profile loads without errors and type-checks as `LogosProfile`.
- A profile with missing node references returns a descriptive error.
- `listProfiles()` returns available profile IDs.
- Loading a non-existent profile returns an error, not a throw.

## Tests / Validation

- Unit test: load a minimal valid YAML profile fixture.
- Unit test: load profile with invalid YAML → error.
- Unit test: load profile with broken cross-references → error.
- Unit test: `listProfiles()` with mock filesystem.

## Dependencies

- Step 1.1 — Profile types

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

