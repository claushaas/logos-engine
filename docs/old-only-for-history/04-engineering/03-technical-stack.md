# Technical Stack

## Stack Overview

LOGOS Engine uses a local-first TypeScript stack optimized for a repository-scoped TUI product, filesystem-only state, profile YAML contracts, deterministic validation, provider-agnostic AI assistance, portable Executive JSON generation, and Git-friendly generated outputs.

The current implementation stack is:

- **Runtime:** Node.js `>=22`.
- **Language:** TypeScript, ESM modules.
- **Primary interface:** Ink `^7.0.2` with React `^19.2.6`.
- **Entrypoint parser:** Commander `^14.0.3`, bounded to launching the TUI.
- **Package manager:** pnpm `10.33.2`.
- **State and output storage:** local filesystem using JSON, YAML, Markdown, Executive JSON, and derived HTML/Markdown/export artifacts.
- **Schema validation:** Zod `^4.4.3`.
- **Profile parsing:** YAML `^2.8.4`.
- **Testing:** Vitest `^4.1.5` with V8 coverage.
- **Build/typecheck:** TypeScript `^6.0.3`.
- **Lint/format:** Biome `^2.4.14` and markdownlint-cli `^0.48.0`.
- **Distribution:** npm package exposing the `logos` binary, with GitHub Releases as a provisional release-note channel.

The stack is intentionally narrow. It avoids a database, hosted backend, authentication service, telemetry platform, browser client, desktop GUI, job queue, and cloud infrastructure in the MVP because those choices would undermine the local-first architecture or overbuild beyond validation evidence.

### Certainty Levels

| Certainty | Stack Areas |
| --- | --- |
| Committed | Node.js >=22, TypeScript, Ink, React, Commander, pnpm, filesystem storage, YAML profiles, Markdown output, Zod validation, Vitest, Biome, markdownlint, npm distribution. |
| Provisional | OS credential store support, HTML artifact renderer implementation, exact provider SDK strategy, CI platform/matrix, debug logging implementation, accessibility test harness. |
| Deferred | Database, hosted backend, web dashboard, native desktop GUI, API server, job queue, telemetry platform, semantic search, profile marketplace, multi-user auth. |
| Rejected for MVP | Cloud sync, accounts, server-side authorization, analytics, CLI batch mode as primary UX, Electron/Tauri, database-first persistence. |

### Primary Trade-Offs

The stack favors inspectability, local ownership, small operational surface, and deterministic testability over hosted collaboration, rich browser UI, centralized analytics, and database-backed querying. This is the right trade for the MVP because the product is not externally validated, the primary surface is terminal-based, and the product promise depends on safe local decisions and generated documentation rather than multi-user scale.

## Stack Decision Register

