# Technical Milestones

## Purpose

This document defines the technical milestones required to deliver LOGOS Engine V1.

It must stay aligned with:

- `docs/09-implementation-roadmap/00_IMPLEMENTATION_ROADMAP.md`
- `docs/09-implementation-roadmap/01_PHASED_TASKS.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`

LOGOS Engine is an AI-structured documentation and intent clarification system.

Therefore, technical milestones must measure not only CLI, storage, and Markdown rendering, but also AI provider abstraction, prompt contracts, structured AI output, user confirmation flows, and safe document generation.

---

## Milestone 1 — Repository and Tooling Foundation

## Outcome

The repository is ready for disciplined TypeScript development.

## Capabilities

- TypeScript project configured;
- package manager configured;
- linting and formatting configured;
- test runner configured;
- documentation tree committed;
- development standards documented;
- initial `src/` and `tests/` structure created.

## Completion Criteria

- dependencies install cleanly;
- tests can run;
- lint/format scripts exist;
- documentation is committed;
- repository can support implementation work without additional setup ambiguity.

---

## Milestone 2 — CLI and TUI Skeleton

## Outcome

The user can execute the LOGOS command-line interface and access the core command surface.

## Capabilities

- executable CLI entrypoint;
- command parser;
- TUI shell;
- command routing;
- command handler layer;
- application service boundary.

## Required Commands

```bash
logos init
logos status
logos continue
logos generate
logos validate
logos diagnose
```

## Completion Criteria

- `logos --help` works;
- all core commands exist;
- command routing is tested;
- TUI renders without requiring workspace state;
- command handlers do not directly mutate files.

---

## Milestone 3 — Local Workspace Initialization

## Outcome

A user can initialize LOGOS Engine inside a local project repository.

## Capabilities

- project root detection;
- existing workspace detection;
- `.logos/` creation;
- `docs/` creation;
- project metadata persistence;
- profile lock persistence;
- safe file writes;
- repeated-init protection.

## Expected Output

```text
.logos/
  project.json
  profile.lock.json
  answers.json
  decisions.json
  sessions/

docs/
  ...
```

## Completion Criteria

- `logos init` creates a valid workspace;
- repeated `logos init` does not corrupt existing state;
- generated files are Git-friendly;
- safe file writes are tested.

---

## Milestone 4 — Profile System and App Business Skeleton

## Outcome

The engine can load and validate the `app-business` profile.

## Capabilities

- profile schema;
- phase schema;
- canonical document schema;
- question set schema;
- validation rule schema;
- profile loader;
- profile versioning;
- profile validation.

## Required App Business Profile Coverage

The initial profile skeleton must include:

- phases;
- canonical document definitions;
- document structure metadata;
- document completion criteria;
- question set stubs;
- validation rule stubs.

## Completion Criteria

- app-business profile loads successfully;
- invalid profiles fail clearly;
- canonical documents define internal structure, not only filenames;
- profile metadata is available to workspace state;
- profile loader is tested.

---

## Milestone 5 — LLM Provider Abstraction

## Outcome

The AI layer exists as a first-class, provider-agnostic system boundary.

## Capabilities

- `LlmProvider` interface;
- provider configuration model;
- mock provider;
- provider error model;
- structured AI request schema;
- structured AI response schema;
- AI output status model;
- response validation utilities.

## Required AI Output Statuses

- `draft`;
- `proposed`;
- `confirmed`;
- `rejected`;
- `needs_review`.

## Completion Criteria

- all AI calls route through provider abstraction;
- mocked provider supports deterministic tests;
- malformed AI output is rejected safely;
- provider failures do not corrupt workspace state;
- no AI operation directly mutates project state.

---

## Milestone 6 — Prompt and Context Management

## Outcome

Prompt construction is implemented as a versioned, testable product surface.

## Capabilities

- prompt builder;
- context builder;
- operation-specific prompt contracts;
- context selection rules;
- structured output instructions;
- refusal and uncertainty handling instructions;
- profile-aware prompt context;
- document-contract-aware prompt context.

