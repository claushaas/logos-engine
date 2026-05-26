# Implement Step 12.1 — Implement document materializer (accepted answers → Markdown)

You are implementing Step 12.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 12.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 12.1;
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

Implement **only** Step 12.1.

## Objective

Build the document materialization module that assembles accepted canonical answers into a structured Markdown document following materialization rules.

## Why This Step Exists

Documents are the primary output of the LOGOS Engine. This is where conversational work becomes portable, reviewable content.

## Required Inputs

- `docs/07-document-materialization-spec.md`
- `docs/architecture/02-runtime-architecture.md` §10

## Relevant Docs

- `docs/07-document-materialization-spec.md`
- `docs/architecture/02-runtime-architecture.md`
- `docs/13-prototypes.md` §3.11 — document preview state

## Tasks

1. Create `src/materialization/document-materializer.ts`:
   - `materializeDocument(documentId, state, profile): Result<MaterializedDocumentDraft, MaterializationError>`
   - For each `DocumentSectionRule`, collect accepted canonical answers from source nodes.
   - Render section headers from rule titles.
   - Insert canonical answer content under each section.
   - Mark missing required sections with `[MISSING — requires node: X]`.
   - Mark stale sections with `[⚠ STALE — source node has changed]`.
   - Generate completeness indicator: "N/M sections accepted".
   - Output format: Markdown string.
2. Implement `previewDocument(documentId, state, profile): MaterializedDocumentDraft`:
   - Same as materialize but allows partial (missing/stale sections visible).
3. Do not generate final documents from unaccepted answers.

## Files / Areas Likely Affected

- `src/materialization/document-materializer.ts` (new)
- `src/materialization/index.ts` (new)

## Acceptance Criteria

- Accepted nodes produce sections with their canonical answer content.
- Missing required nodes are flagged with source node reference.
- Stale source nodes are flagged.
- Document completeness is shown.
- Unaccepted answers are not used for final output.

## Tests / Validation

- Unit test: materialize with all accepted → full document.
- Unit test: materialize with missing node → `[MISSING]` marker present.
- Unit test: materialize with stale source → `[⚠ STALE]` marker.
- Unit test: document from unaccepted answer is rejected.

## Dependencies

- Step 4.2 — Canonical answer management
- Step 3.7 — Document readiness

## Implementation Constraints

- Materializer never bypasses accepted canonical answers.

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
