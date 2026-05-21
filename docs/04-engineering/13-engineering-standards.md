# Engineering Standards

## Standards Objective

LOGOS Engine engineering standards exist to keep a local-first, AI-assisted documentation engine coherent as it grows. They protect architecture boundaries, user agency, local data ownership, provider safety, deterministic validation, generated-output integrity, release confidence, and reviewability.

The standards should be strict where mistakes can break trust:

- AI output must never become confirmed state without explicit user action.
- Raw provider tokens must never be stored in project files, logs, fixtures, generated Markdown, HTML artifacts, or agent packs.
- Generated files must stay under the configured documentation root, defaulting to `logos/`.
- Profile YAML and local structured state must remain the sources of truth for contracts and decisions.
- Executive JSON must be generated from normative documents and treated as a portable exchange model, not live task state.
- Deterministic validation and default tests must not require live AI, network access, or real credentials.
- The TUI must route state-changing behavior through application/domain services, not direct filesystem or provider calls.

The standards should stay flexible where implementation details are still provisional, such as exact HTML renderer internals, OS credential-store support, CI platform/matrix, debug logging, and accessibility test harnesses. Flexibility is acceptable only when the risk is explicit, the exception is reviewable, and the implementation still preserves product boundaries.

Standards failure materially harms the project when it creates hidden remote transmission, unsafe local writes, state corruption, untestable AI behavior, unclear generated output authority, brittle release gates, or undocumented tribal knowledge.

## Standards Taxonomy

| Classification | Meaning | Violation Consequence | Exception Path |
| --- | --- | --- | --- |
| Mandatory | Required for MVP correctness, safety, or release confidence. | Blocks merge/release unless explicitly accepted as risk. | Product/engineering approval with mitigation. |
| Recommended | Preferred pattern that should be followed unless a better local reason exists. | Reviewer may request change or documented rationale. | PR note is usually enough. |
| Optional | Allowed pattern when useful, not required. | No violation. | None. |
| Prohibited | Pattern that violates product, security, privacy, or architecture constraints. | Blocks merge/release. | Only by explicit scope change or accepted release risk. |
| Deprecated | Existing or legacy pattern that should not expand. | New usage blocked; existing usage scheduled for cleanup. | Cleanup plan required. |
| Review-needed | Not fully standardized yet. | Requires human review before relying on it. | Document decision and revisit trigger. |
| CI-enforced | Objective rule enforced by script/tooling. | Failing gate blocks merge/release. | Temporary waiver must name failing command and risk. |
| Review-enforced | Judgment rule checked in code review. | Reviewer determines block/advisory level. | PR note or risk acceptance depending severity. |
| Documentation-only | Current documented intent with no enforcement yet. | Drift should create follow-up work. | Track gap in release/maintenance notes. |

Violation severity:

- **Release-blocking:** token leaks, hidden telemetry, unsafe path writes, confirmed-state bypass, invalid bundled profile, broken package binary, state migration corruption.
- **Merge-blocking:** type/build/test failures, boundary violations, missing regression tests for risky changes, unreviewed dependency additions.
- **Advisory:** naming/style improvements, non-critical refactors, documentation polish.

## Repository Structure

LOGOS Engine is a single-package TypeScript repository, not a monorepo or hosted multi-service system.

| Path | Purpose | Standards |
| --- | --- | --- |
| `src/` | Application source code. | Organized by architectural capability: AI, application services, CLI, commands, diagnostics, document renderer, domain, foundation, storage, TUI, validation. |
| `tests/` | Vitest suites and fixtures. | Mirrors product boundaries and risk areas; default tests use fakes/fixtures. |
| `profiles/` | Profile YAML contracts and schemas. | Profile files are data, never executable code; changes require contract tests. |
| `docs/` | Product/engineering/operations documentation and legacy source material. | Canonical project documentation lives here during planning; generated user docs default to `logos/` at runtime. |
| `docs/old/` | Prior product and implementation material. | Historical input only; current phase docs override old assumptions. |
| `scripts/` | Local automation and release/development scripts. | Scripts must not bypass security, validation, or release gates. |
| `examples/` | Example material and fixtures. | Must not contain real secrets or private user data. |
| `.github/` | Issue/PR templates and repository metadata. | Templates must reflect current quality and AI safety expectations. |
| `dist/` | Build output. | Generated by `pnpm build`; never hand-edited. |

