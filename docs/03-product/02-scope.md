# Product Scope Definition

## Scope Objective

This scope document defines what LOGOS Engine may include now, what it must exclude, what remains deferred, and how scope changes should be governed while the product is still based primarily on founder-origin experience and internal documentary evidence.

The scope objective is decision control, not feature collection. The current product should preserve the core promise from the Product Brief: help the user know what has been decided, what is still assumed, what remains unclear, and which documents can safely guide the next step before building.

At this stage, inclusion is justified only when an item is required to support the primary use case, preserve a Foundation boundary, generate the canonical documentation system defined by the profile YAMLs, or run the validation path without creating false certainty. Exclusion, deferral, and reconsideration are governed by the Validation Report: no user-facing demand, audience fit, pricing, retention, or business-model claim is externally validated yet.

Scope authority belongs to the founder/user through explicit decisions recorded in the Decision Record or later scope-change decisions. A scope item may be added, removed, narrowed, or promoted only when it has one of the following:

- direct support from the Product Brief and Foundation boundaries;
- evidence from the Evidence Log;
- an accepted Decision Record entry;
- a clear requirement for the primary use case;
- an explicit founder decision marked as an assumption, not validation.

## In Scope

The following items are in scope for the current product definition. They are included because they preserve the product promise, primary use case, Foundation constraints, or profile-defined output model.

### SC-001: Repository-Directory TUI

**Classification:** core / MVP.

**Description:** LOGOS Engine runs as a TUI from the target repository directory. Generated documentation is written under the configured LOGOS documentation root inside that repository, defaulting to `logos/`.

**Rationale:** The product is local-first and repository-oriented. Running from the target repository protects inspectability, file ownership, and Git-friendly review, while the dedicated `logos/` default avoids colliding with existing project documentation in `docs/`.

**Evidence basis:** Product Brief, Foundation Principles, Foundation Boundaries, old TUI and product requirements.

**Priority:** must-have.

**Dependencies:** local filesystem access, predictable workspace structure, profile selection.

**Downstream implications:** UX, IA, Interaction Model, Functional Requirements, Non-Functional Requirements, and Engineering must treat the repository directory as the active workspace boundary and the LOGOS documentation root as configurable output scope.

**Reconsider trigger:** evidence that repository-directory execution or the default `logos/` documentation root creates unacceptable friction for the intended user.

### SC-002: Workspace Initialization

**Classification:** core / MVP.

**Description:** The product initializes LOGOS project metadata, profile references, initial state, and a configurable LOGOS documentation root inside the current repository workspace. The default documentation root is `logos/`.

**Rationale:** The primary use case requires a user to begin from an ambiguous project idea and create a structured local documentation foundation.

**Evidence basis:** old MVP scope, old product requirements, Product Brief, Foundation Boundaries.

**Priority:** must-have.

**Dependencies:** repository-directory execution, profile registry, documentation-root configuration, local file-writing rules.

**Downstream implications:** Engineering must define safe initialization behavior, idempotency, and generated-path handling without turning this document into implementation architecture.

**Reconsider trigger:** evidence that users need a different project attachment model.

### SC-003: Standard Profile Selection

**Classification:** core / MVP.

**Description:** The product supports selecting and using the initial Standard profile as the document contract for the local project.

**Rationale:** The profile defines phases, documents, canonical Markdown paths, HTML artifacts, agent packs, completion criteria, quality checks, and review rules.

**Evidence basis:** profile YAMLs, Product Brief, old profile and product requirements.

**Priority:** must-have.

**Dependencies:** profile definitions, document schema, phase registry.

**Downstream implications:** Product Architecture and Functional Requirements should model profiles as product capabilities; Engineering should preserve profile YAML as contract input.

**Reconsider trigger:** validation evidence showing the initial profile is too broad, too narrow, or not aligned with the founder-origin app-business proving ground.

### SC-004: AI-Led Conversational Intake

