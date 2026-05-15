# Acceptance Criteria

## Objective

This document defines what "done" means for LOGOS Engine at product, feature, UX, UI, functional, non-functional, integration, data, permission, release, and operational-readiness levels. It specifies verification methods, evidence requirements, owners, release-blocking rules, and the sign-off model.

The criteria are derived from Product Scope, Functional Requirements, Non-Functional Requirements, UX Model, Information Architecture, Interaction Model, UI Specification, Design System, Product Architecture, Product Stack, and the old product material's definition of done, test policy, and quality gates. Where evidence is internal or founder-origin, it is labeled accordingly. No criterion should be read as externally validated.

The default test policy from old development standards is preserved here: default tests must run without live AI provider calls, network access, or raw API tokens in fixtures.

---

## Acceptance Taxonomy

### Standard Acceptance Criterion Format

Every material acceptance criterion in this document includes:

| Field | Description |
| --- | --- |
| ID | Unique identifier (AC-{category}-{nnn}). |
| Statement | Observable, testable, or reviewable condition. |
| Level | product, feature, UX, UI, functional, non-functional, integration, data, permission, release. |
| Category | Sub-classification (e.g., performance, security, decision-review). |
| Source | Traceable upstream document and item (FR, NFR, SC, CAP, J, UI, UX, etc.). |
| Verification | How the criterion is checked. |
| Evidence | What must exist for acceptance. |
| Owner / Reviewer | Who accepts or reviews. |
| Release Impact | release-blocking, feature-blocking, degrade-gracefully, monitor, or accepted-risk. |
| Failure Consequence | What happens if the criterion fails. |
| Status | draft, ready-for-review, accepted, failed, blocked, deferred, accepted-risk, not-applicable. |

### Verification Methods

| Method | Meaning | Used For |
| --- | --- | --- |
| observable test | Verified through direct product interaction, command execution, or output inspection. | Functional behavior, TUI states, command routing. |
| inspection | Verified by reading local files, configuration, code, or generated artifacts. | File safety, schema compliance, token storage. |
| review | Verified by human review of output, behavior, design, or documentation. | UX quality, document completeness, accessibility. |
| prototype evidence | Requires prototype usage, profiling, or experiment to validate. | Performance thresholds, cognitive load, intake quality. |
| automated test | Verified by deterministic test suite (no live AI or network). | Regression, state transitions, validation rules. |
| engineering review | Requires technical evaluation before commitment. | Security architecture, TUI accessibility feasibility. |

### Release Impact Semantics

| Impact | Definition |
| --- | --- |
| release-blocking | Violation prevents MVP release. Must be resolved or explicitly accepted as risk by sign-off authority. |
| feature-blocking | Violation prevents feature acceptance but may not block release if feature is deferred or scoped out. |
| degrade-gracefully | Violation reduces quality; release may proceed with documented mitigation. |
| monitor | Violation is tracked; acceptable if bounded and improving. |
| accepted-risk | Known gap is documented, owned, and accepted by sign-off authority with revisit trigger. |

### Status Values

| Status | Meaning |
| --- | --- |
| draft | Criterion is proposed; not yet reviewed. |
| ready-for-review | Criterion is complete and awaiting review. |
| accepted | Criterion is accepted as product-level contract. |
| failed | Criterion was tested and failed; requires fix or risk acceptance. |
| blocked | Criterion cannot be evaluated due to dependency. |
| deferred | Criterion belongs to post-MVP; not required now. |
| accepted-risk | Gap is known, documented, and accepted. |
| not-applicable | Criterion does not apply to current scope. |

---

## Product Acceptance Standard

### Whole-Product Definition of Done

LOGOS Engine MVP is accepted when a user can complete the following end-to-end workflow without hitting unrecoverable errors, silent data loss, or trust-breaking behavior:

1. Install the package and run `logos` from a target repository directory.
2. Initialize or resume a LOGOS workspace with the Standard profile.
3. Configure an AI provider (local or remote) with explicit disclosure and no raw token storage in project files.
4. Conduct AI-led conversational intake that asks context-aware question clusters.
5. Review AI-derived proposed decisions and explicitly confirm, revise, reject, or defer them.
6. Generate canonical Markdown documents under the configured LOGOS documentation root.
7. Generate derived HTML artifacts and agent packs from canonical content.
8. Run diagnostics and validation that expose gaps, contradictions, and next actions.
9. Continue the session later without losing structured state or context.
10. Inspect all local state and generated files; commit them to Git if desired.

### Product-Level Release Gates

| Gate | Purpose | Required Evidence | Owner | Outcome if Failed |
|------|---------|-------------------|-------|-------------------|
| Gate 1: Default test suite passes | Engineering quality baseline. | `pnpm check` (lint, test, build, typecheck, smoke) passes without live AI or network. | founder/user | Release blocked. |
| Gate 2: No raw token storage | Privacy and security baseline. | Inspection of `.logos/` and `logos/` confirms no plaintext tokens; `.gitignore` rules verified. | founder/user | Release blocked. |
| Gate 3: No default telemetry | Local-first trust baseline. | Network traffic inspection in default config shows no unexpected outbound calls. | founder/user | Release blocked. |
| Gate 4: AI output never silent-confirmed | Agency and safety baseline. | Observable test confirms proposed decisions require explicit user action to become confirmed. | founder/user | Release blocked. |
| Gate 5: End-to-end workflow | Product value baseline. | Prototype walkthrough of install → init → intake → review → generate → diagnose → continue. | founder/user | Release blocked if critical path broken. |
| Gate 6: Document completeness | Canonical output quality. | Generated Markdown documents include assumptions, gaps, risks, and next actions where profile requires them. | founder/user | Degrade gracefully if basic docs generate but depth is shallow. |
| Gate 7: Provider failure recovery | Reliability baseline. | Provider timeout or failure preserves state and routes to safe recovery. | founder/user | Release blocked if state corruption occurs. |

