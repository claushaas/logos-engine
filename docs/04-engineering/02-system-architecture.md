# System Architecture

## Architecture Overview

LOGOS Engine is a local-first, repository-scoped, modular TypeScript TUI application. It runs as a single local process started by the `logos` command from the target repository directory. The system manages local structured project state, loads profile YAML contracts, coordinates AI-led intake through provider adapters, enforces user-reviewed decision state, runs deterministic validation and diagnostics, renders canonical Markdown plus derived HTML artifacts and agent packs under the configured LOGOS documentation root, and can compile a portable Executive JSON model from the normative documentation baseline.

The architecture is shaped by five primary drivers:

- **Local-first trust:** all project state and generated outputs remain local by default.
- **Repository scope:** the active repository is the system boundary for workspace configuration and generated outputs.
- **Decision safety:** AI can propose or draft, but only user action can confirm decisions.
- **Profile contracts:** profile YAML drives phase, document, output, completion, and quality behavior.
- **Execution portability:** the Executive Axis is generated as portable JSON and exported through adapters, not managed as live task state.
- **Deterministic verification:** validation, diagnostics, tests, and release gates must work without live AI or network.

At a macro level, the system has the following shape:

```text
User
  |
  v
logos command
  |
  v
TUI Shell
  |
  +--> Command Router
  |       |
  |       +--> Workspace Service
  |       +--> Profile Service
  |       +--> Intake Orchestrator
  |       +--> Decision Service
  |       +--> Validation Service
  |       +--> Diagnostics Service
  |       +--> Generation Service
  |       +--> Executive Compiler Service
  |       +--> Configuration Service
  |
  +--> Presentation State

Application Services
  |
  +--> Domain Rules and State Transitions
  |
  +--> Ports
          |
          +--> File System Adapter
          +--> Profile YAML Adapter
          +--> AI Provider Adapters
          +--> Markdown Renderer
          +--> HTML Artifact Renderer
          +--> Agent Pack Renderer
          +--> Executive Export Adapters
```

The major system components are:

| Component | Responsibility | Boundary |
| --- | --- | --- |
| CLI Entrypoint | Parse the `logos` invocation and hand control to the TUI runtime. | Must not become a batch CLI or bypass TUI review flows. |
| TUI Shell | Render the primary interface, route keyboard input, show state, and host conversation and slash command flows. | Does not own domain state transitions or direct filesystem writes. |
| Command Router | Route slash commands to application services and non-slash input to conversational intake. | Does not execute business rules directly. |
| Workspace Service | Resolve repository context, initialize/resume workspace, expose active profile and documentation root. | Does not own generated content semantics. |
| Configuration Service | Manage documentation root and AI provider configuration status. | Does not store raw provider tokens in project files. |
| Profile Service | Load and validate profile YAML contracts, phases, documents, outputs, and quality rules. | Does not decide project content. |
| Intake Orchestrator | Coordinate AI-led question clusters, answer capture, interpretation, and proposal creation. | Cannot confirm decisions. |
| Decision Service | Own decision, assumption, open-question, risk, revision, and state transition rules. | Does not depend on UI or provider implementation details. |
| Validation Service | Run deterministic validation checks against state and profile contracts. | Does not require live AI. |
| Diagnostics Service | Produce severity-grouped gaps, contradictions, risks, affected documents, and next actions. | AI advice, if used later, remains advisory. |
| Generation Service | Render canonical Markdown and derived outputs with reports, stale tracking, and write safety. | Does not invent decisions. |
| Executive Compiler Service | Compile Executive JSON from normative documents and export derived execution artifacts through adapter mappings. | Does not own live task state, assignments, comments, or bidirectional sync. |
| File System Adapter | Read/write local state and generated files safely. | Must be accessed through application ports, not directly by UI/domain code. |
| AI Provider Adapters | Call local or remote providers through a provider-agnostic contract. | Must validate output and preserve privacy boundaries. |

Core flows supported by the architecture:

1. `logos` starts the TUI in the current repository.
2. `/init` creates or resumes local workspace state.
3. Profile YAML loads and validates the active document contract.
4. Non-slash input enters AI-led intake.
5. AI output is schema-validated and converted to proposed state.
6. User review confirms, revises, rejects, or defers proposals.
7. Deterministic validation and diagnostics identify gaps and readiness.
8. `/generate` renders canonical Markdown and derived outputs under the configured root.
9. After the normative baseline is draft-ready or baseline-ready, the Executive Compiler can derive Executive JSON and supported export artifacts under the configured root.
10. Generation reports and stale markers update local state.
11. `/continue` resumes from structured state without relying on raw chat as truth.

## Architectural Style

The selected architectural style is a **local-first modular monolith with hexagonal boundaries**.

This means:

- one deployable local Node.js application;
- modular internal boundaries by responsibility;
- domain and application rules isolated from TUI, filesystem, and provider adapters;
- ports for filesystem, profile loading, AI providers, rendering, and time/environment concerns;
- no hosted backend, database service, telemetry platform, or multi-service deployment in MVP.

### Rationale

| Driver | Why This Style Fits |
| --- | --- |
| Local-first repository workflow | A single local process keeps data ownership, setup, and failure handling inspectable. |
| TUI-first product | The system does not need client/server distribution for MVP. |
| Filesystem-only storage | A modular monolith avoids database or service orchestration while still allowing clean internal boundaries. |
| Provider-agnostic AI | Hexagonal ports keep AI providers at the edge and prevent provider details from leaking into domain rules. |
| Deterministic validation | Pure validation modules are easier to test without AI or network. |
| Founder-led delivery | A modular monolith reduces operational burden while preserving evolvability. |

