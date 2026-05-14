# Product Architecture

## Product Architecture Thesis

LOGOS Engine's product architecture should be organized around a local clarification loop: repository context, profile contract, AI-led intake, structured project state, user-reviewed decisions, canonical document generation, derived outcomes, diagnostics, validation, and recovery.

The architecture is product-modular, not engineering-layered. Each module exists because it protects a product responsibility in the primary journey: helping a user turn ambiguous project intent into explicit, local, reviewable decisions and documentation before execution. The product should remain easy to evolve by adding profiles, outputs, diagnostics, and review surfaces without weakening local ownership, user confirmation, or source-of-truth clarity.

The architecture must keep these separations stable:

- Conversation is an input surface, not the source of truth.
- AI is an assistance layer, not a decision owner.
- Profile YAML defines document contracts and output expectations.
- Structured project state carries decisions, assumptions, open questions, risks, diagnostics, and output status.
- Canonical Markdown is generated under the configured LOGOS documentation root, defaulting to `logos/`.
- HTML artifacts and agent packs are derived outputs, not canonical sources.
- Deterministic validation remains separate from AI-assisted diagnostics and interpretation.
- Internal workspace state and generated documentation root are distinct product concepts.

The product architecture must avoid becoming:

- a generic AI chat product;
- a project management suite;
- a no-code or autonomous execution platform;
- a hosted SaaS architecture by default;
- a profile marketplace before the first profile proves value;
- an engineering module diagram disguised as product architecture;
- a document generator where polished outputs hide weak state.

This architecture is based on founder-origin experience, existing Foundation and Product documents, Validation caveats, and old architecture material. It should be treated as a product hypothesis until validated through real usage.

## Product Modules

### PA-001: Repository Workspace Module

**User-facing name:** Local Workspace.

**Purpose:** Anchor LOGOS to the repository where the user is working.

**Responsibility:** Detect, initialize, summarize, and preserve the local LOGOS workspace context, including active repository, internal workspace state, active profile, configured LOGOS documentation root, and recoverable status.

**Classification:** MVP / core.

**Included capabilities:**

- Repository-directory startup.
- Workspace initialization.
- Existing workspace detection.
- Active root and profile summary.
- Session continuation.
- Safe recovery from missing or inconsistent state.

**Excluded responsibilities:**

- Hosted workspace accounts.
- Multi-user collaboration.
- Cloud sync.
- Arbitrary source-code ingestion.
- Engineering storage schema decisions.

**Owned objects:** Repository Workspace, LOGOS Workspace State, active profile reference, active documentation root reference.

**Affected journeys:** onboarding, primary clarification, continue session, recovery, repeat use.

**Affected screens:** TUI Shell, First-Run View, Workspace Status View, Error and Recovery View.

**Dependencies:** local filesystem, profile system, state model, permission rules.

**Boundary rules:** This module owns local workspace orientation. It does not own generated document content or AI interpretation.

**Owner or review target:** Product Architecture, State Model, Engineering Brief.

**Downstream implications:** Engineering must define idempotent initialization, safe reads, and recovery behavior without conflating internal state with generated docs.

**Open questions:** How much raw workspace state should advanced users inspect?

### PA-002: Profile and Document Contract Module

**User-facing name:** Profile.

**Purpose:** Define what documents, phases, outputs, criteria, and review rules LOGOS should use for a project.

**Responsibility:** Provide product-level structure through profile YAML, phase definitions, document contracts, output definitions, completion criteria, and quality checks.

**Classification:** MVP / core.

**Included capabilities:**

- Standard profile selection.
- Phase and document contract awareness.
- Canonical output definitions.
- HTML artifact and agent pack definitions.
- Completion and quality criteria.
- Profile status and invalid-profile feedback.

**Excluded responsibilities:**

- Profile marketplace.
- Full profile authoring UI.
- Multi-profile composition.
- Profile monetization or licensing model.

**Owned objects:** Profile, Phase, Document Contract, output contract definitions.

**Affected journeys:** onboarding, generation, diagnostics, validation, output review.

**Affected screens:** First-Run View, Status View, Generation Confirmation, Output Browser, Advanced Profile Contract View.

**Dependencies:** repository workspace, profile YAML files, validation/diagnostics, generation module.

**Boundary rules:** This module defines contracts; it does not confirm project decisions or generate final content by itself.

**Owner or review target:** Product Architecture, Feature Specification, Engineering System Architecture.

**Downstream implications:** Engineering must preserve profile YAML as contract input.

**Open questions:** How much profile contract detail should be user-facing in MVP?

### PA-003: Conversational Intake Module

**User-facing name:** Intake.

**Purpose:** Help the user express ambiguous intent and answer useful questions through conversation.

**Responsibility:** Route ordinary non-slash text into AI-led clarification, preserve user input, ask small question clusters, handle unknowns and assumptions, and produce reviewable interpreted output.

**Classification:** MVP / core / validation-required.

**Included capabilities:**

- Conversation-first input.
- `/continue` resume behavior.
- Question cluster guidance.
- Unknown answer handling.
- Assume-for-now handling.
- Low-confidence interpretation surfacing.
- Provider-unavailable guidance.

**Excluded responsibilities:**

