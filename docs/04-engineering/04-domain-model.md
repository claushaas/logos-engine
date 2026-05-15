# Domain Model

## Domain Overview

LOGOS Engine models the domain of **project clarification before execution**. The system helps a user turn ambiguous project intent into structured, reviewable project knowledge: decisions, assumptions, open questions, risks, diagnostics, validation gaps, document contracts, and generated outputs.

The core domain problem is not document storage, chat, AI prompting, or file rendering. The core domain problem is preserving trustworthy project clarity: what has been decided, what is assumed, what remains unknown, what is risky, what is ready to generate, and what must not be treated as validated.

Inside the domain model:

- repository-scoped workspace identity and lifecycle;
- configured LOGOS documentation root;
- active profile and document contracts;
- intake turns as inputs to clarification;
- proposed and confirmed decisions;
- assumptions, open questions, and risks;
- deterministic validation findings;
- diagnostic findings and next-action recommendations;
- canonical document generation status;
- derived HTML artifact and agent pack status;
- permission-relevant state transitions.

Outside the domain model:

- terminal rendering details;
- filesystem layout and JSON schema details;
- provider SDK request/response mechanics;
- prompt wording and model-specific behavior;
- HTML/CSS implementation details;
- package management and deployment mechanics;
- hosted accounts, team permissions, cloud sync, analytics, marketplace, task boards, and external research automation.

Important modelling distinction: Product Information Architecture names user-facing objects; the Domain Model defines which of those objects have identity, lifecycle, invariants, commands, events, and consistency boundaries. Not every IA object becomes a domain entity.

## Ubiquitous Language

| Term | Definition | Classification | Aliases | Forbidden or Discouraged Terms | Related Terms | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Repository Workspace | The local repository context where LOGOS is running and where LOGOS state and outputs belong. | core domain | workspace, local workspace | cloud workspace, account workspace | Documentation Root, Workspace State | canonical |
| LOGOS Documentation Root | The configured repository folder where LOGOS writes generated documentation and outcomes; defaults to `logos/`. | core domain / configuration | output root, generated documentation root | hard-coded docs folder, project docs folder | Canonical Document, Derived Artifact | canonical |
| Workspace State | The structured local state LOGOS uses to preserve decisions, assumptions, questions, risks, diagnostics, and output status. | core domain | project state, structured state | chat memory, hidden state | Decision Registry, Generation Report | canonical |
| Profile | A document system defining phases, document contracts, output contracts, completion criteria, and review rules. | supporting domain | documentation profile | template bundle, prompt pack | Phase, Document Contract | canonical |
| Document Contract | A profile-defined contract for a canonical document: purpose, sections, dependencies, criteria, outputs, and review rules. | supporting domain | document definition | plain template, prompt | Canonical Document, Profile | canonical |
| Intake Turn | A user or AI interaction captured as input to clarification. | supporting domain | conversation turn, answer | source of truth | Proposed Decision, Assumption | canonical |
| Contextual Suggestion | An optional suggested answer or option shown beside a directly related question because prior state supports it. | supporting domain / advisory | suggested answer, grounded suggestion | auto-answer, inferred decision | Intake Turn, Proposed Decision, Source Reference | canonical |
| Decision | A structured statement of project intent, constraint, direction, or commitment affecting documentation or execution. | core domain | project decision | note, vibe, AI decision | Proposed Decision, Confirmed Decision | canonical |
| Proposed Decision | A decision candidate that has not yet been explicitly accepted by the user. | core domain | proposal | confirmed decision, inferred truth | Decision, Confirmation | canonical |
| Confirmed Decision | A user-accepted decision. It is strong source material for generation and validation. | core domain | accepted decision | AI decision, final forever | Decision, Superseded Decision | canonical |
| Assumption | A temporarily accepted planning statement that is not validated as fact. | core domain | planning assumption | fact, evidence, confirmed truth | Open Question, Validation Gap | canonical |
| Open Question | A known unknown that requires later clarification, evidence, or decision. | core domain | unresolved question | missing answer as failure | Assumption, Diagnostic Finding | canonical |
| Risk | A possible negative outcome or uncertainty that can affect project clarity, generation, validation, or downstream execution. | core domain | project risk | defect, task | Diagnostic Finding, Validation Gap | canonical |
| Validation Finding | A deterministic rule result that identifies pass, warning, block, or gap status. | core domain | validation gap | AI opinion, audit | Validation Rule, Diagnostic Finding | canonical |
| Diagnostic Finding | A user-facing explanation of missing, risky, inconsistent, blocked, or recommended next action. | core domain | gap report | validation, grading | Validation Finding, Risk | canonical |
| Canonical Document | A generated Markdown document under the configured root that serves as the primary human-readable projection. | core domain output | canonical Markdown | final document, static doc | Document Contract, Generation Report | canonical |
| Derived Artifact | A non-canonical output generated from canonical source, such as HTML artifact, executive export, or agent pack. | supporting output | generated artifact | source of truth | Canonical Document, Executive Plan, Agent Pack | canonical |
| Agent Pack | A derived execution-oriented artifact packaging canonical context for AI/coding agents. | supporting output | agent-ready brief | autonomous plan, AI source of truth | Derived Artifact | canonical |
| Executive Plan | A portable JSON execution model generated from normative documents. | supporting exchange model | executive JSON, portable execution model | task database, live project board | Canonical Document, Derived Artifact | canonical |
| Executive Export | A derived import/review artifact generated from Executive JSON through an adapter. | supporting output | execution snapshot, adapter export | live sync, canonical task state | Executive Plan, Derived Artifact | canonical |
| Generation Report | A summary of generated, updated, skipped, incomplete, blocked, failed, stale, canonical, and derived outputs. | core domain output | output report | build log only | Generation Plan, Canonical Document | canonical |
| Provider Configuration | The safe, redacted configuration status for AI provider use. | integration concept | AI config | token store in project files | Provider Mode, Remote Disclosure | canonical |

Terms that must not be collapsed:

- **Decision** and **Assumption**: assumptions can support progress but are never confirmed facts.
- **Validation** and **Diagnostics**: validation is deterministic; diagnostics explain gaps and next actions.
- **Canonical Document** and **Derived Artifact**: derived outputs must not become authoritative.
- **Documentation Root** and **Internal Workspace State**: output location and engine state are separate concepts.
- **AI Output** and **Confirmed Decision**: AI output must pass through review before becoming confirmed state.

## Core Entities

| ID | Entity | Definition | Identity Rule | Lifecycle | Ownership | Allowed Operations | Forbidden Operations | Key Invariants | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ENT-001 | Repository Workspace | The local project context LOGOS operates within. | Stable workspace id plus repository path. | detected, uninitialized, initialized, active, inconsistent, recovery-needed. | User owns repository; LOGOS manages workspace state. | initialize, resume, inspect status, configure root, recover. | silently write outside active repository. | Active workspace must have one active documentation root and one active profile reference. | core |
| ENT-002 | Profile | The selected document system and contract set. | Profile id and version. | available, selected, active, invalid, deprecated. | Product/profile maintainer owns definition; user selects. | select, validate, inspect. | mutate project decisions. | Active profile must be schema-valid before generation. | supporting |
| ENT-003 | Phase | A profile-defined stage grouping document contracts. | Phase id within profile version. | not started, active, complete, blocked, deprecated. | Profile owns definition; workspace tracks progress. | mark progress through validated document status. | treat phase complete when required documents are blocked. | Phase status derives from document and state readiness. | supporting |
| ENT-004 | Document Contract | Contract for one canonical document and its outputs. | Document id within profile version. | available, active, blocked, deprecated. | Profile owns contract. | validate, resolve dependencies, render from state. | store confirmed project truth directly. | Contract must define output expectations before generation. | supporting |
| ENT-005 | Intake Session | A bounded clarification conversation for a workspace/profile context. | Session id within workspace. | open, waiting for provider, waiting for user review, paused, completed, failed. | User owns answers; LOGOS manages session state. | add turn, summarize, produce proposals, pause, resume. | confirm decisions directly. | Intake can create proposals, assumptions, and questions, not confirmed decisions. | core |
| ENT-016 | Contextual Suggestion | A source-labeled proposed answer, option, or framing attached to a current question. | Suggestion id within intake session and question context. | proposed, accepted-for-capture, edited-for-capture, rejected, ignored, stale. | LOGOS proposes; user controls use. | create, display, accept for capture, edit for capture, reject, ignore, mark stale. | confirm decisions, hide source basis, override user answer. | Accepted suggestions route through normal answer/proposal flows and remain non-canonical until applicable review rules pass. | supporting |
| ENT-006 | Decision | A project commitment or direction with status and traceability. | Decision id stable across revisions. | proposed, confirmed, rejected, deferred, superseded. | User owns confirmation. | propose, confirm, revise, reject, defer, supersede. | silently confirm, delete without trace. | Confirmed decisions require explicit user action. | core |
| ENT-007 | Assumption | A visible temporary planning statement. | Assumption id. | proposed, active, challenged, resolved, superseded. | User owns acceptance of assumption use. | create, mark active, challenge, resolve, supersede. | convert to confirmed fact without evidence or decision. | Assumptions must remain visibly caveated. | core |
| ENT-008 | Open Question | A known unresolved question. | Question id. | open, answered, deferred, obsolete. | User owns resolution. | create, answer, defer, obsolete. | hide while depending documents claim completeness. | Open questions affecting required docs must surface in status/diagnostics. | core |
| ENT-009 | Risk | A known uncertainty or possible negative outcome. | Risk id. | identified, monitored, mitigated, accepted, closed. | User owns risk acceptance. | identify, classify, mitigate, accept, close. | present as resolved without mitigation/acceptance. | Accepted risk requires visible status and rationale. | core |
| ENT-010 | Validation Finding | Deterministic result of profile/state rule evaluation. | Finding id or deterministic key from rule/object. | passing, warning, blocking, obsolete. | Validation rules own creation; user resolves underlying issue. | create, update, mark obsolete by revalidation. | depend on live AI for deterministic result. | Validation must be reproducible without provider. | core |
| ENT-011 | Diagnostic Finding | Explanation of gap, contradiction, risk, or next action. | Diagnostic id or deterministic key. | active, acknowledged, resolved, obsolete. | LOGOS explains; user chooses action. | create, group, recommend, resolve through state change. | mutate confirmed state. | Diagnostics must distinguish severity and affected object. | core |
| ENT-012 | Generation Report | Record of a generation attempt and output status. | Generation id. | planned, running, partial, complete, failed, obsolete. | LOGOS creates; user reviews. | plan, record result, mark stale/obsolete. | hide partial failure. | Reports must classify canonical and derived outputs separately. | core |
| ENT-013 | Generated Output | A canonical or derived file created by LOGOS. | Output id/path under configured root plus contract reference. | planned, generated, skipped, blocked, failed, stale, obsolete. | User owns files; LOGOS tracks status. | generate, mark stale, skip, fail, regenerate. | treat derived output as canonical source. | Output path must resolve under configured root. | core/supporting |
| ENT-014 | Executive Plan | A generated portable execution graph derived from the Normative Axis. | Executive plan id/path/schema version/source refs. | not generated, draft, generated, stale, blocked, failed. | User owns whether to use/export it; LOGOS tracks status. | compile, validate, mark stale, regenerate. | treat as live execution status. | Source normative documents and readiness status are required. | supporting/post-baseline |
| ENT-015 | Executive Export | A derived snapshot or import file generated from Executive JSON. | Export id/target/path/adapter version/source plan. | planned, generated, unsupported, skipped, blocked, failed, stale. | User owns external import/use; LOGOS tracks local output status. | export, skip, fail, regenerate, mark stale. | sync external task status back into LOGOS in MVP. | Export must be labeled derived and target support must be explicit. | supporting/post-baseline |
| ENT-014 | Provider Configuration | Redacted local status of AI provider configuration. | Provider config id in workspace. | unconfigured, configured, invalid, unavailable. | User owns provider choice and token source. | configure, inspect, mark unavailable, clear. | store raw tokens in project files. | Remote provider use requires explicit disclosure. | integration |

## Value Objects

