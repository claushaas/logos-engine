# UX Model

## UX Thesis

LOGOS Engine should feel like a calm, rigorous project architect running inside the user's own repository: conversational enough to help the user think, structured enough to make decisions reviewable, and conservative enough to preserve local control, uncertainty, and user agency.

The central UX bet is that the user does not need another blank document, generic chatbot, or project dashboard. The user needs a guided clarification loop that turns ambiguous intent into explicit decisions, assumptions, open questions, risks, canonical Markdown, derived HTML artifacts, and agent packs under a configured LOGOS documentation root. The default generated documentation root is `logos/`, and the user may configure another folder when the repository needs a different location.

The normal experience should feel steady, inspectable, and agency-preserving. The user should usually feel, "I can see what is known, what is assumed, what is missing, what changed, and what I can do next." The product should not make the user feel rushed, judged for not knowing, tricked by polished output, or dependent on hidden remote behavior.

This thesis protects the primary journey: a founder-origin technical or product-adjacent builder opens LOGOS Engine from the target repository, clarifies an unclear project through AI-led conversation, reviews proposed decisions, generates local outputs, diagnoses gaps, and leaves with a more usable project foundation.

This UX model is based on the founder's personal experience, existing foundation documents, validation constraints, product scope, user journeys, and old project material. It must be treated as a product hypothesis until external user behavior validates or rejects it.

The experience must not become:

- A generic chatbot where the transcript is the product.
- A deterministic questionnaire that burdens the user with form completion.
- A SaaS dashboard that makes local files secondary.
- An autonomous agent that decides for the user.
- A presentation generator that makes weak reasoning look complete.
- A project management suite that shifts the product away from pre-execution clarity.

## Experience Principles

### Principle 1: Calm Rigor Over Momentum Theater

**Status:** mandatory.

**Meaning:** The product should make progress feel calm, precise, and reviewable instead of fast, magical, or performative. It should expose the project state clearly, even when the state is incomplete.

**Decision rule:** When a UX choice increases perceived speed but weakens clarity, traceability, or user review, choose clarity.

**User benefit:** The user can trust the product during ambiguity because it does not punish slow thinking, incomplete answers, or honest uncertainty.

**Trade-offs:** This may make the first session feel less flashy. It may require extra confirmation before generation, provider setup, root configuration, or decision capture.

**Violations:**

- Showing documents as complete when required decisions are missing.
- Using success language when the system has only generated a draft.
- Asking for rapid decisions without showing consequences.
- Hiding gaps because they make the experience feel less finished.

**Affected journeys:** Primary clarification, first value, diagnostics, generation and review, decision revision.

**Downstream implications:** Information Architecture must prioritize project state and document readiness. UI Model must avoid empty polish. Content Model must label incomplete, assumed, proposed, confirmed, and blocked states explicitly.

### Principle 2: Conversation-Led, State-Backed

**Status:** mandatory.

**Meaning:** Conversation is the main way the user expresses intent, but structured state is the source of truth. Useful answers must become proposed decisions, assumptions, open questions, risks, or document content rather than remaining only in chat.

**Decision rule:** When conversational convenience conflicts with structured reviewability, preserve the structured state and make the conversion visible.

**User benefit:** The user can speak naturally without losing the benefits of durable, inspectable, Git-friendly project knowledge.

**Trade-offs:** The system may need to pause the conversation to show proposed decisions, unresolved questions, or generated-file impact.

**Violations:**

- Treating chat history as canonical project memory.
- Inferring and confirming decisions without review.
- Letting AI output override confirmed decisions silently.
- Generating documents from private conversational context that is not reflected in local state.

**Affected journeys:** AI-led intake, continue session, generate outputs, decision revision, agent pack generation.

**Downstream implications:** State Model must distinguish raw input, proposed decisions, confirmed decisions, assumptions, open questions, risks, and generated outputs. Interaction Model must define review moments that do not destroy conversational flow.

### Principle 3: Uncertainty Is Useful

**Status:** mandatory.

**Meaning:** Unknowns, assumptions, weak evidence, and low-confidence AI interpretations are first-class UX states. The product should help the user work with uncertainty instead of concealing it or treating it as failure.

**Decision rule:** When the system cannot know something from available context, it must label the uncertainty and route it to an assumption, open question, validation need, or next decision.

**User benefit:** The user can continue making progress without confusing assumptions for facts.

