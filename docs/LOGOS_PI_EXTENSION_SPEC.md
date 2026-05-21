

# LOGOS Pi Extension Specification

## 1. Purpose

This document defines how the LOGOS Engine must operate as a conversational extension for the Pi Coding Agent.

The purpose of this specification is to prevent LOGOS from being implemented as a command-driven documentation generator.

LOGOS must behave as a conversational intake and compilation engine with minimal lifecycle commands. Commands exist only to initialize, start, pause, inspect, and generate. They must not be required for answering questions, advancing the intake, refining answers, or completing the documentation flow.

## 2. Product Thesis

LOGOS exists to transform unclear project intent into structured, auditable, executable documentation.

Within Pi, LOGOS should act as a guided conversational engine that:

- asks the next relevant unanswered or insufficiently answered question;
- evaluates whether the user's answer is sufficient;
- asks targeted follow-up questions when needed;
- persists answers and evaluations;
- compiles collected context into canonical documentation;
- generates both normative and executive outputs;
- warns the user when generation is requested before sufficient intake is complete.

LOGOS is not a menu-based CLI.

LOGOS is not a slash-command workflow.

LOGOS is not a one-shot document generator.

## 3. Interaction Model

The primary interaction model is conversational.

`/logos-start` is an active intake trigger, not a passive mode toggle.

When the user runs `/logos-start`, the agent must initiate the interaction immediately by asking the next unresolved question or resuming the active unresolved follow-up.

The user must not be expected to know what the next question is.

The user must not be expected to send an initial answer after `/logos-start` without first receiving a question from the agent.

The required sequence is:

```txt
User runs /logos-start
  ↓
Agent loads intake state
  ↓
Agent selects the next unresolved question or active unresolved follow-up
  ↓
Agent asks that question immediately
  ↓
User answers naturally
```

Only after the agent has asked the first question does the user continue the process by replying naturally.

The user must not need commands to:

- answer the current question;
- request clarification about the current question;
- refine an answer;
- advance to the next question;
- revisit an insufficient answer;
- mark a question as temporarily unknown;
- continue the intake loop.

The assistant is responsible for deciding whether a user response is sufficient to advance.

The assistant must either:

1. accept the answer and ask the next question;
2. request a targeted clarification;
3. identify a contradiction and ask the user to resolve it;
4. mark the answer as partial when the user explicitly cannot answer yet;
5. stop only when the user requests `/logos-stop`, generation starts, or the intake is complete.

## 4. Allowed Lifecycle Commands

Only a small set of commands is allowed in the MVP.

### 4.1 `/logos-init`

Initializes LOGOS in the current project directory.

Responsibilities:

- detect the current project root;
- resolve the active profile (default to `standard`, load from `profiles/<profile-id>/`);
- persist the active profile id in `.logos/config.yml`;
- create the required `.logos/` runtime directory;
- create the required documentation structure if missing;
- create default configuration files;
- install or copy default question registries;
- initialize intake state;
- initialize generation state;
- refuse destructive overwrites unless explicitly confirmed;
- report whether LOGOS was initialized successfully.
- block or require explicit confirmation when invoked during active intake;
- warn that reinitialization will discard active intake state;
- preserve existing intake state unless the user explicitly confirms reset.

Expected files:

```txt
.logos/
├── config.yml
├── intake-state.json
├── answers.json
├── question-index.json
├── generation-state.json
└── logs/
```

Optional project documentation structure:

```txt
docs/
├── docs.yml
├── phases/
└── generated/
```

### 4.2 `/logos-start`

Starts or resumes conversational intake.

Responsibilities:

- load current LOGOS project state;
- detect whether intake is new, paused, active, or complete;
- find the next unanswered, partial, contradictory, or insufficient question;
- immediately ask that question or resume the active unresolved follow-up;
- ask exactly one question at a time;
- activate intake mode;
- persist the active question id.

`/logos-start` must not generate documentation.

`/logos-start` must not wait silently for the user's next message.

`/logos-start` must always produce an assistant message unless the project is not initialized, intake is already complete, or a blocking error occurs.

