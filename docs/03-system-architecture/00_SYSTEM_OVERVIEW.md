# System Overview

## Architecture Summary

LOGOS Engine is a local-first TypeScript TUI application.

It runs inside a project directory and manages a structured documentation workspace.

## High-Level Components

```text
TUI
→ Command Router
→ Profile Loader
→ Interrogation Engine
→ Decision Registry
→ Validation Engine
→ Document Renderer
→ Diagnostics Engine
→ File System Adapter
```

## Core Data Flow

```text
User answer
→ Answer record
→ Decision extraction
→ Decision registry update
→ Validation
→ Document rendering
→ Diagnostics
```

## Source of Truth

The structured project state is the source of truth.

Markdown documents are generated projections.

## Storage

V1 uses filesystem storage.

Recommended structure:

```text
.logos/
  project.json
  decisions.json
  answers.json
  sessions/
  diagnostics.json
  profile.lock.json

docs/
  ...
```

## Runtime

Recommended stack:

- Node.js;
- TypeScript;
- Ink for TUI;
- Zod for schemas;
- Markdown templates;
- JSON for local state.

## Why TypeScript

TypeScript is a good fit because:

- strong schema modeling;
- familiar to web/app developers;
- easy CLI distribution;
- good TUI ecosystem;
- good Markdown and JSON tooling;
- natural fit for future integrations.
