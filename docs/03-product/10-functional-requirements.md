# Functional Requirements

## Objective

This document defines the mandatory product-level behaviors, user actions, system functions, data operations, integration boundaries, local self-administration capabilities, and business rules required to deliver the scoped LOGOS Engine product. It describes what the product must do, for whom, under what conditions, and how each requirement will be verified—without prescribing engineering implementation.

The requirements are derived from the Product Brief, Product Scope, User Journeys, UX Model, Information Architecture, Interaction Model, UI Specification, and Product Architecture. They inherit Foundation Principles and Validation constraints. Where the evidence basis is internal or founder-origin, the requirement is labeled accordingly. No requirement should be read as externally validated user demand.

The functional requirements register covers the full capability surface defined in Product Architecture, including MVP core, supporting, deferred, and excluded items. Each requirement is classified by type, priority, scope status, and verification method. The format is condensed to preserve consistency with sibling Product-phase documents.

---

## Requirement Taxonomy

### Requirement Types

| Type | Definition | Example |
| --- | --- | --- |
| User | End-user-facing functions, actions, outputs, and recovery paths. | Confirm a proposed decision, configure documentation root. |
| System | Background or product-initiated functions that preserve state, process data, or enable automation. | Mark outputs stale when source state changes. |
| Admin (Self-Admin) | Local configuration, permission, and trust management performed by the user in their own repository. | Configure AI provider, change documentation root. |
| Integration | External data flow, provider use, and fallback behavior. | Remote AI provider call with disclosure. |
| Data | Product-level storage, retrieval, retention, and consistency needs tied to IA objects. | Preserve decision registry across sessions. |
| Business Rule | Enforceable product constraints, validation rules, and precedence. | AI cannot confirm decisions; unknown answers must not block safe progress. |

### Priority Model

| Priority | Definition | Inclusion Rule | Decision Authority |
| --- | --- | --- | --- |
| must-have | The product promise or primary journey fails without it. | Always included in MVP. | Founder/user assumption or explicit scope decision. |
| should-have | Important for product completeness or profile contract fulfillment, but primary journey can survive without it. | Included in MVP unless it risks scope expansion. | Product Scope or Decision Record. |
| could-have | Useful but not required for MVP value validation. | Included only if cost is low and boundary is safe. | Product Scope governance. |
| won't-have (MVP) | Explicitly excluded from current MVP. | Deferred or excluded per Product Scope. | Decision Record or scope governance. |

### Scope Classification

| Classification | Meaning |
| --- | --- |
| core / MVP | Essential to the product promise and primary journey. |
| supporting / MVP | Supports the core loop but is not the main value proposition. |
| validation-required | In MVP for testing, but user value is unproven. |
| deferred | Candidate for post-MVP; not committed now. |
| excluded | Permanent exclusion or outside product identity. |

### Verification Methods

| Method | Meaning |
| --- | --- |
| observable test | Can be verified through product interaction or output inspection. |
| review | Requires human review of generated content or state. |
| inspection | Verified by reading local files, state, or configuration. |
| prototype evidence | Requires prototype usage or experiment result to validate. |

### Well-Formed Requirement Rules

- Every requirement has a traceable source in an upstream Product-phase document, Foundation document, or old product material.
- Every requirement specifies an actor and an observable behavior.
- Deferred and excluded requirements remain listed for completeness and scope governance.
- Requirements do not duplicate feature descriptions without behavior.
- Assumptions are explicit; unvalidated behaviors are labeled.

---

## Requirement Register

The register below lists all functional requirements identified from Product Scope, User Journeys, Interaction Model, and Product Architecture. Active requirements are limited to MVP, supporting, and validation-required scope.

