# Implement Step 17.1 — Implement HTML artifact generation placeholder

You are implementing Step 17.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 17.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 17.1;
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

Implement **only** Step 17.1.

## Objective

Create the HTML export pathway: a basic HTML artifact rendered from accepted document content, with proper escaping for local viewing.

## Why This Step Exists

HTML artifacts provide a readable, shareable format for documentation review.

## Required Inputs

- `docs/architecture/10-local-development-and-deployment.md` §11
- `docs/13-prototypes.md` §3.12

## Relevant Docs

- `docs/architecture/10-local-development-and-deployment.md`
- `docs/13-prototypes.md` §3.12

## Tasks

1. Create `src/outputs/html-exporter.ts`:
   - `exportHtml(documentId, state, profile): Promise<Result<GeneratedArtifact, ExportError>>`
   - Generate basic HTML shell with document content.
   - Escape content properly (XSS-safe).
   - Include metadata header.
   - Style minimally for readability.
2. HTML is a derived artifact, not canonical source.
3. Generate HTML only when Markdown export is valid.

## Files / Areas Likely Affected

- `src/outputs/html-exporter.ts` (new)

## Acceptance Criteria

- HTML artifact generated from accepted document.
- Content is properly escaped.
- File is valid HTML.
- Export blocked on incomplete/stale documents.

## Tests / Validation

- Unit test: HTML export produces valid HTML structure.
- Unit test: special characters are escaped.
- Unit test: blocked on incomplete document.

## Dependencies

- Step 16.2 — Markdown export

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
