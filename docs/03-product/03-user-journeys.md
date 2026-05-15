# User Journeys

## Journey Overview

This document maps how the user moves through LOGOS Engine from trigger to value, failure, recovery, completion, and re-entry. The journeys are product hypotheses grounded in the founder-origin Product Brief, Product Scope, Foundation principles, and Validation constraints. They must not be read as externally validated user behavior.

The journey system centers on one primary journey: a technical or product-adjacent builder starts from an ambiguous project idea, opens LOGOS Engine from the target repository, configures or accepts the LOGOS documentation root, uses AI-led clarification to produce structured state, reviews proposed decisions, generates canonical documents and derived outputs, runs diagnostics, and leaves with clearer next steps.

The key journeys are:

| Journey | Classification | User Goal | Entry Point | Relationship |
| --- | --- | --- | --- | --- |
| Primary clarification journey | MVP / validation-required | Turn ambiguous intent into reviewable decisions and documentation. | User opens `logos` in the target repository. | Core journey that must preserve the product promise. |
| Onboarding journey | MVP | Set up enough local context, profile, documentation root, and AI configuration to begin. | First run or uninitialized workspace. | Precedes primary journey. |
| First value journey | MVP / validation-required | Discover a meaningful missing decision, assumption, or gap and see it reflected in generated outputs. | During or after first intake and generation. | Confirms whether the product promise is visible. |
| Continue existing session | MVP | Resume incomplete clarification without losing context. | Existing LOGOS workspace. | Supports primary and repeat use. |
| Generate and review outputs | MVP | Produce canonical Markdown, HTML artifacts, and agent packs under the configured LOGOS root. | `/generate` or generation prompt. | Turns structured state into reviewable outputs. |
| Diagnostics and validation | MVP / validation-required | Understand missing decisions, contradictions, risks, and next useful actions. | `/diagnose`, `/validate`, `/status`, or after generation. | Supports first value, recovery, and completion. |
| Decision revision | MVP support / validation-required | Change a decision and understand affected documents or gaps. | User revisits a decision. | Supports repeat use and living documentation. |
| Provider configuration | MVP support | Enable AI-led intake safely and explicitly. | `/config ai` or blocked AI operation. | Supports onboarding and recovery. |
| Documentation-root configuration | MVP support | Choose where LOGOS writes generated documentation. | First run, `/init`, or settings. | Prevents collision with existing project docs. |
| Repeat use | validation-required | Return when decisions change, documents need refresh, or a project reaches another clarity checkpoint. | Existing workspace with prior state. | Tests whether LOGOS is living documentation, not one-shot output. |
| Hosted collaboration | deferred | Coordinate with other users in a shared workspace. | Not in MVP. | Excluded until validated. |
| External research automation | deferred | Pull market or external evidence automatically. | Not in MVP. | Excluded until provenance and privacy are validated. |

Journeys required for the core product promise to hold are onboarding, primary clarification, first value, output generation, diagnostics, continuation, and safe recovery from common failures.

## Primary Journey

**ID:** J-001.

**Title:** Clarify an Ambiguous Project Into Reviewable Documentation.

**Classification:** MVP / validation-required.

**User:** Founder-origin technical or product-adjacent builder working in a local repository.

**Trigger:** The user is about to build, scope, validate, hand off, or revisit a project and realizes the idea is not clear enough to guide real work.

**Entry state:** The user has a target repository, an ambiguous project idea, and may already have unrelated project documentation in `docs/`. LOGOS may or may not be initialized.

**User goal:** Produce a coherent local documentation foundation that exposes decisions, assumptions, gaps, risks, and next steps before execution.

**Preconditions:**

- The user can run `logos` from the target repository directory.
- LOGOS can initialize or load local workspace state.
- The user can select or use the initial Standard profile.
- The LOGOS documentation root defaults to `logos/` and can be configured.
- AI provider access is configured, or the user can enter provider configuration before AI-led intake.

### Steps

