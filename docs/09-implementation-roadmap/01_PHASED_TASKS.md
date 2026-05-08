# Phased Tasks

## Phase 0 Tasks

- [ ] Create repository
- [ ] Add README
- [ ] Add license
- [ ] Configure TypeScript
- [ ] Configure package manager
- [ ] Add linting
- [ ] Add formatter
- [ ] Add test runner
- [ ] Add docs structure

## Phase 1 Tasks

- [ ] Create CLI entrypoint
- [ ] Add command parser
- [ ] Implement `logos --help`
- [ ] Implement command stubs
- [ ] Add basic tests

## Phase 2 Tasks

- [ ] Implement project root detection
- [ ] Implement workspace creation
- [ ] Write `.logos/project.json`
- [ ] Write `.logos/profile.lock.json`
- [ ] Create docs folder
- [ ] Add init tests

## Phase 3 Tasks

- [ ] Define profile schema
- [ ] Add app-business profile
- [ ] Validate profile at load time
- [ ] Add profile tests

## Phase 4 Tasks

- [ ] Define question schema
- [ ] Implement question group selection
- [ ] Store answers
- [ ] Implement `logos continue`
- [ ] Support unknown answers
- [ ] Support assumptions

## Phase 5 Tasks

- [ ] Define decision schema
- [ ] Map answers to decisions
- [ ] Store decisions
- [ ] Preserve source answer references
- [ ] Add decision update tests

## Phase 6 Tasks

- [ ] Create Markdown renderer
- [ ] Create document templates
- [ ] Implement safe render
- [ ] Add generated frontmatter
- [ ] Preserve manual notes section

## Phase 7 Tasks

- [ ] Define validation rule schema
- [ ] Implement required decision validation
- [ ] Implement dependency validation
- [ ] Add severity levels
- [ ] Implement `logos validate`

## Phase 8 Tasks

- [ ] Implement diagnostics summary
- [ ] Group gaps by severity
- [ ] Show affected documents
- [ ] Recommend next action
- [ ] Implement `logos diagnose`

## Phase 9 Tasks

- [ ] Improve TUI layout
- [ ] Add progress indicator
- [ ] Add keyboard navigation
- [ ] Add review screen
- [ ] Improve errors

## Phase 10 Tasks

- [ ] Complete all app-business docs
- [ ] Complete all app-business question sets
- [ ] Complete profile validation
- [ ] Generate example workspace
- [ ] Write profile documentation

## Phase 11 Tasks

- [ ] Add contributing guide
- [ ] Add code of conduct
- [ ] Add issue templates
- [ ] Add examples
- [ ] Record demo
- [ ] Prepare launch post

## Phase 12 Tasks

- [ ] Publish npm package
- [ ] Create GitHub release
- [ ] Announce project
- [ ] Collect feedback
- [ ] Triage issues

## Phased Tasks

## Purpose

This document translates `00_IMPLEMENTATION_ROADMAP.md` into actionable implementation checklists.

It must stay aligned with the current roadmap, especially the AI-first architecture decisions.

LOGOS Engine uses AI as a core workflow layer for interrogation, synthesis, decision proposal, risk analysis, and document drafting. Therefore, task planning must include provider abstraction, prompt contracts, structured outputs, confirmation flows, AI safety, and mocked AI testing from the beginning.

## Related Documents

- `docs/09-implementation-roadmap/00_IMPLEMENTATION_ROADMAP.md`
- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/01_PROMPTING_CONTRACT.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `docs/05-profiles/app-business/01_CANONICAL_DOCUMENTS.md`

---

## Phase 0 — Repository Foundation

## Goal

Create the technical and documentation foundation for an AI-first local TUI application.

## Tasks

- [ ] Create repository
- [ ] Add `README.md`
- [ ] Add license
- [ ] Add initial documentation tree
- [ ] Configure package manager
- [ ] Configure TypeScript
- [ ] Configure linting
- [ ] Configure formatter
- [ ] Configure test runner
- [ ] Add initial `src/` structure
- [ ] Add initial `tests/` structure
- [ ] Add development scripts
- [ ] Document local development setup
- [ ] Document AI-first engineering constraints
- [ ] Document prompt/context safety expectations

## Acceptance Checklist

- [ ] Project installs cleanly
- [ ] Tests can run
- [ ] Lint/format commands exist
- [ ] Documentation tree exists
- [ ] Development standards are committed
- [ ] Repository is ready for Phase 1

---

## Phase 1 — CLI and TUI Skeleton

