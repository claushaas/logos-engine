# LOGOS Core

LOGOS Core is the Pi-independent product engine.

It owns product behavior such as configuration, profile resolution, intake state, question selection, answer evaluation contracts, generation preflight, validation, artifacts, and persistence ports.

Core must not import Pi APIs, Pi extension modules, Ink, React, TUI modules, or CLI command modules.

Pi-specific code belongs outside Core.

## Result and Message Contracts

Core communicates with external surfaces (such as the Pi Extension) through plain, serializable result envelopes defined in:

- `messages.ts` — `AssistantMessage`, `AssistantAction`, and related kinds.
- `errors.ts` — `LogosErrorCode`, `LogosError`, and structured error shapes.
- `result.ts` — `CoreResult<TData>`, `LogosNotice`, `LogosWarning`, `LogosBlocker`, `ChangedPath`, and safe helper constructors.

These contracts are renderer-agnostic and carry no Pi or UI dependencies.
