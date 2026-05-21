# LOGOS Pi Extension Implementation Plan

## 1. Purpose

This document defines the implementation workstreams, tasks, contracts, tests, and exit criteria for the LOGOS Pi Extension architecture.

It is an execution companion to:

- `docs/LOGOS_PI_EXTENSION_SPEC.md` (product contract);
- `docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md` (technical boundaries).

The implementation plan exists to translate the spec and architecture into ordered, testable work.

## 2. Workstreams

### 2.1 LOGOS Core Implementation

Core logic independent from Pi. Delivers project initialization, question selection, answer evaluation, intake state transitions, completeness calculation, generation preflight, document compilation, and validation.

### 2.2 Pi Extension Surface

Pi-specific orchestration. Delivers command registration, input routing, message rendering, and Core API invocation.

### 2.3 State Persistence

Project-local `.logos/` state. Delivers configuration storage, intake state persistence, answer persistence, and generation state persistence.

### 2.4 Intake Command Interruption

Command-handling safety during active intake. Delivers command detection, safe pause-before-command, active question preservation, and blocked/confirmed reinitialization.

### 2.5 Generation Pipeline

Document and artifact generation. Delivers preflight, safe writers, canonical compilation, derived artifacts, and partial draft marking.

### 2.6 Testing Infrastructure

Coverage for all contracts. Delivers core tests, extension tests, contract tests, and fake providers.

### 2.7 Profile Resolution

Profile loading and resolution. Delivers active profile detection, profile path mapping, profile validation, generic profile contract loading, and missing-profile error handling.

## 3. Workstream: Intake Command Interruption

### 3.1 Objective

Ensure that lifecycle commands issued during active LOGOS intake mode are handled as control intents, not as answers to the active question. Prevent the active question from being corrupted, skipped, replaced, or silently completed by any lifecycle command.

### 3.2 Required Contracts

Core must expose:

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

The Pi extension must:

- Detect slash commands in incoming messages before routing to `handleIntakeMessage`.
- Call `core.handleIntakeCommand(...)` when a command is detected during active intake.
- Respect the returned `action` before executing command-specific behavior.
- Never route command text to answer evaluation.

### 3.3 Implementation Tasks

| Task | Description | Dependencies |
|------|-------------|-------------|
| IC-1 | Detect command messages during active intake in Pi extension input routing | Core intake state available |
| IC-2 | Implement `core.handleIntakeCommand(...)` with interruption logic | Core state repository, intake state types |
| IC-3 | Prevent command text from being routed to `handleIntakeMessage` or answer evaluation | IC-1, IC-2 |
| IC-4 | Implement safe pause-before-command behavior for `/logos-stop`, `/logos-status`, `/logos-generate` | IC-2 |
| IC-5 | Preserve active question id and active follow-up before every interrupting command | IC-2 |
| IC-6 | Define `/logos-start` active-intake exception: re-emit without pausing or advancing | IC-2 |
| IC-7 | Block or require explicit confirmation for `/logos-init` during active intake | IC-2 |
| IC-8 | Persist intake state before command-specific behavior executes for pausing commands | IC-2, state repository |
| IC-9 | Add contract tests for all command interruption behaviors | IC-1 through IC-8 |
| IC-10 | Update Pi extension command handlers to call interruption API before executing | IC-2 |

### 3.4 Tests

#### Core Tests

```txt
Given active intake with Q1
When core.handleIntakeCommand is called with command logos-status
Then core returns action "pause_and_execute"
And preservedQuestionId is Q1
And persisted is true
```

```txt
Given active intake with Q1
When core.handleIntakeCommand is called with command logos-generate
Then core returns action "pause_and_execute"
And preservedQuestionId is Q1
And persisted is true
```

```txt
Given active intake with Q1
When core.handleIntakeCommand is called with command logos-start
Then core returns action "reaffirm"
And preservedQuestionId is Q1
And no state mutation occurs
```

