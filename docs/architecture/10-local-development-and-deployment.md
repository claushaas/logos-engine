# 10 — Local Development and Deployment

## 1. Purpose

This document defines the local development and initial deployment architecture for the LOGOS Engine.

---

## 2. Development Thesis

```txt
The first implementation should optimize for local reliability, deterministic testing, and fast iteration.
```

Cloud deployment can come after runtime boundaries stabilize.

---

## 3. Local Development Requirements

Local development must support:

```txt
- running the TUI;
- loading sample profiles;
- using mock LLM provider;
- optionally using real LLM provider;
- persisting sessions locally;
- generating Markdown/HTML/agent-pack artifacts;
- running tests without network.
```

---

## 4. Suggested Project Structure

```txt
src/
  tui/
  application/
  state-engine/
  conversation-runtime/
  prompt-orchestration/
  llm/
  validation/
  materialization/
  persistence/
  profiles/
  outputs/
  diagnostics/

profiles/
  startup.yml
  app.yml

prompts/
  global/
  foundation/
  product/

schemas/
  agent-turn-output.schema.json
  profile.schema.json

sessions/
  .gitkeep

outcomes/
  markdown/
  html/
  agents/
```

---

## 5. Local Persistence

Recommended:

```txt
SQLite database in local data directory.
Generated artifacts written to outcomes/.
```

Prototype alternative:

```txt
JSON files under sessions/.
```

---

## 6. Environment Variables

Suggested variables:

```txt
LOGOS_DATA_DIR
LOGOS_PROFILE_DIR
LOGOS_PROMPT_DIR
LOGOS_OUTPUT_DIR
LOGOS_LLM_PROVIDER
LOGOS_LLM_MODEL
LOGOS_LLM_API_KEY
LOGOS_USE_MOCK_LLM
LOGOS_LOG_LEVEL
```

Rules:

```txt
- tests should default to mock LLM;
- API keys must not be required for unit tests;
- secrets must not be logged.
```

---

## 7. CLI/TUI Commands

Possible commands:

```txt
logos start
logos start --profile startup
logos sessions list
logos sessions open <id>
logos export <session-id>
logos validate-profile <path>
logos test-fixture <fixture>
```

---

## 8. Build Strategy

Initial build should produce:

```txt
- runnable CLI/TUI;
- typechecked modules;
- bundled prompt/profile assets or configurable paths;
- test fixtures.
```

---

## 9. Deployment Options

Initial deployment targets:

```txt
- local CLI;
- private developer machine;
- optional server-hosted TUI later;
- optional web interface later.
```

Do not optimize for multi-user hosted deployment before the runtime stabilizes.

---

## 10. Future Hosted Architecture

Possible future shape:

```txt
Web UI
→ API server
→ Application runtime
→ State engine
→ Persistence DB
→ LLM provider
→ Artifact storage
```

But this should not drive the MVP architecture prematurely.

---

## 11. Release Artifacts

Generated outputs:

```txt
- canonical Markdown docs;
- HTML navigable artifacts;
- agent packs;
- session export bundle.
```

---

## 12. Development Gates

Before implementation is considered usable:

```txt
- mock first-use flow works;
- local persistence works;
- resume works;
- export works;
- test suite runs without LLM credentials;
- architecture boundaries are respected.
```

---

## 13. Non-Negotiable Rules

```txt
- Local development must work without real LLM credentials.
- Generated artifacts must not overwrite canonical sources silently.
- Secrets must not be committed or logged.
- Runtime architecture must not depend on deployment target.
```
