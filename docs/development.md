# LOGOS Engine — Development Guide

## Overview

LOGOS Engine is a conversation-first documentation engine governed by a
deterministic state engine, rendered in a terminal UI, and producing canonical
documents from accepted semantic nodes.

### Architecture Layers

```text
┌─────────────────────────────────────────────────────────────┐
│ Interface Layer — TUI (renders state snapshots)             │
├─────────────────────────────────────────────────────────────┤
│ Application Layer — Use cases, orchestration, snapshots     │
├─────────────────────────────────────────────────────────────┤
│ Domain / State Layer — State engine, lifecycle, invariants  │
├─────────────────────────────────────────────────────────────┤
│ LLM Orchestration — Prompt registry, assembly, validation   │
├─────────────────────────────────────────────────────────────┤
│ Persistence — Snapshots, event log, migrations              │
├─────────────────────────────────────────────────────────────┤
│ Materialization — Document assembly, Markdown/HTML/Agent Pk │
├─────────────────────────────────────────────────────────────┤
│ Infrastructure — FS adapter, provider clients, diagnostics  │
└─────────────────────────────────────────────────────────────┘
```

### Core Data Flow

```text
User input → TUI event → Application use case → State engine evaluation
→ Prompt orchestration (if needed) → LLM structured output → Validation
→ State engine transition → Persistence → Render snapshot → TUI render
```

---

## Development Setup

### Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 10

### Install

```bash
git clone <repository-url>
cd logos-engine
pnpm install
```

### Build

```bash
pnpm build
```

Compiles TypeScript to `dist/`. The CLI entry point is `dist/cli/main.js`.

### Run

```bash
# Start with mock LLM (no API key)
node dist/cli/main.js --mock --profile startup
```

### Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `LOGOS_USE_MOCK_LLM` | Use mock provider (`true`/`false`) | — |
| `LOGOS_DATA_DIR` | Session persistence directory | `sessions` |
| `LOGOS_PROFILE_DIR` | Profile directory | `profiles` |
| `LOGOS_LLM_PROVIDER` | LLM provider identifier | — |
| `LOGOS_LLM_MODEL` | LLM model name | — |
| `LOGOS_LLM_API_KEY` | LLM API key (never log this) | — |

---

## Project Structure

```text
logos-engine/
├── src/
│   ├── cli/                  # CLI entry point (main.ts)
│   ├── contracts/            # Shared types and schemas
│   ├── state-engine/         # Deterministic state engine
│   ├── conversation-runtime/ # Node-scoped message management
│   ├── application/          # Use cases, orchestration, render snapshots
│   ├── prompt-orchestration/ # Prompt registry, selection, assembly
│   ├── llm/                  # Provider adapter, mock provider
│   ├── validation/           # AgentTurnOutput validation
│   ├── materialization/      # Document assembly (Markdown/HTML/Agent Pack)
│   ├── persistence/          # Session snapshots, event log, migrations
│   ├── profiles/             # Profile loading, dependency graph, node tree
│   ├── tui/                  # Terminal UI (Ink/React)
│   ├── diagnostics/          # Error handling, diagnostic reporting
│   ├── outputs/              # Export manager, artifact metadata
│   └── shared/               # Primitives: Result, Brand, IDs, errors, invariants
├── profiles/
│   ├── startup.yml           # Startup sample profile
│   └── standard/             # Standard multi-file profile
├── tests/
│   ├── contracts/            # Type-level and schema tests
│   ├── profiles/             # Profile loader, dependency graph tests
│   ├── state-engine/         # State engine unit tests
│   ├── flows/                # End-to-end flow tests
│   ├── harness/              # Conversation harness
│   └── tui/                  # TUI component and snapshot tests
├── docs/                     # Specification and architecture documents
│   ├── architecture/         # System, runtime, module, data architecture
│   └── *.md                  # Canonical specs (01–13)
├── implementation-prompts/   # Step-by-step implementation prompts
│   ├── 00-execution-protocol.md
│   ├── 00-execution-board.md
│   └── phase-*/              # Per-step prompt files
└── tsconfig.json
```

---

## Module Guide

### `src/contracts/`

**Purpose:** Define all TypeScript types shared across modules. No runtime logic.

**Key files:**