`/logos-start` must not require the user to select a phase manually before the first question unless multiple incompatible intake profiles exist.

When `/logos-start` is received while intake is already active, it must not pause, must not create a new session, must not advance the question, and must re-emit the active unresolved question or active unresolved follow-up.

### 4.3 `/logos-stop`

Pauses conversational intake.

Responsibilities:

- persist the current intake state;
- preserve the active question id;
- mark the session as paused;
- report concise progress;
- do not discard partial answers;
- do not generate documentation.
- when invoked during active intake, preserve the active question or active unresolved follow-up before pausing.

Expected output should include:

- total progress;
- progress by phase;
- current or next unresolved question;
- whether any critical questions remain incomplete.

### 4.4 `/logos-status`

Reports current LOGOS project status.

Responsibilities:

- show initialization status;
- show intake mode status;
- show total question progress;
- show progress by phase;
- show number of sufficient, partial, missing, and contradictory answers;
- show generation readiness;
- show top blockers to generation.

`/logos-status` is observational only when intake is idle. When intake is active, it must first pause intake safely, preserve the active question, and persist state before reporting. It must not treat `/logos-status` as an answer to the active question.

### 4.5 `/logos-generate`

Generates documentation from collected intake data.

Responsibilities:

- run generation preflight;
- calculate completeness;
- detect missing critical inputs;
- detect partial or contradictory answers;
- warn before generating incomplete documentation;
- require explicit confirmation before partial generation;
- generate normative documentation;
- generate executive documentation;
- generate configured artifacts;
- persist generation results;
- report generated files.
- when invoked during active intake, first pause intake safely;
- preserve the active question or active unresolved follow-up;
- persist state before running preflight;
- must not treat `/logos-generate` as an answer to the active question.

`/logos-generate` must not silently ignore missing critical inputs.

## 5. Explicitly Forbidden Command-First Patterns

The following commands must not exist in the MVP:

```txt
/logos-next
/logos-answer
/logos-continue
/logos-question
/logos-phase
/logos-doc
/logos-set-answer
/logos-skip
/logos-followup
```

These patterns are forbidden because they move the primary workflow from conversation into command execution.

If equivalent behavior is needed, it must be handled conversationally.

Examples:

```txt
User: I don't know how to answer this yet. Leave it pending.
Assistant: Understood. I will mark this question as partial and continue to the next critical question.
```

```txt
User: Can you explain what you mean by audience constraints?
Assistant: In this context, audience constraints means limitations the user brings into the product experience, such as time, technical skill, emotional state, budget, language, or trust. For this project, what constraints should LOGOS assume about the primary user?
```

## 6. Conversational Intake Loop

The intake loop is the core LOGOS interaction.

### 6.1 Loop Overview

```txt
/logos-start
  ↓
Agent loads intake state
  ↓
Agent selects next unresolved question or active unresolved follow-up
  ↓
Agent asks one question immediately
  ↓
User answers naturally
  ↓
Classify user intent
  ↓
Evaluate answer
  ↓
Persist answer and evaluation
  ↓
Advance, clarify, or resolve contradiction
  ↓
Repeat until stopped or complete
```

### 6.2 Intake Mode Behavior

While intake mode is active, every user message must first be interpreted in relation to the active LOGOS question.

The extension must classify each user message as one of:

```ts
type IntakeUserIntent =
  | "answer_current_question"
  | "ask_question_about_current_question"
  | "revise_previous_answer"
  | "pause_intake"
  | "skip_current_question"
  | "request_status"
  | "request_generation"
  | "out_of_scope";
```

The extension must not assume that every user message is an answer.

### 6.3 Advancement Rule

LOGOS may advance to the next question only when:

- the current answer is evaluated as sufficient;
- all required acceptance criteria for the question are satisfied;
- there is no unresolved contradiction;
- the confidence threshold for the question is met.

If the answer is partial, vague, generic, contradictory, or materially incomplete, LOGOS must ask a targeted follow-up instead of advancing.

### 6.4 One Question at a Time

LOGOS must ask one primary question at a time.

It may provide context, examples, or clarification, but it must not overload the user with a large questionnaire in a single message.