| ID | Category | Selected Technology | Status | Version Strategy | Exact Version | Rationale | Alternatives Considered | Constraints Created | Downstream Documents |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TSTK-001 | Runtime | Node.js | committed | Minimum engine version. | `>=22` | Cross-platform TypeScript runtime with strong CLI/TUI ecosystem. | Python, Bun, Deno, bundled binary only. | Users need compatible Node; Deployment must enforce version. | Infrastructure, Deployment |
| TSTK-002 | Language | TypeScript | committed | Package dependency range plus strict project config. | `^6.0.3` | Strong typing for schemas, ports, state, and provider contracts. | JavaScript, Python, Go, Rust. | Build/typecheck required; type errors block release. | Data Model, API Contracts |
| TSTK-003 | Module System | ESM | committed | Package-level `"type": "module"`. | current package setting | Modern Node module format and package exports. | CommonJS. | ESM import rules and tooling compatibility required. | Infrastructure |
| TSTK-004 | TUI Framework | Ink | committed | Semver range; review major upgrades. | `^7.0.2` | React-style terminal UI matching TUI-first product. | raw terminal rendering, blessed, prompts-only CLI, web UI. | Terminal rendering and accessibility limits. | Frontend Architecture |
| TSTK-005 | UI Library | React | committed | Semver range compatible with Ink. | `^19.2.6` | Required by Ink and supports component rendering. | Preact, no UI library. | React upgrades tied to Ink compatibility. | Frontend Architecture |
| TSTK-006 | Entrypoint Parser | Commander | committed | Bounded semver range; entrypoint-only use. | `^14.0.3` | Simple `logos` command parsing before TUI handoff. | yargs, cac, custom parser. | Must not expand into full batch CLI. | API Contracts, Deployment |
| TSTK-007 | Package Manager | pnpm | committed | Pin package manager. | `10.33.2` | Reproducible installs and efficient workspace/dependency handling. | npm, yarn. | Contributors need pnpm; lockfile policy required. | Infrastructure, Release |
| TSTK-008 | Schema Validation | Zod | committed | Semver range; major upgrades reviewed. | `^4.4.3` | Runtime validation for profile, state, AI output, and commands. | io-ts, Valibot, JSON Schema only. | Schema evolution and migration policy required. | Data Model, API Contracts |
| TSTK-009 | Profile Format | YAML via `yaml` package | committed | Semver range; fixtures for parser behavior. | `^2.8.4` | Human-readable profile contracts. | JSON, TOML, executable config. | Malformed YAML must fail clearly; profiles are data only. | Data Model |
| TSTK-010 | Storage | Local filesystem | committed | Node filesystem APIs behind ports. | Node built-in | Preserves local-first and Git-friendly behavior. | SQLite, PostgreSQL, hosted DB. | Safe writes and corruption recovery required. | Data Model, Security |
| TSTK-011 | Structured State Format | JSON | committed | Versioned schemas. | N/A | Inspectable, diffable local state. | SQLite, binary files. | Needs migration/version policy. | Data Model |
| TSTK-012 | Canonical Output Format | Markdown | committed | Profile-defined paths under configured root. | N/A | Git-friendly human-readable output. | HTML-first, DOCX, proprietary docs. | Manual edit safety required. | Data Model, Frontend |
| TSTK-013 | Derived Artifact Format | HTML | provisional implementation | Renderer library unresolved. | unresolved | Profile contracts require navigable review artifacts. | Markdown only, static site generator, custom templates. | Accessibility and stale tracking required. | Frontend, Integration |
| TSTK-014 | Agent Pack Format | Markdown | committed concept / format review-needed | Profile-defined compact prompts. | N/A | Supports downstream agent review without chat history. | JSON packs, no agent packs. | Must preserve caveats and avoid becoming canonical. | Integration |
| TSTK-014A | Executive Exchange Format | JSON | committed concept / schema exists | `profiles/standard/executive/executive-plan.schema.json`. | N/A | Provides portable execution graph and export source. | Manual YAML task tree, live task database. | Must validate, preserve source refs, and remain derived from the Normative Axis. | Data Model, Integration |
| TSTK-015 | AI Provider Layer | Provider-agnostic adapters | committed | Adapter contract stable; provider SDK choices review-needed. | unresolved by provider | Supports local and remote provider modes. | Single provider SDK throughout app. | Adapter maintenance and provider drift. | Integration, Security |
| TSTK-016 | Testing | Vitest | committed | Semver range; CI default. | `^4.1.5` | Fast TypeScript-compatible tests with fixtures/mocks. | Jest, Node test runner. | Test suite must avoid live AI/network by default. | Test Strategy |
| TSTK-017 | Coverage | V8 coverage via Vitest | committed | Semver range. | `^4.1.5` | Lightweight coverage integrated with test runner. | Istanbul standalone. | Exact thresholds belong to Test Strategy. | Test Strategy |
| TSTK-018 | Lint/Format | Biome | committed | Semver range; project quality gate. | `^2.4.14` | Fast lint/format for TS/JS/JSON. | ESLint + Prettier. | Must not blindly reformat generated Markdown/YAML. | Test Strategy |
| TSTK-019 | Markdown Lint | markdownlint-cli | committed | Semver range. | `^0.48.0` | Keeps canonical docs readable and consistent. | remark-lint, no Markdown lint. | Generated docs should satisfy lint rules or report failures. | Test Strategy |
| TSTK-020 | Type Build | TypeScript compiler | committed | Semver range; build and typecheck gates. | `^6.0.3` | Emits distributable JS and verifies type contracts. | tsup, swc-only, esbuild-only. | Build failures block release. | Deployment |
| TSTK-021 | Auth | No user auth in MVP | committed exclusion | N/A | N/A | Single-user local product has no account/session boundary. | Supabase/Auth0/custom auth. | No account lifecycle or server authorization. | Security |
| TSTK-022 | API Server | No product API server in MVP | committed exclusion | N/A | N/A | TUI calls local application services in process. | REST, GraphQL, tRPC. | API Contracts define internal command/action contracts, not network endpoints. | API Contracts |
| TSTK-023 | Background Jobs | No external queue/worker in MVP | committed exclusion | N/A | N/A | Single local process executes operations with visible pending states. | BullMQ, cron, worker service. | Long-running work must be handled in-process. | System Architecture |
| TSTK-024 | Monitoring | Local reports only | committed / some tools deferred | N/A | N/A | No default telemetry; observability is local and privacy-preserving. | Sentry, Datadog, OpenTelemetry dashboards. | Support debugging relies on local diagnostics/reports. | Observability |
| TSTK-025 | Deployment | npm package | committed | Semver package releases. | package `0.1.0` current | Aligns with Node CLI distribution. | app store, Docker, hosted service. | Packaging must include dist, profiles, docs, README, LICENSE. | Deployment, Release |
| TSTK-026 | License | MIT | committed | Repository/package license. | MIT | Permissive open-source posture. | GPL, Apache-2.0, proprietary. | Dependency licenses still require review. | Release, Risk |

