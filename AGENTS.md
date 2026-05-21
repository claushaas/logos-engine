# AGENTS.md

This file is the semantic operating layer for AI coding agents working in LOGOS
Engine. It is not onboarding prose and it is not a README substitute. Use it to
compress the repository's architecture, route retrieval, preserve boundaries,
and make long-running implementation sessions coherent.

If this file, live code, and roadmap documents disagree, treat the disagreement
as a product-contract conflict. Read the relevant source files, name the
conflict, and ask before choosing a material direction.

## Identity And Purpose

LOGOS Engine is a local-first TypeScript CLI/TUI that helps a user clarify a
project into structured decisions, canonical documentation, and derived
execution artifacts. It runs inside the user's repository and keeps the user's
repository as the working boundary.

LOGOS is:

- a decision clarification engine before it is a document generator;
- a repo-scoped, local-first tool with no hosted control plane in the MVP;
- a profile-driven documentation system, starting with the bundled Standard
  profile;
- a structured-state system where conversation can propose truth but cannot own
  truth;
- a deterministic artifact pipeline for Markdown, HTML, validation reports,
  dependency graph views, regeneration plans, and future Executive exports;
- an AI-assisted workflow where providers are adapters and user-reviewed
  decisions remain authoritative.

LOGOS is not:

- a SaaS application, account system, cloud synchronization service, or
  collaboration platform;
- a generic chat transcript store;
- an autonomous builder that silently mutates project truth;
- a live task manager or bidirectional Linear/Notion/GitHub sync engine;
- an AI validation engine;
- a repository-wide crawler that sends arbitrary source code to a model.

MVP positioning: one local Node process, one repository workspace, the Standard
profile, `.logos/workspace.json` as structured state, configurable generated
documentation root defaulting to `logos/`, optional AI assistance, deterministic
validation, and static derived artifacts.

## Source Precedence And Truth Model

Use this precedence when deciding what owns a behavior:

1. Live implementation and tests define current behavior.
2. Profile YAML under `profiles/standard/` defines documentation contracts.
3. `.logos/workspace.json` schema code defines local structured state.
4. Architecture/product/security docs define intended constraints.
5. Roadmap docs define phase intent, but some repo-assessment sections are
   historical and may lag the live `src/`, `tests/`, and `scripts/` tree.

Truth categories:

| Category | Canonical location | Rule |
| --- | --- | --- |
| Profile contract truth | `profiles/standard/docs.yml`, phase `docs.yml`, `document.schema.yml`, Executive YAML/schema files | YAML and schemas define structure, required sections, dependencies, outputs, quality rules, and status workflows. |
| Product truth | `.logos/workspace.json` via `src/state/workspace-state.schema.ts` | Structured local state is authoritative for decisions, assumptions, open questions, risks, sessions, runs, artifacts, provenance, registers, provider config, and docs root. |
| Human-readable canonical content | Markdown under configured documentation root, default `logos/` | Markdown is generated from structured state and profile contracts; it is canonical as a readable projection, not as private chat memory. |
| Derived artifacts | HTML, agent packs, Executive exports, reports, graph views | Derived, reproducible, and non-authoritative unless explicitly promoted through a contract. |
| Runtime UI state | Ink/TUI components and shell logic | Ephemeral; must not become product truth. |
| AI output | Provider responses, contextual suggestions, proposals | Advisory until explicitly accepted into structured state. |

Never store raw provider tokens, prompts, hidden chain-of-thought, or unreviewed
AI claims as project truth.

## Architectural Mental Model

LOGOS is a modular monolith with hexagonal boundaries. The implementation does
not have a dedicated `application/` directory today; command orchestration lives
in the CLI/TUI router plus capability services. Preserve the direction even when
the folder names differ from older docs.

Primary runtime path:

1. `src/cli.ts` calls `bootstrap()`.
2. `src/cli/bootstrap.ts` starts the default `logos` TUI for interactive TTYs
   or exposes non-mutating external commands such as `doctor`.
3. `src/tui/slash-parser.ts` parses slash commands and free-form text.
4. `src/tui/slash-router.ts` routes commands to capability services.
5. Capability services load profile contracts, workspace state, dependency
   graphs, validation state, generation plans, provider context, or filesystem
   adapters.