| Value Object | Definition | Equality Rule | Validation Rules | Normalization / Formatting | Immutability Expectation | Downstream Implications |
| --- | --- | --- | --- | --- | --- | --- |
| Repository Path | Filesystem path to active repository. | Same normalized absolute path. | Must be readable; write checks are separate. | Normalize separators and resolve relative segments. | Immutable within command execution. | Data Model path handling. |
| Documentation Root Path | Configured output root path, defaulting to `logos/`. | Same normalized path relative to workspace. | Must not escape workspace unless explicitly allowed later. | Display as user-facing path. | Changes only through root-change command. | Security and API confirmation rules. |
| Profile Version | Version identifier for profile contracts. | Same profile id and version. | Must match schema-compatible profile. | Preserve exact profile version string. | Immutable for a loaded profile snapshot. | Migration and compatibility. |
| Document Identifier | Stable id of a document contract. | Same id within profile version. | Must exist in active profile. | Lowercase/kebab-case preferred if profile defines it. | Immutable. | API/Data references. |
| Decision Status | Lifecycle value for a decision. | Same enumerated status. | Must be one of proposed, confirmed, rejected, deferred, superseded. | Render as text label. | Changes only through valid transition. | State machine and UI labels. |
| Confidence Label | Qualitative confidence for AI interpretation or diagnostic explanation. | Same label and source. | Must not imply validation. | Render as low/medium/high or equivalent. | Recomputed when source changes. | Frontend and diagnostics. |
| Source Basis | Bounded list of prior decisions, assumptions, open questions, documents, or findings used to justify a contextual suggestion. | Same ordered source refs and caveats. | Must reference existing reviewable state and must not include unrelated repository context. | Render as concise source/caveat text. | Recomputed when source state changes. | API, UI, Security, Tests. |
| Severity | Finding severity. | Same severity level. | Must be ordered and bounded. | Suggested labels: info, warning, blocking. | Immutable per finding revision. | Diagnostics and validation grouping. |
| Output Kind | Classification of generated output. | Same kind. | canonical Markdown, derived HTML artifact, derived agent pack, report. | Must render as text label. | Immutable per output. | Generation report. |
| Staleness Marker | Indicates output is outdated relative to source state. | Same source version/change reference. | Must identify affected source where possible. | Show stale/in-sync/unknown. | Recomputed after state changes. | Generation and status. |
| Provider Mode | Local, remote, custom, or unconfigured provider mode. | Same mode and provider id. | Remote mode requires disclosure. | Display without secrets. | Changes through config command. | Security and Integration. |
| Redacted Secret Reference | Safe reference to token source. | Same source type and key label, never raw token. | Must not contain secret value. | Display as redacted or source-only. | Immutable for status snapshot. | Security Architecture. |
| Evidence Caveat | Label describing validation support or limitation. | Same caveat type and source. | Must not upgrade assumption to evidence. | Render visibly in generated docs. | Changes only when evidence/decision changes. | Validation and generation. |

## Aggregates

| Aggregate | Root Entity | Boundary | Owned Entities / Values | Consistency Rules | Transactional Scope | Allowed Mutations | Forbidden Mutations | Emitted Events |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace Aggregate | Repository Workspace | One local LOGOS workspace in one repository. | Workspace state reference, active profile ref, documentation root config, provider config status. | Workspace must have one active root; root changes require confirmation; active profile must be valid for generation. | Workspace metadata/config update. | initialize, resume, change root, set provider status. | write outside active workspace/root; store raw tokens. | WorkspaceInitialized, DocumentationRootChanged, ProviderConfigurationChanged |
| Profile Contract Aggregate | Profile | One profile version and its contract tree. | Phases, document contracts, output contracts, quality rules. | Contracts must validate before being used; document ids unique within profile. | Profile load/validation snapshot. | load, validate, mark invalid/deprecated. | mutate user project state. | ProfileLoaded, ProfileValidationFailed |
| Clarification Aggregate | Intake Session | One active or historical intake flow. | Intake turns, interpreted answer summaries, contextual suggestions, proposal candidates, low-confidence labels. | Intake may create suggestions and proposed state only; malformed AI output cannot mutate confirmed state. | Add/interpret turn, create contextual suggestions, and create proposals. | add turn, pause, resume, produce suggestions, produce proposals. | confirm decisions directly. | IntakeTurnRecorded, ContextualSuggestionCreated, DecisionProposed, AssumptionProposed, OpenQuestionCreated |
| Decision Registry Aggregate | Decision | Decision lifecycle plus related assumptions/questions/affected outputs by reference. | Decisions, statuses, revisions, supersession links. | Confirmed decision requires explicit user action; revision marks affected outputs stale. | Single decision state transition plus affected-output markers by reference. | propose, confirm, revise, reject, defer, supersede. | silent overwrite; assumption to fact without decision/evidence. | DecisionConfirmed, DecisionRevised, DecisionRejected, DecisionDeferred, DecisionSuperseded |
| Knowledge Gap Aggregate | Open Question | Open questions, assumptions, risks, validation and diagnostic relationships. | Questions, assumptions, risks and their statuses. | Known unknowns and assumptions must remain visible when they affect generation. | Update one gap/risk/assumption status. | create, resolve, defer, challenge, accept risk. | hide unresolved blocker. | AssumptionRecorded, OpenQuestionResolved, RiskAccepted |
| Validation Aggregate | Validation Finding | Deterministic validation result set for a workspace/profile snapshot. | Findings, severity, affected objects, rule references. | Validation result must be reproducible without AI; obsolete after source change. | One validation run. | run, record, obsolete. | remote-provider-dependent pass/fail. | ValidationRunCompleted, ValidationFindingRaised |
| Generation Aggregate | Generation Report | One generation attempt and resulting output states. | Generation plan, output statuses, stale markers, failures. | Writes must be under configured root; canonical and derived outputs classified separately. | One generation attempt. | plan, generate, skip, fail, mark stale. | generate from unconfirmed decisions as confirmed truth; hide partial failure. | GenerationCompleted, GenerationPartiallyCompleted, OutputMarkedStale |

