# LOGOS Engine — Execution Protocol

## Core Rule

Implement exactly one roadmap step at a time.

One agent invocation = one step = one implementation + one report + one commit recommendation.

## Non-Negotiable Rules

- Do not implement later roadmap steps.
- Do not rewrite architecture unless the current step requires it.
- Do not bypass state engine rules.
- Do not let the TUI own state logic.
- Do not let the LLM mutate state directly.
- Preserve conversation-first behavior.
- Preserve sidebar as navigation, not form input.
- Add or update tests required by the step.
- Run validation gates before finishing.
- Use codegraph for repository discovery before editing.
- Use `@juicesharp/rpiv-advisor` before implementation.
- Use `@juicesharp/rpiv-advisor` again before final report.
- Produce a final step report.
- Update or recommend update to the execution board.

## Mandatory Codegraph Discovery

Before editing code, the agent must use the codegraph extension to inspect the repository.

The agent must identify:
- relevant existing files;
- relevant symbols (types, functions, classes, components);
- existing tests;
- import relationships and dependency chains;
- module boundary risks;
- likely files to edit;
- files that should not be touched (belong to later roadmap steps);
- whether the step is greenfield, migration, or adaptation.

The agent must produce a **Codegraph Discovery Summary** before implementation.

## Required Initial Analysis

Before editing code, the agent must:

1. Inspect the repository structure.
2. Use codegraph to discover relevant files, symbols, imports, and tests.
3. Identify overlap with existing implementation.
4. Decide whether the step is greenfield, migration, or adaptation.
5. Identify dependencies already implemented.
6. Identify mismatches between roadmap assumptions and repository reality.
7. Use `@juicesharp/rpiv-advisor` to review the implementation plan.
8. Report the implementation plan briefly before editing.

## Required Final Review

Before final response, the agent must:

1. Run the required validation gates.
2. Use `@juicesharp/rpiv-advisor` to review the implementation.
3. Confirm acceptance criteria status.
4. Recommend the execution board update.
5. Identify next step.

## Required Final Report

Each implementation run must end with:

```md
# Step X.Y Report

## Status
Done / Partial / Blocked / Needs Decision

## Files Changed
...

## Implementation Summary
...

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
...

## Tests Added / Updated
...

## Commands Run
...

## Results
...

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
...

## Follow-up Required
...
```

## Start-of-Step Protocol

1. Open `implementation-prompts/00-execution-board.md`.
2. Find the current step.
3. Update status to `🔵 In progress`.
4. Open the step prompt file.
5. Read all referenced documents.
6. Use codegraph for repository discovery.
7. Produce Codegraph Discovery Summary.
8. Perform initial analysis.
9. Use `@juicesharp/rpiv-advisor`.
10. Implement.
11. Test.
12. Run validation gates.
13. Use `@juicesharp/rpiv-advisor` again.
14. Produce final report.
15. Update execution board recommendation.

## Checkpoint Protocol (End of Phase)

At the end of each phase:

1. All steps in the phase must be at least `🟡 Needs review`.
2. Run `pnpm check` (full gate).
3. Verify phase milestone is met.
4. Document any phase-level deviations.
5. Proceed to next phase only after all phase steps pass review.