6. Safe writers and repositories persist only within explicit workspace
   boundaries.
7. Renderers and planners produce deterministic command results, reports, and
   artifacts.

Semantic model:

- Conversation is input.
- Contextual suggestions are optional, source-labeled assistance.
- Proposals are structured AI/user suggestions waiting for review.
- Confirmed decisions, active assumptions, open questions, risks, validation
  findings, artifacts, sessions, and runs are structured records.
- Canonical Markdown is rendered from accepted structured state and profile
  contracts.
- HTML, agent packs, reports, graph artifacts, and Executive exports are derived
  views.

Normative axis:

- Owned by the Standard profile phases:
  `01-foundation`, `02-validation`, `03-product`, `04-engineering`,
  `05-go-to-market`, and `06-operations`.
- Captures stable project meaning: purpose, validation, product, engineering,
  market, operations, decisions, assumptions, risks, and evidence boundaries.

Temporal / Executive axis:

- Defined under `profiles/standard/executive/`.
- Generated from the normative baseline.
- Produces portable JSON and derived exports.
- Must not become a live task manager, source-of-truth task database, or
  bidirectional sync layer.
- External targets are file exports unless the mapping explicitly says the
  adapter is supported; planned mappings are not implemented capabilities.

Generation pipeline:

1. Load workspace state, profile contract, and dependency graph.
2. Plan canonical documents from descriptors and accepted state.
3. Detect readiness, blockers, unresolved dependencies, existing artifacts, and
   manual edits.
4. Render canonical Markdown deterministically.
5. Write through safe filesystem policies.
6. Register artifacts, runs, sessions, provenance, and diagnostics in structured
   state.

Artifact pipeline:

- HTML planners discover HTML declarations and source readiness.
- Static HTML rendering must be deterministic, local, escaped, and safe.
- Graph, staleness, and regeneration modules are read-only planners.
- Validation and diagnostic reports are generated artifacts, not live AI output.

AI pipeline:

- Provider abstraction lives behind `src/ai/provider-port.ts`.
- Disclosure and consent are enforced by `src/ai/provider-disclosure.ts`.
- Fake providers are used for deterministic tests and local scaffolding.
- Intake context builders scope and redact structured context before provider
  requests.
- Provider responses can create proposals and suggestions, not confirmed truth.

## Repository Topology

| Path | Responsibility |
| --- | --- |
| `package.json` | Node package metadata, CLI bin, scripts, dependencies, release gates. |
| `tsconfig.json` | Strict NodeNext ESM TypeScript contract for `src/` to `dist/`. |
| `biome.json` | Formatting/linting contract: tabs, single quotes, sorted imports/properties/keys. |
| `docs/01-foundation/` | Canonical foundation documents and project framing. |
| `docs/02-validation/` | Canonical validation documents, evidence boundaries, reports, decisions. |
| `docs/03-product/` | Product architecture, requirements, UX, feature boundaries. |
| `docs/04-engineering/` | Architecture, domain model, data model, API contracts, integration, security, testing, standards, risks. |
| `docs/05-go-to-market/` | Canonical market, positioning, launch, funnel, pricing, sales, and GTM risk documents. |
| `docs/06-operations/` | Canonical operating model, support, process, incident, compliance, knowledge, finance, and operations-risk documents. |
| `docs/roadmap/` | Implementation roadmap and phase contract history; verify against live code before acting on old assessment text. |
| `profiles/standard/README.md` | Standard profile mental model and source-truth rules. |
| `profiles/standard/docs.yml` | Profile registry, axes, phases, output model, global rules, quality model, dependency policy, agent policy. |
| `profiles/standard/document.schema.yml` | Profile-wide document descriptor schema and validation rules. |
| `profiles/standard/phases/*/docs.yml` | Phase document descriptors, dependencies, sections, questions, outputs, and validation metadata. |
| `profiles/standard/executive/` | Executive generation contract, JSON schema, and export mappings. |
| `profiles/standard/executive/templates/` | File-export templates for Executive Markdown, HTML, agent tasks, and GitHub issues. |
| `src/cli/` | CLI bootstrap and non-interactive commands. Keep thin. |
| `src/tui/` | Ink shell, slash parsing/routing, shell context, deterministic startup briefing. |
| `src/runtime/` | Project detection, command result envelope, runtime errors. |
| `src/fs/` | Safe filesystem adapter, atomic writes, path safety, secret guards. |
| `src/init/` | Workspace initialization flow and write planning. |
| `src/state/` | Workspace state schema, defaults, repository, status summary, validation. |
| `src/profiles/` | YAML profile loading, document descriptors, contracts, contract graph. |
| `src/dependency-graph/` | Contract graph, output graph, graph queries, unresolved refs, cycles. |
| `src/ai/` | Provider port, fake provider, disclosure, response metadata. |
| `src/intake/` | Question planning, context building, redaction, provider request building, proposal lifecycle, startup/contextual suggestions. |
| `src/generation/` | Canonical document planning, rendering, safe Markdown writes, `/generate` orchestration. |
| `src/html/` | HTML declarations, planning, escaping, layout, static renderer, security-focused rendering. |
| `src/validation/` | Deterministic validation service, command orchestration, semantic lints. |
| `src/diagnose/` | Diagnostic command pipeline. |
| `src/consistency/` | Consistency and completeness checks across state/docs/contracts. |
| `src/staleness/` | Fingerprint-based artifact staleness detection. |
| `src/regeneration/` | Read-only regeneration planning and safe ordering. |
| `src/provenance/` | Source, claim, link, and provenance metadata builders. |
| `src/registers/` | Decision, assumption, hypothesis, risk, and open-question register contracts. |
| `src/traceability/` | Canonical and derived artifact traceability metadata. |
| `src/index.ts` | Public package export surface. Keep export growth intentional. |
| `tests/` | Vitest coverage for CLI, TUI, profiles, state, AI, intake, generation, HTML, validation, graph, staleness, regeneration, provenance, traceability. |
| `tests/__snapshots__/` | Stable renderer and output expectations. Update only with intentional output changes. |
| `scripts/smoke-cli.js` | Post-build CLI smoke checks for help, version, and doctor command. |

