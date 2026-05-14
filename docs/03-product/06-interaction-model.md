# Interaction Model

## Interaction Principles

LOGOS Engine uses a hybrid interaction model: conversational input for clarification, slash commands for explicit system operations, structured review for state changes, and local file feedback for generated outputs. The interaction model must make it clear who acted, what object was affected, what changed, what remains reversible, and what the user can do next.

These principles are product-level rules, not visual UI decisions.

### Principle 1: Conversation Advances Thinking, Commands Execute Operations

**Decision rule:** Ordinary text input should advance AI-led clarification. Slash commands should invoke explicit system operations such as initialization, status, generation, diagnostics, validation, continuation, and AI configuration.

**User benefit:** The user can speak naturally when thinking and use predictable commands when acting on system state.

**Trade-off:** The product must maintain a clear input router so ambiguous slash-like text does not accidentally trigger operations.

**Violations:**

- Requiring normal intake to use deterministic question-id commands.
- Treating every user message as a command.
- Letting natural language silently execute high-risk operations.
- Hiding operational commands behind conversational inference only.

### Principle 2: State Changes Must Be Visible

**Decision rule:** Any material change to project state, configuration, document output, provider behavior, decision status, assumption status, or diagnostic status must produce visible feedback.

**User benefit:** The user can understand what happened without trusting hidden automation.

**Trade-off:** Visible state feedback adds friction, especially after AI interpretation and generation.

**Violations:**

- AI interpretation creates confirmed decisions without review.
- Generation writes files without a report.
- Provider configuration changes without showing redacted status.
- A failed operation leaves unclear partial state.

### Principle 3: User-Owned Decisions Require Confirmation

**Decision rule:** AI may suggest, draft, interpret, diagnose, and prepare, but user-owned decisions remain proposed, assumed, rejected, or deferred until the user explicitly confirms or accepts them for the relevant purpose.

**User benefit:** The product preserves agency and avoids false authority.

**Trade-off:** Decision review can slow progress when the user expects pure automation.

**Violations:**

- Marking inferred decisions as confirmed.
- Treating an assumption as fact because it helps generation.
- Updating downstream documents without showing affected decisions.
- Using diagnostic findings as if they were user decisions.

### Principle 4: Risk Determines Friction

**Decision rule:** Low-risk reversible actions should be fast. High-risk, external, privacy-sensitive, destructive, ambiguous, or hard-to-recover actions need stronger confirmation, explanation, or prevention.

**User benefit:** The product avoids both over-confirmation fatigue and unsafe automation.

**Trade-off:** Some first-run and generation actions will require extra disclosure.

**Violations:**

- Confirming every harmless navigation action.
- Skipping confirmation for remote AI context transmission.
- Skipping confirmation for file overwrite or documentation-root changes.
- Treating undo as a substitute for confirmation when data loss is possible.

### Principle 5: Recovery Is Part of the Flow

**Decision rule:** Interactions should assume interruption, uncertainty, correction, partial failure, provider failure, and later re-entry.

**User benefit:** The user can stop, return, revise, rerun, regenerate, and recover without reconstructing context.

**Trade-off:** Persistent status and recovery feedback must remain understandable.

**Violations:**

- Making a user restart intake after a provider timeout.
- Requiring the user to scroll chat to resume.
- Reporting an error without a next safe action.
- Hiding partial generation results.

### Principle 6: Accessibility Is an Interaction Constraint

**Decision rule:** Critical product actions must not depend on a single fragile modality, timing assumption, hidden focus movement, hover-only affordance, color-only feedback, or inaccessible generated status.

**User benefit:** Users can operate the product through predictable keyboard, screen reader, pointer, and reduced-motion patterns when supported by the platform.

**Trade-off:** Some shortcuts, rich TUI interactions, and future visual affordances require alternatives.

**Violations:**

- A critical confirmation is only available through a mouse click.
- Error feedback is not reachable by keyboard or assistive technology.
- Timeout behavior discards unsaved input.
- Status is communicated only through color or animation.

### Principle Precedence

When principles conflict:

1. Preserve user agency, consent, and data safety.
2. Preserve canonical state and truthfulness.
3. Preserve recoverability.
4. Preserve accessibility and learnability.
5. Optimize speed and convenience.

## Primary Interaction Patterns

### Pattern 1: Conversational Clarification

**Classification:** MVP.

**Purpose:** Let the user describe ambiguous project intent in natural language and answer small context-aware question clusters.

**Input modality:** Text input in the TUI.

**Trigger:** The user types non-slash text during intake or continuation.

**System response:** LOGOS records the conversation turn, summarizes useful content, identifies assumptions and open questions, may propose decision updates, and asks the next useful question or question cluster.

**State effect:** Conversation turns may create interpreted answers, proposed decisions, assumptions, open questions, risks, and summaries. They must not directly create confirmed decisions.

**Failure handling:** If AI is unavailable, show provider configuration guidance and preserve the user's input where safe.

**Status:** MVP.

### Pattern 2: Slash Command Operation

**Classification:** MVP.

**Purpose:** Provide explicit system operations that are discoverable, predictable, and separated from conversational intake.

**Input modality:** Slash-prefixed command text.