**Classification:** core / MVP / validation-required.

**Description:** The normal clarification flow is AI-led conversation. The AI asks context-aware questions, accepts incomplete answers, interprets answers into structured state, identifies gaps, and proposes decisions for review.

**Rationale:** The product thesis depends on AI-assisted clarification bounded by explicit structure. Normal intake should not require the user to operate deterministic question IDs.

**Evidence basis:** Product Brief, old AI strategy, old TUI specification, Foundation principle AI as a Layer.

**Priority:** must-have for the intended product; validation-required for user value.

**Dependencies:** configured local, mock, fixture, or remote AI provider; prompt contracts; structured output validation; user review.

**Downstream implications:** User Stories, User Journeys, UX Model, Interaction Model, Functional Requirements, and Acceptance Criteria must test clarity, uncertainty handling, and false-authority prevention.

**Reconsider trigger:** prototype evidence that AI-led intake creates unacceptable friction, confusion, false authority, or weaker clarity than a more deterministic flow.

### SC-005: AI Provider Configuration

**Classification:** supporting / MVP.

**Description:** The product supports explicit AI provider configuration, including local and remote provider modes where available, with no raw tokens stored in project files.

**Rationale:** AI is central to the product flow, but Safe by Default and Local First require explicit configuration and transmission awareness.

**Evidence basis:** old provider configuration, old privacy docs, Foundation Principles, Product Brief.

**Priority:** must-have for AI-led operation.

**Dependencies:** provider abstraction, token source rules, remote disclosure.

**Downstream implications:** Non-Functional Requirements and Engineering must preserve privacy, token safety, provider abstraction, and deterministic checks.

**Reconsider trigger:** evidence that the provider setup blocks adoption or that a narrower initial provider surface is needed.

### SC-006: Structured Project State

**Classification:** core / MVP.

**Description:** The product captures answers, summaries, assumptions, open questions, proposed decisions, confirmed decisions, risks, dependencies, and document status in local structured state.

**Rationale:** The project thesis says decisions are the durable unit and documents are projections. The product promise fails if important state exists only in chat or prose.

**Evidence basis:** Foundation thesis, old conceptual model, old product requirements, Product Brief.

**Priority:** must-have.

**Dependencies:** schema definitions, state storage, decision review model.

**Downstream implications:** Product Architecture, Functional Requirements, Engineering Brief, and Acceptance Criteria must distinguish state capture from document rendering.

**Reconsider trigger:** user evidence showing a smaller state model can preserve traceability without losing clarity.

### SC-007: User Review of Proposed Decisions

**Classification:** core / MVP.

**Description:** AI-derived decisions remain proposed until the user confirms, revises, rejects, or defers them.

**Rationale:** User-owned decisions are a hard boundary. AI must not silently make project choices or convert assumptions into facts.

**Evidence basis:** Foundation Boundaries, AI as a Layer, old AI behavior docs, Product Brief.

**Priority:** must-have.

**Dependencies:** decision status model, review interactions, conflict reporting.

**Downstream implications:** UX, Interaction Model, Functional Requirements, and Acceptance Criteria must define observable decision states.

**Reconsider trigger:** none for silent AI decision-making; only the interaction design may change.

### SC-008: Canonical Markdown Rendering

**Classification:** core / MVP.

**Description:** The product renders and refreshes canonical Markdown documents under the configured LOGOS documentation root from profile contracts and available structured state. The default root is `logos/`; users may configure another folder.

**Rationale:** Markdown is the canonical human-readable project content. It should be inspectable, editable with care, versionable, and regenerable.

**Evidence basis:** Product Brief, Foundation Principles, old documentation rendering requirements, profile YAMLs.

**Priority:** must-have.

**Dependencies:** profile YAMLs, documentation-root configuration, canonical document paths resolved under that root, rendering rules, manual-content safety.

**Downstream implications:** Product Architecture and Engineering must preserve Markdown as canonical rendered content and avoid treating HTML or agent packs as source of truth.

