# Research Plan

This document defines how LOGOS Engine will gather qualitative and contextual evidence before committing further to product, engineering, or go-to-market direction.

The plan is designed to answer one central question:

> How will we listen and observe in a way that produces decision-useful evidence?

This is a research design, not an experiment protocol. It should help the project learn from real project-start behavior, current workarounds, documentation artifacts, trust concerns, and workflow reactions without pitching the solution too early or treating opinions as proof.

## Research Goals

The research should inform validation decisions, not general curiosity. Every activity should connect to a hypothesis, assumption, or decision gate from the Validation phase.

| ID | Research Question | Linked Hypotheses | Linked Assumptions | Decision Informed | Evidence Needed | Method | Priority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RQ-01 | Do people starting meaningful projects experience ambiguity before execution? | H-PR-01 | A-TH-01, A-PR-01 | Continue, revise, or reject the problem definition. | Recent examples of unclear purpose, audience, scope, assumptions, constraints, success criteria, or next steps. | Problem interviews, project-start artifact review. | critical | Must be asked before solution exposure. |
| RQ-02 | Does that ambiguity create meaningful cost? | H-PR-02 | A-PR-01, A-PR-04 | Decide whether the problem is urgent enough to justify a workflow. | Rework, delays, discarded work, late constraint discovery, weak scoping, poor handoff, or inconsistent documentation. | Problem interviews, retrospective walkthroughs. | critical | Abstract agreement is weak evidence. |
| RQ-03 | What do users currently do instead? | H-PR-03, H-BE-01 | A-PR-02 | Determine differentiation from current alternatives. | Notes, templates, AI chats, docs, task boards, workshops, client intake material, or immediate building behavior. | Current-workflow interview, artifact review. | high | The goal is to understand real behavior, not competitor preference. |
| RQ-04 | Which audience has the strongest pain and workflow fit? | H-AU-01, H-AU-02 | A-AU-01, A-AU-02, A-TR-01 | Confirm or adjust the primary audience. | Evidence of repeated project-start ambiguity among people close to local files, Git, Markdown, IDEs, or repositories. | Audience interviews, screening, workflow observation. | critical | The audience is behavioral, not purely demographic. |
| RQ-05 | Does the problem generalize beyond the app-based business origin case? | H-AU-03 | A-TH-04 | Decide whether to keep a broad project framing or narrow the initial profile. | Similar ambiguity and documentation pain in at least one non-app-business project type. | Cross-context interviews, artifact review. | high | The origin case is a proving ground, not the boundary. |
| RQ-06 | Will users pause execution when missing decisions are exposed? | H-BE-02 | A-PR-04, A-AU-03 | Decide whether clarity-before-execution is viable behavior. | Observed willingness to clarify, revise, or defer execution after seeing meaningful gaps. | Guided walkthrough, later prototype session. | critical | Should be tested after problem evidence exists. |
| RQ-07 | Can users distinguish more clarity from more text? | H-BE-03, H-SO-03 | A-PR-03, A-TH-02, A-TH-03 | Decide whether structured documents are valuable. | User comparison of starting notes, generic prose, and decision-derived documentation. | Artifact comparison, reviewer assessment. | critical | Do not equate polished prose with success. |
| RQ-08 | Can AI-led intake produce useful structured state for review? | H-SO-01, H-SO-02 | A-SO-01, A-SO-02, A-SO-03 | Decide whether the AI-led workflow is viable. | Traceable proposed decisions, assumptions, gaps, open questions, and user corrections. | Prototype or concierge intake session. | critical | Must preserve proposed versus confirmed status. |
| RQ-09 | Are diagnostics actionable rather than noisy? | H-SO-04 | A-SO-05 | Decide whether diagnostics are core or secondary. | Users can explain gaps, risks, contradictions, and reasonable next steps. | Diagnostic review session. | high | Use real project context where possible. |
| RQ-10 | Do local-first, Git-friendly, inspectable outputs increase trust? | H-SO-05, H-SO-06 | A-TR-01, A-TR-02, A-TR-03, A-TR-04 | Decide whether local-first and safety principles are product strengths. | Preference for local files, diffs, editability, provider disclosure, confirmation, and visible uncertainty. | Workflow preference interview, prototype review. | high | Watch actual behavior, not only stated privacy preference. |