## Goal

Create the executable command structure and initial TUI shell.

## Tasks

- [ ] Create CLI entrypoint
- [ ] Add command parser
- [ ] Implement `logos --help`
- [ ] Implement `logos init` stub
- [ ] Implement `logos status` stub
- [ ] Implement `logos generate` stub
- [ ] Implement `logos continue` stub
- [ ] Implement `logos diagnose` stub
- [ ] Implement `logos validate` stub
- [ ] Create basic TUI shell
- [ ] Establish command handler layer
- [ ] Establish application service boundary
- [ ] Add basic command routing tests

## Acceptance Checklist

- [ ] CLI can be executed locally
- [ ] Help output is readable
- [ ] Core command stubs exist
- [ ] TUI can render without workspace state
- [ ] Command handlers do not directly mutate files

---

## Phase 2 — Workspace Initialization

## Goal

Allow LOGOS Engine to initialize a local workspace inside a project repository.

## Tasks

- [ ] Implement project root detection
- [ ] Implement existing workspace detection
- [ ] Implement workspace creation
- [ ] Create `.logos/` directory
- [ ] Create `.logos/sessions/` directory
- [ ] Write `.logos/project.json`
- [ ] Write `.logos/profile.lock.json`
- [ ] Write `.logos/answers.json`
- [ ] Write `.logos/decisions.json`
- [ ] Create `docs/` folder
- [ ] Create initial docs subfolder structure
- [ ] Implement safe file write utility
- [ ] Prevent destructive overwrite during init
- [ ] Add init tests
- [ ] Add repeated-init tests

## Acceptance Checklist

- [ ] `logos init` creates a valid workspace
- [ ] Existing workspace is detected safely
- [ ] Generated files are text-based and Git-friendly
- [ ] Profile lock is persisted
- [ ] Safe write behavior is tested

---

## Phase 3 — Profile Loader and App Business Profile Skeleton

## Goal

Implement the profile system and load the initial `app-business` profile.

## Tasks

- [ ] Define profile schema
- [ ] Define phase schema
- [ ] Define canonical document schema
- [ ] Define question set schema
- [ ] Define validation rule schema stub
- [ ] Define profile versioning model
- [ ] Implement profile loader
- [ ] Implement profile validation
- [ ] Add `app-business` profile metadata
- [ ] Add `app-business` phase definitions
- [ ] Add `app-business` canonical document definitions
- [ ] Add document structure metadata to each canonical document
- [ ] Add document completion criteria metadata
- [ ] Add `app-business` question set stubs
- [ ] Add `app-business` validation rule stubs
- [ ] Add profile loader tests
- [ ] Add invalid profile tests

## Acceptance Checklist

- [ ] App Business profile loads successfully
- [ ] Invalid profile fails with clear errors
- [ ] Canonical documents define structure, not just filenames
- [ ] Profile version is available to workspace state
- [ ] Profile tests cover document contract metadata

---

## Phase 4 — LLM Provider Abstraction and AI Operation Contracts

## Goal

Introduce AI as a first-class system layer without coupling the product to one provider.

## Tasks

- [ ] Define `LlmProvider` interface
- [ ] Define provider configuration model
- [ ] Implement mock provider
- [ ] Define provider error model
- [ ] Define AI operation registry
- [ ] Define AI request schema
- [ ] Define AI response schema
- [ ] Define structured output validation utilities
- [ ] Define AI output status enum
- [ ] Define statuses: `draft`, `proposed`, `confirmed`, `rejected`, `needs_review`
- [ ] Define operation: `generate_follow_up_questions`
- [ ] Define operation: `summarize_answer`
- [ ] Define operation: `extract_decision_proposals`
- [ ] Define operation: `classify_assumptions`
- [ ] Define operation: `identify_gaps`
- [ ] Define operation: `identify_risks`
- [ ] Define operation: `draft_document_section`
- [ ] Define operation: `recommend_next_question_group`
- [ ] Add tests for mock provider
- [ ] Add tests for malformed AI response handling
- [ ] Add tests for provider failure handling

## Acceptance Checklist

- [ ] All AI calls route through provider abstraction
- [ ] Mock provider supports deterministic tests
- [ ] Malformed AI output is rejected safely
- [ ] AI outputs are classified before use
- [ ] AI operations do not directly mutate project state
- [ ] Provider failure cannot corrupt workspace state

---

## Phase 5 — Prompt and Context Management

## Goal

Treat prompt construction as a versioned, testable product surface.

## Tasks

