# ADR-0003 — Use activeNodeId as Runtime Focus

## Status

Proposed

## Context

The runtime must distinguish between two primary modes: a structural overview showing the entire profile tree, and a node-focused conversational mode for working on a specific node. The switch between modes must be explicit and deterministic.

## Decision

Use `activeNodeId` as the single field that determines the session mode. When `null`, the session is in structural/deterministic mode. When set to a valid node ID, the session is in node-focused conversational mode.

## Consequences

The TUI can derive its rendering mode from a single boolean-like field. Mode resolution is pure and always consistent. Navigation between nodes is explicit.

## Alternatives Considered

- Separate `mode` enum with independent `currentNode` field
- Multi-select active nodes
- Implicit mode derived from last action

## Trade-offs

Requires consistent updates to `activeNodeId` on every navigation action. The field must be validated against the selected profile's node set.

## Follow-up Actions

- Implement `resolveSessionMode` in state engine
- Implement node selection/deselection
- Wire TUI mode switching to `activeNodeId`