Research will be worth doing if it changes at least one decision: continue, narrow the audience, revise the problem, adjust the workflow, defer a product direction, or stop pursuing a claim. It will be insufficient if it produces only broad praise, speculative interest, or solution reactions without concrete evidence.

## Participant Profile

Participants should be selected by situation and behavior. The ideal participant is currently starting, scoping, revisiting, or clarifying a meaningful project and has enough agency to make or influence foundational decisions.

Primary participants:

| Criterion | Type | Rationale | Inclusion Rule | Exclusion Rule | Screening Question | Bias Risk |
| --- | --- | --- | --- | --- | --- | --- |
| Project-start situation | inclusion | The problem appears before serious execution. | Participant is within the last 90 days of starting, restarting, scoping, or clarifying a project. | Participant only discusses an old project with no current relevance. | "Tell me about a project you started, restarted, or scoped recently." | Recall bias if the project is too old. |
| Meaningful project | inclusion | The project must have enough stakes for ambiguity to matter. | Project involves time, money, client trust, team alignment, implementation effort, public launch, or strategic commitment. | Participant is discussing a trivial task or casual idea with no real consequence. | "What would go wrong if this project were poorly scoped?" | Participants may inflate importance. |
| Decision authority | inclusion | The workflow assumes the user can confirm or revise decisions. | Participant owns or meaningfully influences scope, audience, purpose, or execution direction. | Participant only follows decisions made by someone else. | "Which decisions about this project are yours to make?" | Title may exaggerate actual authority. |
| Current workaround | inclusion | Existing behavior is stronger evidence than abstract pain. | Participant has notes, chats, docs, task lists, templates, diagrams, intake forms, or other planning artifacts. | Participant has done no work and cannot show or describe any current process. | "What have you already written or used to clarify the project?" | Over-selecting highly organized participants. |
| Local/text workflow fit | primary | The initial audience is local-first and repository-oriented. | Participant uses or accepts local files, Markdown, Git, IDEs, terminal, repository folders, or text-based docs. | Participant requires a fully managed SaaS dashboard before any value is possible. | "Where does project knowledge live while you work?" | May bias too heavily toward developers. |
| Non-app context | exploratory | The thesis must not remain locked to the origin case. | At least some participants are working on non-app projects such as client scoping, internal initiatives, content products, research projects, communities, courses, or open-source direction. | None, unless the participant has no project-start ambiguity. | "What kind of project is this, and what makes it hard to clarify?" | Too few cross-context cases can create false generality. |

Secondary participants may include consultants, agency operators, product managers, creators, educators, open-source maintainers, internal initiative owners, and non-technical founders who work with technical collaborators. They are useful if they can challenge whether the audience should remain technical and local-first.

Excluded participants for this phase:

- People who only want a no-code builder or automatic execution tool.
- People whose main need is task management after decisions are already made.
- Enterprise buyers whose first requirement is procurement, administration, compliance, or centralized governance.
- People who cannot discuss a real or recent project.
- People who are only reacting to the LOGOS Engine pitch.

Provisional sample logic:

- Start with 6 to 8 problem and current-workflow interviews across the primary audience.
- Include at least 2 participants outside the app-business origin case.
- After early patterns emerge, run 3 to 5 deeper artifact or workflow sessions with participants who show strong pain and current workarounds.
- Continue only until the team has enough evidence to make the next validation decision; do not treat these numbers as statistical proof.

## Recruitment Criteria

Recruitment should find people with relevant project-start behavior, not only people who like AI tools or want to help the founder.

