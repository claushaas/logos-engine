# Non-Functional Requirements

## Objective

This document defines the quality attributes, operating constraints, service expectations, risk thresholds, and verification methods that LOGOS Engine must satisfy beyond its functional behavior. It describes how the product should perform, behave under failure, protect user trust, and remain operable—without prescribing engineering implementation.

The requirements are derived from the Foundation Principles, Project Boundaries, Success Definition, Validation Report, Product Scope, Functional Requirements, and Product Architecture. Because LOGOS Engine is a local-first, repository-oriented TUI without a hosted backend, many traditional non-functional requirements for SaaS products (external SLAs, multi-user concurrency, server-side authentication, operational dashboards) do not apply in the current scope. Where a quality attribute is irrelevant, deferred, or unknown, it is classified explicitly rather than omitted.

All targets are provisional unless backed by evidence or engineering review. False precision is avoided.

---

## NFR Taxonomy

### Quality Attribute Categories

| Category | Definition | Why It Matters for LOGOS |
| --- | --- | --- |
| Performance | Speed, responsiveness, and resource usage perceived by the user. | A slow TUI or unresponsive generation breaks trust during clarification. |
| Accessibility | Support for diverse input modes, assistive technologies, and perceptual needs. | Terminal and HTML surfaces must be usable across environments and abilities. |
| Privacy | Control over data collection, storage, transmission, and user rights. | Local-first identity depends on not surprising the user with hidden data movement. |
| Security | Protection of secrets, state, and user context from unauthorized access or misuse. | Token safety and consent are critical for a product that handles project intent. |
| Reliability | Consistency, integrity, and safe recovery from partial or full failures. | Users must trust that state survives interruptions and AI failures. |
| Availability | Ability to operate and degrade gracefully when dependencies fail. | The product should remain useful even when the AI provider is unavailable. |
| Scalability | Behavior as project size, state volume, or output count grows. | Projects may accumulate many decisions and documents over time. |
| Compatibility | Supported platforms, runtimes, and integration surfaces. | The TUI and generated artifacts must work in common developer environments. |
| Observability | Auditability, debuggability, and operational visibility without surveillance. | Users and support must understand what happened without telemetry. |
| Internationalization | Language, locale, and formatting support. | MVP is English-only, but text handling must not block future expansion. |
| Compliance | Regulatory, legal, and ethical obligations. | The product must not claim compliance it has not reviewed. |
| Operational Constraints | Build, release, maintenance, and support boundaries. | Sustainable development requires clear quality gates and release discipline. |

### Classification Model

| Classification | Meaning | Example |
| --- | --- | --- |
| required | Must be met for MVP release. | Token safety, local-first operation. |
| desired | Important but not release-blocking. | HTML artifact accessibility review. |
| provisional | Target is estimated; requires validation or engineering review. | TUI startup time, document generation latency. |
| unknown | Cannot be specified yet; needs experiment or prototype evidence. | Maximum project size before degradation. |
| deferred | Post-MVP candidate. | Multi-language support, advanced graph visualization. |
| excluded | Outside product identity or current scope. | Hosted SLAs, server-side auth, telemetry dashboards. |

### Verification Methods

| Method | Meaning |
| --- | --- |
| observable test | Verified through direct product interaction or measurement. |
| inspection | Verified by reading code, configuration, or local files. |
| review | Verified by human review of output, behavior, or design. |
| prototype evidence | Requires prototype usage or profiling to validate. |
| engineering review | Requires technical evaluation before commitment. |

### Release Impact Model

| Impact | Meaning |
| --- | --- |
| release-blocking | Violation prevents MVP release. |
| degrade gracefully | Violation reduces quality but does not block release if mitigated. |
| monitor | Violation is tracked but accepted if bounded. |
| defer | Violation is acceptable for MVP; fixed post-validation. |

---

## NFR Register

The register below lists all non-functional requirements. Items marked N/A are explicitly classified as excluded to prevent scope drift.

