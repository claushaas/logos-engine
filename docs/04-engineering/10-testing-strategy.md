# Testing Strategy

## Testing Objective

Testing for LOGOS Engine must prove that the product can safely turn local, structured project state into canonical documentation and derived outputs without losing user agency, leaking secrets, requiring hidden network access, or corrupting state.

The MVP quality bar is evidence-based:

- `logos` opens the TUI and routes slash commands predictably.
- Workspace initialization is idempotent and preserves existing state.
- Profile YAML contracts validate and remain the source of truth for document structure.
- Local structured state is schema-valid after every state-changing operation.
- AI provider behavior is tested through deterministic fakes/fixtures by default.
- No default test requires live AI, network access, or raw provider tokens.
- AI proposals cannot become confirmed decisions without explicit user action.
- Deterministic validation remains separate from AI judgment.
- Canonical Markdown, derived HTML artifacts, and agent packs are generated under the configured root, defaulting to `logos/`.
- Write, overwrite, root-change, remote-provider, and destructive actions are confirmation-gated.
- Failures preserve state and produce an actionable recovery path.

Testing does not guarantee external market validation, legal compliance, accessibility certification, penetration-test coverage, provider-side privacy behavior, or cloud reliability. Those claims require separate evidence and review.

## Test Taxonomy

| Category | Purpose | Scope | Automation Level | Tools | Execution Trigger | Owner | Evidence Required | Release Impact | Downstream Documents | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Static quality checks | Catch formatting, lint, type, and build regressions. | TypeScript, Markdown, repo config. | Automated. | `pnpm lint:biome`, `pnpm lint:md`, `pnpm build`, `pnpm typecheck`. | Local/PR/release. | Engineering. | Passing command output. | Release-blocking for unaccepted failures. | Deployment, Release. | MVP |
| Unit tests | Verify focused logic close to source. | Domain rules, validation, providers, prompt/context builders, render helpers. | Automated. | Vitest. | Local/PR. | Engineering. | Passing suite. | Merge/release-blocking for critical logic. | Test Strategy. | MVP |
| Integration tests | Verify meaningful module boundaries. | Workspace/filesystem, profile loading, command handlers, generation, provider adapters with fakes. | Automated. | Vitest, temp dirs, fixtures. | Local/PR/release. | Engineering. | Passing suite and fixture evidence. | Release-blocking for critical boundaries. | Infrastructure, API, Integration. | MVP |
| Workflow/E2E tests | Prove critical user journeys through application flow. | Init, continue/intake, review, generate, validate, diagnose, provider failure. | Automated where feasible; manual review for TUI polish. | Vitest hardening/workflow tests, `pnpm smoke:cli`. | PR/pre-release. | Engineering/product owner. | Passing workflow tests and smoke output. | Release-blocking for primary journey breakage. | Frontend, Release. | MVP |
| Contract tests | Prevent schema and API contract drift. | Profile schemas, state records, provider results, command result envelopes, output records. | Automated. | Zod/schema validation, fixture tests, snapshots. | PR/release. | Engineering. | Passing compatibility tests. | Release-blocking for breaking contract drift. | API, Data, Release. | MVP |
| Security/privacy tests | Verify controls around tokens, paths, remote calls, logs, telemetry, and consent. | Secrets, provider config, path safety, no telemetry, no live network defaults. | Automated plus review. | Vitest, secret-scan style assertions, code review. | PR/release. | Engineering/product owner. | Test results and review checklist. | Release-blocking for token/privacy failures. | Security, Operations. | MVP |
| Accessibility and UX state checks | Verify critical text labels, keyboard-first behavior, focus/state communication. | TUI screens and generated HTML artifacts. | Mixed: automated snapshots where possible, manual review required. | Vitest/render tests, manual terminal/browser review. | Pre-release. | Product/engineering. | Review notes and test evidence. | Release-blocking for critical state communication; certification not claimed. | Frontend. | Review-needed |
| Performance smoke tests | Catch obvious startup/status/generation regressions. | TUI startup, status, validation, generation, provider timeout handling. | Automated/provisional. | Future benchmarks, timing assertions where stable. | Pre-release/nightly if added. | Engineering. | Timing report. | Blocks only if thresholds are defined and missed. | Observability, Release. | Review-needed |
| Manual acceptance review | Verify product criteria that need human judgment. | Founder/user journeys, generated doc usefulness, caveat visibility, disclosure copy. | Manual. | Acceptance checklist. | Pre-release. | Founder/product owner. | Signed checklist or notes. | Release-blocking for must-have acceptance failures. | Release Management. | MVP |