| ID | Requirement | Actor | Type | Classification | Priority | Source | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-001 | The product must open as a TUI when the user runs `logos` from the target repository directory. | User | System | core / MVP | must-have | SC-001, CAP-001, J-001 | observable test |
| FR-002 | The product must detect whether the current repository has an initialized LOGOS workspace. | System | System | core / MVP | must-have | SC-002, CAP-002, J-001 | observable test |
| FR-003 | The product must initialize a workspace with metadata, selected profile reference, and state when the user confirms `/init`. | User | System | core / MVP | must-have | SC-002, CAP-003, J-009 | observable test |
| FR-004 | The product must use `logos/` as the default LOGOS documentation root and allow the user to configure another root. | User | Admin | core / MVP | must-have | SC-002, CAP-004, J-003 | inspection |
| FR-005 | The product must let the user select a profile during `/init`, with the Standard profile available as the initial default active document contract. | User | System | core / MVP | must-have | SC-003, CAP-005 | inspection |
| FR-006 | The product must conduct AI-led conversational intake without requiring deterministic question IDs during normal flow. | User | User | core / MVP | must-have | SC-004, CAP-008, J-001 | observable test |
| FR-007 | The product must capture answers, assumptions, open questions, proposed decisions, risks, and dependencies in local structured state. | System | Data | core / MVP | must-have | SC-006, CAP-009 | inspection |
| FR-008 | The product must present AI-derived decisions as proposed until the user explicitly confirms, revises, rejects, or defers them. | User | User | core / MVP | must-have | SC-007, CAP-011, J-007 | observable test |
| FR-009 | The product must render canonical Markdown documents under the configured LOGOS documentation root from profile contracts and available state. | System | System | core / MVP | must-have | SC-008, CAP-013, J-005 | inspection |
| FR-010 | The product must generate HTML artifacts under the configured root from canonical Markdown and profile contracts. | System | System | supporting / MVP | should-have | SC-009, CAP-014 | inspection |
| FR-011 | The product must generate agent packs under the configured root from canonical documents and profile contracts. | System | System | supporting / MVP / validation-required | should-have | SC-010, CAP-015 | inspection |
| FR-012 | The product must run diagnostics that report missing decisions, contradictions, risks, and affected documents by severity. | User | System | core / MVP | must-have | SC-011, CAP-018, J-006 | observable test |
| FR-013 | The product must run validation checks that expose validation gaps and unsupported claims. | User | System | core / MVP | must-have | SC-011, CAP-017, J-006 | observable test |
| FR-014 | The product must allow the user to resume an existing session without reconstructing prior context. | User | User | supporting / MVP | must-have | SC-012, CAP-012, J-002 | observable test |
| FR-015 | The product must show status and progress by phase, document, decision coverage, or readiness without implying incomplete areas are complete. | User | User | supporting / MVP | should-have | SC-013, CAP-012, J-001 | observable test |
| FR-016 | The product must provide slash commands for explicit system operations: `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai`, `/help`, `/exit`. | User | User | core / MVP | must-have | CAP-006, Interaction Model | observable test |
| FR-017 | The product must support explicit AI provider configuration, including local and remote modes where available, without storing raw tokens in project files. | User | Admin | supporting / MVP | must-have | SC-005, CAP-007, J-004 | inspection |
| FR-018 | The product must disclose remote provider transmission implications before sending project context to a remote AI provider. | System | Integration | core / MVP | must-have | SC-005, Permission Model | observable test |
| FR-019 | The product must generate a report after `/generate` showing created, updated, skipped, incomplete, blocked, and failed outputs. | System | System | core / MVP | must-have | CAP-016, J-005 | inspection |
| FR-020 | The product must preserve user-provided answers and state across interruptions, provider failures, and session exits. | System | Data | core / MVP | must-have | CAP-019, J-002 | observable test |
| FR-021 | The product must allow the user to revise a confirmed decision and show affected documents and stale outputs. | User | User | core / MVP | must-have | J-007, ACT-008 | observable test |
| FR-022 | The product must require explicit confirmation before writing or overwriting generated files. | System | System | core / MVP | must-have | Interaction Model, Permission Model | observable test |
| FR-023 | The product must require explicit confirmation before changing the configured LOGOS documentation root. | User | Admin | core / MVP | must-have | ACT-011, J-003 | observable test |
| FR-024 | The product must preserve unknown answers as valid state, creating open questions rather than fabricating responses. | User | Data | core / MVP | must-have | ACT-003, UX Model | observable test |
| FR-025 | The product must capture assume-for-now responses as assumptions, keep them visible, and explain downstream effects. | User | Data | core / MVP | must-have | ACT-004, UX Model | observable test |
| FR-026 | The product must group diagnostic findings by severity and affected document, and recommend the next useful action. | System | System | core / MVP | must-have | J-006, CAP-018 | observable test |
| FR-027 | The product must distinguish canonical Markdown from derived HTML artifacts and agent packs in generation reports and browsing. | System | System | core / MVP | must-have | IA, Product Architecture | inspection |
| FR-028 | The product must label AI interpretations with confidence status when low confidence is detected. | System | System | supporting / MVP | should-have | UX Model, Interaction Model | review |
| FR-029 | The product must support output browsing to list canonical documents, HTML artifacts, and agent packs under the active root. | User | User | preferred MVP | could-have | CAP-020, J-005 | observable test |
| FR-030 | The product must handle provider timeout or failure by preserving state and offering retry, reconfiguration, or save-and-continue. | System | System | core / MVP | must-have | CAP-019, FR-003 | observable test |
| FR-031 | The product must warn before overwriting manual edits to canonical Markdown or colliding with existing files. | System | System | core / MVP | must-have | Permission Model, FR-006 | observable test |
| FR-032 | The product must not treat chat transcript as canonical source of truth. | System | Business Rule | core / MVP | must-have | Foundation Principles, SC-006 | review |
| FR-033 | The product must not make project decisions on behalf of the user. | System | Business Rule | excluded | won't-have | OOS-002, Foundation Boundaries | review |
| FR-034 | The product must not build the user's final product, app, or business automatically. | System | Business Rule | excluded | won't-have | OOS-001, Product Scope | review |
| FR-035 | The product must not send project context to remote providers without explicit configuration and disclosure. | System | Business Rule | core / MVP | must-have | Foundation Principles, SC-005 | observable test |
| FR-036 | The product must not store raw AI provider tokens or secrets in project files. | System | Business Rule | core / MVP | must-have | Permission Model, CAP-007 | inspection |
| FR-037 | The product must not support hosted web SaaS, user accounts, or cloud workspace in the current scope. | System | Business Rule | excluded | won't-have | OOS-004, Product Scope | review |
| FR-038 | The product must not support multi-user collaboration, comments, or shared workspaces in the current scope. | System | Business Rule | excluded | won't-have | OOS-005, Product Scope | review |
| FR-039 | The product must not support a plugin or profile marketplace in the current scope. | System | Business Rule | excluded | won't-have | OOS-006, Product Scope | review |
| FR-040 | The product must not perform automatic external market, legal, or competitive research. | System | Business Rule | excluded | won't-have | OOS-008, Product Scope | review |
| FR-041 | The product must not become a project management suite, task board, or CRM. | System | Business Rule | excluded | won't-have | OOS-010, Product Scope | review |
| FR-042 | The product must provide a no-provider recovery path when AI is unavailable, including local status review and setup guidance. | System | System | core / MVP | must-have | J-004, CAP-007 | observable test |
| FR-043 | The product must allow the user to correct AI interpretation before it becomes proposed or confirmed state. | User | User | core / MVP | must-have | ACT-016, Interaction Model | observable test |
| FR-044 | The product must show the active repository path, active documentation root, active profile, and provider status in orientation before write or AI operations. | System | System | core / MVP | must-have | UI Spec, IA | observable test |
| FR-045 | The product must route non-slash text to conversational intake and slash-prefixed text to command handling. | System | System | core / MVP | must-have | Interaction Model, CAP-006 | observable test |
| FR-046 | The product must support asking the user small contextual question clusters rather than long deterministic questionnaires. | System | System | core / MVP | must-have | UX Model, J-001 | prototype evidence |
| FR-047 | The product must support search or retrieval across local LOGOS content as a deferred capability. | User | User | deferred | won't-have | CAP-021, IA | prototype evidence |
| FR-048 | The product must support profile marketplace or broad profile authoring UI as a deferred capability. | User | Admin | deferred | won't-have | OOS-006, DD-002 | review |
| FR-049 | The product must support hosted collaboration as a deferred capability only after validated demand. | User | Admin | deferred | won't-have | OOS-004, DD-003 | review |
| FR-050 | The product must expose validation caveats, unsupported claims, and assumption labels in generated documents and diagnostics. | System | System | core / MVP | must-have | Validation Report, J-006 | review |
| FR-051 | The product must be able to compile a portable Executive JSON model from the current Normative Axis when readiness gates allow generation. | System | System | supporting / post-baseline | should-have | SC-014, CAP-021 | inspection |
| FR-052 | Executive JSON generation must declare source normative documents, readiness status, confidence, inferred items requiring review, and unresolved gaps. | System | Data | supporting / post-baseline | must-have for executive generation | SC-014, Executive Profile | inspection |
| FR-053 | Executive JSON must represent an execution graph with roadmaps, milestones, workstreams, initiatives, execution items, decisions, risks, artifacts, dependencies, acceptance criteria, and export metadata. | System | Data | supporting / post-baseline | must-have for executive generation | Executive Axis Specification | schema validation |
| FR-054 | The product must export executive artifacts through adapter mappings without treating exports as live execution state. | System | Integration | supporting / post-baseline | should-have | SC-014, CAP-022 | inspection |
| FR-055 | The product must support supported file exports for executive Markdown snapshots, GitHub Issue-compatible Markdown, HTML executive overview, and agent task packs. | System | Integration | supporting / post-baseline | should-have | Executive mappings | inspection |
| FR-056 | The product must treat Linear and Notion executive mappings as planned adapter contracts unless implemented and validated; they must not imply live sync in MVP. | System | Business Rule | deferred/planned | won't-have for live sync | Executive mappings, OOS-010 | review |
| FR-057 | The product must not provide live task ownership, bidirectional sync, assignment, comment, notification, or calendar workflows as part of the Executive Axis MVP. | System | Business Rule | excluded | won't-have | Foundation Boundaries, OOS-010 | review |
| FR-058 | When intake is advanced and the next question directly depends on earlier project state, the product may show contextual suggestions alongside the question. | System | User | supporting / MVP / validation-required | should-have | UX Model Rule 1A, Interaction Pattern 1A, CAP-023 | observable test |
| FR-059 | Contextual suggestions must remain optional, source-labeled, caveated when needed, and non-canonical until the user accepts or revises them through the normal answer/proposal flow. | User | Business Rule | core / MVP | must-have | Foundation Glossary, Interaction Pattern 1A, ACT-019 through ACT-021 | observable test |
| FR-060 | After workspace initialization, every `logos` TUI startup must present an AI Startup Briefing that summarizes current status and recommends the next step from local structured state. | System | User | supporting / MVP / validation-required | should-have | UX Model Rule 2A, Interaction Pattern 2A, CAP-012A | observable test |
| FR-061 | The AI Startup Briefing must be read-only, grounded in bounded workspace status, and backed by a deterministic status fallback when AI is unavailable or remote-provider disclosure is not satisfied. | System | Business Rule | core / MVP | must-have | AI as a Layer, Permission Model, API Contracts | observable test |
| FR-062 | The product must represent the active profile by id, version, source, and contract status so the Standard profile can be the MVP default without preventing future profiles. | System | Data | supporting / MVP | should-have | SC-003, Profile Glossary, Data Model | inspection |

