# Implement Step 16.2 — Implement Markdown export

You are implementing Step 16.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 16.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 16.2;
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

Implement **only** Step 16.2.

## Objective

Build the Markdown export pathway: when a document is ready, export it as a `.md` file to the configured output directory.

## Why This Step Exists

Markdown is the canonical output format for LOGOS Engine. It's the foundation for all other export formats.

## Required Inputs

- `docs/07-document-materialization-spec.md`
- `docs/13-prototypes.md` Flow H §4.8

## Relevant Docs

- `docs/07-document-materialization-spec.md`
- `docs/13-prototypes.md` §4.8
- `docs/architecture/10-local-development-and-deployment.md` §11

## Tasks

1. Create `src/outputs/markdown-exporter.ts`:
   - `exportMarkdown(documentId, state, profile): Promise<Result<GeneratedArtifact, ExportError>>`
   - Materialize document. Write to configured output path.
   - Generate `GeneratedArtifact` metadata.
   - Handle file collisions.
2. Create `src/outputs/export-manager.ts`:
   - `getAvailableExports(state, profile): ExportAvailability[]`
3. Wire export actions in TUI.

## Files / Areas Likely Affected

- `src/outputs/markdown-exporter.ts` (new)
- `src/outputs/export-manager.ts` (new)
- `src/outputs/index.ts` (new)
- `src/tui/components/ExportPanel.tsx` (new/update)

## Acceptance Criteria

- Ready document → Markdown file written with correct content.
- Incomplete document → export blocked with reason.
- Stale document → export blocked or warned.
- File collision → handled per policy.
- Export metadata stored in session.

## Tests / Validation

- Unit test: export ready document → file created with content.
- Unit test: export incomplete → error.
- Unit test: export stale → blocked.
- E2E harness test: Flow H.

## Dependencies

- Step 12.1 — Document materializer
- Step 3.7 — Document readiness

## Implementation Constraints

- Preserve module boundaries. **Phase 16 checkpoint**.

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
