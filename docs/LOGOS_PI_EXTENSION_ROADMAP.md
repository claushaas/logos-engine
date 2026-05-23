# LOGOS Pi Extension Implementation Roadmap

## Purpose And Scope

This roadmap defines the sequential implementation plan for redesigning LOGOS Engine into a conversational Pi Coding Agent extension backed by an independent LOGOS Core.

This is an implementation roadmap only. It does not implement code, create issues, or modify source files.

The roadmap is governed by:

1. `AGENTS.md`
2. `docs/LOGOS_PI_EXTENSION_SPEC.md`
3. `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md`
4. `docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md`
5. The current repository state inspected during roadmap creation
6. Official Pi extension documentation and installed Pi types/examples

## Audited Repository Facts

- [Fact] `src/` exists as an empty directory; it contains zero tracked or untracked files.
- [Fact] `tests/` does not currently exist.
- [Fact] `.pi/extensions/` does not currently exist.
- [Fact] `scripts/` does not currently exist.
- [Fact] `profiles/standard/` exists and contains the bundled Standard profile contracts, phase descriptors, document schemas, and Executive mapping/template files.
- [Fact] `git status --short` reports zero untracked or modified files.
- [Fact] `docs/LOGOS_PI_EXTENSION_SPEC.md`, `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md`, and `docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md` exist and consistently define the Pi-extension-first direction.
- [Fact] `package.json` still exposes a `logos` binary at `./dist/cli.js`, depends on `commander`, `ink`, `react`, `yaml`, and `zod`, and contains quality scripts for linting, tests, validation, build, smoke checks, security, and NFR evidence.
- [Fact] `tsconfig.json` includes only `src/**/*.ts` and `src/**/*.tsx` and uses strict `NodeNext` TypeScript settings.
- [Fact] `vitest.config.ts` expects tests under `tests/**/*.test.ts` and `tests/**/*.test.tsx`.
- [Fact] Official Pi extension docs state extensions are TypeScript modules loaded from `~/.pi/agent/extensions/` or `.pi/extensions/`, export a default factory receiving `ExtensionAPI`, register commands with `pi.registerCommand("name", ...)`, intercept conversational input with `pi.on("input", ...)`, can render custom messages with `pi.sendMessage(...)` plus `pi.registerMessageRenderer(...)`, can ask confirmations with `ctx.ui.confirm(...)`, and receive the current working directory as `ctx.cwd`.
- [Fact] Pi input processing checks extension commands before the `input` event. Therefore lifecycle command interruption cannot be solved only in `pi.on("input")`; each LOGOS command handler must call Core interruption logic when intake is active.

## Main Assumptions

- [Assumption] Because `src/` is empty in the current checkout, most implementation files listed below are likely new files rather than modifications.
- [Assumption] Because `tests/` is absent, all contract, unit, and integration tests listed below are likely new test files.
- [Assumption] The recommended architecture paths from `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` are acceptable unless future repository restoration reveals a better existing convention.
- [Assumption] `ctx.cwd` is the initial Pi project-root signal; Core should still validate project roots and path containment before writing.
- [Assumption] Pi session APIs may be used for UI/session continuity, but canonical LOGOS state remains project-local under `.logos/`.

## Contradictions And Reconciliation Notes

- [Risk] `README.md` describes a mature CLI/TUI implementation with many `src/` modules, `tests/`, `scripts/`, and 120+ test files, but the current checkout has an empty `src/`, no `tests/`, and no `scripts/` directory. Treat the README implementation inventory as stale until source files reappear.
- [Risk] `package.json` scripts reference `scripts/smoke-cli.js`, `scripts/smoke-package.js`, `scripts/security-check.js`, `scripts/nfr-evidence.js`, and `tests/validation-gate.test.ts`, but those files are absent in the current checkout. Phase 0 includes a spike to decide whether to restore, replace, or rewrite those gates.
- [Risk] `README.md` presents a TUI-first product model, while `AGENTS.md` and the Pi extension docs define the current Pi-extension-first contract. The Pi extension contract wins for this roadmap.
- [Decision] Do not rely on `docs/old-only-for-history/**` for implementation direction. Treat it as historical reference only.

## Dependency Ordering Summary

1. Audit and reconcile current repository gaps.
2. Establish Core contracts and filesystem/state ports.
3. Implement profile resolution because initialization, intake, validation, and generation depend on it.
4. Implement durable intake state and question registry.
5. Implement answer evaluation and intent routing.
6. Implement command interruption policy before Pi command/input routing is considered complete.
7. Implement generation preflight before writing generation outputs.
8. Implement Pi extension shell and command adapters.
9. Implement active-intake conversational input routing.
10. Implement rendering and confirmation flows.
11. Contain or deprecate legacy CLI/TUI assumptions.
12. Run end-to-end validation and release hardening.

## Actual Validation Commands From `package.json`

Use these exact scripts where applicable:

- `pnpm lint`
- `pnpm lint:biome`
- `pnpm lint:md`
- `pnpm typecheck`
- `pnpm test`
- `pnpm check:validation`
- `pnpm build`
- `pnpm smoke:cli`
- `pnpm smoke:package`
- `pnpm security:check`
- `pnpm nfr:evidence`
- `pnpm check`

[Risk] Many commands are expected to fail until missing `src/`, `tests/`, and `scripts/` files are restored or implemented.

## Phase 0 — Repository Audit And Contract Reconciliation

### Objective

Create an implementation baseline from the current checkout and identify which existing assets are authoritative, reusable, stale, missing, or unknown.

### Why This Phase Exists

The repository currently contains strong documentation contracts and profile data but lacks source and test implementation files. Implementation must not invent structure without first recording this gap and deciding how to proceed.

### Preconditions

- Current checkout is available.
- `AGENTS.md`, Pi extension spec, architecture, implementation plan, package config, profile files, and Pi docs have been inspected.

### Steps

#### Step 0.1 — Record Current Tree Reality

##### Goal

Produce a written audit of actual files and directories before creating implementation code.

##### Actions

- List tracked and untracked top-level directories.
- Verify whether `src/`, `tests/`, `.pi/extensions/`, and `scripts/` contain files.
- Verify which profile files exist under `profiles/standard/`.
- Record the absence of source, tests, and scripts as implementation blockers.