Acceptable recruitment sources:

- Personal and professional network referrals, if screened for real project-start behavior.
- Developer, founder, indie builder, consultant, creator, educator, or product communities.
- Open-source maintainers or maintainers of early-stage project repositories.
- Small teams or agencies that run intake, discovery, scoping, or documentation workflows.
- People who recently used AI chat, templates, notes, PRDs, briefs, or task tools to clarify a project.

Recruitment sources that may introduce bias:

- Close friends who already agree with the thesis.
- AI enthusiast communities where people may overvalue automation.
- Only developers, if the project is trying to test broader project types.
- Only app-business builders, if the goal is to test generality.
- Only highly organized planners, if the product also expects to serve people with messy starting points.

Screening should include:

- A recent project-start example.
- The participant's role in decisions.
- Current artifacts or workarounds used.
- Whether the participant works near local files, repositories, Markdown, IDEs, or text documents.
- Whether the participant has experienced rework, delay, disagreement, or uncertainty from unclear foundations.
- Whether the participant is comfortable discussing the project without exposing sensitive details.

Participants should be rejected or deprioritized when:

- They cannot describe a concrete project.
- They only want to discuss the solution after hearing the pitch.
- They have no current pain or workaround.
- Their main need is cloud collaboration, project management, or execution automation.
- Their project contains sensitive information that cannot be safely anonymized for research.

Incentives, if offered, should be modest and disclosed. They should compensate time without pressuring agreement. If incentives are used, the notes should mark incentive type because it may increase politeness bias or participation from people with weaker pain.

## Interview Guide

Interviews should move from context, past behavior, and artifacts toward reactions to structured clarity. The solution should not be pitched until the participant's problem, current workflow, and consequences are understood.

### Interview Flow

1. Consent, privacy boundary, and permission to take notes.
2. Participant context and recent project-start story.
3. Current workflow and artifact walkthrough.
4. Ambiguity, decision, and documentation pain.
5. Consequences, workarounds, and alternatives.
6. Trust, local-first, AI, and review expectations.
7. Optional low-fidelity concept or prototype reaction, only after problem evidence is collected.
8. Closing: contradictions, missing context, and permission for follow-up.

### Core Questions