Tests are not substitutes for product sign-off. Automated tests prove behavior; manual acceptance verifies the product still communicates risk, state, and next actions clearly.

## Coverage Matrix

| Source Document | Source Item | Behavior or Risk | Test Types | Required Evidence | Release Impact | Owner | Status | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Acceptance Criteria | Gate 1 / NFR-OPS-002 | Default quality gate passes without live AI or network. | Static, unit, integration, workflow. | `pnpm check` plus smoke where release scope requires. | Release-blocking. | Engineering. | MVP. | `pnpm check` currently omits `smoke:cli`; release gate should include it explicitly. |
| Acceptance Criteria | Gate 2 / NFR-SEC-001 | No raw token storage in `.logos/`, `logos/`, fixtures, logs, or generated outputs. | Security/privacy, fixtures, snapshots. | Redaction/secret tests and inspection. | Release-blocking. | Engineering. | MVP. | Dedicated repo-wide secret scan command review-needed. |
| Acceptance Criteria | Gate 3 / NFR-PRIV-001 | No telemetry or hidden network calls by default. | Privacy, static review, optional network inspection. | Code review plus no-live-provider tests. | Release-blocking. | Engineering/product. | MVP/review-needed. | Automated network egress guard not yet specified. |
| Functional Requirements | FR-003, FR-007, FR-014 | Workspace state persists and resumes across sessions. | Integration, workflow, state tests. | Temp workspace fixtures and continuation tests. | Release-blocking. | Engineering. | MVP. | Migration coverage must grow with schema changes. |
| Functional Requirements | FR-008, FR-043 | AI-derived decisions remain proposed until user review. | Domain, contract, workflow, security. | Decision transition tests and provider fixture tests. | Release-blocking. | Engineering. | MVP. | None known. |
| Functional Requirements | FR-009, FR-010, FR-011, FR-027 | Markdown, HTML artifacts, and agent packs are generated and classified correctly. | Renderer, golden, integration. | Generated output fixtures/snapshots. | Release-blocking for canonical Markdown; degrade gracefully for early derived renderers if accepted. | Engineering. | MVP/review-needed. | Exact HTML renderer coverage depends on renderer implementation. |
| Functional Requirements | FR-018, FR-035 | Remote provider transmission requires explicit disclosure. | Provider config, command, workflow. | Fake remote-provider tests. | Release-blocking. | Engineering. | MVP. | Context preview UX needs frontend test once finalized. |
| Functional Requirements | FR-022, FR-023, FR-031 | Writes, overwrites, root changes, and manual edits require safe handling. | Filesystem integration, workflow, security. | Collision/path/manual-edit fixtures. | Release-blocking. | Engineering. | MVP/review-needed. | Manual Markdown merge policy unresolved. |
| NFRs | NFR-REL-001 through NFR-REL-006 | Provider failure, decision immutability, idempotent init, safe writes, partial failure, no-AI validation. | Reliability, domain, integration. | Failure fixtures and hardening suite. | Release-blocking. | Engineering. | MVP. | Add more interrupted-write and migration fixtures as implementation grows. |
| NFRs | NFR-AVA-001, NFR-AVA-002 | Offline/no-provider operation. | Workflow, provider fake, static review. | Tests pass with no live provider/network. | Release-blocking. | Engineering. | MVP. | Network egress assertion review-needed. |
| Security/Privacy | Threats T-001 through T-011 | Token leaks, hidden remote calls, unsafe paths, malformed provider output, sensitive logging. | Security/privacy, contract, integration. | Redaction, path, provider, logging tests. | Release-blocking for critical controls. | Engineering. | MVP. | Support export tests deferred until support export exists. |
| Sync and State | Local state, source-of-truth, stale outputs, no remote sync. | State integrity and no false sync expectations. | State, generation, docs/static review. | State fixtures and root/stale tests. | Release-blocking for state corruption/root regression. | Engineering. | MVP. | Concurrent TUI/workspace locking review-needed. |

Coverage is risk-weighted, not coverage-percentage driven. A high coverage number does not compensate for missing tests around state corruption, token leakage, silent confirmation, unsafe writes, or hidden remote calls.

## Test Pyramid

The intended distribution is:

| Level | Role | Expected Weight | Rationale |
| --- | --- | --- | --- |
| Unit/domain/contract tests | Fast proof of rules, schemas, transitions, render helpers, and provider normalization. | Highest. | LOGOS has many deterministic contracts and invariants that should fail close to source. |
| Integration tests | Proof that workspace, filesystem, profile, command, validation, provider-fake, and generation boundaries work together. | High. | The product risk sits at boundaries: state writes, rendering, provider adaptation, and path safety. |
| Workflow/E2E tests | Proof that the primary journey works end to end. | Small but critical. | They protect user trust but should not carry all logic coverage. |
| Manual/review tests | Product communication, acceptance, accessibility assumptions, and generated-document usefulness. | Targeted. | Some quality requires human judgment and should be documented honestly. |
| Specialized checks | Security, privacy, performance, compatibility, release gates. | Risk-triggered. | These do not fit neatly into the pyramid but protect release-critical claims. |

Exceptions are justified for TUI behavior, generated documentation quality, accessibility review, and security/privacy posture because they require either full workflow evidence or human inspection.

## Unit Tests

In LOGOS, a unit is usually a pure function, state transition, schema parser, validation rule, provider result normalizer, renderer helper, or service method with dependencies supplied as fakes.

Unit tests must cover:

- decision status transitions and invalid transitions;
- profile/document schema validation;
- provider config parsing and redaction;
- provider response normalization and invalid output rejection;
- prompt/context builder minimization and versioning;
- validation rule evaluation;
- source-of-truth and stale-output logic;
- path normalization helpers where separable from filesystem integration;
- frontmatter/template rendering helpers;
- error code mapping and recovery result shaping.

Unit tests may mock external providers, clocks, filesystem adapters, and command dependencies. They should not mock the actual rule being tested, Zod schema behavior, or domain transition logic. Over-mocking that makes invalid state look valid is prohibited.

## Integration Tests

Integration tests verify boundaries that are meaningful for this local-first architecture:

| Boundary | What To Test | Dependency Strategy | Release Impact |
| --- | --- | --- | --- |
| Command router to application services | Slash commands map to stable operations and errors. | Real command registry with fake workspace/provider dependencies. | Release-blocking for core commands. |
| Workspace service to filesystem | `.logos/` state creation, reads, safe writes, corrupt state behavior. | Temp directories and fixture files. | Release-blocking. |
| Profile loader to YAML contracts | Bundled/custom profile loading, invalid YAML/schema failures, document schema compatibility. | Real profile fixtures. | Release-blocking. |
| Provider adapter to AI contracts | Success, timeout, auth failure, malformed output, rate-limit mapping. | Fake/mock providers by default; optional live provider tests outside default suite. | Release-blocking for fake contract behavior. |
| Validation service to state/profile | Rule evaluation, affected documents, no-provider operation. | Real validation fixtures. | Release-blocking. |
| Generation service to renderer/filesystem | Markdown generation, derived output classification, collision/partial failure reporting. | Temp roots and golden fixtures. | Release-blocking for canonical generation and safety. |
| Diagnostics/status to state | State health, next actions, stale/missing output reporting. | Real fixture state. | Release-blocking for recovery/status flows. |

External service tests must use mocks, fakes, or explicit optional integration commands. Default CI must not call live providers.

## End-to-End Tests

The E2E/workflow suite should stay small and high-signal.

| Workflow | Scope | Environment / Fixtures | Evidence | Release Impact |
| --- | --- | --- | --- | --- |
| First run to initialized workspace | `logos`/TUI shell, `/init`, state creation, status. | Temp repository. | Smoke/workflow pass. | Release-blocking. |
| Conversation-first intake | `/continue`, provider fake, answer persistence, proposed decisions. | Fixture provider and workspace. | Workflow test. | Release-blocking for AI-led MVP. |
| Proposal review | confirm/revise/reject/defer without silent AI confirmation. | Decision fixtures. | Workflow/domain pass. | Release-blocking. |
| Generate outputs | Generate canonical Markdown and derived outputs under `logos/` or custom root. | Complete fixture state/profile. | Output report and golden files. | Release-blocking for canonical docs. |
| Validate/diagnose recovery | Run validation and diagnostics with no provider or failing provider. | Invalid/incomplete state fixtures. | Findings and recovery output. | Release-blocking for core recovery. |
| Provider failure path | Timeout/auth/malformed output preserves input/state. | Fake provider failures. | Hardening test. | Release-blocking. |

