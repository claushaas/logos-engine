# UI Specification

## UI Thesis

LOGOS Engine's UI should make project clarity state visible inside a restrained, keyboard-first TUI: the user should always be able to see where they are, what LOGOS knows, what is proposed, what is confirmed, what is missing, what will be written, and what action is safest next.

The interface should feel like a focused local workbench for structured thinking, not a dashboard, chat app, form wizard, or presentation surface. The UI exists to expose state, guide decisions, protect consent, and make generated outputs reviewable. Visual polish is useful only when it strengthens orientation, trust, and recovery.

The UI must make these things visually obvious:

- Active repository.
- Active LOGOS documentation root, defaulting to `logos/` unless the user configures another folder.
- Active profile and phase or document context.
- AI provider status when AI interaction is relevant.
- Whether content is conversational, proposed, confirmed, assumed, unknown, incomplete, blocked, canonical, derived, stale, partial, or failed.
- Whether an answer is only a contextual suggestion derived from earlier project state.
- Whether an action will write files, overwrite files, send context remotely, change configuration, or update canonical state.
- The next useful action without hiding alternative safe actions.

The UI should be calm and information-dense enough for technical and product-adjacent builders, but not so dense that first use feels like operating a database. It should use progressive disclosure: show the current action and critical context first, then allow deeper inspection of profile contracts, state details, generated files, diagnostics, and derived artifacts.

The UI must avoid becoming:

- A generic chat interface where transcript position is the main orientation system.
- A SaaS dashboard where cards and metrics obscure local source-of-truth files.
- A deterministic form wizard that requires question IDs during normal intake.
- A decorative documentation portal that makes weak structure look complete.
- A project management interface with tasks, calendars, and team reporting.
- A visual surface that hides risk, uncertainty, permissions, or recovery paths for cleanliness.

This UI specification is based on founder-origin experience, existing Foundation and Product documents, Validation constraints, old TUI material, and current Product-phase documents. It is not externally validated usability evidence.

## Screen Inventory

The MVP UI is one TUI shell with multiple views, panels, overlays, and reports. The exact component implementation belongs to Design System and Frontend Architecture; this document defines what surfaces exist and what they must communicate.

| ID | Screen or View | Classification | Purpose | User Goal | Entry Points | Exit Points | Primary Objects | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UI-001 | TUI Shell | global / MVP | Provide stable frame, command input, conversation area, status, and feedback. | Stay oriented and act safely. | `logos` | `/exit`, command navigation | Repository Workspace, Workspace State | MVP |
| UI-002 | First-Run / Initialization View | contextual / MVP | Start LOGOS in an uninitialized repository. | Initialize safely with profile and root awareness. | `logos`, `/init` | Intake, status, exit | Repository Workspace, Documentation Root, Profile | MVP |
| UI-003 | Workspace Status View | global / MVP | Summarize repository, root, profile, progress, decisions, diagnostics, and next action. | Understand current state without changing it. | `/status`, startup, recovery | Continue, generate, diagnose, configure | Workspace State, Phase, Document, Decision | MVP |
| UI-004 | Conversational Intake View | primary / MVP | Capture natural language project context and show AI-led question clusters. | Clarify ambiguous intent without form burden. | non-slash input, `/continue` | Review proposals, status, generate, exit | Intake Conversation, Open Question, Assumption | MVP |
| UI-005 | Proposal Review View | contextual / MVP | Review AI-derived proposed decisions, assumptions, and follow-ups. | Confirm, revise, reject, or defer proposals. | Intake, diagnostics, `/status` | Intake, status, generate | Decision, Assumption, Open Question | MVP |
| UI-006 | Decision Detail / Revision View | contextual / MVP | Inspect or change a decision and affected documents. | Correct or supersede project state safely. | Proposal review, diagnostics, status | Review, status, regenerate | Decision, Canonical Document | MVP |
| UI-007 | Generation Confirmation View | modal-like / MVP | Show target root, output categories, write implications, and confirmation. | Decide whether generation should write or update files. | `/generate`, suggestion | Generation report, cancel | Documentation Root, Document Contract, Output | MVP |
| UI-008 | Generation Report View | report / MVP | Show created, updated, skipped, incomplete, blocked, failed, canonical, and derived outputs. | Review what changed and what to do next. | `/generate` result, status | Diagnostics, output review, continue | Generation Report, Canonical Document, HTML Artifact, Agent Pack | MVP |
| UI-009 | Diagnostics View | report / MVP | Group missing decisions, contradictions, risks, and next actions by severity and affected object. | Find the next useful clarification step. | `/diagnose`, status, generation report | Intake, decision review, validate | Diagnostic Finding, Risk, Open Question | MVP |
| UI-010 | Validation View | report / MVP | Show readiness checks, validation gaps, unsupported claims, and evidence needs. | Avoid treating assumptions as validated facts. | `/validate`, diagnostics | Intake, evidence note, status | Validation Gap, Assumption, Evidence | MVP |
| UI-011 | AI Provider Configuration View | contextual / MVP | Configure or inspect AI provider status with redacted secrets and remote/local disclosure. | Enable AI safely or understand no-provider mode. | `/config ai`, blocked AI operation | Intake, status, exit | AI Provider Configuration | MVP |
| UI-012 | Documentation Root Configuration View | contextual / MVP | Accept `logos/` or configure another root with path and collision disclosure. | Control where LOGOS writes generated documentation. | `/init`, status, root warning | Status, intake, generation | LOGOS Documentation Root | MVP |
| UI-013 | Error and Recovery View | system surface / MVP | Explain failure, preserved state, and next safe action. | Recover without losing trust or context. | any failed action | retry, configure, status, exit | Failed Operation, Workspace State | MVP |
| UI-014 | Command Help View | overlay / MVP | Show available slash commands and current-context guidance. | Discover how to act. | `/help`, invalid command | return to prior context | Command Surface | MVP |
| UI-015 | Output Browser View | contextual / preferred MVP | List canonical Markdown, HTML artifacts, and agent packs under active root. | Find and distinguish generated outputs. | generation report, status | status, diagnostics | Canonical Document, HTML Artifact, Agent Pack | preferred / validation-required |
| UI-016 | Advanced Profile Contract View | advanced / deferred | Inspect profile document contracts, criteria, and outputs. | Understand why documents and checks exist. | advanced command or document detail | status | Profile, Document Contract | deferred |
| UI-017 | Search / Retrieval View | deferred | Search or filter LOGOS content. | Find objects across large projects. | future search command | object detail | Decisions, documents, diagnostics | deferred |
| UI-018 | Hosted Collaboration Views | excluded from MVP | Support multi-user cloud collaboration. | Coordinate with others. | none in MVP | none | Teams, accounts | deferred / out of scope |

## Layout Rules

### Global TUI Structure

The global TUI should use a stable, predictable structure:

1. **Orientation header:** repository, LOGOS documentation root, profile, provider status when relevant, and current state category.
2. **Primary work area:** conversation, review, report, configuration, or recovery content.
3. **Context rail or summary block:** current phase, affected document, decision status, diagnostics, or output summary when relevant and space permits.
4. **Action area:** command input, available actions, confirmation controls, or next-action guidance.
5. **Feedback area:** transient command feedback, warnings, errors, loading, and success messages.