| Step | User Action | System Response | Visible Feedback | State Change | Decision Point | Risk | Recovery Option |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Opens `logos` from the target repository. | Detects current repository context and workspace status. | Shows initialized or uninitialized state. | Loads or prepares workspace metadata. | Continue, initialize, or configure. | Wrong directory. | Show path and require confirmation before writing. |
| 2 | Starts `/init` or continues an existing workspace. | Creates or loads LOGOS workspace state. | Shows active profile, documentation root, and status. | Workspace state becomes active. | Accept default root or configure another. | Collision with existing docs expectations. | Explain `logos/` default and allow root configuration. |
| 3 | Selects or confirms the initial Standard profile. | Loads document contracts, phases, completion criteria, and output definitions. | Shows profile and phase coverage. | Profile context becomes active. | Confirm profile fit or defer. | Profile feels too broad. | Mark profile fit as assumption and continue with caveat. |
| 4 | Configures AI or confirms existing provider setup. | Checks provider configuration shape and disclosure. | Shows local or remote provider mode and redacted token source. | AI capability becomes enabled or blocked. | Use configured provider, configure later, or stop intake. | Remote transmission confusion. | Explain what may be sent and allow local/provider alternatives. |
| 5 | Describes the project in natural language. | AI asks a small set of context-aware questions. | Shows why questions matter and accepts unknowns. | Raw answer, summary, assumptions, and open questions are stored. | Answer, skip, or mark assumption. | Too many questions or unclear purpose. | Ask fewer questions and show next useful reason. |
| 6 | Answers, says "I do not know", accepts/edits a contextual suggestion, or asks the system to assume. | Interprets answers into proposed decisions, assumptions, risks, and gaps. | Shows captured content, proposed updates, and source/caveat labels for suggestions. | Proposed decision state changes; contextual suggestions remain non-canonical until accepted into the normal flow. | Confirm, revise, reject, ignore, or defer proposals and suggestions. | AI sounds authoritative. | Keep proposals and suggestions visibly unconfirmed. |
| 7 | Reviews proposed decisions. | Records confirmed, revised, rejected, or deferred decisions. | Shows decision status and affected documents. | Decision registry becomes more explicit. | Continue intake or generate documents. | User accepts without review. | Require clear decision-state language. |
| 8 | Requests generation or accepts a generation prompt. | Renders canonical Markdown under the configured LOGOS root and derived HTML/agent outputs. | Shows created, updated, skipped, incomplete, and blocked outputs. | Canonical and derived outputs are refreshed. | Review outputs or run diagnostics. | Generated text hides uncertainty. | Preserve assumptions, gaps, and caveats in outputs. |
| 9 | Runs `/diagnose`, `/validate`, or checks status. | Evaluates gaps, contradictions, incomplete areas, and affected documents. | Shows findings by severity and next suggested action. | Diagnostic state is recorded or displayed. | Continue, revise decisions, stop, or defer. | Diagnostics feel noisy. | Route findings to specific next questions. |
| 10 | Reviews documents and next steps. | Keeps local files inspectable and versionable. | User sees clearer project state and unresolved work. | Project has reviewable local outputs. | Commit, edit, continue later, or run validation research. | User mistakes output for validation. | Keep Validation caveats visible. |

**Success state:** The user can name what has been decided, what is assumed, what remains unclear, and which generated documents can guide the next validation or execution step.

**Failure modes:**

- User runs LOGOS from the wrong directory.
- User does not understand why output defaults to `logos/`.
- AI provider is not configured or remote transmission is unclear.
- AI proposals look like confirmed decisions.
- The generated documents read as polished but not traceable.
- Diagnostics are vague or overwhelming.
- User expects market validation or implementation output.

**Recovery paths:**

- Show active repository path and require confirmation before initialization.
- Explain and allow configuration of the LOGOS documentation root.
- Route missing AI setup to `/config ai`.
- Keep proposed decisions visibly separate from confirmed decisions.
- Mark incomplete documents and preserve validation caveats.
- Turn diagnostics into the next smallest useful question cluster.

**Abandonment path:** The user can save and exit with current answers, assumptions, open questions, and partial outputs preserved. Abandonment must not punish uncertainty.

**Re-entry path:** The user reopens `logos` from the same repository, sees workspace status, resumes the current phase, reviews unresolved questions, and continues from preserved state.

