# 15 - Real LLM Implementation Roadmap

## 1. Purpose

This roadmap breaks `docs/14-real-llm-integration-plan.md` into implementable,
testable steps.

The goal is not merely to add a network call. The goal is to make LOGOS Engine
produce useful node-scoped agent turns and canonical-answer drafts from a real
LLM while preserving deterministic state authority, provider-free CI, local
privacy boundaries, explicit user confirmation, and the existing mock provider.

## 2. Implementation Strategy

Implement in vertical slices.

Each slice must leave the repository in a coherent state:

- `--mock` still works.
- Normal `pnpm check` remains provider-free and network-free.
- Real provider behavior is reachable only through explicit configuration.
- Every real LLM response is validated before any state mutation.
- Documentation is updated when user-visible behavior changes.

Do not implement this as one large patch. The integration touches provider
networking, schemas, prompt assembly, runtime startup, CLI flags, TUI status,
privacy, diagnostics, repair, and manual live validation. Splitting the work
keeps failures local and reviewable.

## 3. Scope Boundaries

In scope:

- OpenAI-compatible provider adapter.
- Provider configuration from CLI flags and environment variables.
- Canonical `AgentTurnOutput` JSON Schema for structured output.
- Runtime provider selection.
- Provider status in runtime/TUI surfaces.
- Remote-provider disclosure and token-source handling.
- Prompt-context redaction before remote calls.
- Validation repair loop for real provider output.
- Manual live smoke test behind explicit credentials.
- Documentation updates and `LIMITATIONS.md` closeout once proven.

Out of scope for this roadmap:

- Native Anthropic adapter.
- Web UI or hosted API server.
- Multi-user provider configuration.
- Automatic provider fallback chains.
- Model benchmarking dashboard.
- Persisting raw prompts or raw provider responses.
- Replacing the deterministic state engine with AI judgment.

## 4. Step Overview

| Step | Name | Outcome |
|---|---|---|
| LLM-00 | Baseline and Contract Reconciliation | Current docs/runtime truth is explicit. |
| LLM-01 | Provider Configuration Model | Real provider config has typed, testable resolution. |
| LLM-02 | AgentTurnOutput JSON Schema | Real providers can be constrained to the contract. |
| LLM-03 | OpenAI-Compatible Adapter | A real adapter implements `LlmProvider`. |
| LLM-04 | Adapter Contract Tests | Network mapping and response normalization are proven without network. |
| LLM-05 | Runtime Provider Selection | Runtime can select mock or real provider explicitly. |
| LLM-06 | CLI and Environment Wiring | Users can configure real provider mode intentionally. |
| LLM-07 | Provider Status Surfaces | `/status` and TUI surfaces show real provider state. |
| LLM-08 | Disclosure and Token Safety | Remote calls require consent and never persist raw tokens. |
| LLM-09 | Prompt Context Redaction | Secrets are redacted before remote provider calls. |
| LLM-10 | Real-Output Repair Loop | Invalid real output can be repaired or safely rejected. |
| LLM-11 | Manual Live Smoke Test | A credential-gated smoke proves real provider viability. |
| LLM-12 | Dogfood and Limitation Closeout | The mock-only limitation is retired with evidence. |

## 5. Roadmap Steps

### LLM-00 - Baseline and Contract Reconciliation

Goal: make the current state and target integration unambiguous before code
changes.

Inputs:

- `LIMITATIONS.md`
- `docs/14-real-llm-integration-plan.md`
- `docs/architecture/05-llm-integration-architecture.md`
- `docs/05-prompt-orchestration-spec.md`
- `docs/06-agent-turn-contract.md`
- `docs/architecture/adr/0006-use-structured-llm-output.md`
- `docs/architecture/adr/0007-prevent-llm-from-mutating-state-directly.md`

Tasks:

- Audit README, walkthrough, and development docs for claims that real provider
  support already exists.
- Update any aspirational wording to separate current mock-only behavior from
  planned real-provider behavior.
- Confirm `LIMITATIONS.md` points to the integration plan and this roadmap.
- Record the intended first live-provider workflow:
  `LOGOS_LLM_PROVIDER=openai-compatible LOGOS_LLM_API_KEY=... logos`.

Likely files:

- `README.md`
- `LIMITATIONS.md`
- `docs/development.md`
- `docs/walkthrough.md`
- `docs/14-real-llm-integration-plan.md`
- `docs/15-real-llm-implementation-roadmap.md`

Tests and checks:

- `pnpm lint:md`

Acceptance:

