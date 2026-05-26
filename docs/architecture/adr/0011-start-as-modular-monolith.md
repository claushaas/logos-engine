# ADR-0011 — Start as Modular Monolith

## Status

Proposed

## Context

The LOGOS Engine has multiple bounded contexts (state engine, conversation runtime, TUI, materialization, persistence). Each could be a separate package or service. However, early extraction into separate packages adds build complexity, versioning overhead, and inter-package coordination that slows development.

## Decision

Start as a single TypeScript package with strict module boundaries enforced at the directory level. Module boundaries are verified by architecture tests and lint rules. Extraction into separate packages is deferred until a clear boundary justifies the cost.

## Consequences

Development velocity is higher in the early phases. Module boundaries are enforced but modules share a single build pipeline and typecheck step. Refactoring across modules is simpler.

## Alternatives Considered

- Monorepo with separate packages from day one
- Microservices with API boundaries
- Single package without enforced module boundaries

## Trade-offs

Risk of accidental boundary violations increases without package-level enforcement. Extraction later requires untangling imports.

## Follow-up Actions

- Enforce module boundaries through architecture tests
- Add boundary lint rules
- Document extraction criteria for future packages