| ID | Requirement | Category | Classification | Priority | Source | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| NFR-PERF-001 | TUI startup from `logos` command must complete within a provisional 2-second threshold on typical developer hardware. | Performance | provisional | must-have | UX Model, old TUI spec | prototype evidence |
| NFR-PERF-002 | AI provider call timeout defaults to 60 seconds, configurable up to 180 seconds. | Performance | required | must-have | old provider config | inspection |
| NFR-PERF-003 | Status view (`/status`) must load without perceptible delay; no blocking spinner for local state reads. | Performance | provisional | must-have | Interaction Model | observable test |
| NFR-PERF-004 | Generation feedback must begin immediately; bulk rendering must not freeze the TUI without pending indicators. | Performance | required | must-have | UX Model | observable test |
| NFR-PERF-005 | Conversation round size must remain between 3 and 12 questions to control cognitive load and response latency. | Performance | required | must-have | old TUI spec, UX Model | review |
| NFR-ACC-001 | All critical TUI actions must be keyboard-operable; slash commands must work without pointer interaction. | Accessibility | required | must-have | Interaction Model, UI Spec | observable test |
| NFR-ACC-002 | State meaning (proposed, confirmed, assumed, error, stale) must not rely on color alone; text labels are required. | Accessibility | required | must-have | Design System, UI Spec | review |
| NFR-ACC-003 | Focus state must be visible and predictable after commands, errors, confirmations, and generation reports. | Accessibility | required | must-have | Interaction Model | observable test |
| NFR-ACC-004 | Generated HTML artifacts should target WCAG 2.2 AA readability; full compliance is deferred until testing. | Accessibility | desired | should-have | Design System | review |
| NFR-ACC-005 | TUI loading and pending states must include text equivalents; motion must not be the only status indicator. | Accessibility | required | must-have | UX Model, Design System | review |
| NFR-PRIV-001 | The product must not collect usage telemetry, analytics, session tracking, or behavioral profiles by default. | Privacy | required | must-have | Foundation Boundaries, old privacy docs | inspection |
| NFR-PRIV-002 | Project context (answers, decisions, assumptions, file paths) must not be sent to remote providers without explicit configuration and disclosure. | Privacy | required | must-have | Foundation Principles, old privacy docs | inspection |
| NFR-PRIV-003 | The product must store only data required for project clarity: no unrelated source code, Git history, or arbitrary files. | Privacy | required | must-have | Foundation Boundaries, old privacy docs | inspection |
| NFR-PRIV-004 | Raw AI provider tokens must not be stored in project files or tracked by Git. | Privacy | required | must-have | Permission Model, old provider config | inspection |
| NFR-PRIV-005 | Users must be able to inspect what context would be sent to a remote provider before it is transmitted. | Privacy | required | must-have | old privacy docs, Functional Requirements | observable test |
| NFR-PRIV-006 | All project state and generated documents remain local by default; no cloud sync or remote storage without explicit opt-in. | Privacy | required | must-have | Foundation Principles | inspection |
| NFR-SEC-001 | Raw API tokens must be read from environment variables or OS credential stores; never from project configuration files. | Security | required | must-have | old provider config, Permission Model | inspection |
| NFR-SEC-002 | Provider configuration must redact tokens in status displays and logs. | Security | required | must-have | old provider config | inspection |
| NFR-SEC-003 | The product must not ingest arbitrary source code, unrelated files, or Git history as AI context without explicit user inclusion. | Security | required | must-have | Foundation Boundaries | inspection |
| NFR-SEC-004 | Destructive operations (overwrite, root change, remote transmission) require explicit confirmation. | Security | required | must-have | Interaction Model, Permission Model | observable test |
| NFR-SEC-005 | Authentication mechanisms: N/A — no user accounts or sessions in MVP. | Security | excluded | won't-have | Product Scope, Boundaries | review |
| NFR-SEC-006 | Authorization model: N/A — single-user local product. | Security | excluded | won't-have | Product Scope, Boundaries | review |
| NFR-SEC-007 | Encryption at rest for local files: preferred but not release-blocking; relies on OS filesystem encryption. | Security | desired | could-have | Engineering review | engineering review |
| NFR-REL-001 | AI provider failures must not corrupt project state or confirmed decisions. | Reliability | required | must-have | old development standards, Product Architecture | observable test |
| NFR-REL-002 | Confirmed decisions must never be silently overwritten; changes require supersession with affected-document reporting. | Reliability | required | must-have | old decision registry, Functional Requirements | observable test |
| NFR-REL-003 | Workspace initialization (`/init`) must be idempotent; repeated init must not destroy existing state without explicit confirmation. | Reliability | required | must-have | old development standards | observable test |
| NFR-REL-004 | File writes must default to safe mode; destructive overwrites require confirmation. | Reliability | required | must-have | old document rendering, Permission Model | observable test |
| NFR-REL-005 | Partial failures (provider timeout, generation error) must preserve completed state and report what succeeded versus what failed. | Reliability | required | must-have | UX Model, Product Architecture | observable test |
| NFR-REL-006 | Deterministic validation and diagnostics must remain usable when the AI provider is unavailable. | Reliability | required | must-have | Product Architecture | observable test |
| NFR-AVA-001 | The product must operate fully offline when no remote AI provider is configured. | Availability | required | must-have | Foundation Principles, old privacy docs | observable test |
| NFR-AVA-002 | When the AI provider is unavailable, the product must degrade to a no-provider mode with local status review and setup guidance. | Availability | required | must-have | User Journeys, Product Architecture | observable test |
| NFR-AVA-003 | No external uptime SLA is offered; availability is a function of the user's local machine and chosen provider. | Availability | excluded | won't-have | Product Scope | review |
| NFR-AVA-004 | Planned maintenance: N/A — no hosted service. | Availability | excluded | won't-have | Product Scope | review |
| NFR-SCAL-001 | MVP supports single-user local operation; multi-user concurrency is excluded. | Scalability | excluded | won't-have | Product Scope, Boundaries | review |
| NFR-SCAL-002 | The initial Standard profile document tree (~28 documents) must generate without perceptible degradation on typical developer hardware. | Scalability | provisional | must-have | Product Architecture | prototype evidence |
| NFR-SCAL-003 | Structured state must support at least hundreds of decisions, assumptions, and open questions without perceptible TUI slowdown. | Scalability | provisional | should-have | Information Architecture | prototype evidence |
| NFR-SCAL-004 | Request throughput and user concurrency: N/A — local single-user product. | Scalability | excluded | won't-have | Product Scope | review |
| NFR-COMP-001 | The TUI must run on macOS, Linux, and Windows (WSL). | Compatibility | required | must-have | Product Scope, old TUI docs | observable test |
| NFR-COMP-002 | The product requires a Node.js runtime; specific version range is engineering-review-needed. | Compatibility | provisional | must-have | Engineering context | engineering review |
| NFR-COMP-003 | Canonical outputs (Markdown, YAML, JSON) must be diff-friendly and compatible with standard Git workflows. | Compatibility | required | must-have | Foundation Principles, old docs | inspection |
| NFR-COMP-004 | Generated HTML artifacts must render in modern evergreen browsers. | Compatibility | required | should-have | Product Scope | observable test |
| NFR-COMP-005 | Terminal support must include common terminal emulators; exact accessibility limits are engineering-review-needed. | Compatibility | provisional | should-have | UI Spec, Interaction Model | engineering review |
| NFR-OBS-001 | The product must maintain an audit trail of decisions: status changes, confirmations, revisions, and affected documents. | Observability | required | must-have | Product Architecture, old decision registry | inspection |
| NFR-OBS-002 | Generation reports must record created, updated, skipped, incomplete, blocked, and failed outputs. | Observability | required | must-have | Functional Requirements, Product Architecture | inspection |
| NFR-OBS-003 | Local debug logging may be supported for troubleshooting; logs must not contain raw secrets or sensitive project context. | Observability | desired | could-have | old development standards | inspection |
| NFR-OBS-004 | Operational dashboards, metrics, alerting: N/A — no hosted service or telemetry. | Observability | excluded | won't-have | Foundation Boundaries, Product Scope | review |
| NFR-OBS-005 | Telemetry and analytics: N/A — prohibited by default per privacy model. | Observability | excluded | won't-have | Foundation Boundaries | review |
| NFR-I18N-001 | MVP is English-only for all system text, commands, and generated document templates. | Internationalization | required | must-have | Product Scope | review |
| NFR-I18N-002 | User input and generated document content must support UTF-8. | Internationalization | required | must-have | Information Architecture | inspection |
| NFR-I18N-003 | Translation readiness and multi-language support are deferred until profile value is validated. | Internationalization | deferred | won't-have | Product Scope | review |
| NFR-COMPL-001 | The product must not claim compliance with named regulations (GDPR, CCPA, SOC2, etc.) without dedicated legal review. | Compliance | required | must-have | Foundation Boundaries, Validation Report | review |
| NFR-COMPL-002 | Data residency and sovereignty: N/A — all data remains local by default. | Compliance | excluded | won't-have | Product Scope, Foundation Principles | review |
| NFR-COMPL-003 | The user retains full ownership of all project data, decisions, and generated documents. | Compliance | required | must-have | Foundation Principles, Boundaries | review |
| NFR-OPS-001 | Releases follow semantic versioning. | Operational Constraints | required | must-have | old release process | inspection |
| NFR-OPS-002 | Releases require passing tests, build, typecheck, lint, and smoke checks. | Operational Constraints | required | must-have | old development standards | inspection |
| NFR-OPS-003 | Breaking changes require migration notes and profile compatibility review. | Operational Constraints | required | must-have | old release process | review |
| NFR-OPS-004 | No hosting or cloud infrastructure is required for the local MVP product. | Operational Constraints | excluded | won't-have | Product Scope | review |
| NFR-OPS-005 | Support model: minimal for MVP; operational scale is deferred until validation evidence exists. | Operational Constraints | deferred | could-have | Product Scope | review |

---

## Performance

Performance requirements focus on perceived responsiveness and resource usage in a local TUI environment. Exact benchmarks are provisional pending prototype profiling.

### NFR-PERF-001: TUI Startup Time

- **Category:** Performance.
- **Statement:** TUI startup from the `logos` command must complete within a provisional 2-second threshold on typical developer hardware.
- **Target:** < 2 seconds from shell invocation to interactive TUI shell.
- **Minimum Threshold:** < 5 seconds before user abandonment risk becomes significant.
- **Classification:** provisional.
- **Priority:** must-have.
- **Source:** UX Model (Calm Rigor), old TUI product spec.
- **Measurement Method:** Manual timing on representative machines; no automated benchmark suite exists yet.
- **Verification:** prototype evidence.
- **Release Impact:** degrade gracefully — slower startup is annoying but not blocking if functional.
- **Risk if Unmet:** Users may perceive the product as heavy before reaching first value.
- **Affected Journeys:** J-009 Onboarding.
- **Affected Features:** TUI Shell, Workspace Status View.
- **Affected Modules:** TUI Experience, Repository Workspace.
- **Owner or Review Target:** Engineering Brief, Frontend Architecture.
- **Notes:** Exact threshold depends on terminal framework overhead and workspace state size. Engineering review needed.

### NFR-PERF-002: AI Provider Timeout

