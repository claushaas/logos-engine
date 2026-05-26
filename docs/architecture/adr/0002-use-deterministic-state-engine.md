# ADR-0002 — Use Deterministic State Engine

## Status

Proposed

## Context

The LOGOS Engine must provide a conversational user experience without becoming unpredictable or dependent on free-form LLM behavior. The user should interact naturally, but the system must know which node is active, which actions are valid, when a node is complete, and when documents can be generated.

## Decision

Use a deterministic state engine to own runtime state, node lifecycle, allowed actions, transition guards, prompt state, and document readiness. The state engine is the single authority for all state mutations.

## Consequences

The TUI can remain conversational while runtime behavior remains auditable. LLM output must be validated before state mutation. More upfront schema work is required.

## Alternatives Considered

- Let the LLM manage conversation state
- Use static forms
- Use a simple global chat transcript

## Trade-offs

This adds implementation complexity, but prevents the product from becoming either too rigid or too chaotic.

## Follow-up Actions

- Implement state engine module
- Add transition matrix tests
- Add structured output validation