Cross-aggregate mutation rule: a command may coordinate multiple aggregates through an application service, but domain invariants must remain owned by their aggregate roots. For example, revising a decision may mark outputs stale, but it must not directly rewrite generated files inside the Decision Registry aggregate.

## Domain Services

| Domain Service | Why It Exists | Inputs | Outputs | Rules Enforced | Not Responsible For |
| --- | --- | --- | --- | --- | --- |
| Proposal Interpretation Service | Interpreted intake can produce decisions, assumptions, questions, and risks that span multiple aggregates. | Intake turn, profile context, existing state summary, validated AI output. | Proposed decisions, assumptions, questions, risks. | AI output remains proposed; low confidence remains labeled. | Provider calls, UI prompts, confirmation. |
| Readiness Evaluation Service | Readiness depends on profile contracts, decisions, assumptions, questions, risks, and validation findings. | Workspace snapshot, profile contracts. | Readiness status and blocking/warning findings. | Deterministic readiness; no AI pass/fail. | Rendering outputs. |
| Generation Planning Service | Generation eligibility depends on contracts, state, root safety, and output status. | Workspace snapshot, profile contracts, output metadata. | Generation plan. | Canonical/derived classification; blocked/skipped/incomplete status. | Filesystem writes and rendering. |
| Staleness Evaluation Service | A change in project state affects many outputs without belonging to one entity. | State change event, output metadata, contract dependency graph. | Staleness markers. | Affected outputs become stale when source decisions change. | Regeneration. |
| Permission Evaluation Service | Permission rules span user intent, operation kind, root path, provider mode, and write risk. | Command intent, target path/provider, workspace status. | Permission requirement or approval result. | Writes, overwrites, root changes, and remote transmission require explicit consent. | UI prompt rendering. |

Application services orchestrate these domain services. Infrastructure services and adapters perform provider calls, filesystem writes, and rendering.

## Policies and Specifications

| Policy / Specification | Type | Used By | Rule | Configurable | Conflict Handling |
| --- | --- | --- | --- | --- | --- |
| Active Workspace Specification | eligibility | `/status`, `/init`, generation, validation | A workspace must be initialized and recoverable for state-changing operations. | no | Recovery mode takes precedence. |
| Valid Profile Specification | eligibility | intake, validation, generation | Active profile must load and validate before contract-dependent behavior. | no | Invalid profile blocks dependent commands. |
| Remote Disclosure Policy | security/privacy | intake, provider config | Remote provider transmission requires explicit disclosure before sending context. | no | Blocks provider call until satisfied. |
| Decision Confirmation Policy | invariant/policy | Decision commands | Proposed decisions become confirmed only through explicit user confirmation. | no | Hard invariant wins over AI confidence. |
| Unknown Answer Policy | business policy | intake | Unknown answers create open questions rather than fabricated decisions. | no | Open question remains visible. |
| Assume-For-Now Policy | business policy | intake, generation | Assumptions can support progress only with visible caveats. | no | Caveat must appear downstream where relevant. |
| Generation Eligibility Specification | eligibility | `/generate` | Generation requires valid profile, configured root, readable state, and write permission. | partly | Blocking validation may prevent or warn depending on rule severity. |
| Derived Output Policy | invariant/policy | generation | HTML artifacts and agent packs are derived and regenerable, not canonical truth. | no | Canonical source takes precedence. |
| No-Provider Degradation Policy | availability | intake, validation, diagnostics | No AI provider blocks AI intake but not local status, validation, diagnostics, or generation from existing state. | no | Local deterministic operations continue. |
| Token Safety Policy | security | provider config | Raw tokens are never stored in project files or displayed. | no | Operation fails if only unsafe storage is available. |

## Commands

| Command | Actor | Intent | Target Aggregate | Preconditions | Validation Rules | Idempotency | State Changes | Emitted Events | Failure Behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| InitializeWorkspace | User | Create or connect local LOGOS workspace. | Workspace | Repository path available. | Path safety; existing state detection. | Re-running is safe unless destructive reinit requested. | Workspace initialized or existing workspace reported. | WorkspaceInitialized | Preserve existing state and request confirmation if conflict. |
| ChangeDocumentationRoot | User | Configure output root. | Workspace | Workspace initialized. | Root path valid and safe; collision risk evaluated. | Repeating same root is no-op. | Root config changed; affected output status may become stale/unknown. | DocumentationRootChanged | Block unsafe path or request confirmation. |
| ConfigureProvider | User | Set AI provider mode/status. | Workspace | Workspace initialized. | Token source safe; provider mode valid. | Updating same config is no-op. | Provider status changed. | ProviderConfigurationChanged | Redacted error and no-provider mode. |
| RecordIntakeTurn | User/System | Preserve conversational input. | Clarification | Intake session open or resumable. | Input routable; remote disclosure if provider used. | Duplicate turn detection review-needed. | Turn recorded. | IntakeTurnRecorded | Preserve user input if provider fails. |
| CreateContextualSuggestion | System | Offer a source-labeled optional answer for a directly related question. | Clarification | Current question has direct dependency on prior state. | Source basis exists; suggestion cannot be confirmed state. | Duplicate suggestion should merge or suppress. | Suggestion proposed. | ContextualSuggestionCreated | Ask question without suggestion if source is weak or stale. |
| ReviewContextualSuggestion | User | Accept, edit, reject, or ignore a contextual suggestion. | Clarification / Decision Registry | Suggestion exists and is current. | Accept/edit routes through answer/proposal flow; reject/ignore does not mutate confirmed state. | Duplicate review returns current suggestion status. | Suggestion reviewed; possible answer/proposal captured. | ContextualSuggestionReviewed | Revalidate source if stale before capture. |
| ProposeDecision | System | Create a reviewable decision candidate. | Clarification / Decision Registry | Valid interpreted output. | Schema-valid; cannot mark confirmed. | Duplicate proposal should merge or flag duplicate. | Proposed decision created. | DecisionProposed | Reject malformed proposal. |
| ConfirmDecision | User | Accept a proposed decision. | Decision Registry | Decision is proposed or revised pending confirmation. | Explicit user action required. | Duplicate confirm returns current confirmed state. | Decision becomes confirmed. | DecisionConfirmed | Reject invalid transition. |
| ReviseDecision | User | Change a confirmed or proposed decision. | Decision Registry | Decision exists. | Revision must preserve audit trail. | Duplicate identical revision is no-op. | Decision revised; affected outputs stale. | DecisionRevised, OutputMarkedStale | Show affected docs; reject unsafe transition. |
| RejectDecision | User | Reject a proposed decision. | Decision Registry | Decision is proposed. | Explicit user action. | Duplicate reject is no-op. | Decision rejected. | DecisionRejected | Reject if already confirmed unless supersession flow used. |
| DeferDecision | User | Defer decision until later. | Decision Registry | Decision exists. | Deferral reason recommended. | Duplicate defer is no-op. | Decision deferred. | DecisionDeferred | Keep gap visible. |
| RecordAssumption | User/System | Track temporary planning assumption. | Knowledge Gap | Assumption content exists. | Must be caveated and source-linked. | Duplicate should merge or flag. | Assumption active/proposed. | AssumptionRecorded | Reject as confirmed fact. |
| ResolveOpenQuestion | User | Answer or close an open question. | Knowledge Gap | Question exists. | Resolution must be answer, deferred, or obsolete. | Duplicate resolution no-op. | Question answered/deferred/obsolete. | OpenQuestionResolved | Invalid resolution rejected. |
| RunValidation | User/System | Evaluate deterministic readiness. | Validation | Workspace and profile loadable. | No AI dependency. | Safe to repeat. | Validation findings recorded/updated. | ValidationRunCompleted | Report invalid state/profile. |
| DiagnoseWorkspace | User/System | Explain gaps, risks, contradictions, next actions. | Validation / Knowledge Gap | Workspace readable. | Severity and affected object required. | Safe to repeat. | Diagnostic findings active/obsolete. | DiagnosticFindingRaised | Return recovery-oriented error. |
| GenerateOutputs | User | Render canonical and derived outputs. | Generation | Valid root; user write consent; profile loadable. | Root safety; overwrite checks; readiness preflight. | Retry produces new report and respects current state. | Outputs generated/skipped/failed; report recorded. | GenerationCompleted or GenerationPartiallyCompleted | Partial report; no silent overwrite. |
| MarkOutputsStale | System | Reflect source-state change. | Generation | Source change occurred. | Affected outputs resolvable where possible. | Safe to repeat. | Output statuses stale. | OutputMarkedStale | If dependencies unknown, mark uncertainty. |

