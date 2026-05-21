

# LOGOS Pi Extension Architecture

## 1. Architecture Objective

This document defines the target architecture for implementing LOGOS Engine as a conversational Pi Coding Agent extension backed by an independent LOGOS Core.

It exists to translate the product contract in `docs/LOGOS_PI_EXTENSION_SPEC.md` into technical boundaries, runtime flows, module responsibilities, persistence contracts, testing strategy, and migration constraints.

The architecture must preserve the central interaction rule:

> `/logos-start` is an active intake trigger. When the user runs it, the agent must initiate the interaction by asking the next unresolved question or resuming the active unresolved follow-up.

The system must not behave as a passive mode toggle waiting silently for the user's next message.

## 2. System Context

LOGOS runs inside Pi as an extension, but LOGOS itself must not become Pi-specific.

The intended system context is:

```txt
User
  ↓
Pi Coding Agent conversation
  ↓
LOGOS Pi Extension
  ↓
LOGOS Core
  ↓
Project-local LOGOS state
  ↓
Canonical docs, derived artifacts, executive outputs, and reports
```

The Pi extension provides the conversational surface.

LOGOS Core provides the product logic.

Project-local state provides durable truth.

Generated documentation and artifacts are projections of accepted state and profile contracts.

## 3. Architectural Principles

### 3.1 Core Independence

LOGOS Core must be independent from Pi.

Core code must not import:

- Pi extension APIs;
- Pi command registration APIs;
- Pi UI primitives;
- Pi session objects;
- Ink components;
- terminal rendering code;
- legacy CLI/TUI presentation modules.

Core must be executable and testable without Pi.

### 3.2 Extension As Surface

The Pi extension is an orchestration and interaction layer.

It may register commands, intercept input, render responses, call Pi UI helpers, and delegate work to LOGOS Core.

It must not own core algorithms, profile interpretation, documentation generation, answer evaluation semantics, or state-transition rules.

### 3.3 Conversation Before Commands

Commands exist only for lifecycle control.

Allowed MVP commands:

```txt
/logos-init
/logos-start
/logos-stop
/logos-status
/logos-generate
```

All intake progression after `/logos-start` must be conversational.

No command may be required to advance to the next question.

### 3.4 Structured State Before Chat Memory

Chat context can help the interaction, but it is not canonical state.

Accepted answers, partial answers, skipped questions, contradictions, evaluations, and generation readiness must be persisted in project-local LOGOS state.

### 3.5 Deterministic Boundaries Around AI

AI may classify, evaluate, draft, summarize, and suggest.

AI must not silently mutate canonical state, resolve contradictions, skip preflight, or treat unreviewed model output as truth.

## 4. High-Level Component Map

```txt
src/
├── core/
│   ├── config/
│   ├── profiles/
│   ├── intake/
│   ├── questions/
│   ├── evaluation/
│   ├── state/
│   ├── generation/
│   ├── validation/
│   ├── artifacts/
│   └── ports/
│
├── pi-extension/
│   ├── extension.ts
│   ├── commands/
│   ├── conversation/
│   ├── renderers/
│   ├── tools/
│   └── adapters/
│
└── shared/
    ├── result.ts
    ├── errors.ts
    └── types.ts
```

This layout is recommended. If the repository already has a better convention, preserve the same architectural boundaries even if paths differ.

## 5. Core Boundary

LOGOS Core owns product behavior.

### 5.1 Core Responsibilities

LOGOS Core is responsible for:

- loading LOGOS project configuration;
- resolving the active profile (profile resolution);
- initializing project-local runtime state;
- loading profile descriptors;
- loading question registries;
- selecting the next unresolved question;
- evaluating intake state completeness;
- defining answer evaluation contracts;
- applying answer evaluation results to state;
- persisting and loading LOGOS state through ports;
- running generation preflight;
- compiling canonical documentation;
- producing derived artifact plans;
- producing generation reports;
- validating profile and state invariants.

### 5.2 Core Public API

The Pi extension should interact with LOGOS Core through a small API surface.

Recommended API shape:

```ts
type LogosCore = {
  initProject(input: InitProjectInput): Promise<InitProjectResult>;
  startIntake(input: StartIntakeInput): Promise<StartIntakeResult>;
  handleIntakeMessage(input: HandleIntakeMessageInput): Promise<HandleIntakeMessageResult>;
  stopIntake(input: StopIntakeInput): Promise<StopIntakeResult>;
  getStatus(input: GetStatusInput): Promise<GetStatusResult>;
  generate(input: GenerateInput): Promise<GenerateResult>;
};
```

The exact implementation can vary, but the boundary must remain stable: Pi calls Core; Core does not call Pi.

### 5.3 Core Must Not Know Pi Concepts

Core must not know about:

- slash-command registration;
- Pi context objects;
- Pi message rendering;
- Pi UI components;
- Pi session entries;
- terminal layout;
- prompt display details.

Core may return structured messages for the extension to render.

## 6. Profile Resolution Architecture

Profile resolution is owned by LOGOS Core and defines how the system maps an active profile id to a profile directory and its contracts.

### 6.1 Design Principle

Core owns profile resolution. The Pi Extension does not resolve profile internals, load profile contracts, or hardcode profile paths. The extension may pass a selected profile id during initialization only if the user explicitly provides or selects one in a future flow.

### 6.2 Profile Resolution Flow

```txt
Core loads project config from .logos/config.yml
  ↓
Read activeProfileId
  ↓
If missing or empty, default to standard
  ↓
Resolve profile path: profiles/<activeProfileId>/
  ↓
Validate profile directory exists
  ↓
Validate required profile contracts are present
  ↓
Load profile contracts
  ↓
Use profile contracts for intake, validation, and generation
```

### 6.3 Profile Path Resolution

The active profile id is read from `.logos/config.yml`.

The fallback is `standard` when no active profile id is configured.

Profile path resolution maps `activeProfileId` to `profiles/<activeProfileId>/`:

```ts
type ProfileResolutionResult = {
  status: "resolved" | "not_found" | "invalid";
  profileId: string;
  profilePath: string;
  contracts: ProfileContracts | null;
  error?: string;
};
```

### 6.4 Profile Validation

Before intake or generation proceeds, Core must validate that the resolved profile:

- Exists on disk at `profiles/<activeProfileId>/`.
- Contains the required profile contracts (e.g., `docs.yml`, phase descriptors, question registry, schemas).
- Has a valid profile structure conforming to the profile contract schema.

If validation fails, Core must return a blocking error with code `profile_not_found` or equivalent profile validation error.

### 6.5 Profile-Derived Contracts

A resolved profile provides all contracts that drive LOGOS behavior:

- Question registry: loaded from the active profile's question definitions.
- Document contracts: loaded from the active profile's `docs.yml` and phase descriptors.
- Validation rules: derived from the active profile's schemas and quality rules.
- Generation configuration: loaded from the active profile's generation descriptors.
- Artifact configuration: loaded from the active profile's artifact descriptors.
- Executive output rules: loaded from the active profile's Executive contracts.

No LOGOS subsystem may derive these contracts from hardcoded paths. All must resolve through the active profile.

### 6.6 Error Handling

When the active profile cannot be resolved:

| Condition | Error code | Behavior |
|-----------|-----------|----------|
| Profile directory missing | `profile_not_found` | Block /logos-init, /logos-start, /logos-generate |
| Required contracts missing | `profile_invalid` | Block /logos-start, /logos-generate |
| Profile schema invalid | `profile_invalid` | Block /logos-start, /logos-generate |

`/logos-status` must report a missing or invalid profile as a blocking condition.

### 6.7 Integration With Other Flows

Profile resolution gates the following flows:

- **Initialization**: `/logos-init` resolves the active profile before creating project state (see §8.1). Defaults to `standard`. Blocks on missing profile.
- **Intake startup**: `/logos-start` validates the active profile exists before entering `intake_active` mode (see §8.2).
- **Generation preflight**: `/logos-generate` validates the active profile exists and is valid before computing completeness or generating outputs (see §8.6).
- **Status reporting**: `/logos-status` reports whether the active profile is resolved, missing, or invalid (see §8.5).

### 6.8 Non-Goals

The Profile Resolution Architecture does not support in the MVP:

- Remote profile registry.
- Profile marketplace.
- User-authored profile editor.
- Dynamic profile installation at runtime.
- Visual profile selector UI.
- Runtime profile switching after initialization.