- User-facing docs no longer imply real provider support is complete.
- The mock-only limitation is clearly linked to the implementation roadmap.
- No runtime behavior changes yet.

### LLM-01 - Provider Configuration Model

Goal: define how real provider settings are represented and resolved.

Tasks:

- Add a provider configuration type for:
  - provider id;
  - mode: mock, disabled, or real;
  - model;
  - base URL;
  - token environment variable name;
  - timeout;
  - retry policy;
  - disclosure acceptance state.
- Resolve config from explicit runtime options first, then CLI/env, then safe
  defaults.
- Preserve support for existing env vars:
  `LOGOS_LLM_PROVIDER`, `LOGOS_LLM_MODEL`, `LOGOS_LLM_BASE_URL`,
  `LOGOS_LLM_API_KEY`, `LOGOS_USE_MOCK_LLM`.
- Add `LOGOS_LLM_TOKEN_ENV` so users can store the token source name without
  storing the token value in project files.
- Distinguish three states:
  - mock selected;
  - real provider configured;
  - real provider requested but unconfigured.

Likely files:

- `src/llm/config.ts`
- `src/llm/index.ts`
- `tests/llm/config.test.ts`

Tests and checks:

- Config resolves explicit options before env values.
- `--mock` and `LOGOS_USE_MOCK_LLM=true` select mock mode.
- Real mode without a token source is reported as unconfigured.
- Raw token values are not included in config serialization helpers.

Acceptance:

- Provider config can be tested without creating a runtime.
- No provider network call exists yet.
- Existing config behavior remains compatible where possible.

### LLM-02 - AgentTurnOutput JSON Schema

Goal: provide the real JSON Schema required by structured-output providers.

Tasks:

- Export a canonical JSON Schema for `AgentTurnOutput`.
- Keep schema values aligned with:
  - lifecycle values;
  - prompt-state values;
  - action values;
  - transition-event values;
  - canonical-answer draft shape;
  - completeness shape;
  - extracted semantic data shape;
  - diagnostics shape.
- Decide whether the schema is hand-written or generated from validation
  schemas. Prefer the least fragile option for the current codebase.
- Add drift tests between representative JSON Schema cases and
  `validateAgentTurnOutput`.
- Document that the schema constrains provider output, while the existing
  validator remains the semantic authority.

Likely files:

- `src/contracts/agent-turn.schema.ts`
- `src/contracts/index.ts`
- `src/validation/agent-turn-validator.ts`
- `tests/contracts/agent-turn-json-schema.test.ts`
- `tests/contracts/agent-turn-schema.test.ts`

Tests and checks:

- Valid minimal output passes JSON Schema and semantic validation.
- Valid synthesis output with a draft passes JSON Schema and semantic
  validation in synthesis-compatible context.
- Invalid empty `userFacingMessage` fails.
- Invalid lifecycle, action, prompt state, and transition event fail.
- Schema and semantic validator disagreement is documented in tests when
  semantic context is required.

Acceptance:

- The adapter can pass a real schema to
  `response_format: { type: "json_schema" }`.
- The old human-readable schema reference is no longer the only schema source.

### LLM-03 - OpenAI-Compatible Adapter

Goal: implement the first real `LlmProvider`.

Tasks:

- Add `OpenAiCompatibleLlmProvider`.
- Convert `LlmRequest.systemPrompt` into a provider `system` message.
- Convert `LlmRequest.messages` into provider `user` and `assistant` messages.
- Pass the `AgentTurnOutput` JSON Schema via structured output.
- Use request-level model and temperature when present; otherwise use provider
  config.
- Capture sanitized diagnostics:
  - provider id;
  - model;
  - base URL host, not full secret-bearing URL if any;
  - latency;
  - token usage;
  - finish reason;
  - repair attempt if present.
- Normalize provider errors into the existing `llm_provider` error category or
  an adapter-local error that the runtime can map.

Likely files:

- `src/llm/openai-compatible-provider.ts`
- `src/llm/client.ts`
- `src/llm/generate-structured-output.ts`
- `src/llm/generate-text.ts`
- `src/llm/index.ts`
- `tests/llm/openai-compatible-provider.test.ts`

Tests and checks:

- Adapter implements `LlmProvider`.
- Adapter calls `/chat/completions` through the existing client layer.
- Adapter sends `response_format.type = "json_schema"`.
- Adapter includes schema name and strict schema.
- Adapter maps provider JSON response to `AgentTurnOutput`.
- Adapter reports provider failures without leaking API keys.

Acceptance:

- The adapter works with mocked fetch.
- No live credentials are needed for automated tests.
- Application code still depends only on `LlmProvider`.

