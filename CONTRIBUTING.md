# Contributing to LOGOS Engine

LOGOS Engine is a local-first, open-source TUI for structured intent clarification
and documentation. Contributions that improve clarity, reasoning quality, profile
breadth, and developer experience are welcome.

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). Participation means
adhering to it.

## Prerequisites

- Node.js 22 or newer
- pnpm `10.33.2` (as declared in `package.json`)

## Development Setup

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Quality Gates

Run these before opening a PR:

```bash
pnpm check              # Full non-mutating quality gate
```

`pnpm check` runs (in order): `pnpm lint` → `pnpm typecheck` → `pnpm test` →
`pnpm check:validation` → `pnpm build` → `pnpm smoke:cli`. It must not mutate
files, require provider credentials, require network access, or depend on user
workspace state.

### Individual Quality Commands

| Command | Purpose | Mutating |
|---|---|---|
| `pnpm lint` | Non-mutating lint (Biome + markdownlint) | No |
| `pnpm lint:biome` | Code/style lint only | No |
| `pnpm lint:md` | Markdown lint only | No |
| `pnpm typecheck` | Type-check `src/` without emit | No |
| `pnpm test` | Run Vitest baseline | No |
| `pnpm check:validation` | Validate bundled Standard profile contracts | No |
| `pnpm build` | Build `src/` to `dist/` | No (generates build output) |
| `pnpm smoke:cli` | Verify built CLI starts | No |
| `pnpm format` | Mutating format with Biome | Yes |

### Release Candidate Quality Commands

| Command | Purpose | Mutating |
|---|---|---|
| `pnpm security:check` | Deterministic security/privacy release check | No |
| `pnpm smoke:package` | Release candidate package smoke | No |
| `pnpm test:coverage` | Test coverage report | No |
| `pnpm test:watch` | Watch mode for development | No |

Pre-existing documentation in `docs/02-validation/`, `docs/06-operations/`, and
select profile templates are excluded from markdownlint via `.markdownlintignore`
until a documentation-hardening pass cleans them up.

## Contribution Areas

LOGOS Engine accepts contributions in several layers:

### Core Engine

- TUI improvements (including keyboard confirmation components — use `ink-testing-library` for component tests)
- Renderer improvements
- Validation engine
- Profile loader
- State management
- Diagnostics
- Tests

### Profiles

Creating or improving outcome profiles (e.g., `standard`, SaaS, course, ecommerce,
agency, research).

### Document Templates

Better PRD templates, architecture documents, market analysis, launch plans, risk
registers.

### Question Packs

Better intake questions for founders — pricing, UX, architecture, marketing, etc.

### Validation Rules

Deterministic checks such as:

- If pricing is undefined, economics are incomplete.
- If offline-first is selected, sync strategy is required.
- If B2C paid acquisition is selected, a CAC model is required.

### Examples

Anonymized sample workspaces demonstrating real use are especially valuable.

## Development Boundaries

- **Local-first**: Default tests must not require network access, AI credentials,
  or external services.
- **TUI-first product model**: The primary user experience is the TUI shell.
  External CLI commands are intentionally minimal.
- **No generated user workspace dependency in `pnpm check`**: All quality gates
  must pass without an initialized `.logos/` workspace.
- **No external APIs in default tests**: All default tests use fakes, fixtures,
  and temp directories. Provider config tests use `createDefaultWorkspaceState` in
  temp dirs — no real `.logos`, no `.env`, no network.

## Test Strategy

- **Unit tests**: Pure functions, schema validation, state transitions, provider
  normalization, renderer helpers.
- **Integration tests**: Meaningful boundaries — workspace/filesystem, profile
  loading, command routing, generation with temp directories.
- **Snapshot tests**: Stable renderer output expectations. Update only with
  intentional output changes.
- **TUI workbench tests**: View model, focus, state labels, and report
  rendering tests are pure deterministic tests. The Ink component tests
  (`tests/tui-shell.test.tsx`) verify the shell integrates workbench rendering.
  Snapshot tests should verify text-visible labels, focus indicators, and
  layout regions.
- **No network/provider credentials** in default tests. Tests use fake providers,
  temp directories, and synthetic fixtures.

## Fixture Policy

- No real secrets, tokens, or credentials in any fixture.
- Fake secrets only for redaction tests (e.g., `sk-fake-test-key-12345`).
- No real `.logos/` mutation — use temp directories only.
- No real provider payloads — use synthetic provider output fixtures.
- No real user data — all fixture data is synthetic.
- Documentation root test fixtures use temp directories only; never mutate real project paths.

## Pull Request Checklist

Before submitting a PR:

- [ ] `pnpm check` passes (non-mutating).
- [ ] `pnpm typecheck` passes.
- [ ] New behavior has tests at the appropriate layer (unit, integration, snapshot).
- [ ] No generated artifacts unintentionally committed.
- [ ] No secrets, tokens, or credentials in source, fixtures, or snapshots.
- [ ] Documentation updated if behavior or contracts changed.
- [ ] Package contents remain safe (`pnpm smoke:package` passes).
- [ ] Security/privacy checks pass (`pnpm security:check` passes).

## Release Candidate Checklist

Before declaring a release candidate:

- [ ] `pnpm check`, `pnpm typecheck`, and `pnpm smoke:cli` pass.
- [ ] `pnpm security:check` passes with no errors or fatal findings.
- [ ] `pnpm smoke:package` passes (non-mutating, no network, no credentials).
- [ ] Bundled Standard profile is valid and loadable.
- [ ] Migration and backup tests pass.
- [ ] Package contents exclude `.env`, `.logos`, backups, coverage, `node_modules`,
  and private artifacts.
- [ ] No raw tokens, secrets, or credentials in package files.
- [ ] No telemetry, analytics, remote logging, or crash reporting code paths.
- [ ] README, CONTRIBUTING, and SECURITY docs are accurate.

## AI Safety Rules for Contributors

- Default tests must not call live models.
- Default tests must not require network access or AI credentials.
- Raw LLM tokens must not be stored in project files.
- AI output must remain `draft`, `proposed`, `needs_review`, `rejected`, or
  explicitly `confirmed`.
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

The project is maintainer-led. Proposals are issue-based. RFCs are used for major
changes.

## License

Code contributions are under MIT. Documentation template contributions are under
Creative Commons Attribution 4.0.