## Runtime

### Selected Runtime

| Runtime Area | Selection | Status | Version Strategy | Notes |
| --- | --- | --- | --- | --- |
| User runtime | Node.js | committed | `>=22` | Required to run the `logos` command. |
| Development runtime | Node.js + pnpm | committed | Node `>=22`, pnpm `10.33.2` | Required for build/test/dev scripts. |
| Test runtime | Node.js + Vitest | committed | Same Node engine as app | Tests must run without live AI or network by default. |
| Build runtime | Node.js + TypeScript compiler | committed | Same Node engine as app | Emits `dist` package output. |
| Browser runtime | None for app | excluded | N/A | HTML artifacts render in modern browsers, but the product is not a browser app. |
| Server runtime | None | excluded | N/A | No hosted backend or API server in MVP. |
| Worker runtime | None | excluded | N/A | No queue/worker service in MVP. |
| Mobile/native runtime | None | excluded | N/A | Mobile and native desktop apps are outside scope. |

Unsupported runtimes:

- native Windows CMD/PowerShell as a committed target;
- Bun or Deno as supported production runtimes;
- browser-only execution;
- hosted server runtime;
- mobile runtime;
- background worker runtime.

Runtime upgrade policy:

- Maintain the declared Node minimum until a security, dependency, or platform reason justifies change.
- Raising the Node minimum requires release notes and installation guidance.
- Major runtime changes require Deployment Plan and Test Strategy review.
- Do not adopt experimental Node runtime features for core behavior without explicit review.

## Languages

TypeScript is the sole implementation language for the application codebase.

| Area | Language | Status | Constraints |
| --- | --- | --- | --- |
| Application code | TypeScript | committed | Must pass typecheck and build. |
| TUI components | TypeScript / TSX where needed | committed | React/Ink components must preserve terminal constraints. |
| Profile contracts | YAML | committed | Data format only; not executable code. |
| Structured state | JSON | committed | Versioned schemas and validation required. |
| Canonical documents | Markdown | committed | Rendered output, not source state. |
| Executive plan | JSON | committed concept / schema exists | Portable exchange model derived from normative documents. |
| Derived HTML artifacts | HTML | committed output / renderer unresolved | Derived from canonical content and contracts. |
| Executive exports | Markdown/HTML/JSON/CSV depending adapter | supported/planned by adapter | Derived snapshots for review/import, not live sync. |
| Scripts | TypeScript or JavaScript | committed / practical | Scripts must not bypass quality/security rules. |

Language rules:

- TypeScript strictness should favor explicit schemas, ports, and discriminated states.
- Type errors block release.
- Runtime validation is still required at trust boundaries; TypeScript alone is not enough.
- ESM is the package module format.
- YAML, JSON, Markdown, and HTML are data/output formats, not places for hidden execution.
- Additional implementation languages are deferred unless a downstream engineering document proves a narrow need.

## Frameworks

| Surface | Framework | Status | Rationale | Constraints |
| --- | --- | --- | --- | --- |
| TUI | Ink | committed | Provides React-style terminal rendering and keyboard-driven interaction. | Terminal layout, focus, accessibility, and rendering limits must be tested. |
| UI component model | React | committed | Required by Ink and supports component composition. | React usage should stay inside presentation layer. |
| CLI entrypoint | Commander | committed | Minimal parsing for `logos` before TUI handoff. | Must not become a parallel batch CLI interface. |
| API server | None | excluded | No network API server in MVP. | Internal command/action contracts still required. |
| Web frontend | None | excluded | Product is TUI-first and local. | HTML artifacts are generated outputs, not a web app. |
| Desktop GUI | None | excluded | Adds unvalidated complexity. | Future GUI requires scope change. |
| Job framework | None | excluded | No external queue or worker runtime. | Long-running tasks handled in-process. |

Framework alternatives rejected for MVP:

- Electron/Tauri: too much distribution and UI complexity.
- Browser SPA: contradicts TUI-first local workflow.
- Raw terminal rendering: too much custom UI plumbing compared with Ink.
- Prompt-only CLI: insufficient for status, review, diagnostics, generation reports, and recovery.
- Service framework: unnecessary without hosted API surface.

## Package Management

pnpm is the committed package manager.

