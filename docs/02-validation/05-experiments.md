# Experiments

This document registers the validation experiments that LOGOS Engine should run, why each experiment exists, what hypothesis it tests, what evidence it will collect, and what decision it will inform.

All experiments are currently **planned** unless explicitly marked otherwise. No results, sample sizes, metrics, participant behavior, or conclusions are claimed in this document.

The central question is:

> What experiments will be run, and what decisions will their results inform?

## Experiment Register

The register separates experiment design from results. Success and failure criteria must be defined before evidence is collected and must not be rewritten after results are known.

| ID | Title | Status | Linked Hypotheses | Decision Gate | Method | Target Audience | Expected Duration | Dependencies | Result Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EXP-01 | Problem and Current Workflow Interview Batch | planned | H-PR-01, H-PR-02, H-PR-03, H-BE-01, H-AU-01 | Gate 2: Problem and Audience Evidence | Structured problem interviews plus artifact review | Technical or product-adjacent builders starting meaningful projects | 1 to 2 weeks after recruitment starts | Research plan, participant screener, consent note | not started |
| EXP-02 | Cross-Context Generality Check | planned | H-AU-02, H-AU-03 | Gate 2: Problem and Audience Evidence | Interviews and artifact review across non-app project types | Builders, consultants, creators, maintainers, or internal initiative owners outside the app-business origin case | 1 to 2 weeks | EXP-01 recruitment pipeline or parallel participant sourcing | not started |
| EXP-03 | Before/After Clarity Artifact Test | planned | H-BE-03, H-SO-03 | Gate 3: Structured Decision Workflow | Compare starting notes, generic AI prose, and decision-derived documentation | Participants with a real project and existing notes or artifacts | 1 week per batch | Evidence of problem pain; safe artifact handling | not started |
| EXP-04 | Concierge Intake and Decision Review Session | planned | H-BE-02, H-SO-01, H-SO-02, H-SO-06 | Gate 3: Structured Decision Workflow | Guided or prototype intake using a real project, followed by decision review | Primary audience participants with decision authority | 60 to 90 minutes per session | Early problem evidence; intake script or prototype; consent | not started |
| EXP-05 | Diagnostic Actionability Review | planned | H-SO-04, H-BE-02, H-SO-06 | Gate 3: Structured Decision Workflow | Present diagnostics for a real or representative project and observe next-action interpretation | Participants who have project artifacts or completed intake | 30 to 45 minutes per session | Diagnostic examples or prototype output | not started |
| EXP-06 | Local-First Trust and Setup Friction Review | planned | H-SO-05, H-SO-06, H-AD-03 | Gate 4: Trust and Boundary Fit | Guided review of local files, Markdown output, provider disclosure, and setup steps | Primary audience participants near repositories, IDEs, Git, or text-based workflows | 45 to 60 minutes per session | Prototype or clickable walkthrough; privacy explanation | not started |
| EXP-07 | Positioning Comprehension Test | planned | H-AD-01, H-AD-02 | Later adoption gate | Compare pain-specific framing with generic AI documentation framing | Participants who match the early audience or adjacent audiences | 1 week | Problem and audience evidence from EXP-01 and EXP-02 | not started |
| EXP-08 | Follow-Up Use Trigger Probe | planned | H-RE-01, H-RE-02 | Later retention gate | Follow-up interviews or lightweight longitudinal use | Participants who complete a workflow experiment | 2 to 4 weeks after first session | At least one completed workflow session | not started |
| EXP-09 | Value and Willingness-to-Pay Interview | deferred | H-WP-01, H-WP-02 | Later economic gate | Value interview after demonstrated workflow value | Users who experienced clarity value or buyers responsible for scoping/documentation cost | deferred | Evidence from problem and workflow experiments | not started |

### Status Definitions

- **planned:** experiment is designed but not started.
- **active:** evidence collection has begun.
- **paused:** experiment started but is waiting on a blocker.
- **completed:** evidence collection and synthesis are complete.
- **inconclusive:** evidence was collected but cannot support a decision.
- **invalidated:** the experiment design or execution failed to produce usable evidence.
- **cancelled:** the experiment is no longer worth running because upstream evidence changed.

## Active Experiments

No experiments are active yet.

An experiment should not become active until it has:

- A named owner or responsibility model.
- Participant criteria and recruitment source.
- Consent and privacy handling.
- Predefined success, failure, and stopping criteria.
- A data capture format linked to hypotheses.
- A clear Evidence Log handoff path.

Interim signals must not be interpreted as validation results unless explicitly marked as interim and limited.

## Planned Experiments

### EXP-01: Problem and Current Workflow Interview Batch

**Status:** planned.

**Linked hypotheses:** H-PR-01, H-PR-02, H-PR-03, H-BE-01, H-AU-01.

**Linked assumptions:** A-TH-01, A-PR-01, A-PR-02, A-PR-04, A-AU-01, A-AU-02.

**Decision gate:** Gate 2: Problem and Audience Evidence.

**Method:** structured problem interviews with current workflow and artifact review.

**Target audience:** technical or product-adjacent builders starting, restarting, scoping, or clarifying meaningful projects. Participants may include technical founders, product-oriented developers, indie builders, consultants, agency operators, creators, educators, or small-team operators.

**Participant criteria:**

- Participant has a recent or active project-start situation.
- Participant has enough decision authority to discuss scope, purpose, audience, or execution direction.
- Participant has used some workaround such as notes, AI chat, templates, docs, tasks, diagrams, or immediate building.
- Participant can discuss the project safely without exposing sensitive information.

**Protocol:**

1. Confirm consent, privacy boundary, and note-taking permission.
2. Ask the participant to describe a recent project-start situation before introducing LOGOS Engine.
3. Ask what was clear, unclear, assumed, or unresolved at the beginning.
4. Review any current artifacts the participant is willing to show or describe.
5. Ask what ambiguity cost them in time, rework, delay, confidence, scope, or handoff quality.
6. Ask what current alternatives helped and where they failed.
7. Capture contradictions and examples that weaken the thesis.
8. Do not pitch the solution until after problem evidence has been collected.

**Success criteria:**

- Multiple participants describe recent ambiguity before solution exposure.
- At least some participants connect ambiguity to meaningful consequences such as rework, delay, weak scoping, inconsistent docs, hidden assumptions, or late constraint discovery.
- Participants show or describe active workarounds.
- Evidence identifies a plausible early audience segment and current workflow context.

**Failure criteria:**

- Participants cannot describe concrete ambiguity.
- Ambiguity is described as mild, normal, or not worth changing behavior for.
- Current alternatives already solve the problem well enough.
- The strongest-pain participants do not resemble the initial audience or require a product boundary the project has deferred.

**Stopping criteria:**

- Stop when enough evidence exists to decide whether to proceed to workflow validation, narrow the audience, revise the problem, or stop.
- Stop early if repeated participants fail to recognize the problem.

**Data collected:** session notes, participant profile, project type, current artifacts, raw observations, quotes with consent, current alternatives, consequences, linked hypotheses, contradictions, evidence strength.

**Instrumentation:** research note template from Research Plan; Evidence Log entries after each batch.

**Ethics and consent:** notes-only by default; recordings require explicit consent; sensitive project details must be anonymized.

**Expected duration:** 1 to 2 weeks after recruitment starts.

**Owner:** founder/user or assigned researcher.

**Dependencies:** Research Plan, participant screener, consent note, evidence capture format.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** qualitative evidence cannot prove market scale; participants may be biased toward people willing to discuss planning.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

### EXP-02: Cross-Context Generality Check

**Status:** planned.

**Linked hypotheses:** H-AU-02, H-AU-03.

**Linked assumptions:** A-TH-04, A-AU-01, A-TE-03.

**Decision gate:** Gate 2: Problem and Audience Evidence.

**Method:** cross-context interviews and artifact review with project types outside the app-business origin case.

**Target audience:** people working on client scoping, internal initiatives, research projects, open-source direction, content products, courses, communities, or non-app software planning.

**Participant criteria:**

- Participant is working on a meaningful project that requires structured documentation before execution.
- Project type is not merely the founder's app-based business origin case.
- Participant has enough project responsibility to evaluate ambiguity and documentation usefulness.

**Protocol:**

1. Use the same problem-first interview structure as EXP-01.
2. Identify whether ambiguity appears in the same categories: purpose, audience, problem, scope, assumptions, constraints, risks, success criteria, or next steps.
3. Review current artifacts or workflows when available.
4. Ask what kind of documentation would help before execution.
5. Compare evidence against app-business-origin assumptions.

