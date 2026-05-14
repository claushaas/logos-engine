# Information Architecture

## IA Thesis

LOGOS Engine's information architecture should organize the product around project clarity state: the repository context, configured LOGOS documentation root, profile, phase, document contracts, decisions, assumptions, open questions, risks, diagnostics, and generated outputs that together explain what the project knows and what remains unresolved.

The IA must help users understand:

- Where they are: active repository, active profile, active phase, active document or flow.
- What exists: workspace state, decisions, assumptions, open questions, risks, canonical documents, derived HTML artifacts, derived agent packs, diagnostics, and configuration.
- What is authoritative: structured state, confirmed decisions, document contracts, and canonical Markdown under the configured LOGOS documentation root.
- What is generated: canonical Markdown, HTML artifacts, agent packs, diagnostics, and reports.
- What can be resumed: unfinished intake, proposed decisions, incomplete documents, diagnostics, validation gaps, and previous generation status.
- What can be trusted: content with visible source, status, confidence, and relationship to canonical source.

The organizing logic is repository-first, profile-guided, state-backed, and output-aware. The user begins in a target repository, chooses or accepts a documentation root that defaults to `logos/`, uses a profile to define what should exist, builds structured state through conversation and review, and generates local outputs from that state.

The IA reinforces the UX mental model that LOGOS is a local decision and documentation engine, not a generic chatbot, dashboard, task manager, or autonomous agent. It must make conversation useful without making chat history the navigation model or source of truth.

The IA must avoid becoming:

- A file tree with no product meaning.
- A chat transcript with hidden state.
- A task board or project management hierarchy.
- A dashboard that treats derived views as canonical.
- An implementation data model exposed as user vocabulary.
- A rigid questionnaire where document sections are the only navigation path.

This IA is a product hypothesis based on founder-origin experience, existing Foundation and Product documents, Validation constraints, and old project material. It is not externally validated user behavior.

## Core Objects

### OBJ-001: Repository Workspace

**User-facing definition:** The local repository where LOGOS is currently running and where LOGOS-related state and generated documentation belong.

**Purpose:** Anchor all project clarification, configuration, state, and generated outputs to a specific local project context.

**Classification:** MVP / user-facing / local context.

**Key properties:**

- Repository path.
- Initialization status.
- Active LOGOS workspace state.
- Configured LOGOS documentation root.
- Active profile.
- Provider configuration status.
- Last known status summary.

**Lifecycle states:**

- Not detected.
- Detected but uninitialized.
- Initialized.
- Active.
- Inconsistent or requires recovery.

**Ownership:** The user owns the repository and decides whether LOGOS may initialize or write inside it.

**Visibility:** Always visible in status and before write operations.

**Permissions relevance:** High. Initialization, writes, output-root changes, and destructive recovery depend on repository context.

**Created by:** User action through `/init` or first-run initialization.

**Modified by:** Configuration changes, profile selection, state updates, generation, diagnostics.

**Archived or deleted by:** Outside current MVP scope as a product action; local files may be removed manually by the user.

**Related objects:** LOGOS Workspace State, LOGOS Documentation Root, Profile, Phase, Canonical Document, Derived Artifact, AI Provider Configuration.

**Evidence basis:** Product Scope, User Journeys, UX Model, Foundation Boundaries.

**Downstream implications:** UI Model must show active repository. Permission Model must require confirmation before writing when repository context is uncertain.

**Open questions:** How much repository metadata should be displayed before it becomes noise?

### OBJ-002: LOGOS Workspace State

**User-facing definition:** The local structured state LOGOS uses to remember project answers, decisions, assumptions, open questions, risks, diagnostics, profile selection, and output status.

**Purpose:** Preserve continuity, traceability, regeneration, diagnostics, and re-entry without relying on chat memory.

**Classification:** MVP / system-facing with user-visible summaries.

**Key properties:**

- Workspace identifier.
- Active profile.
- Configured LOGOS documentation root.
- Conversation summaries.
- Decisions.
- Assumptions.
- Open questions.
- Risks.
- Diagnostics.
- Document status.
- Generation history.
- Provider status reference without raw secrets.

**Lifecycle states:**

- Missing.
- Created.
- Active.
- Partially updated.
- Requires recovery.
- Deprecated by migration.

**Ownership:** The user owns local workspace state; LOGOS manages it.

**Visibility:** Summarized through status, diagnostics, and continuation views. Raw implementation structure should not become normal user navigation.

**Permissions relevance:** Medium to high. State updates are local writes; repair and migration require care.

**Created by:** Initialization.

**Modified by:** Intake, decision review, generation, diagnostics, configuration, recovery.

**Archived or deleted by:** User manually or future workspace management; not a primary MVP flow.

**Related objects:** Repository Workspace, Decision Registry, Assumption, Open Question, Diagnostic Finding, Generation Report.

**Evidence basis:** Product Scope, UX Model, old system architecture.

**Downstream implications:** State Model must define lifecycle and integrity rules. Engineering Data Model must separate user-facing concepts from storage schema.

**Open questions:** How much raw state inspection should be exposed to advanced users?

### OBJ-003: LOGOS Documentation Root

**User-facing definition:** The repository folder where LOGOS writes generated canonical Markdown documents and derived outcomes. The default is `logos/`, and the user may configure another folder.

**Purpose:** Give generated LOGOS documentation a predictable, inspectable, configurable home without assuming the repository's existing documentation folder is available.

**Classification:** MVP / configuration / user-facing.

**Key properties:**

- Root path.
- Default or custom status.
- Existence status.
- Collision or overwrite risk.
- Canonical document locations.
- Derived HTML artifact locations.
- Derived agent pack locations.

**Lifecycle states:**

- Proposed default.
- Accepted default.
- Custom configured.
- Valid.
- Invalid or inaccessible.
- Collision risk.

**Ownership:** User-owned configuration.

**Visibility:** Always visible before generation and in status.

**Permissions relevance:** High. Changing this object affects write paths and output discovery.

**Created by:** Initialization or configuration.

**Modified by:** User configuration.

**Archived or deleted by:** User configuration change or manual filesystem action.

**Related objects:** Repository Workspace, Canonical Document, HTML Artifact, Agent Pack, Generation Report.

**Evidence basis:** Foundation Glossary, Product Scope, User Journeys, UX Model.

**Downstream implications:** UI Model must distinguish default and custom roots. Permission Model must gate changes. Acceptance Criteria must verify no hard-coded generated documentation path.

**Open questions:** Whether `logos/` remains the best default after user testing is unvalidated.

### OBJ-004: Profile

**User-facing definition:** The selected documentation system that defines phases, document contracts, outputs, completion criteria, quality checks, and review rules.

**Purpose:** Tell LOGOS what kind of project documentation structure should be generated and reviewed.

**Classification:** MVP / user-facing concept / system contract.

**Key properties:**

- Profile id.
- Name.
- Version.
- Phases.
- Document contracts.
- Output definitions.
- Completion criteria.
- Quality checks.
- Review rules.

**Lifecycle states:**

- Available.
- Selected.
- Active.
- Invalid.
- Deprecated.

**Ownership:** Profile definitions are product-maintained or future user/community-maintained; profile selection is user-owned.

**Visibility:** Visible during initialization, status, generation, diagnostics, and advanced review.