- **Category:** Performance.
- **Statement:** AI provider call timeout defaults to 60 seconds, configurable up to 180 seconds.
- **Target:** Default 60s; user-configurable to 180s.
- **Minimum Threshold:** Hard timeout must exist to prevent indefinite hangs.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old provider configuration docs.
- **Measurement Method:** Configuration inspection and timeout test.
- **Verification:** inspection.
- **Release Impact:** release-blocking — hangs without timeout break user trust.
- **Risk if Unmet:** Provider failures freeze the TUI; users lose unsaved context.
- **Affected Journeys:** J-001 Primary Clarification, J-004 Provider Configuration.
- **Affected Features:** AI-led intake, provider configuration.
- **Affected Modules:** AI Assistance, TUI Experience.
- **Owner or Review Target:** Engineering Brief, API Contracts.
- **Notes:** Slow models or large context may need the extended timeout.

### NFR-PERF-003: Status View Responsiveness

- **Category:** Performance.
- **Statement:** Status view (`/status`) must load without perceptible delay; no blocking spinner for local state reads.
- **Target:** < 500ms for status display.
- **Minimum Threshold:** < 2 seconds.
- **Classification:** provisional.
- **Priority:** must-have.
- **Source:** Interaction Model, UX Model.
- **Measurement Method:** Manual observation during prototype usage.
- **Verification:** observable test.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Status feels unreliable; users may distrust local state.
- **Affected Journeys:** All journeys.
- **Affected Features:** `/status` command.
- **Affected Modules:** TUI Experience, Structured State.
- **Owner or Review Target:** Engineering Brief.

### NFR-PERF-004: Generation Feedback Latency

- **Category:** Performance.
- **Statement:** Generation feedback must begin immediately; bulk rendering must not freeze the TUI without pending indicators.
- **Target:** Feedback begins within 1 second of confirmation.
- **Minimum Threshold:** User must see pending state before 3 seconds.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** UX Model Feedback Model, Interaction Model.
- **Measurement Method:** Observable during `/generate` execution.
- **Verification:** observable test.
- **Release Impact:** release-blocking — silent generation breaks trust.
- **Risk if Unmet:** Users may think the product crashed or lost their command.
- **Affected Journeys:** J-005 Generate and Review Outputs.
- **Affected Features:** `/generate`, Generation Report View.
- **Affected Modules:** Generation and Outputs, TUI Experience.
- **Owner or Review Target:** Engineering Brief, Frontend Architecture.

### NFR-PERF-005: Conversation Round Sizing

- **Category:** Performance / Cognitive Load.
- **Statement:** Conversation round size must remain between 3 and 12 questions to control cognitive load and response latency.
- **Target:** Ideal 5–8 questions per round; max 12.
- **Minimum Threshold:** Never exceed 12 questions in a single round.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old TUI product spec, UX Model Cognitive Load Rules.
- **Measurement Method:** Review of intake output.
- **Verification:** review.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Users abandon due to question flood or fatigue.
- **Affected Journeys:** J-001 Primary Clarification.
- **Affected Features:** Conversational Intake, AI-led questioning.
- **Affected Modules:** Conversational Intake, AI Assistance.
- **Owner or Review Target:** UX Model, Feature Specification.

---

## Accessibility

Accessibility requirements are targets, not compliance claims, until testing is completed. The product is TUI-first with generated HTML artifacts as secondary surfaces.

### NFR-ACC-001: Keyboard-First Operation

- **Category:** Accessibility.
- **Statement:** All critical TUI actions must be keyboard-operable; slash commands must work without pointer interaction.
- **Target:** 100% of material commands reachable by keyboard.
- **Minimum Threshold:** No critical action requires a mouse or touch.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Interaction Model, UI Specification.
- **Measurement Method:** Keyboard-only navigation test.
- **Verification:** observable test.
- **Release Impact:** release-blocking — terminal users expect keyboard operation.
- **Risk if Unmet:** Product is unusable in terminal-centric workflows.
- **Affected Journeys:** All MVP journeys.
- **Affected Features:** Slash commands, confirmation prompts, proposal review.
- **Affected Modules:** TUI Experience.
- **Owner or Review Target:** UI Specification, Frontend Architecture.

### NFR-ACC-002: Non-Color State Communication

- **Category:** Accessibility.
- **Statement:** State meaning (proposed, confirmed, assumed, error, stale) must not rely on color alone; text labels are required.
- **Target:** Every state has a text label visible in the TUI and HTML artifacts.
- **Minimum Threshold:** Critical states (error, proposed, confirmed) must have text labels.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Design System, UI Specification.
- **Measurement Method:** Review of UI Specification and generated output.
- **Verification:** review.
- **Release Impact:** release-blocking — false authority risk if states are ambiguous.
- **Risk if Unmet:** Users cannot distinguish proposed from confirmed decisions.
- **Affected Journeys:** J-001 Primary Clarification, J-007 Decision Revision.
- **Affected Features:** Proposal Review, Decision Detail, Generation Report.
- **Affected Modules:** TUI Experience, Design System.
- **Owner or Review Target:** Design System, Acceptance Criteria.

### NFR-ACC-003: Predictable Focus

- **Category:** Accessibility.
- **Statement:** Focus state must be visible and predictable after commands, errors, confirmations, and generation reports.
- **Target:** Focus moves to the most relevant interactive element after state changes.
- **Minimum Threshold:** Focus is never lost into an unrecoverable state.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Interaction Model, UI Specification.
- **Measurement Method:** Keyboard navigation test through core flows.
- **Verification:** observable test.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Users cannot recover from errors or confirmations without pointer.
- **Affected Journeys:** All journeys.
- **Affected Features:** Error and Recovery View, Confirmation Prompts.
- **Affected Modules:** TUI Experience, Frontend Architecture.
- **Owner or Review Target:** UI Specification, Frontend Architecture.

### NFR-ACC-004: HTML Artifact Accessibility Target

- **Category:** Accessibility.
- **Statement:** Generated HTML artifacts should target WCAG 2.2 AA readability; full compliance is deferred until testing.
- **Target:** WCAG 2.2 AA for generated HTML artifacts.
- **Minimum Threshold:** Readable structure, heading hierarchy, and text alternatives for derived labels.
- **Classification:** desired.
- **Priority:** should-have.
- **Source:** Design System.
- **Measurement Method:** Automated accessibility scan + manual review.
- **Verification:** review.
- **Release Impact:** defer — HTML artifacts are supporting outputs.
- **Risk if Unmet:** Derived artifacts exclude users who rely on assistive technology.
- **Affected Journeys:** J-005 Generate and Review Outputs.
- **Affected Features:** HTML Artifact generation.
- **Affected Modules:** Generation and Outputs.
- **Owner or Review Target:** Design System, Frontend Architecture.
- **Notes:** Full WCAG testing requires engineering implementation before claims.

### NFR-ACC-005: Text-Only Loading States

- **Category:** Accessibility.
- **Statement:** TUI loading and pending states must include text equivalents; motion must not be the only status indicator.
- **Target:** Every pending operation has a text label (e.g., "Generating documents...").
- **Minimum Threshold:** No operation relies solely on animation or color change.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** UX Model, Design System.
- **Measurement Method:** Review of TUI states.
- **Verification:** review.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Screen reader and terminal users miss progress cues.
- **Affected Journeys:** All journeys.
- **Affected Features:** Loading indicators, generation pending.
- **Affected Modules:** TUI Experience.
- **Owner or Review Target:** UI Specification, Frontend Architecture.

---

## Privacy