- Deterministic question-id workflow as normal UX.
- Autonomous decision confirmation.
- External research automation.
- Broad source-code context capture.

**Owned objects:** Intake Conversation, Conversation Turn, interpreted answer summaries, Open Question candidates.

**Affected journeys:** primary clarification, first value, continuation, recovery.

**Affected screens:** Conversational Intake View, Proposal Review View, Error and Recovery View.

**Dependencies:** AI Assistance Module, Structured State Module, Profile Module, Permission/Trust Module.

**Boundary rules:** Intake can propose state changes; it cannot make project decisions canonical.

**Owner or review target:** Interaction Model, Feature Specification, AI behavior in Engineering Brief.

**Downstream implications:** Feature Specification must preserve non-slash input as conversation and slash commands as operations.

**Open questions:** How much raw conversation should be retained locally?

### PA-004: AI Assistance Module

**User-facing name:** AI Assistance.

**Purpose:** Support questioning, interpretation, drafting, diagnostics, and review without becoming source of truth.

**Responsibility:** Provide bounded AI assistance through configured provider modes, disclosure, prompt/context grounding, structured output expectations, low-confidence labels, and failure handling.

**Classification:** MVP / core support / cross-cutting.

**Included capabilities:**

- AI provider configuration.
- Local or remote provider mode disclosure where available.
- Redacted token-source status.
- Question recommendation.
- Conversation interpretation.
- Decision proposal generation.
- Drafting support.
- AI-assisted diagnostics as advisory output.
- Provider failure recovery.

**Excluded responsibilities:**

- Hidden remote calls.
- Raw token storage in project files.
- Autonomous decisions.
- Unbounded repository context capture.
- AI as canonical memory.

**Owned objects:** AI Provider Configuration, AI output status, provider disclosure, low-confidence interpretation state.

**Affected journeys:** onboarding, intake, diagnostics, generation, recovery.

**Affected screens:** Provider Configuration, Intake, Proposal Review, Diagnostics, Generation Confirmation, Recovery.

**Dependencies:** Permission/Trust Module, Structured State Module, Profile Module.

**Boundary rules:** AI outputs enter as proposed, draft, advisory, or needs-review states. They do not directly mutate confirmed state.

**Owner or review target:** Permission Model, Engineering Brief, API Contracts.

**Downstream implications:** Engineering must route AI through provider abstraction and structured output validation.

**Open questions:** Which provider modes are MVP versus advanced?

### PA-005: Structured State and Decision Module

**User-facing name:** Project State.

**Purpose:** Preserve the project's clarity state across sessions and outputs.

**Responsibility:** Maintain answers, summaries, decisions, assumptions, open questions, risks, diagnostics, validation gaps, document status, output status, and source relationships as local structured state.

**Classification:** MVP / core.

**Included capabilities:**

- Decision registry.
- Proposed/confirmed/rejected/deferred decision status.
- Assumption tracking.
- Open question tracking.
- Risk tracking.
- Source traceability from conversation to state.
- Affected document/output relationships.
- Stale output identification.

**Excluded responsibilities:**

- Treating Markdown as the only state.
- Treating chat transcript as source of truth.
- Technical database schema selection.
- Remote state persistence by default.

**Owned objects:** Decision, Decision Registry, Assumption, Open Question, Risk, Validation Gap, state summaries.

**Affected journeys:** intake, review, generation, diagnostics, repeat use, recovery.

**Affected screens:** Status, Proposal Review, Decision Detail, Diagnostics, Validation, Generation Report.

**Dependencies:** Repository Workspace, Intake, Profile, Generation, Diagnostics.

**Boundary rules:** This module owns product state meaning, but write permissions and user confirmation are governed by Permission/Trust.

**Owner or review target:** State Model, Engineering Data Model.

**Downstream implications:** State Model must define lifecycle and transitions.

**Open questions:** What minimum state history is required for useful recovery?

### PA-006: Decision Review and Confirmation Module

**User-facing name:** Review.

**Purpose:** Keep user-owned decisions under user control.

**Responsibility:** Present proposed decisions, assumptions, corrections, conflicts, affected documents, and confirmation/rejection/deferral options before state becomes canonical.

**Classification:** MVP / core.

**Included capabilities:**

- Proposal review.
- Decision confirmation.
- Decision rejection.
- Decision deferral.
- Decision revision and supersession.
- Assumption acceptance with caveats.
- Affected document/output preview.

**Excluded responsibilities:**

- AI confirming decisions.
- Bulk confirmation without clear scope.
- Silent overwrite of confirmed decisions.

**Owned objects:** Proposed Decision, Confirmed Decision transition, Confirmation Prompt, correction/revision flow.

**Affected journeys:** primary clarification, first value, repeat use, recovery.

**Affected screens:** Proposal Review View, Decision Detail / Revision View, Status View.

**Dependencies:** Structured State, Intake, AI Assistance, Permission/Trust, Generation.

**Boundary rules:** Review owns confirmation behavior; state persistence belongs to Structured State; UI treatment belongs to UI/Design System.

**Owner or review target:** Interaction Model, Permission Model, Acceptance Criteria.

**Downstream implications:** Acceptance Criteria must test AI proposals never become confirmed silently.