| ID | Question | Purpose | Linked Hypotheses | Expected Evidence | Follow-Ups | Bias Risk | Avoid If |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IQ-01 | "Tell me about a project you recently started, restarted, or scoped." | Establish concrete context. | H-PR-01, H-AU-01 | Recent project story, role, stakes, stage. | "When did this happen?" "What was your role?" "What made it meaningful?" | Participant may generalize. | Participant has no concrete project. |
| IQ-02 | "What did you know clearly at the beginning, and what was still unresolved?" | Surface ambiguity without suggesting categories. | H-PR-01 | Explicit knowns and unknowns. | "Which of those unknowns mattered most?" "What did you postpone?" | May imply uncertainty is expected. | Participant already saw the solution pitch. |
| IQ-03 | "What did you write down, collect, or create to clarify the project?" | Identify artifacts and current workarounds. | H-BE-01, H-PR-03 | Notes, docs, chats, diagrams, tickets, templates. | "Can you walk me through one artifact?" "What was missing from it?" | Participants may mention idealized artifacts. | Participant cannot share details safely. |
| IQ-04 | "Where did the project become harder because something was unclear?" | Connect ambiguity to pain. | H-PR-02 | Consequences, rework, delay, misalignment, bad handoff. | "What changed because of that?" "How much time or effort did it cost?" | Leading toward negative examples. | No ambiguity has been established. |
| IQ-05 | "How did you decide what to build, defer, or ignore?" | Understand decision-making and hidden assumptions. | H-PR-01, H-BE-02 | Decision process, trade-offs, assumptions. | "Which decision was hardest?" "Who confirmed it?" | May make decision-making sound more formal than it was. | Participant had no authority. |
| IQ-06 | "What tools or processes did you use, and where did they work or fail?" | Map alternatives. | H-PR-03, H-BE-01 | Alternatives and structural gaps. | "What would you keep from that workflow?" "What would you replace?" | Can become competitor preference talk. | Participant has not used any workaround. |
| IQ-07 | "What would have made you pause before executing?" | Test behavior change conditions. | H-BE-02 | Threshold for useful friction. | "What kind of missing decision would be serious enough?" "What would feel like bureaucracy?" | Speculative future intent. | Treat as weak unless backed by past behavior. |
| IQ-08 | "When you read project documentation, how do you tell whether it is actually useful?" | Test clarity evaluation. | H-BE-03, H-SO-03 | Criteria for clarity, traceability, next action, gaps. | "Show me a useful or useless doc if possible." | Participant may say what sounds rigorous. | Participant never uses docs. |
| IQ-09 | "How do you feel about AI suggesting decisions, assumptions, gaps, or questions for you to review?" | Explore AI trust and agency. | H-SO-01, H-SO-02, H-SO-06 | Trust boundaries, review expectations. | "What must be reviewable?" "What would make it unsafe?" | Solution-first if asked too early. | Ask only after current workflow discussion. |
| IQ-10 | "Where should project knowledge live for you to trust it?" | Explore local-first fit. | H-SO-05 | Local files, Git, docs, cloud tools, privacy expectations. | "Do you inspect diffs?" "Do you commit docs?" "What should never leave your machine?" | Stated privacy may not match behavior. | None. |
| IQ-11 | "If a tool showed missing decisions, risks, and assumptions before producing docs, what would be useful or annoying about that?" | Explore structured clarity and friction. | H-BE-02, H-SO-04, H-SO-06 | Reactions to diagnostics and safeguards. | "Which warning would change your next action?" "Which warning would you ignore?" | Can sound like a pitch. | Ask after pain and alternatives. |
| IQ-12 | "Is there anything in your story that contradicts what I seem to be looking for?" | Protect contradiction and negative evidence. | all critical hypotheses | Counterexamples, corrections, weak-fit signals. | "What type of person would not need this?" | Participant may avoid disagreement. | None. |

### Questions to Avoid

Avoid leading or solution-first questions such as:

- "Would you use a local-first AI documentation engine?"
- "Would this save you time?"
- "Do you agree that decisions should come before documents?"
- "Would you pay for this?"
- "Isn't generic AI chat too unstructured?"
- "Would you prefer our workflow over your current tools?"

These questions produce weak evidence because they invite agreement, speculation, or politeness. They may be useful later only after stronger behavioral evidence exists and the wording is changed to compare concrete alternatives.

### Handling Follow-Ups

Follow-ups should clarify evidence, not push agreement. Good follow-ups ask for:

- A recent example.
- A specific artifact.
- A decision the participant made.
- A consequence of ambiguity.
- A trade-off they accepted.
- A workaround they repeated.
- A contradiction or exception.

When participants contradict themselves, the interviewer should reflect the contradiction neutrally and ask how both things can be true. When participants are uncertain, the interviewer should preserve the uncertainty instead of forcing a confident answer.

## Observation Criteria

Observation should separate what the participant does from what the researcher infers.

Behaviors and artifacts to observe:

- Whether the participant can locate current planning artifacts quickly.
- Whether project knowledge is scattered across notes, chats, documents, tasks, repositories, or memory.
- Whether decisions are explicit or embedded in prose.
- Whether assumptions are labeled or hidden.
- Whether unresolved questions are tracked or forgotten.
- Whether documentation reflects the latest project understanding.
- Whether the participant uses Git, local files, Markdown, IDEs, terminal, or repository folders as part of planning.
- Whether the participant compares docs by clarity, actionability, polish, or volume.
- Whether the participant reviews AI output critically or accepts it passively.
- Whether the participant reacts differently to proposed, assumed, confirmed, and unknown statuses.
- Whether diagnostics lead the participant to a next action or confusion.

