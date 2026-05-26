# Implement Step 17.2 — Implement Agent Pack generation placeholder

You are implementing Step 17.2 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 17.2, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 17.2;
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

Implement **only** Step 17.2.

## Objective

Create the Agent Pack export pathway: a portable context package for downstream AI agents, containing canonical answers, document structure, and metadata.

## Why This Step Exists

Agent Packs enable the LOGOS Engine outputs to feed into other AI tools and coding agents.

## Required Inputs

- `docs/architecture/10-local-development-and-deployment.md`
- `docs/13-prototypes.md` §3.12

## Relevant Docs

- `docs/architecture/10-local-development-and-deployment.md`
- `docs/13-prototypes.md` §3.12

## Tasks

1. Create `src/outputs/agent-pack-exporter.ts`:
   - `exportAgentPack(documentIds, state, profile): Promise<Result<GeneratedArtifact, ExportError>>`
   - Aggregate all accepted canonical answers.
   - Include document structure and dependency information.
   - Output as structured JSON or Markdown package.
   - Label as derived, non-canonical.
   - Include source traceability metadata.

## Files / Areas Likely Affected

- `src/outputs/agent-pack-exporter.ts` (new)

## Acceptance Criteria

- Agent Pack contains all accepted answers from specified documents.
- Includes metadata: source nodes, timestamps, profile version.
- Labeled as `[derived]`, non-canonical.
- Export blocked on incomplete documents.

## Tests / Validation

- Unit test: agent pack generated with correct structure.
- Unit test: includes all accepted answers.
- Unit test: blocked on incomplete document.

## Dependencies

- Step 16.2 — Markdown export

## Implementation Constraints

- Preserve module boundaries. Do not add features not requested.

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
