# Implement Step 12.2 — Implement document preview rendering in TUI

You are implementing Step 12.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 12.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 12.2;
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

Implement **only** Step 12.2.

## Objective

Render the materialized document preview in the TUI: show sections, missing/stale markers, completeness, and provide regenerate/export actions.

## Why This Step Exists

Users need to see the document taking shape before exporting. The preview is an output inspection surface.

## Required Inputs

- `docs/13-prototypes.md` §3.11 — document preview state prototype
- Flow G §4.7

## Relevant Docs

- `docs/13-prototypes.md` §3.11, §4.7
- `docs/07-document-materialization-spec.md`

## Tasks

1. Create `src/tui/components/DocumentPreview.tsx` as an **overlay/modal** panel:
   - Renders as an overlay on top of the main panel (not inline, not right-side panel).
   - Renders materialized document content.
   - Shows accepted sections with content.
   - Shows missing sections with `[MISSING]` label and source node link.
   - Shows stale sections with `[⚠ STALE]` warning.
   - Shows completeness indicator: "N/M sections accepted".
   - Actions: `[Regenerate]`, `[Export]` (enabled only when ready), `[Close]`.
2. Navigation: user can select a missing node link to navigate to it.
3. Scrolling: support long documents with virtual scroll or page navigation.

## Files / Areas Likely Affected

- `src/tui/components/DocumentPreview.tsx` (new/update)
- `src/application/use-cases/open-document-preview.ts` (new)

## Acceptance Criteria

- Document preview shows all accepted sections with content.
- Missing sections link to source nodes.
- Stale sections are clearly marked.
- Export is disabled when document is not fully ready.
- Regenerate updates the preview from current state.

## Tests / Validation

- Snapshot test: document preview with partial completeness.
- Snapshot test: document preview with stale sections.
- Manual TUI walkthrough: Flow G.

## Dependencies

- Step 12.1 — Document materializer
- Step 8.2 — TUI shell

## Implementation Constraints

- TUI is a renderer only.
- Document preview renders as an **overlay/modal** (decision resolved in `99-open-questions.md` #6).
- **Phase 12 checkpoint**.

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