| Policy Area | Rule | Rationale | Enforcement |
| --- | --- | --- | --- |
| Package manager | Use pnpm `10.33.2`. | Reproducible installs and existing package declaration. | `packageManager` field and lockfile. |
| Lockfile | Lockfile changes must be reviewed with dependency changes. | Prevents hidden dependency drift. | Code review and CI install. |
| Registry | npm registry is the primary package distribution surface. | Matches Node CLI distribution. | Deployment Plan. |
| Dependency groups | Runtime dependencies must be required by product runtime; dev tools stay in devDependencies. | Keeps install surface understandable. | Review package changes. |
| Transitive dependencies | New dependencies require transitive risk awareness. | Supply-chain and maintenance risk. | Dependency review checklist. |
| Scripts | Scripts must support `build`, `typecheck`, `test`, `lint`, and `check`. | Acceptance gates depend on repeatable commands. | CI and Release Management. |
| Publishing | Package includes `dist`, `profiles`, `docs`, README, and LICENSE. | Users and agents need runtime plus contracts/docs. | package `files` field and release checks. |

Dependency additions require:

- product or engineering rationale;
- license review at least at the obvious-license level;
- package health check;
- security/vulnerability check where tooling exists;
- bundle/runtime impact review for user-facing runtime dependencies;
- clear owner and replacement trigger for risky dependencies.

## Database

No database is selected for MVP.

| Database Category | Selection | Status | Rationale |
| --- | --- | --- | --- |
| Primary database | None | excluded | Filesystem JSON/YAML/Markdown is committed for local-first MVP. |
| Local embedded database | None | excluded unless re-scoped | Adds migration and query complexity before validated need. |
| Remote database | None | excluded | No hosted backend or cloud sync. |
| Cache store | None | excluded | MVP scale does not justify a cache engine. |
| Search index | None | deferred | Semantic/local search is deferred until usage shows need. |
| Analytics store | None | excluded | No telemetry or analytics by default. |
| Event store | None | excluded | No event-sourced architecture in MVP. |

Database reconsider triggers:

- structured state grows beyond practical filesystem operations;
- search/retrieval becomes validated as a core need;
- concurrent multi-user editing becomes validated and explicitly scoped;
- migration complexity exceeds safe JSON schema evolution;
- hosted collaboration is explicitly approved after validation.

Data Model must define schema and migration policy for filesystem state, not database tables.

## Storage

Storage is local and filesystem-only.

| Storage Type | Technology | Status | Role | Policy |
| --- | --- | --- | --- | --- |
| Internal workspace state | JSON files through filesystem adapter | committed | Durable structured state and metadata. | Versioned, schema-validated, safe-write protected. |
| Profile contracts | YAML files | committed | Profile, phase, document, output, validation contract definitions. | Schema-validated; never executable. |
| Canonical documents | Markdown files | committed | Human-readable rendered project documentation. | Generated under configured LOGOS documentation root. |
| Executive plan | JSON file | committed concept / schema exists | Portable execution graph. | Generated under configured LOGOS documentation root and schema-validated. |
| HTML artifacts | HTML files | committed output / renderer unresolved | Navigable derived review artifacts. | Derived, stale-aware, accessibility-reviewed. |
| Agent packs | Markdown files | committed output / format review-needed | Compact downstream agent context. | Derived and caveat-preserving. |
| Executive exports | Markdown/HTML/JSON/CSV files | supported/planned by adapter | External-tool import/review snapshots. | Derived, source-referenced, no live sync. |
| Temporary files | Filesystem temp/safe-write files | provisional | Support atomic writes and recovery. | Must not leak secrets or stale partial content. |
| Logs | None by default; optional local debug logs deferred | deferred | Support troubleshooting if approved. | Redacted, opt-in, local only. |
| Large assets | None | excluded | Product does not manage media/blob uploads in MVP. | Future need requires storage review. |

The default generated documentation root is `logos/` and must remain configurable. This root is distinct from internal engine workspace state. Detailed state path and generated file layout are Data Model decisions.

Storage failures must produce actionable errors and must not silently corrupt confirmed state or overwrite user work.

## Authentication

There is no user authentication stack in MVP.

| Auth Area | Selection | Status | Reason |
| --- | --- | --- | --- |
| User accounts | None | excluded | Single-user local product. |
| Sessions | None | excluded | No hosted app session model. |
| Authorization | None | excluded | No multi-user roles or permissions. |
| OAuth/social login | None | excluded | No account lifecycle. |
| Provider API tokens | Environment variables; OS credential store review-needed | committed / provisional | Provider tokens are integration credentials, not LOGOS user auth. |
| Local provider auth | None by default | committed | Local providers such as Ollama/LM Studio usually run locally without account auth. |

Security Architecture must expand token source handling, redaction, context disclosure, and credential storage. It must not introduce user auth unless product scope changes.

## API Layer

LOGOS Engine has no network API server in MVP. The API layer is an internal command/action and port-contract layer.

