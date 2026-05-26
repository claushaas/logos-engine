# Implement Step 10.3 — Implement synthesis and review flow

You are implementing Step 10.3 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 10.3, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 10.3;
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

Implement **only** Step 10.3.

## Objective

Implement the synthesis (ready_for_synthesis → synthesized) and review (synthesized → accepted) flow: agent generates canonical answer draft, user reviews, accepts or edits.

## Why This Step Exists

Synthesis and review are the critical steps where LLM output becomes accepted documentation source material. Flow A and Flow D exercise this path.

## Required Inputs

- `docs/13-prototypes.md` §3.7 — synthesized state prototype
- Flow A §4.1 steps 4-5, Flow D §4.4

## Relevant Docs

- `docs/13-prototypes.md` §3.7, §4.1, §4.4
- `docs/06-agent-turn-contract.md` §5

## Tasks

1. Implement synthesis:
   - Engine determines node is `ready_for_synthesis`.
   - Prompt orchestrator selects `synthesis` prompt.
   - Agent generates `canonicalAnswerDraft`.
   - State engine stores draft, transitions lifecycle → `synthesized`.
2. Implement review:
   - TUI shows canonical answer preview in distinct box.
   - Confidence badge: Low / Medium / High.
   - Source note: "Generated from N messages".
   - Actions: `[Accept]`, `[Edit]`, `[Regenerate]`, `[Defer]`, `[Reopen]`.
   - `[Accept]` → marks accepted, transitions to `accepted`.
   - `[Edit]` → shows input with content pre-filled, on submit → marks stale, regenerates.
   - `[Regenerate]` → agent produces new draft.
   - `[Defer]` → transitions to `deferred`.
   - `[Reopen]` → returns to `active`.

## Files / Areas Likely Affected

- `src/application/use-cases/accept-canonical-answer.ts` (new)
- `src/application/use-cases/edit-canonical-answer.ts` (new)
- `src/application/use-cases/regenerate-canonical-answer.ts` (new)
- `src/tui/components/CanonicalPreview.tsx`
- `src/tui/components/ActionBar.tsx`

## Acceptance Criteria

- Synthesis produces canonical answer draft with source message traceability.
- Review screen shows clean content preview with confidence.
- Accept transitions to `accepted`, updates document readiness.
- Edit → regenerate preserves user correction.
- Reopen returns to `active` with stale canonical answer.

## Tests / Validation

- E2E harness test: Flow A step 4-5.
- E2E harness test: Flow D.
- Unit test: accept guard — must be in `synthesized` lifecycle.
- Unit test: edit marks canonical answer stale.

## Dependencies

- Step 10.2 — Clarification/refinement
- Step 4.2 — Canonical answer management

## Implementation Constraints

- Preserve module boundaries. **Phase 10 checkpoint**.

## Required Commands

```bash
pnpm typecheck
pnpm test
pnpm check
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