- [ ] Create prompt builder module
- [ ] Create context builder module
- [ ] Define operation-specific prompt contracts
- [ ] Define context selection rules
- [ ] Include profile context where required
- [ ] Include document contract context where required
- [ ] Include decision registry context where required
- [ ] Include open questions context where required
- [ ] Include assumption context where required
- [ ] Add structured output instructions to prompts
- [ ] Add refusal and uncertainty handling instructions
- [ ] Add provider transmission disclosure metadata
- [ ] Add token/context budgeting utility if needed
- [ ] Add prompt snapshot tests where practical
- [ ] Add context selection tests

## Acceptance Checklist

- [ ] Prompts are inspectable in code
- [ ] Prompt construction is tested
- [ ] Context inclusion is intentional and minimal
- [ ] User facts, assumptions, and AI proposals are separated
- [ ] Output schema expectations are explicit
- [ ] Prompt changes are reviewable

---

## Phase 6 — Question Engine and AI-Assisted Interrogation

## Goal

Implement guided intake with profile-defined questions and AI-assisted follow-up logic.

## Tasks

- [ ] Define question schema
- [ ] Define answer schema
- [ ] Define session schema
- [ ] Implement answer store
- [ ] Implement session store
- [ ] Implement question group selector
- [ ] Implement phase-aware question selection
- [ ] Implement missing-decision-aware question selection
- [ ] Implement `logos continue`
- [ ] Support `unknown` answers
- [ ] Support assumption-based answers
- [ ] Store raw user answers
- [ ] Use AI operation: `generate_follow_up_questions`
- [ ] Use AI operation: `summarize_answer`
- [ ] Use AI operation: `recommend_next_question_group`
- [ ] Mark AI-generated follow-up questions as proposed
- [ ] Add tests with mocked AI responses

## Acceptance Checklist

- [ ] User can answer foundation questions
- [ ] Answers are persisted
- [ ] Sessions can resume
- [ ] Unknown answers create open questions
- [ ] Assumption answers create assumptions
- [ ] AI follow-up questions are proposed, not silently canonical
- [ ] Question selection does not become infinite or uncontrolled

---

## Phase 7 — Decision Registry and AI Decision Proposal Flow

## Goal

Implement structured decisions as the source of truth and allow AI to propose decisions from user answers.

## Tasks

- [ ] Define decision schema
- [ ] Define decision proposal schema
- [ ] Implement decision store
- [ ] Implement decision status transitions
- [ ] Implement decision source tracking
- [ ] Preserve source answer references
- [ ] Implement AI operation: `extract_decision_proposals`
- [ ] Implement AI operation: `classify_assumptions`
- [ ] Add proposal review flow
- [ ] Add confirm proposal flow
- [ ] Add reject proposal flow
- [ ] Prevent AI proposals from becoming confirmed automatically
- [ ] Track decision changes
- [ ] Identify affected documents on decision change
- [ ] Add tests for confirmation-gated state changes
- [ ] Add tests for decision source tracking

## Acceptance Checklist

- [ ] Decisions can be stored and updated
- [ ] Decision status is explicit
- [ ] AI-extracted decisions enter as `proposed`
- [ ] User can confirm or reject proposals
- [ ] Confirmed decisions preserve source references
- [ ] Changed decisions identify affected documents or validations

---

## Phase 8 — Document Renderer and AI-Assisted Drafting

## Goal

Generate complete canonical Markdown documents using structured state and AI-assisted drafting.

## Tasks

- [ ] Create Markdown template renderer
- [ ] Create document renderer service
- [ ] Add generated YAML frontmatter
- [ ] Implement safe render mode
- [ ] Implement refresh render mode
- [ ] Implement manual notes preservation strategy
- [ ] Implement canonical App Business document tree generation
- [ ] Implement AI operation: `draft_document_section`
- [ ] Pass document contract into AI drafting context
- [ ] Pass confirmed decisions into AI drafting context
- [ ] Pass assumptions and open questions into AI drafting context
- [ ] Mark AI-drafted content as `draft` or `needs_review` where appropriate
- [ ] Report missing inputs per document
- [ ] Report document completion criteria status
- [ ] Add document rendering regression tests
- [ ] Add document snapshot tests

## Acceptance Checklist

- [ ] `logos generate` creates canonical App Business docs
- [ ] Documents include required sections
- [ ] Documents are broad and complete, not shallow summaries
- [ ] AI-drafted sections are clearly classified
- [ ] Manual sections are preserved where supported
- [ ] Incomplete documents report missing inputs
- [ ] Rendering is regression tested