**Open questions:** Whether batch review should be in MVP is unresolved.

### PA-007: Generation and Outputs Module

**User-facing name:** Generation.

**Purpose:** Render local, inspectable outputs from profile contracts and structured state.

**Responsibility:** Generate canonical Markdown, derived HTML artifacts, derived agent packs, and generation reports under the configured LOGOS documentation root.

**Classification:** MVP / core plus supporting derived outputs.

**Included capabilities:**

- Canonical Markdown rendering.
- HTML artifact generation.
- Agent pack generation.
- Generation confirmation.
- Generation report.
- Stale output handling.
- Partial generation handling.
- Output category browsing.

**Excluded responsibilities:**

- Treating derived artifacts as canonical.
- Writing into an assumed repository documentation folder.
- Silent overwrites.
- Final-product generation.
- Roadmap-to-task or issue export as MVP.

**Owned objects:** Canonical Document, HTML Artifact, Agent Pack, Generation Report, Output Status.

**Affected journeys:** generation and review, first value, repeat use, recovery.

**Affected screens:** Generation Confirmation, Generation Report, Output Browser, Status.

**Dependencies:** Repository Workspace, Documentation Root, Profile Contracts, Structured State, Permission/Trust.

**Boundary rules:** Generation owns output creation and reports; profile owns output definitions; state owns source data; user owns confirmation.

**Owner or review target:** Feature Specification, Engineering System Architecture, Frontend Architecture for artifact views.

**Downstream implications:** Engineering must resolve canonical paths relative to configured root, defaulting to `logos/`.

**Open questions:** How much manual edit preservation is MVP versus later?

### PA-008: Diagnostics and Validation Module

**User-facing name:** Diagnostics and Validation.

**Purpose:** Make gaps, contradictions, risks, unsupported claims, and readiness issues visible and actionable.

**Responsibility:** Run deterministic validation, identify missing required decisions, report readiness, expose validation gaps, and optionally use AI-assisted diagnostics as advisory interpretation.

**Classification:** MVP / core / validation-required.

**Included capabilities:**

- `/diagnose`.
- `/validate`.
- Required decision checks.
- Dependency and phase readiness checks.
- Severity grouping.
- Affected object/document reporting.
- Next conversational move recommendation.
- Validation gap reporting.

**Excluded responsibilities:**

- Claiming external validation.
- Mutating confirmed decisions.
- Treating AI diagnostics as deterministic truth.
- Automatic external research.

**Owned objects:** Diagnostic Finding, Validation Gap, severity, readiness status.

**Affected journeys:** diagnostics and validation, first value, recovery, repeat use.

**Affected screens:** Diagnostics View, Validation View, Status View, Recovery View.

**Dependencies:** Profile Contracts, Structured State, AI Assistance where configured, Generation status.

**Boundary rules:** Deterministic validation and AI-assisted interpretation remain distinct.

**Owner or review target:** Feature Specification, Acceptance Criteria, Engineering System Architecture.

**Downstream implications:** Acceptance Criteria must test severity, affected document, and next action.

**Open questions:** Exact severity taxonomy and AI-diagnostic scope require validation.

### PA-009: TUI Experience Module

**User-facing name:** TUI.

**Purpose:** Provide the primary interface for local workflow, conversation, commands, review, status, configuration, reports, and recovery.

**Responsibility:** Present UI views, slash commands, conversational input, status, proposal review, confirmation prompts, diagnostics, generation reports, configuration views, and recovery surfaces.

**Classification:** MVP / core surface.

**Included capabilities:**

- TUI shell.
- Slash command surface.
- Conversational input surface.
- Status view.
- Proposal review view.
- Diagnostics and validation views.
- Generation confirmation/report views.
- Provider/root configuration views.
- Error and recovery views.
- Help view.

**Excluded responsibilities:**

- Hosted web dashboard.
- Mobile-first UI.
- Multi-user collaboration UI.
- Marketplace UI.

**Owned objects:** Screen/View surfaces, command help, UI feedback states.

**Affected journeys:** all MVP journeys.

**Affected screens:** all TUI views.

**Dependencies:** all core modules, Design System, Interaction Model.

**Boundary rules:** TUI displays and routes product actions; it should not be the source of truth or directly bypass permissioned product actions.

**Owner or review target:** UI Specification, Design System, Frontend Architecture.

**Downstream implications:** Frontend Architecture must support command/conversation routing and state-driven rendering.

**Open questions:** Terminal accessibility constraints require engineering review.

### PA-010: Permission, Trust, and Recovery Module

**User-facing name:** Safety and Recovery.

**Purpose:** Preserve consent, local control, reversibility, and trust across risky actions.

**Responsibility:** Define and enforce product-level consent gates, confirmation rules, provider disclosure, root/write disclosure, recovery paths, partial failure reporting, and no-raw-token expectations.

**Classification:** MVP / cross-cutting core.

**Included capabilities:**

- Confirmation rules.
- Strong consent for remote provider use.
- Write/overwrite confirmation.
- Documentation-root change confirmation.
- Provider status disclosure.
- Error and recovery behavior.
- Partial failure preservation.
- No raw token storage in project files.

**Excluded responsibilities:**

