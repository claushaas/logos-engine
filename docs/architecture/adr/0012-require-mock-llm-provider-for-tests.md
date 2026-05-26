# ADR-0012 — Require Mock LLM Provider for Tests

## Status

Proposed

## Context

The LOGOS Engine depends on LLM calls for core functionality (conversation, synthesis, validation). Tests that depend on real LLM calls are slow, expensive, non-deterministic, and cannot run in CI without API keys. The test suite must be fast, reliable, and credential-free.

## Decision

Require a mock LLM provider that returns fixture-based responses for all tests. The mock provider implements the same `LlmClient` interface as the real provider. Test fixtures define deterministic responses for known inputs. Tests that require the real LLM are integration tests and run separately.

## Consequences

The test suite runs without network access or API credentials. Test results are deterministic. New test scenarios can be added by defining fixtures. The mock provider validates that the system correctly handles various LLM output shapes.

## Alternatives Considered

- Record/replay of real LLM responses
- Skip LLM-dependent tests in CI
- Use a small local model for testing

## Trade-offs

Mock responses may drift from real LLM behavior over time. Fixtures must be maintained when prompts change. Real LLM integration requires separate validation.

## Follow-up Actions

- Implement `MockLlmProvider`
- Create fixture-based test harness
- Add CI step that does not require API keys
