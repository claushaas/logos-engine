# Commands

## `logos init`

Creates a LOGOS workspace.

### Responsibilities

- detect project root;
- ask for project name;
- ask for profile;
- create `.logos/`;
- create `docs/`;
- initialize state files;
- generate initial documents.

## `logos continue`

Continues guided intake.

### Responsibilities

- load project state;
- identify next useful phase;
- select question group;
- store answers;
- update decisions;
- offer document regeneration.

## `logos diagnose`

Runs diagnostics.

### Responsibilities

- check missing decisions;
- check dependencies;
- check assumptions;
- check risks;
- report affected documents.

## `logos generate`

Renders documents.

### Options

```bash
logos generate
logos generate --safe
logos generate --refresh
logos generate --force
```

## `logos validate`

Validates current phase or entire project.

### Options

```bash
logos validate
logos validate --phase economics
logos validate --all
```

## `logos status`

Shows progress.

Example:

```text
Profile: App Business

Foundation: 80%
Market: 40%
Economics: 10%
Product: 30%
Architecture: 0%
GTM: 0%
```

## Future Commands

```bash
logos export
logos prompts
logos issues
logos graph
logos profile create
```
