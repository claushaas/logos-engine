# Implementation Roadmap

## Roadmap Objective

Build LOGOS Engine incrementally without overengineering the first version, while treating AI as a core product layer from the beginning.

LOGOS Engine is not a generic documentation generator.

It is an AI-structured documentation and intent clarification system.

The roadmap must therefore build three capabilities together:

1. **Deterministic structure** — profiles, schemas, validation rules, document contracts, and state management.
2. **AI reasoning layer** — interrogation, synthesis, decision proposal, gap analysis, risk analysis, and document drafting.
3. **User-controlled confirmation flow** — the user remains the authority over confirmed decisions and generated documentation.

## Related Documents

This roadmap should be read alongside:

- `docs/00-foundation/00_PROJECT_THESIS.md`
- `docs/00-foundation/01_PRINCIPLES.md`
- `docs/00-foundation/02_SCOPE_AND_NON_GOALS.md`
- `docs/00-foundation/03_CONCEPTUAL_MODEL.md`
- `docs/01-product/03_PRODUCT_REQUIREMENTS.md`
- `docs/01-product/04_MVP_SCOPE.md`
- `docs/03-system-architecture/00_SYSTEM_OVERVIEW.md`
- `docs/03-system-architecture/01_MODULES.md`
- `docs/03-system-architecture/02_DATA_MODEL.md`
- `docs/03-system-architecture/03_DECISION_REGISTRY.md`
- `docs/03-system-architecture/04_DOCUMENT_RENDERING.md`
- `docs/03-system-architecture/05_VALIDATION_AND_DIAGNOSTICS.md`
- `docs/04-tui-experience/00_TUI_PRODUCT_SPEC.md`
- `docs/04-tui-experience/01_COMMANDS.md`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`
- `docs/05-profiles/00_PROFILE_SYSTEM.md`
- `profiles/app-business/profile.yml`
- `profiles/app-business/documents.yml`
- `profiles/app-business/questions.yml`
- `profiles/app-business/validations.yml`
- `docs/05-profiles/app-business/profile.yml`
- `docs/05-profiles/app-business/documents.yml`
- `docs/05-profiles/app-business/questions.yml`
- `docs/05-profiles/app-business/validations.yml`
- `docs/06-documentation-system/00_DOCUMENTATION_ARCHITECTURE.md`
- `docs/06-documentation-system/01_CANONICAL_DOCUMENT_TEMPLATE.md`
- `docs/06-documentation-system/02_APP_BUSINESS_DOC_STRUCTURE.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/01_PROMPTING_CONTRACT.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`
- `docs/10-operational-playbooks/02_RISK_REGISTER.md`

## Roadmap Principles

### 1. Build AI as a First-Class Layer

AI must be present in the core workflow from the first usable version.

For V1, this means the architecture, prompt contracts, structured output validation, mocked provider, and user review flows are mandatory.

Live remote model usage remains configurable. The product must be useful with mocked, fixture, or local providers, but the implementation must not provide a deterministic intake questionnaire as the normal fallback.

AI output must enter the system as:

- `draft`;
- `proposed`;
- `needs_review`;
- `rejected`;
- `confirmed` only after user confirmation.

### 2. Keep Deterministic Guardrails Strong

The AI layer owns the normal intake and documentation conversation. Deterministic code should not choose a scripted question path for the user in the primary workflow.

The AI layer still must not replace:

- profile schemas;
- validation rules;
- document contracts;
- decision status rules;
- state transition rules;
- file safety rules.

### 3. Documents Must Be Complete, Not Merely Concise

The profile must define not only document names, but also the ideal internal structure and completion criteria for each document.

### 4. Markdown Is a Rendered View

The source of truth is the structured project state.

Markdown is the human-readable projection.

### 5. V1 Must Be Useful Before It Is Clever

Avoid multi-agent orchestration, cloud sync, dashboards, and profile marketplaces in V1.

The first milestone is a local-first TUI that can conduct an AI-led intake conversation and produce a coherent App Business documentation workspace.

## Scope Reconciliation

This roadmap reconciles the MVP and AI strategy as follows:

- slash commands, workspace initialization, schema validation, state reading, and tests must be usable without live model calls;
- the user-facing intake and documentation workflow must be AI-led, using a mocked, fixture, local, or explicitly configured remote provider;
- the V1 architecture must include the AI layer from the beginning;
- mocked AI providers are required for default tests and local development;
- local providers should be supported where practical;
- remote providers are optional and must require explicit configuration;
- users provide their own LLM endpoint and credential source;
- raw API tokens must not be stored in project files by default;
- project context sent to a remote provider must be visible and explainable;
- AI outputs may become `confirmed` only through user confirmation.

This keeps the MVP inspectable and local-first while still building the product that LOGOS Engine is meant to become.

## State and Status Contracts

The implementation must separate these concepts:

- `DecisionStatus`: `unknown`, `assumed`, `proposed`, `confirmed`, `deprecated`;
- `AiOutputStatus`: `draft`, `proposed`, `needs_review`, `rejected`, `confirmed`;
- `ValidationSeverity`: `info`, `warning`, `error`, `critical`;
- `RenderMode`: `safe`, `refresh`, `force`.

Decision state is the source of truth. AI output state describes the review status of generated suggestions or drafts before they are accepted, rejected, or used as document content.

## Canonical App Business Output

V1 must treat the generated App Business documentation tree as a profile contract, not as incidental template output.

The canonical V1 tree is:

```text
docs/
  00-intake/
    IDEA_BRIEF.md
    ASSUMPTIONS.md
    OPEN_QUESTIONS.md
  01-market/
    MARKET_ANALYSIS.md
    COMPETITOR_MATRIX.md
    ICP.md
  02-business/
    BUSINESS_MODEL.md
    POSITIONING.md
  03-economics/
    PRICING.md
    FINANCIAL_MODEL.md
    BREAK_EVEN.md
  04-product/
    PRODUCT_THESIS.md
    MVP_SCOPE.md
    ROADMAP.md
  05-design/
    UX_FLOWS.md
    DESIGN_DIRECTION.md
    ONBOARDING.md
  06-architecture/
    ARCHITECTURE.md
    TECH_STACK.md
    DATA_MODEL.md
    API_SPEC.md
  07-implementation/
    IMPLEMENTATION_PLAN.md
    DEVELOPMENT_STANDARDS.md
  08-testing/
    TESTING_STRATEGY.md
  09-go-to-market/
    MARKETING_STRATEGY.md
    LAUNCH_PLAN.md
    CONTENT_STRATEGY.md
  10-operations/
    OPERATIONS.md
    SUPPORT_MODEL.md
    METRICS.md
  11-governance/
    DECISION_LOG.md
    RISK_REGISTER.md
