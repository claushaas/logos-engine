# 14 - Real LLM Integration Plan

## 1. Purpose

This document turns the known limitation in `LIMITATIONS.md` into an
implementation plan for making LOGOS Engine useful with real language models.
For the executable implementation sequence, see
`docs/15-real-llm-implementation-roadmap.md`.

The current product value depends on AI-assisted conversation, semantic
extraction, completeness evaluation, and canonical-answer drafting. A
fixture-only `MockLlmProvider` proves deterministic runtime behavior, but it
cannot produce meaningful project documentation for real users.

## 2. Current Gap

`LIMITATIONS.md` states that LOGOS Engine only ships with `MockLlmProvider`,
has no real OpenAI, Anthropic, Ollama, or equivalent adapter, and therefore
cannot produce meaningful canonical answers.

The live code partially supports the future integration:

- `src/application/generate-agent-turn.ts` already accepts an `LlmProvider`.
- `src/application/runtime.ts` resolves a provider during runtime creation.
- `src/llm/client.ts`, `src/llm/generate-text.ts`, and
  `src/llm/generate-structured-output.ts` already contain an
  OpenAI-compatible client layer.
- `src/validation/agent-turn-validator.ts` already validates structural and
  semantic `AgentTurnOutput` proposals before state application.
- `src/validation/repair-prompt.ts` already builds repair prompts for invalid
  structured output.

The missing product bridge is that no real adapter implements the
`LlmProvider` interface and runtime startup falls back to `MockLlmProvider`
when no injected provider is supplied.

## 3. Contract Sources

The integration must follow these existing docs:

- `docs/architecture/05-llm-integration-architecture.md`: the LLM is a
  reasoning and language-generation dependency, never runtime authority.
- `docs/05-prompt-orchestration-spec.md`: prompt behavior is selected from
  profile, active node, lifecycle, prompt state, completeness, dependencies,
  allowed actions, user message, and global context.
- `docs/06-agent-turn-contract.md`: every LLM turn must produce structured
  `AgentTurnOutput`.
- `docs/03-conversation-runtime-spec.md`: user turns are node-scoped, and
  canonical answers are generated only after valid synthesis conditions.
- `docs/11-conversation-quality-and-completeness.md`: the model must evaluate
  coverage, specificity, contradiction, assumptions, and readiness.
- `docs/architecture/08-error-handling-and-recovery.md`: provider failures
  are recoverable and must not append failed assistant messages.
- `docs/architecture/09-testing-architecture.md`: normal CI must stay
  network-free and provider-free.
- `docs/architecture/adr/0006-use-structured-llm-output.md`: structured JSON
  output is required.
- `docs/architecture/adr/0007-prevent-llm-from-mutating-state-directly.md`:
  only validated state-engine transitions may mutate state.

## 4. Non-Negotiable Integration Rules

- Real LLM calls must be opt-in and explicit.
- `--mock` and deterministic tests must continue to work without credentials.
- The runtime must not silently use mock output when the user expects a real
  model. If no real provider is configured, show a provider-unconfigured state.
- Raw API keys must never be stored in project files, rendered in the TUI, or
  written to logs.
- Remote calls must send only the deterministic node-scoped prompt context.
- Real provider output must pass the same `AgentTurnOutput` validator used for
  mock output.
- Invalid provider output must enter the repair loop before becoming a
  recoverable error.
- The LLM must never accept nodes, export documents, change profiles, mutate
  persistence, or bypass user confirmation.

## 5. Provider Strategy

### 5.1 First Supported Provider Family

Implement an OpenAI-compatible adapter first.

Reason:

- The current `src/llm/client.ts` already assumes an OpenAI-compatible chat
  completion API.
- OpenAI-compatible endpoints cover OpenAI, OpenRouter, Ollama, LM Studio, and
  many custom local gateways.
- The adapter can satisfy the architecture contract quickly without adding a
  provider SDK dependency.

### 5.2 Native Provider Adapters

After the OpenAI-compatible adapter is stable, add native adapters only when
they provide a clear benefit:

- Anthropic native API for first-class Claude support.
- Provider-specific diagnostics or structured-output features.
- Local-model adapters that need non-OpenAI request or response shapes.

Native adapters must still implement the same `LlmProvider` boundary.

## 6. Implementation Plan

### Phase 0 - Reconcile Documentation and Runtime Truth

Goal: stop presenting aspirational provider support as current behavior.

Tasks:

- Update user-facing docs to distinguish current mock-only behavior from the
  planned real-provider path.