- Legal compliance guarantees.
- Security certification.
- Hosted account permission systems.
- Support desk operations.

**Owned objects:** Confirmation Prompt, Permission State, Recovery Path, Provider Disclosure.

**Affected journeys:** onboarding, provider configuration, generation, decision review, recovery.

**Affected screens:** First-Run, Provider Config, Root Config, Generation Confirmation, Recovery, Status.

**Dependencies:** all modules that change state, write files, or use providers.

**Boundary rules:** This module defines consent behavior; downstream engineering implements enforcement.

**Owner or review target:** Permission Model, Acceptance Criteria, Engineering Brief.

**Downstream implications:** Permission Model must formalize every consent gate.

**Open questions:** Which confirmations can be inline versus stronger modal-like prompts?

### Deferred or Excluded Product Modules

| Module | Status | Reason |
| --- | --- | --- |
| Hosted Collaboration | deferred | Requires accounts, cloud state, permissions, and validated team demand. |
| Profile Marketplace | deferred | Profile quality and first-profile value must be proven first. |
| External Research Automation | deferred | Provenance, privacy, source currency, and false-authority risks unresolved. |
| Roadmap-to-Task Export | post-MVP candidate | Useful only after canonical docs and decision state are reliable. |
| Project Management Suite | excluded | Pulls product away from structured clarification before execution. |
| Autonomous Execution Agent | excluded as identity direction | Violates user-owned decision boundary. |

## Module Boundaries

### Boundary Rules

| Boundary | Rule |
| --- | --- |
| Intake vs State | Intake captures and interprets; Structured State owns canonical decision/assumption/question status. |
| AI vs Review | AI may propose; Review confirms, rejects, revises, or defers with user action. |
| Profile vs Generation | Profile defines contracts; Generation renders outputs from state and contracts. |
| Generation vs Source of Truth | Generation creates canonical Markdown and derived outputs; structured state and confirmed decisions remain source inputs. |
| Canonical vs Derived | Canonical Markdown is the human-readable rendered output; HTML artifacts and agent packs are derived and regenerable. |
| Diagnostics vs Validation | Deterministic validation checks structure/readiness; diagnostics may include advisory AI interpretation and next actions. |
| TUI vs Product Actions | TUI routes and displays; product actions enforce permissions and state changes. |
| Documentation Root vs Internal State | `logos/` default root is for generated documentation; internal workspace state is a separate concept. |
| Product vs User | LOGOS clarifies, proposes, documents, and diagnoses; the user owns final decisions and external validation. |
| Product vs External Provider | LOGOS discloses and bounds provider use; provider execution is external and never canonical by itself. |

### Gray Areas

| Gray Area | Decision Rule |
| --- | --- |
| Manual edits to canonical Markdown | Treat as user-owned; warn before overwrite; route detailed rules to State Model and Engineering. |
| Assumption accepted for generation | Keep assumption visible; do not convert to fact; require confirmation when material. |
| AI-assisted diagnostics | Mark advisory/proposed where AI contributes; deterministic checks remain separate. |
| Agent packs used by other agents | Keep derived and caveat-preserving; do not treat downstream agent output as LOGOS truth. |
| HTML artifacts as review surfaces | Allow navigation/review; do not allow them to become canonical editing surfaces in MVP. |
| Profile expansion | Defer broad authoring/marketplace until first profile proves value. |

## Core Capabilities

| ID | Capability | Module | Product Promise Relevance | MVP Behavior | Failure or Degradation Behavior | Evidence Basis |
| --- | --- | --- | --- | --- | --- | --- |
| C-001 | Repository-directory TUI startup | Repository Workspace / TUI | Anchors local-first workflow. | `logos` opens TUI in current repository. | Show path and avoid writes if uncertain. | Product Scope, old TUI docs. |
| C-002 | Workspace initialization | Repository Workspace | Creates local project context. | `/init` creates/loads workspace and root/profile setup. | Preserve existing state; report conflicts. | Product Scope. |
| C-003 | Configurable documentation root | Repository Workspace / Permission | Prevents collisions and hidden writes. | Default `logos/`, configurable before generation. | Block or warn on invalid/colliding root. | Foundation Glossary, Scope. |
| C-004 | Standard profile contract use | Profile Module | Defines generated documentation system. | Use Standard profile YAML as contract. | Invalid profile fails clearly. | Profile YAML, Scope. |
| C-005 | AI-led conversational intake | Intake / AI | Core clarification mechanism. | Non-slash input advances conversation. | No-provider state guides configuration. | Product Brief, Interaction Model. |
| C-006 | Structured project state | State Module | Turns conversation into durable clarity. | Store answers, decisions, assumptions, questions, risks, output status. | Malformed AI output cannot corrupt state. | IA, old architecture. |
| C-007 | Decision proposal review | Review Module | Preserves user agency. | AI-derived decisions stay proposed until confirmed. | Keep unconfirmed when ambiguous. | Foundation Boundaries. |
| C-008 | Canonical Markdown generation | Generation Module | Produces reviewable local docs. | `/generate` renders Markdown under active root. | Partial report and recovery. | Scope, profile outputs. |
| C-009 | Derived HTML artifact generation | Generation Module | Supports navigable review. | Generate from canonical content where defined. | Mark skipped/failed; canonical remains primary. | Profile YAML, Scope. |
| C-010 | Derived agent pack generation | Generation Module | Supports downstream agent/review context. | Generate from canonical docs/contracts. | Mark skipped/failed; never source of truth. | Profile YAML, Scope. |
| C-011 | Diagnostics and validation | Diagnostics Module | Exposes gaps before execution. | `/diagnose` and `/validate` report severity, affected docs, next action. | Deterministic checks still useful without AI. | Scope, Validation docs. |
| C-012 | Status and continuation | Workspace / TUI | Supports re-entry and repeat use. | `/status` and `/continue` summarize progress and next action. | Show recovery if state is incomplete. | User Journeys. |
| C-013 | Permission and recovery gates | Permission Module | Protects trust and local control. | Confirm writes, remote use, root changes, decision confirmation. | Block risky actions without consent. | UX, Interaction, UI docs. |