Generated runtime outputs belong under the configured LOGOS documentation root in the user's target repository, defaulting to `logos/`. Internal workspace state is separate and is recommended as `.logos/`. Do not hard-code `docs/` as the generated-output root.

## Code Organization

Code organization follows a modular monolith with hexagonal boundaries.

| Area | Standard | Enforcement |
| --- | --- | --- |
| Presentation | Ink/React components render UI and route user intent. They do not mutate state or call providers directly. | Review, tests. |
| Commands | Slash command parsing and routing produce typed application actions. | Command tests. |
| Application services | Orchestrate use cases, permission gates, state transitions, and ports. | Review, integration tests. |
| Domain | Owns product invariants, state machines, statuses, and deterministic rules. | Unit/domain tests. |
| Ports/adapters | Filesystem, provider, renderer, credential, and environment access happen through explicit boundaries. | Review, integration tests. |
| Renderers | Convert state/profile contracts into Markdown, HTML artifacts, and agent packs. | Golden/output tests. |
| Executive compiler/export adapters | Compile Executive JSON from normative docs and transform it into derived export artifacts. | Executive schema, source-trace, and golden adapter tests. |

Public module surfaces should be intentional. Export only functions, types, and schemas needed by other modules. Avoid broad barrel exports that hide dependency direction or make private internals easy to import.

Prohibited organization patterns:

- TUI importing filesystem writers, provider SDKs, or storage internals directly.
- Provider adapters writing confirmed decisions or generated files.
- Renderers reading raw conversation transcripts as canonical truth.
- Validation rules calling an AI provider to decide pass/fail.
- Profile YAML executing arbitrary code.
- Shared utilities becoming a place for domain, infrastructure, and UI concerns to mix.

## Module Boundaries

| Boundary | Mandatory Rule | Forbidden Dependency | Enforcement |
| --- | --- | --- | --- |
| TUI to application | TUI calls command/application interfaces and renders results. | TUI to filesystem/provider/storage direct writes. | Review, frontend/workflow tests. |
| Application to adapters | Application services depend on ports and schemas. | Application services importing provider SDK details directly. | Review, integration tests. |
| Domain to infrastructure | Domain code stays pure or side-effect-light. | Domain importing Ink, Node filesystem APIs, provider SDKs, or process env. | Review, unit tests. |
| Provider to state | Provider output becomes validated proposal/advisory data only. | Provider creating confirmed decisions or authorizing writes. | AI tests, decision tests. |
| Validation to AI | Deterministic validation runs without live provider. | Validation depending on AI judgment or network. | Tests, review. |
| Generation to root | Generation writes only under configured root after permission checks. | Path traversal, absolute unsafe writes, silent overwrite. | Path/generation tests. |
| Executive to external tools | Executive adapters write derived files or payloads only; external tools own live status after user import. | Bidirectional sync, live assignments/comments, treating exported issues as canonical LOGOS state. | Schema/export tests, review. |

Dependency injection should be explicit at application-service boundaries. Use fakes/mocks for tests, but validate fakes against the same contracts as real adapters.

## Naming Conventions

| Target | Convention | Examples | Forbidden Examples | Enforcement |
| --- | --- | --- | --- | --- |
| Files/folders | Lowercase kebab-case for source modules and docs. | `prompt-builder.ts`, `engineering-standards.md`. | `PromptBuilder.ts`, vague `utils.ts` for mixed concerns. | Review/Biome where applicable. |
| Tests | Match subject plus `.test.ts`. | `provider-config.test.ts`. | `test1.ts`, `misc.test.ts`. | Review. |
| Types/classes | PascalCase. | `DecisionRecord`, `ProviderConfigRecord`. | `decision_record`. | TypeScript/Biome. |
| Functions/variables | camelCase with domain verbs. | `validateWorkspace`, `generateDocuments`. | `doStuff`, `handleThing`. | Review. |
| Schemas | PascalCase or camelCase with `Schema` suffix. | `WorkspaceRecordSchema`. | `schema1`. | Review. |
| Error codes | Stable snake_case strings. | `invalid_ai_output`, `unsafe_path`. | Provider-specific raw messages as codes. | Tests/review. |
| Slash commands | Lowercase slash command names. | `/init`, `/generate`, `/config ai`. | CamelCase commands. | Command tests. |
| Environment variables | Uppercase snake case. | `LOGOS_LLM_API_KEY`. | `logosApiKey`. | Review. |
| Audit/events | PascalCase event names or stable event ids. | `GenerationRunCompleted`. | Free-form log strings as event identity. | Observability review. |
| Feature/config flags | Descriptive config names, not experiment codenames. | `providerMode`, `debugLoggingEnabled`. | `newThing`, `v2Magic`. | Review. |