| API Area | Selection | Status | Notes |
| --- | --- | --- | --- |
| External product API | None | excluded | No REST/GraphQL/gRPC product API in MVP. |
| Internal command/action contracts | TypeScript types + Zod validation where crossing boundaries | committed | Used by TUI, command router, application services, and tests. |
| Provider APIs | Adapter-specific HTTPS/local HTTP calls | committed concept / SDK choices review-needed | Hidden behind provider ports. |
| Serialization | JSON for state and structured results | committed | Human-inspectable and testable. |
| Error model | Typed error/result objects | committed concept | Exact contracts belong to API Contracts. |
| Versioning | Internal contract versioning where persisted or externalized | review-needed | API Contracts and Data Model define details. |
| Documentation | Markdown architecture/API docs | committed | No generated OpenAPI needed without network API. |

API Contracts must define command results, state transition requests, provider status, AI interpretation result schemas, validation findings, diagnostics, generation reports, and error taxonomy.

## Background Jobs

No external background job framework is selected for MVP.

| Job Area | Selection | Status | Architecture Rule |
| --- | --- | --- | --- |
| Queue | None | excluded | No BullMQ, Redis, SQS, or worker queue. |
| Scheduler | None | excluded | No cron or scheduled background work. |
| Worker process | None | excluded | Single local process only. |
| Long-running AI calls | In-process async operation | committed | Timeout, pending UI, retry, and failure recovery required. |
| Generation work | In-process operation | committed | Reports partial success/failure and avoids silent writes. |
| Retrying | Explicit retry by user or bounded application retry | committed concept | Must avoid duplicate state transitions or writes. |
| Cancellation | Review-needed | provisional | Frontend/API Contracts decide UX and semantics. |

If jobs are introduced later, System Architecture and Infrastructure Architecture must re-open runtime, observability, persistence, and failure-mode decisions.

## Testing Tools

| Test Type | Tooling | Status | Expectation |
| --- | --- | --- | --- |
| Unit tests | Vitest | committed | Domain rules, validators, parsers, and pure services. |
| Integration tests | Vitest + fixture filesystem/provider | committed | Workspace, profile, state, validation, generation flows. |
| AI/provider tests | Mocked or fixture providers | committed | No default live provider or network calls. |
| Contract tests | Vitest + Zod schemas | committed concept | Validate command/action, AI output, profile, state contracts. |
| Coverage | `@vitest/coverage-v8` | committed | Thresholds deferred to Test Strategy. |
| Type checks | TypeScript compiler | committed | `pnpm typecheck` and build gates. |
| Code lint/format | Biome | committed | TS/JS/JSON quality gate. |
| Markdown lint | markdownlint-cli | committed | Documentation and generated Markdown quality. |
| TUI E2E | Review-needed | provisional | Test Strategy must define feasible tooling or smoke approach. |
| Accessibility tests | Review-needed | provisional | Keyboard-only tests required; screen reader feasibility unresolved. |
| Security tests | Review-needed | provisional | Secret scanning and no-network tests should be considered. |
| Performance tests | Manual/prototype evidence initially | provisional | Startup/status/generation thresholds need validation. |
| Visual tests | Not applicable for TUI; HTML review deferred | deferred | HTML artifact structure/readability review required. |

Default quality command:

```bash
pnpm check
```

The default test policy is strict: no live AI provider calls, no network dependency, and no raw API tokens in fixtures or project files.

## Deployment Platform

LOGOS Engine deploys as a local Node.js package, not a hosted service.

| Deployment Area | Selection | Status | Notes |
| --- | --- | --- | --- |
| Release artifact | npm package | committed | Exposes `logos` binary. |
| Current package version | `0.1.0` | current | Version policy is semantic versioning. |
| Package contents | `dist`, `profiles`, `docs`, README, LICENSE | committed | Defined in package `files`. |
| Release notes | GitHub Releases | provisional | Product Stack marks as provisional. |
| Hosted runtime | None | excluded | No staging/production servers. |
| Containers | None | excluded | No Docker runtime for MVP. |
| App stores | None | excluded | Not a desktop/mobile app. |
| Secrets platform | Environment variables; credential store review-needed | provisional | No project-file token storage. |
| CI/CD platform | Review-needed | provisional | Exact pipeline belongs to Infrastructure/Deployment. |

Deployment Plan must define publishing, installation, Node version errors, smoke checks, release notes, package contents, and migration notes.

## Monitoring Tools

No hosted monitoring stack is selected for MVP.

| Observability Area | Tooling | Status | Rule |
| --- | --- | --- | --- |
| Product analytics | None | excluded | No telemetry or behavior tracking by default. |
| Hosted logs | None | excluded | No hosted service or log collection. |
| Metrics dashboards | None | excluded | No operational dashboard in MVP. |
| Tracing | None | excluded | No distributed system. |
| Error tracking | None | excluded by default | Future opt-in only after privacy review. |
| Local generation reports | Built-in local report | committed | Records created, updated, skipped, blocked, failed outputs. |
| Decision audit trail | Structured local state | committed | Records decision transitions and affected outputs. |
| Validation/diagnostic reports | Built-in local output | committed | Supports debugging and readiness review. |
| Debug logging | Local, redacted, opt-in | deferred | Requires Observability and Security review. |