**Trigger:** The user enters a recognized command such as `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, or `/config ai`.

**System response:** LOGOS routes the command to a command handler, checks preconditions, shows feedback, and updates state only according to the command's permission and confirmation rules.

**State effect:** Depends on command. Read commands should not mutate state except for harmless session context. Write or configuration commands require appropriate confirmation.

**Failure handling:** Invalid commands should be explained as command errors only when slash-prefixed. Non-slash input should remain conversational input.

**Status:** MVP.

### Pattern 3: Decision Review

**Classification:** MVP.

**Purpose:** Let the user confirm, revise, reject, or defer AI-derived decisions and important assumptions.

**Input modality:** Keyboard-selectable actions, command actions, or explicit text choices. Detailed UI belongs to the UI Model.

**Trigger:** AI interpretation creates proposed decisions, diagnostics identify decision conflicts, or the user revisits a decision.

**System response:** LOGOS shows the proposal, status, evidence basis, affected documents, and available actions.

**State effect:** Proposed decisions may transition to confirmed, rejected, deferred, revised, or deprecated. Confirmation requires explicit user action.

**Failure handling:** If the proposal is malformed or low confidence, keep it unconfirmed and ask for clarification.

**Status:** MVP.

### Pattern 4: Generated Output Review

**Classification:** MVP.

**Purpose:** Let the user understand what canonical Markdown, HTML artifacts, and agent packs were created, updated, skipped, incomplete, or blocked.

**Input modality:** Slash command plus report review.

**Trigger:** The user runs `/generate` or accepts a generation prompt.

**System response:** LOGOS resolves the configured LOGOS documentation root, checks write implications, generates outputs where allowed, and reports results.

**State effect:** Canonical documents and derived outputs may be created, updated, marked stale, incomplete, blocked, or failed.

**Failure handling:** Partial generation must preserve completed outputs and report blocked outputs with recovery paths.

**Status:** MVP.

### Pattern 5: Diagnostic Follow-Up

**Classification:** MVP.

**Purpose:** Turn gaps, contradictions, and validation issues into the next useful question or action.

**Input modality:** Slash command plus follow-up conversation.

**Trigger:** The user runs `/diagnose`, `/validate`, or `/status`, or generation exposes incomplete output.

**System response:** LOGOS groups findings by severity, affected object or document, and next action.

**State effect:** Diagnostic findings may be created, superseded, acknowledged, or resolved. Diagnostics must not mutate confirmed decisions.

**Failure handling:** If diagnostic execution fails, preserve current state and show whether the failure came from deterministic checks, AI assistance, provider configuration, or state loading.

**Status:** MVP.

### Pattern 6: Configuration With Consequence Disclosure

**Classification:** MVP.

**Purpose:** Let the user configure the LOGOS documentation root and AI provider without hidden path, write, or data-movement consequences.

**Input modality:** Slash command, setup flow, or contextual configuration prompt.

**Trigger:** First run, `/init`, `/config ai`, blocked AI operation, or root conflict.

**System response:** LOGOS explains current configuration, proposed change, consequences, and confirmation requirements.

**State effect:** Configuration may change active documentation root or provider status. Raw provider tokens must not be stored in project files.

**Failure handling:** Invalid configuration should preserve the previous working configuration and provide recovery guidance.

**Status:** MVP.

### Pattern 7: Correction and Revision

**Classification:** MVP.

**Purpose:** Let the user correct input, AI interpretation, decision status, assumptions, generated content, output root, or provider configuration.

**Input modality:** Conversational correction, review action, or explicit command.

**Trigger:** User notices a misunderstanding, stale output, wrong classification, wrong path, or changed project decision.

**System response:** LOGOS acknowledges the correction, previews affected state or documents where relevant, and asks for confirmation when the correction changes canonical state or writes files.

**State effect:** Corrections may revise proposed decisions, supersede confirmed decisions, mark assumptions, create open questions, or mark outputs stale.

**Failure handling:** If correction target is ambiguous, ask for clarification instead of guessing when consequences are material.

**Status:** MVP.

### Deferred or Excluded Patterns

| Pattern | Status | Reason |
| --- | --- | --- |
| Hosted multi-user collaboration | deferred | Requires account, permission, and cloud-state models not validated for MVP. |
| Background automation | deferred | Could hide agency and state changes. |
| Broad semantic search | deferred | Useful later but not required for primary journey. |
| External research automation | deferred | Provenance, privacy, and validation complexity are unresolved. |
| Autonomous execution queues | excluded for product identity | Would transfer responsibility away from the user. |
| Project-management task board | excluded for MVP | Pulls the product away from structured clarification. |

## Commands and Actions

### Command Invocation Model

Slash commands are the explicit command model for the TUI. Ordinary text input without a slash is treated as conversational input. A slash-prefixed unknown command should produce command help or an error; it should not silently become conversational text unless the user explicitly escapes or edits it.

Commands should be discoverable through `/help`, status prompts, contextual suggestions, and error recovery. Command autocomplete may help, but the interaction model must not depend on autocomplete existing in every environment.

### Material Commands

| Command | Purpose | Target Object | Preconditions | Confirmation Rule | Output | Error Handling | Permission Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `logos` | Open the TUI in the current repository directory. | Repository Workspace | User is in intended repository directory. | Ask before writing if uninitialized or ambiguous. | Loaded or uninitialized workspace state. | Show active path and recovery. | Read local context; write only after init confirmation. |
| `/init` | Initialize LOGOS workspace and setup defaults. | Workspace State, Documentation Root, Profile | Repository context available. | Required before creating state or generated root. | Initialized workspace, active profile, active root defaulting to `logos/` unless configured. | Preserve existing state; report conflicts. | Local write consent. |
| `/continue` | Resume AI-led clarification. | Intake Conversation, Workspace State | Workspace exists or can explain missing state. | Not required for read/resume; required for state-changing proposals only. | Current progress, next question cluster, unresolved items. | If no AI provider, route to `/config ai`; preserve state. | Remote AI disclosure if provider call needed. |
| `/status` | Show current repository, root, profile, progress, and next actions. | Workspace State | None beyond readable context. | Not required. | Status summary and next action. | If state missing, show initialization path. | Read local state. |
| `/generate` | Render canonical Markdown and derived outputs. | Canonical Documents, HTML Artifacts, Agent Packs | Workspace, profile, root, and sufficient state or accepted caveats. | Required before first write, overwrite, force render, or risky partial generation. | Generation Report. | Report created, updated, skipped, incomplete, blocked, failed. | Local write consent; overwrite safeguards. |
| `/diagnose` | Find gaps, contradictions, risks, and next actions. | Diagnostic Findings | Workspace readable. | Not required unless it triggers AI provider use not already consented to. | Diagnostic report grouped by severity and object. | Explain deterministic, AI, provider, or state failure. | Read state; remote AI disclosure if used. |
| `/validate` | Check readiness and validation gaps. | Validation Gaps, Diagnostic Findings | Workspace and profile contracts readable. | Not required for read-only checks; required if accepting assumptions or changing state. | Validation result with severity and affected documents. | Preserve distinction between missing evidence and system error. | Read state; optional remote AI disclosure. |
| `/config ai` | Configure or inspect AI provider. | AI Provider Configuration | User chooses provider mode or asks to inspect status. | Required before storing non-secret config or testing remote provider. | Redacted provider status and next action. | Invalid config preserves prior valid config. | No raw tokens in project files; disclose remote behavior. |
| `/help` | Explain available commands and current context. | Command Surface | None. | Not required. | Command help scoped to current state. | If help fails, show minimal fallback. | None beyond read. |
| `/exit` | Leave TUI. | Session | None. | Required only if unsaved or in-progress write/correction would be lost. | Exit summary or safe close. | Preserve recoverable state where possible. | No new write unless saving state is necessary and allowed. |

### Material Non-Command Actions

| ID | Name | Actor | Target Object | Action Type | Trigger | System Response | State Change | Confirmation Required | Reversible | Failure Modes | Recovery Path | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-001 | Enter project description | User | Intake Conversation | create | User types non-slash text | Capture turn and process through intake | Conversation turn and summary may be stored | No, unless remote AI call lacks consent | Partially | Provider failure, low confidence | Preserve input; route to config or retry | MVP |
| ACT-002 | Answer question cluster | User | Open Questions, Intake Conversation | update | User answers naturally | Interpret answer, identify state changes | May create proposals, assumptions, questions | No for capture; yes for confirmation | Partially | Misinterpretation | Show proposed state and allow correction | MVP |
| ACT-003 | Say unknown | User | Open Question, Assumption | create/update | User says they do not know | Store unknown and create or update open question | Related decision remains unknown or incomplete | No | Yes | Unknown treated as failure | Preserve unknown as valid state | MVP |
| ACT-004 | Ask system to assume | User | Assumption | create/update | User asks to assume something | Capture assumption and explain caveat | Assumption may become accepted-for-now | Required if assumption materially affects generation | Yes | Assumption becomes fact-like | Keep visible caveat and affected docs | MVP |
| ACT-005 | Confirm proposed decision | User | Decision | confirm | User selects or states confirmation | Mark proposal confirmed and show affected docs | Decision status proposed to confirmed | Yes | Revisable, not simple undo | Wrong confirmation | Allow revision and affected-output warning | MVP |
| ACT-006 | Reject proposed decision | User | Decision | update | User rejects proposal | Mark rejected and preserve source where useful | Decision status proposed to rejected | No unless rejection has cascading impact | Yes | Wrong target | Clarify target and allow restore | MVP |
| ACT-007 | Defer proposed decision | User | Decision, Open Question | update | User defers | Mark deferred and create next review context | Decision remains non-confirmed | No | Yes | Deferred item hidden | Show in status/diagnostics | MVP |
| ACT-008 | Revise confirmed decision | User | Decision | update | User changes prior decision | Show affected docs and confirm change | Decision superseded or revised; outputs stale | Yes | Partially | Downstream inconsistency | Show affected docs and regenerate option | MVP |
| ACT-009 | Accept system suggestion | User | Suggested Action | execute/confirm | User accepts suggestion | Execute action only if preconditions met | Depends on accepted action | Based on underlying action | Based on underlying action | Suggestion target stale | Revalidate before execution | MVP |
| ACT-010 | Dismiss system suggestion | User | Suggested Action | dismiss | User dismisses | Hide or lower priority suggestion | Suggestion dismissed in current context | No | Usually | Reappears too often | Snooze or lower priority | MVP |
| ACT-011 | Change documentation root | User | LOGOS Documentation Root | configure | User configures root | Show old/new root and consequences | Active root changes; outputs may be stale | Yes | Reversible with consequences | Invalid path, stale outputs | Keep previous root until valid; report old outputs | MVP |
| ACT-012 | Configure AI provider | User | AI Provider Configuration | configure | User runs `/config ai` | Validate config and show redacted status | Provider state changes | Yes | Yes | Invalid token, remote concern | Preserve old config; show local/no-provider path | MVP |
| ACT-013 | Generate outputs | User/System after consent | Canonical and Derived Outputs | transform/create/update | `/generate` or accepted prompt | Render and report output status | Output files and generation report change | Yes for writes/overwrites | Partially | Partial failure, overwrite risk | Report partials; rerun or change root | MVP |
| ACT-014 | Run diagnostics | User | Diagnostic Findings | read/derive | `/diagnose` | Analyze state and recommend actions | Findings may be created or superseded | No unless remote AI needs consent | Rerunnable | Noisy or failed diagnostics | Group by severity; show failure source | MVP |
| ACT-015 | Run validation | User | Validation Gaps | read/derive | `/validate` | Check readiness and evidence gaps | Validation findings may change | No unless changing state | Rerunnable | False validation impression | Label evidence gaps and assumptions | MVP |
| ACT-016 | Correct AI interpretation | User | Decision, Assumption, Open Question | update | User says interpretation is wrong | Identify target and preview correction | Proposal or state updated | Required if canonical state changes | Yes | Ambiguous target | Ask clarification; keep old state | MVP |
| ACT-017 | Retry failed operation | User | Failed Operation | recover | User selects retry | Re-run with same or adjusted context | Success, partial, or failed state | Based on operation | Based on operation | Repeated failure | Offer config/root/status path | MVP |
| ACT-018 | Cancel pending operation | User | Pending Operation | recover | User cancels | Stop where safe and report preserved state | Pending to canceled/partial | No unless cancellation loses work | Partially | Operation already wrote files | Report completed writes | MVP |

### System-Initiated Actions

The system may initiate these actions without treating them as user consent:

- Detect repository context.
- Detect initialized or uninitialized workspace state.
- Summarize current state.
- Suggest next questions or commands.
- Mark AI interpretation as proposed or low confidence.
- Report diagnostics and generation status.
- Warn about provider, root, overwrite, or validation risk.

The system must not initiate these without explicit confirmation:

- Confirm decisions.
- Send project context to a remote provider without configured consent.
- Write or overwrite generated files.
- Change the LOGOS documentation root.
- Store provider configuration.
- Delete, repair, or migrate state destructively.

## Confirmation Rules

Confirmation exists to protect agency, data, local files, and truthfulness. It should not become noise for harmless navigation.

### Confirmation Required

| Action Category | Examples | Confirmation Strength | Reason |
| --- | --- | --- | --- |
| User-owned decision becomes canonical | Confirm proposed decision, accept major assumption | Explicit confirmation | AI cannot decide for the user. |
| File write or overwrite | `/generate`, force render, regenerate stale files | Explicit confirmation, stronger if overwrite risk | Protect local work and repository trust. |
| Documentation-root change | Change from `logos/` to custom root or back | Explicit confirmation | Affects where outputs live and what may become stale. |
| Remote AI context use | First remote provider operation, changed provider mode | Strong consent | Project context may leave local machine. |
| Provider configuration storage | Store non-secret config or test provider | Explicit confirmation | Affects future AI behavior. |
| Destructive or hard-to-recover repair | Delete, overwrite, repair state, migrate with risk | Strong confirmation | Protect data integrity. |
| Accept assumption for material generation | Generate with important unknowns treated as assumptions | Explicit confirmation or visible caveat acceptance | Avoid false certainty. |
| Batch or bulk action | Confirm multiple decisions, regenerate many outputs | Batch summary plus confirmation | User must understand scope. |

### Confirmation Skipped

Confirmation is not required for:

- Viewing status.
- Viewing help.
- Navigating between state summaries.
- Dismissing suggestions.
- Running read-only deterministic diagnostics.
- Running read-only validation checks.
- Capturing ordinary conversation input before it becomes canonical state.
- Showing proposed decisions.
- Showing generation previews.

### Undo May Substitute for Confirmation Only When Safe

Undo or easy reversal may replace prior confirmation only when:

- No file write or overwrite occurs.
- No remote context transmission occurs.
- No user-owned decision becomes confirmed.
- No destructive or hard-to-recover state transition occurs.
- The undo path is visible and reliable.

### Stronger Consent

Stronger consent is required when an action combines multiple risk factors, such as remote AI use plus sensitive context, force generation plus overwrite, or repair plus state migration. Stronger consent should include the action, target, consequence, and alternative.

### Over-Confirmation Guard

The product should not ask for confirmation so often that users stop reading. Low-risk, reversible, read-only, or dismissible actions should use normal feedback rather than modal-style confirmation.

## Undo and Recovery

LOGOS should treat undo, revision, retry, restore, and recovery as separate concepts.

### Reversibility Classes

| Class | Meaning | Examples | Required Interaction |
| --- | --- | --- | --- |
| Undoable | Can be immediately reversed without meaningful consequence. | Dismiss suggestion, change draft answer before interpretation. | Show undo or allow edit. |
| Revisable | Can be changed later, but downstream effects may need review. | Confirmed decision, accepted assumption, documentation root. | Show affected objects before applying revision. |
| Rerunnable | Can be executed again to replace or supersede output. | Diagnostics, validation, generation. | Show previous and new status where useful. |
| Recoverable | Failure can be retried or routed to a safe path. | Provider timeout, invalid root, partial generation. | Preserve state and show recovery action. |
| Prevented | Too risky to allow without confirmation. | Destructive repair, overwrite, remote transmission. | Confirm before action; do not rely on undo. |
| Irreversible outside product | Cannot be guaranteed by LOGOS once externalized. | User shares files externally, commits secrets manually, remote provider receives context. | Warn before action where LOGOS can know. |

### Action Recovery Rules

- Conversation input should be editable or correctable through follow-up before it becomes confirmed state.
- Proposed decisions can be rejected, revised, or deferred.
- Confirmed decisions can be revised or superseded, with affected documents identified.
- Assumptions can be rejected, replaced with evidence, or converted into open questions.
- Diagnostics can be rerun and superseded.
- Validation checks can be rerun and superseded.
- Generated files can be regenerated, but manual edits and overwrite risk require warnings.
- Documentation-root changes can be changed again, but old outputs may remain stale.
- Provider configuration can be changed or disabled, but prior remote transmissions cannot be undone by LOGOS.

### Undo Across Sessions

MVP should not promise unlimited history undo. Across sessions, the product should preserve enough state to:

- Resume unfinished intake.
- Review proposed and confirmed decisions.
- Identify stale outputs.
- Revise confirmed decisions.
- Rerun diagnostics and validation.
- Regenerate outputs.
- Show recent generation status where available.

Formal history depth belongs to the State Model and Engineering Data Model.

### Failure Recovery

| Failure | Recovery Interaction | State Preservation |
| --- | --- | --- |
| No workspace state | Offer `/init` and show active repository. | No generated writes before confirmation. |
| Wrong repository suspected | Show path and ask before writing. | Preserve no-op state. |
| AI provider missing | Route to `/config ai`; allow local status review. | Preserve conversation and workspace state. |
| Provider timeout | Retry, switch provider, save and continue later. | Preserve pre-call user input and state. |
| Invalid documentation root | Explain path issue; allow root change. | Preserve previous valid root. |
| Partial generation | Report created, updated, skipped, incomplete, blocked. | Preserve completed outputs and generation report. |
| Malformed AI output | Reject interpretation safely. | Preserve raw input and prior state. |
| State inconsistency | Diagnose, explain, and avoid destructive repair without confirmation. | Preserve readable existing state. |

## Ambiguity Handling

Ambiguity is normal in LOGOS. The product should resolve it according to consequence.

### Ambiguity Decision Rules

| Situation | System Behavior | Reason |
| --- | --- | --- |
| Low-risk conversational ambiguity | Make a labeled best guess and allow correction. | Keeps flow moving. |
| Ambiguous proposed decision | Keep proposed and ask for review or clarification. | Prevents false confirmation. |
| Ambiguous command target | Ask for target clarification. | Commands can change state. |
| Ambiguous documentation root | Do not write; show active root and alternatives. | Path mistakes are costly. |
| Ambiguous remote provider consent | Do not send context; explain provider status. | Privacy and trust risk. |
| Ambiguous overwrite consequence | Do not overwrite; show affected files. | Local work risk. |
| Ambiguous validation claim | Mark as assumption or validation gap. | Prevents false evidence. |
| Conflicting user instructions | Ask which instruction should win. | Avoid hidden prioritization. |
| Low-confidence AI interpretation | Label low confidence and ask for review. | Prevents passive acceptance. |

### Unknown Input

When the user says "I do not know", "unknown", "not sure", or equivalent:

- Capture the answer as a valid state.
- Create or update an open question.
- Keep related decisions unconfirmed.
- Allow progress with visible caveats where safe.
- Do not shame, block unnecessarily, or fabricate an answer.

### Assume-for-Now Input

When the user asks LOGOS to assume something:

- Capture the assumption separately from confirmed decisions.
- Explain if the assumption affects generated documents or validation readiness.
- Require confirmation if the assumption materially affects generation or downstream claims.
- Keep the assumption visible in generated content until resolved.

### Refusal to Guess

The system should refuse to guess when:

- A guess would confirm a decision.
- A guess would send context remotely.
- A guess would change output root.
- A guess would overwrite files.
- A guess would claim external validation.
- A guess would cross product boundaries.

Refusal should be specific and helpful, naming the missing information and the safest next action.

## System Suggestions

System suggestions are not commands, consent, or automation. They are prompts for user-controlled action.

### Allowed MVP Suggestions

| Suggestion Type | Example | When It Appears | Acceptance Behavior | Dismissal Behavior |
| --- | --- | --- | --- | --- |
| Next question cluster | "Clarify target user and success signal next." | Intake or continuation | Opens or continues conversation | Hide for current turn or defer |
| Decision review | "Review 3 proposed decisions." | Proposals exist | Opens review flow | Keep proposals pending |
| Generation | "Generate current Product docs." | Sufficient state or accepted caveats | Runs confirmation flow for generation | Leave outputs unchanged |
| Diagnostics | "Run diagnostics for current gaps." | Unclear readiness or after generation | Runs `/diagnose` | No diagnostic run |
| Validation | "Check validation gaps." | Assumptions or unsupported claims exist | Runs `/validate` | No validation check |
| AI configuration | "Configure AI provider to continue intake." | AI operation blocked | Opens `/config ai` | Remain in no-provider state |
| Root review | "Confirm or change documentation root." | First run or path risk | Opens root configuration | Keep current root if safe |
| Output review | "Review generated files and skipped outputs." | After generation | Shows generation report | Report remains available |

### Suggestion Priority

Suggestion priority should follow:

1. Safety or consent issue.
2. Blocking configuration issue.
3. Severe diagnostic or validation gap.
4. Pending decision review.
5. Next useful intake question.
6. Generation or regeneration.
7. Advanced inspection.

### Suggestion Explanation

Every material suggestion should be able to answer:

- Why am I seeing this?
- What object does it affect?
- What happens if I accept?
- What happens if I ignore or dismiss it?
- Does it change state, write files, or use a provider?

### Prohibited Suggestion Patterns

The system must not:

- Pressure users to complete for engagement.
- Repeatedly re-show dismissed suggestions without changed context.
- Suggest paid, hosted, or remote behavior as if required for local progress.
- Present AI recommendations as preferred user decisions.
- Hide the consequence of accepting a suggestion.

## User Corrections

Corrections should be ordinary, explicit, and visible. The product should assume that AI interpretation, user input, classification, and generated output may need revision.

### Correction Types

| Correction Type | Example | Interaction Loop | Confirmation |
| --- | --- | --- | --- |
| Input correction | User clarifies prior answer. | Identify prior turn, capture correction, update summaries/proposals. | Required only if canonical state changes. |
| Interpretation correction | User says AI misunderstood. | Show interpreted object, accept correction, update proposal. | Required for confirmed state changes. |
| Decision correction | User changes confirmed decision. | Show current decision, new decision, affected docs. | Required. |
| Assumption correction | User rejects or revises assumption. | Update assumption status and affected documents. | Required if generation readiness changes. |
| Classification correction | User says item is a risk, not a decision. | Reclassify object and show downstream impact. | Required if canonical state changes. |
| Output correction | User finds generated document wrong. | Link issue to source state or manual document concern. | Required before regeneration/overwrite. |
| Configuration correction | User changes root or provider. | Show old/new config and consequences. | Required. |
| Suggestion correction | User dismisses or rejects suggestion. | Record dismissal in context where supported. | Not required. |

### Correction Rules

- Corrections must not create hidden assumptions.
- Corrections to AI interpretation should preserve the original source enough for traceability.
- Corrections to confirmed decisions should identify affected documents, diagnostics, and generated outputs.
- Corrections should not silently rewrite derived artifacts without regeneration rules.
- Correction data should improve local project state, not hidden product personalization, unless a future consent model exists.
- If the correction target is ambiguous, ask which object the user means.

### Correction Feedback

After correction, LOGOS should show:

- What changed.
- What stayed unchanged.
- Which objects are affected.
- Whether outputs are stale.
- Whether regeneration, diagnostics, or validation is recommended.
- Whether the correction remains proposed, confirmed, assumed, or deferred.

## State Transitions

This section defines product-level transitions. Formal lifecycle detail belongs to the State Model.

### Core Transitions

| Object | From State | To State | Trigger | Actor | Preconditions | Permission Requirements | Visible Feedback | Reversible | Invalid Transitions | State Model Implication |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Repository Workspace | uninitialized | initialized | `/init` confirmed | user | repository context known | local write consent | repository, profile, root shown | partially | uninitialized to generated | Define init idempotency. |
| LOGOS Documentation Root | proposed default | accepted default | user accepts `logos/` | user | repository writable | root confirmation | active root shown | yes | hidden default to active without disclosure | Track default/custom status. |
| LOGOS Documentation Root | active | changed | user configures root | user | valid path | confirmation | old/new root and stale outputs | yes, with consequences | active to changed silently | Track output-root history or stale outputs. |
| AI Provider Configuration | not configured | configured | `/config ai` | user | valid non-secret config | provider consent | redacted provider status | yes | raw token stored in project files | Track token source safely. |
| Intake Conversation | not started | active | non-slash input or `/continue` | user | workspace and AI path available | remote disclosure if needed | current question or provider guidance | yes | no-provider to remote call silently | Track conversation state. |
| Conversation Turn | captured | interpreted | AI or interpreter processes turn | system | turn exists | provider consent if AI used | interpreted summary and proposals | partially | interpreted to confirmed decision | Link turn to derived state. |
| Decision | unknown | proposed | interpretation or user entry | system/user | source exists | none | proposal shown | yes | proposed to confirmed by AI | Track source and status. |
| Decision | proposed | confirmed | user confirms | user | proposal visible | explicit confirmation | affected documents shown | revisable | proposed to confirmed silently | Track confirmation event. |
| Decision | confirmed | superseded | user revises | user | existing confirmed decision | explicit confirmation | affected docs and stale outputs | partially | confirmed overwritten silently | Track supersession. |
| Assumption | proposed | accepted for now | user accepts assumption | user | assumption visible | confirmation if material | caveat and affected docs shown | yes | accepted to confirmed fact | Track assumption status separately. |
| Open Question | active | answered | user answers | user | question visible | none unless answer confirms decision | answer summary and proposals | yes | active to confirmed decision silently | Link answer to proposals. |
| Canonical Document | not generated | generated | `/generate` confirmed | user/system | root and contract valid | file write consent | generation report | rerunnable | generated outside active root | Track output status. |
| Canonical Document | generated | stale | source state changes | system | affected decision/assumption changes | none | stale indicator | rerunnable | stale hidden | Track source dependencies. |
| HTML Artifact | not generated | generated | generation | system after consent | canonical source available | file write consent | derived status in report | rerunnable | artifact treated canonical | Track derivation. |
| Agent Pack | not generated | generated | generation | system after consent | source docs available | file write and context sensitivity | derived status in report | rerunnable | pack generated from private chat only | Track sources. |
| Diagnostic Finding | active | resolved | state changes or rerun | system | finding affected object changes | none | resolved or superseded status | rerunnable | finding mutates decision | Track diagnostic history. |
| Generation Report | pending | completed/partial/failed | generation ends | system | generation started | none beyond generation consent | result categories | superseded | failure hidden | Track latest report. |

### Automatic Transitions

Allowed automatic transitions:

- Generated output becomes stale when source state changes.
- Diagnostic findings become superseded when diagnostics rerun.
- Suggested actions become lower priority when dismissed.
- Provider status becomes unavailable when a test fails.

Blocked automatic transitions:

- Proposed decision to confirmed.
- Assumption to fact.
- Unknown to answered.
- Root proposed to active without disclosure.
- Remote provider inactive to used.
- Derived artifact to canonical.

### Visibility Rules

Transitions must be visible when they:

- Change canonical state.
- Affect generated files.
- Affect consent or permissions.
- Affect validation confidence.
- Affect decision status.
- Affect active root or provider status.
- Create stale outputs.
- Resolve or introduce severe diagnostics.

## Accessibility Interaction Rules

Accessibility requirements here are interaction expectations, not tested guarantees. Detailed accessibility testing belongs downstream.

### Keyboard and Command Access

- All critical actions should be possible through keyboard-operable interactions.
- Slash commands must remain usable without pointer interaction.
- Confirmation choices must be reachable and distinguishable by keyboard.
- Focus should move predictably after command execution, error display, confirmation prompts, and generation reports.
- Keyboard shortcuts, if added later, must not be the only path to critical actions.

### Pointer and Touch

- Pointer or touch interactions may support selection, review, and navigation, but they must not be the sole path for critical actions.
- Small or timing-sensitive targets should not be required for confirmation, recovery, or error handling.
- Hover-only explanations are insufficient for risk, permission, or validation caveats.

### Screen Reader and Assistive Feedback

- Command results, errors, confirmations, diagnostics, and generation reports must have text equivalents.
- Status must not rely only on color, position, animation, or visual grouping.
- Proposed versus confirmed, canonical versus derived, and success versus partial failure must be textually available.

### Timing and Motion

- The product should not discard user input because of timeout without preserving or warning.
- Long-running operations need pending feedback and safe cancellation where possible.
- Motion or animated progress indicators must not be the only status feedback.
- Reduced-motion preferences should be respected in future visual surfaces.

### Error and Recovery Accessibility

- Error messages must identify what failed and the next safe action.
- Recovery actions must be keyboard-accessible.
- Focus should move to the error or recovery prompt when an action fails.
- Repeated errors should not trap the user in the same interaction.

### Accessibility Assumptions Requiring Validation

- TUI accessibility varies by terminal, OS, screen reader, and framework support.
- Future HTML artifacts may need separate accessibility review.
- Interaction rules should feed UI Model and Acceptance Criteria before claims are made.

## Interaction Risks

| Risk | Affected Action or Journey | Risk Type | User Impact | Early Signal | Mitigation | Target Document |
| --- | --- | --- | --- | --- | --- | --- |
| Natural language accidentally executes high-risk action | Conversational input | Agency risk | User loses control of writes or configuration | Users phrase "generate" and files change unexpectedly | Require slash command or explicit confirmation | Permission Model, Acceptance Criteria |
| Slash command typo loses user input | Command input | Learnability risk | User becomes frustrated or confused | Unknown command errors during intake | Explain command error and preserve typed text | Content Model, Feature Specification |
| AI proposals appear confirmed | Decision review | False authority | User acts on unreviewed AI output | Users cannot tell status | Strong proposed/confirmed labels and confirmation gate | State Model, Acceptance Criteria |
| Confirmation fatigue | Generation, decisions, config | Safety friction | Users stop reading confirmations | Users confirm blindly | Confirm only risk-bearing actions | UI Model, Acceptance Criteria |
| Missing confirmation for remote provider | AI provider use | Privacy risk | Project context leaves local machine unexpectedly | User asks what was sent | Provider status and consent before remote calls | Permission Model |
| Generation overwrites manual work | `/generate` | Data loss risk | User loses trust and content | Unexpected file changes | Generation preview/report and overwrite warnings | Permission Model, Engineering Brief |
| Unknown answers block too much | Intake | Flow risk | User abandons because uncertainty feels punished | Users invent answers | Unknown creates open question and caveated progress | Content Model |
| Assumptions become hidden facts | Assume-for-now | Validation risk | False confidence in docs | Generated docs omit caveats | Assumption labels and validation gaps | Content Model, Acceptance Criteria |
| Diagnostics overwhelm user | `/diagnose`, `/validate` | Cognitive load risk | User cannot find next action | Long flat diagnostic lists | Group by severity and next action | UI Model |
| Correction target ambiguity | User corrections | State integrity risk | Wrong decision or assumption changes | User says "that's wrong" with many possible targets | Ask target clarification | Interaction Model, State Model |
| Partial generation appears successful | `/generate` | Trust risk | User misses blocked files | Success message hides skipped outputs | Use partial status and categories | Acceptance Criteria |
| TUI interaction inaccessible | All critical actions | Accessibility risk | Some users cannot confirm, recover, or navigate | Keyboard/focus issues | Keyboard-accessible command path and text feedback | UI Model, Acceptance Criteria |
| Root change leaves stale outputs | Documentation-root config | Lifecycle risk | User reviews old files | Multiple roots contain similar files | Active root display and stale-output reporting | State Model |
| Suggestion feels like pressure | System suggestions | Agency risk | User follows system instead of deciding | Suggestions repeat after dismissal | Dismiss/snooze and explanation rules | Content Model |

## Interaction Anti-Patterns

| Anti-Pattern | Why It Is Harmful | Violates |
| --- | --- | --- |
| Natural-language execution of risky actions | User intent may be ambiguous; high-risk actions need explicit consent. | User agency, Safe by Default |
| AI-confirmed decisions | Transfers responsibility from user to system. | AI as a Layer, User Responsibility |
| Hidden provider call | Breaks local trust and consent. | Local First, Safe by Default |
| Silent file writes | Makes local repository changes surprising. | Git Friendly, Recoverable Progress |
| Confirmation everywhere | Trains users to ignore confirmation. | Risk Determines Friction |
| No confirmation for overwrite | Risks data loss and trust breakage. | Local Trust, Recoverability |
| Question-id intake as normal UX | Turns conversation-first flow into a mechanical form. | Conversation-Led State |
| Chat transcript as source of truth | Makes state hard to review, regenerate, and validate. | Structure Over Presentation |
| Suggestion as command | Treats recommendation as consent. | User agency |
| Dismissal punishment | Makes users feel coerced into system suggestions. | Safe by Default |
| Color-only status | Excludes users and obscures critical state. | Accessibility |
| Hover-only warnings | Hides consequence information from keyboard and touch users. | Accessibility, Trust |
| Partial failure hidden by success copy | Makes generated output unreliable. | Truthfulness, Recovery |
| Unknown treated as error | Encourages false certainty. | Explicit Over Assumed |
| Derived output editing as canonical | Breaks traceability and regeneration. | Structure Over Presentation |

## Downstream Handoff

### Content Model

Content Model must define clear language for:

- Command feedback.
- Proposed, confirmed, rejected, deferred, assumed, unknown, stale, blocked, partial, and failed states.
- Confirmation prompts by risk level.
- Unknown and assume-for-now responses.
- System suggestions and dismissals.
- Correction acknowledgement.
- Generation reports.
- Diagnostic severity and next actions.
- Provider disclosure and remote context warnings.
- Accessibility-friendly text equivalents for status.

Content must avoid implying that suggestions are commands, AI output is truth, or generated documents are externally validated.

### State Model

State Model must formalize:

- Conversation turn lifecycle.
- Interpretation output lifecycle.
- Decision status transitions.
- Assumption and open question transitions.
- Diagnostic finding lifecycle.
- Generation report lifecycle.
- Canonical and derived output stale states.
- Documentation-root configuration history or active-root rules.
- Provider configuration status without raw token storage.
- Dismissed or snoozed suggestion behavior if persisted.
- Recovery state after partial failure.

State Model must explicitly block AI-proposed state from becoming confirmed without user confirmation.

### Permission Model

Permission Model must define consent and confirmation requirements for:

- Workspace initialization.
- File writes, overwrites, and force generation.
- Documentation-root changes.
- Remote AI provider use.
- Provider configuration storage and tests.
- Decision confirmation.
- Material assumption acceptance.
- Destructive repair or migration.
- Sensitive derived outputs such as agent packs.

Permission Model must distinguish ordinary confirmation from stronger consent.

### Feature Specification

Feature Specification must turn the following interaction capabilities into concrete MVP behavior:

- TUI input router for slash commands versus ordinary conversation.
- `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai`, `/help`, and `/exit`.
- Conversation turn capture and interpretation.
- Decision proposal review and confirmation.
- Assumption and unknown handling.
- Documentation-root setup and change.
- AI provider setup and no-provider recovery.
- Generation confirmation and reporting.
- Diagnostics with next conversational moves.
- User correction flows.
- Error, retry, cancel, and recovery flows.

Feature Specification must not introduce hosted collaboration, task-board workflows, autonomous execution, or broad external research automation as MVP interactions.

### Acceptance Criteria

Acceptance Criteria must verify:

- Ordinary non-slash input creates or continues a conversation turn.
- Slash-prefixed input routes to command handling.
- `/continue` resumes conversation without question-id subcommands.
- AI-generated decisions enter as proposed, not confirmed.
- Confirmed decisions require explicit user confirmation.
- Unknown answers create useful open questions or incomplete states.
- Assume-for-now answers remain visible as assumptions.
- `/generate` shows active root and requires write/overwrite confirmation.
- Generation reports created, updated, skipped, incomplete, blocked, and failed outputs.
- `/diagnose` and `/validate` do not mutate confirmed decisions.
- Provider status appears before remote AI operations.
- Raw provider tokens are not stored in project files.
- Root changes show old root, new root, and stale-output implications.
- Errors preserve state and provide recovery paths.
- Critical interactions are keyboard-operable and text feedback is available.

### Engineering API Contracts

API Contracts must preserve interaction semantics:

- Command handlers should return structured results with status, messages, affected objects, state changes, and recovery options.
- AI interpretation APIs should return proposed, advisory, or needs-review output, not confirmed state.
- Generation APIs should return file-level and category-level results.
- Diagnostics APIs should return findings with severity, affected object, and next action.
- Provider APIs should separate configuration status from raw secret values.
- State-changing APIs should make confirmation requirements explicit.
- Recovery APIs should report preserved state and partial completion.

### Engineering Brief

Engineering must implement the interaction model without hidden state changes, hidden remote calls, or unreviewed AI authority. The implementation should preserve local-first behavior, slash command routing, conversation-first intake, structured output validation, deterministic validation separate from AI judgment, and no raw token storage in project files.

### Unresolved Interaction Questions

- Which confirmations should be modal-style versus inline in the TUI?
- Should generation reports persist as history or only latest status?
- How should manual edits to canonical Markdown be detected and protected?
- Should decision review have a dedicated view in MVP or remain contextual?
- How much suggestion dismissal state should persist across sessions?
- What exact accessibility support is feasible in the chosen TUI framework?
- Should `/generate` allow a force mode in MVP, and what stronger confirmation should it require?
- How much provider disclosure is enough before it becomes repetitive?