**Trade-offs:** Documents may look less polished because they preserve caveats. Diagnostics may reveal uncomfortable gaps.

**Violations:**

- Converting founder intuition into validated user evidence.
- Presenting generated strategy as confirmed truth.
- Treating "I do not know yet" as an error.
- Hiding weak evidence from downstream documents.

**Affected journeys:** Intake, validation, diagnostics, generated documentation, repeat use.

**Downstream implications:** Content Model must include language for assumptions, hypotheses, evidence gaps, and uncertainty. Acceptance Criteria must require low-confidence and incomplete states to be visible.

### Principle 4: Local Trust Before Convenience

**Status:** mandatory.

**Meaning:** The user should understand where LOGOS writes, what it stores, what may be sent to an AI provider, and what can be regenerated. Local inspectability is a trust mechanism, not an implementation detail.

**Decision rule:** When convenience would hide local paths, provider behavior, overwrite risk, or output provenance, disclose the behavior before proceeding.

**User benefit:** The user can use LOGOS inside an existing repository without fearing hidden state, surprise network calls, or collisions with existing documentation.

**Trade-offs:** First-run setup may include extra explanation about the configured LOGOS documentation root, AI configuration, and generated outputs.

**Violations:**

- Treating the repository's existing documentation folder as the generated documentation root by default.
- Hiding that `logos/` is the default generated documentation root.
- Sending project context to a remote AI provider without configuration and disclosure.
- Treating derived HTML artifacts or agent packs as canonical sources.
- Storing raw provider tokens in project files.

**Affected journeys:** Onboarding, documentation-root configuration, provider configuration, generation and review, recovery from path or permission errors.

**Downstream implications:** Permission Model must define consent gates for remote calls and write operations. UI Model must show active repository, active LOGOS documentation root, provider status, and generated-output categories.

### Principle 5: Recoverable Progress

**Status:** preferred.

**Meaning:** The product should make interruption, revision, partial completion, and error recovery feel ordinary. A user should be able to stop, return, revise, regenerate, and diagnose without losing context.

**Decision rule:** When a UX choice optimizes for linear completion but weakens interruption or recovery, prefer recoverability.

**User benefit:** The user can work with real project ambiguity over multiple sessions without restarting or accepting stale context.

**Trade-offs:** Persistent status, diagnostics, and change reporting add visible system state that must be kept understandable.

**Violations:**

- Requiring the user to reread all prior conversation to continue.
- Overwriting manual changes or generated outputs without warning.
- Reporting errors without a next safe action.
- Making a failed generation leave unclear partial state.

**Affected journeys:** Continue session, diagnostics, error recovery, decision revision, repeat use.

**Downstream implications:** Interaction Model must specify resumable flows. State Model must preserve partial and failed operations. Acceptance Criteria must cover interruption and recovery, not only happy paths.

### Principle Precedence

When principles conflict, resolve in this order:

1. Preserve user agency, consent, and data safety.
2. Preserve truthfulness about uncertainty, evidence, and confidence.
3. Preserve local inspectability and source-of-truth clarity.
4. Preserve recoverability.
5. Optimize speed, polish, and convenience.

## Primary UX Paradigm

LOGOS Engine is a conversation-led, state-backed, document-generating repository TUI.

The primary paradigm is not chat-first, dashboard-first, document-first, or workflow-first alone. It combines natural language clarification with explicit project state and local document generation. The user speaks in project intent; the system translates useful content into structured decisions, assumptions, risks, open questions, diagnostics, and generated outputs.

Users navigate by:

- The active repository.
- The configured LOGOS documentation root.
- The active profile and phase.
- Document readiness and output status.
- Decisions, assumptions, open questions, risks, and validation gaps.
- The next useful action, such as continue, configure, generate, diagnose, validate, or revise.

After initialization, every TUI startup should begin with an AI Startup Briefing. The briefing welcomes the user back, summarizes the current status from local structured state, names the most relevant blockers or unresolved items, and recommends the next step with enough detail for the user to continue without first running `/status` or rereading prior documents.