```txt
Given active intake with Q1
When core.handleIntakeCommand is called with command logos-stop
Then core returns action "pause_and_execute"
And preservedQuestionId is Q1
And mode transitions to paused
```

```txt
Given active intake with Q1
When core.handleIntakeCommand is called with command logos-init
Then core returns action "confirm_required"
And no state mutation occurs
And message warns about state loss
```

```txt
Given no active intake
When core.handleIntakeCommand is called with any command
Then core returns action "pause_and_execute" with no preservation needed
```

#### Extension Tests

```txt
Given intake mode is active
And the agent has asked Q1
When the user sends /logos-status
Then the extension calls core.handleIntakeCommand, not core.handleIntakeMessage
And the extension does not submit /logos-status as an answer to Q1
```

```txt
Given intake mode is active
When the user sends /logos-init
Then the extension blocks and requests explicit confirmation
And does not reinitialize silently
```

### 3.5 Exit Criteria

The Intake Command Interruption workstream is complete when:

- [ ] Slash commands during active intake are detected before answer evaluation.
- [ ] Command text is never routed to `handleIntakeMessage` or answer evaluation.
- [ ] `/logos-stop` during active intake pauses safely and preserves the active question.
- [ ] `/logos-status` during active intake pauses, persists, then reports without consuming the command as an answer.
- [ ] `/logos-generate` during active intake pauses, persists, then runs preflight without consuming the command as an answer.
- [ ] `/logos-start` during active intake re-emits the active prompt without advancing or creating a new session.
- [ ] `/logos-init` during active intake blocks or requires explicit confirmation.
- [ ] No command corrupts, skips, replaces, or silently completes the active question.
- [ ] All contract tests pass.
- [ ] Core logic is testable without Pi dependencies.

## 4. Workstream: Profile Resolution

### 4.1 Objective

Ensure that LOGOS resolves the active profile generically, defaults to `standard`, validates profile existence before intake or generation, and supports future profiles under `profiles/<profile-id>/` without Core code changes.

### 4.2 Required Contracts

Core must expose profile resolution logic:

- Read `activeProfileId` from `.logos/config.yml`.
- Default to `standard` when no active profile id is configured.
- Resolve profile path to `profiles/<activeProfileId>/`.
- Validate that the profile directory exists and contains required contracts.
- Return a structured result indicating success, not-found, or invalid.

Pi Extension must:

- Not resolve profile internals or hardcode profile paths.
- Pass a selected profile id during `/logos-init` only if explicitly provided.
- Call Core for all profile-dependent operations.

### 4.3 Implementation Tasks

| Task | Description | Dependencies |
|------|-------------|-------------|
| PR-1 | Define `activeProfileId` field in `.logos/config.yml` schema | Config schema |
| PR-2 | Default `activeProfileId` to `standard` when no profile is selected | PR-1 |
| PR-3 | Implement generic profile path resolution: `profiles/<profile-id>/` → contracts | PR-2 |
| PR-4 | Validate selected profile exists on disk at resolved path | PR-3 |
| PR-5 | Validate required profile files/contracts exist (docs.yml, phase descriptors, question registry, schemas) | PR-4 |
| PR-6 | Make question registry loading profile-driven (load from active profile) | PR-3 |
| PR-7 | Make generation and Executive outputs profile-driven | PR-3 |
| PR-8 | Ensure Pi Extension calls Core for profile resolution instead of hardcoding paths | PR-3 |
| PR-9 | Implement missing-profile blocking: `/logos-init`, `/logos-start`, `/logos-generate` | PR-4 |
| PR-10 | Report missing or invalid profile in `/logos-status` | PR-9 |
| PR-11 | Add contract tests for default, missing, and future custom profile behavior | PR-1 through PR-10 |

### 4.4 Tests

#### Core Tests

```txt
Given no activeProfileId in .logos/config.yml
When Core resolves the active profile
Then Core defaults to standard
And resolves the profile path to profiles/standard/
```

