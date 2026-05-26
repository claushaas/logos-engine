# ADR-0005 — Separate Raw Conversation from Canonical Answers

## Status

Proposed

## Context

Raw conversation messages contain back-and-forth dialogue between the user and the LLM. This dialogue may contain digressions, clarifications, and revisions. Documents must be built from clean, definitive statements, not from raw chat transcripts.

## Decision

Maintain two distinct data stores per node: the raw conversation (`NodeConversation`) and the canonical answer (`CanonicalAnswer`). The canonical answer is a synthesized summary derived from the conversation, not the conversation itself.

## Consequences

Document materialization uses canonical answers as source material, ensuring clean output. The conversation remains available for context and audit. Staleness tracking applies to canonical answers, not raw messages.

## Alternatives Considered

- Use the last assistant message as the canonical answer
- Store only canonical answers, discard conversation
- Mark conversation messages as "canonical" inline

## Trade-offs

Adds complexity in managing two data structures. Requires synthesis step to derive canonical answers from conversation.

## Follow-up Actions

- Implement canonical answer management
- Implement staleness cascade
- Ensure materializer reads only canonical answers