Privacy is a defining quality attribute for LOGOS Engine. The local-first model eliminates many traditional server-side privacy risks but creates requirements around provider transmission and token handling.

### NFR-PRIV-001: No Telemetry by Default

- **Category:** Privacy.
- **Statement:** The product must not collect usage telemetry, analytics, session tracking, or behavioral profiles by default.
- **Target:** Zero telemetry, analytics, or phone-home behavior in default configuration.
- **Minimum Threshold:** No network calls except explicit AI provider calls or user-initiated updates.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Boundaries, old privacy docs.
- **Measurement Method:** Network traffic inspection in default configuration.
- **Verification:** inspection.
- **Release Impact:** release-blocking — telemetry violates Local First and Safe by Default.
- **Risk if Unmet:** User trust is destroyed; product identity is compromised.
- **Affected Journeys:** All journeys.
- **Affected Features:** All operations.
- **Affected Modules:** All modules.
- **Owner or Review Target:** Engineering Brief, Permission Model.

### NFR-PRIV-002: No Covert Remote Transmission

- **Category:** Privacy.
- **Statement:** Project context must not be sent to remote providers without explicit configuration and disclosure.
- **Target:** Remote calls occur only after `/config ai` and explicit consent.
- **Minimum Threshold:** First remote call is blocked until disclosure is acknowledged.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Principles, old privacy docs.
- **Measurement Method:** Review of provider configuration and consent flow.
- **Verification:** observable test.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Sensitive project context leaks unexpectedly.
- **Affected Journeys:** J-001 Primary Clarification, J-004 Provider Configuration.
- **Affected Features:** AI-led intake, provider configuration.
- **Affected Modules:** AI Assistance, Permission/Trust.
- **Owner or Review Target:** Permission Model, Engineering Brief.

### NFR-PRIV-003: Data Minimization

- **Category:** Privacy.
- **Statement:** The product must store only data required for project clarity: no unrelated source code, Git history, or arbitrary files.
- **Target:** Workspace state contains only answers, decisions, assumptions, questions, risks, and metadata needed for generation.
- **Minimum Threshold:** No ingestion of repository source code without explicit inclusion.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Boundaries, old privacy docs.
- **Measurement Method:** Inspection of workspace state schema and ingestion rules.
- **Verification:** inspection.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Workspace bloat and unintended context exposure.
- **Affected Journeys:** J-001 Primary Clarification.
- **Affected Features:** Intake conversation, workspace initialization.
- **Affected Modules:** Conversational Intake, Structured State.
- **Owner or Review Target:** Engineering Data Model, Security Architecture.

### NFR-PRIV-004: Token Safety

- **Category:** Privacy / Security.
- **Statement:** Raw AI provider tokens must not be stored in project files or tracked by Git.
- **Target:** Tokens reside only in environment variables or OS credential stores.
- **Minimum Threshold:** No plaintext token in `.logos/`, `logos/`, or repository config files.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old provider config, Permission Model, Functional Requirements.
- **Measurement Method:** Inspection of file writes and `.gitignore` rules.
- **Verification:** inspection.
- **Release Impact:** release-blocking — token exposure is a security and privacy failure.
- **Risk if Unmet:** Secrets committed to Git; provider abuse; user trust lost.
- **Affected Journeys:** J-004 Provider Configuration.
- **Affected Features:** `/config ai`.
- **Affected Modules:** AI Assistance, Permission/Trust.
- **Owner or Review Target:** Security Architecture, Engineering Brief.

### NFR-PRIV-005: Transmission Inspectability

- **Category:** Privacy.
- **Statement:** Users must be able to inspect what context would be sent to a remote provider before it is transmitted.
- **Target:** Pre-flight disclosure shows scope of context that will leave the local machine.
- **Minimum Threshold:** First remote call per session requires explicit acknowledgment.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old privacy docs, Functional Requirements.
- **Measurement Method:** Review of `/config ai` and intake flows.
- **Verification:** observable test.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Users cannot give informed consent.
- **Affected Journeys:** J-004 Provider Configuration, J-001 Primary Clarification.
- **Affected Features:** Provider configuration, AI-led intake.
- **Affected Modules:** AI Assistance, Permission/Trust.
- **Owner or Review Target:** Permission Model, Feature Specification.

### NFR-PRIV-006: Local-First Default

- **Category:** Privacy.
- **Statement:** All project state and generated documents remain local by default; no cloud sync or remote storage without explicit opt-in.
- **Target:** 100% of canonical state resides in the user's repository.
- **Minimum Threshold:** No hidden remote storage of project decisions or documents.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Principles.
- **Measurement Method:** Inspection of storage paths and sync behavior.
- **Verification:** inspection.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Violates core product identity.
- **Affected Journeys:** All journeys.
- **Affected Features:** Workspace state, canonical documents.
- **Affected Modules:** Repository Workspace, Generation and Outputs.
- **Owner or Review Target:** Engineering Brief, Product Architecture.

---

## Security

Security requirements are product-level boundaries, not implementation architecture. Many traditional security categories are N/A because the product has no hosted backend, no user accounts, and no sessions.

### NFR-SEC-001: Token Source Restriction

- **Category:** Security.
- **Statement:** Raw API tokens must be read from environment variables or OS credential stores; never from project configuration files.
- **Target:** Token source is always external to project files.
- **Minimum Threshold:** No plaintext token in repository files.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old provider config, Permission Model.
- **Verification:** inspection.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Secret exposure via Git or file sharing.
- **Affected Features:** `/config ai`.
- **Affected Modules:** AI Assistance.
- **Owner or Review Target:** Security Architecture, Engineering Brief.

### NFR-SEC-002: Token Redaction

- **Category:** Security.
- **Statement:** Provider configuration must redact tokens in status displays and logs.
- **Target:** Token is never visible in TUI, logs, or generation reports.
- **Minimum Threshold:** Token display shows `***` or similar redaction.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old provider config.
- **Verification:** inspection.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Shoulder surfing or log exposure reveals secrets.
- **Affected Features:** `/config ai`, `/status`.
- **Affected Modules:** AI Assistance.
- **Owner or Review Target:** Security Architecture, Engineering Brief.

### NFR-SEC-003: Bounded Context Ingestion

- **Category:** Security.
- **Statement:** The product must not ingest arbitrary source code, unrelated files, or Git history as AI context without explicit user inclusion.
- **Target:** AI context is limited to structured state and explicitly included material.
- **Minimum Threshold:** No automatic ingestion of `src/`, `.git/`, or other repository folders.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Boundaries.
- **Verification:** inspection.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Sensitive or proprietary code leaked to remote providers.
- **Affected Features:** AI-led intake.
- **Affected Modules:** AI Assistance, Conversational Intake.
- **Owner or Review Target:** Security Architecture, Permission Model.

### NFR-SEC-004: Destructive Action Confirmation

- **Category:** Security.
- **Statement:** Destructive operations (overwrite, root change, remote transmission) require explicit confirmation.
- **Target:** No destructive action executes silently.
- **Minimum Threshold:** Overwrite and root change are always confirmed.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Interaction Model, Permission Model.
- **Verification:** observable test.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Accidental data loss or unauthorized transmission.
- **Affected Features:** `/generate`, `/init`, `/config ai`.
- **Affected Modules:** Permission/Trust, Generation.
- **Owner or Review Target:** Permission Model, Feature Specification.

### NFR-SEC-005: Authentication — N/A

- **Category:** Security.
- **Statement:** Authentication mechanisms are not required in MVP because there are no user accounts or hosted services.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope, Boundaries.
- **Notes:** If hosted collaboration is validated later, authentication requirements will be defined in a future security document.

### NFR-SEC-006: Authorization — N/A