---

## Executive Axis Requirements

Executive Axis requirements apply after the normative documentation baseline is sufficient for compilation. They extend generation, but they do not replace the primary clarification and canonical Markdown workflow.

The required behavior is:

- generate `outcomes/executive/executive-plan.json` as the portable execution exchange model;
- validate it against `profiles/standard/executive/executive-plan.schema.json`;
- derive it from normative documents and profile contracts, not from private chat history;
- preserve source normative document references for generated work;
- classify inferred work as review-needed where confidence is low or source coverage is incomplete;
- export Markdown, HTML, GitHub Issue-compatible files, and agent task packs as derived artifacts;
- keep Linear and Notion mappings as planned adapter contracts until implementation validates them;
- block or clearly mark external-tool exports when readiness is only draft;
- report created, skipped, blocked, failed, stale, and unsupported executive outputs in the generation report.

The Executive Axis must not introduce a task board, live execution database, background sync engine, or external project-management authority.

---

## Core Requirements

Core requirements are the must-have behaviors essential to the product promise and primary journey. The primary journey is: a builder starts with an ambiguous project idea, opens LOGOS in the target repository, uses AI-led clarification to produce structured state, reviews proposed decisions, generates canonical documents and derived outputs, runs diagnostics, and leaves with clearer next steps.

### Core Requirement Details

#### CR-001: Repository-Directory TUI Startup

- **ID:** FR-001.
- **Statement:** The product opens as a TUI when `logos` is run from the target repository directory.
- **Actor:** User.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-001, Product Architecture CAP-001.
- **Related Journey:** J-001 Primary Clarification, J-009 Onboarding.
- **Related Module:** Repository Workspace, TUI Experience.
- **Related Capability:** CAP-001, CAP-002.
- **Verification:** observable test.
- **Failure Behavior:** If the directory context is ambiguous, the product shows the active path and asks for confirmation before writing.
- **Recovery Behavior:** The user may confirm the directory, navigate to the correct directory, or exit without initialization.

#### CR-002: Workspace Initialization

- **ID:** FR-003.
- **Statement:** The product initializes a workspace with metadata, selected profile reference, and state when the user confirms `/init`.
- **Actor:** User.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-002, Product Architecture CAP-003.
- **Related Journey:** J-009 Onboarding.
- **Related Module:** Repository Workspace.
- **Related Capability:** CAP-003.
- **Verification:** observable test.
- **Failure Behavior:** If state already exists, the product reports the conflict and preserves existing state.
- **Recovery Behavior:** The user may continue from existing state or reinitialize after explicit confirmation of consequences.

#### CR-003: Configurable Documentation Root

- **ID:** FR-004.
- **Statement:** The product uses `logos/` as the default LOGOS documentation root and allows the user to configure another root before generation.
- **Actor:** User.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-002, Product Architecture CAP-004, Foundation Glossary.
- **Related Journey:** J-003 Documentation Root Configuration.
- **Related Module:** Repository Workspace, Permission/Trust.
- **Related Capability:** CAP-004.
- **Verification:** inspection.
- **Failure Behavior:** Invalid or inaccessible paths block generation and report the issue.
- **Recovery Behavior:** The user may reconfigure the root or resolve the filesystem issue.

#### CR-004: Profile Selection During Initialization

- **ID:** FR-005.
- **Statement:** The product lets the user select a profile during `/init`, with the Standard profile available as the initial default active document contract. The selected profile defines phases, documents, completion criteria, and output definitions while preserving active profile id/version metadata.
- **Actor:** User.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-003, Product Architecture CAP-005.
- **Related Journey:** J-009 Onboarding.
- **Related Module:** Profile and Document Contract.
- **Related Capability:** CAP-005.
- **Verification:** inspection.
- **Failure Behavior:** Invalid or missing profile blocks generation and reports the failure clearly.
- **Recovery Behavior:** Route to profile validation or workspace reinitialization.

#### CR-005: AI-Led Conversational Intake

- **ID:** FR-006.
- **Statement:** The product conducts AI-led conversational intake that asks context-aware question clusters and accepts incomplete answers, without requiring deterministic question IDs during normal flow.
- **Actor:** User.
- **Classification:** core / MVP / validation-required.
- **Priority:** must-have.
- **Source:** Product Scope SC-004, Product Architecture CAP-008, Interaction Model.
- **Related Journey:** J-001 Primary Clarification.
- **Related Module:** Conversational Intake, AI Assistance.
- **Related Capability:** CAP-008.
- **Verification:** prototype evidence.
- **Failure Behavior:** If AI provider is unavailable, route to no-provider recovery or `/config ai`.
- **Recovery Behavior:** Preserve user input and allow continuation after provider setup.

#### CR-005A: Contextual Suggestions During Intake

- **ID:** FR-058, FR-059.
- **Statement:** When the user is answering a later-phase or directly dependent question, the product may show contextual suggestions derived from prior confirmed decisions, active assumptions, open questions, completed documents, or validation gaps.
- **Actor:** System and user.
- **Classification:** supporting / MVP / validation-required.
- **Priority:** should-have, with safety rules must-have when implemented.
- **Source:** UX Model Rule 1A, Interaction Model Pattern 1A, Product Architecture CAP-023.
- **Related Journey:** J-001 Primary Clarification, J-002 Continue an Existing Session, J-006 Diagnose Gaps and Validate Readiness.
- **Related Module:** Conversational Intake, AI Assistance, Structured State and Decision.
- **Related Capability:** CAP-023.
- **Verification:** observable test.
- **Failure Behavior:** If source context is weak, stale, contradictory, or unavailable, the product asks the question without a suggestion or marks the suggestion low confidence.
- **Recovery Behavior:** User may accept, edit, reject, ignore, say unknown, or answer manually; no confirmed state changes until the underlying review rule allows it.