### LLM-04 - Adapter Contract Tests

Goal: prove the provider boundary independently from runtime and TUI.

Tasks:

- Add mocked fetch tests for request body mapping.
- Add mocked fetch tests for response parsing.
- Add mocked fetch tests for retryable and non-retryable provider failures.
- Add tests for malformed JSON, empty choices, missing message content, and
  provider error bodies.
- Add tests that API keys are never included in thrown error messages when the
  request fails.

Likely files:

- `tests/llm/openai-compatible-provider.test.ts`
- `tests/llm/generate-text.test.ts`
- `tests/llm/generate-structured-output.test.ts`
- `tests/llm/retry-policy.test.ts`

Tests and checks:

- `pnpm test tests/llm`
- `pnpm typecheck`

Acceptance:

- Provider behavior is verified without runtime setup.
- Network instability and bad provider responses have deterministic tests.

### LLM-05 - Runtime Provider Selection

Goal: make runtime startup select mock or real providers intentionally.

Tasks:

- Replace the current silent fallback to `MockLlmProvider` when real provider
  config is absent.
- Add runtime options for provider mode and provider config.
- Preserve custom injected `llmProvider` for tests.
- Keep `useMockLlm` as an explicit deterministic path.
- Add a provider-unconfigured runtime state or diagnostic when real AI is
  requested but cannot be constructed.
- Ensure node turns that require an LLM fail recoverably when provider is
  unconfigured.

Likely files:

- `src/application/runtime.ts`
- `src/application/generate-agent-turn.ts`
- `src/diagnostics/error-categories.ts`
- `src/diagnostics/recovery-actions.ts`
- `tests/application/runtime.test.ts`
- `tests/application/submit-user-message.test.ts`

Tests and checks:

- Runtime with `useMockLlm: true` uses `MockLlmProvider`.
- Runtime with injected provider still uses the injected provider.
- Runtime with real provider config uses `OpenAiCompatibleLlmProvider`.
- Runtime with requested real provider but missing token reports
  provider-unconfigured.
- Existing flow tests still use mock provider and pass.

Acceptance:

- No hidden mock fallback when the user expects real AI.
- Existing deterministic harness behavior remains intact.

### LLM-06 - CLI and Environment Wiring

Goal: expose real-provider mode through user-facing startup options.

Tasks:

- Add CLI flags:
  - `--provider <id>`;
  - `--model <model>`;
  - `--base-url <url>`;
  - `--token-env <name>`;
  - `--llm-timeout <ms>` if timeout is supported in the config.
- Preserve `--mock`.
- Map CLI flags to runtime provider options.
- Resolve env vars consistently with `src/llm/config.ts`.
- Update `--help` output and docs.
- Avoid adding commands that mutate provider config until persistence and
  disclosure rules are implemented.

Likely files:

- `src/cli/main.ts`
- `src/application/runtime.ts`
- `tests/cli/main.test.ts`
- `README.md`
- `docs/development.md`
- `docs/walkthrough.md`

Tests and checks:

- CLI parses real provider flags.
- CLI still parses `--mock`.
- CLI flag values override env values where intended.
- `logos --help` documents provider flags.

Acceptance:

- Users can intentionally start LOGOS in mock or real-provider mode.
- Missing credentials are explained, not hidden by mock fallback.

### LLM-07 - Provider Status Surfaces

Goal: make provider mode visible before and during conversations.

Tasks:

- Add provider status to runtime render snapshot if not already sufficient.
- Show provider status in `/status`.
- Show provider status in the TUI header or context rail:
  - provider-disabled;
  - provider-unconfigured;
  - provider-ready;
  - mock-provider.
- Add actionable next steps for unconfigured provider state.
- Ensure deterministic commands such as validation and output browsing remain
  clear that no provider is required.

Likely files:

- `src/application/render-model-builder.ts`
- `src/contracts/render-snapshot.ts`
- `src/tui/app-shell.tsx`
- `src/tui/components/Sidebar.tsx`
- `src/tui/components/MainPanel.tsx`
- `src/tui/components/DiagnosticsPanel.tsx`
- `tests/contracts/render-snapshot.test.ts`
- `tests/tui` or existing TUI snapshot tests

Tests and checks:

- Snapshot includes provider mode/status.
- TUI renders mock status.
- TUI renders real-provider-ready status.
- TUI renders provider-unconfigured status and recovery action.

Acceptance:

- A user can tell whether they are using mock or real AI before submitting
  meaningful content.

### LLM-08 - Disclosure and Token Safety

