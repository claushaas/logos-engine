# Glossary of Terms

This glossary controls the meaning of recurring terms across the Foundation documents. Definitions are project-specific: they constrain how terms should be read, generated, reviewed, and reused downstream.

## Canonical Terms

### Agent Pack

**Status:** canonical.

**Definition:** A derived execution-oriented artifact that packages canonical project context for an AI or coding agent. An agent pack is not a source of truth; it must be generated from canonical documents, structured state, and document contracts.

**Used in:** Thesis, Principles, Boundaries, Success Definition, downstream Engineering and Product documents.

**Aliases:** agent-ready brief, execution prompt, implementation prompt.

**Discouraged terms:** autonomous agent plan, AI source of truth.

**Not to be confused with:** AI as a Layer, derived artifact, implementation plan.

**Decision relevance:** Agent packs may help execution only after project reasoning is structured and reviewable.

### AI as a Layer

**Status:** canonical.

**Definition:** The principle that AI assists with questioning, interpretation, synthesis, drafting, diagnosis, and review while remaining bounded by canonical structure, user confirmation, and traceability.

**Used in:** Principles, Boundaries, Success Definition, AI behavior documents.

**Aliases:** AI reasoning layer, AI-assisted workflow.

**Discouraged terms:** autonomous AI, AI owner, AI source of truth.

**Not to be confused with:** autonomous agent, deterministic structure, provider.

**Decision relevance:** AI output must be reviewed, grounded, and never silently converted into confirmed project truth.

### Ambiguous Intent

**Status:** canonical.

**Definition:** A starting project idea that contains enough direction to begin discussion but not enough explicit decisions to guide execution safely.

**Used in:** Thesis, Problem Definition, Audience Definition, Success Definition.

**Aliases:** unclear intent, diffuse intent, vague idea.

**Discouraged terms:** bad idea, invalid idea.

**Not to be confused with:** open question, assumption, problem statement.

**Decision relevance:** Ambiguous intent is the input state LOGOS Engine is designed to clarify.

### Assumption

**Status:** canonical.

**Definition:** A statement accepted temporarily for planning even though it has not been validated as fact. An assumption must remain visible and reviewable.

**Used in:** all Foundation documents, validation, diagnostics, decision registry, generated documents.

**Aliases:** planning assumption, unvalidated assumption.

**Discouraged terms:** fact, confirmed truth, evidence.

**Not to be confused with:** hypothesis, confirmed decision, open question.

**Decision relevance:** Assumptions can support progress, but they must not be treated as validated facts.

### Canonical Document

**Status:** canonical.

**Definition:** A human-readable Markdown document that carries approved or reviewable project content for a defined document purpose. It is generated under the configured LOGOS documentation root, which defaults to `logos/`. It is source material for derived outputs, but it should still reflect structured decisions rather than replace them.

**Used in:** Thesis, Principles, Boundaries, Success Definition, documentation registry.

**Aliases:** canonical Markdown, canonical content.

**Discouraged terms:** final document, static document, presentation artifact.

**Not to be confused with:** derived artifact, document contract, decision registry.

**Decision relevance:** Canonical documents are the primary review surface for humans and the basis for generated views and agent packs.

### LOGOS Documentation Root

**Status:** canonical.

**Definition:** The repository folder where LOGOS Engine writes generated canonical Markdown documents and derived outcomes. The default root is `logos/` so LOGOS does not collide with an existing project `docs/` folder. The user may configure a different root when needed.

**Used in:** Principles, Boundaries, Success Definition, Product Brief, Product Scope, Engineering documents.

**Aliases:** documentation root, LOGOS output root, generated documentation root.

**Discouraged terms:** docs folder, hard-coded docs path.

**Not to be confused with:** project `docs/` folder, `.logos` internal state, derived artifact.

**Decision relevance:** Product and Engineering must resolve canonical paths relative to the configured LOGOS documentation root instead of assuming `docs/` is available.

### Canonical Source