##### Files To Inspect

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/`
- `tests/`
- `.pi/extensions/`
- `scripts/`
- `profiles/standard/**`

##### Files Likely To Change

- None in this step except this roadmap or a future audit document if desired.

##### Tests To Add Or Update

- None. This is an audit step.

##### Acceptance Criteria

- The current repository reality is explicitly captured.
- Missing source/test/script directories are not silently ignored.
- The audit distinguishes facts from assumptions.

##### Notes / Risks

- [Risk] Restoring source from history may change later paths. Until then, treat implementation files as likely new.

##### Audit Result

- [Fact] `src/` exists as an empty directory; `find src -maxdepth 4 -type f` returns zero files.
- [Fact] `tests/` is absent; `find tests` fails with `No such file or directory`.
- [Fact] `.pi/extensions/` is absent; `find .pi/extensions` fails with `No such file or directory`.
- [Fact] `scripts/` is absent; `find scripts` fails with `No such file or directory`.
- [Fact] `profiles/standard/` exists and contains `docs.yml`, `document.schema.yml`, `README.md`, six phase descriptor files under `phases/`, document descriptors under `phases/<phase-id>/`, and Executive contracts under `executive/` (mappings, templates, schema, and generation config).
- [Fact] `git status --short` reports no untracked or modified files.
- [Fact] `git ls-files src/ tests/ scripts/ .pi/extensions/` returns zero tracked files for those paths.
- [Blocker] `tests/` is absent while `vitest.config.ts` expects tests under `tests/**/*.test.ts` and `tests/**/*.test.tsx`; no tests can run until the directory is created or the config is changed.
- [Blocker] `src/` is empty while `tsconfig.json` includes `src/**/*.ts` and `src/**/*.tsx`; `pnpm typecheck` and `pnpm build` will compile nothing and may fail if exports depend on missing modules.
- [Risk] `package.json` script `check:validation` references `tests/validation-gate.test.ts`, but `tests/` does not exist.
- [Risk] `package.json` scripts `smoke:cli`, `smoke:package`, `security:check`, and `nfr:evidence` reference `scripts/smoke-cli.js`, `scripts/smoke-package.js`, `scripts/security-check.js`, and `scripts/nfr-evidence.js`, but `scripts/` does not exist.
- [Risk] `package.json` bin entry `logos` points to `./dist/cli.js`, but no source exists to produce that artifact.
- [Assumption] Because `src/`, `tests/`, `.pi/extensions/`, and `scripts/` are all empty or absent, most implementation files in later phases are new files rather than modifications.

#### Step 0.2 — Inspect Legacy CLI/TUI Claims

##### Goal

Determine whether any CLI/TUI implementation exists and whether README claims match the checkout.

##### Actions

- Compare `README.md` described CLI/TUI paths with actual `src/` contents.
- Inspect `package.json` dependencies and bin configuration for legacy CLI/TUI signals.
- Record that `commander`, `ink`, and `react` dependencies are present but no implementation exists in `src/`.
- Classify README-described commands as stale or legacy until source is restored.

##### Files To Inspect

- `README.md`
- `package.json`
- `src/cli/**` if restored
- `src/tui/**` if restored

##### Files Likely To Change

- None in this step.

##### Tests To Add Or Update

- None in this audit step.

##### Acceptance Criteria

- CLI/TUI is not treated as authoritative when it conflicts with the Pi extension spec.
- Any restored CLI/TUI source is classified before use.

##### Notes / Risks

- [Risk] Package scripts and README may lag the Pi-extension-first direction.

##### Audit Result

- [Fact] `README.md` describes LOGOS Engine as a "local-first CLI/TUI engine" with an external CLI (`logos doctor`, `logos --help`, `logos --version`) and an interactive Ink-based TUI shell with slash commands (`/help`, `/status`, `/init`, `/continue`, `/generate`, `/validate`, `/diagnose`, `/graph`, `/config`, `/root`, `/executive`, `/outputs`).
- [Fact] `README.md` claims `src/cli/`, `src/tui/`, `src/commands/`, `src/agent-packs/`, `src/ai/`, `src/consistency/`, `src/dependency-graph/`, `src/executive/`, `src/fs/`, `src/generation/`, `src/html/`, `src/import/`, `src/init/`, `src/intake/`, `src/performance/`, `src/profiles/`, `src/provenance/`, `src/regeneration/`, `src/registers/`, `src/release/`, `src/runtime/`, `src/scanner/`, `src/security/`, `src/staleness/`, `src/state/`, `src/traceability/`, and `src/validation/` exist with implementation files.
- [Fact] `find src -maxdepth 5 -type f` returns zero files; `src/` is an empty directory with no subdirectories. No `src/cli/`, `src/tui/`, or `src/commands/` path exists.
- [Fact] `package.json` contains CLI/TUI-related dependencies: `commander` (`^14.0.3`), `ink` (`^7.0.2`), `react` (`^19.2.6`), plus devDependencies `@types/react` (`^19.2.14`) and `ink-testing-library` (`^4.0.0`).
- [Fact] `package.json` exposes a `logos` binary pointing to `./dist/cli.js`.
- [Fact] No source file exists to produce `./dist/cli.js`; `tsconfig.json` rootDir is `src/` and `src/` is empty.
- [Fact] `README.md` claims "120+ test files, ~3270 tests", but `tests/` does not exist in the current checkout.
- [Fact] `README.md` claims "All quality gates, security checks, smoke tests, and package validation pass deterministically", but `scripts/` and `tests/` are absent and those scripts cannot run.
- [Decision] README-described CLI/TUI behavior, source paths, and command inventory are classified as **stale/legacy claims** for this roadmap. They are not treated as current implementation truth.
- [Decision] `commander`, `ink`, and `react` dependencies are present in `package.json` but have no corresponding source in the current checkout. Their presence is recorded as a legacy artifact, not as a signal to continue TUI-first development.
- [Decision] The Pi-extension-first docs (`AGENTS.md`, `docs/LOGOS_PI_EXTENSION_SPEC.md`, `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md`) override README/TUI claims when there is conflict.
- [Risk] If legacy CLI/TUI source is restored from history, every module must be classified before reuse. Any command-first flow (`/continue`, `/generate --confirm`, `/init --confirm`) is incompatible with the Pi extension MVP and must be reconciled or deprecated.
- [Risk] The `logos` binary entry in `package.json` points to a non-buildable artifact. A future spike must decide whether to preserve, remove, or replace the binary.

#### Step 0.3 — Inspect Command, Intake, Generation, Validation, And State Paths

##### Goal

Identify any current implementation for commands, intake, generation, validation, profiles, or state persistence.

##### Actions

- Search `src/` for command handlers, Ink components, profile loaders, generators, validators, and state repositories.
- If files remain absent, mark these subsystems as new implementation required.
- If files are restored, classify each path against the migration table below.

##### Files To Inspect

- `src/**`
- `tests/**`
- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `profiles/standard/phases/**/*.yml`
- `profiles/standard/executive/**`

##### Files Likely To Change

- None in this step.

##### Tests To Add Or Update

- None in this audit step.

##### Acceptance Criteria

- All existing or absent subsystem paths are classified.
- No legacy command-first behavior is extended without reconciliation.

##### Notes / Risks

- [Risk] If old source reappears, it may encode `/continue`, `/generate --confirm`, or other command-first flows incompatible with the Pi extension MVP.

##### Audit Result

- [Fact] `src/` exists as an empty directory; `find src -maxdepth 6 -type f` returns zero files and `find src -maxdepth 6 -type d` returns only `src` itself.
- [Fact] `src/` contains no command handlers, no Pi extension command handlers, no Pi input routing code, no CLI command handlers, no TUI/Ink components, no intake implementation, no generation implementation, no validation implementation, no profile loading implementation, no state persistence implementation, no filesystem writer/path safety implementation, and no provider/AI adapter implementation.
- [Fact] `tests/` does not exist; no tests exist for any subsystem.
- [Fact] `profiles/standard/` contains profile contract data only (YAML and Markdown files defining phases, documents, sections, questions, schemas, mappings, and templates). It contains zero implementation source code.
- [Fact] `profiles/standard/docs.yml` defines the root documentation registry with phase registry, output model, global rules, quality model, dependency policy, and agent policy.
- [Fact] `profiles/standard/document.schema.yml` defines the canonical document contract with required fields, validation rules, output policies, and supported formats.
- [Fact] `profiles/standard/phases/` contains six phase descriptor YAML files and per-phase document descriptor YAML files; each document descriptor includes `centralQuestion`, `sections`, `outputs` (canonical, artifacts, agentPacks), `completionCriteria`, `qualityChecks`, and `dependsOn`.
- [Fact] `profiles/standard/executive/` contains Executive generation config, a JSON schema, mapping YAML files, and Markdown/HTML template files.
- [Decision] All inspected implementation subsystems (command handlers, Pi extension commands, Pi input routing, CLI commands, TUI/Ink components, intake flow, generation, validation, profile loading, state persistence, filesystem/path safety, provider/AI adapters) are classified as **Absent — new implementation required**.
- [Decision] `profiles/standard/**` is classified as **Present as contract data only**; no code implementation exists to load, validate, or act on these contracts.
- [Decision] If legacy source is restored from history, every module must be classified against the Pi-extension-first contract before reuse. Any command-first flow (`/continue`, `/generate --confirm`) or TUI-specific component is incompatible with the Pi extension MVP.

##### Subsystem Classification Matrix

| Subsystem | Current Finding | Classification | Migration Direction |
| --- | --- | --- | --- |
| Command handlers | `src/` is empty | Absent — new implementation required | Create Core command-interruption API and Pi command adapters in later phases |
| Pi extension commands | No `.pi/extensions/` or `src/pi-extension/` files | Absent — new implementation required | Add project-local extension entrypoint in Phase 7 |
| Pi input routing | No source files | Absent — new implementation required | Implement input interception and intent routing in Phase 4 and Phase 7 |
| CLI commands | No `src/cli/` files; `logos` binary points to non-buildable artifact | Absent — new implementation required | Do not extend CLI-first behavior; decide binary fate in a future spike |
| TUI/Ink components | No `src/tui/` files; `ink` and `react` are unused dependencies | Absent — new implementation required | Do not create Ink components; Pi renders through `ctx.ui` |
| Intake flow | No `src/intake/` files | Absent — new implementation required | Implement durable intake state, question registry, and prompt selector in Phases 3–4 |
| Generation | No `src/generation/` files | Absent — new implementation required | Implement preflight, write-plan, and safe generation boundary in Phase 6 |
| Validation | No `src/validation/` files | Absent — new implementation required | Implement deterministic validation against profile contracts in Phase 2+ |
| Profile loading | No `src/profiles/` source files | Absent — new implementation required | Implement generic profile resolver and contract loaders in Phase 2 |
| State persistence | No `src/state/` files | Absent — new implementation required | Implement filesystem state repository and intake/generation state schemas in Phase 1–3 |
| Filesystem writing/path safety | No `src/fs/` files | Absent — new implementation required | Implement path-containment validation and safe writer ports in Phase 1 |
| Provider/AI adapters | No `src/ai/` files | Absent — new implementation required | Implement evaluator port and fake provider in Phase 4; reserve live provider integration |
| Tests | `tests/` does not exist | Absent — new implementation required | Create Vitest unit, integration, and contract tests starting in Phase 1 |
| Standard profile contracts | `profiles/standard/` contains full YAML contract data | Present as contract data only | Core profile loader must consume generically through `profiles/<profile-id>/` |

#### Step 0.4 — Produce Migration Classification Table

##### Goal

Classify current repository assets before implementation begins.

##### Actions

- Add or update this migration classification table in the implementation planning notes.
- Revisit the table if source files are restored later.

##### Files To Inspect

- `AGENTS.md`
- `docs/LOGOS_PI_EXTENSION_SPEC.md`
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md`
- `docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md`
- `README.md`
- `package.json`
- `src/**`
- `tests/**`
- `.pi/extensions/**`
- `profiles/standard/**`

##### Files Likely To Change

- `docs/LOGOS_PI_EXTENSION_ROADMAP.md`

##### Tests To Add Or Update

- None.

##### Acceptance Criteria

- The table below exists and is accepted as the Phase 0 baseline.

##### Notes / Risks

- [Dependency] Later phases must update this table if repository contents materially change.

| Path / Asset | Current Finding | Classification | Migration Direction |
|---|---|---|---|
| `AGENTS.md` | Present; defines agent operating contract, product direction, and source precedence | Keep as agent operating contract | Must be read before any non-trivial implementation session |
| `docs/LOGOS_PI_EXTENSION_SPEC.md` | Present; defines product contract, interaction model, lifecycle commands, and acceptance criteria | Keep as product contract | Governs behavior, interaction model, and acceptance tests |
| `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` | Present; defines Core/Pi boundaries, runtime flow, persistence contracts, and testing strategy | Keep as architecture contract | Governs Core/Pi boundaries, runtime flow, and architecture risks |
| `docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md` | Present; defines workstreams, tasks, contracts, tests, and exit criteria | Keep as implementation planning contract | Informs roadmap steps and workstreams |
| `docs/LOGOS_PI_EXTENSION_ROADMAP.md` | Present; defines sequential implementation plan updated by Phase 0 audit | Keep as current roadmap | Governs sequential implementation until superseded |
| `profiles/standard/**` | Present and structured; contains YAML contracts, phase descriptors, document schemas, Executive mappings/templates | Keep as bundled profile contract | Core profile loader must consume generically through `profiles/<profile-id>/` |
| `src/**` | Directory exists but contains zero files | Absent — new implementation required | Create `src/core/**` and `src/pi-extension/**` in later phases unless source is restored and reclassified |
| `tests/**` | Directory does not exist | Absent — new test suite required | Create Vitest unit, integration, contract, and extension tests starting in Phase 1 |
| `.pi/extensions/**` | Directory does not exist | Absent — new Pi adapter required | Add project-local extension entrypoint during Pi shell phase (Phase 7) |
| `scripts/**` | Directory does not exist; `package.json` scripts reference missing files | Absent — restore or rewrite required | Restore or rewrite smoke, package, security, and NFR scripts before release hardening |
| `README.md` CLI/TUI claims | Describes mature CLI/TUI source and tests absent from current checkout | Stale / legacy claim | Do not treat as implementation truth; reconcile after Pi extension MVP baseline exists |
| `package.json` bin `logos` | Points to `./dist/cli.js` but no source exists to produce it | Legacy artifact / needs spike | Decide later whether to preserve CLI shim, remove, or replace |
| `package.json` scripts referencing `scripts/**` | Reference `scripts/smoke-cli.js`, `scripts/smoke-package.js`, `scripts/security-check.js`, `scripts/nfr-evidence.js` which are absent | Legacy artifact / needs spike | Restore or rewrite before release hardening |
| `package.json` CLI/TUI dependencies | `commander`, `ink`, `react`, `@types/react`, `ink-testing-library` present but no corresponding source | Legacy artifact / needs spike | Keep only if needed for Pi extension or future TUI; otherwise remove or reclassify later |
| `tsconfig.json` | Present; strict `NodeNext` settings with `rootDir: src`, `outDir: dist` | Current config — keep and reconcile | Ensure `src/core/**` and `src/pi-extension/**` compile under these settings |
| `vitest.config.ts` | Present; expects `tests/**/*.test.ts` and `tests/**/*.test.tsx` | Current config — keep and reconcile | Works once `tests/` is created; no config change required for Phase 1+ |
| `docs/old-only-for-history/**` | Present; 74 historical markdown files | Historical only | May be read for context; must not drive implementation |

### Phase Acceptance Criteria

- Current repository gaps are documented.
- All existing assets are classified.
- Stale README/package claims are identified as risks.
- No implementation begins until Core/Pi/profile boundaries are restated.

### Validation Commands

- No required command.
- Optional: `git status --short`
- Optional: `find src tests profiles .pi scripts -maxdepth 4 -type f`

## Phase 1 — Core Boundary And Public API Stabilization

### Objective

Create or stabilize a Pi-independent LOGOS Core API that owns product behavior and can be tested without Pi, Ink, or TUI dependencies.

### Why This Phase Exists

The Pi extension must be an adapter over Core, not the place where intake, profile resolution, generation, or state transitions are implemented.

### Preconditions

- Phase 0 audit is complete.
- Any restored legacy source has been classified.

### Steps

#### Step 1.1 — Create Core Module Skeleton

##### Goal

Establish a Core location and module boundaries without importing Pi or UI code.

##### Actions

- Create `src/core/` as the product engine boundary.
- Add index exports only for stable Core contracts.
- Create subdirectories for config, profiles, intake, questions, evaluation, state, generation, validation, artifacts, and ports as needed.
- Add a boundary note in code comments or module README if the repository uses module docs.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md`
- `tsconfig.json`
- Any restored `src/**`

##### Files Likely To Change

- `src/core/index.ts`
- `src/core/config/**`
- `src/core/profiles/**`
- `src/core/intake/**`
- `src/core/state/**`
- `src/core/generation/**`
- `src/core/ports/**`

##### Tests To Add Or Update

- `tests/core/core-boundary.test.ts`

##### Acceptance Criteria

- Core compiles with no Pi imports.
- Core compiles with no Ink, React, or TUI imports.
- Test imports Core directly without a Pi runtime.

##### Notes / Risks

- [Risk] If legacy code is restored, extraction must preserve behavior only when compatible with the Pi spec.

#### Step 1.2 — Define Core Result And Message Contracts

##### Goal

Create structured Core result envelopes that Pi can render without owning product logic.

##### Actions

- Define `AssistantMessage`, `LogosErrorCode`, warning/blocker shapes, and command result envelopes.
- Ensure results include status, user-facing messages, blockers, warnings, changed paths, dry-run markers, metadata, and data where relevant.
- Keep result types free of Pi-specific types.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` sections 15 and 17
- `docs/LOGOS_PI_EXTENSION_SPEC.md` acceptance criteria

##### Files Likely To Change

- `src/core/messages.ts`
- `src/core/errors.ts`
- `src/core/result.ts`
- `src/core/index.ts`

##### Tests To Add Or Update

- `tests/core/result-contracts.test.ts`

##### Acceptance Criteria

- Result contracts are serializable plain TypeScript data.
- Core results can represent questions, follow-ups, contradictions, status, generation blockers, errors, and generation results.

##### Notes / Risks

- [Risk] Returning presentation-specific strings only will make Pi renderers brittle. Include structured fields.

#### Step 1.3 — Define Public Core API

##### Goal

Expose the stable API that the Pi extension will call.

##### Actions

- Define `initProject(input)`.
- Define `startIntake(input)`.
- Define `handleIntakeMessage(input)`.
- Define `stopIntake(input)`.
- Define `getStatus(input)`.
- Define `generate(input)`.
- Define or reserve `handleIntakeCommand(input)` for Phase 5 command interruption.
- Keep all inputs rooted in `projectRoot`, optional provider/evaluator ports, and explicit options.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 5.2
- `docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md`

##### Files Likely To Change

- `src/core/api.ts`
- `src/core/index.ts`
- `src/core/intake/intake-service.ts`
- `src/core/generation/generation-service.ts`

##### Tests To Add Or Update

- `tests/core/public-api.test.ts`

##### Acceptance Criteria

- All required Core APIs are exported.
- APIs can be invoked from tests with fake ports.
- No API accepts or returns Pi context objects.

##### Notes / Risks

- [Dependency] Later phases fill in behavior behind the stable API.

#### Step 1.4 — Define Filesystem And State Ports

##### Goal

Keep Core deterministic and testable while still supporting safe project-local persistence.

##### Actions

- Define ports for reading/writing config, intake state, generation state, profile contracts, and generated files.
- Implement a filesystem adapter behind the port, not inside pure planners.
- Add path containment validation for project-local writes.
- Add redaction/secrets rules for persisted data.

##### Files To Inspect

- `AGENTS.md` state and filesystem rules
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 13

##### Files Likely To Change

- `src/core/ports/filesystem.ts`
- `src/core/ports/state-repository.ts`
- `src/core/state/filesystem-state-repository.ts`
- `src/core/fs/path-safety.ts`

##### Tests To Add Or Update

- `tests/core/state-repository.test.ts`
- `tests/core/path-safety.test.ts`
- `tests/core/token-redaction.test.ts`

##### Acceptance Criteria

- Core services can run with in-memory fake ports.
- Filesystem writes are contained in the project root.
- Secret-like values are not persisted raw.

##### Notes / Risks

- [Risk] Direct filesystem access throughout Core will make dry-run and tests hard.

#### Step 1.5 — Add Dependency Boundary Tests

##### Goal

Prove Core remains independent from Pi and legacy TUI dependencies.

##### Actions

- Add tests that scan `src/core/**` import specifiers.
- Fail if Core imports `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `ink`, `react`, or `src/pi-extension/**`.
- If legacy TUI modules are restored, fail on Core importing `src/tui/**`.

##### Files To Inspect

- `package.json`
- `src/core/**`
- Any restored `src/tui/**`

##### Files Likely To Change

- `tests/core/core-boundary.test.ts`

##### Tests To Add Or Update

- `tests/core/core-boundary.test.ts`

##### Acceptance Criteria

- Boundary test fails on forbidden imports.
- Boundary test passes with Core-only imports.

##### Notes / Risks

- [Decision] Treat boundary regression as a release blocker.

### Phase Acceptance Criteria

- Core API exists and is independent from Pi, Ink, React, and TUI modules.
- Core result contracts are serializable and renderer-agnostic.
- State/filesystem ports exist.
- Boundary tests prove Core independence.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/core/core-boundary.test.ts`
- `pnpm lint:biome`

## Phase 2 — Profile Resolution

### Objective

Make active profile resolution generic, explicit, persisted, and owned by Core.

### Why This Phase Exists

Questions, validation, generation, artifacts, and Executive outputs must derive from `profiles/<activeProfileId>/`, defaulting to `profiles/standard/` only through Core fallback logic.

### Preconditions

- Phase 1 Core API and state ports exist.
- `profiles/standard/` remains present.

### Steps

#### Step 2.1 — Define LOGOS Config Schema With Active Profile

##### Goal

Persist the active profile id in project-local config.

##### Actions

- Define `.logos/config.yml` schema with `activeProfileId`.
- Default missing `activeProfileId` to `standard` during initialization and config loading.
- Add schema validation for invalid profile ids.

##### Files To Inspect

- `profiles/standard/README.md`
- `profiles/standard/docs.yml`
- `AGENTS.md` Profile Resolution Policy

##### Files Likely To Change

- `src/core/config/config-schema.ts`
- `src/core/config/load-config.ts`
- `src/core/config/write-config.ts`
- `src/core/state/filesystem-state-repository.ts`

##### Tests To Add Or Update

- `tests/core/config-schema.test.ts`
- `tests/core/init-project-profile.test.ts`

##### Acceptance Criteria

- `/logos-init` with no explicit profile persists `activeProfileId: standard`.
- Config loading defaults to `standard` only when no id is configured.

##### Notes / Risks

- [Risk] Do not hardcode `profiles/standard` outside the default profile id fallback.

#### Step 2.2 — Implement Generic Profile Resolver

##### Goal

Map `activeProfileId` to `profiles/<profile-id>/` and validate required contracts.

##### Actions

- Implement `resolveActiveProfile(projectRoot, config)` in Core.
- Validate profile directory existence.
- Validate required contracts such as `docs.yml`, `document.schema.yml`, phase registry files, and Executive contracts when generation needs them.
- Return structured statuses: resolved, not found, invalid.

##### Files To Inspect

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `profiles/standard/phases/**/*.yml`
- `profiles/standard/executive/**`

##### Files Likely To Change

- `src/core/profiles/profile-resolver.ts`
- `src/core/profiles/profile-contracts.ts`
- `src/core/profiles/profile-errors.ts`

##### Tests To Add Or Update

- `tests/core/profile-resolution.test.ts`

##### Acceptance Criteria

- `standard` resolves to `profiles/standard/`.
- `custom-profile` resolves to `profiles/custom-profile/` when present.
- Missing directories return `profile_not_found`.
- Invalid contracts return `profile_invalid`.

##### Notes / Risks

- [Decision] The Pi extension must not inspect profile internals.

#### Step 2.3 — Load Profile Contracts Through Resolver

##### Goal

Ensure questions, validation, generation, artifacts, and Executive outputs derive from the active profile.

##### Actions

- Implement loaders for root registry, phase descriptors, document descriptors, schemas, artifacts, agent packs, and Executive mapping contracts.
- Convert local section questions into an initial question registry model.
- Preserve document ids, phase ids, section ids, required flags, central questions, and output paths.

##### Files To Inspect

- `profiles/standard/docs.yml`
- `profiles/standard/phases/*.yml`
- `profiles/standard/phases/*/*.yml`
- `profiles/standard/executive/executive-generation.yml`
- `profiles/standard/executive/mappings/*.yml`

##### Files Likely To Change

- `src/core/profiles/load-profile-contracts.ts`
- `src/core/questions/profile-question-registry.ts`
- `src/core/validation/profile-validation.ts`
- `src/core/generation/profile-generation-contracts.ts`

##### Tests To Add Or Update

- `tests/core/profile-contract-loading.test.ts`
- `tests/core/profile-driven-questions.test.ts`
- `tests/core/profile-driven-generation.test.ts`

##### Acceptance Criteria

- Intake questions load from the resolved active profile.
- Validation rules load from the resolved active profile.
- Generation and Executive output rules load from the resolved active profile.
- No subsystem reads `profiles/standard` directly except through resolver defaulting.

##### Notes / Risks

- [Risk] Current profile stores guiding questions inside document sections, not a separate question bank. The first implementation should adapt this shape rather than invent a new required file.

#### Step 2.4 — Gate Core APIs On Profile Resolution

##### Goal

Block initialization, intake, and generation when the active profile is missing or invalid.

##### Actions

- Make `initProject` resolve and validate the selected/default profile before writing state.
- Make `startIntake` block with `profile_not_found` and not enter `intake_active` when the active profile is missing.
- Make `generate` preflight block with `profile_not_found` when missing.
- Make `getStatus` report missing or invalid profile as a blocker.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 12
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 6

##### Files Likely To Change

- `src/core/api.ts`
- `src/core/init/init-project.ts`
- `src/core/intake/start-intake.ts`
- `src/core/generation/generate.ts`
- `src/core/status/get-status.ts`

##### Tests To Add Or Update

- `tests/core/missing-profile-blocks-intake.test.ts`
- `tests/core/missing-profile-blocks-generation.test.ts`
- `tests/core/status-profile-blockers.test.ts`

##### Acceptance Criteria

- Missing profile blocks `/logos-init`, `/logos-start`, and `/logos-generate` with `profile_not_found`.
- Missing profile status does not activate intake.
- `/logos-status` reports the blocker.

##### Notes / Risks

- [Dependency] This phase must complete before reliable intake and generation tests.

### Phase Acceptance Criteria

- `activeProfileId` is persisted and defaults to `standard`.
- Active profile resolution is generic through `profiles/<profile-id>/`.
- Profile-derived questions, validation, generation, artifacts, and Executive outputs load through the resolver.
- Missing profile behavior matches the spec.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/core/profile-resolution.test.ts`
- `pnpm test -- tests/core/profile-driven-questions.test.ts`
- `pnpm check:validation`

## Phase 3 — Intake State And Question Registry

### Objective

Implement durable intake state and profile-driven prompt selection.

### Why This Phase Exists

Conversational intake must survive restarts, know the active prompt, track progress, prioritize contradictions and follow-ups, and select exactly one next question.

### Preconditions

- Core API exists.
- Profile resolution and contract loading work.
- State repository port exists.

### Steps

#### Step 3.1 — Define Durable Intake State Schema

##### Goal

Persist intake mode, active question, answers, partials, skipped/pending items, contradictions, and progress.

##### Actions

- Define `LogosIntakeState` schema.
- Include `mode`, `activeQuestionId`, active follow-up metadata, answered questions, partial answers, skipped/pending questions, contradictions, and progress by phase.
- Add migration/default creation for new projects.
- Persist after every state-changing intake operation.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 9
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 13

##### Files Likely To Change

- `src/core/intake/intake-state.ts`
- `src/core/intake/intake-state-schema.ts`
- `src/core/state/intake-state-repository.ts`

##### Tests To Add Or Update

- `tests/core/intake-state-schema.test.ts`
- `tests/core/intake-state-persistence.test.ts`

##### Acceptance Criteria

- Valid persisted state parses successfully.
- Invalid state fails with actionable errors.
- New project state initializes in `idle` mode with empty progress.

##### Notes / Risks

- [Risk] Persisting raw chat instead of structured state violates the truth model.

#### Step 3.2 — Build Profile-Driven Question Registry

##### Goal

Convert active profile document/section questions into structured `LogosQuestion` records.

##### Actions

- Generate stable question ids from phase id, document id, section id, and question index or slug.
- Preserve phase/document/section metadata, required flags, priority, acceptance criteria, completion signals, insufficiency signals, dependencies, and follow-up policy.
- Use profile completion criteria and quality checks as evaluation metadata where explicit question metadata is absent.

##### Files To Inspect

- `profiles/standard/phases/**/*.yml`
- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 7

##### Files Likely To Change

- `src/core/questions/question-types.ts`
- `src/core/questions/load-question-registry.ts`
- `src/core/questions/question-id.ts`

##### Tests To Add Or Update

- `tests/core/question-registry.test.ts`
- `tests/core/profile-question-id-stability.test.ts`

##### Acceptance Criteria

- Registry loads questions from `profiles/<activeProfileId>/`.
- Question ids are stable across runs.
- Registry includes phase, document, section, priority, required, and dependency metadata.

##### Notes / Risks

- [Risk] Current profile sections contain arrays of strings. Add metadata derivation carefully and document defaults.

#### Step 3.3 — Implement Next Prompt Selector

##### Goal

Select the next active prompt according to contradiction, follow-up, required, priority, dependency, and phase order.

##### Actions

- Implement selector priority: unresolved contradiction, active unresolved follow-up, critical unanswered, critical partial, important unanswered, important partial, optional, complete.
- Ensure one prompt is returned at a time.
- Return structured blocker results when dependencies prevent selection.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 10
- `profiles/standard/docs.yml`
- `profiles/standard/phases/*.yml`

##### Files Likely To Change

- `src/core/intake/select-next-prompt.ts`
- `src/core/intake/active-prompt.ts`
- `src/core/intake/progress.ts`

##### Tests To Add Or Update

- `tests/core/next-prompt-selector.test.ts`
- `tests/core/contradiction-priority-selection.test.ts`
- `tests/core/follow-up-selection.test.ts`

##### Acceptance Criteria

- Selector returns unresolved contradiction prompts before new questions.
- Selector resumes active unresolved follow-ups before advancing.
- Selector never returns a multi-question dump.

##### Notes / Risks

- [Decision] Question selection belongs only to Core.

#### Step 3.4 — Implement Start/Stop Intake State Transitions

##### Goal

Make `startIntake` activate or resume intake and immediately return an assistant prompt; make `stopIntake` pause without losing the active prompt.

##### Actions

- Implement `startIntake` to load state, resolve profile, select prompt, set `intake_active`, persist `activeQuestionId`, and return `assistantMessage`.
- Implement active-intake `/logos-start` behavior as re-emission without advancing.
- Implement `stopIntake` to preserve active prompt and set mode to `paused`.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` sections 4.2 and 4.3
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` sections 8.2 and 9.2

##### Files Likely To Change

- `src/core/intake/start-intake.ts`
- `src/core/intake/stop-intake.ts`
- `src/core/intake/intake-service.ts`

##### Tests To Add Or Update

- `tests/core/start-intake.test.ts`
- `tests/core/stop-resume-intake.test.ts`

##### Acceptance Criteria

- `startIntake` returns a prompt immediately when intake can start.
- `startIntake` does not silently toggle mode.
- `stopIntake` preserves active question/follow-up.

##### Notes / Risks

- [Dependency] Pi `/logos-start` must later render this returned prompt immediately.

### Phase Acceptance Criteria

- Intake state persists active mode, active prompt, answers, partials, skips, contradictions, and progress.
- Questions load from active profile contracts.
- Next prompt selection is deterministic and Core-owned.
- Start and stop transitions preserve conversational state.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/core/intake-state-schema.test.ts`
- `pnpm test -- tests/core/start-intake.test.ts`
- `pnpm test -- tests/core/next-prompt-selector.test.ts`

## Phase 4 — Answer Evaluation And Intent Routing

### Objective

Implement structured intent classification, answer evaluation, and conversational progression without command-first intake.

### Why This Phase Exists

After `/logos-start`, users must answer naturally. LOGOS must decide whether to advance, clarify, mark partial, or ask for contradiction resolution.

### Preconditions

- Intake state and question registry work.
- Core can start intake and select prompts.

### Steps

#### Step 4.1 — Define Intake Intent And Evaluation Schemas

##### Goal

Constrain user intent and answer evaluation to validated structured outputs.

##### Actions

- Define `IntakeUserIntent` enum.
- Define `AnswerEvaluation` schema.
- Validate completeness scores, status, extracted facts, assumptions, decisions, risks, and `shouldAdvance`.
- Reject unknown evaluator output.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` sections 6 and 8
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` sections 11 and 12

##### Files Likely To Change

- `src/core/intake/intake-user-intent.ts`
- `src/core/evaluation/answer-evaluation.ts`
- `src/core/evaluation/evaluation-schema.ts`

##### Tests To Add Or Update

- `tests/core/intake-intent-schema.test.ts`
- `tests/core/answer-evaluation-schema.test.ts`

##### Acceptance Criteria

- Intent classification is constrained to the allowed enum.
- Evaluation output is validated before state mutation.
- Invalid evaluator output cannot become canonical state.

##### Notes / Risks

- [Risk] Letting free-form AI output mutate state will violate the AI boundary.

#### Step 4.2 — Implement Deterministic Intent Routing

##### Goal

Route active-intake user messages by intent before evaluation.

##### Actions

- Detect lifecycle commands before answer evaluation.
- Recognize natural-language pause, skip/pending, clarification, status, generation, revision, out-of-scope, and answer intents.
- Route non-command lifecycle-like intents to Core actions where appropriate.
- Ensure command text is never passed to answer evaluation.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 6.2
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 12

##### Files Likely To Change

- `src/core/intake/classify-intent.ts`
- `src/core/intake/route-intent.ts`
- `src/core/intake/handle-intake-message.ts`

##### Tests To Add Or Update

- `tests/core/intake-intent-routing.test.ts`
- `tests/core/command-text-not-answer.test.ts`

##### Acceptance Criteria

- Non-command answers are evaluated against the active prompt.
- Clarification requests explain and re-ask the current prompt.
- Out-of-scope messages are handled deliberately.
- Slash commands are excluded from answer evaluation.

##### Notes / Risks

- [Dependency] Full command interruption behavior is completed in Phase 5.

#### Step 4.3 — Add Evaluator Port And Fake Provider

##### Goal

Allow deterministic tests while keeping optional AI assistance behind a port.

##### Actions

- Define an `AnswerEvaluator` port.
- Implement deterministic baseline checks for empty, command-only, and structurally invalid answers.
- Add a fake evaluator for sufficient, partial, insufficient, and contradictory outcomes.
- Reserve live provider integration behind explicit disclosure and future configuration.

##### Files To Inspect

- `AGENTS.md` AI and testing rules
- `CONTRIBUTING.md` no-network/no-credentials test rules

##### Files Likely To Change

- `src/core/evaluation/answer-evaluator-port.ts`
- `src/core/evaluation/deterministic-evaluator.ts`
- `src/core/evaluation/fake-answer-evaluator.ts`

##### Tests To Add Or Update

- `tests/core/fake-answer-evaluator.test.ts`
- `tests/core/deterministic-evaluator.test.ts`

##### Acceptance Criteria

- Default tests require no network, provider credentials, or live model.
- Fake evaluator can drive all required intake scenarios.
- Provider output remains advisory until validated.

##### Notes / Risks

- [Risk] Live AI integration before state/evaluation contracts are stable can hide bugs.

#### Step 4.4 — Implement Handle Intake Message Transitions

##### Goal

Apply evaluations to state and return the next assistant action.

##### Actions

- On sufficient answer, persist answer/evaluation, update progress, select next question, and return it automatically.
- On partial answer, persist partial state and return targeted follow-up.
- On contradiction, persist contradiction and return resolution prompt.
- On insufficient answer, return clarification/follow-up without advancing.
- On explicit pending/unknown, mark partial or skipped according to question policy and continue when allowed.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` sections 6.3, 6.5, and 8.2

##### Files Likely To Change

- `src/core/intake/handle-intake-message.ts`
- `src/core/intake/apply-evaluation.ts`
- `src/core/intake/follow-up-policy.ts`
- `src/core/intake/contradiction-resolution.ts`

##### Tests To Add Or Update

- `tests/core/sufficient-answer-advances.test.ts`
- `tests/core/partial-answer-follow-up.test.ts`
- `tests/core/contradictory-answer-resolution.test.ts`
- `tests/core/no-command-needed-to-advance.test.ts`

##### Acceptance Criteria

- Sufficient answer advances to the next prompt without `/logos-next`.
- Partial answer asks a targeted follow-up.
- Contradiction asks for user resolution and does not silently choose.
- User never needs `/logos-answer` or equivalent.

##### Notes / Risks

- [Decision] Advancement decisions belong to Core, not Pi renderers.

### Phase Acceptance Criteria

- Intent and evaluation schemas exist and are validated.
- Natural-language answers drive state transitions.
- Sufficient, partial, insufficient, and contradictory paths are covered by tests.
- No command-first happy path exists.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/core/answer-evaluation-schema.test.ts`
- `pnpm test -- tests/core/sufficient-answer-advances.test.ts`
- `pnpm test -- tests/core/partial-answer-follow-up.test.ts`
- `pnpm test -- tests/core/contradictory-answer-resolution.test.ts`

## Phase 5 — Intake Command Interruption Policy

### Objective

Ensure lifecycle commands during active intake are control intents that preserve state and are never evaluated as answers.

### Why This Phase Exists

Pi checks extension commands before `input` events. Therefore command safety must be implemented in command handlers through Core interruption logic, not only in conversational input routing.

### Preconditions

- Core intake state exists.
- Core `startIntake`, `stopIntake`, `getStatus`, and `generate` exist at least as callable APIs.
- Intent routing excludes command text from answer evaluation.

### Steps

#### Step 5.1 — Define Lifecycle Command Enum And Interruption API

##### Goal

Expose a Core-owned interruption policy for all allowed LOGOS lifecycle commands.

##### Actions

- Define `LogosLifecycleCommand` as `logos-init`, `logos-start`, `logos-stop`, `logos-status`, `logos-generate`.
- Define `handleIntakeCommand(input)` with actions `block`, `pause_and_execute`, `reaffirm`, and `confirm_required`.
- Include preserved question/follow-up ids and persisted status in results.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 21
- `docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md` section 3

##### Files Likely To Change

- `src/core/intake/lifecycle-command.ts`
- `src/core/intake/handle-intake-command.ts`
- `src/core/api.ts`

##### Tests To Add Or Update

- `tests/core/handle-intake-command.test.ts`

##### Acceptance Criteria

- Only allowed lifecycle commands are represented.
- Core owns interruption state transitions.
- Result shape includes preserved active prompt information.

##### Notes / Risks

- [Risk] Adding `/logos-next`, `/logos-answer`, or equivalent commands is prohibited.

#### Step 5.2 — Implement `/logos-start` During Active Intake

##### Goal

Re-emit the active prompt without pausing, creating a session, or advancing.

##### Actions

- Detect `intake_active` mode.
- Read active question/follow-up/contradiction prompt.
- Return `reaffirm` action and assistant message.
- Do not mutate state except optional harmless timestamp if required by existing schema; prefer no mutation.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` sections 4.2 and 16.2

##### Files Likely To Change

- `src/core/intake/handle-intake-command.ts`
- `src/core/intake/start-intake.ts`

##### Tests To Add Or Update

- `tests/core/start-during-active-intake.test.ts`

##### Acceptance Criteria

- `/logos-start` during active intake does not create a new session.
- It does not advance from Q1 to Q2.
- It re-emits Q1 or active follow-up.

##### Notes / Risks

- [Decision] `/logos-start` is the exception to pause-before-execute.

#### Step 5.3 — Implement Pause-Before-Command For Stop, Status, And Generate

##### Goal

Safely pause and preserve active state before executing interrupting lifecycle behavior.

##### Actions

- For `/logos-stop`, preserve active prompt, persist state, set mode `paused`, and report progress.
- For `/logos-status`, preserve active prompt, persist state, set mode `paused`, then compute status.
- For `/logos-generate`, preserve active prompt, persist state, set mode `paused`, then run generation preflight.
- Ensure none of these command strings enter answer evaluation.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` sections 16.3 through 16.5

##### Files Likely To Change

- `src/core/intake/handle-intake-command.ts`
- `src/core/intake/stop-intake.ts`
- `src/core/status/get-status.ts`
- `src/core/generation/generate.ts`

##### Tests To Add Or Update

- `tests/core/status-during-active-intake.test.ts`
- `tests/core/generate-during-active-intake.test.ts`
- `tests/core/stop-during-active-intake.test.ts`
- `tests/core/lifecycle-command-not-evaluated.test.ts`

##### Acceptance Criteria

- `/logos-status` pauses, preserves Q1, reports, and is not an answer.
- `/logos-generate` pauses, preserves Q1, runs preflight, and is not an answer.
- `/logos-stop` pauses and preserves active prompt.

##### Notes / Risks

- [Risk] Treating `/logos-status` as read-only during active intake violates the spec because it must pause safely.

#### Step 5.4 — Implement `/logos-init` Active-Intake Block Or Confirmation

##### Goal

Prevent silent reinitialization while intake is active.

##### Actions

- Detect active intake on init command.
- Return `confirm_required` with warning about state loss.
- Preserve existing state unless explicit confirmation is passed to a destructive reset path.
- Keep destructive reset outside the MVP unless explicitly approved.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` sections 4.1 and 16.6

##### Files Likely To Change

- `src/core/init/init-project.ts`
- `src/core/intake/handle-intake-command.ts`

##### Tests To Add Or Update

- `tests/core/init-during-active-intake.test.ts`

##### Acceptance Criteria

- `/logos-init` during active intake does not reinitialize silently.
- User-facing message warns active state would be lost.
- Existing active state remains preserved without confirmation.

##### Notes / Risks

- [Decision] Prefer blocking in MVP unless a later UX explicitly defines confirmation semantics.

#### Step 5.5 — Add Extension-Level Command Routing Contract Tests

##### Goal

Ensure Pi command handlers call interruption policy before command-specific behavior.

##### Actions

- Create fake Core and fake Pi extension harness.
- Simulate active intake with Q1.
- Invoke each allowed command handler.
- Assert `handleIntakeCommand` is called before command behavior where active intake exists.
- Assert `handleIntakeMessage` is not called with command text.

##### Files To Inspect

- Pi docs `extensions.md` command processing order
- Installed Pi `ExtensionAPI` types

##### Files Likely To Change

- `tests/pi-extension/command-interruption-routing.test.ts`
- `src/pi-extension/commands/**` when Phase 7 exists

##### Tests To Add Or Update

- `tests/pi-extension/command-interruption-routing.test.ts`

##### Acceptance Criteria

- Extension tests prove command text never reaches answer evaluation.
- Command handlers use Core interruption before executing behavior.

##### Notes / Risks

- [Dependency] Full command adapter implementation arrives in Phase 7, but this contract should shape it.

### Phase Acceptance Criteria

- Command interruption API exists in Core.
- `/logos-start`, `/logos-stop`, `/logos-status`, `/logos-generate`, and `/logos-init` active-intake behavior matches the spec.
- Commands during active intake are never answers.
- Active prompt is preserved before interrupting behavior.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/core/status-during-active-intake.test.ts`
- `pnpm test -- tests/core/generate-during-active-intake.test.ts`
- `pnpm test -- tests/core/start-during-active-intake.test.ts`
- `pnpm test -- tests/core/lifecycle-command-not-evaluated.test.ts`

## Phase 6 — Generation Preflight And Safe Generation Boundary

### Objective

Make generation state-aware, profile-driven, preflighted, and safe before any documentation writes occur.

### Why This Phase Exists

`/logos-generate` must not silently generate final docs when critical intake is incomplete, partial, contradictory, or unsafe to write.

### Preconditions

- Profile resolution works.
- Intake state and progress calculation exist.
- Core generation API exists.
- Safe filesystem ports exist.

### Steps

#### Step 6.1 — Implement Completeness Calculation

##### Goal

Compute readiness from active profile questions and persisted intake evaluations.

##### Actions

- Calculate total completeness score.
- Calculate by-phase completeness.
- Identify sufficient, partial, missing, and contradictory answers.
- Mark critical required questions separately.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 10
- `profiles/standard/docs.yml`
- `profiles/standard/phases/**/*.yml`

##### Files Likely To Change

- `src/core/intake/progress.ts`
- `src/core/generation/completeness.ts`

##### Tests To Add Or Update

- `tests/core/completeness-calculation.test.ts`

##### Acceptance Criteria

- Completeness can be reconstructed from persisted state.
- Missing and partial critical questions are explicit.
- Contradictions are blockers.

##### Notes / Risks

- [Risk] Treating optional questions as critical can block generation unnecessarily; priority mapping must be explicit.

#### Step 6.2 — Implement Generation Preflight Result

##### Goal

Return blockers and warnings before any generation write plan executes.

##### Actions

- Define `GenerationPreflightResult` schema.
- Check initialization, active profile validity, intake status, completeness, missing critical questions, partial critical questions, contradictions, output paths, and overwrite/manual-edit risk.
- Persist preflight attempts in generation state.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 10.2
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 14

##### Files Likely To Change

- `src/core/generation/preflight.ts`
- `src/core/generation/generation-state.ts`
- `src/core/generation/generation-result.ts`

##### Tests To Add Or Update

- `tests/core/generation-preflight.test.ts`
- `tests/core/missing-critical-blocks-final-generation.test.ts`

##### Acceptance Criteria

- Final generation is blocked when critical information is missing.
- Preflight reports partial critical questions and contradictions.
- Missing profile blocks preflight.

##### Notes / Risks

- [Decision] Generation preflight belongs to Core, not Pi.

#### Step 6.3 — Build Safe Write Plan And Output Path Validation

##### Goal

Plan generated outputs from active profile contracts and accepted state without unsafe writes.

##### Actions

- Resolve canonical Markdown, HTML artifacts, agent packs, data outputs, and Executive outputs from the active profile.
- Validate all output paths are contained in the project root or configured docs/output roots.
- Detect existing files and manual-edit/overwrite risks.
- Support dry-run write plans.

##### Files To Inspect

- `profiles/standard/docs.yml`
- `profiles/standard/phases/**/*.yml`
- `profiles/standard/executive/**`

##### Files Likely To Change

- `src/core/generation/write-plan.ts`
- `src/core/generation/output-paths.ts`
- `src/core/artifacts/artifact-plan.ts`
- `src/core/fs/path-safety.ts`

##### Tests To Add Or Update

- `tests/core/generation-write-plan.test.ts`
- `tests/core/generated-output-path-safety.test.ts`
- `tests/core/overwrite-risk.test.ts`

##### Acceptance Criteria

- Output paths derive from active profile contracts.
- Unsafe paths are blocked.
- Existing/manual-edit risks appear in preflight.

##### Notes / Risks

- [Risk] Derived artifacts must not become canonical state.

#### Step 6.4 — Implement Partial Draft Confirmation Boundary

##### Goal

Allow incomplete draft generation only after explicit confirmation and mark outputs incomplete.

##### Actions

- Add generation modes: `final`, `partial_draft`, and `dry_run`.
- Require explicit confirmation for partial draft mode.
- Mark partial draft docs as incomplete in generated headers/metadata.
- Refuse final generation when critical blockers remain.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` sections 10.3 and 14.4

##### Files Likely To Change

- `src/core/generation/generate.ts`
- `src/core/generation/render-canonical-markdown.ts`
- `src/core/generation/partial-draft.ts`

##### Tests To Add Or Update

- `tests/core/partial-generation-confirmation.test.ts`
- `tests/core/partial-docs-marked-incomplete.test.ts`

##### Acceptance Criteria

- Partial generation requires explicit confirmation.
- Partial docs are clearly marked incomplete.
- Final generation cannot bypass blockers.

##### Notes / Risks

- [Dependency] Pi confirmation UI is implemented in Phase 9.

### Phase Acceptance Criteria

- Generation always runs preflight before writes.
- Missing critical information blocks final generation.
- Partial generation is confirmation-gated and marked incomplete.
- Generation is derived from active profile and accepted state.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/core/generation-preflight.test.ts`
- `pnpm test -- tests/core/missing-critical-blocks-final-generation.test.ts`
- `pnpm test -- tests/core/partial-generation-confirmation.test.ts`

## Phase 7 — Pi Extension Shell And Lifecycle Commands

### Objective

Create the Pi extension surface that registers only allowed lifecycle commands and delegates behavior to Core.

### Why This Phase Exists

The extension is the first product surface, but it must remain a Pi adapter over Core.

### Preconditions

- Core public API exists.
- Command interruption API exists.
- Official Pi docs and installed types have been inspected.

### Steps

#### Step 7.1 — Add Pi Extension Dependency And Type Strategy

##### Goal

Make Pi extension code typecheck against installed Pi extension APIs without leaking Pi into Core.

##### Actions

- Decide whether `@earendil-works/pi-coding-agent` is a dependency, devDependency, peer dependency, or package-local runtime dependency for extension loading.
- Add TypeScript import boundaries so only `src/pi-extension/**` imports Pi types.
- Add boundary test preventing `src/core/**` from importing Pi.

##### Files To Inspect

- `package.json`
- Installed Pi `dist/index.d.ts`
- Installed Pi `dist/core/extensions/types.d.ts`
- Pi docs `extensions.md`

##### Files Likely To Change

- `package.json`
- `src/pi-extension/index.ts`
- `tests/core/core-boundary.test.ts`

##### Tests To Add Or Update

- `tests/pi-extension/pi-types-boundary.test.ts`

##### Acceptance Criteria

- Pi extension compiles with `ExtensionAPI` types.
- Core still has no Pi imports.
- Dependency choice is documented in code or package metadata.

##### Notes / Risks

- [Risk] Project currently lacks `@earendil-works/pi-coding-agent` in `package.json`; implementation must decide how extension runtime resolves it.

#### Step 7.2 — Create Extension Entrypoint

##### Goal

Create a Pi-loadable extension factory.

##### Actions

- Create a default factory function receiving `ExtensionAPI`.
- Keep entrypoint thin: register commands, input handler, message renderer, and optional tools only.
- For project-local discovery, decide whether to add `.pi/extensions/logos/index.ts` that imports built extension code or place a TypeScript entrypoint directly there.

##### Files To Inspect

- Pi docs extension locations
- `tsconfig.json`
- `.gitignore`

##### Files Likely To Change

- `src/pi-extension/index.ts`
- `.pi/extensions/logos/index.ts` or `.pi/extensions/logos.ts`
- `src/pi-extension/create-extension.ts`

##### Tests To Add Or Update

- `tests/pi-extension/extension-entrypoint.test.ts`

##### Acceptance Criteria

- Pi can load the extension factory shape.
- Entrypoint contains no generation, evaluation, or profile algorithms.
- Project-local extension location is documented.

##### Notes / Risks

- [Fact] Pi auto-discovers `.pi/extensions/*.ts` and `.pi/extensions/*/index.ts`.

#### Step 7.3 — Register Only Allowed LOGOS Commands

##### Goal

Expose lifecycle commands and prohibit command-first intake commands.

##### Actions

- Register `logos-init`, `logos-start`, `logos-stop`, `logos-status`, and `logos-generate` with `pi.registerCommand`.
- Do not include leading slash in `registerCommand` names.
- Add tests asserting forbidden commands are not registered: `logos-next`, `logos-answer`, `logos-continue`, `logos-question`, `logos-phase`, `logos-doc`, `logos-set-answer`, `logos-skip`, `logos-followup`.

##### Files To Inspect

- Pi docs `pi.registerCommand`
- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 5

##### Files Likely To Change

- `src/pi-extension/commands/register-commands.ts`
- `src/pi-extension/commands/init-command.ts`
- `src/pi-extension/commands/start-command.ts`
- `src/pi-extension/commands/stop-command.ts`
- `src/pi-extension/commands/status-command.ts`
- `src/pi-extension/commands/generate-command.ts`

##### Tests To Add Or Update

- `tests/pi-extension/command-registration.test.ts`
- `tests/pi-extension/forbidden-commands-not-registered.test.ts`

##### Acceptance Criteria

- Only five LOGOS lifecycle commands are registered.
- Forbidden command-first commands are absent.
- Command handlers are adapter-only.

##### Notes / Risks

- [Decision] User-facing invocation includes slash, but registered command names do not.

#### Step 7.4 — Implement Command Adapter Pattern

##### Goal

Make every command resolve project context, call Core, and render results.

##### Actions

- Resolve project root from `ctx.cwd` and pass it to Core.
- Before command-specific behavior, detect active intake state and call `core.handleIntakeCommand(...)` where required.
- Call `initProject`, `startIntake`, `stopIntake`, `getStatus`, or `generate` only after Core interruption policy allows it.
- Render returned messages through the rendering layer.

##### Files To Inspect

- Pi `ExtensionCommandContext` types
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` section 8.7

