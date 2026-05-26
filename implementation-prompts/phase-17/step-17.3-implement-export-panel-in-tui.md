# Implement Step 17.3 — Implement export panel in TUI

You are implementing Step 17.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 17.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 17.3;
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

Implement **only** Step 17.3.

## Objective

Render the export/outcome generation screen in the TUI, showing available exports, blocked exports with reasons, and export actions.

## Required Inputs

- `docs/13-prototypes.md` §3.12 — export state prototype
- Flow H §4.8

## Relevant Docs

- `docs/13-prototypes.md` §3.12, §4.8
- `docs/08-tui-state-and-rendering-contract.md`

## Tasks

1. Create `src/tui/components/ExportPanel.tsx`:
   - Renders export options list.
   - Available exports: `✓ Markdown`, `✓ HTML`.
   - Blocked exports: `⚠ Agent Pack` with reason.
   - For blocked exports: show missing requirements.
   - Export action triggers generation and file write.
   - Shows output path on success. Shows `[Close]` action.
2. Wire into main panel rendering switch.

## Files / Areas Likely Affected

- `src/tui/components/ExportPanel.tsx` (new/update)
- `src/tui/app-shell.tsx` (update)

## Acceptance Criteria

- Export panel shows available and blocked exports.
- Blocked exports explain why.
- Successful export shows output path.
- Exports produce correct files on disk.

## Tests / Validation

- Snapshot test: export panel with all exports available.
- Snapshot test: export panel with blocked exports.
- Manual TUI walkthrough: Flow H.

## Dependencies

- Step 16.2 — Markdown export
- Step 17.1 — HTML export
- Step 17.2 — Agent Pack export

## Implementation Constraints

- TUI is a renderer only. **Phase 17 checkpoint**.

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
