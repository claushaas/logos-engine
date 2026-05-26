# Implement Step 0.1 — Establish project structure and tooling baseline

You are implementing Step 0.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Before doing anything, read:
- `implementation-prompts/00-execution-protocol.md`
- `implementation-prompts/00-execution-board.md`
- `IMPLEMENTATION_ROADMAP.md`, Step 0.1
- All documents listed under **Relevant Docs** for this step

You must follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 0.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 0.1;
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

You must use the PI advisor extension:

```txt
@juicesharp/rpiv-advisor
```

### Before implementation

Use the advisor to review:

- Your understanding of Step 0.1;
- The allowed scope;
- Relevant files found in the repository;
- Your implementation plan;
- Risks of implementing future steps accidentally;
- Risks of violating module boundaries;
- Required tests;
- Acceptance criteria;
- Mismatches between roadmap assumptions and repository reality.

Incorporate the advisor's recommendations before editing code.

### Before final report

After implementing and before final response, use the advisor again to review:

- Whether the implementation stayed within Step 0.1;
- Whether acceptance criteria were met;
- Whether tests are sufficient;
- Whether validation gates were run;
- Whether the execution board update recommendation is correct;
- Whether follow-up is required.

If the advisor identifies a critical issue, do not mark the step as complete.

## Scope

Implement **only** Step 0.1.

Do **not** implement later roadmap steps unless strictly required to make this step compile. If such adaptation is necessary, document it as a deviation.

## Objective

Set up the repository skeleton with TypeScript, Vitest, Biome, and the module directory structure. Configure path aliases, build scripts, and quality gates.

## Why This Step Exists

All subsequent phases depend on a clean, compilable, type-checked environment. Module boundaries must be physically enforced through directory structure and import lint rules.

## Required Inputs

- `package.json` (existing)
- `tsconfig.json` (existing — may need path aliases)
- `vitest.config.ts` (existing)
- `biome.json` (existing)

## Relevant Docs

- `docs/architecture/03-module-boundaries.md`
- `docs/architecture/10-local-development-and-deployment.md`
- `docs/architecture/11-architecture-decision-records.md`

## Required Initial Analysis

Before editing code:

1. Inspect the repository structure (`src/`, `tests/`, config files).
2. Locate existing files relevant to this step (`tsconfig.json`, `package.json`, `vitest.config.ts`, `biome.json`).
3. Identify existing implementation overlap — `src/` has `core/`, `tui/`, `llm/`, `shared/`, `interview/`, `executive/`, `cli/`, `fs/`, `prompts/`, `renderers/`. Only `src/llm/` contains non-placeholder code; all others are placeholder files and can be safely deleted.
4. Determine whether this step is greenfield, migration, or adaptation — **this is an aggressive migration step**: delete old placeholder directories, keep only `src/llm/` (real code) and `src/shared/` (audit and migrate), build the new roadmap-defined directory structure on a clean slate.
5. Identify dependencies already implemented — existing `package.json` has TypeScript, Vitest, Biome configured.
6. Identify blockers or mismatches — current `src/` structure differs from roadmap target.
7. Use `@juicesharp/rpiv-advisor` to review your plan.
8. Provide a brief implementation plan.

## Tasks

1. **Clean up old structure**: Delete all existing `src/` subdirectories except `src/llm/` (contains real LLM provider code). Audit `src/shared/` utilities — keep the good ones, move them into the new `src/shared/` under the roadmap structure, then delete the old `src/shared/`. Delete `src/core/`, `src/interview/`, `src/executive/`, `src/cli/`, `src/fs/`, `src/prompts/`, `src/renderers/`, `src/tui/` (they are placeholders; the roadmap rebuilds these with correct module boundaries).
2. Define target module directory structure under `src/`:
   ```
   src/
     contracts/
     state-engine/
     conversation-runtime/
     application/
     prompt-orchestration/
     llm/              # (preserved from existing; contains real provider code)
     validation/
     materialization/
     persistence/
     profiles/
     tui/
     diagnostics/
     outputs/
     shared/           # (migrated from old src/shared/: Result, Brand, id, date, errors)
   ```
3. Configure TypeScript path aliases (`@logos/state-engine`, `@logos/conversation-runtime`, etc.) in `tsconfig.json`.
4. Verify `pnpm typecheck` passes on the new skeleton.
5. Add architecture boundary tests (or eslint-plugin-import rules) that prevent forbidden cross-module imports.
6. Create `.gitkeep` files in empty directories to preserve structure.
7. Add `pnpm check` script: typecheck + lint + test.
8. Create ADR directory at `docs/architecture/adr/` and draft first 12 ADRs as stubs.

## Files / Areas Likely Affected

- `tsconfig.json`
- `package.json`
- `src/` — new directory structure
- `docs/architecture/adr/` — new ADR files

## Acceptance Criteria

- `pnpm typecheck` passes on the new skeleton.
- Import boundary tests detect TUI importing LLM adapter directly.
- All module directories exist and are under version control.
- 12 ADR stubs exist documenting the core architecture decisions.

## Tests / Validation

- `pnpm typecheck`
- Architecture boundary unit test (verify import violations fail)
- Manual: `ls src/*/` shows all module directories

## Dependencies

- None (first step)

## Implementation Constraints

- Preserve module boundaries.
- Keep the implementation minimal and directly aligned with this step.
- Do not add features not requested by this step.
- Do not weaken existing tests.
- Do not let the TUI own state logic.
- Do not let the LLM mutate state directly.
- Preserve conversation-first behavior.
- Preserve sidebar as navigation, not form input.
- **Migration strategy (resolved — see `99-open-questions.md` #8):** Aggressive migration. Delete old placeholder directories (`src/core/`, `src/interview/`, `src/executive/`, `src/cli/`, `src/fs/`, `src/prompts/`, `src/renderers/`, `src/tui/`). Preserve only `src/llm/` (real provider code). Audit `src/shared/` and migrate useful utilities into the new structure. Build everything else from scratch following the roadmap-defined module map. No backward compatibility burden.

## Required Commands

Run the commands that apply to this step:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

If available, run:

```bash
pnpm check
```

## Execution Board Update

Update or recommend updating `implementation-prompts/00-execution-board.md`.

### Rules

- When starting the step, status should become `🔵 In progress`.
- After implementation and tests, status should become `🟡 Needs review`.
- If blocked, status should become `🔴 Blocked`.
- If a decision is required, status should become `⚠️ Needs decision`.
- Do **not** mark `✅ Done`; that is reserved for human review after merge.

## Required Final Report

Return a final report with:

```md
# Step 0.1 Report
## Status
Done / Partial / Blocked / Needs Decision
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
| Next Step | Step 0.2 — Define shared primitives and utility types |
## Deviations From Roadmap
## Follow-up Required
```
