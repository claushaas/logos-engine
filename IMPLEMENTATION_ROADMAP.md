# LOGOS Engine — Implementation Roadmap

## 1. Purpose

This document defines the canonical implementation roadmap for the LOGOS Engine — a conversation-first documentation engine governed by a deterministic state engine, rendered in a terminal UI, and producing canonical documents from accepted semantic nodes.

The roadmap converts the high-level vision into a sequence of atomic, testable, and dependency-ordered implementation steps. Each step is small enough to be delivered by a single coding agent with low risk of ambiguous interpretation.

---

## 2. Implementation Principles

```txt
Build the runtime first.
Render the runtime second.
Integrate the LLM third.
Materialize documents fourth.
Polish the TUI last.
```

**Core architectural rules:**

- The TUI is a conversation-first rendering surface, not a form-based interface.
- The sidebar is navigational structure, not a data-entry form.
- The state engine is deterministic — it owns state, validates transitions, and computes allowed actions.
- `activeNodeId` controls the primary runtime mode (structural vs. node-focused).
- Each node owns its own conversation history, lifecycle, canonical answer, and completeness state.
- Canonical answers are separate from raw conversation messages.
- Documents are materialized outputs derived from accepted canonical answers.
- The LLM proposes structured outputs but never mutates state directly.
- The active prompt is determined by node lifecycle and prompt state.
- Deterministic actions appear only when permitted by the state engine.
- Tests accompany every relevant step.

---

## 3. Source Documents

This roadmap is derived from the following canonical specification documents:

| # | Document | Role |
|---|---|---|
| 01 | `01-prototype-plan.md` | Prototype scope, states, flows, component model |
| 02 | `02-state-engine-canonical-spec.md` | Deterministic state engine specification |
| 03 | `03-conversation-runtime-spec.md` | Node-scoped conversation model |
| 04 | `04-node-lifecycle-and-question-state.md` | Node lifecycle, transitions, allowed actions |
| 05 | `05-prompt-orchestration-spec.md` | Prompt selection and assembly by state |
| 06 | `06-agent-turn-contract.md` | Structured LLM output contract |
| 07 | `07-document-materialization-spec.md` | Document generation from accepted answers |
| 08 | `08-tui-state-and-rendering-contract.md` | TUI rendering rules |
| 09 | `09-session-events-and-persistence.md` | Event log and persistence model |
| 10 | `10-profile-and-node-schema-spec.md` | Profile, document, and node definitions |
| 11 | `11-conversation-quality-and-completeness.md` | Completeness evaluation rules |
| 12 | `12-high-level-implementation-roadmap.md` | High-level phased plan |
| 13 | `13-prototypes.md` | Wireframes, state prototypes, flow walkthroughs |
| — | `architecture/01-system-architecture.md` | Macro system architecture |
| — | `architecture/02-runtime-architecture.md` | Runtime execution flow |
| — | `architecture/03-module-boundaries.md` | Module dependency rules |
| — | `architecture/04-data-and-persistence-architecture.md` | Persistence and data model |
| — | `architecture/05-llm-integration-architecture.md` | LLM provider integration |
| — | `architecture/06-tui-rendering-architecture.md` | TUI render architecture |
| — | `architecture/07-contracts-and-schemas.md` | Contract index and ownership |
| — | `architecture/08-error-handling-and-recovery.md` | Error handling model |
| — | `architecture/09-testing-architecture.md` | Testing strategy |
| — | `architecture/10-local-development-and-deployment.md` | Dev environment and deployment |
| — | `architecture/11-architecture-decision-records.md` | ADR process and required ADRs |

---

## 4. Architecture Summary

### 4.1 System Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Interface Layer — TUI (renders state, captures input)       │
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

### 4.2 Module Map (Target)

```
src/
  contracts/           # Shared types and schemas
  state-engine/        # Runtime state, transitions, guards, invariants
  conversation-runtime/# Node-scoped message management
  application/         # Use cases, orchestration, snapshot building
  prompt-orchestration/# Prompt registry, selection, assembly
  llm/                 # Provider adapter, mock provider
  validation/          # AgentTurnOutput validation, schema validation
  materialization/     # Document assembly, Markdown/HTML/Agent Pack generation
  persistence/         # Session snapshots, event log, migrations
  profiles/            # Profile loading, schema validation
  tui/                 # Terminal rendering, keyboard handling
  diagnostics/         # Error handling, recovery, diagnostic reporting
  outputs/             # Export management, artifact metadata
```

### 4.3 Primary Data Flow

```
User input → TUI event → Application use case → State engine evaluation
→ Prompt orchestration (if needed) → LLM structured output → Validation
→ State engine transition → Persistence → Render snapshot → TUI render
```

### 4.4 Core Runtime Type

```ts
type LogosRuntimeState = {
  sessionId: string
  selectedProfileId: string | null
  activeNodeId: string | null
  mode: SessionMode
  nodeStates: Record<NodeId, NodeRuntimeState>
  documentStates: Record<DocumentId, DocumentRuntimeState>
  exportState: ExportRuntimeState
  globalContext: GlobalContext
  lastActiveNodeId: string | null
  updatedAt: string
}
```

### 4.5 Key Invariants

- `activeNodeId === null` → structural/deterministic mode
- `activeNodeId !== null` → node-focused conversational mode
- An active node must belong to the selected profile
- Each node has isolated conversation, canonical answer, and lifecycle
- Documents materialize from accepted non-stale canonical answers
- LLM output is a proposal; the state engine validates and applies
- The TUI renders state snapshots; it never owns state

---

## 5. Implementation Phases

---

### Phase 0 — Repository and Development Baseline

#### Step 0.1 — Establish project structure and tooling baseline

##### Objective

Set up the repository skeleton with TypeScript, Vitest, Biome, and the module directory structure. Configure path aliases, build scripts, and quality gates.

##### Why This Step Exists

All subsequent phases depend on a clean, compilable, type-checked environment. Module boundaries must be physically enforced through directory structure and import lint rules.

##### Required Inputs

- `package.json` (existing)
- `tsconfig.json` (existing — may need path aliases)
- `vitest.config.ts` (existing)
- `biome.json` (existing)

##### Relevant Docs

- `architecture/03-module-boundaries.md`
- `architecture/10-local-development-and-deployment.md`
- `architecture/11-architecture-decision-records.md`

##### Tasks

1. Define target module directory structure under `src/`:
   ```
   src/
     contracts/
     state-engine/
     conversation-runtime/
     application/
     prompt-orchestration/
     llm/
     validation/
     materialization/
     persistence/
     profiles/
     tui/
     diagnostics/
     outputs/
     shared/         # (existing utilities: Result, Brand, id, date, errors)
   ```
2. Configure TypeScript path aliases (`@logos/state-engine`, `@logos/conversation-runtime`, etc.) in `tsconfig.json`.
3. Verify `pnpm typecheck` passes on the skeleton.
4. Add architecture boundary tests (or eslint-plugin-import rules) that prevent forbidden cross-module imports.
5. Create `.gitkeep` files in empty directories to preserve structure.
6. Add `pnpm check` script: typecheck + lint + test.
7. Create ADR directory at `docs/architecture/adr/` and draft first 12 ADRs as stubs.

##### Files / Areas Likely Affected

- `tsconfig.json`
- `package.json`
- `src/` — new directory structure
- `docs/architecture/adr/` — new ADR files

##### Acceptance Criteria

- `pnpm typecheck` passes on the new skeleton.
- Import boundary tests detect TUI importing LLM adapter directly.
- All module directories exist and are under version control.
- 12 ADR stubs exist documenting the core architecture decisions.

##### Tests / Validation

- `pnpm typecheck`
- Architecture boundary unit test (verify import violations fail)
- Manual: `ls src/*/` shows all module directories

##### Dependencies

- None (first step)

##### Notes

- **Fact:** The existing codebase has a working `src/` structure with CLI, TUI, LLM, core, interview, etc. This step does not delete existing code; it establishes the target structure alongside or as a migration path.
- **Decision:** Maintain backward compatibility with existing code during phase 0. New code follows the new module structure; existing code can be gradually migrated.

---

#### Step 0.2 — Define shared primitives and utility types

##### Objective

Define foundational types and utilities that all modules depend on: `Result<T, E>`, `Brand<T, B>`, ID generation, date utilities, invariant checks, and the `LogosError` base class.

##### Why This Step Exists

These types are the "standard library" of the LOGOS Engine. Every module will use `Result`, branded IDs, and invariants. Defining them first prevents duplication and inconsistent error handling.

##### Required Inputs

- Architecture documents that reference `Result` and `Brand` patterns.
- Existing `src/shared/` code.

##### Relevant Docs

- `architecture/08-error-handling-and-recovery.md`
- `architecture/03-module-boundaries.md`

##### Tasks

1. Audit existing `src/shared/` code (`Result.ts`, `Brand.ts`, `id.ts`, `date.ts`, `invariant.ts`, `LogosError.ts`).
2. Ensure `Result<T, E>` is a discriminated union with `ok: true` / `ok: false`.
3. Define branded types for domain IDs: `NodeId`, `DocumentId`, `SessionId`, `ProfileId`, `PromptId`.
4. Define `LogosError` base class with `code`, `category`, `recoverable`, `userFacingMessage`, `details`.
5. Ensure `invariant(condition, message)` throws `LogosError`.
6. Ensure `generateId()` produces stable, sortable IDs.
7. Export all shared types from `src/shared/index.ts`.

##### Files / Areas Likely Affected

- `src/shared/types/Result.ts`
- `src/shared/types/Brand.ts`
- `src/shared/utils/id.ts`
- `src/shared/utils/date.ts`
- `src/shared/errors/LogosError.ts`
- `src/shared/errors/invariant.ts`
- `src/shared/index.ts`

##### Acceptance Criteria

- `Result` type is a proper discriminated union.
- `NodeId`, `DocumentId`, etc. are distinct branded string types (not assignable to each other).
- `invariant` throws `LogosError` with code and category.
- `generateId()` returns non-colliding, lexicographically sortable strings.
- Unit tests cover all primitives.

##### Tests / Validation

- Unit tests for `Result` construction and narrowing.
- Unit tests for `Brand` type identity (TypeScript-level).
- Unit tests for `invariant` throwing behavior.
- Unit tests for `generateId` uniqueness and sortability.
- Unit tests for `LogosError` property access.

##### Dependencies

- Step 0.1 — Project structure

---

#### Step 0.3 — Establish development gates and CI baseline

##### Objective

Configure pre-commit hooks, CI scripts, and quality gates that enforce architecture boundaries, type safety, and test coverage from day one.

##### Why This Step Exists

Architecture drift is the primary risk. Catching boundary violations at commit time prevents the codebase from becoming entangled as it grows.

##### Required Inputs

- `package.json` scripts
- `biome.json`
- `vitest.config.ts`

##### Relevant Docs

- `architecture/09-testing-architecture.md`
- `architecture/10-local-development-and-deployment.md`
- `architecture/11-architecture-decision-records.md`

##### Tasks

1. Add `pnpm check` script: `pnpm typecheck && pnpm lint && pnpm test`.
2. Configure Vitest with coverage thresholds (aim for ≥80% on state engine, ≥60% overall initially).
3. Add `pnpm lint:boundaries` script using dependency-cruiser or eslint-plugin-import to enforce module boundary rules.
4. Document the quality gate in `CONTRIBUTING.md`.
5. Verify `pnpm check` passes on the baseline code.
6. Add a `pnpm check:ci` script that runs in CI with stricter settings.

##### Files / Areas Likely Affected

- `package.json` (scripts)
- `vitest.config.ts`
- `biome.json`
- `.github/workflows/` (if CI configs exist)
- `CONTRIBUTING.md`

##### Acceptance Criteria

- `pnpm check` passes on the Phase 0 baseline.
- Boundary lint catches `tui/` importing from `llm/provider.ts` directly.
- Coverage reports are generated.
- Pre-commit hook or CI step runs `pnpm check`.

##### Tests / Validation

- Verify boundary lint rule catches a deliberate violation.
- `pnpm check` exits 0 on clean code, non-zero on type/lint/test failure.

##### Dependencies

- Step 0.1 — Project structure
- Step 0.2 — Shared primitives

---

### Phase 1 — Core Types, Schemas, and Contracts

#### Step 1.1 — Define LogosProfile and node definition types

##### Objective

Define the TypeScript types for `LogosProfile`, `PhaseDefinition`, `DocumentDefinition`, `NodeDefinition`, and `DocumentMaterializationRule`. These types define the structural map that the runtime navigates.

##### Why This Step Exists

The state engine, sidebar, prompt orchestrator, and materializer all depend on profile/node definitions. Without these types, nothing can reference profile structure.

##### Required Inputs

- `10-profile-and-node-schema-spec.md` — canonical types
- Existing profile YAML files under `profiles/standard/`

##### Relevant Docs

- `10-profile-and-node-schema-spec.md`
- `architecture/07-contracts-and-schemas.md`

##### Tasks

1. Create `src/contracts/profile.ts` with:
   ```ts
   type LogosProfile = {
     id: ProfileId
     title: string
     description?: string
     version: string
     phases: PhaseDefinition[]
     documents: DocumentDefinition[]
     nodes: NodeDefinition[]
     materializationRules: DocumentMaterializationRule[]
   }
   ```
2. Define `PhaseDefinition` with `id`, `title`, `order`, `purpose`.
3. Define `DocumentDefinition` with `id`, `phaseId`, `title`, `order`, `purpose`, `outputPath`, `requiredNodeIds`, `optionalNodeIds`.
4. Define `NodeDefinition` with `id`, `phaseId`, `documentId`, `title`, `order`, `canonicalQuestion`, `coverageTopics`, `sufficiencyCriteria`, `dependencies`, `promptRefs`, `outputSchemaRef`.
5. Define `DocumentMaterializationRule` with `documentId`, `title`, `outputPath`, `sourceNodeIds`, `requiredNodeIds`, `optionalNodeIds`, `sections`.
6. Export all types with branded IDs.

##### Files / Areas Likely Affected

- `src/contracts/profile.ts` (new)
- `src/contracts/index.ts` (new)

##### Acceptance Criteria

- `LogosProfile` matches the shape defined in `10-profile-and-node-schema-spec.md`.
- A hand-constructed TypeScript object representing the "Startup" profile (from `13-prototypes.md` wireframes) type-checks.
- `NodeId` and `DocumentId` are distinct branded types; passing a `NodeId` where a `DocumentId` is expected causes a compile error.

##### Tests / Validation

- TypeScript compilation test: construct a minimal valid profile object.
- Branded type test: verify `NodeId` ≠ `DocumentId` at the type level.

##### Dependencies

- Step 0.2 — Shared primitives (branded IDs)

---

#### Step 1.2 — Define LogosRuntimeState and NodeRuntimeState types

##### Objective

Define the full runtime state types: `LogosRuntimeState`, `NodeRuntimeState`, `NodeLifecycle`, `PromptState`, `CanonicalAnswer`, `CompletenessState`, and `ExtractedNodeData`.

##### Why This Step Exists

These are the most referenced types in the system. The state engine, application layer, persistence, and TUI all depend on them.

##### Required Inputs

- `02-state-engine-canonical-spec.md` — `LogosRuntimeState`, session modes
- `04-node-lifecycle-and-question-state.md` — `NodeRuntimeState`, lifecycles
- `11-conversation-quality-and-completeness.md` — `CompletenessState`

##### Relevant Docs

- `02-state-engine-canonical-spec.md`
- `03-conversation-runtime-spec.md`
- `04-node-lifecycle-and-question-state.md`
- `11-conversation-quality-and-completeness.md`
- `architecture/07-contracts-and-schemas.md`

##### Tasks

1. Create `src/contracts/runtime-state.ts` with:
   - `SessionMode` union: `"idle" | "profile_selection" | "structure_overview" | "node_focus" | "document_preview" | "export" | "settings" | "error"`
   - `LogosRuntimeState` with all fields as specified in `02-state-engine-canonical-spec.md` §4.
   - `GlobalContext` with project name, summary, preferences.

2. Create `src/contracts/node-state.ts` with:
   - `NodeLifecycle` union: `"not_started" | "active" | "answered" | "needs_clarification" | "needs_refinement" | "ready_for_synthesis" | "synthesized" | "accepted" | "deferred" | "blocked"`
   - `PromptState` union: `"initial" | "follow_up" | "clarification" | "refinement" | "synthesis" | "review" | "repair" | "blocked" | "accepted"`
   - `NodeRuntimeState` with all fields.
   - `NodeAction` union: `"answer" | "accept" | "edit" | "regenerate" | "defer" | "reopen" | "skip" | "continue_next" | "mark_as_assumption" | "mark_as_decision" | "open_prerequisite" | "open_document_preview" | "ask_for_example" | "resume"`
   - `NodeDependencyState` with `requiredNodeIds`, `blockedBy`, `unlocks`.

3. Create `src/contracts/canonical-answer.ts` with `CanonicalAnswer` and `CanonicalAnswerDraft` types.

4. Create `src/contracts/completeness.ts` with `CompletenessState` and `ExtractedNodeData`.

##### Files / Areas Likely Affected