**Persisted state:** Workspace metadata, configured LOGOS documentation root, profile, answers, assumptions, proposed decisions, confirmed decisions, open questions, risks, diagnostics, contextual suggestion status where useful, canonical documents, HTML artifacts, and agent packs.

**Evidence basis:** Product Brief, Product Scope, Audience Definition, Foundation Boundaries, old TUI and AI docs. No external behavior evidence yet.

**Open questions:**

- Will users understand the difference between workspace state, canonical documents, HTML artifacts, and agent packs?
- Will users tolerate AI provider setup before first value?
- Is `logos/` the right default documentation root?
- How much decision review is useful before it feels heavy?

## Secondary Journeys

### J-002: Continue an Existing Session

**Classification:** MVP.

**Trigger:** The user has previously initialized LOGOS and returns after a break, unfinished intake, changed decision, or incomplete document generation.

**User goal:** Resume without reconstructing prior context.

**Steps:**

1. User opens `logos` from the target repository.
2. System detects existing workspace state, configured documentation root, profile, document status, and unresolved items.
3. System shows an AI Startup Briefing with current status, relevant unresolved decisions, pending proposals, diagnostics, generation status, and the recommended next step.
4. User runs `/continue`, accepts the recommended next action, or types naturally into the conversation.
5. System summarizes current progress, unresolved decisions, and next useful questions, optionally including source-labeled contextual suggestions when a question directly depends on prior state.
6. User continues intake, reviews proposed decisions, regenerates outputs, or runs diagnostics.

**Success state:** The user can continue from the latest meaningful state without rereading every document or manually running `/status` first.

**Failure modes:** stale context, missing files, changed documentation root, uncommitted manual edits, or confusing progress status.

**Recovery paths:** deterministic status fallback, show changed paths, report missing outputs, avoid overwriting manual content without warning, and identify the next smallest continuation step.

**Re-entry:** This is itself the re-entry journey for interrupted work.

### J-003: Configure Documentation Root

**Classification:** MVP support / validation-required.

**Trigger:** First initialization, existing `docs/` folder, user preference for another output folder, or path conflict.

**User goal:** Know where LOGOS will write files and avoid colliding with existing project documentation.

**Steps:**

1. System proposes `logos/` as the default LOGOS documentation root.
2. System explains that this avoids assuming the repository's `docs/` folder is available.
3. User accepts `logos/` or configures another root.
4. System shows the resolved canonical Markdown, HTML artifact, and agent pack locations.
5. User confirms before files are created or refreshed.

**Success state:** The user understands and trusts where generated LOGOS files will live.

**Failure modes:** user expects `docs/`, chooses an unsafe path, selects an existing folder with conflicting content, or forgets where output was configured.

**Recovery paths:** path disclosure, collision warnings, confirmation before writing, and status display of active root.

**Deferred questions:** Whether users prefer `logos/`, `.logos/docs`, custom paths, or a different naming convention is unvalidated.

### J-004: Configure AI Provider

**Classification:** MVP support.

**Trigger:** User starts AI-led intake without configured AI, changes provider, or wants to inspect remote transmission behavior.

**User goal:** Enable AI-led clarification without hidden provider behavior or token risk.

**Steps:**

1. User runs `/config ai` or reaches an AI-required step.
2. System shows current AI status and available provider modes.
3. User selects local, remote, mock, fixture, or custom-compatible configuration where supported.
4. System records non-secret configuration and redacted token source.
5. System discloses remote transmission boundaries before AI operations.
6. User returns to intake.

**Success state:** AI is available for intake, and the user understands provider boundaries.

**Failure modes:** missing token, provider timeout, remote privacy concern, unsupported provider, or setup friction.

**Recovery paths:** local-only operational mode, provider test, redacted config display, and clear blocking message for AI-led intake.

### J-005: Generate and Review Outputs

**Classification:** MVP.

**Trigger:** User has enough structured state to render or refresh documents, or wants to inspect current output.

**User goal:** Turn structured state into canonical Markdown and derived outputs without hiding uncertainty.

**Steps:**