Domain terms must remain stable: profile, workspace, documentation root, structured state, proposed decision, confirmed decision, canonical Markdown, Normative Axis, Executive Axis, Executive JSON, execution graph, export adapter, derived HTML artifact, derived agent pack, validation finding, diagnostic finding, generation report, provider mode.

Avoid abbreviations that blur meaning: "doc root" is acceptable in local code if defined, but "docs root" must not imply the generated root is `docs/`.

## Formatting and Linting

| Rule | Tool / Mechanism | Scope | Failure Consequence |
| --- | --- | --- | --- |
| TypeScript/JSON formatting and linting uses Biome. | `pnpm lint:biome`, `pnpm format`. | Source, tests, configs supported by Biome. | Blocks release if unresolved. |
| Markdown uses markdownlint. | `pnpm lint:md`. | Docs, README, generated/planned Markdown where checked. | Blocks docs/release unless accepted exception. |
| TypeScript compiles with the project tsconfig. | `pnpm build`, `pnpm typecheck`. | Source and tests as configured. | Blocks release. |
| Dead/commented code is removed unless it documents a deliberate temporary workaround. | Review/Biome where possible. | Source/tests/scripts. | Reviewer may block. |
| Generated/vendor files are not hand-formatted unless owned by the repo. | Review. | `dist/`, generated outputs, vendored examples. | Avoid churn. |

Current caveat: `pnpm lint:biome` is configured with `--write --unsafe`, so contributors must inspect resulting changes before committing. Automation should eventually separate "check" from "write" behavior for CI.

## Type Safety

TypeScript is mandatory for application code. Runtime validation remains mandatory at trust boundaries because TypeScript does not protect against malformed files, YAML, provider responses, environment variables, or user input.

| Standard | Scope | Enforcement |
| --- | --- | --- |
| Public command/action/result shapes use explicit types. | Command router, application services, TUI. | Typecheck, tests. |
| External inputs are parsed into known structures before domain use. | YAML, JSON state, provider output, env vars, command args. | Zod/schema tests. |
| Domain states use discriminated unions or explicit enums where practical. | Decisions, findings, generation states, provider states. | Typecheck, domain tests. |
| `any` is prohibited unless isolated at an adapter boundary with immediate validation. | All TypeScript. | Review/type lint where possible. |
| `unknown` is preferred for untrusted input until parsed. | Adapters, parsers, provider responses. | Review. |
| Non-null assertions and type suppression comments require local explanation. | All TypeScript. | Review. |
| Persistence types must not leak as UI view models without mapping. | Data/UI boundary. | Review/tests. |

Public types should preserve domain language and avoid exposing provider-specific or filesystem-specific internals unless the module is explicitly an adapter.

## Validation Standards

Validation belongs at trust boundaries and domain invariants.

| Validation Type | Owner | Rule | Error Shape |
| --- | --- | --- | --- |
| Profile validation | Profile module. | YAML contracts must schema-validate before use. | Profile error with path/category and safe summary. |
| Workspace state validation | State/workspace module. | Local JSON must validate before mutation. | Recovery-needed error; mutation blocked. |
| Provider response validation | AI/provider adapter + interpreter. | AI output must match operation schema before proposal creation. | `invalid_ai_output` or provider error; no confirmed-state mutation. |
| Command validation | Command router/application service. | Slash commands and arguments become typed actions. | User-safe command error with next action. |
| Path validation | Filesystem/generation. | Output paths resolve under configured root. | `unsafe_path` or write-denied result. |
| Domain validation | Domain/application services. | State transitions preserve explicit confirmation and status rules. | Stable domain error code. |
| Deterministic validation | Validation service. | Product readiness findings are local and provider-independent. | Validation finding with severity and affected object. |