**Permissions relevance:** Medium. Profile selection changes what may be generated but does not by itself send data or overwrite files.

**Created by:** Product or future profile authoring process.

**Modified by:** Product/profile maintainers; not normal MVP user flow.

**Archived or deleted by:** Profile governance; deferred.

**Related objects:** Phase, Document Contract, Canonical Document, HTML Artifact, Agent Pack, Diagnostic Finding.

**Evidence basis:** Profile YAMLs, Product Scope, Foundation Principles.

**Downstream implications:** Feature Specification must treat profile YAML as contract input. Content Model must use profile terminology consistently.

**Open questions:** Future profile governance and user-authored profiles are deferred.

### OBJ-005: Phase

**User-facing definition:** A major area of project clarification, such as Foundation, Validation, or Product, containing related document contracts.

**Purpose:** Help users orient progress and review documentation in coherent groups.

**Classification:** MVP / user-facing / profile-defined.

**Key properties:**

- Phase id.
- Name.
- Order.
- Status.
- Document contracts.
- Dependencies.
- Readiness.
- Diagnostics.

**Lifecycle states:**

- Not started.
- In progress.
- Partially generated.
- Blocked.
- Ready with caveats.
- Complete enough for next step.

**Ownership:** Defined by profile; progress is user/project-owned.

**Visibility:** Visible in status, navigation, diagnostics, and generation reports.

**Permissions relevance:** Low by itself; phase actions may trigger writes or AI use.

**Created by:** Profile.

**Modified by:** Profile updates and project progress.

**Archived or deleted by:** Profile governance; not MVP user flow.

**Related objects:** Document Contract, Canonical Document, Decision, Diagnostic Finding, Validation Gap.

**Evidence basis:** Profile YAMLs, Product Scope, User Journeys.

**Downstream implications:** IA and UI Model must make phase progress useful without turning the product into a checklist-only wizard.

**Open questions:** Whether users think in phases or documents first is unvalidated.

### OBJ-006: Document Contract

**User-facing definition:** The structured definition of what a document is for, what sections it needs, what it depends on, what outputs it generates, and how it should be reviewed.

**Purpose:** Constrain generation and review so documents are not arbitrary AI prose.

**Classification:** MVP / system-facing with advanced user visibility.

**Key properties:**

- Document id.
- Title.
- Purpose.
- Central question.
- Dependencies.
- Canonical path relative to documentation root.
- HTML artifact definitions.
- Agent pack definitions.
- Sections.
- Completion criteria.
- Quality checks.
- Review rules.

**Lifecycle states:**

- Defined.
- Active.
- Invalid.
- Deprecated.

**Ownership:** Profile-owned contract; user uses the contract through generation and review.

**Visibility:** Summarized in normal flow; inspectable in advanced flow.

**Permissions relevance:** Low directly; outputs defined by contract may require write confirmation.

**Created by:** Profile author.

**Modified by:** Profile author or product maintainers.

**Archived or deleted by:** Profile governance.

**Related objects:** Profile, Phase, Canonical Document, HTML Artifact, Agent Pack, Diagnostic Finding.

**Evidence basis:** Profile YAMLs, Foundation Glossary, UX Model.

**Downstream implications:** Engineering Data Model must preserve contract metadata. Content Model must use contract language for document-specific guidance.

**Open questions:** How much contract detail should normal users see?

### OBJ-007: Canonical Document

**User-facing definition:** A generated or refreshed Markdown document under the configured LOGOS documentation root that carries reviewable project content for a defined purpose.

**Purpose:** Provide the main human-readable review surface for project knowledge.

**Classification:** MVP / generated / user-facing / canonical rendered output.

**Key properties:**

- Document id.
- Title.
- Path under configured root.
- Phase.
- Source contract.
- Source state.
- Completion status.
- Assumptions.
- Open questions.
- Last generated timestamp or generation status.
- Manual edit risk where detectable.

**Lifecycle states:**

- Not generated.
- Draft generated.
- Incomplete.
- Updated.
- Stale relative to state.
- Blocked.
- Reviewed.

**Ownership:** User owns the document; LOGOS generates and refreshes it.

**Visibility:** High. Canonical documents are primary outputs.

**Permissions relevance:** High for create, update, overwrite, and manual-content preservation.

**Created by:** Generation.

**Modified by:** Generation, regeneration, or manual user edits.

**Archived or deleted by:** User manually or future archive operation; not a core MVP action.

**Related objects:** Document Contract, Decision, Assumption, Open Question, Risk, Diagnostic Finding, HTML Artifact, Agent Pack.

**Evidence basis:** Product Scope, Foundation Glossary, UX Model, User Journeys.

**Downstream implications:** UI Model must distinguish canonical documents from derived artifacts. Acceptance Criteria must verify caveats and incomplete states remain visible.

**Open questions:** How should manual edits and regeneration boundaries be represented?

### OBJ-008: Decision

**User-facing definition:** A structured statement of project intent, constraint, direction, or commitment that affects documents, validation, or downstream execution.

**Purpose:** Serve as the primary unit of project clarity.

**Classification:** MVP / user-facing / canonical state.

**Key properties:**

- Decision id.
- Statement.
- Status.
- Source.
- Confidence.
- Affected documents.
- Dependencies.
- Superseded-by or supersedes relationship.
- Review history.

**Lifecycle states:**

- Proposed.
- Confirmed.
- Rejected.
- Deferred.
- Deprecated.
- Superseded.

**Ownership:** User-owned. AI may propose but cannot confirm.

**Visibility:** High when relevant to intake, generation, diagnostics, or affected documents.

**Permissions relevance:** Medium. Confirmation changes canonical project state.

**Created by:** AI interpretation, user entry, or document review.

**Modified by:** User confirmation, revision, rejection, deferral, or future decision updates.

**Archived or deleted by:** Deprecation or supersession; silent deletion is discouraged.

**Related objects:** Decision Registry, Assumption, Open Question, Canonical Document, Diagnostic Finding, Validation Gap.

**Evidence basis:** Glossary, Product Scope, UX Model, old decision registry docs.

**Downstream implications:** State Model must define statuses and transitions. Interaction Model must define review and confirmation flows.

**Open questions:** What is the smallest decision unit that avoids both over-fragmentation and vague prose?

### OBJ-009: Decision Registry

**User-facing definition:** The organized set of project decisions and their statuses, sources, dependencies, and affected documents.

**Purpose:** Make project choices traceable, reviewable, and reusable across documents and sessions.

**Classification:** MVP / system-facing with user-facing summaries.

**Key properties:**

- Decision list.
- Status grouping.
- Source references.
- Affected documents.
- Dependencies and conflicts.
- Revision history.

**Lifecycle states:**

- Empty.
- Populated with proposals.
- Partially confirmed.
- Updated.
- Has conflicts.
- Requires review.

**Ownership:** User owns the meaning of decisions; LOGOS manages the registry.

**Visibility:** Summary visible in status, diagnostics, and review flows; detailed view may be advanced.

**Permissions relevance:** Medium.

**Created by:** Workspace initialization and first decision capture.

**Modified by:** Intake, AI interpretation, review, revision, diagnostics.

**Archived or deleted by:** Not a normal MVP user-facing action; individual decisions may be deprecated.

**Related objects:** Decision, Assumption, Open Question, Diagnostic Finding, Canonical Document.

**Evidence basis:** Foundation Glossary, old architecture docs, UX Model.

