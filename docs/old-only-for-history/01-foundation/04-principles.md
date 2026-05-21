# Design Principles

These principles govern LOGOS Engine decisions when two plausible directions conflict. They are not slogans. Each principle must be usable during review to choose, reject, revise, or defer a design, product, documentation, or agent behavior decision.

## Principle: Local First

### Meaning

Local First means the user's project knowledge should belong to the user's workspace before it belongs to any hosted service, remote provider, dashboard, or hidden runtime. Project answers, decisions, assumptions, generated documents, profile definitions, and reviewable state should be inspectable as local files whenever possible.

The principle is about local agency, not only local execution. The user should be able to understand what exists, where it is stored, what generated it, and what can be committed, reviewed, changed, or removed.

LOGOS Engine must not assume the repository's existing `docs/` folder is available for generated project documentation. Many projects already use `docs/` for their own documentation. The default LOGOS documentation root should therefore be `logos/`, and the user should be able to configure a different folder when the project needs another location.

### Decision Rule

When local control conflicts with hosted convenience, favor local control unless the user has explicitly chosen the hosted behavior and can inspect what will leave the workspace.

### Acceptable Trade-offs

- Accept less polished collaboration in the first version to preserve local ownership.
- Accept text-based files over richer hosted interfaces when the richer interface would make state opaque.
- Accept explicit provider configuration before AI features that send project context outside the machine.
- Accept slower onboarding if the alternative hides where project knowledge lives.
- Accept a dedicated configurable LOGOS documentation root instead of writing into an existing `docs/` folder by default.

### Violations

- Requiring a cloud account before the user can clarify and document a project.
- Treating remote storage as the canonical source of project decisions.
- Sending project answers, assumptions, source context, or file paths to a provider without explicit configuration and disclosure.
- Making generated documentation available only through a hosted interface.
- Hiding workspace state in a format the user cannot reasonably inspect, diff, or remove.
- Writing generated LOGOS documentation into an existing project documentation folder without explicit configuration and confirmation.

### Downstream Implications

- Product should prioritize local project initialization, local state, local documents under a configurable LOGOS documentation root, and explicit provider configuration.
- Engineering should favor plain files, predictable directories, and opt-in remote calls.
- Operations should avoid telemetry, phone-home behavior, and default cloud dependency unless the user explicitly enables them.
- Documentation should explain local ownership and remote-provider boundaries clearly.

### Tensions

- Local First can slow cloud collaboration and multi-device convenience.
- Local First can make setup feel more technical for non-technical users.
- Local First must be balanced with Safe by Default so local files do not accidentally expose secrets through Git.

## Principle: Structure Over Presentation

### Meaning

Structure Over Presentation means durable project structure has priority over attractive outputs. The system should first clarify decisions, sections, dependencies, assumptions, and review rules; only then should it generate polished Markdown, HTML views, agent packs, or other presentation artifacts.

Presentation is useful when it helps a user review, navigate, or act on structured knowledge. It becomes misleading when it makes weak reasoning look complete.

### Decision Rule

When durable structure conflicts with visual polish or artifact convenience, favor the structure that preserves source-of-truth clarity and regeneration.

### Acceptable Trade-offs

- Accept simpler-looking documents when they better expose decisions, assumptions, risks, and open questions.
- Accept generated HTML or agent outputs as derived artifacts, not canonical sources.
- Accept more explicit document contracts when they make review and regeneration more reliable.
- Accept less decorative output if decoration obscures document quality.

### Violations

- Treating a beautiful generated page as proof that the underlying thinking is sound.
- Editing derived artifacts as the source of truth when canonical Markdown or YAML exists.
- Generating documents that read well but hide missing decisions or unresolved assumptions.
- Prioritizing layout, tone, or visual completeness over section validity and traceability.
- Creating presentation artifacts that cannot be regenerated from canonical sources.

### Downstream Implications

- YAML should define structure, metadata, dependencies, sections, quality gates, and agent instructions.
- Markdown should carry canonical human-readable project content under the configured LOGOS documentation root.
- HTML artifacts should remain derived views for review and navigation.
- Agent packs should be generated from canonical documents and document contracts, not from ad hoc presentation state.

### Tensions

- Structure Over Presentation can make early artifacts feel less impressive.
- It can conflict with user motivation if the user expects polished deliverables immediately.
- It must be balanced with usability: structure should be visible and useful, not bureaucratic.

## Principle: Explicit Over Assumed

### Meaning

Explicit Over Assumed means the system should name decisions, assumptions, hypotheses, risks, dependencies, uncertainty, and open questions instead of letting them remain implicit inside prose, prompts, or AI output.