Acceptable:

```txt
What is the central thesis that justifies this project existing?
```

Not acceptable:

```txt
Please answer the following 12 questions about thesis, audience, market, product, engineering, and go-to-market.
```

### 6.5 Follow-Up Policy

Follow-ups must be targeted and minimal.

A follow-up should ask for the missing dimension only.

Examples:

- If the user gave features but no thesis, ask for the underlying conviction.
- If the user gave a problem but no audience, ask who experiences it.
- If the user gave a vision but no constraint, ask what the project must not become.
- If the user gave a technical choice but no reason, ask what constraint or trade-off drove that choice.

Each question may define a maximum number of follow-ups before LOGOS marks the answer as partial and continues, depending on priority.

## 7. Question Registry

LOGOS questions must be structured data, not hardcoded prose.

Each question must include enough metadata for routing, evaluation, persistence, and generation.

### 7.1 Question Shape

```ts
type LogosQuestion = {
  id: string;
  phaseId: string;
  documentId: string;
  sectionId: string;

  question: string;
  purpose: string;

  required: boolean;
  priority: "critical" | "important" | "optional";

  acceptanceCriteria: string[];
  completionSignals: string[];
  insufficiencySignals: string[];

  dependsOn?: string[];

  followUpPolicy: {
    maxFollowUps: number;
    askForExamples: boolean;
    askForTradeoffs: boolean;
  };
};
```

### 7.2 Example Question

```ts
const question: LogosQuestion = {
  id: "foundation.thesis.core",
  phaseId: "01-foundation",
  documentId: "01-thesis",
  sectionId: "core-thesis",
  question: "What is the central thesis that justifies this project existing?",
  purpose: "Stabilize the founding proposition of the project.",
  required: true,
  priority: "critical",
  acceptanceCriteria: [
    "Identifies the central conviction behind the project",
    "Explains why this matters now",
    "Distinguishes the thesis from a feature list or implementation detail"
  ],
  completionSignals: [
    "A clear proposition exists",
    "A real tension or problem is named",
    "The answer can guide future scope decisions"
  ],
  insufficiencySignals: [
    "The answer is only a list of features",
    "The answer is generic",
    "No tension, problem, or conviction is stated"
  ],
  followUpPolicy: {
    maxFollowUps: 3,
    askForExamples: true,
    askForTradeoffs: true
  }
};
```

## 8. Answer Evaluation

LOGOS must evaluate answers before advancing.

The evaluator must produce structured output.

### 8.1 Evaluation Shape

```ts
type AnswerEvaluation = {
  questionId: string;

  status:
    | "sufficient"
    | "partial"
    | "insufficient"
    | "contradictory"
    | "needs_clarification";

  completenessScore: number;

  missingAspects: string[];

  extractedFacts: string[];
  extractedAssumptions: string[];
  extractedDecisions: string[];
  extractedRisks: string[];

  suggestedFollowUp?: string;

  shouldAdvance: boolean;
};
```

### 8.2 Evaluation Rules

An answer is sufficient when:

- it directly responds to the active question;
- it satisfies the question acceptance criteria;
- it provides enough specificity to support documentation generation;
- it does not conflict with already accepted answers;
- it is not merely a vague affirmation.

An answer is partial when:

- it contains useful information but misses one or more required dimensions;
- the user explicitly says they do not know yet;
- the answer is directionally useful but not stable enough for final documentation.

An answer is insufficient when:

- it does not answer the question;
- it is too generic to be useful;
- it only repeats the question in different words;
- it provides implementation detail where conceptual intent is required.

An answer is contradictory when:

- it conflicts with a previous decision;
- it invalidates a previously accepted premise;
- it introduces mutually incompatible constraints.

Contradictions must not be silently resolved by the model. The user must be asked to resolve them.

## 9. Intake State Persistence

LOGOS must persist intake state between sessions.

The state must be stored inside the project-local `.logos/` directory.

### 9.1 Intake State Shape