Validation errors must be actionable and safe to show in the TUI. They must not dump raw JSON state, full prompts, provider payloads, auth headers, environment dumps, or secrets.

## Error Handling

Errors are product states, not just exceptions. Expected failures should return typed results or stable error envelopes. Programmer errors can still throw, but user-facing flows should catch and translate them into safe messages.

| Error Class | Examples | Standard |
| --- | --- | --- |
| Domain error | Invalid decision transition, unsupported status. | Return stable code and preserve prior state. |
| Validation error | Invalid profile, invalid provider output, invalid config. | Show safe summary and recovery action. |
| Filesystem error | Permission denied, unsafe path, partial write. | Stop unsafe mutation and report affected output. |
| Provider error | Timeout, auth failure, unavailable, malformed response. | Preserve user input/state; offer retry/reconfigure/no-provider path. |
| Security/privacy error | Raw token attempt, missing remote disclosure, unsafe path. | Block operation; record/audit if implemented. |
| Migration error | Unsupported schema, failed migration. | Enter recovery-needed state; block mutation. |
| Unknown error | Unexpected exception. | Convert to generic safe error; avoid sensitive stack in user output. |

Retryability must be explicit. Retrying provider calls may be safe; retrying state writes is safe only when prior write outcome is known or idempotent. Error messages should state what failed, what was preserved, and the next safe action.

## Logging Conventions

Default MVP behavior should not produce persistent debug logs. If local debug logging is enabled later, it must be opt-in, redacted, and local-only.

| Log / Event Area | Allowed Context | Forbidden Context | Enforcement |
| --- | --- | --- | --- |
| Command results | command, status, error code, operation id. | full user answer, secrets, full env dump. | Review/tests. |
| Provider status | provider mode, timeout, error class, redacted token source. | token, auth header, prompt, raw response. | Security tests. |
| State operations | state category, schema version, safe file ref. | full sensitive state dump. | Review. |
| Generation reports | run id, root, output kind counts, relative paths where needed. | generated body in debug logs, secrets. | Generation tests. |
| Audit events | material action, actor, target category, outcome. | behavioral analytics identifiers. | Observability review. |

Diagnostic logs, audit events, and telemetry are different concepts. Audit events explain important local actions; telemetry transmits usage data and is prohibited by default.

## Security Coding Standards

| Standard | Scope | Required Level | Enforcement |
| --- | --- | --- | --- |
| Store only token source references, never raw tokens. | Provider config, state, tests, docs, logs. | Mandatory/prohibited. | Security tests, review. |
| Remote provider calls require explicit configuration and disclosure. | AI intake/diagnostics/provider use. | Mandatory. | Provider workflow tests. |
| Validate and escape generated HTML. | HTML artifact renderer. | Mandatory when renderer ships. | Renderer/security tests. |
| Treat profile YAML as data, never executable code. | Profile loader. | Mandatory. | Schema tests/review. |
| Use safe path resolution for every write. | State and generation. | Mandatory. | Path traversal tests. |
| Do not introduce hidden telemetry, analytics, crash reporting, or update checks. | Runtime dependencies and app code. | Prohibited. | Review/network tests when added. |
| Keep provider adapters at the edge. | AI integrations. | Mandatory. | Boundary review/tests. |
| Review dependency additions for supply-chain risk. | Runtime/dev dependencies. | Mandatory. | PR review. |

Security-sensitive changes include provider configuration, credential handling, filesystem writes, HTML rendering, profile loading, package publishing, logging, support export, dependency additions, and migrations.

## Privacy Coding Standards

Privacy standards preserve local-first trust.

- Collect only state needed to guide documentation generation, validation, diagnostics, and recovery.
- Do not ingest arbitrary source code, Git history, environment variables, or unrelated files by default.
- Context sent to AI providers must be bounded, explainable, and disclosed for remote providers.
- Generated agent packs must contain only bounded downstream context and must not include credentials, raw provider payloads, or hidden tool authority.
- Support/debug exports, if added, must require explicit user action, preview, redaction, and no automatic upload.
- Logs, tests, fixtures, screenshots, and generated artifacts must avoid raw tokens and sensitive payload dumps.
- Do not claim GDPR, SOC2, CCPA, encryption, penetration-test, or legal compliance without separate review.