Authorization relevance: MVP has no user accounts or roles. Authorization means user intent and local permission gates, not server-side identity.

## Domain Events

| Event | Meaning | Trigger | Source Aggregate | Payload | Ordering / Idempotency | Consumers | Privacy/Security Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WorkspaceInitialized | Workspace became initialized. | InitializeWorkspace succeeds. | Workspace | workspace id, root, profile ref. | Idempotent by workspace id. | Status, observability, generation eligibility. | No secrets. |
| DocumentationRootChanged | Output root changed. | ChangeDocumentationRoot succeeds. | Workspace | old root, new root, timestamp. | Ordered per workspace config. | Generation, status, permission checks. | Paths are local project context. |
| ProviderConfigurationChanged | Provider status changed. | ConfigureProvider succeeds. | Workspace | provider mode, redacted status. | Latest status wins. | TUI, intake. | Never include token value. |
| IntakeTurnRecorded | User/system turn recorded for clarification. | RecordIntakeTurn succeeds. | Clarification | turn id, actor, summary/ref. | Ordered within session. | Intake, proposal interpretation. | May contain sensitive project context. |
| ContextualSuggestionCreated | A source-labeled suggestion exists for a current question. | CreateContextualSuggestion succeeds. | Clarification | suggestion id, question ref, source refs, confidence/caveat. | Idempotency by question/source/context where possible. | Intake view, status if persisted. | Not confirmed truth; may include sensitive project context. |
| ContextualSuggestionReviewed | User acted on a contextual suggestion. | ReviewContextualSuggestion succeeds. | Clarification | suggestion id, action, resulting answer/proposal refs if any. | Ordered per suggestion. | Intake, decision review, diagnostics. | Rejection/ignore should not mutate confirmed state. |
| DecisionProposed | A decision candidate exists for review. | ProposeDecision succeeds. | Clarification / Decision Registry | decision id, source ref, confidence. | Idempotency by source/ref where possible. | Proposal Review, status. | Not confirmed truth. |
| DecisionConfirmed | User confirmed a decision. | ConfirmDecision succeeds. | Decision Registry | decision id, revision id, affected docs. | Ordered per decision. | Generation, validation, diagnostics. | User-owned commitment. |
| DecisionRevised | Decision content changed. | ReviseDecision succeeds. | Decision Registry | decision id, old/new revision refs, affected docs. | Ordered per decision. | Staleness evaluation, diagnostics. | Preserve audit trail. |
| DecisionRejected | Proposed decision rejected. | RejectDecision succeeds. | Decision Registry | decision id, reason optional. | Terminal for proposal revision unless reopened. | Intake, status. | Avoid retaining sensitive rejected content beyond policy. |
| DecisionDeferred | Decision deferred. | DeferDecision succeeds. | Decision Registry | decision id, reason optional. | Latest deferral status wins. | Diagnostics, status. | Keep visible as unresolved. |
| AssumptionRecorded | Assumption captured. | RecordAssumption succeeds. | Knowledge Gap | assumption id, caveat, source ref. | Idempotency by content/source where possible. | Generation, diagnostics. | Must not be rendered as fact. |
| OpenQuestionCreated | Known unknown captured. | Intake or diagnostics identify gap. | Knowledge Gap | question id, affected docs. | Duplicate questions should merge/flag. | Status, diagnostics. | None special unless content sensitive. |
| OpenQuestionResolved | Question answered/deferred/obsolete. | ResolveOpenQuestion succeeds. | Knowledge Gap | question id, resolution status. | Ordered per question. | Validation, generation. | Preserve source caveats. |
| ValidationRunCompleted | Deterministic validation completed. | RunValidation succeeds. | Validation | run id, finding counts, severity summary. | Each run supersedes prior snapshot. | Status, release gates. | No AI dependency. |
| ValidationFindingRaised | Blocking/warning finding exists. | RunValidation identifies issue. | Validation | finding id, severity, affected object. | Deterministic key preferred. | Diagnostics, UI. | Local only. |
| DiagnosticFindingRaised | Diagnostic next action exists. | DiagnoseWorkspace identifies issue. | Knowledge Gap / Validation | finding id, severity, next action. | May supersede prior diagnostic. | TUI, support. | Avoid leaking broad context. |
| OutputMarkedStale | Output no longer reflects source state. | Decision/risk/assumption/profile/root changes. | Generation | output id, source change ref. | Idempotent by output/source version. | Status, generation. | Local file path only. |
| GenerationCompleted | Generation finished successfully. | GenerateOutputs completes all planned outputs. | Generation | report id, output summary. | Ordered by generation id/time. | Status, observability. | Paths under configured root. |
| GenerationPartiallyCompleted | Some outputs failed/skipped/blocked. | GenerateOutputs partially succeeds. | Generation | report id, result categories. | Ordered by generation id/time. | Recovery, support. | Do not hide failures. |