```ts
type LogosIntakeState = {
  projectRoot: string;
  initializedAt: string;
  updatedAt: string;

  mode: "idle" | "intake_active" | "paused" | "generating" | "complete";

  activeQuestionId?: string;

  answeredQuestions: Record<string, {
    answer: string;
    evaluation: AnswerEvaluation;
    answeredAt: string;
    revisedAt?: string;
  }>;

  skippedQuestions: Record<string, {
    reason: string;
    skippedAt: string;
  }>;

  progress: {
    total: number;
    sufficient: number;
    partial: number;
    missing: number;
    contradictory: number;
    byPhase: Record<string, {
      total: number;
      sufficient: number;
      partial: number;
      missing: number;
      contradictory: number;
    }>;
  };
};
```

### 9.2 Persistence Rules

LOGOS must persist state after every accepted answer, partial answer, contradiction, skip, stop, and generation attempt.

LOGOS must never rely only on chat memory for intake state.

If persisted state and chat context diverge, persisted project state wins unless the user explicitly requests correction.

## 10. Generation Preflight

Before generating documentation, LOGOS must run preflight checks.

### 10.1 Preflight Checks

Preflight must check:

- whether LOGOS is initialized;
- whether the active profile exists and is valid;
- whether intake has started;
- total completeness;
- completeness by phase;
- missing critical questions;
- partial critical questions;
- unresolved contradictions;
- document generation targets;
- output paths;
- existing files that would be overwritten.

### 10.2 Preflight Result Shape

```ts
type GenerationPreflightResult = {
  ready: boolean;
  completenessScore: number;

  blockers: string[];
  warnings: string[];

  missingCriticalQuestions: string[];
  partialCriticalQuestions: string[];
  contradictions: string[];

  canGeneratePartialDraft: boolean;
  requiresExplicitConfirmation: boolean;
};
```

### 10.3 Partial Generation Rule

If critical information is missing, LOGOS may generate only a partial draft.

Partial drafts must be clearly marked as incomplete.

LOGOS must not present partial documentation as final.

## 11. LOGOS Core Boundary

The LOGOS Core must be independent from Pi.

The core must not depend on Pi-specific APIs, UI primitives, commands, or runtime assumptions.

The core is responsible for:

- project configuration logic;
- question registry loading;
- question selection;
- answer evaluation contracts;
- intake state transitions;
- completeness calculation;
- generation preflight;
- document compilation;
- artifact generation;
- validation rules.

The core should expose stable APIs that can be used by:

- Pi extension;
- future standalone TUI;
- future CLI;
- future web interface;
- tests.

## 12. Profile Resolution Policy

This section defines how LOGOS resolves the active profile. Profile resolution is owned by LOGOS Core and must be generic enough to support any profile under `profiles/<profile-id>/`.

### 12.1 Profile Locations

Profiles live under the repository-local `profiles/` directory.

Each profile is a directory at `profiles/<profile-id>/`.

The default bundled profile is `profiles/standard/`.
The default active profile id is `standard`.

### 12.2 Profile Resolution Rules

- When no profile is explicitly selected, LOGOS must use the `standard` profile.
- The active profile id must be persisted in project-local LOGOS configuration at `.logos/config.yml`.
- Business logic must not hardcode `profiles/standard` except as the default fallback.
- Profile loading must be generic enough to support future profiles under `profiles/<profile-id>/`.
- Future profile selection may be supported by configuration or an explicit initialization option.

### 12.3 `/logos-init` Behavior

`/logos-init` must initialize the project using the active profile:

- If no profile is explicitly selected, default to `standard`.
- Persist `activeProfileId: standard` in `.logos/config.yml`.
- If the selected profile does not exist on disk, block initialization with error code `profile_not_found`.

### 12.4 Missing Profile Behavior

If the active profile id references a profile directory that does not exist on disk at `profiles/<activeProfileId>/`:

- `/logos-init` must block initialization with a clear missing-profile error.
- `/logos-start` must block intake activation and must not enter `intake_active` mode.
- `/logos-generate` must block generation preflight.
- `/logos-status` must report the missing profile as a blocking condition.

The error code for a missing profile is `profile_not_found`.

### 12.5 Relationship To Profile-Derived Outputs

All profile-derived outputs must resolve from the active profile contracts:

- Question registry: loaded from `profiles/<activeProfileId>/`.
- Document contracts: loaded from the active profile's `docs.yml` and phase descriptors.
- Validation rules: derived from the active profile's schemas and quality rules.
- Generation outputs: produced according to the active profile's generation configuration.
- Executive outputs: produced according to the active profile's Executive contracts.
- Artifact configuration: loaded from the active profile's artifact descriptors.

### 12.6 Pi Extension Boundary

The Pi Extension must not resolve profile internals, load profile contracts, or hardcode profile paths.

The Pi Extension may pass a selected profile id during initialization only if the user explicitly provides or selects one in a future flow.

Core owns profile resolution. The extension calls Core to initialize, start intake, and generate, and Core resolves the active profile internally.

### 12.7 MVP Non-Goals For Profile Management

The MVP does not require:

- remote profile registry;
- profile marketplace;
- user-authored profile editor;
- dynamic profile installation;
- visual profile selector UI.

### 12.8 Future Profile Support

Future profiles may be added by creating a new directory at `profiles/<profile-id>/` that conforms to the profile contract.

Future profile selection may be supported by:

- an explicit `--profile <profile-id>` option on `/logos-init`;
- a `defaultProfile` key in workspace configuration;
- project-level `.logos/config.yml` with `activeProfileId`.

None of these are required in the MVP.

## 13. Pi Extension Boundary

The Pi extension is a surface and orchestration layer.

The extension is responsible for:

- registering allowed LOGOS commands;
- detecting the current project directory;
- connecting Pi conversation events to LOGOS intake mode;
- rendering assistant messages;
- invoking LOGOS Core services;
- persisting project-local state through core adapters;
- handling Pi-specific UI affordances when useful;
- reporting command results to the user.

The Pi extension must not contain core documentation generation logic.

The Pi extension must not hardcode the normative document structure when that structure belongs in LOGOS Core configuration.

## 14. Acceptance Criteria

The implementation is acceptable only if all criteria below are satisfied.

### 14.1 Lifecycle Commands

- `/logos-init` initializes LOGOS in the current project directory using the active profile (default: `standard`).
- `/logos-init` persists the active profile id in `.logos/config.yml`.
- `/logos-init` blocks with `profile_not_found` when the selected profile does not exist.
- `/logos-start` starts or resumes intake and immediately emits the next unresolved question or active unresolved follow-up.
- `/logos-stop` pauses intake and preserves state.
- `/logos-status` reports progress without mutating state.
- `/logos-generate` runs preflight before generation.

### 13.2 Conversational Intake

- After `/logos-start`, the agent asks first.
- The user can answer naturally only after the agent has emitted the current question.
- A sufficient natural-language answer advances to the next question automatically.
- A partial answer triggers a targeted follow-up.
- A contradictory answer triggers contradiction resolution.
- The user does not need `/logos-next`, `/logos-answer`, or equivalent commands.

### 13.3 Persistence

- Intake state survives process restart.
- The active question is preserved after `/logos-stop`.
- Answers are persisted with evaluations.
- Progress can be reconstructed from persisted state.

### 13.4 Generation

- Generation cannot run silently when critical information is missing.
- Missing critical inputs are reported before generation.
- Partial generation requires explicit confirmation.
- Generated docs are marked incomplete when generated from incomplete intake.

### 14.5 Architecture

- LOGOS Core is independent from Pi.
- Pi extension calls core APIs.
- Core logic is testable without Pi.
- Commands are lifecycle controls, not the primary workflow.
- Core owns profile resolution. Pi Extension does not hardcode profile paths or profile internals.
- Profile resolution works generically for any profile under `profiles/<profile-id>/`.

### 13.6 Intake Command Interruption

- Slash commands during active intake are treated as control intents, not answers.
- `/logos-start` during active intake re-emits the active prompt without advancing or creating a new session.
- `/logos-stop` during active intake preserves the active question before pausing.
- `/logos-status` during active intake pauses safely, preserves state, persists, then reports.
- `/logos-generate` during active intake pauses safely, preserves state, persists, then runs preflight.
- `/logos-init` during active intake blocks or requires explicit confirmation.
- No command corrupts, skips, replaces, or silently completes the active question.

