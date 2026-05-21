# LOGOS Engine Implementation Roadmap

## 1. Roadmap Premises

### Confirmed Premises

- LOGOS Engine is a local-first CLI/TUI system that runs in the user's target repository, not a hosted service. Reference: `README.md`; Reference: `docs/04-engineering/02-system-architecture.md`; Reference: `docs/04-engineering/12-deployment-and-environments.md`
- The primary user interaction is `logos`, which opens a TUI. Explicit system operations happen through slash commands such as `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai`, `/help`, and `/exit`. Reference: `docs/03-product/10-functional-requirements.md`; Reference: `docs/03-product/06-interaction-model.md`
- The default documentation root for generated user project outputs is `logos/`, and the user may configure another root. The engine must not hard-code `docs/` as the generated documentation root. Reference: `docs/03-product/10-functional-requirements.md`; Reference: `docs/03-product/02-scope.md`; Reference: `docs/04-engineering/14-technical-risks.md`
- The initial bundled documentation profile is the Standard profile, while the architecture must allow future profiles. Reference: `docs/03-product/10-functional-requirements.md`; Reference: `docs/01-foundation/07-glossary.md`; Reference: `profiles/standard/README.md`
- Profile YAML defines structure, metadata, dependencies, required sections, outputs, and quality rules. Canonical Markdown contains project decisions and generated content. Reference: `profiles/standard/docs.yml`; Reference: `profiles/standard/document.schema.yml`
- HTML artifacts and agent packs are generated derivatives. They must never become canonical sources of truth. Reference: `profiles/standard/docs.yml`; Reference: `profiles/standard/document.schema.yml`; Reference: `docs/03-product/09-product-architecture.md`
- Structured local state, not private chat history, must preserve decisions, assumptions, open questions, sessions, generation runs, validation findings, and artifacts. Reference: `docs/04-engineering/05-data-model.md`; Reference: `docs/04-engineering/09-sync-and-state.md`
- AI may assist intake, suggestions, diagnostics, and drafting, but AI output must remain proposed or reviewable until explicitly accepted by the user. Reference: `README.md`; Reference: `docs/03-product/10-functional-requirements.md`; Reference: `docs/04-engineering/01-engineering-brief.md`
- Deterministic validation is separate from AI judgment and must work without live model calls. Reference: `README.md`; Reference: `docs/04-engineering/10-testing-strategy.md`; Reference: `docs/03-product/13-acceptance-criteria.md`
- Remote AI providers are opt-in. Raw provider tokens must not be stored in project files, logs, fixtures, Markdown, HTML, or agent packs. Reference: `README.md`; Reference: `SECURITY.md`; Reference: `docs/04-engineering/08-security-and-privacy.md`
- After initialization, every TUI startup must show an AI-generated startup briefing when provider rules allow it, with deterministic fallback when AI is unavailable. Reference: `docs/03-product/10-functional-requirements.md`; Reference: `docs/03-product/04-ux-model.md`; Reference: `docs/03-product/06-interaction-model.md`
- When documentation is already advanced, the intake engine may present contextual suggestions beside questions that depend on earlier decisions. Reference: `docs/03-product/10-functional-requirements.md`; Reference: `docs/03-product/04-ux-model.md`; Reference: `docs/03-product/06-interaction-model.md`
- The Executive Axis is generated from the normative documentation baseline. It produces a portable JSON execution graph plus derived exports; it does not create a live task manager. Reference: `profiles/standard/executive/executive-generation.yml`; Reference: `profiles/standard/executive/executive-plan.schema.json`; Reference: `docs/03-product/10-functional-requirements.md`
- GitHub Issue-compatible, Markdown, HTML, and agent-pack executive exports are file exports. Linear and Notion mappings are planned adapter contracts unless explicitly implemented and validated later. Reference: `profiles/standard/executive/executive-generation.yml`; Reference: `profiles/standard/executive/mappings/github-issues.mapping.yml`; Reference: `profiles/standard/executive/mappings/linear.mapping.yml`; Reference: `profiles/standard/executive/mappings/notion.mapping.yml`
- Hosted SaaS, user accounts, cloud workspace, live collaboration, profile marketplace, automatic external market/legal/competitive research, and live external sync are outside current MVP scope. Reference: `docs/01-foundation/05-boundaries.md`; Reference: `docs/03-product/02-scope.md`; Reference: `docs/03-product/10-functional-requirements.md`

### Assumptions

- Inference. The live repository currently contains documentation, profile contracts, and package metadata, but no implementation source tree. Phase 0 therefore starts by restoring the smallest executable TypeScript core. Reference: `package.json`; Reference: `tsconfig.json`
- Inference. The README still references `app-business`, while the current product documentation and profile folder define `standard` as the initial profile. The implementation should treat `standard` as current and schedule README correction as a documentation alignment task. Reference: `README.md`; Reference: `docs/03-product/10-functional-requirements.md`; Reference: `profiles/standard/README.md`
- Inference. External CLI subcommands should remain minimal because the product contract is TUI-first. Non-mutating commands such as `logos --help`, `logos --version`, and `logos doctor` are acceptable; mutating workflows should route through the TUI and slash commands unless a later document explicitly adds batch mode. Reference: `docs/03-product/06-interaction-model.md`; Reference: `docs/04-engineering/06-api-contracts.md`
- Inference. Importing transcripts or arbitrary notes is supported by the schema as an input type, but no detailed import workflow is documented. Phase 12 should implement bounded import for existing Markdown/profile files first and mark transcript import as deferred until specified. Reference: `profiles/standard/document.schema.yml`; Reference: `docs/04-engineering/07-integration-architecture.md`
- Inference. HTML rendering can start with static, self-contained local files and must avoid external scripts, telemetry, and unescaped user content. Reference: `docs/04-engineering/08-security-and-privacy.md`; Reference: `docs/04-engineering/14-technical-risks.md`; Reference: `profiles/standard/executive/mappings/html.mapping.yml`

### Constraints

- Preserve local-first behavior unless a future document explicitly changes the architecture. Reference: `docs/01-foundation/04-principles.md`; Reference: `docs/04-engineering/02-system-architecture.md`
- Treat profile YAML, local state, and canonical Markdown as the authoritative inputs for generation. Reference: `profiles/standard/docs.yml`; Reference: `docs/04-engineering/05-data-model.md`
- Do not send arbitrary repository source files to remote AI providers by default. Reference: `README.md`; Reference: `SECURITY.md`; Reference: `docs/04-engineering/08-security-and-privacy.md`
- Every mutating file operation must disclose target paths and protect against destructive overwrites. Reference: `docs/03-product/10-functional-requirements.md`; Reference: `docs/04-engineering/09-sync-and-state.md`
- Default tests must not require network access, AI credentials, live providers, or external services. Reference: `README.md`; Reference: `CONTRIBUTING.md`; Reference: `docs/04-engineering/10-testing-strategy.md`
- Executive exports must remain snapshots with source metadata and generated timestamps. Reference: `profiles/standard/executive/mappings/markdown.mapping.yml`; Reference: `profiles/standard/executive/mappings/html.mapping.yml`

### Explicit Non-Goals

- No hosted backend, managed database, cloud workspace, user account system, or multi-user collaboration in MVP. Reference: `docs/03-product/02-scope.md`; Reference: `docs/04-engineering/02-system-architecture.md`
- No live task management, ownership assignment, notification, calendar workflow, or bidirectional external sync in the Executive Axis MVP. Reference: `profiles/standard/executive/executive-generation.yml`; Reference: `docs/03-product/10-functional-requirements.md`
- No profile marketplace or broad profile authoring UI in MVP. Reference: `docs/03-product/10-functional-requirements.md`; Reference: `docs/05-go-to-market/10-pricing-and-packaging.md`
- No automatic external research engine. Reference: `docs/03-product/10-functional-requirements.md`
- No raw LLM token persistence in project files. Reference: `README.md`; Reference: `SECURITY.md`; Reference: `docs/04-engineering/08-security-and-privacy.md`
- No claim that current validation proves market demand, pricing, retention, or willingness to pay. Reference: `docs/02-validation/10-validation-report.md`; Reference: `docs/02-validation/08-evidence-log.md`

## 2. Current Repository Assessment

### Existing Structure