**Downstream implications:** State Model and Engineering Data Model must separate registry from chat history.

**Open questions:** Whether users need a dedicated decision registry view in MVP is unvalidated.

### OBJ-010: Assumption

**User-facing definition:** A statement accepted temporarily for planning even though it has not been validated as fact.

**Purpose:** Allow progress without creating false certainty.

**Classification:** MVP / user-facing / canonical state.

**Key properties:**

- Assumption id.
- Statement.
- Evidence basis.
- Confidence or strength.
- Expiration or revisit trigger.
- Affected documents.
- Related decisions or hypotheses.

**Lifecycle states:**

- Proposed.
- Accepted for now.
- Needs validation.
- Replaced by evidence.
- Rejected.
- Deprecated.

**Ownership:** User-owned; AI may suggest or classify.

**Visibility:** High in generated documents, diagnostics, and validation contexts.

**Permissions relevance:** Medium when accepting assumptions affects generated content.

**Created by:** User answer, AI interpretation, unknown answer handling, diagnostics.

**Modified by:** User review, validation evidence, decision changes.

**Archived or deleted by:** Rejection, replacement, or deprecation.

**Related objects:** Decision, Open Question, Validation Gap, Canonical Document, Diagnostic Finding.

**Evidence basis:** Glossary, UX Model, Validation Strategy.

**Downstream implications:** Content Model must prevent assumptions from sounding like facts.

**Open questions:** How much assumption metadata is useful before it feels heavy?

### OBJ-011: Open Question

**User-facing definition:** A known unresolved question that requires user input, evidence, deferral, or future validation.

**Purpose:** Preserve uncertainty as actionable project state.

**Classification:** MVP / user-facing / canonical state.

**Key properties:**

- Question id.
- Question text.
- Source.
- Related phase or document.
- Priority.
- Blocking status.
- Suggested next action.
- Related assumptions or decisions.

**Lifecycle states:**

- New.
- Active.
- Deferred.
- Answered.
- Converted to assumption.
- Closed.

**Ownership:** User owns the answer; LOGOS manages routing and visibility.

**Visibility:** High when blocking progress, diagnostics, or generation.

**Permissions relevance:** Low directly; answering may update state.

**Created by:** User uncertainty, AI interpretation, diagnostics, validation checks.

**Modified by:** User answers, deferral, conversion to assumption, generation review.

**Archived or deleted by:** Closure or replacement.

**Related objects:** Assumption, Decision, Diagnostic Finding, Canonical Document, Phase.

**Evidence basis:** User Journeys, UX Model, old intake docs.

**Downstream implications:** Interaction Model must route open questions into small clusters. UI Model must show unresolved questions without overwhelming the user.

**Open questions:** What priority model best separates blocking from useful-later questions?

### OBJ-012: Risk

**User-facing definition:** A potential issue that could harm project clarity, validation, execution, trust, or product boundaries.

**Purpose:** Keep risk visible enough to guide decisions and diagnostics.

**Classification:** MVP / user-facing / canonical state.

**Key properties:**

- Risk id.
- Statement.
- Type.
- Severity.
- Affected documents.
- Related assumptions or decisions.
- Mitigation.
- Evidence basis.

**Lifecycle states:**

- Identified.
- Active.
- Mitigated.
- Accepted.
- Deferred.
- Closed.

**Ownership:** User owns risk acceptance; LOGOS identifies and explains risks.

**Visibility:** High for severe or decision-affecting risks; contextual for lower risks.

**Permissions relevance:** Low directly; severe risks may gate generation or validation readiness.

**Created by:** User input, AI interpretation, diagnostics, validation checks.

**Modified by:** Mitigation, evidence, decision changes, user acceptance.

**Archived or deleted by:** Closure, mitigation, or deprecation.

**Related objects:** Decision, Assumption, Diagnostic Finding, Validation Gap, Canonical Document.

**Evidence basis:** Product Scope, Validation Report, UX Model.

**Downstream implications:** Acceptance Criteria must include severe-risk visibility. Content Model must avoid alarmist risk language.

**Open questions:** Severity taxonomy needs validation through actual diagnostics usage.

### OBJ-013: Diagnostic Finding

**User-facing definition:** A system explanation of what is missing, contradictory, risky, blocked, incomplete, or recommended next in the current project state.

**Purpose:** Help the user understand readiness and next useful action.

**Classification:** MVP / generated / user-facing.

**Key properties:**

- Finding id.
- Severity.
- Type.
- Message.
- Affected object or document.
- Evidence basis.
- Recommended next action.
- Blocking status.

**Lifecycle states:**

- New.
- Active.
- Acknowledged.
- Resolved.
- Deferred.
- Superseded.

**Ownership:** LOGOS generates findings; user decides how to act.

**Visibility:** High, grouped by severity and affected area.

**Permissions relevance:** Low directly; may influence gated actions.

**Created by:** `/diagnose`, `/validate`, `/status`, generation checks, or contextual review.

**Modified by:** State changes, reruns, user acknowledgement, resolution.

**Archived or deleted by:** Resolution or supersession.

**Related objects:** Decision, Assumption, Open Question, Risk, Canonical Document, Phase, Generation Report.

**Evidence basis:** Product Scope, User Journeys, UX Model, old diagnostics docs.

**Downstream implications:** UI Model must make diagnostics scannable. Interaction Model must route findings to next questions or actions.

**Open questions:** How much AI-assisted interpretation should be mixed with deterministic diagnostics in the visible IA?

### OBJ-014: AI Provider Configuration

**User-facing definition:** The configuration that enables AI-led intake, interpretation, drafting, and diagnostics while disclosing provider mode and protecting secrets.

**Purpose:** Make AI availability and data movement understandable and consent-based.

**Classification:** MVP / configuration / user-facing.

**Key properties:**

- Provider mode.
- Configuration status.
- Token source status, redacted.
- Local or remote implication.
- Last test status.
- Blocking errors.

**Lifecycle states:**

- Not configured.
- Configured.
- Invalid.
- Temporarily unavailable.
- Disabled.

**Ownership:** User-owned configuration.

**Visibility:** Visible before AI-required operations and in status.

**Permissions relevance:** High for remote provider use and token safety.

**Created by:** `/config ai` or setup flow.

**Modified by:** User configuration.

**Archived or deleted by:** User disables or changes configuration.

**Related objects:** Repository Workspace, Intake Conversation, Decision Proposal, Diagnostic Finding.

**Evidence basis:** Product Scope, UX Model, Foundation Boundaries.

**Downstream implications:** Permission Model must define remote context disclosure. UI Model must show enough status without exposing secrets.

**Open questions:** Which provider modes should be visible in MVP versus advanced settings?

### OBJ-015: Intake Conversation

**User-facing definition:** The AI-led clarification exchange where the user describes the project and answers small clusters of context-aware questions.

**Purpose:** Capture ambiguous intent and convert it into structured reviewable state.

**Classification:** MVP / user-facing input flow / not canonical source by itself.

**Key properties:**

- Conversation turn summaries.
- Raw user answers where needed.
- AI question clusters.
- Source references for proposals.
- Current focus.
- Pending follow-ups.

**Lifecycle states:**

- Not started.
- Active.
- Paused.
- Waiting for review.
- Continued.
- Superseded by structured state.