```

If another document uses older names such as `IMPLEMENTATION_ROADMAP.md` or `11-roadmap`, implementation should normalize toward this tree.

---

## Phase 0 — Repository Foundation

## Objective

Create the repository foundation, development standards, and documentation baseline for an AI-first local TUI application.

## Goals

- initialize repository;
- define package manager;
- configure TypeScript;
- configure linting and formatting;
- configure tests;
- create documentation structure;
- establish AI-specific engineering rules;
- establish file safety and prompt safety conventions.

## Related Docs

- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`
- `docs/00-foundation/01_PRINCIPLES.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`

## Deliverables

- `package.json`;
- `tsconfig.json`;
- lint/format config;
- test runner config;
- `README.md`;
- `docs/` folder;
- initial `src/` structure;
- initial `tests/` structure;
- initial AI engineering standards documented in the repository.

## Implementation Notes

Recommended stack:

- TypeScript;
- Node.js;
- Ink for TUI;
- Zod for schemas;
- Vitest for tests;
- Biome or Prettier for formatting;
- Markdown templates;
- provider-agnostic LLM interface.

## Acceptance Criteria

- repository installs cleanly;
- tests can run;
- lint/format commands exist;
- documentation tree exists;
- roadmap and standards are committed;
- development setup is reproducible.

---

## Phase 1 — CLI and TUI Skeleton

## Objective

Create the executable interface and command structure that will host the LOGOS workflow.

## Goals

- create executable `logos` CLI entrypoint;
- implement TUI slash command router;
- create initial TUI shell;
- support core slash commands;
- establish command-to-application-service boundaries.

## Commands

- `logos`
- `/init`
- `/status`
- `/generate`
- `/continue`
- `/diagnose`
- `/validate`
- `/config ai`

## Related Docs