- The repository currently contains root project metadata, documentation, Standard profile contracts, and executive mapping templates.
- Present root files include `README.md`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`, `biome.json`, `.markdownlint.json`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, and documentation directories.
- Present documentation directories include `docs/01-foundation`, `docs/02-validation`, `docs/03-product`, `docs/04-engineering`, `docs/05-go-to-market`, and `docs/06-operations`.
- Present profile directories include `profiles/standard`, `profiles/standard/phases`, and `profiles/standard/executive`.
- The current repository does not contain `src/`, `tests/`, or `scripts/`. There is no implementation source tree in the live workspace.
- [DOC GAP] `docs/README.md` is not present.
- [DOC GAP] `docs/docs.yml` is not present.
- [DOC GAP] `docs/document.schema.json` is not present.
- [DOC GAP] `docs/phases/*.yml` is not present.
- [DOC GAP] `docs/raw/EXECUTIVE_AXIS_SPEC.md` is not present.
- [DOC GAP] root `executive/**` is not present.
- [DOC GAP] `AGENTS.md` is not present.
- [DOC GAP] `.cursor/rules` is not present.

### Existing Tooling

- `package.json` declares Node.js `>=22`, pnpm `10.33.2`, ESM, and the `logos` binary at `./dist/cli.js`.
- Declared runtime dependencies are `commander`, `ink`, `react`, `yaml`, and `zod`.
- Declared development tooling includes TypeScript, Vitest, Biome, markdownlint, and V8 coverage.
- `tsconfig.json` expects source files under `src/**/*.ts` and `src/**/*.tsx`, with output in `dist`.
- `vitest.config.ts` expects tests under `tests/**/*.test.ts`.
- `package.json` declares `smoke:cli` as `node scripts/smoke-cli.js`, but `scripts/smoke-cli.js` does not exist.
- The current `lint:biome` script uses `biome check --write --unsafe .`, which mutates files and is unsuitable as a strict CI check without a separate non-mutating script.

### Existing Documentation

- The normative documentation set is substantially filled across Foundation, Validation, Product, Engineering, Go-to-Market, and Operations.
- The Product and Engineering docs define a TUI-first, local-first, profile-driven architecture with Standard profile support, configurable `logos/` root, AI-assisted intake, structured local state, canonical Markdown generation, derived HTML and agent packs, validation gates, and Executive Axis compilation.
- The Standard profile registry exists at `profiles/standard/docs.yml`, with phase descriptors and document descriptors under `profiles/standard/phases`.
- The profile-wide document schema exists at `profiles/standard/document.schema.yml`.
- The Executive Axis profile exists under `profiles/standard/executive`, including generation rules, JSON schema, mappings, and templates.
- The root README is partially stale: it describes an `app-business` first profile and old documentation folders, while current profile and product docs define `standard` and the numbered documentation set.

### Missing Structural Pieces

- Implementation source tree: `src/`.
- Automated test tree: `tests/`.
- CLI smoke script: `scripts/smoke-cli.js`.
- Buildable CLI entrypoint: `src/cli.ts` or equivalent.
- TUI runtime implementation.
- Profile loader, schema validator, local state layer, generation pipeline, validation engine, artifact renderers, executive compiler, and export adapters.
- Non-mutating CI-quality scripts and CI workflow.
- Generated artifact registry and local `.logos/` workspace implementation.
- Roadmap output directory existed only after this planning task created `docs/roadmap/`.

### Implementation Readiness

- The documentation is ready to drive implementation, but the codebase is not yet executable.
- The package metadata is ahead of implementation: it declares build, test, smoke, CLI, and packaging behavior that the repository cannot yet satisfy because source and scripts are absent.
- Phase 0 must produce a minimal executable baseline before domain work starts.
- The current docs are detailed enough to implement the MVP without choosing hosted infrastructure, live sync, or a task-management product.

## 3. Implementation Strategy

### Build Order

1. Reconcile repository baseline, package scripts, and minimal CLI build.
2. Implement profile manifest and schema loading from `profiles/standard`.
3. Add TUI runtime and command routing while preserving `logos` as the default entrypoint.
4. Add local `.logos/` state, sessions, safe writes, and snapshots.
5. Implement intake, contextual suggestions, AI provider abstraction, and deterministic fallbacks.
6. Generate canonical Markdown from profile contracts and structured state.
7. Add deterministic validation, linting, review reports, dependency graph, staleness detection, and provenance.
8. Generate HTML artifacts and agent packs as derived outputs.
9. Compile the Executive Axis only after normative readiness checks pass.
10. Add import/scanner workflows and operational hardening.

This order starts from the smallest reliable executable core, then adds contracts, state, and generation before derived artifacts and executive exports. It avoids building export surfaces before the canonical state and Markdown pipeline are trustworthy.

### Architectural Approach

- Build a local modular TypeScript application with explicit boundaries: CLI adapter, TUI adapter, command router, profile loader, state repository, AI provider ports, intake service, validation service, generation service, artifact renderers, executive compiler, and filesystem adapter.
- Keep the core domain independent of Ink, Commander, live providers, and concrete filesystem implementation where practical.
- Treat Commander as process/bootstrap routing and Ink as interactive UI, not as the domain model.
- Use Zod or equivalent runtime validation for profile contracts, local state, AI outputs, and executive JSON.

### Data and State Approach

- Store workspace metadata, sessions, decisions, assumptions, questions, risks, validation runs, generation runs, artifacts, and provider config under `.logos/`.
- Store generated canonical Markdown under the configured documentation root, defaulting to `logos/`.
- Store derived artifacts under generated-output paths declared by profile descriptors or executive mappings.
- Use atomic writes, backups/snapshots, run metadata, checksums, and overwrite policies for all mutations.

### AI Provider Approach

- Define provider ports before integrating concrete providers.
- Ship fake/fixture providers first for tests and local development.
- Require explicit provider configuration and remote disclosure before sending context externally.
- Validate AI responses structurally before proposing changes to local state.
- Provide deterministic fallback for status, startup briefing essentials, validation, and generation planning.

### Artifact Generation Approach

- Generate canonical Markdown first.
- Generate HTML artifacts and agent packs only from profile YAML, canonical Markdown, structured state, and generation metadata.
- Label every derived artifact with source paths, generation time, and non-canonical status.
- Keep Executive Axis compilation separate from normative documentation generation.

### Testing Approach

- Build tests in every phase: unit tests for pure services, contract tests for schemas and profiles, CLI/TUI smoke tests, filesystem integration tests with temporary directories, snapshot tests for generated Markdown/HTML/agent packs, and security tests for token redaction and overwrite safety.
- Default tests must not require network, AI credentials, external services, or live providers.
- `pnpm check` should become the release gate after Phase 0 fixes scripts.

### Release Approach

- Release as an npm package containing `dist`, bundled profiles, docs, README, and LICENSE.
- Treat profile schema compatibility, state migrations, and package smoke tests as release blockers.
- Do not claim hosted reliability, sync, telemetry, or external-tool integration beyond file exports.

## 4. Phase Overview

| Phase | Name | Goal | Primary Deliverable | Depends On | Main Docs |
|---|---|---|---|---|---|
| Phase 0 | Repository Baseline | Make the repository buildable and testable from the current docs/package scaffold. | Minimal CLI package baseline | None | `README.md`, `package.json`, `docs/04-engineering/03-technical-stack.md` |
| Phase 1 | Manifest and Schema Core | Load and validate profile, phase, and document contracts. | Profile contract loader | Phase 0 | `profiles/standard/docs.yml`, `profiles/standard/document.schema.yml` |
| Phase 2 | CLI and TUI Runtime | Provide the `logos` entrypoint and slash-command shell. | Working local TUI shell | Phase 1 | `docs/03-product/06-interaction-model.md`, `docs/04-engineering/06-api-contracts.md` |
| Phase 3 | Local State and Sessions | Persist workspace state safely under `.logos/`. | State repository and session model | Phase 2 | `docs/04-engineering/05-data-model.md`, `docs/04-engineering/09-sync-and-state.md` |
| Phase 4 | Intake and Question Engine | Run AI-led intake with reviewable proposals and contextual suggestions. | Intake/session engine | Phase 3 | `docs/03-product/04-ux-model.md`, `docs/03-product/10-functional-requirements.md` |
| Phase 5 | Canonical Markdown Generation | Render canonical Markdown from contracts and confirmed state. | Markdown generation pipeline | Phase 4 | `profiles/standard/docs.yml`, `docs/03-product/10-functional-requirements.md` |
| Phase 6 | Validation, Linting, and Review Gates | Add deterministic quality checks and review reports. | Validation engine and reports | Phase 5 | `profiles/standard/docs.yml`, `docs/04-engineering/10-testing-strategy.md` |
| Phase 7 | Dependency Graph and Staleness | Track upstream/downstream document impact. | Dependency graph and stale planner | Phase 6 | `profiles/standard/docs.yml`, `docs/04-engineering/09-sync-and-state.md` |
| Phase 8 | Provenance and Registers | Preserve sources, confidence, decisions, assumptions, and unresolved questions. | Provenance and register services | Phase 7 | `docs/04-engineering/05-data-model.md`, `docs/02-validation/09-decision-record.md` |
| Phase 9 | HTML Artifacts | Generate local static HTML artifacts as derived review views. | HTML artifact renderer | Phase 8 | `profiles/standard/docs.yml`, `docs/04-engineering/14-technical-risks.md` |
| Phase 10 | Agent Packs | Generate bounded execution packs for coding and review agents. | Agent pack renderer | Phase 8 | `profiles/standard/docs.yml`, `profiles/standard/executive/mappings/agent-pack.mapping.yml` |
| Phase 11 | Executive Axis Compilation | Compile portable executive JSON and supported exports after readiness checks. | Executive compiler and file exports | Phases 8-10 | `profiles/standard/executive/executive-generation.yml`, `docs/03-product/10-functional-requirements.md` |
| Phase 12 | Import and Repository Scanner | Import existing docs and inspect repository/tooling consistency. | Import/scanner reports | Phase 11 | `profiles/standard/document.schema.yml`, `docs/04-engineering/07-integration-architecture.md` |
| Phase 13 | Operational Hardening | Prepare safe package release and supportable local operation. | Release candidate | Phase 12 | `docs/04-engineering/12-deployment-and-environments.md`, `docs/06-operations/09-incident-management.md` |

## 5. Detailed Implementation Phases

### Phase 0 — Repository Baseline

#### Goal

Create the smallest reliable executable TypeScript package from the current documentation and package scaffold.

#### Why This Phase Exists

The repository declares a CLI, build, tests, and smoke script, but the live workspace has no `src/`, `tests/`, or `scripts/`. Later phases need a working baseline before implementing domain behavior.

#### Inputs

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `biome.json`
- `.markdownlint.json`
- `README.md`
- `CONTRIBUTING.md`
- `docs/04-engineering/03-technical-stack.md`

#### Outputs

- Minimal `src/` structure.
- Minimal `tests/` structure.
- Minimal `scripts/smoke-cli.js`.
- Buildable `dist/cli.js`.
- Non-mutating quality scripts suitable for CI.
- Updated local development instructions if behavior changes.

#### Relevant Documentation

- `README.md`
- `package.json`
- `docs/04-engineering/01-engineering-brief.md`
- `docs/04-engineering/03-technical-stack.md`
- `docs/04-engineering/13-engineering-standards.md`

#### Steps

#### Step 0.1 — Reconcile Current Package Contract

**Objective:**  
Make package metadata, scripts, and documented local-development commands truthful.

**Work:**

- Audit `package.json`, `README.md`, `CONTRIBUTING.md`, `tsconfig.json`, `vitest.config.ts`, and `biome.json`.
- Record the README drift from `app-business` to `standard`.
- Split mutating format scripts from non-mutating check scripts where needed.
- Keep `logos` as the package binary.
- Do not add runtime dependencies beyond the documented stack.

**References:**

- `README.md`
- `package.json`
- `docs/04-engineering/03-technical-stack.md`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
Package and development-command contract that another agent can build against.

**Validation:**  
`pnpm --version`, `node --version`, and package script inspection show a coherent Node 22/pnpm 10 baseline.

**Suggested Tests:**

- Script contract test that asserts required scripts exist.
- Static test that `package.json` binary points to the built CLI file.

**Agent Notes:**  
Do not change the product model to fit stale README text. Treat Standard profile docs as current.

#### Step 0.2 — Scaffold Minimal TypeScript Source Tree

**Objective:**  
Create the smallest source layout required by `tsconfig.json` and package exports.

**Work:**

- Create `src/index.ts` exporting package metadata and core placeholder types.
- Create `src/cli.ts` as the future executable entrypoint.
- Add a shebang-compatible CLI build strategy if needed.
- Keep the placeholder free of domain behavior that belongs to later phases.

**References:**

- `package.json`
- `tsconfig.json`
- `docs/04-engineering/02-system-architecture.md`
- `docs/04-engineering/13-engineering-standards.md`

**Deliverable:**  
Compilable TypeScript source tree.

**Validation:**  
`pnpm build` emits `dist/index.js`, `dist/index.d.ts`, and `dist/cli.js`.

**Suggested Tests:**

- Unit test importing the package entrypoint.
- CLI smoke test for `--help` or version output.

**Agent Notes:**  
Do not implement profile loading, state, generation, or TUI behavior in this step.

#### Step 0.3 — Add Test and Smoke Baseline

**Objective:**  
Make the repository's declared test and smoke commands real.

**Work:**

- Create `tests/` with a minimal Vitest test.
- Create `scripts/smoke-cli.js` to verify the built CLI can start in non-interactive mode.
- Ensure smoke output does not require an initialized workspace.
- Avoid tests that call network, live AI, or external services.

**References:**

- `package.json`
- `vitest.config.ts`
- `README.md`
- `docs/04-engineering/10-testing-strategy.md`

**Deliverable:**  
Passing baseline test and smoke commands.

**Validation:**  
`pnpm test`, `pnpm build`, and `pnpm smoke:cli` pass.

**Suggested Tests:**

- Vitest package import test.
- Smoke script invoking `node dist/cli.js --help`.

**Agent Notes:**  
Keep this phase small. It proves the executable skeleton, not product behavior.

#### Step 0.4 — Establish CI-Ready Quality Gate

**Objective:**  
Define the quality gate later phases must keep green.

**Work:**

- Make `pnpm check` run non-mutating lint, markdownlint, tests, typecheck, and build.
- Keep a separate formatting script for write operations.
- Add a basic CI workflow if repository policy allows it.
- Document exact local commands.

**References:**

- `CONTRIBUTING.md`
- `docs/04-engineering/10-testing-strategy.md`
- `docs/04-engineering/12-deployment-and-environments.md`
- `docs/04-engineering/14-technical-risks.md`

**Deliverable:**  
Repeatable quality gate for all later phases.

**Validation:**  
`pnpm check` exits successfully on a clean repository.

**Suggested Tests:**

- CI smoke run.
- Markdown lint run over new docs.

**Agent Notes:**  
If CI is deferred, record it as a release risk rather than silently relying on manual checks.

#### Acceptance Criteria

- The repository builds from source.
- The `logos` binary can print help/version information.
- `pnpm test`, `pnpm build`, `pnpm smoke:cli`, `pnpm lint:md`, and `pnpm check` are meaningful.
- No live AI, network, or external service is required.

#### Tests

- Package import unit test.
- CLI smoke test.
- Typecheck and build.
- Markdownlint and Biome check.

#### Risks

- Package scripts remain aspirational.
- Stale README profile naming misleads implementers.
- CI check mutates files if Biome script is not corrected.

#### Out of Scope

- TUI interaction.
- Profile loading.
- Workspace state.
- Document generation.

### Phase 1 — Manifest and Schema Core

#### Goal

Load, normalize, and validate documentation profile contracts from the bundled Standard profile.

#### Why This Phase Exists

All later behavior depends on profile YAML being trustworthy. The engine cannot generate, validate, or compile executive artifacts until it can read phases, documents, dependencies, outputs, and status rules.

#### Inputs

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `profiles/standard/phases/**/*.yml`
- `docs/03-product/05-information-architecture.md`
- `docs/04-engineering/04-domain-model.md`

#### Outputs

- Profile registry loader.
- Phase descriptor loader.
- Document descriptor loader.
- Runtime schema validation.
- Canonical document ID and dependency index.

#### Relevant Documentation

- `profiles/standard/README.md`
- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/04-engineering/05-data-model.md`

#### Steps

#### Step 1.1 — Implement Profile Registry Loader

**Objective:**  
Read `profiles/<profileId>/docs.yml` and expose a typed profile registry.

**Work:**

- Create profile loader module.
- Resolve profile root, registry path, phase registry, axes, output model, global rules, status workflow, and roadmap integration.
- Validate required fields and produce file-path-aware errors.
- Add support for selecting `standard` during initialization later.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/README.md`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
Typed `ProfileRegistry` contract and loader.

**Validation:**  
Loading `profiles/standard/docs.yml` succeeds and invalid fixture registries fail with path-aware diagnostics.

**Suggested Tests:**

- Contract tests for valid Standard registry.
- Fixture tests for missing phase registry, invalid axis, and unsupported output role.

**Agent Notes:**  
Do not hard-code Standard documents outside tests. The loader must support future profiles.

#### Step 1.2 — Implement Document Schema Validation

**Objective:**  
Turn the profile-wide document schema into executable validation.

**Work:**

- Parse `profiles/standard/document.schema.yml`.
- Implement runtime validation for document descriptors.
- Validate required fields, status values, outputs, dependencies, sections, completion criteria, quality checks, anti-patterns, generation rules, and review rules.
- Report errors with file path and JSON/YAML pointer.

**References:**

- `profiles/standard/document.schema.yml`
- `docs/04-engineering/13-engineering-standards.md`
- `docs/04-engineering/10-testing-strategy.md`

**Deliverable:**  
Document descriptor validator.

**Validation:**  
All bundled document descriptor YAML files validate.

**Suggested Tests:**

- Schema contract tests.
- Invalid fixture tests for missing `id`, missing canonical output path, invalid output type, and invalid dependency shape.

**Agent Notes:**  
The current schema is YAML, not JSON Schema. Preserve the source contract unless a later step explicitly generates JSON Schema as a derived artifact.

#### Step 1.3 — Load Phase and Document Descriptors

**Objective:**  
Build a complete in-memory documentation contract from profile phases and documents.

**Work:**

- Read phase files listed by `phaseRegistry`.
- Read per-phase document files.
- Normalize document IDs as stable canonical IDs.
- Preserve order, phase, dependencies, inputs, outputs, completion criteria, and questions.
- Detect duplicate IDs and missing descriptor files.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/phases/01-foundation.yml`
- `profiles/standard/phases/03-product.yml`
- `profiles/standard/phases/04-engineering.yml`