### Alternatives Considered

| Alternative | Status | Reason Rejected or Deferred |
| --- | --- | --- |
| Layered monolith without ports | rejected | Too easy for UI, filesystem, and AI provider details to leak into domain rules. |
| Microservices | rejected | Adds deployment, network, observability, and operational complexity without product need. |
| Hosted SaaS architecture | rejected for MVP | Contradicts local-first boundaries and validation state. |
| Event-driven architecture with queues | deferred | Useful only if background generation, collaboration, or long-running workflows become validated needs. |
| CLI batch processor | rejected for MVP | Risks bypassing conversational review and consent gates. |
| Desktop GUI or Electron app | rejected for MVP | Adds distribution and UI complexity without validated demand. |
| Database-backed local app | rejected for MVP | Filesystem JSON/YAML/Markdown is the committed inspectable storage direction. |

### Trade-Offs

The selected style accepts limited runtime scalability because MVP is single-user and local. It also requires discipline in module boundaries because all modules live in one codebase and process. The advantage is lower operational complexity, stronger local ownership, simpler release packaging, easier default testing without network, and faster iteration on the core clarification loop.

The decision is partially reversible. A future hosted service, database, API, or event-driven worker model can be added only after product evidence justifies it and after downstream architecture documents define migration boundaries. The MVP architecture must not pre-build those surfaces.

## System Context

### Actors and External Systems

| Actor or System | Role | Trust Level | Data Crossing Boundary | Control Crossing Boundary |
| --- | --- | --- | --- | --- |
| User | Runs LOGOS, answers questions, confirms decisions, configures providers, approves writes. | trusted decision owner | User answers, configuration choices, confirmations. | Slash commands, text input, confirmations. |
| Local Repository | Workspace boundary containing local state and generated outputs. | trusted local environment, but files may pre-exist or be edited externally | State files, profile references, generated documents, artifacts, packs. | Filesystem read/write through adapter. |
| Terminal Emulator | Runtime presentation surface for Ink TUI. | semi-trusted platform | Rendered text, keyboard input. | Keyboard events and terminal capabilities. |
| Profile YAML Files | Document and workflow contract source. | trusted if bundled or explicitly selected; validate before use | Phase, document, output, completion, and quality definitions. | Profile loading only; no execution. |
| Local AI Provider | Optional local model endpoint such as Ollama or LM Studio. | user-configured local dependency | Prompts and responses stay on machine. | Provider HTTP calls, timeout, retry. |
| Remote AI Provider | Optional external model provider such as OpenAI, Anthropic, OpenRouter, or compatible endpoint. | user-configured external dependency | Project context and prompts leave local machine after disclosure. | HTTPS provider calls. |
| OS Environment or Credential Store | Source for provider tokens and configuration. | platform-trusted, review-needed | Token source status, not raw token content. | Credential lookup. |
| Git | User workflow for reviewing and versioning files. | external user tool, not product integration | Generated files may be committed by user. | No product-controlled Git operations in MVP. |

### System Boundary

Inside the LOGOS Engine system boundary:

- CLI entrypoint;
- TUI shell and command router;
- application services;
- domain state transition rules;
- profile loading and validation;
- deterministic validation and diagnostics;
- generation orchestration;
- ports and adapters for filesystem, profile files, providers, rendering, and environment access.

Outside the system boundary:

- user's repository contents unrelated to LOGOS;
- terminal emulator implementation;
- local or remote AI provider runtime;
- OS credential store implementation;
- Git operations;
- hosted collaboration, accounts, marketplace, telemetry, and cloud sync.

Trust boundaries:

- **User to TUI:** ordinary input is untrusted until parsed and routed.
- **TUI to application services:** command and conversation requests must use typed command/action interfaces.
- **Application to filesystem:** all reads/writes pass through safe filesystem ports.
- **Application to AI providers:** remote context crosses machine boundary only after configuration and disclosure.
- **Profile YAML to application:** profile contracts are data, not executable code; they require schema validation.
- **Generated outputs to downstream users/agents:** Markdown, HTML, and agent packs are outputs and must preserve caveats.

## Application Layers

| Layer | Responsibility | May Depend On | Must Not Depend On | Owns | Enforcement Rule |
| --- | --- | --- | --- | --- | --- |
| Presentation Layer | Ink components, layout, keyboard handling, visible state, confirmation screens. | Application command/query interfaces, presentation models. | Filesystem adapter, provider SDKs, domain internals. | UI state and rendering only. | UI calls application services; it does not mutate storage directly. |
| Command Routing Layer | Parse slash commands and route non-slash text. | Application services, input parser. | Filesystem adapter directly, provider SDKs directly. | Command routing decisions. | Routing produces typed actions. |
| Application Service Layer | Orchestrate use cases such as init, continue, intake, validate, diagnose, generate, configure. | Domain services, ports, schemas. | Ink components, provider SDKs directly. | Use-case flow, transactions, permission checks. | Application services call ports, not concrete adapters. |
| Domain Layer | Decision rules, state transitions, validation predicates, status semantics, output classification. | Pure domain types and schemas. | UI, filesystem, provider SDKs, OS APIs. | Product invariants and business rules. | Domain functions are pure or side-effect free where feasible. |
| Port Layer | Define abstract interfaces for filesystem, provider, profile source, renderer, clock, environment, credentials. | Domain and application types. | Concrete libraries. | Boundary contracts. | Adapters must implement ports. |
| Adapter Layer | Implement filesystem, YAML parsing, provider calls, renderer, environment, credential sources. | Ports, schemas, third-party libraries. | Presentation components. | External interaction details. | Adapter results are validated before entering domain/application state. |
| Cross-Cutting Layer | Error taxonomy, logging/reporting hooks, redaction, configuration loading, test fixtures. | Shared types and approved ports. | Direct hidden global state. | Shared policies. | Cross-cutting utilities must not become bypass paths around domain rules. |