Events are domain facts, not UI notifications or analytics events. Integration and observability documents may derive messages or logs from them.

## Invariants

| Invariant | Applies To | Type | Rationale | Enforcement Location | Violation Behavior | Test Implication | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A confirmed decision must require explicit user action. | Decision Registry | aggregate / business | Preserves user ownership and AI boundary. | Decision aggregate and command handler. | Reject transition. | State transition tests. | hard |
| AI output may create proposals, not confirmed state. | Clarification, Decision | cross-aggregate | Prevents false authority. | Proposal interpretation service. | Reject or downgrade to proposal. | Malformed/overconfident AI fixture tests. | hard |
| Contextual suggestions may create answer/proposal input, not confirmed state. | Clarification, Contextual Suggestion, Decision | cross-aggregate | Coherent prior-state suggestions must not become silent decisions. | Contextual suggestion service and decision service. | Route through answer/proposal capture or reject transition. | Suggestion acceptance and no-confirmation tests. | hard |
| Assumptions must remain visibly caveated. | Assumption, Generation | business / temporal | Prevents unvalidated claims. | Knowledge Gap, Renderer, Validation. | Block or warn generation if caveat would be hidden. | Output review tests. | hard |
| Unknown answers create open questions rather than fabricated content. | Intake, Knowledge Gap | business | Preserves uncertainty. | Intake/domain service. | Create open question. | Intake tests. | hard |
| Deterministic validation must not depend on live AI. | Validation | bounded-context | Enables offline verification. | Validation service. | Fail architecture/test review. | No-provider validation tests. | hard |
| Documentation root defaults to `logos/` and is configurable. | Workspace | business/config | Avoids collision with existing docs. | Workspace aggregate/config service. | Reject hard-coded generated root behavior. | Root config tests. | hard |
| Generated output paths must resolve under the configured root. | Generation | security/data integrity | Prevents unsafe writes. | Generation planning and filesystem port. | Block write. | Path traversal/root tests. | hard |
| Executive plans must derive from normative documents, not private chat history. | Executive | source-of-truth | Preserves traceability and avoids stale planning artifacts. | Executive compiler. | Block or mark review-needed. | Source-reference/schema tests. | hard |
| Executive exports must not become live task state. | Executive/Integration | product boundary | Prevents LOGOS from becoming a task manager. | Export adapters and reports. | Mark as derived/unsupported or block sync behavior. | Export golden tests and review. | hard |
| Derived outputs are not canonical source. | Generation, Outputs | business/data integrity | Preserves traceability. | Generation/reporting/domain terms. | Mark derived and prevent source mutation. | Report/output classification tests. | hard |
| Raw provider tokens must not be stored in project files. | Provider Configuration | security/privacy | Protects user secrets. | Configuration/credential policy. | Reject unsafe config. | Secret scanning/inspection. | hard |
| Remote provider transmission requires disclosure. | Provider Configuration, Intake | security/privacy | Protects local-first trust. | Permission policy. | Block provider call. | Provider setup tests. | hard |
| Workspace state must be schema-valid before mutation. | Workspace State | data integrity | Prevents corruption. | State repository/domain command layer. | Enter recovery/diagnostic mode. | Invalid state tests. | hard |
| Generation reports must not hide partial failure. | Generation | observability/reliability | Recovery depends on accurate output status. | Generation aggregate. | Mark partial/failed. | Partial generation tests. | hard |
| Profile contracts must validate before generation. | Profile Contract | data integrity | Generation depends on contract meaning. | Profile aggregate/generation preflight. | Block generation. | Invalid profile tests. | hard |
| Revisions to confirmed decisions must preserve traceability. | Decision Registry | auditability | Prevents silent overwrite. | Decision aggregate. | Create revision/supersession. | Revision/audit tests. | hard |

## Business Rules

| Rule | Source | Rationale | Fixed or Configurable | Precedence | Auditability | Versioning |
| --- | --- | --- | --- | --- | --- | --- |
| Non-slash input is treated as conversational intake. | Interaction Model, FR-045 | Normal UX is conversation-first. | fixed for MVP | Below explicit slash commands. | Session turn record. | Product change required. |
| Slash-prefixed input is treated as command intent. | Interaction Model, FR-016 | Explicit operations need clear routing. | fixed for MVP | Above conversation. | Command result. | Product change required. |
| `/generate` requires explicit user intent before file writes. | FR-022, Permission Model | Protects files and trust. | fixed | Hard safety rule. | Generation report. | Product/security review. |
| Root changes require explicit confirmation. | FR-023 | Affects where outputs are written. | fixed | Hard safety rule. | Config event. | Product/security review. |
| Provider failures must preserve user input and confirmed state. | FR-030, NFR-REL-001 | Prevents AI dependency from corrupting work. | fixed | Hard reliability rule. | Provider failure record. | Engineering review. |
| No-provider mode still supports status, validation, diagnostics, and generation from existing state. | FR-042, NFR-AVA-002 | Keeps local deterministic core useful. | fixed | Availability rule. | Command result. | Engineering review. |
| Validation caveats and unsupported claims must surface in diagnostics and generated docs. | FR-050, Validation Report | Prevents false validation. | fixed | Hard trust rule. | Output review. | Product review. |
| Hosted collaboration, accounts, marketplace, task boards, and external research are excluded from MVP. | Foundation Boundaries, Product Scope | Prevents scope drift. | fixed until scope change | Scope boundary. | Release review. | Founder/user decision. |
| Output browsing is preferred but not core if generation reports remain sufficient. | Product Scope / FR-029 | Useful but not primary domain. | configurable by scope | MVP core first. | Scope decision. | Product review. |

