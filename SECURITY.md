# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in LOGOS Engine, please report it privately. Do not open a public issue.

Send a description of the vulnerability, including steps to reproduce and affected versions, to the project maintainers.

## Security Model

LOGOS Engine is a local-first CLI/TUI application. It runs on your machine and writes to your local filesystem. It does not run a server, collect telemetry, or phone home.

### In-Scope Concerns

- **LLM token handling**: The engine loads API keys from environment variables (e.g. `LOGOS_LLM_API_KEY`) and never stores raw tokens in project files (`.logos/config.json`). Tokens are redacted from diagnostic output.
- **Prompt safety**: Unrelated project files are excluded from AI context by default. Context sent to remote providers is limited to structured project state, profile definitions, and user answers.
- **File safety**: The engine uses safe/atomic writes for JSON/YAML state. It refuses destructive overwrites during initialization.
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