- `docs/04-tui-experience/00_TUI_PRODUCT_SPEC.md`
- `docs/04-tui-experience/01_COMMANDS.md`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`
- `docs/03-system-architecture/01_MODULES.md`

## Deliverables

- CLI entrypoint;
- command parser;
- TUI layout shell;
- slash command input;
- slash command autocomplete;
- help output;
- slash command stubs;
- application service boundary;
- basic command tests.

## Implementation Notes

The CLI should open the TUI by default.

The TUI must not directly mutate project state.

Recommended boundary:

```text
TUI
→ command handler
→ application service
→ domain/service layer
→ storage adapter
```

## Acceptance Criteria

- `logos --help` works;
- `logos` opens the TUI;
- each core slash command has a stub;
- slash command routing is tested;
- slash command autocomplete exists;
- TUI shell renders without requiring project state;
- command handlers do not directly write files.

---

## Phase 2 — Workspace Initialization

## Objective

Allow LOGOS Engine to initialize a local project workspace inside an existing repository.

## Goals

- create `.logos/`;
- create `docs/`;
- initialize project metadata;
- select profile;
- lock profile version;
- prepare safe file writing behavior.

## Related Docs

- `docs/03-system-architecture/00_SYSTEM_OVERVIEW.md`
- `docs/04-tui-experience/01_COMMANDS.md`
- `docs/06-documentation-system/00_DOCUMENTATION_ARCHITECTURE.md`
- `docs/05-profiles/00_PROFILE_SYSTEM.md`

## Deliverables

- `.logos/project.json`;
- `.logos/profile.lock.json`;
- `.logos/answers.json`;
- `.logos/decisions.json`;
- `.logos/sessions/`;
- `docs/` structure;
- safe write utility;
- project root detection.

## Implementation Notes

The initialization flow should support:

- creating a new LOGOS workspace;
- detecting an existing workspace;
- refusing destructive overwrites;
- explaining what files will be created.

## Acceptance Criteria

- `/init` creates a valid workspace;
- repeated `/init` does not corrupt existing state;
- generated files are text-based and Git-friendly;
- profile lock is persisted;
- safe file write behavior is tested.

---

## Phase 3 — Profile Loader and App Business Profile Skeleton

## Objective

Implement the profile system and load the initial `app-business` profile.

## Goals

- define profile schema;
- load profile metadata;
- define phases;
- define canonical documents;
- define question sets;
- define validation rule structure;
- define decision ids required by each phase and document;
- define risk pattern metadata;
- define dependency mappings between decisions and documents;
- validate profile configuration.

## Related Docs

- `docs/05-profiles/00_PROFILE_SYSTEM.md`
- `profiles/app-business/profile.yml`
- `profiles/app-business/documents.yml`
- `profiles/app-business/questions.yml`
- `profiles/app-business/validations.yml`
- `docs/05-profiles/app-business/profile.yml`
- `docs/05-profiles/app-business/documents.yml`
- `docs/05-profiles/app-business/questions.yml`
- `docs/05-profiles/app-business/validations.yml`

## Deliverables

- profile schema;
- profile loader;
- profile validation;
- app-business profile metadata;
- app-business phase definitions;
- app-business `documents.yml` definitions;
- app-business question set definitions;
- app-business validation rule stubs;
- app-business risk pattern stubs;
- normalized canonical output tree definition;
- profile fixture files for tests.

## Implementation Notes

The profile must define more than filenames.

Canonical document definitions should live in a structured `documents.yml` file. Markdown documentation may explain the contract, but the engine should load and validate YAML.

Each canonical document definition should include:

- document id;
- phase id;
- output path;
- title;
- purpose;
- primary questions;
- required decisions;
- recommended structure;
- generated outputs;
- completion criteria;
- dependencies.

Question definitions should also be structured, ideally in `questions.yml`.

Each question definition should support:

- question id;
- phase id;
- question text;
- short help text;
- examples;
- answer type;
- options for choice and multi-choice answers;
- mapped decision ids;
- unknown and assumption behavior.

Phase and folder naming must align with the canonical output tree:

- `00-intake`;
- `01-market`;
- `02-business`;
- `03-economics`;
- `04-product`;
- `05-design`;
- `06-architecture`;
- `07-implementation`;
- `08-testing`;
- `09-go-to-market`;
- `10-operations`;
- `11-governance`.

The profile loader should reject duplicate document ids, duplicate output paths, missing template references, invalid phase references, and document definitions without completion criteria.

## Acceptance Criteria

- app-business profile loads successfully;
- invalid profiles fail with clear errors;
- document definitions include internal structure metadata;
- `documents.yml` is schema-validated;
- profile version is available to the workspace;
- canonical output paths match the App Business documentation contract;
- profile validation catches duplicate ids and missing dependencies;
- profile loader is covered by tests.

---

## Phase 4 — LLM Provider Abstraction and AI Operation Contracts

## Objective

Introduce the AI layer as a first-class system component before building AI-assisted flows.

## Goals

- define provider-agnostic LLM interface;
- define AI operation types;
- define request/response schemas;
- support mocked providers for tests;
- support local provider configuration where practical;
- support at least one remote provider adapter behind explicit configuration later;
- define AI output status model;
- define provider privacy and transmission metadata;
- define provider preset model;
- define token source model.

## Related Docs

- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/01_PROMPTING_CONTRACT.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`

## Deliverables

- `LlmProvider` interface;
- mock provider;
- provider config model;
- AI operation registry;
- structured response schemas;
- AI output status enum;
- response validation utilities;
- provider error model;
- provider capability metadata;
- provider transmission disclosure model;
- provider preset registry;
- token source resolver;
- AI configuration validation command or service.

## AI Operations for V1

Initial operation types:

- `lead_intake_turn`;
- `generate_follow_up_questions`;
- `summarize_answer`;
- `extract_decision_proposals`;
- `classify_assumptions`;
- `identify_gaps`;
- `identify_risks`;
- `draft_document_section`;
- `recommend_next_conversation_move`.

## Implementation Notes

AI modules must not directly mutate project state.

The mocked provider is required before any live provider integration.

Remote provider support must be opt-in. If no remote provider is configured, the system should still run operational commands and execute tests with fixture AI responses. Normal intake should use a mocked, fixture, local, or explicitly configured remote provider; it should not fall back to a deterministic question script.

The user should provide:

- endpoint URL;
- model id;
- token source.

The token source should usually be an environment variable such as `LOGOS_LLM_API_KEY`.

Project config may store endpoint, provider preset, model id, timeout, and token environment variable name. It should not store the raw token by default.

V1 should include presets for:

- OpenAI-compatible providers;
- OpenAI;
- OpenRouter;
- Anthropic;
- Ollama;
- LM Studio;
- custom endpoints.