Observability Plan must preserve no-default-telemetry and define local support artifacts that do not leak secrets or sensitive project context.

## Local Development Tools

### Required Tools

| Tool | Version / Policy | Purpose |
| --- | --- | --- |
| Node.js | `>=22` | Runtime, build, tests. |
| pnpm | `10.33.2` | Install dependencies and run scripts. |
| TypeScript compiler | `^6.0.3` | Typecheck and build. |
| Vitest | `^4.1.5` | Unit/integration tests. |
| Biome | `^2.4.14` | Lint/format for TS/JS/JSON. |
| markdownlint-cli | `^0.48.0` | Markdown linting. |
| Git | Recommended user/dev workflow | Review generated files and version changes. |

### Current Scripts

| Script | Purpose | Release Relevance |
| --- | --- | --- |
| `pnpm build` | Compile TypeScript. | Release-blocking. |
| `pnpm typecheck` | Typecheck without emit. | Release-blocking. |
| `pnpm test` | Run Vitest. | Release-blocking. |
| `pnpm test:coverage` | Run tests with coverage. | Review-needed thresholds. |
| `pnpm lint:biome` | Run Biome check/write. | Quality gate. |
| `pnpm lint:md` | Lint Markdown. | Documentation quality gate. |
| `pnpm check` | Run lint, tests, and build. | Primary quality gate. |
| `pnpm smoke:cli` | Run CLI smoke script. | Deployment/release confidence. |

Local development fixtures should include:

- valid and invalid profile YAML;
- fixture workspace state;
- fixture AI provider responses;
- malformed AI output;
- generation output snapshots;
- root collision scenarios;
- no-provider scenarios;
- provider timeout/failure scenarios.

## Version Constraints

| Dependency | Current Version | Minimum Version | Maximum Version | Pinned or Range | Status | Upgrade Cadence | Review Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Node.js | `>=22` | `22` | none specified | minimum engine | committed | Review each LTS cycle. | Dependency requires higher Node or runtime issue appears. |
| pnpm | `10.33.2` | `10.33.2` | none specified | pinned package manager | committed | Review quarterly or on security issue. | Install/reproducibility issue. |
| TypeScript | `^6.0.3` | package range | next major review | semver range | committed | Review minor updates routinely; major carefully. | Compiler breaking change. |
| Ink | `^7.0.2` | package range | next major review | semver range | committed | Review minor updates routinely; major carefully. | Rendering/accessibility break. |
| React | `^19.2.6` | package range | Ink compatibility | semver range | committed | Upgrade with Ink compatibility review. | React or Ink peer dependency change. |
| Commander | `^14.0.3` | package range | next major review | semver range | committed | Low-frequency updates. | Entrypoint parsing issue. |
| Zod | `^4.4.3` | package range | next major review | semver range | committed | Review with schema changes. | Parser/schema behavior changes. |
| YAML package | `^2.8.4` | package range | next major review | semver range | committed | Review with profile parser tests. | YAML parsing regression. |
| Vitest | `^4.1.5` | package range | next major review | semver range | committed | Routine dev dependency updates. | Test behavior/coverage issue. |
| Biome | `^2.4.14` | package range | next major review | semver range | committed | Routine dev dependency updates. | Lint/format churn. |
| markdownlint-cli | `^0.48.0` | package range | next major review | semver range | committed | Routine docs tooling updates. | Rule behavior changes. |

Breaking-change policy:

- Major dependency upgrades require changelog review and targeted regression tests.
- Runtime minimum increases require release notes and migration guidance.
- Schema-related dependency changes require profile/state fixture tests.
- TUI dependency changes require keyboard and rendering smoke checks.
- Security updates may bypass routine cadence but still require release gate verification.

## Dependency Policy

| Policy Area | Rule | Rationale | Enforcement Mechanism | Exception Process | Review Cadence | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| New runtime dependency | Must have clear product/architecture need and no simpler built-in alternative. | Limits supply-chain and maintenance burden. | PR/review checklist. | Founder/engineering approval. | Every addition. | Engineering |
| New dev dependency | Must support quality, tests, docs, release, or local development. | Prevents tooling sprawl. | PR/review checklist. | Engineering approval. | Every addition. | Engineering |
| License review | Avoid copyleft or commercial-use restrictions unless explicitly approved. | Protects distribution flexibility. | Manual license check initially. | Legal/founder review. | Every addition. | Release/Risk |
| Security review | Check known vulnerabilities where tooling exists. | Protects users and release quality. | Audit tool or manual check. | Security review. | Routine and release. | Engineering |
| Package health | Prefer maintained, widely used, documented packages. | Reduces abandonment risk. | Manual review. | Explicit risk acceptance. | Every material addition. | Engineering |
| Transitive risk | Watch large or risky transitive trees. | Supply-chain risk can hide in dependencies. | Lockfile review. | Risk acceptance. | Every material addition. | Engineering |
| Major upgrades | Require changelog review and targeted tests. | Avoid silent breaking changes. | Upgrade PR checklist. | Emergency security process. | As needed. | Engineering |
| Removal/replacement | Replace dependencies when abandoned, insecure, incompatible, or over-scoped. | Keeps stack healthy. | Risk register and issue tracking. | Founder/engineering decision. | Quarterly or trigger-based. | Engineering |