## Supporting Capabilities

| Capability | Scope Status | Supports | Deferral Risk | Revisit Trigger |
| --- | --- | --- | --- | --- |
| Output browser | preferred MVP / validation-required | Review generated files and source status. | Users may not find outputs easily. | Confusion after generation. |
| Advanced profile contract inspection | deferred | Trust and advanced debugging. | First-run complexity if exposed too soon. | Users ask why a document exists or fails. |
| Generation history | deferred | Repeat use and recovery. | Latest report may be insufficient. | Users need audit trail. |
| Search/retrieval | deferred/basic later | Large projects and repeat use. | Harder to find decisions at scale. | Project state grows beyond simple browsing. |
| Profile governance | post-MVP | Future profile expansion. | Profile drift and quality issues later. | Multiple profiles or contributors appear. |
| Manual edit protection | MVP basic, expanded later | Trust during regeneration. | Overwrite fear or lost edits. | Users manually edit generated docs. |
| Accessibility test harness | engineering follow-up | TUI/HTML usability. | Claims remain untested. | Implementation reaches UI testing stage. |
| Provider test and diagnostics | MVP support | AI setup and recovery. | Provider setup blocks intake. | No-provider failures in prototype. |

## Cross-Cutting Capabilities

| Capability | Spans Modules | Product Owner or Review Target | Consistency Rule |
| --- | --- | --- | --- |
| State visibility | TUI, State, Review, Generation, Diagnostics | State Model / UI Specification | Same state names across product surfaces. |
| Permissions and consent | Workspace, AI, Review, Generation, Recovery | Permission Model | Risky actions require appropriate confirmation. |
| AI boundaries | Intake, AI, Review, Diagnostics, Generation | Engineering Brief / Permission Model | AI output is advisory/proposed until reviewed. |
| Terminology | all modules | Content Model / Glossary | Canonical terms must remain consistent. |
| Accessibility | TUI, Design System, Outputs | UI Specification / Design System | Critical state must be perceivable without color alone. |
| Diagnostics severity | Diagnostics, Status, Validation, Review | Feature Specification / Acceptance Criteria | Severity must include affected object and next action. |
| Output provenance | Generation, Output Browser, Agent Packs | Feature Specification / Engineering | Canonical and derived outputs must be labeled. |
| Recovery | all state-changing modules | Interaction Model / State Model | Failures preserve state and route to next safe action. |
| Local-first behavior | Workspace, Generation, AI, Permission | Engineering Brief | No hidden remote state or telemetry by default. |

## Capability Map

| ID | Capability | Type | Module | Scope | Priority | Dependencies | Delivery Sequence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAP-001 | Open TUI with `logos` | core | TUI Experience | MVP | must-have | local runtime | 1 | defined |
| CAP-002 | Repository context detection | core | Repository Workspace | MVP | must-have | local filesystem | 1 | defined |
| CAP-003 | Workspace initialization | core | Repository Workspace | MVP | must-have | CAP-001, CAP-002 | 2 | defined |
| CAP-004 | Documentation-root setup | core | Repository Workspace / Permission | MVP | must-have | CAP-003 | 2 | defined |
| CAP-005 | Standard profile loading | core | Profile Module | MVP | must-have | profile YAML | 2 | defined |
| CAP-006 | Slash command surface | core | TUI Experience | MVP | must-have | CAP-001 | 2 | defined |
| CAP-007 | AI provider configuration | support | AI Assistance | MVP | must-have for AI intake | Permission rules | 3 | defined |
| CAP-008 | Conversation-first intake | core | Conversational Intake | MVP / validation-required | must-have | CAP-007 or no-provider recovery | 4 | defined |
| CAP-009 | Structured state capture | core | Structured State | MVP | must-have | CAP-008 | 4 | defined |
| CAP-010 | Decision proposal extraction | core | AI / State / Review | MVP | must-have | CAP-008, CAP-009 | 5 | defined |
| CAP-011 | Decision confirmation flow | core | Review | MVP | must-have | CAP-010 | 5 | defined |
| CAP-012 | Status view | support | TUI / Workspace | MVP | should-have | CAP-003, CAP-009 | 5 | defined |
| CAP-013 | Canonical Markdown generation | core | Generation | MVP | must-have | CAP-004, CAP-005, CAP-009, CAP-011 | 6 | defined |
| CAP-014 | HTML artifact generation | support | Generation | MVP support | should-have | CAP-013 | 6 | defined |
| CAP-015 | Agent pack generation | support | Generation | MVP support / validation-required | should-have | CAP-013 | 6 | defined |
| CAP-016 | Generation report | core support | Generation / TUI | MVP | must-have | CAP-013 | 6 | defined |
| CAP-017 | Deterministic validation | core | Diagnostics / Validation | MVP | must-have | CAP-005, CAP-009 | 7 | defined |
| CAP-018 | Diagnostics with next action | core | Diagnostics / AI optional | MVP / validation-required | must-have | CAP-017, optional CAP-007 | 7 | defined |
| CAP-019 | Recovery surfaces | cross-cutting | Permission / TUI | MVP | must-have | all state-changing capabilities | throughout | defined |
| CAP-020 | Output browser | support | Generation / TUI | preferred MVP | medium | CAP-016 | later MVP | provisional |
| CAP-021 | Search/retrieval | support | TUI / State | deferred | low | CAP-009 scale | post-MVP | deferred |
| CAP-022 | Hosted collaboration | external | deferred module | deferred | none for MVP | cloud/account model | post-validation | deferred |
| CAP-023 | Profile marketplace | external | deferred module | deferred | none for MVP | profile governance | post-validation | deferred |