**Status:** canonical.

**Definition:** The authoritative project state used for review and regeneration. In this project, canonical source includes structured decisions, assumptions, open questions, profile definitions, document contracts, and canonical Markdown.

**Used in:** Principles, Boundaries, Success Definition.

**Aliases:** source of truth, canonical state.

**Discouraged terms:** chat memory, generated view, dashboard state.

**Not to be confused with:** derived artifact, AI output.

**Decision relevance:** Any output that cannot be traced back to canonical source must not be treated as authoritative.

### Confirmed Decision

**Status:** canonical.

**Definition:** A decision the user has explicitly accepted. A confirmed decision should not be overwritten silently and should identify affected documents or downstream decisions when changed.

**Used in:** Decision Registry, Principles, Boundaries, Success Definition, generation and validation flows.

**Aliases:** accepted decision, approved decision.

**Discouraged terms:** AI decision, inferred truth.

**Not to be confused with:** proposed decision, assumed decision, deprecated decision.

**Decision relevance:** Confirmed decisions are the strongest inputs for canonical documents and downstream generation.

### Contextual Suggestion

**Status:** canonical.

**Definition:** An advisory proposed answer, option, framing, or draft response shown alongside a current question because prior confirmed decisions, active assumptions, open questions, completed documents, or validation gaps make the suggestion plausible.

**Used in:** Principles, Boundaries, UX Model, Interaction Model, Functional Requirements, API Contracts.

**Aliases:** suggested answer, grounded suggestion, context-aware suggestion.

**Discouraged terms:** auto-answer, inferred decision, default decision.

**Not to be confused with:** confirmed decision, assumption, diagnostic finding, generic hint.

**Decision relevance:** A contextual suggestion can reduce repeated work in later phases, but it is not canonical state until the user accepts or revises it through an explicit review path.

### Decision

**Status:** canonical.

**Definition:** A structured statement of project intent, constraint, direction, or commitment that can affect documents, validation, or downstream execution.

**Used in:** all Foundation documents, decision registry, validation, diagnostics, profiles.

**Aliases:** structured decision, project decision.

**Discouraged terms:** note, preference, vibe.

**Not to be confused with:** answer, assumption, hypothesis, task.

**Decision relevance:** Decisions are the primary unit of LOGOS Engine. Documents, artifacts, and plans should derive from decisions.

### Decision Registry

**Status:** canonical.

**Definition:** The structured record of what has been decided, assumed, proposed, deprecated, or left unknown, including status, sources, confidence, dependencies, and affected documents.

**Used in:** old architecture docs, Principles, Boundaries, Success Definition, generation and diagnostics flows.

**Aliases:** decision log, structured decision state.

**Discouraged terms:** chat transcript, memory, notes file.

**Not to be confused with:** canonical document, document registry, task board.

**Decision relevance:** The registry provides continuity and traceability when documents are generated or decisions change.

### Derived Artifact

**Status:** canonical.

**Definition:** An output generated from canonical source for navigation, review, presentation, import, or execution support. Examples include HTML views, Markdown execution snapshots, GitHub Issue-compatible files, and agent packs.

**Used in:** Principles, Boundaries, Success Definition, documentation registry.

**Aliases:** generated artifact, presentation artifact, derived output.

**Discouraged terms:** source of truth, canonical artifact.

**Not to be confused with:** canonical document, canonical source.

**Decision relevance:** Derived artifacts can improve usability but must not become authoritative.

### Executive Axis

**Status:** canonical.

**Definition:** The volatile execution-planning axis that defines what should happen next. It is generated from the Normative Axis as a portable JSON execution model, then exported to review artifacts, import files, or agent packs.

**Used in:** Boundaries, Product Scope, Product Architecture, Engineering documents, Operations.

**Aliases:** execution axis, portable execution model.

**Discouraged terms:** task manager, live project board, operational workspace.

**Not to be confused with:** Normative Axis, project management suite, derived artifact.