**Success criteria:**

- At least one non-app project type shows similar ambiguity and documentation pain.
- The participant can explain why structured decisions before documentation would be useful.
- The evidence supports a behavioral audience definition rather than a hard domain boundary.

**Failure criteria:**

- Non-app contexts do not show similar pain.
- The workflow appears valuable only for app-business creation.
- The broader framing becomes too vague to guide product decisions.

**Stopping criteria:**

- Stop when the project can decide whether to keep broad framing, narrow to a first profile, or defer generality claims.

**Data collected:** project type, ambiguity pattern, artifacts, current workflow, contrast with app-business origin, linked hypotheses, contradictions.

**Instrumentation:** research note template; cross-context comparison table in Evidence Log.

**Ethics and consent:** anonymize sensitive project and client details.

**Expected duration:** 1 to 2 weeks.

**Owner:** founder/user or assigned researcher.

**Dependencies:** participant sourcing outside the origin case; EXP-01 may run in parallel.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** small cross-context samples can suggest generality but cannot prove broad applicability.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

### EXP-03: Before/After Clarity Artifact Test

**Status:** planned.

**Linked hypotheses:** H-BE-03, H-SO-03.

**Linked assumptions:** A-TH-02, A-TH-03, A-PR-03, A-SO-04.

**Decision gate:** Gate 3: Structured Decision Workflow.

**Method:** compare project starting artifacts against generic AI prose and decision-derived documentation.

**Target audience:** participants with a real project, current notes or planning artifacts, and willingness to review anonymized or non-sensitive outputs.

**Participant criteria:**

- Participant has starting notes, AI chat, template docs, task lists, or other pre-existing artifacts.
- Participant can identify what makes documentation useful for execution.
- Participant can safely share or describe enough context for a comparison.

**Protocol:**

1. Capture the starting artifact or a sanitized summary.
2. Create or collect a generic AI-written documentation sample for the same project input.
3. Create or collect a decision-derived documentation sample that exposes decisions, assumptions, gaps, risks, and next actions.
4. Ask the participant to compare the artifacts without leading them toward the preferred one.
5. Ask what changed in clarity, actionability, traceability, trust, and readiness.
6. Ask which artifact they would use for a real next step and why.

**Success criteria:**

- Participants identify concrete clarity improvements in decision-derived documentation.
- Participants notice explicit assumptions, gaps, risks, decision status, or next actions as useful.
- Participants can distinguish polish from execution readiness.
- Reviewer assessment agrees that structured documentation better reflects project reasoning.

**Failure criteria:**

- Participants prefer generic prose mainly because it is polished or shorter.
- Decision-derived documentation is no clearer or feels too heavy.
- Participants cannot identify any change in decisions, assumptions, or next actions.
- The comparison cannot be made safely because project context is too sensitive or incomplete.

**Stopping criteria:**

- Stop when the project can decide whether structured documents are valuable enough to continue.
- Stop or redesign if the artifact comparison itself biases participants too strongly.

**Data collected:** artifact versions, participant rankings, raw observations, clarity criteria, preferred next-step artifact, contradictions, reviewer notes.

**Instrumentation:** artifact comparison rubric; Evidence Log entries linked to H-BE-03 and H-SO-03.

**Ethics and consent:** use sanitized artifacts where needed; do not expose private project content to remote AI without explicit consent.

**Expected duration:** 1 week per batch.

**Owner:** founder/user or assigned researcher.

**Dependencies:** enough problem evidence to justify solution comparison; safe document generation or concierge artifact preparation.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** artifact preference does not prove sustained behavior or retention.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

### EXP-04: Concierge Intake and Decision Review Session

**Status:** planned.

**Linked hypotheses:** H-BE-02, H-SO-01, H-SO-02, H-SO-06.

**Linked assumptions:** A-SO-01, A-SO-02, A-SO-03, A-TR-03, A-TR-04.

**Decision gate:** Gate 3: Structured Decision Workflow.

**Method:** guided or prototype intake session using a real project, followed by decision review.

**Target audience:** primary audience participants with a real project and decision authority.

**Participant criteria:**

- Participant has project ambiguity that was already evidenced or screened.
- Participant can spend 60 to 90 minutes in a guided session.
- Participant can review proposed decisions, assumptions, open questions, and risks.