**Deliverable:**  
`DocumentationContract` aggregate.

**Validation:**  
A command or test can list all Standard phases and documents in deterministic order.

**Suggested Tests:**

- Snapshot test for loaded Standard phase/document index.
- Duplicate ID fixture test.
- Missing descriptor fixture test.

**Agent Notes:**  
Canonical IDs must remain stable across regeneration and export phases.

#### Step 1.4 — Model Status, Outputs, and Dependencies

**Objective:**  
Create reusable contract primitives for status workflow, output declarations, and dependency declarations.

**Work:**

- Implement allowed status workflow from registry and document schema.
- Normalize canonical, artifact, agent-pack, data, and executive output declarations.
- Build dependency references but do not yet compute staleness.
- Add circular-dependency detection for descriptors.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/04-engineering/05-data-model.md`

**Deliverable:**  
Validated contract graph primitives.

**Validation:**  
Contract graph reports all outputs and blocks circular dependencies in fixtures.

**Suggested Tests:**

- Unit tests for status transitions.
- Contract tests for declared outputs.
- Circular dependency tests.

**Agent Notes:**  
Do not generate files yet. This phase is read and validate only.

#### Acceptance Criteria

- Bundled Standard profile validates from disk.
- Profile loading errors are actionable and include source paths.
- Phase and document indexes are deterministic.
- Output declarations distinguish canonical Markdown, HTML artifacts, agent packs, and data outputs.

#### Tests

- Profile contract tests.
- Schema validation fixture tests.
- Snapshot test for Standard contract index.
- Dependency validation tests.

#### Risks

- Profile schema drift blocks all downstream phases.
- Runtime validation diverges from YAML schema language.

#### Out of Scope

- CLI/TUI presentation.
- Workspace initialization.
- Markdown rendering.
- Executive compilation.

### Phase 2 — CLI and TUI Runtime

#### Goal

Provide the local `logos` entrypoint, TUI shell, command parser, and basic non-mutating diagnostics.

#### Why This Phase Exists

The product contract is TUI-first. Users need a stable shell before state, intake, and generation can be exposed safely.

#### Inputs

- Phase 1 profile contract loader.
- `docs/03-product/06-interaction-model.md`
- `docs/03-product/07-ui-specification.md`
- `docs/04-engineering/06-api-contracts.md`

#### Outputs

- Commander bootstrap.
- Ink TUI shell.
- Slash command router.
- Repository root detection.
- Basic logging and error formatting.
- Non-mutating `doctor` diagnostic surface.

#### Relevant Documentation

- `README.md`
- `docs/03-product/06-interaction-model.md`
- `docs/03-product/07-ui-specification.md`
- `docs/04-engineering/02-system-architecture.md`
- `docs/04-engineering/06-api-contracts.md`

#### Steps

#### Step 2.1 — Implement CLI Bootstrap

**Objective:**  
Make `logos` start the TUI and support minimal non-interactive metadata commands.

**Work:**

- Use Commander for `logos`, `logos --help`, `logos --version`, and `logos doctor`.
- Keep `logos` without arguments as the primary TUI entrypoint.
- Avoid adding mutating batch commands unless later docs require them.
- Return structured exit codes for startup failures.

**References:**

- `README.md`
- `package.json`
- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/06-api-contracts.md`

**Deliverable:**  
Working CLI bootstrap.

**Validation:**  
`node dist/cli.js --help`, `node dist/cli.js --version`, and `node dist/cli.js doctor` run without initialized workspace.

**Suggested Tests:**

- CLI invocation tests.
- Exit-code tests.
- Snapshot tests for help text.

**Agent Notes:**  
Do not turn documented slash commands into external batch commands unless the implementation also preserves TUI-first behavior.

#### Step 2.2 — Implement TUI Shell and Slash Router

**Objective:**  
Create a keyboard-driven TUI shell for explicit system commands and free-form input.

**Work:**

- Build an Ink root component with command input, message log, status line, and help surface.
- Implement slash command parsing for `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai`, `/help`, and `/exit`.
- Route unprefixed text to the future intake engine placeholder.
- Show active repository path, documentation root, profile, and provider status when available.

**References:**

- `docs/03-product/06-interaction-model.md`
- `docs/03-product/07-ui-specification.md`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
Interactive TUI shell with command routing stubs.

**Validation:**  
Manual and automated TUI smoke tests can open the shell, run `/help`, run `/status`, and exit.

**Suggested Tests:**

- Command parser unit tests.
- TUI rendering tests for `/help` and unknown commands.
- Keyboard flow smoke test where practical.

**Agent Notes:**  
Use concise terminal copy. Do not rely only on color to communicate status.

#### Step 2.3 — Implement Project Root and Config Detection

**Objective:**  
Identify the active repository and workspace configuration before any write or AI operation.

**Work:**

- Detect project root from current working directory using Git and package markers.
- Detect `.logos/` workspace presence.
- Detect configured documentation root when state exists.
- Load global or project config only from documented local locations.
- Report missing initialization as a recoverable state.

**References:**

- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/05-data-model.md`
- `docs/04-engineering/09-sync-and-state.md`

**Deliverable:**  
Root/config detection service.

**Validation:**  
`logos doctor` and `/status` report repository path and initialization state.

**Suggested Tests:**

- Temporary-directory integration tests.
- Git and non-Git directory detection tests.
- Missing `.logos/` tests.

**Agent Notes:**  
Do not write files in this step.

#### Step 2.4 — Add Error, Logging, Dry-Run, and JSON Result Conventions

**Objective:**  
Create common command result semantics before mutating workflows exist.

**Work:**

- Define typed result envelopes with status, messages, changed paths, warnings, and errors.
- Add dry-run capability to command/service contracts where practical.
- Add `--json` output for non-interactive diagnostic commands such as `logos doctor`.
- Implement redaction helpers for paths and secret-like values.

**References:**

- `docs/04-engineering/06-api-contracts.md`
- `docs/04-engineering/08-security-and-privacy.md`
- `docs/04-engineering/11-observability.md`
- `docs/04-engineering/13-engineering-standards.md`

**Deliverable:**  
Shared command-result and error model.

**Validation:**  
Errors include code, message, path where relevant, and recovery hint.

**Suggested Tests:**

- Unit tests for result formatting.
- JSON output schema tests.
- Secret redaction tests.

**Agent Notes:**  
JSON mode is for diagnostics and automation-friendly inspection, not a separate product workflow.

#### Acceptance Criteria

- `logos` starts the TUI.
- `/help`, `/status`, and `/exit` work.
- `logos doctor` works without initialization.
- Unknown commands fail gracefully.
- No command performs unsafe writes.

#### Tests

- CLI tests.
- Command parser tests.
- TUI smoke tests.
- Error-format and redaction tests.

#### Risks

- CLI surface grows beyond documented TUI-first scope.
- TUI tests become brittle.

#### Out of Scope

- Workspace mutation.
- AI calls.
- Generation.
- Executive exports.

### Phase 3 — Local State and Sessions

#### Goal

Implement safe local workspace state under `.logos/`, including initialization, profile lock, sessions, snapshots, and artifact registry.

#### Why This Phase Exists

LOGOS needs durable structured state before AI intake, Markdown generation, validation, and continuation can be reliable.

#### Inputs

- Phase 1 contract loader.
- Phase 2 TUI command router.
- `docs/04-engineering/05-data-model.md`
- `docs/04-engineering/09-sync-and-state.md`

#### Outputs

- `.logos/` workspace structure.
- Workspace state schemas.
- Safe filesystem adapter.
- Initialization flow.
- Snapshot and rollback primitives.
- Session and run metadata records.

#### Relevant Documentation

- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/05-data-model.md`
- `docs/04-engineering/09-sync-and-state.md`
- `docs/04-engineering/08-security-and-privacy.md`

#### Steps

#### Step 3.1 — Define Workspace State Schemas

**Objective:**  
Create typed, versioned schemas for the local `.logos/` state model.

**Work:**

- Define workspace metadata, documentation root config, profile lock, provider config reference, decisions, assumptions, open questions, risks, sessions, validation runs, generation runs, artifacts, audit events, and migrations.
- Store provider token environment-variable names, never token values.
- Include schema version fields.
- Support Standard profile id/version/source metadata.

**References:**

- `docs/04-engineering/05-data-model.md`
- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/08-security-and-privacy.md`

**Deliverable:**  
Versioned state schema module.

**Validation:**  
Empty and sample workspace states validate.

**Suggested Tests:**

- State schema unit tests.
- Token persistence negative tests.
- Snapshot tests for default initialized state.

**Agent Notes:**  
Do not make Markdown the only source of decision state.

#### Step 3.2 — Implement Safe Filesystem Writes

**Objective:**  
Protect local user files during initialization and later mutations.

**Work:**

- Implement atomic JSON writes.
- Create backups or snapshots before mutating existing state.
- Refuse destructive overwrites unless the caller passes an explicit policy.
- Track changed paths in command results.
- Keep dry-run paths side-effect free.

**References:**

- `docs/04-engineering/09-sync-and-state.md`
- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/14-technical-risks.md`

**Deliverable:**  
Filesystem adapter with atomic write and backup support.

**Validation:**  
Interruption/corruption fixtures fail safely and preserve recoverable state.

**Suggested Tests:**

- Temporary filesystem integration tests.
- Overwrite collision tests.
- Dry-run no-write tests.

**Agent Notes:**  
All later write paths should depend on this adapter.

#### Step 3.3 — Implement `/init` Workspace Creation

**Objective:**  
Create a local LOGOS workspace with selected profile and documentation root.

**Work:**

- Ask for or accept default documentation root `logos/`.
- Let the user select `standard` as initial default profile.
- Persist workspace metadata, profile lock, documentation root, created timestamp, and initial status.
- Show target paths before writes.
- Support custom documentation root without assuming `docs/`.

**References:**