Privacy review is mandatory for remote provider changes, prompt/context expansion, logging, telemetry-like behavior, support export, deletion/reset behavior, and generated agent pack scope changes.

## Dependency Management

pnpm is the committed package manager. Dependency changes must be intentional and reviewed.

| Rule | Scope | Enforcement |
| --- | --- | --- |
| Runtime dependencies require product/runtime justification. | `dependencies`. | PR review. |
| Dev dependencies require tooling/test justification. | `devDependencies`. | PR review. |
| Lockfile changes must match dependency intent. | `pnpm-lock.yaml`. | Review/CI install. |
| New dependencies require license, maintenance, security, transitive, and runtime-impact review. | All packages. | PR checklist. |
| Provider SDK additions require adapter-boundary review. | AI integrations. | Architecture/security review. |
| Abandoned/deprecated/vulnerable packages require update, replacement, removal, or accepted risk. | All packages. | Maintenance/release review. |
| Dependency upgrades that affect runtime, Ink/React, TypeScript, Zod, YAML, provider behavior, or packaging require focused regression tests. | High-risk packages. | Tests/review. |

Avoid adding dependencies for small utilities that TypeScript/Node can handle clearly. Prefer existing stack choices over parallel libraries.

## Migration Rules

LOGOS has no database migrations in MVP, but local state, profile contracts, provider config, and generated output formats can migrate.

| Migration Type | Standard | Release Impact |
| --- | --- | --- |
| Workspace state schema | Version every schema change; include old-state fixtures; preserve prior state where feasible. | Release-blocking. |
| Profile contract/schema | Validate bundled profiles; document compatibility and stale/orphan behavior. | Release-blocking for the initial Standard profile and any future bundled profile. |
| Provider config shape | Never introduce raw token persistence; route failures to `/config ai`. | Release-blocking if token safety affected. |
| Generated output format | Treat outputs as regenerable; warn/confirm before overwriting manual edits. | Release-blocking for canonical Markdown safety. |
| Root behavior | Preserve default `logos/`; root changes mark prior outputs stale/unknown. | Release-blocking for root regression. |

Migration code must be tested with old fixtures and failure fixtures. Destructive migrations require explicit confirmation and release notes. Failed migrations must block mutation and show recovery guidance.

## Testing Standards

Default tests must be deterministic and must not require live AI, network access, or raw provider tokens.

| Change Type | Required Tests / Evidence |
| --- | --- |
| Domain/state transition | Unit/domain tests for valid and invalid transitions. |
| Profile/schema | Contract tests and invalid fixture tests. |
| Provider/AI | Fake provider tests, malformed response tests, redaction tests. |
| Prompt/context | Snapshot or structured tests for context selection, minimization, and output schema instructions. |
| Filesystem/generation | Temp-dir integration tests, path containment, collision/partial failure tests. |
| Markdown/HTML/agent pack rendering | Golden or snapshot tests with caveat/source labels. |
| TUI/commands | Command routing tests and workflow tests for critical paths. |
| Security/privacy | Regression tests for token safety, disclosure, no telemetry, unsafe paths. |
| Migration | Old-state fixtures, failed migration behavior, recovery path tests. |
| Bug fix | Regression test unless impossible; explain exception in PR. |
| Docs-only | markdownlint and review for consistency with product contracts. |

Snapshot tests are allowed for stable contracts, generated output, prompts, and view models, but they must be reviewed carefully. Do not use snapshots as a substitute for semantic assertions around state, secrets, path safety, or confirmation.

Flaky tests are treated as product risk. Quarantining or skipping requires an issue/follow-up and cannot hide release-blocking behavior.

## Documentation Rules

Documentation is part of the product contract for LOGOS Engine.

| Change Type | Documentation Requirement |
| --- | --- |
| Product/architecture behavior change | Update affected docs in `docs/` and any profile contract implications. |
| Profile contract change | Update profile docs/schema expectations and tests. |
| Command/user flow change | Update relevant UX/API/interaction docs and help expectations. |
| Provider/security/privacy change | Update security/privacy, integration, testing, and release notes as needed. |
| State or migration change | Update data model, sync/state, deployment, and migration notes. |
| Release/process change | Update deployment, engineering standards, or release-management docs. |
| Public setup change | Update README or installation docs. |

