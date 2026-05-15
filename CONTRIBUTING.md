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
pnpm lint:biome    # passes cleanly
pnpm lint:md       # currently has pre-existing failures in docs/ and profile templates
```

The following commands are now part of the quality gate:

```bash
pnpm typecheck   # requires src/ (Step 0.2)
pnpm test        # requires tests/ (Step 0.3)
pnpm build       # requires src/ (Step 0.2)
pnpm smoke:cli   # requires scripts/smoke-cli.js (Step 0.3)
```

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
