# Contributing to LOGOS Engine

LOGOS Engine is a local-first, open-source TUI for structured intent clarification and documentation. Contributions that improve clarity, reasoning quality, profile breadth, and developer experience are welcome.

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). Participation means adhering to it.

## Contribution Areas

LOGOS Engine accepts contributions in several layers:

### Core Engine

- TUI improvements
- Renderer improvements
- Validation engine
- Configuration loader
- Storage system
- Diagnostics
- Tests

### Profiles

Creating or improving outcome profiles (e.g. `standard`, SaaS, course, ecommerce, agency, research).

### Document Templates

Better PRD templates, architecture documents, market analysis, launch plans, risk registers.

### Question Packs

Better intake questions for founders — pricing, UX, architecture, marketing, etc.

### Validation Rules

Deterministic checks such as:

- If pricing is undefined, economics are incomplete.
- If offline-first is selected, sync strategy is required.
- If B2C paid acquisition is selected, a CAC model is required.

### Examples

Anonymized sample workspaces demonstrating real use are especially valuable.

## Prerequisites

- Node.js 22 or newer
- pnpm (version declared in `package.json`)

## Development Setup

```bash
pnpm install
```

## Quality Gate

Run these before opening a PR:

```bash
pnpm check              # Full non-mutating quality gate (lint + typecheck + test + validation + build + smoke)
```

Individual quality commands:

```bash
pnpm lint              # Non-mutating lint (Biome + markdownlint)
pnpm lint:biome        # Code/style lint — non-mutating
pnpm lint:md           # Markdown lint — non-mutating
pnpm typecheck         # Type-check src/ tree without emit
pnpm test              # Run Vitest baseline
pnpm check:validation  # Validate bundled Standard profile contracts and generated-output fixtures
pnpm build             # Build src/ to dist/
pnpm smoke:cli         # Verify built CLI starts
pnpm format            # Mutating format with Biome — fixes auto-fixable issues
```

`pnpm check` is the strict CI/release gate and must not mutate files. `pnpm format` is the local write command.

`pnpm check:validation` runs deterministic validation of the bundled Standard profile contracts using the Step 6.1 validation service and Step 6.2 semantic lint rules. It validates profile registry shape, phase and document descriptors, output declarations, dependency references, and generated-output fixtures. It does not require AI credentials, an initialized `.logos/` workspace, or network access.

Pre-existing documentation in `docs/02-validation/`, `docs/06-operations/`, and select profile templates are excluded from markdownlint via `.markdownlintignore` until a documentation-hardening pass cleans them up.

## Contribution Requirements

Each contribution should include:

1. **Purpose** — what problem does it solve?
2. **Affected module / profile** — which part of the system changes?
3. **Tests** — where relevant.
4. **Documentation update** — if the change affects user-visible behavior or contracts.
5. **Migration note** — if a schema, file layout, or API changes.

## AI Safety Rules for Contributors

- Default tests must not call live models.
- Default tests must not require network access or AI credentials.
- Raw LLM tokens must not be stored in project files.
- AI output must remain `draft`, `proposed`, `needs_review`, `rejected`, or explicitly `confirmed`.
- `DecisionStatus` and `AiOutputStatus` must remain separate concepts.
- Deterministic validation must remain separate from AI judgment.

## Review Principles

Reviews prioritize:

- Clarity
- Maintainability
- User value
- Schema stability
- Avoiding unnecessary abstraction

## How to Propose a Major Change

Open an issue first. Describe:

- The problem.
- The proposed approach.
- Why it fits within the project scope.
- What would break or change.

For large features, an RFC-style issue is preferred.

## How to Propose a New Profile

See [profiles/standard/README.md](./profiles/standard/README.md).

## Governance

The project is maintainer-led. Proposals are issue-based. RFCs are used for major changes.

## License

Code contributions are under MIT. Documentation template contributions are under Creative Commons Attribution 4.0.