**Reconsider trigger:** evidence that another canonical review format is necessary without violating Git Friendly and Structure Over Presentation.

### SC-009: Derived HTML Artifacts

**Classification:** supporting / MVP.

**Description:** The product generates HTML artifacts under the configured LOGOS documentation root, such as `logos/outcomes/html` by default, from canonical Markdown and profile output contracts.

**Rationale:** The profile YAMLs define HTML artifacts as navigable review views. They help review and navigation but remain derived from canonical content.

**Evidence basis:** Product Brief, profile YAML outputs, Structure Over Presentation.

**Priority:** should-have for profile-complete generation; must remain derived.

**Dependencies:** configured LOGOS documentation root, canonical Markdown, artifact generation rules, regeneration metadata.

**Downstream implications:** Functional Requirements and Acceptance Criteria should verify generated artifacts preserve caveats and do not become source of truth.

**Reconsider trigger:** evidence that HTML artifacts do not improve review or create too much maintenance burden.

### SC-010: Derived Agent Packs

**Classification:** supporting / MVP.

**Description:** The product generates agent packs under the configured LOGOS documentation root, such as `logos/outcomes/agents` by default, from canonical documents and document contracts.

**Rationale:** The profile YAMLs define compact review prompts and agent contexts. Agent packs support downstream review or agent work without relying on private chat history.

**Evidence basis:** Product Brief, profile YAML outputs, AI as a Layer, Structure Over Presentation.

**Priority:** should-have for profile-complete generation; validation-required for downstream usefulness.

**Dependencies:** configured LOGOS documentation root, canonical Markdown, dependency documents, completion criteria, quality checks, review rules.

**Downstream implications:** Functional Requirements and Acceptance Criteria should verify agent packs are grounded, compact, and caveat-preserving.

**Reconsider trigger:** evidence that agent packs are unused, misleading, too broad, or better deferred.

### SC-011: Diagnostics and Validation

**Classification:** core / MVP / validation-required.

**Description:** The product reports missing decisions, unresolved assumptions, contradictions, high-risk gaps, affected documents, and next recommended questions or actions.

**Rationale:** The product promise depends on exposing uncertainty instead of hiding it. Diagnostics make gaps visible before execution.

**Evidence basis:** old diagnostics docs, Foundation Success Definition, Product Brief, Validation Report.

**Priority:** must-have at a basic level.

**Dependencies:** structured state, profile completion criteria, validation rules, severity classification.

**Downstream implications:** User Stories, Interaction Model, Functional Requirements, and Acceptance Criteria must define what makes a diagnostic useful and non-misleading.

**Reconsider trigger:** EXP-05 evidence that diagnostics are too noisy, too vague, or not actionable.

### SC-012: Continue Existing Session

**Classification:** supporting / MVP.

**Description:** The product can resume from existing local state and continue the AI-led clarification flow without losing context.

**Rationale:** The primary use case may not complete in one session. The user needs continuity across documents, assumptions, decisions, and gaps.

**Evidence basis:** old core use cases, old TUI flows, Product Brief.

**Priority:** must-have for practical MVP use.

**Dependencies:** local state persistence, session context reconstruction, status reporting.

**Downstream implications:** UX and Interaction Model should define continuation states and incomplete-work recovery.

**Reconsider trigger:** evidence that first use should be narrower and single-session only for validation.

### SC-013: Status and Progress Visibility

**Classification:** supporting / MVP.

**Description:** The product shows progress by phase, document, decision coverage, or readiness without pretending incomplete areas are complete.

**Rationale:** Users need to know where they are, what is missing, and what can be generated or reviewed next.

**Evidence basis:** old TUI spec, old use cases, Product Brief, Success Definition.

**Priority:** should-have.

**Dependencies:** profile structure, document status, validation state.