Layer violations to reject in review:

- TUI imports a filesystem writer directly.
- Provider adapter writes decision state directly.
- Renderer reads raw conversation transcript as canonical truth.
- Validation service calls a remote AI provider to determine pass/fail.
- Profile loader executes arbitrary code from profile files.
- Domain layer depends on Ink, Node filesystem APIs, or provider SDKs.

## Module Boundaries

| Module | Responsibility | Owns | Does Not Own | Public Interface | Allowed Dependencies | Forbidden Dependencies | Boundary Enforcement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CLI Entrypoint | Start process, parse minimal invocation, launch TUI. | Process startup. | Product commands, state, generation. | `runLogos()` or equivalent launch function. | TUI bootstrap, environment check. | Domain mutation, filesystem writes. | Entrypoint remains thin. |
| TUI Module | Render screens, collect keyboard/text input, display status and confirmations. | Presentation state, view models. | Domain state truth, provider calls, file writes. | Renderable views and UI event callbacks. | Command Router, application query models. | File System Adapter, AI Provider Adapter. | UI lint/review boundary plus typed callbacks. |
| Command Router Module | Map input to command or conversation action. | Command parsing and routing. | Command execution internals. | `routeInput(input)` and command result dispatch. | Application services. | Concrete adapters. | Slash/non-slash routing tests. |
| Workspace Module | Resolve repository, initialize/resume workspace, expose active root/profile/status. | Workspace metadata, root config reference. | Profile content semantics, generated documents. | `initWorkspace`, `loadWorkspace`, `getWorkspaceStatus`. | File System Port, Profile Module, State Module. | TUI internals, provider SDKs. | Idempotency and path safety tests. |
| Profile Module | Load and validate profile YAML contracts. | Profile metadata, phases, document contracts, output definitions, quality rules. | User decisions or generated content. | `loadProfile`, `validateProfile`, `getDocumentContract`. | File System Port, YAML adapter, schemas. | Decision mutation, renderer writes. | Schema validation fixtures. |
| State Module | Persist and retrieve structured project state. | Decisions, assumptions, questions, risks, diagnostics, validation gaps, output status, generation reports. | UI rendering, provider execution. | State repository port and state transition service. | File System Port, Domain Layer. | TUI components, provider SDKs. | Versioned schemas and safe write policy. |
| Intake Module | Coordinate user answers, prompt context, provider calls, and interpretation. | Conversation turns as input records, proposed interpreted outputs. | Confirmed decisions. | `continueIntake`, `interpretAnswer`, `createProposals`. | AI Provider Port, Profile Module, State Module, Decision Module. | Direct confirmed-state writes. | AI output schema validation and proposal-only tests. |
| Decision Module | Enforce decision lifecycle and user confirmation. | Decision state machine, revisions, supersession, affected outputs. | Provider prompts, UI layout. | `proposeDecision`, `confirmDecision`, `reviseDecision`, `deferDecision`. | State Module, Domain types. | AI Provider Adapter, Renderer Adapter. | State transition tests. |
| Validation Module | Run deterministic checks. | Validation findings, severity rules, readiness checks. | AI advisory text. | `validateWorkspace`, `validateDocument`, `validateProfileCoverage`. | Profile Module, State Module, Domain rules. | AI Provider Adapter. | No-provider tests. |
| Diagnostics Module | Summarize gaps, contradictions, risks, and next actions. | Diagnostic findings and grouping logic. | Canonical state mutation. | `diagnoseWorkspace`, `diagnoseDocument`. | Validation Module, State Module, Profile Module. | Direct remote provider calls for deterministic findings. | Snapshot and fixture tests. |
| Generation Module | Orchestrate canonical and derived output rendering. | Generation plan, report, stale status. | Decision confirmation. | `planGeneration`, `generateDocuments`, `generateDerivedOutputs`. | Profile Module, State Module, Renderer Ports, File System Port. | AI Provider Adapter for deterministic generation. | Root safety and report tests. |
| Renderer Module | Convert state and contracts into Markdown, HTML artifacts, and agent packs. | Rendered content and derived labels. | State truth and permissions. | Renderer ports for Markdown, HTML, agent packs. | Profile contracts, state snapshots. | Direct state mutation. | Golden output tests. |
| Configuration Module | Manage local config, provider status, documentation root settings. | Config values and redacted display state. | Raw provider tokens in project files. | `getConfig`, `setDocumentationRoot`, `getProviderStatus`. | Environment/Credential Ports, State Module. | UI-specific storage or direct provider SDK calls. | Secret redaction tests. |
| Permission Module | Enforce confirmation gates for writes, overwrites, root changes, and remote transmission. | Permission decisions and pending action summaries. | UI prompt layout. | `requireConfirmation`, `checkWritePermission`, `checkRemoteDisclosure`. | Application services, State Module. | Concrete UI rendering. | Acceptance and failure-path tests. |

Ambiguity rule: if a module needs data owned by another module, it requests it through that module's public interface or an application service. It must not read internal files, cached view models, or adapter implementation details directly.