**Protocol:**

1. Begin from the participant's real project context.
2. Run a short AI-led or concierge-led intake flow.
3. Capture answers, assumptions, open questions, and proposed decisions.
4. Present proposed decisions separately from confirmed decisions.
5. Ask the participant to confirm, reject, revise, or defer proposals.
6. Observe whether missing decisions cause the participant to pause execution, revise scope, or identify next questions.
7. Capture friction, confusion, trust, and unsafe interpretation.

**Success criteria:**

- Intake produces traceable proposed decisions, assumptions, gaps, and open questions.
- Participant can correctly understand proposed versus confirmed decision status.
- Participant meaningfully revises, rejects, confirms, or defers at least some output when appropriate.
- Participant identifies a missing decision or assumption that affects the project.
- Safeguards improve trust without making the workflow feel intolerably heavy.

**Failure criteria:**

- Output is generic, invented, untraceable, or overconfident.
- Participant treats proposed decisions as final.
- Participant cannot correct or review decision output reliably.
- The session creates more process burden than clarity.
- The participant prefers to continue execution despite exposed critical gaps.

**Stopping criteria:**

- Stop when the project can decide whether AI-led intake and decision review are viable.
- Stop early if the workflow repeatedly creates false confidence or unsafe decision ownership.

**Data collected:** intake transcript or notes, proposed decisions, participant edits, decision status comprehension, observed friction, trust reactions, linked evidence.

**Instrumentation:** session note, decision review checklist, optional screen recording with consent.

**Ethics and consent:** participant must understand whether AI or concierge assistance is being used; sensitive content must be minimized.

**Expected duration:** 60 to 90 minutes per session.

**Owner:** founder/user or assigned researcher.

**Dependencies:** problem evidence, intake script or prototype, privacy-safe data handling.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** concierge execution may overstate product capability; prototype execution may understate future workflow quality.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

### EXP-05: Diagnostic Actionability Review

**Status:** planned.

**Linked hypotheses:** H-SO-04, H-BE-02, H-SO-06.

**Linked assumptions:** A-SO-05, A-TR-03, A-TR-04.

**Decision gate:** Gate 3: Structured Decision Workflow.

**Method:** diagnostic output review using a real or representative project.

**Target audience:** participants with project artifacts, completed intake output, or representative project context.

**Participant criteria:**

- Participant can understand the project context being diagnosed.
- Participant has authority or enough context to judge whether a gap matters.
- Participant can explain what next action they would take.

**Protocol:**

1. Present diagnostic output that includes missing decisions, open assumptions, risks, affected documents, and recommended next questions.
2. Ask the participant to explain the diagnostic in their own words.
3. Ask which items are useful, obvious, noisy, wrong, or missing.
4. Ask what next action they would take, if any.
5. Observe whether severity labels help or confuse.
6. Record which diagnostics would change behavior.

**Success criteria:**

- Participant can explain the diagnostic meaning accurately.
- Participant identifies at least one reasonable next action.
- Diagnostics surface gaps, risks, or contradictions that matter to the project.
- Severity labels help prioritize without creating false authority.

**Failure criteria:**

- Diagnostics feel vague, obvious, noisy, or disconnected from action.
- Participant cannot tell what is missing, risky, assumed, or blocked.
- Diagnostics pressure the participant into fake certainty.
- Diagnostic output is treated as authoritative rather than advisory.

**Stopping criteria:**

- Stop when the project can decide whether diagnostics are core, secondary, or need redesign.

**Data collected:** diagnostic output, participant interpretation, next action chosen, usefulness rating with explanation, observed confusion, contradiction flags.

**Instrumentation:** diagnostic review rubric; Evidence Log entries linked to H-SO-04.

**Ethics and consent:** diagnostics must not expose sensitive project details unnecessarily.

**Expected duration:** 30 to 45 minutes per session.

**Owner:** founder/user or assigned researcher.

**Dependencies:** diagnostic examples or prototype output.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** static diagnostics may not reflect the full value of an interactive workflow.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

### EXP-06: Local-First Trust and Setup Friction Review

**Status:** planned.

**Linked hypotheses:** H-SO-05, H-SO-06, H-AD-03.

**Linked assumptions:** A-TR-01, A-TR-02, A-TR-03, A-TE-01.

**Decision gate:** Gate 4: Trust and Boundary Fit.

