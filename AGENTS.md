# AGENTS.md

## Purpose

This file defines working rules for AI agents contributing to LOGOS Engine.

LOGOS Engine is a local-first, TUI-first, AI-structured documentation and intent clarification system. It turns unclear intent into structured decisions and complete generated documentation.

Agents must preserve that product shape while implementing the roadmap.

## Mandatory Documentation Rule

Before implementing any roadmap phase, always consult the documentation for that phase.

At minimum, read:

- `docs/09-implementation-roadmap/00_IMPLEMENTATION_ROADMAP.md`;
- `docs/09-implementation-roadmap/01_PHASED_TASKS.md`;
- `docs/09-implementation-roadmap/02_TECHNICAL_MILESTONES.md`;
- every related document listed in the roadmap phase being implemented.

Do not implement a phase from memory or assumptions.

If a requested change conflicts with the documentation, update the documentation first or explicitly explain the conflict before changing code.

## Core Product Rules

- The default command is `logos`, which opens the TUI.
- The primary in-app command surface is slash commands such as `/init`, `/continue`, `/status`, `/validate`, `/diagnose`, `/generate`, and `/config ai`.
- The TUI must not directly mutate files.
- Route mutations through command handlers, application services, domain logic, and storage adapters.
- Structured project state is the source of truth.
- Markdown is a rendered projection.
- Generated documents must be broad, useful, auditable, and explicit about assumptions, gaps, risks, dependencies, and next actions.

## Profile Rules

- Profiles are structured YAML contracts, not Markdown documents.
- Runtime profile contracts live under `profiles/<profile-id>/`.
- For V1, the App Business runtime profile contract lives in:
  - `profiles/app-business/profile.yml`;
  - `profiles/app-business/documents.yml`;
  - `profiles/app-business/questions.yml`;
  - `profiles/app-business/validations.yml`.
- The documentation mirror for the App Business profile lives in:
  - `docs/05-profiles/app-business/profile.yml`;
  - `docs/05-profiles/app-business/documents.yml`;
  - `docs/05-profiles/app-business/questions.yml`;
  - `docs/05-profiles/app-business/validations.yml`.
- Keep the runtime profile and documentation mirror aligned.
- Parse YAML with a real YAML parser.
- Validate profile files with explicit schemas.
- Reject duplicate ids, invalid references, missing required fields, and unresolved template paths when templates exist.
- Keep the engine generic. Specialize behavior through profiles.

## AI Rules

- Treat AI as a first-class workflow layer, not an optional afterthought.
- Never couple core logic directly to one LLM provider.
- Route model calls through provider abstractions.
- Users provide their own LLM endpoint and credential source.
- Do not store raw API tokens in project files by default.
- Make remote provider usage explicit and configurable.
- Show what project context may be sent to remote providers.
- Validate all AI responses before use.
- Keep deterministic validation separate from AI judgment.
- AI output must enter as `draft`, `proposed`, `needs_review`, or `rejected`.
- AI-generated decisions may become `confirmed` only after explicit user confirmation.
- Default tests must not require live model calls.

## State and Status Rules

Keep these concepts separate:

- `DecisionStatus`: `unknown`, `assumed`, `proposed`, `confirmed`, `deprecated`;
- `AiOutputStatus`: `draft`, `proposed`, `needs_review`, `rejected`, `confirmed`;
- `ValidationSeverity`: `info`, `warning`, `error`, `critical`;
- `RenderMode`: `safe`, `refresh`, `force`.

Do not conflate AI proposal state with confirmed decision state.

## Implementation Style

- Use TypeScript and Node.js.
- Prefer simple modules, explicit schemas, pure functions where practical, and small files.
- Avoid premature abstractions.
- Use Ink for TUI work when implementation begins.
- Use Zod or equivalent schema validation for runtime contracts.
- Use Vitest or the project test runner for tests.
- Use Biome for formatting and linting according to repo scripts.

## File Safety

- Default to safe writes.
- Do not overwrite user-authored content without explicit confirmation behavior.
- Preserve manual sections when rendering generated documents.
- Use atomic writes for JSON/YAML state where practical.
- Keep generated state text-based and Git-friendly.

## Testing Rules

Test behavior at deterministic boundaries:

- profile loading;
- YAML schema validation;
- cross-file profile reference validation;
- question selection;
- decision updates and status transitions;
- AI response parsing with mocked providers;
- confirmation-gated AI proposals;
- document rendering;
- manual section preservation;
- validation rules;
- diagnostics output;
- provider configuration without raw token persistence.

Live provider tests may exist only as optional integration tests.

## Useful Commands

Run these before considering work complete:

```bash
pnpm lint:md
pnpm lint:biome
```

Add or run tests once the codebase has a real test runner beyond the placeholder script.

## Roadmap Discipline

Work phase by phase.

For each phase:

1. Read the phase in `00_IMPLEMENTATION_ROADMAP.md`.
2. Read the checklist in `01_PHASED_TASKS.md`.
3. Read the matching milestone in `02_TECHNICAL_MILESTONES.md`.
4. Read every related document named by that phase.
5. Implement only the scope of the phase unless the documentation requires a prerequisite change.
6. Update documentation when implementation decisions refine the contract.
7. Run the relevant validations and linters.

The documentation is part of the product. Keep it aligned with the implementation.
