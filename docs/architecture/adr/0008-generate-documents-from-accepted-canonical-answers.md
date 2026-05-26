# ADR-0008 — Generate Documents from Accepted Canonical Answers

## Status

Proposed

## Context

Documents are the primary output of the LOGOS Engine. They must be coherent, accurate, and traceable to source material. Using raw conversation messages as document source would produce noisy, unpolished output.

## Decision

Documents are materialized exclusively from accepted, non-stale canonical answers. The materializer reads canonical answers from nodes that have reached the `accepted` lifecycle state and assembles them according to document materialization rules.

## Consequences

Document quality is gated by node acceptance. Stale canonical answers are excluded from document generation. Documents can be regenerated deterministically from the same canonical answer set.

## Alternatives Considered

- Generate documents directly from complete conversations
- Use the LLM to write documents independently of canonical answers
- Allow partial documents from non-accepted nodes

## Trade-offs

Documents cannot be generated until all required nodes are accepted. This enforces quality but may delay document availability.

## Follow-up Actions

- Implement document readiness computation
- Implement document materializer
- Implement staleness cascade