Explicitness is not verbosity. The goal is to make the important things reviewable and actionable, not to document everything endlessly.

### Decision Rule

When speed or brevity conflicts with reviewable clarity, make the decision, assumption, risk, or uncertainty explicit.

### Acceptable Trade-offs

- Accept slightly slower intake when a missing decision would create downstream rework.
- Accept marked incompleteness instead of fake certainty.
- Accept visible assumptions even when they make a document feel less finished.
- Accept concise metadata when it improves review, validation, or agent reliability.

### Violations

- Converting an assumption into a fact.
- Allowing AI to infer a decision silently from vague context.
- Generating confident prose when required information is missing.
- Hiding dependencies between decisions and documents.
- Treating "unknown" as a failure instead of a valid state.
- Collapsing facts, assumptions, hypotheses, risks, and open questions into one undifferentiated narrative.

### Downstream Implications

- Intake should allow "I do not know yet" and store it meaningfully.
- Generated documents should mark assumptions, open questions, risks, and dependencies.
- Review workflows should flag hidden assumptions and unsupported claims.
- Agent outputs should be grounded in confirmed decisions or clearly labeled uncertainty.
- Validation should classify gaps by severity instead of merely counting completed fields.

### Tensions

- Explicit Over Assumed can make documents longer.
- It can conflict with readability if every uncertainty is repeated without structure.
- It must be balanced with Structure Over Presentation so explicitness appears in a usable form.

## Principle: Git Friendly

### Meaning

Git Friendly means project knowledge should be easy to version, diff, review, revert, and discuss. The system should produce text-based, stable, predictable outputs that work naturally inside repositories and IDEs.

This principle is not merely "use Git." It means generated state, canonical documents, and profile definitions should respect the review habits and failure modes of Git-based work.

### Decision Rule

When Git-friendly formats conflict with rich presentation or convenience, favor formats and workflows that preserve readable diffs, stable history, and reversible change.

### Acceptable Trade-offs

- Accept Markdown, YAML, and JSON over opaque binary formats for canonical state.
- Accept derived presentation artifacts only when they can be regenerated from canonical sources.
- Accept more predictable file structures even if a dynamic interface would feel smoother.
- Accept explicit generated markers or provenance metadata when they reduce review ambiguity.

### Violations

- Storing canonical decisions only in a database, binary file, hidden cache, or remote service.
- Producing noisy diffs that obscure meaningful project changes.
- Rewriting large documents unnecessarily when only one decision changed.
- Making manual edits to generated outputs when canonical sources exist.
- Committing secrets, raw provider tokens, or sensitive transient state.
- Generating files whose source, purpose, or regeneration rule is unclear.

### Downstream Implications

- File names, folders, and document ids should be stable.
- The default LOGOS documentation root should be `logos/`, with user configuration available for projects that need a different path.
- Generated changes should be reviewable in ordinary diffs.
- Manual content should not be overwritten without warning.
- Sensitive local configuration should be excluded from tracked files by default.
- Derived artifacts should have clear regeneration rules.

### Tensions

- Git Friendly can constrain rich media, dashboards, and interactive artifacts.
- It can conflict with convenience when users expect state to synchronize automatically.
- It must be balanced with Local First and Safe by Default so local ownership does not create accidental exposure.

## Principle: AI as a Layer

### Meaning

AI as a Layer means AI participates in questioning, interpretation, drafting, diagnosis, and review, but it is not the source of truth. The source of truth is the canonical project state: confirmed decisions, assumptions, document contracts, review rules, and canonical Markdown.

AI should help the user think, not silently replace the user's judgment. It may suggest, challenge, summarize, and draft, but it must remain bounded by structure, provenance, and review.

When the project is already advanced through several phases, AI may use confirmed decisions, active assumptions, open questions, and completed documents to offer contextual suggestions alongside the next relevant questions. These suggestions are allowed only when the next question has a direct dependency on earlier work, and they must remain visibly proposed until the user accepts, revises, rejects, or ignores them.

### Decision Rule

When AI convenience conflicts with auditability, user control, or canonical structure, favor auditability, user control, and canonical structure.

### Acceptable Trade-offs

- Accept user confirmation steps when AI proposes decisions.
- Accept slower generation when structured output validation prevents unreliable documents.
- Accept visible AI limitations instead of pretending the system knows more than it does.
- Accept deterministic or incomplete behavior when no AI provider is configured, rather than hiding remote dependencies.
- Accept source-labeled contextual suggestions when they reduce repeated work without turning prior assumptions into new facts.