Recommended flow:

```text
application service
→ AI orchestration service
→ LLM provider adapter
→ structured response validator
→ proposal object
→ user confirmation flow
→ state update
```

## Acceptance Criteria

- AI calls route through provider abstraction;
- mocked provider works in tests;
- operational workflows and automated tests can run without a live provider;
- intake and documentation flows use a provider abstraction, including mocked or fixture providers in development and tests;
- remote provider usage is explicit and configurable;
- provider presets can be inspected and overridden;
- tokens are loaded from approved secret sources, not raw project config;
- malformed AI output is rejected safely;
- AI outputs are classified by status;
- no AI operation directly writes project state;
- provider failures do not corrupt workspace state.

---

## Phase 5 — Prompt and Context Management

## Objective

Implement prompt construction as a versioned and testable product surface.

## Goals

- create prompt modules per AI operation;
- define context selection rules;
- define prompt version identifiers;
- include profile context where needed;
- include document contracts where needed;
- include decision registry context where needed;
- enforce structured output instructions;
- enforce uncertainty and refusal handling instructions;
- add prompt snapshot tests where practical.

## Related Docs

- `docs/07-ai-and-agent-behavior/01_PROMPTING_CONTRACT.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`
- `docs/05-profiles/app-business/documents.yml`

## Deliverables

- prompt builder;
- context builder;
- operation-specific prompt templates;
- schema-aware output instructions;
- prompt tests or snapshots;
- context budgeting utilities if needed;
- provider transmission disclosure metadata;
- prompt version metadata persisted with AI outputs where useful.

## Implementation Notes

Prompts must clearly separate:

- user-provided facts;
- assumptions;
- confirmed decisions;
- proposed decisions;
- open questions;
- profile requirements.

## Acceptance Criteria

- prompts are inspectable in code;
- prompt construction is tested;
- context inclusion is intentional and minimal;
- prompt versions are visible in reviewable output or logs where useful;
- output schema expectations are explicit;
- prompt changes are reviewable through tests or snapshots.

---

## Phase 6 — AI-Led Conversational Intake

## Objective

Implement the conversational intake system, using the AI layer as the normal driver and the profile as coverage context.

## Goals

- let AI choose and ask the next useful question or small question cluster;
- store raw conversation turns and interpreted answers;
- resume sessions;
- allow `unknown` answers;
- allow assumption-based answers;
- use AI to generate contextual follow-up questions;
- use AI to propose the next conversational move.

## Related Docs