**Ownership:** User owns provided context; LOGOS manages interpretation.

**Visibility:** High during intake; summarized for continuation.

**Permissions relevance:** High when conversation context may be sent to a remote AI provider.

**Created by:** User starts or continues intake.

**Modified by:** User answers, AI follow-ups, summaries, review.

**Archived or deleted by:** Not defined in MVP; retention policy belongs downstream.

**Related objects:** AI Provider Configuration, Decision, Assumption, Open Question, Risk, Decision Proposal.

**Evidence basis:** Product Scope, User Journeys, UX Model, old interaction flows.

**Downstream implications:** Interaction Model must prevent chat transcript from becoming source of truth. State Model must define what is retained.

**Open questions:** How much raw conversation should be retained locally?

### OBJ-016: Generation Report

**User-facing definition:** A report that explains what generation created, updated, skipped, blocked, or left incomplete.

**Purpose:** Make generated output changes inspectable and recoverable.

**Classification:** MVP / generated / user-facing.

**Key properties:**

- Generation target root.
- Canonical documents created or updated.
- HTML artifacts created or updated.
- Agent packs created or updated.
- Skipped outputs.
- Blocked outputs.
- Incomplete outputs.
- Warnings.
- Next suggested action.

**Lifecycle states:**

- Pending.
- Completed.
- Partial.
- Failed.
- Superseded by newer generation.

**Ownership:** LOGOS generates; user interprets and acts.

**Visibility:** High immediately after generation and in status until superseded.

**Permissions relevance:** High when generation writes files or overwrites generated content.

**Created by:** `/generate` or confirmed generation flow.

**Modified by:** New generation run.

**Archived or deleted by:** Supersession or workspace cleanup.

**Related objects:** Canonical Document, HTML Artifact, Agent Pack, Diagnostic Finding, LOGOS Documentation Root.

**Evidence basis:** User Journeys, UX Model, Product Scope.

**Downstream implications:** Acceptance Criteria must require created, updated, skipped, incomplete, and blocked categories.

**Open questions:** Whether generation reports should be persisted as canonical history is unresolved.

### OBJ-017: HTML Artifact

**User-facing definition:** A derived HTML output generated from canonical documents and document contracts for navigation, review, or presentation support.

**Purpose:** Improve review and navigation without becoming the source of truth.

**Classification:** MVP support / derived artifact / user-facing.

**Key properties:**

- Artifact id.
- Path under configured LOGOS documentation root.
- Source canonical document.
- Source contract.
- Generation mode.
- Last generation status.

**Lifecycle states:**

- Not generated.
- Generated.
- Stale.
- Failed.
- Superseded.

**Ownership:** User owns local files; LOGOS regenerates them.

**Visibility:** Medium. Visible in generation reports and output lists, not as canonical state.

**Permissions relevance:** Medium to high for file writes.

**Created by:** Generation from canonical content.

**Modified by:** Regeneration.

**Archived or deleted by:** User manually or future cleanup.

**Related objects:** Canonical Document, Document Contract, Generation Report, LOGOS Documentation Root.

**Evidence basis:** Profile YAMLs, Product Scope, UX Model.

**Downstream implications:** UI and Content Models must label HTML artifacts as derived.

**Open questions:** Whether HTML artifacts are valuable enough for MVP user workflows is validation-required.

### OBJ-018: Agent Pack

**User-facing definition:** A derived execution-oriented Markdown artifact that packages canonical project context for an AI or coding agent.

**Purpose:** Support downstream review or implementation work without relying on private chat history.

**Classification:** MVP support / derived artifact / user-facing for advanced use.

**Key properties:**

- Agent pack id.
- Path under configured LOGOS documentation root.
- Agent role.
- Included source documents.
- Review rules.
- Generation mode.
- Last generation status.

**Lifecycle states:**

- Not generated.
- Generated.
- Stale.
- Failed.
- Superseded.

**Ownership:** User owns local files; LOGOS regenerates them.

**Visibility:** Medium. Visible in generation reports and output lists, with derived status.

**Permissions relevance:** Medium to high for file writes and context sensitivity.

**Created by:** Generation from canonical documents and document contracts.

**Modified by:** Regeneration.

**Archived or deleted by:** User manually or future cleanup.

**Related objects:** Canonical Document, Document Contract, Generation Report, LOGOS Documentation Root.

**Evidence basis:** Foundation Glossary, Profile YAMLs, Product Scope, UX Model.

**Downstream implications:** Content Model must ensure agent packs preserve caveats and scope. Permission Model must consider whether packs contain sensitive project context.

**Open questions:** Whether users understand agent packs as derived outputs is unvalidated.

### OBJ-019: Validation Gap

**User-facing definition:** A missing or insufficient evidence point that prevents a project claim from being treated as externally validated.

**Purpose:** Prevent founder-origin assumptions and generated prose from becoming false evidence.

**Classification:** MVP / user-facing / validation state.

**Key properties:**

- Gap id.
- Claim or assumption affected.
- Evidence needed.
- Severity.
- Affected documents.
- Suggested validation action.

**Lifecycle states:**

- Identified.
- Active.
- Deferred.
- Evidence added.
- Resolved.

**Ownership:** User owns validation decisions; LOGOS identifies and tracks gaps.

**Visibility:** High in validation, diagnostics, and documents with unsupported claims.

**Permissions relevance:** Low directly.

**Created by:** Validation strategy, diagnostics, document review, user input.

**Modified by:** Evidence updates, decisions, deferrals.

**Archived or deleted by:** Resolution or accepted deferral.

**Related objects:** Assumption, Risk, Diagnostic Finding, Canonical Document, Evidence.

**Evidence basis:** Validation Report, Validation Strategy, UX Model.

**Downstream implications:** Content Model must prevent validation gaps from being hidden. Acceptance Criteria must test false-validation prevention.

**Open questions:** Whether validation gaps should be independent objects or diagnostic finding subtypes is unresolved.

### OBJ-020: Evidence

**User-facing definition:** A source, observation, experiment result, or internal note used to support or challenge a claim.

**Purpose:** Separate actual evidence from assumptions and generated reasoning.

**Classification:** MVP support / user-facing in validation contexts.

**Key properties:**

- Evidence id.
- Source type.
- Summary.
- Date.
- Related assumption or claim.
- Strength.
- Limitations.

**Lifecycle states:**

- Logged.
- Reviewed.
- Superseded.
- Rejected.

**Ownership:** User owns evidence interpretation; LOGOS organizes and references it.

**Visibility:** Contextual. High where validation claims are made.

**Permissions relevance:** Medium if evidence contains sensitive external or personal information.

**Created by:** User entry, experiment notes, imported material where explicitly provided.

**Modified by:** User review and updates.

**Archived or deleted by:** User action; not core MVP.

**Related objects:** Assumption, Validation Gap, Diagnostic Finding, Canonical Document.

**Evidence basis:** Validation documents.

**Downstream implications:** State Model must preserve evidence limitations. Content Model must avoid overstating evidence strength.

**Open questions:** External evidence ingestion is deferred; IA should not imply automatic research.

## Object Relationships