## 7. Pi Extension Boundary

The Pi extension owns Pi-specific integration.

### 7.1 Extension Responsibilities

The Pi extension is responsible for:

- registering `/logos-init`;
- registering `/logos-start`;
- registering `/logos-stop`;
- registering `/logos-status`;
- registering `/logos-generate`;
- detecting the current project root from Pi/runtime context;
- invoking LOGOS Core APIs;
- rendering Core results to the user;
- routing user messages to Core while intake mode is active;
- using Pi UI affordances when helpful;
- exposing optional tools to the LLM when they support the conversational workflow;
- preserving Pi-specific session continuity when useful.

### 7.2 Extension Must Not Own Core Behavior

The Pi extension must not:

- decide question order directly;
- hardcode Standard profile document structure;
- evaluate answer sufficiency itself;
- compile documentation itself;
- mutate `.logos/` state without Core transition logic;
- bypass generation preflight;
- invent command-first alternatives to the conversational flow.

## 8. Runtime Flow

### 8.1 Initialization Flow

```txt
User runs /logos-init
  ↓
Pi extension detects project root
  ↓
Pi extension calls core.initProject(...)
  ↓
Core resolves active profile (default to standard)
  ↓
Core validates profile exists and has required contracts
  ↓
Core validates root and existing files
  ↓
Core creates .logos/ runtime state if safe
  ↓
Core persists activeProfileId in .logos/config.yml
  ↓
Core creates or validates project documentation scaffold
  ↓
Core returns InitProjectResult
  ↓
Pi extension renders result
```

`/logos-init` may refuse destructive overwrites and ask for explicit confirmation when needed.

If the active profile does not exist, Core returns a `profile_not_found` error and initialization is blocked.

### 8.2 Start Intake Flow

```txt
User runs /logos-start
  ↓
Pi extension detects project root
  ↓
Pi extension calls core.startIntake(...)
  ↓
Core validates active profile exists and has required contracts
  ↓
Core loads intake state
  ↓
Core selects active unresolved follow-up or next unresolved question
  ↓
Core marks intake mode active
  ↓
Core persists activeQuestionId
  ↓
Core returns the question to ask
  ↓
Pi extension immediately renders the agent's question
```

This flow is mandatory.

The extension must not enter intake mode silently.

The agent must ask first after `/logos-start`.

### 8.3 Conversational Answer Flow

```txt
User answers naturally
  ↓
Pi extension detects active LOGOS intake mode
  ↓
Pi extension calls core.handleIntakeMessage(...)
  ↓
Core classifies user intent
  ↓
Core evaluates answer or control intent
  ↓
Core persists answer/evaluation/transition
  ↓
Core returns next assistant action
  ↓
Pi extension renders follow-up, next question, status, pause, or error
```

### 8.4 Stop Flow

```txt
User runs /logos-stop
  ↓
Pi extension calls core.stopIntake(...)
  ↓
Core persists paused mode and active question
  ↓
Core returns progress summary
  ↓
Pi extension renders pause confirmation
```

`/logos-stop` must not generate documentation.

### 8.5 Status Flow

```txt
User runs /logos-status
  ↓
Pi extension calls core.getStatus(...)
  ↓
Core loads state and computes progress
  ↓
Core returns read-only status
  ↓
Pi extension renders status
```

`/logos-status` must not mutate state.

### 8.6 Generation Flow

```txt
User runs /logos-generate
  ↓
Pi extension calls core.generate(...)
  ↓
Core validates active profile exists and has required contracts
  ↓
Core runs generation preflight
  ↓
If blockers exist, Core returns blockers and warnings
  ↓
If partial generation is allowed, extension requests explicit confirmation
  ↓
Core compiles documentation and artifacts only after allowed
  ↓
Core writes generated outputs through safe writer ports
  ↓
Pi extension renders generated paths and warnings
```

Generation must never silently ignore missing critical inputs.

### 8.7 Command Interruption Flow

When a lifecycle command arrives while intake mode is active:

```txt
Incoming user message
  ↓
Pi extension detects slash command syntax
  ↓
Pi extension detects active LOGOS intake mode
  ↓
Pi extension calls core.handleIntakeCommand(...)
  ↓
Core reads active question/follow-up from state
  ↓
Core persists current intake state snapshot
  ↓
Core returns required pre-action (block, pause_and_execute, reaffirm, confirm_required)
  ↓
Pi extension executes the commanded behavior only after Core's pre-action completes
  ↓
Pi extension renders result
```

The extension must not short-circuit this flow. It must not route command text to `handleIntakeMessage` and must not execute command behavior before Core confirms the interruption is safe.

## 9. Conversational Intake Session Model

### 9.1 Intake Session States

Recommended session states:

```ts
type IntakeMode =
  | "idle"
  | "intake_active"
  | "paused"
  | "generating"
  | "complete";
```

State transitions:

```txt
idle
  └── /logos-start → intake_active

paused
  └── /logos-start → intake_active

intake_active
  ├── /logos-stop → paused (preserve active question)
  ├── /logos-status → paused (preserve, persist, then report)
  ├── /logos-generate → paused (preserve, persist, then generate)
  ├── /logos-start → intake_active (re-emit, no transition)
  ├── /logos-init → intake_active (blocked, confirmation required)
  ├── intake complete → complete
  └── blocking error → paused or idle

generating
  ├── generation complete → complete or paused
  └── generation blocked → paused
```

### 9.2 Agent-Initiated Start

When transitioning to `intake_active` through `/logos-start`, Core must return an assistant prompt payload.

Recommended result shape:

```ts
type StartIntakeResult = {
  status: "started" | "resumed" | "already_active" | "complete" | "blocked";
  mode: IntakeMode;
  activeQuestionId?: string;
  assistantMessage?: AssistantMessage;
  warnings: string[];
  blockers: string[];
};
```

If `status` is `started`, `resumed`, or `already_active`, `assistantMessage` must be present unless a blocking error prevents intake.

### 9.3 Active Question Contract

An active intake session must always know which question or follow-up is active.

Recommended shape:

```ts
type ActivePrompt = {
  kind: "question" | "follow_up" | "contradiction_resolution";
  questionId: string;
  text: string;
  context?: string;
  required: boolean;
  priority: "critical" | "important" | "optional";
};
```

The user replies to the active prompt, not to an implicit questionnaire.

## 10. Question Selection Architecture

Question selection belongs to LOGOS Core.

### 10.1 Inputs

The question selector should use:

- profile question registry;
- current intake state;
- answered questions;
- partial questions;
- contradictions;
- dependencies between questions;
- required/optional priority;
- phase ordering;
- follow-up state.

### 10.2 Selection Priority

Selection should prioritize:

1. unresolved contradiction resolution;
2. active unresolved follow-up;
3. required critical unanswered questions;
4. required critical partial questions;
5. important unanswered questions;
6. important partial questions;
7. optional questions;
8. completion.

### 10.3 Selector Output

Recommended shape:

```ts
type NextPromptSelection = {
  status: "selected" | "complete" | "blocked";
  prompt?: ActivePrompt;
  reason: string;
  blockers: string[];
};
```

The Pi extension should render this output. It should not reselect questions.

## 11. Answer Evaluation Architecture

Answer evaluation has two layers:

1. deterministic structural evaluation;
2. optional AI-assisted semantic evaluation.

### 11.1 Deterministic Evaluation

Deterministic evaluation checks:

- active question exists;
- answer is not empty;
- answer is not command-only unless it is a lifecycle/control command;
- answer belongs to the active question or is a recognized intake control intent;
- required question metadata exists;
- evaluation result shape is valid.

### 11.2 AI-Assisted Evaluation

AI-assisted evaluation may assess:

- whether the answer satisfies acceptance criteria;
- whether the answer is too generic;
- which aspects are missing;
- whether a targeted follow-up is needed;
- whether the answer contradicts prior accepted state;
- which facts, assumptions, decisions, and risks were extracted.

AI output must be validated before becoming state.

### 11.3 Evaluation Result

The canonical evaluation shape remains:

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

### 11.4 Advancement Rule

Core may advance only when:

- evaluation status is `sufficient`;
- `shouldAdvance` is true;
- completeness threshold is met;
- no unresolved contradiction exists;
- required acceptance criteria are satisfied.

The Pi extension must not override advancement decisions.