**Method:** guided review of local files, Markdown output, Git-friendly changes, provider disclosure, and setup steps.

**Target audience:** primary audience participants who work near local files, repositories, IDEs, terminal, or Markdown.

**Participant criteria:**

- Participant can understand a local project folder or repository workflow.
- Participant has some experience with text-based project artifacts.
- Participant is willing to discuss trust, privacy, setup friction, and remote provider boundaries.

**Protocol:**

1. Show or guide the participant through a local workspace shape.
2. Show canonical Markdown, structured state, and derived artifact concepts.
3. Explain provider disclosure and local-only versus remote-provider behavior.
4. Ask which parts increase trust, which create friction, and which are unnecessary.
5. Observe whether the participant values inspectability, diffs, editability, and ownership.
6. Ask what setup step would cause abandonment before value.

**Success criteria:**

- Participant values local ownership, inspectability, Markdown, diffs, or Git-friendly output.
- Participant understands the difference between local state, generated documents, and remote AI operations.
- Setup friction is acceptable if clarity value is visible.
- Provider disclosure increases trust more than it creates confusion.

**Failure criteria:**

- Participant strongly prefers hosted state as canonical.
- Local files and Git-friendly output are irrelevant to the strongest-pain audience.
- Setup or provider configuration prevents participants from reaching value.
- Trust requires boundary violations such as hidden remote processing or automatic decisions.

**Stopping criteria:**

- Stop when the project can decide whether local-first remains a product strength for the early audience.

**Data collected:** setup friction notes, trust reactions, privacy concerns, local-first preference evidence, abandonment thresholds, boundary concerns.

**Instrumentation:** walkthrough checklist; optional setup observation notes.

**Ethics and consent:** do not ask participants to expose real secrets, tokens, repository paths, or private files.

**Expected duration:** 45 to 60 minutes per session.

**Owner:** founder/user or assigned researcher.

**Dependencies:** prototype, mock workspace, or concrete walkthrough material.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** stated trust preferences must be weighed against observed behavior.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

### EXP-07: Positioning Comprehension Test

**Status:** planned.

**Linked hypotheses:** H-AD-01, H-AD-02.

**Linked assumptions:** A-MK-04, A-TH-02, A-TH-04, A-TE-03.

**Decision gate:** later adoption gate.

**Method:** compare pain-specific framing against generic AI documentation framing.

**Target audience:** validated or likely early audience participants.

**Participant criteria:**

- Participant matches emerging audience evidence.
- Participant has not been overexposed to the internal thesis.
- Participant can explain what they think the product does after seeing a short message.

**Protocol:**

1. Present one positioning message at a time.
2. Ask the participant to explain the product in their own words.
3. Ask what problem they think it solves.
4. Ask who they think it is for.
5. Ask what they would expect to happen in the workflow.
6. Compare comprehension, perceived relevance, and risk of generic AI-docs interpretation.

**Success criteria:**

- Pain-specific framing leads participants to describe missing decisions, pre-execution clarity, or structured documentation.
- Participants understand a concrete proving profile more easily than broad generic coverage.
- Participants do not reduce the product to generic AI writing.

**Failure criteria:**

- Participants understand only generic document generation.
- Pain-specific framing is confusing or too narrow.
- Concrete profile framing makes the product seem permanently domain-locked.

**Stopping criteria:**

- Stop when positioning can inform later go-to-market and onboarding language.

**Data collected:** message variant, participant paraphrase, relevance signal, confusion points, category interpretation.

**Instrumentation:** message testing note template.

**Ethics and consent:** avoid implying that unvalidated capabilities already exist.

**Expected duration:** 1 week after upstream evidence.

**Owner:** founder/user or assigned researcher.

**Dependencies:** problem and audience evidence from EXP-01 and EXP-02.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** comprehension does not equal adoption or payment.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

### EXP-08: Follow-Up Use Trigger Probe

**Status:** planned.

**Linked hypotheses:** H-RE-01, H-RE-02.

**Linked assumptions:** A-AU-02, A-SO-04, A-TH-03, A-TE-02.

**Decision gate:** later retention gate.

**Method:** follow-up interview or lightweight longitudinal use after a workflow experiment.

**Target audience:** participants who completed a workflow session and have a project likely to change over time.

**Participant criteria:**

