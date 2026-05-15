# Technical Risks

## Risk Objective

This register identifies technical risks that could make LOGOS Engine unsafe, unstable, unmaintainable, unreleasable, expensive to operate, or unable to preserve its local-first product promise.

It protects:

- feasibility of a TUI-first local Node.js product;
- safety of local structured state and generated files;
- privacy and security of provider context and credentials;
- reliability of AI-assisted but user-reviewed decision workflows;
- maintainability of profile contracts, schemas, and renderers;
- release readiness through deterministic tests, packaging, and smoke checks;
- operations handoff for support, incident response, maintenance, and release management.

This document covers engineering and technical delivery risks. It does not replace business, GTM, legal, market, or operational risk management. When a risk becomes an operational procedure, support burden, release process, or incident-response concern, this document preserves the engineering context and hands it downstream.

## Risk Taxonomy

| Dimension | Values | Meaning |
| --- | --- | --- |
| Category | architecture, stack, domain, data, API, integration, security/privacy, sync/state, testing, observability, deployment, performance, vendor/dependency, maintenance, operational-readiness | Primary risk area. |
| Status | open, monitoring, mitigated, accepted, transferred, deferred, escalated, retired, review-needed | Current risk state. |
| Likelihood | low, medium, high, unknown | Probability based on current evidence; unknown does not mean low. |
| Impact | low, medium, high, critical | Worst credible technical/product impact. |
| Confidence | low, medium, high | How much evidence supports the likelihood/impact judgment. |
| Release Impact | release-blocking, release-warning, feature-blocking, accepted-risk, monitor, post-MVP, not-applicable | How the risk affects release readiness. |
| Escalation Class | product, engineering, security/privacy, release, operations | Who must decide or accept the risk. |

Release impact semantics:

- **release-blocking:** must be fixed or formally accepted before MVP release.
- **release-warning:** release can proceed only with documented mitigation and monitoring.
- **feature-blocking:** blocks the affected feature, not necessarily the whole product.
- **accepted-risk:** explicitly accepted by the sign-off authority with residual risk and revisit trigger.
- **monitor:** tracked but not blocking while signals remain within expectation.
- **post-MVP:** outside MVP scope, but must not be implied as solved.

## Risk Scoring Model

| Dimension | Scale | Definition | Priority Effect |
| --- | --- | --- | --- |
| Likelihood | low / medium / high / unknown | Chance that the risk occurs under expected MVP use. | High or unknown likelihood raises review priority. |
| Impact | low / medium / high / critical | Consequence if the risk materializes. | Critical impact can block release even with low likelihood. |
| Confidence | low / medium / high | Evidence quality behind scoring. | Low confidence increases need for spike or review. |
| Detectability | easy / moderate / hard | How quickly the team/user can detect the issue. | Hard-to-detect risks need tests, reports, or gates. |
| Reversibility | easy / moderate / hard / irreversible | How safely the issue can be undone. | Hard/irreversible risks need pre-release mitigation. |
| Blast Radius | local file / workspace / package users / ecosystem | How far damage spreads. | Package/user-data impact raises severity. |
| Security/Privacy Impact | none / low / high / critical | Credential, sensitive data, consent, telemetry, or third-party exposure. | High/critical impact is release-blocking unless formally accepted. |
| Operational Impact | none / low / medium / high | Support, incident, rollback, maintenance burden. | High operational impact requires downstream handoff. |

A risk is release-blocking when it can cause token leakage, hidden remote transmission, unsafe writes, silent AI confirmation, state corruption, invalid bundled profiles, broken package install/start, or loss of deterministic no-provider operation.

## Risk Register

