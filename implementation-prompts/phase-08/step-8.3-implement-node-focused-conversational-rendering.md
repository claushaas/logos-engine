# Implement Step 8.3 — Implement node-focused conversational rendering

You are implementing Step 8.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 8.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 8.3;
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

Implement **only** Step 8.3.

## Objective

Render the complete node-focused mode: breadcrumb, status, conversation history, agent message, canonical answer preview, action bar, and input area.

## Why This Step Exists

This is the core interaction surface. It must render all 9 lifecycle states with appropriate agent behavior and user affordances.

## Required Inputs

- `docs/13-prototypes.md` §3.3-3.10 — state prototypes for each lifecycle
- `docs/08-tui-state-and-rendering-contract.md` §5

## Relevant Docs

- `docs/13-prototypes.md` State prototypes
- `docs/08-tui-state-and-rendering-contract.md`

## Tasks

1. Create `src/tui/components/ConversationPanel.tsx`:
   - Renders scrollable message history.
   - Renders latest agent message prominently.
   - Shows node status badge.
2. Create `src/tui/components/CanonicalPreview.tsx`:
   - Renders canonical answer in distinct box when available.
   - Shows confidence level, source message count.
   - Shows "Accepted" / "Draft" / "Stale" badge.
3. Create `src/tui/components/ActionBar.tsx`:
   - Renders only actions from `snapshot.allowedActions`.
   - Maps actions to labels (Appendix A).
4. Create `src/tui/components/InputArea.tsx`:
   - Visible only when `InputRenderModel.enabled` is true.
   - Shows placeholder text from render model.
5. Wire user input → dispatch `USER_MESSAGE` event.

## Files / Areas Likely Affected

- `src/tui/components/ConversationPanel.tsx` (new/update)
- `src/tui/components/CanonicalPreview.tsx` (new/update)
- `src/tui/components/ActionBar.tsx` (new/update)
- `src/tui/components/InputArea.tsx` (new/update)

## Acceptance Criteria

- Conversation panel shows user and agent messages in order.
- Canonical preview appears when `canonicalAnswer !== null`.
- Action bar shows only state-engine-approved actions.
- Input is hidden when blocked or accepted (unless reopened).
- Breadcrumb shows `Phase / Document / Node`.

## Tests / Validation

- Snapshot test: `not_started` node → input enabled, actions: answer/skip.
- Snapshot test: `synthesized` node → canonical preview, actions: accept/edit/regenerate.
- Snapshot test: `accepted` node → accepted badge, actions: continue/reopen/preview.
- Snapshot test: `blocked` node → blocker explanation, actions: open_prerequisite/defer.

## Dependencies

- Step 8.2 — TUI shell

## Implementation Constraints

- TUI is a renderer only. **Phase 8 checkpoint**.

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