- `docs/03-product/02-scope.md`
- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/05-data-model.md`

**Deliverable:**  
Working `/init` flow.

**Validation:**  
Running `/init` creates `.logos/` and records active profile/root without generating canonical docs.

**Suggested Tests:**

- TUI flow test for default init.
- Custom root test.
- Existing `.logos/` collision test.

**Agent Notes:**  
Initialization should not call AI and should not generate docs automatically.

#### Step 3.4 — Implement Sessions, Runs, and Artifact Registry

**Objective:**  
Prepare durable records for continuation, generation reports, and artifact tracking.

**Work:**

- Add session records for intake and TUI runs.
- Add run metadata for validation, diagnostics, generation, and executive compilation.
- Add artifact registry entries with type, source, path, status, checksum, generatedAt, and non-canonical marker where applicable.
- Expose current status through `/status`.

**References:**

- `docs/04-engineering/05-data-model.md`
- `docs/03-product/05-information-architecture.md`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
State-backed status and artifact registry primitives.

**Validation:**  
`/status` reports workspace, root, profile, sessions, and artifact summary.

**Suggested Tests:**

- State repository tests.
- Status query tests.
- Artifact registry schema tests.

**Agent Notes:**  
Artifact registry entries are metadata. They do not make artifacts canonical.

#### Acceptance Criteria

- `/init` creates a safe `.logos/` workspace.
- Standard profile and configurable documentation root are persisted.
- `.logos/` state validates on read and write.
- `/status` reports current local state.
- Raw tokens are never persisted.

#### Tests

- State schema tests.
- Filesystem integration tests.
- Init flow tests.
- Recovery and collision tests.

#### Risks

- State corruption blocks continuation.
- Root handling regresses to `docs/`.
- Manual edits or existing files are overwritten.

#### Out of Scope

- AI intake.
- Markdown rendering.
- Derived artifact generation.

### Phase 4 — Intake and Question Engine

#### Goal

Implement AI-led intake sessions that produce reviewable structured proposals, contextual suggestions, and startup briefings.

#### Why This Phase Exists

LOGOS is a decision clarification engine. It must turn conversation into explicit decisions, assumptions, hypotheses, risks, and open questions without silently treating AI output as confirmed truth.

#### Inputs

- Phase 3 state repository.
- Profile document questions and sections.
- Provider configuration.
- `docs/03-product/04-ux-model.md`
- `docs/03-product/10-functional-requirements.md`

#### Outputs

- Intake session model.
- Question selection service.
- AI provider port and fake provider.
- Proposal review flow.
- Contextual suggestions.
- Startup briefing.

#### Relevant Documentation

- `README.md`
- `docs/03-product/03-user-journeys.md`
- `docs/03-product/04-ux-model.md`
- `docs/03-product/06-interaction-model.md`
- `docs/04-engineering/01-engineering-brief.md`

#### Steps

#### Step 4.1 — Implement Question Planning from Profile Contracts

**Objective:**  
Select small, relevant question clusters from document descriptors and current state.

**Work:**

- Load questions from document descriptors.
- Classify questions as blocking or non-blocking where descriptors and completion criteria support it.
- Order questions by phase dependencies, missing required sections, current status, and open gaps.
- Avoid long deterministic questionnaires.
- Preserve unresolved questions when answers are not available.

**References:**

- `profiles/standard/document.schema.yml`
- `profiles/standard/docs.yml`
- `docs/03-product/04-ux-model.md`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
Question planning service.

**Validation:**  
Given an initialized empty workspace, the planner returns a small next-question cluster with source document IDs.

**Suggested Tests:**

- Unit tests for empty, partial, and advanced workspaces.
- Snapshot tests for planned question clusters.
- Dependency-order tests.

**Agent Notes:**  
Questions should be sourced from profile contracts, not a global question bank.

#### Step 4.2 — Implement AI Provider Port and Intake Context Builder

**Objective:**  
Prepare AI-led intake without binding the core to any live provider.

**Work:**

- Define provider interface for conversation, structured extraction, suggestion, and startup briefing operations.
- Implement fake provider for tests.
- Build scoped context from profile contracts, current state, relevant answers, decisions, assumptions, open questions, and validation gaps.
- Require remote provider disclosure before sending context externally.
- Validate provider responses before use.

**References:**

- `README.md`
- `SECURITY.md`
- `docs/04-engineering/08-security-and-privacy.md`
- `docs/04-engineering/07-integration-architecture.md`

**Deliverable:**  
Provider abstraction and context builder.

**Validation:**  
Default tests use fake provider only; remote-provider calls cannot run before disclosure/consent.

**Suggested Tests:**

- Fake provider tests.
- Context redaction tests.
- Remote disclosure guard tests.
- Invalid AI response tests.

**Agent Notes:**  
Do not store raw prompts or model tokens in project files.

#### Step 4.3 — Map Answers to Reviewable Proposals

**Objective:**  
Convert user answers and AI extraction into proposed structured state.

**Work:**

- Extract proposed decisions, assumptions, hypotheses, open questions, risks, and document content hints.
- Store proposals separately from confirmed records.
- Add accept, reject, and revise operations.
- Preserve source answer/session IDs.
- Prevent AI-generated decisions from becoming confirmed without explicit user action.

**References:**

- `README.md`
- `docs/04-engineering/05-data-model.md`
- `docs/03-product/10-functional-requirements.md`
- `docs/02-validation/09-decision-record.md`

**Deliverable:**  
Proposal review workflow.

**Validation:**  
User confirmation is required before proposed state becomes confirmed.

**Suggested Tests:**

- Proposal lifecycle tests.
- AI status versus decision status tests.
- Source traceability tests.

**Agent Notes:**  
Conversation is input evidence, not canonical state.

#### Step 4.4 — Implement Contextual Suggestions and Startup Briefing

**Objective:**  
Help users resume and answer dependent questions based on current structured state.

**Work:**

- Generate contextual suggestions for advanced intake when a question directly depends on prior decisions, assumptions, open questions, completed documents, or validation gaps.
- On every post-init TUI startup, produce a status briefing using AI when allowed.
- Provide deterministic fallback briefing with current state, gaps, and next command when AI is unavailable.
- Show recovery options such as `/continue`, `/status`, `/diagnose`, `/validate`, `/generate`, and `/config ai`.

**References:**

- `docs/03-product/10-functional-requirements.md`
- `docs/03-product/04-ux-model.md`
- `docs/03-product/06-interaction-model.md`
- `docs/03-product/13-acceptance-criteria.md`

**Deliverable:**  
State-aware startup briefing and contextual suggestion service.

**Validation:**  
Initialized workspaces always show a continuation briefing at TUI startup.

**Suggested Tests:**

- Startup briefing tests with fake provider.
- Deterministic fallback tests.
- Contextual suggestion tests for advanced state fixtures.

**Agent Notes:**  
Suggestions must be visibly suggestions, not auto-filled decisions.

#### Acceptance Criteria

- `/continue` can guide an initialized workspace through small question clusters.
- AI proposals require explicit review.
- Startup briefing appears after initialization.
- Contextual suggestions appear only when supported by prior state.
- No live provider is required for tests.

#### Tests

- Question planner tests.
- Provider abstraction tests.
- Proposal lifecycle tests.
- Startup briefing tests.
- Security/redaction tests.

#### Risks

- AI output becomes silently authoritative.
- Context sent to remote providers is too broad.
- Suggestions feel like confirmed facts.

#### Out of Scope

- Markdown file writing.
- HTML artifacts.
- Executive compilation.

### Phase 5 — Canonical Markdown Generation

#### Goal

Render canonical Markdown documents under the configured LOGOS documentation root from profile contracts and confirmed structured state.

#### Why This Phase Exists

Canonical Markdown is the user-facing documentation output and the source for derived artifacts. It must be deterministic, source-aware, and safe around manual edits.

#### Inputs

- Phase 4 confirmed state.
- Profile document descriptors.
- Configured documentation root.
- Existing Markdown files when present.

#### Outputs

- Generation planner.
- Markdown renderer.
- Safe writer with overwrite policy.
- Generation report.
- Missing-section and incomplete-document detection.

#### Relevant Documentation

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/05-data-model.md`
- `docs/04-engineering/09-sync-and-state.md`

#### Steps

#### Step 5.1 — Implement Generation Planner

**Objective:**  
Determine which canonical Markdown documents can be generated, skipped, blocked, or marked incomplete.

**Work:**

- Evaluate document dependencies, required inputs, required sections, status, and confirmed state.
- Distinguish generated, updated, skipped, incomplete, blocked, failed, and stale outputs.
- Support dry-run planning without writes.
- Preserve explicit uncertainty and unresolved questions.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
Generation plan model and service.

**Validation:**  
Dry-run generation reports planned actions without changing files.

**Suggested Tests:**

- Planner tests for empty, partial, and complete state.
- Missing dependency tests.
- Dry-run tests.

**Agent Notes:**  
Do not invent missing project facts to satisfy required sections.

#### Step 5.2 — Implement Canonical Markdown Renderer

**Objective:**  
Render profile-defined documents into consistent Markdown.

**Work:**

- Resolve document sections from descriptors.
- Render title, metadata, purpose, status, sources, decisions, assumptions, unresolved questions, generated content, and quality notes.
- Include generated metadata headers where appropriate.
- Keep content in English when the workspace language/config requires it.
- Avoid generic prose when state is insufficient; mark gaps explicitly.

**References:**

- `profiles/standard/document.schema.yml`
- `docs/03-product/05-information-architecture.md`
- `docs/03-product/09-product-architecture.md`
- `docs/04-engineering/13-engineering-standards.md`

**Deliverable:**  
Markdown renderer for canonical documents.

**Validation:**  
Renderer snapshots match expected Markdown for fixture states.

**Suggested Tests:**

- Snapshot tests per document type.
- Missing-section rendering tests.
- Source/gap marker tests.

**Agent Notes:**  
Markdown is editable canonical output, but generation must preserve traceability to structured state.

#### Step 5.3 — Implement Safe Markdown Writes and Manual Edit Detection

**Objective:**  
Write generated Markdown without destroying user edits.

**Work:**

- Use checksums, generated metadata, mtime, or registry records to detect manual edits.
- Provide overwrite policies: skip, fail, backup-and-write, or explicit overwrite.
- Report collisions and skipped files.
- Ensure generated root defaults to `logos/`, not `docs/`.

**References:**

- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/09-sync-and-state.md`
- `docs/04-engineering/14-technical-risks.md`

**Deliverable:**  
Safe Markdown writer.

**Validation:**  
Regeneration does not overwrite modified files without explicit policy.

**Suggested Tests:**

- Manual edit collision tests.
- Custom root tests.
- Backup and skip tests.

**Agent Notes:**  
This is a release-blocking safety surface.

#### Step 5.4 — Implement `/generate` for Canonical Docs

**Objective:**  
Expose canonical Markdown generation through the TUI.

**Work:**

- Add `/generate` route for canonical Markdown outputs.
- Show preflight summary and target root.
- Run planner, renderer, writer, and report generation.
- Persist generation run metadata and artifact registry updates.

**References:**

- `docs/03-product/06-interaction-model.md`
- `docs/03-product/10-functional-requirements.md`
- `docs/03-product/13-acceptance-criteria.md`

**Deliverable:**  
User-invoked canonical Markdown generation.

**Validation:**  
Running `/generate` creates or updates canonical Markdown under configured root and reports outcomes.

**Suggested Tests:**

- End-to-end temp workspace generation test.
- Generation report snapshot test.
- Blocked/incomplete output tests.

**Agent Notes:**  
Generation remains user-triggered. Do not auto-generate at the end of questions.

#### Acceptance Criteria

- `/generate` renders canonical Markdown under the configured root.
- Missing facts are marked as gaps or unresolved questions.
- Manual edits are protected.
- Generation reports created, updated, skipped, incomplete, blocked, and failed outputs.

#### Tests

- Planner unit tests.
- Renderer snapshot tests.
- Filesystem writer tests.
- End-to-end generation test.

#### Risks

- Generic generated content hides uncertainty.
- Root defaults regress to `docs/`.
- Manual edits are overwritten.

#### Out of Scope

- HTML artifact generation.
- Agent packs.
- Executive Axis.

### Phase 6 — Validation, Linting, and Review Gates

#### Goal

Implement deterministic validation and review gates for contracts, state, canonical docs, and generation readiness.

#### Why This Phase Exists

LOGOS must detect missing decisions, contradictions, boundary violations, stale dependencies, and unsafe outputs without relying on AI judgment.

#### Inputs

- Profile contracts.
- Local state.
- Generated Markdown.
- Generation reports.

#### Outputs

- Validation engine.
- Review report.
- `/validate` command.
- `/diagnose` deterministic baseline with optional AI assistance.
- Gate status model.

#### Relevant Documentation

- `profiles/standard/docs.yml`
- `docs/03-product/13-acceptance-criteria.md`
- `docs/04-engineering/10-testing-strategy.md`
- `docs/04-engineering/13-engineering-standards.md`
- `docs/04-engineering/14-technical-risks.md`

#### Steps

#### Step 6.1 — Validate Contracts, State, and Outputs

**Objective:**  
Run deterministic schema and consistency checks across the active workspace.

**Work:**

- Validate profile registry, phase descriptors, document descriptors, local state, artifact registry, and generated output metadata.
- Check missing dependencies, invalid statuses, circular dependencies, unknown document IDs, and invalid roots.
- Emit findings with severity, path, pointer, source, and recovery hint.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/04-engineering/10-testing-strategy.md`

**Deliverable:**  
Validation service and finding model.

**Validation:**  
Invalid fixtures produce deterministic findings.

**Suggested Tests:**

- Schema validation tests.
- Workspace consistency tests.
- Finding format tests.

**Agent Notes:**  
Do not use AI to decide pass/fail for deterministic gates.

#### Step 6.2 — Implement Document Completeness and Semantic Lints

**Objective:**  
Check canonical documents for required sections, traceability, contradictions, and boundary integrity.

**Work:**

- Check required sections from descriptors.
- Check unresolved questions and assumptions are explicitly marked.
- Check docs do not claim external validation beyond evidence.
- Check generated artifacts are labeled as derived.
- Check no generated outputs contain raw token-like values.

**References:**

- `profiles/standard/docs.yml`
- `docs/02-validation/10-validation-report.md`
- `docs/04-engineering/08-security-and-privacy.md`
- `docs/04-engineering/14-technical-risks.md`

**Deliverable:**  
Semantic lint service.

**Validation:**  
Fixture docs with missing sections, unsupported claims, or token-like strings fail.

**Suggested Tests:**

- Markdown fixture lint tests.
- Token leak tests.
- Evidence boundary tests.

**Agent Notes:**  
Semantic lints should be conservative and explain what they checked.

#### Step 6.3 — Implement `/validate`, `/diagnose`, and Review Reports

**Objective:**  
Expose validation and review findings to the user.

**Work:**

- Add `/validate` for deterministic checks.
- Add `/diagnose` as deterministic findings plus optional AI interpretation when configured.
- Persist validation and diagnostic run metadata.
- Generate local review report artifacts.

**References:**

- `docs/03-product/06-interaction-model.md`
- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/11-observability.md`

**Deliverable:**  
Validation and diagnostics TUI workflows.

**Validation:**  
Users can run `/validate` without provider configuration.

**Suggested Tests:**

- Command flow tests.
- Report snapshot tests.
- Provider-absent diagnostic tests.

**Agent Notes:**  
AI diagnostics may explain findings but must not change deterministic severity.

#### Step 6.4 — Wire Validation into `pnpm check`

**Objective:**  
Make repository and bundled profile quality enforceable before release.

**Work:**

- Add tests that validate bundled Standard profile.
- Add tests for current documentation references where practical.
- Ensure `pnpm check` covers tests, build, typecheck, Markdown lint, and profile contract tests.
- Keep checks local and deterministic.

**References:**

- `package.json`
- `docs/04-engineering/10-testing-strategy.md`
- `docs/04-engineering/12-deployment-and-environments.md`

**Deliverable:**  
Release-quality validation gate.

**Validation:**  
`pnpm check` fails if bundled profile contracts break.

**Suggested Tests:**

- Profile contract test suite.
- Generated schema test.
- Package smoke test.

**Agent Notes:**  
Do not require generated user workspace files to exist for repository tests.

#### Acceptance Criteria

- `/validate` runs without AI.
- Validation reports are structured, persisted, and actionable.
- Bundled profile validation is part of the quality gate.
- Release-blocking findings are explicit.

#### Tests

- Validation unit tests.
- Semantic lint tests.
- Report snapshot tests.
- Quality gate tests.

#### Risks

- Validation becomes too AI-dependent.
- Lints overreach and block valid incomplete work.
- Profile checks are not run in CI.

#### Out of Scope

- Dependency graph visualization.
- HTML and agent pack generation.
- Executive compilation.

### Phase 7 — Dependency Graph and Staleness Detection

#### Goal

Track document dependencies, affected outputs, and stale artifacts.

#### Why This Phase Exists

The Standard profile has many cross-phase dependencies. Users need to know what changed, what is stale, and what should be regenerated after upstream decisions shift.

#### Inputs

- Documentation contract graph.
- Local state changes.
- Generation run metadata.
- Artifact registry.

#### Outputs

- Dependency graph service.
- Staleness detector.
- Regeneration planner.
- Textual graph output.

#### Relevant Documentation

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/03-product/05-information-architecture.md`
- `docs/04-engineering/09-sync-and-state.md`