1. User runs `/generate` or accepts generation after an intake round.
2. System resolves the configured LOGOS documentation root.
3. System renders canonical Markdown documents from available state.
4. System generates HTML artifacts and agent packs from canonical documents and profile contracts.
5. System reports created, updated, skipped, incomplete, and blocked outputs.
6. User reviews documents, artifacts, agent packs, or diagnostics.

**Success state:** Outputs are useful, local, reviewable, and visibly caveated.

**Failure modes:** output path confusion, overwrite risk, generic prose, stale derived artifacts, or false completeness.

**Recovery paths:** generated-file report, manual-content warning, incomplete markers, regeneration from canonical sources, and diagnostics.

### J-006: Diagnose Gaps and Validate Readiness

**Classification:** MVP / validation-required.

**Trigger:** User wants to know what is missing, whether a phase is ready, or why documents feel incomplete.

**User goal:** Understand gaps, risks, contradictions, and next actions.

**Steps:**

1. User runs `/diagnose`, `/validate`, or `/status`.
2. System checks profile criteria, available state, confirmed decisions, assumptions, open questions, and generated documents.
3. System groups findings by severity.
4. System names affected documents and recommends next questions or decisions.
5. User chooses whether to continue, revise, defer, or stop.

**Success state:** The user knows the next decision or question that matters.

**Failure modes:** noisy diagnostics, vague severity, false blocking, or hidden contradiction.

**Recovery paths:** explain severity, allow progress with warnings where safe, and route each finding to a concrete next action.

### J-007: Revise a Decision

**Classification:** MVP support / validation-required.

**Trigger:** User changes their mind, learns something new, or detects inconsistency in generated docs.

**User goal:** Update project direction without losing traceability.

**Steps:**

1. User edits or revises a decision through the product flow.
2. System records the new status and preserves prior context where appropriate.
3. System identifies affected documents, assumptions, risks, and derived outputs.
4. User confirms the change.
5. System recommends regeneration and validation.

**Success state:** The changed decision and its downstream implications are visible.

**Failure modes:** overwritten confirmed decision, unclear impact, stale documents, or hidden contradiction.

**Recovery paths:** confirmation, affected-document report, regeneration, and diagnostic rerun.

### J-008: Use Agent Pack for Downstream Review

**Classification:** MVP support / validation-required for usefulness.

**Trigger:** User wants an AI or coding agent to review, critique, or use compact project context.

**User goal:** Provide an agent with grounded context without relying on private chat history.

**Steps:**

1. User generates or refreshes agent packs.
2. System builds packs from canonical documents and document contracts.
3. User opens or passes an agent pack to a reviewer or downstream tool.
4. Agent uses the pack with caveats and source context.

**Success state:** The agent pack is compact, grounded, and preserves assumptions and validation limits.

**Failure modes:** pack omits caveats, becomes stale, is treated as source of truth, or includes too much context.

**Recovery paths:** regenerate from canonical documents, label pack as derived, and include review rules.

## Onboarding Journey

**ID:** J-009.

**Classification:** MVP.

**Trigger:** New user starts LOGOS in a repository for the first time.

**Entry state:** The repository may contain source code, notes, existing `docs/`, or no documentation. LOGOS state may not exist.

**User goal:** Understand what LOGOS will do, where it will write files, what setup is required, and how to reach first value.

### Steps

1. User runs `logos` from the target repository.
2. System shows that LOGOS works locally and writes generated documentation under a configurable root.
3. System proposes `logos/` as the default root and explains that this avoids colliding with existing project `docs/`.
4. User accepts the root or configures another one.
5. System initializes workspace state and selected profile.
6. System checks AI provider readiness.
7. If AI is missing, user configures AI or exits with clear setup guidance.
8. System starts the first AI-led clarification round.

**Required setup:** repository directory, LOGOS documentation root, selected profile, and AI provider for normal intake.

**Deferrable setup:** advanced provider tuning, non-MVP exports, collaboration, external research, and economic configuration.

**Time-to-first-value assumption:** The user should reach first value after a small intake round and either a proposed decision, a surfaced gap, or a generated initial document section. No numeric target is validated.

**Abandonment path:** If setup feels too heavy, the user can exit after workspace/root configuration or provider guidance. The system should preserve any completed setup and make re-entry clear.