On narrow terminal widths, these regions should stack in priority order rather than hide critical context.

### Layout Priority

The highest-priority visible information is:

1. Risk or consent prompt if present.
2. Current question, decision proposal, diagnostic, generation report, or configuration issue.
3. Active repository and active LOGOS documentation root.
4. Current state category and next action.
5. Affected phase, document, decision, output, or provider context.
6. Secondary summaries and advanced details.

### Density Behavior

The UI should support dense work without creating a wall of equal-weight text.

- Show one primary user decision at a time when confirmation is required.
- Group diagnostics by severity and affected object.
- Summarize generation results before listing files.
- Show proposal batches with clear status and per-item actions.
- Collapse advanced contract details by default.
- Avoid full phase maps during intake unless requested.
- Preserve critical warnings even when compacting.

### Terminal Viewport Classes

The UI should assume terminal variability. These classes are provisional and require engineering review:

| Viewport Class | Approximate Width | Layout Behavior |
| --- | --- | --- |
| Compact terminal | under 80 columns | Single-column stack; hide advanced summaries behind commands; never hide root, risk, or confirmation. |
| Standard terminal | 80-119 columns | Header, primary work area, compact context summaries, command/action area. |
| Wide terminal | 120+ columns | Optional side context for phase, affected documents, proposal counts, diagnostics, or output categories. |

Height-constrained terminals should prioritize current action, feedback, and command input. Historical conversation and long reports should scroll or paginate.

### Composition Rules

- Do not put critical consequence information only in side regions.
- Do not require horizontal scanning for confirmation prompts.
- Do not place unrelated diagnostics, proposals, and generation results at the same hierarchy level.
- Do not use decorative panels where a plain grouped report is clearer.
- Do not use a dashboard grid as the default first screen.
- Do not use layout to imply completeness when documents are incomplete.

## Visual Hierarchy

The UI hierarchy should distinguish action, state, consequence, and source-of-truth status.

### Dominant Information by Screen Type

| Screen Type | Visually Dominant | Secondary | Risk-Critical |
| --- | --- | --- | --- |
| Startup / status | active repository, root, next action | profile, progress, counts | wrong directory, missing root, provider missing |
| Intake | current question cluster or user turn | why it matters, affected document | remote provider disclosure, low-confidence interpretation |
| Proposal review | proposed decision and status | evidence basis, affected documents | confirmation consequence |
| Generation confirmation | active root and output categories | document counts and derived outputs | write/overwrite, stale or partial risk |
| Generation report | result summary by category | file-level detail | failed, blocked, skipped, incomplete |
| Diagnostics | severity and affected object | explanation and next action | critical contradictions or validation gaps |
| Configuration | current value and proposed change | alternatives | remote context, raw token safety, path collision |
| Error / recovery | what failed and preserved state | cause detail | data loss, state inconsistency, retry risk |

### State Treatment

State labels must be visible in text. Color or icon treatment may reinforce meaning but cannot carry meaning alone.

| State | UI Treatment |
| --- | --- |
| Proposed | Distinct from confirmed; always reviewable. |
| Confirmed | Stronger status but still revisable with affected-document warning. |
| Assumed | Caveated and visible near generated or validation-sensitive content. |
| Unknown | Valid state; paired with open question or next action. |
| Incomplete | Visible without shame; tied to missing object or document. |
| Blocked | Prominent, with recovery path. |
| Stale | Connected to changed source state and regeneration option. |
| Canonical | Marked as primary human-readable generated output. |
| Derived | Marked as regenerated from canonical source; not source of truth. |
| Low confidence | Requires review; never visually merged with confirmed content. |
| Contextual suggestion | Optional and source-labeled; never styled as already accepted or expected. |
| Partial | Summary must show what succeeded and what did not. |
| Failed | Clear error state with preserved state and next safe action. |

### Action Hierarchy

Primary actions should represent the next useful safe action, not the product's preferred business outcome.

- Primary action: continue intake, review proposals, confirm generation, run diagnostics, configure provider, accept root.
- Secondary action: status, defer, inspect affected documents, view output list, configure later.
- Destructive or high-risk action: visually distinct, never adjacent to safe primary action without clear labeling.
- Dismissal: available for suggestions and non-blocking guidance without penalty.

### Warnings and Uncertainty

Warnings should be proportional:

- **Blocking warning:** prevents action until addressed or explicitly overridden where safe.
- **High-risk warning:** requires confirmation.
- **Caveat:** visible but does not interrupt normal progress.
- **Informational note:** available without crowding primary flow.

Uncertainty should not be styled as failure. It should be styled as project state.

## Component Usage

### Component Classes

| Component | Purpose | Used In | Variants | Do Not Use When | Accessibility Expectations |
| --- | --- | --- | --- | --- | --- |
| Orientation Header | Show active repository, root, profile, provider status, and state category. | All major views | normal, warning, compact | Never omit on write/config screens. | Text labels, not color-only status. |
| Command Input | Accept slash commands and conversational text. | TUI Shell | idle, focused, pending, error | Do not use for irreversible action confirmation alone. | Keyboard-first, clear focus. |
| Conversation Turn | Display user and AI-led intake messages. | Intake | user, system, AI, low-confidence | Do not treat AI turn as confirmed state. | Speaker/status text labels. |
| Question Cluster | Present small set of questions. | Intake, diagnostics follow-up | normal, blocking, optional | Do not show long questionnaire pages by default. | Clear order and keyboard navigation. |
| Contextual Suggestion | Show a suggested answer, option, or framing grounded in earlier state. | Intake, diagnostics follow-up, proposal review | normal, low-confidence, conflicted, source-limited | Do not show when source basis is weak or unrelated; do not make it look confirmed. | Source/caveat text and accept/edit/reject/ignore actions. |
| Proposal Card | Show proposed decision, assumption, or follow-up. | Proposal Review | proposed, low-confidence, conflicted | Do not use for confirmed content without relabeling. | Status in text; actions reachable. |
| Decision Status Badge | Mark proposed, confirmed, rejected, deferred, deprecated. | Review, status, documents | all decision states | Do not rely on color alone. | Text label required. |
| Assumption Badge | Mark accepted-for-now or unvalidated assumption. | Review, diagnostics, generated reports | proposed, accepted, needs validation | Do not replace validation gaps. | Text label required. |
| Diagnostic Finding Row | Summarize severity, object, message, next action. | Diagnostics, status | critical, error, warning, info | Do not flatten all severities visually. | Severity text required. |
| Generation Summary | Report generated output categories. | Generation Report | success, partial, failed | Do not show simple success if partial. | Category names and counts in text. |
| File Result Row | Show file path and result. | Generation Report, Output Browser | created, updated, skipped, blocked, failed, stale | Do not imply derived files are canonical. | Path readable and copyable where feasible. |
| Confirmation Prompt | Explain action, target, consequence, alternatives. | Generation, config, decision confirm | normal, strong, destructive | Do not use for harmless read-only navigation. | Focus managed; explicit actions. |
| Inline Alert | Surface local warning, caveat, or note. | All relevant views | info, caveat, warning, error | Do not hide critical prompts inline if action is blocked. | Text and role semantics downstream. |
| Empty State Block | Explain absence and next action. | Empty views | new, zero-results, permission, filtered, intentional | Do not use for loading or errors. | Clear explanation and action. |
| Loading Indicator | Show pending action. | AI, generation, diagnostics | inline, report-level, long-running | Do not imply exact progress if unknown. | Text status required. |
| Recovery Panel | Explain failure and recovery options. | Error screens | retry, configure, change root, status | Do not bury next action in logs. | Focus and keyboard actions. |
| Command Help List | Show available commands. | Help overlay, invalid command | full, contextual | Do not expose out-of-scope commands. | Navigable text list. |