- Participant completed a prior experiment involving documentation, intake, or diagnostics.
- Participant has a project with changing decisions, open questions, or next-stage planning.

**Protocol:**

1. Follow up after a defined delay.
2. Ask what changed in the project since the session.
3. Ask whether they used, edited, shared, committed, or revisited the generated documentation.
4. Ask what would trigger them to return.
5. If possible, observe whether they revise decisions or regenerate documents.

**Success criteria:**

- Participant identifies real decision changes or new gaps that would make them return.
- Participant used or preserved documentation after the first session.
- Ongoing value is tied to living decision state, diagnostics, or regeneration rather than novelty.

**Failure criteria:**

- Participant treats output as a one-time document bundle.
- Participant does not return when decisions change.
- The only remembered value is polished output or novelty.

**Stopping criteria:**

- Stop when there is enough evidence to decide whether retention should be designed around decision changes, document refresh, diagnostics, or another trigger.

**Data collected:** follow-up notes, project changes, document use, return triggers, retention blockers, evidence of decision revision.

**Instrumentation:** follow-up session template; optional document diff or participant-reported use.

**Ethics and consent:** do not ask participants to reveal private project changes beyond the research scope.

**Expected duration:** 2 to 4 weeks after first session.

**Owner:** founder/user or assigned researcher.

**Dependencies:** completed workflow experiment.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** early retention probes are directional and cannot establish long-term retention.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

### EXP-09: Value and Willingness-to-Pay Interview

**Status:** deferred.

**Linked hypotheses:** H-WP-01, H-WP-02.

**Linked assumptions:** A-MK-02, A-MK-03.

**Decision gate:** later economic gate.

**Method:** value and willingness-to-pay interviews after demonstrated workflow value.

**Target audience:** users who experienced validated clarity value or buyers responsible for project scoping, documentation, discovery, or reduced rework.

**Participant criteria:**

- Participant has seen or experienced the workflow value.
- Participant can discuss budget, avoided cost, saved time, paid alternatives, or procurement context.

**Protocol:**

1. Review the value experienced or observed.
2. Ask what cost, risk, or effort the workflow could reduce.
3. Ask what alternatives are currently paid for.
4. Ask who would pay and who would benefit.
5. Avoid asking abstract "would you pay?" questions without context.

**Success criteria:**

- Participant can connect value to avoided cost, saved time, better scoping, reduced rework, or improved decision quality.
- A plausible buyer or budget context emerges.
- Payment interest is grounded in demonstrated value, not concept praise.

**Failure criteria:**

- Users value the output but would not allocate money, time, trust, or workflow change.
- Buyer and user cannot be identified.
- Pricing discussion pulls the product toward boundary violations.

**Stopping criteria:**

- Do not run until problem, audience, and workflow value have stronger evidence.

**Data collected:** value driver, buyer/user distinction, paid alternatives, budget context, objections, boundary risks.

**Instrumentation:** value interview template.

**Ethics and consent:** be clear that pricing and packaging are exploratory.

**Expected duration:** deferred.

**Owner:** founder/user or assigned researcher.

**Dependencies:** evidence from EXP-01 through EXP-06.

**Result:** not started.

**Interpretation:** none yet.

**Confidence:** none yet.

**Limitations:** willingness-to-pay evidence is weak before real product value is experienced.

**Decision:** pending.

**Evidence Log refs:** pending.

**Decision Record refs:** pending.

## Completed Experiments

No experiments have been completed yet.

Completed experiment summaries should use this structure:

```yaml
experimentId: "EXP-00"
rawResult: ""
interpretation: ""
hypothesisOutcome: "supported | refuted | inconclusive"
confidence: "low | medium | high"
limitations:
  - ""
decision: ""
evidenceLogRefs:
  - ""
decisionRecordRefs:
  - ""
```

Raw result must describe what happened. Interpretation must explain what the result may mean. Decision must state what the project will do because of the evidence.

## Experiment Protocols

### Standard Protocol Rules

Every experiment should follow these rules:

1. Define the hypothesis and decision gate before execution.
2. Define success, failure, and stopping criteria before evidence collection.
3. Confirm consent, privacy handling, and recording rules.
4. Capture raw observations separately from interpretation.
5. Link each evidence item to hypotheses and assumptions.
6. Preserve contradictions and refutation signals.
7. Avoid changing criteria after results are known.
8. Send evidence to the Evidence Log before recording decisions.
9. Record decisions in the Decision Record only when evidence changes a validation decision.

