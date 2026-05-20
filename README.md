# LOGOS Engine

LOGOS Engine is a local-first CLI/TUI engine for structured externalization of intent
and deterministic documentation generation. It runs inside a user's target repository
and keeps the user's repository as the working boundary.

LOGOS is not a document generator. It is a decision clarification engine that helps
users transform ambiguous project ideas into structured decisions, canonical
documentation, and derived execution artifacts.

## Current Status

Release candidate — local package baseline (`v0.1.0`). The package is not yet
published to a public registry. All quality gates, security checks, smoke tests,
and package validation pass deterministically without AI credentials or network
access.

## Requirements

- Node.js `>=22`
- pnpm `10.33.2` (as declared in `package.json`)
- No provider credentials required for deterministic local commands
- No network access required for default tests, builds, or quality gates

## Installation

Local development install:

```bash
git clone <repository-url>
cd logos-engine
pnpm install --frozen-lockfile
pnpm build
```

Package usage (if built as a local package):

```bash
pnpm pack          # Produce a tarball for local inspection (does not publish)
pnpm smoke:package # Verify release candidate package integrity
```

No npm registry publication has occurred yet.

## Basic Commands

| Command | Purpose | Mutating | Notes |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | Install dependencies from lockfile | No (state) | |
| `pnpm build` | Compile TypeScript to `dist/` | No (generates build output) | Required before CLI commands |
| `pnpm test` | Run Vitest suite | No | 120+ test files, ~3270 tests |
| `pnpm typecheck` | Type-check without emit | No | |
| `pnpm lint` | Non-mutating lint (Biome + markdownlint) | No | |
| `pnpm lint:biome` | Code/style lint only | No | |
| `pnpm lint:md` | Markdown lint only | No | |
| `pnpm check:validation` | Validate bundled Standard profile contracts | No | No workspace required |
| `pnpm smoke:cli` | Verify built CLI starts and basic commands work | No | |
| `pnpm security:check` | Run deterministic security/privacy release checker | No | Requires build |
| `pnpm smoke:package` | Run release candidate package smoke | No | Requires build |
| `pnpm check` | Full quality gate (lint + typecheck + test + validation + build + smoke) | No | Non-mutating CI/release gate |
| `pnpm format` | Mutating format with Biome | Yes (formatting) | Fixes auto-fixable issues |

## CLI Usage

LOGOS Engine exposes a minimal external CLI; the primary workflow is through the TUI.

```bash
logos                 # Open the interactive TUI shell
logos --help          # Show CLI help
logos --version       # Show package version
logos doctor          # Run non-mutating local diagnostics
logos doctor --json   # Structured JSON diagnostics
logos doctor --dry-run # Dry-run diagnostics
logos doctor --json --dry-run # Combined JSON + dry-run
```

## TUI Slash Commands

Inside the TUI, slash commands drive system operations:

| Command | Purpose | Mutating | Requires Workspace |
|---|---|---|---|
| `/help` | Show available slash commands | No | No |
| `/status` | Show runtime status (project root, doc root, profile, provider, workspace, registers, staleness, graph, executive readiness) | No | Works when present |
| `/exit` | Exit the shell | No | No |
| `/init` | Preview workspace creation paths | No | No |
| `/init --confirm` | Create `.logos/workspace.json` | Yes | No |
| `/init --dry-run` | Dry-run workspace initialization plan | No | No |
| `/init --root <path>` | Set custom documentation root | Depends on mode | No |
| `/init --profile <id>` | Select profile (default: `standard`) | Depends on mode | No |
| `/continue` | Show the next intake question cluster (read-only, deterministic) | No | Yes |
| `/generate` | Preflight canonical Markdown generation | No | Yes |
| `/generate --confirm` | Execute canonical Markdown generation | Yes | Yes |
| `/generate --dry-run` | Dry-run generation report | No | Yes |
| `/generate --policy <name> --confirm` | Use specific write policy (skip, fail, backup_and_write, overwrite) | Yes | Yes |
| `/validate` | Run deterministic validation and write a local report | Yes (report) | Yes |
| `/validate --dry-run` | Run validation without writes | No | Yes |
| `/validate --scope <scope>` | Scope validation (contracts, state, artifacts, outputs, all) | Depends | Depends |
| `/diagnose` | Run diagnostic analysis | Yes (report) | Yes |
| `/diagnose --dry-run` | Run diagnosis without writes | No | Yes |
| `/graph` | Show dependency graph output (summary mode) | No | No (profile contract) |
| `/graph --json` | Graph output as JSON | No | No |
| `/graph --phase <id>` | Filter graph by phase | No | No |
| `/graph --doc <id>` | Filter graph by document | No | No |
| `/graph --mode full` | Full graph output | No | No |
| `/config ai` | Configure AI provider (recognized stub, not yet implemented) | No | No |
| `/executive compile` | Preflight Executive Axis compilation | No | Yes |
| `/executive compile --confirm` | Execute Executive compilation (JSON + exports) | Yes | Yes |
| `/executive compile --dry-run` | Dry-run executive compilation | No | Yes |
| `/executive compile --mode strict` | Strict mode (block on readiness issues) | Depends | Yes |
| `/executive compile --target <target>` | Specific export target (json, markdown, html, github-issues, agent-pack) | Depends | Yes |
| `/executive compile --all-file-exports` | All supported file exports | Yes | Yes |