##### Files Likely To Change

- `src/pi-extension/adapters/project-context.ts`
- `src/pi-extension/commands/*.ts`
- `src/pi-extension/renderers/render-core-result.ts`

##### Tests To Add Or Update

- `tests/pi-extension/command-adapters-call-core.test.ts`
- `tests/pi-extension/command-interruption-routing.test.ts`

##### Acceptance Criteria

- Commands do not duplicate Core logic.
- Active-intake commands call Core interruption policy.
- `/logos-start` renders the returned question immediately.

##### Notes / Risks

- [Risk] Because Pi commands bypass `input`, command handlers are the critical interruption safety point.

### Phase Acceptance Criteria

- Pi extension entrypoint exists.
- Only allowed lifecycle commands are registered.
- Command handlers delegate to Core.
- Command interruption policy is integrated into command adapters.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/pi-extension/command-registration.test.ts`
- `pnpm test -- tests/pi-extension/forbidden-commands-not-registered.test.ts`
- `pnpm test -- tests/pi-extension/command-adapters-call-core.test.ts`

## Phase 8 — Conversational Input Routing

### Objective

Route natural user messages to LOGOS Core while intake mode is active, without intercepting normal Pi behavior when LOGOS is inactive.

### Why This Phase Exists

The happy path after `/logos-start` must be conversational: the agent asks first, the user answers naturally, and LOGOS advances or follows up without `/logos-next`.

### Preconditions

- Pi extension shell exists.
- Core `handleIntakeMessage` works.
- Core interruption policy works.

### Steps

#### Step 8.1 — Register Pi Input Handler

##### Goal

Detect active LOGOS intake on normal user messages.

##### Actions

- Use `pi.on("input", ...)` to inspect raw input after extension commands have been checked.
- Ignore `event.source === "extension"` to avoid loops from extension-injected messages.
- Load LOGOS state for `ctx.cwd`.
- If intake is inactive, return `{ action: "continue" }`.
- If active and message is not a slash command, call `core.handleIntakeMessage(...)` and return `{ action: "handled" }` after rendering.

##### Files To Inspect

- Pi docs `Input Events`
- Pi example `examples/extensions/input-transform.ts`

##### Files Likely To Change

- `src/pi-extension/conversation/input-router.ts`
- `src/pi-extension/index.ts`
- `src/pi-extension/adapters/core-instance.ts`

##### Tests To Add Or Update

- `tests/pi-extension/input-routing-inactive.test.ts`
- `tests/pi-extension/input-routing-active.test.ts`

##### Acceptance Criteria

- Inactive LOGOS does not intercept normal Pi prompts.
- Active LOGOS routes natural messages to Core.
- Extension-injected messages do not loop.

##### Notes / Risks

- [Fact] Extension commands are checked before `input`; slash lifecycle commands are handled by command handlers.

#### Step 8.2 — Enforce Agent-Initiated `/logos-start`

##### Goal

Ensure `/logos-start` immediately produces an assistant question.

##### Actions

- In `logos-start` command handler, call `core.startIntake(...)`.
- Render returned `assistantMessage` immediately through Pi UI/message renderer.
- Add contract test that no silent mode toggle occurs.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 3
- Pi docs `pi.sendMessage(...)` and `ctx.ui.notify(...)`

##### Files Likely To Change

- `src/pi-extension/commands/start-command.ts`
- `src/pi-extension/renderers/question-renderer.ts`

##### Tests To Add Or Update

- `tests/pi-extension/logos-start-asks-first.test.ts`

##### Acceptance Criteria

- `/logos-start` emits the next unresolved question or follow-up immediately.
- User is not expected to send an answer before seeing a LOGOS question.
- Blocking errors are rendered clearly.

##### Notes / Risks

- [Decision] `/logos-start` as passive mode toggle is non-compliant.

#### Step 8.3 — Render Conversational Advancement

##### Goal

After sufficient answers, ask the next question automatically.

##### Actions

- Render `handleIntakeMessage` results for next question, follow-up, contradiction, clarification, completion, or blocker.
- Do not call `pi.sendUserMessage` for ordinary intake advancement; render Core assistant messages as extension/assistant-facing output.
- Preserve natural Pi behavior only outside active intake.

##### Files To Inspect

- Pi docs `pi.sendMessage(...)`, `registerMessageRenderer`, and message rendering examples
- Pi example `message-renderer.ts`

##### Files Likely To Change

- `src/pi-extension/conversation/input-router.ts`
- `src/pi-extension/renderers/intake-renderer.ts`
- `src/pi-extension/renderers/message-renderer.ts`

##### Tests To Add Or Update

- `tests/pi-extension/sufficient-answer-asks-next.test.ts`
- `tests/pi-extension/partial-answer-renders-follow-up.test.ts`
- `tests/pi-extension/contradiction-renders-resolution.test.ts`

##### Acceptance Criteria

- Sufficient answer causes Q2 to be asked without `/logos-next`.
- Partial answer renders targeted follow-up.
- Contradiction renders resolution request.

##### Notes / Risks

- [Risk] Sending synthetic user messages can confuse history; prefer custom rendered LOGOS assistant messages unless an explicit Pi turn is required.

#### Step 8.4 — Handle Out-Of-Scope And Clarification Messages

##### Goal

Avoid treating every active-intake message as an answer.

##### Actions

- Route clarification intent to explanatory message plus re-ask.
- Route out-of-scope intent to ask whether to pause or continue.
- Route natural-language status/generation/pause intents through Core-equivalent actions.
- Persist any state changes.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 6.2

##### Files Likely To Change

- `src/core/intake/route-intent.ts`
- `src/pi-extension/conversation/input-router.ts`
- `src/pi-extension/renderers/clarification-renderer.ts`

##### Tests To Add Or Update

- `tests/core/intake-clarification-intent.test.ts`
- `tests/pi-extension/out-of-scope-message-routing.test.ts`

##### Acceptance Criteria

- Clarification requests do not advance the active question.
- Out-of-scope messages do not corrupt intake state.
- Natural control intents are handled deliberately.

##### Notes / Risks

- [Risk] Over-eager answer classification can silently accept vague or unrelated input.

### Phase Acceptance Criteria

- Active intake routes natural user messages to Core.
- Inactive LOGOS does not intercept normal Pi usage.
- `/logos-start` asks first.
- Sufficient answers advance conversationally.
- Partial and contradictory answers do not advance silently.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/pi-extension/logos-start-asks-first.test.ts`
- `pnpm test -- tests/pi-extension/sufficient-answer-asks-next.test.ts`
- `pnpm test -- tests/pi-extension/input-routing-active.test.ts`

