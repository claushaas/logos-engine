# Implement Step 9.1 — Implement sidebar node tree with status indicators

You are implementing Step 9.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 9.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 9.1;
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

Implement **only** Step 9.1.

## Objective

Build the navigable sidebar that renders phases, documents, and nodes as a collapsible tree with correct status symbols and active node highlighting.

## Why This Step Exists

The sidebar is the user's structural map. It shows what exists, what's done, and what needs attention. It is the primary navigation mechanism.

## Required Inputs

- `docs/13-prototypes.md` §2.4-2.6 — sidebar and node tree component model
- `docs/08-tui-state-and-rendering-contract.md` §6

## Relevant Docs

- `docs/13-prototypes.md` §2.4-2.6
- `docs/08-tui-state-and-rendering-contract.md`
- `docs/architecture/06-tui-rendering-architecture.md`

## Tasks

1. Implement collapsible tree rendering:
   - Phases: collapsible, show title and order.
   - Documents: collapsible within phase, show title.
   - Nodes: selectable, show title and status symbol.
2. Status symbols per node:
   ```
   ○ → not_started    ◐ → active, answered    ? → needs_clarification
   △ → needs_refinement    ◆ → ready_for_synthesis, synthesized
   ✓ → accepted    ⏸ → deferred    ⚠ → blocked
   ```
3. Active node gets visual highlight.
4. Keyboard navigation: up/down to move, enter to select, left/right to collapse/expand.
5. Selecting a node dispatches `NODE_SELECTED` event.

## Files / Areas Likely Affected

- `src/tui/components/Sidebar.tsx` (update)
- `src/tui/components/NodeTree.tsx` (new)

## Acceptance Criteria

- Phases and documents are collapsible.
- Node status symbols match lifecycle state.
- Active node is visually distinct.
- Keyboard navigation works.
- Selecting a blocked node navigates to it (shows blocked state).
- All 8 status symbols are distinct and visible.

## Tests / Validation

- Snapshot test: sidebar with all lifecycle states represented.
- Manual: navigate sidebar with keyboard.
- Manual: collapse/expand phases and documents.

## Dependencies

- Step 8.2 — TUI shell
- Step 8.1 — Render model builder

## Implementation Constraints

- Sidebar is navigation, not form input. TUI is a renderer only.

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