#### Steps

#### Step 7.1 — Build Document Dependency Graph

**Objective:**  
Represent upstream and downstream relationships across phases and outputs.

**Work:**

- Build graph nodes for phases, documents, canonical outputs, HTML artifacts, agent packs, and executive outputs.
- Add edges from `dependsOn`, `feeds`, inputs, and output declarations.
- Detect cycles and unresolved references.
- Expose graph query APIs.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/04-engineering/05-data-model.md`

**Deliverable:**  
Dependency graph module.

**Validation:**  
Standard profile graph builds deterministically with no unresolved required references.

**Suggested Tests:**

- Graph snapshot tests.
- Cycle fixture tests.
- Missing node fixture tests.

**Agent Notes:**  
Graph data should support future profiles, not only Standard.

#### Step 7.2 — Detect Stale Documents and Artifacts

**Objective:**  
Mark outputs stale when source contracts or upstream state changed after generation.

**Work:**

- Compare output metadata, source checksums, profile version, state versions, and generation timestamps.
- Classify stale, current, missing, blocked, and orphaned outputs.
- Preserve warnings for optional dependencies.
- Add staleness data to `/status`.

**References:**

- `profiles/standard/docs.yml`
- `docs/04-engineering/09-sync-and-state.md`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
Staleness detector.

**Validation:**  
Changing an upstream decision marks downstream outputs stale in fixture workspaces.

**Suggested Tests:**

- Stale output tests.
- Optional dependency tests.
- Status output snapshot tests.

**Agent Notes:**  
Staleness warnings should not automatically overwrite files.

#### Step 7.3 — Implement Regeneration Planning

**Objective:**  
Tell the user what should be regenerated and why.

**Work:**

- Generate affected-output plans for canonical docs, HTML artifacts, agent packs, and executive outputs.
- Show reasons, source changes, dependencies, and safe order.
- Support dry-run.
- Integrate plan into `/generate` report.

**References:**

- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/11-observability.md`
- `docs/04-engineering/14-technical-risks.md`

**Deliverable:**  
Regeneration planner.

**Validation:**  
Dry-run regeneration explains affected outputs without writing.

**Suggested Tests:**

- Planner tests for upstream changes.
- Report snapshot tests.
- Dry-run integration tests.

**Agent Notes:**  
Do not regenerate derived artifacts before canonical sources are current.

#### Step 7.4 — Add Graph Output

**Objective:**  
Provide inspectable dependency output without overbuilding visualization.

**Work:**

- Add textual graph output through TUI or diagnostic report.
- Optionally add JSON graph output for diagnostics.
- Include phase, document, output type, status, and stale flags.
- Defer rich visualization unless later justified.

**References:**

- `profiles/standard/docs.yml`
- `docs/03-product/05-information-architecture.md`
- `docs/04-engineering/06-api-contracts.md`

**Deliverable:**  
Inspectable dependency graph report.

**Validation:**  
Graph output includes upstream/downstream relationships for a selected document.

**Suggested Tests:**

- Graph report snapshot tests.
- JSON graph schema tests.

**Agent Notes:**  
Textual graph is sufficient for MVP.

#### Acceptance Criteria

- Standard profile graph is loadable.
- Stale downstream outputs are detected.
- `/status` or diagnostic output explains stale state.
- Regeneration order is deterministic.

#### Tests

- Graph unit tests.
- Staleness fixture tests.
- Regeneration plan tests.
- Report snapshot tests.

#### Risks

- Incorrect graph edges cause missed regeneration.
- Graph feature expands into unnecessary visual tooling.

#### Out of Scope

- Live external sync.
- Rich hosted dashboards.

### Phase 8 — Provenance, Decisions, and Open Questions

#### Goal

Preserve source traceability, confidence, decision records, assumptions, hypotheses, risks, and unresolved contradictions.

#### Why This Phase Exists

LOGOS must prevent generated clarity from being mistaken for validated truth. Provenance is also required before Executive Axis compilation.

#### Inputs

- Intake sessions.
- Confirmed state.
- Generated docs.
- Validation findings.
- Validation documentation.

#### Outputs

- Claim/source model.
- Registers for decisions, assumptions, hypotheses, open questions, contradictions, and risks.
- Confidence/status markers.
- Traceability queries.

#### Relevant Documentation

- `docs/02-validation/08-evidence-log.md`
- `docs/02-validation/09-decision-record.md`
- `docs/02-validation/10-validation-report.md`
- `docs/04-engineering/05-data-model.md`
- `profiles/standard/executive/executive-generation.yml`

#### Steps

#### Step 8.1 — Implement Claim and Source Model

**Objective:**  
Attach claims and generated content to explicit sources.

**Work:**

- Define source types: conversation answer, confirmed decision, assumption, document, profile descriptor, validation finding, manual note, repository scan, and external reference.
- Store source IDs, paths, timestamps, confidence, and status.
- Require source references for generated document sections where practical.
- Mark inferred content as requiring review.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/executive/executive-generation.yml`
- `docs/04-engineering/05-data-model.md`

**Deliverable:**  
Provenance model and query API.

**Validation:**  
Generated sections and executive items can list source normative documents or state records.

**Suggested Tests:**

- Provenance schema tests.
- Source resolution tests.
- Missing source tests.

**Agent Notes:**  
Unknown facts should become assumptions or open questions, not invented claims.

#### Step 8.2 — Implement Registers

**Objective:**  
Maintain first-class registers for decisions, assumptions, hypotheses, risks, and open questions.

**Work:**

- Add CRUD-style domain operations through review flows, not direct hidden mutation.
- Link register items to source sessions and affected documents.
- Support status values such as proposed, confirmed, rejected, open, resolved, accepted risk, and superseded where documented.
- Surface registers in `/status`, `/validate`, and generation reports.

**References:**

- `docs/02-validation/02-core-assumptions.md`
- `docs/02-validation/03-hypotheses.md`
- `docs/02-validation/09-decision-record.md`
- `docs/04-engineering/05-data-model.md`

**Deliverable:**  
State-backed register services.

**Validation:**  
Register changes update affected documents and validation findings.

**Suggested Tests:**

- Register lifecycle tests.
- Document impact tests.
- Status report tests.

**Agent Notes:**  
Do not hide unresolved questions to make outputs look complete.

#### Step 8.3 — Detect Contradictions and Boundary Violations

**Objective:**  
Flag inconsistencies before generation and executive compilation.

**Work:**

- Compare decisions, assumptions, boundaries, requirements, risks, and generated outputs.
- Detect root path contradictions, profile naming drift, validation overclaims, hosted/sync scope creep, and artifact source-of-truth confusion.
- Record unresolved contradictions as validation findings.
- Block approval or export when contradictions are release-blocking.

**References:**

- `docs/01-foundation/05-boundaries.md`
- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/14-technical-risks.md`
- `docs/02-validation/10-validation-report.md`

**Deliverable:**  
Consistency and contradiction detector.

**Validation:**  
Fixtures containing known contradictions produce blocking findings.

**Suggested Tests:**

- Boundary violation tests.
- README profile-drift fixture test.
- Validation overclaim tests.

**Agent Notes:**  
Prefer explicit findings over silent correction.

#### Step 8.4 — Expose Traceability in Generated Outputs

**Objective:**  
Make provenance visible in Markdown, reports, HTML, agent packs, and executive exports.

**Work:**

- Add source document lists and generated metadata to outputs.
- Include confidence and review-required markers where relevant.
- Ensure derived artifacts identify canonical sources.
- Keep source paths relative and portable.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/executive/mappings/markdown.mapping.yml`
- `profiles/standard/executive/mappings/html.mapping.yml`
- `docs/04-engineering/13-engineering-standards.md`

**Deliverable:**  
Traceability rendering primitives.

**Validation:**  
Generated fixture outputs include source references and derived-artifact labels.

**Suggested Tests:**

- Snapshot tests for source references.
- Derived label tests.
- Portable path tests.

**Agent Notes:**  
Traceability must not leak raw provider context or secrets.

#### Acceptance Criteria

- Decisions, assumptions, hypotheses, risks, and open questions are first-class state.
- Generated content can identify its sources.
- Contradictions and validation overclaims are flagged.
- Executive compiler has provenance data available.

#### Tests

- Register lifecycle tests.
- Provenance model tests.
- Contradiction fixture tests.
- Output traceability snapshots.

#### Risks

- Provenance becomes too heavy for users.
- Source traceability is incomplete for AI-generated drafts.

#### Out of Scope

- External knowledge management sync.
- Hosted audit logs.

### Phase 9 — HTML Artifact Generation

#### Goal

Generate static, self-contained HTML review artifacts from canonical docs, profile contracts, and structured state.

#### Why This Phase Exists

The Standard profile declares HTML artifacts for navigation and review, but HTML must remain derived and safe.

#### Inputs

- Canonical Markdown.
- Profile output declarations.
- State and provenance metadata.
- Validation findings.

#### Outputs

- HTML artifact manifest.
- Static renderer.
- Dashboard, phase map, risk map, decision map, and executive readiness views where supported.
- Artifact registry updates.

#### Relevant Documentation

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/03-product/10-functional-requirements.md`
- `docs/04-engineering/08-security-and-privacy.md`
- `docs/04-engineering/14-technical-risks.md`

#### Steps

#### Step 9.1 — Implement HTML Artifact Planner

**Objective:**  
Resolve which HTML artifacts are declared and ready to generate.

**Work:**

- Read artifact declarations from profile phase and document descriptors.
- Determine source canonical docs and required state.
- Block artifacts when canonical docs are missing or stale.
- Include artifact paths in generation reports.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
HTML artifact plan.

**Validation:**  
Planner lists declared Standard HTML outputs and blocks missing canonical sources.

**Suggested Tests:**

- Artifact planner tests.
- Missing source tests.
- Stale source tests.

**Agent Notes:**  
HTML must never be planned as a source input for canonical docs.

#### Step 9.2 — Implement Safe Static HTML Renderer

**Objective:**  
Render local HTML without introducing security or source-of-truth risks.

**Work:**

- Escape all user/project content.
- Avoid external scripts, telemetry, remote fonts, and network assets.
- Include generatedAt, source canonical paths, profile version, and derived-artifact warning.
- Produce semantic HTML with accessible headings and readable status labels.

**References:**

- `docs/04-engineering/08-security-and-privacy.md`
- `docs/04-engineering/14-technical-risks.md`
- `profiles/standard/executive/mappings/html.mapping.yml`

**Deliverable:**  
Static HTML renderer.

**Validation:**  
Rendered HTML contains no external script/link dependencies and escapes unsafe input fixtures.

**Suggested Tests:**

- HTML snapshot tests.
- Escaping tests.
- No external asset tests.
- Basic accessibility smoke tests.

**Agent Notes:**  
Use simple static HTML first. Do not build a web app.

#### Step 9.3 — Generate Review Views

**Objective:**  
Create useful derived views for project review.

**Work:**

- Generate dashboard, phase map, risk map, decision map, validation summary, and readiness views when source data exists.
- Include links to canonical Markdown paths.
- Mark incomplete, stale, blocked, and review-required items.
- Persist artifact registry records.

**References:**

- `docs/03-product/05-information-architecture.md`
- `docs/03-product/07-ui-specification.md`
- `docs/04-engineering/11-observability.md`

**Deliverable:**  
HTML review artifact set.

**Validation:**  
Running generation creates HTML files with correct source references and registry entries.

**Suggested Tests:**

- End-to-end HTML generation test.
- Artifact registry test.
- Review view snapshot tests.

**Agent Notes:**  
Visual polish is secondary to correctness, traceability, and safety.

#### Acceptance Criteria

- HTML artifacts generate only from canonical sources.
- Artifacts are static, self-contained, escaped, and labeled as derived.
- Generation report separates HTML from canonical Markdown.
- Missing or stale sources block or warn appropriately.

#### Tests

- Planner tests.
- Renderer snapshot tests.
- Security escaping tests.
- End-to-end artifact generation tests.

#### Risks

- HTML becomes mistaken for canonical state.
- Unsafe rendering introduces XSS or external calls.
- Accessibility claims exceed evidence.

#### Out of Scope

- Hosted dashboard.
- Rich client-side app.
- Manual HTML editing workflow.