**Decision relevance:** The Executive Axis helps turn approved project clarity into actionable execution structure without making LOGOS own day-to-day task management.

### Executive Compiler

**Status:** canonical.

**Definition:** The LOGOS capability that reads the current normative documentation baseline, applies readiness and derivation rules, and produces the Executive JSON model plus optional export artifacts.

**Used in:** Product Architecture, Functional Requirements, System Architecture, API Contracts.

**Aliases:** execution compiler, executive generation.

**Discouraged terms:** task creator, task manager.

**Not to be confused with:** Generation Service for canonical Markdown, external execution tools.

**Decision relevance:** The compiler must preserve traceability to source normative documents and must not infer live operational truth from stale or incomplete docs.

### Executive JSON

**Status:** canonical.

**Definition:** The portable JSON execution model generated from the Normative Axis. It represents roadmaps, milestones, workstreams, initiatives, execution items, decisions, risks, artifacts, dependencies, acceptance criteria, confidence, and export metadata.

**Used in:** Product Scope, Data Model, API Contracts, Integration Architecture.

**Aliases:** executive plan, executive exchange model, portable execution model.

**Discouraged terms:** task database, live status store.

**Not to be confused with:** Markdown implementation plan, HTML overview, GitHub issue export, agent pack.

**Decision relevance:** Executive JSON is the canonical exchange model for execution exports, but it is still derived from the Normative Axis and must be regenerated when normative inputs change.

### Export Adapter

**Status:** canonical.

**Definition:** A mapping layer that transforms Executive JSON into a target-specific file, payload, or review artifact such as Markdown, HTML, GitHub Issue-compatible Markdown, Linear JSON, Notion JSON/CSV, or agent packs.

**Used in:** Engineering and Integration documents.

**Aliases:** adapter mapping, export mapping.

**Discouraged terms:** sync engine, live integration.

**Not to be confused with:** provider adapter, renderer, public API.

**Decision relevance:** Export adapters support transfer to external tools while preserving source metadata and avoiding bidirectional task ownership in MVP.

### Execution Graph

**Status:** canonical.

**Definition:** The structured graph inside Executive JSON that connects roadmaps, milestones, workstreams, initiatives, execution items, acceptance criteria, dependencies, risks, decisions, artifacts, and export targets.

**Used in:** Executive Axis, Product Architecture, Data Model, Testing Strategy.

**Aliases:** executive graph, execution model.

**Discouraged terms:** flat task list.

**Not to be confused with:** dependency visualization, project board.

**Decision relevance:** LOGOS must preserve why work exists and where it came from, not merely flatten every item into a task.

### Diagnostics

**Status:** canonical.

**Definition:** The system's explanation of what is missing, risky, inconsistent, blocked, or recommended next in the current project state.

**Used in:** Problem Definition, Principles, Boundaries, Success Definition, old validation docs.

**Aliases:** diagnostic review, gap report.

**Discouraged terms:** validation, audit, grading.

**Not to be confused with:** validation, review, success metric.

**Decision relevance:** Diagnostics help the user understand what to clarify or revisit without pretending all gaps are equally severe.

### Document Contract

**Status:** canonical.

**Definition:** The structured definition of a document's purpose, sections, dependencies, completion criteria, quality checks, generated outputs, and review rules.

**Used in:** profile YAML, documentation registry, AI prompts, generation flows.

**Aliases:** document definition, document schema entry.

**Discouraged terms:** template, prompt, form.

**Not to be confused with:** canonical document, document template.

**Decision relevance:** Document contracts constrain generation and review so outputs remain aligned with project intent.

### Documentation Foundation

**Status:** canonical.

**Definition:** The initial coherent set of project documents that explains why the project exists, what problem it addresses, who it serves, which principles guide it, what boundaries protect it, how success is defined, and how terms are used.

**Used in:** Foundation phase, Success Definition, downstream Validation and Product documents.

**Aliases:** foundation package, foundation docs.