### Unresolved Risk and Accepted Risk Handling

- Unresolved risks at release time must be classified and either resolved, mitigated, or explicitly accepted as risk by the sign-off authority.
- Accepted risks require: risk description, affected criterion, user impact, mitigation in place, revisit trigger, and sign-off record.
- Deferred scope items (hosted collaboration, marketplace, multi-user, etc.) are not treated as risks; they are excluded per Product Scope.

---

## Feature Acceptance Standard

### Feature-Level Definition of Done

A feature is accepted when:

1. It implements the scoped behavior from Product Scope and Product Architecture without scope creep.
2. It satisfies the relevant functional requirements with happy-path and primary failure-path coverage.
3. It respects the Interaction Model's command, confirmation, recovery, and state-transition rules.
4. It aligns with the UI Specification's screen inventory, layout rules, and state treatment.
5. It follows the Design System's semantic tokens, state definitions, and accessibility principles.
6. It includes observable or automated verification where feasible; manual review where not.
7. It does not break existing features or corrupt existing project state.
8. It documents known limitations, edge cases, and deferred enhancements.

### Feature Acceptance vs. Release Acceptance

- Feature acceptance means the feature is correct and complete within its boundaries.
- Release acceptance means the whole product meets all product-level gates, including cross-feature interactions, performance, security, privacy, and reliability.
- A feature may be accepted individually but held from release if it creates a product-level regression.

### Traceability Requirement

Every accepted feature must be traceable to:

- Product Scope item (SC, OOS, CAP)
- Functional Requirement (FR)
- Non-Functional Requirement (NFR) where relevant
- User Journey (J)
- Product Architecture module and capability
- Interaction Model pattern or action

### Feature Test Expectations

| Expectation | Scope | Verification |
|-------------|-------|------------|
| Happy path | All MVP features | Observable test or automated test. |
| Primary failure path | All state-changing features | Observable test (provider failure, timeout, invalid input). |
| Edge cases | Features with boundaries | Automated test or manual QA. |
| State transitions | All features that mutate state | Automated test. |
| Permission / consent | All write, remote, or destructive features | Observable test. |
| Recovery | All features with failure modes | Observable test. |

---

## UX Acceptance Criteria

### Primary Journey Acceptance

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-UX-001 | A first-time user can run `logos`, see orientation (repository, root, profile, provider status), and understand what to do next without external documentation. | UX Model Principle 1, J-009 | prototype evidence | degrade gracefully | draft |
| AC-UX-002 | The AI-led intake asks small contextual question clusters (3–12 questions per round) and accepts incomplete, unknown, or assume-for-now answers without punishing the user. | FR-006, FR-024, FR-025, NFR-PERF-005 | observable test | release-blocking | draft |
| AC-UX-003 | The user can complete the primary clarification journey (init → intake → review → generate → diagnose) in one session without unrecoverable blocking. | J-001, Product Scope MVP | prototype evidence | release-blocking | draft |
| AC-UX-004 | Proposed decisions are visually and textually distinct from confirmed decisions; the user can tell which is which without relying on color alone. | NFR-ACC-002, UX Model Principle 2 | observable test | release-blocking | draft |
| AC-UX-005 | The user can resume a previous session and understand what changed, what remains incomplete, and what to do next. | FR-014, J-002, UX Model Principle 5 | observable test | release-blocking | draft |
| AC-UX-006 | Diagnostics group findings by severity and affected object, and recommend a next useful action rather than dumping a flat list. | FR-012, FR-026, UX Model Principle 3 | observable test | degrade gracefully | draft |
| AC-UX-007 | Generation reports summarize created, updated, skipped, incomplete, blocked, and failed outputs before listing file details. | FR-019, UX Model Principle 1 | observable test | degrade gracefully | draft |
| AC-UX-008 | The product does not pressure the user to complete for engagement; dismissed suggestions do not reappear without changed context. | Interaction Model Suggestion Rules | observable test | degrade gracefully | draft |
| AC-UX-016 | Contextual suggestions appear only beside directly related questions, include source/caveat text, and provide accept, edit, reject, or ignore actions without implying the suggestion is expected. | FR-058, FR-059, UX Model Rule 1A | observable test | degrade gracefully | draft |
| AC-UX-017 | After initialization, opening `logos` shows an AI Startup Briefing or deterministic fallback with current status, unresolved items, generation state, provider/root/profile context, and the recommended next step. | FR-060, FR-061, UX Model Rule 2A | observable test | release-blocking for re-entry | draft |

### Trust and Recovery Acceptance

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-UX-009 | Before the first remote AI call, the product discloses that project context will leave the local machine. | FR-018, NFR-PRIV-002, NFR-PRIV-005 | observable test | release-blocking | draft |
| AC-UX-010 | Before writing or overwriting files, the product shows the active documentation root and output categories and asks for confirmation. | FR-022, FR-023, Interaction Model Confirmation Rules | observable test | release-blocking | draft |
| AC-UX-011 | Provider timeout or failure preserves the user's input and state; the user sees a recovery path (retry, reconfigure, continue without AI). | FR-030, NFR-REL-001, UX Model Principle 5 | observable test | release-blocking | draft |
| AC-UX-012 | The user can correct AI interpretation before it becomes proposed or confirmed state. | FR-043, Interaction Model Correction Rules | observable test | release-blocking | draft |
| AC-UX-013 | Unknown answers are treated as valid state and paired with open questions; the user does not feel punished for not knowing. | FR-024, UX Model Principle 3 | observable test | release-blocking | draft |