The dominant input mode is natural language conversation supported by slash commands for explicit system operations. Slash commands should remain clear operational anchors, including `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, and `/config ai`.

The dominant output mode is local, inspectable project knowledge:

- Canonical Markdown under the configured LOGOS documentation root.
- Derived HTML artifacts regenerated from canonical content.
- Derived agent packs regenerated from canonical content and profile contracts.
- Visible status, diagnostics, decision proposals, gap reports, and generation reports inside the TUI.

When the user has already completed several related phases, the intake experience may also show contextual suggestions beside the next questions. A contextual suggestion should feel like "LOGOS noticed this question relates to what you already decided; here is a proposed answer you may accept, edit, reject, or ignore." It must not feel like a required answer, a hidden default, or a decision the system already made.

Secondary paradigms exist but remain subordinate:

- **Command surface:** for explicit operations and recovery.
- **Document surface:** for reviewing canonical outputs.
- **Diagnostic surface:** for seeing gaps, contradictions, and readiness.
- **Artifact surface:** for derived HTML and agent context outputs.

Misleading paradigms to avoid:

- **Generic chatbot:** suggests conversation itself is the product.
- **Form wizard:** suggests the user must answer every field in a fixed order.
- **SaaS dashboard:** suggests remote hosted state is canonical.
- **Autonomous agent:** suggests LOGOS decides or executes without confirmation.
- **Static documentation generator:** suggests documents are templates rather than projections of structured decisions.

## User Mental Model

Users are likely to arrive with one of several existing mental models:

- "I need a better prompt or AI assistant to help shape my project."
- "I need documentation before implementation."
- "I need a project brief, scope, roadmap, or validation structure."
- "I need to get unstuck from vague thinking."
- "I need something that works inside my repository."

The product should teach a more specific model:

> LOGOS Engine is a local decision and documentation engine that helps turn ambiguous project intent into structured, reviewable project knowledge.

The core abstraction is the **project clarity state**. This state includes what is known, what is assumed, what is proposed, what is confirmed, what remains open, what is risky, which documents depend on that knowledge, and which outputs were generated from it.

The user should understand that LOGOS is responsible for:

- Guiding clarification through AI-led conversation.
- Asking context-aware questions.
- Translating answers into structured project state.
- Proposing decisions and assumptions for review.
- Rendering canonical Markdown documents.
- Regenerating derived HTML artifacts and agent packs.
- Diagnosing gaps, contradictions, incompleteness, and readiness issues.
- Preserving local, inspectable outputs under a configured root.

The user remains responsible for:

- Confirming decisions.
- Providing or withholding project context.
- Judging whether assumptions are acceptable.
- Validating real user, market, business, legal, or technical claims.
- Reviewing generated documents before using them as execution input.
- Choosing when to commit, share, or act on generated files.

Helpful metaphors:

- A structured project architect.
- A local documentation engine.
- A decision reviewer.
- A clarity checkpoint before execution.

Misleading metaphors:

- A builder that creates the final product.
- A project manager that runs the work.
- A strategy oracle that knows market truth.
- A generic chatbot that remembers everything.
- A SaaS workspace that owns the project.
- A pitch-deck or presentation machine.

The highest-risk misunderstanding is that generated documents prove the project is validated or complete. The UX must repeatedly separate generated clarity from external evidence.

## Cognitive Load Rules

### Rule 1: Ask in Small Contextual Clusters

**Applies to:** AI-led intake, onboarding, continuation, validation follow-up.

**Rationale:** The user is often starting from ambiguity. Large question sets increase abandonment and encourage shallow answers.

**Evidence basis:** Product hypothesis grounded in founder-origin need and user-journey risk; not externally validated.

**Trade-off:** Smaller clusters can make intake take more rounds.

**Violation example:** Asking the user to complete every product, market, validation, scope, and UX question before showing any state or value.

**Downstream requirement:** Interaction Model must define intake turns that focus on the next few useful decisions rather than full phase completion at once.

### Rule 1A: Suggest Only From Direct Prior Context

**Applies to:** later-phase intake, continuation, diagnostics follow-up, document-specific questions.

**Rationale:** Once the project has several completed documents, some later questions are direct continuations of earlier decisions. Re-asking them from zero creates friction, but auto-answering them creates false authority.

**Evidence basis:** Product hypothesis grounded in founder-origin use and the project's source-of-truth principles; not externally validated.

**Trade-off:** Suggestions add cognitive load if shown too often or without a clear source basis.

**Violation example:** Asking an engineering architecture question and pre-filling an answer from an unvalidated market assumption without labeling the assumption or asking the user to review it.

**Downstream requirement:** Interaction Model and API Contracts must define contextual suggestions as proposed, source-labeled, and optional; State Model must prevent suggestions from becoming confirmed decisions without user action.

### Rule 2: Show the Next Useful Action by Default

**Applies to:** TUI status, generation result, diagnostics, recovery, re-entry.

**Rationale:** The product should reduce uncertainty about what to do next without pretending the project is complete.

**Evidence basis:** Product Scope and User Journeys identify status, continue, diagnose, and generate as core navigation anchors.

**Trade-off:** Prioritizing a next action may hide less urgent options until requested.

**Violation example:** Ending a diagnostic report with a long list of findings but no recommended next question or action.

**Downstream requirement:** UI Model and Content Model must include concise next-action language for major states.

### Rule 2A: Welcome Back With Status and Continuation Detail

**Applies to:** TUI startup after initialization, session re-entry, recovery after reopening.

**Rationale:** A returning user should not need to remember where they stopped. The agent should orient them immediately using the current local state and the profile contract.

**Evidence basis:** Founder-origin workflow hypothesis; not externally validated.

**Trade-off:** AI-generated summaries can introduce latency or overconfidence if not grounded in deterministic status data.

**Violation example:** Opening an initialized workspace into a blank shell or generic greeting that does not name current phase, unresolved decisions, pending proposals, stale outputs, or the safest next action.

**Downstream requirement:** Interaction Model, UI Specification, API Contracts, and Test Strategy must define a startup briefing that is AI-generated when provider rules allow it, source-grounded, non-mutating, and backed by a deterministic fallback when AI is unavailable.

### Rule 3: Never Hide Critical Consequence Information

**Applies to:** path selection, provider configuration, remote AI calls, file writes, overwrite risk, validation confidence, destructive or irreversible actions.

**Rationale:** Progressive disclosure must not conceal information that changes consent, trust, data safety, or interpretation.

**Evidence basis:** Foundation boundaries and product scope.

**Trade-off:** Critical warnings may slow first-run flow.

**Violation example:** Running generation without showing that `logos/` is the active default documentation root, especially when the repository already has its own documentation folder.

**Downstream requirement:** Permission Model and Acceptance Criteria must identify consequence-bearing actions that require explicit disclosure.

### Rule 4: Keep Advanced Configuration Out of the Main Path Until Needed

**Applies to:** custom documentation root, provider settings, profile details, output regeneration settings, diagnostics verbosity.

**Rationale:** New users need a clear path to first value; advanced users need control without crowding the default flow.

**Evidence basis:** Product hypothesis; external usability evidence is not yet available.

**Trade-off:** Some advanced users may want immediate access to configuration.

**Violation example:** Opening first run with a full settings surface before the user understands what LOGOS will produce.

**Downstream requirement:** Information Architecture must separate main journey actions from inspectable advanced settings.

### Rule 5: Preserve Important State Across Turns

**Applies to:** conversation, continuation, generation, diagnostics, decision revision, error recovery.

**Rationale:** The user should not need to remember what LOGOS already captured, proposed, confirmed, or failed to generate.

**Evidence basis:** User Journeys and Git Friendly foundation principle.

**Trade-off:** More state visibility can create visual density if not prioritized.

**Violation example:** Asking a returning user to restate the project summary without showing current progress first.

**Downstream requirement:** State Model must support resumable, inspectable progress states.

### Rule 6: Make Unknown a Valid Input

**Applies to:** intake answers, validation gaps, assumptions, product choices, scope boundaries.

**Rationale:** Forcing certainty creates false clarity. Unknowns should become useful project state.

**Evidence basis:** Explicit Over Assumed and Safe by Default foundation principles.

**Trade-off:** Generated documents may contain more caveats and open questions.

**Violation example:** Blocking all generation because the user cannot yet define a validated target audience.

**Downstream requirement:** Content Model must define clear language for unknown, assumed, deferred, and validation-required states.

## Guidance Model

LOGOS guidance should be mixed: proactive enough to move the user toward clarity, reactive enough to preserve control.

### Onboarding Guidance

First-run guidance should explain only what the user needs to begin:

- The active repository.
- Whether LOGOS is initialized.
- The active profile.
- The configured LOGOS documentation root, defaulting to `logos/`.
- Whether AI is configured.
- The next safe action.

It should not start with a full theory of profiles, phases, artifacts, agent packs, validation, and internal state. Those concepts should appear when they affect the user's next decision.

### Contextual Guidance

Contextual guidance should appear when the user is making or reviewing a decision:

- Explain why a question matters.
- Identify which document or phase the answer affects.
- Offer "unknown", "assume for now", "defer", and "revise" as valid paths.
- Show when a proposal is not yet confirmed.
- Warn when a choice affects generated outputs or validation claims.

### Ambient Guidance

Ambient guidance should help orientation without interrupting:

- Active repository.
- Active LOGOS documentation root.
- Active phase or document.
- Provider status.
- Document readiness.
- Open questions or blockers.
- Last generation result.

Ambient guidance should stay compact. It is a map, not the work itself.

### Explicit Guidance

Explicit guidance is appropriate when consequence, risk, or confusion is high:

- Before writing or overwriting files.
- Before sending context to a remote AI provider.
- When a generated document contains important assumptions.
- When diagnostics find a severe contradiction.
- When the user may be in the wrong directory.
- When the selected output root may collide with existing content.

### Advanced Guidance

Advanced guidance should support users who want to inspect or tune the system:

- Profile contracts.
- Output definitions.
- Derived artifact rules.
- Agent pack generation.
- Validation criteria.
- Root configuration.
- Provider configuration.

Advanced guidance should be discoverable through commands and status, not imposed during every normal intake turn.

### When to Suggest, Explain, Warn, Ask, or Stay Silent

The product should **suggest** when there is a clear next useful action but no serious consequence.

The product should **explain** when a question, state, output, or limitation may be confusing.

The product should **warn** when the user may lose work, overwrite files, send context remotely, misread validation, or act on low-confidence output.

The product should **ask** when user confirmation is needed to make a decision canonical, change output root, generate files, or accept an assumption with significant downstream impact.

The product should **stay silent** when extra guidance would repeat known information, interrupt focused writing, or pressure the user toward completion.

Guidance becomes unsafe when it pressures the user to decide, exaggerates risks to force action, hides alternatives, or treats engagement as a goal above clarity.

## Feedback Model

Feedback should prevent ambiguity about what happened, what changed, what remains incomplete, and what the user can do next. It should not overstate certainty or use completion language for partial progress.

| Action Type | Feedback Timing | Feedback Mode | Must Include | Should Persist |
| --- | --- | --- | --- | --- |
| Command accepted | Immediate | Ambient or inline | Command, recognized target, next state | No, unless it changes state |
| Workspace initialization | Immediate and persistent | Inline plus status | Repository path, LOGOS state path, documentation root | Yes |
| Documentation-root change | Immediate and persistent | Explicit | Old root, new root, affected outputs, confirmation status | Yes |
| AI provider configuration | Immediate and persistent | Explicit | Provider mode, token source redacted, remote/local implication | Yes |
| Intake answer captured | Immediate | Inline | Captured summary, proposed state changes, uncertainties | Until reviewed |
| Decision proposed | Immediate | Inline plus review state | Proposal, evidence basis, affected documents, confirmation options | Yes |
| Decision confirmed | Immediate and persistent | Inline plus status | Confirmed decision, affected documents, regeneration implication | Yes |
| Generation started | Immediate | Ambient progress | Target root, output categories, pending files | Until complete |
| Generation completed | Immediate and persistent | Report | Created, updated, skipped, incomplete, blocked, derived outputs | Yes |
| Diagnostics run | Immediate and persistent | Report | Findings, severity, affected documents, next action | Yes |
| Validation incomplete | Immediate and persistent | Report | Missing evidence, assumptions, unsupported claims | Yes |
| Low-confidence AI interpretation | Immediate | Inline | Confidence caveat, reason, review path | Until resolved |
| Error | Immediate | Explicit | What failed, preserved state, recovery path | Until resolved |

Feedback states must include:

- **Success:** The action completed and the resulting state is clear.
- **Pending:** The action is in progress and latency is expected.
- **Partial:** Some outputs or checks succeeded while others were skipped, incomplete, or blocked.
- **Failed:** The action did not complete and no hidden success should be implied.
- **Low confidence:** The system produced an interpretation that requires review.
- **Reversible:** The user can revise, regenerate, reconfigure, or rerun.

Interruptive feedback should be reserved for:

- Consent gates.
- Data movement.
- File overwrite or path collision.
- Severe contradiction.
- Blocked generation.
- Risk of false validation or false completion.

Feedback should not be interruptive for routine status, minor warnings, or repetitive reminders unless the user asks for stricter guidance.

## Error and Recovery Model

Errors are expected UX states. They should be surfaced without blame, with preserved context, and with a next safe action.

| Error Class | Example | User Impact | Recovery Path | State to Preserve |
| --- | --- | --- | --- | --- |
| User error | Running LOGOS from the wrong directory | Output may target the wrong repository | Show path, stop writes, ask for confirmation or exit | No generated writes before confirmation |
| Configuration error | AI provider missing or invalid | AI-led intake cannot continue | Route to `/config ai`, allow non-AI status and docs review where possible | Workspace and prior answers |
| Path or permission error | Cannot write to configured root | Generation blocked | Explain path, permission issue, and root configuration option | Proposed generation plan |
| Validation error | Required decision or evidence missing | Phase cannot be marked ready | List missing items by document and severity | Current decisions, assumptions, diagnostics |
| Network or provider error | Remote AI call fails or times out | Intake or drafting interrupted | Retry, switch provider mode, save partial state, continue later | User input and pre-call state |
| Data or state error | Missing workspace file or inconsistent state | Continuation may be confusing | Diagnose state, show missing/corrupt item, avoid destructive repair without confirmation | Readable existing state |
| AI confidence error | Interpretation may be wrong | User may accept a bad decision | Mark low confidence, ask for review, keep unconfirmed | Raw answer and proposed decision |
| Boundary error | User asks LOGOS to validate market truth or build the final product | Product may overpromise | Explain boundary, route to assumptions, validation plan, or downstream handoff | User intent and boundary note |
| Overwrite risk | Generated output would replace existing content | User may lose work | Show affected files and require confirmation or alternative root | Existing files and generation plan |

Recovery rules:

- The product must never blame the user for ambiguity, missing answers, wrong paths, or unknowns.
- Failed generation must report what was created, skipped, incomplete, blocked, or unchanged.
- Manual edits should not be overwritten without warning.
- Reconfiguration must show consequences before changing output root or provider behavior.
- Recovery should prefer the smallest next safe action, not a full restart.
- If an error exposes uncertainty about state integrity, the system must say so plainly.
- Destructive repair, overwrite, deletion, and remote transmission require explicit confirmation.

Undo and revision expectations:

- Proposed decisions must be reversible before confirmation.
- Confirmed decisions must be revisable, with affected documents and outputs identified.
- Generated canonical Markdown should be regenerable from structured state.
- Derived HTML artifacts and agent packs should be regenerable from canonical documents and profile contracts.
- Provider and documentation-root configuration should be reviewable and changeable, with path and output consequences disclosed.

## Proactivity Model

LOGOS should be mixed-proactive. It may notice useful next steps and prepare reviewable proposals, but it must not silently take ownership of decisions or consequential actions.

### Allowed Without Additional Confirmation

The system may:

- Suggest the next question cluster.
- Summarize current project state.
- Identify likely gaps or contradictions.
- Suggest `/generate`, `/diagnose`, `/validate`, `/status`, or `/config ai`.
- Prepare proposed decisions for review.
- Prepare draft document content before confirmation if it is clearly labeled as proposed or draft.
- Show that `logos/` is the default documentation root and can be configured.
- Report derived output categories expected from a document contract.

### Consent-Gated

The system must ask before it:

- Marks a major decision as confirmed.
- Writes or overwrites generated files.
- Changes the configured LOGOS documentation root.
- Sends project context to a remote AI provider.
- Treats an assumption as acceptable for generation.
- Regenerates outputs in a way that may replace previous generated content.
- Applies recovery that changes workspace state.

### Prohibited

The system must not:

- Confirm decisions on behalf of the user.
- Claim external validation without evidence.
- Send context remotely without configuration and disclosure.
- Overwrite manual work silently.
- Change the output root silently.
- Hide low confidence behind polished prose.
- Optimize for engagement, streaks, completion pressure, or lock-in.
- Treat derived HTML artifacts or agent packs as canonical.

### Deferred

These proactive behaviors require future validation before entering scope:

- Automatic generation after enough answers are collected.
- Background diagnostics while files change.
- Automatic issue or task creation.
- Hosted collaboration alerts.
- External research recommendations.
- Agent-to-agent orchestration based on generated packs.

Every proactive behavior must be explainable, dismissible, and recoverable. The user should always understand whether LOGOS is suggesting, preparing, asking, warning, or acting.

## Trust Model

Trust in LOGOS is earned through behavior, not tone. The product must make its boundaries, state, outputs, uncertainty, and consequences visible enough that the user can inspect and challenge them.

### Trust Mechanisms

**Local inspectability:** Project knowledge should live in local, predictable, text-based files whenever possible. The configured LOGOS documentation root defaults to `logos/` and can be changed by the user.

**Source-of-truth clarity:** Profile YAML defines document contracts and output definitions. Structured project state and confirmed decisions drive generation. Canonical Markdown is the human-readable rendered output. HTML artifacts and agent packs are derived outputs.

**Decision-state disclosure:** Proposed, confirmed, rejected, deferred, assumed, incomplete, and low-confidence states must remain distinguishable.

**Provider transparency:** AI provider mode, remote/local implication, and redacted token source must be understandable before AI-led operations that send context.

**Uncertainty handling:** Unsupported claims, founder-origin assumptions, validation gaps, and low-confidence interpretations must be visible in generated documents and diagnostics.

**Generated-output reporting:** Generation must report created, updated, skipped, incomplete, blocked, canonical, and derived outputs.

**Reversibility:** The user should be able to revise decisions, rerun diagnostics, regenerate outputs, and change configuration with clear consequences.

**No surprise data movement:** The product must not collect telemetry, phone home, or transmit project context without explicit configuration and disclosure under the current product boundary.

**No raw secrets in project files:** Provider tokens and sensitive runtime secrets must not be stored as raw project content.

### Trust-Breaking Behaviors

Trust breaks immediately if LOGOS:

- Writes to an unexpected folder.
- Sends project context remotely without disclosure.
- Presents assumptions as validated facts.
- Marks AI-inferred decisions as confirmed.
- Hides failed or partial generation.
- Overwrites manual content without warning.
- Stores raw provider tokens in project files.
- Makes derived outputs appear canonical.
- Uses manipulative pressure to force completion, upgrades, provider choice, or continued engagement.

### What Must Be Transparent by Default

- Active repository path.
- Active LOGOS documentation root.
- Active profile.
- Current phase or document focus.
- AI provider status.
- Whether content is proposed, confirmed, assumed, incomplete, or generated.
- Whether an output is canonical or derived.
- Whether a diagnostic is blocking, warning, or informational.
- Whether external validation exists or is missing.

## UX Anti-Patterns

| Anti-Pattern | Why It Is Harmful | Violates | Early Signal |
| --- | --- | --- | --- |
| Fake completeness | Makes users act on documents that hide missing decisions or evidence. | Explicit Over Assumed, Safe by Default | Generated docs lack assumptions, gaps, or open questions. |
| Generic chatbot drift | Turns LOGOS into conversation without durable project state. | AI as a Layer, Structure Over Presentation | Important decisions only exist in chat. |
| Deterministic questionnaire burden | Makes users feel they are filling forms instead of being guided through thinking. | Calm Rigor, Conversation-Led State | Intake requires long fixed question lists before value. |
| Autonomous authority | Transfers user-owned decisions to AI. | User agency, AI as a Layer | AI marks inferred choices as confirmed. |
| Hidden remote provider | Breaks local trust and consent. | Local First, Safe by Default | AI calls occur before provider disclosure. |
| Hardcoded existing-docs output | Collides with repository-owned documentation and ignores configurability. | Local Trust, Git Friendly | Generated LOGOS files assume a repository documentation folder instead of defaulting to `logos/` or the user-configured root. |
| Presentation-as-truth | Lets polished HTML or agent packs appear more authoritative than canonical content. | Structure Over Presentation | Derived artifacts are edited or cited as source of truth. |
| Question flood | Overwhelms users during ambiguity. | Cognitive load rules | The system asks many unrelated questions at once. |
| Shame around uncertainty | Pressures users into false answers. | Safe by Default, Uncertainty Is Useful | "Unknown" is framed as failure. |
| Manipulative retention | Optimizes for continued use instead of clarity. | User agency | Streaks, pressure copy, artificial urgency, or lock-in appear. |
| Dashboard creep | Pulls the product toward generic project management. | Product Boundaries | Task boards, calendars, and reporting displace clarification. |
| Overwrite surprise | Destroys trust and local control. | Recoverable Progress, Local Trust | Files change without path, diff, or confirmation awareness. |
| Vague diagnostics | Produces anxiety without action. | Calm Rigor, Feedback Model | Findings lack severity, affected document, or next step. |

## Downstream Handoff

### Information Architecture

Information Architecture must organize the product around repository context, configured LOGOS documentation root, profile, phase, document state, decisions, assumptions, risks, open questions, diagnostics, and output categories. It must not organize the product primarily around a chat transcript or a generic dashboard.

IA must preserve the distinction between:

- Internal workspace state.
- Canonical Markdown outputs.
- Derived HTML artifacts.
- Derived agent packs.
- Configuration.
- Diagnostics and validation status.

### UI Model

UI Model must make the following visible enough for normal orientation:

- Active repository.
- Active documentation root.
- Active profile.
- Provider status.
- Current document or phase.
- Next useful action.
- Decision status.
- Generation result.
- Diagnostics severity.

UI Model must avoid detailed visual decisions in this document but inherit the UX requirement that critical consequence information must not be hidden.

### Interaction Model

Interaction Model must define:

- Natural language intake behavior.
- Slash command behavior.
- Decision proposal, review, confirmation, revision, and deferral.
- Generation confirmation and reporting.
- Diagnostics and validation flows.
- Configuration flows for documentation root and AI provider.
- Error recovery and continuation flows.

It must preserve the difference between suggestion, preparation, confirmation, and execution.

### Content Model

Content Model must define language and structure for:

- Proposed decisions.
- Confirmed decisions.
- Assumptions.
- Unknowns.
- Open questions.
- Risks.
- Evidence gaps.
- Low-confidence interpretations.
- Derived-output disclaimers.
- Generated-file reports.
- Recovery instructions.

It must avoid brand-like confidence when evidence is missing.

### State Model

State Model must preserve:

- Raw user input when needed for review.
- Proposed decisions.
- Confirmed decisions.
- Rejected and deferred decisions.
- Assumptions.
- Open questions.
- Risks.
- Diagnostic findings.
- Active profile.
- Active documentation root.
- Provider configuration status without raw tokens.
- Generated output status.
- Relationships between canonical and derived outputs.

State Model must support interruption, continuation, revision, regeneration, and partial failure.

### Permission Model

Permission Model must define consent gates for:

- Initializing workspace state.
- Writing files.
- Overwriting files.
- Changing the documentation root.
- Sending context to remote AI providers.
- Storing provider configuration.
- Running recovery that changes local state.

Permission Model must keep local-first defaults and must not assume telemetry or remote storage.

### Feature Specification

Feature Specification must convert this UX model into concrete MVP behavior without expanding scope into hosted collaboration, project management, automatic external research, or final-product generation. Features must be testable against agency, uncertainty, recovery, and local trust.

### Acceptance Criteria

Acceptance Criteria must include:

- User can see active repository and documentation root before generation.
- User can accept or configure `logos/` as the default generated documentation root.
- User can distinguish proposed and confirmed decisions.
- User can say "unknown" without blocking all progress.
- Generated reports distinguish canonical Markdown, HTML artifacts, and agent packs.
- Derived outputs are not presented as canonical.
- Remote AI behavior is disclosed before context is sent.
- Errors preserve state and provide recovery paths.
- Diagnostics include severity, affected document, and next action.
- Generated documents preserve assumptions and validation caveats.

### Engineering Brief

Engineering must implement local, inspectable, Git-friendly behavior that supports the UX model. Technical architecture should not create hidden state, hidden remote dependencies, raw token storage, opaque generated artifacts, or irreversible file writes that contradict the trust and recovery model.

### Unresolved UX Questions

These questions must be carried forward:

- How much guidance creates first value before it becomes too much ceremony?
- Do users understand and accept `logos/` as the default documentation root?
- How much decision review is enough to preserve agency without slowing flow too much?
- How should diagnostics balance severity against encouragement?
- How much AI provider disclosure is necessary before it becomes noisy?
- Are HTML artifacts and agent packs understood as useful derived outputs or confusing extra surface area?
- Does repeat use happen naturally when decisions change, or does the product feel one-shot?
- Can non-founder users understand the mental model without direct personal context from the founder's original experience?