| ID | Title | Category | Source Document | Cause | Affected Systems | Likelihood | Impact | Confidence | Detection Signals | Mitigation | Contingency | Owner | Status | Release Impact | Downstream Target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TR-001 | AI output becomes canonical truth without user confirmation. | security/privacy, domain, data | Foundation Boundaries; API Contracts; Testing Strategy | Provider fluency or implementation shortcuts bypass proposal/review states. | Intake, decision service, generation, TUI. | medium | critical | high | Confirmed decisions appear without review event; tests allow provider to set confirmed state. | Proposal-only schemas, decision transition tests, review UI labels. | Block release; patch transition path; audit affected state. | Engineering/product | open | release-blocking | Incident Response, Release Management |
| TR-002 | Raw provider token leaks into files, logs, fixtures, package, or generated outputs. | security/privacy | Security and Privacy; Deployment; Standards | Unsafe config/logging/test fixture/package handling. | Provider config, logs, `.logos/`, `logos/`, artifacts, package. | medium | critical | high | Token-like strings in state/output/package; redaction tests fail. | Token source refs only, redaction tests, package inspection, future secret scanner. | Rotate token, deprecate bad package, publish hotfix. | Engineering/security | open | release-blocking | Incident Response |
| TR-003 | Remote provider receives project context without explicit disclosure. | privacy, integration | Security and Privacy; Integration Architecture; Acceptance Criteria | Hidden provider call, unclear provider mode, or missing permission gate. | Intake, diagnostics, provider adapters. | medium | critical | high | Network call before disclosure; provider fake receives context in no-consent test. | Remote disclosure gate, provider mode status, fake remote-provider tests. | Disable provider path; patch gate; notify if released. | Product/engineering | open | release-blocking | Incident Response, Support |
| TR-004 | Generated root regresses from `logos/` to legacy `docs/`. | data, deployment, maintenance | Foundation Boundaries; Data Model; Standards | Old documentation assumptions or hard-coded paths. | Generation, status, root config, support docs. | medium | high | high | Generated files appear under `docs/`; examples use `docs/` as default root. | Root tests, review checklist, status displays active root. | Hotfix root handling; migration/support note. | Product/engineering | open | release-blocking | Support, Release Management |
| TR-005 | Unsafe path handling writes outside configured root or overwrites user work silently. | data, security/privacy | Security and Privacy; Sync and State; Deployment | Path traversal, absolute path misuse, symlink edge case, or weak overwrite confirmation. | Filesystem adapter, generation, root config. | medium | critical | high | Path traversal test fails; generation report misses overwritten file. | Path containment tests, safe writes, overwrite confirmation, generation reports. | Stop generation; restore from Git/backup; patch filesystem guard. | Engineering/security | open | release-blocking | Incident Response, Support |
| TR-006 | Local `.logos` state corruption blocks or corrupts continuation/generation. | data, sync/state | Data Model; Sync and State | Interrupted writes, schema drift, migration bug, invalid manual edits. | Workspace state, decisions, sessions, validation, generation. | medium | critical | high | State read failure; invalid schema after mutation; migration fixture fails. | Zod reads, safe writes, migration records, corrupt-state tests. | Enter recovery mode; block mutation; restore from backup or roll forward. | Engineering | open | release-blocking | Support, Release Management |
| TR-007 | Provider adapter drift breaks AI workflow despite deterministic fakes. | integration, testing, vendor/dependency | Integration Architecture; Testing Strategy | Real provider API changes or fake contracts diverge from adapter behavior. | Provider adapters, intake, diagnostics. | medium | high | medium | Live provider failures; malformed response rate rises; fake passes while support reports fail. | Contract fakes, optional live sandbox checks, provider error mapping. | Degrade to no-provider mode; hotfix adapter. | Engineering/integration | monitoring | release-warning | Support, Release Management |
| TR-008 | Deterministic validation accidentally depends on AI or network. | testing, architecture | Testing Strategy; System Architecture | Convenience reuse of AI diagnostics or provider calls. | Validation engine, diagnostics, release gates. | low/medium | critical | high | Validation tests require provider; network call during `/validate`. | No-provider tests, module boundary review, validation/diagnostics separation. | Remove provider dependency; block release. | Engineering | open | release-blocking | Release Management |
| TR-009 | `pnpm check` is mistaken for complete release gate. | testing, deployment | Testing Strategy; Deployment; Standards | Current script omits `typecheck` and `smoke:cli`. | Release process, CI, package validation. | high | medium/high | high | Release checklist differs from `pnpm check`; type/smoke regression escapes. | Document explicit release gate: `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli`. | Rerun complete gate; update script/CI. | Engineering/release | open | release-warning/block if unresolved | Release Management |
| TR-010 | CI/CD automation is documented but not implemented. | deployment, testing, maintenance | Deployment; Standards | No checked-in GitHub Actions workflow yet. | PR checks, release evidence, contributor workflow. | high | medium | high | Manual gate variance; no CI status on PRs. | Add CI workflow before broader release; keep manual evidence meanwhile. | Manual release checklist with command output. | Engineering | accepted/monitoring | accepted-risk | Release Management |
| TR-011 | Generated docs feel generic and lose decision traceability. | domain, data, product quality | Old Risk Register; Product Architecture; Testing Strategy | Renderer or AI drafting ignores decisions, assumptions, risks, and validation gaps. | Markdown renderer, HTML artifacts, agent packs. | medium | high | medium | Docs read like generic LLM prose; source refs/caveats missing. | Render from structured state/profile contracts; golden tests; manual acceptance. | Mark docs incomplete/degraded; revise renderer/templates. | Product/engineering | open | release-warning | GTM, Support |
| TR-012 | Profile complexity causes inconsistent contracts or broken generation. | stack, domain, testing | Old Risk Register; Profile docs; Technical Stack | Many YAML files, output types, completion criteria, and profile-level schemas drift. | Profile loader, validation, generation, tests. | medium | high | high | Profile snapshot tests fail; phase docs disagree with YAML. | Profile schema tests, profile root contract, docs-first review. | Block profile release; hotfix profile package. | Product/profile owner | open | release-blocking for Standard profile | Maintenance, Release |
| TR-013 | HTML artifacts introduce XSS, external scripts, accessibility, or stale-output risk. | security/privacy, frontend, data | Security and Privacy; Testing Strategy | HTML renderer implementation is provisional. | HTML renderer, generated artifacts, browser review. | medium | high | medium | Generated HTML contains unescaped content/external scripts; accessibility review fails. | Escape content, no telemetry/external scripts, semantic HTML tests. | Disable/defer HTML artifact generation; rely on Markdown. | Engineering/frontend | review-needed | feature-blocking/release-warning | Frontend, Support |
| TR-014 | Agent packs leak sensitive context or are treated as authoritative. | privacy, integration, data | Security and Privacy; Integration Architecture | Packs package downstream context for external agents and may omit caveats. | Agent pack renderer, downstream usage. | medium | high | medium | Pack includes credentials/unrelated content; downstream agent ignores caveat labels. | Bounded context, derived labels, no secrets, golden tests. | Regenerate/patch packs; advise users to delete stale pack. | Product/engineering | open | release-warning | Support, Risk Management |
| TR-015 | No hosted observability makes incidents hard to diagnose. | observability, operational-readiness | Observability; Deployment | Local-first design excludes dashboards, telemetry, alerts. | Support, incident response, release monitoring. | high | medium | high | User reports lack enough evidence; issue diagnosis depends on screenshots. | Local status/validation/diagnostics/generation reports, redaction rules. | Ask for redacted reports; add support export later if justified. | Product/engineering | accepted | accepted-risk | Support, Incident Response |
| TR-016 | Debug logging or support artifacts leak sensitive data. | observability, security/privacy | Observability; Security and Privacy | Future debug/export path may log prompts, state, or token metadata unsafely. | Logs, support exports, error reports. | medium | critical | medium | Log snapshots include prompt/raw token/full state; user shares unsafe support data. | Debug disabled by default, redaction tests before shipping, explicit export preview. | Disable debug/export; rotate token if exposed. | Engineering/security | review-needed | release-blocking if shipped | Incident Response |
| TR-017 | Node/terminal/OS compatibility is narrower than expected. | stack, performance, deployment | Technical Stack; Deployment | Ink terminal behavior, Node >=22, WSL limitations, filesystem path differences. | TUI, CLI, filesystem, package install. | medium | medium/high | medium | Install/start failures on supported OS; terminal layout breaks compact screens. | Node engine range, smoke tests on macOS/Linux/WSL target, manual terminal review. | Adjust support matrix; patch CLI/TUI. | Engineering | monitoring | release-warning | Support, Release |
| TR-018 | Dependency or package supply-chain compromise affects local repositories. | vendor/dependency, security/privacy | Security and Privacy; Technical Stack; Deployment | npm dependencies execute locally with repository access. | Runtime dependencies, package publish, install. | low/medium | critical | medium | Vulnerability alert, suspicious package update, lockfile anomaly. | Minimal dependencies, lockfile review, dependency scan/review, package inspection. | Deprecate release, rotate maintainer tokens, publish patched version. | Maintainer/security | open | release-blocking for known criticals | Incident Response |
| TR-019 | Performance assumptions remain unmeasured. | performance, testing | NFRs; Observability; Testing Strategy | Local state size, profile count, generation workload, provider timeout behavior are not benchmarked yet. | Startup, `/status`, validation, generation, provider calls. | medium | medium | low/medium | Status/generation feels slow; provider timeouts trap user. | Add smoke timings/benchmarks for representative workspaces. | Narrow supported workspace size; optimize state reads/rendering. | Engineering | review-needed | release-warning | Maintenance |
| TR-020 | Overengineering slows the MVP before value is proven. | architecture, maintenance | Old Risk Register; Validation Report | Building hosted/collaboration/marketplace/pluggable complexity too early. | Architecture, roadmap, dependencies, operations. | medium | high | high | New services/features bypass local MVP scope; docs expand faster than product. | Keep MVP local-first, package-based, Standard profile-first; defer hosted/platform work. | Cut scope; remove unused abstractions. | Product/engineering | monitoring | release-warning | GTM, Risk Management |
| TR-021 | Documentation and standards drift from implementation. | maintenance | Engineering Standards; Acceptance Criteria | Rapid docs-first work without automated consistency checks. | Docs, profiles, tests, release gates. | medium | medium/high | high | Docs claim behavior tests/code do not support; repeated review corrections. | Docs update rule, markdownlint, contract tests, review checklist. | Mark doc as stale and correct before release. | Product/engineering | open | release-warning | Maintenance |
| TR-022 | Manual edit conflict policy for generated Markdown remains unresolved. | data, sync/state, UX | Data Model; Sync and State | Generated Markdown may be user-edited, but merge/overwrite policy is review-needed. | Markdown renderer, generation reports, status. | medium | high | medium | Regeneration overwrites edits or blocks users without clear recovery. | Checksum/mtime metadata, overwrite confirmation, manual-edit warnings. | Skip file, restore from Git, or require explicit overwrite. | Engineering/product | review-needed | release-blocking if overwrite unsafe | Support |
| TR-023 | Accessibility claims exceed evidence. | frontend, testing, operational-readiness | Acceptance Criteria; Testing Strategy | TUI screen reader behavior and generated HTML accessibility are not fully validated. | TUI, HTML artifacts, docs. | medium | medium/high | high | State communicated by color only; compact terminal hides risk/root text. | Keyboard-first tests, text labels, manual accessibility review, no certification claim. | Accept risk with explicit scope; fix critical labels. | Product/engineering | accepted/monitoring | accepted-risk pending validation | Support, GTM |
| TR-024 | Local backup/restore responsibility is misunderstood. | operational-readiness, data | Deployment; Sync and State | No hosted backup, recovery environment, or operator restore in MVP. | User state, generated files, support. | medium | high | high | Users expect LOGOS to recover deleted/corrupt local files. | Clear docs, recovery mode, Git/OS backup guidance, migration tests. | User restores from Git/backup; patch recovery guidance. | Product/support | accepted | accepted-risk | Support, Risk Management |
| TR-025 | Executive Axis exports are mistaken for live execution state. | architecture, integration, data, operational-readiness | Executive Axis Specification; Product Architecture; Integration Architecture | Executive JSON and exports resemble task-management artifacts and may be treated as a task database or bidirectional sync. | Executive compiler, Executive JSON, GitHub/Linear/Notion exports, Markdown snapshots, agent packs. | medium | high | medium | Users ask why LOGOS task status is stale; exports omit source metadata; Linear/Notion mappings imply live sync. | Derived/export labels, source refs, readiness gates, unsupported-target reporting, no live sync API, export tests. | Disable affected export adapter; clarify docs; regenerate from normative baseline. | Product/engineering | open | feature-blocking/release-warning | Support, Operations |