### UX Exception Handling

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-UX-014 | Ambiguous user input is handled by labeled best guess and correction offer, not by silent assumption or blocking error. | Interaction Model Ambiguity Rules | observable test | degrade gracefully | draft |
| AC-UX-015 | Errors identify what failed, what state was preserved, and the next safe action. | Interaction Model Failure Recovery | observable test | degrade gracefully | draft |

---

## UI Acceptance Criteria

### Screen Coverage

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-UI-001 | All MVP screens from the UI Specification inventory exist and are reachable: TUI Shell, First-Run, Status, Intake, Proposal Review, Decision Detail, Generation Confirmation, Generation Report, Diagnostics, Validation, Provider Config, Root Config, Error/Recovery, Help. | UI Spec Screen Inventory | observable test | feature-blocking | draft |
| AC-UI-002 | The orientation header shows active repository, active LOGOS documentation root, active profile, and provider status when relevant. | UI Spec Layout Rules, FR-044 | observable test | release-blocking | draft |
| AC-UI-003 | The TUI degrades gracefully on compact terminals (under 80 columns): critical information (root, risk, confirmation) remains visible; advanced summaries collapse. | UI Spec Terminal Viewport Classes | observable test | degrade gracefully | draft |

### State Coverage

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-UI-004 | Every screen that shows decisions, assumptions, or outputs displays the correct state label in text: proposed, confirmed, assumed, unknown, incomplete, blocked, stale, canonical, derived, partial, failed. | UI Spec State Treatment, Design System Principle 2 | review | release-blocking | draft |
| AC-UI-005 | Low-confidence AI interpretations are labeled as such and never visually merged with confirmed content. | FR-028, Design System Principle 2 | review | degrade gracefully | draft |
| AC-UI-006 | Empty, loading, error, success, and partial states are visually distinct and include text equivalents. | UI Spec Screen Inventory, NFR-ACC-005 | observable test | degrade gracefully | draft |

### Design System Alignment

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-UI-007 | Color or visual emphasis reinforces but never replaces text labels for critical states. | NFR-ACC-002, Design System Principle 4 | review | release-blocking | draft |
| AC-UI-008 | Focus is visible and predictable after commands, errors, confirmations, and generation reports. | NFR-ACC-003, Design System Principle 4 | observable test | degrade gracefully | draft |
| AC-UI-009 | Loading and pending states include text labels; motion is not the only status indicator. | NFR-ACC-005, Design System Principle 4 | review | degrade gracefully | draft |

### Accessibility Gates

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-UI-010 | All critical actions are keyboard-operable; slash commands work without pointer interaction. | NFR-ACC-001, Interaction Model Keyboard Rules | observable test | release-blocking | draft |
| AC-UI-011 | TUI accessibility with screen readers and terminal emulators is engineering-review-needed; keyboard-only operation is the minimum accepted threshold. | NFR-ACC-001, Product Architecture | engineering review | accepted-risk pending validation | draft |
| AC-UI-012 | Generated HTML artifacts use readable structure and heading hierarchy. | NFR-ACC-004 | review | degrade gracefully | draft |

---

## Functional Acceptance Criteria

