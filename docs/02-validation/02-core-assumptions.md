# Core Assumptions

This document lists what must be true for LOGOS Engine to make sense. These are assumptions, not validated facts. Current evidence is primarily internal reasoning, legacy specification material, and the drafted Foundation documents; external user evidence still needs to be collected.

## Assumption Map

### Thesis Assumptions

| ID | Assumption | Status | Evidence Level | Uncertainty | Impact | Criticality |
| --- | --- | --- | --- | --- | --- | --- |
| A-TH-01 | People starting meaningful projects often have enough intent to act but not enough explicit decisions to guide execution safely. | intuited | internal reasoning and legacy docs | high | high | critical |
| A-TH-02 | Explicit, traceable decisions are more valuable as the foundation of documentation than polished prose alone. | intuited | foundation thesis and principles | high | high | critical |
| A-TH-03 | Documentation derived from structured decisions can be more coherent, regenerable, and useful than manually written isolated documents. | intuited | foundation thesis and old documentation architecture | high | high | critical |
| A-TH-04 | The app-based business origin case can validate the broader thesis without permanently domain-locking the engine. | provisional | founder context and audience revision | medium | high | critical |

### Problem Assumptions

| ID | Assumption | Status | Evidence Level | Uncertainty | Impact | Criticality |
| --- | --- | --- | --- | --- | --- | --- |
| A-PR-01 | Ambiguous project intent produces real pain: rework, weak scoping, inconsistent documentation, hidden assumptions, or late-discovered constraints. | intuited | legacy thesis, problem doc | high | high | critical |
| A-PR-02 | Existing alternatives solve parts of the problem but leave structural gaps for users who want local, decision-oriented documentation. | intuited | problem doc, old product vision | high | high | critical |
| A-PR-03 | Users can recognize the difference between more text and more clarity. | unknown | foundation success definition | high | high | critical |
| A-PR-04 | The problem is severe enough to justify behavior change before execution begins. | unknown | no external evidence yet | high | high | killing |

### Audience Assumptions

| ID | Assumption | Status | Evidence Level | Uncertainty | Impact | Criticality |
| --- | --- | --- | --- | --- | --- | --- |
| A-AU-01 | The strongest early audience is technical or product-adjacent builders who work near terminals, Git, Markdown, IDEs, and local repositories. | provisional | old product vision and audience doc | medium | high | critical |
| A-AU-02 | This audience values structured documentation enough to adopt a new workflow. | unknown | no external evidence yet | high | high | critical |
| A-AU-03 | This audience tolerates explicit assumptions, decision review, and visible uncertainty when it produces trust and clarity. | unknown | principles and audience doc | high | high | critical |
| A-AU-04 | Non-technical or collaboration-heavy audiences can be deferred without invalidating the project. | provisional | boundaries doc | medium | medium | secondary |

### Solution and Workflow Assumptions

| ID | Assumption | Status | Evidence Level | Uncertainty | Impact | Criticality |
| --- | --- | --- | --- | --- | --- | --- |
| A-SO-01 | AI-led intake can clarify ambiguous intent better than deterministic questionnaires for the primary audience. | unknown | old AI strategy, foundation docs | high | high | critical |
| A-SO-02 | Proposed decisions, assumptions, gaps, and open questions can be extracted from conversation with enough quality to support canonical documents. | unknown | old AI strategy and roadmap | high | high | killing |
| A-SO-03 | Users will review, confirm, reject, or revise proposed decisions rather than passively accepting AI output. | unknown | boundaries and success definition | high | high | critical |
| A-SO-04 | Generated Markdown documents can reflect structured state without becoming generic AI prose. | unknown | documentation architecture | high | high | critical |
| A-SO-05 | Diagnostics can surface gaps and risks in a way users find actionable rather than noisy. | unknown | old validation docs | medium | high | critical |

### Trust, Safety, and Local-First Assumptions

| ID | Assumption | Status | Evidence Level | Uncertainty | Impact | Criticality |
| --- | --- | --- | --- | --- | --- | --- |
| A-TR-01 | Local-first storage, inspectability, and Git-friendly outputs are valued by the primary audience. | provisional | old product vision, principles | medium | high | critical |
| A-TR-02 | Explicit provider configuration and transmission disclosure increase trust enough to justify added friction. | unknown | privacy docs and principles | medium | medium | secondary |
| A-TR-03 | Safe defaults can coexist with useful progress; safeguards will not make the product feel blocked or bureaucratic. | unknown | principles and boundaries | high | high | critical |
| A-TR-04 | Users will trust documents more when uncertainty is visible rather than hidden. | unknown | success definition | high | high | critical |