## Architecture Risks

| Risk ID | Architecture Concern | Failure Mode | Required Response |
| --- | --- | --- | --- |
| TR-001 | AI/domain boundary. | Provider output directly mutates confirmed truth. | Proposal-only contracts, domain transition tests, review UI. |
| TR-005 | Filesystem boundary. | UI/generation writes outside safe root. | File system port, path tests, overwrite permissions. |
| TR-008 | Validation boundary. | Validation imports AI/provider behavior. | Dependency review and no-provider validation tests. |
| TR-020 | Architectural style. | Local modular monolith expands into hosted/platform complexity before validation. | Scope governance and ADR for any hosted/service boundary. |

Hard-to-reverse decisions are state schema design, provider abstraction shape, generated output authority, and package distribution. Changes to these areas require tests, migration notes, and release review.

## Stack Risks

| Risk ID | Stack Area | Risk | Mitigation |
| --- | --- | --- | --- |
| TR-017 | Node.js >=22, Ink, terminal runtime. | User environment compatibility may be narrower than claimed. | Engine range, smoke tests, terminal review, support matrix honesty. |
| TR-018 | npm dependencies and package distribution. | Supply-chain compromise or dependency vulnerability affects local runtime. | Minimal dependencies, lockfile review, dependency scans, package inspection. |
| TR-013 | HTML renderer unresolved. | Renderer introduces security/accessibility drift. | Escape tests, no external scripts, renderer spike. |
| TR-009 | Current scripts. | `pnpm check` omits typecheck/smoke expectations. | Explicit release gate until script/CI is updated. |