### User Actions and System Behavior

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-FN-001 | Running `logos` from the target repository opens the TUI with workspace detection. | FR-001, FR-002 | observable test | release-blocking | draft |
| AC-FN-002 | `/init` creates workspace metadata, profile reference, and state; repeated init is idempotent and preserves existing state. | FR-003, NFR-REL-003 | observable test | release-blocking | draft |
| AC-FN-003 | The default documentation root is `logos/`; the user can configure another root before generation. | FR-004 | inspection | release-blocking | draft |
| AC-FN-004 | Non-slash text routes to conversational intake; slash-prefixed text routes to command handling. | FR-045, Interaction Model Command Router | observable test | release-blocking | draft |
| AC-FN-005 | All material slash commands (`/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai`, `/help`, `/exit`) are recognized and handled. | FR-016, Interaction Model Commands | observable test | release-blocking | draft |
| AC-FN-006 | AI-led intake asks context-aware questions without requiring deterministic question IDs. | FR-006, FR-046 | prototype evidence | release-blocking | draft |
| AC-FN-007 | Structured state captures answers, assumptions, open questions, proposed decisions, risks, and dependencies across sessions. | FR-007, FR-020 | inspection | release-blocking | draft |
| AC-FN-008 | AI-derived decisions enter as proposed; explicit user action is required to confirm, revise, reject, or defer. | FR-008, NFR-REL-002 | observable test | release-blocking | draft |
| AC-FN-009 | Canonical Markdown documents are rendered under the configured root from profile contracts and structured state. | FR-009 | inspection | release-blocking | draft |
| AC-FN-010 | HTML artifacts and agent packs are generated from canonical content and marked as derived. | FR-010, FR-011, FR-027 | inspection | degrade gracefully | draft |
| AC-FN-011 | Diagnostics report missing decisions, contradictions, risks, and affected documents by severity with next-action recommendation. | FR-012, FR-026 | observable test | release-blocking | draft |
| AC-FN-012 | Validation checks expose validation gaps and unsupported claims without mutating confirmed decisions. | FR-013 | observable test | release-blocking | draft |
| AC-FN-013 | Session continuation resumes intake and state without requiring the user to reconstruct context. | FR-014 | observable test | release-blocking | draft |
| AC-FN-014 | Status view shows progress by phase, document, or decision coverage without implying incomplete areas are complete. | FR-015 | observable test | degrade gracefully | draft |
| AC-FN-015 | AI provider configuration supports local and remote modes; raw tokens are not stored in project files. | FR-017, FR-036, NFR-SEC-001, NFR-PRIV-004 | inspection | release-blocking | draft |
| AC-FN-016 | Remote provider transmission is disclosed before the first call. | FR-018, NFR-PRIV-002 | observable test | release-blocking | draft |
| AC-FN-017 | Generation reports show created, updated, skipped, incomplete, blocked, and failed outputs. | FR-019 | inspection | release-blocking | draft |
| AC-FN-018 | The user can revise a confirmed decision and see affected documents and stale outputs. | FR-021 | observable test | release-blocking | draft |
| AC-FN-019 | Write and overwrite operations require explicit confirmation. | FR-022 | observable test | release-blocking | draft |
| AC-FN-020 | Documentation root changes require explicit confirmation. | FR-023 | observable test | release-blocking | draft |
| AC-FN-021 | The product provides a no-provider recovery path with local status and setup guidance. | FR-042, NFR-AVA-002 | observable test | release-blocking | draft |
| AC-FN-022 | The product warns before overwriting manual edits or colliding with existing files. | FR-031 | observable test | release-blocking | draft |
| AC-FN-023 | Generated documents expose validation caveats, unsupported claims, and assumption labels. | FR-050 | review | degrade gracefully | draft |
| AC-FN-024 | Executive JSON generation produces `outcomes/executive/executive-plan.json` from normative documents with readiness, confidence, source document references, and review-needed labels for inferred items. | FR-051, FR-052 | inspection | feature-blocking for Executive Axis | draft |
| AC-FN-025 | Executive JSON validates against the executive plan schema and represents roadmaps, milestones, workstreams, initiatives, items, decisions, risks, artifacts, dependencies, acceptance criteria, and export metadata. | FR-053 | automated test | feature-blocking for Executive Axis | draft |
| AC-FN-026 | Executive exports are marked as derived snapshots and are not treated as live task state or canonical project truth. | FR-054, FR-057 | inspection | feature-blocking for Executive Axis | draft |
| AC-FN-027 | Supported executive exports can generate Markdown implementation snapshots, GitHub Issue-compatible Markdown files, HTML executive overview, and agent task packs under the configured LOGOS documentation root. | FR-055 | inspection | degrade gracefully | draft |
| AC-FN-028 | Linear and Notion mappings are reported as planned or unsupported unless implemented and validated; no live sync is implied. | FR-056 | review | release-blocking for claim accuracy | draft |

### Edge Cases and Failure Behavior

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-FN-029 | Malformed AI output is rejected before corrupting confirmed state. | FR-007, NFR-REL-001 | automated test | release-blocking | draft |
| AC-FN-030 | Invalid or missing profile blocks generation and reports failure clearly. | FR-005, CR-004 | observable test | degrade gracefully | draft |
| AC-FN-031 | Invalid documentation root blocks generation and reports the issue. | FR-004, CR-003 | observable test | degrade gracefully | draft |
| AC-FN-032 | Unrecognized slash commands produce helpful error feedback without destroying conversational context. | Interaction Model Command Router | observable test | degrade gracefully | draft |
| AC-FN-033 | Partial generation preserves completed outputs and reports blocked or failed items. | NFR-REL-005 | observable test | degrade gracefully | draft |
| AC-FN-034 | Executive external-tool exports are blocked or marked unavailable when the normative baseline is draft and export rules do not allow draft export. | FR-052, FR-054 | automated test | feature-blocking for Executive Axis | draft |

### State Transitions

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-FN-035 | Proposed decision → confirmed requires explicit user confirmation. | Interaction Model State Transitions | automated test | release-blocking | draft |
| AC-FN-036 | Confirmed decision → superseded requires explicit confirmation and affected-document warning. | Interaction Model State Transitions | automated test | release-blocking | draft |
| AC-FN-037 | Generated output becomes stale when source state changes; stale indicator is visible. | Interaction Model Automatic Transitions | automated test | degrade gracefully | draft |
| AC-FN-038 | Assumption → confirmed fact is blocked; assumptions remain visibly caveated. | Interaction Model Blocked Transitions | automated test | release-blocking | draft |
| AC-FN-039 | Executive JSON and exports become stale when normative documents, profile contracts, acceptance criteria, or source decisions change. | FR-051, FR-052, FR-054 | automated test | feature-blocking for Executive Axis | draft |
| AC-FN-040 | Contextual suggestion → confirmed decision is blocked; accepting or editing a suggestion must route through ordinary answer/proposal capture and explicit review rules. | FR-058, FR-059, ACT-019, ACT-020 | automated test | release-blocking | draft |
| AC-FN-041 | Startup briefing generation is read-only: it cannot confirm decisions, mutate assumptions/questions, write files, or send remote context before disclosure requirements are satisfied. | FR-060, FR-061, Interaction Pattern 2A | automated test | release-blocking | draft |

---

## Non-Functional Acceptance Criteria