ADRs or decision records are required when a change alters architecture style, storage source of truth, provider trust boundary, generated-output authority, default documentation root, release gate, or security/privacy posture.

Code comments should explain non-obvious decisions, risk controls, or boundary rationale. Avoid comments that restate obvious code.

## Git Workflow

Current standards are repository-oriented and do not assume a large team or a fully automated CI/CD platform.

| Area | Standard |
| --- | --- |
| Branch model | Use short-lived feature/fix branches when collaborating. Direct local work is acceptable for founder-led solo work but must still pass quality gates before release. |
| Main branch | Should represent releasable or near-releasable state once CI is active. |
| Commit messages | Use clear imperative or descriptive messages naming scope and behavior. Conventional Commits are recommended but not yet mandatory. |
| Merge strategy | Squash or merge commit may be used; release history should preserve meaningful change grouping. |
| Tags/releases | Package releases use semver tags once release automation exists. |
| Hotfixes | Start from affected release or current main, add focused regression test, run release gate, publish patch. |
| History rewriting | Do not rewrite shared/public history without maintainer agreement. |

No product command should perform Git operations in MVP. Users decide what to commit.

## Pull Request Rules

The existing PR template is the baseline. PRs should include summary, type, scope, test evidence, quality-gate status, and AI safety notes where relevant.

Additional PR standards:

- Keep PRs focused on one coherent change or documentation artifact.
- Call out changes to state schemas, profiles, provider behavior, generated outputs, root handling, logging, security/privacy, and release gates.
- Include screenshots/terminal output only when useful and redacted.
- Include migration notes for state/profile/config changes.
- Include manual test notes for TUI or generated HTML behavior that automation does not cover.
- Do not claim `pnpm check` is the full release gate while `pnpm typecheck` and `pnpm smoke:cli` remain separate.

High-risk PRs require additional review or explicit owner acceptance:

- credential/token handling;
- remote provider context expansion;
- filesystem write/root behavior;
- state migrations;
- HTML rendering and escaping;
- profile loader/schema changes;
- dependency additions affecting runtime;
- release/package publishing behavior.

## Review Checklist

| Item | Applies To | Check | Evidence Required | Blocking Level | Automation Support |
| --- | --- | --- | --- | --- | --- |
| Architecture boundary | Code changes | Does the change preserve TUI/application/domain/adapter separation? | Diff review, tests. | Blocking for violations. | Partial. |
| Domain truth | AI/state/generation | Does confirmed state require user action and remain separate from proposals? | Domain/workflow tests. | Release-blocking. | Yes. |
| Source of truth | Profiles/state/output | Are YAML profiles and structured state authoritative, with Markdown/HTML/agent packs rendered or derived? | Tests/docs review. | Blocking. | Partial. |
| Root safety | Generation/filesystem | Are writes constrained under configurable root defaulting to `logos/`? | Path tests. | Release-blocking. | Yes. |
| Token safety | Provider/logs/tests/output | Are raw tokens absent from files, logs, fixtures, generated outputs, and package artifacts? | Tests/inspection. | Release-blocking. | Partial. |
| Remote disclosure | Provider/AI | Is remote context transmission explicit and consented? | Workflow/provider tests. | Release-blocking. | Yes. |
| Validation boundary | Validation/diagnostics | Does deterministic validation remain provider-independent? | No-provider tests. | Release-blocking. | Yes. |
| Error recovery | All risky flows | Does failure preserve state and show next safe action? | Failure tests/manual review. | Blocking when state risk exists. | Partial. |
| Observability | Commands/generation/provider | Are reports/status useful and redacted? | Tests/review. | Blocking for unsafe logs. | Partial. |
| Tests | All changes | Are required tests updated and deterministic? | Command output. | Blocking unless exception accepted. | Yes. |
| Docs | Behavior/contract changes | Are affected docs updated? | Diff review/markdownlint. | Blocking for contract drift. | Yes/partial. |
| Deployment | Release-affecting changes | Are package, build, smoke, migration, and rollback implications handled? | Release checklist. | Blocking for release. | Partial. |

Reviewers should ask for automation when a repeated objective check is being handled only by memory or ad hoc review.

## Automation and Enforcement