---

## Phase 9 — Validation Engine and Deterministic Guardrails

## Goal

Implement deterministic validation rules that verify structural completeness and phase readiness.

## Tasks

- [ ] Define validation rule schema
- [ ] Implement validation engine
- [ ] Implement required decision validation
- [ ] Implement dependency validation
- [ ] Implement phase readiness validation
- [ ] Implement severity levels
- [ ] Implement affected document reporting
- [ ] Implement `logos validate`
- [ ] Add App Business foundation rules
- [ ] Add App Business market rules
- [ ] Add App Business economics rules
- [ ] Add App Business product rules
- [ ] Add App Business architecture rules
- [ ] Add App Business GTM rules
- [ ] Add App Business operations rules
- [ ] Add validation tests

## Acceptance Checklist

- [ ] Required decisions are enforced
- [ ] Dependency rules work
- [ ] Severity levels are clear
- [ ] Validation does not depend on live AI
- [ ] Validation output references affected docs/phases
- [ ] Critical App Business validation rules are covered by tests

---

## Phase 10 — AI-Assisted Diagnostics and Risk Analysis

## Goal

Combine deterministic validation with AI-assisted interpretation, risk analysis, and next-step recommendations.

## Tasks

- [ ] Implement diagnostics engine
- [ ] Implement deterministic gap summary
- [ ] Implement severity grouping
- [ ] Implement affected document list
- [ ] Implement `logos diagnose`
- [ ] Use AI operation: `identify_gaps`
- [ ] Use AI operation: `identify_risks`
- [ ] Use AI operation: `recommend_next_question_group`
- [ ] Mark AI diagnostics as advisory/proposed
- [ ] Prevent diagnostics from mutating confirmed decisions
- [ ] Add malformed AI diagnostics handling
- [ ] Add mocked AI diagnostic tests
- [ ] Add risk output tests

## Acceptance Checklist

- [ ] Diagnostics show critical, important, and optional gaps
- [ ] AI risk notes are clearly marked as advisory/proposed
- [ ] User receives next useful action
- [ ] Diagnostics do not mutate confirmed state
- [ ] Malformed AI diagnostics are handled safely

---

## Phase 11 — TUI Interaction Polish

## Goal

Make the AI-assisted workflow transparent, controlled, and usable.

## Tasks

- [ ] Improve TUI layout
- [ ] Add progress indicator
- [ ] Add phase progress view
- [ ] Add keyboard navigation
- [ ] Add proposal review screen
- [ ] Add decision confirmation screen
- [ ] Add assumption confirmation screen
- [ ] Add diagnostics screen
- [ ] Add generation summary screen
- [ ] Add provider usage notice where relevant
- [ ] Add context disclosure screen where relevant
- [ ] Improve error messages
- [ ] Improve destructive-action confirmations
- [ ] Add TUI flow tests where practical

## Acceptance Checklist

- [ ] User can distinguish profile questions from AI proposals
- [ ] User can distinguish proposed decisions from confirmed decisions
- [ ] Progress by phase is visible
- [ ] Diagnostics are readable
- [ ] Destructive actions require confirmation
- [ ] TUI supports resume-oriented workflows

---

## Phase 12 — App Business Profile Completion

## Goal

Complete the first production-quality profile.

## Tasks

- [ ] Complete all App Business phases
- [ ] Complete all App Business canonical document contracts
- [ ] Complete all App Business document templates
- [ ] Complete all App Business question sets
- [ ] Complete all App Business validation rules
- [ ] Complete all App Business AI prompt context requirements
- [ ] Ensure docs cover ideation
- [ ] Ensure docs cover market
- [ ] Ensure docs cover business model
- [ ] Ensure docs cover financial model
- [ ] Ensure docs cover break-even
- [ ] Ensure docs cover product
- [ ] Ensure docs cover UX/design
- [ ] Ensure docs cover architecture
- [ ] Ensure docs cover implementation
- [ ] Ensure docs cover testing
- [ ] Ensure docs cover marketing
- [ ] Ensure docs cover launch
- [ ] Ensure docs cover operations
- [ ] Ensure docs cover governance
- [ ] Generate example workspace
- [ ] Add profile tests

## Acceptance Checklist

- [ ] App Business profile can produce every canonical document
- [ ] Each document follows its declared structure
- [ ] Each document has completion criteria
- [ ] Incomplete documents report missing decisions
- [ ] Example workspace demonstrates end-to-end value
- [ ] Profile validation is tested