### Performance

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-PERF-001 | TUI startup from `logos` completes within 2 seconds on typical developer hardware (provisional threshold). | NFR-PERF-001 | prototype evidence | degrade gracefully | draft |
| AC-NF-PERF-002 | AI provider call timeout defaults to 60 seconds and is configurable up to 180 seconds. | NFR-PERF-002 | inspection | release-blocking | draft |
| AC-NF-PERF-003 | Status view loads without perceptible blocking delay. | NFR-PERF-003 | observable test | degrade gracefully | draft |
| AC-NF-PERF-004 | Generation feedback begins immediately; TUI does not freeze without pending indicators. | NFR-PERF-004 | observable test | release-blocking | draft |

### Accessibility

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-ACC-001 | All critical actions are keyboard-operable. | NFR-ACC-001 | observable test | release-blocking | draft |
| AC-NF-ACC-002 | State meaning is communicated by text labels, not color alone. | NFR-ACC-002 | review | release-blocking | draft |
| AC-NF-ACC-003 | Focus state is visible and predictable. | NFR-ACC-003 | observable test | accepted-risk pending validation | draft |
| AC-NF-ACC-004 | TUI loading and pending states include text equivalents. | NFR-ACC-005 | review | degrade gracefully | draft |
| AC-NF-ACC-005 | Generated HTML artifacts target readable structure; full WCAG 2.2 AA is deferred. | NFR-ACC-004 | review | accepted-risk pending validation | draft |

### Privacy

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-PRIV-001 | No telemetry, analytics, session tracking, or behavioral profiles in default configuration. | NFR-PRIV-001 | inspection | release-blocking | draft |
| AC-NF-PRIV-002 | Project context is not sent to remote providers without explicit configuration and disclosure. | NFR-PRIV-002 | observable test | release-blocking | draft |
| AC-NF-PRIV-003 | Workspace state contains only project clarity data; no unrelated source code or Git history. | NFR-PRIV-003 | inspection | release-blocking | draft |
| AC-NF-PRIV-004 | Raw AI provider tokens are not stored in project files or tracked by Git. | NFR-PRIV-004 | inspection | release-blocking | draft |
| AC-NF-PRIV-005 | Users can inspect what context would be sent to a remote provider before transmission. | NFR-PRIV-005 | observable test | release-blocking | draft |
| AC-NF-PRIV-006 | All project state and documents remain local by default. | NFR-PRIV-006 | inspection | release-blocking | draft |

### Security

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-SEC-001 | Raw API tokens are read from env vars or OS credential stores; never from project config files. | NFR-SEC-001 | inspection | release-blocking | draft |
| AC-NF-SEC-002 | Provider configuration redacts tokens in status displays and logs. | NFR-SEC-002 | inspection | release-blocking | draft |
| AC-NF-SEC-003 | The product does not ingest arbitrary source code or unrelated files as AI context. | NFR-SEC-003 | inspection | release-blocking | draft |
| AC-NF-SEC-004 | Destructive operations (overwrite, root change, remote transmission) require explicit confirmation. | NFR-SEC-004 | observable test | release-blocking | draft |

### Reliability and Availability

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-REL-001 | AI provider failures do not corrupt project state or confirmed decisions. | NFR-REL-001 | automated test | release-blocking | draft |
| AC-NF-REL-002 | Confirmed decisions are never silently overwritten. | NFR-REL-002 | automated test | release-blocking | draft |
| AC-NF-REL-003 | Workspace initialization is idempotent. | NFR-REL-003 | automated test | release-blocking | draft |
| AC-NF-REL-004 | File writes default to safe mode; destructive overwrites require confirmation. | NFR-REL-004 | observable test | release-blocking | draft |
| AC-NF-REL-005 | Partial failures preserve completed state and report what succeeded versus what failed. | NFR-REL-005 | observable test | release-blocking | draft |
| AC-NF-REL-006 | Deterministic validation and diagnostics remain usable when AI provider is unavailable. | NFR-REL-006 | observable test | release-blocking | draft |
| AC-NF-AVA-001 | The product operates fully offline when no remote AI provider is configured. | NFR-AVA-001 | observable test | release-blocking | draft |
| AC-NF-AVA-002 | When AI provider is unavailable, the product degrades to no-provider mode with guidance. | NFR-AVA-002 | observable test | release-blocking | draft |

### Compatibility

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-COMP-001 | The TUI runs on macOS, Linux, and Windows (WSL). | NFR-COMP-001 | observable test | release-blocking | draft |
| AC-NF-COMP-002 | Canonical outputs (Markdown, YAML, JSON) are diff-friendly and Git-compatible. | NFR-COMP-003 | inspection | release-blocking | draft |
| AC-NF-COMP-003 | Generated HTML artifacts render in modern evergreen browsers. | NFR-COMP-004 | observable test | degrade gracefully | draft |

### Observability

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-OBS-001 | Decision audit trail records status changes, confirmations, revisions, and affected documents. | NFR-OBS-001 | inspection | release-blocking | draft |
| AC-NF-OBS-002 | Generation reports record created, updated, skipped, incomplete, blocked, and failed outputs. | NFR-OBS-002 | inspection | release-blocking | draft |
| AC-NF-OBS-003 | Debug logging, if supported, does not contain raw secrets or sensitive context. | NFR-OBS-003 | inspection | accepted-risk pending validation | draft |

### Internationalization

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-I18N-001 | MVP system text, commands, and templates are English-only. | NFR-I18N-001 | review | release-blocking | draft |
| AC-NF-I18N-002 | User input and generated content support UTF-8. | NFR-I18N-002 | inspection | release-blocking | draft |