## Phase 9 — Rendering, Confirmation, And User Feedback

### Objective

Render Core messages clearly through Pi without moving product logic into renderers.

### Why This Phase Exists

Users need clear prompts, follow-ups, contradiction notices, status summaries, blockers, confirmation prompts, and generated output reports.

### Preconditions

- Core returns structured assistant messages.
- Pi extension command and input routing exist.

### Steps

#### Step 9.1 — Create Core Message Renderers

##### Goal

Render Core messages consistently through Pi UI and custom messages.

##### Actions

- Implement question renderer.
- Implement follow-up renderer.
- Implement contradiction renderer.
- Implement clarification renderer.
- Implement error and warning renderer.
- Register a custom LOGOS message renderer with `pi.registerMessageRenderer` if custom TUI display is needed.

##### Files To Inspect

- Pi docs `Custom Rendering` and `Message Rendering`
- Pi example `message-renderer.ts`

##### Files Likely To Change

- `src/pi-extension/renderers/question-renderer.ts`
- `src/pi-extension/renderers/follow-up-renderer.ts`
- `src/pi-extension/renderers/contradiction-renderer.ts`
- `src/pi-extension/renderers/logos-message-renderer.ts`

##### Tests To Add Or Update

- `tests/pi-extension/render-question.test.ts`
- `tests/pi-extension/render-follow-up.test.ts`
- `tests/pi-extension/render-contradiction.test.ts`