```txt
Given activeProfileId is standard
When Core loads the profile
Then Core validates profiles/standard/ exists and has required contracts
```

```txt
Given activeProfileId is custom-profile
And profiles/custom-profile/ does not exist
When Core resolves the active profile
Then Core returns status not_found with error code profile_not_found
```

```txt
Given activeProfileId is custom-profile
And profiles/custom-profile/ exists with valid contracts
When Core loads the profile
Then Core returns status resolved with loaded contracts
```

```txt
Given activeProfileId references a missing profile
When Core handles `/logos-init`
Then Core returns a blocker with error code profile_not_found
And initialization does not proceed
```

```txt
Given activeProfileId references a missing profile
When Core handles `/logos-start`
Then Core returns a blocker with error code profile_not_found
And intake does not enter intake_active mode
```

```txt
Given activeProfileId references a missing profile
When Core runs generation preflight
Then Core returns a blocker with error code profile_not_found
And generation does not proceed
```

```txt
Given a future profile exists at profiles/custom-profile/ with full contracts
When the system is configured with activeProfileId: custom-profile
Then Core loads question registry from profiles/custom-profile/
And loads validation rules from profiles/custom-profile/
And loads generation config from profiles/custom-profile/
And loads Executive output rules from profiles/custom-profile/
```

### 4.5 Exit Criteria

The Profile Resolution workstream is complete when:

- [ ] `activeProfileId` is defined in `.logos/config.yml` schema and defaults to `standard`.
- [ ] Profile paths are resolved generically from `profiles/<profile-id>/`.
- [ ] Profile existence and required contracts are validated before intake or generation.
- [ ] Missing profile blocks `/logos-init`, `/logos-start`, and `/logos-generate` with `profile_not_found`.
- [ ] Question registry, validation rules, generation config, and Executive outputs load from the active profile.
- [ ] Pi Extension does not hardcode profile paths or profile internals.
- [ ] Future profiles under `profiles/<profile-id>/` work without Core code changes.
- [ ] All contract tests pass.
- [ ] Core profile resolution is testable without Pi dependencies.

## 5. Roadmap Input Checklist

The following items must be present in any future roadmap phase that includes this policy:

- [ ] Intake Command Interruption detection in Pi extension input routing.
- [ ] `core.handleIntakeCommand(...)` API with interruption actions.
- [ ] Safe pause-before-command for `/logos-stop`, `/logos-status`, `/logos-generate`.
- [ ] Active question preservation before any interrupting command.
- [ ] `/logos-start` active-intake re-emit exception.
- [ ] `/logos-init` block-or-confirm during active intake.
- [ ] Contract tests proving commands are never evaluated as answers.
- [ ] Architecture compliance check: command text never reaches answer evaluation.
- [ ] Profile resolution: `activeProfileId` in `.logos/config.yml`, defaults to `standard`.
- [ ] Generic profile path resolution: `profiles/<profile-id>/` → contracts.
- [ ] Profile existence and contract validation before intake and generation.
- [ ] Missing-profile blocking for `/logos-init`, `/logos-start`, `/logos-generate`.
- [ ] Profile-driven question registry, validation, generation, and Executive output loading.
- [ ] Pi Extension calls Core for profile resolution, never hardcodes profile paths.
- [ ] Contract tests for default, missing, and custom profile behavior.

## 6. Non-Goals For This Plan

- Implementing the full conversational intake loop.
- Implementing question registry loading.
- Implementing answer evaluation AI integration.
- Implementing canonical document compilation.
- Implementing derived artifact generation.
- Implementing Pi UI custom components.

Those belong in their respective workstreams.

## 7. Plan Validation

Before marking any workstream complete, validate:

1. All exit criteria are satisfied.
2. All contract tests pass.
3. Core is testable without Pi.
4. Pi extension calls Core APIs without owning Core logic.
5. No forbidden command patterns have been introduced.
6. The Intake Command Interruption Policy is enforced in all lifecycle commands.