### Compliance

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-COMPL-001 | The product does not claim compliance with named regulations without legal review. | NFR-COMPL-001 | review | release-blocking | draft |
| AC-NF-COMPL-002 | The user retains full ownership of project data, decisions, and generated documents. | NFR-COMPL-003 | review | release-blocking | draft |

### Operational Constraints

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-NF-OPS-001 | Release follows semantic versioning. | NFR-OPS-001 | inspection | release-blocking | draft |
| AC-NF-OPS-002 | Release requires passing tests, build, typecheck, lint, and smoke checks. | NFR-OPS-002 | inspection | release-blocking | draft |
| AC-NF-OPS-003 | Breaking changes include migration notes and profile compatibility review. | NFR-OPS-003 | review | degrade gracefully | draft |

---

## Data and Permission Acceptance Criteria

### Data Correctness and Lifecycle

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-DP-001 | Structured state files (JSON) are valid and parseable after every state-changing operation. | FR-007, Product Architecture | automated test | release-blocking | draft |
| AC-DP-002 | Decision registry preserves proposed, confirmed, rejected, deferred, and superseded states with source traceability. | NFR-OBS-001, Product Architecture | inspection | release-blocking | draft |
| AC-DP-003 | Assumptions remain visible and caveated in generated documents and diagnostics. | FR-025, FR-050 | review | degrade gracefully | draft |
| AC-DP-004 | Open questions are preserved across sessions and linked to affected decisions or documents. | FR-007, FR-024 | inspection | degrade gracefully | draft |
| AC-DP-005 | Generation reports correctly mark outputs as created, updated, skipped, incomplete, blocked, or failed. | FR-019, NFR-OBS-002 | inspection | release-blocking | draft |

### Permission and Consent

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-DP-006 | Workspace initialization requires explicit confirmation before creating state or write directories. | Interaction Model Confirmation Rules | observable test | release-blocking | draft |
| AC-DP-007 | File write and overwrite require explicit confirmation with affected-file preview. | FR-022, Interaction Model | observable test | release-blocking | draft |
| AC-DP-008 | Documentation root change requires explicit confirmation with old/new path and stale-output warning. | FR-023, Interaction Model | observable test | release-blocking | draft |
| AC-DP-009 | Remote AI provider use requires explicit consent before first transmission per project session. | FR-018, NFR-PRIV-002, NFR-SEC-004 | observable test | release-blocking | draft |
| AC-DP-010 | Provider configuration storage requires confirmation and redacts tokens in displays. | NFR-SEC-001, NFR-SEC-002 | inspection | release-blocking | draft |
| AC-DP-011 | Destructive state repair or migration requires strong confirmation with consequence disclosure. | Interaction Model Confirmation Rules | observable test | release-blocking | draft |

### Auditability

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-DP-012 | Decision status changes (confirm, revise, reject, defer, supersede) are traceable to user action or system event. | NFR-OBS-001, Product Architecture | inspection | release-blocking | draft |
| AC-DP-013 | Generation events are recorded with timestamp, source state version, and output categories. | NFR-OBS-002 | inspection | degrade gracefully | draft |

---

## Integration Acceptance Criteria

### AI Provider Integration

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-INT-001 | Provider configuration supports OpenAI, Anthropic, OpenRouter, Ollama, LM Studio, and custom (OpenAI-compatible) endpoints. | Product Stack STK-009 | observable test | release-blocking | draft |
| AC-INT-002 | Local providers (Ollama, LM Studio) do not transmit data outside the local machine. | Product Stack Integration Surface | inspection | release-blocking | draft |
| AC-INT-003 | Remote providers (OpenAI, Anthropic, OpenRouter, custom) disclose transmission behavior before first call. | FR-018, Product Stack | observable test | release-blocking | draft |
| AC-INT-004 | Provider timeout defaults to 60 seconds and triggers safe fallback (preserve state, offer retry/reconfigure). | NFR-PERF-002, FR-030 | observable test | release-blocking | draft |
| AC-INT-005 | Provider authentication failure is handled gracefully without exposing raw tokens in error messages. | NFR-SEC-002 | observable test | release-blocking | draft |
| AC-INT-006 | Malformed or unexpected provider responses are rejected before state mutation. | FR-007, NFR-REL-001 | automated test | release-blocking | draft |
| AC-INT-007 | The product degrades to no-provider mode when no provider is configured or available. | FR-042, NFR-AVA-002 | observable test | release-blocking | draft |

### No Other Integrations

| ID | Statement | Source | Verification | Release Impact | Status |
|----|-----------|--------|------------|----------------|--------|
| AC-INT-008 | The product does not integrate with SaaS platforms, cloud sync, analytics, telemetry, or auth services. | Product Scope OOS-004, OOS-005, NFR-PRIV-001 | inspection | release-blocking | draft |

---

## Release Blocking Issues

### Severity Definitions

| Severity | Definition | Release Impact |
|----------|------------|----------------|
| critical | Data loss, security breach, privacy violation, or silent corruption of user-owned decisions. | Automatic release blocker. |
| high | Feature broken in primary journey, unrecoverable error, or violation of core product promise. | Automatic release blocker unless explicitly accepted as risk. |
| medium | Feature degraded, secondary path broken, or UX friction that does not block primary journey. | Feature blocker; may be accepted with mitigation for release. |
| low | Cosmetic issue, minor inconsistency, or documentation gap. | Advisory; does not block release. |

### Automatic Release Blocker Categories