## Dependency Rules

### Direction Rules

Dependencies flow inward toward domain rules and outward only through ports:

```text
Presentation
  -> Command Routing
    -> Application Services
      -> Domain
      -> Ports
        <- Adapters
```

Allowed dependency examples:

- TUI Shell calls `routeInput`.
- Command Router calls `workspaceService.init`.
- Generation Service calls `stateRepository.loadSnapshot`.
- Generation Service calls `markdownRenderer.render`.
- AI Provider Adapter implements `AiProviderPort`.
- Validation Service reads state through state repository interfaces.

Forbidden dependency examples:

- TUI Shell imports Node `fs` to write generated files.
- Decision Module imports provider SDKs.
- Validation Module calls remote AI to decide pass/fail.
- Renderer mutates decision state.
- File System Adapter imports Ink components.
- Profile YAML file changes runtime code behavior through executable hooks.

### Import and Boundary Rules

- Domain code imports only domain types, schemas, and pure utilities.
- Application services import domain modules and port interfaces.
- Adapters import port interfaces and concrete libraries.
- Presentation imports command/query interfaces and presentation models only.
- Test fixtures may import adapters, but production domain tests should not require concrete adapters.
- Circular dependencies are prohibited; module references should form a directed graph.
- Shared utilities must remain low-level and cannot own business rules.
- Cross-cutting concerns such as redaction and error taxonomy may be shared, but they cannot bypass permission checks.

### Adapter Injection

Adapters are assembled at application startup and passed into application services through a dependency composition layer. This keeps provider, filesystem, YAML, environment, and renderer details outside domain and presentation code.

The composition layer may know concrete implementations. Domain modules must not.

### Enforcement Expectations

Detailed enforcement belongs to Test Strategy and future tooling, but the architecture expects:

- import-boundary lint rules where practical;
- circular dependency detection;
- unit tests for domain rules without adapters;
- adapter contract tests;
- integration tests using fixture filesystem and fixture AI provider;
- code review checklist for dependency direction.

## Runtime Architecture

### Runtime Units

| Runtime Unit | Responsibility | Notes |
| --- | --- | --- |
| Node.js Process | Hosts the entire local application. | Single process for MVP. |
| TUI Runtime | Renders Ink UI, handles keyboard input, command submission, and pending states. | No browser, DOM, or hosted UI. |
| Application Runtime | Executes use cases synchronously or through controlled async operations. | Coordinates state, validation, generation, providers. |
| Provider Call Runtime | Performs bounded async calls to local or remote AI providers. | Timeout and failure handling required. |
| Generation Runtime | Plans and writes outputs, reports partial success/failure. | Must show progress and avoid silent writes. |
| Validation Runtime | Runs deterministic checks locally. | Must work offline and without provider configuration. |

There are no servers, workers, queues, scheduled jobs, edge functions, or background daemons in MVP.

### Concurrency Model

The MVP concurrency model is single-user, single-process, command-oriented execution.

- User actions are serialized through the TUI command/action flow.
- Long-running provider calls and generation operations are asynchronous but owned by the active process.
- State-changing operations must use atomic or safe-write patterns where feasible.
- Duplicate commands should be idempotent or rejected with a clear pending-state message.
- The system must prevent overlapping writes to the same workspace state or output files.

### Long-Running Operations

Long-running operations include:

- AI provider calls;
- generation of all profile documents;
- derived HTML artifact generation;
- agent pack generation;
- validation across a large profile state.

Architecture rules:

- TUI must show pending status quickly.
- Provider calls must have timeouts.
- Partial generation must produce a generation report.
- Cancellation or interruption must preserve existing confirmed state.
- Retry must be explicit when an operation may duplicate writes.

### Idempotency and Retry

| Operation | Idempotency Expectation | Retry Behavior |
| --- | --- | --- |
| `/init` | Re-running must not destroy existing state without confirmation. | Report existing workspace and continue or confirm reinitialization path. |
| `/status` | Read-only. | Safe to retry. |
| `/validate` | Read-only deterministic check. | Safe to retry. |
| `/diagnose` | Read-only unless saving diagnostic report is explicitly implemented. | Safe to retry. |
| AI intake | Input preservation required; provider call may be retried. | Retry should not duplicate confirmed state. |
| Decision confirmation | State transition must be explicit and traceable. | Duplicate confirmation should be idempotent or rejected with current status. |
| `/generate` | Must plan writes and report created/updated/skipped/failed. | Retry uses current state and root safety checks. |
| Root change | Requires confirmation. | Re-running should show current root and pending consequences. |

## Deployment Topology

### Deployable Units

| Unit | Status | Description |
| --- | --- | --- |
| LOGOS npm package / executable | committed | Local package exposing the `logos` command. |
| Standard profile files | committed | Bundled or installed profile YAML contracts used by the product. |
| Generated workspace state | runtime local artifact | Local structured state created inside the active repository workspace. |
| Generated documentation root | runtime local artifact | Defaults to `logos/`, configurable by the user. |
| HTML artifacts and agent packs | runtime local artifacts | Derived outputs under the configured LOGOS documentation root. |

### Environments

| Environment | Purpose | Hosting Boundary |
| --- | --- | --- |
| Local development | Build and test LOGOS Engine itself. | Developer machine. |
| Local user repository | Product runtime environment for MVP. | User machine and repository. |
| CI | Run lint, typecheck, tests, build, and smoke checks. | Project CI, with no live AI or raw tokens. |
| Hosted staging/production | Not applicable for MVP. | No hosted service. |