- `docs/05-profiles/app-business/questions.yml`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/03-system-architecture/01_MODULES.md`

## Deliverables

- question schema;
- guided question metadata;
- conversation turn schema;
- answer store;
- session store;
- `/continue` slash command;
- AI intake turn operation;
- AI follow-up question operation;
- answer summarization operation;
- assumption marking behavior.

## Implementation Notes

The conversation engine should combine:

- profile-defined coverage prompts;
- current phase;
- missing required decisions;
- AI-suggested follow-ups;
- user answer history.

The system should not ask unlimited questions.

Conversational question clusters should remain small and purposeful.

Questions should be helpful without being leading. When useful, the AI may mention examples or options in natural language so the user understands the expected level of detail.

## Acceptance Criteria

- user can progress through foundation intake by conversing with AI;
- raw turns and interpreted answers are stored;
- sessions can resume;
- unknown answers create open questions;
- assumption answers create assumptions;
- AI can use help text, examples, and options from profile context;
- AI follow-up questions are proposed, not silently injected as canonical requirements;
- AI conversation move selection is tested with mocked AI responses.

---

## Phase 7 — Decision Registry and AI Decision Proposal Flow

## Objective

Implement the structured decision registry and allow AI to propose decisions based on user answers.

## Goals

- define decision schema;
- define decision status transitions;
- define AI proposal schema separately from confirmed decisions;
- store decisions;
- support decision statuses;
- preserve source answer references;
- allow AI to extract proposed decisions;
- require user confirmation before confirmation status;
- track decision changes.

## Related Docs

- `docs/03-system-architecture/02_DATA_MODEL.md`
- `docs/03-system-architecture/03_DECISION_REGISTRY.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`

## Deliverables

- decision schema;
- decision status transition rules;
- decision store;
- decision proposal model;
- decision confirmation flow;
- decision update logic;
- decision source tracking;
- decision inspection command or screen;
- tests for confirmation-gated state changes.

## Implementation Notes

AI may propose:

- decision values;
- assumptions;
- risks;
- dependencies;
- document updates.

AI may not confirm decisions without the user.

The decision registry should use `DecisionStatus`.

AI-generated proposal objects should use `AiOutputStatus` until the user confirms, rejects, or leaves them for later review.

Confirmed decisions should retain:

- source answer ids;
- source proposal id where applicable;
- confidence;
- dependencies;
- affected document ids;
- revision history or change metadata.

## Acceptance Criteria

- decisions can be stored and updated;
- decision status is explicit;
- invalid decision status transitions are rejected;
- AI-extracted decisions enter as `proposed`;
- user can confirm or reject proposals;
- confirmed decisions preserve source answer references;
- proposal status and decision status are not conflated;
- changing a decision identifies affected documents or future validation needs.

---

## Phase 8 — Document Renderer and AI-Assisted Drafting

## Objective

Render complete canonical Markdown documents from structured state and AI-assisted drafts.

## Goals

- render Markdown templates;
- create canonical docs;
- support safe render;
- support refresh render;
- support force render behind explicit confirmation;
- support generated sections;
- support manual notes preservation;
- use AI to draft complete document sections based on document contracts;
- mark AI-generated content as draft or needs review when appropriate.

## Related Docs

- `docs/03-system-architecture/04_DOCUMENT_RENDERING.md`
- `docs/06-documentation-system/00_DOCUMENTATION_ARCHITECTURE.md`
- `docs/06-documentation-system/01_CANONICAL_DOCUMENT_TEMPLATE.md`
- `docs/06-documentation-system/02_APP_BUSINESS_DOC_STRUCTURE.md`
- `docs/05-profiles/app-business/documents.yml`

## Deliverables

- template renderer;
- document renderer service;
- app-business document templates;
- generated frontmatter;
- safe render mode;
- refresh render mode;
- force render mode with confirmation;
- AI document section drafting operation;
- document completion criteria reporting.

## Implementation Notes

The renderer should produce documents that are:

- complete enough to guide execution;
- structured according to document contract;
- explicit about assumptions and gaps;
- not artificially brief;
- not overwritten destructively.

`IMPLEMENTATION_PLAN.md` is the V1 home for generated milestones, phases, technical epics, validation gates, testing requirements, and launch checklist content. A future `/export` command may expose this in additional formats, but V1 should generate it as part of `/generate`.

## Acceptance Criteria

- `/generate` creates the canonical App Business document tree;
- generated documents include required sections;
- manual sections are preserved where supported;
- AI-drafted sections are clearly classified;
- incomplete documents report missing inputs;
- implementation planning output is generated as canonical documentation;
- document rendering is regression tested.

---

## Phase 9 — Validation Engine and Deterministic Guardrails

## Objective

Implement deterministic validation rules that check whether the documentation and decisions are structurally sufficient.

## Goals

- implement required decision checks;
- implement dependency checks;
- implement phase readiness checks;
- implement consistency checks;
- implement risk pattern checks;
- implement severity levels;
- keep validation separate from AI judgment;
- allow AI to explain validation findings where useful without replacing the rules.

## Related Docs

- `docs/03-system-architecture/05_VALIDATION_AND_DIAGNOSTICS.md`
- `docs/05-profiles/app-business/validations.yml`
- `docs/03-system-architecture/03_DECISION_REGISTRY.md`

## Deliverables

- validation rule schema;
- validation engine;
- `/validate` slash command;
- severity reporting;
- phase readiness output;
- affected document reporting;
- consistency validation output;
- risk validation output;
- tests for validation rules.

## Implementation Notes

Validation should answer:

- What is missing?
- What is blocking?
- What is risky but not blocking?
- What is contradictory?
- Which documents are affected?
- Which phase can proceed?

## Acceptance Criteria

- required decisions are enforced;
- dependency rules work;
- consistency rules flag known contradictions;
- risk pattern rules identify high-risk combinations;
- severity levels are shown clearly;
- validation does not depend on live AI;
- validation output references affected phases/documents;
- validation tests cover critical App Business rules.

---

## Phase 10 — AI-Assisted Diagnostics and Risk Analysis

## Objective

Build diagnostics that combine deterministic validation with AI-assisted interpretation, risk analysis, and next-step recommendations.

## Goals

- summarize gaps;
- identify risks;
- detect inconsistencies;
- recommend next conversational move;
- identify weak documents;
- explain downstream implications;
- keep AI diagnostics classified as advisory unless confirmed.

## Related Docs

- `docs/03-system-architecture/05_VALIDATION_AND_DIAGNOSTICS.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/10-operational-playbooks/02_RISK_REGISTER.md`

## Deliverables

- `/diagnose` slash command;
- diagnostics engine;
- deterministic gap summary;
- AI risk analysis operation;
- AI next-step recommendation operation;
- affected document list;
- severity grouping;
- diagnostic tests with mocked AI.

## Implementation Notes

Diagnostics should produce concise but useful output in the TUI, with deeper detail available in generated docs or logs.

## Acceptance Criteria

- diagnostics show critical, important, and optional gaps;
- AI risk notes are clearly marked as proposed/advisory;
- user can act on the recommended next conversational move;
- diagnostics do not mutate confirmed decisions;
- malformed AI diagnostics are handled safely.

---

## Phase 11 — TUI Interaction Polish

## Objective

Improve the TUI so the AI-led workflow feels controlled, transparent, and useful.

## Goals

- improve navigation;
- show progress;
- support skip/assume/unknown;
- show AI proposal status;
- show provider usage notices;
- show affected documents;
- improve visual hierarchy;
- support review screens for AI proposals.

## Related Docs

- `docs/04-tui-experience/00_TUI_PRODUCT_SPEC.md`
- `docs/04-tui-experience/01_COMMANDS.md`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`