## Licensing and Compliance

The package declares an MIT license. Dependency license clearance has not been fully documented and should not be treated as legally complete until reviewed.

### License Posture

| Area | Current Status | Notes |
| --- | --- | --- |
| Project license | MIT | Committed in package metadata. |
| Runtime dependencies | Review-needed | Known packages are common open-source dependencies, but license inventory should be verified. |
| Dev dependencies | Review-needed | License and supply-chain review still needed. |
| Copyleft dependencies | Not intentionally selected | Must be flagged if introduced. |
| Source-available/non-commercial packages | Not intentionally selected | Should be rejected unless explicitly approved. |
| Hosted-service terms | Applies to AI providers chosen by user | LOGOS must not imply provider legal/privacy guarantees. |
| Compliance claims | None | The product must not claim GDPR, SOC2, CCPA, or similar compliance without legal review. |
| Attribution | Review-needed | Release packaging should preserve required notices if any dependency requires them. |

Security and privacy compliance concerns:

- Remote AI providers process project context only after explicit user configuration and disclosure.
- LOGOS must not make legal, regulatory, data residency, or compliance claims.
- Users own local project data and generated outputs.
- No telemetry or analytics are collected by default.

## Maintenance and Upgrade Policy

Stack maintenance is owned by Engineering, with founder/user approval required for scope-changing or user-visible trade-offs.

| Maintenance Area | Policy |
| --- | --- |
| Routine dependency updates | Review periodically, batch where possible, and run full quality gates. |
| Security patches | Prioritize immediately; run focused regression plus release gates. |
| Major upgrades | Require changelog review, migration notes if user-visible, and targeted tests. |
| Runtime upgrades | Require Deployment Plan update and user-facing installation guidance. |
| TUI framework upgrades | Require rendering, keyboard, compact terminal, and accessibility smoke checks. |
| Schema-library upgrades | Require profile, state, and AI output fixture validation. |
| Provider adapter updates | Require mock/fixture tests and failure-path tests. |
| Deprecated dependencies | Track replacement plan and remove before they become release blockers. |
| Abandoned dependencies | Replace or accept risk explicitly with mitigation. |
| Technical debt | Track in Risk Management or engineering backlog with release impact. |

Replacement triggers:

- package becomes unmaintained or security-vulnerable;
- license becomes incompatible with distribution;
- runtime compatibility blocks supported platforms;
- dependency forces hidden telemetry, remote behavior, or broad context capture;
- framework prevents release-blocking accessibility or reliability requirements;
- maintenance cost exceeds product value.

## Stack Risks