#### CR-006: Structured Project State Capture

- **ID:** FR-007.
- **Statement:** The product captures answers, assumptions, open questions, proposed decisions, risks, and dependencies in local structured state that survives across sessions.
- **Actor:** System.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-006, Product Architecture CAP-009.
- **Related Journey:** J-001 Primary Clarification, J-002 Continue Session.
- **Related Module:** Structured State and Decision.
- **Related Capability:** CAP-009.
- **Verification:** inspection.
- **Failure Behavior:** Malformed AI output must not corrupt confirmed state.
- **Recovery Behavior:** Preserve raw input and prior state; flag interpretation issues for review.

#### CR-007: Decision Proposal Review

- **ID:** FR-008.
- **Statement:** The product presents AI-derived decisions as proposed until the user explicitly confirms, revises, rejects, or defers them.
- **Actor:** User.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-007, Product Architecture CAP-011, Foundation Boundaries.
- **Related Journey:** J-001 Primary Clarification, J-007 Decision Revision.
- **Related Module:** Decision Review and Confirmation.
- **Related Capability:** CAP-011.
- **Verification:** observable test.
- **Failure Behavior:** Ambiguous or low-confidence proposals remain unconfirmed.
- **Recovery Behavior:** User may defer, reject, or request clarification.

#### CR-008: Canonical Markdown Generation

- **ID:** FR-009.
- **Statement:** The product renders canonical Markdown documents under the configured LOGOS documentation root from profile contracts and available structured state.
- **Actor:** System.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-008, Product Architecture CAP-013.
- **Related Journey:** J-005 Generate and Review Outputs.
- **Related Module:** Generation and Outputs.
- **Related Capability:** CAP-013.
- **Verification:** inspection.
- **Failure Behavior:** Partial generation reports what succeeded and what was blocked.
- **Recovery Behavior:** Regenerate after state changes or configuration fixes.

#### CR-009: Diagnostics and Validation

- **ID:** FR-012, FR-013.
- **Statement:** The product runs diagnostics and validation that report missing decisions, contradictions, risks, validation gaps, and affected documents by severity, recommending the next useful action.
- **Actor:** User.
- **Classification:** core / MVP / validation-required.
- **Priority:** must-have.
- **Source:** Product Scope SC-011, Product Architecture CAP-017, CAP-018.
- **Related Journey:** J-006 Diagnose Gaps and Validate Readiness.
- **Related Module:** Diagnostics and Validation.
- **Related Capability:** CAP-017, CAP-018.
- **Verification:** observable test.
- **Failure Behavior:** Diagnostic execution failure preserves state and explains the failure source.
- **Recovery Behavior:** Rerun diagnostics after state changes.

#### CR-010: Session Continuation

- **ID:** FR-014.
- **Statement:** The product allows the user to resume an existing session without reconstructing prior context.
- **Actor:** User.
- **Classification:** supporting / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-012, Product Architecture CAP-012.
- **Related Journey:** J-002 Continue an Existing Session.
- **Related Module:** Repository Workspace, Conversational Intake.
- **Related Capability:** CAP-012.
- **Verification:** observable test.
- **Failure Behavior:** Stale or missing state triggers recovery with preserved safe state.
- **Recovery Behavior:** Reinitialize or repair with user confirmation.

#### CR-010A: AI Startup Briefing

- **ID:** FR-060, FR-061.
- **Statement:** After initialization, every TUI startup presents a welcome briefing that uses AI when provider rules allow it to summarize current local status and recommend the next step.
- **Actor:** System.
- **Classification:** supporting / MVP / validation-required.
- **Priority:** should-have for AI generation; must-have for read-only safety and fallback behavior.
- **Source:** UX Model Rule 2A, Interaction Model Pattern 2A, Product Architecture CAP-012A.
- **Related Journey:** J-002 Continue an Existing Session.
- **Related Module:** TUI Experience, Workspace Status, AI Assistance.
- **Related Capability:** CAP-012A.
- **Verification:** observable test.
- **Failure Behavior:** If AI is unavailable, blocked by disclosure rules, times out, or returns invalid output, the product shows deterministic startup status with the same essential continuation details.
- **Recovery Behavior:** User can run `/continue`, `/status`, `/diagnose`, `/validate`, `/generate`, or `/config ai` from the briefing.

---

## User Requirements

User requirements describe what end users must be able to do and what the product must return or change in response.

### UR-001: Natural Language Clarification

- **ID:** FR-006, FR-045.
- **Statement:** The user must be able to describe project intent in natural language and answer small context-aware question clusters through non-slash text input.
- **Actor:** End user.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Interaction Model Pattern 1, UX Model.
- **Related Journey:** J-001 Primary Clarification.
- **Related Actions:** ACT-001, ACT-002.
- **User Value:** Allows the user to think naturally without learning command syntax for normal intake.
- **Verification:** observable test.
- **Failure Behavior:** If input is ambiguous, the product makes a labeled best guess and allows correction.
- **Recovery Behavior:** User may correct, skip, or mark unknown.

### UR-002: Decision Confirmation, Revision, Rejection, and Deferral

- **ID:** FR-008, FR-021.
- **Statement:** The user must be able to confirm, revise, reject, or defer proposed decisions and assumptions, with affected documents and stale outputs visible before confirmation.
- **Actor:** End user.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Interaction Model Pattern 3, ACT-005 through ACT-008.
- **Related Journey:** J-007 Decision Revision.
- **Related Actions:** ACT-005, ACT-006, ACT-007, ACT-008.
- **User Value:** Preserves agency and prevents false authority.
- **Verification:** observable test.
- **Failure Behavior:** Proposals with cascading impact that are unclear remain pending.
- **Recovery Behavior:** Revisit the decision detail view and supersede or restore.

### UR-003: Slash Command Operations

- **ID:** FR-016.
- **Statement:** The user must be able to invoke explicit system operations through slash commands: `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai`, `/help`, `/exit`.
- **Actor:** End user.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Interaction Model, Product Architecture CAP-006.
- **Related Journey:** All MVP journeys.
- **Related Actions:** All material commands.
- **User Value:** Separates thinking from action; provides predictable operational anchors.
- **Verification:** observable test.
- **Failure Behavior:** Unknown slash commands produce help or error without destroying conversational context.
- **Recovery Behavior:** Preserve typed text and route to `/help`.

### UR-004: Generation Trigger and Review

- **ID:** FR-009, FR-019.
- **Statement:** The user must be able to trigger generation of canonical and derived outputs, receive a report of created, updated, skipped, incomplete, blocked, and failed files, and review what changed.
- **Actor:** End user.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Interaction Model Pattern 4, J-005.
- **Related Journey:** J-005 Generate and Review Outputs.
- **Related Actions:** ACT-013.
- **User Value:** Turns structured state into reviewable local outputs.
- **Verification:** inspection.
- **Failure Behavior:** Partial generation reports partial status; failed generation explains failure.
- **Recovery Behavior:** Retry, reconfigure root, or regenerate after fixing state.