- **Category:** Security.
- **Statement:** Authorization models are not required in MVP because the product is single-user local.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope, Boundaries.
- **Notes:** Multi-user permissions belong to deferred scope.

### NFR-SEC-007: Encryption at Rest — Preferred

- **Category:** Security.
- **Statement:** Encryption at rest for local files is preferred but not release-blocking; the product relies on OS filesystem encryption.
- **Target:** OS-level encryption (FileVault, BitLocker, LUKS) is assumed.
- **Minimum Threshold:** No additional product-level encryption is required for MVP.
- **Classification:** desired.
- **Priority:** could-have.
- **Source:** Engineering context.
- **Verification:** engineering review.
- **Release Impact:** defer.
- **Risk if Unmet:** Stolen machine exposes local project files.
- **Affected Modules:** Repository Workspace.
- **Owner or Review Target:** Security Architecture, Engineering Brief.
- **Notes:** Product-level encryption would add complexity and key management burden.

---

## Reliability

Reliability requirements protect user trust by ensuring state survives failures and destructive actions are bounded.

### NFR-REL-001: AI Failure State Preservation

- **Category:** Reliability.
- **Statement:** AI provider failures must not corrupt project state or confirmed decisions.
- **Target:** 100% of confirmed decisions survive any AI failure mode.
- **Minimum Threshold:** Malformed AI output cannot write to structured state without validation.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old development standards, Product Architecture.
- **Verification:** observable test.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** User loses trust in local state; decisions become unreliable.
- **Affected Features:** AI-led intake, decision review.
- **Affected Modules:** AI Assistance, Structured State.
- **Owner or Review Target:** Engineering Data Model, Test Strategy.

### NFR-REL-002: Decision Immutability

- **Category:** Reliability.
- **Statement:** Confirmed decisions must never be silently overwritten; changes require supersession with affected-document reporting.
- **Target:** All confirmed decision changes create an audit trail.
- **Minimum Threshold:** Overwrite of confirmed decision is blocked or requires explicit supersession.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old decision registry, Functional Requirements.
- **Verification:** observable test.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Traceability is lost; users cannot trust decision history.
- **Affected Features:** Decision revision, generation.
- **Affected Modules:** Structured State, Decision Review.
- **Owner or Review Target:** State Model, Test Strategy.

### NFR-REL-003: Idempotent Initialization

- **Category:** Reliability.
- **Statement:** Workspace initialization (`/init`) must be idempotent; repeated init must not destroy existing state without explicit confirmation.
- **Target:** Re-running `/init` on an initialized workspace is safe or warns clearly.
- **Minimum Threshold:** No silent data loss on repeated init.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old development standards.
- **Verification:** observable test.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** User accidentally wipes project state.
- **Affected Features:** `/init`.
- **Affected Modules:** Repository Workspace.
- **Owner or Review Target:** Engineering Brief, Test Strategy.

### NFR-REL-004: Safe File Writes

- **Category:** Reliability.
- **Statement:** File writes must default to safe mode; destructive overwrites require confirmation.
- **Target:** Generation reports distinguish created, updated, skipped, and blocked files.
- **Minimum Threshold:** Manual edits are not overwritten without warning.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old document rendering, Permission Model.
- **Verification:** observable test.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** User loses manual work; trust in regeneration is destroyed.
- **Affected Features:** `/generate`.
- **Affected Modules:** Generation and Outputs.
- **Owner or Review Target:** Permission Model, Test Strategy.

### NFR-REL-005: Partial Failure Preservation

- **Category:** Reliability.
- **Statement:** Partial failures (provider timeout, generation error) must preserve completed state and report what succeeded versus what failed.
- **Target:** User receives a clear report of partial completion with recovery options.
- **Minimum Threshold:** Failed operations do not rollback successful prior state.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** UX Model, Product Architecture.
- **Verification:** observable test.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Users lose progress or cannot distinguish success from failure.
- **Affected Features:** `/generate`, `/diagnose`, `/continue`.
- **Affected Modules:** All state-changing modules.
- **Owner or Review Target:** Interaction Model, Test Strategy.

### NFR-REL-006: Deterministic Validation Without AI

- **Category:** Reliability.
- **Statement:** Deterministic validation and diagnostics must remain usable when the AI provider is unavailable.
- **Target:** `/validate` and deterministic `/diagnose` work in no-provider mode.
- **Minimum Threshold:** Core validation rules do not depend on remote calls.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Product Architecture.
- **Verification:** observable test.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Product is useless without AI, contradicting the bounded-AI thesis.
- **Affected Features:** `/validate`, `/diagnose`.
- **Affected Modules:** Diagnostics and Validation.
- **Owner or Review Target:** Engineering System Architecture, Test Strategy.

---

## Availability

Availability requirements for LOGOS Engine focus on offline capability and graceful degradation rather than external uptime commitments.

### NFR-AVA-001: Offline Operation

- **Category:** Availability.
- **Statement:** The product must operate fully offline when no remote AI provider is configured.
- **Target:** All local operations (status, validation, document review, diagnostics) work without network.
- **Minimum Threshold:** Non-AI features do not fail when offline.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Principles, old privacy docs.
- **Verification:** observable test.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Violates Local First principle.
- **Affected Features:** `/status`, `/validate`, `/diagnose`, document browsing.
- **Affected Modules:** Repository Workspace, Diagnostics and Validation.
- **Owner or Review Target:** Engineering Brief.

### NFR-AVA-002: No-Provider Degradation

- **Category:** Availability.
- **Statement:** When the AI provider is unavailable, the product must degrade to a no-provider mode with local status review and setup guidance.
- **Target:** User sees clear guidance to `/config ai` or continue without AI.
- **Minimum Threshold:** TUI does not crash when provider is missing.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** User Journeys, Product Architecture.
- **Verification:** observable test.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Provider setup blocks all product use.
- **Affected Features:** `/continue`, `/diagnose`, `/generate`.
- **Affected Modules:** AI Assistance, TUI Experience.
- **Owner or Review Target:** Feature Specification, Test Strategy.

### NFR-AVA-003: No External SLA

- **Category:** Availability.
- **Statement:** No external uptime SLA is offered; availability is a function of the user's local machine and chosen provider.
- **Target:** Product documentation states that availability is local-only.
- **Minimum Threshold:** No SLA claims in product or marketing material.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope.
- **Verification:** review.
- **Release Impact:** N/A.
- **Risk if Unmet:** False commitment to hosted reliability.
- **Affected Modules:** N/A.
- **Owner or Review Target:** GTM Brief, Operations.

### NFR-AVA-004: No Planned Maintenance Windows

- **Category:** Availability.
- **Statement:** Planned maintenance windows are not applicable because there is no hosted service.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope.
- **Notes:** Future hosted features would require maintenance policies.

---

## Scalability

Scalability requirements focus on local data volume and project complexity rather than user concurrency or request throughput.

### NFR-SCAL-001: Single-User Local Operation

- **Category:** Scalability.
- **Statement:** MVP supports single-user local operation; multi-user concurrency is excluded.
- **Target:** One active user per repository workspace.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope, Boundaries.
- **Notes:** Multi-user collaboration is deferred until validated.

### NFR-SCAL-002: Initial Standard Profile Document Tree

- **Category:** Scalability.
- **Statement:** The initial Standard profile document tree (~28 documents) must generate without perceptible degradation on typical developer hardware. Future profiles should receive separate performance baselines when introduced.
- **Target:** Full tree generation completes within a provisional 30-second threshold.
- **Minimum Threshold:** Generation does not hang or exhaust memory on typical machines.
- **Classification:** provisional.
- **Priority:** must-have.
- **Source:** Product Architecture.
- **Verification:** prototype evidence.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** The first bundled profile feels too heavy to use.
- **Affected Features:** `/generate`.
- **Affected Modules:** Generation and Outputs.
- **Owner or Review Target:** Engineering Brief, Test Strategy.