## Module Relationships

| Source Module | Target Module | Relationship Type | Shared Objects | Conceptual Flow | Coupling Level | Fallback Behavior | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Repository Workspace | Profile | setup dependency | active profile reference | workspace loads selected profile | medium | show invalid/missing profile | profile failure blocks generation |
| Repository Workspace | Generation | path dependency | documentation root | generation resolves paths under active root | high | block writes if root invalid | wrong root breaks trust |
| TUI Experience | Conversational Intake | input routing | conversation turns | non-slash text becomes intake | high | no-provider guidance | command/conversation ambiguity |
| TUI Experience | Commands/Modules | operation routing | command result | slash command invokes product action | high | command error/help | hidden mutation if bypassed |
| Conversational Intake | AI Assistance | interpretation dependency | conversation turn, prompt context | AI recommends questions/proposals | medium | no-provider or retry | provider failure blocks flow |
| Conversational Intake | Structured State | state creation | answers, assumptions, questions | interpreted content becomes proposed state | high | preserve raw input | malformed output corrupts state if unchecked |
| AI Assistance | Review | proposal dependency | proposed decisions | AI output enters review | high | keep as low-confidence/proposed | false authority |
| Review | Structured State | confirmation dependency | decisions, assumptions | user action changes state | high | keep proposal pending | silent confirmation |
| Structured State | Generation | source dependency | decisions, assumptions, risks | state feeds rendering context | high | generate with caveats or block | documents hide gaps |
| Profile | Generation | contract dependency | document contracts, outputs | contracts define what to render | high | invalid contract blocks output | profile drift |
| Structured State | Diagnostics | evaluation dependency | state, gaps, outputs | diagnostics inspect state | high | deterministic subset | noisy or stale diagnostics |
| Diagnostics | Intake | next-action loop | open questions, findings | findings route to next question | medium | show findings without AI | unresolved gaps stay abstract |
| Generation | Diagnostics | readiness loop | output status | generation exposes incomplete/stale output | medium | report partial | missing output not noticed |
| Permission | All State-Changing Modules | consent dependency | confirmation, disclosure | risky actions require gates | high | block or ask | over/under-confirmation |

Coupling constraints:

- AI Assistance must not couple directly to confirmed state mutation.
- TUI must not bypass product actions for writes or confirmations.
- Generation must depend on profile contracts and structured state, not private chat history.
- Diagnostics may read confirmed state and assumptions but must not mutate confirmed decisions.
- Derived output modules must remain downstream of canonical content.

## Product Dependencies

| Dependency | Type | Used By | Purpose | Criticality | Fallback or Degradation | Ownership | Concern |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Local filesystem | platform capability | Workspace, Generation, State | Read/write local state and outputs. | critical | Product cannot operate fully without it. | User machine / Engineering | permissions, path safety |
| Current repository directory | user/platform context | Workspace, TUI | Anchor local project. | critical | Show path and avoid writes. | User | wrong directory risk |
| Profile YAML files | internal product dependency | Profile, Generation, Validation | Define contracts and outputs. | critical | Invalid profile blocks affected flows. | Product | governance and schema validation |
| Configured LOGOS documentation root | user config | Generation, Output Browser | Output destination, default `logos/`. | critical for generation | Block generation until valid. | User/Product | collision, stale outputs |
| Internal workspace state | local product dependency | all core modules | Preserve project clarity state. | critical | Recovery/status if inconsistent. | Product/User | corruption, migration |
| AI provider | external/service dependency | Intake, AI diagnostics, drafting | AI-led questions and interpretation. | important but bounded | No-provider guidance; deterministic status/validation where possible. | User/provider | privacy, availability, cost |
| Terminal/TUI runtime | platform capability | TUI | Primary interface. | critical | CLI/help fallback possible later, not specified. | Engineering/User environment | accessibility variability |
| Markdown tooling | internal/engineering dependency | Generation | Render canonical docs. | critical for output | Block output and report failure. | Engineering | formatting, manual edits |
| HTML generation tooling | internal/engineering dependency | Derived artifacts | Generate navigable artifacts. | supporting | Skip derived outputs; keep canonical docs. | Engineering | accessibility, maintenance |
| Agent pack generation | internal/product dependency | Derived outputs | Create downstream agent context. | supporting | Skip packs; keep canonical docs. | Product/Engineering | context sensitivity |
| Git | user workflow dependency | User review | Diff/review local outputs. | useful but not required | Files still inspectable. | User | accidental commits/secrets |
| Manual user review | user dependency | Review, validation | Confirm decisions and assumptions. | critical | Product cannot replace user judgment. | User | passive acceptance |