### Violations

- Treating AI-generated text as confirmed project truth without review.
- Keeping important project state only in chat history.
- Allowing AI output to override prior confirmed decisions without surfacing the conflict.
- Hiding AI assumptions inside generated documents.
- Making normal project progress depend on uninspectable prompts or provider behavior.
- Letting AI make autonomous project decisions on behalf of the user.
- Presenting a contextual suggestion as the expected answer instead of an optional proposed answer.

### Downstream Implications

- Prompts should be grounded in profile definitions, confirmed decisions, assumptions, open questions, and document contracts.
- AI outputs should be parsed, validated, and reviewable before becoming canonical.
- Contextual suggestions should cite or identify the prior decisions, assumptions, documents, or gaps that make the suggestion plausible.
- Agent packs should derive from canonical documents, not from private conversational memory.
- UX should make clear when content is proposed, confirmed, incomplete, or uncertain.
- Provider configuration and transmission disclosure should be explicit.

### Tensions

- AI as a Layer can reduce automation speed.
- It can make the system feel less magical because review and confirmation remain visible.
- It must be balanced with the user's desire for conversational flow so the experience does not become a deterministic questionnaire.

## Principle: Safe by Default

### Meaning

Safe by Default means the system should preserve user agency, data control, reversibility, and truthfulness under uncertainty. It should choose conservative defaults for destructive actions, sensitive context, remote calls, generated changes, and AI confidence.

Safety does not mean refusing to help. It means making useful progress without hiding risk, overwriting important work, leaking private context, or creating false certainty.

### Decision Rule

When safety conflicts with speed, autonomy, or convenience, favor the safer path unless the user has explicitly accepted the risk.

### Acceptable Trade-offs

- Accept confirmation prompts for destructive or externally visible actions.
- Accept incomplete generated sections when the alternative would invent facts.
- Accept opt-in provider configuration before sending project context to remote AI.
- Accept warnings and diagnostics when decisions are missing, contradictory, or high-risk.
- Accept conservative defaults even if they require one more user action.

### Violations

- Overwriting manual content without warning.
- Sending project context, file paths, or sensitive data to remote providers without explicit configuration.
- Making irreversible changes without confirmation.
- Presenting uncertain AI output as authoritative.
- Hiding contradictions, risks, or missing required decisions.
- Blocking all progress merely because some information is unknown.
- Shaming the user for uncertainty or incomplete answers.

### Downstream Implications

- Product should support skip, assumption marking, review, diagnostics, and save-and-continue behavior.
- Engineering should make destructive operations explicit and reversible where possible.
- Operations should avoid telemetry and surprise network behavior.
- AI behavior should avoid fake certainty and identify missing context.
- Documentation should preserve open questions and risks instead of smoothing them away.

### Tensions

- Safe by Default can slow expert users who want rapid automation.
- It can conflict with proactive agent behavior when the system is uncertain.
- It must be balanced with usefulness so safety does not become paralysis.

## Principle Tensions and Precedence

These principles intentionally create tension. The project should surface those tensions rather than hide them.

When principles conflict, use this precedence order:

1. Safe by Default overrides speed, convenience, and automation.
2. Local First overrides hosted convenience unless the user explicitly opts in.
3. Explicit Over Assumed overrides brevity when a hidden assumption could affect downstream decisions.
4. Structure Over Presentation overrides visual polish when presentation could hide weak reasoning.
5. Git Friendly constrains canonical state and generated outputs whenever reviewability or reversibility is at risk.
6. AI as a Layer constrains AI behavior whenever generated output could be mistaken for confirmed truth.

Common tensions:

- Local First versus collaboration: the system should not solve cloud collaboration before proving local structured documentation.
- Structure Over Presentation versus user delight: artifacts should be usable and clear, but polish must not hide missing decisions.
- Explicit Over Assumed versus simplicity: explicitness should be structured and concise, not noisy.
- Git Friendly versus rich artifacts: rich artifacts may exist, but canonical truth should remain text-based and regenerable.
- AI as a Layer versus automation: AI should reduce cognitive load without taking ownership away from the user.
- Safe by Default versus momentum: the system should preserve progress while making risk visible.

## Open Questions

- How much explicitness can the primary audience tolerate before the process feels heavy?
- Which actions should require confirmation in V1 versus later versions?
- How should the system present principle violations during document review?
- Which derived artifacts should be generated by default, and which should remain opt-in?
- How should these principles adapt when future profiles support project types beyond the initial app-based business origin case?