### Protocol Deviations That Weaken Evidence

Evidence should be marked weak or invalid if:

- The participant saw a solution pitch before problem evidence was collected.
- Success criteria were changed after seeing the result.
- Sensitive data was captured without consent.
- The participant did not match the stated criteria.
- The interviewer led the participant toward preferred answers.
- The experiment could not distinguish raw evidence from interpretation.
- The method tested praise or curiosity instead of behavior, artifacts, or decision clarity.

### Controls and Comparisons

Use controls only where they improve decision quality:

- Compare decision-derived documentation against starting notes or generic AI prose when testing clarity.
- Compare pain-specific positioning against generic AI-documentation framing when testing comprehension.
- Compare local-first workflow expectations against hosted-tool preferences when testing trust.
- Compare diagnostic output with and without severity and next-action guidance when testing actionability.

Do not add comparisons that make sessions too heavy or distract from the decision gate.

## Experiment Templates

### Template: Problem Interview Batch

**Purpose:** test whether a problem exists before solution exposure.

**Best for:** H-PR, H-BE, and audience hypotheses.

**Not for:** testing usability, pricing, retention, or detailed product design.

**Required inputs:** participant screener, interview guide, consent language, evidence capture format.

**Protocol steps:** recruit, screen, interview, review artifacts, capture consequences, synthesize by hypothesis.

**Data captured:** project context, current workaround, pain consequence, artifacts, alternatives, contradictions.

**Success criteria pattern:** repeated concrete examples and consequences before solution exposure.

**Failure criteria pattern:** abstract agreement without behavior or cost.

**Common bias risks:** confirmation bias, selection bias, recall bias, politeness bias.

**Output artifacts:** session notes, Evidence Log entries, audience refinement notes.

### Template: Artifact Comparison

**Purpose:** test whether one artifact creates more decision clarity than another.

**Best for:** H-BE-03 and H-SO-03.

**Not for:** proving retention, willingness to pay, or market scale.

**Required inputs:** starting artifact, comparison artifact, review rubric, safe project context.

**Protocol steps:** present artifacts, ask for independent review, capture clarity criteria, ask which artifact supports next action.

**Data captured:** artifact ranking, clarity explanation, missed decisions, assumptions noticed, preferred next-step artifact.

**Success criteria pattern:** participant identifies specific decision clarity improvements.

**Failure criteria pattern:** participant prefers polish, volume, or confidence tone without decision value.

**Common bias risks:** ordering bias, researcher preference, artifact quality mismatch.

**Output artifacts:** comparison notes, reviewer rubric, Evidence Log entries.

### Template: Workflow Prototype Session

**Purpose:** test whether a realistic workflow changes understanding, decisions, or action.

**Best for:** H-BE-02, H-SO-01, H-SO-02, H-SO-04, H-SO-06.

**Not for:** broad adoption, economic model, or final UX claims.

**Required inputs:** prototype or concierge script, participant project, decision review checklist, consent language.

**Protocol steps:** run intake or review, capture outputs, ask participant to interpret, observe decision changes, capture friction and trust.

**Data captured:** proposed decisions, participant edits, missing decisions, next actions, trust/friction observations.

**Success criteria pattern:** participant gains observable clarity and can review system output safely.

**Failure criteria pattern:** participant accepts AI output passively or experiences more friction than clarity.

**Common bias risks:** facilitator help, prototype novelty, overexplaining.

**Output artifacts:** session note, decision review trace, Evidence Log entries, potential Decision Record entry.

### Template: Trust and Boundary Review

**Purpose:** test whether local-first, provider disclosure, confirmation, and visible uncertainty increase trust without creating excessive friction.

**Best for:** H-SO-05, H-SO-06, H-AD-03.

**Not for:** testing final onboarding conversion or legal compliance.

**Required inputs:** local workspace example, provider disclosure example, setup walkthrough, privacy boundary language.

**Protocol steps:** walkthrough, participant explanation, friction review, trust review, abandonment threshold.

**Data captured:** trust signals, confusion points, local-first value, setup objections, privacy concerns.

**Success criteria pattern:** safeguards make the workflow more trusted and still usable.

