# LIMITATIONS.md — LOGOS Engine

Last updated: 2026-05-28 (Step 18.5 — Final quality gate)

---

## 1. Known Limitations

### 1.1 No Real LLM Provider Integration

The engine only ships with a `MockLlmProvider` (fixture-based). No real provider adapter
(OpenAI, Anthropic, Ollama, etc.) is implemented. All flows and tests use deterministic
mock responses.

**Impact:** The engine cannot produce meaningful canonical answers without a real LLM.
Run `pnpm start --mock` to use the mock provider for prototyping.

### 1.2 HTML Export Is Basic

`src/outputs/html-exporter.ts` wraps the Markdown materializer in basic HTML boilerplate
(`<html>`, `<head>`, `<body>`, `<pre>`, `<code>`) rather than a full semantic HTML
renderer. It is functional but primitive.

**Impact:** HTML output is usable for preview but not production-ready for web
publishing or rich formatting.

### 1.3 Agent Pack Export Is Not Validated Against Consumers

`src/outputs/agent-pack-exporter.ts` produces structured JSON with answers, section
maps, dependency graphs, and source traceability. The data model is well-defined but
has not been validated against real AI agent consumption patterns.

**Impact:** Agent Packs are structurally complete but untested against downstream
AI coding tools.

### 1.4 TUI Is Terminal-Only (Ink/React)

The user interface runs in a terminal via Ink (React for terminals). There is no web
UI, no mobile UI, and no hosted/server-mode interface.

**Impact:** Users must operate LOGOS locally in a terminal. This is by design for the
MVP but limits accessibility.

### 1.5 Single-User, Single-Session Design

The runtime, persistence, and TUI are designed for one user in one terminal session at
a time. There is no multi-user coordination, no concurrent session support, and no
authentication layer.

**Impact:** Cannot be deployed as a multi-user service without significant architectural
changes.

### 1.6 Snapshot Builder Coverage Gap

`src/state-engine/snapshot-builder.ts` has 68.81% statement coverage and 65.27% branch
coverage. Several panel variants (export, settings) are partially tested.

**Impact:** Edge-case rendering for export and settings panels may have uncaught bugs.

### 1.7 TUI App-Shell Coverage Gap

`src/tui/app-shell.tsx` has 72.9% statement coverage. The component is large
(~430 lines) and some keyboard handling paths are only tested through the integration
shell renderer, not unit-tested directly.

**Impact:** Keyboard navigation edge cases (multi-key sequences, rapid input) may not
be fully covered.

### 1.8 Use-Focus Hook Branch Coverage

`src/tui/hooks/use-focus.ts` has 56.89% branch coverage. Focus region cycling across
all regions (sidebar → main → input → actions) is tested, but some boundary
conditions (empty regions, rapid region switching) have gaps.

**Impact:** Focus state may behave unexpectedly when regions appear/disappear
dynamically.

---

## 2. Test Coverage Summary

| Layer | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| **Overall** | 83.46% | 75.19% | 92.08% | 84.49% |
| State Engine | 90.28% | 81.96% | 97.02% | 91.00% |
| Profiles | 93.93% | 76.19% | 100% | 94.72% |
| Contracts | 100% | 100% | 100% | 100% |
| Prompt Orch. | 88.15% | 78.99% | 100% | 91.53% |
| Persistence | 87.26% | 80.21% | 83.67% | 90.41% |
| TUI (overall) | ~82% | ~74% | ~88% | ~83% |

State engine exceeds the 80% branch threshold specified in the testing architecture.
Overall branch coverage (75.19%) is below the aspirational 80% but above the 60%
minimum.

---

## 3. Stub Tests (it.todo)

Two flow test files contain only `it.todo` placeholders:

- **Flow H — Export Outcomes** (`tests/flows/flow-h-export-outcomes.test.ts`):
  - Only ready documents exported without warning
  - Blocked exports show specific missing requirements
  - Generated files contain correct content
  - Export does not mutate runtime state

- **Flow I — Resume Session** (`tests/flows/flow-i-resume-session.test.ts`):
  - Session detection works on launch
  - All node states restored correctly
  - Conversation history intact
  - Can continue without re-answering previous questions

These are counted as 2 skipped test files (0 actual tests, 8 `it.todo` items).

---

## 4. Architecture Boundaries

All enforced boundaries are clean as of this checkpoint:

| Boundary | Rule | Status |
|---|---|---|
| TUI → LLM | No direct imports | ✅ Clean |
| State Engine → TUI | No UI framework imports | ✅ Clean |
| LLM → State Mutation | No dispatch/state imports | ✅ Clean |
| All cross-boundary | Verified via grep | ✅ Clean |

Architecture boundary tests in `tests/architecture/module-boundaries.test.ts` (6 tests) all pass.

---

## 5. Roadmap Omissions

The following roadmap items were intentionally deferred or are out of scope for the
current implementation phase:

- **Real LLM provider integration** — deferred to post-MVP
- **Web UI / hosted mode** — future architecture
- **Multi-user support** — future architecture
- **Advanced prompt templates for all lifecycle states** — partial; core states covered
- **Full coverage of all 10 node lifecycles in TUI** — 4 lifecycles explicitly
  rendered (not_started, synthesized, accepted, blocked); others render via shared
  conversation panel
- **Performance optimization** — not profiled or optimized
- **Security hardening** — no auth, no input sanitization beyond YAML validation
- **Internationalization** — English only

---

## 6. Development Environment

- **Node.js** ≥ 20
- **pnpm** as package manager
- **TypeScript** 5.x in strict mode
- **Vitest** 4.x for testing
- **Biome** for linting/formatting
- **Ink** 6.x for terminal rendering

Tests are designed to run without network access. No LLM credentials are required.

---

## 7. Quality Gate Status

```bash
pnpm check  # typecheck + lint + test — exits 0
```

| Gate | Status | Notes |
|---|---|---|
| `pnpm typecheck` | ✅ Pass | Zero errors |
| `pnpm lint` | ✅ Pass | Zero warnings |
| `pnpm test` | ✅ Pass | 79/81 files, 1616 tests, 0 failures |
| Flow tests (A-J) | ✅ Pass | 14 files, 43 tests (10 prototypes covered) |
| State snapshots | ✅ Pass | 81 snapshot tests |
| Mock LLM | ✅ Pass | 20 mock provider tests |
| Persistence | ✅ Pass | 68 round-trip tests |
| Architecture bounds | ✅ Pass | 6 boundary tests |

---

## 8. Recommendations for Next Phase

1. Wire a real LLM provider (OpenAI or Anthropic adapter). See
   `docs/14-real-llm-integration-plan.md` and
   `docs/15-real-llm-implementation-roadmap.md`.
2. Implement the 8 `it.todo` tests in stub files.
3. Raise `snapshot-builder.ts` branch coverage above 80%.
4. Add lifecycle-specific rendering tests for all 10 lifecycle states.
5. Profile and optimize the Ink rendering pipeline for large conversations.
6. Add a `logos validate` CLI command for profile schema validation.
7. Consider a headless mode for CI/CD integration.