### NFR-SCAL-003: State Volume Tolerance

- **Category:** Scalability.
- **Statement:** Structured state must support at least hundreds of decisions, assumptions, and open questions without perceptible TUI slowdown.
- **Target:** 500+ decisions and 200+ assumptions load without degradation.
- **Minimum Threshold:** 100 decisions and 50 assumptions load without degradation.
- **Classification:** provisional.
- **Priority:** should-have.
- **Source:** Information Architecture.
- **Verification:** prototype evidence.
- **Release Impact:** monitor.
- **Risk if Unmet:** Long-running projects become sluggish.
- **Affected Features:** `/status`, `/diagnose`, `/continue`.
- **Affected Modules:** Structured State, TUI Experience.
- **Owner or Review Target:** Engineering Data Model, Test Strategy.

### NFR-SCAL-004: Request Throughput — N/A

- **Category:** Scalability.
- **Statement:** Request throughput and user concurrency requirements are not applicable to a local single-user product.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope.
- **Notes:** Would apply only to future hosted services.

---

## Compatibility

Compatibility requirements define supported environments and output formats.

### NFR-COMP-001: Operating System Support

- **Category:** Compatibility.
- **Statement:** The TUI must run on macOS, Linux, and Windows (WSL).
- **Target:** Verified on latest two major versions of macOS, Ubuntu LTS, and Windows 10/11 WSL.
- **Minimum Threshold:** At least one macOS and one Linux environment work correctly.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Product Scope, old TUI docs.
- **Verification:** observable test.
- **Release Impact:** degrade gracefully — OS-specific bugs may be patched post-release.
- **Risk if Unmet:** Excludes segments of the target audience.
- **Affected Modules:** TUI Experience, Repository Workspace.
- **Owner or Review Target:** Engineering Brief, Test Strategy.

### NFR-COMP-002: Runtime Compatibility

- **Category:** Compatibility.
- **Statement:** The product requires a Node.js runtime; specific version range is engineering-review-needed.
- **Target:** LTS Node.js version at time of release.
- **Minimum Threshold:** Runs on current LTS.
- **Classification:** provisional.
- **Priority:** must-have.
- **Source:** Engineering context.
- **Verification:** engineering review.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Installation friction for users with outdated runtimes.
- **Affected Modules:** All modules.
- **Owner or Review Target:** Engineering Brief.

### NFR-COMP-003: Git Compatibility

- **Category:** Compatibility.
- **Statement:** Canonical outputs (Markdown, YAML, JSON) must be diff-friendly and compatible with standard Git workflows.
- **Target:** Generated changes produce readable diffs; manual edits are preserved where detectable.
- **Minimum Threshold:** No binary or opaque canonical state.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Principles, old docs.
- **Verification:** inspection.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Violates Git Friendly principle.
- **Affected Features:** `/generate`, workspace state.
- **Affected Modules:** Generation and Outputs, Structured State.
- **Owner or Review Target:** Engineering Brief, Test Strategy.

### NFR-COMP-004: Browser Support for HTML Artifacts

- **Category:** Compatibility.
- **Statement:** Generated HTML artifacts must render in modern evergreen browsers.
- **Target:** Chrome, Firefox, Safari, Edge (last two major versions).
- **Minimum Threshold:** Readable in at least one modern browser.
- **Classification:** required.
- **Priority:** should-have.
- **Source:** Product Scope.
- **Verification:** observable test.
- **Release Impact:** defer.
- **Risk if Unmet:** Derived artifacts are unusable for some users.
- **Affected Features:** HTML artifact generation.
- **Affected Modules:** Generation and Outputs.
- **Owner or Review Target:** Frontend Architecture, Test Strategy.

### NFR-COMP-005: Terminal Emulator Support

- **Category:** Compatibility.
- **Statement:** Terminal support must include common terminal emulators; exact accessibility limits are engineering-review-needed.
- **Target:** Works in iTerm2, Terminal.app, GNOME Terminal, Windows Terminal, VS Code integrated terminal.
- **Minimum Threshold:** Works in at least one common terminal per OS.
- **Classification:** provisional.
- **Priority:** should-have.
- **Source:** UI Spec, Interaction Model.
- **Verification:** engineering review.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** TUI rendering issues in specific terminals.
- **Affected Modules:** TUI Experience.
- **Owner or Review Target:** Frontend Architecture, Test Strategy.

---

## Observability

Observability requirements focus on auditability and local debugging without surveillance or telemetry.

### NFR-OBS-001: Decision Audit Trail

- **Category:** Observability.
- **Statement:** The product must maintain an audit trail of decisions: status changes, confirmations, revisions, and affected documents.
- **Target:** Every confirmed, revised, or superseded decision is traceable in structured state.
- **Minimum Threshold:** Decision registry records status transitions.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Product Architecture, old decision registry.
- **Verification:** inspection.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Users cannot trust decision history or regeneration.
- **Affected Features:** Decision review, decision revision.
- **Affected Modules:** Structured State, Decision Review.
- **Owner or Review Target:** State Model, Engineering Data Model.

### NFR-OBS-002: Generation Reporting

- **Category:** Observability.
- **Statement:** Generation reports must record created, updated, skipped, incomplete, blocked, and failed outputs.
- **Target:** Every `/generate` produces a report with file-level and category-level results.
- **Minimum Threshold:** Report distinguishes at least created, skipped, and failed.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Functional Requirements, Product Architecture.
- **Verification:** inspection.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Users cannot verify what changed.
- **Affected Features:** `/generate`.
- **Affected Modules:** Generation and Outputs.
- **Owner or Review Target:** Feature Specification, Test Strategy.

### NFR-OBS-003: Local Debug Logging

- **Category:** Observability.
- **Statement:** Local debug logging may be supported for troubleshooting; logs must not contain raw secrets or sensitive project context.
- **Target:** Debug logs exist behind an opt-in flag; secrets are redacted.
- **Minimum Threshold:** Default configuration produces no debug logs.
- **Classification:** desired.
- **Priority:** could-have.
- **Source:** old development standards.
- **Verification:** inspection.
- **Release Impact:** defer.
- **Risk if Unmet:** Troubleshooting is harder for early users.
- **Affected Modules:** All modules.
- **Owner or Review Target:** Engineering Brief, Observability Plan.

### NFR-OBS-004: Operational Dashboards — N/A

- **Category:** Observability.
- **Statement:** Operational dashboards, metrics, and alerting are not applicable because there is no hosted service.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Foundation Boundaries, Product Scope.
- **Notes:** Would apply only to future hosted services.

### NFR-OBS-005: Telemetry and Analytics — N/A

- **Category:** Observability.
- **Statement:** Telemetry and analytics collection are prohibited by default per the privacy model.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Foundation Boundaries.
- **Notes:** Any future telemetry requires explicit governance and user consent.

---

## Internationalization

Internationalization requirements are minimal for MVP because the initial audience and proving ground are English-centric.

### NFR-I18N-001: English-Only MVP

- **Category:** Internationalization.
- **Statement:** MVP is English-only for all system text, commands, and generated document templates.
- **Target:** All product output is in English.
- **Minimum Threshold:** No mixed-language system text.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Product Scope.
- **Verification:** review.
- **Release Impact:** defer — English-only is acceptable for MVP validation.
- **Risk if Unmet:** N/A for MVP; limits addressable market post-validation.
- **Affected Modules:** Content Model, Profile and Document Contract.
- **Owner or Review Target:** Content Model, Feature Specification.