**Discouraged terms:** complete business plan, final strategy.

**Not to be confused with:** full project documentation, implementation plan.

**Decision relevance:** The foundation determines whether later validation, product, engineering, go-to-market, and operations work has a stable conceptual base.

### Explicit Decision

**Status:** canonical.

**Definition:** A decision that is named, statused, reviewable, and traceable to user input, assumptions, evidence, or confirmation.

**Used in:** Thesis, Principles, Success Definition.

**Aliases:** traceable decision, structured decision.

**Discouraged terms:** implied decision, hidden decision.

**Not to be confused with:** inferred AI suggestion, loose prose.

**Decision relevance:** Explicit decisions prevent documents from hiding unresolved thinking.

### Gap

**Status:** canonical.

**Definition:** A missing, incomplete, contradictory, or insufficient piece of project knowledge that affects confidence, validation, documentation, or execution readiness.

**Used in:** Problem Definition, Principles, Success Definition, diagnostics.

**Aliases:** missing input, missing decision, unresolved gap.

**Discouraged terms:** error, failure, blocker, unless severity warrants it.

**Not to be confused with:** open question, risk, assumption.

**Decision relevance:** Gaps should guide follow-up questions, diagnostics, validation, or document revision.

### Git Friendly

**Status:** canonical.

**Definition:** Easy to version, diff, review, revert, and discuss in a file-based repository workflow.

**Used in:** Principles, Audience Definition, Boundaries, Success Definition.

**Aliases:** diff-friendly, repository-friendly.

**Discouraged terms:** Git-only, developer-only.

**Not to be confused with:** Local First.

**Decision relevance:** Git friendliness constrains file formats, generated output behavior, and canonical state design.

### Hypothesis

**Status:** canonical.

**Definition:** A testable claim about what may be true, expected, or causally related, but which requires validation before being treated as reliable.

**Used in:** Thesis, Problem Definition, Success Definition, Validation phase.

**Aliases:** testable claim, validation hypothesis.

**Discouraged terms:** fact, assumption, belief.

**Not to be confused with:** assumption, success criterion, evidence.

**Decision relevance:** Hypotheses should move into validation work rather than remain hidden in foundation prose.

### Intake

**Status:** canonical.

**Definition:** The process of collecting and clarifying user intent through conversation, answers, follow-up questions, assumptions, proposed decisions, and reviewable state.

**Used in:** Audience Definition, Boundaries, Success Definition, old TUI and AI docs.

**Aliases:** conversational intake, AI-led intake.

**Discouraged terms:** questionnaire, form, survey.

**Not to be confused with:** validation, generation, diagnostics.

**Decision relevance:** Intake is the primary path from ambiguous intent to structured project state.

### Local First

**Status:** canonical.

**Definition:** The principle that project knowledge should belong to the user's local workspace before it belongs to any remote service, hosted interface, provider, or hidden runtime.

**Used in:** Principles, Audience Definition, Boundaries, Success Definition, privacy docs.

**Aliases:** local-first, local ownership.

**Discouraged terms:** offline-only, local-only, unless explicitly discussing no-network mode.

**Not to be confused with:** Git Friendly, local provider.

**Decision relevance:** Local First governs storage, provider configuration, privacy, and source-of-truth decisions.

### Open Question

**Status:** canonical.

**Definition:** A known unanswered question that matters to project clarity, validation, or execution.

**Used in:** all Foundation documents, diagnostics, document generation.

**Aliases:** unresolved question, pending question.

**Discouraged terms:** error, missing field, unknown, when a specific question is known.

**Not to be confused with:** gap, assumption, hypothesis.

**Decision relevance:** Open questions should remain visible until answered, deferred, or converted into assumptions or validation work.

### Profile

**Status:** canonical.

**Definition:** A domain or outcome configuration that defines phases, canonical documents, document contracts, questions, validation rules, decision schema, dependency rules, and terminology.

