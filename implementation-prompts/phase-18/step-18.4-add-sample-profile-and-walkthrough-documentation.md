# Implement Step 18.4 — Add sample profile and walkthrough documentation

You are implementing Step 18.4 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 18.4, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 18.4;
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

Implement **only** Step 18.4.

## Objective

Bundle a complete sample profile ("Startup" from the prototypes) and write developer/user walkthrough documentation.

## Why This Step Exists

New users and developers need a concrete example to understand the system's behavior without configuring a LLM provider.

## Required Inputs

- `docs/13-prototypes.md` wireframes (references a "Startup" profile)
- `docs/10-profile-and-node-schema-spec.md`

## Relevant Docs

- `docs/10-profile-and-node-schema-spec.md`
- `docs/13-prototypes.md`
- `docs/architecture/10-local-development-and-deployment.md`

## Tasks

1. Create `profiles/startup.yml` — a complete profile with:
   - 3 phases (Foundation, Validation, Product)
   - Multiple documents per phase
   - 10-12 nodes with canonical questions, coverage topics, sufficiency criteria
   - Dependency declarations
   - Materialization rules
2. Create `docs/walkthrough.md`:
   - Step-by-step: install, start TUI, select profile, complete first node, accept, preview document, export.
   - With mock provider (no API key needed).
3. Create `docs/development.md`:
   - Development setup, architecture overview, module guide, testing guide.

## Files / Areas Likely Affected

- `profiles/startup.yml` (new)
- `docs/walkthrough.md` (new)
- `docs/development.md` (new)

## Acceptance Criteria

- Sample profile loads without errors.
- Walkthrough can be followed with mock LLM.
- Development guide covers module structure and testing.

## Tests / Validation

- Unit test: load sample profile → valid.
- Manual: follow walkthrough from start to export.

## Dependencies

- Step 16.1 — CLI entry point

## Implementation Constraints

- Do not add features not requested.

## Required Commands

```bash
pnpm typecheck
# Manual validation + pnpm check if available
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