## 12. User Intent Classification

While intake mode is active, user messages must be classified before being treated as answers.

Recommended shape:

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

### 12.1 Intent Routing

```txt
answer_current_question
  → evaluate answer

ask_question_about_current_question
  → explain question and re-ask or clarify

revise_previous_answer
  → locate target answer, revise through controlled transition

pause_intake
  → stop/pause intake

skip_current_question
  → mark partial/skipped according to policy

request_status
  → return status without mutation except session continuity

request_generation
  → run generation preflight

out_of_scope
  → ask whether to pause intake or continue
```

Intent classification may use AI, but the resulting intent must be constrained to the allowed enum.

## 13. Persistence Architecture

### 13.1 Project-Local State

Canonical LOGOS state must live inside the project.

Recommended runtime directory:

```txt
.logos/
├── config.yml
├── intake-state.json
├── answers.json
├── question-index.json
├── generation-state.json
└── logs/
```

Exact file names may evolve, but the state must remain project-local and recoverable outside a single Pi session.

### 13.2 State Repository Port

Core should depend on a state repository port.

Recommended shape:

```ts
type LogosStateRepository = {
  loadConfig(projectRoot: string): Promise<LogosConfig>;
  saveConfig(projectRoot: string, config: LogosConfig): Promise<void>;

  loadIntakeState(projectRoot: string): Promise<LogosIntakeState>;
  saveIntakeState(projectRoot: string, state: LogosIntakeState): Promise<void>;

  loadGenerationState(projectRoot: string): Promise<GenerationState>;
  saveGenerationState(projectRoot: string, state: GenerationState): Promise<void>;
};
```

The concrete filesystem implementation should live outside pure Core logic or behind adapters.

### 13.3 Persistence Timing

Persist state after:

- initialization;
- `/logos-start` activation;
- every accepted answer;
- every partial answer;
- every contradiction;
- every skip/pending marker;
- every follow-up transition;
- `/logos-stop`;
- generation preflight;
- generation completion or failure.

### 13.4 State Consistency

If chat context and persisted state diverge, persisted state wins.

The user may explicitly ask to correct persisted state.

Such corrections must be modeled as state transitions, not silent overwrites.

## 14. Generation Preflight Architecture

Generation preflight belongs to Core.

### 14.1 Preflight Inputs

Preflight uses:

- current project config;
- loaded profile contracts;
- intake state;
- answer evaluations;
- completeness thresholds;
- output configuration;
- safe write plan;
- existing target files.

### 14.2 Preflight Output

Recommended shape:

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

### 14.3 Generation Modes

Recommended generation modes:

```ts
type GenerationMode =
  | "final"
  | "partial_draft"
  | "dry_run";
```

`final` requires no critical blockers.

`partial_draft` requires explicit user confirmation and must mark generated documentation as incomplete.

`dry_run` returns a write plan without writing files.

## 15. Rendering Architecture

Core returns structured messages.

Pi extension renders them.

### 15.1 Assistant Message Shape

Recommended shape:

```ts
type AssistantMessage = {
  kind:
    | "question"
    | "follow_up"
    | "clarification"
    | "contradiction"
    | "status"
    | "warning"
    | "error"
    | "generation_result";

  title?: string;
  body: string;
  questionId?: string;
  actions?: AssistantAction[];
  metadata?: Record<string, unknown>;
};
```

### 15.2 Rendering Rules

The extension should render:

- questions clearly;
- follow-ups as continuation of the active question;
- contradictions as explicit choices or clarification requests;
- status as concise progress summaries;
- generation blockers as actionable warnings;
- generated file paths when generation succeeds.

Rendering must not hide missing critical information.

## 16. Pi Extension Integration Architecture

The extension must follow the official Pi extension model.

Reference:

```txt
https://pi.dev/docs/latest/extensions
```

When implementing this layer, verify current APIs against the installed Pi version and official docs.

### 16.1 Command Registration

The extension registers only lifecycle commands.

Recommended command modules:

```txt
src/pi-extension/commands/init-command.ts
src/pi-extension/commands/start-command.ts
src/pi-extension/commands/stop-command.ts
src/pi-extension/commands/status-command.ts
src/pi-extension/commands/generate-command.ts
```

Each command should:

1. resolve project context;
2. call Core;
3. render the result;
4. avoid duplicating Core logic.

### 16.2 Input Interception

The extension must route user messages to Core while intake mode is active.

The exact Pi API should be verified in the Pi docs and installed types.

Architecturally, input handling must support:

```txt
Incoming user message
  ↓
Check active LOGOS intake state
  ↓
If inactive: do not intercept normal Pi behavior
  ↓
If active: detect whether message is a slash command
  ↓
If slash command: route to core.handleIntakeCommand(...) before command execution
  ↓
If not a slash command: route to core.handleIntakeMessage(...)
  ↓
Render Core response
```

### 16.3 Optional Tools

The extension may expose tools to the LLM, such as:

- read LOGOS status;
- read active LOGOS question;
- submit evaluated intake response;
- run generation preflight;
- list generated artifacts.

Tools must not create a parallel command-first workflow.

### 16.4 Optional UI

The extension may use Pi UI helpers for:

- explicit confirmation before partial generation;
- selecting between contradiction-resolution options;
- displaying status summaries;
- previewing generated paths.

UI helpers must support the conversational flow. They must not replace intake with a menu questionnaire.

## 17. Error Handling Architecture

Errors should be structured.

Recommended error categories:

```ts
type LogosErrorCode =
  | "project_not_initialized"
  | "invalid_project_root"
  | "profile_not_found"
  | "profile_invalid"
  | "intake_not_started"
  | "intake_already_complete"
  | "active_question_missing"
  | "question_registry_invalid"
  | "state_read_failed"
  | "state_write_failed"
  | "evaluation_failed"
  | "preflight_blocked"
  | "generation_failed"
  | "pi_extension_api_unavailable";
```

Core should return structured failures where possible.

The Pi extension should render failures in user-actionable language.

## 18. Testing Architecture

Testing must prove the conversational architecture, not just command registration.

### 18.1 Core Tests

Core tests should cover:

- project initialization planning;
- question registry loading;
- next-question selection;
- active unresolved follow-up selection;
- answer evaluation result validation;
- state transitions;
- progress calculation;
- generation preflight;
- partial generation blocking;
- Core independence from Pi.

### 18.2 Pi Extension Tests

Pi extension tests should cover:

- command registration;
- `/logos-start` immediately emitting a question;
- active intake message routing;
- no silent passive mode after `/logos-start`;
- `/logos-stop` preserving active question;
- `/logos-status` read-only behavior;
- `/logos-generate` preflight rendering;
- explicit confirmation for partial generation.

### 18.3 Contract Tests

Contract tests should prove:

```txt
Given LOGOS is initialized
When the user runs /logos-start
Then the agent immediately asks the next unresolved question
And the system does not wait silently for the user's next message
```

```txt
Given intake mode is active
And the agent has asked Q1
When the user answers sufficiently
Then Core persists the answer
And the agent asks Q2 without requiring /logos-next
```

```txt
Given intake mode is active
And the user gives a partial answer
Then Core persists the partial answer
And the agent asks a targeted follow-up
And does not advance to Q2
```

```txt
Given critical intake information is missing
When the user runs /logos-generate
Then Core returns blockers
And final generation does not proceed silently
```

```txt
Given intake mode is active
And the agent has asked Q1
When the user runs /logos-status
Then Core pauses intake
And preserves Q1 as active
And persists state
And reports status
And does not treat /logos-status as an answer to Q1
```

```txt
Given intake mode is active
And the agent has asked Q1
When the user runs /logos-start
Then Core does not create a new session
And does not advance the question
And re-emits Q1 or its active follow-up
```

```txt
Given intake mode is active
And the agent has asked Q1
When the user runs /logos-init
Then Core blocks initialization
And warns that active state will be lost
And does not reinitialize without explicit confirmation
```

## 19. Migration From Legacy CLI/TUI

The repository may contain existing CLI/TUI code from the previous architecture.

This code should be treated as legacy or transitional unless it aligns with the Pi extension direction.

### 19.1 Migration Strategy

Prefer extracting reusable logic into Core rather than extending CLI/TUI behavior.

Migration order:

1. identify reusable non-UI logic;
2. move or wrap it behind Core APIs;
3. add tests proving Core works without CLI/TUI imports;
4. implement Pi extension commands as adapters over Core;
5. remove or deprecate command-first flows that conflict with the SPEC;
6. keep legacy CLI only if explicitly required and non-conflicting.

### 19.2 Legacy Code Red Flags

Treat these as signs that code should be refactored:

- command handler directly selects next question;
- command handler directly mutates intake state;
- TUI component contains generation logic;
- UI code imports profile parsing internals;
- CLI commands are required for intake progression;
- answer submission is command-based;
- `/logos-start` only toggles a mode and waits silently;
- generation runs without preflight.

## 20. Architecture Risks

### 20.1 Pi API Drift

Pi extension APIs may change.

Mitigation:

- verify against official docs and installed types;
- isolate Pi-specific code under `src/pi-extension/`;
- keep Core free from Pi imports.

### 20.2 Command-First Regression

Agents may reintroduce command-first behavior because it is easier to implement.

Mitigation:

- keep forbidden command list in SPEC and AGENTS;
- add tests proving no command is required after `/logos-start`;
- make `/logos-start` assistant-initiated by contract.

### 20.3 State Split Between Pi And LOGOS

Pi session state may diverge from LOGOS project state.

Mitigation:

- canonical state lives in `.logos/`;
- Pi state is only interaction continuity;
- persisted LOGOS state wins on conflict.

### 20.4 AI Overreach

The model may accept vague answers, resolve contradictions, or generate final docs too early.

Mitigation:

- constrained evaluation schema;
- preflight blockers;
- explicit contradiction resolution;
- partial draft marking;
- deterministic validation around AI output.

### 20.5 Legacy Coupling

Existing CLI/TUI code may make Core extraction harder.

Mitigation:

- extract logic behind ports;
- test Core independently;
- avoid extending legacy UI paths unless necessary.

### 20.6 Command Interruption Risk

If command messages are routed to intake evaluation during active intake, the model may treat commands as answers, discarding the active question.

Mitigation:

- command detection must precede answer evaluation;
- Core owns interruption state transitions;
- the active question must be persisted before any command executes;
- contract tests must prove commands are never evaluated as answers;
- `/logos-init` during active intake must require explicit confirmation.

### 20.7 Profile Hardcoding Risk

Code may hardcode `profiles/standard` paths instead of resolving through the active profile, making future profile support impossible.

Mitigation:

- Profile resolution lives in Core behind a single resolution API.
- All subsystems load contracts through the resolved active profile, never from hardcoded paths.
- Tests must prove that question registries, validation rules, generation config, and Executive outputs load from the active profile, not a hardcoded path.
- Contract tests must prove that a future profile under `profiles/<custom-id>/` works without Core code changes.

## 21. Intake Command Interruption Architecture

This section defines the runtime architecture for handling lifecycle commands that arrive while LOGOS intake mode is active.

### 21.1 Design Principle

Commands during active intake are control intents, not answers. The architecture must prevent command text from being evaluated as an answer and must preserve the active question before any command-specific behavior executes.

### 21.2 Command Detection And Routing

Incoming messages during active intake must be checked for command syntax before being routed to intake handling.

```txt
Incoming user message
  ↓
Detect whether message is a slash command
  ↓
If not a command and intake is active: route to core.handleIntakeMessage(...)
  ↓
If command and intake is active: apply interruption policy before command-specific behavior
  ↓
Preserve active question/follow-up before executing interrupting command
  ↓
Execute lifecycle command behavior
```

The Pi extension may detect commands and route them, but LOGOS Core must own the state transition semantics for command interruption. The extension must not independently decide that a command message is an answer or that the active question can be silently discarded.

### 21.3 Core Ownership

Command interruption transitions belong in Core, not only in Pi rendering.

Core must expose an API for the extension to signal that a command was received during active intake. Recommended shape:

```ts
type HandleIntakeCommandInput = {
  projectRoot: string;
  command: LogosLifecycleCommand;
  activeIntakeState: LogosIntakeState;
};

type HandleIntakeCommandResult = {
  action: "block" | "pause_and_execute" | "reaffirm" | "confirm_required";
  preservedQuestionId?: string;
  preservedFollowUp?: ActivePrompt;
  persisted: boolean;
  message: AssistantMessage;
};
```