### NFR-I18N-002: UTF-8 Support

- **Category:** Internationalization.
- **Statement:** User input and generated document content must support UTF-8.
- **Target:** All text fields accept and preserve UTF-8 characters.
- **Minimum Threshold:** No corruption of non-ASCII user input.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Information Architecture.
- **Verification:** inspection.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Users with non-English project names or descriptions lose data.
- **Affected Features:** Intake conversation, generated documents.
- **Affected Modules:** Conversational Intake, Generation and Outputs.
- **Owner or Review Target:** Engineering Data Model, Test Strategy.

### NFR-I18N-003: Translation Readiness — Deferred

- **Category:** Internationalization.
- **Statement:** Translation readiness and multi-language support are deferred until profile value is validated.
- **Target:** Architecture does not hard-code English-only assumptions.
- **Classification:** deferred.
- **Priority:** won't-have.
- **Source:** Product Scope.
- **Notes:** Early awareness of i18n boundaries helps future profile expansion.
- **Affected Modules:** Content Model, Profile and Document Contract.
- **Owner or Review Target:** Engineering Brief, Feature Specification.

---

## Compliance

Compliance requirements surface legal and ethical concerns without inventing obligations.

### NFR-COMPL-001: No Unverified Compliance Claims

- **Category:** Compliance.
- **Statement:** The product must not claim compliance with named regulations (GDPR, CCPA, SOC2, etc.) without dedicated legal review.
- **Target:** No compliance badges, certifications, or guarantees in product or marketing.
- **Minimum Threshold:** Marketing and documentation avoid unverified compliance language.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Boundaries, Validation Report.
- **Verification:** review.
- **Release Impact:** release-blocking — false compliance claims create liability.
- **Risk if Unmet:** Legal exposure; user distrust.
- **Affected Modules:** All public-facing content.
- **Owner or Review Target:** GTM Brief, Operations, Legal review.

### NFR-COMPL-002: Data Residency — N/A

- **Category:** Compliance.
- **Statement:** Data residency and sovereignty requirements are not applicable because all data remains local by default.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope, Foundation Principles.
- **Notes:** Future hosted features would require residency policies.

### NFR-COMPL-003: User Data Ownership

- **Category:** Compliance / Ethics.
- **Statement:** The user retains full ownership of all project data, decisions, and generated documents.
- **Target:** License and terms do not transfer ownership of user content.
- **Minimum Threshold:** No claim of ownership over user project state or documents.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** Foundation Principles, Boundaries.
- **Verification:** review.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Violates core product identity and user trust.
- **Affected Modules:** Repository Workspace, Generation and Outputs.
- **Owner or Review Target:** Operations, Legal review.

---

## Operational Constraints

Operational constraints define build, release, and maintenance boundaries for sustainable development.

### NFR-OPS-001: Semantic Versioning

- **Category:** Operational Constraints.
- **Statement:** Releases follow semantic versioning.
- **Target:** Version format `MAJOR.MINOR.PATCH` with documented breaking changes.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old release process.
- **Verification:** inspection.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Users cannot predict upgrade safety.
- **Affected Modules:** Release process.
- **Owner or Review Target:** Engineering Brief, Operations.

### NFR-OPS-002: Quality Gates

- **Category:** Operational Constraints.
- **Statement:** Releases require passing tests, build, typecheck, lint, and smoke checks.
- **Target:** All quality gates pass before release.
- **Minimum Threshold:** Tests and build must pass; lint and typecheck may warn but not fail if justified.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old development standards.
- **Verification:** inspection.
- **Release Impact:** release-blocking.
- **Risk if Unmet:** Broken releases damage trust.
- **Affected Modules:** Release process.
- **Owner or Review Target:** Engineering Brief, Test Strategy.

### NFR-OPS-003: Breaking Change Policy

- **Category:** Operational Constraints.
- **Statement:** Breaking changes require migration notes and profile compatibility review.
- **Target:** Every breaking change includes migration guidance and affected file list.
- **Classification:** required.
- **Priority:** must-have.
- **Source:** old release process.
- **Verification:** review.
- **Release Impact:** degrade gracefully.
- **Risk if Unmet:** Users cannot upgrade safely.
- **Affected Modules:** Release process, Profile system.
- **Owner or Review Target:** Engineering Brief, Operations.

### NFR-OPS-004: No Hosting Infrastructure

- **Category:** Operational Constraints.
- **Statement:** No hosting or cloud infrastructure is required for the local MVP product.
- **Target:** Product runs entirely on user hardware.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope.
- **Notes:** Future hosted features would require infrastructure planning.

### NFR-OPS-005: Support Model — Deferred

- **Category:** Operational Constraints.
- **Statement:** Formal support model is deferred until validation evidence exists.
- **Target:** Community or founder support only during MVP phase.
- **Classification:** deferred.
- **Priority:** could-have.
- **Source:** Product Scope.
- **Notes:** Support burden should be tracked but not optimized before product-market fit.
- **Owner or Review Target:** Operations.

---

## NFR Traceability

Each NFR traces backward to a source document or risk and forward to downstream engineering and operations artifacts.

### Backward Traceability

| NFR ID | Source Document | Source Item |
| --- | --- | --- |
| NFR-PERF-001 | UX Model | Calm Rigor, Feedback Model |
| NFR-PERF-002 | old provider config | timeoutMs default |
| NFR-PERF-003 | Interaction Model | `/status` command |
| NFR-PERF-004 | UX Model | Feedback Model |
| NFR-PERF-005 | old TUI spec | Conversation round sizing |
| NFR-ACC-001 | Interaction Model | Keyboard access rules |
| NFR-ACC-002 | Design System | State token rules |
| NFR-ACC-003 | UI Specification | Focus behavior |
| NFR-ACC-004 | Design System | WCAG target |
| NFR-ACC-005 | UX Model | Loading state rules |
| NFR-PRIV-001 | Foundation Boundaries | No surveillance |
| NFR-PRIV-002 | Foundation Principles | Local First |
| NFR-PRIV-003 | Foundation Boundaries | No unbounded context |
| NFR-PRIV-004 | old provider config | Token handling |
| NFR-PRIV-005 | old privacy docs | Transmission disclosure |
| NFR-PRIV-006 | Foundation Principles | Local First |
| NFR-SEC-001 | old provider config | Token source |
| NFR-SEC-002 | old provider config | Redaction |
| NFR-SEC-003 | Foundation Boundaries | No unbounded context |
| NFR-SEC-004 | Interaction Model | Confirmation rules |
| NFR-SEC-005 | Product Scope | No accounts |
| NFR-SEC-006 | Product Scope | Single-user |
| NFR-SEC-007 | Engineering context | OS encryption |
| NFR-REL-001 | old dev standards | AI failure handling |
| NFR-REL-002 | old decision registry | Decision immutability |
| NFR-REL-003 | old dev standards | Idempotent init |
| NFR-REL-004 | old doc rendering | Safe writes |
| NFR-REL-005 | UX Model | Error recovery |
| NFR-REL-006 | Product Architecture | Deterministic validation |
| NFR-AVA-001 | Foundation Principles | Local First |
| NFR-AVA-002 | User Journeys | No-provider recovery |
| NFR-AVA-003 | Product Scope | No hosted SLA |
| NFR-AVA-004 | Product Scope | No hosted service |
| NFR-SCAL-001 | Product Scope | Single-user |
| NFR-SCAL-002 | Product Architecture | Initial Standard profile |
| NFR-SCAL-003 | Information Architecture | Object volume |
| NFR-SCAL-004 | Product Scope | No concurrency |
| NFR-COMP-001 | Product Scope | OS support |
| NFR-COMP-002 | Engineering context | Node.js runtime |
| NFR-COMP-003 | Foundation Principles | Git Friendly |
| NFR-COMP-004 | Product Scope | HTML artifacts |
| NFR-COMP-005 | UI Spec | Terminal support |
| NFR-OBS-001 | Product Architecture | Decision registry |
| NFR-OBS-002 | Functional Requirements | Generation report |
| NFR-OBS-003 | old dev standards | Debug logging |
| NFR-OBS-004 | Foundation Boundaries | No telemetry |
| NFR-OBS-005 | Foundation Boundaries | No telemetry |
| NFR-I18N-001 | Product Scope | English MVP |
| NFR-I18N-002 | Information Architecture | UTF-8 |
| NFR-I18N-003 | Product Scope | Deferred i18n |
| NFR-COMPL-001 | Foundation Boundaries | Legal limits |
| NFR-COMPL-002 | Product Scope | Local data |
| NFR-COMPL-003 | Foundation Principles | User ownership |
| NFR-OPS-001 | old release process | Semver |
| NFR-OPS-002 | old dev standards | Quality gates |
| NFR-OPS-003 | old release process | Migration notes |
| NFR-OPS-004 | Product Scope | No hosting |
| NFR-OPS-005 | Product Scope | Support deferred |