Free-form text input is recognized but not yet implemented for intake routing.

## Workspace Model

- `.logos/` stores local structured state (workspace.json, config, session data).
- Generated canonical documentation defaults to `logos/` (configurable at init).
- The bundled profile is `standard` under `profiles/standard/`.
- `.logos/workspace.json` and canonical Markdown are the authoritative sources of truth.
- Provider credentials are referenced by environment variable name, never stored as raw values.

## Generation Model

- **Canonical Markdown** is generated from profile contracts and workspace state
  under the configured documentation root (default `logos/`).
- **Derived HTML artifacts** are static, escaped, local-safe review views.
- **Derived Agent Packs** are labeled as non-canonical, regenerable execution aids.
- **Executive Axis outputs** are derived snapshots from the normative documentation
  baseline.

All generated artifacts include source metadata, timestamps, and derived/non-canonical
classification where applicable. Manual edits to generated files are detected and
protected from silent overwrite.

## Validation and Diagnostics

- `/validate` runs deterministic, provider-free validation against profile contracts,
  workspace state, artifacts, and generated outputs. Produces a local review report.
- `/diagnose` runs deterministic diagnosis with optional guarded AI interpretation
  (falls back to deterministic when AI is unavailable).
- `logos doctor` runs non-mutating local diagnostics without requiring an initialized
  workspace.
- Deterministic checks never require AI credentials or network access.

## Executive Axis

- `/executive compile` runs a readiness gate before compiling.
- Produces an **Executive Plan JSON** validated against the executive schema.
- Supported local file exports: Markdown, HTML, GitHub Issue-compatible files,
  Agent Pack files.
- All exports are derived, non-canonical snapshots with source traceability.
- Linear and Notion mappings are planned adapter contracts and are not yet implemented
  as live integrations.

## Import and Scanner

- The import planner is read-only and bounded.
- The repository scanner is read-only and bounded.
- The docs-vs-code checker is read-only and bounded.
- Candidate extraction produces reviewable candidates only; no imports are applied
  automatically.
- Transcript semantic import is deferred and not yet implemented.

## Migrations and Backups

- Local state schema versioning is supported.
- `/init` and generation commands support dry-run planning before mutation.
- Backups are created before mutating migrations (local only).
- Backups exclude `.env`, provider tokens, and secret-like files.
- Restore is user-managed via filesystem or Git; pre-restore backup creation is
  recommended.
- Partial failure reports include changed paths and recovery hints.
- No cloud backup, remote migration, or managed restore is available in MVP.

## Security and Privacy

LOGOS Engine is local-first by default:

- **No telemetry, remote logging, crash reporting, or analytics.**
- **No external sync** by default — user repository stays local.
- **Provider credentials** are opt-in, referenced by environment variable name only.
  Raw tokens are never stored in `.logos/`, generated docs, artifacts, reports,
  logs, backups, fixtures, or snapshots.
- **Deterministic commands** (doctor, validate, diagnose, test, build, lint, check)
  require no network access and no provider credentials.
- **Provider calls** only occur when explicitly configured and disclosed to the user.
- **Security/privacy release checks** are available via `pnpm security:check`.
- **Package safety** excludes `.env`, `.logos`, backups, coverage, `node_modules`,
  and private artifacts.

See [SECURITY.md](./SECURITY.md) for the full security policy.

## Limitations and Non-Goals

- **No hosted SaaS** — LOGOS Engine runs locally only.
- **No live external task sync** — GitHub/Linear/Notion exports are local file
  snapshots, not bidirectional integrations.
- **No automatic external research** — no web scraping, market data lookup, or
  competitive analysis.
- **No package publication** — the package is not yet published to npm.
- **No formal security audit** — security checks are deterministic and local, not
  a penetration test or CVE audit.
- **No cloud backup** — backups and restore are user-managed.
- **No provider credentials required** for deterministic operations.
- **No profile marketplace** — only the bundled `standard` profile is supported.
- **No multi-user collaboration** — single-user, local repository only.

## Troubleshooting