##### Acceptance Criteria

- Renderers consume Core message data only.
- Renderers do not select questions or evaluate answers.
- Messages clearly identify current prompt and blockers.

##### Notes / Risks

- [Decision] Rendering is presentation, not product behavior.

#### Step 9.2 — Implement Status And Generation Blocker Renderers

##### Goal

Make progress and generation blockers actionable.

##### Actions

- Render total progress and by-phase progress.
- Render sufficient, partial, missing, and contradictory counts.
- Render top blockers to generation.
- Render missing profile and project-not-initialized errors.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` sections 4.4 and 10

##### Files Likely To Change

- `src/pi-extension/renderers/status-renderer.ts`
- `src/pi-extension/renderers/generation-blocker-renderer.ts`

##### Tests To Add Or Update

- `tests/pi-extension/render-status.test.ts`
- `tests/pi-extension/render-generation-blockers.test.ts`

##### Acceptance Criteria

- Status is concise but complete.
- Blockers show actionable next steps.
- Missing critical information is not hidden.

##### Notes / Risks

- [Risk] Status during active intake must reflect paused/preserved state after interruption.

#### Step 9.3 — Implement Partial Generation Confirmation UI

##### Goal

Require explicit user confirmation before partial drafts are written.

##### Actions

- Use `ctx.ui.confirm(...)` when Core reports `requiresExplicitConfirmation` for partial generation.
- If confirmed, call Core generate with `partial_draft` mode and confirmation flag.
- If declined, do not write files and render a safe cancellation message.
- Support non-interactive/no-UI behavior by blocking partial generation unless explicit confirmation is provided in input options.

##### Files To Inspect

- Pi docs `ctx.ui.confirm(...)`
- Pi docs Mode Behavior

##### Files Likely To Change

- `src/pi-extension/commands/generate-command.ts`
- `src/pi-extension/renderers/generation-confirmation-renderer.ts`

##### Tests To Add Or Update

- `tests/pi-extension/partial-generation-confirmation-ui.test.ts`
- `tests/pi-extension/partial-generation-no-ui-blocks.test.ts`

##### Acceptance Criteria

- Partial generation is not performed without explicit confirmation.
- Decline path writes nothing.
- No-UI mode fails safe.

##### Notes / Risks

- [Fact] `ctx.hasUI` may be false in print/JSON modes.

#### Step 9.4 — Render Generated Output Paths And Provenance

##### Goal

Report generated files without implying derived artifacts are canonical.

##### Actions

- Render generated canonical Markdown paths.
- Render derived HTML, agent pack, data, and Executive output paths as derived/non-canonical.
- Include warnings and changed paths from Core.
- Preserve source traceability metadata in reports.

##### Files To Inspect

- `profiles/standard/docs.yml`
- `profiles/standard/executive/**`
- `AGENTS.md` truth model

##### Files Likely To Change

- `src/pi-extension/renderers/generation-result-renderer.ts`
- `src/core/generation/generation-result.ts`

##### Tests To Add Or Update

- `tests/pi-extension/render-generation-result.test.ts`
- `tests/core/derived-artifacts-not-canonical.test.ts`

##### Acceptance Criteria

- Generated paths are clear.
- Derived outputs are labeled derived/non-authoritative.
- Warnings are preserved.

##### Notes / Risks

- [Risk] Users may edit generated derived artifacts; renderers should reinforce canonical boundaries.

### Phase Acceptance Criteria

- All Core message kinds have clear Pi rendering.
- Confirmation UI gates partial generation.
- Renderers contain no Core logic.
- Output reports distinguish canonical from derived artifacts.

### Validation Commands

- `pnpm typecheck`
- `pnpm test -- tests/pi-extension/render-question.test.ts`
- `pnpm test -- tests/pi-extension/partial-generation-confirmation-ui.test.ts`

## Phase 10 — Legacy CLI/TUI Containment Or Cleanup

### Objective

Prevent legacy command-first CLI/TUI assumptions from driving the Pi extension MVP.

### Why This Phase Exists

README and package metadata still describe a TUI-first architecture, but current specs require Pi extension first and conversational intake.

### Preconditions

- Pi extension path exists.
- Core APIs are stable.
- Phase 0 classification is available.

### Steps

#### Step 10.1 — Decide CLI Binary Strategy

##### Goal

Decide whether `logos` remains, becomes a compatibility shim, or is deferred.

##### Actions

- Inspect any restored CLI source.
- If no CLI source exists, update implementation plan to either create a minimal non-primary CLI shim later or remove bin before release.
- Ensure CLI does not introduce command-first intake progression.

##### Files To Inspect

- `package.json`
- `README.md`
- Any restored `src/cli/**`

##### Files Likely To Change

- `package.json`
- `src/cli/**` if retained
- `README.md` in a later documentation update phase, not during code implementation unless requested

##### Tests To Add Or Update

- `tests/cli/cli-boundary.test.ts` if CLI retained

##### Acceptance Criteria

- CLI strategy is explicit.
- CLI cannot become the primary MVP surface.
- CLI does not register forbidden command-first flows.

##### Notes / Risks

- [Risk] Existing package scripts expect CLI smoke tests but scripts are absent.

##### Implementation Decision (2026-05-22)

- [Decision] **Strategy A — Defer CLI binary.** No `src/cli/` source exists, no `src/tui/` source exists, and no buildable source produces `dist/cli.js`. The stale `bin.logos` entry pointing to `./dist/cli.js` has been removed from `package.json`.
- [Decision] The `logos` binary is deferred for the Pi-extension-first MVP because no safe/buildable CLI source currently exists. A minimal non-primary compatibility shim may be added later as a separate implementation task (Phase 12+), but must not implement command-first intake progression.
- [Decision] Legacy CLI/TUI dependencies (`commander`, `ink`, `react`) remain in `package.json` as known legacy artifacts; dependency cleanup belongs to a later containment task (Step 10.2).
- [Decision] Missing `scripts/smoke-cli.js`, `scripts/smoke-package.js`, `scripts/security-check.js`, and `scripts/nfr-evidence.js` are recorded as known release-hardening gaps for Phase 12.
- [Decision] Tests added in this step prove the deferred strategy: `tests/package/cli-binary-strategy.test.ts`, `tests/cli/cli-boundary.test.ts`, `tests/cli/forbidden-cli-commands.test.ts`.

#### Step 10.2 — Isolate Or Remove Ink/TUI Paths

##### Goal

Ensure legacy TUI code does not couple into Core or Pi extension behavior.

##### Actions

- If `src/tui/**` is restored, classify components as legacy, reusable render logic, or removable.
- Prevent Core imports from `ink`, `react`, or TUI components.
- Keep any retained TUI behind adapter boundaries and out of the MVP happy path.

##### Files To Inspect

- Any restored `src/tui/**`
- `package.json` dependencies
- `tests/tui/**` if restored

##### Files Likely To Change

- `src/tui/**` if restored
- `src/core/**` import cleanup
- `tests/core/core-boundary.test.ts`

##### Tests To Add Or Update

- `tests/core/core-boundary.test.ts`
- `tests/legacy/tui-containment.test.ts` if TUI retained

##### Acceptance Criteria

- Core does not import TUI modules.
- Pi extension does not depend on legacy TUI flows.
- Legacy UI cannot enforce `/continue`-style intake progression.

##### Notes / Risks

- [Decision] Extract reusable pure logic into Core; do not deepen UI coupling.

#### Step 10.3 — Remove Or Deprecate Forbidden Intake Commands

##### Goal

Eliminate command-first progression from active product surfaces.

##### Actions

- Search restored source for `/continue`, `/next`, `/answer`, `/skip`, `/followup`, and equivalent patterns.
- Remove or deprecate incompatible command handlers from the Pi MVP.
- Keep natural-language equivalents through Core intent routing.

##### Files To Inspect

- `src/**`
- `tests/**`
- `README.md`

##### Files Likely To Change

- `src/cli/**` if retained
- `src/tui/**` if retained
- `src/pi-extension/**`
- Future docs update files

##### Tests To Add Or Update

- `tests/pi-extension/forbidden-commands-not-registered.test.ts`
- `tests/legacy/no-command-first-intake.test.ts` if legacy retained

##### Acceptance Criteria

- Forbidden LOGOS commands are not exposed by the Pi extension.
- Legacy surfaces do not define the MVP happy path.
- Natural-language skip/pending/clarification remains supported.

##### Notes / Risks

- [Risk] `/continue` appears in README as old TUI behavior and is non-compliant for the Pi MVP.

#### Step 10.4 — Restore Or Rewrite Missing Script Gates

##### Goal

Make package quality scripts truthful before release hardening.

##### Actions

- Inspect missing `scripts/` expectations from `package.json`.
- Restore or implement `smoke-cli.js`, `smoke-package.js`, `security-check.js`, and `nfr-evidence.js`, or update scripts deliberately.
- Ensure scripts do not require network, credentials, or initialized user workspaces.

##### Files To Inspect

- `package.json`
- `CONTRIBUTING.md`
- Any restored `scripts/**`

##### Files Likely To Change

- `scripts/smoke-cli.js`
- `scripts/smoke-package.js`
- `scripts/security-check.js`
- `scripts/nfr-evidence.js`
- `package.json`

##### Tests To Add Or Update

- `tests/release/package-scripts.test.ts`

##### Acceptance Criteria

- All `package.json` scripts reference existing files.
- Release checks are deterministic and local.
- Script behavior matches the Pi-extension-first direction.

##### Notes / Risks

- [Risk] `pnpm check` cannot be trusted until script targets exist.

### Phase Acceptance Criteria

- Legacy CLI/TUI behavior is classified, isolated, removed, or explicitly retained as non-primary.
- No legacy path weakens Core independence or conversational intake.
- Package scripts are reconciled with actual files.

### Validation Commands

- `pnpm lint:biome`
- `pnpm typecheck`
- `pnpm test -- tests/pi-extension/forbidden-commands-not-registered.test.ts`
- `pnpm smoke:cli` only after smoke script and CLI strategy are reconciled

## Phase 11 — End-To-End Validation And Release Hardening

### Objective

Prove the full Pi extension flow works from initialization through conversational intake and generation.

### Why This Phase Exists

The redesign is only complete when contract tests prove the interaction model, profile resolution, command interruption, Core independence, and generation preflight.

### Preconditions

- Phases 1 through 10 are complete.
- Package scripts reference existing files.
- Pi extension is loadable in a project-local or configured extension location.

### Steps

#### Step 11.1 — Add Core End-To-End Scenario

##### Goal

Prove the product behavior without Pi runtime.

##### Actions

- Create temp project with `profiles/standard` fixture or real bundled profile copied/available.
- Run Core `initProject`.
- Run Core `startIntake` and assert assistant prompt exists.
- Submit sufficient answer and assert next prompt exists.
- Stop and resume intake.
- Complete enough critical intake for generation readiness.
- Run generation preflight and generation in dry-run/final mode as appropriate.

##### Files To Inspect

- `src/core/**`
- `profiles/standard/**`

##### Files Likely To Change

- `tests/e2e/core-flow.test.ts`

##### Tests To Add Or Update

- `tests/e2e/core-flow.test.ts`

##### Acceptance Criteria

- Core works without Pi dependencies.
- State survives reload from disk.
- Generation preflight passes only when critical intake is complete.

##### Notes / Risks

- [Dependency] Use fake evaluator to avoid live AI.

#### Step 11.2 — Add Pi Extension End-To-End Harness

##### Goal

Prove Pi command and input adapters satisfy the interaction contract.

##### Actions

- Build a fake `ExtensionAPI` harness that records registered commands, input handlers, messages, and UI confirmations.
- Load the LOGOS extension factory.
- Invoke `/logos-init`, `/logos-start`, active-intake natural answer, `/logos-stop`, resume, and `/logos-generate` through the harness.
- Assert command interruption paths call Core appropriately.

##### Files To Inspect

- Installed Pi `ExtensionAPI` types
- Pi examples for commands and input events

##### Files Likely To Change

- `tests/pi-extension/fake-pi.ts`
- `tests/e2e/pi-extension-flow.test.ts`

##### Tests To Add Or Update

- `tests/e2e/pi-extension-flow.test.ts`

##### Acceptance Criteria

- `/logos-start` asks Q1 immediately.
- Natural sufficient answer asks Q2 without `/logos-next`.
- Stop/resume preserves active prompt.
- Generate runs preflight.

##### Notes / Risks

- [Risk] This is a harness test, not a substitute for manual Pi smoke testing.

#### Step 11.3 — Add Required Contract Test Matrix

##### Goal

Ensure every spec-required behavior has a named regression test.

##### Actions

- Add tests for initialization, start, advance without command, partial answer, contradiction, stop/resume, status, incomplete generation, Core independence, status during active intake, generate during active intake, start during active intake, init during active intake, command not evaluated as answer, default profile, active profile question loading, missing profile blocks intake/generation, future custom profile, and Core-owned profile resolution.
- Link tests to spec sections in test names or comments.

##### Files To Inspect

- `docs/LOGOS_PI_EXTENSION_SPEC.md` section 15

##### Files Likely To Change

- `tests/contracts/*.test.ts`
- Existing test files if consolidated

##### Tests To Add Or Update

- `tests/contracts/logos-pi-extension-contract.test.ts`
- `tests/contracts/profile-resolution-contract.test.ts`
- `tests/contracts/command-interruption-contract.test.ts`

##### Acceptance Criteria

- Every required test in the spec has coverage.
- Contract tests fail if `/logos-start` becomes passive.
- Contract tests fail if command text is evaluated as an answer.

##### Notes / Risks

- [Decision] Missing contract tests block release.

#### Step 11.4 — Run Quality Gates And Manual Pi Smoke

##### Goal

Validate code, tests, package scripts, and live extension loading.

##### Actions

- Run targeted tests during development.
- Run full `pnpm check` once missing scripts and implementation are reconciled.
- Manually load the extension in Pi via `.pi/extensions/` or `pi -e`.
- Exercise `/logos-init`, `/logos-start`, natural answer, interruption commands, and `/logos-generate` in an isolated temp project.
- Record failures as task-caused or pre-existing.

##### Files To Inspect

- `package.json`
- `.pi/extensions/**`
- `src/pi-extension/**`
- `tests/**`

##### Files Likely To Change

- Test fixtures and release scripts as needed
- No product code changes unless failures identify bugs

##### Tests To Add Or Update

- Update regression tests for any bug found during smoke.

##### Acceptance Criteria

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:validation`, `pnpm build`, and `pnpm check` pass when implementation is complete.
- Manual Pi smoke confirms extension load and conversational flow.
- No unresolved critical contract conflicts remain.

##### Notes / Risks

- [Risk] Current checkout is expected to fail broad gates until missing implementation and scripts exist.

### Phase Acceptance Criteria

- End-to-end Core and Pi extension flows pass.
- Required contract matrix is complete.
- Full quality gates pass after repository gaps are resolved.
- Manual Pi smoke confirms the extension works in Pi.

### Validation Commands

- `pnpm lint`
- `pnpm lint:biome`
- `pnpm lint:md`
- `pnpm typecheck`
- `pnpm test`
- `pnpm check:validation`
- `pnpm build`
- `pnpm smoke:cli`
- `pnpm smoke:package`
- `pnpm security:check`
- `pnpm nfr:evidence`
- `pnpm check`

## Cross-Cutting Acceptance Checklist

- [ ] `/logos-start` immediately asks the next unresolved question or active unresolved follow-up.
- [ ] `/logos-start` is not a silent passive mode toggle.
- [ ] After `/logos-start`, the user answers naturally without `/logos-next` or `/logos-answer`.
- [ ] Sufficient answers advance conversationally.
- [ ] Partial answers trigger targeted follow-ups.
- [ ] Contradictions trigger explicit resolution.
- [ ] Lifecycle commands during active intake are control intents, not answers.
- [ ] Active question/follow-up is preserved before interrupting commands.
- [ ] `/logos-status` and `/logos-generate` pause safely during active intake.
- [ ] `/logos-start` during active intake re-emits without advancing.
- [ ] `/logos-init` during active intake blocks or requires confirmation.
- [ ] Core owns product behavior, profile resolution, question selection, evaluation transitions, preflight, and generation planning.
- [ ] Pi extension owns command registration, Pi input routing, project context adaptation, rendering, and UI confirmation only.
- [ ] Core imports no Pi, Ink, React, or legacy TUI modules.
- [ ] Active profile id persists in `.logos/config.yml`.
- [ ] Default profile id is `standard`.
- [ ] Profile path resolution is generic through `profiles/<profile-id>/`.
- [ ] Questions, validation, generation, artifacts, and Executive outputs derive from the active profile.
- [ ] Missing profile blocks init/start/generate and is reported by status.
- [ ] Generation runs preflight before writing.
- [ ] Missing critical intake blocks final generation.
- [ ] Partial generation requires explicit confirmation and marks docs incomplete.
- [ ] Legacy CLI/TUI flows are contained, removed, or explicitly non-primary.
- [ ] Required tests from `docs/LOGOS_PI_EXTENSION_SPEC.md` pass.

## Pi Documentation And Type Evidence Used

- Official Pi docs: `https://pi.dev/docs/latest/extensions`
- Local Pi docs: `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- Installed Pi types: `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/dist/index.d.ts`
- Installed Pi extension types: `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
- Local Pi examples inspected:
  - `examples/extensions/input-transform.ts`
  - `examples/extensions/send-user-message.ts`
  - `examples/extensions/message-renderer.ts`
  - `examples/extensions/question.ts`
  - `examples/extensions/qna.ts`
  - `examples/extensions/todo.ts`

## Roadmap Completion Definition

This roadmap is complete when an implementation following it produces a Pi-loadable LOGOS extension where:

1. `/logos-init` initializes project-local LOGOS state using the active profile.
2. `/logos-start` immediately emits the next unresolved question or active follow-up.
3. Natural-language answers advance, clarify, or ask for contradiction resolution without command-first progression.
4. Lifecycle commands safely interrupt active intake without corrupting state.
5. Active profile resolution is generic and persisted.
6. Generation preflight blocks unsafe or incomplete final generation.
7. Core is independent from Pi and testable in isolation.
8. Pi extension adapters call Core and do not duplicate product logic.
9. Legacy CLI/TUI code does not define or weaken the MVP interaction model.
10. Full contract, unit, integration, and end-to-end tests pass.