### Phase 10 — Agent Pack Generation

#### Goal

Generate bounded agent packs for implementation, review, documentation, and task execution from canonical docs and structured state.

#### Why This Phase Exists

Agent packs are declared derived artifacts that help external coding/review agents execute work without rereading the entire documentation set.

#### Inputs

- Canonical Markdown.
- Profile descriptors.
- Provenance registers.
- Validation findings.
- Executive mappings where relevant.

#### Outputs

- Agent pack manifest.
- Context bundle generator.
- Implementation, review, and task prompt renderers.
- Safety and redaction checks.

#### Relevant Documentation

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `profiles/standard/executive/mappings/agent-pack.mapping.yml`
- `profiles/standard/executive/templates/agent-task.md`
- `docs/04-engineering/08-security-and-privacy.md`

#### Steps

#### Step 10.1 — Implement Agent Pack Planner

**Objective:**  
Resolve declared agent pack outputs and required source context.

**Work:**

- Read agent-pack declarations from document and executive mappings.
- Classify pack type: review, implementation, task, documentation, research, or follow-up.
- Determine required canonical docs, decisions, risks, assumptions, and validation findings.
- Block pack generation when canonical sources are missing or stale.

**References:**

- `profiles/standard/docs.yml`
- `profiles/standard/document.schema.yml`
- `profiles/standard/executive/mappings/agent-pack.mapping.yml`

**Deliverable:**  
Agent pack plan.

**Validation:**  
Planner lists declared packs and explains blocked packs.

**Suggested Tests:**

- Planner tests.
- Missing source tests.
- Pack type classification tests.

**Agent Notes:**  
Agent packs are execution aids, not project authority.

#### Step 10.2 — Implement Bounded Context Bundles

**Objective:**  
Create minimal context bundles for downstream agents.

**Work:**

- Include objective, relevant docs, source paths, constraints, required changes, acceptance criteria, non-goals, risks, and expected outputs.
- Exclude unrelated repository files by default.
- Include unresolved questions and assumptions when relevant.
- Redact provider tokens and sensitive config.

**References:**

- `SECURITY.md`
- `docs/04-engineering/08-security-and-privacy.md`
- `docs/04-engineering/07-integration-architecture.md`
- `profiles/standard/executive/templates/agent-task.md`

**Deliverable:**  
Context bundle service.

**Validation:**  
Generated bundles include required context and omit secrets/unrelated files.

**Suggested Tests:**

- Bundle snapshot tests.
- Redaction tests.
- Scope boundary tests.

**Agent Notes:**  
Keep bundles small enough to be useful and auditable.

#### Step 10.3 — Render Agent Packs

**Objective:**  
Write Markdown agent packs under generated artifact paths.

**Work:**

- Render pack templates for coding agents, review agents, documentation agents, and executive task packs.
- Include metadata: source docs, generatedAt, profile id/version, LOGOS item id where relevant, and derived-artifact warning.
- Persist artifact registry entries.
- Report created, updated, skipped, blocked, and failed packs.

**References:**

- `profiles/standard/executive/mappings/agent-pack.mapping.yml`
- `profiles/standard/executive/templates/agent-task.md`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
Agent pack renderer and writer.

**Validation:**  
Generated pack snapshots preserve source references and constraints.

**Suggested Tests:**

- Template snapshot tests.
- Artifact registry tests.
- Generation report tests.

**Agent Notes:**  
Downstream agent instructions must forbid unrelated changes when appropriate.

#### Acceptance Criteria

- Agent packs generate only from canonical/project state sources.
- Packs include constraints, source docs, acceptance criteria, and non-goals.
- Packs are labeled as derived execution aids.
- Packs pass redaction checks.

#### Tests

- Planner tests.
- Bundle and renderer snapshot tests.
- Redaction tests.
- End-to-end pack generation tests.

#### Risks

- Packs leak sensitive context.
- Packs omit caveats and cause downstream agents to overreach.
- Packs are treated as canonical documentation.

#### Out of Scope

- Sending packs to external services.
- Managing downstream agent execution state.

### Phase 11 — Executive Axis Compilation

#### Goal

Compile the Executive Axis from the normative baseline into portable JSON and supported derived file exports.

#### Why This Phase Exists

Executive output should sequence work after normative documentation is sufficiently ready. It must not replace canonical docs or become live task management state.

#### Inputs

- Normative docs.
- Profile contracts.
- Provenance registers.
- Validation and readiness findings.
- Executive generation profile, schema, mappings, and templates.

#### Outputs

- Normative baseline readiness check.
- Executive plan JSON.
- Executive validation.
- Markdown, HTML, GitHub Issue-compatible, and agent-pack file exports.
- Unsupported/planned target reporting for Linear and Notion.

#### Relevant Documentation

- `profiles/standard/executive/executive-generation.yml`
- `profiles/standard/executive/executive-plan.schema.json`
- `profiles/standard/executive/mappings/markdown.mapping.yml`
- `profiles/standard/executive/mappings/github-issues.mapping.yml`
- `profiles/standard/executive/mappings/html.mapping.yml`
- `profiles/standard/executive/mappings/agent-pack.mapping.yml`
- `docs/03-product/10-functional-requirements.md`

#### Steps

#### Step 11.1 — Implement Normative Baseline Readiness Gate

**Objective:**  
Decide whether Executive Axis generation and exports are allowed.

**Work:**

- Implement readiness statuses: draft, baseline_ready, execution_ready.
- Check required coverage for Foundation, Validation, Product, and Engineering.
- Treat Go-to-Market and Operations coverage as optional unless policy changes.
- Allow draft JSON generation if configured, but block execution-tool exports while draft.
- Include unresolved gaps and review-required inferred items.

**References:**

- `profiles/standard/executive/executive-generation.yml`
- `docs/03-product/10-functional-requirements.md`
- `docs/03-product/13-acceptance-criteria.md`

**Deliverable:**  
Executive readiness gate.

**Validation:**  
Fixture baselines classify as draft, baseline_ready, or execution_ready correctly.

**Suggested Tests:**

- Readiness gate tests.
- Missing required doc tests.
- Draft export block tests.

**Agent Notes:**  
Do not let Executive outputs hide incomplete normative docs.

#### Step 11.2 — Compile Executive Plan JSON

**Objective:**  
Generate a portable execution graph from normative sources.

**Work:**

- Derive roadmaps, milestones, workstreams, initiatives, items, decisions, risks, and artifacts.
- Preserve source normative documents.
- Mark inferred items as requiring review.
- Include confidence overall and by area.
- Validate against `executive-plan.schema.json`.

**References:**

- `profiles/standard/executive/executive-generation.yml`
- `profiles/standard/executive/executive-plan.schema.json`
- `docs/04-engineering/04-domain-model.md`

**Deliverable:**  
`outcomes/executive/executive-plan.json` or configured equivalent.

**Validation:**  
Generated JSON validates against the executive schema.

**Suggested Tests:**

- Compiler unit tests.
- JSON schema validation tests.
- Snapshot tests for representative normative baseline.

**Agent Notes:**  
Executive JSON is portable exchange state, not a live project database.

#### Step 11.3 — Implement Executive Export Adapters

**Objective:**  
Generate supported executive file exports from Executive JSON.

**Work:**

- Implement Markdown export for implementation plan, decisions, and risks.
- Implement HTML executive overview export.
- Implement GitHub Issue-compatible Markdown file export.
- Implement executive agent pack export.
- Report Linear and Notion mappings as planned/unsupported unless separately implemented and validated.
- Include generatedAt, source executive plan path, and source normative documents.

**References:**

- `profiles/standard/executive/mappings/markdown.mapping.yml`
- `profiles/standard/executive/mappings/github-issues.mapping.yml`
- `profiles/standard/executive/mappings/html.mapping.yml`
- `profiles/standard/executive/mappings/agent-pack.mapping.yml`
- `profiles/standard/executive/mappings/linear.mapping.yml`
- `profiles/standard/executive/mappings/notion.mapping.yml`

**Deliverable:**  
Supported executive file exports.

**Validation:**  
Exports generate from valid Executive JSON and preserve metadata.

**Suggested Tests:**

- Mapping contract tests.
- Export snapshot tests.
- Unsupported target tests.

**Agent Notes:**  
Do not call GitHub, Linear, Notion, or any external API in MVP exports.

#### Step 11.4 — Expose `executive compile`

**Objective:**  
Allow the user to compile executive outputs after readiness checks.

**Work:**

- Add TUI command flow or explicit command surface that fits the TUI-first product model.
- Show readiness status, planned outputs, blocked exports, and target paths.
- Persist executive run metadata and artifact registry entries.
- Fail safely when normative baseline is insufficient.

**References:**

- `docs/03-product/06-interaction-model.md`
- `docs/03-product/10-functional-requirements.md`
- `profiles/standard/executive/executive-generation.yml`

**Deliverable:**  
User-invoked executive compilation workflow.

**Validation:**  
Compilation reports created, skipped, blocked, failed, stale, and unsupported executive outputs.

**Suggested Tests:**

- End-to-end executive compile test.
- Readiness-blocked flow test.
- Report snapshot test.

**Agent Notes:**  
If an external `logos executive compile` command is added, it must not bypass readiness, provenance, or local-first rules.

#### Acceptance Criteria

- Executive JSON is generated from normative docs, not independent authoring.
- Schema validation passes.
- Exports are file snapshots with source metadata.
- Draft readiness blocks execution-tool exports.
- No live sync or external API calls occur.

#### Tests

- Readiness gate tests.
- Executive compiler tests.
- Schema validation tests.
- Export snapshot tests.
- Unsupported target tests.

#### Risks

- Executive outputs are mistaken for live task state.
- Inferred tasks lack source traceability.
- Planned mappings imply implemented sync.

#### Out of Scope

- Live GitHub issue creation.
- Linear/Notion API sync.
- Task status tracking inside LOGOS.

### Phase 12 — Import and Repository Scanner

#### Goal

Import existing project documentation and scan repository structure/tooling to support workspace initialization and consistency checks.

#### Why This Phase Exists

Users may already have documentation before adopting LOGOS. The engine should help preserve that work while avoiding arbitrary source ingestion and unsupported external research.

#### Inputs

- Existing Markdown files.
- Profile contracts.
- Repository metadata files.
- Package/tooling files.
- Local workspace state.

#### Outputs

- Import planner.
- Repository scanner.
- Docs-versus-code consistency checks.
- Candidate fact/decision extraction proposals.
- Import report.

#### Relevant Documentation

- `profiles/standard/document.schema.yml`
- `docs/04-engineering/07-integration-architecture.md`
- `docs/04-engineering/05-data-model.md`
- `docs/03-product/10-functional-requirements.md`

#### Steps

#### Step 12.1 — Implement Existing Documentation Import Planner

**Objective:**  
Find existing docs and map them to LOGOS documents without overwriting them.

**Work:**

- Scan configured import roots for Markdown files.
- Compare filenames, headings, and paths to profile document descriptors.
- Propose mappings as reviewable candidates.
- Preserve original files unless user confirms copy or reference behavior.
- Mark unmapped files as unknown, not discarded.

**References:**

- `profiles/standard/document.schema.yml`
- `docs/04-engineering/09-sync-and-state.md`
- `docs/03-product/10-functional-requirements.md`

**Deliverable:**  
Import planning service.

**Validation:**  
Import dry-run reports candidate mappings and collisions without writes.

**Suggested Tests:**

- Import fixture tests.
- Collision tests.
- Dry-run tests.

**Agent Notes:**  
Do not assume existing `docs/` is the LOGOS output root.

#### Step 12.2 — Implement Repository Scanner

**Objective:**  
Inspect repository metadata for useful implementation context and consistency findings.

**Work:**

- Detect package manager, runtime, scripts, source directories, tests, CI, and major config files.
- Compare detected facts against documented technical stack when available.
- Produce candidate facts and findings, not confirmed decisions.
- Avoid scanning arbitrary source file contents into AI context by default.

**References:**

- `docs/04-engineering/03-technical-stack.md`
- `docs/04-engineering/07-integration-architecture.md`
- `SECURITY.md`

**Deliverable:**  
Repository scanner report.

**Validation:**  
Scanner identifies current LOGOS repo facts such as package manager, missing `src/`, missing `tests/`, and missing `scripts/`.

**Suggested Tests:**

- Fixture repository scanner tests.
- Package manager detection tests.
- Security boundary tests.

**Agent Notes:**  
Repository facts require review before becoming canonical project decisions.

#### Step 12.3 — Add Docs-vs-Code Consistency Checks

**Objective:**  
Detect mismatch between documentation claims and repository reality.

**Work:**

- Check package scripts versus files.
- Check README structure versus live tree.
- Check profile naming claims versus bundled profile IDs.
- Check documented roots against implementation defaults.
- Report findings through validation/diagnostics.

**References:**

- `README.md`
- `package.json`
- `docs/04-engineering/14-technical-risks.md`
- `docs/04-engineering/13-engineering-standards.md`

**Deliverable:**  
Consistency checker.

**Validation:**  
The current README `app-business` drift and missing source tree can be reported as findings.

**Suggested Tests:**

- Consistency fixture tests.
- README drift test.
- Missing script target test.

**Agent Notes:**  
Findings should not rewrite docs automatically.

#### Step 12.4 — Extract Candidate Facts and Decisions