**Return after abandonment:** Reopening `logos` should show what is configured, what is missing, and the next smallest step.

**Onboarding risks:**

- The user does not understand why LOGOS uses `logos/`.
- AI provider configuration blocks first value.
- The product explains too much before producing value.
- The user expects LOGOS to build the final product or perform market validation.

## First Value Journey

**ID:** J-010.

**Classification:** MVP / validation-required.

**First value definition:** The first meaningful value occurs when the user sees a concrete missing decision, assumption, risk, contradiction, or clearer project statement that they did not have explicitly before, and that insight is reflected in structured state or generated documentation.

First value is not merely:

- opening the TUI;
- initializing a workspace;
- configuring AI;
- generating a long document;
- seeing polished prose;
- producing HTML artifacts or agent packs.

### Minimum Conditions

- User provides enough project context for the system to ask useful questions.
- AI output remains visibly proposed or incomplete until reviewed.
- The system captures at least one decision, assumption, open question, risk, or gap.
- The user can see how that captured item affects a document, diagnostic, or next step.

### Journey

1. User states the ambiguous project idea.
2. System asks a small set of purposeful questions.
3. User answers or marks uncertainty.
4. System surfaces captured content, proposed decisions, assumptions, risks, and open questions.
5. User recognizes at least one useful clarification.
6. System generates or updates canonical Markdown and derived outputs.
7. User reviews output and sees unresolved work rather than fake completion.

**Success signal:** The user can say something like, "I know what I still need to decide," and can point to the generated or structured evidence.

**False value signals:**

- The user praises polish without identifying clearer decisions.
- The generated document hides uncertainty.
- The user believes the project has been externally validated.
- The output feels complete because it is long.

**Open questions:**

- How much intake is required before first value?
- Which first value is strongest: proposed decision, diagnostic gap, generated document, or risk exposure?
- Does the user need HTML or agent packs before first value, or are they supporting outputs?

## Repeat Use Journey

**ID:** J-011.

**Classification:** validation-required / MVP support.

**Trigger:** The user returns because a decision changed, new information appeared, a document needs refresh, diagnostics remain unresolved, or the project reaches a new phase.

**User goal:** Continue from prior state and keep documentation aligned with current decisions.

### Steps

1. User opens `logos` from the target repository.
2. System loads workspace state, configured documentation root, profile, progress, and unresolved items.
3. System shows what changed or remains incomplete.
4. User continues intake, revises a decision, runs diagnostics, or regenerates outputs.
5. System updates canonical documents and derived artifacts.
6. User uses refreshed outputs to guide validation, product planning, engineering planning, or agent context.

**Persisted state:** repository path expectation, LOGOS documentation root, profile, answers, assumptions, decisions, open questions, risks, diagnostics, canonical Markdown, HTML artifacts, and agent packs.

**Repeated value should come from:**

- living decision state;
- ability to revise and regenerate;
- diagnostics after changes;
- traceable impact across documents;
- better downstream handoff.

**Repeat use must not depend on:**

- lock-in;
- novelty;
- notifications for their own sake;
- document volume;
- hidden hosted state.

**Failure modes:** user treats LOGOS as one-time document generation, forgets where output lives, finds state stale, or sees no reason to return after first output.

**Recovery paths:** clear status, unresolved question list, affected-document report, and prompt to regenerate after decision changes.

## Failure and Recovery Journeys

Failure paths are first-class because the product promise depends on trust, state continuity, and visible uncertainty.

### FR-001: Wrong Repository

**Failure:** User runs `logos` from a directory that is not the intended target repository.

**Detection:** Workspace state missing, unexpected path, Git context mismatch, or user confirmation mismatch.

**Risk:** Files are generated in the wrong place.

**Recovery:** Show current path, configured LOGOS documentation root, and require confirmation before initialization or generation.

### FR-002: Documentation Root Confusion

**Failure:** User expects output in `docs/`, does not understand `logos/`, or configures a path that conflicts with existing content.

**Detection:** User questions output location, selects existing folder, or cannot find generated files.

