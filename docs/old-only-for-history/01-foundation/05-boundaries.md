# Project Boundaries

LOGOS Engine exists to help people turn unclear project intent into explicit decisions and well-structured documentation before execution. These boundaries protect that thesis from becoming a generic AI assistant, a project management suite, a no-code builder, a cloud platform, or an autonomous decision-maker.

The central temptation this project must resist is expansion into anything that makes output look faster while making decisions less explicit, less reviewable, less local, or less owned by the user.

## What This Project Is Not

LOGOS Engine is not a no-code builder. It does not promise to build the final product, application, website, book, course, business, community, or internal initiative for the user. It prepares structured decisions and documentation that can guide execution.

LOGOS Engine is not a generic chatbot. Conversation is a means of structured clarification, not the product's source of truth. A chat transcript alone is not enough; the system must convert useful answers into reviewable decisions, assumptions, open questions, and canonical documents.

LOGOS Engine is not a project management clone. It may help produce plans, risks, milestones, or downstream execution context, but it should not become primarily a task board, ticket tracker, calendar, reporting dashboard, or team coordination suite.

LOGOS Engine is not a pitch deck generator, accelerator curriculum, fundraising assistant, or business-success guarantee. It may help clarify project reasoning, but it should not promise market validation, funding readiness, commercial success, or strategic certainty.

LOGOS Engine is not a web SaaS by default. Hosted experiences, accounts, cloud sync, and collaboration may become future candidates, but they must not replace the local-first source-of-truth model without explicit validation.

LOGOS Engine is not an autonomous agent that decides for the user. It may ask, suggest, challenge, diagnose, draft, validate, and prepare outputs, but decisions remain user-owned unless the user explicitly confirms them.

LOGOS Engine is not limited to the founder's original app-based business use case. That use case is the origin story and a useful proving ground, but the broader project exists for any meaningful project that needs structured documentation before execution.

## Out of Scope

### Current Scope

In scope for the initial product:

- Initializing a local project workspace.
- Creating and using a configurable LOGOS documentation root, defaulting to `logos/`, for generated project documentation.
- Supporting the Standard profile as the first bundled documentation profile while preserving a profile model that can later support additional profile directories.
- Running a structured AI-led intake conversation.
- Offering contextual suggestions alongside directly related questions when earlier confirmed or reviewable project state supports them.
- Capturing answers, assumptions, open questions, and proposed decisions.
- Storing decisions and project state locally.
- Rendering canonical Markdown documentation from structured state.
- Compiling a portable Executive Axis JSON model from the current normative documentation baseline when readiness gates allow it.
- Exporting derived executive artifacts such as Markdown implementation snapshots, GitHub Issue-compatible files, HTML review views, and agent packs.
- Running diagnostics for gaps, risks, contradictions, and incomplete areas.
- Validating phase readiness.
- Supporting a repository-oriented workflow with text-based, diff-friendly files.
- Allowing the user to continue later without losing context.

### Temporary or MVP Exclusions

These are out of scope now, but not permanently forbidden:

- **Cloud sync**: deferred. It conflicts with Local First unless designed around explicit opt-in, inspectable data boundaries, and user control.
- **Multi-user collaboration**: deferred. Useful later, but it risks pulling the product toward team workflow software before the core structured-documentation loop is proven.
- **Web dashboard**: deferred. A hosted visual surface may help later, but it must not become the canonical source of truth.
- **User accounts**: deferred. They are unnecessary for local-first value and would introduce privacy, infrastructure, and operational burden.
- **Plugin marketplace**: deferred. Extensibility matters, but a marketplace before the core model is stable would create avoidable complexity.
- **Multi-profile authoring UI**: deferred. Future profiles matter, but the profile model should be validated before building a broad authoring surface.
- **Advanced graph visualization**: deferred. Dependencies should be tracked, but full graph visualization is not required to prove the thesis.
- **Live roadmap, task, and issue management**: deferred. LOGOS may generate portable execution models and export files, but live operational status, comments, assignments, and collaboration belong in external tools.
- **Figma export, presentation exports, and rich generated views**: future candidates. They must remain derived artifacts, not sources of truth.

### Permanent Exclusions

These are not part of the project identity:

- **Automatic final-product generation**: prohibited as an identity direction. LOGOS Engine should not become a generic app, website, content, or business generator.
- **Silent decision-making on behalf of the user**: prohibited. It violates user agency and AI as a Layer.
- **Hidden remote-first state**: prohibited. It violates Local First, Git Friendly, and Structure Over Presentation.
- **Unreviewed conversion of assumptions into facts**: prohibited. It violates Explicit Over Assumed and Safe by Default.
- **Contextual suggestions presented as expected answers**: prohibited. Suggestions may reduce repeated work, but they must remain optional, source-labeled, and reviewable.
- **Telemetry or surprise data collection**: prohibited unless a future explicit governance decision changes the privacy model with user consent.

### Pending Validation

These require future evidence before entering scope:

- Whether non-technical users can be served without diluting the local-first workflow.
- Whether hosted collaboration can preserve inspectability and user control.
- Whether profile expansion should be broad immediately or sequenced around a small number of well-defined project types.
- Whether AI-generated agent packs should become a primary output or remain a secondary derivative.
- Whether external research integrations improve clarity enough to justify privacy, accuracy, and provenance complexity.

## Anti-Patterns

### Polished Output Over Real Clarity

**Classification:** prohibited.

This anti-pattern appears when the system produces attractive documents, views, or agent prompts while hiding weak structure underneath.

It violates Structure Over Presentation and the founding claim that documents should be projections of structured decisions.

Example violation: generating a complete-looking strategy document while target audience, assumptions, risks, and success criteria remain unknown.

Review signal: the artifact looks finished, but reviewers cannot trace statements back to decisions, assumptions, or evidence.

### Chat Transcript as Source of Truth

**Classification:** prohibited.

This anti-pattern appears when important project state exists only in conversation history instead of canonical files and structured decisions.

It violates AI as a Layer, Git Friendly, and Explicit Over Assumed.

Example violation: asking the AI to remember a project constraint from chat without storing it as a decision, assumption, or open question.

Review signal: the system cannot regenerate, diff, inspect, or validate the project state without private conversational context.

### Remote Convenience by Default

**Classification:** prohibited unless explicitly opted in.

This anti-pattern appears when the system sends project context, stores state, or depends on a hosted service before the user has chosen that behavior.

It violates Local First and Safe by Default.

Example violation: sending answers to a remote LLM provider during setup without provider configuration and transmission disclosure.

Review signal: useful behavior depends on network access or hosted state before the user has consented.

### Autonomous Authority

**Classification:** prohibited.

This anti-pattern appears when the system acts as if AI can make project decisions without the user's confirmation.

It violates User Responsibility Boundaries, AI as a Layer, and Safe by Default.

Example violation: marking a major product, market, architecture, or operational decision as confirmed because the AI inferred it from vague answers.

Related violation: pre-filling the next phase with suggested answers derived from earlier documents and treating them as accepted because they are coherent with the existing project state.

Review signal: user-owned choices become canonical without a clear confirmation path.

### Scope Gravity Toward Generic Productivity

**Classification:** out of scope.

This anti-pattern appears when LOGOS Engine begins absorbing adjacent productivity categories: task management, dashboards, calendar workflows, CRM, team reporting, or knowledge-base management.

It dilutes the founding thesis by shifting attention from pre-execution clarification to generic work coordination.

Example violation: prioritizing task board features over decision capture, diagnostics, and document regeneration.

Review signal: the roadmap starts optimizing for managing work after decisions are made instead of clarifying decisions before execution.

### Overbuilt Meta-System

**Classification:** out of scope for the initial product.

This anti-pattern appears when the system prioritizes complex profile marketplaces, multi-agent orchestration, full dependency graph visualization, or elaborate infrastructure before the core documentation loop is proven.

It violates Safe by Default, Local First, and the MVP risk identified in the old scope material.

Example violation: building a plugin ecosystem before the canonical decision and document model works reliably for one or a small number of profiles.

Review signal: architecture complexity grows faster than user-visible clarity.

## Ethical Boundaries

### No Covert Data Movement

**Classification:** prohibited.

The system must not send project answers, assumptions, generated documents, file paths, source files, Git history, or sensitive workspace context to a remote provider without explicit configuration and disclosure.

Protected principles: Local First, Safe by Default, Git Friendly.

Review signal: any feature that depends on undisclosed network calls or remote storage violates this boundary.

### No False Authority

**Classification:** prohibited.

The system must not present uncertain AI output, inferred strategy, generated claims, or unvalidated assumptions as authoritative truth.

Protected principles: Explicit Over Assumed, AI as a Layer, Safe by Default.

Review signal: a generated document makes strong claims without evidence, confirmation, or uncertainty labels.

### No Manipulative Pressure

