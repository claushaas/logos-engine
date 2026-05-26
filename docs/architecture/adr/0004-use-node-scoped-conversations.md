# ADR-0004 — Use Node-Scoped Conversations

## Status

Proposed

## Context

The LOGOS Engine must support conversations about multiple independent topics (nodes) within a session. A single global chat transcript would mix unrelated topics and make it impossible to determine per-node completeness.

## Decision

Each node owns its own conversation history, lifecycle, canonical answer, and completeness state. Conversations are scoped to the active node. When the user switches nodes, the conversation context switches accordingly.

## Consequences

Per-node completeness evaluation is straightforward. Node state is isolated and independently trackable. Prompts can be tailored per node. The sidebar can display per-node status accurately.

## Alternatives Considered

- Global chat transcript with topic tags
- Threaded conversation model
- Single conversation with sections

## Trade-offs

Requires conversation state management per node. Context switching adds complexity to the application layer.

## Follow-up Actions

- Implement node-scoped message management
- Implement canonical answer per node
- Implement per-node completeness evaluation