Browser/device E2E is not applicable to the TUI MVP except for generated HTML artifact review, which belongs to Frontend Architecture once the renderer is finalized.

## Contract Tests

Contract tests protect the shape of internal APIs and generated outputs.

Required contract coverage:

- profile YAML schema and `document.schema.yml`;
- phase/document contracts and output definitions;
- workspace state files and schema versions;
- command request/result envelopes and error codes;
- provider request/response normalization;
- decision/proposal statuses;
- validation findings and generation reports;
- output kinds: canonical Markdown, derived HTML artifact, derived agent pack;
- root path behavior defaulting to `logos/`;
- redacted provider config and token source references.

Mocks and fakes must be validated against the same contract surface they replace. If a provider fake can return a shape that no real adapter would produce, the fake is a liability and must be corrected or explicitly scoped.

## Domain Tests

Domain tests must directly verify product invariants:

- confirmed decisions require explicit user action;
- AI output remains proposed/advisory until reviewed;
- assumptions remain caveated;
- unknown answers create valid open-question/incomplete state;
- rejected/deferred proposals do not silently reappear without changed context;
- decision revisions preserve history rather than overwriting truth;
- state-changing commands return structured results with recovery guidance;
- generated outputs become stale when source state changes;
- validation and diagnostics remain separate from AI judgment.

Domain tests should be table-driven where state transitions have clear matrices. Property-like tests are useful for path normalization, idempotent init behavior, and repeated generation no-op behavior once implementation stabilizes.

## Data Model Tests

Data model tests must protect the filesystem-backed state model.

| Data Area | Required Tests | Release Impact |
| --- | --- | --- |
| Workspace records | valid read/write, missing state, corrupt JSON, unsupported schema version. | Release-blocking. |
| Profile lock | active profile id/version/source, invalid profile, profile compatibility. | Release-blocking. |
| Decisions and revisions | schema validity, status enums, revision history, source refs. | Release-blocking. |
| Sessions and turns | persistence, source traceability, provider failure preservation, retention/pruning behavior when defined. | Release-blocking for persistence; pruning review-needed. |
| Validation/generation reports | run status, partial failure, stale/missing outputs, affected object refs. | Release-blocking. |
| Output records | path containment, kind classification, source refs/checksum/mtime behavior. | Release-blocking. |
| Provider config | redacted metadata only; unsafe raw token storage rejected. | Release-blocking. |
| Migrations | old schema fixtures, failed migration, migration record evidence. | Release-blocking once migrations exist. |

There is no database, so tests must compensate for the absence of database constraints by validating referential integrity, schema compatibility, and safe filesystem writes.

## Sync Tests

LOGOS has no remote sync engine in MVP, so sync tests are state-safety tests rather than cloud replication tests.

Required MVP sync/state tests:

- local hydration from valid and invalid state;
- repeated `/init` does not corrupt existing state;
- local operations work offline/no-provider;
- output stale/missing/manual-edit states are detected where metadata exists;
- generation retry preserves successful outputs and reports failed outputs;
- provider retry/failure does not replay duplicate confirmed decisions;
- schema/checkpoint/source refs prefer conservative stale/unknown over false freshness;
- root changes mark prior output status uncertain/stale;
- no remote sync, background sync, queue, worker, webhook, or telemetry path is introduced accidentally.

Deferred tests: mutation queues, cursors, server checkpoints, multi-client divergence, cross-device conflict resolution, background sync, and remote invalidation. These become release-blocking only if the corresponding features are added.

## Frontend Tests

For the TUI MVP, frontend tests mean terminal interaction and state presentation tests.

Coverage should include:

- shell renders without initialized workspace;
- command suggestions/help are available;
- orientation shows repository, root, profile, and provider status;
- states are labeled textually: proposed, confirmed, assumed, unknown, incomplete, blocked, stale, canonical, derived, partial, failed, missing, recovery-needed;
- loading/pending/error/success/partial states are distinct;
- confirmation prompts show affected root/files/provider implications;
- compact terminal behavior preserves critical text;
- generated HTML artifacts render without hidden telemetry or external scripts once implemented.

Detailed component and visual strategy belongs in Frontend Architecture. This document requires that frontend tests cover states, not only happy-path rendering.

## Accessibility Tests

Accessibility validation is partly automated and partly review-based.

Required checks:

- keyboard-first command access and predictable focus behavior;
- critical state is communicated in text, not color alone;
- loading and pending states have text equivalents;
- errors describe what failed, what state was preserved, and next action;
- compact terminal output keeps root, risk, and confirmation text visible;
- generated HTML artifacts use semantic structure and preserve caveat labels;
- reduced-motion and screen-reader assumptions are not claimed without evidence.

Automated checks cannot prove terminal accessibility. Manual review is required before any accessibility claim beyond keyboard-first/text-label basics.

## Security Tests

Security tests map directly to the Security and Privacy threat model.

| Control | Test Evidence | Release Impact |
| --- | --- | --- |
| Raw tokens never persist | Fixtures/snapshots inspect config, state, logs, generated docs, HTML, agent packs. | Release-blocking. |
| Remote provider consent | Fake remote provider cannot receive context before disclosure/acceptance. | Release-blocking. |
| Path containment | Traversal, absolute path, root escape, collision tests. | Release-blocking. |
| AI cannot confirm decisions | Provider output cannot create confirmed decision directly. | Release-blocking. |
| Invalid provider output rejected | Malformed/hostile provider fixtures. | Release-blocking. |
| No telemetry by default | Static review and optional network guard. | Release-blocking. |
| Generated HTML safety | Escaping/no external scripts/no telemetry. | Release-blocking for HTML artifact renderer. |
| Dependency risk | Dependency scan/review before release. | High/critical findings block unless accepted. |

Authentication and tenant authorization tests are not applicable in MVP because there are no accounts, sessions, admin roles, or hosted tenants.

## Privacy Tests

Privacy tests must prove concrete handling rules:

- no raw provider tokens in project files, fixtures, logs, or outputs;
- no hidden telemetry, analytics, crash reporting, or behavioral tracking;
- remote provider context requires explicit configuration and disclosure;
- prompt/context builder excludes arbitrary source code, Git history, and unrelated files by default;
- generated agent packs contain bounded context and no live credentials;
- support/debug artifacts, if added, require explicit export and redaction;
- deletion/export claims remain local/user-managed unless separately implemented.

Legal compliance tests are not in scope for MVP. Any GDPR/CCPA/SOC2-style claim requires legal and operational review, not just automated tests.

## Performance Tests

Performance thresholds are provisional until measured on representative developer machines.

Initial performance smoke coverage should focus on:

- TUI startup and `/status` responsiveness;
- profile load and state hydration with hundreds of decisions/assumptions/questions;
- deterministic `/validate`;
- full Standard profile generation;
- provider timeout handling with the documented 60s default and configurable upper bound;
- generated HTML/agent pack rendering once implemented.

Performance tests should avoid false precision. Until benchmarks exist, performance regressions should be treated as review-needed unless they make core flows unusable or violate an explicit NFR threshold.

## Reliability and Recovery Tests

Reliability tests must include failure, not only success.

Required cases:

- provider timeout/auth failure/rate limit/malformed output preserves input and prior state;
- generation can partially fail and report created/updated/skipped/failed outputs;
- corrupt state blocks unsafe mutation and shows recovery guidance;
- repeated init is safe and idempotent;
- unsafe path/root/write attempts are denied;
- failed validation/diagnostics do not corrupt state;
- manual edit/collision prevents silent overwrite;
- migration failure enters recovery instead of silently repairing destructively;
- no-provider mode still supports local status/validation/generation where state is valid.

Backup/restore is user-managed in MVP, so tests verify that LOGOS reports local recovery states honestly rather than claiming managed restore.

## Observability Tests

Observability tests verify local diagnostic usefulness without telemetry.

Required checks:

- command results include status, affected object/file, error code, and next safe action;
- generation reports include root, output kind, created/updated/skipped/blocked/failed/stale/missing categories;
- validation findings include rule id, severity, affected object, and actionable message;
- provider errors are redacted and mapped to stable internal codes;
- decision transitions and root/provider config changes are traceable;
- logs/reports never include raw tokens, auth headers, full prompts, raw provider payloads, or unrelated files.

Metrics, traces, dashboards, alerts, and post-deploy monitoring are not MVP runtime features because there is no hosted service or telemetry platform. If introduced, observability tests must expand accordingly.

## Regression Strategy

Every product-critical bug should produce a regression test before closure when feasible.

Regression tests are required for defects involving:

- state corruption or data loss;
- silent AI confirmation;
- token persistence or privacy leak;
- hidden remote/network call;
- unsafe path/write/overwrite behavior;
- root default regression from `logos/`;
- malformed provider output mutating state;
- generated output misclassification;
- validation depending on AI;
- command routing breakage;
- migration failure.

Regression workflow:

1. Reproduce with the smallest fixture or workflow.
2. Add a failing test at the closest useful layer.
3. Fix the bug.
4. Run the focused suite and the relevant gate.
5. Keep the fixture if it protects a real contract.

## Fixtures and Test Data

| Fixture | Purpose | Data Category | Source | Sensitivity Class | Generation Method | Reset Rule | Versioning Rule | Owner | Downstream Implications |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Minimal workspace | Init/status tests. | Synthetic state. | Test factory. | Low. | Generated temp dir. | Delete after test. | Update with state schema. | Engineering. | Infrastructure. |
| Complete Standard profile workspace | Generation/validation workflow. | Synthetic project clarity data. | Hand-authored fixture. | Low/synthetic. | Versioned JSON/YAML/Markdown. | Immutable per test. | Update with profile schema. | Engineering/product. | Release. |
| Incomplete/ambiguous workspace | Diagnostics/open question behavior. | Synthetic project context. | Hand-authored fixture. | Low/synthetic. | Versioned fixture. | Immutable. | Update with validation rules. | Engineering. | Support. |
| Corrupt/old state fixtures | Recovery/migration tests. | Synthetic broken state. | Hand-authored fixtures. | Low. | Versioned files. | Immutable. | One fixture per schema issue. | Engineering. | Release. |
| Provider success/failure responses | AI contract and workflow tests. | Synthetic provider output. | Fake provider fixtures. | Low; no real prompts/tokens. | Hand-authored JSON/objects. | Immutable. | Version with provider contract. | Engineering. | Integration. |
| Generated output goldens | Renderer regression tests. | Synthetic generated docs. | Test renderer outputs reviewed into fixtures. | Low/project-like. | Golden files/snapshots. | Update only intentionally. | Tie to profile/doc schema. | Engineering/product. | Frontend/Release. |
| Path/collision fixtures | File safety tests. | Synthetic files. | Temp dirs. | Low. | Generated per test. | Delete after test. | N/A. | Engineering. | Security. |

Forbidden fixture data: real provider tokens, real user private project data, unredacted provider payloads, unrelated repository source code, full Git history, and production-like sensitive data.

## Mocking Strategy

| Mock or Fake | Replaces | Used By | Fidelity Level | Contract Source | Failure Modes Covered | Sync Rule | Drift Risk | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fake AI provider | Live remote/local providers. | Provider, intake, diagnostics, workflow tests. | Contract-faithful enough for normalized results. | Provider port/API contracts. | Timeout, auth failure, unavailable, invalid output, malformed schema, rate limit. | No remote sync; request/response only. | Medium. | Engineering. | MVP |
| Temp filesystem workspace | Real user repository. | Workspace, generation, path tests. | High for local files. | Data/Sync architecture. | Permission denied where simulated, collision, missing/corrupt files. | Local-only. | Low/medium. | Engineering. | MVP |
| Fake clock/request ids | Time/id dependencies. | State, generation, idempotency tests. | High for deterministic behavior. | State/API contracts. | Ordering/retry reproducibility. | Local checkpoints only. | Low. | Engineering. | Recommended |
| Profile fixtures | Bundled/custom profile variants. | Profile loader, validation, generation. | High for schema behavior. | Profile YAML/document schema. | Invalid YAML, missing docs, incompatible profile. | Local-only. | Low. | Engineering. | MVP |
| Renderer goldens/snapshots | Human comparison for generated text. | Renderer/regression tests. | Medium/high. | Profile contracts and expected output. | Template/frontmatter/output kind drift. | Derived outputs only. | Medium. | Engineering/product. | MVP |

Do not mock domain invariants, schema validation, decision transition rules, root containment logic, or redaction behavior in tests whose purpose is to verify those controls.

## CI Requirements