| ID | Source | Target | Relationship | Cardinality | User Visible | Lifecycle Behavior | Permission Implications | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REL-001 | Repository Workspace | LOGOS Workspace State | contains | one-to-one for MVP | yes | Workspace state is created or loaded inside the repository context. | Initialization and repair require write consent. | Repository context must be visible before writes. |
| REL-002 | Repository Workspace | LOGOS Documentation Root | configures output location | one-to-one active root | yes | Root may default to `logos/` or be changed by user configuration. | Changing root requires disclosure and confirmation. | Never assume another repository folder as generated output root. |
| REL-003 | LOGOS Workspace State | Profile | uses | one active profile for MVP | yes | Profile selection constrains phases, contracts, and outputs. | Changing profile may affect generated outputs. | Multi-profile composition is deferred. |
| REL-004 | Profile | Phase | defines | one-to-many | yes | Phases exist through profile definition. | Low direct permission impact. | Phase order supports orientation, not a rigid questionnaire. |
| REL-005 | Phase | Document Contract | groups | one-to-many | yes | Contracts are grouped under phases. | Low direct permission impact. | User sees contract summaries, not full YAML by default. |
| REL-006 | Document Contract | Canonical Document | renders | one-to-one per contract per workspace | yes | Canonical document may be not generated, incomplete, stale, or updated. | File creation and overwrite require write rules. | Path resolves under configured LOGOS documentation root. |
| REL-007 | Document Contract | HTML Artifact | defines derived output | zero-to-many | yes | Artifact regenerates from canonical source and contract. | File write consent follows generation rules. | Derived only. |
| REL-008 | Document Contract | Agent Pack | defines derived output | zero-to-many | yes | Pack regenerates from canonical source and contract. | May contain sensitive context; generation must be explicit. | Derived only. |
| REL-009 | Decision Registry | Decision | contains | one-to-many | partially | Registry groups decisions by status and relation. | Confirming decisions updates canonical state. | Registry details may be advanced. |
| REL-010 | Intake Conversation | Decision | proposes | many-to-many | yes | AI or user input may create proposed decisions. | User confirmation required before canonical decision status. | AI cannot confirm. |
| REL-011 | Intake Conversation | Assumption | identifies | many-to-many | yes | Unknown or provisional answers may become assumptions. | Accepting an assumption can affect generation. | Assumptions must stay visible. |
| REL-012 | Intake Conversation | Open Question | creates | many-to-many | yes | Unknowns and follow-ups become open questions. | Low direct permission impact. | Questions should be clustered by next usefulness. |
| REL-013 | Decision | Canonical Document | affects | many-to-many | yes | Document status may become stale when decisions change. | Regeneration may write files. | Affected documents should be visible on change. |
| REL-014 | Assumption | Canonical Document | qualifies | many-to-many | yes | Documents must preserve assumption labels until resolved. | Low direct permission impact. | Avoid treating assumptions as facts. |
| REL-015 | Open Question | Canonical Document | blocks or informs | many-to-many | yes | Open questions can make documents incomplete or caveated. | Low direct permission impact. | Blocking status must be visible. |
| REL-016 | Risk | Diagnostic Finding | surfaces through | many-to-many | yes | Active risks may produce findings. | Low direct permission impact. | Severe risks may block readiness. |
| REL-017 | Diagnostic Finding | Decision | references | many-to-many | yes | Findings may be resolved by confirming, revising, or deferring decisions. | Confirmation remains user-owned. | Findings do not mutate decisions silently. |
| REL-018 | Diagnostic Finding | Canonical Document | affects | many-to-many | yes | Findings identify incomplete or inconsistent documents. | Low direct permission impact. | Must include severity and next action. |
| REL-019 | Generation Report | Canonical Document | reports changes to | one-to-many | yes | New generation supersedes prior report status. | Write and overwrite disclosure required. | Report includes created, updated, skipped, incomplete, blocked. |
| REL-020 | Generation Report | HTML Artifact | reports changes to | zero-to-many | yes | Derived outputs may be generated, stale, or failed. | File write disclosure required. | Derived status must be clear. |
| REL-021 | Generation Report | Agent Pack | reports changes to | zero-to-many | yes | Derived outputs may be generated, stale, or failed. | Context sensitivity should be considered. | Derived status must be clear. |
| REL-022 | Validation Gap | Assumption | challenges | many-to-many | yes | Evidence may resolve, weaken, or replace assumptions. | Low direct permission impact. | Do not imply external validation. |
| REL-023 | Evidence | Validation Gap | resolves or informs | many-to-many | yes in validation context | Evidence can close or modify gaps. | Sensitive evidence handling may matter. | Automatic evidence gathering is deferred. |
| REL-024 | AI Provider Configuration | Intake Conversation | enables | one-to-many over time | yes | Missing provider blocks AI-led intake but not all local status review. | Remote use requires disclosure. | No raw token visibility. |

Deletion and archive behavior:

- Deleting or moving the repository is outside product control; LOGOS should report missing state rather than repair silently.
- Changing the documentation root does not delete prior generated outputs by default.
- Removing a profile, phase, or document contract is profile governance, not normal user action.
- Decisions should be deprecated or superseded rather than silently deleted.
- Derived artifacts may be regenerated or manually removed, but they must not be treated as the only copy of project knowledge.
- Diagnostic findings may be superseded by newer diagnostics once underlying state changes.

Implementation-only relationships should not be exposed as product objects unless they help the user understand trust, recovery, or consequences. Storage schema, file handles, prompt internals, provider adapters, and renderer internals belong to Engineering documents.

## Navigation Structure

The top-level navigation model is repository-context first, command-assisted, and state-oriented. The user should not have to understand internal modules to move through the product.

### Primary Entry Points

| Entry Point | User Goal | Initial Context | Primary Objects | Expected Next Move |
| --- | --- | --- | --- | --- |
| Open `logos` in repository | Start or resume project clarification | Repository Workspace | Workspace State, Profile, Documentation Root | Initialize, continue, check status |
| `/init` | Create local LOGOS workspace | Repository Workspace | Workspace State, Documentation Root, Profile | Accept/configure root and profile |
| `/continue` | Resume work | Existing Workspace State | Open Questions, Proposed Decisions, Diagnostics | Answer, review, generate |
| Natural language input | Clarify project intent | Intake Conversation | Assumptions, Open Questions, Decisions | Review proposals or answer follow-up |
| `/status` | Understand current state | Workspace State | Phase, Document, Decision, Diagnostic summaries | Continue, diagnose, generate, configure |
| `/generate` | Produce or refresh outputs | Document Contracts and State | Canonical Documents, HTML Artifacts, Agent Packs | Review report or diagnostics |
| `/diagnose` | Find gaps and contradictions | Current State | Diagnostic Findings, Risks, Open Questions | Resolve, defer, revise |
| `/validate` | Check readiness or validation gaps | Current State and Contracts | Validation Gaps, Diagnostics, Documents | Add evidence, mark assumption, defer |
| `/config ai` | Enable or inspect AI behavior | Provider Configuration | Provider status, consent boundaries | Configure, test, return |

### Navigation Axes

Users should be able to move by:

- **Current state:** what is incomplete, blocked, proposed, confirmed, stale, or ready.
- **Phase:** where in the profile-defined project structure the work belongs.
- **Document:** which canonical document or contract is affected.
- **Decision:** what choice needs review, confirmation, revision, or deferral.
- **Question:** what needs an answer next.
- **Diagnostic severity:** what most affects progress or trust.
- **Output category:** canonical Markdown, HTML artifact, agent pack, generation report.
- **Configuration:** documentation root and AI provider status.