- `src/contracts/runtime-state.ts` (new)
- `src/contracts/node-state.ts` (new)
- `src/contracts/canonical-answer.ts` (new)
- `src/contracts/completeness.ts` (new)
- `src/contracts/index.ts`

##### Acceptance Criteria

- `LogosRuntimeState` has all required fields: `sessionId`, `selectedProfileId`, `activeNodeId`, `mode`, `nodeStates`, `documentStates`, `exportState`, `globalContext`, `lastActiveNodeId`, `updatedAt`.
- `NodeRuntimeState` has `nodeId`, `lifecycle`, `conversation`, `canonicalAnswer`, `completeness`, `extracted`, `promptState`, `allowedActions`, `dependencies`, `updatedAt`.
- `NodeLifecycle` includes all 10 states.
- `NodeAction` includes all 14 allowed actions.

##### Tests / Validation

- TypeScript compilation: construct a minimal valid `LogosRuntimeState` with an empty session.
- Type narrowing: verify that `lifecycle === "accepted"` narrows the type correctly.
- Schema validation: verify that each lifecycle has a defined set of mapped actions (refer to `13-prototypes.md` §1.6).

##### Dependencies

- Step 1.1 — Profile types (for `NodeId`, `DocumentId`, `ProfileId`)

---

#### Step 1.3 — Define NodeMessage, AgentTurnOutput, and conversation contracts

##### Objective

Define the message model, conversation model, and the structured AgentTurnOutput contract that the LLM must produce.

##### Why This Step Exists

Messages are the raw material of conversations. `AgentTurnOutput` is the bridge between LLM generation and state engine application. Both must be precisely typed before any runtime code is written.

##### Required Inputs

- `03-conversation-runtime-spec.md`
- `06-agent-turn-contract.md`

##### Relevant Docs

- `03-conversation-runtime-spec.md`
- `06-agent-turn-contract.md`
- `architecture/07-contracts-and-schemas.md`

##### Tasks

1. Create `src/contracts/conversation.ts` with:
   - `NodeMessage` with `id`, `role`, `content`, `createdAt`, `metadata?`.
   - `NodeMessageMetadata` with `promptId?`, `promptState?`, `model?`, `structuredOutputId?`, `stateBefore?`, `stateAfter?`.
   - `NodeConversation` with `nodeId`, `messages`, `summary?`, `lastUserMessageId?`, `lastAssistantMessageId?`.

2. Create `src/contracts/agent-turn.ts` with:
   - `AgentTurnOutput` with `userFacingMessage`, `proposedLifecycle?`, `proposedPromptState?`, `canonicalAnswerDraft?`, `completenessEvaluation?`, `extracted?`, `suggestedActions?`, `transitionIntent?`, `diagnostics?`.
   - `TransitionIntent` with `event` (union of transition event names) and `reason`.
   - `AgentDiagnostic` type.

3. Ensure `AgentTurnOutput` fields reference existing types: `NodeLifecycle`, `PromptState`, `CanonicalAnswerDraft`, `CompletenessState`, `ExtractedNodeData`, `NodeAction`.

##### Files / Areas Likely Affected

- `src/contracts/conversation.ts` (new)
- `src/contracts/agent-turn.ts` (new)
- `src/contracts/index.ts`

##### Acceptance Criteria

- `NodeMessage.role` is `"user" | "assistant" | "system"`.
- `AgentTurnOutput.userFacingMessage` is required (must be non-empty for valid output).
- `AgentTurnOutput.proposedLifecycle` is constrained to `NodeLifecycle` values.
- `TransitionIntent.event` covers all lifecycle-related events.

##### Tests / Validation

- TypeScript compilation: construct valid and invalid `AgentTurnOutput` objects.
- Schema validation test: verify that an `AgentTurnOutput` with empty `userFacingMessage` is rejected by a validation function (defined later, but type should support detection).

##### Dependencies

- Step 1.2 — Runtime state types

---

#### Step 1.4 — Define DocumentRuntimeState, ExportRuntimeState, and materialization contracts

##### Objective

Define types for document runtime state, export state, materialized document drafts, and generated artifacts.

##### Why This Step Exists

Document materialization is a core output path. The document state model defines readiness, staleness, and export eligibility — concepts referenced by the state engine and TUI.

##### Required Inputs

- `07-document-materialization-spec.md`
- `09-session-events-and-persistence.md`

##### Relevant Docs

- `07-document-materialization-spec.md`
- `architecture/04-data-and-persistence-architecture.md`
- `architecture/07-contracts-and-schemas.md`

##### Tasks

1. Create `src/contracts/document-state.ts` with:
   - `DocumentStatus` union: `"not_ready" | "partially_ready" | "ready" | "drafted" | "accepted" | "stale"`
   - `DocumentRuntimeState` with `documentId`, `status`, `sourceNodeIds`, `requiredNodeIds`, `optionalNodeIds`, `missingRequiredNodeIds`, `staleSourceNodeIds`, `draft`, `updatedAt`.
   - `MaterializedDocumentDraft` with `documentId`, `content`, `format`, `generatedAt`, `sourceNodeIds`, `missingSections`, `stale`.
   - `DocumentSectionRule` with `sectionId`, `title`, `sourceNodeIds`, `required`.

2. Create `src/contracts/export-state.ts` with:
   - `ExportRuntimeState` type.
   - `GeneratedArtifact` with `id`, `sessionId`, `type`, `path`, `sourceDocumentIds`, `sourceNodeIds`, `generatedAt`, `stale`.

##### Files / Areas Likely Affected

- `src/contracts/document-state.ts` (new)
- `src/contracts/export-state.ts` (new)
- `src/contracts/index.ts`

##### Acceptance Criteria

- `DocumentRuntimeState.status` correctly represents the 6 states.
- `missingRequiredNodeIds` is typed as `NodeId[]`.
- `MaterializedDocumentDraft.stale` is a boolean flag.
- `GeneratedArtifact.type` is `"markdown" | "html" | "agent_pack"`.

##### Tests / Validation

- TypeScript compilation: construct a valid `DocumentRuntimeState` for a partially-ready document.
- Verify discriminated union behavior on `DocumentStatus`.

##### Dependencies

- Step 1.1 — Profile types (for `DocumentId`, `NodeId`)
- Step 1.2 — Runtime state types

---

#### Step 1.5 — Define render snapshot, session event, and persistence contracts

##### Objective

Define the contracts for TUI render snapshots, session events, and persisted data models.

##### Why This Step Exists

The TUI must receive a fully-specified render snapshot. Persistence needs typed event payloads and snapshot shapes. These contracts complete the type system.

##### Required Inputs

- `08-tui-state-and-rendering-contract.md`
- `09-session-events-and-persistence.md`
- `architecture/06-tui-rendering-architecture.md`

##### Relevant Docs

- `08-tui-state-and-rendering-contract.md`
- `09-session-events-and-persistence.md`
- `architecture/06-tui-rendering-architecture.md`
- `architecture/04-data-and-persistence-architecture.md`
- `architecture/07-contracts-and-schemas.md`

##### Tasks

1. Create `src/contracts/render-snapshot.ts` with:
   - `TuiRenderSnapshot` (or `StateEngineSnapshot`) with `mode`, `sidebar`, `mainPanel`, `actionBar`/`allowedActions`, `input`, `diagnostics`.
   - `SidebarRenderModel` with `profileTitle?`, `phases` (array of `SidebarPhase`), `activeNodeId`.
   - `SidebarPhase` → `SidebarDocument` → `SidebarNode` with `nodeId`, `title`, `statusSymbol`, `selected`, `disabled`, `reasonIfDisabled?`.
   - `MainPanelRenderModel` as a discriminated union: `IdlePanel | ProfilePanel | NodeConversationPanel | DocumentPreviewPanel | ExportPanel | SettingsPanel | ErrorPanel`.
   - `ActionBarRenderModel` with `actions` array.
   - `InputRenderModel` with `enabled`, `placeholder?`, `submitAction?`, `reasonIfDisabled?`.

2. Create `src/contracts/session-event.ts` with:
   - `SessionEventType` union: all event types from `09-session-events-and-persistence.md` §6.
   - `SessionEvent` with `id`, `sessionId`, `type`, `payload`, `createdAt`.
   - Typed payloads for each event type (e.g., `UserMessageAddedEvent`, `CanonicalAnswerAcceptedEvent`).

3. Create `src/contracts/persistence.ts` with:
   - `SessionSnapshot` with `sessionId`, `schemaVersion`, `runtimeState`, `savedAt`.
   - `PersistedSession` with `schemaVersion`, `sessionId`, `snapshot`, `events`.
   - `Migration` type with `from`, `to`, `migrate` function.

##### Files / Areas Likely Affected

- `src/contracts/render-snapshot.ts` (new)
- `src/contracts/session-event.ts` (new)
- `src/contracts/persistence.ts` (new)
- `src/contracts/index.ts`

##### Acceptance Criteria

- `TuiRenderSnapshot` contains all information needed to render any screen.
- `SessionEventType` covers all 17+ event types from the spec.
- Each event payload is typed (not `unknown` at the type level).
- `PersistedSession.schemaVersion` is a required string field.

##### Tests / Validation

- TypeScript compilation: construct all render snapshot variants.
- Type narrowing: verify `mainPanel` discriminated union works correctly.

##### Dependencies

- Step 1.2 — Runtime state types
- Step 1.4 — Document/export state types

---

### Phase 2 — Profile and Node Definition Loading

#### Step 2.1 — Implement profile YAML loader with schema validation

##### Objective

Implement a module that loads profile YAML/JSON files, validates them against the `LogosProfile` schema, and returns a typed result.

##### Why This Step Exists

Before the state engine can initialize, it needs valid profile data. The loader is a prerequisite for profile selection, sidebar rendering, and node resolution.

##### Required Inputs

- `10-profile-and-node-schema-spec.md`
- Existing profile YAML files under `profiles/standard/`
- Contract types from Step 1.1

##### Relevant Docs

- `10-profile-and-node-schema-spec.md`
- `architecture/07-contracts-and-schemas.md`
- `architecture/10-local-development-and-deployment.md`

##### Tasks

1. Create `src/profiles/profile-loader.ts`:
   - `loadProfile(path: string): Result<LogosProfile, LoadError>`
   - Reads YAML/JSON, parses, validates structure.
   - Validates that all `NodeDefinition.documentId` references exist in `documents[]`.
   - Validates that `DocumentMaterializationRule.sourceNodeIds` reference existing nodes.
   - Validates that `requiredNodeIds` and `optionalNodeIds` are subsets of `sourceNodeIds`.
2. Create `src/profiles/profile-registry.ts`:
   - `listProfiles(): ProfileId[]` — scans profile directory.
   - `getProfile(id: ProfileId): Result<LogosProfile, LoadError>`
3. Handle errors: missing files, invalid YAML, schema violations, missing references.

##### Files / Areas Likely Affected

- `src/profiles/profile-loader.ts` (new)
- `src/profiles/profile-registry.ts` (new)
- `src/profiles/index.ts` (new)

##### Acceptance Criteria

- A valid YAML profile loads without errors and type-checks as `LogosProfile`.
- A profile with missing node references returns a descriptive error.
- `listProfiles()` returns available profile IDs.
- Loading a non-existent profile returns an error, not a throw.

##### Tests / Validation

- Unit test: load a minimal valid YAML profile fixture.
- Unit test: load profile with invalid YAML → error.
- Unit test: load profile with broken cross-references → error.
- Unit test: `listProfiles()` with mock filesystem.

##### Dependencies

- Step 1.1 — Profile types

---

#### Step 2.2 — Implement node resolution and dependency graph from profile

##### Objective

Given a loaded `LogosProfile`, compute the dependency graph: which nodes depend on which, which nodes are unlocked by which, and the topological order.

##### Why This Step Exists

The state engine needs to know node dependencies to determine blocked states, recommend next nodes, and validate prerequisite chains. The sidebar needs the tree structure.

##### Required Inputs

- `04-node-lifecycle-and-question-state.md` §10 — `NodeDependencyState`
- `10-profile-and-node-schema-spec.md` §6 — `NodeDefinition.dependencies`

##### Relevant Docs

- `04-node-lifecycle-and-question-state.md`
- `10-profile-and-node-schema-spec.md`
- `13-prototypes.md` — Flow F (Blocked Node)

##### Tasks

1. Create `src/profiles/dependency-graph.ts`:
   - `buildDependencyGraph(profile: LogosProfile): NodeDependencyGraph`
   - `getDependencies(nodeId: NodeId): NodeId[]`
   - `getDependents(nodeId: NodeId): NodeId[]`
   - `getTopologicalOrder(): NodeId[]`
   - `detectCycles(): NodeId[][]` — return any circular dependency chains.
2. Create `src/profiles/node-tree.ts`:
   - `buildNodeTree(profile: LogosProfile): NodeTree` — nested `Phase → Document → Node` structure.
   - Used by the sidebar render model.

##### Files / Areas Likely Affected

- `src/profiles/dependency-graph.ts` (new)
- `src/profiles/node-tree.ts` (new)

##### Acceptance Criteria

- Dependency graph correctly resolves `requiredNodeIds` and `recommendedNodeIds`.
- Circular dependencies are detected and reported.
- Topological order respects dependency constraints.
- Node tree preserves phase/document grouping from profile.

##### Tests / Validation

- Unit test: simple linear dependency chain.
- Unit test: node with multiple prerequisites.
- Unit test: node that unlocks multiple dependents.
- Unit test: circular dependency detection.
- Unit test: cycle-free graph returns empty cycles array.

##### Dependencies

- Step 2.1 — Profile loader

---

### Phase 3 — Deterministic State Engine

#### Step 3.1 — Implement session initialization and profile selection

##### Objective

Implement the state engine operations to initialize a new session, set the selected profile, and compute the resulting `SessionMode`.

##### Why This Step Exists

Session initialization is the entry point for all runtime behavior. The state engine must produce a valid initial state before any other operation.

##### Required Inputs

- `02-state-engine-canonical-spec.md` §4-5
- Contract types from Phase 1

##### Relevant Docs

- `02-state-engine-canonical-spec.md`
- `architecture/02-runtime-architecture.md`

##### Tasks

1. Create `src/state-engine/state-engine.ts`:
   - `createSession(): LogosRuntimeState` — returns an `idle` session with `activeNodeId: null` and `selectedProfileId: null`.
   - `selectProfile(state, profileId): StateEngineResult` — sets `selectedProfileId`, loads profile structure, transitions mode to `structure_overview`.
   - `changeProfile(state, profileId): StateEngineResult` — replaces profile, resets node states.
   - Guard: cannot select a profile if none exists.
   - Guard: cannot select a node without a selected profile.
2. Implement `StateEngineResult` as `{ ok: true; state: LogosRuntimeState } | { ok: false; error: string; diagnostics: StateDiagnostic[] }`.
3. Create `StateEngineEvent` union for all events (reuse from `LogosEvent` in prototypes).

##### Files / Areas Likely Affected

- `src/state-engine/state-engine.ts` (new)
- `src/state-engine/types.ts` (new)
- `src/state-engine/index.ts` (new)

##### Acceptance Criteria