## Required Context Separation

Prompts must clearly separate:

- confirmed user facts;
- assumptions;
- open questions;
- proposed decisions;
- confirmed decisions;
- profile requirements;
- document completion criteria.

## Completion Criteria

- prompts are inspectable in code;
- prompt construction is tested;
- context inclusion is minimal and intentional;
- output schema expectations are explicit;
- prompt changes are reviewable.

---

## Milestone 7 — AI-Assisted Guided Intake

## Outcome

A user can answer structured questions, and the system can use AI to generate context-aware follow-ups and summaries.

## Capabilities

- question schema;
- answer schema;
- session schema;
- answer store;
- session store;
- question group selector;
- phase-aware question selection;
- missing-decision-aware question selection;
- AI-assisted follow-up question generation;
- AI-assisted answer summarization;
- unknown answer handling;
- assumption answer handling.

## Completion Criteria

- user can answer foundation questions;
- answers are persisted;
- sessions can resume;
- unknown answers create open questions;
- assumption answers create assumptions;
- AI follow-up questions are proposed, not silently canonical;
- question selection is tested with mocked AI responses.

---

## Milestone 8 — Decision Registry and AI Decision Proposal Flow

## Outcome

User answers can be transformed into structured decision proposals, and confirmed decisions become the source of truth.

## Capabilities

- decision schema;
- decision proposal schema;
- decision store;
- decision status transitions;
- source answer tracking;
- AI decision extraction;
- AI assumption classification;
- proposal review flow;
- confirm/reject flow;
- affected document detection.

## Completion Criteria

- AI-extracted decisions enter as `proposed`;
- user can confirm or reject proposed decisions;
- confirmed decisions preserve source answer references;
- AI cannot silently confirm decisions;
- changed decisions identify affected documents or validations.

---

## Milestone 9 — Canonical Document Renderer with AI Drafting

## Outcome

The system can generate complete canonical Markdown documents using structured state and AI-assisted drafting.

## Capabilities

- Markdown template renderer;
- document renderer service;
- generated YAML frontmatter;
- safe render mode;
- refresh render mode;
- manual notes preservation strategy;
- AI document section drafting;
- document completion criteria reporting;
- missing input reporting.

## Required Quality Bar

Generated documents must be:

- complete enough to guide execution;
- structured according to profile contract;
- explicit about assumptions;
- explicit about open questions;
- explicit about risks;
- not shallow summaries.

## Completion Criteria

- `logos generate` creates the canonical App Business document tree;
- generated documents include required sections;
- AI-drafted sections are clearly classified;
- incomplete documents report missing inputs;
- document rendering is regression tested.

---

## Milestone 10 — Deterministic Validation Engine

## Outcome

The system can validate project completeness without relying on live AI calls.

## Capabilities

- validation rule schema;
- validation engine;
- required decision validation;
- dependency validation;
- phase readiness validation;
- severity levels;
- affected document reporting;
- `logos validate` command.

## Completion Criteria

- required decisions are enforced;
- dependency rules work;
- severity levels are clear;
- validation does not require live AI;
- validation output references affected documents and phases;
- critical App Business rules are tested.

---

## Milestone 11 — AI-Assisted Diagnostics and Risk Analysis

## Outcome

The system can explain gaps, risks, inconsistencies, and next steps by combining deterministic validation with AI-assisted interpretation.

## Capabilities

- diagnostics engine;
- deterministic gap summary;
- AI-assisted gap analysis;
- AI-assisted risk analysis;
- next question group recommendation;
- severity grouping;
- affected document list;
- `logos diagnose` command.

## Completion Criteria

- diagnostics show critical, important, and optional gaps;
- AI risk notes are marked as advisory/proposed;
- diagnostics do not mutate confirmed decisions;
- malformed AI diagnostics are handled safely;
- diagnostic tests use mocked AI responses.

---

## Milestone 12 — TUI Review and Confirmation Experience

## Outcome