### Configuration Boundaries

- Workspace configuration belongs to the local repository workspace.
- Documentation root configuration belongs to workspace state and defaults to `logos/`.
- Provider configuration status may be project-visible, but raw tokens must come from environment variables or approved credential-store mechanisms.
- Profile contracts are loaded from bundled or configured profile sources.
- Runtime environment checks include Node.js version and terminal capabilities where feasible.

Infrastructure Architecture and Deployment Plan must expand package publishing, install/update behavior, Node version enforcement, CI matrix, smoke checks, and migration notes. They must not introduce hosted infrastructure by default.

## Data Flow

### Flow 1: Workspace Initialization

| Field | Description |
| --- | --- |
| Source | User command `/init`. |
| Destination | Workspace Service and State Module. |
| Trigger | First run or explicit initialization. |
| Data Objects | Repository path, workspace metadata, active profile reference, documentation root config. |
| Validation Point | Repository path and root path safety checks; profile availability. |
| Transformation Point | User intent becomes initialized workspace metadata. |
| Persistence Point | Local workspace state through File System Adapter. |
| Permission Check | Confirmation before destructive reinitialization or root change. |
| Failure Behavior | Preserve existing state; report missing permissions, invalid paths, or profile failure. |
| Audit or Report | Workspace status and initialization result. |

### Flow 2: Conversational Intake to Proposed State

| Field | Description |
| --- | --- |
| Source | Non-slash user text in TUI. |
| Destination | Intake Orchestrator, AI Provider Port, State Module, Decision Module. |
| Trigger | User submits ordinary conversational input. |
| Data Objects | Conversation turn, profile context, state summary, AI response, proposed decisions, assumptions, open questions, risks. |
| Validation Point | Input routing, provider availability, AI output schema validation. |
| Transformation Point | User text becomes interpreted proposals and structured pending state. |
| Persistence Point | Conversation input and proposed state where policy allows. |
| Permission Check | Remote provider disclosure before sending context; user review before confirmation. |
| Failure Behavior | Preserve user input, reject malformed AI output, offer retry/reconfigure/no-provider path. |
| Audit or Report | Decision proposal status and provider failure record if applicable. |

### Flow 3: Decision Review

| Field | Description |
| --- | --- |
| Source | Proposal Review screen or decision command. |
| Destination | Decision Service and State Module. |
| Trigger | User confirms, revises, rejects, or defers a proposal. |
| Data Objects | Proposed decision, decision status, revision, affected documents, stale output markers. |
| Validation Point | State transition rules and required confirmation. |
| Transformation Point | Proposed state becomes confirmed, revised, rejected, or deferred state. |
| Persistence Point | Structured project state. |
| Permission Check | Explicit user action required. |
| Failure Behavior | Invalid transitions are rejected with current state and next action. |
| Audit or Report | Decision audit trail and affected document status. |

### Flow 4: Validation and Diagnostics

| Field | Description |
| --- | --- |
| Source | `/validate`, `/diagnose`, status checks, or generation preflight. |
| Destination | Validation Service, Diagnostics Service, TUI. |
| Trigger | User command or pre-generation check. |
| Data Objects | Profile contracts, structured state snapshot, validation findings, diagnostics, severity, affected objects. |
| Validation Point | Deterministic rule execution. |
| Transformation Point | State and profile contracts become findings and recommendations. |
| Persistence Point | Optional saved diagnostic/validation result; status metadata. |
| Permission Check | None for read-only checks; confirmation if persisted output is added later. |
| Failure Behavior | Invalid state or profile yields diagnostic error, not silent pass. |
| Audit or Report | Validation report and diagnostic summary. |

### Flow 5: Generation

| Field | Description |
| --- | --- |
| Source | `/generate` after user intent and preflight checks. |
| Destination | Generation Service, Renderers, File System Adapter, State Module. |
| Trigger | User confirms generation. |
| Data Objects | State snapshot, profile document contracts, canonical Markdown, HTML artifacts, agent packs, generation report. |
| Validation Point | Profile validity, root safety, required state availability, overwrite checks. |
| Transformation Point | Structured state and contracts become rendered outputs. |
| Persistence Point | Configured LOGOS documentation root and workspace output metadata. |
| Permission Check | Confirmation before writes or overwrites. |
| Failure Behavior | Partial generation reports created, updated, skipped, incomplete, blocked, failed outputs. |
| Audit or Report | Generation report and stale status updates. |

### Flow 6: Provider Configuration

| Field | Description |
| --- | --- |
| Source | `/config ai` or first AI-required flow. |
| Destination | Configuration Service, Environment/Credential Port, AI Provider Port. |
| Trigger | User configures or inspects provider state. |
| Data Objects | Provider type, endpoint, token source, timeout, local/remote mode, redacted status. |
| Validation Point | Provider config shape, token source availability, disclosure status. |
| Transformation Point | User configuration becomes provider status and runtime adapter selection. |
| Persistence Point | Safe configuration metadata; never raw token in project files. |
| Permission Check | Confirmation before remote provider use. |
| Failure Behavior | No-provider mode with setup guidance. |
| Audit or Report | Redacted provider status. |

## Security and Privacy Hooks

Security Architecture must expand these control points:

| Hook | Location | Architecture Requirement |
| --- | --- | --- |
| Remote transmission disclosure | Intake and provider configuration | Before remote provider calls, the system must disclose that project context leaves the machine. |
| Context minimization | AI Provider Port | Prompt/context builder sends only relevant profile and project state, not arbitrary repository files or Git history. |
| Token source boundary | Configuration and provider adapters | Raw tokens come from env vars or approved credential store, never project files. |
| Redaction | TUI status, logs, reports, errors | Provider tokens and sensitive context must not appear in status output, fixtures, or logs. |
| Write permission | Generation and root configuration | Writes, overwrites, destructive reinitialization, and root changes require explicit confirmation. |
| Profile safety | Profile loader | Profile YAML is data validated by schema, not executable code. |
| Local state protection | State and filesystem adapters | Safe writes, corruption detection, and recovery paths protect local state integrity. |
| No accounts/auth | System boundary | No authentication or authorization service exists in MVP because this is single-user local software. |
| No default telemetry | Observability hooks | No analytics, session tracking, or behavioral telemetry by default. |
| Compliance claims | Generated outputs and UI | System must not claim legal or regulatory compliance without downstream review. |

Privacy-sensitive data includes project answers, decisions, assumptions, open questions, risks, repository path, generated documents, prompts, provider responses, diagnostics, validation gaps, and support/debug artifacts.

## Observability Hooks

Observability is local and privacy-preserving. The system should support debugging, acceptance verification, and support without default telemetry.

| Observable Event or Artifact | Purpose | Storage or Surface | Privacy Rule | Target Document |
| --- | --- | --- | --- | --- |
| Workspace initialization result | Confirm init/resume behavior. | TUI status and optional local state metadata. | No unrelated repository scan. | Observability Plan |
| Decision state transition | Audit proposed, confirmed, revised, rejected, deferred changes. | Structured local state. | No raw provider token or hidden context. | Data Model |
| Provider status and failure | Debug AI configuration and timeout behavior. | Redacted TUI status and error result. | Redact tokens and avoid dumping prompts by default. | Security Architecture |
| Validation findings | Verify deterministic readiness checks. | TUI and optional local report. | Findings may reference project state; local only. | Test Strategy |
| Diagnostic findings | Explain gaps and next actions. | TUI and optional local report. | Local only unless user sends context externally. | Observability Plan |
| Generation report | Show created, updated, skipped, blocked, failed outputs. | Local state and TUI report. | File paths limited to workspace/output root. | Data Model |
| Stale output markers | Explain affected docs after state change. | Local state and generation/status views. | Local only. | Data Model |
| Release quality gates | Prove tests/lint/build/typecheck/smoke status. | CI output and release checklist. | No live AI or secrets. | Release Management |

No hosted metrics, alerting, tracing, analytics, crash reporting, or behavioral telemetry is assumed for MVP.

## Failure Modes

| Failure | Affected Components | Detection | User Impact | Containment | Recovery | Release Impact |
| --- | --- | --- | --- | --- | --- | --- |
| Current directory is not a valid target repository. | CLI, Workspace | Startup path check. | User may initialize in wrong place. | Show active path and require confirmation before writes. | Exit, navigate, or confirm. | release-blocking if writes proceed silently |
| Existing docs collide with output root. | Workspace, Generation | Root safety check. | Outputs may overwrite unrelated files. | Default to `logos/`; warn on collisions. | Reconfigure root or confirm safe action. | release-blocking if destructive |
| Profile YAML missing or invalid. | Profile, Validation, Generation | Schema validation. | Intake/generation cannot trust contracts. | Block dependent flows. | Show profile error and next action. | feature-blocking |
| Workspace state is malformed or schema-incompatible. | State, Workspace | State schema validation. | Session cannot resume safely. | Load read-only diagnostic mode if possible. | Backup, repair, migrate, or reinitialize with confirmation. | release-blocking if unrecoverable without explanation |
| AI provider not configured. | Intake, Provider | Provider status check. | AI-led intake unavailable. | No-provider mode; local status/validation still work. | Run `/config ai` or continue with non-AI operations. | release-blocking only if local operations fail |
| Remote provider timeout or outage. | Provider, Intake | Timeout/error response. | Intake stalls or fails. | Preserve user input and current state. | Retry, reconfigure, switch provider, or continue without AI. | release-blocking if state corrupts |
| Malformed AI output. | Provider, Intake, Decision | Zod/schema validation. | Proposals cannot be trusted. | Reject output before state mutation. | Ask retry/rephrase or fallback to manual review. | release-blocking if confirmed state mutates |
| User rejects or revises proposed decision. | Decision, Generation | State transition result. | Previous generated outputs may become stale. | Mark affected outputs stale. | Regenerate after review. | normal behavior |
| Validation finds blocking gaps. | Validation, Generation | Preflight validation. | Generation may be incomplete or unsafe. | Block or warn based on severity. | Resolve gaps or accept explicit caveat if allowed. | release-blocking if false pass |
| Filesystem permission denied. | File System, Generation, State | Adapter write/read error. | State or outputs cannot persist. | Stop operation and preserve in-memory result where safe. | Fix permissions, change root, retry. | release-blocking if silent |
| Manual edit conflict. | Generation, File System | Metadata/checksum/diff strategy, review-needed. | User edits could be overwritten. | Warn before overwrite; skip if uncertain. | Confirm overwrite, preserve, or regenerate elsewhere. | release-blocking if destructive |
| Terminal too small or lacks color. | TUI | Layout capability observation. | UI may be hard to read. | Collapse non-critical detail and use text labels. | Resize terminal or use command output views. | degrade gracefully |
| Process interrupted during generation. | Generation, File System, State | Partial writes or missing report. | Outputs may be partially updated. | Safe write strategy and partial report where possible. | Re-run generation; status identifies stale/partial outputs. | release-risk |
| Derived artifact generation fails. | HTML/Agent Pack Renderer | Renderer error. | Markdown may exist without derived outputs. | Keep canonical docs; mark derived failure. | Retry derived generation. | degrade gracefully |
| Executive compilation or export fails. | Executive Compiler, Export Adapters, File System | Schema validation, adapter support, readiness gate. | Execution artifacts may be absent, stale, or unsafe to import. | Preserve canonical docs; mark executive outputs blocked/failed/unsupported. | Resolve normative gaps, regenerate Executive JSON, or retry selected export. | feature-blocking for Executive Axis |
| Test suite accidentally calls live AI. | Test Strategy, Provider | CI/network/token guard. | Releases become non-deterministic and unsafe. | Fixture provider required by default. | Fix tests; fail release gate. | release-blocking |

