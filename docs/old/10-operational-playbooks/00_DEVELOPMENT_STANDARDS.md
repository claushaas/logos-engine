# Development Standards

## Language

Use TypeScript.

## Runtime

Use Node.js.

## Code Style

Prioritize:

- simple modules;
- explicit schemas;
- pure functions where possible;
- small files;
- testable logic;
- no premature abstractions.

## Suggested Libraries

- Ink for TUI;
- Zod for schema validation;
- Commander or similar for CLI parsing;
- Vitest for tests;
- Prettier/Biome for formatting;
- Markdown renderer/template library as needed;
- provider-agnostic LLM client abstraction;
- structured output parser for AI responses;
- token counting and context budgeting utilities where needed.

## AI-First Architecture Standards

LOGOS Engine uses AI as a core reasoning, interrogation, synthesis, and drafting layer.

The codebase must therefore treat AI behavior as a first-class engineering concern, not as an optional integration.

AI-related implementation must follow these rules:

- never couple core logic directly to a single LLM provider;
- route all model calls through a provider abstraction;
- define explicit request and response schemas for every AI operation;
- validate AI responses before using them;
- classify AI output as draft, proposed, confirmed, rejected, or needs_review;
- never persist AI-generated decisions as confirmed without user confirmation;
- preserve source answers and prompt context for traceability where practical;
- keep deterministic validation rules separate from AI judgment;
- make external provider usage explicit to the user;
- avoid sending unnecessary project context to remote providers.

## Module Boundaries

The TUI should not directly mutate files.

Recommended flow:

```text
TUI
→ application service
→ domain logic
→ storage adapter
```

## AI Module Boundaries

AI modules should not directly mutate project state or generated documents.

Recommended flow:

```text
TUI
→ application service
→ AI orchestration service
→ LLM provider adapter
→ structured response validator
→ decision proposal service
→ user confirmation
→ state update
→ document renderer
```

AI output should enter the system as a proposal, draft, critique, or diagnostic note.

Confirmed project state should only change through explicit application services.

## Testing

Test:

- profile loading;
- schema validation;
- decision updates;
- document rendering;
- validation rules;
- diagnostics output;
- prompt contract generation;
- AI response parsing;
- malformed AI response handling;
- provider adapter behavior;
- user confirmation flows for AI-proposed decisions;
- regression tests for canonical document generation.

## Repository Scripts

The repository foundation should expose reproducible commands through `package.json`:

- `pnpm test` runs the default deterministic test suite;
- `pnpm test:coverage` runs coverage reporting where practical;
- `pnpm build` compiles TypeScript;
- `pnpm typecheck` checks TypeScript without emitting files;
- `pnpm lint:biome` checks TypeScript, JavaScript, JSON, and supported source files with Biome;
- `pnpm lint:md` checks Markdown with markdownlint;
- `pnpm smoke:cli` runs the Phase 0 CLI preflight until the executable `logos` TUI is implemented in Phase 1.

## AI Testing Standards

AI behavior must be tested through deterministic boundaries wherever possible.

Tests should not depend on live model calls by default.

Use fixtures and mocked provider responses to validate:

- prompt construction;
- context selection;
- schema compliance;
- response parsing;
- refusal or malformed response handling;
- decision proposal extraction;
- assumption classification;
- gap analysis output;
- document draft generation;
- confirmation-gated state changes.

Live model tests may exist as optional integration tests, but they should not be required for the default test suite.

The default test policy is:

- no network access required;
- no live AI provider credentials required;
- no remote model calls required;
- no raw API tokens in fixtures, project files, or generated state.

## Error Handling

Errors should be:

- clear;
- actionable;
- non-destructive.

## AI Error Handling

AI-related failures must be handled as expected product states.

The system should provide clear behavior for:

- provider unavailable;
- authentication failure;
- rate limits;
- timeout;
- context length exceeded;
- invalid structured output;
- unsafe or unsupported model response;
- user declines AI-generated proposal.

AI failures should not corrupt project state.

When an AI operation fails, the system should preserve the current workspace and explain what can be retried or completed manually.

## File Safety

The system should not overwrite user content without explicit behavior.

Default to safe writes.

## Prompt and Context Safety

Prompt construction is part of the product surface.

Prompts must be treated as versioned implementation artifacts.

Prompt-related code should:

- keep prompts close to the profile or AI operation they support;
- avoid hidden global instructions that alter behavior unpredictably;
- include only the context required for the operation;
- clearly separate user-provided facts from system-generated assumptions;
- include output schema requirements;
- include refusal or uncertainty handling instructions;
- be covered by tests or snapshots where practical.

Context sent to an LLM should be intentional, minimal, and explainable.