Success signals:

- Participant names meaningful missing decisions without being prompted.
- Participant shows current artifacts that reveal structural gaps.
- Participant connects ambiguity to a real consequence.
- Participant values explicit assumptions, risks, open questions, and decision status.
- Participant prefers traceable documentation over polished but unsupported prose.
- Participant understands why local, inspectable outputs may matter.

Failure or contradiction signals:

- Participant has no recent concrete example.
- Current tools already solve the problem well enough.
- The participant only wants execution automation.
- The participant values output polish but ignores decision quality.
- The workflow feels heavier than the problem.
- Local-first storage is irrelevant or undesirable for the strongest-pain segment.
- The app-business origin case does not generalize to other project types.

Contextual factors to capture:

- Project type and stage.
- Stake level and expected cost of wrong decisions.
- Participant role and decision authority.
- Collaboration context.
- Sensitivity of the project information.
- Existing documentation habits.
- AI usage habits.
- Local versus cloud workflow preference.
- Time pressure and tolerance for clarification work.

## Bias Risks

The research must actively protect negative evidence. A research process that only confirms the founding thesis is not useful.

| Bias Risk | Where It Appears | Mitigation |
| --- | --- | --- |
| Confirmation bias | Recruiting friendly participants, interpreting every ambiguity as product validation. | Ask for counterexamples, preserve refutation signals, review notes against hypotheses, and log contradictions explicitly. |
| Selection bias | Recruiting only developers, AI enthusiasts, friends, or app-business builders. | Balance primary participants with at least some non-app project types and less enthusiastic current workflows. |
| Interviewer bias | Explaining LOGOS Engine too early or approving answers that match the thesis. | Use problem-first interview order and neutral acknowledgments. Delay solution exposure. |
| Leading questions | Asking whether participants want the proposed solution. | Use past-behavior questions and artifact walkthroughs. Maintain a banned-question list. |
| Recall bias | Asking about distant projects. | Prefer projects from the last 90 days and ask for artifacts or timestamps. |
| Social desirability bias | Participants claim rigorous planning habits or privacy preferences. | Ask to see artifacts and observe actual tool choices. Treat unsupported claims as weak evidence. |
| Survivorship bias | Studying only people whose projects moved forward. | Include stalled, abandoned, or restarted projects when possible. |
| Founder-origin bias | Treating the app-business origin case as representative of all projects. | Include non-app contexts and test whether the same pain appears there. |
| AI novelty bias | Participants praise AI because it feels impressive. | Separate reactions to AI from evidence of clearer decisions and better artifacts. |
| Over-synthesis bias | Turning a few stories into broad market conclusions. | Label sample limits, evidence strength, and unresolved questions in the Evidence Log. |

Negative evidence should be protected by default. If a participant says the workflow is unnecessary, too heavy, too local, too technical, too AI-dependent, or too broad, the note should be captured as first-class evidence rather than explained away.

## Data Capture Format

Research data should be captured in a format that preserves raw evidence, participant privacy, and traceability to hypotheses.

Each session should create a research note with:

```yaml
participantId: "P-001"
sessionDate: "YYYY-MM-DD"
method: "problem_interview | artifact_review | workflow_observation | prototype_review"
consentStatus: "notes_only | audio_allowed | screen_recording_allowed | declined_recording"
participantProfile:
  role: ""
  projectType: ""
  projectStage: ""
  decisionAuthority: ""
  localWorkflowFit: ""
researcher: ""
linkedHypotheses: []
rawObservations:
  - ""
quotes:
  - text: ""
    context: ""
interpretations:
  - statement: ""
    evidenceBasis: ""
    confidence: "low | medium | high"
contradictions:
  - ""
evidenceStrength: "weak | moderate | strong"
privacyNotes: ""
followUpQuestions:
  - ""
handoffTargets:
  - "Evidence Log"
  - "Decision Record"
```

