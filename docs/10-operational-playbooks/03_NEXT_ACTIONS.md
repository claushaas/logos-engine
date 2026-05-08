# Next Actions

## Immediate Next Step

Create the initial repository and commit this documentation package.

## Recommended Repository Name

```text
logos-engine
```

Alternative:

```text
stoa-logos-engine
```

## First Implementation Sprint

### Goal

Create a working CLI skeleton and workspace initializer.

### Tasks

- initialize TypeScript project;
- create CLI entrypoint;
- implement `logos init`;
- create `.logos/`;
- create `docs/`;
- write project metadata;
- include app-business profile stub;
- generate initial README docs.

## Second Implementation Sprint

### Goal

Implement AI-led conversational intake.

### Tasks

- define question and conversation turn schemas;
- create foundation coverage prompts;
- store answers;
- implement conversational `/continue` resume behavior;
- update project state.

## Third Implementation Sprint

### Goal

Implement decision registry and basic rendering.

### Tasks

- define decision schema;
- map answers to decisions;
- render IDEA_BRIEF.md;
- render ASSUMPTIONS.md;
- render OPEN_QUESTIONS.md.

## Fourth Implementation Sprint

### Goal

Implement diagnostics.

### Tasks

- define validation rule schema;
- implement missing decision checks;
- implement `logos diagnose`;
- show next suggested questions.

## Strategic Recommendation

Do not implement all profiles now.

Do not build a web app now.

Do not build multi-agent orchestration now.

Make the App Business profile excellent first.