| Gate | Trigger | Required Suites | Time Budget | Pass Criteria | Failure Consequence | Exception Rule | Evidence Stored | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local fast check | Before committing meaningful code. | Focused Vitest, relevant lint/typecheck where practical. | Minutes. | Changed area passes. | Fix before handoff or report blocker. | Explicitly document skipped checks. | Terminal output. | Engineer. | MVP |
| PR/default check | Every PR/merge candidate. | `pnpm lint:biome`, `pnpm lint:md`, `pnpm test`, `pnpm build`; `pnpm typecheck` if kept separate. | Fast enough for routine PRs. | All pass. | Block merge unless accepted as non-task/pre-existing risk. | Product/engineering owner approval. | CI logs. | Engineering. | MVP |
| Release quality gate | Pre-release. | `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli`, release-blocking workflow/security/privacy tests, manual acceptance checklist. | Release window. | All release blockers pass or are formally accepted. | Block release. | Product owner signs accepted risk. | Release evidence bundle. | Product/engineering. | MVP |
| Optional live provider check | Manual/pre-release only. | Provider connectivity against sandbox/user-owned tokens. | Bounded by provider timeout. | Does not mutate state; redacted output. | Does not block local-only release unless provider feature is release scope. | Never default; requires explicit credentials. | Redacted notes only. | Engineering/product. | Optional |
| Nightly/deep check | Future. | Coverage, performance smoke, broader compatibility. | Longer. | Trends reviewed. | Investigate; not immediate release blocker unless critical. | N/A. | Reports. | Engineering. | Deferred |

Current repo scripts include `pnpm check`, `pnpm test`, `pnpm test:coverage`, `pnpm lint:biome`, `pnpm lint:md`, `pnpm build`, `pnpm typecheck`, and `pnpm smoke:cli`. Release Management should decide whether `smoke:cli` becomes part of `pnpm check` or remains a separate release gate.

## Release Gates

Release gates map to Acceptance Criteria:

| Gate | Evidence | Failure Consequence | Exception Rule |
| --- | --- | --- | --- |
| Default suite passes | `pnpm check` and required supplemental gates pass without live AI/network. | Block release. | Only accepted by product/engineering owner with written risk. |
| No raw token storage | Secret/redaction tests and inspection of state/outputs/fixtures. | Block release. | No silent exception. |
| No default telemetry | Static review and network/no-live-provider evidence. | Block release. | No silent exception. |
| AI output never silent-confirms | Decision/provider workflow tests. | Block release. | No exception for MVP. |
| Root behavior correct | Tests prove default `logos/` and configurable root; no hard-coded `docs/` default. | Block release. | No exception unless product contract changes. |
| Safe writes/overwrites | Collision/path/manual-edit tests. | Block release. | Accepted risk only for clearly deferred feature, not unsafe overwrite. |
| Provider failure recovery | Timeout/auth/invalid output tests preserve state. | Block release if corruption occurs. | No exception for corruption. |
| Validation independent from AI | No-provider validation tests. | Block release. | No exception. |
| Generated outputs classified | Markdown/HTML/agent packs distinguish canonical vs derived. | Block or degrade gracefully depending feature scope. | Product owner accepts derived-output deferral if documented. |
| Manual acceptance | Founder/product owner reviews primary journey and generated docs. | Block release for must-have journey failure. | Accepted risk recorded. |

After any release-blocking fix, rerun the failing focused suite and the release gate it belongs to.

## Flaky Test Policy

Flaky tests are product risk, not background noise.

| Test or Suite | Signal | Detection Method | Quarantine Rule | Owner | Time To Fix | Release Impact | Prevention Action | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Critical state/security/provider tests | Intermittent pass/fail. | CI rerun/local reproduction. | Quarantine only with replacement coverage or explicit release risk. | Engineering. | Immediate/next work block. | Blocks release if coverage is critical. | Remove timing/network dependence, use fake clocks/providers. | MVP |
| Renderer goldens | Snapshot churn. | Diff review. | Do not auto-update without product review. | Engineering/product. | Before merge if output contract changed. | Can block release. | Smaller focused goldens and intentional update notes. | MVP |
| TUI workflow tests | Timing/render instability. | Repeated failures. | Quarantine with manual acceptance checklist if necessary. | Engineering. | Before release. | Blocks release for primary journey. | Stable harness and deterministic state. | Review-needed |
| Optional live provider checks | Provider/network variability. | Manual run failure. | Keep outside default CI. | Engineering/product. | Before provider-specific release claim. | Does not block local-only release. | Use fakes for default; document provider issue. | Optional |

No failing critical suite should be normalized as "red but expected."

## Test Ownership