## Domain Risks

| Risk ID | Domain Concern | Failure Mode | Mitigation |
| --- | --- | --- | --- |
| TR-001 | Proposed vs confirmed decisions. | Decision state semantics collapse. | Stable statuses, user-action transition tests, generated labels. |
| TR-011 | Decision traceability. | Generated docs hide assumptions, risks, and open questions. | Render from structured state and profile rules. |
| TR-012 | Profile/document language. | Profile contracts drift or become too complex. | Schema validation, profile snapshots, root schema contract. |
| TR-020 | Scope/domain boundary. | LOGOS becomes project management, hosted workflow, or generic AI generator. | Foundation boundary review and scope governance. |

## Data Risks

| Risk ID | Data Area | Risk | Detection | Mitigation |
| --- | --- | --- | --- | --- |
| TR-004 | Documentation root config. | Outputs go to legacy `docs/` or wrong root. | Root tests, status display, review. | Default `logos/`, configurable root, docs review. |
| TR-005 | Output writes. | Data loss through unsafe overwrite/path traversal. | Path/collision tests, generation report. | Safe writes, confirmation, partial report. |
| TR-006 | Structured state. | Corrupt `.logos` state blocks continuation or causes bad generation. | State schema tests, corrupt fixtures. | Safe writes, recovery mode, migrations. |
| TR-022 | Manual Markdown edits. | Regeneration loses user edits or leaves stale docs. | Checksum/mtime mismatch, status. | Manual-edit warnings and overwrite confirmation. |

## API Risks

MVP has no public network API, so API risks are internal contract risks.