## Deliverables

- better TUI components;
- progress display;
- keyboard interactions;
- review screen for proposed decisions;
- diagnostics screen;
- generate summary screen;
- provider/context disclosure screen where appropriate.

## Implementation Notes

The TUI should make it clear when the user is:

- answering an AI-led conversational prompt;
- reviewing an AI-generated proposal;
- confirming a decision;
- accepting an assumption;
- regenerating documents.

## Acceptance Criteria

- user can distinguish AI proposals from confirmed state;
- progress by phase is visible;
- conversation sessions are easy to resume;
- diagnostics are readable;
- destructive actions require confirmation;
- TUI flows are covered by integration-style tests where practical.

---

## Phase 12 — App Business Profile Completion

## Objective

Complete the first production-quality profile: `app-business`.

## Goals

- complete canonical question sets;
- complete canonical document contracts;
- complete document templates;
- complete validation rules;
- complete AI prompt context for the profile;
- complete risk pattern definitions;
- complete dependency mappings;
- complete example generated project.

## Related Docs

- `docs/05-profiles/app-business/profile.yml`
- `docs/05-profiles/app-business/documents.yml`
- `docs/05-profiles/app-business/questions.yml`
- `docs/05-profiles/app-business/validations.yml`
- `docs/06-documentation-system/02_APP_BUSINESS_DOC_STRUCTURE.md`

## Deliverables

- full app-business profile;
- full document contracts;
- full question sets;
- full validation rules;
- full risk pattern definitions;
- full dependency mappings;
- full document templates;
- full AI prompt context for profile operations;
- sample generated project;
- profile tests.

## Implementation Notes

The profile must be broad enough to generate documentation for:

- ideation;
- market;
- business model;
- financial model;
- break-even;
- product;
- UX;
- architecture;
- implementation;
- testing;
- marketing;
- launch;
- operations;
- governance.

The profile completion pass should reconcile all App Business document references to the canonical output tree defined earlier in this roadmap. Older names should either become aliases for migration or be removed from implementation-facing docs.

Each canonical document contract should include:

- required inputs;
- primary questions;
- generated outputs;
- completion criteria;
- dependent decisions;
- related validation rules;
- related prompt context requirements.

## Acceptance Criteria

- app-business profile can produce all canonical documents;
- canonical document names and phase folders are consistent across docs;
- each document follows its declared structure;
- each document declares required inputs and generated outputs;
- incomplete documents report missing decisions;
- profile validation is covered by tests;
- sample project demonstrates end-to-end value.

---

## Phase 13 — End-to-End Workflow Hardening

## Objective

Validate the full LOGOS flow from project initialization to generated documentation.

## Goals

- run complete workflow tests;
- test state persistence;
- test recovery from AI failures;
- test regeneration behavior;
- test user confirmation flows;
- test profile-driven document generation;
- improve error messages.

## Related Docs

- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`
- `docs/03-system-architecture/05_VALIDATION_AND_DIAGNOSTICS.md`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`

## Deliverables

- end-to-end test scenarios;
- fixture projects;
- mocked AI workflow tests;
- document snapshot tests;
- failure handling tests;
- regression suite.

## Acceptance Criteria

- a test user can initialize a project;
- answer questions;
- receive AI proposals;
- confirm decisions;
- generate documents;
- run diagnostics;
- regenerate safely;
- recover from provider failure without corrupting state.

---

## Phase 14 — Open Source Launch Prep

## Objective

Prepare LOGOS Engine for public use and contribution.

## Goals

- prepare docs;
- write contribution guide;
- create demo;
- create issue templates;
- explain AI provider configuration;
- explain privacy behavior;
- explain profile contribution model.

## Related Docs

- `docs/02-open-source/00_OPEN_SOURCE_STRATEGY.md`
- `docs/02-open-source/01_CONTRIBUTING_MODEL.md`
- `docs/02-open-source/02_COMMUNITY_AND_ETHOS.md`
- `docs/08-growth-and-community/00_MARKETING_STRATEGY.md`
- `docs/08-growth-and-community/01_LAUNCH_PLAN.md`
- `docs/08-growth-and-community/02_CONTENT_STRATEGY.md`

## Deliverables

- `CONTRIBUTING.md`;
- `CODE_OF_CONDUCT.md`;
- `SECURITY.md`;
- provider configuration docs;
- privacy notes;
- examples;
- launch README;
- issue templates;
- demo recording or GIF.

## Acceptance Criteria

- new users can install and run the tool;
- new contributors understand where to help;
- AI behavior and provider usage are documented;
- privacy implications are explicit;
- example workspace demonstrates value quickly.

---

## Post-Phase 14 Migration Context

Phase 0 through Phase 14 have already produced a working repository with CLI/TUI
shell, workspace initialization, profile loading, provider abstraction, prompt
contracts, guided intake, decision and validation models, document rendering,
diagnostics, regression tests, examples, and launch/contribution documentation.

