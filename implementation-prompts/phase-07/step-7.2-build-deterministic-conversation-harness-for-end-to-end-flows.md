# Implement Step 7.2 — Build deterministic conversation harness for end-to-end flows

You are implementing Step 7.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 7.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 7.2;
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

Implement **only** Step 7.2.

## Objective

Build a test harness that runs complete conversations using the mock LLM provider, state engine, and prompt orchestrator, producing deterministic end-to-end flow tests.

## Why This Step Exists

The 10 flow prototypes from `13-prototypes.md` must be validated as end-to-end tests. A harness that wires state engine + mock LLM enables flow validation before the TUI exists.

## Required Inputs

- `docs/13-prototypes.md` Part 4 — 10 flow prototypes
- All state engine and conversation runtime modules

## Relevant Docs

- `docs/13-prototypes.md` §4.1-4.10
- `docs/architecture/09-testing-architecture.md`

## Tasks

1. Create `tests/harness/conversation-harness.ts`:
   - `createTestSession(profile: LogosProfile): { state, dispatch }`
   - `simulateUserTurn(state, input: string): Promise<StateEngineResult>`
   - `simulateNodeCompletion(state, nodeId): Promise<StateEngineResult>` — runs through not_started → accepted flow.
2. Implement Flow A (First Use) as a test.
3. Implement Flow B (Incomplete Answer) as a test.
4. Implement Flow C (Sidebar Navigation) as a test.
5. Implement Flow D (Review/Edit/Regenerate) as a test.
6. Create test files for Flows E-J as stubs if not fully testable yet.

## Files / Areas Likely Affected

- `tests/harness/conversation-harness.ts` (new)
- `tests/flows/flow-a-first-use.test.ts` through `tests/flows/flow-j-change-profile.test.ts` (new)

## Acceptance Criteria

- Flow A runs end-to-end without LLM credentials.
- Flow B demonstrates clarification → refinement → synthesis.
- Flow C preserves node state during navigation.
- Flow D allows edit → regenerate → accept.
- All flows produce the expected lifecycle transitions.

## Tests / Validation

- These files ARE the tests. Each flow test validates a complete prototype walkthrough.

## Dependencies

- Step 7.1 — Mock provider
- Step 6.3 — Apply agent turn
- Step 5.3 — Prompt assembly
- Step 3.8 — State engine dispatch

## Implementation Constraints

- Preserve module boundaries. **Phase 7 checkpoint**.

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