Generated project artifacts are not kept in the source tree by default. At
runtime they are written under the configured documentation root, defaulting to
`logos/`, and internal state is stored under `.logos/`.

## Dependency Rules

Allowed directions:

- CLI bootstrap may depend on commander, runtime command envelopes, TUI startup,
  and explicit CLI command modules.
- TUI components may depend on presentation types, slash parser/router, and
  shell logic.
- Slash routing may orchestrate capability services, but should remain a routing
  boundary rather than a place for domain algorithms.
- Capability services may depend on profile contracts, workspace state,
  dependency graph, validation, generation, and safe filesystem ports.
- Domain-like planners, validators, graph builders, renderers, and context
  builders should prefer pure functions, explicit inputs, and structured
  results.
- Adapters depend inward on ports and contracts; ports must not depend on
  adapter implementations.
- Tests may use fakes, temp directories, snapshots, and fixtures to lock the
  contracts.

Disallowed directions:

- Ink UI components must not directly own filesystem writes, provider SDK calls,
  credential access, or state-transition policy.
- Domain/planning/rendering modules must not import Ink, commander, provider
  SDKs, or process-global UI assumptions.
- Validation must not call live AI providers or depend on model judgment.
- Dependency graph, staleness detection, regeneration planning, and HTML
  planning must remain read-only.
- Renderers must not mutate workspace state or filesystem by themselves.
- Providers must not confirm decisions, close questions, accept risks, or mutate
  state directly.
- Generated root paths must not be hard-coded to `docs/`; use configured
  documentation root, default `logos/`.
- Profile YAML must be parsed as data, never executed.
- Derived artifacts must not be read back as canonical source of truth when the
  structured state or canonical Markdown exists.
- Executive exports must not introduce live external sync or task-manager state
  unless a supported adapter contract is explicitly added.
- Raw tokens, secrets, hidden prompts, provider credentials, or unredacted
  sensitive context must not be persisted.

## Ports And Adapters Strategy

Filesystem:

- `src/fs/safe-filesystem.ts` is the write boundary.
- Use explicit write policies, dry-run support, path containment, atomic writes,
  backup behavior, changed paths, and structured diagnostics.
- Do not bypass safe writers for project artifact writes.

State:

- `src/state/workspace-state.schema.ts` is the canonical structured state
  contract.
- `src/state/workspace-state-repository.ts` owns reading/updating
  `.logos/workspace.json`.