| Rule | Tool or Mechanism | Trigger | Scope | Failure Consequence | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TypeScript build | `pnpm build`. | Local/PR/release. | Source. | Block release. | Engineering. | Active. |
| Type checking | `pnpm typecheck`. | PR/release. | Source/tests as configured. | Block release. | Engineering. | Active, separate from `pnpm check`. |
| Unit/integration tests | `pnpm test`. | Local/PR/release. | Tests. | Block release for unaccepted failure. | Engineering. | Active. |
| Coverage | `pnpm test:coverage`. | Pre-release or targeted review. | Tests. | Review-needed until thresholds exist. | Engineering. | Active tool, threshold unresolved. |
| Biome lint/format | `pnpm lint:biome`, `pnpm format`. | Local/PR. | Supported source/config files. | Block if unresolved. | Engineering. | Active. |
| Markdown lint | `pnpm lint:md`. | Docs/PR/release. | Markdown docs. | Block docs/release if unresolved. | Engineering/docs. | Active. |
| CLI smoke | `pnpm smoke:cli`. | CLI/release changes. | Package/CLI wiring. | Block release. | Engineering. | Active. |
| Full current check | `pnpm check`. | Local/PR/release baseline. | Biome, markdownlint, tests, build. | Block if fails. | Engineering. | Active but incomplete release gate. |
| Secret scanning | Dedicated command/tool. | PR/release. | Source, fixtures, package, outputs. | Block token/privacy releases. | Engineering/security. | Review-needed. |
| CI workflow | GitHub Actions or equivalent. | PR/tag/release. | Quality gates. | Should block merge/release when implemented. | Engineering. | Required/proposed; no workflow currently checked in. |
| Codeowners/policy checks | CODEOWNERS or review rules. | PR. | High-risk areas. | Review gate. | Maintainer. | Deferred/review-needed. |

Objective checks should become automated as the project stabilizes. Architecture, product judgment, and risk acceptance remain human review responsibilities.

## Exception Process

Exceptions must be explicit, temporary where possible, and risk-aware.

| Exception | Standard Affected | Required Approval | Expiration / Review Trigger | Mitigation |
| --- | --- | --- | --- | --- |
| Temporary failing non-release lint/docs rule | Formatting/docs. | Engineering owner. | Next PR or release candidate. | Track command and affected files. |
| Missing regression test | Testing. | Engineering/product owner. | Before related release or when test harness supports it. | Manual evidence and follow-up issue. |
| Live provider manual test skipped | Provider compatibility. | Engineering/product owner. | Before provider-specific claim/release note. | Fake provider tests still required. |
| Dependency with known risk | Dependency management/security. | Product/engineering owner. | Next dependency review or vulnerability update. | Pin, monitor, replacement plan. |
| State migration risk accepted | Migration/release. | Product owner and engineering owner. | Before public release. | Release notes, backup guidance, rollback/roll-forward plan. |

The following exceptions cannot be casual: raw token persistence, hidden telemetry, unsafe writes outside root, AI confirming decisions silently, validation requiring live AI, and package artifacts containing secrets. These require release-risk acceptance or a scope change.

## Ownership and Maintenance

| Standards Area | Owner | Maintenance Rule |
| --- | --- | --- |
| Architecture boundaries | Engineering owner. | Review after major module or stack changes. |
| Profile contracts | Product/profile owner + engineering. | Review with profile/schema changes. |
| Security/privacy | Product/security owner + engineering. | Review for provider, logging, token, path, export, dependency changes. |
| Testing gates | Engineering owner. | Review when scripts, CI, or release gates change. |
| Deployment/release | Maintainer/product owner. | Review before package releases and automation changes. |
| Documentation standards | Product/engineering. | Review when docs drift or phase contracts change. |
| Dependency policy | Engineering/maintainer. | Review during dependency additions/upgrades and release prep. |

Standards should evolve through documentation updates and PR/review practice, not silent convention. Deprecated standards need replacement guidance and cleanup tracking. New contributors should be onboarded through README, PR template, docs, and failing/passing quality gates rather than private tribal knowledge.

Standards drift signals:

- repeated review comments on the same issue;
- docs contradicting implementation;
- tests passing while release checklist fails;
- generated root reverting to `docs/`;
- provider/token rules handled inconsistently;
- exceptions without expiry;
- CI scripts diverging from documented gates.