| Category | Examples | Severity |
|----------|----------|----------|
| Data corruption or loss | State corruption, confirmed decision overwrite, file destruction without confirmation. | critical |
| Security failure | Raw token in project files, tokens in logs, unauthenticated remote transmission. | critical |
| Privacy violation | Default telemetry, hidden network calls, undisclosed remote transmission. | critical |
| Silent AI authority | AI proposals become confirmed without explicit user action. | critical |
| Primary journey broken | Cannot init, intake, review, generate, or diagnose in the happy path. | high |
| No recovery path | Provider failure or generation error loses state or leaves user trapped. | high |
| Deterministic validation broken | Validation fails to catch missing required decisions or reports false readiness. | high |
| Build or test failure | `pnpm check` fails; tests require live AI or network. | high |

### Exception Rules

- A release blocker may be overridden only by the sign-off authority (founder/user) with an explicit accepted-risk record.
- The accepted-risk record must include: risk description, affected criterion, user impact, mitigation in place, and revisit trigger.
- Critical severity issues (data loss, security, privacy, silent AI authority) cannot be overridden without a fix.

### Resolution and Re-Test

- Release-blocking issues must have resolution evidence (test result, inspection log, or review note) before re-test.
- Re-test must verify the fix and confirm no regression in related features.
- The owner of the fix is responsible for re-test evidence; the sign-off authority validates it.

---

## Product Readiness Checklist

### Product Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| Product Scope is current and aligned with implemented features. | Scope document reviewed against implemented capabilities. | founder/user | No — may release with documented scope deltas. | draft |
| Primary journey works end-to-end. | Prototype walkthrough or demo recording. | founder/user | Yes | draft |
| Product promise is preserved: decisions are reviewable, assumptions are visible, gaps are exposed. | Review of generated documents and diagnostics. | founder/user | Yes | draft |

### Engineering Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| Default test suite passes without live AI or network. | `pnpm test` and `pnpm check` output. | founder/user | Yes | draft |
| Build compiles without errors. | `pnpm build` output. | founder/user | Yes | draft |
| TypeScript type checks pass. | `pnpm typecheck` output. | founder/user | Yes | draft |
| Lint and format checks pass. | `pnpm lint:biome` and `pnpm lint:md` output. | founder/user | Yes | draft |
| Smoke test passes. | `pnpm smoke:cli` output. | founder/user | Yes | draft |
| No raw tokens or secrets in codebase or fixtures. | Code and fixture inspection. | founder/user | Yes | draft |

### Test Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| Deterministic tests cover state transitions, validation, generation, and provider mock behavior. | Test coverage report or file inventory. | founder/user | No — accepted-risk if coverage is low but critical paths are tested. | draft |
| Regression tests for canonical document generation exist. | Test files or manual QA checklist. | founder/user | No | draft |
| No live model calls in default test suite. | Test configuration inspection. | founder/user | Yes | draft |

### Security and Privacy Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| No telemetry or analytics in default configuration. | Network inspection and code review. | founder/user | Yes | draft |
| Token storage uses env vars or OS credential stores only. | Configuration and file inspection. | founder/user | Yes | draft |
| Transmission disclosure is shown before first remote call. | UI observation. | founder/user | Yes | draft |
| Destructive operations require confirmation. | Interaction test. | founder/user | Yes | draft |

### Accessibility Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| Keyboard-only operation of critical actions. | Keyboard navigation test. | founder/user | Yes | draft |
| Non-color state communication. | UI review. | founder/user | Yes | draft |
| TUI screen reader compatibility. | Engineering review and terminal testing. | founder/user | No — accepted-risk pending validation. | draft |
| HTML artifact accessibility. | Automated scan or manual review. | founder/user | No | draft |

### Observability Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| Decision audit trail is maintained. | State file inspection. | founder/user | No — degrade gracefully if basic. | draft |
| Generation reports are accurate and complete. | Output inspection. | founder/user | No | draft |
| Debug logging does not leak secrets. | Log inspection. | founder/user | No | draft |

### Release Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| Version is updated per semantic versioning. | `package.json` and changelog. | founder/user | Yes | draft |
| Changelog is updated. | `CHANGELOG.md` or release notes. | founder/user | No | draft |
| Example workspace is regenerated and committed. | Example directory inspection. | founder/user | No | draft |
| README is accurate for install and basic usage. | README review. | founder/user | No | draft |
| npm package contents are correct (`dist`, `profiles`, `docs`, README, LICENSE). | `npm pack --dry-run` or inspection. | founder/user | Yes | draft |

### Support and Operations Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| Known issues and limitations are documented. | Issue list or release notes. | founder/user | No | draft |
| Provider setup troubleshooting guidance exists. | Documentation or help text. | founder/user | No | draft |
| Rollback plan is defined. | This document, Release Management. | founder/user | No | draft |

### Go-to-Market Readiness

| Item | Required Evidence | Owner | Blocker If Incomplete | Status |
|------|-------------------|-------|----------------------|--------|
| Product messaging does not claim validated demand, market fit, or pricing. | Messaging review against Validation Report. | founder/user | Yes | draft |
| Install instructions are tested on target platforms. | Platform-specific install test. | founder/user | No | draft |

---

## Sign-Off Model

### Authority

The founder/user is the sign-off authority for all areas. There is no separate QA, security, or operations team in the current product stage.

### Sign-Off by Area

