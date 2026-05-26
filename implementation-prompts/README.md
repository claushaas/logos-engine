# LOGOS Engine — Implementation Prompt Pack

## Purpose

This directory contains a complete, step-by-step implementation prompt pack for the LOGOS Engine. Each prompt is designed to be executed by a single coding agent in a linear, dependency-ordered fashion.

The pack converts the `IMPLEMENTATION_ROADMAP.md` into executable, self-contained agent instructions with mandatory advisor review gates.

## How to Use This Pack

Each file in this pack is an executable prompt. Give one prompt file to the agent at a time, in order.

## Recommended Workflow

1. Open `00-execution-board.md`.
2. Pick the next step with status `⏳` (Not started).
3. Update the step status to `🔵 In progress`.
4. Open the corresponding prompt file (path in `Prompt File` column).
5. Run the agent with that prompt.
6. The agent must use **codegraph** for repository discovery before editing.
7. The agent must produce a **Codegraph Discovery Summary**.
8. The agent must use `@juicesharp/rpiv-advisor` **before** implementation.
9. The agent must use `@juicesharp/rpiv-advisor` **before** final report.
10. The agent must produce a final report.
11. After implementation, update the execution board to `🟡 Needs review`, `🔴 Blocked`, or `⚠️ Needs decision`.
12. After human review and merge, update to `✅ Done`.
13. Commit.
14. Repeat with the next step.

## Execution Order

Steps must be executed in strictly linear order as defined in `IMPLEMENTATION_ROADMAP.md` and `00-execution-board.md`.

Do not skip steps. Do not parallelize within the same agent run. One step = one agent invocation = one commit.

## Files

| File | Purpose |
|---|---|
| `README.md` | This document — overview and usage instructions |
| `00-execution-protocol.md` | Operational contract every agent must follow |
| `00-execution-board.md` | Full status board of all implementation steps |
| `01-current-slice.md` | First operational slice scope and stop condition |
| `99-open-questions.md` | Open questions and architectural decisions (if any) |
| `phase-XX/step-X.Y-*.md` | Individual step prompts |

## Rules for Agents

1. Follow `00-execution-protocol.md` exactly.
2. Implement only the current step — never implement future steps.
3. Use codegraph for repository discovery before editing code.
4. Produce a Codegraph Discovery Summary.
5. Use `@juicesharp/rpiv-advisor` before editing code.
6. Use `@juicesharp/rpiv-advisor` before final report.
7. Produce a structured final report including Codegraph Discovery Applied.
8. Update or recommend updating the execution board.
9. Run validation gates before finishing.
10. Do not mark steps ✅ Done (reserved for human review after merge).

## Rules for Human Review

1. Review each step's implementation after the agent produces `🟡 Needs review`.
2. Verify acceptance criteria are met.
3. Run quality gates: `pnpm typecheck && pnpm lint && pnpm test`.
4. Merge the branch.
5. Update execution board to `✅ Done`.
6. Proceed to next step.

## Required Tooling Flow

Each step prompt requires two distinct forms of automated support:

### Codegraph (Repository Discovery)

Used for repository discovery **before** implementation. The agent must use the codegraph extension to:
- Find existing files, symbols, tests, dependencies, and module boundary risks.
- Identify reuse opportunities and files that should not be touched.
- Determine whether the step is greenfield, migration, or adaptation.

The agent must produce a **Codegraph Discovery Summary** before editing code.

### Advisor (Plan & Quality Review)

Used for implementation plan review and final quality review. The agent must use:

```txt
@juicesharp/rpiv-advisor
```

The advisor must be consulted:

- **Before implementation** — to review plan, scope, risks, test requirements, and repository reality mismatches.
- **Before final report** — to review completeness, gate results, acceptance criteria, and execution board update.

### Distinction

| Tool | Purpose | When |
|---|---|---|
| Codegraph | Repository discovery and implementation map | Before editing code |
| Advisor | Plan/risk/scope/quality review | Before implementation + before final report |

Codegraph discovers *what exists*. Advisor reviews *what you plan to do*.

If the advisor identifies a critical issue, the agent must not mark the step as complete.

## Execution Board Workflow

```
⏳ Not started        → Agent starts step
🔵 In progress        → Agent implements
🟡 Needs review       → Agent finishes, submits for human review
✅ Done               → Human reviews, merges (manual only)
🔴 Blocked            → Agent hits blocker
⚠️ Needs decision     → Agent needs human decision
```

## Quality Gates

All steps must pass applicable quality gates. Standard gates:

| Gate | Command | Applicability |
|---|---|---|
| TypeCheck | `pnpm typecheck` | All code steps |
| Lint | `pnpm lint` | All code steps |
| Test | `pnpm test` | All code steps |
| Full Check | `pnpm check` | Phase boundaries, hardening |

## Milestones

| # | Milestone | Steps | Description |
|---|---|---|---|
| 1 | Baseline | 0.1 → 0.3 | Repository, types, CI |
| 2 | Contracts | 1.1 → 1.5 | All core type definitions |
| 3 | Profiles | 2.1 → 2.2 | Profile loading, dependency graph |
| 4 | State Engine | 3.1 → 3.8 | Deterministic state engine |
| 5 | Conversation + Prompt + Mock | 4.1 → 7.2 | Runtime, prompts, LLM harness |
| 6 | TUI | 8.1 → 10.3 | Terminal UI rendering |
| 7 | Canonical Answers + Materialization | 11.1 → 12.2 | Staleness, document generation |
| 8 | Persistence | 13.1 → 13.3 | Save, load, resume |
| 9 | Errors + Testing + Tooling + Exports + Hardening | 14.1 → 18.5 | Quality, exports, hardening |