- Keep `LIMITATIONS.md` as the current-state source until the adapter ships.
- Add this plan to the docs index and roadmap references.
- Define the minimum supported live-provider workflow:
  `LOGOS_LLM_API_KEY=... logos --provider openai-compatible --model ...`.

Acceptance:

- Docs clearly say mock provider is current default.
- Docs clearly say real LLM support is planned by this document.
- No README or walkthrough section implies real provider support is already
  complete.

### Phase 1 - Harden the Provider Boundary

Goal: make the provider interface ready for real network calls without leaking
provider details into application logic.

Tasks:

- Keep `LlmProvider.generateStructuredOutput(request)` as the application
  boundary.
- Add a real-provider options type for provider id, model, base URL, token env,
  timeout, retry, and disclosure state.
- Decide where provider diagnostics live: either in `AgentDiagnostic` entries
  or a side-channel runtime diagnostic event.
- Preserve the current application pipeline:
  prompt assembly -> provider call -> output validation -> state application.

Acceptance:

- Application use cases still depend on `LlmProvider`, not concrete adapters.
- TUI modules do not import real provider adapters.
- Existing mock-provider tests remain unchanged or require only narrow type
  updates.

### Phase 2 - Add a Real OpenAI-Compatible Adapter

Goal: make `src/llm` capable of producing validated `AgentTurnOutput` through a
real provider.

Tasks:

- Add `src/llm/openai-compatible-provider.ts`.
- Implement `LlmProvider` by wrapping the existing `createLlmClient` or the
  lower-level structured-output helpers.
- Convert `LlmRequest.systemPrompt` plus `LlmRequest.messages` into provider
  chat messages.
- Pass a real JSON Schema for `AgentTurnOutput`, not only the current human
  schema reference.
- Preserve request metadata needed for diagnostics: provider id, model, node
  id, prompt state, lifecycle, latency, token usage, and repair attempt.
- Normalize provider failures into `llm_provider` errors.

Acceptance:

- A unit test proves the adapter sends `response_format: json_schema`.
- A mocked fetch test proves API-key, model, base URL, schema name, messages,
  and temperature are mapped correctly.
- A mocked fetch test proves a valid provider JSON response becomes
  `AgentTurnOutput`.
- A mocked fetch test proves malformed provider output is rejected.

### Phase 3 - Export a Canonical AgentTurnOutput JSON Schema

Goal: make structured output enforceable by real providers.

Tasks:

- Export a canonical JSON Schema for `AgentTurnOutput`.
- Keep the schema in sync with `validateAgentTurnOutput`.
- Decide whether to generate JSON Schema from Zod or maintain a hand-written
  schema with tests.
- Ensure strict structured-output compatibility:
  all provider-required object shapes must be explicit, and unknown fields
  should not be needed for the core contract.
- Add schema tests for representative valid and invalid outputs.

Acceptance:

- The adapter can pass the schema directly to OpenAI-compatible
  `response_format: { type: "json_schema" }`.
- Contract tests prove the JSON Schema and Zod validation do not drift for core
  cases.
- The schema includes `userFacingMessage`, lifecycle proposals, prompt-state
  proposals, canonical-answer drafts, completeness, extracted data, suggested
  actions, transition intent, and diagnostics.

### Phase 4 - Wire Runtime and CLI Configuration

Goal: make real-provider mode reachable by users without test-only injection.

Tasks:

- Add runtime provider resolution:
  - `--mock` or `LOGOS_USE_MOCK_LLM=true` selects `MockLlmProvider`.
  - real provider flags or `LOGOS_LLM_*` config select the real adapter.
  - missing real config shows provider-unconfigured, not silent mock behavior.
- Add CLI flags for provider, model, base URL, timeout, and token env.
- Preserve environment variable support:
  `LOGOS_LLM_PROVIDER`, `LOGOS_LLM_MODEL`, `LOGOS_LLM_BASE_URL`,
  `LOGOS_LLM_API_KEY`, and `LOGOS_LLM_TOKEN_ENV`.
- Reflect provider status in `/status` and TUI header/context rail.
- Ensure deterministic commands still run without provider credentials.

Acceptance:

- `logos --mock` still starts with deterministic mock output.
- `LOGOS_USE_MOCK_LLM=true logos` still starts with deterministic mock output.
- `logos --provider openai-compatible --model <model>` requires a token source.
- When real provider config is missing, the TUI displays provider-unconfigured
  and offers configuration guidance.