| Risk ID | API Concern | Failure Mode | Mitigation |
| --- | --- | --- | --- |
| TR-001 | Decision/review contract. | AI/provider payload sets confirmed status. | Request/response schemas and decision service transition rules. |
| TR-006 | State repository contract. | Unsupported schema mutates instead of entering recovery. | Schema versioning and mutation blocking. |
| TR-007 | Provider adapter contract. | Real provider errors do not map to stable internal errors. | Error mapping tests and fake/live provider review. |
| TR-014 | Agent pack contract. | Pack consumers treat derived context as canonical. | Derived labels, source refs, review prompt wording. |
| TR-025 | Executive export contract. | Export files become perceived live task state. | Snapshot labels, source refs, no sync API, unsupported-target reports. |

## Integration Risks

| Risk ID | Integration | Risk | Fallback |
| --- | --- | --- | --- |
| TR-003 | Remote AI providers. | Undisclosed context leaves local machine. | Block call until disclosure; no-provider mode. |
| TR-007 | AI provider APIs. | Provider outage, API drift, rate limits, malformed output. | Retry/reconfigure/no-provider; adapter hotfix. |
| TR-018 | npm/GitHub distribution. | Package/dependency/release channel compromise or outage. | Pin prior version, source install, deprecate/hotfix. |
| TR-014 | Downstream agents. | Sensitive or stale context is reused outside LOGOS. | Regenerate packs, caveats, no credentials. |
| TR-025 | External execution tools. | Users expect LOGOS to own status after import. | Document external tools own live execution; exports are regenerable snapshots. |

## Security and Privacy Risks

Release-blocking security/privacy risks:

- TR-002: raw token leakage.
- TR-003: undisclosed remote provider transmission.
- TR-005: unsafe file writes.
- TR-008: AI-dependent deterministic validation.
- TR-016: unsafe debug/support export if shipped.
- TR-018: known critical dependency/package compromise.

Security/privacy accepted risks must include founder/product approval, residual risk, mitigation, and revisit trigger. They cannot be hidden under "deferred" status.

## Sync and State Risks

LOGOS has no remote sync in MVP, so the primary state risks are local source-of-truth ambiguity, state corruption, stale outputs, and manual edit conflicts.

| Risk ID | State Failure | Required Signal |
| --- | --- | --- |
| TR-006 | State cannot be parsed or migrated. | Recovery-needed status, state error code, migration record. |
| TR-011 | Generated docs do not reflect structured decisions. | Validation/generation report, source refs, manual acceptance. |
| TR-022 | Manual edit conflict is undetected. | Output checksum/mtime or stale/manual-edit marker. |
| TR-024 | User expects cloud restore. | Support docs and setup/recovery guidance. |

## Testing Risks

| Risk ID | Testing Gap | Required Gate or Evidence |
| --- | --- | --- |
| TR-007 | Fakes diverge from real provider behavior. | Contract fakes plus optional live/sandbox provider review for provider claims. |
| TR-009 | Incomplete release gate. | Run `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli` explicitly. |
| TR-010 | No checked-in CI workflow. | Manual evidence now; CI workflow before broader release. |
| TR-013 | HTML artifact safety not fully covered. | Escaping/no-external-script/semantic HTML tests before relying on HTML artifacts. |
| TR-019 | Performance assumptions unmeasured. | Timing smoke/benchmark spike. |
| TR-023 | Accessibility evidence incomplete. | Manual terminal and HTML review; no certification claim. |
| TR-025 | Executive schema/export coverage incomplete. | Executive JSON schema fixtures, golden exports, unsupported-target tests, readiness-gate tests. |

## Observability Risks

| Risk ID | Observability Gap | Impact | Mitigation |
| --- | --- | --- | --- |
| TR-015 | No hosted dashboards/logs/alerts. | Incidents depend on user-provided local evidence. | Local status, validation, diagnostics, generation reports. |
| TR-016 | Debug/support data leaks sensitive context. | Privacy/security incident. | Opt-in redacted logs only; support export spike. |
| TR-006 | State corruption lacks actionable evidence. | Support cannot guide recovery. | Error codes, migration records, recovery-needed state. |
| TR-007 | Provider failure classification is too coarse. | Users cannot recover/reconfigure. | Provider error categories and redacted status. |

## Deployment Risks

| Risk ID | Deployment Failure | Release Consequence | Recovery |
| --- | --- | --- | --- |
| TR-009 | Release gate incomplete. | Release warning; blocks if unexplained. | Run missing gates; update CI/script. |
| TR-010 | No CI workflow. | Accepted MVP risk for now; broader release blocker. | Add GitHub Actions or equivalent. |
| TR-018 | Package artifact/dependency compromise. | Release blocker or incident. | Deprecate/hotfix; dependency audit. |
| TR-006 | Migration corrupts state after package update. | Release blocker when migrations exist. | Roll forward, restore backup, migration notes. |
| TR-017 | Package runs only on narrow environments. | Release warning/support risk. | Support matrix and smoke tests. |

## Performance and Scalability Risks

Performance risks are mostly unmeasured assumptions today.