### Location Cues

Every major state should make these cues available:

- Active repository.
- Active LOGOS documentation root.
- Active profile.
- Active phase or document when applicable.
- Current operation or command.
- State category: intake, review, generation, diagnostics, validation, configuration, recovery.
- Whether content is proposed, confirmed, assumed, incomplete, generated, derived, stale, or blocked.
- Next useful action.

### Movement Patterns

**Conversation to state:** User input creates summaries, assumptions, open questions, risks, and proposed decisions.

**State to review:** Proposed decisions and assumptions become reviewable objects.

**Review to generation:** Confirmed or accepted-for-now state can produce canonical documents and derived outputs.

**Generation to diagnostics:** Generated outputs can reveal incompleteness, stale state, or validation gaps.

**Diagnostics to next question:** Findings route the user to the smallest useful clarification step.

**Any state to status:** The user can request orientation without changing state.

**Any recoverable state to continue:** The user can leave and return without replaying the whole conversation.

### Blocked, Deferred, or Hidden Navigation

The IA should not expose these as primary MVP paths:

- Hosted team workspace navigation.
- Task boards, issue trackers, calendars, or project management views.
- External research automation.
- Profile marketplace navigation.
- Multi-user permissions surfaces.
- Autonomous execution queues.
- Full data-schema inspection as normal user navigation.

Advanced profile and state inspection may exist later, but it should not crowd the primary clarification journey.

## Content Hierarchy

### Global Hierarchy

The highest-priority information across the product is:

1. Active repository and configured LOGOS documentation root.
2. Current state and next useful action.
3. User-owned decision or consent point.
4. Critical risk, blocked state, overwrite risk, provider disclosure, or validation caveat.
5. Relevant phase, document, decision, assumption, question, or diagnostic context.
6. Secondary details and advanced configuration.
7. Implementation-only details, hidden unless needed for troubleshooting.

### Primary Content

Primary content is what the user needs to act now:

- Current question or decision proposal.
- Active blocker or diagnostic.
- Next suggested command or action.
- Generation result summary.
- Documentation root and file-write target before generation.
- Provider status before AI use.
- Confirm, revise, reject, defer, continue, generate, diagnose, or configure choices.

### Secondary Content

Secondary content supports understanding but should not dominate:

- Phase progress.
- Document readiness.
- Related assumptions.
- Related open questions.
- Affected documents.
- Recent generation summary.
- Prior diagnostic status.
- Profile name and version.

### Contextual Content

Contextual content appears when it changes interpretation:

- Why a question matters.
- Which document depends on an answer.
- Whether a statement is assumed, confirmed, proposed, or unsupported.
- Whether an output is canonical or derived.
- Whether a diagnostic is critical, important, or optional.
- Whether a root path is default or custom.

### Advanced Content

Advanced content should be discoverable but not always visible:

- Full document contract details.
- Complete profile structure.
- Detailed state references.
- Generation metadata.
- Provider technical settings.
- Diagnostic internals.
- Derived artifact regeneration rules.

### Hidden by Default

These should usually be hidden unless requested or needed for recovery:

- Internal storage filenames and schemas.
- Prompt internals.
- Provider adapter details.
- Low-level rendering internals.
- Historical conversation turns when summarized state is enough.
- Implementation-only object relationships.

### Must Never Be Hidden When Relevant

- Active repository before initialization or write operations.
- Active LOGOS documentation root before generation.
- Remote AI transmission implication before provider use.
- Raw token secrecy rules.
- File overwrite or collision risk.
- Proposed versus confirmed decision status.
- Assumption versus fact distinction.
- Low-confidence AI interpretation.
- Validation gaps and unsupported claims.
- Partial or failed generation.
- Canonical versus derived output status.
- Destructive or irreversible consequences.

### Adapting to Volume

For small volumes, show inline detail with clear labels.

For normal volumes, group by phase, document, severity, or status.

For large volumes, summarize first, then allow drill-down by affected document, severity, or object type.

For overloaded volumes, prioritize blocking items, severe risks, stale generated outputs, and user-owned decisions. Do not show every low-priority detail at the same level.

## Naming Rules

Foundation Glossary terms are the default source of truth. New labels should be introduced only when they make user understanding sharper.

### Canonical Naming Patterns

| Concept Type | Naming Pattern | Examples | Notes |
| --- | --- | --- | --- |
| Product context | Use concrete local terms | Repository Workspace, LOGOS Documentation Root | Avoid cloud workspace assumptions. |
| State objects | Use decision-language terms | Decision, Assumption, Open Question, Risk | Avoid generic notes/tasks. |
| Decision status | Use explicit state labels | Proposed, Confirmed, Rejected, Deferred, Deprecated | Never imply AI confirmation. |
| Document outputs | Separate authority and derivation | Canonical Document, HTML Artifact, Agent Pack | Derived outputs must be labeled. |
| Diagnostics | Use finding language | Diagnostic Finding, Validation Gap | Avoid grading language. |
| Configuration | Name by consequence | AI Provider Configuration, Documentation Root | Avoid hiding provider or path meaning. |
| Commands | Use slash-command names | `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai` | Commands should be stable anchors. |

### Preferred Terms

- LOGOS Documentation Root.
- Canonical Document.
- Canonical Source.
- Derived Artifact.
- HTML Artifact.
- Agent Pack.
- Decision.
- Proposed Decision.
- Confirmed Decision.
- Assumption.
- Open Question.
- Diagnostic Finding.
- Validation Gap.
- Repository Workspace.
- AI Provider Configuration.

### Discouraged or Banned Terms

| Avoid | Use Instead | Reason |
| --- | --- | --- |
| repository documentation folder | LOGOS Documentation Root | Avoid implying a hard-coded generated output location. |
| final document | Canonical Document | Documents may remain caveated or incomplete. |
| AI decision | Proposed Decision | AI does not own decisions. |
| chat memory | Workspace State or Intake Summary | Chat is not source of truth. |
| artifact source | Derived Artifact | Derived outputs are not canonical. |
| audit | Diagnostics or Validation Check | Avoid overclaiming authority. |
| grade | Diagnostic Finding | Avoid shame or false objectivity. |
| project manager | LOGOS Engine or local decision engine | Avoid scope creep. |
| dashboard | Status or Review View | Avoid hosted/SaaS mental model. |
| task | Decision, Open Question, or Next Action | Avoid project-management drift. |
| autonomous agent | AI-assisted workflow | Preserve user agency. |

### Naming Conflict Rules

- If a term appears in the Foundation Glossary, use the glossary meaning.
- If a term is overloaded, choose the more explicit phrase even if longer.
- If a term implies validation, authority, autonomy, or remote ownership, avoid it unless that implication is true.
- If a term is implementation-only, keep it out of user-facing IA unless it explains trust or recovery.
- If a generated output is derived, its label must include or imply derivation.

### Provisional Terms

These terms may need validation:

- Project clarity state.
- Repository Workspace.
- Diagnostic Finding.
- Validation Gap.
- Generation Report.

They are useful internally now, but user-facing wording should be tested for clarity.

## Search and Retrieval

Retrieval in MVP should favor scoped browsing, status, related links, recents, and command-based lookup over broad search intelligence. Full semantic search is not required for the core product promise.

### Retrieval Modes