### Consistency Requirements

- Status names must match Glossary, IA, and Interaction Model terms.
- The same status must look and read the same across screens.
- Confirmation prompts must always include action, target, consequence, and alternative.
- Derived outputs must always be labeled as derived.
- The active LOGOS documentation root must be displayed before generation.
- Provider status must be shown before AI operations that may use a provider.
- Error and recovery components must use the same structure across operation types.

## Screen-by-Screen Specification

### UI-001: TUI Shell

**Classification:** global / MVP.

**Purpose:** Provide the persistent frame for orientation, command input, conversational work, reports, feedback, and recovery.

**User goal:** Stay oriented while clarifying, reviewing, generating, diagnosing, configuring, or recovering.

**Primary journey:** All MVP journeys.

**Entry points:** `logos`, startup after command execution, return from any view.

**Exit points:** `/exit`, recovery exit, normal terminal close with state preservation where possible.

**Primary content:**

- Orientation header.
- Current view content.
- Command input.
- Current feedback or pending status.

**Secondary content:**

- Current profile.
- Current phase or document.
- Provider status when relevant.
- Proposal, diagnostic, or output counts.

**Available actions:** Enter non-slash text, enter slash command, open help, continue, status, exit.

**Component composition:** Orientation Header, Primary Work Area, Command Input, Feedback Area, optional Context Summary.

**States:** idle, active conversation, command pending, loading, error, recovery, narrow viewport.

**Empty state:** If no workspace exists, route to First-Run / Initialization View.

**Loading state:** Show current command or operation name and preserve command input state where possible.

**Error state:** Show error in Recovery Panel or inline alert depending on severity.

**Success state:** Quiet feedback for routine commands; persistent state for material changes.

**Permission state:** Show confirmation prompt before writes, provider use, root change, or canonical state confirmation.

**Responsive rules:** Stack context summaries below primary content on compact terminals.

**Accessibility notes:** Keyboard-first; focus must remain predictable after command execution and errors.

**Data dependencies:** Repository Workspace, Workspace State, command routing state.

**Downstream implications:** Frontend Architecture must support stable shell regions and command/conversation input routing.

**Open questions:** Exact terminal framework constraints require engineering review.

### UI-002: First-Run / Initialization View

**Classification:** contextual / MVP.

**Purpose:** Guide initialization without hiding repository path, profile, root, or provider implications.

**User goal:** Start safely in the intended repository.

**Primary journey:** Onboarding.

**Entry points:** `logos` in uninitialized repository, `/init`.

**Exit points:** accept initialization, configure root, configure provider, status, exit.

**Primary content:**

- Active repository path.
- Initialization status.
- Proposed profile.
- Proposed LOGOS documentation root, defaulting to `logos/`.
- Explanation that generated documentation will be written under the configured root.
- Primary action to initialize.

**Secondary content:**

- Why `logos/` avoids colliding with repository-owned documentation.
- AI provider status.
- Link to help.

**Available actions:** Initialize, configure root, configure AI, exit, help.

**Component composition:** Orientation Header, Empty State Block, Root Summary, Profile Summary, Confirmation Prompt.

**States:** new-user empty, root conflict, profile unavailable, provider not configured, initialization error, initialized.

**Empty state:** Explain that LOGOS has not been initialized and name the next action.

**Loading state:** Show "Initializing workspace" with no false progress precision.

**Error state:** Preserve no-write or partial-write details; route to recovery.

**Success state:** Show initialized workspace, active root, active profile, and next action.

**Permission state:** Confirm local write before creating workspace state or output root.

**Responsive rules:** On compact terminals, show repository and root before profile details.

**Accessibility notes:** Confirmation must be text-based and keyboard-reachable.

**Data dependencies:** Repository Workspace, Profile, LOGOS Documentation Root.

**Downstream implications:** Acceptance Criteria must verify no hidden default output path.

**Open questions:** Whether profile selection is explicit in first MVP or defaults to Standard requires final scope confirmation.

### UI-003: Workspace Status View

**Classification:** global / MVP.

**Purpose:** Summarize current project clarity state without mutating it.

**User goal:** Know what exists, what is missing, and what to do next.

**Primary journey:** Continue, repeat use, recovery, diagnostics.

**Entry points:** `/status`, startup with existing workspace, after errors, after generation.

**Exit points:** continue, review proposals, generate, diagnose, validate, configure.

**Primary content:**

- Active repository.
- Active LOGOS documentation root.
- Active profile.
- Current phase/document focus if any.
- Next useful action.
- Counts or summary for proposed decisions, confirmed decisions, assumptions, open questions, diagnostics, and generated outputs.

**Secondary content:**

- Provider status.
- Last generation result.
- Stale outputs.
- Validation gaps.

**Available actions:** `/continue`, `/generate`, `/diagnose`, `/validate`, `/config ai`, root configuration, output review.

**Component composition:** Orientation Header, Status Summary, Next Action Block, Diagnostic Summary, Output Summary.

**States:** healthy, incomplete, blocked, stale outputs, provider missing, root invalid, no generated outputs.

**Empty state:** For initialized workspace with no content, prompt the user to describe the project or run `/continue`.

**Loading state:** Minimal, because status should be fast; if slow, show which state is loading.

**Error state:** Show which state could not be read and recovery path.

**Success state:** Quiet; status itself is the result.

**Permission state:** Read-only unless user chooses a state-changing action.

**Responsive rules:** Summarize counts first, expand details by command or selection.

**Accessibility notes:** Counts must have labels; status cannot rely on color.

**Data dependencies:** Workspace State, Profile, Documentation Root, Diagnostics, Generation Report.

**Downstream implications:** State Model must support status summaries without reading private chat history as source of truth.

**Open questions:** Whether status should show recent history is unresolved.

### UI-004: Conversational Intake View

**Classification:** primary / MVP.

**Purpose:** Support natural language clarification while preserving structured state and review boundaries.

**User goal:** Explain the project and answer useful questions without operating a form wizard.

**Primary journey:** Primary clarification, first value, continuation.

**Entry points:** non-slash text, `/continue`, suggested next question.

**Exit points:** proposal review, status, diagnostics, generation, exit.

**Primary content:**

- Current question cluster.
- Optional contextual suggestions with source basis, confidence or caveat, and accept/edit/reject/ignore actions.
- User messages.
- AI/system responses.
- Why the question matters when helpful.
- Status of captured content: proposed, assumed, unknown, or open.

**Secondary content:**

