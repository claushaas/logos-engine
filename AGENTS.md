# AGENTS.md

This file is the semantic operating layer for AI coding agents working in LOGOS Engine.
It is not onboarding prose and it is not a README substitute. Use it to preserve the current product direction, route retrieval, enforce boundaries, and keep implementation sessions coherent.
If this file, live code, and product specifications disagree, treat the disagreement as a product-contract conflict. Read the relevant source files, name the conflict, and ask before choosing a material direction.

## Current Product Direction

LOGOS Engine is being repositioned from a standalone local TypeScript CLI/TUI into a conversational Pi Coding Agent extension with an independent LOGOS Core.
The current target architecture is:
```txt
Pi Coding Agent
  ↓
LOGOS Pi Extension
  ↓
LOGOS Core
  ↓
Project-local state, profiles, generated documentation, and artifacts

The extension is the first product surface.

A standalone TUI may exist later, but it is not the current MVP direction unless explicitly reintroduced by a newer specification.

The controlling specification for this direction is:

docs/LOGOS_PI_EXTENSION_SPEC.md

Agents must read that file before making any command, intake, extension, or interaction-model change.

External Pi Extension Reference

When implementing or changing the Pi extension surface, consult the official Pi extension documentation:

https://pi.dev/docs/latest/extensions

Relevant Pi extension capabilities include:

* TypeScript extension modules loaded by Pi;
* project-local extensions under .pi/extensions/;
* global extensions under ~/.pi/agent/extensions/;
* custom commands registered with pi.registerCommand();
* custom tools registered with pi.registerTool();
* event interception through pi.on(...);
* input handling through Pi extension events;
* user interaction through ctx.ui;
* custom UI components through ctx.ui.custom() when needed;
* session persistence through Pi session mechanisms such as pi.appendEntry();
* custom rendering for messages, tool calls, and tool results.

Do not invent Pi extension APIs from memory. Check the official docs and live installed Pi types when implementation details matter.

Identity And Purpose

LOGOS is a conversational intake and compilation engine.

It helps a user clarify a project into:

* structured decisions;
* assumptions;
* open questions;
* risks;
* canonical documentation;
* derived HTML artifacts;
* executive execution artifacts;
* agent-ready implementation outputs.

LOGOS is:

* a decision clarification engine before it is a document generator;
* a conversational intake system with minimal lifecycle commands;
* a repo-scoped, local-first tool with no hosted control plane in the MVP;
* a profile-driven documentation system, starting with the bundled Standard profile;
* a structured-state system where conversation can propose truth but cannot own truth;
* a deterministic artifact pipeline for Markdown, HTML, validation reports, dependency graph views, regeneration plans, and Executive exports;
* an AI-assisted workflow where providers are adapters and user-reviewed decisions remain authoritative.

LOGOS is not:

* a command-driven documentation generator;
* a menu-based CLI workflow;
* a slash-command questionnaire;
* a SaaS application, account system, cloud synchronization service, or collaboration platform;
* a generic chat transcript store;
* an autonomous builder that silently mutates project truth;
* a live task manager or bidirectional Linear/Notion/GitHub sync engine;
* an AI validation engine;
* a repository-wide crawler that sends arbitrary source code to a model.

Interaction Contract

The primary interaction model is conversational.

Allowed lifecycle commands for the MVP:

/logos-init
/logos-start
/logos-stop
/logos-status
/logos-generate

After `/logos-start`, LOGOS must immediately produce the first assistant interaction by asking the next unresolved question or resuming the active unresolved question.

The user must not be expected to know or provide the next question.

`/logos-start` is not a passive mode toggle. It is an active intake trigger.

After the first assistant question is emitted, the user must be able to proceed by answering naturally.

The user must not need commands to:

* answer the current question;
* request clarification;
* refine an answer;
* advance to the next question;
* revisit an insufficient answer;
* mark a question as unknown or pending;
* continue the intake loop.

Forbidden command-first patterns for the MVP:

/logos-next
/logos-answer
/logos-continue
/logos-question
/logos-phase
/logos-doc
/logos-set-answer
/logos-skip
/logos-followup

Equivalent behavior must be handled through natural language while intake mode is active.

Intake Command Interruption Policy

While intake mode is active, slash commands are control intents, not answers to the active question.

No lifecycle command may leave intake in an ambiguous state. No lifecycle command may consume the command text as the answer to the active question. No command may corrupt, skip, replace, or silently complete the active question.

Per-command rules:

* `/logos-status` during active intake: must first pause intake safely, preserve the active question, persist state, then report. Must not treat `/logos-status` as an answer.
* `/logos-generate` during active intake: must first pause intake safely, preserve the active question, persist state, then run generation preflight. Must not treat `/logos-generate` as an answer.
* `/logos-stop` during active intake: must preserve the active question or active unresolved follow-up before pausing.
* `/logos-start` during active intake: must not pause, must not create a new session, must not advance the question. Must re-emit the active unresolved question or active unresolved follow-up.
* `/logos-init` during active intake: must not silently reinitialize. Must block or require explicit confirmation before any initialization action. Must warn that active intake state will be lost.

Implementation rule:

If the happy path requires commands after /logos-start, the implementation is wrong.

The acceptable happy path is:

/logos-init
/logos-start
LOGOS asks the next unresolved question
User answers conversationally
LOGOS evaluates and advances conversationally
User stops or intake completes
/logos-generate

Source Precedence And Truth Model

Use this precedence when deciding what owns a behavior:

1. Live implementation and tests define current behavior.
2. docs/LOGOS_PI_EXTENSION_SPEC.md defines the current intended Pi-extension interaction contract.
3. Profile contracts under the active profile directory (profiles/<profile-id>/) define documentation contracts. The active profile id is persisted in .logos/config.yml and defaults to standard.
4. Workspace state schema code defines local structured state.
5. Architecture/product/security docs define intended constraints.
6. Roadmap docs define phase intent, but may lag live code and newer specs.

Truth categories:

Category	Canonical location	Rule
Interaction contract	docs/LOGOS_PI_EXTENSION_SPEC.md	Defines lifecycle commands, conversational intake, state persistence, generation preflight, and acceptance tests.
Pi extension contract	Official Pi docs + installed Pi types	Defines available extension APIs, events, commands, tools, UI hooks, and persistence options.
Profile contract truth	Active profile directory: profiles/<activeProfileId>/docs.yml, phase descriptors, schemas, Executive YAML/schema files	Defines structure, required sections, dependencies, outputs, quality rules, and status workflows. Resolved through the Profile Resolution Policy. Default activeProfileId is standard.
Product truth	Project-local structured state	Accepted decisions, assumptions, questions, risks, answers, evaluations, artifacts, runs, and provenance.
Human-readable canonical content	Generated Markdown under configured documentation root	Readable projection of structured state and profile contracts.
Derived artifacts	HTML, agent packs, Executive exports, reports, graph views	Derived, reproducible, and non-authoritative unless explicitly promoted through a contract.
Pi session/UI state	Pi extension session entries, UI widgets, status, message renderers	Useful for interaction continuity, but not canonical project truth unless explicitly persisted into LOGOS state.
AI output	Provider responses, contextual suggestions, proposals	Advisory until explicitly accepted into structured state.

Never store raw provider tokens, prompts, hidden chain-of-thought, or unreviewed AI claims as project truth.

Architectural Mental Model

LOGOS must be split into two major layers.

LOGOS Core

LOGOS Core is independent from Pi.

It owns:

* project configuration logic;
* profile resolution (default to standard, load from profiles/<profile-id>/);
* profile loading;
* question registry loading;
* question selection;
* answer evaluation contracts;
* intake state transitions;
* completeness calculation;
* generation preflight;
* canonical document compilation;
* derived artifact planning;
* validation rules.

LOGOS Core must not import Pi APIs, Pi UI primitives, Pi command types, Ink components, or process-global UI assumptions.

Core behavior should be testable without Pi.

LOGOS Pi Extension

The Pi extension is the first product surface and orchestration layer.

It owns:

* registering allowed LOGOS commands with Pi;
* detecting the current project directory through Pi context;
* starting, pausing, resuming, and reporting intake status;
* connecting Pi input/conversation events to LOGOS intake mode;
* calling LOGOS Core services;
* rendering user-facing command and intake responses;
* using Pi UI affordances when useful;
* optionally adding custom tools or message renderers when they support the conversational workflow.

The Pi extension must not contain core documentation-generation logic.

The Pi extension must not hardcode the normative document structure when that structure belongs in LOGOS Core configuration.

The Pi extension must not hardcode the Standard profile structure or resolve profile internals directly. Profile resolution is owned by LOGOS Core.

Profile Resolution Policy

LOGOS resolves the active profile through a defined, generic resolution mechanism.

**Profile Locations**

Profiles live under the repository-local `profiles/` directory.

Each profile is a directory under `profiles/<profile-id>/`.

The default bundled profile is `profiles/standard/`.
The default active profile id is `standard`.

**Resolution Rules**

When no profile is explicitly selected, LOGOS must use the `standard` profile.

Business logic must not hardcode `profiles/standard` except as the default fallback.

Profile loading must be generic enough to support future profiles under `profiles/<profile-id>/`.

The active profile id must be persisted in project-local LOGOS configuration at `.logos/config.yml`.

If the selected profile does not exist, LOGOS must block initialization, intake, or generation with a clear missing-profile error.

**Core Owns Profile Resolution**

LOGOS Core owns profile resolution.

The Pi Extension may pass a selected profile id during initialization only if the user explicitly provides or selects one in a future flow.

The Pi Extension must not resolve profile internals, load profile contracts, or hardcode profile paths.

All profile-derived outputs—generated documentation, question registry, validation rules, generation outputs, and Executive outputs—must derive from the active profile contracts.

**`/logos-init` Behavior**

`/logos-init` must initialize the project using the active profile.

If no profile is explicitly selected, `/logos-init` must default to `standard` and persist `activeProfileId: standard` in `.logos/config.yml`.

If a selected profile does not exist, `/logos-init` must block with a clear missing-profile error.

**Missing Profile Behavior**

If the active profile id references a profile that does not exist on disk:

* `/logos-init` must block initialization with error code `profile_not_found`;
* `/logos-start` must block intake activation and must not enter `intake_active` mode;
* `/logos-generate` must block generation preflight;
* `/logos-status` must report the missing profile as a blocking condition.

**Future Profile Support**

Future profiles may be added by creating a new directory under `profiles/<profile-id>/` that conforms to the profile contract.

Future profile selection may be supported by configuration or an explicit initialization option.

The MVP does not require:

* remote profile registry;
* profile marketplace;
* user-authored profile editor;
* dynamic profile installation;
* visual profile selector UI.

**Profile Resolution Flow**

Core loads project config from .logos/config.yml
  ↓
Read activeProfileId
  ↓
If missing, default to standard
  ↓
Resolve profiles/<activeProfileId>/
  ↓
Validate profile exists and has required contracts
  ↓
Load profile contracts
  ↓
Use profile contracts for intake, validation, and generation

Runtime Model

Target runtime path:

1. Pi loads the LOGOS extension from a supported extension location.
2. The extension registers /logos-init, /logos-start, /logos-stop, /logos-status, and /logos-generate.
3. /logos-init initializes project-local LOGOS files and state.
4. `/logos-start` activates or resumes intake mode and immediately emits the next unresolved question or active unresolved follow-up.
5. The assistant speaks first after `/logos-start`; only after that, while intake mode is active, user messages are interpreted first as responses or control intent for the active LOGOS question.
6. LOGOS Core evaluates the response.
7. The extension persists accepted, partial, contradictory, or skipped state through LOGOS Core persistence APIs.
8. The extension asks the next question, asks a targeted follow-up, or requests contradiction resolution.
9. /logos-stop pauses intake without losing state.
10. /logos-generate runs preflight, warns on missing critical input, and generates only when allowed.

Repository Topology

The repository may still contain legacy CLI/TUI code while the transition is underway. Agents must not assume that legacy CLI/TUI architecture is still the desired final direction.

Path	Responsibility
AGENTS.md	Current semantic operating contract for coding agents.
docs/LOGOS_PI_EXTENSION_SPEC.md	Current product specification for the Pi extension model.
package.json	Package metadata, scripts, dependencies, validation gates.
tsconfig.json	TypeScript contract.
biome.json	Formatting/linting contract.
profiles/<profile-id>/	Profile contracts, phase descriptors, schemas, and Executive contracts. profiles/standard/ is the default bundled profile.
src/	Implementation source. Existing CLI/TUI code may be legacy or transitional. Verify against the current spec before extending it.
tests/	Vitest coverage. Tests must be updated when behavior changes.
.pi/extensions/	Preferred project-local Pi extension location if this repository includes a Pi extension entrypoint.
.logos/	Runtime project-local LOGOS state. Must not be treated as source code.

When adding the Pi extension, prefer a clear boundary such as:

src/core/           # Pi-independent LOGOS Core
src/pi-extension/   # Pi-specific extension surface

or an equivalent structure if the existing repository already has a better convention.

Dependency Rules

Allowed directions:

* Pi extension code may depend on LOGOS Core APIs.
* Pi extension code may depend on official Pi extension types and APIs.
* LOGOS Core may depend on profile contracts, workspace state, validation, generation, and safe filesystem ports.
* Planners, evaluators, validators, renderers, and context builders should prefer pure functions and explicit inputs.
* Adapters depend inward on ports and contracts.
* Tests may use fakes, temp directories, snapshots, and fixtures.

Disallowed directions:

* LOGOS Core must not import Pi APIs.
* LOGOS Core must not import Ink UI components or legacy TUI presentation code.
* Pi extension code must not own domain algorithms or document-generation logic.
* Validation must not call live AI providers or depend on model judgment.
* Providers must not confirm decisions, close questions, accept risks, or mutate canonical state directly.
* Profile YAML must be parsed as data, never executed.
* Derived artifacts must not be read back as canonical source of truth.
* Raw tokens, secrets, hidden prompts, provider credentials, or unredacted sensitive context must not be persisted.
* Slash commands must not be added for ordinary intake progression.

State And Persistence Rules

Project truth must be persisted in LOGOS-managed project-local state.

Pi session persistence may be used for UI/session continuity, but canonical LOGOS state must remain project-local and recoverable independently from a single chat session.

State persistence must support:

* active profile id;
* active intake mode;
* active question id;
* answered questions;
* answer evaluations;
* partial answers;
* skipped or pending questions;
* contradictions;
* completeness by phase;
* generation preflight results;
* generated artifacts and provenance.

Persist state after every accepted answer, partial answer, contradiction, skip, stop, and generation attempt.

Never rely only on chat memory for LOGOS intake state.

AI And Intake Rules

AI may help with:

* classifying user intent;
* evaluating answer sufficiency;
* producing targeted follow-up questions;
* detecting contradictions;
* drafting proposed documentation;
* summarizing accepted state into generated artifacts.

AI must not:

* silently accept vague answers as complete;
* silently resolve contradictions;
* mutate canonical state without explicit transition logic;
* treat raw chat as canonical truth;
* generate final documentation when critical intake is incomplete without warning;
* bypass generation preflight.

The intake loop must ask one primary question at a time.

Large questionnaire dumps are non-compliant.

Generation Rules

/logos-generate must run preflight before writing documentation.

Preflight must check:

* initialization status;
* intake status;
* total completeness;
* completeness by phase;
* missing critical questions;
* partial critical questions;
* unresolved contradictions;
* output paths;
* overwrite/manual-edit risk.

If critical information is missing, LOGOS may offer partial draft generation only with explicit confirmation.

Partial drafts must be clearly marked as incomplete.

Generated documentation must remain reproducible from accepted structured state and profile contracts.

Coding Conventions

Language and modules:

* TypeScript is the implementation language unless a newer repo contract says otherwise.
* Prefer strict types at module boundaries.
* Use schemas for untrusted input and persisted state.
* Avoid any; use unknown plus validation for external data.
* Keep pure planners and renderers deterministic.

Style:

* Follow the repository formatter/linter.
* File and directory names should be lowercase kebab-case unless existing conventions differ.
* Types and schemas use PascalCase; schema constants generally end with Schema.
* Functions and variables use camelCase.
* Error codes and validation codes use stable snake_case strings.
* LOGOS commands are lowercase slash commands.
* Environment variables are uppercase snake case.

Runtime results:

* Use structured command/result envelopes where the repository already has them.
* Include status, user-facing messages, warnings, errors, changed paths, dry-run markers, metadata, and data deliberately.
* Do not expose raw thrown causes or secret-like values in user-facing output.

Filesystem and state:

* Use safe filesystem write plans and state repository updates.
* Preserve dry-run behavior and changed-path reporting.
* Validate path containment.
* Reject or redact secret-like values.

Testing:

* Add regression tests for every schema, path-safety, token-safety, intake, command, generation, provider, validation, or boundary change.
* Use fake providers for tests.
* Default tests must not require live AI, network access, credentials, or remote services.

Required Tests For This Direction

Implementation of the Pi extension model must include tests proving:

* /logos-init initializes project-local state;
* /logos-start activates or resumes intake and immediately emits the next unresolved question;
* a sufficient natural-language answer advances without a command;
* a partial answer triggers a targeted follow-up;
* a contradictory answer asks for resolution instead of silently choosing one side;
* /logos-stop persists the active question and resumes correctly;
* /logos-status reports progress without mutation;
* /logos-generate refuses final generation when critical input is missing;
* partial generation requires explicit confirmation;
* LOGOS Core works without Pi dependencies;
* /logos-status during active intake pauses safely, preserves state, and does not treat the command as an answer;
* /logos-start during active intake re-emits the active prompt without advancing;
* /logos-init during active intake blocks or requires explicit confirmation;
* no lifecycle command during active intake consumes the command text as an answer;
* /logos-init uses the standard profile when no profile is explicitly selected;
* /logos-init persists the active profile id in .logos/config.yml;
* intake questions are loaded from profiles/<activeProfileId>/;
* intake blocks with a clear error when the active profile does not exist;
* generation preflight blocks with a clear error when the active profile does not exist;
* profile resolution works generically for future profiles under profiles/<profile-id>/;
* LOGOS Core owns profile resolution and is testable without Pi.

If a test cannot be written because the current architecture is too coupled to CLI/TUI code, that coupling is a design problem to fix, not a reason to skip the test.

Retrieval Guidance For Agents

Start every non-trivial task with semantic files, then expand by runtime or schema graph.

Universal first pass:

1. AGENTS.md
2. docs/LOGOS_PI_EXTENSION_SPEC.md
3. The user’s named file, roadmap step, or failing test
4. The nearest source files for the touched subsystem
5. The nearest tests
6. Official Pi extension docs when touching Pi extension behavior

Pi extension changes:

* Read docs/LOGOS_PI_EXTENSION_SPEC.md.
* Read the official Pi extension docs: https://pi.dev/docs/latest/extensions.
* Inspect installed Pi extension types if available.
* Inspect any existing .pi/extensions/ or src/pi-extension/ code.
* Inspect command registration, input interception, custom tool, and persistence tests.

Core/intake changes:

* Read the LOGOS Pi Extension spec.
* Read question registry and intake state code.
* Read answer evaluation code.
* Read persistence/state repository code.
* Read generation preflight code.
* Inspect tests proving conversational advancement.

Profile contract changes:

* Read profiles/standard/README.md if present.
* Read profiles/standard/docs.yml.
* Read profile document schemas.
* Read target phase descriptors.
* Inspect profile, validation, and generation tests.

Generation changes:

* Read generation planner and canonical renderer code.
* Read safe writer code.
* Read traceability/provenance code.
* Inspect generation and snapshot tests.

Legacy CLI/TUI changes:

* Verify whether the requested change is still compatible with the Pi extension direction.
* Do not expand command-first behavior unless the user explicitly asks to preserve legacy CLI/TUI behavior.
* Prefer extracting reusable core logic over deepening CLI/TUI coupling.

Stop expanding when you have:

* the contract owner;
* the current implementation path;
* the write/persistence boundary;
* the nearest tests;
* and the relevant external Pi API reference when needed.

Avoid:

* loading every file because the context window is large;
* trusting stale roadmap text over the current Pi extension spec;
* implementing from a single README section;
* widening AI context just in case;
* writing new abstractions before checking for existing services/ports;
* treating tests as optional for interaction, schema, path-safety, provider, validation, or generation changes.

Change Safety Rules

Repository-wide analysis is required when changing:

* the interaction model;
* allowed or forbidden LOGOS commands;
* Pi extension entrypoints;
* input interception behavior;
* command interruption behavior during active intake;
* intake state schema;
* answer evaluation semantics;
* generation preflight behavior;
* profile descriptor schema;
* generated output path resolution;
* safe filesystem policy;
* proposal acceptance semantics;
* validation finding semantics;
* Executive generation contracts;
* exported package API.

Schema changes require:

* schema updates;
* defaults and migrations if persisted state changes;
* validation updates;
* tests for valid and invalid examples;
* documentation/profile contract updates when the schema is user-facing.

Pi extension changes require:

* verification against official Pi extension docs and installed types;
* command registration tests;
* input/conversational-flow tests;
* state persistence tests;
* proof that commands remain lifecycle controls only;
* no new command-first happy path.

AI/provider/context changes require:

* disclosure review;
* redaction review;
* no-raw-token persistence tests;
* fake-provider deterministic tests;
* proof that provider output remains proposed, not confirmed.

Renderer changes require:

* escaping/security tests;
* snapshot updates;
* canonical/derived boundary checks;
* no-write verification for pure renderers/planners.

Executive changes require:

* normative source traceability;
* JSON schema validation;
* export mapping support-status checks;
* review markers for inferred items;
* tests proving exports are derived, not task-manager truth.

Workflow Expectations

* Inspect before editing.
* Read the contract owner, implementation path, and tests before changing code.
* Preserve the current Pi-extension-first direction unless explicitly told otherwise.
* Keep LOGOS Core independent from Pi.
* Keep lifecycle commands minimal.
* Keep intake progression conversational and assistant-initiated after `/logos-start`.
* Keep local-first behavior intact.
* Prefer existing services, schemas, and result envelopes over new parallel abstractions.
* Keep deterministic validation separate from AI assistance.
* Keep generated artifacts reproducible from structured state and profile contracts.
* Use safe filesystem adapters for writes.
* Update tests with behavior changes.
* Report whether failures are caused by the task or pre-existing repository state.
* Ask before choosing a material direction when live code and normative docs conflict.

Operational Commands

Use the package manager pinned in package.json.

Common commands:

* Install: pnpm install
* Markdown lint: pnpm lint:md
* Biome check: pnpm lint:biome
* Typecheck: pnpm typecheck
* Tests: pnpm test
* Validation gate: pnpm check:validation
* Build: pnpm build
* Full release gate: pnpm check
* Mutating format: pnpm format

Verify exact script names in package.json before running them. Some script names may change during the transition away from standalone CLI/TUI assumptions.

Agent Output Discipline

When finishing work:

* name the files changed;
* name the validation commands run;
* identify any command failures and whether they are task-caused;
* mention unresolved contract conflicts;
* do not overclaim implemented features from planned roadmap text;
* keep final summaries concise and grounded in evidence.
