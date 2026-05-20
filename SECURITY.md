# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in LOGOS Engine, please report it privately. Do not open a public issue.

Send a description of the vulnerability, including steps to reproduce and affected versions, to the project maintainers.

## Security Model

LOGOS Engine is a local-first CLI/TUI application. It runs on your machine and writes to your local filesystem. It does not run a server, collect telemetry, or phone home.

### In-Scope Concerns

- **LLM token handling**: The engine loads API keys from environment variables (e.g. `OPENAI_API_KEY`) referenced by the provider configuration. Token values are NEVER stored in workspace state (`.logos/workspace.json`). Only environment variable names are stored. Tokens are redacted from diagnostic output and never appear in status displays.
- **Prompt safety**: Unrelated project files are excluded from AI context by default. Context sent to remote providers is limited to structured project state, profile definitions, and user answers.
- **File safety**: The engine uses safe/atomic writes for JSON/YAML state. It refuses destructive overwrites during initialization. Interactive TUI confirmations require explicit keyboard acceptance of destructive actions; cancel/no mutates nothing.
- **Confirmation safety**: Keyboard confirmation does not bypass validation, path safety, security, readiness, or write-policy checks. Stale confirmations are rejected. Destructive actions are visibly marked as destructive.
- **Documentation root safety**: The documentation root must remain inside the project root. Root configuration (`/root`) enforces path containment, rejects traversal (`..`), blocks reserved directories (`.git`, `.logos`, `node_modules`, `src`, `tests`, `profiles`, `scripts`, `dist`, `build`, `coverage`), blocks package metadata files (`package.json`, `README.md`, `SECURITY.md`), detects symlink escapes, and rejects active profile root overlap. Root changes require confirmation and never move, delete, or regenerate files automatically.
- **Input validation**: YAML profile files, user answers, and AI responses are schema-validated before use.

### Out-of-Scope

- Network-level attacks on the user's machine.
- Compromise of the user's OS or shell environment.
- Malicious AI model responses (the engine validates structure, not content truth).

## Supported Versions

Only the latest release is supported with security updates.

## Disclosure Process

1. Reporter submits vulnerability privately.
2. Maintainers acknowledge receipt within 72 hours.
3. Maintainers investigate and develop a fix.
4. A security advisory is published alongside the fix release.

## LLM Provider Security

When you configure a remote LLM provider:

- Your API key is read from an environment variable you specify (default: `LOGOS_LLM_API_KEY`).
- The key is never written to `.logos/config.json` or any tracked file.
- Project context sent to the provider is limited to structured state relevant to the AI operation (answers, decisions, profile definitions, document contracts).
- Arbitrary source files are never sent to remote providers by default.

You can inspect what context would be sent using `/config ai --show`.

## Release Security and Privacy Checks

LOGOS Engine includes a deterministic, read-only, non-mutating security/privacy release checker. It can be run at any time after building:

```bash
pnpm build
pnpm security:check
```

> **Note:** `pnpm security:check` requires a prior build (`pnpm build`) because the
> checker imports compiled TypeScript modules from `dist/`. It does not require
> provider credentials, network access, or an initialized workspace.

### What the checker verifies

- **Redaction audit**: Scans for raw API keys, bearer tokens, authorization headers, private key blocks, credentials in URLs, and other secret-like values.
- **Provider config safety**: Ensures provider tokens are stored as environment variable references, not raw strings.
- **Workspace state safety**: Ensures no raw secrets are persisted in workspace state, run metadata, or session records.
- **Backup safety**: Ensures backup manifests exclude `.env` contents and raw secrets.
- **Generated artifact safety**:
  - HTML artifacts must not contain `<script>`, `<iframe>`, `<form>`, `javascript:`, `vbscript:`, event handlers, or remote assets.
  - Agent Packs must include derived/non-canonical warnings and must not contain instructions to exfiltrate secrets, override constraints, or claim canonical authority.
  - Executive exports must be marked as derived snapshots, not live task managers.
- **Derived artifact boundary**: Ensures HTML, Agent Packs, Executive exports, reports, scanner outputs, and consistency reports are marked as non-canonical.
- **Package contents safety**: Verifies package excludes `.env`, `.logos`, backups, coverage, `.git`, `node_modules`, and private artifacts.
- **Script safety**: Detects network/external tools (`curl`, `wget`, `npm publish`, etc.) in default check scripts. Flags telemetry, analytics, remote logging, crash upload, cloud backup, and external sync patterns.
- **Dependency surface**: Flags unexpected dependencies that suggest telemetry, analytics, cloud services, or external sync.
- **Network safety**: Confirms default CLI commands and tests do not require network access.

### Release status

The checker produces one of four statuses:

- `pass`: No findings at error or fatal severity.
- `pass_with_warnings`: Warning-level findings only.
- `blocked`: One or more error or fatal findings. Release is blocked.
- `unknown`: Insufficient evidence for critical checks (strict mode only).

### Limitations

- The security/privacy release checker does NOT perform network vulnerability audits.
- It does NOT look up CVEs for dependencies.
- It does NOT perform formal penetration testing.
- It does NOT scan for all possible secret formats.
- It is a release gate, not a security guarantee.
- No formal third-party security audit has been performed on LOGOS Engine.
- The security posture depends on the user's local OS, filesystem permissions,
  shell history, and OS backup security.

## Operational Security Commands

| Command | Purpose | Requires Build | Requires Workspace |
|---|---|---|---|
| `pnpm security:check` | Deterministic security/privacy release check | Yes | No |
| `pnpm smoke:package` | Release candidate package smoke (includes security check) | Yes | No |
| `pnpm smoke:cli` | CLI smoke test (help, version, doctor) | Yes | No |
| `logos doctor` | Local diagnostics (includes provider config redaction) | Yes | No |
| `/config ai --show` | Inspect what context would be sent to provider | Yes | Yes |

For development and contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).
For product-level security and privacy documentation, see [Security and Privacy](./docs/04-engineering/08-security-and-privacy.md).