| Area | Owner | Maintenance Responsibility | Accepted-Risk Authority |
| --- | --- | --- | --- |
| Domain/state/API/provider tests | Engineering. | Keep tests aligned with contracts and schemas. | Engineering owner for technical risk; product owner for scope risk. |
| Renderer/generation goldens | Engineering + product owner. | Approve intentional output changes. | Product owner for generated-doc quality risk. |
| Security/privacy tests | Engineering + product owner. | Maintain redaction, consent, no-telemetry, and secret fixtures. | No silent exception for critical failures. |
| Frontend/accessibility checks | Engineering + product owner. | Verify state communication and terminal usability. | Product owner accepts accessibility limitations if documented. |
| CI/release gates | Engineering. | Keep scripts reliable and evidence available. | Product/engineering owner. |
| Manual acceptance checklist | Founder/product owner. | Review primary journey and release readiness. | Founder/product owner. |
| Fixtures/mocks/fakes | Engineering. | Version with contracts; prevent drift. | Engineering owner. |

Every release-blocking suite needs an owner before release.

## Testing Risks

| Risk | Affected Area | Risk Type | Source | Likelihood | Impact | Early Signal | Mitigation | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mock providers hide real provider drift. | AI integration. | False confidence. | Provider API changes. | Medium. | High. | Live users report provider failures despite passing tests. | Contract-focused fakes, optional manual provider checks, adapter release notes. | Integration, Release. | Blocks provider-specific claims. |
| No network egress guard misses hidden calls. | Privacy/offline. | Blind spot. | Future dependency or telemetry code. | Medium. | High. | Unexpected outbound traffic in manual review. | Add automated egress test or static rule. | Security, CI. | Release-blocking once detected. |
| Manual Markdown merge behavior under-tested. | Generation/state. | Data loss. | User edits generated docs. | High. | High. | Overwrite confusion or stale docs. | Collision/manual-edit tests; define merge policy. | Frontend, Support. | Must warn before MVP release. |
| Accessibility claims exceed evidence. | TUI/HTML artifacts. | Compliance/trust. | Automated-only checks. | Medium. | Medium/high. | User accessibility issue reports. | Phrase claims narrowly; add manual review. | Frontend, Release. | Blocks unsupported claims. |
| `pnpm check` omits smoke/typecheck expectations. | CI/release. | Gate ambiguity. | Script drift. | Medium. | Medium. | Release checklist differs from CI. | Define release gate explicitly; consider script update. | Deployment, Release. | Review-needed. |
| Fixture drift from profile/schema contracts. | Contracts/generation. | False confidence. | Profile changes. | Medium. | High. | Tests pass with obsolete fixtures. | Profile contract snapshots and fixture versioning. | Release. | Release-blocking for profile changes. |
| Concurrent process/state locking untested. | State integrity. | Hard-to-test gap. | Unsupported multi-client behavior. | Unknown. | High. | State corruption from two TUI sessions. | Document unsupported; add lock tests if support is added. | Infrastructure. | Accepted risk until feature support changes. |
| Performance thresholds remain provisional. | Performance. | Unknown readiness. | Lack of benchmark evidence. | Medium. | Medium. | Slow generation/status in user trials. | Add smoke benchmarks before public release. | Observability, Release. | Review-needed. |

## Downstream Handoff

Frontend Architecture must inherit:

- state-label testing requirements for TUI screens;
- confirmation and recovery flow coverage;
- accessibility checks that distinguish automated evidence from manual review;
- HTML artifact rendering tests once renderer implementation is finalized.

Infrastructure Architecture must inherit:

- temp workspace and safe-write test harness requirements;
- path containment, root default, collision, interrupted-write, and migration fixtures;
- future workspace locking tests if concurrent TUI support is added.

Observability Plan must inherit:

- local diagnostic evidence requirements;
- redacted provider/error/report tests;
- no telemetry by default;
- future signal tests only if metrics/traces/alerts are introduced.

Deployment Plan and Release Management must inherit:

- `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli`, security/privacy gates, and manual acceptance as release evidence;
- explicit exception/accepted-risk process;
- retest requirements after release-blocking fixes.

Support Model, Incident Response, Risk Management, and Operations must inherit:

- regression-test requirements for state corruption, token leaks, hidden remote calls, unsafe writes, provider failures, and migration failures;
- local redacted support evidence only;
- no assumption of hosted logs, operator access, telemetry dashboards, or cloud restore;
- testing risks that remain review-needed before broader public release.