**Objective:**  
Convert imported material and scan results into reviewable state proposals.

**Work:**

- Extract candidate assumptions, decisions, open questions, risks, and source references.
- Mark imported/extracted records as proposed.
- Require user confirmation before they affect canonical generation.
- [DOC GAP] Transcript and note import behavior is not specified in detail; defer broad transcript parsing until documented.

**References:**

- `profiles/standard/document.schema.yml`
- `docs/04-engineering/05-data-model.md`
- `docs/02-validation/09-decision-record.md`

**Deliverable:**  
Candidate extraction pipeline.

**Validation:**  
Extracted facts remain proposed and source-linked until confirmed.

**Suggested Tests:**

- Markdown extraction fixture tests.
- Proposal lifecycle tests.
- Source traceability tests.

**Agent Notes:**  
Do not turn scanner guesses into confirmed decisions.

#### Acceptance Criteria

- Existing docs can be scanned and mapped in dry-run mode.
- Repository scanner reports tooling and structure facts.
- Docs-vs-code drift is detected.
- Extracted facts are proposed, not confirmed.

#### Tests

- Import planner tests.
- Scanner fixture tests.
- Consistency checker tests.
- Proposal extraction tests.

#### Risks

- Import overwrites existing work.
- Scanner sends too much context to AI.
- Guesses become canonical state.

#### Out of Scope

- Automatic external research.
- Full source-code semantic analysis.
- Transcript import beyond documented schema placeholders.

### Phase 13 — Operational Hardening and Release

#### Goal

Prepare LOGOS Engine for safe local use, package release, support, migration, and incident handling.

#### Why This Phase Exists

The MVP writes to local repositories and may interact with AI providers. Release requires strong safety, migration, observability, and support practices.

#### Inputs

- All previous phases.
- Risk register.
- Operations docs.
- Deployment docs.
- Security docs.

#### Outputs

- Error model hardening.
- Migration strategy.
- Performance baseline.
- Local observability reports.
- Security/privacy checks.
- Release package and smoke tests.
- Support/runbook documentation.

#### Relevant Documentation

- `docs/04-engineering/08-security-and-privacy.md`
- `docs/04-engineering/11-observability.md`
- `docs/04-engineering/12-deployment-and-environments.md`
- `docs/04-engineering/14-technical-risks.md`
- `docs/06-operations/09-incident-management.md`
- `docs/06-operations/10-risk-and-compliance.md`

#### Steps

#### Step 13.1 — Harden Error and Recovery Model

**Objective:**  
Make failures understandable, recoverable, and non-destructive.

**Work:**

- Standardize error codes, severities, recovery hints, and changed path reporting.
- Add recovery mode for invalid `.logos/` state.
- Preserve evidence for failed writes and migrations.
- Ensure errors never print raw tokens.

**References:**

- `docs/04-engineering/11-observability.md`
- `docs/04-engineering/09-sync-and-state.md`
- `docs/04-engineering/08-security-and-privacy.md`

**Deliverable:**  
Hardened error and recovery layer.

**Validation:**  
Corrupt state and failed write fixtures produce safe recovery guidance.

**Suggested Tests:**

- Error fixture tests.
- Corrupt state tests.
- Redaction tests.

**Agent Notes:**  
Recovery guidance should be local and practical, not dependent on hosted support.

#### Step 13.2 — Implement Migrations, Backups, and Performance Baseline

**Objective:**  
Support local state evolution and representative workspace sizes.

**Work:**

- Implement migration registry for `.logos/` schema versions.
- Create migration dry-run and backup behavior.
- Add benchmarks or timed smoke tests for startup, status, validation, and generation.
- Define supported size assumptions for documents and profile count.

**References:**

- `docs/04-engineering/09-sync-and-state.md`
- `docs/04-engineering/12-deployment-and-environments.md`
- `docs/04-engineering/14-technical-risks.md`

**Deliverable:**  
Migration and performance baseline.

**Validation:**  
Old fixture states migrate safely and representative workspace operations meet documented targets or warnings.

**Suggested Tests:**

- Migration fixture tests.
- Backup/restore tests.
- Performance smoke tests.

**Agent Notes:**  
Do not introduce cloud backup. Local Git/OS backup guidance remains the support model.

#### Step 13.3 — Complete Security and Privacy Release Checks

**Objective:**  
Block release on token leaks, hidden telemetry, unsafe remote calls, or unsafe writes.

**Work:**

- Add secret-pattern scans for generated outputs, logs, fixtures, package files, Markdown, HTML, and agent packs.
- Verify no telemetry or phone-home code exists.
- Verify remote provider calls require disclosure and provider configuration.
- Verify package excludes unintended local state and secrets.

**References:**

- `SECURITY.md`
- `docs/04-engineering/08-security-and-privacy.md`
- `docs/04-engineering/14-technical-risks.md`

**Deliverable:**  
Security/privacy release gate.

**Validation:**  
Release checks fail on token-like fixtures and hidden remote-call fixtures.

**Suggested Tests:**

- Secret redaction tests.
- Package contents test.
- Remote consent guard tests.

**Agent Notes:**  
Security failures are release-blocking.

#### Step 13.4 — Package and Release Candidate Smoke

**Objective:**  
Verify the npm package works from a clean install.

**Work:**

- Build package contents with `dist`, `profiles`, `docs`, README, and LICENSE.
- Run package smoke test in a temporary project.
- Verify `logos`, `/init`, `/status`, `/validate`, `/generate`, HTML generation, agent pack generation, and executive compile flows where readiness permits.
- Confirm no implementation assumes the repo under development as the target project.

**References:**

- `package.json`
- `docs/04-engineering/12-deployment-and-environments.md`
- `docs/03-product/13-acceptance-criteria.md`

**Deliverable:**  
Release candidate package evidence.

**Validation:**  
Clean package smoke succeeds without live AI provider.

**Suggested Tests:**

- Packed tarball smoke test.
- Temporary target repository E2E test.
- Package contents snapshot.

**Agent Notes:**  
The TUI must run in the target repository where documentation will be generated.

#### Step 13.5 — Finalize Support and Operational Documentation

**Objective:**  
Make local-first operation supportable after release.

**Work:**

- Document common failure modes, evidence to collect, redaction rules, recovery steps, and known limitations.
- Update README and contribution docs to reflect Standard profile and current folder structure.
- Document no hosted telemetry, no cloud backup, and no live sync.
- Provide release checklist and rollback/deprecation guidance.

**References:**

- `docs/06-operations/04-customer-support.md`
- `docs/06-operations/09-incident-management.md`
- `docs/06-operations/12-knowledge-management.md`
- `docs/06-operations/14-operational-risks.md`

**Deliverable:**  
Operational support docs and release checklist.

**Validation:**  
Support docs match implemented commands, roots, profiles, and known limitations.

**Suggested Tests:**

- Documentation consistency check.
- Markdown lint.
- Manual support walkthrough.

**Agent Notes:**  
Do not promise hosted support capabilities that the product does not have.

#### Acceptance Criteria

- Package install and smoke tests pass from a clean target repository.
- Security, privacy, state migration, and overwrite gates pass.
- Operational docs match implemented behavior.
- Release candidate remains local-first and TUI-first.

#### Tests

- Full `pnpm check`.
- Package smoke tests.
- Migration tests.
- Security/privacy tests.
- End-to-end workflow tests.

#### Risks

- Package includes unintended files.
- Local state migrations corrupt workspaces.
- Support expectations exceed local-first capability.

#### Out of Scope

- Hosted monitoring.
- Cloud backup.
- Live external sync.

## 6. Cross-Phase Technical Standards

### TypeScript Standards