### UR-005: Diagnostics and Validation Trigger

- **ID:** FR-012, FR-013.
- **Statement:** The user must be able to run diagnostics and validation to understand gaps, contradictions, readiness, and next useful actions.
- **Actor:** End user.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Interaction Model Pattern 5, J-006.
- **Related Journey:** J-006 Diagnose Gaps and Validate Readiness.
- **Related Actions:** ACT-014, ACT-015.
- **User Value:** Exposes uncertainty instead of hiding it.
- **Verification:** observable test.
- **Failure Behavior:** Diagnostics failure separates deterministic check failure from provider failure.
- **Recovery Behavior:** Rerun or inspect state manually.

### UR-006: Unknown and Assume-for-Now Responses

- **ID:** FR-024, FR-025.
- **Statement:** The user must be able to answer "I do not know" or ask the system to assume something, with both responses treated as valid state that remains visible.
- **Actor:** End user.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Interaction Model, UX Model Principle 3, ACT-003, ACT-004.
- **Related Journey:** J-001 Primary Clarification.
- **Related Actions:** ACT-003, ACT-004.
- **User Value:** Prevents false certainty and reduces abandonment.
- **Verification:** observable test.
- **Failure Behavior:** Unknown answers must not be treated as errors.
- **Recovery Behavior:** User may later answer, validate, or convert to assumption.

### UR-007: Status and Orientation

- **ID:** FR-015, FR-044.
- **Statement:** The user must be able to check current repository, documentation root, profile, progress, proposed decisions, and next useful action without changing state.
- **Actor:** End user.
- **Classification:** supporting / MVP.
- **Priority:** should-have.
- **Source:** Interaction Model `/status`, J-001.
- **Related Journey:** J-001 Primary Clarification, J-002 Continue Session.
- **Related Actions:** `/status`.
- **User Value:** Supports re-entry and reduces uncertainty about what to do next.
- **Verification:** observable test.
- **Failure Behavior:** If state is unreadable, show initialization path or recovery.
- **Recovery Behavior:** Route to `/init` or error recovery.

### UR-008: Output Browsing

- **ID:** FR-029.
- **Statement:** The user must be able to browse generated outputs under the active root, distinguishing canonical documents from derived artifacts.
- **Actor:** End user.
- **Classification:** preferred MVP.
- **Priority:** could-have.
- **Source:** Product Architecture CAP-020, IA.
- **Related Journey:** J-005 Generate and Review Outputs.
- **User Value:** Helps locate and trust generated files.
- **Verification:** observable test.
- **Failure Behavior:** Missing outputs are explained with next action.
- **Recovery Behavior:** Suggest generation if appropriate.

---

## System Requirements

System requirements describe required background functions, automation, data processing, and degradation behavior at the product level.

### SR-001: Repository and Workspace Detection

- **ID:** FR-001, FR-002.
- **Statement:** The product must detect the current repository context and workspace initialization status on startup.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Architecture CAP-002.
- **Related Module:** Repository Workspace.
- **Verification:** observable test.
- **Failure Behavior:** If detection fails, show path and ask for confirmation before writing.
- **Recovery Behavior:** User confirms or exits.

### SR-002: Structured State Persistence

- **ID:** FR-007, FR-020.
- **Statement:** The product must persist structured project state locally, including decisions, assumptions, open questions, risks, diagnostics, and output status, in a form that survives session exits and interruptions.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Architecture CAP-009.
- **Related Module:** Structured State and Decision.
- **Verification:** inspection.
- **Failure Behavior:** Corrupt or missing state triggers diagnosis without destructive repair.
- **Recovery Behavior:** Show readable existing state and repair options.

### SR-003: Stale Output Tracking

- **ID:** FR-027.
- **Statement:** The product must automatically mark generated outputs as stale when their source state or confirmed decisions change.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Architecture, IA.
- **Related Module:** Generation and Outputs, Structured State.
- **Verification:** inspection.
- **Failure Behavior:** Stale outputs are not hidden; regeneration is recommended.
- **Recovery Behavior:** Regenerate from current state.

### SR-004: Generation Report Production

- **ID:** FR-019.
- **Statement:** The product must produce a generation report after each `/generate` that categorizes results as created, updated, skipped, incomplete, blocked, or failed.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Architecture CAP-016.
- **Related Module:** Generation and Outputs.
- **Verification:** inspection.
- **Failure Behavior:** Failed generation preserves prior report or explains failure.
- **Recovery Behavior:** User reviews report and decides to regenerate or fix state.

### SR-005: Deterministic Validation

- **ID:** FR-013.
- **Statement:** The product must run deterministic validation checks against profile contracts and structured state independently of AI provider availability.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Architecture CAP-017.
- **Related Module:** Diagnostics and Validation.
- **Verification:** observable test.
- **Failure Behavior:** Deterministic checks remain useful even if AI-assisted diagnostics fail.
- **Recovery Behavior:** Rerun after state updates.

### SR-006: Input Routing

- **ID:** FR-045.
- **Statement:** The product must route non-slash text to conversational intake and slash-prefixed text to command handling.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Interaction Model, Product Architecture CAP-006.
- **Related Module:** TUI Experience, Conversational Intake.
- **Verification:** observable test.
- **Failure Behavior:** Ambiguous input is clarified rather than guessed when consequences are material.
- **Recovery Behavior:** Explain routing and allow re-entry.

### SR-007: Low-Confidence Labeling

- **ID:** FR-028.
- **Statement:** The product must label AI interpretations with low-confidence status when detected, requiring review before acceptance.
- **Classification:** supporting / MVP.
- **Priority:** should-have.
- **Source:** UX Model, Interaction Model.
- **Related Module:** AI Assistance, Conversational Intake.
- **Verification:** review.
- **Failure Behavior:** Low-confidence output is not treated as ordinary AI text.
- **Recovery Behavior:** User reviews, corrects, or rejects.

### SR-008: Error and Partial Failure Preservation

- **ID:** FR-030.
- **Statement:** The product must preserve state after provider timeouts, generation failures, path errors, or malformed AI output, and offer a next safe action.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Architecture CAP-019, UX Model Error and Recovery Model.
- **Related Module:** Permission/Trust, TUI Experience.
- **Verification:** observable test.
- **Failure Behavior:** Errors preserve as much safe state as possible.
- **Recovery Behavior:** Retry, reconfigure, save and continue, or exit.

---

## Admin Requirements

Admin requirements cover local self-administration: the user configures their own workspace, provider, and output location. There are no separate admin roles in MVP.

### AR-001: Documentation Root Configuration

- **ID:** FR-004, FR-023.
- **Statement:** The user must be able to accept the default `logos/` documentation root or configure a custom root, with path disclosure and confirmation before writes.
- **Actor:** End user (self-admin).
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-002, J-003.
- **Related Module:** Repository Workspace, Permission/Trust.
- **Verification:** inspection.
- **Failure Behavior:** Invalid paths block generation and explain the issue.
- **Recovery Behavior:** Reconfigure to a valid path.