- `profile.ts` — `LogosProfile`, `PhaseDefinition`, `NodeDefinition`, `DocumentDefinition`, `DocumentMaterializationRule`
- `runtime-state.ts` — `LogosRuntimeState`, `SessionMode`, `GlobalContext`
- `node-state.ts` — `NodeRuntimeState`, `NodeLifecycle`, `NodeAction`, `PromptState`
- `canonical-answer.ts` — `CanonicalAnswer`, `CanonicalAnswerDraft`
- `conversation.ts` — `NodeMessage`, `NodeConversation`
- `agent-turn.ts` — `AgentTurnOutput`, `TransitionIntent`
- `document-state.ts` — `DocumentRuntimeState`, `DocumentStatus`
- `render-snapshot.ts` — `TuiRenderSnapshot`, sidebar/main panel/action bar models
- `session-event.ts` — `SessionEvent`, typed event payloads
- `persistence.ts` — `SessionSnapshot`, `PersistedSession`
- `completeness.ts` — `CompletenessState`
- `export-state.ts` — `ExportRuntimeState`, `GeneratedArtifact`

**Import rules:** Contracts may import from `shared/` only. No module outside
`shared/` may be imported by contracts.

### `src/state-engine/`

**Purpose:** Owns the deterministic state. Validates lifecycle transitions,
computes allowed actions, evaluates completeness and document readiness.

**Key files:**

- `state-engine.ts` — `createSession`, `selectProfile`, core state operations
- `node-lifecycle.ts` — `isValidTransition`, `applyLifecycleTransition`
- `node-selection.ts` — `selectNode`, `deselectNode`
- `session-mode.ts` — `resolveSessionMode`
- `allowed-actions.ts` — `getAllowedActions`, `isActionAllowed`
- `completeness.ts` — `evaluateCompleteness`
- `document-readiness.ts` — `computeDocumentReadiness`
- `dispatch.ts` — `dispatch(state, event, profile): StateEngineResult`
- `snapshot-builder.ts` — `buildSnapshot(state, profile): StateEngineSnapshot`

**Key invariant:** The state engine is deterministic. Same state + same event =
same result. The LLM *proposes* structured outputs but never mutates state
directly.

**Tests:** `tests/state-engine/` — transition matrix, allowed actions,
completeness, document readiness, dispatch.

### `src/conversation-runtime/`

**Purpose:** Node-scoped message management. Append messages, summarise
conversations for token budgets, manage canonical answers.

**Key files:**

- `message-manager.ts` — `appendUserMessage`, `appendAssistantMessage`
- `canonical-answer.ts` — `createDraft`, `acceptAnswer`, `markStale`
- `summarizer.ts` — `generateSummary`

### `src/application/`

**Purpose:** Orchestration layer. Translates TUI events into state engine
events, manages the prompt → LLM → validation → state cycle, builds render
snapshots.

**Key files:**

- `runtime.ts` — `createApplicationRuntime`, subscription model for TUI

### `src/prompt-orchestration/`

**Purpose:** Selects, assembles, and injects context into prompts based on
node lifecycle, prompt state, and profile configuration.

**Key files:**

- `prompt-registry.ts` — Centralised prompt store with fallbacks
- `prompt-selector.ts` — Maps lifecycle to prompt state
- `prompt-assembler.ts` — Builds final LLM request with context injection

### `src/llm/`

**Purpose:** LLM provider abstraction. The `LlmProvider` interface is
implemented by mock and (eventually) real providers.

**Key files:**

- `llm-provider.ts` — `LlmProvider` interface
- `mock-provider.ts` — `MockLlmProvider` with fixture-based deterministic
  responses. Used in tests and the `--mock` CLI flag.

### `src/validation/`

**Purpose:** Validates `AgentTurnOutput` from the LLM before applying to state.
Rejects malformed output and triggers the repair loop.

**Key files:**

- `agent-turn-validator.ts` — `validateAgentTurnOutput`
- `repair-prompt.ts` — Repair prompt generation for invalid output

### `src/materialization/`

**Purpose:** Assembles documents from accepted canonical answers. Generates
Markdown, HTML, and Agent Pack outputs.

**Key files:**

- `document-materializer.ts` — `materializeDocument`, `previewDocument`

### `src/persistence/`

**Purpose:** Session save/load, event log, schema migrations.

**Key files:**

