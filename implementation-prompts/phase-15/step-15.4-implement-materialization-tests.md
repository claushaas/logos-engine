# Implement Step 15.4 — Implement materialization tests

You are implementing Step 15.4 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 15.4, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 15.4;
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

Implement **only** Step 15.4. This is a test-only step.

## Objective

Validate document materialization: correct assembly, missing/stale markers, partial previews, and export blocking.

## Why This Step Exists

Document generation from accepted answers is the output contract. Materialization tests verify correctness of the final deliverable.

## Tasks

1. Create `tests/materialization/document-materializer.test.ts`:
   - Materialize document from all accepted nodes → verify content.
   - Materialize with missing required node → verify `[MISSING]` marker.
   - Materialize with stale source → verify `[⚠ STALE]` marker.
   - Verify partial preview is allowed.
   - Verify export is blocked for incomplete documents.
   - Verify raw conversation is not used as final source.

## Acceptance Criteria

- Full document materialization produces correct Markdown.
- Missing sections are flagged.
- Stale sections are flagged.
- Export gating works.

## Dependencies

- Phase 12 — Document materialization

## Implementation Constraints

- **Phase 15 checkpoint**. Tests must run without LLM credentials.

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