---

## Phase 13 — End-to-End Workflow Hardening

## Goal

Validate the complete LOGOS workflow from initialization to generated documentation.

## Tasks

- [ ] Create fixture project for minimal app business
- [ ] Create fixture project for complex app business
- [ ] Test init → intake → decision proposal → confirmation → generate
- [ ] Test init → unknown answers → open questions
- [ ] Test init → assumptions → assumption tracking
- [ ] Test diagnostics after partial intake
- [ ] Test validation after partial intake
- [ ] Test document regeneration
- [ ] Test manual notes preservation
- [ ] Test provider unavailable failure
- [ ] Test authentication failure behavior
- [ ] Test rate limit behavior
- [ ] Test invalid structured output behavior
- [ ] Test context length exceeded behavior
- [ ] Add regression suite
- [ ] Improve error messages based on E2E findings

## Acceptance Checklist

- [ ] Full workflow can run with mocked AI
- [ ] Provider failures do not corrupt state
- [ ] Generated docs remain stable under regression tests
- [ ] User confirmation flow is enforced
- [ ] Workspace can be committed to Git cleanly

---

## Phase 14 — Open Source Launch Prep

## Goal

Prepare the project for public use and contribution.

## Tasks

- [ ] Add `CONTRIBUTING.md`
- [ ] Add `CODE_OF_CONDUCT.md`
- [ ] Add `SECURITY.md`
- [ ] Add issue templates
- [ ] Add pull request template
- [ ] Add provider configuration docs
- [ ] Add privacy behavior docs
- [ ] Add AI behavior docs to README
- [ ] Add profile contribution guide
- [ ] Add example workspaces
- [ ] Add launch demo script
- [ ] Record demo or GIF
- [ ] Prepare launch post
- [ ] Prepare first good issues
- [ ] Prepare roadmap issue labels

## Acceptance Checklist

- [ ] New users can install and run the tool
- [ ] New contributors understand where to help
- [ ] AI provider usage is documented
- [ ] Privacy implications are explicit
- [ ] Example workspace demonstrates value quickly

---

## Phase 15 — Public Release

## Goal

Publish the first public version of LOGOS Engine.

## Tasks

- [ ] Verify package build
- [ ] Verify package install locally
- [ ] Prepare changelog
- [ ] Prepare release notes
- [ ] Tag release
- [ ] Publish npm package
- [ ] Create GitHub release
- [ ] Announce project
- [ ] Share demo
- [ ] Collect feedback
- [ ] Triage initial issues
- [ ] Identify V1 gaps

## Acceptance Checklist

- [ ] Package is installable
- [ ] Release notes explain capabilities and limitations
- [ ] App Business workflow works end-to-end
- [ ] Issues can be reported clearly
- [ ] First feedback loop is established

---

## Phase 16 — Post-Release Iteration

## Goal

Improve LOGOS Engine based on real usage without expanding scope prematurely.

## Tasks

- [ ] Review user feedback
- [ ] Fix onboarding friction
- [ ] Improve AI prompt quality
- [ ] Improve document completeness
- [ ] Improve diagnostics
- [ ] Improve profile authoring documentation
- [ ] Improve validation rules
- [ ] Improve generated document templates
- [ ] Identify next profile candidates
- [ ] Create candidate profile backlog
- [ ] Update roadmap
- [ ] Avoid premature platform expansion

## Acceptance Checklist

- [ ] User feedback is reflected in roadmap
- [ ] Most common workflow issues are addressed
- [ ] Profile gaps are identified
- [ ] Expansion decisions are explicit
- [ ] V2 direction is documented

---

## V1 Completion Checklist

V1 is complete only when all items below are true.

- [ ] User can install LOGOS Engine
- [ ] User can initialize a local workspace
- [ ] User can select the App Business profile
- [ ] User can answer guided questions
- [ ] User can receive AI-generated follow-up questions
- [ ] User can review AI-generated decision proposals
- [ ] User can confirm or reject proposed decisions
- [ ] User can generate canonical App Business documentation
- [ ] Generated documents include assumptions, gaps, risks, and next actions
- [ ] Generated documents are broad and complete enough to guide execution
- [ ] User can run validation
- [ ] User can run diagnostics
- [ ] User can regenerate documents safely
- [ ] User can inspect project state in `.logos/`
- [ ] User can commit the workspace to Git
- [ ] Tests do not require live model calls by default
- [ ] Provider coupling is avoided
- [ ] AI output is never silently treated as confirmed truth