## Standards Risks

| Risk | Affected Standard | Risk Type | Source | Likelihood | Impact | Early Signal | Mitigation | Owner | Downstream Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Standards become too broad to apply. | All standards. | Over-bureaucracy. | Large documentation surface. | Medium. | Medium. | PRs ignore standards. | Keep rules tied to enforcement and risk. | Engineering/product. | Slower delivery, weaker trust. |
| Critical rules remain review-only. | Security, root safety, AI confirmation. | Under-enforcement. | Missing automation. | Medium. | High. | Same bug class recurs. | Add tests/scanners/CI gates. | Engineering. | Release risk. |
| `pnpm check` is mistaken for full release gate. | Testing/deployment. | Tool drift. | Script excludes `typecheck` and `smoke:cli`. | Medium. | Medium/high. | Release checklist differs from CI. | Document and automate complete release gate. | Engineering/release. | Broken package or type regression. |
| CI design is documented but not implemented. | Automation. | Process gap. | No workflow currently checked in. | High. | Medium. | Manual gates vary. | Add CI workflow before broader release. | Engineering. | Release Management. |
| Root terminology drifts back to `docs/`. | Repository/output standards. | Product regression. | Legacy assumptions. | Medium. | High. | Generated output path examples use `docs/`. | Root tests and review checklist. | Product/engineering. | Support confusion, unsafe overwrites. |
| Provider abstraction erodes. | AI boundaries. | Architecture erosion. | Convenience imports/provider SDK use. | Medium. | High. | Provider-specific logic appears in domain/application. | Adapter boundary review and tests. | Engineering. | Integration/security risk. |
| Secret handling relies on manual inspection. | Security/privacy. | Enforcement gap. | No dedicated secret scan command yet. | Medium. | Critical. | Token-like strings in fixtures/logs. | Add scanner/test assertions. | Engineering/security. | Incident Response. |
| Standards lag implementation. | Documentation. | Drift. | Fast iteration. | Medium. | Medium. | New behavior missing in docs. | Docs update rule and review checklist. | Product/engineering. | Maintenance/support ambiguity. |
| Exceptions become permanent. | Exception process. | Governance risk. | Founder-led speed. | Medium. | Medium. | Old TODOs and waivers remain. | Expiry/review trigger required. | Maintainer. | Risk Management. |

## Downstream Handoff

Operating Model must inherit:

- LOGOS is local-first, package-distributed, and user-operated in a target repository.
- Operational expectations are local reports, deterministic checks, and user-provided redacted evidence, not hosted dashboards.
- Standards enforcement is partly automated and partly review-based until CI and scanners mature.

Maintenance Plan must inherit:

- dependency, Node, pnpm, TypeScript, Zod, YAML, Ink/React, Biome, markdownlint, and Vitest changes require focused review;
- standards drift should be tracked as maintenance work;
- deprecated patterns need cleanup plans.

Release Management must inherit:

- release gates include `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli`, package inspection, no-secret/no-telemetry review, profile validation, and manual acceptance;
- `pnpm check` alone is not the complete release gate today;
- release notes must call out migrations, provider behavior, root behavior, dependency risk, and known exceptions.

Support Model must inherit:

- support requests should ask for redacted status, validation, diagnostics, generation reports, Node/pnpm versions, package version, and provider mode;
- support must not request raw tokens, full prompts, full provider responses, or broad repository dumps;
- root confusion between `.logos/`, `logos/`, and legacy `docs/` should be expected and handled clearly.

Risk Management must inherit:

- release-blocking standards risks: token leak, hidden telemetry, unsafe writes, AI confirmation bypass, root regression, state migration corruption, invalid profiles, broken package binary;
- accepted MVP risks: no complete CI workflow yet, no dedicated secret scanner yet, no formal accessibility certification, no hosted monitoring, and limited live provider coverage.

Unresolved standards questions to carry forward:

- exact CI platform and required matrix;
- dedicated secret/dependency scanning tools;
- CODEOWNERS or high-risk area ownership automation;
- final debug logging mechanism and env var name;
- OS credential-store support policy;
- generated HTML accessibility test harness;
- exact ADR/decision-record format for engineering changes.