### Market, Economics, and Distribution Assumptions

| ID | Assumption | Status | Evidence Level | Uncertainty | Impact | Criticality |
| --- | --- | --- | --- | --- | --- | --- |
| A-MK-01 | There are enough people with this pain to justify continued product development. | unknown | no external evidence yet | high | high | critical |
| A-MK-02 | The project can eventually find a sustainable model without violating Local First, Git Friendly, or user ownership. | unknown | boundaries | high | medium | secondary |
| A-MK-03 | Willingness to pay should be validated after problem, audience, workflow, and trust value are better supported. | provisional | validation strategy | medium | medium | secondary |
| A-MK-04 | Open-source positioning or local-first distribution may help adoption among the primary audience. | unknown | old open-source and product material | medium | medium | secondary |

### Technical and Operational Assumptions

| ID | Assumption | Status | Evidence Level | Uncertainty | Impact | Criticality |
| --- | --- | --- | --- | --- | --- | --- |
| A-TE-01 | Plain files, Markdown, YAML, JSON, and Git are sufficient foundations for useful structured documentation. | provisional | old principles and docs registry | medium | high | critical |
| A-TE-02 | The engine can keep canonical documents, structured state, derived artifacts, and AI output clearly separated. | unknown | principles and glossary | high | high | critical |
| A-TE-03 | The system can remain useful without complex multi-agent orchestration, cloud sync, or a marketplace in the initial product. | provisional | old scope and boundaries | medium | high | secondary |

## Critical Assumptions

Critical assumptions carry high uncertainty and high impact. They should feed directly into Hypotheses, Research Plan, Experiments, Evidence Log, and Decision Record.

### A-PR-04: The Problem Is Severe Enough to Change Behavior

If users experience ambiguity but do not care enough to change behavior, the project becomes intellectually useful but practically weak.

Evidence that would strengthen it:

- Users describe recent examples of ambiguity causing rework, delay, weak scoping, or bad decisions.
- Users already spend time or money on workarounds.
- Users are willing to pause execution to clarify decisions.

Evidence that would weaken it:

- Users agree in principle but continue preferring immediate building, generic AI chat, or ad hoc notes.

### A-SO-02: Conversation Can Produce Reliable Structured State

The project depends on extracting usable proposed decisions, assumptions, gaps, and open questions from AI-led conversation.

Evidence that would strengthen it:

- Real intake sessions produce decisions reviewers can trace to user answers.
- Users can confirm or correct proposed decisions without confusion.
- Generated documents reflect the structured state accurately.

Evidence that would weaken it:

- AI output frequently invents, overgeneralizes, or misclassifies decisions.
- Users cannot tell what came from them versus what came from the system.

### A-TH-02: Decisions Before Documents Creates More Value Than Documents Alone

If users only want polished prose, the central thesis is weakened.

Evidence that would strengthen it:

- Users value seeing decision status, assumptions, and gaps.
- Reviewers judge decision-derived documents more useful than a generic AI-written brief.

Evidence that would weaken it:

- Users prefer one-shot generated documents and ignore decision state.

### A-AU-02: The Primary Audience Will Adopt a New Workflow

The audience may value clarity but reject the process needed to produce it.

Evidence that would strengthen it:

- Users complete an intake session with their own project.
- Users return to revise decisions or regenerate documents.
- Users commit or preserve generated docs in their workspace.

Evidence that would weaken it:

- Users abandon the workflow because it is too heavy, too technical, or not obviously useful.

### A-TR-01: Local-First and Git-Friendly Outputs Matter

The project assumes local ownership is a strength, not merely an implementation detail.

Evidence that would strengthen it:

- Users prefer local files over hosted-only project state.
- Users inspect, edit, diff, or commit generated documents.

Evidence that would weaken it:

- Target users strongly prefer a managed SaaS dashboard and do not value local ownership.

## Secondary Assumptions