| Area | Approver | Required Evidence | Decision Options |
|------|----------|-------------------|------------------|
| Product acceptance | founder/user | End-to-end workflow evidence; scope alignment review. | accept, reject, accept with risk, defer. |
| UX acceptance | founder/user | Prototype walkthrough; heuristic review; journey completion evidence. | accept, reject, accept with risk. |
| UI acceptance | founder/user | Screen coverage review; state coverage review; design system alignment check. | accept, reject, accept with risk. |
| Functional acceptance | founder/user | Automated and observable test results; edge case coverage. | accept, reject, accept with risk. |
| Non-functional acceptance | founder/user | Performance observation; privacy/security inspection; accessibility test. | accept, reject, accept with risk. |
| Integration acceptance | founder/user | Provider configuration test; failure mode test; fallback verification. | accept, reject, accept with risk. |
| Data and permission acceptance | founder/user | State inspection; permission flow test; audit trail review. | accept, reject, accept with risk. |
| Engineering acceptance | founder/user | Build, test, lint, typecheck, smoke results. | accept, reject. |
| Release acceptance | founder/user | All product-level gates passed; readiness checklist complete; blockers resolved or accepted as risk. | accept, reject, hold. |

### Accepted Risk Record

When a criterion is accepted as risk, the record must include:

- Risk ID and description.
- Affected acceptance criterion.
- User impact summary.
- Mitigation already in place.
- Revisit trigger (when the risk will be re-evaluated).
- Sign-off date and authority.

### Dissent and Exception

- Dissent from the sign-off authority is recorded as a rejection or hold with reasoning.
- Exceptions to release-blocking rules require an explicit accepted-risk record; they cannot be silently bypassed.
- Deferrals are treated as scope decisions, not risk acceptances, and must follow Product Scope governance.

---

## Rollback and Contingency

### Post-Release Failure Triggers

| Trigger | Severity | Response |
|---------|----------|----------|
| Critical bug causing data loss or corruption in released version. | critical | Deprecate affected npm version; publish emergency patch; communicate in release notes and README. |
| Security vulnerability (token exposure, secret leak). | critical | Deprecate affected npm version immediately; publish patch; notify users via GitHub release notes. |
| Privacy violation (unexpected telemetry or remote call). | critical | Deprecate affected npm version; publish patch; update documentation. |
| Primary journey broken for new users. | high | Publish patch or minor fix; update release notes; recommend upgrade. |
| Feature regression that blocks generation or intake for existing users. | high | Publish patch; document workaround if upgrade is delayed. |
| Secondary feature degraded (HTML artifacts, output browser). | medium | Schedule fix in next release; document known issue. |
| Documentation or help inaccuracy. | low | Update documentation; no code release required. |

### Rollback Mechanism

- LOGOS Engine is distributed via npm registry and GitHub Releases.
- Rollback is performed by deprecating the affected npm version and publishing a corrected version.
- There is no automatic downgrade mechanism in the client.
- Users downgrade by installing a previous version explicitly (`npm install logos-engine@<previous>`).
- GitHub Releases are updated with deprecation notices and migration guidance.

### Contingency Options

| Option | When Used | Owner |
|--------|-----------|-------|
| Patch release | Fix is isolated and low-risk. | founder/user |
| Minor release with fix | Fix requires small feature addition or behavior change. | founder/user |
| Deprecation only | No immediate fix available; users should stay on previous version. | founder/user |
| Documentation workaround | Issue has a manual workaround that does not require code change. | founder/user |

### Communication

- Critical and high-severity issues require updated release notes, README warning, and GitHub release annotation.
- Medium and low issues are documented in release notes and changelog.
- There is no operational alerting or incident response team in MVP; communication is async through release channels.

---

## Downstream Handoff

### Engineering Brief

Must inherit:

- Acceptance criteria as product-level contracts; Engineering defines test implementation.
- Release-blocking categories that cannot be silently relaxed.
- Default test policy: no live AI, no network, no raw tokens in fixtures.
- Accepted risks with revisit triggers.

### Test Strategy

Must inherit:

- All functional, non-functional, integration, data, and permission criteria as test targets.
- Verification methods (observable, inspection, review, automated, prototype, engineering review).
- Edge cases, failure paths, recovery paths, and state transitions to cover.
- Accessibility testing assumptions and accepted-risk items.

### Security Architecture

Must inherit:

- Privacy and security acceptance criteria as hard constraints.
- Token storage, transmission disclosure, and destructive confirmation requirements.
- No telemetry, no hidden network calls as release-blocking.

### Observability Plan

Must inherit:

- Decision audit trail and generation report requirements.
- Debug logging constraints (no secrets).
- No operational dashboards or telemetry pipelines.

### Release Management

Must inherit:

- Release gates and readiness checklist.
- Semantic versioning rules.
- Rollback mechanism (npm deprecate + patch publish).
- Exception and accepted-risk process.

### Support Model

Must inherit:

- Known issues, limitations, and accepted risks.
- Provider setup troubleshooting guidance.
- Rollback and downgrade instructions.

### Risk Management

Must inherit:

- Release-blocking severity definitions.
- Automatic blocker categories.
- Accepted risk records with revisit triggers.

### Go-to-Market

Must inherit:

- Product must not claim validated demand, market fit, or pricing until Evidence Log supports it.
- Install instructions must be tested on target platforms.
- Known limitations must be disclosed, not hidden.

### Unresolved Acceptance Questions

- What is the minimum TUI accessibility verification that can be performed without a dedicated test harness?
- What performance profiling tools and baseline hardware should define the "typical developer machine" threshold?
- How should acceptance criteria evolve when new profiles or provider modes are added post-MVP?
- What is the exact process for recording and revisiting accepted risks across releases?
