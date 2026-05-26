# Implement Step 8.2 — Implement TUI shell and layout components

You are implementing Step 8.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 8.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 8.2;
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

Implement **only** Step 8.2.

## Objective

Build the terminal UI shell using Ink (React for terminal): the AppFrame with sidebar and main panel layout, focus management, and keyboard handling.

## Why This Step Exists

The TUI is the primary user interface. The shell component owns layout, routing between modes, and event dispatch to the application layer.

## Required Inputs

- `docs/08-tui-state-and-rendering-contract.md`
- `docs/architecture/06-tui-rendering-architecture.md`
- `docs/13-prototypes.md` Part 2 — component model

## Relevant Docs

- `docs/08-tui-state-and-rendering-contract.md`
- `docs/architecture/06-tui-rendering-architecture.md`
- `docs/13-prototypes.md` §2.1-2.11

## Tasks

1. Create `src/tui/app-shell.tsx`:
   - `AppShell` component: renders `AppFrame` layout.
   - Reads `TuiRenderSnapshot` from application context.
   - Primary rendering switch based on `snapshot.mode`.
   - Keyboard handler: dispatches events for up/down, enter, tab, escape.
   - Focus management: tracks which region has focus.
2. Create `src/tui/components/Sidebar.tsx`:
   - Renders profile header, collapsible phase/document/node tree.
   - Highlights active node. Shows status symbols.
3. Create `src/tui/components/MainPanel.tsx`:
   - Renders mode-specific content.
4. Additional components: `ConversationPanel.tsx`, `CanonicalPreview.tsx`, `ActionBar.tsx`, `InputArea.tsx`, `use-focus.ts`.
5. Existing Ink-based TUI components in `src/tui/` can be adapted.

## Files / Areas Likely Affected

- `src/tui/app-shell.tsx` (new)
- `src/tui/components/Sidebar.tsx` (new)
- `src/tui/components/MainPanel.tsx` (new)
- `src/tui/components/ConversationPanel.tsx` (new)
- `src/tui/components/CanonicalPreview.tsx` (new)
- `src/tui/components/ActionBar.tsx` (new)
- `src/tui/components/InputArea.tsx` (new)
- `src/tui/hooks/use-focus.ts` (new)

## Acceptance Criteria

- Terminal renders sidebar + main panel layout.
- Sidebar shows profile structure with node tree and status symbols.
- Main panel content changes with mode.
- Keyboard navigation works: up/down in sidebar, tab between regions.
- Enter selects node/action. Escape returns from sub-modes.

## Tests / Validation

- TUI rendering test: render idle screen from snapshot.
- TUI rendering test: render structure_overview.
- TUI rendering test: render node_focus with conversation.
- Manual: run TUI locally with mock provider.

## Dependencies

- Step 8.1 — Render model builder

## Implementation Constraints

- TUI is a renderer only — never owns state logic. Do not add features not requested.

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
