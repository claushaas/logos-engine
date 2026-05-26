# Architecture

This folder defines the executable architecture of the LOGOS Engine.

The architecture must preserve the product thesis:

```txt
Conversation is the interface.
State is deterministic.
Prompts are selected by state.
Documents are materialized outputs.
```

## Documents

```txt
01-system-architecture.md
02-runtime-architecture.md
03-module-boundaries.md
04-data-and-persistence-architecture.md
05-llm-integration-architecture.md
06-tui-rendering-architecture.md
07-contracts-and-schemas.md
08-error-handling-and-recovery.md
09-testing-architecture.md
10-local-development-and-deployment.md
11-architecture-decision-records.md
```

## Architectural Rule

The LOGOS Engine must not become a deterministic form interface.

Determinism belongs in the state engine, contracts, transitions, validators, and persistence model.

The user-facing interaction remains conversational.