- Runtime no longer silently falls back to mock when the user requested real AI.

### Phase 5 - Add Disclosure, Privacy, and Redaction Controls

Goal: make remote model calls safe enough for local repository usage.

Tasks:

- Require remote-provider disclosure acceptance before the first remote call.
- Store only the disclosure state and token environment variable name, never raw
  tokens.
- Add a prompt-context redaction pass for likely secrets, env file content,
  private keys, tokens, and obvious credentials.
- Keep context node-scoped according to the prompt assembly priority rules.
- Add a debug mode that can inspect sanitized prompts without raw provider
  payloads or secrets.

Acceptance:

- Tests prove raw token values are never persisted or rendered.
- Tests prove common secret patterns are redacted before provider calls.
- Real provider calls are blocked until disclosure is accepted.
- Prompt debug output is sanitized by default.

### Phase 6 - Implement Validation Repair Around Real Calls

Goal: recover from real-model schema or semantic mistakes without corrupting
state.

Tasks:

- Use `validateAgentTurnOutput` after every provider response.
- On validation failure, call `buildNextRepairAttempt`.
- Retry repair up to the configured limit.
- Do not append invalid assistant messages.
- Return a recoverable diagnostic if repair fails.
- Track repair attempts in provider diagnostics.

Acceptance:

- Tests prove invalid first output plus valid repair output succeeds.
- Tests prove repeated invalid output returns a recoverable error.
- Tests prove failed repair does not mutate node lifecycle, canonical answer,
  messages, document readiness, or persistence.

### Phase 7 - Add Manual Live Smoke Tests

Goal: verify real provider behavior without making CI depend on credentials.

Tasks:

- Add a manual script such as `pnpm smoke:llm`.
- Gate it behind explicit environment variables and skip when credentials are
  absent.
- Exercise one minimal node turn and one synthesis-like structured output.
- Print sanitized diagnostics: provider, model, latency, token usage, repair
  count, and validation result.

Acceptance:

- `pnpm check` remains provider-free and network-free.
- `pnpm smoke:llm` can be run manually with credentials.
- The smoke output never prints API keys or raw provider payloads.

### Phase 8 - Dogfood the Real Conversation Loop

Goal: prove LOGOS can generate useful canonical answers from actual user
conversation.

Tasks:

- Run the startup profile with a real provider against a small project.
- Validate these flows:
  - initial question;
  - follow-up;
  - clarification;
  - refinement;
  - synthesis;
  - user accept/edit/regenerate;
  - document preview;
  - export.
- Capture failures as either prompt gaps, schema gaps, runtime bugs, or UX gaps.
- Only then update `LIMITATIONS.md` to remove the mock-only limitation.

Acceptance:

- At least one node reaches synthesized state from real model output.
- At least one canonical answer is accepted by explicit user action.
- Generated Markdown uses accepted canonical answers, not raw chat.
- Diagnostics show model, provider, latency, token usage, and repair count.
- `LIMITATIONS.md` is updated with the new remaining risks instead of saying
  no real provider exists.

## 7. Suggested First Development Slice

Implement the smallest useful path:

1. Export `agentTurnOutputJsonSchema`.
2. Add `OpenAiCompatibleLlmProvider`.
3. Wire runtime selection from `LOGOS_LLM_PROVIDER=openai-compatible`.
4. Keep `--mock` unchanged.
5. Add mocked-fetch tests for request mapping and response validation.
6. Add one manual `pnpm smoke:llm` command.

This slice creates the first real end-to-end path while preserving the
deterministic test architecture.

## 8. Out of Scope for the First Slice

- Native Anthropic adapter.
- Web UI or hosted mode.
- Multi-user provider configuration.
- Automatic provider fallback chains.
- Model benchmarking.
- Long-term cost dashboards.
- Persisting raw prompts or raw provider responses.

## 9. Readiness Checklist

Real LLM integration is ready to claim when:

- `MockLlmProvider` remains available and deterministic.
- A real provider adapter implements `LlmProvider`.
- Runtime can select real or mock provider explicitly.
- Provider status is visible in the TUI.
- Remote calls require token source and disclosure acceptance.
- Provider responses are constrained by `AgentTurnOutput` JSON Schema.
- Provider responses pass semantic validation before state mutation.
- Invalid output repair is implemented.
- Provider failures are recoverable and diagnosable.
- Normal CI remains provider-free.
- Manual live smoke testing proves at least one real node conversation can
  reach a reviewable canonical answer.
