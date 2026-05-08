# Implementation Roadmap

## Roadmap Objective

Build LOGOS Engine incrementally without overengineering the first version.

## Phase 0 — Repository Foundation

### Goals

- initialize repository;
- define package manager;
- configure TypeScript;
- configure linting and formatting;
- configure tests;
- create documentation structure.

### Deliverables

- package.json;
- tsconfig;
- lint config;
- test runner;
- README;
- docs folder.

## Phase 1 — CLI Skeleton

### Goals

- create executable CLI;
- implement command router;
- support basic commands.

### Commands

- `logos init`
- `logos status`
- `logos generate`

### Deliverables

- CLI entrypoint;
- command parser;
- basic output.

## Phase 2 — Workspace Initialization

### Goals

- create `.logos/`;
- create `docs/`;
- initialize project metadata;
- select profile.

### Deliverables

- project.json;
- profile lock;
- initial docs.

## Phase 3 — Profile Loader

### Goals

- define profile schema;
- load app-business profile;
- validate profile config.

### Deliverables

- profile loader;
- app-business profile metadata;
- phase definitions;
- document definitions.

## Phase 4 — Question Engine

### Goals

- ask question groups;
- store answers;
- resume sessions.

### Deliverables

- question schema;
- answer store;
- continue command;
- simple TUI prompts.

## Phase 5 — Decision Registry

### Goals

- map answers to decisions;
- store decisions;
- support decision statuses.

### Deliverables

- decisions.json;
- decision update logic;
- decision inspection.

## Phase 6 — Document Renderer

### Goals

- render Markdown templates;
- create canonical docs;
- support safe render.

### Deliverables

- template renderer;
- app-business document templates;
- generate command.

## Phase 7 — Validation Engine

### Goals

- implement required decision checks;
- implement basic dependency checks;
- show validation output.

### Deliverables

- validation rules;
- validate command;
- severity reporting.

## Phase 8 — Diagnostics

### Goals

- summarize gaps;
- identify risks;
- recommend next question group.

### Deliverables

- diagnose command;
- risk output;
- next action recommendation.

## Phase 9 — TUI Polish

### Goals

- improve navigation;
- show progress;
- support skip/assume/unknown;
- improve visual hierarchy.

### Deliverables

- better TUI components;
- progress display;
- keyboard interactions.

## Phase 10 — App Business Profile Completion

### Goals

- complete canonical question sets;
- complete document templates;
- complete validation rules.

### Deliverables

- full profile;
- sample generated project;
- tests.

## Phase 11 — Open Source Launch Prep

### Goals

- prepare docs;
- write contribution guide;
- create demo;
- create issue templates.

### Deliverables

- CONTRIBUTING.md;
- CODE_OF_CONDUCT.md;
- examples;
- launch README.

## Phase 12 — Public Release

### Goals

- publish package;
- tag release;
- announce project.

### Deliverables

- npm package;
- GitHub release;
- launch content.

## Implementation Roadmap

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
- `docs/05-profiles/app-business/00_APP_BUSINESS_PROFILE.md`
- `docs/05-profiles/app-business/01_CANONICAL_DOCUMENTS.md`
- `docs/05-profiles/app-business/02_QUESTION_SETS.md`
- `docs/05-profiles/app-business/03_VALIDATION_RULES.md`
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

However, AI output must enter the system as:

- `draft`;
- `proposed`;
- `needs_review`;
- `rejected`;
- `confirmed` only after user confirmation.

### 2. Keep Deterministic Guardrails Strong

The AI layer should not replace:

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

The first milestone is a local-first TUI that can conduct an AI-assisted intake and produce a coherent App Business documentation workspace.

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

- create executable CLI;
- implement command router;
- create initial TUI shell;
- support basic commands;
- establish command-to-application-service boundaries.

## Commands

- `logos init`
- `logos status`
- `logos generate`
- `logos continue`
- `logos diagnose`
- `logos validate`

## Related Docs