Dependencies requiring downstream review:

- AI provider privacy, policy, token, and cost behavior.
- Terminal accessibility limits.
- Filesystem overwrite/manual edit protection.
- HTML artifact accessibility.
- Agent pack sensitivity and downstream misuse.

## Capability Sequencing

### Minimum MVP Sequence

1. Repository-directory TUI startup.
2. Workspace initialization and safe existing-state loading.
3. Configurable LOGOS documentation root with default `logos/`.
4. Standard profile loading and contract validation.
5. Slash command surface and status view.
6. AI provider configuration and no-provider recovery state.
7. Conversation-first intake.
8. Structured state capture for answers, assumptions, open questions, risks, and proposals.
9. Decision proposal review and confirmation.
10. Canonical Markdown generation with generation report.
11. Derived HTML artifact and agent pack generation from canonical content.
12. Deterministic validation and diagnostics.
13. Recovery and partial failure handling across all above flows.

### Parallelizable Work

- UI/design system specification can advance alongside feature specification.
- Profile contract validation can advance alongside generation design.
- Diagnostics taxonomy can advance alongside validation rules.
- Provider configuration UX can advance alongside AI operation contracts.
- Output artifact specification can advance alongside canonical generation, as long as derived status remains clear.

### Must Wait

| Capability | Waits For | Reason |
| --- | --- | --- |
| Profile marketplace | validated profile value and governance | Avoid premature ecosystem complexity. |
| Hosted collaboration | validated team use and permission model | Avoid remote-first drift. |
| External research automation | provenance/privacy model | Avoid false authority. |
| Semantic search | larger state scale evidence | Avoid overbuilding retrieval. |
| Roadmap-to-task export | reliable canonical docs/decisions | Avoid execution before clarity. |
| Advanced graph visualization | proven dependency complexity | Avoid visual theater. |

## Ownership Model

| Area | Product Owner or Review Target | Engineering Review Target | Notes |
| --- | --- | --- | --- |
| Product module boundaries | Product Architecture | Engineering Brief | Product responsibility first. |
| Scope changes | Product Scope / Decision Record | Engineering impact review | Evidence or explicit assumption required. |
| Profile contracts | Profile docs / Feature Specification | System Architecture | YAML remains contract source. |
| Workspace state meaning | State Model | Data Model | Product states before schema. |
| Confirmation and consent | Permission Model | API Contracts / Frontend Architecture | Must cover writes, remote calls, root changes, decisions. |
| AI boundaries | Product Architecture / Permission Model | Engineering Brief / API Contracts | AI cannot confirm decisions. |
| Generated outputs | Feature Specification | System Architecture / Data Model | Canonical vs derived distinction required. |
| Diagnostics and validation | Feature Specification / Acceptance Criteria | System Architecture | Deterministic and AI-assisted roles separate. |
| TUI surfaces | UI Specification / Design System | Frontend Architecture | TUI-first, keyboard-first. |
| Operational support | Operating Model | Engineering/Ops | Deferred until product use creates support needs. |

Unresolved ownership gaps:

- Who governs future profile quality and deprecation?
- Who approves derived agent pack formats when downstream agents change?
- Who owns manual-edit conflict policy?
- Who reviews provider-specific privacy/policy implications?
- Who decides when search or hosted collaboration graduates from deferred to planned?

## Product Architecture Risks