| Mode | MVP Status | User Goal | Searchable or Retrievable Objects | Notes |
| --- | --- | --- | --- | --- |
| Browse by phase | MVP | Understand document structure and progress | Phases, document contracts, canonical documents | Supports profile orientation. |
| Browse by status | MVP | Find blockers, incomplete items, proposed decisions, stale outputs | Decisions, questions, diagnostics, documents | Supports continuation and recovery. |
| Browse by output type | MVP | Find canonical Markdown, HTML artifacts, agent packs | Generated outputs | Must distinguish canonical and derived. |
| Related items | MVP | See what a decision or diagnostic affects | Documents, decisions, assumptions, risks | Critical for traceability. |
| Recents | preferred / validation-required | Resume recent work | Recent phase, document, decision, diagnostic, generation report | Useful for re-entry but may be implemented simply. |
| Command lookup | MVP | Jump to status, generation, diagnostics, config | Commands and current context | Slash commands remain primary anchors. |
| Text search | deferred or basic | Find a phrase across local LOGOS content | Canonical documents and summaries | Must not overpromise intelligence. |
| Semantic search | deferred | Find concepts across project state | Decisions, documents, assumptions | Requires validation and engineering review. |

### Relevance Expectations

Results should be grouped before they are ranked:

1. Blocking or critical items.
2. Active proposed decisions.
3. Open questions.
4. Current phase or document items.
5. Stale or incomplete generated outputs.
6. Related assumptions and risks.
7. Older or resolved items.

The product should not imply that search has discovered all relevant project truth unless the retrieval scope is explicit.

### Zero-Results Behavior

Zero results must say what scope was searched and offer a useful next action:

- Broaden scope.
- Clear filters.
- Browse by phase.
- Check status.
- Create or answer an open question.
- Run diagnostics.

Zero results must not be confused with no-access, loading, error, or uninitialized states.

### What Is Not Searchable by Default

- Raw provider tokens.
- Hidden provider internals.
- Arbitrary repository files not explicitly included.
- Broad source code context.
- Private chat history beyond retained summaries.
- External research sources not provided by the user.

## Empty States

Empty states should explain what is absent, why it may be absent, and what the user can do next. They should not use fake positivity when absence indicates risk, misconfiguration, missing permission, or failure.

| Empty State Type | Example | Meaning | Useful Next Action | Must Not Imply |
| --- | --- | --- | --- | --- |
| New-user empty | No workspace state yet | LOGOS has not been initialized in this repository | Run `/init` or confirm repository | That the project is invalid |
| No documentation root selected | Root not accepted or configured | Output location is not ready | Accept `logos/` or configure another root | That generated files will go somewhere hidden |
| No AI provider configured | AI-led intake unavailable | Provider setup is required for AI operations | Run `/config ai` or inspect local status | That local state is broken |
| No decisions yet | No project choices captured | Intake has not produced reviewable decisions | Describe the project or continue intake | That there is nothing valuable to do |
| No proposed decisions | Nothing pending review | Current proposals are resolved or not created | Continue intake or generate if ready | That all decisions are complete |
| No open questions | No unresolved questions currently known | The system has no known unanswered questions | Generate, diagnose, or continue | That the project is fully validated |
| No canonical documents generated | Output has not been rendered | State may exist but files are not created | Run `/generate` when ready | That state is absent |
| No derived artifacts generated | HTML or agent packs are absent | Derived outputs have not been generated or are deferred | Generate outputs or review canonical docs | That canonical docs are missing |
| Zero search results | Query matched nothing in scope | The selected scope has no match | Clear filters or browse by phase/status | That the content does not exist elsewhere |
| Filtered empty | Filters exclude all items | Results exist outside current filter | Clear or change filters | That state is missing |
| Permission empty | Cannot read or write path | Access or path issue blocks display/action | Fix permissions or change root | That the project has no content |
| Loading empty | Operation pending | Results are not ready yet | Wait or cancel where available | That no results exist |
| Error empty | Operation failed | State could not be loaded or generated | Review error and recovery path | That absence is normal |
| Intentionally empty | A deferred or out-of-scope area has no content | The object is not part of current scope | Explain deferral or boundary | That hidden functionality exists |

Empty state tone should be calm and specific. It should name the absent object and the next useful action, not motivate through urgency or shame.

## Information Density Rules

### Density by Hierarchy Level

| Level | Default Density | Detail Strategy | Examples |
| --- | --- | --- | --- |
| Global orientation | Very low | Show only current repository, root, profile, state category, next action | Status header, command context |
| Current action | Low to medium | Show the question, proposal, warning, or result needed now | Intake prompt, decision review |
| Object summary | Medium | Show status, purpose, affected objects, next action | Document card/list item, diagnostic summary |
| Object detail | Medium to high | Show full properties needed for review | Decision detail, diagnostic detail |
| Advanced inspection | High | Allow contract/state detail for power users | Profile contract, generation metadata |
| Recovery state | Low first, expandable | Show what failed, preserved state, next safe action | Error recovery |

### Density by User Expertise

New users should see fewer objects at once and more explanatory labels:

- Repository.
- Documentation root.
- Profile.
- Next question.
- Proposed decision.
- Generate or diagnose action.

Experienced users may need denser summaries:

- Phase readiness.
- Document status.
- Decision counts by status.
- Open questions by severity.
- Generation report history.
- Advanced configuration.

The product should not require users to choose an expertise mode before it has enough signal. Density can adapt through command use and advanced disclosure.

### Density by Journey State

**Onboarding:** Keep density low. Show repository, root, profile, provider status, and next safe action.

**Intake:** Show the current question cluster, why it matters, and any proposed state changes. Avoid showing the whole phase map unless requested.

**Decision review:** Show proposal, status, evidence basis, affected documents, and choices. Hide unrelated decisions.

**Generation:** Show target root and output categories before action; show report after action.

**Diagnostics:** Group by severity and affected document. Avoid long flat lists.

**Recovery:** Show failure, preserved state, and next safe action first. Technical detail can expand.

**Repeat use:** Show what changed or remains unresolved before showing full history.

### Density by Risk

Risk-critical content overrides density reduction. The product must not hide:

- Path consequences.
- Remote provider consequences.
- Overwrite risk.
- Severe diagnostics.
- Validation gaps.
- Low-confidence AI interpretation.
- Proposed versus confirmed status.
- Canonical versus derived output status.

### Provisional Numeric Rules

These limits are provisional and should be validated:

- Intake should usually ask no more than three primary questions in a cluster.
- Status summaries should highlight no more than five next-action candidates, with one recommended next action.
- Diagnostic summaries should show critical findings first, then allow expansion by severity.
- Generation reports should summarize output counts before listing file-level detail.
- Long lists should group by phase, document, status, or severity before requiring search.

These are UX/IA guidelines, not hard implementation constraints until validated.

## IA Risks

