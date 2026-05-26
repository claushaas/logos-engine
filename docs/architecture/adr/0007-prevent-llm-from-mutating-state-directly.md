# ADR-0007 — Prevent LLM from Mutating State Directly

## Status

Proposed

## Context

An LLM is inherently non-deterministic and can produce unexpected output. If LLM output is applied directly to runtime state, the system becomes unpredictable, unrecoverable, and impossible to audit.

## Decision

The LLM produces proposals (`AgentTurnOutput`). The application layer validates these proposals via the validation module. Only the state engine, through validated transitions, may mutate state. The LLM is never an authority over state.

## Consequences

State transitions are always traceable through the event log. Invalid LLM output does not corrupt state. The system can detect and respond to LLM errors gracefully.

## Alternatives Considered

- Let the LLM directly update a state object
- Use the LLM as the state authority with human override
- Chain multiple LLM calls for verification

## Trade-offs

Adds a validation layer and indirection between LLM output and state mutation. Slightly increases latency per turn.

## Follow-up Actions

- Implement `AgentTurnOutput` validation
- Implement transition intent validation
- Ensure state engine dispatch flows through validation
