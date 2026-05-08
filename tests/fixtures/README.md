# Test Fixtures

Fixtures in this directory must be deterministic and safe for the default test suite.

Default tests must not require:

- network access;
- live AI provider credentials;
- remote model calls;
- raw API tokens.

Future AI fixtures should capture structured provider responses and malformed-response cases without storing secrets or private project content.

## Example Workspace

`example-workspace/` contains a complete LOGOS Engine workspace for a hypothetical app business ("FitFlow" — personal trainer scheduling app).

It demonstrates:

- `.logos/project.json` — project metadata
- `.logos/profile.lock.json` — locked app-business profile v0.1.0
- `.logos/answers.json` — 50 answers covering all 12 phases
- `.logos/decisions.json` — 38 confirmed/assumed decisions derived from intake
- `.logos/config.json` — AI config (no live provider configured)
- `.logos/diagnostics.json` — empty diagnostics (ready for `/diagnose`)

No live AI was used to produce this fixture. It serves as a reference for what a fully-initialized workspace looks like.
