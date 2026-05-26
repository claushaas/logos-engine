# Implement Step 18.2 — Add TUI snapshot tests for all 13 states

You are implementing Step 18.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 18.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 18.2;
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

Implement **only** Step 18.2. This is a test-only step.

## Objective

Create snapshot tests for all 13 TUI states defined in `13-prototypes.md`, ensuring every rendered state matches the wireframe expectations.

## Why This Step Exists

Snapshot tests prevent visual regressions and enforce that state-driven rendering rules are followed.

## Required Inputs

- `docs/13-prototypes.md` Part 3 — all 13 state prototypes

## Relevant Docs

- `docs/13-prototypes.md` §3.1-3.13

## Tasks

1. Create `tests/tui/state-snapshots.test.tsx`:
   - For each state: idle, structure_overview, not_started, active, needs_clarification, needs_refinement, synthesized, accepted, deferred, blocked, document_preview, export, settings.
   - Render with test renderer (Ink's `render`).
   - Capture snapshot (text output).
   - Verify key elements present: status symbols, action labels, message content.

## Files / Areas Likely Affected

- `tests/tui/state-snapshots.test.tsx` (new)

## Acceptance Criteria

- All 13 states have snapshot tests.
- Snapshots include status symbols and action labels.
- Tests catch when rendering rules change unintentionally.

## Tests / Validation

- These ARE the tests.

## Dependencies

- Phases 8-12 — All TUI components

## Implementation Constraints

- Tests must run without LLM credentials.

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