- Use strict TypeScript and keep `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `noImplicitReturns` enabled.
- Prefer domain types and Zod/runtime validators at IO boundaries.
- Do not use `any` for profile, state, AI, or executive payloads.
- Keep CLI/TUI adapters thin; domain services must be testable without Ink or Commander.
- Exports from `src/index.ts` must not require an initialized workspace.

### CLI Standards

- `logos` without arguments opens the TUI.
- Slash commands remain the primary mutating workflow.
- Non-interactive commands must be non-mutating unless explicitly documented.
- Commands that mutate files must disclose target paths before writes and report changed paths after writes.
- `--json` output, where available, must use stable result envelopes.
- Exit codes must distinguish success, validation failure, user cancellation, configuration error, and unexpected error.

### File System Safety

- Default generated documentation root is `logos/`, configurable during `/init`.
- All writes must support dry-run where practical.
- State writes must be atomic and versioned.
- Existing files must not be overwritten without policy and user-visible reporting.
- Generated files should include metadata when appropriate: generatedAt, profile id/version, source paths, and derived/canonical role.
- Never store raw LLM tokens in `.logos/`, logs, fixtures, Markdown, HTML, agent packs, or package artifacts.

### Schema Standards

- Profile registry, document descriptors, state files, AI outputs, generation reports, artifact registry entries, and executive JSON must be schema-validated.
- Validation errors must include file path and JSON/YAML pointer where possible.
- Schema changes must include migration notes and fixture updates.
- Bundled Standard profile validation is a release blocker.
- Derived JSON Schema artifacts may be generated later, but the current source schema is `profiles/standard/document.schema.yml`.

### Testing Standards

- Default tests must not call live models, require network, require AI credentials, or depend on external services.
- Every phase must add tests for its own contracts before relying on later E2E tests.
- Use temporary directories for filesystem integration tests.
- Use snapshot tests for generated Markdown, HTML, agent packs, reports, and executive exports.
- Use fixture tests for invalid profiles, corrupt state, stale outputs, manual edit conflicts, and token leaks.
- `pnpm check` must be the release gate by the time Phase 6 completes.

### AI Provider Abstraction Standards

- Provider integrations must be behind ports and replaceable with fake providers.
- Remote calls require explicit provider configuration and disclosure.
- Context sent to providers must be scoped to relevant structured state, profile contracts, user answers, and document contracts.
- Arbitrary repository source files are excluded from provider context by default.
- AI responses must be structurally validated before creating proposals.
- AI output may explain, suggest, extract, or draft; it may not silently confirm decisions.

### Documentation Update Standards

- Behavior changes must update relevant docs, profile contracts, examples, and tests in the same implementation phase.
- Documentation must distinguish current implemented behavior from planned/deferred capabilities.
- Generated `logos/` project outputs must not be confused with repository authoring docs under `docs/`.
- README must reflect Standard profile as current default once implementation catches up.
- Missing documentation must be marked as `[DOC GAP]` rather than invented.

### Error Handling Standards

- Errors must have code, severity, message, recovery hint, and relevant path/pointer.
- User-correctable errors should not throw raw stack traces in TUI.
- Unexpected errors may include redacted diagnostic IDs and local report paths.
- Validation and generation failures must preserve partial reports.
- Security/privacy failures must be release-blocking.

## 7. Validation Gates

### Gate 0 — Repository Builds

#### Required Before

- Phase 1 begins.

#### Checks

- `pnpm install` succeeds.
- `pnpm build` succeeds.
- `pnpm test` succeeds.
- `pnpm smoke:cli` succeeds.
- `pnpm lint:md` succeeds.
- Non-mutating Biome check succeeds.

#### Passing Criteria

- Repository has buildable `src/`, runnable CLI help/version, test baseline, and smoke script.

#### Blocking Failures

- Missing `src/`, missing smoke script, build failure, mutating-only lint script, or CLI binary mismatch.

### Gate 1 — Manifest Validates

#### Required Before

- Phase 2 TUI workflows depend on active profile contracts.

#### Checks

- `profiles/standard/docs.yml` loads.
- All listed phase files load.
- All document descriptors validate.
- Output declarations and dependencies are normalized.

#### Passing Criteria

- Standard profile contract snapshot is deterministic and error-free.

#### Blocking Failures

- Missing required descriptor, duplicate canonical ID, invalid output, circular required dependency, or schema mismatch.

### Gate 2 — CLI Can Inspect Project

#### Required Before

- Workspace initialization and state mutation.

#### Checks

- `logos` opens TUI.
- `/help`, `/status`, and `/exit` work.
- `logos doctor` reports repository and initialization status.
- Errors are formatted and redacted.

#### Passing Criteria

- User can inspect current state without modifying files.

#### Blocking Failures

- TUI cannot start, status command crashes, path detection is wrong, or diagnostics leak secrets.

### Gate 3 — Canonical Docs Can Be Generated

#### Required Before

- HTML artifacts, agent packs, and executive compilation.

#### Checks

- `/init` creates `.logos/`.
- `/continue` can collect/review proposed state.
- `/generate` creates canonical Markdown under configured root.
- Manual edit protection works.
- Generation report records outcomes.

#### Passing Criteria

- A fixture workspace generates traceable Markdown without live AI provider.

#### Blocking Failures

- Root regression to `docs/`, unsafe overwrite, invented facts, missing report, or unvalidated state mutation.

### Gate 4 — Docs Can Be Reviewed

#### Required Before

- Dependency/staleness and provenance-dependent outputs.

#### Checks

- `/validate` runs without AI.
- Required sections, dependencies, assumptions, contradictions, and boundary checks run.
- Review reports persist.
- Validation distinguishes incomplete work from approved work.

#### Passing Criteria

- Deterministic validation finds known fixture issues and passes clean fixtures.

#### Blocking Failures

- AI-dependent validation, missing severity/path, validation overclaim, or untracked release-blocking risk.

### Gate 5 — Artifacts Can Be Generated

#### Required Before

- Executive exports and release candidate.

#### Checks

- HTML artifacts generate from canonical sources only.
- Agent packs generate from bounded context only.
- Derived artifacts include source metadata and non-canonical labels.
- Redaction and no-external-script checks pass.

#### Passing Criteria

- Fixture workspace generates Markdown, HTML, and agent packs with correct registry entries.

#### Blocking Failures

- Token leak, external script, stale source used silently, or derived artifact treated as canonical.

### Gate 6 — Executive Plan Can Be Compiled

#### Required Before

- Import/scanner hardening and release candidate.

#### Checks

- Normative readiness gate classifies baseline.
- Executive JSON validates against schema.
- Supported file exports generate.
- Draft readiness blocks execution-tool exports.
- Unsupported planned adapters are reported, not called.

#### Passing Criteria

- Representative normative baseline compiles to valid Executive JSON and supported exports without external API calls.

#### Blocking Failures

- Missing source normative documents, invalid executive schema, live sync attempt, or unreviewed inferred items exported as final.

### Gate 7 — Release Candidate Is Usable

#### Required Before

- Public or broader distribution.

#### Checks

- Packed npm artifact installs in a clean temporary repository.
- `logos` TUI can initialize, continue, validate, generate, produce derived artifacts, and compile executive outputs where ready.
- Package contents exclude local state, raw tokens, and unintended files.
- Migrations and corrupt-state recovery tests pass.
- Support docs match implemented behavior.

#### Passing Criteria

- A new user can run the documented local-first workflow without live AI credentials and without writing outside disclosed paths.

#### Blocking Failures

- Broken package, unsafe writes, hidden remote call, token leak, invalid bundled profile, or stale documentation that misleads core setup.

## 8. Risk Register

| ID | Risk | Category | Likelihood | Impact | Detection Signal | Mitigation | Related Phase |
|---|---|---|---|---|---|---|---|
| RR-001 | Repository package claims behavior that implementation does not provide. | architecture | high | high | Build, smoke, or README consistency checks fail. | Start with Phase 0 baseline and docs alignment. | Phase 0 |
| RR-002 | Generated root regresses from `logos/` to legacy `docs/`. | document integrity | medium | high | Generated files appear under `docs/` by default. | Root config tests, status display, docs grep. | Phases 3, 5 |
| RR-003 | AI output becomes confirmed state without user review. | AI hallucination | medium | critical | Proposal lifecycle tests fail. | Separate AI output status from decision status. | Phase 4 |
| RR-004 | Source traceability is missing from generated docs or executive items. | source traceability | medium | high | Output snapshots lack source paths or confidence markers. | Provenance model and output traceability tests. | Phase 8 |
| RR-005 | Stale outputs remain presented as current. | stale documentation | medium | high | Upstream fixture change does not mark downstream output stale. | Dependency graph and staleness detection. | Phase 7 |
| RR-006 | Regeneration overwrites manual Markdown edits. | user overwrites | medium | critical | Manual edit collision fixture is overwritten. | Checksums, explicit overwrite policy, backups. | Phase 5 |
| RR-007 | Profile schema drift breaks bundled Standard profile. | schema drift | medium | high | Profile contract tests fail. | Schema tests, profile snapshots, release blocker. | Phase 1 |
| RR-008 | Large context handling sends too much data to AI providers. | security/privacy | medium | high | Context preview includes unrelated repository files. | Scoped context builder, disclosure, redaction tests. | Phase 4 |
| RR-009 | HTML artifacts introduce unsafe content or external scripts. | security/privacy | medium | high | HTML tests find unescaped content or external dependencies. | Escape renderer, no external assets, static HTML. | Phase 9 |
| RR-010 | Agent packs leak sensitive context or omit caveats. | security/privacy | medium | high | Pack snapshot includes secrets or lacks assumptions/open questions. | Bounded context, redaction, derived labels. | Phase 10 |
| RR-011 | Executive exports are mistaken for live task state. | external tool assumptions | medium | high | Users expect sync or issue status tracking. | Snapshot labels, no API calls, unsupported adapter reporting. | Phase 11 |
| RR-012 | Linear/Notion planned mappings imply implemented live integrations. | external tool assumptions | medium | medium | Export UI presents planned targets as available. | Status-aware adapter registry and blocked reporting. | Phase 11 |
| RR-013 | Overbuilding hosted infrastructure delays MVP. | overbuilding | medium | high | New backend/auth/db/sync work appears before local workflow passes. | Roadmap gates and explicit non-goals. | All phases |
| RR-014 | Validation claims exceed actual external evidence. | document integrity | medium | medium | Generated docs claim market validation without evidence. | Evidence-boundary linting and validation report references. | Phase 6 |
| RR-015 | State migrations corrupt `.logos/`. | data/state | medium | critical | Migration fixture cannot recover old state. | Versioned migrations, backups, recovery mode. | Phase 13 |
| RR-016 | No hosted observability makes support hard. | operations | high | medium | User reports lack local evidence. | Local reports, redaction guidance, support runbooks. | Phase 13 |

## 9. Documentation References Index

- `README.md` — Used for: current public product description, CLI/TUI intent, AI behavior, provider configuration, and stale profile/structure assessment.
- `CONTRIBUTING.md` — Used for: development quality gate and contributor safety rules.
- `SECURITY.md` — Used for: local-first security model, provider token handling, context disclosure, and no telemetry.
- `package.json` — Used for: package manager, scripts, dependencies, CLI binary, and release packaging.
- `tsconfig.json` — Used for: TypeScript source/build expectations.
- `vitest.config.ts` — Used for: test directory and Vitest baseline.
- `biome.json` — Used for: formatting/lint tooling assessment.
- `.markdownlint.json` — Used for: Markdown lint baseline.
- `profiles/standard/README.md` — Used for: Standard profile scope and profile contract framing.
- `profiles/standard/docs.yml` — Used for: documentation registry, axes, output model, global rules, status workflow, quality model, dependency policy, agent policy, and roadmap integration.
- `profiles/standard/document.schema.yml` — Used for: document descriptor fields, outputs, inputs, dependencies, sections, and generation/review contracts.
- `profiles/standard/phases/01-foundation.yml` — Used for: Standard profile phase registry and Foundation output declarations.
- `profiles/standard/phases/02-validation.yml` — Used for: Standard profile phase registry and Validation output declarations.
- `profiles/standard/phases/03-product.yml` — Used for: Standard profile phase registry and Product output declarations.
- `profiles/standard/phases/04-engineering.yml` — Used for: Standard profile phase registry and Engineering output declarations.
- `profiles/standard/phases/05-go-to-market.yml` — Used for: Standard profile phase registry and Go-to-Market output declarations.
- `profiles/standard/phases/06-operations.yml` — Used for: Standard profile phase registry and Operations output declarations.
- `profiles/standard/executive/executive-generation.yml` — Used for: Executive Axis readiness gate, generation model, derivation rules, exports, validation, and non-goals.
- `profiles/standard/executive/executive-plan.schema.json` — Used for: Executive JSON output validation.
- `profiles/standard/executive/mappings/markdown.mapping.yml` — Used for: supported executive Markdown export rules.
- `profiles/standard/executive/mappings/github-issues.mapping.yml` — Used for: GitHub Issue-compatible file export mapping.
- `profiles/standard/executive/mappings/html.mapping.yml` — Used for: executive HTML artifact rules.
- `profiles/standard/executive/mappings/agent-pack.mapping.yml` — Used for: executive agent pack export rules.
- `profiles/standard/executive/mappings/linear.mapping.yml` — Used for: planned Linear mapping status and no-live-sync boundary.
- `profiles/standard/executive/mappings/notion.mapping.yml` — Used for: planned Notion mapping status and no-live-sync boundary.
- `profiles/standard/executive/templates/agent-task.md` — Used for: agent pack prompt content requirements.
- `docs/01-foundation/04-principles.md` — Used for: local-first and source-of-truth principles.
- `docs/01-foundation/05-boundaries.md` — Used for: MVP non-goals and scope boundaries.
- `docs/01-foundation/07-glossary.md` — Used for: profile terminology and Standard profile framing.
- `docs/02-validation/02-core-assumptions.md` — Used for: assumptions register and validation state.
- `docs/02-validation/03-hypotheses.md` — Used for: hypothesis register.
- `docs/02-validation/08-evidence-log.md` — Used for: evidence boundaries and validation status.
- `docs/02-validation/09-decision-record.md` — Used for: decision register behavior.
- `docs/02-validation/10-validation-report.md` — Used for: conservative validation claims and external evidence gaps.
- `docs/03-product/02-scope.md` — Used for: MVP scope, out-of-scope items, Standard profile, root configuration, derived artifacts, and Executive Axis scope.
- `docs/03-product/03-user-journeys.md` — Used for: intake and continuation workflow expectations.
- `docs/03-product/04-ux-model.md` — Used for: AI-led intake, contextual suggestions, and startup briefing behavior.
- `docs/03-product/05-information-architecture.md` — Used for: output browsing, document hierarchy, and artifact organization.
- `docs/03-product/06-interaction-model.md` — Used for: TUI slash commands and interaction flows.
- `docs/03-product/07-ui-specification.md` — Used for: TUI presentation and status surfaces.
- `docs/03-product/09-product-architecture.md` — Used for: module separation, canonical/derived output boundaries, and Executive compiler role.
- `docs/03-product/10-functional-requirements.md` — Used for: detailed product requirements, commands, root, profile, generation, validation, AI, HTML, agent packs, and Executive Axis.
- `docs/03-product/11-non-functional-requirements.md` — Used for: local-first quality, privacy, and reliability constraints.
- `docs/03-product/13-acceptance-criteria.md` — Used for: MVP acceptance gates and end-to-end workflow expectations.
- `docs/04-engineering/01-engineering-brief.md` — Used for: technical scope, modules, and implementation boundaries.
- `docs/04-engineering/02-system-architecture.md` — Used for: local modular monolith, architecture boundaries, and core flows.
- `docs/04-engineering/03-technical-stack.md` — Used for: Node, TypeScript, Ink, Commander, Zod, YAML, Markdown, HTML, agent packs, and test tooling.
- `docs/04-engineering/04-domain-model.md` — Used for: domain entities and Executive compilation concepts.
- `docs/04-engineering/05-data-model.md` — Used for: `.logos/` state, records, artifacts, provider config, and migration data.
- `docs/04-engineering/06-api-contracts.md` — Used for: internal command/query/port contracts and no public network API.
- `docs/04-engineering/07-integration-architecture.md` — Used for: provider integrations, file exports, and no live external sync.
- `docs/04-engineering/08-security-and-privacy.md` — Used for: token handling, disclosure, local files, trust boundaries, and generated artifact privacy.
- `docs/04-engineering/09-sync-and-state.md` — Used for: local state, snapshots, rollback, staleness, and overwrite policy.
- `docs/04-engineering/10-testing-strategy.md` — Used for: test taxonomy, no-live-provider defaults, profile tests, and release checks.
- `docs/04-engineering/11-observability.md` — Used for: local reports, diagnostics, and no hosted observability.
- `docs/04-engineering/12-deployment-and-environments.md` — Used for: npm packaging, local environments, release gates, and migrations.
- `docs/04-engineering/13-engineering-standards.md` — Used for: coding, schema, documentation, and review standards.
- `docs/04-engineering/14-technical-risks.md` — Used for: root regression, token leak, profile drift, HTML safety, agent pack safety, executive sync confusion, and release-blocking risks.
- `docs/05-go-to-market/10-pricing-and-packaging.md` — Used for: open-source/free initial scope and deferred hosted/profile-pack hypotheses.
- `docs/06-operations/04-customer-support.md` — Used for: local-first support model and documentation/profile support needs.
- `docs/06-operations/09-incident-management.md` — Used for: local incident handling expectations.
- `docs/06-operations/10-risk-and-compliance.md` — Used for: operational risk and compliance boundaries.
- `docs/06-operations/12-knowledge-management.md` — Used for: support and knowledge documentation needs.
- `docs/06-operations/14-operational-risks.md` — Used for: operational support, local evidence, and no hosted support assumptions.
- [DOC GAP] `docs/README.md` — Expected by the roadmap prompt, but not present in the current repository.
- [DOC GAP] `docs/docs.yml` — Expected by the roadmap prompt, but not present in the current repository; the available registry is `profiles/standard/docs.yml`.
- [DOC GAP] `docs/document.schema.json` — Expected by the roadmap prompt, but not present in the current repository; the available schema source is `profiles/standard/document.schema.yml`.
- [DOC GAP] `docs/phases/*.yml` — Expected by the roadmap prompt, but not present in the current repository; phase descriptors are under `profiles/standard/phases`.
- [DOC GAP] `docs/raw/EXECUTIVE_AXIS_SPEC.md` — Expected by the roadmap prompt, but not present in the current repository; available executive contracts are under `profiles/standard/executive`.
- [DOC GAP] `executive/**` — Expected by the roadmap prompt at repository root, but not present in the current repository; available executive files are under `profiles/standard/executive`.
- [DOC GAP] `AGENTS.md` — Expected by the roadmap prompt, but not present in the current repository.
- [DOC GAP] `.cursor/rules` — Expected by the roadmap prompt, but not present in the current repository.
