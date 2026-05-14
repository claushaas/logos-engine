# Modules

## 1. CLI Entrypoint

Responsible for starting the application:

```bash
logos
```

## 2. TUI Layer

Responsible for:

- slash command input;
- slash command autocomplete;
- interactive flows;
- profile selection;
- question display;
- progress display;
- diagnostics display;
- confirmation prompts.

## 3. Profile Loader

Responsible for loading:

- profile metadata;
- phases;
- document templates;
- question sets;
- decision schema;
- validation rules;
- dependency rules.

## 4. Interrogation Engine

Responsible for:

- selecting next questions;
- grouping questions;
- applying conditional logic;
- avoiding repeated questions;
- respecting unanswered questions.

## 5. Answer Store

Responsible for storing raw answers.

Answers should not be discarded because future decision extraction may improve.

## 6. Decision Registry

Responsible for maintaining structured project decisions.

## 7. Validation Engine

Responsible for checking:

- required decisions;
- missing dependencies;
- contradiction patterns;
- phase readiness.

## 8. Diagnostics Engine

Responsible for producing:

- open gaps;
- risk summaries;
- affected documents;
- next recommended actions.

## 9. Document Renderer

Responsible for rendering Markdown documents from templates and structured state.

## 10. File System Adapter

Responsible for:

- reading project state;
- writing project state;
- writing docs;
- avoiding destructive overwrites.