**Classification:** prohibited.

The system must not shame uncertainty, coerce users into decisions, exaggerate risk to force completion, or pressure users toward paid services, remote providers, or specific strategic choices.

Protected principles: Safe by Default and user agency.

Review signal: the experience makes a user feel that "I do not know yet" is unacceptable or that an AI suggestion is the expected answer.

### No Surveillance or Telemetry by Default

**Classification:** prohibited under the current privacy model.

The system must not collect usage analytics, phone home, track sessions, or build hidden behavioral profiles by default.

Protected principles: Local First and Safe by Default.

Review signal: runtime behavior includes background data collection not required for the local task.

### No Unbounded Context Capture

**Classification:** prohibited.

The system must not ingest arbitrary source code, unrelated files, other projects, Git history, or machine paths as context unless the user explicitly includes them for a bounded purpose.

Protected principles: Safe by Default, Local First, AI as a Layer.

Review signal: an AI operation pulls broad workspace context when a specific document contract or decision context would suffice.

### Legal and Compliance Limits

**Classification:** review need.

The current material does not establish legal, compliance, or regulated-industry obligations. The project should avoid making legal compliance claims until those claims are reviewed in a dedicated legal, security, or compliance artifact.

Protected principle: Explicit Over Assumed.

Review signal: docs or UI claim the product is compliant with a named regulation without evidence or review.

## Product Boundaries

### Documentation System, Not Execution Platform

**Classification:** identity boundary.

LOGOS Engine should remain focused on structured clarification, decisions, diagnostics, and documentation. Execution artifacts may be derived, but the product should not become the platform where all work is executed.

Protected thesis claim: documentation should derive from structured decisions before execution.

Violation example: replacing the core intake and document workflow with a full task execution environment.

### Execution Compiler, Not Task Manager

**Classification:** identity boundary.

The Executive Axis may compile the Normative Axis into a portable JSON execution model and export that model into external execution formats. LOGOS owns clarification, derivation, traceability, readiness gates, export adapters, and review artifacts. External tools own live execution state: daily status, comments, assignments, labels, notifications, calendars, and collaboration.

Protected thesis claim: execution should be derived from canonical clarity, but LOGOS should not become another project management product.

Violation example: adding a LOGOS task board where users manage live work status instead of exporting an execution model to GitHub, Linear, Notion, Markdown, HTML, or agent packs.

### Generic Across Project Types, Not Domain-Locked

**Classification:** strategic boundary.

The project should not be permanently limited to app-based businesses. That use case explains the origin and can validate early assumptions, but the engine should remain usable for many project types that need structured documentation before starting.

Protected claim: the broader audience is any builder, creator, consultant, team, or operator who needs structured documentation before a meaningful project.

Violation example: hard-coding all documentation, language, and validation assumptions around app startups in ways that prevent future profiles for books, courses, research, communities, services, or internal initiatives.

### Local Source of Truth, Derived Views

**Classification:** prohibited to violate.

Canonical truth should live in structured local state and Markdown/YAML documents inside the configured LOGOS documentation root. The default root is `logos/`, not the repository's existing `docs/` folder, because user projects may already have their own documentation there. The Executive Axis JSON is a portable exchange model derived from the Normative Axis. HTML views, dashboards, presentations, Markdown execution snapshots, GitHub issue exports, Linear/Notion payloads, and agent packs may exist, but they must remain generated or exported outputs rather than live operational truth.

Protected principles: Local First, Structure Over Presentation, Git Friendly.

Violation example: letting a dashboard edit derived state that cannot be traced back to canonical files.

### Not a Research Oracle

**Classification:** out of scope now; future candidate with safeguards.

LOGOS Engine should not claim to perform real-time external research, market validation, legal analysis, or competitive intelligence as a core foundation promise.

Protected principles: Explicit Over Assumed and Safe by Default.

Violation example: generating market-size claims or competitor conclusions without cited evidence and uncertainty labels.

### Not a Collaboration Suite

**Classification:** deferred.

Team collaboration, permissions, shared workspaces, comments, assignments, approval workflows, and enterprise administration are outside the current scope.

Protected principles: Local First and focus on the primary audience.

Violation example: prioritizing account management and multi-user permissions before local structured documentation is reliable.

### Not a Marketplace First Product

**Classification:** deferred.

Profiles, integrations, templates, and plugins may become important, but a marketplace should not lead product strategy before the core engine proves its value.

Protected risk: overbuilding the meta-system.