- Affected phase or document.
- Provider status before AI calls.
- Open questions count.
- Pending proposal count.

**Available actions:** answer naturally, say unknown, ask to assume, correct prior answer, review proposals, run commands.

**Component composition:** Conversation Turn, Question Cluster, Contextual Suggestion, Inline Alert, Proposal Preview, Command Input.

**States:** active, waiting for AI, no provider, low confidence, proposal available, unknown answer captured, assumption captured, provider error.

**Empty state:** Prompt the user to describe the project if no conversation exists.

**Loading state:** Show that LOGOS is interpreting or preparing the next question; do not show fake precision.

**Error state:** Provider or interpretation errors preserve the user's input and route to recovery.

**Success state:** Captured answer feedback and visible proposed state changes.

**Permission state:** Remote provider disclosure when relevant.

**Responsive rules:** Keep current question and input visible; conversation history may scroll.

**Accessibility notes:** Conversation turns need speaker/status labels.

**Data dependencies:** Intake Conversation, AI Provider Configuration, Open Questions, Assumptions, Decision Proposals, Contextual Suggestions.

**Downstream implications:** Feature Specification must ensure non-slash input routes to conversation and does not require question IDs.

**Open questions:** How much conversation history should remain visible by default?

### UI-005: Proposal Review View

**Classification:** contextual / MVP.

**Purpose:** Make AI-derived proposed decisions and important assumptions reviewable before they affect canonical state.

**User goal:** Confirm, revise, reject, or defer proposals safely.

**Primary journey:** Decision review, first value, repeat use.

**Entry points:** Intake proposal prompt, `/status`, diagnostics, decision suggestion.

**Exit points:** intake, decision detail, generation, diagnostics, status.

**Primary content:**

- Proposal text.
- Proposal type: decision, assumption, follow-up, risk, or open question.
- Status: proposed, low confidence, conflicted, deferred.
- Evidence basis or source turn.
- Affected documents.
- Available actions.

**Secondary content:**

- Related assumptions.
- Related diagnostics.
- Related open questions.

**Available actions:** confirm, revise, reject, defer, inspect affected documents, continue intake.

**Component composition:** Proposal Card, Decision Status Badge, Assumption Badge, Confirmation Prompt, Affected Documents List.

**States:** no proposals, proposal batch, low confidence, conflict, confirmed, rejected, deferred.

**Empty state:** State that no proposals are pending and suggest continuing intake or generation if appropriate.

**Loading state:** Only when loading proposal details or related documents.

**Error state:** If proposal data is malformed, keep it unconfirmed and route to correction.

**Success state:** Show what changed and whether outputs became stale.

**Permission state:** Confirm before status becomes confirmed or material assumption is accepted.

**Responsive rules:** Show one proposal at a time on compact terminals; batch summary can precede details.

**Accessibility notes:** Confirmation choices must be keyboard-accessible and text-labeled.

**Data dependencies:** Decision, Assumption, Open Question, Source Conversation Turn, Canonical Document.

**Downstream implications:** Acceptance Criteria must verify proposed and confirmed states are visually and textually distinct.

**Open questions:** Whether batch confirmation should exist in MVP is unresolved.

### UI-006: Decision Detail / Revision View

**Classification:** contextual / MVP.

**Purpose:** Let users inspect, correct, revise, supersede, or understand a decision.

**User goal:** Change project state without losing traceability or downstream awareness.

**Primary journey:** Decision revision, repeat use, diagnostics recovery.

**Entry points:** Proposal Review, Diagnostics, Status, generated document review.

**Exit points:** status, proposal review, diagnostics, generation.

**Primary content:**

- Current decision statement.
- Status.
- Source and confidence.
- Affected documents and outputs.
- Proposed revision or correction.
- Confirmation consequence.

**Secondary content:**

- Related assumptions, risks, open questions, and validation gaps.

**Available actions:** revise, supersede, reject proposal, defer, run diagnostics, regenerate affected outputs.

**Component composition:** Decision Detail Panel, Affected Objects List, Confirmation Prompt, Stale Output Alert.

**States:** proposed, confirmed, superseded, deprecated, conflicted, low-confidence.

**Empty state:** Not applicable except missing decision target; show recovery and return to status.

**Loading state:** Load related objects with inline pending state.

**Error state:** If target is missing or ambiguous, show safe recovery.

**Success state:** Show revised/superseded state and affected outputs.

**Permission state:** Confirmation required for confirmed-state changes.

**Responsive rules:** Affected objects can collapse after the decision and action summary.

**Accessibility notes:** Status and consequence text must be explicit.

**Data dependencies:** Decision Registry, Canonical Documents, Diagnostics, Generation Report.

**Downstream implications:** State Model must support supersession and affected-output tracking.

**Open questions:** How detailed source traceability should be in MVP remains open.

### UI-007: Generation Confirmation View

**Classification:** modal-like / MVP.

**Purpose:** Prevent surprise writes and make output scope explicit.

**User goal:** Know exactly where generation will write and what categories will be produced.

**Primary journey:** Generate and review outputs.

**Entry points:** `/generate`, generation suggestion, stale-output prompt.

**Exit points:** confirm generation, cancel, configure root, status.

**Primary content:**

- Active LOGOS documentation root.
- Whether root is default `logos/` or custom.
- Canonical Markdown output count or target list.
- Derived HTML artifact count or target list.
- Derived agent pack count or target list.
- Warnings for overwrite, stale state, incomplete inputs, or validation caveats.
- Confirm and cancel actions.

**Secondary content:**

- Affected phase/documents.
- Last generation summary.
- Assumptions or open questions that will appear in outputs.

**Available actions:** confirm, cancel, configure root, inspect outputs, run diagnostics.

**Component composition:** Confirmation Prompt, Output Category Summary, Root Summary, Warning Block.

**States:** ready, incomplete with caveats, overwrite risk, invalid root, provider unavailable for AI-assisted drafting, force mode if later allowed.

**Empty state:** If no outputs are available for generation, explain missing profile/state dependency.

**Loading state:** Not applicable before confirmation except preview loading.

**Error state:** Invalid root or missing state prevents confirmation and routes to recovery.

**Success state:** Moves to Generation Report.

**Permission state:** File write and overwrite confirmation required.

**Responsive rules:** Root and confirmation must remain visible before output detail.

**Accessibility notes:** Confirmation cannot rely on color or position; output categories must be text.

**Data dependencies:** Documentation Root, Document Contracts, Workspace State, Output Status.

**Downstream implications:** Permission Model must define write and overwrite confirmation strength.

**Open questions:** Force generation behavior remains unresolved.

### UI-008: Generation Report View

**Classification:** report / MVP.

**Purpose:** Report output changes and incomplete or blocked generation clearly.

**User goal:** Understand what changed and what to review next.

**Primary journey:** Generate and review outputs, recovery, first value.

**Entry points:** completed `/generate`, status, output browser.

**Exit points:** diagnostics, output browser, continue, status, regenerate.

**Primary content:**

- Summary by result category: created, updated, skipped, incomplete, blocked, failed.
- Summary by output type: canonical Markdown, HTML artifacts, agent packs.
- Active root.
- Next recommended action.

**Secondary content:**