Secondary assumptions affect positioning, sequencing, product design, or tactics. They matter, but they should not block early validation unless new evidence raises their risk.

- **A-AU-04:** Non-technical and collaboration-heavy users can be deferred. If false, the product may need a different interface or hosted model, but the core thesis may still survive for another audience.
- **A-MK-02:** A sustainable model can be found without lock-in. If false, business strategy changes, but early validation can still test user value.
- **A-MK-03:** Willingness to pay should wait. If false, pricing research may need to start earlier, but not before problem evidence.
- **A-MK-04:** Open-source or local-first distribution may help adoption. If false, go-to-market changes, not the core thesis.
- **A-TE-03:** The initial product can avoid multi-agent orchestration, cloud sync, and marketplaces. If false, the roadmap changes, but the foundation thesis is not automatically invalidated.

These assumptions should be tracked in the Evidence Log when evidence appears, but they do not need to lead the first validation sequence.

## Unknowns

### Dangerous Unknowns Requiring Early Validation

- Whether target users describe the problem without being prompted by the solution.
- Whether users will complete a structured intake flow using a real project.
- Whether generated documents are judged more useful when tied to structured decisions.
- Whether the workflow creates clarity faster than it creates process burden.
- Whether local-first storage is valued or merely tolerated.
- Whether the broader project-type ambition holds outside the founder's app-based business origin case.

Resolution path:

- Convert each into explicit hypotheses.
- Test through problem/audience research and workflow prototype validation.
- Record evidence in Evidence Log.
- Capture validation decisions in Decision Record.

### Acceptable Unknowns for Now

- Exact pricing and monetization model.
- Hosted collaboration demand.
- Marketplace or plugin demand.
- Full profile expansion sequence.
- Long-term enterprise or non-technical user needs.
- Whether agent packs improve implementation outcomes.

Deferral rationale:

- These depend on earlier evidence about problem severity, audience fit, workflow value, and trust.
- Testing them too early would create evidence theater or pull the project toward premature product strategy.

## Dependency Between Assumptions

### Core Dependency Chain

```text
A-TH-01: Users start with ambiguous intent
→ A-PR-01: Ambiguity creates real pain
→ A-AU-02: A reachable audience wants a new workflow
→ A-SO-02: The workflow can convert conversation into structured state
→ A-TH-03: Structured state can generate useful canonical documentation
→ A-TR-01/A-TR-03: The workflow is trusted and acceptable
→ A-MK-01/A-MK-02: Continued product development is justified
```

### Important Dependency Relationships

- **Problem before solution:** A-SO assumptions should not be treated as validated until A-PR and A-AU assumptions have evidence.
- **Audience before economics:** A-MK-02 and A-MK-03 depend on A-AU-02 and A-SO-02.
- **Workflow before engineering:** A-TE-02 depends on evidence that users understand and value the separation between structured state, canonical documents, derived artifacts, and AI output.
- **Trust before scale:** A-MK-01 depends partly on A-TR assumptions because demand that requires boundary violations may not count as valid demand.
- **Generality after proof:** A-TH-04 depends on validating at least one concrete proving ground before broad profile expansion.

### Assumptions That Can Be Validated Independently

- A-TR-01 can be explored through user workflow preference interviews.
- A-PR-02 can be explored by studying current alternatives.
- A-TE-01 can be assessed through prototype/document workflow review.
- A-MK-04 can be explored later through distribution experiments.

## Assumptions That Can Kill the Project

### K-01: Users Do Not Experience the Problem Strongly Enough

**Related assumptions:** A-PR-01, A-PR-04.

**Why fatal:** If the problem is not meaningful, structured documentation becomes a nice artifact rather than a necessary tool.

**Evidence threshold:** Multiple target users fail to describe recent painful examples, current workarounds, or consequences.

**Invalidating condition:** Users consistently say the problem is interesting but not worth changing behavior for.

**Mitigation:** Narrow to a more painful audience, such as consultants or agencies.

**Pivot option:** Reframe around client scoping or documentation review if that pain is stronger.

**Decision gate:** Problem and Audience Evidence.

### K-02: Structured Decisions Do Not Improve Documentation Usefulness

**Related assumptions:** A-TH-02, A-TH-03, A-SO-04.

**Why fatal:** The founding thesis depends on decisions before documents.