| Risk ID | Performance Concern | Current Evidence | Required Measurement |
| --- | --- | --- | --- |
| TR-019 | Startup/status/generation on larger workspaces. | Provisional NFR targets and local-first design. | Benchmarks with representative profile/state/output sizes. |
| TR-007 | Provider timeout/retry behavior. | 60s default target and provider fakes. | Timeout tests and optional live provider measurements. |
| TR-013 | HTML artifact rendering size. | Renderer implementation provisional. | Render smoke with realistic document sets. |
| TR-017 | Terminal rendering in compact/varied terminals. | UX/UI docs and manual assumptions. | Manual TUI viewport checks and automated render tests where feasible. |

There is no multi-user or hosted scalability risk in MVP because those features are out of scope. GTM and Operations must not imply hosted scale, collaboration scale, or SLA-backed performance.

## Vendor and Dependency Risks

| Risk ID | Vendor / Dependency | Risk | Exit or Replacement Trigger |
| --- | --- | --- | --- |
| TR-007 | OpenAI/Anthropic/OpenRouter/local model providers. | API drift, pricing, outage, policy changes, malformed output. | Adapter failures, unacceptable privacy/cost, provider deprecation. |
| TR-018 | npm package ecosystem. | Supply-chain or registry risk. | Critical vulnerability, maintainer compromise, registry availability issue. |
| TR-017 | Ink/React terminal stack. | Terminal compatibility/accessibility limitations. | Unresolvable TUI accessibility or rendering defects. |
| TR-012 | YAML/profile tooling. | Parser/schema drift affects contracts. | Persistent profile compatibility failures. |

Vendor guarantees must not be assumed. Provider privacy, retention, availability, pricing, and quality claims require separate review.

## Maintenance Risks

| Risk ID | Maintenance Risk | Mitigation |
| --- | --- | --- |
| TR-012 | Profile system becomes difficult to maintain. | Profile schemas, examples, snapshot tests, profile owner review. |
| TR-020 | Architecture accumulates abstractions before value is proven. | MVP scope control and removal of unused abstractions. |
| TR-021 | Docs and standards drift from code. | Docs-as-contract review, markdownlint, contract tests. |
| TR-010 | Manual release/review process varies. | CI workflow, release checklist, PR template. |
| TR-018 | Dependency debt or abandoned packages. | Dependency review cadence and replacement triggers. |

## Operational Readiness Risks

| Risk ID | Readiness Gap | Downstream Owner | Required Handoff |
| --- | --- | --- | --- |
| TR-015 | No hosted observability or operator view. | Support/Incident Response. | Redacted local evidence requirements and support triage flow. |
| TR-024 | No managed backup/restore. | Support/Risk Management. | User backup guidance and restore limitations. |
| TR-010 | No CI workflow yet. | Release Management. | Manual gate evidence until automation exists. |
| TR-016 | Support export/debug logging undefined. | Support/Incident Response. | Export/redaction spike before shipping support bundles. |
| TR-023 | Accessibility evidence incomplete. | Support/GTM. | Do not overclaim; track manual review outcomes. |

## Required Technical Spikes

| ID | Unknown | Risk Reduced | Hypothesis | Scope | Timebox | Success Criteria | Decision Criteria | Output Artifact | Owner | Downstream Decision | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SP-001 | HTML artifact renderer safety and accessibility. | TR-013 | A constrained renderer can produce local, semantic, escaped HTML without telemetry/external scripts. | Render representative docs and run browser/manual accessibility checks. | 1-2 days | Escaping/no-script tests pass; manual review acceptable. | Ship, defer, or reduce HTML artifact scope. | Spike report + tests. | Engineering/frontend | Frontend/Test/Release | required |
| SP-002 | Manual edit detection policy. | TR-022 | Checksum/mtime/source refs can prevent silent overwrite without complex merge. | Prototype generated-file metadata and stale/manual-edit report. | 1-2 days | Manual edit is detected and regeneration is safe. | Confirm overwrite-only vs future merge policy. | Spike report + fixture tests. | Engineering/product | Data/UX/Support | required |
| SP-003 | Secret scanning and package inspection. | TR-002, TR-018 | A lightweight release check can catch token-like strings and bad package contents. | Evaluate script/tool against source, fixtures, generated examples, package dry-run. | 1 day | Low false positives and release-ready command. | Add gate or document manual inspection. | Script or release checklist update. | Engineering/security | Release/Incident | required before public release |
| SP-004 | CI workflow and release matrix. | TR-010, TR-017 | A minimal GitHub Actions workflow can run deterministic gates on at least Linux and optionally macOS. | Install pnpm/Node, run lint/test/build/typecheck/smoke. | 1 day | PR check proves core gates. | Adopt workflow and decide matrix. | CI workflow PR. | Engineering | Release Management | required before broader release |
| SP-005 | Performance smoke baseline. | TR-019 | Startup/status/generation can be measured on representative fixtures. | Create fixture workspace and timing script or test. | 1 day | Baseline timings and threshold proposal. | Define provisional performance gate or accepted risk. | Benchmark notes/tests. | Engineering | Observability/Release | review-needed |
| SP-006 | Support export/redaction model. | TR-015, TR-016 | Users can share useful local evidence without secrets or broad project dumps. | Design redacted status/diagnostic/export payload. | 1-2 days | Redaction rules and sample output pass review. | Ship support export, defer, or keep manual guidance. | Support export spec. | Product/engineering | Support/Incident | post-MVP or pre-public-support |