- File-level detail.
- Caveats and assumptions preserved in outputs.
- Stale output warnings.

**Available actions:** review outputs, run diagnostics, regenerate, configure root, continue.

**Component composition:** Generation Summary, File Result Row, Inline Alert, Next Action Block.

**States:** success, partial, failed, no outputs, stale report.

**Empty state:** No generated outputs yet; route to generation confirmation or intake.

**Loading state:** During generation, show operation pending with current stage where possible.

**Error state:** Failed or partial generation must show preserved state and recovery.

**Success state:** Proportional; no excessive celebration. Show concrete outputs.

**Permission state:** Regeneration or overwrite routes back to confirmation.

**Responsive rules:** Show category summary before file list; file list can paginate or collapse.

**Accessibility notes:** File result categories must be textual.

**Data dependencies:** Generation Report, Output Status, Documentation Root.

**Downstream implications:** Acceptance Criteria must test partial and failed reports.

**Open questions:** Whether reports persist as history is unresolved.

### UI-009: Diagnostics View

**Classification:** report / MVP.

**Purpose:** Make gaps, contradictions, risks, and next actions actionable.

**User goal:** Know what to clarify, revise, defer, or validate next.

**Primary journey:** Diagnostics and validation, recovery, first value.

**Entry points:** `/diagnose`, status, generation report.

**Exit points:** intake, proposal review, validation, status.

**Primary content:**

- Findings grouped by severity.
- Affected object or document.
- Short explanation.
- Next action.
- Whether the finding is blocking.

**Secondary content:**

- Evidence basis.
- Related decisions, assumptions, questions, or outputs.

**Available actions:** resolve through intake, review decision, defer, validate, rerun diagnostics, inspect affected document.

**Component composition:** Diagnostic Finding Row, Severity Group, Next Action Block, Related Objects List.

**States:** no findings, info-only, warnings, errors, critical, failed diagnostics, stale diagnostics.

**Empty state:** If no known findings, avoid claiming full validation; suggest generation or validation as appropriate.

**Loading state:** Show pending diagnostic check.

**Error state:** Separate deterministic failure, provider failure, and state-read failure.

**Success state:** Report completed diagnostics and next action.

**Permission state:** Read-only unless user accepts a suggested state-changing action.

**Responsive rules:** Critical and blocking findings first; details expand.

**Accessibility notes:** Severity must be text-labeled.

**Data dependencies:** Diagnostic Findings, Workspace State, Profile Criteria.

**Downstream implications:** Content Model must define severity language.

**Open questions:** Exact severity taxonomy may change after validation.

### UI-010: Validation View

**Classification:** report / MVP.

**Purpose:** Separate generated clarity from external validation.

**User goal:** See unsupported claims, assumptions, and evidence gaps.

**Primary journey:** Validation and readiness.

**Entry points:** `/validate`, diagnostics, status, generated document caveat.

**Exit points:** intake, diagnostics, evidence update, status.

**Primary content:**

- Validation gaps.
- Affected claim or assumption.
- Evidence needed.
- Severity or readiness impact.
- Next action.

**Secondary content:**

- Existing evidence notes.
- Related documents.
- Deferred validation items.

**Available actions:** add note, mark assumption, defer, continue intake, rerun validation.

**Component composition:** Validation Gap Row, Assumption Badge, Evidence Summary, Next Action Block.

**States:** no evidence, gaps found, incomplete, ready with caveats, validation check failed.

**Empty state:** No evidence yet should say evidence is absent, not that validation is complete.

**Loading state:** Show validation check pending.

**Error state:** Explain check failure separately from evidence absence.

**Success state:** Show readiness only with caveats and evidence basis.

**Permission state:** Accepting assumptions or changing state requires confirmation where material.

**Responsive rules:** Show unsupported claims first, details expand.

**Accessibility notes:** Do not rely on color to distinguish evidence strength.

**Data dependencies:** Assumptions, Evidence, Validation Gaps, Canonical Documents.

**Downstream implications:** Acceptance Criteria must prevent false validation.

**Open questions:** Evidence-entry UI is not fully specified for MVP.

### UI-011: AI Provider Configuration View

**Classification:** contextual / MVP.

**Purpose:** Configure or inspect AI provider behavior safely.

**User goal:** Enable AI-led intake or understand why AI is unavailable.

**Primary journey:** Provider configuration, onboarding, recovery.

**Entry points:** `/config ai`, blocked AI operation, startup warning.

**Exit points:** intake, status, exit.

**Primary content:**

- Current provider status.
- Local/remote implication.
- Redacted token source status.
- Available provider actions.
- Disclosure before remote use.

**Secondary content:**

- Last provider test result.
- No-provider guidance.
- Link to status.

**Available actions:** configure provider, test provider, show redacted status, disable/change provider, return.

**Component composition:** Configuration Summary, Warning Block, Confirmation Prompt, Error/Recovery Panel.

**States:** not configured, configured, invalid, test pending, test failed, remote disclosure needed, disabled.

**Empty state:** No provider configured; guide to configuration or local status-only path.

**Loading state:** Provider test pending with no fake certainty.

**Error state:** Invalid token/config, provider timeout, remote concern.

**Success state:** Redacted provider status and next action.

**Permission state:** Strong consent before remote AI context use; no raw token display.

**Responsive rules:** Provider implication and secret safety before advanced options.

**Accessibility notes:** Redaction must be textually clear.

**Data dependencies:** AI Provider Configuration.

**Downstream implications:** Permission Model must define provider consent and token handling.

**Open questions:** Exact provider list and setup flow belong to Feature Specification.

### UI-012: Documentation Root Configuration View

**Classification:** contextual / MVP.

**Purpose:** Let the user accept or change where LOGOS writes generated documentation.

**User goal:** Avoid collisions and know where outputs live.

**Primary journey:** Onboarding, generation recovery.

**Entry points:** `/init`, root warning, generation confirmation, status.

**Exit points:** status, initialization, generation confirmation.

**Primary content:**

- Current root.
- Proposed root.
- Default explanation: `logos/` is the default generated documentation root.
- Path validity.
- Collision or stale-output risk.
- Output category examples under the active root.

**Secondary content:**

- Previous root if changed.
- Existing generated output status.

**Available actions:** accept `logos/`, enter custom root, validate path, cancel, return.

**Component composition:** Root Summary, Path Input, Collision Warning, Confirmation Prompt.

**States:** proposed default, accepted default, custom, invalid, inaccessible, collision risk.

**Empty state:** Root not selected; prompt accept default or configure custom.

**Loading state:** Path validation pending.

**Error state:** Invalid path, permission issue, conflict.

**Success state:** Active root shown and next action.

**Permission state:** Confirmation required for root changes.

**Responsive rules:** Active/proposed root should not wrap ambiguously; long paths may truncate with full path available.

**Accessibility notes:** Path status must be textual.

**Data dependencies:** Documentation Root, Repository Workspace, Output Status.

**Downstream implications:** Acceptance Criteria must verify no hard-coded repository documentation folder assumption.

**Open questions:** How to present long paths cleanly in compact terminals requires UI testing.

### UI-013: Error and Recovery View

**Classification:** system surface / MVP.