- `snapshot-store.ts` — `saveSnapshot`, `loadSnapshot`, `listSessions`
- `event-log.ts` — Append and replay session events
- `session-resume.ts` — `resumeSessionWithDiagnostics`

### `src/profiles/`

**Purpose:** Load and validate profile YAML/JSON files. Build dependency
graphs and node trees for the state engine and sidebar.

**Key files:**

- `profile-loader.ts` — `loadProfile(path): Result<LogosProfile, LoadError>`
- `profile-registry.ts` — `listProfiles()`, `getProfile(id)`
- `dependency-graph.ts` — `buildDependencyGraph`, cycle detection
- `node-tree.ts` — `buildNodeTree` (phase → document → node)

### `src/tui/`

**Purpose:** Terminal UI rendered with [Ink](https://github.com/vadimdemedes/ink)
(React for the terminal).

**Key files:**

- `AppShell.tsx` — Global layout, routes to mode-appropriate components
- `components/Sidebar.tsx` — Collapsible node tree with status indicators
- `components/ConversationPanel.tsx` — Chat-like message rendering
- `components/DocumentPreview.tsx` — Materialised document view
- `components/ExportPanel.tsx` — Export type selector
- `components/DiagnosticsPanel.tsx` — Error and diagnostic display (Ctrl+D)

### `src/shared/`

**Purpose:** Foundation types and utilities used by all modules.

**Key files:**

- `types/Result.ts` — `Result<T, E>` discriminated union
- `types/Brand.ts` — `Brand<T, B>` for branded IDs (`NodeId`, `DocumentId`, etc.)
- `utils/id.ts` — `generateId()`
- `utils/date.ts` — Date/time utilities
- `errors/LogosError.ts` — Base error class
- `errors/invariant.ts` — `invariant(condition, message)` assertion

---

## Testing Guide

### Run all tests

```bash
pnpm test
```

### Run a specific test file

```bash
pnpm vitest run tests/profiles/startup-profile.test.ts
```

### Watch mode

```bash
pnpm test:watch
```

### Coverage

```bash
pnpm test:coverage
```

Coverage targets: ≥ 80% on state engine, ≥ 60% overall.

### Test Architecture

| Directory | Tests |
|---|---|
| `tests/contracts/` | Type-level tests, schema validation, type narrowing |
| `tests/state-engine/` | Transition matrix, allowed actions, completeness, readiness |
| `tests/profiles/` | Profile loading, dependency graph, node tree |
| `tests/flows/` | End-to-end flow tests (A–J from prototypes) |
| `tests/harness/` | Deterministic conversation harness |
| `tests/tui/` | TUI component tests, render snapshot tests |

### Writing Tests

- **No network dependency.** Tests must run without LLM credentials. Use
  `MockLlmProvider` for any LLM-dependent test.
- **Use `loadProfile`** for profile fixtures. The test fixture pattern is
  established in `tests/profiles/profile-loader.test.ts`.
- **State engine tests** should verify deterministic behaviour: same state +
  same event = same result.
- **TUI tests** use `ink-testing-library` for component rendering.
- **Flow tests** use the conversation harness from `tests/harness/` to simulate
  complete user journeys.

### Mock LLM Provider

The mock provider (`src/llm/mock-provider.ts`) returns deterministic fixtures
keyed by `NodeLifecycle`. It is enabled via:

```bash
node dist/cli/main.js --mock
LOGOS_USE_MOCK_LLM=true node dist/cli/main.js
```

In tests, construct the provider directly:

```ts
import { MockLlmProvider } from '../../src/llm/mock-provider.js';
const provider = new MockLlmProvider();
```

---

## Quality Gates

### `pnpm check`

Runs the full quality gate:

```bash
pnpm check
# Equivalent to: pnpm typecheck && pnpm lint && pnpm test
```

### Individual gates

| Command | What it checks |
|---|---|
| `pnpm typecheck` | TypeScript compilation (`tsc --noEmit`) |
| `pnpm lint` | Biome lint + markdownlint |
| `pnpm lint:boundaries` | Module import boundary violations (dependency-cruiser) |
| `pnpm test` | All unit/component/flow tests |

### Boundary Enforcement

Module boundaries are enforced by `dependency-cruiser` via `pnpm lint:boundaries`.
Key rules:

- `contracts/` may only import from `shared/`
- `tui/` must not import from `llm/` directly
- `state-engine/` must not import from `tui/`

Run before committing:

```bash
pnpm check
```

---

## Profiles

### Format

Profiles are YAML files conforming to the `LogosProfile` contract. A single-file
minimum example:

```yaml
id: my-profile
title: My Profile
version: '1.0.0'
phases:
  - id: 01-phase
    title: Phase One
    order: 1
    purpose: The first phase.
documents:
  - id: doc-one
    phaseId: 01-phase
    title: Document One
    order: 1
    purpose: The first document.
    outputPath: docs/one.md
    requiredNodeIds:
      - node-one
    optionalNodeIds: []
nodes:
  - id: node-one
    phaseId: 01-phase
    documentId: doc-one
    title: Node One
    order: 1
    canonicalQuestion: What is the core thesis?
    coverageTopics:
      - central conviction
    sufficiencyCriteria:
      - explicit and non-generic
    promptRefs:
      initial: prompts/one/initial.md
materializationRules:
  - documentId: doc-one
    title: Document One Rule
    outputPath: docs/one.md
    sourceNodeIds:
      - node-one
    requiredNodeIds:
      - node-one
    optionalNodeIds: []
    sections:
      - id: core
        title: Core Section
        sourceNodeIds:
          - node-one
        required: true
```

See `profiles/startup.yml` for a full 12-node sample profile.

### Loading in code

```ts
import { resolve } from 'node:path';
import { loadProfile } from './src/profiles/index.js';

const result = loadProfile(resolve('profiles/startup.yml'));
if (result.ok) {
  console.log(result.value.nodes.length, 'nodes loaded');
}
```

---

## Key Concepts

### Deterministic State Engine

The state engine is the system's source of truth. It:

- Owns all runtime state.
- Validates every lifecycle transition against the transition matrix.
- Computes allowed actions per lifecycle.
- Evaluates completeness and document readiness.
- Generates render snapshots for the TUI.
- Persists snapshots and event logs.

The LLM proposes structured output (`AgentTurnOutput`) but the state engine
decides whether to apply it.

### Node Lifecycle

```text
not_started → active → answered → needs_clarification
                                → needs_refinement
                                → ready_for_synthesis → synthesized
                                                       → accepted
any → deferred
any → blocked → not_started (when unblocked)
```

### Profile → State separation

- **Profile** defines *what can be worked* (phases, documents, nodes, rules).
- **Runtime state** defines *what has happened* (lifecycle, conversation,
  canonical answers, document status).

### Conversation-First

The TUI is conversation-first, not form-based. Users answer questions
conversationally. The sidebar is navigational structure, not a data-entry form.

---

## Contributing

1. Follow the execution protocol in `implementation-prompts/00-execution-protocol.md`.
2. Use CodeGraph for repository discovery before editing.
3. Use `@juicesharp/rpiv-advisor` before and after implementation.
4. Run `pnpm check` before committing.
5. Keep diffs focused — one step at a time.
6. Add or update tests required by the change.
7. Update the execution board.

---

## Further Reading

| Document | Topic |
|---|---|
| `docs/01-prototype-plan.md` | Prototype scope, states, flows, component model |
| `docs/02-state-engine-canonical-spec.md` | State engine specification |
| `docs/03-conversation-runtime-spec.md` | Conversation model |
| `docs/04-node-lifecycle-and-question-state.md` | Node lifecycle and allowed actions |
| `docs/05-prompt-orchestration-spec.md` | Prompt selection and assembly |
| `docs/06-agent-turn-contract.md` | LLM output contract |
| `docs/07-document-materialization-spec.md` | Document generation |
| `docs/08-tui-state-and-rendering-contract.md` | TUI rendering rules |
| `docs/09-session-events-and-persistence.md` | Persistence model |
| `docs/10-profile-and-node-schema-spec.md` | Profile and node schema |
| `docs/11-conversation-quality-and-completeness.md` | Completeness evaluation |
| `docs/13-prototypes.md` | Wireframes, state prototypes, flow walkthroughs |
| `docs/architecture/` | System, runtime, module, data, LLM, TUI architecture |
| `IMPLEMENTATION_ROADMAP.md` | Canonical implementation roadmap |
| `implementation-prompts/00-execution-protocol.md` | Step-by-step execution protocol |
| `implementation-prompts/00-execution-board.md` | Current implementation status |