## Risk Mitigation Plan

| Risk ID | Mitigation | Type | Owner | Evidence Required | Linked Test or Gate | Linked Document | Residual Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TR-001 | Enforce proposal-only AI contracts and decision transition tests. | test/gate | Engineering | Passing provider/decision workflow tests. | Domain/provider tests. | API Contracts, Testing Strategy | User can still accept poor advice. | open |
| TR-002 | Add secret scanning/package inspection and redaction tests. | automate/test | Engineering/security | Scanner or inspection checklist; redaction fixtures. | Security tests/release gate. | Security, Deployment | User shell history outside scope. | open |
| TR-003 | Require remote disclosure before provider context transmission. | gate/test | Product/engineering | Fake remote-provider cannot receive context before consent. | Provider workflow tests. | Security, Integration | User-chosen provider policy remains external. | open |
| TR-004 | Maintain root tests and docs review for `logos/`. | test/document | Product/engineering | Root fixtures and docs grep/review. | Generation/root tests. | Data, Standards | Custom roots may still confuse users. | open |
| TR-006 | Use safe writes, schema validation, and migration fixtures. | reduce/test | Engineering | Corrupt-state and old-state tests. | State/migration tests. | Data, Sync/State | Catastrophic local disk loss remains user-managed. | open |
| TR-009 | Treat release gate as `pnpm check` plus `typecheck` plus `smoke:cli`. | gate/document | Engineering/release | Release checklist command output. | Release gate. | Deployment | Manual until CI/script update. | open |
| TR-010 | Add CI workflow before broader release. | automate | Engineering | Checked-in workflow passing. | CI. | Deployment, Standards | CI platform outages remain external. | accepted/monitoring |
| TR-013 | Spike and test HTML renderer. | spike/test | Engineering/frontend | Spike result and renderer tests. | HTML golden/security tests. | Frontend, Testing | Browser differences remain. | required |
| TR-015 | Improve local diagnostic reports and support guidance. | reduce/transfer | Product/engineering | Status/report examples and support model handoff. | Manual support review. | Observability, Support | No hosted operator view. | accepted |
| TR-021 | Keep docs and implementation linked through review and contract tests. | document/test | Product/engineering | Updated docs and tests with behavior changes. | markdownlint/profile tests. | Standards | Manual judgment still needed. | open |

## Accepted Risks

| Risk ID | Rationale | Approver | Residual Risk | Mitigation Still Required | Expiration or Review Trigger | Release Impact | Contingency | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TR-010 | MVP can proceed with manual gate evidence while CI is not yet checked in, but broader/public release should automate gates. | Founder/product owner required. | Manual gate inconsistency. | Manual release checklist with command output. | Before broader public release or external contribution push. | accepted-risk now; release blocker later. | Add CI workflow. | accepted/monitoring |
| TR-015 | Local-first MVP intentionally avoids hosted telemetry and dashboards. | Founder/product owner required. | Slower incident diagnosis. | Local reports, redacted support guidance. | First recurring support/diagnosis failure. | accepted-risk. | Support export spike. | accepted |
| TR-023 | Keyboard-first/text-label accessibility can ship before full screen-reader certification if claims stay limited. | Founder/product owner required. | Some terminal/screen-reader users may struggle. | Manual review and no certification claim. | Before accessibility claim or broader launch. | accepted-risk pending validation. | Fix labels/focus; narrow claims. | accepted/monitoring |
| TR-024 | MVP does not provide managed cloud backup/restore. | Founder/product owner required. | User can lose local files without Git/OS backups. | Recovery docs and state safety tests. | Before hosted/sync claims or support incidents. | accepted-risk. | Restore from Git/backup; patch guidance. | accepted |

## Risk Escalation

| Trigger | Severity | Escalation Target | Response Expectation | Decision Required | Release Consequence | Communication Requirement | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Raw token, hidden telemetry, undisclosed remote call, unsafe root write, or AI confirmation bypass is detected. | critical | Product owner + engineering/security. | Immediate triage and release hold. | Fix, deprecate/hotfix, or explicit accepted risk if unreleased. | Blocks release; incident if shipped. | Security/privacy note if users affected. | active |
| State migration corrupts or makes `.logos` unreadable. | critical | Engineering + product owner. | Preserve evidence; stop mutation path. | Roll forward, restore guidance, or hold release. | Blocks release. | Migration advisory if shipped. | active |
| CI/release gate failure occurs. | high | Engineering/release owner. | Identify failing gate and root cause. | Fix, rerun, or accepted-risk record. | Blocks release unless accepted. | Release checklist note. | active |
| Provider adapter fails live but fakes pass. | high | Engineering/integration. | Compare fake contract with real failure. | Hotfix, provider-specific warning, or disable claim. | Blocks provider-specific release claims. | Provider notes/support guidance. | active |
| Risk remains unknown with high impact and low confidence. | high | Product + engineering. | Timebox spike or accept residual risk. | Spike, defer, or accept. | Blocks if tied to release gate. | Record in risk register. | active |