**Downstream implications:** UX, UI Specification, Interaction Model, and Acceptance Criteria should avoid vanity progress metrics.

**Reconsider trigger:** evidence that progress display creates false confidence or unnecessary pressure.

## Out of Scope

The following items are outside current scope. Some are permanent exclusions; others are deferred or validation-required.

### OOS-001: Automatic Product, App, Website, or Business Generation

**Classification:** permanent exclusion.

LOGOS Engine will not build the user's final product, app, website, course, book, business, community, or internal initiative. It prepares structured decisions and documentation for execution.

**Reconsider trigger:** none under current identity boundaries.

### OOS-002: Autonomous Decision-Making

**Classification:** permanent exclusion.

The product will not make project, product, market, architecture, pricing, launch, or operational decisions silently on behalf of the user.

**Reconsider trigger:** none for silent autonomy; only assisted recommendation behavior may evolve.

### OOS-003: Generic Chatbot Behavior

**Classification:** permanent exclusion as product identity.

Conversation is in scope only as structured clarification. Chat transcript alone is not source of truth and should not replace structured state, decision review, diagnostics, or canonical documents.

**Reconsider trigger:** none for making generic chat the product.

### OOS-004: Web SaaS, Accounts, and Cloud Workspace

**Classification:** deferred / validation-required.

Hosted web experiences, user accounts, cloud sync, and remote workspaces are outside current scope. They may become candidates only if evidence shows demand and they can preserve local ownership, inspectability, and explicit data boundaries.

**Reconsider trigger:** repeated validated demand plus a design that does not violate Local First.

### OOS-005: Multi-User Collaboration

**Classification:** deferred / validation-required.

Comments, shared workspaces, permissions, assignments, approvals, and team collaboration are not current scope.

**Reconsider trigger:** evidence that collaboration is necessary for the primary validated use case rather than an adjacent productivity pull.

### OOS-006: Marketplace or Plugin Economy

**Classification:** deferred.

Plugin marketplace, profile marketplace, monetized templates, and broad ecosystem mechanics are excluded until the core documentation loop works reliably.

**Reconsider trigger:** validated repeat use of one or a small number of profiles plus evidence that extension demand is real.

### OOS-007: Broad Profile Expansion

**Classification:** validation-required.

The product should not immediately commit to many profiles for SaaS, ecommerce, books, courses, communities, research, agencies, or internal initiatives.

**Reconsider trigger:** EXP-02 or later evidence that the core problem and workflow generalize beyond the founder-origin app-business proving ground.

### OOS-008: Real-Time External Research

**Classification:** deferred / validation-required.

The product will not claim market research, legal research, competitive intelligence, or live validation as a core initial capability.

**Reconsider trigger:** evidence that external research improves clarity enough to justify privacy, provenance, accuracy, and cost complexity.

### OOS-009: Pricing, Payments, Revenue, and Packaging

**Classification:** deferred.

Pricing, payment flows, packaging, revenue claims, CAC, LTV, retention, and willingness-to-pay mechanics are outside current product scope.

**Reconsider trigger:** value evidence from workflow experiments and a Decision Record update authorizing economic validation.

### OOS-010: Project Management Suite

**Classification:** out of scope / identity boundary.

The product may generate downstream plans, risks, or execution context, but it will not become a task board, calendar, sprint manager, CRM, reporting dashboard, or team operating system.

**Reconsider trigger:** none for replacing the product identity; specific derived execution artifacts may be revisited after core value is validated.

### OOS-011: Full Dependency Graph Visualization

**Classification:** deferred.

The product may track dependencies and affected documents, but advanced graph visualization is not part of the current scope.

**Reconsider trigger:** evidence that users cannot understand impact or diagnostics without richer visualization.

### OOS-012: Detailed Engineering Architecture

**Classification:** outside Product Scope responsibility.

This document does not define software architecture, database schema, API contracts, deployment, CI/CD, test harnesses, or provider implementation details.