## Architecture Decisions

| ID | Decision | Status | Context | Options Considered | Rationale | Trade-Offs | Reversibility | Linked Requirements | Downstream Impact | Revisit Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADR-001 | Use a local-first modular monolith. | committed | MVP is single-user, local, TUI-first. | Microservices, hosted SaaS, serverless, event-driven. | Minimizes operational burden and preserves local ownership. | Requires internal boundary discipline. | partially reversible | SC-001, NFR-PRIV-006 | System, Infrastructure, Deployment | Validated hosted/collab need. |
| ADR-002 | Use TypeScript, Node.js >=22, Ink, React, and Commander entrypoint. | committed | Product Stack defines platform. | Native app, Electron, Python CLI, web UI. | Fits terminal workflow and existing stack constraints. | Node runtime required; terminal accessibility varies. | partially reversible | STK-001 through STK-005 | Frontend, Deployment | Platform evidence contradicts stack fit. |
| ADR-003 | Use filesystem-only storage for MVP. | committed | Local-first and Git-friendly outputs are central. | SQLite, hosted DB, embedded document DB. | Inspectable, diffable, low operational complexity. | Requires safe writes and corruption handling. | partially reversible | STK-006, NFR-COMP-003 | Data Model | State complexity exceeds filesystem viability. |
| ADR-004 | Treat structured local state as durable source of project truth. | committed | Chat and Markdown alone cannot preserve decisions safely. | Markdown-only state, transcript-only memory. | Enables validation, regeneration, status, and decision review. | Requires schema/migration discipline. | hard to reverse | FR-007, FR-032 | Data Model, API Contracts | Evidence that simpler model preserves clarity. |
| ADR-005 | Treat Markdown as canonical human-readable output and HTML/agent packs as derived. | committed | Product requires Markdown plus derived artifacts. | HTML-first, proprietary docs, agent packs as source. | Preserves Git-friendly review and traceability. | Manual edits require conflict handling. | partially reversible | FR-009, FR-010, FR-011, FR-027 | Generation, Data Model | Strong evidence for alternate canonical format. |
| ADR-006 | Keep AI providers behind provider-agnostic ports. | committed | Local/remote provider choice and privacy are product requirements. | Single provider SDK throughout app. | Avoids lock-in and isolates provider failure. | Adapter complexity and lowest-common-denominator risk. | reversible | FR-017, FR-018 | Integration, Security | Provider abstraction blocks critical capability. |
| ADR-007 | Keep deterministic validation independent of AI. | committed | Release gates and validation must work offline. | AI-based validation, mixed validator/AI flow. | Keeps checks testable and reliable. | AI explanations must be clearly separate. | hard to reverse | FR-013, NFR-REL-006 | Test Strategy | None for MVP. |
| ADR-008 | Use `logos/` as default generated documentation root, configurable per workspace. | committed | Avoids colliding with existing `docs/` directories. | Default `docs/`, root beside repo, hidden output. | Protects existing docs and makes outputs visible. | Requires root resolution everywhere. | reversible by product decision | FR-004, AC-FN-003 | System, Data, Security | User evidence that default blocks adoption. |
| ADR-009 | Exclude hosted backend, accounts, telemetry, and marketplace from MVP architecture. | committed | Validation is incomplete and local-first is core. | Hosted platform baseline. | Prevents scope creep and operational burden. | Limits collaboration and remote analytics. | reversible after validation | Product Scope, Validation Report | Infrastructure, Operations | Explicit scope change after evidence. |
| ADR-010 | Treat Executive Axis as generated portable JSON plus derived exports, not live execution state. | committed | Executive Axis Specification defines LOGOS as execution compiler, not task manager. | Manual execution docs, embedded task board, direct live project-management sync. | Preserves traceability and avoids stale manually maintained execution YAML. | Requires schema, adapter, readiness, and stale-output discipline. | partially reversible only by product scope change | FR-051 through FR-057 | Data, API, Integration, Testing, Operations | Evidence that users need live task ownership inside LOGOS and scope is explicitly reopened. |

## Architecture Risks