**Failure criteria pattern:** safeguards or local setup prevent value or require boundary violations.

**Common bias risks:** stated privacy mismatch, technical-user overfit, demo bias.

**Output artifacts:** trust review notes, Evidence Log entries, boundary decision candidates.

## Data and Instrumentation

Data collection should be sufficient to evaluate criteria without collecting unnecessary sensitive information.

Required data for all experiments:

- Experiment ID.
- Participant ID or anonymized code.
- Session date.
- Method.
- Consent status.
- Linked hypotheses.
- Raw observations.
- Direct quotes only with consent.
- Researcher interpretation.
- Evidence strength.
- Contradiction flag.
- Privacy notes.
- Evidence Log reference.
- Decision Record reference when applicable.

Experiment-specific data:

- **EXP-01 and EXP-02:** project context, current artifacts, alternatives, consequences, audience fit.
- **EXP-03:** artifact versions, clarity rubric, participant comparison, reviewer assessment.
- **EXP-04:** intake outputs, proposed decisions, participant edits, status comprehension, trust/friction notes.
- **EXP-05:** diagnostic output, participant interpretation, next action, noise/usefulness signal.
- **EXP-06:** setup steps reviewed, local-first trust signals, provider disclosure comprehension, abandonment threshold.
- **EXP-07:** message variant, participant paraphrase, category interpretation, confusion points.
- **EXP-08:** follow-up trigger, document use, decision changes, return behavior.
- **EXP-09:** value driver, buyer/user distinction, paid alternatives, budget context.

Data quality risks:

- Small qualitative samples may be overgeneralized.
- Participants may praise concepts out of politeness.
- Artifact comparisons may favor better-written samples rather than better structure.
- Concierge sessions may hide real product friction.
- Prototype sessions may understate future product quality.
- Privacy constraints may limit artifact visibility.

Privacy and consent rules:

- Notes-only is the default unless recording is explicitly approved.
- Audio, video, or screen recording requires separate consent.
- Sensitive project, client, repository, file path, token, and business details should be omitted or anonymized.
- Raw participant material should not be sent to remote AI providers unless explicit consent and handling rules allow it.
- Evidence should preserve enough context for synthesis without exposing unnecessary personal or project data.

## Experiment Results Summary

No results exist yet.

The aggregate results summary should be completed only after experiments produce evidence. It should summarize outcomes at the hypothesis level, not only by experiment.

| Hypothesis | Experiments Run | Aggregate Result | Evidence Strength | Confidence | Contradictions | Decision Implication | Follow-Up Needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H-PR-01 | none | not tested | none | none | none yet | pending | Run EXP-01. |
| H-PR-02 | none | not tested | none | none | none yet | pending | Run EXP-01. |
| H-PR-03 | none | not tested | none | none | none yet | pending | Run EXP-01. |
| H-AU-01 | none | not tested | none | none | none yet | pending | Run EXP-01. |
| H-AU-02 / H-AU-03 | none | not tested | none | none | none yet | pending | Run EXP-02. |
| H-BE-02 / H-BE-03 | none | not tested | none | none | none yet | pending | Run EXP-03 and EXP-04. |
| H-SO-01 / H-SO-02 / H-SO-03 | none | not tested | none | none | none yet | pending | Run EXP-03 and EXP-04 after upstream evidence. |
| H-SO-04 | none | not tested | none | none | none yet | pending | Run EXP-05. |
| H-SO-05 / H-SO-06 | none | not tested | none | none | none yet | pending | Run EXP-06. |
| H-AD-01 / H-AD-02 / H-AD-03 | none | not tested | none | none | none yet | pending | Run after problem and workflow evidence. |
| H-RE-01 / H-RE-02 | none | not tested | none | none | none yet | pending | Run after first workflow sessions. |
| H-WP-01 / H-WP-02 | none | deferred | none | none | none yet | pending | Do not run until value is demonstrated. |

## Open Questions

- Who will own recruitment, session execution, note capture, and synthesis?
- What participant access is available for the first experiment batch?
- Will the first workflow experiment use the current product, a concierge simulation, or static artifacts?
- What threshold is enough to proceed from problem evidence to workflow validation?
- Where will raw experiment notes live before the Evidence Log document is written?
- How will sensitive project artifacts be sanitized without losing decision-useful context?
- Which non-app project type should be used first to test generality?