**Evidence threshold:** Reviewers or users judge decision-derived documents no clearer or more actionable than generic AI-generated prose.

**Invalidating condition:** Users ignore decision state and only value polished output.

**Mitigation:** Reduce structure, improve review UX, or reposition around diagnostics.

**Pivot option:** Become a documentation review/diagnostic tool rather than a full intent-to-documentation engine.

**Decision gate:** Structured Decision Workflow.

### K-03: AI-Led Intake Cannot Produce Trustworthy Structured State

**Related assumptions:** A-SO-01, A-SO-02, A-SO-03.

**Why fatal:** The current product premise depends on AI-led conversation writing back into structured, auditable state.

**Evidence threshold:** Repeated intake sessions produce untraceable, inaccurate, or overconfident decision proposals.

**Invalidating condition:** Users or reviewers cannot reliably correct or confirm AI-proposed decisions.

**Mitigation:** Add stronger schemas, review gates, or narrower prompt contexts.

**Pivot option:** Use deterministic guided templates with optional AI support.

**Decision gate:** Structured Decision Workflow.

### K-04: The Workflow Requires Boundary Violations to Feel Useful

**Related assumptions:** A-TR-01, A-TR-03, A-TE-02.

**Why fatal:** If value depends on hidden remote state, autonomous decisions, or polished artifacts as source of truth, the project violates its principles.

**Evidence threshold:** Users only find the product compelling when it behaves like a hosted autonomous assistant or generic productivity suite.

**Invalidating condition:** Local-first, explicit, reviewable workflow is rejected by the intended audience as too burdensome.

**Mitigation:** Narrow audience to users who value local inspectability.

**Pivot option:** Reconsider project identity, but that would require revising Foundation boundaries.

**Decision gate:** Trust and Boundary Fit.

### K-05: No Reachable Audience Adopts the Workflow

**Related assumptions:** A-AU-01, A-AU-02, A-MK-01.

**Why fatal:** A real problem without reachable adoption cannot justify continued product development.

**Evidence threshold:** Target users recognize the problem but will not try the workflow with a real project.

**Invalidating condition:** All plausible early audiences prefer existing alternatives or require a different product category.

**Mitigation:** Narrow to a use case with higher urgency.

**Pivot option:** Focus on consultants/agencies, internal project scoping, or another audience where documentation pain is sharper.

**Decision gate:** Validation Phase Recommendation.

## Assumptions That Only Change Direction

These assumptions matter, but if false they change positioning, sequencing, or product shape rather than killing the project.

### D-01: App-Based Business Is the Best First Proving Ground

If false, the project may validate first with client scoping, internal initiatives, creator projects, research projects, or general software planning.

Affected downstream documents:

- Research Plan
- Experiments
- Product Brief
- Go-to-market Brief

### D-02: CLI/TUI Is the Right Initial Interface

If false, the project may still be valid but require a different first surface, such as an editor-integrated, web, or document-native workflow.

Affected downstream documents:

- Product Scope
- UX Model
- Engineering Brief

### D-03: Git Is Central Rather Than Merely Helpful

If false, the project may still remain local-first but support file-based workflows that do not presume Git.

Affected downstream documents:

- Product UX
- Engineering Standards
- Operations and support documentation

### D-04: Users Prefer AI-Led Conversation Over Structured Forms

If false, the project may need a hybrid workflow: deterministic structure first, AI assistance second.

Affected downstream documents:

- Product Requirements
- Interaction Model
- AI Behavior

### D-05: Broad Profile Expansion Should Happen Early

If false, the project should focus on one or a few proving profiles until the core model is stable.

Affected downstream documents:

- Product Roadmap
- Profile System
- Go-to-market Strategy

### D-06: Open Source Positioning Helps Adoption

If false, distribution and business model may change, but the core value of structured local documentation may remain.

Affected downstream documents:

- Business Model
- Go-to-market Strategy
- Operations

## Open Questions

- Which audience should provide the first real validation evidence?
- What is the smallest realistic intake flow that can test A-SO-02 without building the full product?
- How should reviewers compare decision-derived documentation against generic AI prose?
- What evidence would show that local-first is a valued property rather than an implementation preference?
- Which assumption should become the first hypothesis in `03-hypotheses.md`?