**Used in:** old profile docs, documentation registry, AI prompts, generation flows.

**Aliases:** documentation profile, project profile.

**Discouraged terms:** template pack, vertical, unless discussing market positioning.

**Not to be confused with:** persona, user profile, document template.

**Decision relevance:** Profiles let the engine adapt to project types without hard-coding one domain.

### Proposed Decision

**Status:** canonical.

**Definition:** A decision suggested by the system or AI that has not yet been explicitly confirmed by the user.

**Used in:** Boundaries, Success Definition, Decision Registry, AI integration docs.

**Aliases:** decision proposal, suggested decision.

**Discouraged terms:** confirmed decision, AI decision.

**Not to be confused with:** assumption, confirmed decision.

**Decision relevance:** Proposed decisions must be reviewed before becoming canonical truth.

### Risk

**Status:** canonical.

**Definition:** A possible failure mode, harm, contradiction, uncertainty, or dependency that could weaken the project or make execution unreliable.

**Used in:** all Foundation documents, diagnostics, validation, generated documents.

**Aliases:** risk note, risk pattern.

**Discouraged terms:** fear, issue, blocker, unless severity warrants it.

**Not to be confused with:** gap, assumption, failure signal.

**Decision relevance:** Risks should influence diagnostics, validation, boundaries, and next actions.

### Structured Documentation

**Status:** canonical.

**Definition:** Documentation whose content follows explicit sections, decisions, assumptions, dependencies, review rules, and quality criteria rather than freeform prose alone.

**Used in:** Thesis, Audience Definition, Boundaries, Success Definition.

**Aliases:** structured docs, coherent documentation.

**Discouraged terms:** generated docs, complete docs, unless structure and reviewability are clear.

**Not to be confused with:** polished documents, template output.

**Decision relevance:** Structured documentation is the intended output of the engine and the basis for downstream execution.

### Structured State

**Status:** canonical.

**Definition:** The machine-readable project knowledge used to generate, review, validate, or update documents, including answers, assumptions, open questions, decisions, gaps, and metadata.

**Used in:** Success Definition, Boundaries, old generation and architecture docs.

**Aliases:** project state, workspace state.

**Discouraged terms:** memory, hidden state.

**Not to be confused with:** canonical Markdown, chat history.

**Decision relevance:** Structured state enables regeneration, diagnostics, and traceability.

### Validation

**Status:** canonical.

**Definition:** The process of determining whether the project has enough structured clarity, required decisions, consistency, and risk awareness to proceed.

**Used in:** Success Definition, old validation docs, downstream Validation phase.

**Aliases:** completeness validation, phase readiness check.

**Discouraged terms:** diagnostics, proof, guarantee.

**Not to be confused with:** diagnostics, market validation, user validation.

**Decision relevance:** Validation decides whether progress is structurally supported, not whether the user's project will succeed.

### Workspace

**Status:** canonical.

**Definition:** The local project environment where LOGOS Engine stores or reads project state, profile information, canonical documents, generated artifacts, and configuration.

**Used in:** Audience Definition, Boundaries, Success Definition, privacy docs.

**Aliases:** local workspace, project workspace.

**Discouraged terms:** cloud workspace, account, dashboard.

**Not to be confused with:** repository, profile, project.

**Decision relevance:** Workspace boundaries determine what remains local, what can be inspected, and what may be transmitted only with consent.

## Required Foundation Terms

The following Foundation terms are defined above because they affect interpretation, generation, review, or downstream decisions:

- Agent Pack
- AI as a Layer
- Ambiguous Intent
- Assumption
- Canonical Document
- Canonical Source
- Confirmed Decision
- Decision
- Decision Registry
- Derived Artifact
- Diagnostics
- Document Contract
- Documentation Foundation
- Explicit Decision
- Gap
- Git Friendly
- Hypothesis
- Intake
- Local First
- Open Question
- Profile
- Proposed Decision
- Risk
- Structured Documentation
- Structured State
- Validation
- Workspace

