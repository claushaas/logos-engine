# ADR-0006 — Use Structured LLM Output

## Status

Proposed

## Context

Free-form LLM text output requires post-hoc parsing to extract structured information (lifecycle intent, canonical answer draft, completeness evaluation). This is fragile and error-prone. The LLM must produce output the state engine can consume deterministically.

## Decision

Require all LLM output to conform to a structured `AgentTurnOutput` contract. Use JSON Schema with `response_format: json_schema` to guarantee structural conformance. Validate output against the contract before applying to state.

## Consequences

LLM output is always parseable. The state engine receives typed, validated proposals. Repair prompts can be generated for invalid output. The LLM cannot accidentally corrupt state through malformed output.

## Alternatives Considered

- Free-form text with regex extraction
- Function calling / tool use
- Hybrid: structured envelope with free-form content fields

## Trade-offs

Requires schema definition and validation infrastructure. May slightly increase token usage due to structured format overhead.

## Follow-up Actions

- Define `AgentTurnOutput` contract types
- Implement validation module
- Implement repair prompt generation