- State writes must validate before and after mutation and reject secret-like
  values.

Profiles:

- `src/profiles/documentation-contract.ts`,
  `src/profiles/document-descriptor.ts`, and
  `src/profiles/contract-graph.ts` translate YAML data into runtime contracts.
- Profile contracts must be valid before generation.

AI providers:

- `src/ai/provider-port.ts` defines provider-agnostic requests and responses.
- Provider-specific behavior belongs in adapters behind the port.
- Remote providers require explicit disclosure and accepted consent.
- The fake provider is the default deterministic test/local scaffold.

Credentials:

- Provider configuration may reference environment variables.
- Raw credential values must not be written to workspace state or generated
  artifacts.

Renderers and exporters:

- Markdown, HTML, validation reports, graph artifacts, agent packs, and
  Executive exports are generated through explicit planners/renderers.
- Rendering should be deterministic, snapshot-testable, and side-effect-free
  until passed to a writer/orchestrator.

External integrations:

- Local filesystem and bundled profile YAML are core integrations.
- AI providers are optional adapters.
- Provider prompts are assembled by request builders and Executive mapping
  templates; there is no standalone prompt directory to treat as canonical.
- Git is part of the user's workflow; LOGOS should not control Git history.
- GitHub Markdown/issue exports, Linear, Notion, HTML, and agent packs must
  follow their declared mapping support status. Planned means not implemented.

## Canonical Invariants

- `logos` opens the TUI for interactive use.
- In-app commands are slash commands.
- Non-slash input is conversational intake input.
- `.logos/workspace.json` is the structured local state source of truth.
- Profile YAML and schemas define the documentation contract.
- Generated documentation root is configurable and defaults to `logos/`.
- AI suggestions and proposals are never confirmed decisions without explicit
  user acceptance.
- Provider output is advisory and provenance-bearing.
- Deterministic validation is separate from AI judgment.
- Default tests must not require live AI, network access, credentials, or remote
  services.
- Raw provider tokens and secrets must never be persisted.
- File writes outside the workspace boundary or configured output boundary are
  unsafe unless an explicit safe adapter contract allows them.
- Markdown canonical documents are human-readable projections of structured
  truth and profile contracts.
- HTML, agent packs, validation reports, graph artifacts, and Executive exports
  are derived and regenerable.
- Static HTML must be escaped, local-safe, and free of unsafe remote/protocol
  links unless an explicit security contract changes that.
- Executive artifacts derive from the normative baseline and include source
  traceability.
- Inferred Executive items require review.
- Validation, graph, staleness, and regeneration planning must not mutate
  project state unless a command orchestrator explicitly writes a report.
- Manual edits to generated Markdown must be detected and surfaced instead of
  silently overwritten.
- Startup briefings and contextual suggestions are read-only assistance.
- Missing required inputs block generation; optional missing inputs may continue
  only as explicit assumptions.

## Coding Conventions

Language and modules:

- TypeScript is strict ESM with NodeNext resolution.
- Use `.js` extensions in relative imports from TypeScript source.
- Prefer explicit types at module boundaries and structured Zod schemas for
  untrusted inputs.
- Avoid `any`; use `unknown` plus validation for external data.
- Keep pure planners and renderers deterministic.

Style:

- Biome owns formatting: tabs, single quotes, sorted imports/properties/keys.
- File and directory names are lowercase kebab-case.
- Types and schemas use PascalCase; schema constants generally end with
  `Schema`.
- Functions and variables use camelCase.
- Error codes and validation codes use stable snake_case strings.
- Slash commands are lowercase.
- Environment variables are uppercase snake case.

Runtime results:

- Commands should return the structured command result envelope from
  `src/runtime/command-result.ts`.
- Include status, user-facing messages, warnings, errors, changed paths,
  dry-run markers, metadata, and data deliberately.
- Do not expose raw thrown causes or secret-like values in user-facing output.

Filesystem and state:

- Use safe filesystem write plans and state repository updates.
- Preserve dry-run behavior and changed path reporting.
- Keep write policy explicit.
- Validate path containment and derived/canonical boundaries.

Validation:

- Keep validation deterministic and provider-free.
- Prefer structured findings with stable codes and source paths.
- Semantic lints should be conservative and source-local.

Generation:

