# Test Fixtures

Fixtures in this directory must be deterministic and safe for the default test suite.

Default tests must not require:

- network access;
- live AI provider credentials;
- remote model calls;
- raw API tokens.

Future AI fixtures should capture structured provider responses and malformed-response cases without storing secrets or private project content.