That implementation was built around a deterministic question engine exposed
through `/continue` subcommands such as answering a selected question id. The
desired product direction has changed: normal intake and documentation must now
be driven by AI conversation. The existing deterministic structure remains
valuable as profile coverage, validation, persistence, tests, and guardrails, but
it must no longer be the user-facing intake path.

The following migration phases convert the current post-Phase 14 repository into
the desired AI-led conversational product before public release.

---

## Phase 15 — Conversation Model and Legacy Intake Boundary

## Objective

Introduce the conversation-first runtime model while explicitly isolating the
existing deterministic guided-intake implementation as legacy/internal support.

## Goals

- define conversation turns as first-class state;
- add AI operation contracts for leading intake turns;
- rename or supersede next-question-group operations with next-conversation-move operations;
- preserve existing question/profile metadata as AI coverage context;
- prevent `/continue answer <question-id>` from remaining the documented user path;
- keep existing tests passing while new conversational tests are introduced.

## Related Docs

- `docs/04-tui-experience/01_COMMANDS.md`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/01_PROMPTING_CONTRACT.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/03-system-architecture/02_DATA_MODEL.md`
- `profiles/app-business/questions.yml`

## Deliverables

- conversation turn schema and storage;
- conversation session model or migration of the current intake session model;
- `lead_intake_turn` AI operation schema;
- `recommend_next_conversation_move` AI operation schema;
- prompt/context updates for conversation state;
- legacy boundary around deterministic question selection APIs;
- migration notes for existing `.logos/sessions/` data.

## Implementation Notes

The current `question-engine` can remain as an internal helper for coverage,
fixtures, and migration, but user-facing services should not ask the user to
select question ids.

Conversation turns should preserve:

- user message;
- AI response;
- interpreted answer records;
- proposed decisions;
- assumptions;
- open questions;
- source links between the turn and generated state.

## Acceptance Criteria

- conversation turns are persisted and schema-validated;
- AI operation registry includes `lead_intake_turn` and `recommend_next_conversation_move`;
- old next-question-group behavior is not presented as the primary product path;
- existing workspace state can still be read safely;
- new tests cover conversation turn parsing and storage;
- default tests still avoid live model calls.

---

## Phase 16 — Conversational TUI Runtime

## Objective

Make the TUI behave like a conversation with AI by routing ordinary text input
to the conversational intake service instead of the slash command parser.

## Goals

- route non-slash input to AI conversation;
- keep slash commands only for operational actions;
- make `/continue` start or resume the conversation;
- show AI messages and user messages as conversation history;
- handle no-provider state by guiding setup instead of falling back to deterministic questions;
- keep destructive operations confirmation-gated.

## Related Docs

- `docs/04-tui-experience/00_TUI_PRODUCT_SPEC.md`
- `docs/04-tui-experience/01_COMMANDS.md`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`
- `docs/07-ai-and-agent-behavior/03_PROVIDER_CONFIGURATION.md`
- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`

## Deliverables

- conversational intake application service;
- TUI input router that separates slash commands from conversation messages;
- `/continue` implementation that resumes AI-led conversation;
- no-provider setup prompt/state;
- conversation rendering components;
- provider/context disclosure hook before remote calls;
- tests for non-slash input behavior.

## Implementation Notes

The current TUI rejects non-slash input as a command error. That behavior must be
removed for normal mode. A user typing `I don't know yet`, `assume solo
founders`, or a long product explanation should create a conversation turn, not
a command parse failure.

## Acceptance Criteria

- ordinary text input advances the AI conversation;
- slash commands continue to work for explicit operations;
- `/continue` does not require subcommands for normal progress;
- no-provider state points the user to `/config ai`;
- user can mark uncertainty and assumptions conversationally;
- TUI tests cover both slash command and conversation input paths.

---

## Phase 17 — AI Interpretation, Proposals, and Confirmation

## Objective

Use AI to interpret conversation turns into structured answers, assumptions,
open questions, and decision proposals while preserving explicit user control.

## Goals

- interpret free-form user messages into structured state;
- extract proposed decisions from conversation turns;
- classify assumptions and unknowns from natural language;
- require confirmation before proposed decisions become confirmed;
- preserve traceability from document claims back to conversation turns;
- reject malformed or overconfident AI output safely.

## Related Docs

- `docs/03-system-architecture/03_DECISION_REGISTRY.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/01_PROMPTING_CONTRACT.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/10-operational-playbooks/02_RISK_REGISTER.md`

## Deliverables

- conversation interpretation service;
- AI response schemas for interpreted answers and proposal batches;
- proposal review flow adapted to conversation turns;
- confirmation and rejection flows for AI proposals;
- source linking from turns to answers, assumptions, decisions, and documents;
- malformed AI output tests;
- provider failure tests for conversation interpretation.

## Implementation Notes

AI may infer candidate decisions, but must not silently confirm them. If a user
states something directly and unambiguously, the system may prepare a proposed
decision and ask for confirmation, or route it through an explicit confirmation
screen.

## Acceptance Criteria

- conversation messages create structured interpreted records;
- AI-generated decisions enter as `proposed`;
- confirmed decisions require explicit user confirmation;
- assumptions and unknowns are separated from confirmed facts;
- malformed interpretation output does not corrupt state;
- traceability from generated state to conversation turns is test-covered.

---

## Phase 18 — AI-Led Document Drafting and Regression Rebaseline

## Objective

Rebaseline document generation, diagnostics, examples, and regression tests
around AI-led conversation rather than deterministic question-answer commands.

## Goals

- draft documents from conversation-derived state and confirmed decisions;
- remove deterministic questionnaire assumptions from E2E tests and examples;
- update diagnostics to recommend conversational next steps;
- update demo scripts and example guidance;
- preserve deterministic validation as a guardrail;
- verify the complete AI-led workflow before release.

## Related Docs

- `docs/03-system-architecture/04_DOCUMENT_RENDERING.md`
- `docs/03-system-architecture/05_VALIDATION_AND_DIAGNOSTICS.md`
- `docs/06-documentation-system/00_DOCUMENTATION_ARCHITECTURE.md`
- `docs/07-ai-and-agent-behavior/03_PROVIDER_CONFIGURATION.md`
- `docs/08-growth-and-community/01_LAUNCH_PLAN.md`
- `examples/README.md`

## Deliverables

- conversational E2E workflow tests;
- updated example workspace or new conversation-first fixture;
- updated demo script;
- document rendering tests based on conversation-derived state;
- diagnostics tests using next conversational move recommendations;
- README and example updates for AI-led usage;
- regression suite proving no live provider is required for tests.

## Implementation Notes

Existing tests that exercise `/continue answer <question-id>` should either move
to internal service-level coverage or be replaced by conversation-first workflow
tests. Release-facing examples should not teach users to answer question ids.

## Acceptance Criteria

- full workflow can run with mocked or fixture AI conversation;
- E2E tests no longer depend on user-facing question id commands;
- generated docs remain broad, auditable, and explicit about uncertainty;
- diagnostics recommend conversational next steps;
- examples demonstrate AI-led intake;
- `pnpm check` passes.

---

## Phase 19 — Public Release

## Objective

Publish the first public version of LOGOS Engine.

## Goals

- publish package;
- tag release;
- announce project;
- collect feedback;
- triage issues;
- identify V1 gaps.

## Related Docs

- `docs/10-operational-playbooks/01_RELEASE_PROCESS.md`
- `docs/08-growth-and-community/01_LAUNCH_PLAN.md`
- `docs/08-growth-and-community/00_MARKETING_STRATEGY.md`

## Deliverables

- npm package;
- GitHub release;
- changelog;
- release notes;
- launch content;
- public demo;
- feedback collection process.

## Acceptance Criteria

- package is installable;
- release notes explain capabilities and limitations;
- users can run the App Business workflow;
- issues can be reported clearly;
- first feedback loop is established.

---

## Phase 20 — Post-Release Iteration

## Objective

Improve LOGOS Engine based on real usage without expanding scope prematurely.

## Goals

- fix onboarding friction;
- improve AI prompt quality;
- improve document completeness;
- improve diagnostics;
- improve profile authoring experience;
- identify next profile candidates;
- avoid premature platform expansion.

## Related Docs

- `docs/10-operational-playbooks/02_RISK_REGISTER.md`
- `docs/02-open-source/01_CONTRIBUTING_MODEL.md`
- `docs/05-profiles/00_PROFILE_SYSTEM.md`

## Deliverables

- issue triage;
- usability improvements;
- prompt refinements;
- template refinements;
- validation rule improvements;
- updated roadmap;
- candidate profile backlog.

## Acceptance Criteria

- user feedback is reflected in roadmap;
- profile gaps are identified;
- most common workflow issues are addressed;
- expansion decisions are explicit, not impulsive.

---

## V1 Definition of Done

V1 is complete when a user can:

1. install LOGOS Engine;
2. initialize a local workspace;
3. select the App Business profile;
4. complete an AI-led intake conversation;
5. receive AI-generated initial and follow-up questions;
6. review AI-generated decision proposals;
7. confirm or reject proposed decisions;
8. generate the canonical App Business documentation tree;
9. receive complete Markdown documents with assumptions, gaps, risks, and next actions;
10. run validation;
11. run diagnostics;
12. safely regenerate documents;
13. inspect project state in `.logos/`;
14. understand whether any context is being sent to an AI provider;
15. run the default test suite without live model calls;
16. commit everything to Git.

## V1 Non-Negotiables

- AI is part of the core workflow.
- Live remote AI is opt-in and configurable.
- AI output is never silently treated as confirmed truth.
- Documents are broad and complete, not shallow summaries.
- Profiles define document structure, not just document names.
- The project remains local-first.
- State is text-based and Git-friendly.
- Decision status and AI output status are separate model concepts.
- Provider coupling is avoided.
- Tests do not depend on live model calls by default.

## Explicitly Deferred Until After V1

- web dashboard;
- team collaboration;
- cloud sync;
- profile marketplace;
- multi-agent orchestration;
- automatic app implementation;
- unrestricted market research;
- complex financial simulation engine;
- visual graph editor;
- paid hosted product.