**Purpose:** Preserve trust after failures.

**User goal:** Know what failed, what state was preserved, and what can be done next.

**Primary journey:** Failure and recovery.

**Entry points:** Any failed command, provider error, state error, path error, generation failure.

**Exit points:** retry, configure, change root, status, exit.

**Primary content:**

- Error type.
- What failed.
- What was preserved.
- What may be partial.
- Recovery actions.

**Secondary content:**

- Technical detail behind disclosure.
- Affected object or output.
- Last safe state.

**Available actions:** retry, cancel, status, configure provider, configure root, rerun diagnostics, exit.

**Component composition:** Recovery Panel, Inline Alert, Preserved State Summary, Next Action Block.

**States:** user error, validation error, permission error, provider error, system error, dependency error, low-confidence error, partial failure.

**Empty state:** Not applicable.

**Loading state:** Retry pending.

**Error state:** If recovery fails, preserve the previous recovery context and avoid loops.

**Success state:** Show recovered state and next action.

**Permission state:** Destructive repair or overwrite needs strong confirmation.

**Responsive rules:** Error, preserved state, and next action appear before technical detail.

**Accessibility notes:** Focus should move to the error summary; recovery actions must be keyboard-accessible.

**Data dependencies:** Failed Operation, Workspace State, last command result.

**Downstream implications:** Feature Specification must define recovery paths per error class.

**Open questions:** Support escalation is not part of local MVP.

### UI-014: Command Help View

**Classification:** overlay / MVP.

**Purpose:** Make commands discoverable without turning normal intake into command operation.

**User goal:** Learn what commands are available in current context.

**Primary journey:** All.

**Entry points:** `/help`, invalid slash command, contextual prompt.

**Exit points:** return to previous view, execute command, exit.

**Primary content:**

- Current-context commands.
- Short descriptions.
- Whether command is read-only, write, configuration, or diagnostic.
- Risk/confirmation notes for risky commands.

**Secondary content:**

- Examples of ordinary conversational input.
- Reminder that non-slash text continues intake.

**Available actions:** choose command, return, continue typing.

**Component composition:** Command Help List, Inline Note.

**States:** full help, contextual help, invalid command help.

**Empty state:** If no workspace exists, show startup commands.

**Loading state:** Not expected.

**Error state:** Minimal fallback command list.

**Success state:** Not applicable.

**Permission state:** Help does not grant permission to execute risky command.

**Responsive rules:** Group commands by purpose and risk.

**Accessibility notes:** Commands and descriptions must be plain text.

**Data dependencies:** Command Registry, Workspace State.

**Downstream implications:** Content Model must define command descriptions.

**Open questions:** Exact autocomplete UI belongs downstream.

### UI-015: Output Browser View

**Classification:** contextual / preferred MVP.

**Purpose:** Help users find canonical Markdown, HTML artifacts, and agent packs under active root.

**User goal:** Know what files exist and whether they are canonical, derived, stale, or incomplete.

**Primary journey:** Generate and review outputs, repeat use.

**Entry points:** Generation Report, `/status`, future output command.

**Exit points:** status, diagnostics, generation, document detail.

**Primary content:**

- Active root.
- Output categories.
- File paths.
- Status by file.
- Canonical or derived label.

**Secondary content:**

- Source document contract.
- Last generated status.
- Caveats.

**Available actions:** open/review path conceptually, regenerate, diagnose, return.

**Component composition:** Output Category Tabs or Groups, File Result Row, Status Badge.

**States:** no outputs, generated, stale, partial, failed, missing files.

**Empty state:** No generated outputs yet; suggest `/generate` if safe.

**Loading state:** Output scan pending.

**Error state:** Root unreadable or files missing.

**Success state:** Output list available.

**Permission state:** Regeneration routes to confirmation.

**Responsive rules:** Group by canonical, HTML artifact, agent pack; collapse long file detail.

**Accessibility notes:** Derived/canonical distinction must be textual.

**Data dependencies:** Output Status, Documentation Root, Generation Report.

**Downstream implications:** Feature Specification should decide whether this is MVP or preferred-MVP.

**Open questions:** Whether output browsing is needed beyond generation reports is validation-required.

## Empty States

| Empty State | Applies To | Visual Treatment | Content Treatment | Available Action | Acceptance Implication |
| --- | --- | --- | --- | --- | --- |
| New repository | First-Run View | Quiet full-view block | "LOGOS is not initialized in this repository." | `/init`, exit | Must show repository path before write. |
| Root not selected | Root Config, Generation | Blocking configuration block | Explain `logos/` default and custom option. | Accept root, configure root | Must not write before root is active. |
| No AI provider | Intake, Provider Config | Blocking for AI actions, non-blocking for status | Explain AI is unavailable and show `/config ai`. | Configure, status, exit | Must not fall back to deterministic question IDs as normal flow. |
| No conversation yet | Intake | Simple prompt | Ask user to describe project intent. | Type naturally | Must not require form completion first. |
| No proposed decisions | Proposal Review | Quiet empty block | Nothing pending review. | Continue, generate if safe, diagnose | Must not imply project is complete. |
| No generated outputs | Output Browser, Status | Output empty block | State that files have not been generated. | `/generate`, continue | Must not imply state is missing. |
| No diagnostics | Diagnostics | Quiet report state | No known findings in current scope. | Validate, generate, continue | Must not imply external validation. |
| No validation evidence | Validation | Caveated empty state | Evidence is absent or insufficient. | Add evidence note, continue, defer | Must not read as validation success. |
| Filtered empty | Future search/filter | Compact empty block | Current filter found nothing. | Clear filter | Must differ from no-access or error. |
| Permission empty | Root, output, provider | Warning block | Access is missing or denied. | Change root/config, retry | Must differ from normal absence. |
| Error empty | Any failed load | Recovery panel | Loading failed. | Retry, status, recover | Must preserve state. |

Empty states should be useful but not pushy. They should never shame uncertainty or imply hidden capabilities.

## Loading States

### Loading Principles

- Show what operation is pending.
- Do not claim exact progress unless exact progress is known.
- Keep cancellation or safe waiting visible for long operations where feasible.
- Preserve user input while AI or provider calls are pending.
- Disable only actions that would conflict with the pending operation.
- Do not make partial data look complete.

### Loading by Operation

| Operation | Loading Treatment | Available Actions | Timeout Behavior |
| --- | --- | --- | --- |
| Startup | Short status line with repository detection. | Exit if hung. | Show recovery if workspace cannot load. |
| Initialization | Pending message with target repository/root. | Cancel before write where feasible. | Report partial writes if any. |
| AI intake | Inline pending state in conversation. | Cancel or wait where supported; status may remain available. | Preserve input and offer retry/configure. |
| Provider test | Inline pending in provider view. | Cancel or return. | Preserve prior provider config. |
| Generation | Report-level pending with output categories. | Avoid conflicting writes; cancel where safe. | Partial generation report. |
| Diagnostics | Pending report state. | Cancel or return to status where safe. | Explain deterministic/provider/state failure. |
| Validation | Pending report state. | Cancel or return to status where safe. | Explain missing evidence versus check failure. |
| Path validation | Inline pending near root field. | Edit/cancel. | Keep previous valid root. |