## Risk Review Cadence

| Review Type | Cadence | Participants | Inputs | Outputs | Escalation Rules | Retirement Rules | Downstream Handoff |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Engineering risk review | At end of each engineering phase and before release candidate. | Product/engineering. | Current docs, tests, status, risk register. | Updated risk scores/status/actions. | Critical/high open risks escalate. | Retire only with test/review evidence. | Release, Maintenance, Risk Management. |
| Release risk review | Every release candidate. | Founder/product owner, engineering/release. | Release gates, accepted risks, deployment checklist. | Release hold/approve/accept-risk decision. | Any release-blocking risk unresolved. | Retire after release evidence passes. | Release Management. |
| Security/privacy risk review | Any provider/logging/export/token/path change. | Engineering/security/product. | Diff, tests, redaction evidence. | Approval, fix list, or release block. | Token/privacy issues escalate immediately. | Retire after redaction/security evidence. | Incident Response. |
| Dependency risk review | Dependency add/update or release prep. | Engineering/maintainer. | Lockfile diff, advisories, package health. | Approve/update/replace/accept risk. | Critical vulnerability escalates. | Retire after update/removal. | Maintenance Plan. |
| Operational handoff review | Before operations phase docs and public release. | Product/engineering/support/release. | Technical risk register, deployment, observability. | Transferred risks and runbook requirements. | Unsupported recovery/support risk escalates. | Retire only after operations doc owns it. | Support, Incident, Risk Management. |

## Release Impact

Automatic MVP release blockers:

- raw token or secret persistence in project files, fixtures, logs, package, Markdown, HTML, or agent packs;
- hidden telemetry, analytics, crash reporting, or undisclosed network calls;
- remote provider context transmission without explicit disclosure;
- AI output becoming confirmed state without user action;
- generated files writing outside configured root or silently overwriting user work;
- default generated documentation root regressing from `logos/`;
- corrupted/invalid structured state after state-changing operations;
- deterministic validation requiring live AI or network;
- invalid bundled Standard profile/schema;
- broken package binary or missing required package files.

Release warnings or accepted-risk items:

- no checked-in CI workflow yet;
- no dedicated secret scanner yet;
- limited live provider compatibility coverage;
- no hosted observability/support visibility;
- incomplete screen-reader/accessibility evidence;
- performance baselines not yet measured;
- support export/redaction model deferred.

Mitigated risks require retest evidence. Accepted risks require owner approval, residual risk, mitigation, contingency, and revisit trigger.

## Downstream Handoff

| Risk ID | Handoff Target | Context To Preserve | Required Action | Owner | Timing | Acceptance or Escalation Rule | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TR-011 | GTM Brief | Generated docs may feel generic if not grounded in decisions/evidence. | Do not overpromise automated strategy quality; show caveats. | Product/GTM | Before launch messaging. | Escalate if GTM claims validation not present. | open |
| TR-015 | Support Model | No hosted logs/dashboards; support depends on local reports. | Define redacted evidence request flow. | Support/product | Operations phase. | Escalate if support cannot diagnose recurring issues. | accepted/transferred |
| TR-024 | Support Model / Risk Management | No managed backup/restore in MVP. | Document Git/OS backup reliance and recovery limits. | Support/risk | Operations phase. | Escalate before any recovery guarantee. | accepted/transferred |
| TR-010 | Release Management | CI workflow missing; manual gates in use. | Add CI or require manual gate evidence before release. | Release/engineering | Before broader release. | Escalate if release gate cannot be evidenced. | accepted/monitoring |
| TR-002 | Incident Response | Token leak requires rotation, deprecation/hotfix, and advisory. | Define token leak runbook. | Security/incident | Before public release. | Any leak escalates critical. | open |
| TR-005 | Incident Response / Support | Unsafe write could affect user files. | Define restore/support guidance and urgent release response. | Engineering/support | Before release. | Any unsafe write report escalates critical. | open |
| TR-007 | Support / Release Management | Provider failures are expected and must degrade safely. | Provide provider setup/failure guidance and no-provider path. | Support/release | Before provider claims. | Escalate if provider failure corrupts state. | monitoring |
| TR-023 | GTM / Support | Accessibility evidence is limited. | Avoid certification claims; document keyboard-first scope. | Product/support | Before launch copy. | Escalate before any accessibility compliance claim. | accepted/monitoring |

Operations documents must not assume hosted dashboards, cloud restore, central telemetry, multi-user support, SLA-backed uptime, legal compliance, or managed provider privacy. Those require future architecture and operations decisions.