**Reconsider trigger:** none here; those belong to Engineering documents.

## MVP Scope

The MVP is the smallest useful product surface that can preserve the product promise and test whether founder-origin structured clarification produces observable clarity.

### Must Have

- Run `logos` as a TUI from the target repository directory.
- Initialize or resume a LOGOS workspace in that repository.
- Use a configurable LOGOS documentation root, defaulting to `logos/`.
- Select and load the initial Standard profile.
- Configure AI provider access explicitly, including local or remote modes where supported.
- Conduct AI-led intake for the active profile without requiring deterministic question-ID operation during normal flow.
- Capture answers, assumptions, open questions, proposed decisions, confirmed decisions, risks, and dependencies in local structured state.
- Let the user review proposed decisions before they become confirmed.
- Render or refresh canonical Markdown documents under the configured LOGOS documentation root.
- Generate profile-defined HTML artifacts under the configured LOGOS documentation root, such as `logos/outcomes/html` by default, from canonical content.
- Generate profile-defined agent packs under the configured LOGOS documentation root, such as `logos/outcomes/agents` by default, from canonical content and document contracts.
- Run basic diagnostics and validation for missing inputs, contradictions, incomplete areas, and affected documents.
- Show status or progress in a way that preserves uncertainty.
- Preserve local-first, Git-friendly, safe-by-default behavior.

### Should Have