### AR-002: AI Provider Configuration

- **ID:** FR-017.
- **Statement:** The user must be able to configure AI provider mode, inspect redacted status, test connectivity, and understand local versus remote implications.
- **Actor:** End user (self-admin).
- **Classification:** supporting / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-005, J-004.
- **Related Module:** AI Assistance, Permission/Trust.
- **Verification:** inspection.
- **Failure Behavior:** Invalid configuration preserves prior valid configuration.
- **Recovery Behavior:** Reconfigure or use local no-provider mode.

### AR-003: No Raw Token Storage

- **ID:** FR-036.
- **Statement:** The product must not store raw AI provider tokens or secrets in project files.
- **Actor:** System.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Permission Model, Product Architecture.
- **Related Module:** AI Assistance, Permission/Trust.
- **Verification:** inspection.
- **Failure Behavior:** Token storage attempt is rejected.
- **Recovery Behavior:** Route to secure token source guidance.

### AR-004: Profile Selection

- **ID:** FR-005.
- **Statement:** The user must be able to select the active profile during `/init` and use the Standard profile as the initial default document contract.
- **Actor:** End user (self-admin).
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-003.
- **Related Module:** Profile and Document Contract.
- **Verification:** inspection.
- **Failure Behavior:** Invalid profile blocks generation and reports failure.
- **Recovery Behavior:** Validate profile or reinitialize.

### AR-005: No-Provider Recovery

- **ID:** FR-042.
- **Statement:** The product must provide a no-provider recovery path that allows local status review and setup guidance when AI is unavailable.
- **Actor:** End user (self-admin).
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** J-004, CAP-007.
- **Related Module:** AI Assistance, TUI Experience.
- **Verification:** observable test.
- **Failure Behavior:** Missing provider blocks AI intake but not all local status review.
- **Recovery Behavior:** Route to `/config ai` or allow local-only review.

---

## Integration Requirements

Integration requirements define external data flows, provider use, and fallback behavior. The primary external integration in MVP is the AI provider.

### IR-001: AI Provider Abstraction

- **ID:** FR-017.
- **Statement:** The product must support AI provider configuration through a product-level abstraction that accepts local and remote modes where available.
- **Classification:** supporting / MVP.
- **Priority:** must-have.
- **Source:** Product Scope SC-005, Product Architecture CAP-007.
- **Direction:** Outbound (project context to provider), Inbound (questions, interpretations, proposals).
- **Criticality:** High for AI-led intake; bounded by no-provider fallback.
- **Fallback:** Local no-provider mode with deterministic status and validation.
- **Failure Behavior:** Provider timeout or error preserves state and offers retry or reconfiguration.
- **Recovery Behavior:** Switch provider mode, retry, or continue without AI.

### IR-002: Remote Transmission Disclosure

- **ID:** FR-018, FR-035.
- **Statement:** The product must disclose that project context may leave the local machine before the first remote AI provider call, and require explicit consent.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** Foundation Principles, Permission Model.
- **Direction:** Outbound.
- **Criticality:** High for privacy and trust.
- **Fallback:** Block remote call until consent is given.
- **Failure Behavior:** Undisclosed remote call is blocked.
- **Recovery Behavior:** Route to provider configuration and consent.

### IR-003: No Automatic External Research

- **ID:** FR-040.
- **Statement:** The product must not integrate automatic external market, legal, or competitive research.
- **Classification:** excluded.
- **Priority:** won't-have.
- **Source:** Product Scope OOS-008.
- **Direction:** N/A.
- **Criticality:** N/A.
- **Fallback:** Manual evidence entry by user.
- **Failure Behavior:** N/A.
- **Recovery Behavior:** N/A.

---

## Data Requirements

Data requirements are aligned with Information Architecture objects, state transitions, and user trust.

### DR-001: Decision Registry Durability

- **ID:** FR-007.
- **Statement:** The product must store decisions with id, statement, status, source, confidence, affected documents, dependencies, and review history in local structured state.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** IA OBJ-008, OBJ-009.
- **Data Objects:** Decision, Decision Registry.
- **Lifecycle:** Proposed → Confirmed/Rejected/Deferred; Confirmed → Superseded.
- **Retention:** Preserved across sessions; deprecated rather than silently deleted.
- **Verification:** inspection.

### DR-002: Assumption and Open Question Tracking

- **ID:** FR-024, FR-025.
- **Statement:** The product must store assumptions and open questions with status, evidence basis, affected documents, and related decisions.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** IA OBJ-010, OBJ-011.
- **Data Objects:** Assumption, Open Question.
- **Lifecycle:** Active → Resolved/Replaced/Deferred.
- **Retention:** Visible until resolved or deprecated.
- **Verification:** inspection.

### DR-003: Output Status Tracking

- **ID:** FR-027.
- **Statement:** The product must track canonical and derived output status: not generated, generated, stale, blocked, failed.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** IA OBJ-007, OBJ-017, OBJ-018.
- **Data Objects:** Canonical Document, HTML Artifact, Agent Pack, Generation Report.
- **Lifecycle:** Generated → Stale when source changes; regenerated on demand.
- **Retention:** Latest generation report replaces prior; outputs persist unless deleted by user.
- **Verification:** inspection.

### DR-004: Provider Configuration Status

- **ID:** FR-017, FR-036.
- **Statement:** The product must store provider configuration status, mode, and redacted token source without storing raw secrets.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** IA OBJ-014.
- **Data Objects:** AI Provider Configuration.
- **Lifecycle:** Not configured → Configured → Invalid/Disabled.
- **Retention:** Persistent; raw secrets excluded.
- **Verification:** inspection.

### DR-005: Documentation Root Configuration

- **ID:** FR-004.
- **Statement:** The product must store the active LOGOS documentation root, default/custom status, and validity.
- **Classification:** core / MVP.
- **Priority:** must-have.
- **Source:** IA OBJ-003.
- **Data Objects:** LOGOS Documentation Root.
- **Lifecycle:** Proposed → Active → Changed.
- **Retention:** Persistent; prior root may leave stale outputs.
- **Verification:** inspection.

---

## Business Rules

Business rules are enforceable product constraints that preserve boundaries, trust, and truthfulness.

### BR-001: AI Cannot Confirm Decisions

- **ID:** FR-033.
- **Rule:** AI-derived decisions, assumptions, or interpretations must enter as proposed, advisory, or needs-review. They must not become confirmed without explicit user action.
- **Applies to:** All AI-assisted intake, diagnostics, and drafting.
- **Rationale:** Preserves user agency and prevents false authority.
- **Source:** Foundation Boundaries, Product Scope OOS-002.
- **Configurable:** No.
- **Conflict Handling:** If a system process attempts to auto-confirm, block the transition.
- **Auditability:** Confirmation events must be traceable to user action.

### BR-002: Unknown Is Valid State