| Risk | Affected Module or Capability | Risk Type | User Impact | Product Impact | Early Signal | Mitigation | Target Document |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chat becomes source of truth | Intake, State | boundary risk | User cannot inspect or regenerate decisions. | Product becomes generic chatbot. | Decisions only visible in transcript. | Route all useful content to structured state. | State Model |
| AI proposals become confirmed | AI, Review | agency risk | User acts on unreviewed AI output. | Violates core boundary. | Proposed labels disappear. | Confirmation-gated state transitions. | Permission Model, Acceptance Criteria |
| Documentation root confusion | Workspace, Generation | path risk | User cannot find or trusts wrong files. | Local-first trust weakens. | Users expect another folder. | Display active root and default `logos/`. | UI Spec, Acceptance Criteria |
| Derived outputs become canonical | Generation | source-of-truth risk | User edits/cites stale artifacts. | Structure over presentation breaks. | HTML or packs edited directly. | Derived labels and regeneration rules. | Content Model, Feature Spec |
| Profile module over-expands | Profile | scope risk | Product becomes template marketplace too soon. | Core loop underbuilt. | Marketplace/profile UI appears before MVP proof. | Defer governance and authoring UI. | Product Scope |
| Diagnostics are too coupled to AI | Diagnostics, AI | dependency risk | Diagnostics fail when provider fails. | Validation trust weakens. | `/diagnose` useless without AI. | Keep deterministic validation separate. | Engineering Architecture |
| TUI bypasses product permissions | TUI, Permission | safety risk | Writes or confirmations happen unsafely. | Trust breaks. | UI calls file actions directly. | Product actions own state changes. | Frontend Architecture, API Contracts |
| Manual edits conflict with regeneration | Generation, State | ownership risk | User loses work or avoids regeneration. | Git-friendly promise weakens. | Unexpected overwrite reports. | Warning, affected files, policy. | State Model, Engineering |
| Capability sequencing overbuilds support | Supporting modules | sequencing risk | MVP delayed by non-core systems. | Validation delayed. | Search/marketplace/collab prioritized early. | Follow minimum MVP sequence. | Feature Specification |
| Provider setup blocks first value | AI, Intake | adoption risk | User quits before clarity. | AI-led thesis hard to test. | No-provider state causes abandonment. | Clear setup guidance and local status value. | UI Spec, Feature Spec |
| Agent packs leak too much context | Derived outputs, Permission | privacy risk | Sensitive project context reused. | Trust and safety issue. | User unsure what packs contain. | Source disclosure and generation control. | Permission Model |
| Internal state and output root confused | Workspace, Generation | conceptual risk | User moves/deletes wrong folder. | Recovery/support burden. | `.logos` and `logos/` questions. | Consistent terminology and path display. | Content Model |

## Downstream Handoff

### Feature Specification

Feature Specification must inherit:

- MVP module list and deferred/excluded module boundaries.
- Capability map with priority and sequencing.
- Core capabilities that must be specified as user-facing features.
- Supporting capabilities marked MVP, preferred, deferred, or validation-required.
- Cross-cutting rules for permissions, state visibility, AI boundaries, output provenance, and recovery.
- Explicit exclusions for hosted collaboration, marketplace, autonomous execution, and project-management surfaces.

### Acceptance Criteria

Acceptance Criteria must verify:

- `logos` opens the TUI in the target repository.
- Active LOGOS documentation root defaults to `logos/` and is configurable.
- Profile YAML contracts drive documents and outputs.
- Ordinary text drives conversation; slash commands drive operations.
- AI output remains proposed/advisory until user review.
- Confirmed decisions require explicit user confirmation.
- Canonical Markdown and derived HTML/agent outputs are distinct.
- Generation reports partial, skipped, blocked, and failed outputs.
- Diagnostics and validation do not mutate confirmed decisions.
- Remote provider usage is disclosed and configurable.
- Raw provider tokens are not stored in project files.
- Recovery preserves state after provider, generation, path, or malformed AI failures.

### Engineering Brief and System Architecture

Engineering must inherit product boundaries without turning this document into implementation detail:

- TUI-first local product.
- Product actions as permissioned state-change boundaries.
- Profile loader as contract source.
- AI provider abstraction with explicit disclosure.
- Structured local state as product source input.
- Markdown rendering under configured documentation root.
- Derived artifact generation as downstream of canonical content.
- Deterministic validation separate from AI diagnostics.
- Safe recovery and partial failure handling.

### Data Model

Data Model must define product object lifecycles for:

- Repository Workspace.
- LOGOS Workspace State.
- Documentation Root.
- Profile and Phase references.
- Document Contract references.
- Conversation Turns and interpreted outputs.
- Decisions and proposal states.
- Assumptions.
- Open Questions.
- Risks.
- Diagnostics.
- Validation Gaps.
- Canonical and derived output status.
- Generation Reports.
- Provider configuration status without raw secrets.

### API Contracts

API Contracts must preserve:

- command/action result shape;
- confirmation requirements;
- state transition validity;
- AI output status as proposed/advisory/needs-review;
- generation result categories;
- diagnostic severity and affected object references;
- provider disclosure metadata;
- recovery and partial failure reporting.

### Frontend Architecture

Frontend Architecture must inherit:

- TUI shell as primary surface;
- command/conversation input routing;
- state-driven screens;
- design system components;
- compact terminal behavior;
- visible root/provider/status indicators;
- confirmation and recovery surfaces;
- no direct UI bypass of permissioned product actions.

### Operations

Operating Model must eventually define:

- profile maintenance and quality review;
- support for provider setup problems;
- handling user reports about lost files or overwrite confusion;
- release notes for breaking profile or design-system changes;
- issue triage for diagnostics, validation, generation, and recovery failures.

### Unresolved Product Architecture Questions

- What is the minimal manual-edit protection needed for MVP?
- How much generation history should be product-visible?
- Should output browser be MVP or only a generation-report affordance?
- What state history is required to make decision revision trustworthy?
- Which provider modes should be supported first?
- How much profile contract inspection should normal users see?
- When does the product need search or retrieval beyond status, diagnostics, and output reports?
- What evidence would justify hosted collaboration or profile marketplace modules?