- Clear `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, and `/config ai` command behavior.
- Generated-file reporting that distinguishes created, updated, skipped, incomplete, and blocked outputs, including the active LOGOS documentation root.
- Basic manual-content safety to avoid unexpected overwrite.
- Transmission disclosure for remote AI operations.
- Local-only behavior for non-AI operational tasks.

### Nice To Have

- Richer progress views.
- More refined generated HTML navigation.
- More compact or role-specific agent packs.
- Enhanced diagnostics grouping and suggested next question clusters.
- Additional export conveniences derived from canonical state.

### Explicitly Not MVP

- Web dashboard.
- Cloud sync.
- Accounts.
- Multi-user collaboration.
- Marketplace.
- Broad profile authoring UI.
- Automatic external market research.
- Pricing or payment flows.
- Automatic code generation.
- Full dependency graph visualization.
- Multi-agent orchestration.

MVP compromises are acceptable when they do not break the product promise. HTML artifacts and agent packs may be simple, but they must remain regenerated from canonical content. Diagnostics may begin basic, but they must not hide uncertainty. AI provider support may begin narrow, but project content must not leave the machine without explicit configuration.

## Post-MVP Scope

Post-MVP items are candidates, not commitments. None should leak back into MVP without a new scope decision.

### Near-Term Candidates

- Richer validation and diagnostics that classify severity, dependencies, document impact, and recommended next questions more precisely.
- Better document refresh safety, including clearer manual edit preservation and change summaries.
- More useful generated HTML artifacts for review and navigation.
- More specialized agent packs for review, implementation planning, research, and downstream critique.
- Stronger decision impact tracking across documents.
- Better local provider setup and provider testing.

### Later Candidates

- Additional profiles after evidence shows the workflow generalizes beyond the founder-origin app-business proving ground.
- Roadmap-to-task export or issue generation after canonical documents and decisions are reliable.
- Market research integrations after provenance, privacy, and validation rules are defined.
- Figma, presentation, or richer export formats as derived artifacts.
- Advanced dependency graph visualization.
- Hosted collaboration only if validated demand can be served without replacing local source of truth.

### Expansion Triggers

Post-MVP scope may be reconsidered when one or more of the following is true:

- EXP-01 and EXP-02 support the problem and audience hypotheses.
- EXP-03 shows decision-derived artifacts are clearer than alternatives.
- EXP-04 shows AI-led intake is safe, useful, and not too heavy.
- EXP-05 shows diagnostics are actionable.
- EXP-06 shows local-first setup and trust posture are acceptable.
- Users demonstrate repeat use or a need to update decisions over time.
- A deferred capability is required to preserve the validated core promise.

## Explicit Non-Goals

LOGOS Engine will not optimize for output volume. More documents, longer documents, or more generated artifacts are not evidence of success.

LOGOS Engine will not promise that a user's project, business, product, or launch will succeed. It reduces avoidable confusion; it does not validate the market by itself.

LOGOS Engine will not treat founder-origin assumptions as validated user demand. Personal experience may justify founder-led exploration and prototype scope, but external claims require evidence.

LOGOS Engine will not replace user judgment. AI may suggest, challenge, summarize, diagnose, and draft; the user owns decisions.

LOGOS Engine will not make HTML artifacts or agent packs canonical sources of truth. They are regenerated outputs.

LOGOS Engine will not require a cloud account, hidden remote state, telemetry, or surprise network calls for the local product.

LOGOS Engine will not become a generic productivity suite, task manager, project manager, CRM, or collaboration system in the current product definition.

LOGOS Engine will not silently ingest arbitrary source code, Git history, unrelated files, other projects, or machine paths as AI context.

LOGOS Engine will not set pricing, packaging, revenue, or business-model commitments before value and willingness-to-pay evidence exists.

## Scope Boundaries

### Product vs. User Responsibility

The product is responsible for asking useful questions, structuring answers, exposing assumptions, proposing decisions, rendering documents, generating derived outputs, and reporting gaps.

The user is responsible for the truth of their answers, final decisions, validation choices, business commitments, implementation choices, and risk acceptance.

Decision rule: if a choice changes the project's purpose, audience, scope, economics, architecture, ethics, launch, or acceptable risk, the product may assist but the user must decide.

### Product vs. AI Provider Responsibility

The product is responsible for provider configuration, context boundaries, transmission disclosure, prompt grounding, structured parsing, and review safeguards.

The AI provider is responsible for model execution and response generation. The product must not hide provider use or present provider output as confirmed truth.

Decision rule: remote provider use requires explicit configuration and must not include arbitrary workspace context.

### Product vs. Canonical Documents

Canonical Markdown is the human-readable rendered project content. Structured state and profile contracts govern what should be generated and reviewed.

HTML artifacts and agent packs are derived outputs. They may help navigation, review, or downstream work, but they must not become separate truth stores.

Decision rule: when a derived output conflicts with canonical Markdown or structured state, update the canonical source or regeneration logic, not the derived artifact by hand.

### Product vs. Engineering

Product Scope defines capabilities and boundaries. Engineering defines architecture, implementation design, runtime behavior, data model, test strategy, deployment, observability, and technical trade-offs.

Decision rule: this document may state that local structured state is required; it should not decide the internal storage implementation beyond product-level constraints.

### Product vs. Go-to-Market

The product may provide a problem framing and product hypothesis for messaging tests. It must not claim validated demand, market advantage, pricing power, or broad audience fit.

Decision rule: GTM claims require Evidence Log entries and Decision Record updates.

### Product vs. Operations

The product may generate operational context and research preparation outputs. It does not own research execution quality, participant recruitment, evidence interpretation, support staffing, or business operations.

Decision rule: operations may prepare validation workflows, but product scope should not expand into an operations platform.

## Deferred Decisions

### DD-001: Breadth of Initial Audience

**Reason deferred:** The current audience is founder-origin and internally reasoned. No external user evidence exists.

**Evidence needed:** EXP-01 and EXP-02 evidence from qualified participants.

**Revisit trigger:** first problem and audience research batch.

**Risk of deferral:** Product language may stay broad while the strongest actual segment remains unknown.

**Blocked work:** segment-specific product commitments and GTM claims.

**Allowed work:** founder-origin MVP and validation preparation.

**Owner:** founder/user.

**Status:** deferred.

### DD-002: Profile Expansion

**Reason deferred:** App-business is the origin and proving ground, but broad profile demand is unvalidated.

**Evidence needed:** cross-context evidence that the same clarification problem appears in non-app contexts.

**Revisit trigger:** EXP-02 or later repeated non-app demand.

**Risk of deferral:** The product may appear narrower than the long-term thesis.

**Blocked work:** broad profile marketplace, profile authoring UI, multi-profile launch commitments.

**Allowed work:** keeping engine concepts generic enough not to hard-code app-business permanently.

**Owner:** founder/user.

**Status:** deferred.

### DD-003: Hosted or Collaborative Product Surface

**Reason deferred:** Hosted collaboration may conflict with Local First and is not validated as necessary.

**Evidence needed:** repeated user evidence that collaboration is required for the primary use case and can preserve inspectability.

**Revisit trigger:** validated demand from intended users after core local workflow works.

**Risk of deferral:** Teams may find the product less convenient.

**Blocked work:** accounts, cloud sync, permissions, team workspaces, shared dashboards.

**Allowed work:** local files that users may version or share through their own Git workflow.

**Owner:** founder/user.

**Status:** deferred.

### DD-004: Agent Pack Role in the Product

**Reason deferred:** Profile YAMLs define agent packs, but their usefulness is not externally validated.

**Evidence needed:** evidence that generated agent packs improve review, implementation planning, or downstream agent performance.

**Revisit trigger:** artifact review or downstream agent-use experiment.

**Risk of deferral:** Agent packs may be generated but underused or too generic.

**Blocked work:** treating agent packs as a primary differentiator or monetizable output.

**Allowed work:** generating profile-defined agent packs as derived artifacts.

**Owner:** founder/user.

**Status:** deferred.

### DD-005: Economic Model and Pricing

**Reason deferred:** No value, willingness-to-pay, pricing, retention, CAC, LTV, or revenue evidence exists.

**Evidence needed:** workflow value evidence followed by willingness-to-pay research.

**Revisit trigger:** after EXP-03, EXP-04, EXP-06, EXP-08, and later EXP-09 produce evidence.

**Risk of deferral:** Sustainability questions may remain hidden too long.

**Blocked work:** pricing, packaging, payment flows, revenue model commitments.

**Allowed work:** cost tracking preparation and business-model hypotheses.

**Owner:** founder/user.

**Status:** deferred.

### DD-006: External Research Integrations

**Reason deferred:** External research may add value but creates accuracy, privacy, provenance, and scope risks.

**Evidence needed:** proof that users need integrated research and that the product can cite, constrain, and mark evidence safely.

**Revisit trigger:** user research shows that manual evidence collection blocks progress.

**Risk of deferral:** Users may need to collect external evidence outside LOGOS.

**Blocked work:** automatic market research, competitor intelligence, legal claims, live data lookup.

**Allowed work:** evidence logging structure and manual research planning.

**Owner:** founder/user.

**Status:** deferred.

## Scope Risks

### Risk: Product Scope Overclaims Validation

**Source:** detailed internal documentation may look like validation.

**Affected items:** Product Brief, Product Scope, GTM, pricing, broad audience claims.

**Likelihood:** high without discipline.

**Impact:** high.

**Early signal:** documents describe demand, segment fit, pricing, or differentiation without caveats.

**Mitigation:** label founder-origin assumptions, cite Evidence Log, and keep Decision Record gates explicit.

**Decision trigger:** any downstream document treating internal coherence as external validation.

### Risk: MVP Becomes Too Broad

**Source:** profile system, generated artifacts, diagnostics, AI, provider setup, and future outputs can all expand quickly.

**Affected items:** MVP scope, Engineering, Product Architecture, Operations.

**Likelihood:** medium.

**Impact:** high.

**Early signal:** marketplace, collaboration, rich exports, graph visualization, or advanced integrations enter MVP.

**Mitigation:** include only what preserves the product promise and primary use case.

**Decision trigger:** any MVP item not tied to Product Brief, Foundation boundary, or validation need.

### Risk: MVP Becomes Too Narrow

**Source:** cutting derived outputs, diagnostics, review states, or structured decisions could make the product a thin document generator.

**Affected items:** canonical Markdown, HTML artifacts, agent packs, diagnostics, decision review.

**Likelihood:** medium.

**Impact:** high.

**Early signal:** generated documents exist but users cannot trace decisions, inspect assumptions, or see gaps.

**Mitigation:** preserve structured state, decision review, canonical documents, derived outputs, and diagnostics at least at a basic level.

**Decision trigger:** MVP cannot demonstrate the core promise.

### Risk: AI Creates False Authority

**Source:** AI-led intake and drafting may sound confident before evidence or user confirmation exists.

**Affected items:** AI intake, document rendering, decision review, diagnostics, agent packs.

**Likelihood:** medium.

**Impact:** high.

**Early signal:** proposed decisions appear confirmed, assumptions disappear, or generated docs read as final truth.

**Mitigation:** explicit decision states, user confirmation, caveat preservation, validation warnings.

**Decision trigger:** prototype users accept AI claims without review or cannot tell what is confirmed.

### Risk: Repository Directory or Documentation Root Creates Friction

**Source:** requiring `logos` to run from the target repository directory and defaulting LOGOS output to `logos/` may be clear but less flexible.

**Affected items:** onboarding, workspace initialization, documentation-root configuration, UX, Engineering.

**Likelihood:** unknown.

**Impact:** medium.

**Early signal:** users attempt to manage projects from outside the target repository, expect output in `docs/`, or misunderstand where files will be written.

**Mitigation:** clear status, path disclosure, documentation-root configuration, and initialization confirmation.

**Decision trigger:** repeated setup confusion in EXP-06 or prototype sessions.

### Risk: Derived Outputs Become Source of Truth

**Source:** HTML artifacts and agent packs may feel more polished or convenient than canonical documents.

**Affected items:** HTML artifacts, agent packs, Markdown, profile contracts.

**Likelihood:** medium.

**Impact:** medium to high.

**Early signal:** users or agents edit derived outputs directly or cite them over canonical Markdown.

**Mitigation:** mark derived outputs as regenerated from canonical content and keep regeneration rules explicit.

**Decision trigger:** artifact review shows derived outputs causing drift or false confidence.

## Scope Governance

Scope changes must be lightweight but explicit.

New scope items should be proposed with:

- item name;
- classification;
- rationale;
- evidence basis or assumption label;
- dependency;
- affected downstream documents;
- risk if added;
- risk if deferred;
- reconsider trigger.

To add scope, one of the following must be true:

- the item is required for the Product Brief's core promise or primary use case;
- the item preserves a Foundation boundary;
- the item is required by the profile document contract;
- the Evidence Log supports the need;
- the Decision Record accepts the scope change;
- the founder/user explicitly accepts it as an assumption for validation.

To remove or narrow scope, one of the following must be true:

- the item is not required for the core promise;
- the item creates unsafe complexity or false certainty;
- evidence refutes its usefulness;
- it belongs better in a later Product, Engineering, GTM, or Operations document;
- it violates Foundation boundaries or Validation restrictions.

To defer scope, the document must name the evidence needed, revisit trigger, blocked work, allowed work, and risk of deferral.

Accepted scope changes must update the affected downstream documents. At minimum, changes may require updates to Product Brief, Scope, User Stories, User Journeys, UX Model, Information Architecture, Interaction Model, UI Specification, Product Architecture, Functional Requirements, Non-Functional Requirements, Product Stack, Acceptance Criteria, Engineering Brief, GTM Brief, or Operations documents.

Scope governance should preserve learning without letting curiosity become commitment. The default rule is simple: if a scope item does not protect the promise, support the primary use case, preserve a boundary, or produce validation evidence, it should stay out, stay deferred, or be explicitly marked as an assumption.