**Risk:** Loss of trust, accidental overwrite, or abandonment.

**Recovery:** Explain default `logos/`, show resolved output paths, warn on conflicts, and support configuration.

### FR-003: AI Provider Missing or Unsafe

**Failure:** Normal AI-led intake cannot proceed because no provider is configured, token source is missing, provider fails, or remote disclosure is unclear.

**Detection:** AI operation blocked or provider test fails.

**Risk:** User cannot reach first value or unknowingly sends context remotely.

**Recovery:** Route to `/config ai`, show local/remote distinction, redact tokens, and allow non-AI operational tasks where useful.

### FR-004: AI False Authority

**Failure:** Proposed decisions or generated text appear confirmed.

**Detection:** User treats AI suggestion as final or cannot distinguish proposed, assumed, unknown, and confirmed states.

**Risk:** The product creates false certainty.

**Recovery:** Use explicit decision status, require confirmation, preserve assumptions, and flag low-confidence claims.

### FR-005: Generated Output Hides Uncertainty

**Failure:** Canonical Markdown, HTML artifacts, or agent packs look complete while critical assumptions or gaps remain.

**Detection:** Diagnostics disagree with document confidence, reviewer cannot trace claims, or outputs omit caveats.

**Risk:** Polished output over real clarity.

**Recovery:** Mark incomplete sections, include evidence basis and open questions, regenerate derived outputs from canonical documents.

### FR-006: Manual Content or Local Files at Risk

**Failure:** Generation would overwrite manual edits or collide with existing files.

**Detection:** changed file timestamps, diff conflict, path collision, or configured root conflict.

**Risk:** Loss of user work.

**Recovery:** Report created/updated/skipped files, warn before overwrite, preserve manual content where product rules allow, and keep diffs reviewable.

### FR-007: Diagnostics Are Noisy

**Failure:** Diagnostics list too many vague gaps or block progress unnecessarily.

**Detection:** User cannot choose a next step or dismisses diagnostics as generic.

**Risk:** Useful friction becomes bureaucracy.

**Recovery:** Group by severity, explain affected documents, and recommend the next smallest useful question or decision.

### FR-008: User Abandons Mid-Flow

**Failure:** User exits during setup, intake, review, generation, or diagnostics.

**Detection:** incomplete workspace state or unresolved session.

**Risk:** Lost momentum.

**Recovery:** Save partial state, show next step on re-entry, and avoid treating incomplete answers as failure.

## Exit and Completion Journeys

### Completion After First Documentation Pass

**User signal:** The user has completed enough intake, review, generation, and diagnostics to know what has been decided, what remains assumed, and what next action is recommended.

**System signal:** Canonical documents and derived outputs are generated or marked incomplete, diagnostics have no hidden critical blockers, and unresolved questions are visible.

**Saved state:** decisions, assumptions, open questions, risks, diagnostics, generated outputs, configured root, provider config metadata, and profile status.

**What should not happen:** The product must not imply that the project, market, audience, pricing, or business model is validated.

### Pause or Save-and-Continue

The user may pause at any time. The product should preserve state, show incomplete work, and make re-entry obvious.

**Re-entry after pause:** User opens `logos`, sees the active repository, documentation root, status, unresolved items, and suggested next action.

### Abandonment

The user may abandon because setup is too heavy, AI configuration is blocked, questions feel excessive, output feels generic, or the problem is not urgent.

The product should not shame abandonment. It should preserve safe state and make clear what has and has not been completed.

### Completion After Decision Change

After a revised decision, completion means affected documents and derived outputs are refreshed or explicitly marked stale, and diagnostics identify remaining impact.

### Exit to Downstream Work

The user exits to validation, product planning, engineering planning, client scoping, or agent-assisted review.

The product should provide grounded outputs, not claim that downstream work is risk-free.

## Journey Risks