- **ID:** FR-024.
- **Rule:** The product must treat "I do not know" as valid input that creates an open question or incomplete state, not as an error.
- **Applies to:** Intake, validation, diagnostics.
- **Rationale:** Prevents false certainty and reduces abandonment.
- **Source:** Foundation Principle Explicit Over Assumed, UX Model.
- **Configurable:** No.
- **Conflict Handling:** Never fabricate an answer to fill a gap.
- **Auditability:** Unknown answers are visible in state and generated documents.

### BR-003: Assumptions Remain Visible

- **ID:** FR-025.
- **Rule:** Accepted assumptions must remain labeled in structured state, generated documents, and diagnostics until replaced by evidence.
- **Applies to:** Generation, diagnostics, validation.
- **Rationale:** Prevents assumptions from becoming hidden facts.
- **Source:** Validation Report, UX Model.
- **Configurable:** No.
- **Conflict Handling:** If generation would omit an assumption label, block or warn.
- **Auditability:** Assumption status is inspectable in state and documents.

### BR-004: No Remote Transmission Without Consent

- **ID:** FR-035.
- **Rule:** The product must not send project context to a remote AI provider without explicit user configuration and disclosure.
- **Applies to:** AI provider use.
- **Rationale:** Preserves local-first trust and privacy.
- **Source:** Foundation Principle Local First, Safe by Default.
- **Configurable:** Provider mode is configurable; the rule itself is not.
- **Conflict Handling:** Block remote call if consent is missing.
- **Auditability:** Provider status and disclosure state are visible.

### BR-005: No Raw Token Storage

- **ID:** FR-036.
- **Rule:** Raw AI provider tokens and secrets must not be stored in project files.
- **Applies to:** Provider configuration.
- **Rationale:** Protects secrets from accidental Git commits and exposure.
- **Source:** Permission Model, Product Architecture.
- **Configurable:** No.
- **Conflict Handling:** Reject storage attempts.
- **Auditability:** Inspect configuration files for token absence.

### BR-006: Derived Outputs Are Not Canonical

- **ID:** FR-027.
- **Rule:** HTML artifacts and agent packs must be labeled as derived from canonical Markdown and must not be treated as sources of truth.
- **Applies to:** Generation, output browsing, user guidance.
- **Rationale:** Preserves source-of-truth clarity and regeneration traceability.
- **Source:** Foundation Principle Structure Over Presentation, Product Scope.
- **Configurable:** No.
- **Conflict Handling:** If a user edits a derived artifact, the product warns on regeneration.
- **Auditability:** Generation reports and output labels show derivation.

### BR-007: Confirmation Before Destructive Action

- **ID:** FR-022, FR-023.
- **Rule:** The product must require explicit confirmation before file writes, overwrites, documentation-root changes, remote provider use, and confirmed decision changes.
- **Applies to:** Generation, configuration, decision review.
- **Rationale:** Protects local work and user agency.
- **Source:** Interaction Model, Permission Model.
- **Configurable:** No.
- **Conflict Handling:** If confirmation is bypassed, block the action.
- **Auditability:** Confirmation prompts are observable.

### BR-008: Validation Caveats in Generated Content

- **ID:** FR-050.
- **Rule:** Generated documents and diagnostics must expose validation caveats, unsupported claims, assumption labels, and open questions.
- **Applies to:** Canonical Markdown generation, HTML artifacts, agent packs, diagnostics.
- **Rationale:** Prevents generated clarity from being mistaken for external validation.
- **Source:** Validation Report, Product Scope.
- **Configurable:** No.
- **Conflict Handling:** If generation would hide a validation gap, preserve the caveat.
- **Auditability:** Review generated documents for caveat presence.

---

## Requirement Traceability

Each requirement traces backward to source documents and forward to downstream artifacts.

### Backward Traceability

| Requirement ID | Source Document | Source Item |
| --- | --- | --- |
| FR-001 | Product Scope | SC-001 |
| FR-002 | Product Scope | SC-001 |
| FR-003 | Product Scope | SC-002 |
| FR-004 | Product Scope | SC-002 |
| FR-005 | Product Scope | SC-003 |
| FR-006 | Product Scope | SC-004 |
| FR-007 | Product Scope | SC-006 |
| FR-008 | Product Scope | SC-007 |
| FR-009 | Product Scope | SC-008 |
| FR-010 | Product Scope | SC-009 |
| FR-011 | Product Scope | SC-010 |
| FR-012 | Product Scope | SC-011 |
| FR-013 | Product Scope | SC-011 |
| FR-014 | Product Scope | SC-012 |
| FR-015 | Product Scope | SC-013 |
| FR-016 | Product Architecture | CAP-006 |
| FR-017 | Product Scope | SC-005 |
| FR-018 | Foundation Principles | Safe by Default |
| FR-019 | Product Architecture | CAP-016 |
| FR-020 | Product Architecture | CAP-019 |
| FR-021 | User Journeys | J-007 |
| FR-022 | Interaction Model | Confirmation Rules |
| FR-023 | Interaction Model | ACT-011 |
| FR-024 | Interaction Model | ACT-003 |
| FR-025 | Interaction Model | ACT-004 |
| FR-026 | Product Architecture | CAP-018 |
| FR-027 | Information Architecture | OBJ-007, OBJ-017, OBJ-018 |
| FR-028 | UX Model | Feedback Model |
| FR-029 | Product Architecture | CAP-020 |
| FR-030 | Product Architecture | CAP-019 |
| FR-031 | Permission Model | Overwrite safeguards |
| FR-032 | Foundation Principles | AI as a Layer |
| FR-033 | Product Scope | OOS-002 |
| FR-034 | Product Scope | OOS-001 |
| FR-035 | Foundation Principles | Local First, Safe by Default |
| FR-036 | Permission Model | Token handling |
| FR-037 | Product Scope | OOS-004 |
| FR-038 | Product Scope | OOS-005 |
| FR-039 | Product Scope | OOS-006 |
| FR-040 | Product Scope | OOS-008 |
| FR-041 | Product Scope | OOS-010 |
| FR-042 | User Journeys | J-004 |
| FR-043 | Interaction Model | ACT-016 |
| FR-044 | UI Specification | Orientation Header |
| FR-045 | Interaction Model | Input Routing |
| FR-046 | UX Model | Cognitive Load Rule 1 |
| FR-047 | Product Architecture | CAP-021 |
| FR-048 | Product Scope | OOS-006, DD-002 |
| FR-049 | Product Scope | OOS-004, DD-003 |
| FR-050 | Validation Report | Validation gaps |

### Forward Traceability