Terms intentionally excluded from glossary treatment:

- **User**: ordinary language in this phase unless a later document needs a formal actor model.
- **Project**: ordinary language here; formal project taxonomy belongs in Product or Profile documentation.
- **Success**: defined substantively in `06-success-definition.md`, not duplicated as a generic glossary entry.
- **Product**: ordinary or phase-specific depending on context; avoid overloading it in the Foundation glossary.
- **Execution**: used broadly to mean downstream action after clarification; detailed execution taxonomy belongs in Product, Engineering, or Operations.

Review items:

- "Source of truth" is used as an alias for Canonical Source, but downstream engineering may need a sharper split between decision registry, structured state, and Markdown documents.
- "Profile" is stable conceptually, but future profile authoring may require more precise terms for profile, phase, document contract, and template.
- "Validation" may need separate downstream definitions for project validation, market validation, document validation, and phase readiness.

## Semantic Distinctions

### Decision vs. Answer

An answer is the user's response to a question. A decision is a normalized, structured statement that may be derived from one or more answers and can affect documents, validation, or execution.

This distinction matters because raw answers should not automatically become confirmed decisions.

### Proposed Decision vs. Confirmed Decision

A proposed decision is suggested but not accepted. A confirmed decision has explicit user acceptance.

This distinction matters because AI suggestions must not become canonical truth without review.

### Assumption vs. Hypothesis

An assumption is temporarily accepted for planning. A hypothesis is a testable claim that should be validated.

This distinction matters because assumptions can allow progress with visible uncertainty, while hypotheses should guide validation work.

### Gap vs. Open Question

A gap is missing or insufficient project knowledge. An open question is a known question that can help resolve a gap.

This distinction matters because diagnostics may identify gaps, while intake or validation may generate open questions.

### Risk vs. Failure Signal

A risk is a possible future failure mode or uncertainty. A failure signal is observed evidence that something may already be going wrong.

This distinction matters because risks should influence planning, while failure signals should trigger review or revision.

### Canonical Document vs. Derived Artifact

A canonical document is a reviewable source document. A derived artifact is generated from canonical source for navigation, presentation, or execution support.

This distinction matters because derived artifacts must not become the source of truth.

### Canonical Source vs. AI Output

Canonical source is reviewable project state. AI output is generated assistance that may become useful only after validation, grounding, or confirmation.

This distinction matters because AI remains a layer, not an authority.

### Local First vs. Git Friendly

Local First concerns ownership and control of project knowledge in the user's workspace. Git Friendly concerns reviewability, diffs, history, and reversibility.

This distinction matters because something can be local but still hard to review, or Git-friendly but not privacy-safe.

### Validation vs. Diagnostics

Validation determines whether structured clarity is sufficient to proceed. Diagnostics explain what is missing, risky, inconsistent, or recommended next.

This distinction matters because validation can block or approve, while diagnostics should guide understanding and action.

### Profile vs. Template

A profile defines domain or outcome structure, phases, document contracts, rules, dependencies, and terminology. A template is a reusable shape or starting content for a specific output.

This distinction matters because profiles govern behavior; templates alone do not.

### Structured Documentation vs. Polished Output

Structured documentation exposes decisions, assumptions, dependencies, gaps, and review rules. Polished output may look complete without being structurally useful.

This distinction matters because the project optimizes for clarity before presentation.

## Aliases and Discouraged Terms

### Acceptable Aliases

- **Diffuse intent**, **unclear intent**, and **ambiguous intent** may be used interchangeably when referring to the initial unclear project state. Prefer **Ambiguous Intent** in canonical docs.
- **Decision proposal** and **proposed decision** may both be used. Prefer **Proposed Decision**.
- **Canonical Markdown** may be used for **Canonical Document** when the format matters.
- **Generated artifact**, **derived output**, and **presentation artifact** may be used for **Derived Artifact** if the context is clear.
- **Diagnostic review** may be used for **Diagnostics**.
- **Documentation profile** may be used for **Profile** when avoiding confusion with user personas.