## 15. Required Tests

The implementation must include tests that prove the interaction model.

### 15.1 Initialization Test

```txt
Given a project without LOGOS initialized
When the user runs /logos-init
Then .logos/ is created
And default configuration is created
And intake state is initialized
```

### 15.2 Start Intake Test

```txt
Given LOGOS is initialized
When the user runs /logos-start
Then intake mode becomes active
And the agent immediately asks the next unresolved question or active unresolved follow-up
And the system does not wait silently for the user's next message
```

### 15.3 Advance Without Command Test

```txt
Given intake mode is active
And LOGOS has asked question Q1
When the user replies with a sufficient natural-language answer
Then LOGOS saves the answer
And evaluates it as sufficient
And asks Q2 automatically
And no command is required to advance
```

### 15.4 Partial Answer Test

```txt
Given intake mode is active
And LOGOS has asked question Q1
When the user gives a partial answer
Then LOGOS saves the partial answer
And asks a targeted follow-up
And does not advance to Q2
```

### 15.5 Contradiction Test

```txt
Given intake mode is active
And a previous answer established decision D1
When the user gives a new answer that contradicts D1
Then LOGOS marks the answer as contradictory
And asks the user to resolve the contradiction
And does not silently choose one side
```

### 15.6 Stop And Resume Test

```txt
Given intake mode is active on question Q7
When the user runs /logos-stop
Then LOGOS persists Q7 as the active question
When the user later runs /logos-start
Then LOGOS resumes from Q7 or its unresolved follow-up
```

### 15.7 Status Test

```txt
Given LOGOS has collected several answers
When the user runs /logos-status
Then LOGOS reports total progress
And progress by phase
And generation readiness
And does not mutate intake state
```

### 15.8 Incomplete Generation Test

```txt
Given critical questions are missing
When the user runs /logos-generate
Then LOGOS runs preflight
And reports missing critical inputs
And refuses final generation
And offers partial draft generation only with explicit confirmation
```

### 15.9 Core Independence Test

```txt
Given LOGOS Core is imported without Pi runtime
When tests call core intake and generation APIs
Then core behavior works without Pi extension dependencies
```

### 15.10 Status During Active Intake Test

```txt
Given intake mode is active
And the agent has asked Q1
When the user runs /logos-status
Then LOGOS pauses intake
And preserves Q1 as the active unresolved question
And reports status
And does not treat /logos-status as an answer to Q1
```

### 15.11 Generate During Active Intake Test

```txt
Given intake mode is active
And the agent has asked Q1
When the user runs /logos-generate
Then LOGOS pauses intake
And preserves Q1 as the active unresolved question
And runs generation preflight
And does not treat /logos-generate as an answer to Q1
```

### 15.12 Start During Active Intake Test

```txt
Given intake mode is active
And the agent has asked Q1
When the user runs /logos-start
Then LOGOS does not create a new intake session
And does not advance to Q2
And re-emits Q1 or its active unresolved follow-up
```

### 15.13 Init During Active Intake Test

```txt
Given intake mode is active
When the user runs /logos-init
Then LOGOS blocks initialization
And warns that active intake state will be lost
And does not reinitialize without explicit confirmation
```

### 15.14 Command Not Evaluated As Answer Test

```txt
Given intake mode is active
And the agent has asked Q1
When the user runs any lifecycle command
Then the command text is never submitted to answer evaluation for Q1
```

### 15.15 Default Profile Test

```txt
Given no profile is explicitly selected
When the user runs /logos-init
Then LOGOS uses the standard profile
And persists standard as the active profile id in project-local config
```

### 15.16 Active Profile Question Loading Test

```txt
Given activeProfileId is standard
When LOGOS loads intake questions
Then questions are loaded from profiles/standard
```

### 15.17 Missing Profile Blocks Intake Test

```txt
Given activeProfileId references a missing profile
When LOGOS starts intake
Then LOGOS blocks with a clear missing-profile error
And does not enter intake_active mode
```

### 15.18 Missing Profile Blocks Generation Test