Capture rules:

- Keep raw observations separate from interpretation.
- Mark direct quotes clearly and only with consent.
- Avoid unnecessary names, company names, client names, repository paths, secrets, or sensitive business details.
- Store participant identifiers as pseudonyms or codes.
- Record whether the participant allowed notes, audio, video, or screen recording.
- If a screen share or artifact contains sensitive information, summarize the relevant structure instead of copying the sensitive content.
- Link each evidence item to one or more hypotheses where possible.
- Mark contradictions even when they weaken the preferred thesis.

Consent and privacy:

- Explain what is being recorded before the session begins.
- Ask before recording audio, video, or screens.
- Allow participants to decline recording without losing participation.
- Do not send raw participant material to remote AI tools unless explicit consent and data-handling rules allow it.
- Prefer local research notes and anonymized synthesis.

## Synthesis Method

Synthesis should convert raw data into decision-useful findings without overclaiming.

After each session:

- Summarize the participant's project context.
- Extract raw evidence linked to hypotheses.
- Identify observed behaviors, artifacts, contradictions, and consequences.
- Mark evidence strength as weak, moderate, or strong.
- Record open questions and follow-up needs.

After each research batch:

- Group evidence by hypothesis.
- Separate problem evidence, audience evidence, behavior evidence, solution evidence, trust evidence, and generality evidence.
- Compare patterns across participants and project types.
- Identify outliers and contradictions before writing conclusions.
- Mark which findings are strong enough to affect decisions and which remain suggestive.
- Update the Evidence Log with raw evidence references and synthesis notes.
- Update the Decision Record only when evidence changes a validation decision.

Evidence strength guidance:

- **Strong evidence:** recent concrete behavior, artifact-backed examples, observed workflow choices, or repeated patterns across relevant participants.
- **Moderate evidence:** detailed self-report with plausible consequences but limited artifact support.
- **Weak evidence:** abstract agreement, future intent, praise after seeing the solution, or unsupported preference claims.
- **Invalidating evidence:** repeated failure to find the problem, strong existing alternatives, rejection of the workflow by the intended audience, or evidence that the product must violate boundaries to be useful.

Contradictions should be synthesized explicitly. A contradiction may mean the hypothesis is wrong, the audience is too broad, the participant is outside scope, the workflow is too heavy, or the research method is leading the participant. The synthesis should not resolve contradictions by averaging them away.

## Evidence Handoff

Research outputs should move into downstream validation artifacts with enough context to preserve uncertainty.

After each session, create:

- A session note using the data capture format.
- A short hypothesis evidence summary.
- A list of contradictions or refutation signals.
- Any participant-approved artifact references.
- Follow-up questions or candidate experiment needs.

After each batch, update:

- **Evidence Log:** raw evidence excerpts, observations, metadata, linked hypotheses, evidence strength, contradiction flags, and privacy notes.
- **Decision Record:** only decisions that the evidence supports changing, such as narrowing the audience, revising a hypothesis, deferring a feature, or moving to prototype validation.
- **Experiments:** questions that require controlled prototype sessions, artifact comparisons, pricing tests, or behavior tests rather than interviews.
- **Validation Report:** later synthesis of what the research did and did not prove.

Evidence belongs in the Evidence Log when it records what was heard, seen, or inferred. Evidence belongs in the Decision Record only when it changes a validation decision. Evidence belongs in Experiments when it requires a designed test. Evidence belongs in the Validation Report when enough evidence exists to explain the phase outcome.

## Open Questions

- What participant access is realistically available for the first research batch?
- Are audio or screen recordings acceptable, or should research begin with notes only?
- Which non-app project type should be included first to test generality?
- Should the first prototype review use the current LOGOS Engine flow, a concierge simulation, or static artifacts?
- What incentive, if any, is appropriate without creating agreement bias?
- Where will anonymized research notes live in the repository before the Evidence Log format is finalized?