Violation example: designing profile monetization before validating that users get value from one well-structured documentation workflow.

## User Responsibility Boundaries

The user remains responsible for final project decisions. LOGOS Engine can clarify, propose, challenge, and document, but it must not silently absorb the responsibility to decide.

### User-Owned Decisions

**Classification:** user-owned responsibility.

The user owns decisions about project purpose, audience, scope, positioning, ethics, validation, economics, implementation commitments, launch timing, operational obligations, and acceptable risk.

The system may suggest options, identify gaps, and explain trade-offs. It must not convert suggestions into confirmed decisions without explicit confirmation.

### Evidence and Truth Claims

**Classification:** user-owned responsibility with system assistance.

The user is responsible for validating external facts, market claims, legal claims, user behavior claims, and business assumptions. The system may mark evidence gaps and request sources, but it must not invent evidence.

### Sensitive Context and Provider Choice

**Classification:** user-owned responsibility with safeguards.

The user decides whether to configure a remote AI provider and what context may be sent. The system must provide safe defaults, disclosure, and boundaries, but the user's provider choice remains their responsibility.

### Manual Edits and Canonical Changes

**Classification:** shared responsibility.

The user owns manual edits to canonical documents. The system should preserve those edits where appropriate and warn before overwriting content. The system is responsible for making generated and manual areas clear enough to review.

### Execution and Commitment

**Classification:** user-owned responsibility.

The user owns whether to build, publish, fund, sell, launch, hire, contract, or operationalize a project. LOGOS Engine may prepare documentation and plans, but it should not create external commitments without explicit user action.

### Actions Requiring Explicit Confirmation

The system should require explicit confirmation before:

- Marking proposed decisions as confirmed.
- Overwriting manual content.
- Sending project context to a remote provider.
- Performing destructive file operations.
- Creating externally visible outputs.
- Changing provider configuration.
- Exporting artifacts that could be mistaken for approved plans.

## Future Temptations to Resist

### "Just Build the App"

This temptation is attractive because AI coding tools make generation feel immediate. It is misaligned because LOGOS Engine's purpose is structured clarification and documentation before execution, not automatic product generation.

Reconsider only if execution remains a derived, user-confirmed workflow grounded in approved canonical documents.

### "Turn It Into a SaaS Dashboard"

This temptation is attractive because dashboards are easier to sell, demo, and collaborate in. It is misaligned if it makes hosted state canonical or weakens local ownership.

Reconsider only with explicit evidence that a hosted surface improves clarity without violating Local First, Git Friendly, and Safe by Default.

### "Add Team Collaboration Early"

This temptation is attractive because many documentation problems become team problems. It is misaligned if collaboration features overtake the core decision and document model.

Reconsider only after the local single-user workflow reliably produces useful structured documentation.

### "Create a Profile Marketplace"

This temptation is attractive because the project can support many domains. It is misaligned if marketplace mechanics arrive before profiles are proven, reviewable, and maintainable.

Reconsider only after multiple profiles demonstrate real user value and the governance model for profile quality is clear.

### "Make AI Fully Autonomous"

This temptation is attractive because autonomy feels powerful and marketable. It is misaligned because the user owns the decision and AI remains a layer.

Reconsider only for narrow, reversible, explicitly delegated actions with strong provenance, review, and user consent.

### "Generate External Research Automatically"

This temptation is attractive because project documentation often needs market, legal, technical, or competitive evidence. It is misaligned if generated research appears authoritative without sources, currency, or validation.

Reconsider only with citation, provenance, freshness, and uncertainty rules that prevent invented evidence.

### "Optimize for Polished Deliverables"

This temptation is attractive because polished artifacts feel valuable. It is misaligned if presentation hides missing decisions or weak structure.

Reconsider only when polished artifacts remain derived from canonical state and preserve visible uncertainty.

### "Monetize Through Lock-In"

This temptation is attractive because hosted storage, proprietary formats, and account-based workflows create commercial leverage. It is misaligned with Local First, Git Friendly, and user ownership.

Reconsider only if monetization preserves exportability, local files, and user control.

## Open Questions

- Which exclusions should be treated as permanent constitutional boundaries versus deferred product decisions?
- How should boundaries be enforced during roadmap review: warnings, hard validation failures, or review checklists?
- Which user confirmations should be required in V1, and which can be added later?
- How should the project express its broad project-type ambition while still validating through one or a few concrete early profiles?
- What governance process should approve future movement from deferred to in-scope?