Conflict precedence:

1. Security/privacy invariants.
2. User confirmation and local ownership invariants.
3. Profile contract validity.
4. Deterministic validation and readiness rules.
5. Generation convenience and derived output completeness.
6. UI convenience.

## State Machines

### Workspace State Machine

| State | Meaning |
| --- | --- |
| not-detected | No usable repository/workspace context. |
| detected-uninitialized | Repository found, LOGOS workspace not initialized. |
| initialized | Workspace metadata exists. |
| active | Workspace is loadable with active profile/root. |
| inconsistent | Workspace state/profile/root conflict detected. |
| recovery-needed | Safe operation requires repair, migration, or user confirmation. |

Valid transitions:

- not-detected → detected-uninitialized.
- detected-uninitialized → initialized via InitializeWorkspace.
- initialized → active after profile/root/state validation.
- active → inconsistent when state/profile/root fails validation.
- inconsistent → recovery-needed when automatic recovery is unsafe.
- recovery-needed → active after successful repair or confirmed recovery.

Invalid transition: recovery-needed → active without validation or explicit recovery action.

### Decision State Machine

| State | Meaning |
| --- | --- |
| proposed | Candidate awaiting user review. |
| confirmed | User accepted decision. |
| rejected | User rejected proposed decision. |
| deferred | Decision postponed and remains visible. |
| superseded | Prior confirmed decision replaced by newer decision/revision. |

Valid transitions:

- proposed → confirmed via ConfirmDecision.
- proposed → rejected via RejectDecision.
- proposed → deferred via DeferDecision.
- confirmed → superseded via ReviseDecision or supersession command.
- confirmed → deferred only through explicit revision/supersession policy if later defined.
- deferred → proposed when revisited.
- deferred → confirmed via explicit user confirmation.

Invalid transitions:

- proposed → confirmed by AI/system alone.
- rejected → confirmed without reopening/proposing again.
- confirmed → deleted without audit trail.

### Assumption State Machine

| State | Meaning |
| --- | --- |
| proposed | Suggested but not accepted for planning. |
| active | Accepted as temporary planning premise. |
| challenged | Questioned by user, validation, or new evidence. |
| resolved | Replaced by decision, evidence, or explicit answer. |
| superseded | Replaced by newer assumption. |

Guard: active assumptions must remain caveated in diagnostics and generation.

### Open Question State Machine

| State | Meaning |
| --- | --- |
| open | Known unknown requiring future answer. |
| answered | User supplied answer or decision. |
| deferred | Known but intentionally postponed. |
| obsolete | No longer relevant due to scope/profile/state change. |

Guard: open or deferred questions affecting required documents must remain visible.

### Risk State Machine

| State | Meaning |
| --- | --- |
| identified | Risk is known. |
| monitored | Risk is tracked without active mitigation. |
| mitigated | Mitigation exists. |
| accepted | User explicitly accepts remaining risk. |
| closed | Risk no longer applies. |

Guard: accepted risks require visible rationale or status.

### Generated Output State Machine

| State | Meaning |
| --- | --- |
| planned | Output is expected by contract or generation plan. |
| generated | Output exists and reflects current source snapshot. |
| skipped | Output intentionally not generated. |
| blocked | Output cannot be generated due to blocking condition. |
| failed | Generation attempted and failed. |
| stale | Output exists but source state changed. |
| obsolete | Output no longer belongs to active profile/root/contract. |

Valid transitions:

- planned → generated, skipped, blocked, or failed.
- generated → stale when source state changes.
- stale → generated after regeneration.
- generated/stale → obsolete when profile/root/contract changes make it irrelevant.

### Provider Configuration State Machine

| State | Meaning |
| --- | --- |
| unconfigured | No provider available. |
| configured | Provider mode and safe token source are available. |
| invalid | Configuration exists but cannot be used. |
| unavailable | Provider is configured but not reachable or timed out. |

Guard: remote configured state does not imply disclosure has happened for a specific transmission context.

## Bounded Contexts

| Context | Classification | Responsibility | Language | Owned Concepts | External Concepts | Integration Pattern | Anti-Corruption Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace Context | core domain | Repository-local workspace identity, active root, active profile, recoverable state. | workspace, root, active profile, recovery. | Repository Workspace, Documentation Root, Workspace Status. | Filesystem paths, OS permissions. | Ports/adapters. | Normalize paths and avoid exposing raw filesystem behavior as domain truth. |
| Profile Contract Context | supporting domain | Define document/phase/output contracts. | profile, phase, document contract, quality rule. | Profile, Phase, Document Contract. | YAML parser, bundled files. | Anti-corruption through schema validation. | Profiles are data, not code. |
| Clarification Context | core domain | Turn conversation into reviewable proposed knowledge. | intake, turn, proposal, confidence. | Intake Session, Intake Turn, Proposed Decision. | AI provider responses. | Provider adapter and interpretation service. | Provider output must be schema-validated and downgraded to proposal. |
| Decision Governance Context | core domain | Preserve decisions, assumptions, questions, risks, and lifecycles. | decision, assumption, open question, risk, confirmed, deferred. | Decision, Assumption, Open Question, Risk. | User input, profile dependencies. | Application service coordination. | UI/provider must not bypass lifecycle rules. |
| Validation and Diagnostics Context | core domain | Determine deterministic readiness and explain gaps. | validation finding, diagnostic finding, severity, affected object. | Validation Finding, Diagnostic Finding. | Profile rules, state snapshot. | Read-only evaluation over state/profile. | AI explanations must not replace deterministic rules. |
| Generation Context | supporting/core output | Produce canonical and derived outputs from state/contracts. | generation plan, canonical, derived, stale, report. | Generation Report, Generated Output, Staleness Marker. | Filesystem renderer. | Renderer/file ports. | Derived outputs cannot become canonical source. |
| Executive Context | supporting execution exchange | Produce portable execution structure from normative docs. | executive plan, execution graph, export adapter, readiness, source refs. | Executive Plan, Executive Export, Generated Output. | Normative docs, profile contracts, executive mappings. | Executive compiler/export ports. | External tools own live task state. |
| Provider Configuration Context | integration/supporting | Represent safe AI provider availability and transmission constraints. | provider mode, token source, disclosure, no-provider. | Provider Configuration. | Remote/local provider APIs, OS env/credential store. | Provider ports. | Redact secrets and avoid importing provider concepts into domain decisions. |