- `createSession()` returns `mode: "idle"`, `activeNodeId: null`, `selectedProfileId: null`.
- After `selectProfile`, `mode` is `"structure_overview"` and `selectedProfileId` is set.
- Selecting a node without a selected profile returns an error.
- State engine is a pure function (or returns new state, doesn't mutate input).

##### Tests / Validation

- Unit test: `createSession()` produces valid initial state.
- Unit test: `selectProfile` with valid profile ID.
- Unit test: `selectProfile` with invalid profile ID → error.
- Unit test: attempting `selectNode` before `selectProfile` → error.

##### Dependencies

- Step 1.2 — Runtime state types
- Step 2.1 — Profile loader

---

#### Step 3.2 — Implement active node mode resolution

##### Objective

Implement the runtime rule that determines whether the session is in structural mode or node-focused mode based on `activeNodeId`.

##### Why This Step Exists

The entire TUI behavior depends on the active node switch. If this rule is ambiguous, the renderer will become stateful and violate the architecture.

##### Required Inputs

- `02-state-engine-canonical-spec.md` §6
- `LogosRuntimeState`

##### Relevant Docs

- `02-state-engine-canonical-spec.md`
- `08-tui-state-and-rendering-contract.md`
- `architecture/02-runtime-architecture.md`
- `architecture/03-module-boundaries.md`

##### Tasks

1. Create `src/state-engine/session-mode.ts`:
   - `resolveSessionMode(state: LogosRuntimeState): SessionMode`
   - Return `"idle"` when `selectedProfileId === null` and `activeNodeId === null`.
   - Return `"structure_overview"` when `selectedProfileId !== null` and `activeNodeId === null`.
   - Return `"node_focus"` when `activeNodeId !== null` (after validation).
   - Validate that `activeNodeId` exists in the profile's node definitions.
   - If `activeNodeId` is invalid, return `"error"` mode with a diagnostic.
2. This function must be pure and deterministic (no side effects).

##### Files / Areas Likely Affected

- `src/state-engine/session-mode.ts` (new)
- `src/state-engine/state-engine.ts` (update)

##### Acceptance Criteria

- Mode resolution is pure and deterministic.
- Invalid active node does not crash the runtime; enters `error` mode.
- TUI does not implement independent mode logic — it reads `state.mode`.

##### Tests / Validation

- Unit test: idle mode (no profile, no node).
- Unit test: structure overview mode (profile, no node).
- Unit test: node focus mode (profile + valid activeNodeId).
- Unit test: error mode (profile + invalid activeNodeId).
- Unit test: mode transitions when profile is changed.

##### Dependencies

- Step 3.1 — Session initialization

---

#### Step 3.3 — Implement node selection and deselection

##### Objective

Implement node selection (setting `activeNodeId`) with all guards: node must exist in profile, must not be blocked by unmet dependencies (unless explicitly navigating to blocked node), and must initialize node state if first access.

##### Why This Step Exists

Node selection is the primary navigation action. It must correctly handle blocked nodes, preserve existing node state, and recompute session mode.

##### Required Inputs

- `02-state-engine-canonical-spec.md` §7
- `04-node-lifecycle-and-question-state.md` §10 — dependency state

##### Relevant Docs

- `02-state-engine-canonical-spec.md`
- `04-node-lifecycle-and-question-state.md`
- `13-prototypes.md` — Flow C (sidebar navigation), Flow F (blocked node)

##### Tasks

1. Create `src/state-engine/node-selection.ts`:
   - `selectNode(state, nodeId): StateEngineResult`
   - Guard: profile must be selected.
   - Guard: node must exist in profile.
   - Guard: check dependencies — if blocked, transition node to `blocked` lifecycle (but still allow navigation).
   - If node has no runtime state yet, initialize `NodeRuntimeState` with `lifecycle: "not_started"`.
   - If node already has runtime state, preserve conversation and lifecycle.
   - Set `lastActiveNodeId` to previous `activeNodeId` before changing.
   - Set `activeNodeId` to the new node.
   - Recompute `mode` via `resolveSessionMode`.
2. Implement `deselectNode(state): StateEngineResult`:
   - Sets `activeNodeId` to `null`.
   - Mode returns to `structure_overview`.
   - Current node state is preserved.

##### Files / Areas Likely Affected

- `src/state-engine/node-selection.ts` (new)
- `src/state-engine/state-engine.ts` (update)

##### Acceptance Criteria

- First selection of a node initializes `NodeRuntimeState.lifecycle` as `"not_started"`.
- Re-selection of a previously worked node preserves its full state.
- Blocked nodes are navigable but open in `blocked` lifecycle.
- Deselection sets `mode` to `structure_overview` and preserves node state.
- `lastActiveNodeId` is updated correctly on navigation.

##### Tests / Validation

- Unit test: select node for first time → `not_started`.
- Unit test: select node, work on it, navigate away, navigate back → state preserved.
- Unit test: select node with unmet dependencies → opens as `blocked`.
- Unit test: deselect → returns to `structure_overview`.
- Unit test: select non-existent node → error.

##### Dependencies

- Step 3.2 — Mode resolution
- Step 2.2 — Dependency graph

---

#### Step 3.4 — Implement node lifecycle transition validation

##### Objective

Implement the complete lifecycle state machine: validate every possible transition, reject invalid ones, and apply valid ones.

##### Why This Step Exists

Lifecycle transitions are the core of the state engine. Every allowed action, prompt state, and document readiness evaluation depends on the current lifecycle. Invalid transitions must be rejected before they corrupt state.

##### Required Inputs

- `04-node-lifecycle-and-question-state.md` §6-7 — valid and invalid transitions
- `13-prototypes.md` §1.2 — lifecycle transition matrix

##### Relevant Docs

- `04-node-lifecycle-and-question-state.md`
- `02-state-engine-canonical-spec.md`
- `13-prototypes.md` Part 1 (State Inventory)

##### Tasks

1. Create `src/state-engine/node-lifecycle.ts`:
   - `isValidTransition(from: NodeLifecycle, to: NodeLifecycle): boolean`
   - `applyLifecycleTransition(state, nodeId, newLifecycle): StateEngineResult`
   - Define the complete transition matrix as a lookup table.
2. Valid transitions (from spec):
   ```
   not_started → active
   active → answered, needs_clarification, needs_refinement, ready_for_synthesis
   answered → needs_clarification, needs_refinement, ready_for_synthesis
   needs_clarification → active, deferred
   needs_refinement → active, deferred, ready_for_synthesis
   ready_for_synthesis → synthesized
   synthesized → accepted, active (reopen/edit), deferred
   accepted → active (reopen)
   any non-final → deferred
   any non-final → blocked
   blocked → active (when blocker resolved), not_started (auto-resolve)
   ```
3. Invalid transitions that must be rejected:
   ```
   not_started → accepted
   needs_clarification → accepted
   needs_refinement → accepted
   blocked → accepted (without resolving dependency)
   accepted → synthesized (without reopen)
   synthesized → document export (without acceptance)
   ```

##### Files / Areas Likely Affected

- `src/state-engine/node-lifecycle.ts` (new)
- `src/state-engine/state-engine.ts` (update)

##### Acceptance Criteria

- All valid transitions from the spec are accepted.
- All invalid transitions are rejected with descriptive errors.
- Transition application updates `node.lifecycle`, `updatedAt`, and recomputes `allowedActions`.
- Guard: lifecycle transition must be paired with the correct event/intent.

##### Tests / Validation

- **Transition matrix test:** For every combination of `from × to`, verify expected validity.
- Unit test: `not_started → active` succeeds.
- Unit test: `not_started → accepted` fails.
- Unit test: `synthesized → accepted` succeeds.
- Unit test: `synthesized → export` (without accept) fails.
- Unit test: `blocked → accepted` fails.

##### Dependencies

- Step 3.3 — Node selection

---

#### Step 3.5 — Implement allowed actions computation

##### Objective

Given a node's lifecycle, compute the set of allowed `NodeAction` values. This is a pure function with no side effects.

##### Why This Step Exists

The TUI must render only actions approved by the state engine. Hardcoding action-to-lifecycle rules in render components would violate the architecture.

##### Required Inputs

- `04-node-lifecycle-and-question-state.md` §8 — allowed actions by lifecycle
- `13-prototypes.md` §1.6 and Appendix A — action-label mapping

##### Relevant Docs

- `04-node-lifecycle-and-question-state.md`
- `08-tui-state-and-rendering-contract.md`
- `13-prototypes.md` §1.6

##### Tasks

1. Create `src/state-engine/allowed-actions.ts`:
   - `getAllowedActions(lifecycle: NodeLifecycle): NodeAction[]`
   - Pure function mapping lifecycle to action set.
2. Action map:
   ```
   not_started → [answer, skip, ask_for_example]
   active → [answer, defer, mark_as_assumption, mark_as_decision]
   answered → [answer, defer, mark_as_assumption, mark_as_decision]
   needs_clarification → [answer, defer, open_prerequisite]
   needs_refinement → [answer, defer, ask_for_example]
   ready_for_synthesis → []  (automatic transition)
   synthesized → [accept, edit, regenerate, defer, reopen]
   accepted → [continue_next, reopen, open_document_preview]
   deferred → [resume, continue_next]
   blocked → [open_prerequisite, defer]
   ```
3. Create `isActionAllowed(lifecycle, action): boolean`.

##### Files / Areas Likely Affected

- `src/state-engine/allowed-actions.ts` (new)

##### Acceptance Criteria

- Every lifecycle returns a non-overlapping, correct set of actions.
- `accept` is only available in `synthesized` state.
- `reopen` is available in `synthesized` and `accepted`.
- `continue_next` is available in `accepted` and `deferred`.

##### Tests / Validation

- Unit test: verify action set for each lifecycle state.
- Unit test: verify `accept` is NOT in `active` action set.
- Unit test: verify `answer` is in `not_started`, `active`, `answered`, `needs_clarification`, `needs_refinement`.

##### Dependencies

- Step 1.2 — `NodeAction` and `NodeLifecycle` types

---

#### Step 3.6 — Implement completeness evaluation

##### Objective

Implement the logic that evaluates whether a node's conversation has produced sufficient quality to synthesize a canonical answer.

##### Why This Step Exists

Completeness evaluation determines when `answered` can transition to `ready_for_synthesis`, and when `ready_for_synthesis` has sufficient coverage. Without it, the engine cannot decide when to synthesize.

##### Required Inputs

- `11-conversation-quality-and-completeness.md`
- `04-node-lifecycle-and-question-state.md` §9

##### Relevant Docs

- `11-conversation-quality-and-completeness.md`
- `04-node-lifecycle-and-question-state.md`
- `06-agent-turn-contract.md` §7

##### Tasks

1. Create `src/state-engine/completeness.ts`:
   - `evaluateCompleteness(nodeState: NodeRuntimeState, nodeDef: NodeDefinition): CompletenessState`
   - For each `coverageTopic` in `nodeDef`, evaluate as `"missing" | "weak" | "sufficient"`.
   - A topic is `"missing"` if not addressed at all.
   - A topic is `"weak"` if addressed vaguely or generically.
   - A topic is `"sufficient"` if addressed with specificity.
   - `complete` is `true` only when all required topics are `"sufficient"` and there are no `blockingIssues`.
2. Implement specificity heuristics:
   - Generic claims → weak
   - Vague value propositions → weak
   - Undefined problem → weak
   - Solution language without reasoning → weak
3. Contradiction detection: flag contradictory statements as `blockingIssues`.
4. Initially, this function may use simple heuristics (keyword matching, length checks). The LLM-assisted evaluation (via `CompletenessState` in `AgentTurnOutput`) will enhance accuracy in later phases.

##### Files / Areas Likely Affected

- `src/state-engine/completeness.ts` (new)
- `src/state-engine/state-engine.ts` (update — use completeness in transition guards)

##### Acceptance Criteria

- Empty conversation → all topics `"missing"`, `complete: false`.
- Conversation covers all topics with specific content → all topics `"sufficient"`, `complete: true`.
- Contradictory statements generate `blockingIssues`.
- `ready_for_synthesis` transition guard uses completeness check.

##### Tests / Validation

- Unit test: empty node → not complete.
- Unit test: complete coverage → `complete: true`.
- Unit test: missing one topic → `complete: false` with topic listed in `missing`.
- Unit test: contradiction → `blockingIssues` populated.
- Call `evaluateCompleteness` from transition guard: verify `answered → ready_for_synthesis` is blocked when incomplete.

##### Dependencies

- Step 3.4 — Lifecycle transitions

---

#### Step 3.7 — Implement document readiness computation

##### Objective

Implement the function that evaluates whether a document is ready for materialization, partially ready, or not ready, given the state of its source nodes.

##### Why This Step Exists

Document readiness gates materialization and export. The sidebar and document preview panel depend on this evaluation.

##### Required Inputs

- `07-document-materialization-spec.md` §5
- `13-prototypes.md` §1.4 — document states

##### Relevant Docs

- `07-document-materialization-spec.md`
- `02-state-engine-canonical-spec.md`
- `architecture/02-runtime-architecture.md`

##### Tasks

1. Create `src/state-engine/document-readiness.ts`:
   - `computeDocumentReadiness(documentId: DocumentId, state: LogosRuntimeState, profile: LogosProfile): DocumentRuntimeState`
   - A document is `"ready"` when all `requiredNodeIds` are accepted and have non-stale canonical answers.
   - A document is `"partially_ready"` when at least one source node is accepted but some required nodes are missing.
   - A document is `"not_ready"` when no source nodes are accepted.
   - A document becomes `"stale"` when any accepted source node's canonical answer is stale.
   - Populates `missingRequiredNodeIds` and `staleSourceNodeIds`.
2. Recompute document readiness after:
   - Any node transitions to `accepted`.
   - Any node transitions from `accepted` to `active` (reopen).
   - Any canonical answer is marked stale.
   - Any canonical answer is regenerated.

##### Files / Areas Likely Affected

- `src/state-engine/document-readiness.ts` (new)
- `src/state-engine/state-engine.ts` (update — trigger recomputation)

##### Acceptance Criteria

- Document with all required nodes accepted → `ready`.
- Document with one accepted, one missing → `partially_ready`, with correct `missingRequiredNodeIds`.
- Document with no accepted nodes → `not_ready`.
- Document with stale source → `stale`.
- Readiness recomputes automatically on node state changes.

##### Tests / Validation

- Unit test: all required accepted → ready.
- Unit test: partially accepted → partially_ready.
- Unit test: none accepted → not_ready.
- Unit test: stale source → stale.
- Unit test: recomputation after accept event.

##### Dependencies

- Step 3.4 — Lifecycle transitions
- Step 3.6 — Completeness evaluation

---

#### Step 3.8 — Implement state engine event dispatch and snapshot generation

##### Objective

Wire all state engine operations into a unified `dispatch(event)` interface that takes a `LogosEvent`, applies guards and effects, and returns a `StateEngineResult` with a render snapshot.

##### Why This Step Exists

The application layer and TUI need a single entry point for all state mutations. The `dispatch` pattern ensures every mutation passes through guards and validation.

##### Required Inputs

- `02-state-engine-canonical-spec.md` §12 — `StateEngineSnapshot`
- `13-prototypes.md` Part 5 — State Engine Contract Summary

##### Relevant Docs

- `02-state-engine-canonical-spec.md`
- `13-prototypes.md` §5.1-5.4
- `architecture/02-runtime-architecture.md`

##### Tasks

1. Create `src/state-engine/dispatch.ts`:
   - `dispatch(state: LogosRuntimeState, event: LogosEvent, profile: LogosProfile): StateEngineResult`
   - Route event by `event.type` to the appropriate handler.
   - Apply guards before effects.
   - Apply effects (state changes).
   - Recompute `mode`, `allowedActions`, document readiness.
   - Generate `StateEngineSnapshot` for the TUI.
2. Implement `StateEngineSnapshot` builder:
   - `buildSnapshot(state: LogosRuntimeState, profile: LogosProfile): StateEngineSnapshot`
   - Includes `mode`, `selectedProfileId`, `activeNodeId`, `activeNodeState`, `allowedActions`, `sidebar`, `mainPanel`, `diagnostics`.
3. All state engine functions from previous steps should be callable through `dispatch`.

##### Files / Areas Likely Affected

- `src/state-engine/dispatch.ts` (new)
- `src/state-engine/snapshot-builder.ts` (new)
- `src/state-engine/index.ts` (update — export `dispatch` as primary API)

##### Acceptance Criteria

- `dispatch(state, { type: "SELECT_NODE", nodeId: "..." }, profile)` returns an updated state and snapshot.
- Invalid events (e.g., SELECT_NODE without profile) return `ok: false` with diagnostics.
- Snapshot includes all fields required for TUI rendering.
- `dispatch` is a pure function (returns new state, no side effects).

##### Tests / Validation

- Integration test: full createSession → selectProfile → selectNode → userMessage flow.
- Unit test: invalid event returns error.
- Snapshot test: verify snapshot shape matches `TuiRenderSnapshot` contract.
- Test snapshot after each major event type.

##### Dependencies

- Steps 3.1-3.7 — All state engine sub-modules

---

### Phase 4 — Node-Scoped Conversation Runtime

#### Step 4.1 — Implement message management for node conversations

##### Objective

Implement functions to append messages to a node's conversation, retrieve conversation history, and manage message metadata.

##### Why This Step Exists

Node-scoped conversations are the fundamental data container for all user and agent interactions. The state engine needs these functions to record turns.

##### Required Inputs

- `03-conversation-runtime-spec.md` §4-5
- Contract types from Step 1.3

##### Relevant Docs

- `03-conversation-runtime-spec.md`
- `13-prototypes.md`

##### Tasks

1. Create `src/conversation-runtime/messages.ts`:
   - `appendUserMessage(state, nodeId, content): StateEngineResult` — appends a user message to the node conversation.
   - `appendAssistantMessage(state, nodeId, content, metadata): StateEngineResult` — appends an assistant message with prompt state and structured output metadata.
   - `appendSystemMessage(state, nodeId, content): StateEngineResult` — appends a system message (should not be rendered as chat).
   - `getConversation(state, nodeId): NodeMessage[]` — returns all messages for a node.
   - `getRecentMessages(state, nodeId, limit: number): NodeMessage[]` — returns last N messages for context window.
2. Update `lastUserMessageId` and `lastAssistantMessageId` on append.
3. Guard: user messages can only be added in node-focused mode with `activeNodeId === nodeId`.
4. Guard: assistant messages record `promptState` and `promptId` in metadata.

##### Files / Areas Likely Affected

- `src/conversation-runtime/messages.ts` (new)
- `src/conversation-runtime/index.ts` (new)

##### Acceptance Criteria

- User messages are appended with role `"user"`, timestamp, and unique ID.
- Assistant messages include metadata: `promptId`, `promptState`, `structuredOutputId`.
- `getConversation` returns messages in chronological order.
- Appending to a non-active node is rejected.

##### Tests / Validation

- Unit test: append user message → appears in conversation.
- Unit test: append assistant message with metadata → metadata preserved.
- Unit test: append to non-active node → error.
- Unit test: `getRecentMessages(limit: 3)` returns last 3 messages.
- Unit test: message IDs are unique and sortable.

##### Dependencies

- Step 1.3 — Message types
- Step 3.8 — State engine dispatch

---

#### Step 4.2 — Implement canonical answer management

##### Objective

Implement canonical answer creation, staleness marking, acceptance, and source traceability.

##### Why This Step Exists

Canonical answers are the clean output of a node's conversation. They must be stored separately from raw messages, tracked for staleness, and linked to source messages.

##### Required Inputs

- `03-conversation-runtime-spec.md` §8-9
- `06-agent-turn-contract.md` §5

##### Relevant Docs

- `03-conversation-runtime-spec.md`
- `06-agent-turn-contract.md`
- `13-prototypes.md` — State 3.7 (Synthesized)

##### Tasks

1. Create `src/conversation-runtime/canonical-answers.ts`:
   - `setCanonicalAnswerDraft(state, nodeId, draft: CanonicalAnswerDraft): StateEngineResult`
   - `acceptCanonicalAnswer(state, nodeId): StateEngineResult`
   - `markCanonicalAnswerStale(state, nodeId): StateEngineResult`
   - `regenerateCanonicalAnswer(state, nodeId): StateEngineResult` — marks old as stale, allows new draft.
2. Staleness rules (from spec):
   - New user message added → mark stale.
   - User edits canonical answer → mark stale.
   - Node reopened from `accepted` → mark stale.
   - Upstream dependency changes materially → mark stale.
   - Completeness changes from sufficient to weak/missing → mark stale.
3. Guard: can only accept when lifecycle is `synthesized`.
4. Guard: can only generate draft when lifecycle is `ready_for_synthesis` or during `synthesized` regeneration.
5. `acceptedAt` timestamp is set when canonical answer is accepted.

##### Files / Areas Likely Affected

- `src/conversation-runtime/canonical-answers.ts` (new)
- `src/conversation-runtime/index.ts`

##### Acceptance Criteria

- Draft set correctly with `generatedFromMessageIds`.
- Acceptance sets `accepted: true` and records `acceptedAt`.
- New user message after acceptance marks answer stale.
- Reopening an `accepted` node marks answer stale.
- Accepting when lifecycle is not `synthesized` → error.

##### Tests / Validation

- Unit test: set draft → answer appears in node state.
- Unit test: accept → `accepted: true`.
- Unit test: new user message → `stale: true`.
- Unit test: accept in wrong lifecycle → error.
- Unit test: regenerate → old marked stale, new draft assigned.

##### Dependencies

- Step 4.1 — Message management
- Step 3.4 — Lifecycle transitions

---

#### Step 4.3 — Implement conversation summary generation

##### Objective

Implement a deterministic function that produces a node-level conversation summary for prompt compression in long conversations.

##### Why This Step Exists

Long conversations consume context window budget. A summary allows the prompt orchestrator to include relevant context without exceeding token limits.

##### Required Inputs

- `03-conversation-runtime-spec.md` §10
- `05-prompt-orchestration-spec.md` §8 — context budget

##### Relevant Docs

- `03-conversation-runtime-spec.md`
- `05-prompt-orchestration-spec.md`

##### Tasks

1. Create `src/conversation-runtime/summarizer.ts`:
   - `summarizeConversation(messages: NodeMessage[]): string`
   - Extract key points: facts, decisions, assumptions mentioned.
   - Do not replace raw messages; summary is supplementary.
   - Reference source message IDs in summary text.
   - Keep summary concise (target ~200 tokens worth of text).

##### Files / Areas Likely Affected

- `src/conversation-runtime/summarizer.ts` (new)

##### Acceptance Criteria

- Summary is shorter than original conversation.
- Summary mentions extracted facts and decisions.
- Raw messages remain intact and accessible.

##### Tests / Validation

- Unit test: generate summary from multi-turn conversation.
- Unit test: summary length < 50% of conversation length.
- Unit test: summary includes reference to key claim from messages.

##### Dependencies

- Step 4.1 — Message management

---

### Phase 5 — Prompt Registry and Prompt Orchestration

#### Step 5.1 — Implement prompt registry

##### Objective

Build a registry that stores and retrieves prompt definitions by profile, node type, and prompt state, with fallback chains.

##### Why This Step Exists

The prompt orchestrator needs a centralized, queryable prompt store. Fallback chains ensure graceful degradation when profile-specific prompts don't exist.

##### Required Inputs

- `05-prompt-orchestration-spec.md` §6-7
- `10-profile-and-node-schema-spec.md` §10 — prompt references

##### Relevant Docs

- `05-prompt-orchestration-spec.md`
- `10-profile-and-node-schema-spec.md`

##### Tasks

1. Create `src/prompt-orchestration/prompt-registry.ts`:
   - `PromptRegistry` class or module with:
     - `register(prompt: PromptDefinition): void`
     - `lookup(profileId, nodeType, promptState): PromptDefinition | null`
     - Fallback chain: `node-specific → document-specific → phase-specific → profile-generic → global prompt-state fallback`.
   - `loadPromptsFromDirectory(dir: string): Promise<void>` — load `.md` prompt files.
2. Define `PromptDefinition`:
   ```ts
   type PromptDefinition = {
     id: PromptId
     scope: string
     promptState: PromptState
     content: string
     outputSchemaRef: string
     version: string
   }
   ```
3. Provide default fallback prompts for each `PromptState`:
   - `initial` — ask one opening question
   - `follow_up` — respond and ask targeted follow-up
   - `clarification` — name ambiguity, ask clarifying question
   - `refinement` — explain weakness, request sharper answer
   - `synthesis` — draft canonical answer
   - `review` — present draft, invite accept/edit
   - `repair` — regenerate structured output
   - `blocked` — explain blocker, identify prerequisite
   - `accepted` — confirm, recommend next node

##### Files / Areas Likely Affected

- `src/prompt-orchestration/prompt-registry.ts` (new)
- `src/prompt-orchestration/default-prompts.ts` (new)
- `src/prompt-orchestration/index.ts` (new)

##### Acceptance Criteria

- Registry stores and retrieves prompts.
- Fallback chain resolves correctly: profile-specific → generic.
- All 9 `PromptState` values have at least a global fallback prompt.
- Prompts can be loaded from filesystem.

##### Tests / Validation

- Unit test: register and lookup exact match.
- Unit test: fallback from node-specific to generic.
- Unit test: lookup for unregistered state returns global fallback.
- Unit test: all 9 prompt states have fallback content.

##### Dependencies

- Step 1.2 — `PromptState` type

---

#### Step 5.2 — Implement prompt selection by node state

##### Objective

Given a node's lifecycle, prompt state, and profile definition, select the appropriate prompt from the registry.

##### Why This Step Exists

Prompt selection is the bridge between deterministic state and LLM instruction. The lifecycle-to-prompt-state mapping must be explicit and testable.

##### Required Inputs

- `05-prompt-orchestration-spec.md` §3-5
- `13-prototypes.md` §1.3 — lifecycle → prompt state mapping

##### Relevant Docs

- `05-prompt-orchestration-spec.md`
- `13-prototypes.md` §1.3

##### Tasks

1. Create `src/prompt-orchestration/prompt-selector.ts`:
   - `selectPrompt(nodeState: NodeRuntimeState, nodeDef: NodeDefinition, profile: LogosProfile, registry: PromptRegistry): PromptDefinition`
   - Lifecycle → PromptState mapping (from spec):
     ```
     not_started → initial
     active → follow_up
     answered → follow_up
     needs_clarification → clarification
     needs_refinement → refinement
     ready_for_synthesis → synthesis
     synthesized → review
     accepted → accepted
     blocked → blocked
     deferred → (no prompt)
     ```
   - Lookup in registry with fallback chain.
   - If node has `promptRefs` in its definition, use those overrides.

##### Files / Areas Likely Affected

- `src/prompt-orchestration/prompt-selector.ts` (new)

##### Acceptance Criteria

- `not_started` node → `initial` prompt selected.
- `synthesized` node → `review` prompt selected.
- `blocked` node → `blocked` prompt selected.
- `deferred` node → no prompt (returns null or special marker).
- Node-specific prompt overrides take precedence over generic.

##### Tests / Validation

- Unit test: verify prompt selection for each lifecycle state.
- Unit test: profile-specific prompt overrides generic.
- Unit test: deferred → no prompt.

##### Dependencies

- Step 5.1 — Prompt registry
- Step 3.4 — Lifecycle transitions

---

#### Step 5.3 — Implement prompt assembly and context injection

##### Objective

Assemble the final LLM request: combine the selected prompt template with conversation context, node definition, accepted dependencies, and global context, respecting token budget.

##### Why This Step Exists

Prompt assembly determines what the LLM sees. Context must be assembled in priority order, with deterministic budget rules, to produce consistent and relevant agent turns.

##### Required Inputs

- `05-prompt-orchestration-spec.md` §7-8

##### Relevant Docs

- `05-prompt-orchestration-spec.md`
- `architecture/05-llm-integration-architecture.md`

##### Tasks

1. Create `src/prompt-orchestration/prompt-assembler.ts`:
   - `assemblePromptRequest(input: PromptAssemblyInput): LlmRequest`
   - Context assembly priority (from spec):
     1. Current system instruction (from selected prompt).
     2. Active node definition (`canonicalQuestion`, `coverageTopics`, `sufficiencyCriteria`).
     3. Current lifecycle and prompt state.
     4. Latest user message.
     5. Recent node conversation (last N messages, respecting budget).
     6. Node conversation summary (if conversation is long).
     7. Accepted prerequisite node answers.
     8. Global project context.
     9. Profile metadata.
   - Attach output schema (`AgentTurnOutput` schema reference).
   - Include allowed actions as constraints.
   - Estimate and cap token usage.

##### Files / Areas Likely Affected

- `src/prompt-orchestration/prompt-assembler.ts` (new)

##### Acceptance Criteria

- Assembled prompt includes system instruction, node definition, and conversation context.
- Context is ordered by priority.
- Output schema reference is attached.
- Token budget is respected (conversation is truncated if needed, with summary fallback).
- Accepted dependency answers are injected in dependency order.

##### Tests / Validation

- Unit test: assemble prompt for `not_started` node → includes canonical question.
- Unit test: assemble prompt for `active` node → includes recent messages.
- Unit test: long conversation → includes summary, not full history.
- Unit test: accepted dependencies included when relevant.
- Unit test: output schema reference present.

##### Dependencies

- Step 5.2 — Prompt selection
- Step 4.3 — Conversation summary

---

### Phase 6 — Agent Turn Contract and Structured Output Validation

#### Step 6.1 — Define AgentTurnOutput validation schema

##### Objective

Create a validation function (using Zod or hand-rolled) that validates `AgentTurnOutput` against the contract, including lifecycle transition validity, action validity, and content rules.

##### Why This Step Exists

Every LLM output must be validated before state mutation. The validator is the gatekeeper that prevents the LLM from corrupting state.

##### Required Inputs

- `06-agent-turn-contract.md` §10 — validation rules
- Contract types from Step 1.3

##### Relevant Docs

- `06-agent-turn-contract.md`
- `architecture/05-llm-integration-architecture.md`

##### Tasks

1. Create `src/validation/agent-turn-validator.ts`:
   - `validateAgentTurnOutput(output: unknown): Result<AgentTurnOutput, ValidationError[]>`
   - Schema-level validation:
     - `userFacingMessage` must be non-empty string.
     - `proposedLifecycle` must be a valid `NodeLifecycle` value.
     - `proposedPromptState` must be a valid `PromptState` value.
     - `canonicalAnswerDraft`, if present, must have required fields.
     - `transitionIntent`, if present, must have `event` and `reason`.
   - Semantic validation:
     - Proposed lifecycle transition must be valid given current node state (passed as context).
     - `canonicalAnswerDraft` must not be generated in disallowed states.
     - `accepted` lifecycle must not be proposed without explicit user accept event.
     - Suggested actions must be compatible with current/proposed lifecycle.
     - Completeness must not contradict lifecycle (e.g., `complete: true` with `lifecycle: needs_clarification`).
   - Returns all validation errors (not just the first).

##### Files / Areas Likely Affected

- `src/validation/agent-turn-validator.ts` (new)
- `src/validation/index.ts` (new)

##### Acceptance Criteria

- Empty `userFacingMessage` → validation error.
- `proposedLifecycle: "accepted"` when current state is `not_started` → validation error.
- `canonicalAnswerDraft` with `proposedLifecycle: "not_started"` → validation error.
- Valid `AgentTurnOutput` passes all checks.
- All validation errors are returned as a list.

##### Tests / Validation

- Unit test: valid output passes.
- Unit test: empty message → error.
- Unit test: impossible transition → error.
- Unit test: draft in wrong state → error.
- Unit test: missing required fields → error.
- Unit test: multiple errors reported at once.

##### Dependencies

- Step 1.3 — AgentTurnOutput types
- Step 3.4 — Lifecycle transition validation

---

#### Step 6.2 — Implement repair prompt generation

##### Objective

When `AgentTurnOutput` fails validation, generate a repair prompt that includes the original request, the validation errors, and instructions to regenerate.

##### Why This Step Exists

LLM outputs will sometimes fail validation. The repair loop allows the system to recover without user intervention, as long as the LLM can produce a valid output on retry.

##### Required Inputs

- `05-prompt-orchestration-spec.md` §11
- `architecture/05-llm-integration-architecture.md` §7

##### Relevant Docs

- `05-prompt-orchestration-spec.md`
- `architecture/05-llm-integration-architecture.md`

##### Tasks

1. Create `src/validation/repair-prompt.ts`:
   - `buildRepairPrompt(originalRequest: LlmRequest, errors: ValidationError[]): LlmRequest`
   - Includes original system prompt, messages, and schema.
   - Adds repair instructions: "Your previous output failed validation. Fix these errors: ..."
   - Lists specific validation errors with clear descriptions.
   - Does not re-ask the original task; only asks for structural repair.
2. Implement retry limit (default: 3 attempts).
3. On final failure, return `repair_failed` error with diagnostics.

##### Files / Areas Likely Affected

- `src/validation/repair-prompt.ts` (new)

##### Acceptance Criteria

- Repair prompt includes original context and error details.
- Retry loop stops after N attempts.
- Final failure produces a recoverable error, not a crash.

##### Tests / Validation

- Unit test: repair prompt contains error messages.
- Unit test: retry counter increments.
- Unit test: max retries exceeded → error returned.

##### Dependencies

- Step 6.1 — AgentTurnOutput validator

---

#### Step 6.3 — Implement AgentTurnOutput application to state

##### Objective

After validation passes, apply the `AgentTurnOutput` to the runtime state: append assistant message, update lifecycle, update prompt state, store canonical answer draft, update completeness, update extracted data, recompute allowed actions.

##### Why This Step Exists

This is the "apply effects" step in the runtime pipeline. It translates validated LLM output into deterministic state changes.

##### Required Inputs

- `06-agent-turn-contract.md` §11
- `architecture/02-runtime-architecture.md` §8

##### Relevant Docs

- `06-agent-turn-contract.md`
- `02-state-engine-canonical-spec.md`

##### Tasks

1. Create `src/application/apply-agent-turn.ts`:
   - `applyAgentTurn(state, nodeId, output: AgentTurnOutput): StateEngineResult`
   - Append assistant message with `userFacingMessage` as content and metadata from output.
   - If `proposedLifecycle` is set and valid, transition node lifecycle.
   - If `proposedPromptState` is set, update node prompt state.
   - If `canonicalAnswerDraft` is present, store it.
   - If `completenessEvaluation` is present, merge with existing completeness (LLM evaluation is advisory).
   - If `extracted` is present, merge extracted data.
   - If `transitionIntent` is present, log the intent.
   - Recompute `allowedActions`.
   - Recompute document readiness.
   - Generate and return snapshot.
2. **Important:** The LLM `proposedLifecycle` is treated as a proposal. The state engine guard still validates the transition before applying.

##### Files / Areas Likely Affected

- `src/application/apply-agent-turn.ts` (new)
- `src/application/index.ts` (new)

##### Acceptance Criteria

- Assistant message is appended to active node conversation.
- Lifecycle is updated only if proposed transition is valid.
- Canonical answer draft is stored if present.
- `allowedActions` and document readiness recompute after application.
- Invalid proposed transitions are caught by guards (not silently applied).

##### Tests / Validation

- Integration test: apply valid `AgentTurnOutput` → state updated correctly.
- Integration test: apply output with invalid lifecycle → rejected, error returned.
- Unit test: canonical answer draft stored → appears in node state.
- Unit test: completeness merged correctly.

##### Dependencies

- Step 6.1 — Validation
- Step 3.8 — State engine dispatch
- Step 4.2 — Canonical answer management

---

### Phase 7 — Mock LLM Provider and Deterministic Conversation Harness

#### Step 7.1 — Implement MockLlmProvider with fixture-based responses

##### Objective

Build a mock LLM provider that returns predetermined `AgentTurnOutput` fixtures based on node lifecycle, enabling development and testing without real LLM calls.

##### Why This Step Exists

The entire TUI and state engine can be prototyped and tested without LLM credentials or network access. This is a non-negotiable requirement from the testing architecture.

##### Required Inputs

- `architecture/05-llm-integration-architecture.md` §11
- `13-prototypes.md` §6.7 — mock agent function

##### Relevant Docs

- `architecture/05-llm-integration-architecture.md`
- `architecture/09-testing-architecture.md`
- `13-prototypes.md` §6.7

##### Tasks

1. Create `src/llm/mock-provider.ts`:
   - `MockLlmProvider` implementing the `LlmProvider` interface.
   - `fixtures: Record<string, AgentTurnOutput>` — keyed by lifecycle state.
   - `generateStructuredOutput(request: LlmRequest): Promise<LlmResponse>` — returns fixture based on node lifecycle detected in request context.
   - Fixture responses for each lifecycle:
     - `not_started` → initial question
     - `active` / `answered` → follow-up question
     - `needs_clarification` → clarification request
     - `needs_refinement` → refinement request
     - `ready_for_synthesis` → canonical answer draft
     - `synthesized` → review prompt
     - `blocked` → blocker explanation
     - `accepted` → confirmation
   - Support for custom fixtures passed in constructor.
2. Implement `setFixture(lifecycle: NodeLifecycle, output: AgentTurnOutput)` for test-specific overrides.

##### Files / Areas Likely Affected

- `src/llm/mock-provider.ts` (new)
- `src/llm/index.ts` (update)

##### Acceptance Criteria

- Mock provider returns `AgentTurnOutput` for each lifecycle state.
- Fixtures can be overridden per test.
- Mock provider does not make network calls.
- Response includes all required `AgentTurnOutput` fields.

##### Tests / Validation

- Unit test: mock returns initial question for `not_started`.
- Unit test: mock returns review prompt for `synthesized`.
- Unit test: custom fixture overrides default.
- Unit test: mock response passes `validateAgentTurnOutput`.

##### Dependencies

- Step 6.1 — AgentTurnOutput validator
- Step 1.3 — AgentTurnOutput type

---

#### Step 7.2 — Build deterministic conversation harness for end-to-end flows

##### Objective

Build a test harness that runs complete conversations using the mock LLM provider, state engine, and prompt orchestrator, producing deterministic end-to-end flow tests.

##### Why This Step Exists

The 10 flow prototypes from `13-prototypes.md` must be validated as end-to-end tests. A harness that wires state engine + mock LLM enables flow validation before the TUI exists.

##### Required Inputs

- `13-prototypes.md` Part 4 — 10 flow prototypes
- All state engine and conversation runtime modules

##### Relevant Docs

- `13-prototypes.md` §4.1-4.10
- `architecture/09-testing-architecture.md`

##### Tasks

1. Create `tests/harness/conversation-harness.ts`:
   - `createTestSession(profile: LogosProfile): { state, dispatch }`
   - `simulateUserTurn(state, input: string): Promise<StateEngineResult>` — appends user message, calls mock LLM, validates and applies output.
   - `simulateNodeCompletion(state, nodeId): Promise<StateEngineResult>` — runs through entire not_started → accepted flow.
2. Implement Flow A (First Use) as a test.
3. Implement Flow B (Incomplete Answer) as a test.
4. Implement Flow C (Sidebar Navigation) as a test.
5. Implement Flow D (Review/Edit/Regenerate) as a test.

##### Files / Areas Likely Affected

- `tests/harness/conversation-harness.ts` (new)
- `tests/flows/flow-a-first-use.test.ts` (new)
- `tests/flows/flow-b-incomplete-answer.test.ts` (new)
- `tests/flows/flow-c-navigation.test.ts` (new)
- `tests/flows/flow-d-review-edit.test.ts` (new)
- `tests/flows/flow-e-deferred.test.ts` (new)
- `tests/flows/flow-f-blocked.test.ts` (new)
- `tests/flows/flow-g-document-preview.test.ts` (new)
- `tests/flows/flow-h-export.test.ts` (new)
- `tests/flows/flow-i-resume.test.ts` (new)
- `tests/flows/flow-j-change-profile.test.ts` (new)

##### Acceptance Criteria

- Flow A runs end-to-end without LLM credentials.
- Flow B demonstrates clarification → refinement → synthesis.
- Flow C preserves node state during navigation.
- Flow D allows edit → regenerate → accept.
- All flows produce the expected lifecycle transitions.

##### Tests / Validation

- These files ARE the tests. Each flow test validates a complete prototype walkthrough.

##### Dependencies

- Step 7.1 — Mock provider
- Step 6.3 — Apply agent turn
- Step 5.3 — Prompt assembly
- Step 3.8 — State engine dispatch

---

### Phase 8 — TUI Rendering Architecture

#### Step 8.1 — Implement render snapshot to TUI render model mapping

##### Objective

Map the `StateEngineSnapshot` to the `TuiRenderSnapshot` model consumed by the TUI components. This is a pure transformation layer.

##### Why This Step Exists

The state engine produces a domain snapshot. The TUI needs a render-optimized model with labels, status symbols, and layout information. This mapping layer keeps domain and presentation separate.

##### Required Inputs

- `08-tui-state-and-rendering-contract.md`
- `architecture/06-tui-rendering-architecture.md`
- `13-prototypes.md` Appendix C — mode → panel content

##### Relevant Docs

- `08-tui-state-and-rendering-contract.md`
- `architecture/06-tui-rendering-architecture.md`
- `13-prototypes.md` Part 2 (Component Model), Appendix A-C

##### Tasks

1. Create `src/application/render-model-builder.ts`:
   - `buildRenderSnapshot(snapshot: StateEngineSnapshot, profile: LogosProfile): TuiRenderSnapshot`
   - Map `SessionMode` → main panel variant (see `13-prototypes.md` Appendix C).
   - Build `SidebarRenderModel` from profile phases/documents/nodes + node states:
     - Each node gets `statusSymbol` from lifecycle mapping.
     - Active node gets `selected: true`.
     - Blocked nodes get `disabled: true` with reason.
   - Build `ActionBarRenderModel` from `snapshot.allowedActions`:
     - Map action IDs to display labels (Appendix A).
     - Mark actions as `enabled`/`disabled`.
   - Build `InputRenderModel`: `enabled` when lifecycle allows text input.
   - Include diagnostics.

##### Files / Areas Likely Affected

- `src/application/render-model-builder.ts` (new)

##### Acceptance Criteria

- Idle mode → idle panel with welcome and deterministic actions.
- Structure overview → profile summary with node tree in sidebar.
- Node focus → conversation panel, canonical preview, action bar.
- Sidebar nodes have correct status symbols for each lifecycle.
- Action labels match Appendix A from `13-prototypes.md`.

##### Tests / Validation

- Snapshot test: idle mode produces expected render model.
- Snapshot test: node_focus with `synthesized` lifecycle produces review actions.
- Snapshot test: blocked node sidebar entry has `disabled: true`.
- Unit test: status symbol mapping (`not_started → "○"`, `accepted → "✓"`, etc.).

##### Dependencies

- Step 3.8 — State engine snapshot
- Step 2.2 — Node tree

---

#### Step 8.2 — Implement TUI shell and layout components

##### Objective

Build the terminal UI shell using Ink (React for terminal): the AppFrame with sidebar and main panel layout, focus management, and keyboard handling.

##### Why This Step Exists

The TUI is the primary user interface. The shell component owns layout, routing between modes, and event dispatch to the application layer.

##### Required Inputs

- `08-tui-state-and-rendering-contract.md`
- `architecture/06-tui-rendering-architecture.md`
- `13-prototypes.md` Part 2 — component model

##### Relevant Docs

- `08-tui-state-and-rendering-contract.md`
- `architecture/06-tui-rendering-architecture.md`
- `13-prototypes.md` §2.1-2.11

##### Tasks

1. Create `src/tui/app-shell.tsx`:
   - `AppShell` component: renders `AppFrame` layout.
   - Reads `TuiRenderSnapshot` from application context.
   - Primary rendering switch:
     ```tsx
     if (snapshot.mode === "node_focus") {
       return <NodeFocusedLayout />
     } else {
       return <StructuralLayout />
     }
     ```
   - Keyboard handler: dispatches events for up/down, enter, tab, escape.
   - Focus management: tracks which region has focus (sidebar, input, actions).
2. Create `src/tui/components/Sidebar.tsx`:
   - Renders profile header, collapsible phase/document/node tree.
   - Highlights active node.
   - Shows status symbols.
3. Create `src/tui/components/MainPanel.tsx`:
   - Renders mode-specific content (idle, structure_overview, node_focus, document_preview, export, settings).
4. Existing Ink-based TUI components in `src/tui/` can be adapted.

##### Files / Areas Likely Affected

- `src/tui/app-shell.tsx` (new)
- `src/tui/components/Sidebar.tsx` (new)
- `src/tui/components/MainPanel.tsx` (new)
- `src/tui/components/ConversationPanel.tsx` (new)
- `src/tui/components/CanonicalPreview.tsx` (new)
- `src/tui/components/ActionBar.tsx` (new)
- `src/tui/components/InputArea.tsx` (new)
- `src/tui/hooks/use-focus.ts` (new)

##### Acceptance Criteria

- Terminal renders sidebar + main panel layout.
- Sidebar shows profile structure with node tree and status symbols.
- Main panel content changes with mode.
- Keyboard navigation works: up/down in sidebar, tab between regions.
- Enter selects node/action.
- Escape returns from sub-modes.

##### Tests / Validation

- TUI rendering test: render idle screen from snapshot, verify welcome text present.
- TUI rendering test: render structure_overview, verify node tree rendered.
- TUI rendering test: render node_focus with conversation, verify messages rendered.
- Manual: run TUI locally with mock provider, navigate structure and nodes.

##### Dependencies

- Step 8.1 — Render model builder

---

#### Step 8.3 — Implement node-focused conversational rendering

##### Objective

Render the complete node-focused mode: breadcrumb, status, conversation history, agent message, canonical answer preview, action bar, and input area.

##### Why This Step Exists

This is the core interaction surface. It must render all 9 lifecycle states with appropriate agent behavior and user affordances.

##### Required Inputs

- `13-prototypes.md` §3.3-3.10 — state prototypes for each lifecycle
- `08-tui-state-and-rendering-contract.md` §5

##### Relevant Docs

- `13-prototypes.md` State prototypes
- `08-tui-state-and-rendering-contract.md`

##### Tasks

1. Create `src/tui/components/ConversationPanel.tsx`:
   - Renders scrollable message history (user left-aligned, agent right-aligned or marked).
   - Renders latest agent message prominently.
   - Shows node status badge.
2. Create `src/tui/components/CanonicalPreview.tsx`:
   - Renders canonical answer in a distinct box when available.
   - Shows confidence level, source message count.
   - Shows "Accepted" / "Draft" / "Stale" badge.
3. Create `src/tui/components/ActionBar.tsx`:
   - Renders only actions from `snapshot.allowedActions`.
   - Maps actions to labels (Appendix A).
4. Create `src/tui/components/InputArea.tsx`:
   - Visible only when `InputRenderModel.enabled` is true.
   - Shows placeholder text from render model.
5. Wire user input → dispatch `USER_MESSAGE` event.

##### Files / Areas Likely Affected

- `src/tui/components/ConversationPanel.tsx` (new/update)
- `src/tui/components/CanonicalPreview.tsx` (new/update)
- `src/tui/components/ActionBar.tsx` (new/update)
- `src/tui/components/InputArea.tsx` (new/update)

##### Acceptance Criteria

- Conversation panel shows user and agent messages in order.
- Canonical preview appears when `canonicalAnswer !== null`.
- Action bar shows only state-engine-approved actions.
- Input is hidden when blocked or accepted (unless reopened).
- Breadcrumb shows `Phase / Document / Node`.

##### Tests / Validation

- Snapshot test: `not_started` node → initial question, input enabled, actions: answer/skip.
- Snapshot test: `synthesized` node → canonical preview, actions: accept/edit/regenerate/defer/reopen.
- Snapshot test: `accepted` node → accepted badge, actions: continue/reopen/preview.
- Snapshot test: `blocked` node → blocker explanation, actions: open_prerequisite/defer.

##### Dependencies

- Step 8.2 — TUI shell

---

### Phase 9 — Sidebar, Node Navigation, and activeNodeId Flow

#### Step 9.1 — Implement sidebar node tree with status indicators

##### Objective

Build the navigable sidebar that renders phases, documents, and nodes as a collapsible tree with correct status symbols and active node highlighting.

##### Why This Step Exists

The sidebar is the user's structural map. It shows what exists, what's done, and what needs attention. It is the primary navigation mechanism.

##### Required Inputs

- `13-prototypes.md` §2.4-2.6 — sidebar and node tree component model
- `08-tui-state-and-rendering-contract.md` §6

##### Relevant Docs

- `13-prototypes.md` §2.4-2.6
- `08-tui-state-and-rendering-contract.md`
- `architecture/06-tui-rendering-architecture.md`

##### Tasks

1. Implement collapsible tree rendering:
   - Phases: collapsible, show title and order.
   - Documents: collapsible within phase, show title.
   - Nodes: selectable, show title and status symbol.
   - Collapse/expand state stored per phase and document.
2. Status symbols rendered per node:
   ```
   ○ → not_started
   ◐ → active, answered
   ? → needs_clarification
   △ → needs_refinement
   ◆ → ready_for_synthesis, synthesized
   ✓ → accepted
   ⏸ → deferred
   ⚠ → blocked
   ```
3. Active node gets visual highlight (bold, inverse, or color).
4. Keyboard navigation: up/down to move, enter to select, left/right to collapse/expand.
5. Selecting a node dispatches `NODE_SELECTED` event.
6. Document readiness indicator when applicable.

##### Files / Areas Likely Affected

- `src/tui/components/Sidebar.tsx` (update)
- `src/tui/components/NodeTree.tsx` (new)

##### Acceptance Criteria

- Phases and documents are collapsible.
- Node status symbols match lifecycle state.
- Active node is visually distinct.
- Keyboard navigation works.
- Selecting a blocked node navigates to it (shows blocked state).
- All 8 status symbols are distinct and visible.

##### Tests / Validation

- Snapshot test: sidebar with all lifecycle states represented.
- Manual: navigate sidebar with keyboard.
- Manual: collapse/expand phases and documents.

##### Dependencies

- Step 8.2 — TUI shell
- Step 8.1 — Render model builder

---

#### Step 9.2 — Implement node navigation and state preservation

##### Objective

Ensure that navigating between nodes preserves each node's conversation, lifecycle, and canonical answer. Handle deselection and `lastActiveNodeId` tracking.

##### Why This Step Exists

Non-linear navigation is a core design principle. Users must be able to jump between nodes without losing work.

##### Required Inputs

- `03-conversation-runtime-spec.md` §12
- `13-prototypes.md` Flow C (Sidebar Navigation)

##### Relevant Docs

- `03-conversation-runtime-spec.md`
- `13-prototypes.md` §4.3

##### Tasks

1. On node selection:
   - Preserve current node state (lifecycle, conversation).
   - Update `lastActiveNodeId`.
   - Set new `activeNodeId`.
   - Load/initialize new node state.
2. On node deselection (escape or "Back to structure"):
   - Clear `activeNodeId`.
   - Mode returns to `structure_overview`.
3. Handle rapid navigation:
   - Debounce node selection events.
   - Ensure each selection completes before next starts.
4. Handle node deletion from profile (edge case):
   - Clear `activeNodeId` if currently active.
   - Show error diagnostic.

##### Files / Areas Likely Affected

- `src/tui/hooks/use-navigation.ts` (new)
- `src/state-engine/node-selection.ts` (verify preservation)

##### Acceptance Criteria

- Navigate from node A (active) to node B → node A state preserved.
- Return to node A → conversation and lifecycle restored exactly.
- Sidebar reflects correct state for all nodes after navigation.
- `lastActiveNodeId` is correct after navigation.

##### Tests / Validation

- E2E harness test: Flow C (sidebar navigation).
- Unit test: `selectNode` preserves previous node state.
- Manual: navigate between nodes in TUI, verify state restoration.

##### Dependencies

- Step 9.1 — Sidebar
- Step 3.3 — Node selection (state engine)

---

### Phase 10 — Node Lifecycle Interaction Flows

#### Step 10.1 — Implement initial question flow (not_started → active)

##### Objective

Implement the full interaction: user selects a not_started node → agent generates initial question from canonical question → user answers → engine transitions to active.

##### Why This Step Exists

This is the entry point for every node's conversation. The initial question must be generated from the canonical question, not a static template.

##### Required Inputs

- `13-prototypes.md` §3.3 — not_started state prototype
- Flow A §4.1 step 3

##### Relevant Docs

- `13-prototypes.md` §3.3, §4.1
- `05-prompt-orchestration-spec.md` §5.1

##### Tasks

1. Wire the `not_started` lifecycle through the full pipeline:
   - Node selected → state engine initializes `NodeRuntimeState` as `not_started`.
   - Prompt orchestrator selects `initial` prompt.
   - LLM (mock or real) generates initial question as `AgentTurnOutput`.
   - State engine validates and applies: assistant message appended, lifecycle → `active`.
   - TUI renders: agent message with initial question, input enabled, actions: answer/skip/ask_for_example.
2. User types answer → dispatch `USER_MESSAGE` → engine evaluates → lifecycle may transition to `answered`, `needs_clarification`, `needs_refinement`, or `ready_for_synthesis`.
3. Ensure the initial question paraphrases the canonical question (not verbatim unless natural).

##### Files / Areas Likely Affected

- `src/application/use-cases/submit-user-message.ts` (new)
- `src/application/use-cases/select-node.ts` (new)
- `src/tui/components/ConversationPanel.tsx`

##### Acceptance Criteria

- Selecting a `not_started` node shows the initial question immediately.
- The initial question is specific to the node context.
- Answering moves the node to `active` or beyond.
- Skip action transitions to deferred and recommends next node.

##### Tests / Validation

- E2E harness test: not_started → active flow with mock LLM.
- Unit test: initial prompt selection for not_started node.
- Manual TUI walkthrough.

##### Dependencies

- Step 7.2 — Conversation harness
- Step 8.3 — Node-focused rendering

---

#### Step 10.2 — Implement clarification and refinement flows

##### Objective

Implement the clarification (needs_clarification) and refinement (needs_refinement) interaction paths: agent identifies issue, asks targeted question, user responds, engine re-evaluates.

##### Why This Step Exists

These are the quality gates that prevent weak or ambiguous answers from reaching synthesis. Flow B in the prototypes validates this path.

##### Required Inputs

- `13-prototypes.md` §3.5-3.6 — clarification and refinement state prototypes
- Flow B §4.2

##### Relevant Docs

- `13-prototypes.md` §3.5, §3.6, §4.2
- `11-conversation-quality-and-completeness.md`

##### Tasks

1. Implement `needs_clarification` flow:
   - Engine detects ambiguity → lifecycle → `needs_clarification`.
   - Prompt orchestrator selects `clarification` prompt.
   - Agent names the ambiguity, asks one targeted question.
   - User answers → engine re-evaluates.
   - After 3+ clarification rounds without resolution → suggest deferring or marking as assumption.
2. Implement `needs_refinement` flow:
   - Engine detects weak/generic answer → lifecycle → `needs_refinement`.
   - Prompt orchestrator selects `refinement` prompt.
   - Agent identifies weakness, requests sharper version.
   - May offer concrete direction without taking over user intent.
   - After 3+ refinement rounds → offer to accept as-is with low confidence.
3. Both flows preserve the conversation context from earlier turns.

##### Files / Areas Likely Affected

- `src/state-engine/node-lifecycle.ts` (update — clarification/refinement guard logic)
- `src/application/use-cases/submit-user-message.ts`

##### Acceptance Criteria

- Clarification state renders correctly: `?` symbol, agent names ambiguity.
- Refinement state renders correctly: `△` symbol, agent identifies weakness.
- User response is evaluated and may resolve to `active` or progress to `ready_for_synthesis`.
- After 3 failures, system offers fallback options.

##### Tests / Validation

- E2E harness test: Flow B (Incomplete Answer → Clarification → Refinement → Synthesis).
- Unit test: completeness evaluation triggers `needs_clarification` on contradictory input.
- Unit test: completeness evaluation triggers `needs_refinement` on generic input.

##### Dependencies

- Step 10.1 — Initial question flow
- Step 3.6 — Completeness evaluation

---

#### Step 10.3 — Implement synthesis and review flow

##### Objective

Implement the synthesis (ready_for_synthesis → synthesized) and review (synthesized → accepted) flow: agent generates canonical answer draft, user reviews, accepts or edits.

##### Why This Step Exists

Synthesis and review are the critical steps where LLM output becomes accepted documentation source material. Flow A and Flow D exercise this path.

##### Required Inputs

- `13-prototypes.md` §3.7 — synthesized state prototype
- Flow A §4.1 steps 4-5, Flow D §4.4

##### Relevant Docs

- `13-prototypes.md` §3.7, §4.1, §4.4
- `06-agent-turn-contract.md` §5

##### Tasks

1. Implement synthesis:
   - Engine determines node is `ready_for_synthesis`.
   - Prompt orchestrator selects `synthesis` prompt.
   - Agent generates `canonicalAnswerDraft` with `content`, `confidence`, `sourceMessageIds`, `assumptions`, `unresolvedIssues`.
   - State engine stores draft, transitions lifecycle → `synthesized`.
2. Implement review:
   - TUI shows canonical answer preview in distinct box.
   - Confidence badge: Low / Medium / High.
   - Source note: "Generated from N messages".
   - Actions: `[Accept]`, `[Edit]`, `[Regenerate]`, `[Defer]`, `[Reopen]`.
   - `[Accept]` → marks accepted, transitions to `accepted`.
   - `[Edit]` → shows input with content pre-filled, on submit → marks stale, regenerates.
   - `[Regenerate]` → agent produces new draft.
   - `[Defer]` → transitions to `deferred`.
   - `[Reopen]` → returns to `active`.

##### Files / Areas Likely Affected

- `src/application/use-cases/accept-canonical-answer.ts` (new)
- `src/application/use-cases/edit-canonical-answer.ts` (new)
- `src/application/use-cases/regenerate-canonical-answer.ts` (new)
- `src/tui/components/CanonicalPreview.tsx`
- `src/tui/components/ActionBar.tsx`

##### Acceptance Criteria

- Synthesis produces canonical answer draft with source message traceability.
- Review screen shows clean content preview with confidence.
- Accept transitions to `accepted`, updates document readiness.
- Edit → regenerate preserves user correction.
- Reopen returns to `active` with stale canonical answer.

##### Tests / Validation

- E2E harness test: Flow A step 4-5 (synthesis → accept).
- E2E harness test: Flow D (review → edit → regenerate → accept).
- Unit test: accept guard — must be in `synthesized` lifecycle.
- Unit test: edit marks canonical answer stale.

##### Dependencies

- Step 10.2 — Clarification/refinement
- Step 4.2 — Canonical answer management

---

### Phase 11 — Canonical Answer Generation and Review Flow

*(Note: Phase 10.3 covers synthesis/review. Phase 11 refines canonical answer handling, staleness cascading, and edge cases.)*

#### Step 11.1 — Implement staleness cascade for canonical answers

##### Objective

When an upstream node's canonical answer changes, mark all downstream dependent nodes' canonical answers as stale and notify the user.

##### Why This Step Exists

Document consistency depends on staleness propagation. If a user changes a foundational thesis, all dependent answers must be reviewed.

##### Required Inputs

- `03-conversation-runtime-spec.md` §9
- `02-state-engine-canonical-spec.md` §13

##### Relevant Docs

- `03-conversation-runtime-spec.md`
- `07-document-materialization-spec.md` §9

##### Tasks

1. Implement `propagateStaleness(state, changedNodeId): StateEngineResult`:
   - Find all nodes that depend on `changedNodeId` (via `dependency-graph.ts`).
   - For each dependent: if it has an accepted canonical answer, mark it stale.
   - Recompute document readiness for affected documents.
   - Generate diagnostic events for each staleness change.
2. Staleness triggers:
   - Node reopened from `accepted`.
   - New user message added to accepted node.
   - Canonical answer edited.
   - Completeness changes from sufficient to weak/missing.

##### Files / Areas Likely Affected

- `src/state-engine/staleness.ts` (new)
- `src/state-engine/dispatch.ts` (update — trigger staleness cascade)

##### Acceptance Criteria

- Changing an accepted node marks its dependents as stale.
- Staleness propagates transitively through the dependency graph.
- Document readiness recomputes when sources become stale.
- Sidebar reflects stale status (e.g., stale canonical answer symbol).

##### Tests / Validation

- Unit test: change upstream → downstream stale.
- Unit test: multiple dependents → all marked stale.
- Unit test: change non-accepted node → no staleness propagation.

##### Dependencies

- Step 4.2 — Canonical answer management
- Step 2.2 — Dependency graph

---

### Phase 12 — Document Materialization

#### Step 12.1 — Implement document materializer (accepted answers → Markdown)

##### Objective

Build the document materialization module that assembles accepted canonical answers into a structured Markdown document following materialization rules.

##### Why This Step Exists

Documents are the primary output of the LOGOS Engine. This is where conversational work becomes portable, reviewable content.

##### Required Inputs

- `07-document-materialization-spec.md`
- `architecture/02-runtime-architecture.md` §10

##### Relevant Docs

- `07-document-materialization-spec.md`
- `architecture/02-runtime-architecture.md`
- `13-prototypes.md` §3.11 — document preview state

##### Tasks

1. Create `src/materialization/document-materializer.ts`:
   - `materializeDocument(documentId, state, profile): Result<MaterializedDocumentDraft, MaterializationError>`
   - For each `DocumentSectionRule`, collect accepted canonical answers from source nodes.
   - Render section headers from rule titles.
   - Insert canonical answer content under each section.
   - Mark missing required sections with `[MISSING — requires node: X]`.
   - Mark stale sections with `[⚠ STALE — source node has changed]`.
   - Generate completeness indicator: "N/M sections accepted".
   - Output format: Markdown string.
2. Implement `previewDocument(documentId, state, profile): MaterializedDocumentDraft`:
   - Same as materialize but allows partial (missing/stale sections visible).
3. Do not generate final documents from unaccepted answers.

##### Files / Areas Likely Affected

- `src/materialization/document-materializer.ts` (new)
- `src/materialization/index.ts` (new)

##### Acceptance Criteria

- Accepted nodes produce sections with their canonical answer content.
- Missing required nodes are flagged with source node reference.
- Stale source nodes are flagged.
- Document completeness is shown.
- Unaccepted answers are not used for final output.

##### Tests / Validation

- Unit test: materialize with all accepted → full document.
- Unit test: materialize with missing node → `[MISSING]` marker present.
- Unit test: materialize with stale source → `[⚠ STALE]` marker present.
- Unit test: document generation from unaccepted answer is rejected.

##### Dependencies

- Step 4.2 — Canonical answer management
- Step 3.7 — Document readiness

---

#### Step 12.2 — Implement document preview rendering in TUI

##### Objective

Render the materialized document preview in the TUI: show sections, missing/stale markers, completeness, and provide regenerate/export actions.

##### Why This Step Exists

Users need to see the document taking shape before exporting. The preview is an output inspection surface.

##### Required Inputs

- `13-prototypes.md` §3.11 — document preview state prototype
- Flow G §4.7

##### Relevant Docs

- `13-prototypes.md` §3.11, §4.7
- `07-document-materialization-spec.md`

##### Tasks

1. Create `src/tui/components/DocumentPreview.tsx`:
   - Renders materialized document content.
   - Shows accepted sections with content.
   - Shows missing sections with `[MISSING]` label and source node link.
   - Shows stale sections with `[⚠ STALE]` warning.
   - Shows completeness indicator: "N/M sections accepted".
   - Actions: `[Regenerate]`, `[Export]` (enabled only when ready), `[Close]`.
2. Navigation: user can select a missing node link to navigate to it.
3. Scrolling: support long documents with virtual scroll or page navigation.

##### Files / Areas Likely Affected

- `src/tui/components/DocumentPreview.tsx` (new/update)
- `src/application/use-cases/open-document-preview.ts` (new)

##### Acceptance Criteria

- Document preview shows all accepted sections with content.
- Missing sections link to source nodes.
- Stale sections are clearly marked.
- Export is disabled when document is not fully ready.
- Regenerate updates the preview from current state.

##### Tests / Validation

- Snapshot test: document preview with partial completeness.
- Snapshot test: document preview with stale sections.
- Manual TUI walkthrough: Flow G.

##### Dependencies

- Step 12.1 — Document materializer
- Step 8.2 — TUI shell

---

### Phase 13 — Session Persistence and Resume

#### Step 13.1 — Implement session snapshot save and load

##### Objective

Implement local persistence: save the full `LogosRuntimeState` as a JSON snapshot after each completed turn, and load it on session start.

##### Why This Step Exists

Without persistence, the user loses all work on exit. Snapshots enable fast resume without replaying events.

##### Required Inputs

- `09-session-events-and-persistence.md`
- `architecture/04-data-and-persistence-architecture.md`

##### Relevant Docs

- `09-session-events-and-persistence.md`
- `architecture/04-data-and-persistence-architecture.md`

##### Tasks

1. Create `src/persistence/snapshot-store.ts`:
   - `saveSnapshot(sessionId: string, state: LogosRuntimeState): Promise<Result<void, PersistenceError>>`
   - `loadSnapshot(sessionId: string): Promise<Result<SessionSnapshot, PersistenceError>>`
   - `listSessions(): Promise<SessionSummary[]>` — list available sessions.
   - Store snapshots as JSON files under `sessions/` directory (or configurable `LOGOS_DATA_DIR`).
   - Include `schemaVersion` in every snapshot.
2. Auto-save after each completed agent turn (not after every keystroke).
3. Save on SIGINT/SIGTERM.
4. Atomic writes: write to temp file, then rename.

##### Files / Areas Likely Affected

- `src/persistence/snapshot-store.ts` (new)
- `src/persistence/index.ts` (new)

##### Acceptance Criteria

- Snapshot saved after agent turn.
- Snapshot loaded on session start.
- Multiple sessions can be listed.
- Corrupted snapshot → error with recovery options.
- Atomic write prevents partial saves.

##### Tests / Validation

- Unit test: save and load snapshot round-trip.
- Unit test: list sessions returns correct IDs.
- Unit test: load corrupted snapshot → error.
- Unit test: atomic write (temp file + rename).

##### Dependencies

- Step 3.8 — State engine dispatch (snapshot generation)

---

#### Step 13.2 — Implement session event log

##### Objective

Implement append-only event logging for all meaningful state transitions. Events provide audit trail and enable future replay.

##### Why This Step Exists

Events explain how state changed. They are essential for debugging, auditing, and potentially replaying sessions.

##### Required Inputs

- `09-session-events-and-persistence.md` §6
- `architecture/04-data-and-persistence-architecture.md` §6

##### Relevant Docs

- `09-session-events-and-persistence.md`
- `architecture/04-data-and-persistence-architecture.md`

##### Tasks

1. Create `src/persistence/event-log.ts`:
   - `appendEvent(sessionId: string, event: SessionEvent): Promise<Result<void, PersistenceError>>`
   - `getEvents(sessionId: string): Promise<SessionEvent[]>`
   - `getEventsByType(sessionId: string, type: SessionEventType): Promise<SessionEvent[]>`
   - Store events as JSONL (newline-delimited JSON) under `sessions/<id>/events.jsonl`.
2. Emit events from the state engine on all significant transitions:
   - `SESSION_CREATED`, `PROFILE_SELECTED`, `NODE_SELECTED`, `USER_MESSAGE_ADDED`, `ASSISTANT_MESSAGE_ADDED`, `NODE_LIFECYCLE_CHANGED`, `CANONICAL_ANSWER_DRAFTED`, `CANONICAL_ANSWER_ACCEPTED`, `CANONICAL_ANSWER_MARKED_STALE`, `NODE_DEFERRED`, `NODE_BLOCKED`, `DOCUMENT_PREVIEW_GENERATED`, `EXPORT_GENERATED`, etc.

##### Files / Areas Likely Affected

- `src/persistence/event-log.ts` (new)
- `src/state-engine/dispatch.ts` (update — emit events)

##### Acceptance Criteria

- Every lifecycle transition generates an event.
- Every canonical answer change generates an event.
- Events are append-only (no overwrites).
- Events can be queried by type.

##### Tests / Validation

- Integration test: run complete flow, verify events logged for each transition.
- Unit test: append and read events.
- Unit test: event contains all required fields (id, sessionId, type, payload, createdAt).

##### Dependencies

- Step 13.1 — Snapshot persistence
- Step 1.5 — Session event types

---

#### Step 13.3 — Implement session resume with validation and repair

##### Objective

On launch, detect existing sessions, load the latest snapshot, validate runtime state, repair safe inconsistencies, and restore the session.

##### Why This Step Exists

Session resume is a core user need. The system must gracefully handle corrupted or stale data.

##### Required Inputs

- `09-session-events-and-persistence.md` §10
- `13-prototypes.md` Flow I §4.9

##### Relevant Docs

- `09-session-events-and-persistence.md`
- `architecture/04-data-and-persistence-architecture.md` §12
- `13-prototypes.md` §4.9

##### Tasks

1. Create `src/persistence/session-resume.ts`:
   - `resumeSession(sessionId?: string): Promise<Result<LogosRuntimeState, ResumeError>>`
   - If no `sessionId`, load latest session.
   - Load snapshot.
   - Validate `schemaVersion` — run migrations if needed.
   - Validate `activeNodeId` — if references non-existent node, clear it and enter `structure_overview`.
   - Validate `selectedProfileId` — if profile not found, prompt to re-select.
   - Validate node states: ensure accepted nodes have canonical answers.
   - Repair safe inconsistencies: clear invalid activeNodeId, mark stale answers, recompute document readiness.
   - Return restored state.
2. On idle screen, show `[Resume Session]` when sessions exist.
3. Implement schema migration:
   - `Migration { from: string; to: string; migrate(data): unknown }`
   - Never silently drop node conversations or accepted answers.

##### Files / Areas Likely Affected

- `src/persistence/session-resume.ts` (new)
- `src/persistence/migrations.ts` (new)
- `src/tui/screens/IdleScreen.tsx` (update — show resume option)

##### Acceptance Criteria

- Resume restores active node, profile, and all node states.
- Invalid activeNodeId is cleared with diagnostic.
- Missing profile triggers re-selection.
- Migrations run when schema version changes.
- Conversations are not lost during resume.

##### Tests / Validation

- Unit test: resume from valid snapshot.
- Unit test: resume with invalid activeNodeId → repaired.
- Unit test: resume with missing profile → error with recovery action.
- Unit test: migration preserves messages and canonical answers.
- E2E harness test: Flow I (Resume Session).

##### Dependencies

- Step 13.1 — Snapshot persistence
- Step 13.2 — Event log

---

### Phase 14 — Error Handling, Recovery, and Diagnostics

#### Step 14.1 — Implement error categorization and diagnostic reporting

##### Objective

Build a unified error handling system that categorizes all errors, produces user-facing messages, suggests recovery actions, and generates diagnostic reports.

##### Why This Step Exists

Errors must be explicit and recoverable. Users need clear, actionable messages — not cryptic stack traces.

##### Required Inputs

- `architecture/08-error-handling-and-recovery.md`
- `02-state-engine-canonical-spec.md` §13

##### Relevant Docs

- `architecture/08-error-handling-and-recovery.md`
- `architecture/02-runtime-architecture.md` §15

##### Tasks

1. Create `src/diagnostics/error-categories.ts`:
   - `RuntimeErrorCategory`: `"validation" | "invalid_state" | "llm_provider" | "structured_output" | "persistence" | "profile_schema" | "materialization" | "tui_rendering" | "export"`
   - `RuntimeError` with `code`, `category`, `message`, `recoverable`, `userFacingMessage?`, `details?`
2. Create `src/diagnostics/diagnostic-collector.ts`:
   - Collect `StateDiagnostic[]` during state engine operations.
   - Include error code, affected node/document, recovery actions.
3. Create `src/diagnostics/recovery-actions.ts`:
   - Map error codes to suggested recovery actions.
   - `getRecoveryActions(error: RuntimeError): RecoveryAction[]`
   - Recovery actions: `retry`, `reopen_node`, `open_missing_prerequisite`, `regenerate_canonical_answer`, `clear_invalid_active_node`, `export_recovery_bundle`, `restore_previous_snapshot`, `open_settings`.

##### Files / Areas Likely Affected

- `src/diagnostics/error-categories.ts` (new)
- `src/diagnostics/diagnostic-collector.ts` (new)
- `src/diagnostics/recovery-actions.ts` (new)
- `src/diagnostics/index.ts` (new)

##### Acceptance Criteria

- All errors carry category, code, and user-facing message.
- Diagnostics include recovery actions.
- State engine errors produce diagnostics (not raw exceptions).
- User-facing messages are specific and actionable (e.g., "Two required nodes are missing: Core Thesis, Central Tension").

##### Tests / Validation

- Unit test: error categorization for each category.
- Unit test: recovery action suggestions for common errors.
- Unit test: diagnostic collection during state engine operation.

##### Dependencies

- Step 3.8 — State engine (error-producing operations)

---

#### Step 14.2 — Implement error mode rendering in TUI

##### Objective

Render error states in the TUI: show the error message, diagnostic details, and recovery action buttons. The TUI must enter `error` mode for unrecoverable situations.

##### Why This Step Exists

When the state engine enters `error` mode, the TUI must render something useful — not crash or show a blank screen.

##### Required Inputs

- `architecture/08-error-handling-and-recovery.md` §10-11
- `13-prototypes.md` — error mode overview

##### Relevant Docs

- `architecture/08-error-handling-and-recovery.md`
- `13-prototypes.md`

##### Tasks

1. Create `src/tui/components/ErrorPanel.tsx`:
   - Renders when `mode === "error"`.
   - Shows user-facing error message.
   - Shows diagnostic details (code, category).
   - Shows recovery action buttons.
   - `[Retry]`, `[Reopen Node]`, `[Open Prerequisite]`, `[Export Recovery Bundle]`, `[Restore Previous Snapshot]`, `[Close]`.
2. Wire error mode into the rendering switch in `AppShell`.
3. Error mode should not lose current session state (allow recovery without restart).

##### Files / Areas Likely Affected

- `src/tui/components/ErrorPanel.tsx` (new)
- `src/tui/app-shell.tsx` (update)

##### Acceptance Criteria

- Error mode renders with clear message and recovery actions.
- User can dismiss error and return to previous mode.
- Recovery actions trigger appropriate state engine events.
- Fatal errors (e.g., persistence failure) are clearly distinguished from recoverable errors.

##### Tests / Validation

- Snapshot test: error mode with recoverable error.
- Snapshot test: error mode with fatal error.
- Manual: trigger error mode via invalid state, verify recovery actions.

##### Dependencies

- Step 14.1 — Error categorization
- Step 8.2 — TUI shell

---

### Phase 15 — Testing Architecture and End-to-End Flow Coverage

#### Step 15.1 — Implement transition matrix tests

##### Objective

Create a comprehensive test suite that validates every valid lifecycle transition and rejects every invalid one. Use a transition matrix approach.

##### Why This Step Exists

The lifecycle state machine is the core of the system. Exhaustive transition testing prevents regression in the most critical logic.

##### Required Inputs

- `04-node-lifecycle-and-question-state.md` §6-7
- `architecture/09-testing-architecture.md` §5

##### Relevant Docs

- `04-node-lifecycle-and-question-state.md`
- `architecture/09-testing-architecture.md`
- `13-prototypes.md` §1.2

##### Tasks

1. Create `tests/state-engine/transition-matrix.test.ts`:
   - For each `from` lifecycle × `to` lifecycle combination (10 × 10 = 100 combinations):
     - Assert expected validity (valid or invalid).
   - Use a test table approach for maintainability.
2. Cover edge cases:
   - `blocked → not_started` when dependency resolved.
   - `deferred → active` via resume.
   - `synthesized → accepted` (valid).
   - `synthesized → accepted` after user accept event only.
3. Ensure all invalid transitions from `04-node-lifecycle-and-question-state.md` §7 are tested.

##### Files / Areas Likely Affected

- `tests/state-engine/transition-matrix.test.ts` (new)

##### Acceptance Criteria

- 100 lifecycle transition combinations tested.
- All documented valid transitions pass.
- All documented invalid transitions are rejected.
- Tests run without LLM credentials (pure state engine).

##### Tests / Validation

- This step IS the test implementation.

##### Dependencies

- Step 3.4 — Lifecycle transitions

---

#### Step 15.2 — Implement contract and schema tests

##### Objective

Validate all type contracts with runtime schema checks, fixture validation, and shape assertions.

##### Why This Step Exists

TypeScript types provide compile-time safety. Runtime schema tests catch mismatches between docs, types, and actual data shapes.

##### Required Inputs

- `architecture/09-testing-architecture.md` §6
- `architecture/07-contracts-and-schemas.md` §13

##### Relevant Docs

- `architecture/09-testing-architecture.md`
- `architecture/07-contracts-and-schemas.md`

##### Tasks

1. Create `tests/contracts/profile-schema.test.ts`:
   - Validate example profiles against `LogosProfile` shape.
   - Validate that profile YAML files pass schema checks.
2. Create `tests/contracts/agent-turn-schema.test.ts`:
   - Validate mock LLM outputs against `AgentTurnOutput` shape.
   - Validate that invalid outputs are caught.
3. Create `tests/contracts/runtime-state-schema.test.ts`:
   - Validate that state snapshots match `LogosRuntimeState`.
4. Create `tests/contracts/render-snapshot.test.ts`:
   - Validate that `StateEngineSnapshot` contains all required fields.

##### Files / Areas Likely Affected

- `tests/contracts/profile-schema.test.ts` (new)
- `tests/contracts/agent-turn-schema.test.ts` (new)
- `tests/contracts/runtime-state-schema.test.ts` (new)
- `tests/contracts/render-snapshot.test.ts` (new)

##### Acceptance Criteria

- Valid fixtures pass schema checks.
- Intentionally broken fixtures fail with specific errors.
- All contract types have at least one valid example fixture.

##### Tests / Validation

- These ARE the tests.

##### Dependencies

- Phase 1 — All contract types

---

#### Step 15.3 — Implement persistence round-trip tests

##### Objective

Test save → load → resume cycles, migration preservation, and corrupted data recovery.

##### Why This Step Exists

Persistence bugs can silently lose user work. Round-trip tests verify that state survives the save/load cycle.

##### Required Inputs

- `architecture/09-testing-architecture.md` §10
- `architecture/04-data-and-persistence-architecture.md`

##### Relevant Docs

- `architecture/09-testing-architecture.md`
- `09-session-events-and-persistence.md`

##### Tasks

1. Create `tests/persistence/snapshot-roundtrip.test.ts`:
   - Save a session with multiple node states and canonical answers.
   - Load and verify exact match.
2. Create `tests/persistence/event-log.test.ts`:
   - Append events, read back, verify order and content.
3. Create `tests/persistence/resume-repair.test.ts`:
   - Load snapshot with invalid activeNodeId → verify repair.
   - Load snapshot with missing profile → verify error.
   - Load snapshot with different schema version → verify migration.
4. Create `tests/persistence/migration.test.ts`:
   - Test each migration preserves node messages and canonical answers.

##### Files / Areas Likely Affected

- `tests/persistence/snapshot-roundtrip.test.ts` (new)
- `tests/persistence/event-log.test.ts` (new)
- `tests/persistence/resume-repair.test.ts` (new)
- `tests/persistence/migration.test.ts` (new)

##### Acceptance Criteria

- Snapshot round-trip preserves all state fields.
- Events are append-only and ordered.
- Invalid state is repaired on resume.
- Migrations don't drop data.

##### Tests / Validation

- These ARE the tests.

##### Dependencies

- Phase 13 — Persistence

---

#### Step 15.4 — Implement materialization tests

##### Objective

Validate document materialization: correct assembly, missing/stale markers, partial previews, and export blocking.

##### Why This Step Exists

Document generation from accepted answers is the output contract. Materialization tests verify correctness of the final deliverable.

##### Required Inputs

- `architecture/09-testing-architecture.md` §11
- `07-document-materialization-spec.md`

##### Relevant Docs

- `architecture/09-testing-architecture.md`
- `07-document-materialization-spec.md`

##### Tasks

1. Create `tests/materialization/document-materializer.test.ts`:
   - Materialize document from all accepted nodes → verify content.
   - Materialize with missing required node → verify `[MISSING]` marker.
   - Materialize with stale source → verify `[⚠ STALE]` marker.
   - Verify partial preview is allowed.
   - Verify export is blocked for incomplete documents.
   - Verify raw conversation is not used as final source.

##### Files / Areas Likely Affected

- `tests/materialization/document-materializer.test.ts` (new)

##### Acceptance Criteria

- Full document materialization produces correct Markdown.
- Missing sections are flagged.
- Stale sections are flagged.
- Export gating works.

##### Tests / Validation

- These ARE the tests.

##### Dependencies

- Phase 12 — Document materialization

---

### Phase 16 — Local Development, Tooling, and Deployment Baseline

#### Step 16.1 — Implement CLI/TUI entry point and command routing

##### Objective

Build the `logos` CLI entry point that starts the TUI, handles command-line arguments, and routes to appropriate screens.

##### Why This Step Exists

Users need a single entry point to launch the LOGOS Engine.

##### Required Inputs

- `architecture/10-local-development-and-deployment.md`
- Existing CLI code in `src/cli/`

##### Relevant Docs

- `architecture/10-local-development-and-deployment.md`
- `README.md`

##### Tasks

1. Create/update `src/cli/main.ts`:
   - Parse command-line arguments: `--profile`, `--session`, `--mock`, `--data-dir`.
   - Initialize persistence layer.
   - Detect existing sessions.
   - Initialize state engine.
   - Mount TUI with Ink.
2. Support commands via environment variables:
   - `LOGOS_USE_MOCK_LLM=true` → use mock provider.
   - `LOGOS_DATA_DIR` → set persistence directory.
   - `LOGOS_PROFILE_DIR` → set profile directory.
3. Wire the application layer between state engine and TUI.

##### Files / Areas Likely Affected

- `src/cli/main.ts` (update)
- `src/application/runtime.ts` (new — wires everything together)

##### Acceptance Criteria

- `logos` starts the TUI.
- `logos --mock` runs with mock LLM provider.
- `logos --profile startup` pre-selects a profile.
- `logos --session <id>` resumes a session.
- Exit on SIGINT/SIGTERM with auto-save.

##### Tests / Validation

- CLI smoke test: `logos --help` prints usage.
- CLI smoke test: `logos --mock` starts and renders idle screen.
- Manual: run TUI, navigate, exit.

##### Dependencies

- Step 13.1 — Persistence
- Step 8.2 — TUI shell
- Step 7.1 — Mock provider

---

#### Step 16.2 — Implement Markdown export

##### Objective

Build the Markdown export pathway: when a document is ready, export it as a `.md` file to the configured output directory.

##### Why This Step Exists

Markdown is the canonical output format for LOGOS Engine. It's the foundation for all other export formats.

##### Required Inputs

- `07-document-materialization-spec.md`
- `13-prototypes.md` Flow H §4.8

##### Relevant Docs

- `07-document-materialization-spec.md`
- `13-prototypes.md` §4.8
- `architecture/10-local-development-and-deployment.md` §11

##### Tasks

1. Create `src/outputs/markdown-exporter.ts`:
   - `exportMarkdown(documentId, state, profile): Promise<Result<GeneratedArtifact, ExportError>>`
   - Materialize document.
   - Write to configured output path.
   - Generate `GeneratedArtifact` metadata.
   - Handle file collisions (warn, version, or overwrite per policy).
2. Create `src/outputs/export-manager.ts`:
   - `getAvailableExports(state, profile): ExportAvailability[]`
   - Each export type: `{ type, available: boolean, blockedReason?: string, missingRequirements?: string[] }`
3. Wire export actions in TUI.

##### Files / Areas Likely Affected

- `src/outputs/markdown-exporter.ts` (new)
- `src/outputs/export-manager.ts` (new)
- `src/outputs/index.ts` (new)
- `src/tui/components/ExportPanel.tsx` (new/update)

##### Acceptance Criteria

- Ready document → Markdown file written with correct content.
- Incomplete document → export blocked with reason.
- Stale document → export blocked or warned.
- File collision → handled per policy.
- Export metadata stored in session.

##### Tests / Validation

- Unit test: export ready document → file created with content.
- Unit test: export incomplete document → error with missing nodes listed.
- Unit test: export stale document → blocked.
- E2E harness test: Flow H.

##### Dependencies

- Step 12.1 — Document materializer
- Step 3.7 — Document readiness

---

### Phase 17 — Outcome Generation and Export Paths

#### Step 17.1 — Implement HTML artifact generation placeholder

##### Objective

Create the HTML export pathway: a basic HTML artifact rendered from accepted document content, with proper escaping for local viewing.

##### Why This Step Exists

HTML artifacts provide a readable, shareable format for documentation review.

##### Required Inputs

- `architecture/10-local-development-and-deployment.md` §11
- `13-prototypes.md` §3.12

##### Relevant Docs

- `architecture/10-local-development-and-deployment.md`
- `13-prototypes.md` §3.12

##### Tasks

1. Create `src/outputs/html-exporter.ts`:
   - `exportHtml(documentId, state, profile): Promise<Result<GeneratedArtifact, ExportError>>`
   - Generate basic HTML shell with document content.
   - Escape content properly (XSS-safe).
   - Include metadata header.
   - Style minimally for readability (monospace, terminal-like).
2. HTML is a derived artifact, not canonical source.
3. Generate HTML only when Markdown export is valid.

##### Files / Areas Likely Affected

- `src/outputs/html-exporter.ts` (new)

##### Acceptance Criteria

- HTML artifact generated from accepted document.
- Content is properly escaped.
- File is valid HTML.
- Export blocked on incomplete/stale documents.

##### Tests / Validation

- Unit test: HTML export produces valid HTML structure.
- Unit test: special characters are escaped.
- Unit test: blocked on incomplete document.

##### Dependencies

- Step 16.2 — Markdown export

---

#### Step 17.2 — Implement Agent Pack generation placeholder

##### Objective

Create the Agent Pack export pathway: a portable context package for downstream AI agents, containing canonical answers, document structure, and metadata.

##### Why This Step Exists

Agent Packs enable the LOGOS Engine outputs to feed into other AI tools and coding agents.

##### Required Inputs

- `architecture/10-local-development-and-deployment.md`
- `13-prototypes.md` §3.12

##### Relevant Docs

- `architecture/10-local-development-and-deployment.md`
- `13-prototypes.md` §3.12

##### Tasks

1. Create `src/outputs/agent-pack-exporter.ts`:
   - `exportAgentPack(documentIds, state, profile): Promise<Result<GeneratedArtifact, ExportError>>`
   - Aggregate all accepted canonical answers.
   - Include document structure and dependency information.
   - Output as structured JSON or Markdown package.
   - Label as derived, non-canonical.
   - Include source traceability metadata.

##### Files / Areas Likely Affected

- `src/outputs/agent-pack-exporter.ts` (new)

##### Acceptance Criteria

- Agent Pack contains all accepted answers from specified documents.
- Includes metadata: source nodes, timestamps, profile version.
- Labeled as `[derived]`, non-canonical.
- Export blocked on incomplete documents.

##### Tests / Validation

- Unit test: agent pack generated with correct structure.
- Unit test: includes all accepted answers.
- Unit test: blocked on incomplete document.

##### Dependencies

- Step 16.2 — Markdown export

---

#### Step 17.3 — Implement export panel in TUI

##### Objective

Render the export/outcome generation screen in the TUI, showing available exports, blocked exports with reasons, and export actions.

##### Why This Step Exists

Users need a unified view of all export options and what's blocking each.

##### Required Inputs

- `13-prototypes.md` §3.12 — export state prototype
- Flow H §4.8

##### Relevant Docs

- `13-prototypes.md` §3.12, §4.8
- `08-tui-state-and-rendering-contract.md`

##### Tasks

1. Create `src/tui/components/ExportPanel.tsx`:
   - Renders export options list.
   - Available exports: `✓ Markdown`, `✓ HTML`.
   - Blocked exports: `⚠ Agent Pack` with reason.
   - For blocked exports: show missing requirements.
   - Export action triggers generation and file write.
   - Shows output path on success.
   - Shows `[Close]` action.
2. Wire into main panel rendering switch.

##### Files / Areas Likely Affected

- `src/tui/components/ExportPanel.tsx` (new/update)
- `src/tui/app-shell.tsx` (update)

##### Acceptance Criteria

- Export panel shows available and blocked exports.
- Blocked exports explain why.
- Successful export shows output path.
- Exports produce correct files on disk.

##### Tests / Validation

- Snapshot test: export panel with all exports available.
- Snapshot test: export panel with blocked exports.
- Manual TUI walkthrough: Flow H.

##### Dependencies

- Step 16.2 — Markdown export
- Step 17.1 — HTML export
- Step 17.2 — Agent Pack export

---

### Phase 18 — Hardening, Documentation, and Implementation Handoff

#### Step 18.1 — Implement remaining flow tests (E-J)

##### Objective

Complete the end-to-end flow test suite for Flows E through J (Deferred, Blocked, Document Preview, Export, Resume, Change Profile).

##### Why This Step Exists

Comprehensive flow coverage provides regression protection and validates the architecture.

##### Required Inputs

- `13-prototypes.md` §4.5-4.10

##### Relevant Docs

- `13-prototypes.md` Part 4
- `architecture/09-testing-architecture.md`

##### Tasks

1. Complete Flow E test (Deferred Node).
2. Complete Flow F test (Blocked Node).
3. Complete Flow G test (Document Preview).
4. Complete Flow H test (Export).
5. Complete Flow I test (Resume Session).
6. Complete Flow J test (Change Profile).

##### Files / Areas Likely Affected

- `tests/flows/flow-e-deferred.test.ts`
- `tests/flows/flow-f-blocked.test.ts`
- `tests/flows/flow-g-document-preview.test.ts`
- `tests/flows/flow-h-export.test.ts`
- `tests/flows/flow-i-resume.test.ts`
- `tests/flows/flow-j-change-profile.test.ts`

##### Acceptance Criteria

- All 10 prototype flows pass as automated tests.
- No LLM credentials required.
- Tests run in CI.

##### Tests / Validation

- These ARE the tests.

##### Dependencies

- Phase 7 (conversation harness), Phase 13 (persistence), Phase 12 (materialization)

---

#### Step 18.2 — Add TUI snapshot tests for all 13 states

##### Objective

Create snapshot tests for all 13 TUI states defined in `13-prototypes.md`, ensuring every rendered state matches the wireframe expectations.

##### Why This Step Exists

Snapshot tests prevent visual regressions and enforce that state-driven rendering rules are followed.

##### Required Inputs

- `13-prototypes.md` Part 3 — all 13 state prototypes

##### Relevant Docs

- `13-prototypes.md` §3.1-3.13

##### Tasks

1. Create `tests/tui/state-snapshots.test.tsx`:
   - For each state: idle, structure_overview, not_started, active, needs_clarification, needs_refinement, synthesized, accepted, deferred, blocked, document_preview, export, settings.
   - Render with test renderer (Ink's `render`).
   - Capture snapshot (text output).
   - Verify key elements present: status symbols, action labels, message content.

##### Files / Areas Likely Affected

- `tests/tui/state-snapshots.test.tsx` (new)

##### Acceptance Criteria

- All 13 states have snapshot tests.
- Snapshots include status symbols and action labels.
- Tests catch when rendering rules change unintentionally.

##### Tests / Validation

- These ARE the tests.

##### Dependencies

- Phase 8-12 — All TUI components

---

#### Step 18.3 — Implement diagnostics panel and logging

##### Objective

Add a diagnostics panel to the TUI that shows session-level diagnostics: errors, warnings, stale nodes, blocked exports, and recovery suggestions.

##### Why This Step Exists

Users need visibility into system health. Diagnostics provide the "dashboard" view of session state.

##### Required Inputs

- `architecture/08-error-handling-and-recovery.md` §12

##### Relevant Docs

- `architecture/08-error-handling-and-recovery.md`
- `08-tui-state-and-rendering-contract.md`

##### Tasks

1. Create `src/tui/components/DiagnosticsPanel.tsx`:
   - Shows collected `StateDiagnostic[]`.
   - Groups by severity: error, warning, info.
   - Shows affected nodes/documents.
   - Shows suggested recovery actions.
   - Toggle with keyboard shortcut (e.g., Ctrl+D).
2. Wire diagnostics collection into application layer.

##### Files / Areas Likely Affected

- `src/tui/components/DiagnosticsPanel.tsx` (new)
- `src/tui/app-shell.tsx` (update)

##### Acceptance Criteria

- Diagnostics panel accessible via keyboard shortcut.
- Errors and warnings grouped by severity.
- Recovery actions listed for each diagnostic.
- Panel can be dismissed.

##### Tests / Validation

- Snapshot test: diagnostics panel with errors.
- Manual: open diagnostics during session, verify contents.

##### Dependencies

- Step 14.1 — Error categorization

---

#### Step 18.4 — Add sample profile and walkthrough documentation

##### Objective

Bundle a complete sample profile ("Startup" from the prototypes) and write developer/user walkthrough documentation.

##### Why This Step Exists

New users and developers need a concrete example to understand the system's behavior without configuring a LLM provider.

##### Required Inputs

- `13-prototypes.md` wireframes (references a "Startup" profile)
- `10-profile-and-node-schema-spec.md`

##### Relevant Docs

- `10-profile-and-node-schema-spec.md`
- `13-prototypes.md`
- `architecture/10-local-development-and-deployment.md`

##### Tasks

1. Create `profiles/startup.yml` — a complete profile with:
   - 3 phases (Foundation, Validation, Product)
   - Multiple documents per phase
   - 10-12 nodes with canonical questions, coverage topics, sufficiency criteria
   - Dependency declarations
   - Materialization rules
2. Create `docs/walkthrough.md`:
   - Step-by-step: install, start TUI, select profile, complete first node, accept, preview document, export.
   - With mock provider (no API key needed).
3. Create `docs/development.md`:
   - Development setup, architecture overview, module guide, testing guide.

##### Files / Areas Likely Affected

- `profiles/startup.yml` (new)
- `docs/walkthrough.md` (new)
- `docs/development.md` (new)

##### Acceptance Criteria

- Sample profile loads without errors.
- Walkthrough can be followed with mock LLM.
- Development guide covers module structure and testing.

##### Tests / Validation

- Unit test: load sample profile → valid.
- Manual: follow walkthrough from start to export.

##### Dependencies

- Step 16.1 — CLI entry point

---

#### Step 18.5 — Final quality gate and hardening

##### Objective

Run the full quality gate (`pnpm check`), fix all failures, ensure all tests pass, verify architecture boundaries, and produce a release-ready baseline.

##### Why This Step Exists

The project must pass all gates before being considered implementation-complete. This step is the final hardening pass.

##### Required Inputs

- All previous steps

##### Relevant Docs

- `architecture/09-testing-architecture.md`
- `architecture/10-local-development-and-deployment.md` §12

##### Tasks

1. Run `pnpm check`:
   - `pnpm typecheck` → zero errors.
   - `pnpm lint` → zero warnings.
   - `pnpm test` → all tests pass.
2. Verify architecture boundaries:
   - No TUI → LLM direct imports.
   - No state engine → terminal imports.
   - No LLM module → state mutation imports.
3. Verify mock LLM works for all flows.
4. Verify persistence round-trips.
5. Verify all 10 flow prototypes pass.
6. Verify all 13 state snapshots render.
7. Run manual smoke test: complete first-use flow without real LLM.
8. Document any known limitations in a `LIMITATIONS.md`.

##### Files / Areas Likely Affected

- `LIMITATIONS.md` (new)
- Various files (fixes)

##### Acceptance Criteria

- `pnpm check` exits 0.
- All 10 flow tests pass.
- All 13 state snapshot tests pass.
- Architecture boundaries enforced.
- Mock LLM flow works end-to-end.

##### Tests / Validation

- `pnpm check` includes all gates.

##### Dependencies

- All previous phases

---

## 6. Dependency Map

```
Phase 0 (Baseline)
 └─ Phase 1 (Core Types)
     ├─ Phase 2 (Profiles)
     │   ├─ Phase 3 (State Engine)
     │   │   ├─ Phase 4 (Conversation Runtime)
     │   │   │   ├─ Phase 5 (Prompt Orchestration)
     │   │   │   │   ├─ Phase 6 (Agent Turn Contract)
     │   │   │   │   │   ├─ Phase 7 (Mock LLM)
     │   │   │   │   │   │   ├─ Phase 8 (TUI Rendering)
     │   │   │   │   │   │   │   ├─ Phase 9 (Sidebar/Navigation)
     │   │   │   │   │   │   │   │   ├─ Phase 10 (Lifecycle Flows)
     │   │   │   │   │   │   │   │   │   ├─ Phase 11 (Canonical Answer Hardening)
     │   │   │   │   │   │   │   │   │   ├─ Phase 12 (Document Materialization)
     │   │   │   │   │   │   │   │   │   │   ├─ Phase 16 (CLI + Markdown Export)
     │   │   │   │   │   │   │   │   │   │   │   ├─ Phase 17 (Outcome Generation)
     │   │   │   │   │   │   │   │   │   ├─ Phase 13 (Persistence)
     │   │   │   │   │   │   │   │   │   │   ├─ Phase 15 (Testing Architecture)
     │   │   │   │   │   │   │   │   │   ├─ Phase 14 (Error Handling)
     │   │   │   │   │   │   │   │   │   │   └─ Phase 18 (Hardening)
```

**Key dependency chain:**
Contracts → Profiles → State Engine → Conversation Runtime → Prompt Orchestration → Agent Turn → Mock LLM → TUI → Full Integration → Persistence → Materialization → Export → Testing → Hardening

**Parallelizable work:**
- Phase 14 (Error Handling) can be developed in parallel with Phases 10-13.
- Phase 15 (Testing) can run concurrently with Phases 10-14.
- Phase 17 (HTML, Agent Pack) can be developed after Phase 16 (Markdown Export).
- TUI snapshot tests (Step 18.2) can be written incrementally during Phases 8-10.

---

## 7. Testing Strategy Across Phases

### Test Layers

| Layer | Scope | Phases Covered |
|---|---|---|
| **Unit tests** | Individual functions: lifecycle guards, action computation, completeness, mode resolution | Phases 1-6 |
| **Transition matrix tests** | Every lifecycle transition combination (100 combos) | Phase 3 |
| **Contract/schema tests** | Type shape validation, fixture validation | Phases 1-2 |
| **Integration tests** | State engine + conversation runtime + prompt orchestrator (no TUI, no LLM) | Phases 3-6 |
| **Mock LLM tests** | State engine + prompt orchestrator + mock provider | Phase 7 |
| **E2E flow tests** | All 10 prototype flows with mock LLM | Phase 7, 15 |
| **Persistence tests** | Save/load round-trip, migration, resume repair | Phase 13 |
| **Materialization tests** | Document assembly, partial previews, export gating | Phase 12 |
| **TUI snapshot tests** | All 13 states rendered as text snapshots | Phase 8-12, 18 |
| **Architecture boundary tests** | Import violation detection | Phase 0, 18 |
| **Manual smoke tests** | Terminal walkthroughs | Phases 8, 16, 18 |

### CI Requirements

- `pnpm typecheck` — no errors.
- `pnpm lint` — no warnings.
- `pnpm test` — all unit, integration, contract, flow, and snapshot tests pass.
- No real LLM credentials required in CI.
- Mock LLM provider used for all AI-dependent tests.
- Architecture boundary lint must pass.

---

## 8. Implementation Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| TUI becomes form-like | High | Medium | Enforce conversation-first design; sidebar is navigation only; all rendering tests check this |
| LLM state leakage | High | Medium | Strict AgentTurnOutput validation; repair loop with limit; state engine guards on all transitions |
| Architecture boundary erosion | High | Medium | Boundary lint rules; ADR documentation; code review gates |
| Complexity explosion in state engine | Medium | Medium | Pure functions; transition matrix; small, testable sub-modules |
| Persistence data loss | High | Low | Atomic writes; snapshot + event log dual storage; schema versioning |
| Mock/real LLM divergence | Medium | Medium | Contract tests validate both produce AgentTurnOutput; snapshot tests use both |
| TUI rendering performance | Low | Medium | Virtual scroll for long conversations; sidebar re-render optimization |
| Profile migration complexity | Low | Low | Schema versioning; explicit migrations; backup before migration |
| Token budget overflows | Medium | Medium | Context assembly priority rules; summary fallback; budget estimation |
| Staleness cascade false positives | Low | Medium | Explicit dependency graph; staleness only on accepted nodes; configurable strictness |

---

## 9. Recommended First Execution Slice

The first working slice targets the minimum end-to-end path:

```
Select profile → View structure → Select node → Answer node
→ Mock agent asks refinement → User responds
→ Mock canonical answer generated → User accepts
→ Document preview shows accepted answer
```

**This corresponds to:**
- Phase 0 (Steps 0.1-0.3): Project baseline
- Phase 1 (Steps 1.1-1.5): All contracts and types
- Phase 2 (Steps 2.1-2.2): Profile loading and dependency graph
- Phase 3 (Steps 3.1-3.8): Complete state engine
- Phase 4 (Steps 4.1-4.3): Conversation runtime
- Phase 5 (Steps 5.1-5.3): Prompt orchestration
- Phase 6 (Steps 6.1-6.3): Agent turn contract and validation
- Phase 7 (Steps 7.1-7.2): Mock LLM and flow harness
- Phase 8 (Steps 8.1-8.3): TUI rendering
- Phase 9 (Steps 9.1-9.2): Sidebar navigation
- Phase 10 (Steps 10.1-10.3): Lifecycle interaction flows
- Phase 12 (Step 12.1): Basic document materialization

**Deferred for later slices:**
- Full persistence (Phase 13)
- HTML/Agent Pack exports (Phase 17)
- Settings panel (minimal placeholder only)
- Advanced staleness cascade (Phase 11)
- Error recovery UI (Phase 14)

This validates the architecture without depending on full LLM behavior or production persistence.

---

## 10. Definition of Done

The LOGOS Engine implementation is complete when:

1. **All 10 prototype flows** from `13-prototypes.md` pass as automated E2E tests with the mock LLM provider.
2. **All 13 TUI states** render correctly as verified by snapshot tests.
3. **All lifecycle transitions** pass the 100-combination transition matrix test.
4. **Architecture boundaries** are enforced by lint rules: TUI does not import LLM provider, state engine does not import terminal libraries, etc.
5. **Mock LLM provider** enables complete development and testing without network or API keys.
6. **Session persistence** supports save, load, resume, and migration without data loss.
7. **Document materialization** produces correct Markdown from accepted canonical answers.
8. **Export pathways** (Markdown, HTML, Agent Pack) work with correct gating.
9. **`pnpm check`** passes with zero errors across typecheck, lint, and test.
10. **Sample profile** (`startup.yml`) enables a complete first-use walkthrough with mock provider.
11. **ADR records** document all major architecture decisions.
12. **Walkthrough documentation** enables a new developer to install and run the full flow.

---

## Open Questions / Required Decisions

| Area | Question | Impact | Recommended Default |
|---|---|---|---|
| TUI library | Continue with Ink (React for terminal) or switch? | Medium — existing code uses Ink; changing requires full TUI rewrite | Continue with Ink (existing `src/tui/` components can be adapted) |
| Persistence format | JSON files or SQLite? | Low — JSON is simpler for MVP, SQLite better for production | JSON files for MVP (Phase 13), SQLite migration path documented |
| Prompt format | Continue with TypeScript template literals or load from `.md` files? | Low — `.md` files enable non-developer editing | `.md` files in `prompts/` directory, loaded at startup |
| Type validation | Use Zod or hand-rolled validators? | Low — Zod is faster to develop, but adds dependency | Use Zod (existing dependency in `package.json`); hand-rolled for runtime-critical paths if performance needed |
| Profile format | Continue with YAML or switch to TypeScript definitions? | Low — YAML is more portable; TypeScript is more type-safe | YAML for profiles; TypeScript for contracts |
| Document preview | Inline, overlay/modal, or right-side panel? | Low — affects TUI layout only | Overlay/modal (simplest for MVP); right-side panel deferred |
| Settings scope | Full implementation or placeholder? | Low — settings are not core to the first slice | Placeholder screen with language/depth toggles (see `13-prototypes.md` §3.13) |