| Symptom | Likely Cause | Command | Recovery |
|---|---|---|---|
| `logos` command not found | Build missing | `pnpm build` | Verify `dist/cli.js` exists |
| `logos` won't start | Non-TTY or missing Node | `node --version` | Use interactive terminal with Node >=22 |
| `doctor` reports missing workspace | Not initialized | `/init` | Run `/init` to create workspace |
| `/init` collision | `.logos/` already exists | `/init --dry-run` | Use `--confirm` if safe, or backup first |
| Validation blockers | Incomplete state or contract issues | `/validate`, `/diagnose` | Review findings and resolve blocked inputs |
| Stale generated docs | State changed since last generation | `/status`, `/generate --dry-run` | Run `/generate --confirm` |
| Manual edit collision | User edited generated output | `/generate --dry-run` | Use write policy or review conflicts |
| Generation/export partial failure | Missing inputs or blocked documents | `/status`, `/diagnose` | Resolve blocking inputs, retry generation |
| Executive readiness blocked | Blocking open questions or stale outputs | `/status` | Resolve open questions, regenerate canonical docs |
| Migration required | Schema version mismatch after update | `/status` | Follow migration guidance in output |
| Migration partially failed | Interrupted migration or invalid state | `/diagnose` | Restore from backup, retry |
| Restore from backup | Corrupt or unwanted state change | Manual | Copy backup over `.logos/`, verify with `/status` |
| Package smoke missing profile | Build incomplete or profile missing | `pnpm build` | Verify `profiles/standard/` exists |
| Security check found secret | Token or credential in source/fixtures | `pnpm security:check` | Remove secret, add regression test |
| Provider unavailable | Credential or network issue | `/config ai`, `/status` | Check env vars, reconfigure or use no-provider mode |
| No network expected | Network-dependent command attempted | Check command docs | Use deterministic commands without provider |

## Repository Structure

```text
src/
  agent-packs/       # Agent pack generation
  ai/                # Provider abstraction, fake provider, disclosure
  cli/               # CLI bootstrap and external commands
  consistency/       # Consistency checks
  dependency-graph/  # Contract graph, output graph, graph queries
  executive/         # Executive Axis compilation
  fs/                # Safe filesystem adapter, atomic writes
  generation/        # Canonical Markdown generation and writing
  html/              # HTML artifact planning, rendering, escaping
  import/            # Import planner (read-only)
  init/              # Workspace initialization
  intake/            # Intake questions, context building, proposals
  performance/       # Performance benchmarking
  profiles/          # Profile YAML loading and contract assembly
  provenance/        # Source and claim provenance
  regeneration/      # Regeneration planning
  registers/         # Decision, assumption, risk, question registers
  release/           # Release candidate smoke
  runtime/           # Project detection, diagnostics, redaction
  scanner/           # Repository scanner (read-only)
  security/          # Security/privacy release checks
  staleness/         # Staleness detection
  state/             # Workspace state schema and repository
  traceability/      # Artifact traceability metadata
  tui/               # Ink TUI shell, slash parser and router
  validation/        # Deterministic validation and diagnosis
scripts/
  smoke-cli.js       # CLI smoke test
  smoke-package.js   # Release candidate package smoke
  security-check.js  # Security/privacy release check
profiles/
  standard/          # Bundled Standard documentation profile
docs/
  01-foundation/     # Project thesis, problem, audience, principles
  02-validation/     # Validation documents and evidence
  03-product/        # Product architecture, requirements, UX
  04-engineering/    # System architecture, data model, API, security, testing
  05-go-to-market/   # Market, positioning, launch
  06-operations/     # Operating model, support, incidents
  roadmap/           # Implementation roadmap
tests/               # Vitest test suite
```

## AI Behavior

AI is an advisory workflow layer, not an authority. AI output enters the system
with a status that keeps it distinct from confirmed state:

| Status | Meaning |
|---|---|
| `draft` | Generated but not yet reviewed |
| `proposed` | Ready for user review |
| `needs_review` | Flagged for attention |
| `rejected` | Reviewed and rejected by user |
| `confirmed` | Reviewed and accepted by user |

AI-generated decisions may become `confirmed` only after explicit user confirmation.
Provider output is advisory and provenance-bearing. Deterministic validation
remains separate from AI judgment.

### Running Without A Live Remote Provider

LOGOS Engine does not require live remote model calls for installation, tests,
initialization, status, validation, or provider setup. All deterministic commands
work offline with no credentials.

Remote AI is always opt-in. If no AI provider is enabled, deterministic fallback
behavior applies.

## Provider Configuration

LOGOS Engine supports local and remote LLM providers through a provider-agnostic
abstraction. Supported presets:

- **OpenAI** — `gpt-4o`, `gpt-4o-mini`, etc.
- **Anthropic** — `claude-sonnet-4-20250514`, etc.
- **OpenRouter** — any model available through OpenRouter
- **Ollama** — local models (`llama3.2`, `mistral`, etc.)
- **LM Studio** — local models via OpenAI-compatible endpoint
- **Custom** — any OpenAI-compatible endpoint

Configure via `/config ai` in the TUI (currently a recognized stub, planned for
a future phase) or edit `.logos/config.json`:

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4o",
    "tokenEnv": "LOGOS_LLM_API_KEY"
  }
}
```

API keys are loaded from environment variables — never stored in project files.
The config stores the name of the environment variable, not the key value.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, quality gates,
and review guidelines.

## License

- **Code**: MIT License — see [LICENSE](./LICENSE)
- **Documentation Templates**: Creative Commons Attribution 4.0
- **Code of Conduct**: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- **Security Policy**: [SECURITY.md](./SECURITY.md)