- Generate canonical Markdown before derived artifacts.
- Preserve frontmatter/checksum/manual-edit semantics.
- Do not silently overwrite user edits.
- Update snapshots when rendered output intentionally changes.

Testing:

- Place tests under `tests/` with `*.test.ts` or `*.test.tsx`.
- Use temp directories and fake providers for side-effect tests.
- Lock renderer output with snapshots when output shape matters.
- Add regression tests for every schema, path-safety, token-safety, boundary, or
  derivation change.

Exports:

- `src/index.ts` is the public package surface. Add exports only when the symbol
  is intentionally part of the package API.
- Avoid new broad barrels that obscure dependency direction.

## Retrieval Guidance For Agents

Start every non-trivial task with semantic files, then expand by the runtime or
schema graph. Do not brute-force the whole repository into context.

Universal first pass:

1. `AGENTS.md`
2. The user's named file(s), roadmap step, or failing test
3. `package.json`, `tsconfig.json`, `biome.json` when tooling or style matters
4. The closest tests for the touched subsystem

Product and architecture questions:

- Read `docs/03-product/09-product-architecture.md`.
- Read `docs/03-product/10-functional-requirements.md`.
- Read `docs/04-engineering/02-system-architecture.md`.
- Read `docs/04-engineering/04-domain-model.md`.
- Read `docs/04-engineering/05-data-model.md`.
- Read `docs/04-engineering/06-api-contracts.md`.
- Read `docs/04-engineering/07-integration-architecture.md`.
- Read `docs/04-engineering/08-security-and-privacy.md`.
- Read `docs/04-engineering/09-sync-and-state.md`.
- Read `docs/04-engineering/10-testing-strategy.md`.
- Read `docs/04-engineering/13-engineering-standards.md`.
- Read `docs/04-engineering/14-technical-risks.md` for high-coupling changes.

Profile contract changes:

- Start with `profiles/standard/README.md`.
- Then read `profiles/standard/docs.yml`.
- Then read `profiles/standard/document.schema.yml`.
- Then read the target phase file under `profiles/standard/phases/*/docs.yml`.
- Then read `src/profiles/documentation-contract.ts`,
  `src/profiles/document-descriptor.ts`, and
  `src/profiles/contract-graph.ts`.
- Then inspect generation, validation, graph, and profile tests touching that
  descriptor shape.

Workspace state changes:

- Start with `src/state/workspace-state.schema.ts`.
- Then read `src/state/workspace-state-defaults.ts`.
- Then read `src/state/workspace-state-repository.ts`.
- Then read `src/state/workspace-state-validation.ts` and
  `src/state/workspace-status.ts`.
- Then read `src/runtime/project-context.ts` and `src/init/*`.
- Then inspect state, init, validation, and token-safety tests.

CLI/TUI command changes:

- Start with `src/cli/bootstrap.ts`.
- Then read `src/cli/commands.ts` for external commands.
- Then read `src/tui/slash-parser.ts`, `src/tui/slash-router.ts`,
  `src/tui/shell-logic.ts`, and `src/tui/App.tsx`.
- Then inspect `src/runtime/command-result.ts`.
- Then inspect CLI/TUI tests and `scripts/smoke-cli.js`.

AI/intake changes:

- Start with `src/ai/provider-port.ts`.
- Then read `src/ai/provider-disclosure.ts`.
- Then read `src/ai/fake-provider.ts`.
- Then read `src/intake/intake-context-builder.ts`,
  `src/intake/intake-context-redaction.ts`,
  `src/intake/provider-request-builders.ts`,
  `src/intake/proposal-lifecycle.ts`,
  `src/intake/question-planner.ts`,
  `src/intake/startup-briefing.ts`, and
  `src/intake/contextual-suggestion-service.ts`.
- Then inspect AI, intake, proposal, disclosure, and no-live-provider tests.

Canonical generation changes:

- Start with `src/generation/generate-canonical-docs.ts`.
- Then read `src/generation/generation-planner.ts`.
- Then read `src/generation/canonical-markdown-renderer.ts`.
- Then read `src/generation/safe-markdown-writer.ts`.
- Then read `src/traceability/traceability-metadata.ts`.
- Then inspect generation, renderer, safe-writer, traceability, and snapshot
  tests.

HTML artifact changes:

- Start with `src/html/html-artifact-planner.ts`.
- Then read `src/html/html-render-types.ts`,
  `src/html/static-html-renderer.ts`,
  `src/html/html-escaping.ts`,
  `src/html/html-layout.ts`, and section/view builders.
- Then inspect HTML security, escaping, renderer, and snapshot tests.

Validation and diagnose changes:

- Start with `src/validation/validation-service.ts`.
- Then read `src/validation/validate-command.ts`.
- Then read `src/validation/document-semantic-lints.ts`.
- Then read `src/diagnose/diagnose-command.ts` and `src/consistency/*`.
- Then inspect validation, diagnose, semantic lint, and no-provider tests.

Dependency graph, staleness, and regeneration changes:

- Start with `src/dependency-graph/dependency-graph.ts`.
- Then read `src/dependency-graph/graph-queries.ts` and output graph modules.
- Then read `src/staleness/staleness-detector.ts` and
  `src/staleness/source-fingerprint.ts`.
- Then read `src/regeneration/regeneration-planner.ts` and
  `src/regeneration/regeneration-order.ts`.
- Then inspect graph, staleness, regeneration, and non-mutation tests.

Executive axis changes:

- Start with `profiles/standard/executive/executive-generation.yml`.
- Then read `profiles/standard/executive/executive-plan.schema.json`.
- Then read all files under `profiles/standard/executive/mappings/`.
- Then inspect dependency graph, traceability, generation, validation, and
  regeneration code for Executive references.
- Do not implement live external sync from a planned mapping.

Use `rg --files` for topology, `rg -n` for terms, and import graphs for local
expansion. Retrieve by:

- runtime path when changing command behavior;
- schema ownership when changing persisted data;
- profile descriptor ownership when changing generated documents;
- dependency graph when changing derived artifact ordering;
- test surface when preserving behavior.

Stop expanding when you have the contract owner, runtime caller, write boundary,
and nearest tests in context.

## Change Safety Rules

Repository-wide analysis is required when changing:

- workspace state schema or migrations;
- profile descriptor schema, profile registry rules, or phase dependencies;
- generated output path resolution;
- safe filesystem policy;
- proposal acceptance semantics;
- validation finding semantics;
- Executive generation contracts;
- public CLI/TUI commands;
- exported package API.

Schema changes require:

- Zod/schema updates;
- defaults and migrations if persisted state changes;
- validation updates;
- tests for valid and invalid examples;
- documentation/profile contract updates when the schema is user-facing.

Profile changes require:

- descriptor schema compatibility check;
- dependency graph check;
- generation readiness check;
- validation coverage;
- snapshot updates when canonical output shape changes.

Filesystem/path changes require:

- containment tests;
- dry-run tests;
- manual-edit/collision tests where generated artifacts are involved;
- explicit behavior for configured documentation root.

AI/provider/context changes require:

- disclosure review;
- redaction review;
- no-raw-token persistence tests;
- fake-provider deterministic tests;
- proof that provider output remains proposed, not confirmed.

Renderer changes require:

- escaping/security tests;
- snapshot updates;
- canonical/derived boundary checks;
- no-write verification for pure renderers/planners.

Executive changes require:

- normative source traceability;
- JSON schema validation;
- export mapping support-status checks;
- review markers for inferred items;
- tests proving exports are derived, not task-manager truth.

Public command changes require:

- parser/router updates;
- help/status output updates;
- command result envelope tests;
- CLI/TUI tests;
- smoke test review when external CLI behavior changes.

## Workflow Expectations

- Inspect before editing. Read the relevant contract owner, implementation path,
  and tests before changing code.
- Preserve phase boundaries and roadmap scope when the user asks for a specific
  phase or step.
- Keep local-first behavior intact.
- Prefer existing services, schemas, and result envelopes over new parallel
  abstractions.
- Keep deterministic validation separate from AI assistance.
- Keep generated artifacts reproducible from structured state and profile
  contracts.
- Use safe filesystem adapters for writes and preserve dry-run paths.
- Update tests with behavior changes.
- Report whether failures are caused by the task or pre-existing repository
  state.
- Ask before choosing a direction when live code and normative docs conflict in
  a way that changes product behavior.

## High-Risk Areas

- `src/state/workspace-state.schema.ts`: central persisted-state contract and
  secret guard.