The extension calls this API before executing command-specific behavior. Core returns the required pre-action and the extension follows it.

### 21.4 Command-Specific Architecture

#### `/logos-start` During Active Intake

Core receives `HandleIntakeCommandInput` with command `logos-start`.

```txt
Core detects intake is already active
  ↓
Core does NOT transition state to new session
  ↓
Core reads activeQuestionId and any active follow-up
  ↓
Core returns { action: "reaffirm", preservedQuestionId, message: re-emit prompt }
  ↓
Extension renders the re-emitted prompt
```

State mutation: none. The active question and mode remain unchanged.

#### `/logos-stop` During Active Intake

```txt
Core receives HandleIntakeCommandInput with command logos-stop
  ↓
Core reads activeQuestionId and active follow-up
  ↓
Core persists current intake state with active question preserved
  ↓
Core transitions mode to "paused"
  ↓
Core returns { action: "pause_and_execute", persisted: true }
  ↓
Extension renders pause confirmation with progress
```

State mutation: mode → paused, active question preserved.

#### `/logos-status` During Active Intake

```txt
Core receives HandleIntakeCommandInput with command logos-status
  ↓
Core reads activeQuestionId and active follow-up
  ↓
Core persists current intake state with active question preserved
  ↓
Core transitions mode to "paused"
  ↓
Core loads state and computes status
  ↓
Core returns { action: "pause_and_execute", preservedQuestionId, persisted: true, message: status }
  ↓
Extension renders status without treating command as answer
```

State mutation: mode → paused, active question preserved, status computed from persisted state.

#### `/logos-generate` During Active Intake

```txt
Core receives HandleIntakeCommandInput with command logos-generate
  ↓
Core reads activeQuestionId and active follow-up
  ↓
Core persists current intake state with active question preserved
  ↓
Core transitions mode to "paused"
  ↓
Core runs generation preflight
  ↓
Core returns { action: "pause_and_execute", preservedQuestionId, persisted: true, message: preflight result }
  ↓
Extension renders preflight result; requests confirmation if partial
```

State mutation: mode → paused, active question preserved, generation preflight recorded.

#### `/logos-init` During Active Intake

```txt
Core receives HandleIntakeCommandInput with command logos-init
  ↓
Core detects active intake mode
  ↓
Core returns { action: "confirm_required", message: warning about state loss }
  ↓
Extension renders confirmation prompt
  ↓
If user confirms, Core proceeds with reinitialization (destructive)
  ↓
If user declines, Core returns to active intake with preserved state
```

State mutation: blocked unless explicitly confirmed.

### 21.5 State Preservation Contract

Before any interrupting command executes, Core must:

1. Read the active question id and any active follow-up from current state.
2. Persist the current intake state snapshot.
3. Return the preserved identifiers in the result.

The extension must not bypass this preservation step.

### 21.6 Prohibited Patterns

The following patterns are architecturally prohibited:

* Routing command text to `handleIntakeMessage` as an answer.
* Executing command behavior without first calling Core's interruption handler.
* Discarding the active question id before command execution.
* Silently transitioning to a new question during command handling.
* Treating `/logos-status` or `/logos-generate` as purely observational when intake is active.
* Allowing `/logos-init` to reinitialize without confirmation during active intake.

### 21.7 Architecture Tests

Architecture-level tests must prove:

```txt
Given active intake with Q1
When any lifecycle command arrives
Then Core's interruption handler is called before command behavior
And Q1 id is preserved in the result
And state is persisted before command execution
```

```txt
Given active intake with Q1
When the extension receives a command message
Then the extension does not route the message to handleIntakeMessage
And the extension calls handleIntakeCommand instead
```

## 22. Architecture Decision

The architecture decision is:

```txt
LOGOS Core is the product engine.
LOGOS Pi Extension is the first interaction surface.
Pi commands are lifecycle controls.
Conversational intake is the primary workflow.
/logos-start must make the agent ask first.
Project-local LOGOS state is canonical.
Active profile resolution is owned by Core, defaulting to standard.
Generated docs and artifacts are reproducible projections from active profile contracts.
Slash commands during active intake are control intents, not answers.
```

Any implementation that violates these boundaries should be treated as architecturally non-compliant.