| Risk | Affected Object or View | Risk Type | User Impact | Early Signal | Mitigation | Target Document |
| --- | --- | --- | --- | --- | --- | --- |
| Users confuse workspace state with generated documents | Workspace State, Canonical Document | Object ambiguity | They may edit or trust the wrong thing | Questions about where truth lives | Label source-of-truth roles and generation rules | State Model, UI Model |
| Users confuse `.logos` internal state with `logos/` documentation root | Workspace State, Documentation Root | Naming/path ambiguity | They may inspect or move the wrong folder | Root/path support questions | Use LOGOS Documentation Root consistently and show paths | Content Model, Permission Model |
| Users expect generated outputs in an existing documentation folder | Documentation Root | Path expectation | Files seem missing or surprising | User asks why output is not in repository docs | Explain `logos/` default and configurability | UI Model, Acceptance Criteria |
| Derived artifacts appear canonical | HTML Artifact, Agent Pack | Authority ambiguity | User acts on stale or presentation-first output | Agent pack or HTML edited as truth | Label derived status and source canonical document | Content Model, Acceptance Criteria |
| Chat becomes the navigation model | Intake Conversation | IA drift | State becomes hard to resume or validate | User must scroll chat to find decisions | Route conversation into structured objects | Interaction Model, State Model |
| Too many object types overwhelm users | Global navigation | Cognitive load | Product feels bureaucratic | Users ignore status or diagnostics | Progressive disclosure and small clusters | UI Model |
| Phase navigation becomes a rigid questionnaire | Phase, Document Contract | Navigation trap | Users answer mechanically or abandon | Users treat every section as required before value | Keep conversation and next action primary | Interaction Model |
| Diagnostics become a noisy list | Diagnostic Finding | Retrieval failure | User cannot identify next action | Diagnostics produce many equal-severity findings | Group by severity and affected document | UI Model, Acceptance Criteria |
| Naming implies validation | Validation Gap, Evidence | Terminology risk | User believes assumptions are proven | Generated docs sound certain | Use assumption, evidence, and validation-gap labels | Content Model |
| Provider configuration is hidden too deep | AI Provider Configuration | Permission/trust risk | User does not know what may be sent remotely | Surprise or concern during intake | Show provider status before AI operations | Permission Model |
| Search overpromises intelligence | Search and Retrieval | Retrieval risk | User trusts missing results as absence of issue | Search says nothing found without scope | Show retrieval scope and limitations | Feature Specification |
| Advanced contract detail crowds first use | Document Contract | Density risk | First run feels technical and abstract | User stalls before first answer | Hide advanced details until requested | UI Model |
| Manual edits are overwritten or made ambiguous | Canonical Document | Ownership risk | User loses trust in regeneration | User reports unexpected changes | Generation report and overwrite warnings | Permission Model, Acceptance Criteria |
| Agent packs expose too much context | Agent Pack | Context/privacy risk | Sensitive project details may be reused externally | User unsure what packs contain | Show source documents and derived nature | Permission Model, Content Model |
| Root configuration creates stale outputs in old roots | Documentation Root, Generation Report | Lifecycle risk | User reviews outdated files | Multiple roots contain similar outputs | Report active root and stale/superseded outputs | State Model, Engineering Data Model |

### Unresolved IA Questions

- Should users see a dedicated Decision Registry view in MVP, or should decision state appear only contextually?
- Is "Project Clarity State" a useful user-facing term or only an internal IA concept?
- How should LOGOS represent manual edits to canonical Markdown during regeneration?
- Should generation reports be persisted as durable history or only latest status?
- How much of the profile/document contract should normal users inspect?
- Are HTML artifacts and agent packs discoverable enough through generation reports, or do they need their own output navigation?
- What is the right severity taxonomy for diagnostics and validation gaps?
- How should retrieval work when a project has many phases, documents, decisions, and generated outputs?

## Downstream Handoff

### UI Model

UI Model must inherit the object hierarchy and make these orientation cues visible:

- Active repository.
- Active LOGOS documentation root.
- Active profile.
- Current phase or document context.
- Current state category.
- Next useful action.
- Proposed versus confirmed status.
- Canonical versus derived output status.
- Provider status when AI is relevant.
- Severe diagnostics and write consequences.

UI Model must not design around a generic dashboard unless it preserves repository-first, state-backed, local-first IA.

### Interaction Model

Interaction Model must define movement between:

- Conversation and structured state.
- Proposed decisions and confirmation.
- Open questions and assumptions.
- Diagnostics and next questions.
- Generation and output review.
- Configuration and normal flow.
- Error states and recovery.

It must preserve user confirmation for decisions, root changes, remote AI use, and write operations.

### Content Model

Content Model must enforce canonical terminology from this IA:

- LOGOS Documentation Root, not a generic repository documentation folder.
- Canonical Document, not final document.
- Derived Artifact, HTML Artifact, and Agent Pack, not source of truth.
- Proposed Decision and Confirmed Decision, not AI decision.
- Assumption and Validation Gap, not fact.
- Diagnostic Finding, not grade.

It must define language for empty states, status summaries, generation reports, search scope, low confidence, and recovery.

### State Model

State Model must define lifecycle and persistence for:

- Repository Workspace.
- LOGOS Workspace State.
- Documentation Root.
- Profile and Phase references.
- Document Contracts.
- Decisions and Decision Registry.
- Assumptions.
- Open Questions.
- Risks.
- Diagnostics.
- Validation Gaps.
- Generation Reports.
- Canonical and derived output status.
- Provider configuration status without raw secrets.

State Model must distinguish user-facing conceptual objects from implementation storage.

### Permission Model

Permission Model must cover:

- Workspace initialization.
- Documentation-root acceptance or change.
- File generation and overwrite.
- Remote AI provider use.
- Provider configuration and token handling.
- Manual-content preservation.
- Recovery actions that modify local state.
- Sensitive derived outputs, especially agent packs.

Permission Model must not assume remote storage, telemetry, or hidden context capture.

### Feature Specification

Feature Specification must convert the IA into MVP behavior without adding out-of-scope surfaces. It should define features around:

- Repository startup and status.
- Documentation-root configuration.
- Profile and phase orientation.
- AI-led intake.
- Decision review.
- Generation and generation reports.
- Diagnostics and validation gaps.
- Output browsing.
- Recovery and continuation.

It should mark search, recents, advanced inspection, and persistent generation history as validation-required or deferred unless needed for MVP.

### Acceptance Criteria

Acceptance Criteria must test that:

- The user can identify active repository and documentation root before generation.
- `logos/` is the default generated documentation root and can be configured.
- The product never assumes an existing repository documentation folder as generated output root.
- Proposed and confirmed decisions are distinguishable.
- Assumptions and validation gaps remain visible.
- Canonical documents and derived artifacts are distinguishable.
- Generation reports show created, updated, skipped, incomplete, and blocked outputs.
- Empty states explain absence and next action.
- Diagnostics include severity, affected object or document, and next action.
- Remote AI and write consequences are disclosed before action.

### Engineering Data Model

Engineering Data Model must derive from this IA without exposing implementation detail as user vocabulary. It should define storage for conceptual objects, relationships, lifecycles, and status transitions while preserving:

- Local-first inspectability.
- Git-friendly text state where appropriate.
- Configurable LOGOS documentation root.
- No raw token storage in project files.
- Separation between canonical source and derived outputs.
- Regeneration traceability.
- Safe handling of partial failure and stale outputs.

### Unresolved Handoff Items

- Whether the Decision Registry becomes a dedicated MVP view.
- Whether search is command-scoped, text-based, semantic, or deferred.
- Whether recents are needed for first MVP re-entry.
- Whether generation reports are durable objects or transient status.
- How manual edits to canonical documents affect state and regeneration.
- How much advanced profile-contract inspection belongs in the TUI.