| Risk | Category | Affected Components | Source | Likelihood | Impact | Early Signal | Mitigation | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Module boundaries erode inside the monolith. | coupling | TUI, services, adapters, domain | Engineering Brief | medium | high | UI imports filesystem/provider adapters. | Import rules, code review, boundary tests. | Test Strategy | release-risk |
| Filesystem storage becomes fragile without schema and safe-write policy. | data | State, File System | Product Stack | medium | high | Corrupt state, failed resume, partial writes. | Versioned schemas, safe writes, recovery diagnostics. | Data Model | release-blocking |
| AI provider output leaks into confirmed state. | AI safety | Intake, Decision, State | Foundation Boundaries | medium | high | Malformed output creates confirmed decisions. | Schema validation and proposal-only boundary. | API Contracts | release-blocking |
| Documentation root resolution is duplicated. | path safety | Workspace, Generation, UI | Product Scope | medium | high | Some flows default to `docs/` or write outside root. | Central root service and path tests. | System Architecture, Test Strategy | release-blocking |
| Derived outputs become stale or canonical in practice. | generation | HTML Renderer, Agent Pack Renderer | Product Architecture | medium | medium | Users edit derived files or packs lack caveats. | Derived labels, source metadata, stale tracking. | Data Model, Integration Architecture | degrade gracefully |
| Deterministic validation becomes mixed with AI explanation. | validation | Validation, Diagnostics | NFRs | medium | high | `/validate` changes with provider availability. | Separate validation and AI advisory paths. | Test Strategy | release-blocking |
| Remote provider boundaries are under-specified. | privacy | Provider Adapter, Intake | NFR Privacy | medium | high | Prompt context sent before disclosure. | Context preview, disclosure hook, adapter tests. | Security Architecture | release-blocking |
| Ink/TUI runtime limits hurt accessibility. | frontend | TUI Shell | NFR Accessibility | medium | medium | Keyboard traps or unreadable compact views. | Keyboard-first tests, text labels, accepted-risk tracking. | Frontend Architecture | release-risk |
| No hosted telemetry makes support harder. | observability | Support, Debugging | Privacy Boundaries | medium | medium | Hard-to-reproduce user issues. | Local diagnostics, redacted reports, opt-in logs if approved. | Observability Plan | monitor |
| Package/runtime assumptions fail on WSL or Linux variants. | deployment | CLI, Filesystem, TUI | Product Stack | medium | medium | Path/terminal bugs outside macOS. | Smoke checks, platform abstraction, deployment notes. | Deployment Plan | release-risk |
| Architecture overbuilds for unvalidated demand. | scope | all modules | Validation Report | medium | high | Work begins on SaaS, accounts, marketplace, database. | Scope gates and release review. | Risk Management | release-blocking if default behavior expands |

## Downstream Handoff

### Data Model

Data Model must define the exact structured state schemas, file layout, state versioning, migration policy, decision lifecycle, assumption/open-question/risk objects, diagnostic and validation objects, output metadata, generation reports, stale markers, and derived artifact metadata. It must preserve the rule that structured state is durable truth and Markdown/HTML/agent packs are projections.

### Security Architecture

Security Architecture must expand remote provider disclosure, context minimization, token source rules, redaction, local file permissions, overwrite protection, root change confirmation, safe handling of logs, and the no-auth/no-telemetry MVP posture.

### API Contracts

API Contracts must define typed command/action results, service interfaces, confirmation requirements, state transition requests, provider configuration status, AI interpretation result schemas, validation findings, diagnostics, generation reports, and error taxonomy.

### Integration Architecture

Integration Architecture must define provider adapter contracts, local versus remote provider behavior, timeout/retry policies, context assembly boundaries, malformed response handling, provider capability differences, HTML artifact generation boundaries, and agent pack format strategy.

### Frontend Architecture

Frontend Architecture must map the Presentation Layer into Ink components, screen states, keyboard handling, pending states, confirmation prompts, compact terminal behavior, text labels, root/provider/status visibility, and failure recovery screens.

### Infrastructure Architecture

Infrastructure Architecture must remain local-package focused: Node.js runtime, package distribution, CI, supported platforms, filesystem assumptions, environment configuration, and no hosted production topology for MVP.

### Test Strategy

Test Strategy must enforce architecture boundaries through unit tests, integration tests with fixture filesystem and fixture AI provider, no-live-AI default tests, circular dependency checks if feasible, command-routing tests, state transition tests, generation snapshot tests, validation fixtures, and smoke workflows.

### Engineering Design System

Engineering Design System must translate state labels, semantic status categories, compact layout behavior, non-color-only meaning, and generated HTML artifact presentation into implementable TUI and artifact conventions.

### Observability Plan

Observability Plan must define local reports, audit trails, diagnostic outputs, redacted error context, optional debug logging if approved, and how support can inspect failures without telemetry or secret leakage.

### Deployment Plan

Deployment Plan must define package release, install/update behavior, Node.js version checks, cross-platform smoke checks, CI gates, migration notes, and no-hosting assumptions.

### Release, Support, Operations, and Risk Management

Release Management must require architecture-aligned quality gates. Support Model must handle provider setup, root confusion, profile failure, state corruption, generation failure, and no-provider operation. Risk Management must track AI false authority, filesystem data loss, privacy leakage, architecture scope creep, and validation overclaiming.

### Unresolved System Architecture Questions

- What exact internal workspace state path should be used, and how should it be distinguished from the generated `logos/` documentation root?
- What safe-write mechanism should be used for state files and generated outputs?
- What state migration policy is required before release?
- How should manual edits to generated Markdown be detected and protected?
- Should HTML artifact generation be implemented through a Markdown-to-HTML pipeline, templates, or a custom renderer?
- What is the minimum stable agent pack format for MVP?
- Is env-var token sourcing sufficient for MVP, or is OS credential-store support required before release?
- What import-boundary tooling is realistic for the first implementation?
- What platform matrix is required before declaring macOS, Linux, and WSL support?