### Discouraged Terms

- **Magic**: discouraged because it hides how the system works. Prefer inspectable generation, traceability, or AI-assisted workflow.
- **Autonomous agent**: discouraged for the core product because it implies authority transfer. Prefer AI as a Layer or AI-assisted workflow.
- **Questionnaire**: discouraged for normal intake because the intended experience is AI-led conversation constrained by structure, not deterministic form completion.
- **Final document**: discouraged because documents are living and regenerable. Prefer canonical document or approved document.
- **AI decision**: discouraged because decisions belong to the user. Prefer proposed decision or confirmed decision.
- **Guarantee**: discouraged because LOGOS Engine reduces ambiguity; it does not guarantee market, product, or execution success.
- **No-code builder**: discouraged as a description of the project because LOGOS Engine prepares documentation and decisions, not final products.
- **SaaS dashboard**: discouraged as default framing because it conflicts with Local First unless explicitly scoped as a future derived surface.
- **Source of truth**: acceptable as an alias for Canonical Source, but use carefully and specify whether the context means structured state, confirmed decisions, or canonical documents.

### Deprecated or Excluded Terms

- **App Business as project boundary**: excluded. The founder's app-based business need is an origin case and possible proving ground, not the conceptual limit of LOGOS Engine.
- **Pitch deck generator**: excluded. This misrepresents the product as presentation-first.
- **Project management clone**: excluded. This shifts meaning from pre-execution clarification to work coordination.

## Unresolved Terminology Issues

### Canonical Source Boundaries

**Affected terms:** Canonical Source, Decision Registry, Structured State, Canonical Document.

**Description:** Foundation documents use a broad concept of canonical source that includes structured decisions and canonical Markdown. Engineering may need a stricter model that identifies which component wins when structured state and Markdown diverge.

**Risk:** Downstream systems may treat Markdown, registry state, and generated artifacts inconsistently.

**Proposed resolution:** Use **Canonical Source** broadly in Foundation, then define precise precedence rules in Engineering.

**Status:** provisional.

### Profile Scope

**Affected terms:** Profile, Template, Document Contract, Documentation Foundation.

**Description:** The old material references an App Business profile, while current Foundation language frames LOGOS Engine as broader than app-based businesses.

**Risk:** Downstream docs may accidentally domain-lock the engine or overgeneralize before profile mechanics are stable.

**Proposed resolution:** Treat App Business as an origin/proving profile and define Profile generically as an outcome configuration.

**Status:** provisional.

### Validation Types

**Affected terms:** Validation, Diagnostics, Hypothesis, Success Definition.

**Description:** Validation can mean structural readiness, market validation, user research validation, or experiment validation.

**Risk:** Downstream docs may claim the project is "validated" without specifying what kind of evidence exists.

**Proposed resolution:** Use **Validation** in Foundation to mean structured readiness unless explicitly qualified. Define market and experiment validation in Phase 02.

**Status:** provisional.

### Agent Terminology

**Affected terms:** Agent Pack, AI as a Layer, autonomous agent, implementation agent.

**Description:** The project may generate context for agents, but it should not become an autonomous multi-agent execution system by default.

**Risk:** "Agent" language may imply automation or authority beyond the project's boundaries.

**Proposed resolution:** Use **Agent Pack** for derived context artifacts and **AI as a Layer** for the core AI role. Avoid "autonomous agent" unless discussing an excluded or future delegated capability.

**Status:** provisional.

### Workspace vs. Repository

**Affected terms:** Workspace, repository, local workspace, project workspace.

**Description:** The current docs assume a local repository-oriented workflow, but not every future project type may begin inside a Git repository.

**Risk:** Overstating repository assumptions could exclude valid local-first workflows for non-code project types.

**Proposed resolution:** Use **Workspace** as the broad term and **repository** when Git-specific behavior matters.

**Status:** provisional.