Context map:

```text
Workspace Context
  -> Profile Contract Context
  -> Clarification Context
  -> Decision Governance Context
  -> Validation and Diagnostics Context
  -> Generation Context

Provider Configuration Context
  -> Clarification Context

External AI Provider
  -> Provider Configuration Context
  -> Clarification Context
```

The core domain is Decision Governance plus Clarification and Validation/Diagnostics. Workspace, Profile, Generation, and Provider Configuration are essential supporting contexts.

## Domain Risks

| Risk | Affected Area | Failure Mode | Impact | Mitigation | Evidence Needed | Target Document |
| --- | --- | --- | --- | --- | --- | --- |
| IA objects are copied directly into persistence entities. | entities/data | Data Model becomes UI/file-tree shaped instead of invariant-shaped. | Weak domain rules and brittle schemas. | Preserve aggregate and invariant boundaries. | Data model review. | Data Model |
| Decision and assumption semantics blur. | ubiquitous language | Assumptions are rendered as confirmed truth. | False confidence and validation overclaiming. | Hard caveat invariants and output tests. | Prototype output review. | Test Strategy |
| AI proposal lifecycle is under-modeled. | state machines | AI output mutates confirmed state. | User agency violation. | Proposal-only commands and transition tests. | AI fixture tests. | API Contracts |
| Documentation root and internal state are confused. | Workspace | User deletes/moves wrong folder or generated outputs go to wrong path. | Trust and data loss risk. | Separate terms and config entities. | User testing on setup. | Data Model, Security |
| Derived artifacts become canonical in practice. | Generation | HTML/agent packs edited or cited as source truth. | Traceability loss. | Derived output policy, labels, stale markers. | Artifact review. | Integration Architecture |
| Validation and diagnostics are collapsed. | Validation | AI explanation treated as deterministic pass/fail. | Release gate unreliability. | Separate bounded contexts and events. | No-provider tests. | Test Strategy |
| Over-modeling speculative profile ecosystem. | Profile | Marketplace/profile authoring concepts enter core model too early. | Scope creep. | Keep profile governance deferred. | Validation evidence. | Risk Management |
| Under-modeling output staleness. | Generation | Users rely on outdated docs after decision changes. | Bad downstream execution. | Staleness state machine and events. | Regeneration tests. | Data Model |
| Missing auditability for decision revisions. | Decision | Confirmed decisions change without trace. | Loss of trust. | Revision/supersession events. | State transition tests. | Observability Plan |
| Provider concepts leak into domain language. | Provider | Domain model depends on specific provider quirks. | Lock-in and brittle behavior. | Anti-corruption layer around provider output. | Integration tests. | Integration Architecture |

## Downstream Handoff

### Data Model

Data Model must translate entities, value objects, aggregates, events, and state machines into versioned filesystem schemas without changing domain semantics. It must preserve structured state as durable project truth, separate internal workspace state from the configured `logos/` documentation root, and represent decision revision, staleness, validation findings, generation reports, and derived output metadata.

### Security Architecture

Security Architecture must inherit invariants for remote provider disclosure, token safety, local state ownership, write/root-change confirmation, path safety, and privacy-sensitive domain data. It must not introduce accounts or server authorization into MVP unless scope changes.

### API Contracts

API Contracts must inherit domain commands, events, state transitions, failure behavior, idempotency expectations, and permission relevance. API payloads must distinguish commands from queries and events from audit logs or UI notifications.

### Integration Architecture

Integration Architecture must inherit the anti-corruption boundary between provider output and domain proposals. Provider responses may feed Proposal Interpretation, but they cannot create confirmed decisions or deterministic validation results.

### Frontend Architecture

Frontend Architecture must render domain states faithfully: proposed, confirmed, rejected, deferred, superseded, active assumption, open question, blocking finding, stale output, canonical output, derived output, partial generation, and no-provider state. UI labels must not collapse distinct domain terms for convenience.

### Test Strategy

Test Strategy must cover domain invariants, aggregate state transitions, invalid transitions, no-provider validation, malformed AI output, staleness evaluation, generation report classification, root safety, token safety, and assumption caveat preservation.

### Observability Plan

Observability must preserve domain events and audit trails locally: workspace initialization, root change, provider config change, decision transitions, assumption/question/risk updates, validation runs, diagnostic findings, output staleness, and generation reports. These are not telemetry events.

### Operations and Support

Support Model must use domain language when helping users: workspace, documentation root, profile, decision, assumption, open question, validation finding, diagnostic finding, canonical document, derived artifact, agent pack, and generation report. Support must avoid implying that AI output or derived artifacts are authoritative.

### Risk Management

Risk Management must track modelling risks around AI false authority, assumption/fact confusion, root/state confusion, stale outputs, profile scope creep, provider leakage, and validation overclaiming.

### Unresolved Domain Questions

- What exact lifecycle should Intake Session have when multiple sessions overlap or resume?
- Should raw intake turns be retained indefinitely, summarized, or pruned after interpretation?
- How should duplicate proposed decisions be detected and merged?
- What is the precise boundary between Validation Finding and Diagnostic Finding in saved state?
- Which validation severities block generation versus warn with caveats?
- What metadata is required to prove a generated output is stale?
- How should manual edits to canonical Markdown affect domain state, if at all?
- Should profile version changes create explicit domain events or only data-model migration records?
