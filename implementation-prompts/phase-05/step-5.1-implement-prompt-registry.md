# Implement Step 5.1 — Implement prompt registry

You are implementing Step 5.1 from `IMPLEMENTATION_ROADMAP.md`.

## Execution Protocol

Read `00-execution-protocol.md`, `00-execution-board.md`, and relevant docs first. Follow the execution protocol exactly.


## Mandatory Codegraph Discovery

Before editing code for Step 5.1, you must use the codegraph extension to discover the existing repository context.

Use codegraph to inspect:
- files likely affected by Step 5.1;
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

Implement **only** Step 5.1.

## Objective

Build a registry that stores and retrieves prompt definitions by profile, node type, and prompt state, with fallback chains.

## Why This Step Exists

The prompt orchestrator needs a centralized, queryable prompt store. Fallback chains ensure graceful degradation when profile-specific prompts don't exist.

## Required Inputs

- `docs/05-prompt-orchestration-spec.md` §6-7
- `docs/10-profile-and-node-schema-spec.md` §10 — prompt references

## Relevant Docs

- `docs/05-prompt-orchestration-spec.md`
- `docs/10-profile-and-node-schema-spec.md`

## Tasks

1. Create `src/prompt-orchestration/prompt-registry.ts` with `PromptRegistry` class/module:
   - `register(prompt: PromptDefinition): void`
   - `lookup(profileId, nodeType, promptState): PromptDefinition | null`
   - Fallback chain: `node-specific → document-specific → phase-specific → profile-generic → global prompt-state fallback`.
   - `loadPromptsFromDirectory(dir: string): Promise<void>` — load `.md` prompt files.
2. Define `PromptDefinition` with `id`, `scope`, `promptState`, `content`, `outputSchemaRef`, `version`.
3. Provide default fallback prompts for each `PromptState`: `initial`, `follow_up`, `clarification`, `refinement`, `synthesis`, `review`, `repair`, `blocked`, `accepted`.

## Files / Areas Likely Affected

- `src/prompt-orchestration/prompt-registry.ts` (new)
- `src/prompt-orchestration/default-prompts.ts` (new)
- `src/prompt-orchestration/index.ts` (new)

## Acceptance Criteria

- Registry stores and retrieves prompts.
- Fallback chain resolves correctly: profile-specific → generic.
- All 9 `PromptState` values have at least a global fallback prompt.
- Prompts can be loaded from filesystem.

## Tests / Validation

- Unit test: register and lookup exact match.
- Unit test: fallback from node-specific to generic.
- Unit test: lookup for unregistered state returns global fallback.
- Unit test: all 9 prompt states have fallback content.

## Dependencies

- Step 1.2 — `PromptState` type

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