```txt
Given activeProfileId references a missing profile
When LOGOS runs generation preflight
Then LOGOS blocks generation with a clear missing-profile error
```

### 15.19 Future Custom Profile Test

```txt
Given a future profile exists under profiles/custom-profile
When LOGOS is configured to use custom-profile
Then Core loads profile contracts, questions, validation rules, generation config, and Executive output rules from profiles/custom-profile
```

### 15.20 Core Owns Profile Resolution Test

```txt
Given LOGOS Core is imported without Pi runtime
When tests call Core profile resolution APIs
Then Core resolves the active profile generically from profiles/<profile-id>/
And Core does not depend on Pi extension APIs for profile resolution
```

## 16. Intake Command Interruption Policy

While LOGOS intake mode is active, slash commands are control intents, not answers to the active question.

Any lifecycle command issued during active intake must first resolve the active intake state safely before executing its own behavior.

No lifecycle command may leave intake in an ambiguous state. No lifecycle command may consume the command text as the answer to the active question. No command may corrupt, skip, replace, or silently complete the active question.

### 16.1 General Rules

* Slash commands during active intake are control intents and must not be routed to answer evaluation.
* The active question or active unresolved follow-up must be preserved before any interrupting command executes.
* No command may silently advance, discard, or complete the active question.
* State must be persisted before command-specific behavior executes when that behavior would alter the intake session.

### 16.2 `/logos-start` During Active Intake

When `/logos-start` is received while intake mode is already active:

* Must not pause intake.
* Must not create a new intake session.
* Must not advance to the next question.
* Must re-emit the active unresolved question or active unresolved follow-up.

`/logos-start` is the exception to the pause-before-execute rule. It must acknowledge that intake is already active and reaffirm the current prompt without altering session state.

### 16.3 `/logos-stop` During Active Intake

When `/logos-stop` is received while intake mode is active:

* Must first preserve the active question or active unresolved follow-up.
* Must persist current intake state.
* Must then pause intake.
* Must not treat `/logos-stop` as an answer to the active question.

### 16.4 `/logos-status` During Active Intake

When `/logos-status` is received while intake mode is active:

* Must first pause intake safely.
* Must preserve the active question or active unresolved follow-up.
* Must persist state.
* Must then report status.
* Must not treat `/logos-status` as an answer to the active question.

`/logos-status` is not purely observational when intake is active. It must safely pause before reporting to prevent the status query from being consumed as intake input.

### 16.5 `/logos-generate` During Active Intake

When `/logos-generate` is received while intake mode is active:

* Must first pause intake safely.
* Must preserve the active question or active unresolved follow-up.
* Must persist state.
* Must then run generation preflight.
* Must not treat `/logos-generate` as an answer to the active question.

### 16.6 `/logos-init` During Active Intake

When `/logos-init` is received while intake mode is active:

* Must not silently reinitialize.
* Must block or require explicit confirmation before any initialization action.
* Must preserve existing intake state unless the user explicitly confirms a destructive or resetting operation.
* Must warn that active intake state will be lost if reinitialization is confirmed.

## 17. Non-Goals

The MVP must not implement:

- a standalone TUI;
- a web interface;
- a complete visual dashboard;
- multi-user collaboration;
- remote sync;
- hosted project storage;
- arbitrary slash-command workflows;
- command-based answer submission;
- manual phase-by-phase command navigation;
- automatic generation without preflight.

These may be considered later only if they preserve the core conversational intake model.

## 18. Implementation Principle

The implementation must be judged by the following rule:

> If the happy path requires commands after `/logos-start`, the implementation is wrong.

The only acceptable happy path is:

```txt
/logos-init
/logos-start
Agent asks the next unresolved question
User answers conversationally
LOGOS evaluates and advances conversationally
Agent asks the next question or follow-up
User stops or intake completes
/logos-generate
```

Any implementation that turns this into a command sequence is non-compliant.

Any implementation where `/logos-start` activates a mode but does not immediately produce the agent's next question is also non-compliant.

This rule extends to command interruption: no lifecycle command during active intake may consume the command text as an answer or silently discard the active question.