| Requirement ID | Downstream Document |
| --- | --- |
| FR-001 through FR-005 | Feature Specification, Acceptance Criteria, Engineering Brief |
| FR-006 through FR-008 | Feature Specification, Acceptance Criteria, State Model |
| FR-009 through FR-011 | Feature Specification, Acceptance Criteria, Engineering System Architecture |
| FR-012 through FR-013 | Feature Specification, Acceptance Criteria, Validation Report |
| FR-014 through FR-015 | Feature Specification, Acceptance Criteria, UX Model |
| FR-016 | Feature Specification, UI Specification, Frontend Architecture |
| FR-017 through FR-018 | Feature Specification, Permission Model, API Contracts |
| FR-019 | Feature Specification, UI Specification |
| FR-020 | State Model, Engineering Data Model |
| FR-021 | Feature Specification, State Model |
| FR-022 through FR-023 | Permission Model, Acceptance Criteria |
| FR-024 through FR-025 | Content Model, Acceptance Criteria |
| FR-026 | Feature Specification, UI Specification |
| FR-027 | Feature Specification, Content Model |
| FR-028 | Feature Specification, UI Specification |
| FR-029 | Feature Specification, UI Specification |
| FR-030 | Feature Specification, Error Handling Spec |
| FR-031 | Permission Model, Engineering Brief |
| FR-032 through FR-041 | Scope Governance, Decision Record |
| FR-042 | Feature Specification, UI Specification |
| FR-043 | Feature Specification, Interaction Model |
| FR-044 | UI Specification, Frontend Architecture |
| FR-045 | Feature Specification, Frontend Architecture |
| FR-046 | Feature Specification, UX Model |
| FR-047 through FR-049 | Scope Governance, Decision Record |
| FR-050 | Content Model, Validation Report |

### Completeness Check

- Every scope item in Product Scope (in scope and out of scope) has at least one corresponding requirement.
- Every core capability in Product Architecture (CAP-001 through CAP-019) is covered by one or more requirements.
- Every material action in the Interaction Model (ACT-001 through ACT-018) is reflected.
- Every primary journey step in User Journeys that implies functional behavior is traced.
- No orphan requirements exist without a source document.
- No core journey, module, or action lacks a corresponding requirement.

---

## Change Governance

Functional requirements change only through lightweight, explicit governance that preserves scope discipline.

### Proposal Rules

A new functional requirement may be proposed when one of the following is true:

- It is required for the Product Brief's core promise or primary use case.
- It preserves a Foundation boundary.
- It is required by the profile document contract.
- The Evidence Log supports the need.
- The Decision Record accepts the change.
- The founder/user explicitly accepts it as an assumption for validation.

### Proposal Content

Each proposal must include:

- Requirement name and statement.
- Classification and priority.
- Rationale and evidence basis or assumption label.
- Dependency on existing requirements.
- Affected downstream documents.
- Risk if added and risk if deferred.
- Reconsider trigger.

### Review and Approval

- Requirements that change core MVP behavior require review against Product Scope, Foundation Boundaries, and Decision Record.
- Requirements that add deferred or excluded scope require explicit scope governance per Product Scope.
- Requirements that duplicate existing behavior or lack traceability are rejected.

### Versioning and Deprecation

- Deprecated requirements remain in the register with deprecated status and a replacement reference.
- Requirement versions are updated when statements, priorities, or classifications change materially.
- Superseded requirements link to their replacements.

### Downstream Update Obligations

After a requirement change, the following documents must be reviewed and updated if affected:

- Product Scope (if scope classification changes).
- Feature Specification.
- Acceptance Criteria.
- State Model or Permission Model (if states or consent rules change).
- Content Model (if terminology or labels change).
- Engineering Brief, System Architecture, or Data Model (if product boundaries change).

---

## Open Questions

- Is the current requirement density appropriate, or does it duplicate capability descriptions from Product Architecture too closely?
- Should batch decision review be added as a requirement if Product Architecture leaves it unresolved?
- How should manual edits to canonical Markdown be detected and protected at the product level before engineering defines the implementation?
- Should generation reports persist as durable history or remain latest-only?
- What is the minimum manual-edit protection needed for MVP, and how should it be expressed as a functional requirement?
- Should output browsing (FR-029) be promoted from preferred to core MVP if users cannot find generated files?
- Which provider modes (local, remote, mock, fixture, custom) should be individually specified as requirements?
- How should the product behave when a user manually deletes or moves generated files outside the TUI?
- Should search/retrieval (FR-047) be included in a near-term post-MVP candidate list?
- Do HTML artifacts and agent packs need separate functional requirements for accessibility, or should that remain a non-functional concern?

---

## Downstream Handoff

### Feature Specification

Feature Specification must convert each active requirement into concrete MVP behavior, including:

- TUI input routing for slash commands versus conversation.
- `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai`, `/help`, `/exit` behavior.
- Decision proposal, review, confirmation, revision, and deferral flows.
- Generation confirmation and reporting.
- Diagnostics and validation flows.
- Configuration flows for documentation root and AI provider.
- Error recovery and continuation flows.
- Unknown and assume-for-now handling.
- User correction flows.

Feature Specification must not introduce hosted collaboration, task-board workflows, autonomous execution, or broad external research automation.

### Acceptance Criteria

Acceptance Criteria must verify:

- Users can initialize, continue, generate, diagnose, validate, and configure from the target repository.
- `logos/` is the default documentation root and is configurable.
- AI-led intake does not require deterministic question IDs.
- AI output remains proposed/advisory until user review.
- Confirmed decisions require explicit user confirmation.
- Unknown answers create useful open questions without blocking safe progress.
- Assume-for-now answers remain visible as assumptions.
- Generation reports created, updated, skipped, incomplete, blocked, and failed outputs.
- Diagnostics and validation do not mutate confirmed decisions.
- Remote provider usage is disclosed and configurable.
- Raw provider tokens are not stored in project files.
- Root changes show old root, new root, and stale-output implications.
- Errors preserve state and provide recovery paths.
- Derived outputs are labeled and not treated as canonical.

### Non-Functional Requirements

Non-Functional Requirements must inherit local-first defaults, Git-friendly text outputs, explicit provider configuration, privacy safeguards, safe regeneration behavior, auditability, and no hidden remote state.

### Engineering Brief and System Architecture

Engineering must inherit:

- Local-first, repository-directory, text-based, profile-driven direction.
- Standard profile as the first bundled profile, with active profile id/version/source represented explicitly for future compatibility.
- Explicit AI boundaries.
- Configurable LOGOS documentation root defaulting to `logos/`.
- Canonical Markdown outputs and derived HTML artifacts and agent packs.
- Structured state as product source input.
- Deterministic validation separate from AI-assisted diagnostics.
- No raw token storage in project files.

### Data Model

Data Model must define product object lifecycles for all objects listed in Information Architecture and Data Requirements, preserving:

- Local-first inspectability.
- Git-friendly text state where appropriate.
- Configurable documentation root.
- No raw token storage.
- Separation between canonical source and derived outputs.
- Regeneration traceability.

### API Contracts

API Contracts must preserve interaction semantics:

- Command handlers return structured results with status, messages, affected objects, state changes, and recovery options.
- AI interpretation APIs return proposed, advisory, or needs-review output.
- Generation APIs return file-level and category-level results.
- Diagnostics APIs return findings with severity, affected object, and next action.
- Provider APIs separate configuration status from raw secret values.
- State-changing APIs make confirmation requirements explicit.
- Recovery APIs report preserved state and partial completion.

### Operations

Operating Model must eventually define:

- Profile maintenance and quality review.
- Support for provider setup problems.
- Handling user reports about lost files or overwrite confusion.
- Release notes for breaking profile or requirement changes.