The TUI makes the AI-assisted workflow transparent and controlled.

## Capabilities

- progress indicator;
- phase progress view;
- proposal review screen;
- decision confirmation screen;
- assumption confirmation screen;
- diagnostics screen;
- generation summary screen;
- provider/context disclosure where relevant;
- destructive action confirmation.

## Completion Criteria

- user can distinguish profile questions from AI proposals;
- user can distinguish proposed decisions from confirmed decisions;
- user can confirm/reject proposals;
- progress by phase is visible;
- diagnostics are readable;
- destructive actions require confirmation.

---

## Milestone 13 — Full App Business Profile

## Outcome

The `app-business` profile is complete enough to generate broad, implementation-ready documentation for an app-based business.

## Required Coverage

- ideation;
- market;
- business model;
- positioning;
- financial model;
- pricing;
- break-even;
- product thesis;
- MVP scope;
- UX and design;
- architecture;
- tech stack;
- data model;
- API spec;
- implementation plan;
- testing strategy;
- marketing strategy;
- launch plan;
- operations;
- support;
- metrics;
- risk register;
- decision log.

## Completion Criteria

- every canonical document has a declared structure;
- every canonical document has completion criteria;
- every canonical document can be generated;
- incomplete documents report missing decisions;
- profile validation is tested;
- an example workspace demonstrates end-to-end value.

---

## Milestone 14 — End-to-End Workflow Hardening

## Outcome

The full LOGOS workflow is reliable enough for external users.

## Required Workflow

```text
init
→ guided intake
→ AI follow-up
→ AI decision proposal
→ user confirmation
→ document generation
→ validation
→ diagnostics
→ safe regeneration
```

## Capabilities

- fixture projects;
- mocked AI workflow tests;
- provider failure handling;
- invalid structured output handling;
- manual notes preservation tests;
- document snapshot tests;
- regression suite.

## Completion Criteria

- full workflow can run with mocked AI;
- provider failures do not corrupt state;
- generated docs remain stable under regression tests;
- user confirmation flow is enforced;
- workspace can be committed to Git cleanly.

---

## Milestone 15 — Open Source Launch Readiness

## Outcome

The project is ready for public use and contribution.

## Capabilities

- installation docs;
- provider configuration docs;
- privacy behavior docs;
- AI behavior docs;
- contribution guide;
- code of conduct;
- security policy;
- issue templates;
- example workspace;
- demo recording or GIF.

## Completion Criteria

- new users can install and run the tool;
- new contributors understand where to help;
- AI provider usage is documented;
- privacy implications are explicit;
- example workspace demonstrates value quickly.

---

## Milestone 16 — Public Release

## Outcome

LOGOS Engine is published and usable by external users.

## Capabilities

- package build;
- local package install verification;
- changelog;
- release notes;
- npm package publish;
- GitHub release;
- public demo;
- feedback collection process.

## Completion Criteria

- package is installable;
- release notes explain capabilities and limitations;
- App Business workflow works end-to-end;
- issues can be reported clearly;
- first feedback loop is established.

---

## Definition of V1 Done

V1 is done when:

- LOGOS Engine can be installed;
- `logos init` creates a valid local workspace;
- the App Business profile works end-to-end;
- AI is part of the guided workflow;
- AI calls use provider abstraction;
- prompt/context management is explicit and tested;
- answers are persisted;
- AI-generated decision proposals can be reviewed;
- decisions are persisted only after confirmation;
- canonical documentation tree is generated;
- generated documents are broad and complete enough to guide execution;
- validation works without live AI;
- diagnostics combine deterministic checks and AI-assisted interpretation;
- safe regeneration works;
- README explains the system clearly;
- AI provider and privacy behavior are documented;
- at least one example project exists;
- default tests do not require live model calls.

## Explicitly Not Required for V1

- web dashboard;
- cloud sync;
- team collaboration;
- multiple production profiles;
- marketplace;
- multi-agent orchestration;
- automatic app implementation;
- unrestricted market research;
- hosted paid SaaS.