| Risk | Affected Journey | Risk Type | Likelihood | Impact | Early Signal | Mitigation | Owner or Target Document |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User runs LOGOS in the wrong directory. | Primary, onboarding | state / data | medium | high | User is surprised by generated paths. | Show repository path and require confirmation before writing. | Interaction Model, Acceptance Criteria |
| `logos/` default is unclear or disliked. | Onboarding, documentation-root configuration | setup / trust | unknown | medium | User expects output in `docs/` or cannot find files. | Explain default, show resolved paths, allow configuration. | UX Model, Functional Requirements |
| AI provider setup blocks first value. | Onboarding, primary | dependency / drop-off | medium | high | User exits before intake. | Route to clear provider setup and support local options. | Interaction Model, Non-Functional Requirements |
| AI proposals look confirmed. | Primary, first value | trust / authority | medium | high | User accepts without review. | Distinguish proposed, assumed, unknown, and confirmed states. | Interaction Model, State Model, Acceptance Criteria |
| Generated docs hide uncertainty. | Generate outputs, first value | trust / clarity | medium | high | Reviewer cannot find assumptions or evidence basis. | Include caveats, open questions, and diagnostics. | Functional Requirements, Acceptance Criteria |
| Diagnostics overwhelm the user. | Diagnostics | drop-off / confusion | medium | medium | User cannot choose next action. | Group by severity and recommend one next step. | UX Model, Interaction Model |
| Derived outputs become source of truth. | HTML artifacts, agent packs | state / traceability | medium | medium | User edits or cites derived output over canonical Markdown. | Label derived outputs and regenerate from canonical sources. | Product Architecture, Acceptance Criteria |
| User treats output as validation. | First value, completion | false success | high | high | User claims demand, pricing, or market fit from generated docs. | Preserve Validation caveats and evidence status. | Product Brief, GTM Brief |
| Repeat use does not happen. | Repeat use | retention | unknown | high | User uses LOGOS once and never returns after decisions change. | Test re-entry triggers and decision-change workflows. | Validation, Product Scope |
| Manual edits are overwritten. | Generate outputs, decision revision | data integrity | medium | high | User loses local edits. | Warn, skip, preserve, or require confirmation. | Functional Requirements, Engineering Brief |

## Downstream Handoff

User Stories should inherit the journey triggers, user goals, success states, failure modes, and recovery paths. Stories must include uncertainty handling, decision review, documentation-root configuration, provider setup, generation, diagnostics, and continuation.

Information Architecture should organize concepts around repository workspace, LOGOS documentation root, profile, phase, document, decision, assumption, open question, risk, diagnostic, canonical output, HTML artifact, and agent pack.

UX Principles should preserve useful friction, visible uncertainty, clear decision states, graceful abandonment, re-entry, and explicit path disclosure.

UI Principles should support status visibility, generated-file reporting, decision review states, diagnostic severity, provider disclosure, and documentation-root confirmation without turning journey mapping into screen layout.

Interaction Model should define slash command behavior, normal conversational input, confirmation flows, skip/assumption behavior, path warnings, generation feedback, diagnostics, recovery, and re-entry.

State Model should inherit persisted state requirements: workspace metadata, configured documentation root, profile, intake session, answers, proposed decisions, confirmed decisions, assumptions, open questions, risks, diagnostics, canonical documents, derived outputs, and stale/updated status.

Permission Model should address local filesystem writes, provider configuration, remote transmission disclosure, token handling, and confirmation before destructive or overwrite-prone actions.

Feature Specification should expand journey-level capabilities into precise behavior for initialization, continuation, provider configuration, AI-led intake, decision review, document generation, HTML artifact generation, agent pack generation, diagnostics, validation, and status.

Acceptance Criteria should verify that users can:

- initialize from the target repository;
- understand and configure the LOGOS documentation root;
- reach first value without false certainty;
- distinguish proposed, assumed, unknown, and confirmed decisions;
- generate canonical and derived outputs with caveats preserved;
- recover from provider, path, generation, and diagnostic failures;
- pause and re-enter without losing context.

Unresolved journey questions must be carried forward:

- Is `logos/` the right default documentation root?
- What is the smallest intake round that reliably creates first value?
- How much decision review is enough without creating process fatigue?
- Which failures should block progress versus warn and continue?
- Do HTML artifacts and agent packs help before the core Markdown journey is trusted?
- What repeat-use trigger is real: decision changes, diagnostics, document refresh, phase progression, or downstream agent work?