Optimistic UI should be used rarely. It is acceptable for harmless local UI state such as dismissing a suggestion. It is not acceptable for writes, decision confirmation, provider use, or generation.

## Error States

Errors should be specific, calm, and recoverable. They should expose enough cause to guide action without dumping implementation internals by default.

| Error Type | UI Surface | Must Include | Recovery Actions |
| --- | --- | --- | --- |
| User/path error | Recovery View or inline warning | Active path, why it may be wrong, preserved state | Confirm path, exit, status |
| Validation error | Validation or Diagnostics View | Missing decision/evidence, affected document, severity | Continue intake, mark assumption, defer |
| Permission error | Root Config or Recovery View | Path/action blocked, required permission | Change root, retry, cancel |
| Provider not configured | Intake or Provider Config | AI unavailable, provider status | `/config ai`, status, exit |
| Provider timeout/failure | Intake or Recovery View | Provider failed, input preserved | retry, switch config, continue later |
| Low-confidence AI output | Inline alert in Intake/Review | What is uncertain, why review is needed | revise, reject, clarify |
| Malformed AI output | Recovery View or Review View | Interpretation rejected, prior state preserved | retry, continue, diagnose |
| Generation partial/failure | Generation Report | categories and files affected | rerun, change root, diagnose |
| State inconsistency | Recovery View | readable state, uncertain state, risky repair warning | status, diagnose, manual review |
| Boundary error | Inline or Recovery View | Requested action outside scope | route to assumption, validation plan, or handoff |

Error states must not:

- Blame the user for ambiguity.
- Hide partial writes.
- Collapse provider failure into user failure.
- Claim validation failure means project failure.
- Encourage destructive repair without confirmation.

## Success States

Success states should be proportional and traceable. Routine actions need quiet feedback; material actions need persistent state.

| Success State | Applies To | Treatment | Next Action |
| --- | --- | --- | --- |
| Workspace initialized | `/init` | Persistent status summary | Continue intake or configure AI |
| Root accepted | Root Config | Persistent root status | Continue or generate |
| Provider configured | `/config ai` | Redacted provider status | Continue intake |
| Answer captured | Intake | Inline confirmation with proposed state preview | Continue or review proposals |
| Decision confirmed | Proposal Review | Persistent decision status and affected docs | Continue or generate |
| Assumption accepted | Proposal Review | Caveated assumption status | Continue or validate |
| Generation completed | Generation Report | Category summary and file results | Review outputs or diagnose |
| Diagnostics completed | Diagnostics | Findings summary | Resolve next finding or continue |
| Validation completed | Validation | Readiness/gap summary with caveats | Add evidence, defer, or proceed |
| Error recovered | Recovery | Preserved state and restored path | Continue safely |

The UI must not celebrate generated documentation as validated success. It can say generation completed; it must not imply the project is complete, validated, or ready for execution unless supporting checks exist.

## Responsive Behavior

The primary product surface is a terminal TUI. Responsive behavior means adapting to terminal width, height, text wrapping, keyboard-only operation, and future derived HTML review views.

### Terminal Responsiveness

| Context | Compact Terminal | Standard Terminal | Wide Terminal |
| --- | --- | --- | --- |
| Shell | single-column, header compressed | header + primary work + compact context | optional side context |
| Intake | current question and input prioritized | conversation plus context summary | context rail may show affected docs/proposals |
| Review | one proposal at a time | proposal plus related objects | batch list plus detail if feasible |
| Diagnostics | severity summary first | grouped report | grouped report plus affected-object summary |
| Generation | category summary first | category plus file preview | category, file detail, and context if space |
| Config | current/proposed value first | value plus consequences | advanced detail may be side context |
| Recovery | error, preserved state, action first | recovery plus cause detail | recovery plus related object context |

### Content Hiding Rules

The UI may collapse:

- Advanced profile contract detail.
- Long file lists.
- Historical conversation turns.
- Low-severity diagnostics.
- Related object detail.
- Previous generation report detail.

The UI must not hide:

- Active repository before writes.
- Active LOGOS documentation root before generation.
- Provider disclosure before remote AI use.
- File overwrite risk.
- Proposed versus confirmed state.
- Assumption versus fact distinction.
- Canonical versus derived status.
- Partial or failed generation.
- Recovery action after error.

### Unsupported or Deferred Platforms

- Hosted web dashboard is deferred.
- Touch-first mobile use is not part of MVP.
- Multi-user collaboration UI is deferred.
- Rich visual graph navigation is deferred.
- HTML artifacts are generated review outputs, not the primary editing UI.

## Accessibility UI Rules

These are expectations for downstream design and implementation, not proven compliance claims.

### Perceivable State

- Status, severity, confidence, and output type must be expressed in text.
- Color may reinforce but not replace labels.
- Icons may reinforce but not replace labels.
- Partial, failed, blocked, and stale states must be textually distinct.
- Derived artifacts must be labeled as derived in text.

### Focus and Keyboard

- Command input must have a predictable focus model.
- Confirmation prompts must receive focus when they block action.
- Error summaries should receive focus or be announced in a way supported by the implementation platform.
- All critical actions must be keyboard-operable.
- Escape/cancel behavior should be consistent where supported.

### Readability

- Long paths must remain inspectable without breaking layout.
- Dense reports should use grouping and labels, not visual clutter.
- Text should wrap cleanly in compact terminals.
- Tables that become unreadable in compact terminals should degrade into labeled lists.

### Motion and Timing

- Loading indicators require text alternatives.
- Motion should not be required to understand progress.
- Timeouts must not discard user input without warning or preservation.

### Future HTML Artifacts

Generated HTML artifacts need separate accessibility review if they become important review surfaces. They must preserve caveats, canonical/derived labels, and readable navigation.

## Microcopy Rules

### Voice and Tone

Microcopy should be calm, precise, local-first, and non-judgmental. It should avoid hype, shame, false urgency, and overconfident AI language.

### Required Wording Patterns

| Context | Pattern |
| --- | --- |
| Unknown answer | "Marked as unknown. LOGOS will keep this as an open question." |
| Assumption | "Accepted as an assumption, not validated evidence." |
| Proposed decision | "Proposed decision. Review before confirming." |
| Confirmed decision | "Confirmed by you." |
| Derived output | "Derived output regenerated from canonical content." |
| Root default | "`logos/` is the default LOGOS documentation root. You can configure another folder." |
| Provider disclosure | "This may send project context to the configured provider." |
| No provider | "AI is not configured. Configure a provider to continue AI-led intake." |
| Generation confirmation | "Generate files under the active LOGOS documentation root?" |
| Partial generation | "Generation completed partially. Review blocked and incomplete outputs." |
| Validation caveat | "This is not externally validated yet." |
| Error | "This failed. Your current state was preserved where possible." |

### Action Labels

Use direct verbs:

- Continue.
- Review proposals.
- Confirm decision.
- Revise.
- Reject.
- Defer.
- Generate.
- Run diagnostics.
- Validate.
- Configure AI.
- Configure root.
- Retry.
- Cancel.
- Show status.

Avoid vague labels:

- Finish.
- Complete project.
- Make it real.
- Trust AI.
- Fix everything.
- Optimize.
- Launch.

### Prohibited Microcopy Patterns

- "Your project is validated" without evidence.
- "AI decided" or "AI confirmed".
- "Almost done" when critical decisions are missing.
- "Just one more step" for manipulative completion pressure.
- "No issues found" when only a narrow scope was checked.
- "Final document" for canonical Markdown.
- "Docs folder" as generated-output terminology when LOGOS Documentation Root is meant.
- "Safe to build" without explicit caveats and evidence.

## UI Risks

| Risk | Affected Screen or Component | Risk Type | User Impact | Early Signal | Mitigation | Target Document |
| --- | --- | --- | --- | --- | --- | --- |
| TUI looks like generic chat | Intake View | Mental model risk | User trusts chat instead of structured state | Users ask where decisions live | Show proposal/status/state summaries near conversation | UI Specification, Content Model |
| Header hides active root in compact terminals | TUI Shell, Generation | Path/trust risk | User writes to unexpected folder | Users cannot find files | Root must remain visible before generation | Acceptance Criteria |
| Proposal cards look confirmed | Proposal Review | False authority | User accepts AI output passively | Users cannot distinguish states | Strong proposed/confirmed labels | Design System, Acceptance Criteria |
| Generation success hides partial failure | Generation Report | Trust risk | User misses blocked outputs | Missing files after success message | Partial state and category summary | Acceptance Criteria |
| Diagnostics become visually noisy | Diagnostics View | Density risk | User cannot choose next action | Long equal-weight findings list | Severity grouping and next-action emphasis | UI, Content Model |
| Provider disclosure is buried | Provider Config, Intake | Privacy risk | User misses remote data movement | Surprise about provider usage | Provider status before AI calls | Permission Model |
| Root configuration resembles optional preference | Root Config | Data-location risk | User ignores output destination | Confusion about `logos/` | Treat root as consequence-bearing config | Permission Model |
| Empty validation looks like success | Validation View | False certainty | User mistakes no evidence for readiness | "No gaps" misread | Empty evidence caveat | Content Model |
| Dense terminal tables break on small widths | Reports | Responsive risk | Critical info unreadable | Wrapped columns obscure status | Convert compact tables to labeled lists | Frontend Architecture |
| Color-only severity | Diagnostics, alerts | Accessibility risk | Severity inaccessible or unclear | Users miss warnings | Text labels required | Design System |
| Long paths are truncated unsafely | Root, output browser | Review risk | User cannot inspect exact target | Similar path confusion | Preserve full path access | Frontend Architecture |
| HTML artifacts look authoritative | Output Browser | Source-of-truth risk | Derived view becomes treated as truth | User edits/cites HTML as canonical | Derived labels and source links | Content Model |
| Confirmation fatigue | Confirmation Prompts | Interaction risk | Users ignore prompts | Fast repeated confirmation | Confirm only risk-bearing actions | Interaction Model |
| Error detail overwhelms recovery | Recovery View | Recovery risk | User sees logs instead of next action | Users abandon after errors | Recovery first, detail second | Content Model |

## Downstream Handoff

### Content Model

Content Model must inherit:

- Microcopy patterns for proposed, confirmed, assumed, unknown, stale, blocked, partial, failed, canonical, and derived states.
- Error, loading, success, empty, permission, and low-confidence wording rules.
- Command labels and confirmation language.
- Prohibited terms and phrases.
- Validation caveat language.

Content Model must not invent alternative terminology that conflicts with the Foundation Glossary or IA naming rules.

### State Model

State Model must support UI-visible states for:

- Workspace initialization.
- Active documentation root and root validity.
- Provider status.
- Conversation pending and interpreted states.
- Proposal review status.
- Decision status.
- Assumption status.
- Diagnostics severity and stale status.
- Generation report categories.
- Canonical and derived output status.
- Error and recovery status.

State Model must define enough persistence for startup, status, continuation, stale outputs, and recovery.

### Permission Model

Permission Model must define when UI must show confirmation or stronger consent for:

- Initialization writes.
- Documentation-root changes.
- File generation and overwrite.
- Remote provider use.
- Provider configuration.
- Decision confirmation.
- Material assumption acceptance.
- Destructive recovery.
- Sensitive derived outputs such as agent packs.

### Feature Specification

Feature Specification must translate this UI spec into concrete MVP features:

- TUI Shell.
- First-run initialization.
- Status view.
- Conversational intake.
- Proposal review.
- Generation confirmation and report.
- Diagnostics and validation views.
- Provider and documentation-root configuration.
- Error and recovery surfaces.
- Help view.
- Optional or preferred output browser.

It must not add hosted dashboards, task boards, collaboration screens, marketplace screens, or autonomous execution screens to MVP.

### Acceptance Criteria

Acceptance Criteria must verify:

- Active repository and active LOGOS documentation root are visible before writes.
- `logos/` is presented as the default generated documentation root and is configurable.
- Non-slash input can remain conversation-first.
- Slash commands remain visible and discoverable.
- Proposed and confirmed decisions are distinguishable.
- Assumptions and unknowns are visible and non-shaming.
- Canonical and derived outputs are distinguishable.
- Generation confirmation precedes write/overwrite.
- Generation report shows created, updated, skipped, incomplete, blocked, failed, canonical, and derived categories.
- Diagnostics group findings by severity and affected object.
- Validation empty state does not imply external validation.
- Provider status appears before remote AI operations.
- Error states include preserved state and next recovery action.
- Critical states do not rely on color alone.
- Compact terminal layouts do not hide critical information.

### Design System

Design System must define components and variants for:

- Orientation Header.
- Command Input.
- Conversation Turn.
- Question Cluster.
- Proposal Card.
- Decision Status Badge.
- Assumption Badge.
- Diagnostic Finding Row.
- Generation Summary.
- File Result Row.
- Confirmation Prompt.
- Inline Alert.
- Empty State Block.
- Loading Indicator.
- Recovery Panel.
- Command Help List.

It must include text-label requirements, focus expectations, severity variants, confirmation variants, and derived/canonical labeling.

### Frontend Architecture

Frontend Architecture must support:

- Terminal viewport adaptation.
- Stable shell regions.
- Keyboard-first interaction.
- Scrollable history and reports.
- Long path handling.
- State-driven rendering.
- Loading and cancellation where feasible.
- Accessible text feedback.
- Compact table degradation into labeled lists.
- No reliance on color-only meaning.

### Engineering Brief

Engineering must preserve local-first, TUI-first behavior. The UI must reflect profile contracts and structured state without making UI state canonical. Command handlers and services may power the UI, but the UI should not directly mutate files without going through permissioned product actions.

### Unresolved UI Questions

- Should output browsing be MVP or remain available only through generation reports?
- How much proposal batch review should fit in the first MVP?
- What exact terminal widths should be officially supported?
- How should long file paths be displayed and copied in the TUI?
- How much raw conversation history should remain visible after interpretation?
- Should generation reports persist as history or latest status only?
- What TUI accessibility support is feasible in the chosen framework?
- What visual treatment best distinguishes proposed, confirmed, assumed, and low-confidence states without overloading the screen?