| Risk | Affected Technology | Risk Type | Likelihood | Impact | Early Signal | Mitigation | Replacement or Exit Plan | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Node.js >=22 blocks some users. | Node.js | compatibility | medium | medium | Install failures on older machines. | Clear version error and setup docs. | Evaluate bundling only after adoption evidence. | Deployment Plan | degrade gracefully |
| Ink accessibility varies by terminal. | Ink / terminal | accessibility | medium | high | Keyboard/focus/screen reader issues. | Keyboard-first tests, text labels, compact layouts. | Consider alternative UI only after evidence. | Frontend Architecture | release-risk |
| React/Ink major upgrades create churn. | React, Ink | maintenance | medium | medium | Peer dependency conflicts or rendering regressions. | Keep React usage bounded to TUI. | Isolate presentation layer. | Frontend Architecture | monitor |
| Filesystem-only state corrupts on partial writes. | Node fs / JSON storage | reliability | medium | high | Malformed state or failed resume. | Safe writes, schema validation, backups/recovery. | Reconsider embedded DB only if filesystem model fails. | Data Model | release-blocking |
| JSON state becomes hard to query at scale. | JSON storage | scalability | low now | medium later | Slow status/diagnostics on large projects. | Keep MVP size assumptions explicit; optimize reads. | Add index/search or DB only after evidence. | Data Model | monitor |
| YAML profile parsing creates confusing errors. | `yaml`, Zod | usability | medium | medium | Invalid profile messages are unclear. | Schema-specific diagnostics and fixtures. | Alternative profile tooling if needed. | Data Model | feature-blocking |
| Provider abstraction lags provider APIs. | AI adapters | integration | medium | medium | Provider failures after API changes. | Adapter contract tests and provider-specific isolation. | Replace adapter or narrow supported provider list. | Integration Architecture | release-risk |
| Remote provider SDKs increase dependency risk. | Provider SDKs | supply-chain/privacy | medium | high | Large transitive tree or unexpected behavior. | Consider HTTP adapters; review SDK dependency tree. | Swap SDK for direct HTTP client if safer. | Integration Architecture | review-needed |
| OS credential store library is brittle. | credential storage | security/compatibility | medium | medium | Works on macOS but fails on Linux/WSL. | Env-var source first; credential store review. | Defer credential store until reliable. | Security Architecture | review-needed |
| Markdown-to-HTML renderer weakens accessibility. | HTML renderer | accessibility/content | medium | medium | Poor headings, missing caveat labels. | Renderer evaluation with artifact snapshots. | Switch renderer or custom templates. | Frontend Architecture | degrade gracefully |
| Agent packs overfit current agents. | Markdown agent packs | maintainability | medium | medium | Packs become stale or too broad. | Keep compact, traceable, caveat-preserving. | Version pack format or defer advanced packs. | Integration Architecture | monitor |
| Biome write mode causes unexpected churn. | Biome | tooling | medium | low/medium | Large unrelated formatting diffs. | Review format scope and avoid generated docs/YAML churn. | Adjust scripts/config. | Test Strategy | monitor |
| No hosted monitoring makes support harder. | observability stack | supportability | medium | medium | Hard-to-debug user reports. | Local diagnostics and redacted reports. | Opt-in local debug logs after review. | Observability Plan | monitor |
| Dependency licenses are not fully inventoried. | all dependencies | licensing | medium | high | Unknown restrictive license appears. | Add license review before release. | Replace incompatible packages. | Release Management | release-blocking if incompatible |

## Downstream Handoff

### Data Model

Data Model must inherit filesystem-only persistence, JSON structured state, YAML profile contracts, Markdown canonical output, derived HTML/agent pack metadata, schema validation with Zod, state versioning, migration policy, and safe-write expectations.

### Security Architecture

Security Architecture must inherit no user auth in MVP, provider token sources via env vars or reviewed credential store, no raw tokens in project files, redaction requirements, no default telemetry, local-first storage, and remote provider disclosure.

### API Contracts

API Contracts must inherit that APIs are internal command/action and port contracts, not network endpoints. They must use TypeScript types and runtime validation where boundary data enters the system.

### Integration Architecture

Integration Architecture must inherit provider-agnostic AI adapters, local/remote provider separation, timeout and failure behavior, SDK-versus-direct-HTTP review, no-provider fallback, and derived agent pack format review.

### Frontend Architecture

Frontend Architecture must inherit Ink, React, terminal-only constraints, keyboard-first behavior, text labels for state, compact terminal handling, and no DOM/CSS/browser dependency for the product UI.

### Infrastructure Architecture

Infrastructure Architecture must inherit local package deployment, Node.js `>=22`, pnpm, npm registry distribution, no hosted runtime, no database, no queue, no telemetry platform, and CI/release gate needs.

### Test Strategy

Test Strategy must inherit Vitest, fixture providers, fixture filesystem, no-live-AI default tests, no-network default tests, no raw tokens in fixtures, TypeScript typecheck, Biome, markdownlint, smoke CLI, and release gate expectations.

### Engineering Design System

Engineering Design System must inherit terminal rendering constraints, Ink/React component boundaries, semantic state labels, non-color-only meaning, and generated HTML artifact readability expectations.

### Observability Plan

Observability Plan must inherit no hosted monitoring, no telemetry, local generation reports, decision audit trail, validation/diagnostic outputs, and optional redacted debug logging as deferred/review-needed.

### Deployment Plan

Deployment Plan must inherit npm package distribution, package file inclusion, Node version enforcement, pnpm build process, GitHub Releases as provisional, semver, release notes, and migration notes.

### Release Management and Risk Management

Release Management must require dependency/license/security review before release. Risk Management must track stack risks around Node adoption, Ink accessibility, filesystem corruption, provider drift, credential storage, dependency licensing, and scope creep into hosted infrastructure.

### Unresolved Stack Questions

- Which Markdown-to-HTML renderer should be selected for derived HTML artifacts?
- Should provider adapters use official SDKs, direct HTTP clients, or a mixed approach?
- Is OS credential-store integration required before MVP release, or are env vars sufficient?
- What exact TUI accessibility test harness is feasible for Ink?
- What state migration tooling is required before the first public release?
- Should dependency license scanning be automated before MVP release?
- What CI platform and OS matrix are required for macOS, Linux, and WSL confidence?
- Should `pnpm lint:biome` run in write mode in CI/release gates, or should check-only mode be separated?
