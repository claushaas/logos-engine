# ADR-0001 — Use Conversation-First TUI

## Status

Proposed

## Context

The LOGOS Engine must provide a user interface for structured documentation intake. Traditional form-based interfaces impose a rigid question-answer structure. A chat-based interface risks losing structure. The TUI must balance conversational fluidity with structured output.

## Decision

Use a conversation-first Terminal UI where the primary interaction surface is a node-focused conversation panel. The TUI renders the current node's conversation history, prompts the user to respond, and displays actions as conversation options rather than form fields.

## Consequences

The TUI feels natural and conversational while the state engine maintains structure. Users navigate between nodes via sidebar rather than filling out forms. The conversation-first design must not allow the LLM to own state.

## Alternatives Considered

- Static form-based TUI with labeled fields per node
- Pure chat interface without node structure
- Hybrid approach mixing forms and chat

## Trade-offs

Conversation-first can feel less "efficient" than forms for simple answers, but prevents the product from becoming a form-filling tool. More complex rendering logic is required in the TUI.

## Follow-up Actions

- Implement node-focused conversational rendering
- Implement sidebar navigation
- Implement action bar rendering