- `docs/04-tui-experience/00_TUI_PRODUCT_SPEC.md`
- `docs/04-tui-experience/01_COMMANDS.md`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`
- `docs/03-system-architecture/01_MODULES.md`

## Deliverables

- CLI entrypoint;
- command parser;
- TUI layout shell;
- help output;
- command stubs;
- application service boundary;
- basic command tests.

## Implementation Notes

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
- each core command has a stub;
- command routing is tested;
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

- `logos init` creates a valid workspace;
- repeated `logos init` does not corrupt existing state;
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
- validate profile configuration.

## Related Docs

- `docs/05-profiles/00_PROFILE_SYSTEM.md`
- `docs/05-profiles/app-business/00_APP_BUSINESS_PROFILE.md`
- `docs/05-profiles/app-business/01_CANONICAL_DOCUMENTS.md`
- `docs/05-profiles/app-business/02_QUESTION_SETS.md`
- `docs/05-profiles/app-business/03_VALIDATION_RULES.md`

## Deliverables

- profile schema;
- profile loader;
- profile validation;
- app-business profile metadata;
- app-business phase definitions;
- app-business document definitions;
- app-business question set definitions;
- app-business validation rule stubs.

## Implementation Notes

The profile must define more than filenames.

Each canonical document definition should include:

- document id;
- output path;
- purpose;
- required decisions;
- recommended structure;
- completion criteria;
- dependencies.

## Acceptance Criteria

- app-business profile loads successfully;
- invalid profiles fail with clear errors;
- document definitions include internal structure metadata;
- profile version is available to the workspace;
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
- support at least one real provider adapter later;
- define output status model.

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
- provider error model.

## AI Operations for V1

Initial operation types:

- `generate_follow_up_questions`;
- `summarize_answer`;
- `extract_decision_proposals`;
- `classify_assumptions`;
- `identify_gaps`;
- `identify_risks`;
- `draft_document_section`;
- `recommend_next_question_group`.

## Implementation Notes

AI modules must not directly mutate project state.

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
- include profile context where needed;
- include document contracts where needed;
- include decision registry context where needed;
- enforce structured output instructions;
- add prompt snapshot tests where practical.

## Related Docs

- `docs/07-ai-and-agent-behavior/01_PROMPTING_CONTRACT.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`
- `docs/05-profiles/app-business/01_CANONICAL_DOCUMENTS.md`

## Deliverables

- prompt builder;
- context builder;
- operation-specific prompt templates;
- schema-aware output instructions;
- prompt tests or snapshots;
- context budgeting utilities if needed;
- provider transmission disclosure metadata.

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
- output schema expectations are explicit;
- prompt changes are reviewable through tests or snapshots.

---

## Phase 6 — Question Engine and AI-Assisted Interrogation

## Objective

Implement the guided intake system, using the profile and AI layer to ask context-aware questions.

## Goals

- ask question groups;
- store answers;
- resume sessions;
- allow `unknown` answers;
- allow assumption-based answers;
- use AI to generate contextual follow-up questions;
- use AI to recommend next question groups.

## Related Docs

- `docs/05-profiles/app-business/02_QUESTION_SETS.md`
- `docs/04-tui-experience/02_INTERACTION_FLOWS.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/03-system-architecture/01_MODULES.md`

## Deliverables

- question schema;
- answer store;
- session store;
- `logos continue` command;
- question group selector;
- AI follow-up question operation;
- answer summarization operation;
- assumption marking behavior.

## Implementation Notes

The question engine should combine:

- profile-defined questions;
- current phase;
- missing required decisions;
- AI-suggested follow-ups;
- user answer history.

The system should not ask unlimited questions.

Question groups should remain small and purposeful.

## Acceptance Criteria

- user can answer foundation questions;
- answers are stored;
- sessions can resume;
- unknown answers create open questions;
- assumption answers create assumptions;
- AI follow-up questions are proposed, not silently injected as canonical requirements;
- question selection is tested with mocked AI responses.

---

## Phase 7 — Decision Registry and AI Decision Proposal Flow

## Objective

Implement the structured decision registry and allow AI to propose decisions based on user answers.

## Goals

- define decision schema;
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

## Acceptance Criteria

- decisions can be stored and updated;
- decision status is explicit;
- AI-extracted decisions enter as `proposed`;
- user can confirm or reject proposals;
- confirmed decisions preserve source answer references;
- changing a decision identifies affected documents or future validation needs.

---

## Phase 8 — Document Renderer and AI-Assisted Drafting

## Objective

Render complete canonical Markdown documents from structured state and AI-assisted drafts.

## Goals

- render Markdown templates;
- create canonical docs;
- support safe render;
- support generated sections;
- support manual notes preservation;
- use AI to draft complete document sections based on document contracts;
- mark AI-generated content as draft or needs review when appropriate.

## Related Docs

- `docs/03-system-architecture/04_DOCUMENT_RENDERING.md`
- `docs/06-documentation-system/00_DOCUMENTATION_ARCHITECTURE.md`
- `docs/06-documentation-system/01_CANONICAL_DOCUMENT_TEMPLATE.md`
- `docs/06-documentation-system/02_APP_BUSINESS_DOC_STRUCTURE.md`
- `docs/05-profiles/app-business/01_CANONICAL_DOCUMENTS.md`

## Deliverables

- template renderer;
- document renderer service;
- app-business document templates;
- generated frontmatter;
- safe render mode;
- refresh render mode;
- AI document section drafting operation;
- document completion criteria reporting.

## Implementation Notes

The renderer should produce documents that are:

- complete enough to guide execution;
- structured according to document contract;
- explicit about assumptions and gaps;
- not artificially brief;
- not overwritten destructively.

## Acceptance Criteria

- `logos generate` creates the canonical App Business document tree;
- generated documents include required sections;
- manual sections are preserved where supported;
- AI-drafted sections are clearly classified;
- incomplete documents report missing inputs;
- document rendering is regression tested.

---

## Phase 9 — Validation Engine and Deterministic Guardrails

## Objective

Implement deterministic validation rules that check whether the documentation and decisions are structurally sufficient.

## Goals

- implement required decision checks;
- implement dependency checks;
- implement phase readiness checks;
- implement severity levels;
- keep validation separate from AI judgment;
- allow AI to explain validation findings where useful without replacing the rules.

## Related Docs

- `docs/03-system-architecture/05_VALIDATION_AND_DIAGNOSTICS.md`
- `docs/05-profiles/app-business/03_VALIDATION_RULES.md`
- `docs/03-system-architecture/03_DECISION_REGISTRY.md`

## Deliverables

- validation rule schema;
- validation engine;
- `logos validate` command;
- severity reporting;
- phase readiness output;
- affected document reporting;
- tests for validation rules.

## Implementation Notes

Validation should answer:

- What is missing?
- What is blocking?
- What is risky but not blocking?
- Which documents are affected?
- Which phase can proceed?

## Acceptance Criteria

- required decisions are enforced;
- dependency rules work;
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
- recommend next question group;
- identify weak documents;
- explain downstream implications;
- keep AI diagnostics classified as advisory unless confirmed.

## Related Docs

- `docs/03-system-architecture/05_VALIDATION_AND_DIAGNOSTICS.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/10-operational-playbooks/02_RISK_REGISTER.md`

## Deliverables

- `logos diagnose` command;
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
- user can act on recommended next question group;
- diagnostics do not mutate confirmed decisions;
- malformed AI diagnostics are handled safely.

---

## Phase 11 — TUI Interaction Polish

## Objective

Improve the TUI so the AI-assisted workflow feels controlled, transparent, and useful.

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

- answering a profile-defined question;
- reviewing an AI-generated proposal;
- confirming a decision;
- accepting an assumption;
- regenerating documents.

## Acceptance Criteria

- user can distinguish AI proposals from confirmed state;
- progress by phase is visible;
- question sessions are easy to resume;
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
- complete example generated project.

## Related Docs

- `docs/05-profiles/app-business/00_APP_BUSINESS_PROFILE.md`
- `docs/05-profiles/app-business/01_CANONICAL_DOCUMENTS.md`
- `docs/05-profiles/app-business/02_QUESTION_SETS.md`
- `docs/05-profiles/app-business/03_VALIDATION_RULES.md`
- `docs/06-documentation-system/02_APP_BUSINESS_DOC_STRUCTURE.md`

## Deliverables

- full app-business profile;
- full document contracts;
- full question sets;
- full validation rules;
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

## Acceptance Criteria

- app-business profile can produce all canonical documents;
- each document follows its declared structure;
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

## Phase 15 — Public Release

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

## Phase 16 — Post-Release Iteration

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
4. answer guided questions;
5. receive AI-generated follow-up questions;
6. review AI-generated decision proposals;
7. confirm or reject proposed decisions;
8. generate the canonical App Business documentation tree;
9. receive complete Markdown documents with assumptions, gaps, risks, and next actions;
10. run validation;
11. run diagnostics;
12. safely regenerate documents;
13. inspect project state in `.logos/`;
14. commit everything to Git.

## V1 Non-Negotiables

- AI is part of the core workflow.
- AI output is never silently treated as confirmed truth.
- Documents are broad and complete, not shallow summaries.
- Profiles define document structure, not just document names.
- The project remains local-first.
- State is text-based and Git-friendly.
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