Goal: prevent accidental remote calls or credential persistence.

Tasks:

- Add a remote-provider disclosure gate before the first real remote call.
- Store only disclosure acceptance state and token env name.
- Never store raw token values in `.logos/`, sessions, snapshots, event logs,
  diagnostics, generated outputs, or backups.
- Ensure displayed config masks token state as present/missing only.
- Decide whether initial disclosure is session-local or workspace-local.
  Prefer workspace-local only if `.logos/config.json` already has a safe
  config pattern.

Likely files:

- `src/llm/config.ts`
- `src/application/runtime.ts`
- `src/persistence/*`
- `src/contracts/runtime-state.ts`
- `src/diagnostics/*`
- `tests/llm/config.test.ts`
- `tests/persistence/*`
- `SECURITY.md`

Tests and checks:

- Raw token value is never serialized.
- Disclosure not accepted blocks real remote calls.
- Disclosure accepted allows real adapter construction when other config is
  valid.
- Diagnostics never include token values.

Acceptance:

- Remote AI is opt-in at both configuration and disclosure boundaries.
- Secrets remain outside project files.

### LLM-09 - Prompt Context Redaction

Goal: sanitize prompt context before it leaves the machine.

Tasks:

- Add a redaction pass between prompt assembly and real provider calls.
- Redact likely secrets:
  - API keys;
  - bearer tokens;
  - `.env` assignments;
  - private keys;
  - password-like values;
  - common cloud credential patterns.
- Keep redaction deterministic and testable.
- Track redaction counts in diagnostics without storing raw matches.
- Do not run broad repository scans as part of a normal node turn.
- Preserve node-scoped prompt context rules from prompt orchestration docs.

Likely files:

- `src/llm/redaction.ts`
- `src/llm/openai-compatible-provider.ts`
- `src/prompt-orchestration/prompt-assembler.ts`
- `tests/llm/redaction.test.ts`
- `tests/prompt-orchestration/prompt-assembler.test.ts`

Tests and checks:

- Common secret patterns are redacted.
- Non-secret user content is preserved.
- Redaction applies to system prompt and messages.
- Diagnostics show counts/categories only.

Acceptance:

- Real provider calls use sanitized prompt payloads.
- Debug output cannot reveal raw secrets by default.

### LLM-10 - Real-Output Repair Loop

Goal: recover from invalid real provider output without corrupting state.

Tasks:

- Integrate `buildNextRepairAttempt` into `generateAgentTurn`.
- Run `validateAgentTurnOutput` after every provider response.
- If validation fails, build a repair request and call the same provider again.
- Limit attempts using the existing repair attempt limit or provider config.
- Do not append invalid assistant messages.
- Do not mutate lifecycle, canonical answer, completeness, document readiness,
  or persistence until a valid output is available.
- Return recoverable diagnostics when repair fails.

Likely files:

- `src/application/generate-agent-turn.ts`
- `src/validation/repair-prompt.ts`
- `src/diagnostics/*`
- `tests/application/generate-agent-turn.test.ts`
- `tests/validation/repair-prompt.test.ts`

Tests and checks:

- Invalid first response plus valid repair response succeeds.
- Invalid response through all repair attempts returns recoverable error.
- Failed repair leaves state unchanged except for safe diagnostics.
- Repair prompt includes validation errors and preserves original context.

Acceptance:

- Real-model mistakes are contained by validation and repair.
- Invalid output cannot enter node conversation as an assistant message.

### LLM-11 - Manual Live Smoke Test

Goal: provide a credential-gated proof that real provider integration works.

Tasks:

- Add `pnpm smoke:llm`.
- Skip with a clear message when required env vars are absent.
- Use a minimal request that exercises structured `AgentTurnOutput`.
- Validate the response with `validateAgentTurnOutput`.
- Print sanitized output:
  - provider;
  - model;
  - latency;
  - token usage if available;
  - validation status;
  - repair attempts.
- Do not print API keys, raw provider payloads, or full prompt content.

Likely files:

- `scripts/smoke-llm.js` or `scripts/smoke-llm.ts`
- `package.json`
- `docs/development.md`
- `README.md`

Tests and checks:

- Script exits successfully with skip status when credentials are absent, if
  that is the repo convention.
- Script validates real output when credentials are present.
- `pnpm check` does not require this smoke.

Acceptance:

- Maintainers can manually verify a live provider without changing CI.

### LLM-12 - Dogfood and Limitation Closeout

Goal: prove the real provider path is useful in the actual LOGOS workflow.

Tasks:

- Run the startup profile with a real provider against a small project.
- Validate these flows manually:
  - initial question;
  - follow-up;
  - clarification;
  - refinement;
  - synthesis;
  - user accept;
  - user edit or regenerate;
  - document preview;
  - export.
- Capture issues by category:
  - provider adapter;
  - schema;
  - prompt quality;
  - runtime validation;
  - TUI/UX;
  - privacy/diagnostics.
- Update `LIMITATIONS.md` only after a real node reaches synthesized state and
  a user explicitly accepts a canonical answer.
- Replace the mock-only limitation with the remaining real-provider risks.

Likely files:

- `LIMITATIONS.md`
- `README.md`
- `docs/walkthrough.md`
- `docs/development.md`
- `CHANGELOG.md`

Tests and checks:

- `pnpm check`
- `pnpm smoke:llm` with credentials
- Manual TUI dogfood notes

Acceptance:

- LOGOS can produce at least one reviewable canonical answer from a real model.
- Generated Markdown still uses accepted canonical answers, not raw chat.
- The repository no longer claims real LLM integration is absent.

## 6. Dependency Order

Implement in this order:

1. LLM-00
2. LLM-01
3. LLM-02
4. LLM-03
5. LLM-04
6. LLM-05
7. LLM-06
8. LLM-07
9. LLM-08
10. LLM-09
11. LLM-10
12. LLM-11
13. LLM-12

LLM-08 and LLM-09 may be developed in parallel after LLM-05, but both must be
complete before broad live dogfooding.

LLM-10 can start after LLM-03, but it should not be considered done until the
runtime wiring in LLM-05 is complete.

## 7. Recommended PR Slices

### PR 1 - Config and Schema Foundation

Includes:

- LLM-00
- LLM-01
- LLM-02

Validation:

- `pnpm typecheck`
- `pnpm test tests/llm tests/contracts`
- `pnpm lint:md`

### PR 2 - OpenAI-Compatible Adapter

Includes:

- LLM-03
- LLM-04

Validation:

- `pnpm test tests/llm`
- `pnpm typecheck`
- `pnpm lint:biome`

### PR 3 - Runtime and CLI Wiring

Includes:

- LLM-05
- LLM-06
- LLM-07

Validation:

- `pnpm test tests/application tests/cli`
- relevant TUI/render snapshot tests
- `pnpm check`

### PR 4 - Safety and Repair

Includes:

- LLM-08
- LLM-09
- LLM-10

Validation:

- `pnpm test tests/llm tests/application tests/validation tests/persistence`
- `pnpm security:check`
- `pnpm check`

### PR 5 - Live Smoke and Closeout

Includes:

- LLM-11
- LLM-12

Validation:

- `pnpm check`
- `pnpm smoke:llm` with credentials
- manual TUI dogfood

## 8. Global Acceptance Criteria

The roadmap is complete only when:

- `MockLlmProvider` remains the deterministic test provider.
- Real provider mode is explicit and visible.
- No normal CI command requires credentials or network.
- Provider credentials are never persisted or logged.
- Remote calls require disclosure acceptance.
- Prompt context is node-scoped and redacted.
- Real provider output is constrained by JSON Schema.
- Real provider output is semantically validated.
- Invalid output enters repair before recoverable failure.
- Failed provider calls do not append assistant messages.
- The LLM never accepts nodes or exports documents.
- At least one dogfooded real conversation reaches a user-accepted canonical
  answer.

## 9. Stop Conditions

Pause implementation and revisit the plan if any of these occur:

- The chosen provider cannot reliably support structured JSON Schema output.
- The `AgentTurnOutput` schema cannot be made compatible with provider strict
  schema requirements without weakening validation semantics.
- Real provider wiring would require TUI modules to import provider adapters.
- Any proposed implementation stores raw tokens in project files.
- Repair behavior would mutate state before validation succeeds.
- Prompt context needs broad repository dumps to work acceptably.

## 10. First Step Prompt

Use this as the first implementation request:

```txt
Implement LLM-01 from docs/15-real-llm-implementation-roadmap.md.

Scope:
- Provider configuration model only.
- No real provider adapter yet.
- No CLI flag changes yet unless required for tests.
- Preserve MockLlmProvider and provider-free CI.

Required reading:
- LIMITATIONS.md
- docs/14-real-llm-integration-plan.md
- docs/15-real-llm-implementation-roadmap.md
- docs/architecture/05-llm-integration-architecture.md
- docs/06-agent-turn-contract.md
- src/llm/config.ts
- src/application/runtime.ts

Validation:
- targeted config tests
- pnpm typecheck
```