### Forward Traceability

| NFR ID | Downstream Document |
| --- | --- |
| NFR-PERF-001 through NFR-PERF-005 | Engineering Brief, Frontend Architecture, Test Strategy |
| NFR-ACC-001 through NFR-ACC-005 | UI Specification, Design System, Frontend Architecture, Test Strategy |
| NFR-PRIV-001 through NFR-PRIV-006 | Security Architecture, Data Model, Permission Model, Engineering Brief |
| NFR-SEC-001 through NFR-SEC-007 | Security Architecture, Engineering Brief, API Contracts |
| NFR-REL-001 through NFR-REL-006 | Engineering Data Model, Test Strategy, State Model |
| NFR-AVA-001 through NFR-AVA-002 | Engineering Brief, Feature Specification, Test Strategy |
| NFR-SCAL-002 through NFR-SCAL-003 | Engineering Data Model, Test Strategy |
| NFR-COMP-001 through NFR-COMP-005 | Engineering Brief, Frontend Architecture, Test Strategy |
| NFR-OBS-001 through NFR-OBS-003 | Engineering Brief, Observability Plan, State Model |
| NFR-I18N-001 through NFR-I18N-003 | Content Model, Engineering Brief |
| NFR-COMPL-001 through NFR-COMPL-003 | Operations, GTM Brief, Legal review |
| NFR-OPS-001 through NFR-OPS-005 | Engineering Brief, Test Strategy, Operations |

### Completeness Check

- Every Foundation Principle with quality implications has at least one corresponding NFR.
- Every Product Scope risk with non-functional impact is traced.
- Every old architecture constraint (timeouts, idempotency, safe writes, token handling) is represented.
- No critical product risk lacks a corresponding NFR or explicit exclusion rationale.
- Excluded items are classified rather than omitted.

---

## Change Governance

Non-functional requirements change through the same lightweight governance as functional requirements, with additional scrutiny for performance, security, privacy, and accessibility claims.

### Proposal Rules

A new NFR may be proposed when:

- It protects a Foundation Principle or product boundary.
- It addresses a product risk identified in Product Architecture, Validation Report, or old risk registers.
- It is required by a downstream engineering or operations constraint.
- It replaces a provisional target with evidence-backed data.

### Proposal Content

Each NFR proposal must include:

- Category, statement, target, threshold, classification, priority.
- Source document or risk.
- Verification method and release impact.
- Risk if unmet.
- Downstream engineering or operations implication.
- Reconsider trigger.

### Review and Approval

- NFRs that claim compliance, security guarantees, or performance benchmarks require review against Validation Report and Decision Record.
- NFRs that add deferred scope require explicit scope governance.
- Provisional targets may be accepted for MVP but must be marked for prototype validation.
- Excluded items may be reclassified only through Product Scope change.

### Downstream Update Obligations

After an NFR change, the following must be reviewed:

- Engineering Brief and System Architecture (if performance, reliability, or scalability targets change).
- Security Architecture (if security or privacy requirements change).
- Test Strategy (if verification methods or acceptance criteria change).
- Observability Plan (if monitoring or audit requirements change).
- Operations and Support Model (if availability or maintenance constraints change).
- Acceptance Criteria (if user-observable quality changes).

---

## Open Questions

- What are the actual TUI startup and generation latencies on representative developer hardware?
- Which terminal emulators introduce rendering or accessibility constraints that affect the TUI framework choice?
- Should debug logging be opt-in via environment variable, CLI flag, or configuration file?
- What is the maximum project state size before JSON/YAML parsing becomes perceptibly slow?
- Do generated HTML artifacts need automated accessibility scanning in CI, or is manual review sufficient for MVP?
- Should the product include a built-in `.gitignore` template for the LOGOS documentation root to prevent accidental commits of derived artifacts?
- What Node.js version range is the minimum acceptable for the target audience?
- How should the product behave when a user opens a workspace created by a newer version of LOGOS with an older binary?
- Should profile YAML contracts include a version compatibility check?
- What is the appropriate level of error detail to log locally without exposing sensitive project context?

---

## Downstream Handoff

### Engineering Brief and System Architecture

Engineering must inherit:

- Local-first, no-telemetry, no-phone-home constraints.
- Token safety and redaction requirements.
- Provider timeout and failure handling behavior.
- TUI keyboard-first and focus requirements.
- Git-friendly text output constraints.
- Idempotent initialization and safe file write requirements.
- Deterministic validation independence from AI provider.
- Provisional performance targets for startup, status, and generation.
- Terminal and OS compatibility targets.

### Security Architecture

Security must review:

- Token handling and storage boundaries.
- Provider transmission disclosure and consent requirements.
- Bounded context ingestion rules.
- Excluded authentication and authorization scope.
- Encryption at rest preference.

### Data Model

Data Model must preserve:

- Decision audit trails and status transitions.
- No raw token storage in project state.
- UTF-8 support for all text fields.
- State volume tolerance for hundreds of decisions.
- Git-friendly text serialization.

### Test Strategy

Test Strategy must verify:

- AI failure does not corrupt state.
- Overwrite requires confirmation.
- Provider timeout is respected.
- Status and generation produce feedback.
- Keyboard-only navigation works for critical paths.
- No telemetry is sent in default configuration.
- Generation reports are accurate.

### Observability Plan

Observability Plan must define:

- Local debug logging approach (opt-in, secret-free).
- Decision change audit structure.
- Generation report persistence rules.
- Exclusion of operational dashboards and metrics.

### Operations

Operations must prepare:

- Release checklist and quality gates.
- Semantic versioning discipline.
- Breaking change migration notes.
- Support model for provider setup and file overwrite questions.
- No compliance claims without legal review.

### Acceptance Criteria

Acceptance Criteria must verify observable NFRs:

- TUI startup completes without excessive delay.
- Provider timeout is configurable and respected.
- No network calls occur in default offline configuration.
- Tokens are redacted in status and configuration.
- Keyboard navigation covers critical actions.
- State labels are text-based, not color-only.
- Generation reports distinguish all outcome categories.
- AI failures preserve state and show recovery paths.
- `/validate` works without AI provider.
- Destructive actions require confirmation.