- `src/state/workspace-state-repository.ts`: structured state write boundary.
- `src/fs/safe-filesystem.ts`: path containment, atomic writes, backup policy,
  token guard.
- `src/runtime/project-context.ts`: project root, workspace root, documentation
  root, and profile lock detection.
- `src/profiles/documentation-contract.ts`: profile YAML loading and runtime
  contract assembly.
- `src/profiles/document-descriptor.ts`: document descriptor schema mapping.
- `src/profiles/contract-graph.ts`: contract graph and output declaration
  semantics.
- `src/generation/generate-canonical-docs.ts`: `/generate` orchestration and
  mutation boundary.
- `src/generation/generation-planner.ts`: readiness, blockers, output target
  resolution, and state-to-document planning.
- `src/generation/safe-markdown-writer.ts`: generated frontmatter, checksum, and
  manual-edit handling.
- `src/html/html-escaping.ts`: static HTML safety and link sanitization.
- `src/html/static-html-renderer.ts`: derived HTML output shape and security
  summaries.
- `src/validation/validation-service.ts`: deterministic validation authority.
- `src/validation/document-semantic-lints.ts`: conservative semantic lint
  policy.
- `src/ai/provider-disclosure.ts`: remote provider consent and context category
  boundary.
- `src/intake/intake-context-builder.ts`: context minimization and redaction.
- `src/intake/proposal-lifecycle.ts`: transition from proposed to accepted
  structured truth.
- `src/dependency-graph/*`: dependency, output, Executive, and derived artifact
  graph semantics.
- `src/staleness/*`: fingerprinting and stale/dirty/manual-review
  classification.
- `src/regeneration/*`: safe derived-artifact ordering.
- `profiles/standard/executive/*`: Executive axis source contracts and mapping
  support status.
- `tests/__snapshots__/`: renderer expectations and accidental output drift.

## Recommended Context Loading Strategy

Use semantic-first progressive retrieval:

1. Read this file.
2. Read the user's requested file or roadmap step.
3. Read the nearest architecture/profile/state contract.
4. Read the runtime entrypoint that exercises the behavior.
5. Read the write boundary if the task mutates files or state.
6. Read the nearest tests and snapshots.
7. Expand one dependency edge at a time only when the current evidence is
   insufficient.

Graph expansion patterns:

- For command behavior, follow `cli -> tui/router -> service -> state/profile/fs`.
- For generation behavior, follow `profile descriptor -> contract graph ->
  generation planner -> renderer -> safe writer -> state artifact registration`.
- For validation behavior, follow `profile/state/artifacts -> validation service
  -> findings/report -> command result`.
- For AI behavior, follow `provider port -> disclosure -> context builder ->
  request builder -> proposal lifecycle -> state`.
- For derived artifacts, follow `canonical source -> planner -> renderer/exporter
  -> traceability -> tests`.
- For Executive work, follow `normative documents -> executive YAML/schema ->
  dependency graph -> exporter mapping -> derived output tests`.

Avoid:

- loading every file because the context window is large;
- trusting stale roadmap assessment text over live code;
- implementing from a single README section;
- copying old folder structures into new code;
- widening AI context "just in case";
- writing a new abstraction before checking for an existing service/port;
- treating tests as optional for schema, path-safety, provider, validation, or
  generation changes.

A good context set is small but complete: contract owner, current implementation,
write boundary, nearest tests, and the specific docs that define product intent.

## Operational Commands

Use the package manager pinned in `package.json`.

- Install: `pnpm install`
- Markdown lint: `pnpm lint:md`
- Biome check: `pnpm lint:biome`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`
- Validation gate: `pnpm check:validation`
- Build: `pnpm build`
- CLI smoke: `pnpm smoke:cli`
- Full release gate: `pnpm check`
- Mutating format: `pnpm format`

Prefer targeted tests during iteration, then run the relevant wider gate. Run
`pnpm check` when the change affects runtime behavior, schemas, generation,
validation, package exports, or CLI behavior.

## Agent Output Discipline

When finishing work:

- name the files changed;
- name the validation commands run;
- identify any command failures and whether they are task-caused;
- mention unresolved contract conflicts;
- do not overclaim implemented features from planned roadmap text;
- keep final summaries concise and grounded in evidence.
