# Phased Tasks

## Purpose

This document translates `00_IMPLEMENTATION_ROADMAP.md` into actionable implementation checklists.

It must stay aligned with the current roadmap, especially the AI-first architecture decisions.

LOGOS Engine uses AI as the core conversational workflow layer for interrogation, synthesis, decision proposal, risk analysis, and document drafting. Therefore, task planning must include provider abstraction, prompt contracts, structured outputs, confirmation flows, AI safety, and mocked AI testing from the beginning.

Operational commands, state validation, and automated tests must remain useful without live model calls. The default implementation path should use explicit schemas, fixtures, and mocked AI providers first, with remote provider usage added behind configuration and clear user disclosure. The normal intake experience must not fall back to a deterministic questionnaire.

## Implementation Contracts

- [ ] Keep `DecisionStatus` separate from `AiOutputStatus`
- [ ] Keep deterministic validation separate from AI diagnostics
- [ ] Treat Markdown as rendered output, not source of truth
- [ ] Treat the App Business document tree as a profile contract
- [ ] Require user confirmation before AI proposals become confirmed decisions
- [ ] Ensure default tests do not call live models

## Related Documents

- `docs/09-implementation-roadmap/00_IMPLEMENTATION_ROADMAP.md`
- `docs/10-operational-playbooks/00_DEVELOPMENT_STANDARDS.md`
- `docs/07-ai-and-agent-behavior/00_AGENT_BEHAVIOR.md`
- `docs/07-ai-and-agent-behavior/01_PROMPTING_CONTRACT.md`
- `docs/07-ai-and-agent-behavior/02_LLM_INTEGRATION_STRATEGY.md`
- `profiles/app-business/documents.yml`
- `docs/05-profiles/app-business/documents.yml`

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
- [ ] Configure test coverage reporting if practical
- [ ] Add initial `src/` structure
- [ ] Add initial `tests/` structure
- [ ] Add initial `fixtures/` or test fixture convention
- [ ] Add development scripts
- [ ] Add package build script
- [ ] Add CLI smoke-test script
- [ ] Document local development setup
- [ ] Document AI-first engineering constraints
- [ ] Document prompt/context safety expectations
- [ ] Document default no-live-model test policy

## Acceptance Checklist

- [ ] Project installs cleanly
- [ ] Tests can run
- [ ] Lint/format commands exist
- [ ] Build command exists
- [ ] Documentation tree exists
- [ ] Development standards are committed
- [ ] Default test policy does not require network or live AI credentials
- [ ] Repository is ready for Phase 1

---

## Phase 1 — CLI and TUI Skeleton

## Goal

Create the executable command structure and initial TUI shell.

## Tasks

- [ ] Create CLI entrypoint
- [ ] Make `logos` open the TUI by default
- [ ] Add CLI help and version output
- [ ] Add slash command parser
- [ ] Add slash command autocomplete
- [ ] Implement `logos --help`
- [ ] Implement `/init` stub
- [ ] Implement `/status` stub
- [ ] Implement `/generate` stub
- [ ] Implement `/continue` stub
- [ ] Implement `/diagnose` stub
- [ ] Implement `/validate` stub
- [ ] Implement `/config ai` stub
- [ ] Implement `/help` stub
- [ ] Implement `/exit` stub
- [ ] Implement shared command context loader stub
- [ ] Implement common command error output
- [ ] Define exit code conventions
- [ ] Create basic TUI shell
- [ ] Establish command handler layer
- [ ] Establish application service boundary
- [ ] Add command help text for all V1 commands
- [ ] Add basic command routing tests

## Acceptance Checklist

- [ ] `logos` opens the TUI locally
- [ ] Help output is readable
- [ ] Core slash command stubs exist
- [ ] Slash command autocomplete works
- [ ] Commands return predictable exit codes
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
- [ ] Create `.logos/proposals/` directory or equivalent proposal store
- [ ] Write `.logos/project.json`
- [ ] Write `.logos/profile.lock.json`
- [ ] Write `.logos/answers.json`
- [ ] Write `.logos/decisions.json`
- [ ] Write `.logos/diagnostics.json` or define why diagnostics remain ephemeral
- [ ] Write `.logos/config.json` or equivalent local configuration file
- [ ] Create `docs/` folder
- [ ] Create initial docs subfolder structure
- [ ] Normalize App Business folder names to canonical tree
- [ ] Implement safe file write utility
- [ ] Implement atomic JSON write utility
- [ ] Implement schema validation on state read
- [ ] Prevent destructive overwrite during init
- [ ] Explain created files before or after init
- [ ] Add init tests
- [ ] Add repeated-init tests
- [ ] Add corrupted-state read tests

## Acceptance Checklist

- [ ] `/init` creates a valid workspace
- [ ] Existing workspace is detected safely
- [ ] Generated files are text-based and Git-friendly
- [ ] Profile lock is persisted
- [ ] Initial state files validate against schemas
- [ ] Canonical docs folder structure is created consistently
- [ ] Safe write behavior is tested

---

## Phase 3 — Profile Loader and App Business Profile Skeleton

## Goal

Implement the profile system and load the initial `app-business` profile.

## Tasks

- [ ] Define profile schema
- [ ] Define phase schema
- [ ] Define canonical document schema
- [ ] Define `documents.yml` schema
- [ ] Define question set schema
- [ ] Define validation rule schema stub
- [ ] Define risk pattern schema stub
- [ ] Define dependency mapping schema
- [ ] Define prompt context requirement schema
- [ ] Define profile versioning model
- [ ] Implement profile loader
- [ ] Implement profile validation
- [ ] Reject duplicate profile ids
- [ ] Reject duplicate phase ids
- [ ] Reject duplicate document ids
- [ ] Reject duplicate document output paths
- [ ] Reject missing template references
- [ ] Reject document definitions without completion criteria
- [ ] Add `app-business` profile metadata
- [ ] Add `app-business` phase definitions
- [ ] Add `app-business` `documents.yml` canonical document definitions
- [ ] Normalize `11-governance` as the governance phase folder
- [ ] Normalize `IMPLEMENTATION_PLAN.md` as the implementation planning document
- [ ] Add document structure metadata to each canonical document
- [ ] Add section metadata to each canonical document
- [ ] Add primary question metadata to each canonical document
- [ ] Add required input metadata to each canonical document
- [ ] Add generated output metadata to each canonical document
- [ ] Add document completion criteria metadata
- [ ] Add document dependency metadata
- [ ] Add `app-business` question set stubs
- [ ] Add `app-business` validation rule stubs
- [ ] Add `app-business` risk pattern stubs
- [ ] Add profile loader tests
- [ ] Add `documents.yml` schema tests
- [ ] Add invalid profile tests
- [ ] Add canonical tree consistency tests

## Acceptance Checklist

- [ ] App Business profile loads successfully
- [ ] Invalid profile fails with clear errors
- [ ] Canonical documents define structure, not just filenames
- [ ] Canonical documents are loaded from structured YAML
- [ ] Canonical folder and document names match the roadmap contract
- [ ] Profile version is available to workspace state
- [ ] Profile tests cover document contract metadata
- [ ] Invalid document references fail before runtime

---

## Phase 4 — LLM Provider Abstraction and AI Operation Contracts

## Goal

Introduce AI as a first-class system layer without coupling the product to one provider.

## Tasks

- [ ] Define `LlmProvider` interface
- [ ] Define provider configuration model
- [ ] Define provider capability metadata
- [ ] Define provider transmission disclosure metadata
- [ ] Define provider preset registry
- [ ] Define token source model
- [ ] Define secret redaction rules
- [ ] Implement mock provider
- [ ] Implement fixture response provider
- [ ] Implement OpenAI-compatible adapter
- [ ] Implement Anthropic-compatible adapter if included in V1
- [ ] Implement Ollama/local adapter if included in V1
- [ ] Define local provider configuration path where practical
- [ ] Define remote provider configuration path as opt-in
- [ ] Define `LOGOS_LLM_API_KEY` as generic default token environment variable
- [ ] Define provider-specific token env var aliases where useful
- [ ] Implement `.logos/config.json` AI config read/write without raw token persistence
- [ ] Implement optional global AI defaults config
- [ ] Implement token resolution from environment variables
- [ ] Define optional OS keychain integration boundary
- [ ] Add `/config ai` slash command or equivalent configuration flow
- [ ] Add `/config ai --test` or equivalent provider connectivity check
- [ ] Add `/config ai --show` with token redaction
- [ ] Define provider error model
- [ ] Define AI operation registry
- [ ] Define AI request schema
- [ ] Define AI response schema
- [ ] Define structured output validation utilities
- [ ] Define `AiOutputStatus` enum
- [ ] Define `AiOutputStatus` values: `draft`, `proposed`, `confirmed`, `rejected`, `needs_review`
- [ ] Define operation: `generate_follow_up_questions`
- [ ] Define operation: `summarize_answer`
- [ ] Define operation: `extract_decision_proposals`
- [ ] Define operation: `classify_assumptions`
- [ ] Define operation: `identify_gaps`
- [ ] Define operation: `identify_risks`
- [ ] Define operation: `draft_document_section`
- [ ] Define operation: `lead_intake_turn`
- [ ] Define operation: `recommend_next_conversation_move`
- [ ] Add tests for mock provider
- [ ] Add tests for fixture response provider
- [ ] Add tests for provider preset resolution
- [ ] Add tests for token environment variable resolution
- [ ] Add tests that raw tokens are not written to `.logos/config.json`
- [ ] Add tests for malformed AI response handling
- [ ] Add tests for provider failure handling
- [ ] Add tests proving default suite avoids live provider calls

## Acceptance Checklist

- [ ] All AI calls route through provider abstraction
- [ ] Mock provider supports deterministic tests
- [ ] Default tests do not require live AI credentials
- [ ] Remote provider usage is explicit and configurable
- [ ] User can configure endpoint, model, and token source
- [ ] Provider config can be displayed with secrets redacted
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
- [ ] Define prompt version metadata
- [ ] Define context selection rules
- [ ] Include profile context where required
- [ ] Include document contract context where required
- [ ] Include decision registry context where required
- [ ] Include open questions context where required
- [ ] Include assumption context where required
- [ ] Include validation findings context where required
- [ ] Exclude unrelated project files by default
- [ ] Add structured output instructions to prompts
- [ ] Add refusal and uncertainty handling instructions
- [ ] Add provider transmission disclosure metadata
- [ ] Add token/context budgeting utility if needed
- [ ] Add context preview or disclosure data structure
- [ ] Add prompt snapshot tests where practical
- [ ] Add context selection tests

## Acceptance Checklist

- [ ] Prompts are inspectable in code
- [ ] Prompt construction is tested
- [ ] Context inclusion is intentional and minimal
- [ ] User facts, assumptions, and AI proposals are separated
- [ ] Prompt version is inspectable
- [ ] Context sent to providers is explainable
- [ ] Output schema expectations are explicit
- [ ] Prompt changes are reviewable

---

## Phase 6 — AI-Led Conversational Intake

## Goal

Implement AI-led intake where normal user progress happens through conversation, not question ids or slash subcommands.

## Tasks

- [ ] Define question schema
- [ ] Define `questions.yml` schema
- [ ] Define conversation turn schema
- [ ] Add `helpText` support to questions
- [ ] Add examples support to questions
- [ ] Add choice option metadata to questions
- [ ] Define answer schema
- [ ] Define session schema
- [ ] Define open question schema
- [ ] Define assumption schema
- [ ] Implement answer store
- [ ] Implement session store
- [ ] Implement open question store or derived open question view
- [ ] Implement assumption tracking behavior
- [ ] Implement AI-led intake turn service
- [ ] Provide phase context to the intake AI operation
- [ ] Provide missing-decision context to the intake AI operation
- [ ] Implement maximum conversational question cluster size guard
- [ ] Implement skipped question handling
- [ ] Implement save-and-exit behavior
- [ ] Implement `/continue` as conversation resume
- [ ] Route non-slash TUI input to the conversational intake service
- [ ] Support `unknown` answers
- [ ] Support assumption-based answers
- [ ] Store raw user answers
- [ ] Store normalized answer summaries separately from raw answers
- [ ] Let AI use question help text when phrasing conversational prompts
- [ ] Let AI use question examples where present
- [ ] Let AI mention option lists naturally for choice and multi-choice decisions
- [ ] Use AI operation: `lead_intake_turn`
- [ ] Use AI operation: `generate_follow_up_questions`
- [ ] Use AI operation: `summarize_answer`
- [ ] Use AI operation: `recommend_next_conversation_move`
- [ ] Mark AI-generated follow-up questions as proposed
- [ ] Require user acceptance before AI follow-ups enter the active session
- [ ] Add tests with mocked AI responses
- [ ] Add tests for skipped, unknown, and assumed answers

## Acceptance Checklist

- [ ] User can complete foundation intake through conversation
- [ ] Answers are persisted
- [ ] Sessions can resume
- [ ] Unknown answers create open questions
- [ ] Assumption answers create assumptions
- [ ] Questions can guide users with examples without forcing an answer
- [ ] Choice questions display options clearly
- [ ] AI follow-up questions are proposed, not silently canonical
- [ ] User can save and resume an unfinished intake
- [ ] Question selection does not become infinite or uncontrolled

---

## Phase 7 — Decision Registry and AI Decision Proposal Flow

## Goal

Implement structured decisions as the source of truth and allow AI to propose decisions from user answers.

## Tasks

- [ ] Define decision schema
- [ ] Define `DecisionStatus` enum
- [ ] Define `DecisionStatus` values: `unknown`, `assumed`, `proposed`, `confirmed`, `deprecated`
- [ ] Define decision proposal schema
- [ ] Keep decision proposals modeled separately from confirmed decisions
- [ ] Implement decision store
- [ ] Implement decision status transitions
- [ ] Reject invalid decision status transitions
- [ ] Implement decision source tracking
- [ ] Link confirmed decisions to accepted proposal ids where applicable
- [ ] Preserve source answer references
- [ ] Implement AI operation: `extract_decision_proposals`
- [ ] Implement AI operation: `classify_assumptions`
- [ ] Add proposal review flow
- [ ] Add confirm proposal flow
- [ ] Add reject proposal flow
- [ ] Prevent AI proposals from becoming confirmed automatically
- [ ] Track decision changes
- [ ] Add decision revision or change metadata
- [ ] Identify affected documents on decision change
- [ ] Identify affected validation rules on decision change
- [ ] Add tests for confirmation-gated state changes
- [ ] Add tests for decision source tracking
- [ ] Add tests proving `DecisionStatus` and `AiOutputStatus` are not conflated

## Acceptance Checklist

- [ ] Decisions can be stored and updated
- [ ] Decision status is explicit
- [ ] Invalid decision transitions are rejected
- [ ] AI-extracted decisions enter as `proposed`
- [ ] User can confirm or reject proposals
- [ ] Confirmed decisions preserve source references
- [ ] Proposal review state does not silently become confirmed decision state
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
- [ ] Implement force render mode with explicit confirmation
- [ ] Implement manual notes preservation strategy
- [ ] Implement canonical App Business document tree generation
- [ ] Generate `IMPLEMENTATION_PLAN.md` as the canonical implementation roadmap output
- [ ] Generate `DECISION_LOG.md` from decision registry state
- [ ] Generate `ASSUMPTIONS.md` from assumption state
- [ ] Generate `OPEN_QUESTIONS.md` from unknown answers and unresolved gaps
- [ ] Implement AI operation: `draft_document_section`
- [ ] Pass document contract into AI drafting context
- [ ] Pass confirmed decisions into AI drafting context
- [ ] Pass assumptions and open questions into AI drafting context
- [ ] Pass validation findings into drafting context where useful
- [ ] Mark AI-drafted content as `draft` or `needs_review` where appropriate
- [ ] Report missing inputs per document
- [ ] Report document completion criteria status
- [ ] Report created, updated, skipped, and blocked files
- [ ] Add document rendering regression tests
- [ ] Add document snapshot tests
- [ ] Add manual notes preservation tests

## Acceptance Checklist

- [ ] `/generate` creates canonical App Business docs
- [ ] Documents include required sections
- [ ] Documents are broad and complete, not shallow summaries
- [ ] AI-drafted sections are clearly classified
- [ ] Manual sections are preserved where supported
- [ ] Incomplete documents report missing inputs
- [ ] Render output includes implementation planning content
- [ ] Render summary explains file actions
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
- [ ] Implement consistency validation
- [ ] Implement risk pattern validation
- [ ] Implement severity levels
- [ ] Implement `ValidationSeverity`: `info`, `warning`, `error`, `critical`
- [ ] Implement affected document reporting
- [ ] Implement affected decision reporting
- [ ] Implement `/validate`
- [ ] Implement `/validate --phase <phase>`
- [ ] Implement `/validate --all`
- [ ] Add App Business foundation rules
- [ ] Add App Business market rules
- [ ] Add App Business economics rules
- [ ] Add App Business product rules
- [ ] Add App Business architecture rules
- [ ] Add App Business GTM rules
- [ ] Add App Business operations rules
- [ ] Add App Business governance rules
- [ ] Add contradiction fixtures
- [ ] Add validation tests

## Acceptance Checklist

- [ ] Required decisions are enforced
- [ ] Dependency rules work
- [ ] Consistency rules flag contradictions
- [ ] Risk pattern rules flag known high-risk combinations
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
- [ ] Implement affected decision list
- [ ] Implement deterministic next action fallback
- [ ] Implement `/diagnose`
- [ ] Use AI operation: `identify_gaps`
- [ ] Use AI operation: `identify_risks`
- [ ] Use AI operation: `recommend_next_conversation_move`
- [ ] Mark AI diagnostics as advisory/proposed
- [ ] Show when diagnostics were generated without live AI
- [ ] Prevent diagnostics from mutating confirmed decisions
- [ ] Add malformed AI diagnostics handling
- [ ] Add mocked AI diagnostic tests
- [ ] Add diagnostics tests without live provider
- [ ] Add risk output tests

## Acceptance Checklist

- [ ] Diagnostics show critical, important, and optional gaps
- [ ] AI risk notes are clearly marked as advisory/proposed
- [ ] User receives next useful action
- [ ] Diagnostics remain useful without live AI
- [ ] Diagnostics do not mutate confirmed state
- [ ] Malformed AI diagnostics are handled safely

---

## Phase 11 — TUI Interaction Polish

## Goal

Make the AI-led workflow transparent, controlled, and usable.

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
- [ ] Add status screen or `/status` TUI output
- [ ] Add provider usage notice where relevant
- [ ] Add context disclosure screen where relevant
- [ ] Add no-provider / mocked-provider state messaging
- [ ] Improve error messages
- [ ] Improve destructive-action confirmations
- [ ] Add safe regeneration confirmation flow
- [ ] Add TUI flow tests where practical

## Acceptance Checklist

- [ ] User can distinguish AI conversational prompts from AI proposals
- [ ] User can distinguish proposed decisions from confirmed decisions
- [ ] Progress by phase is visible
- [ ] Diagnostics are readable
- [ ] Provider and context disclosure are visible before remote calls
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
- [ ] Complete all App Business risk pattern rules
- [ ] Complete all App Business dependency mappings
- [ ] Complete all App Business AI prompt context requirements
- [ ] Reconcile all document lists to the canonical output tree
- [ ] Reconcile `IMPLEMENTATION_PLAN.md` naming across implementation docs
- [ ] Reconcile `11-governance` naming across profile docs
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
- [ ] Add profile contract snapshot tests

## Acceptance Checklist

- [ ] App Business profile can produce every canonical document
- [ ] Canonical document names are consistent across documentation
- [ ] Each document follows its declared structure
- [ ] Each document has completion criteria
- [ ] Each document declares required inputs and generated outputs
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
- [ ] Test init → intake → status → validate → diagnose → generate
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
- [ ] Test no-provider configured behavior
- [ ] Test remote-provider disclosure behavior
- [ ] Test profile canonical tree generation
- [ ] Add regression suite
- [ ] Improve error messages based on E2E findings

## Acceptance Checklist

- [ ] Full workflow can run with mocked AI
- [ ] Operational workflow can run without live provider
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

## Phase 15 — Conversation Model and Legacy Intake Boundary

## Goal

Introduce conversation-first state and AI operation contracts while isolating the existing deterministic guided-intake implementation as legacy/internal support.

## Tasks

- [ ] Audit current `/continue` command flow and question-engine dependencies
- [ ] Document which guided-intake APIs remain internal during migration
- [ ] Define conversation turn schema
- [ ] Define conversation session schema or extend current intake session schema
- [ ] Add storage for conversation turns
- [ ] Add schema validation for conversation turn reads
- [ ] Add migration-safe read behavior for existing `.logos/sessions/`
- [ ] Add source ids linking turns to interpreted answers
- [ ] Add source ids linking turns to assumptions
- [ ] Add source ids linking turns to open questions
- [ ] Add source ids linking turns to decision proposals
- [ ] Define AI operation: `lead_intake_turn`
- [ ] Define AI operation: `recommend_next_conversation_move`
- [ ] Deprecate user-facing use of `recommend_next_question_group`
- [ ] Update prompt context to include conversation history
- [ ] Update prompt context to include profile coverage prompts
- [ ] Update prompt context to include missing document inputs
- [ ] Add mocked provider output for `lead_intake_turn`
- [ ] Add mocked provider output for `recommend_next_conversation_move`
- [ ] Add tests for conversation turn schema
- [ ] Add tests for conversation turn storage
- [ ] Add tests proving existing workspace state still reads safely

## Acceptance Checklist

- [ ] Conversation turns are persisted
- [ ] Conversation turns are schema-validated
- [ ] AI operation registry includes conversation-first operations
- [ ] Existing guided-intake state remains readable
- [ ] Deterministic question selection is no longer documented as the primary path
- [ ] Default tests do not call live providers

---

## Phase 16 — Conversational TUI Runtime

## Goal

Make ordinary TUI input advance the AI conversation while preserving slash commands for explicit system operations.

## Tasks

- [ ] Add TUI input router for slash command vs conversation input
- [ ] Route non-slash input to conversational intake service
- [ ] Keep slash command autocomplete for slash-prefixed input
- [ ] Change missing-slash command error into conversation handling
- [ ] Implement conversational intake application service
- [ ] Make `/continue` start or resume the conversation
- [ ] Remove user-facing `/continue answer <question-id>` hints
- [ ] Remove user-facing `/continue unknown <question-id>` hints
- [ ] Remove user-facing `/continue assume <question-id>` hints
- [ ] Remove user-facing `/continue skip <question-id>` hints
- [ ] Render user messages in the TUI history
- [ ] Render AI messages in the TUI history
- [ ] Show provider status before conversation calls
- [ ] Show no-provider setup guidance instead of deterministic questions
- [ ] Preserve `/init`, `/status`, `/validate`, `/diagnose`, `/generate`, `/config ai`, `/help`, and `/exit`
- [ ] Keep destructive `/generate --force` confirmation behavior
- [ ] Add tests for non-slash input
- [ ] Add tests for slash command input after router change
- [ ] Add tests for no-provider conversation state

## Acceptance Checklist

- [ ] Ordinary text input creates a conversation turn
- [ ] Slash commands still route through command handlers
- [ ] `/continue` resumes conversation without subcommands
- [ ] TUI does not ask users for question ids during normal intake
- [ ] No-provider state guides the user to configure AI
- [ ] TUI tests cover conversation and command paths

---

## Phase 17 — AI Interpretation, Proposals, and Confirmation

## Goal

Interpret AI-led conversation turns into structured answers, assumptions, open questions, and decision proposals without allowing AI to confirm decisions silently.

## Tasks

- [ ] Define interpreted conversation output schema
- [ ] Define proposal batch schema for conversation turns
- [ ] Implement conversation interpretation service
- [ ] Extract answer records from user conversation turns
- [ ] Extract decision proposals from interpreted turns
- [ ] Extract assumptions from interpreted turns
- [ ] Extract open questions from interpreted turns
- [ ] Preserve raw user text separately from normalized summaries
- [ ] Link answer records to conversation turn ids
- [ ] Link proposal records to conversation turn ids
- [ ] Link assumptions and open questions to conversation turn ids
- [ ] Add review flow for conversation-derived decision proposals
- [ ] Add confirmation flow for conversation-derived decision proposals
- [ ] Add rejection flow for conversation-derived decision proposals
- [ ] Prevent AI-generated proposals from becoming confirmed automatically
- [ ] Reject malformed interpretation output safely
- [ ] Handle provider failure without corrupting state
- [ ] Add tests for proposed decision extraction
- [ ] Add tests for assumption and unknown extraction
- [ ] Add tests for confirmation-gated state changes
- [ ] Add tests for malformed AI interpretation handling

## Acceptance Checklist

- [ ] Conversation turns produce structured interpreted records
- [ ] AI-generated decisions enter as `proposed`
- [ ] Confirmed decisions require explicit user confirmation
- [ ] Assumptions and unknowns remain separate from confirmed decisions
- [ ] Malformed AI output does not corrupt workspace state
- [ ] Traceability from conversation turn to generated state is tested

---

## Phase 18 — AI-Led Document Drafting and Regression Rebaseline

## Goal

Rebaseline document generation, diagnostics, examples, and regression tests around AI-led conversation.

## Tasks

- [ ] Update document drafting context to include conversation-derived state
- [ ] Update document drafting context to include confirmed decisions
- [ ] Update document drafting context to include assumptions and open questions
- [ ] Ensure generated documents cite or reference source turn ids where useful
- [ ] Ensure generated documents mark uncertain content clearly
- [ ] Update diagnostics to recommend next conversational moves
- [ ] Replace release-facing `/continue answer <question-id>` E2E tests
- [ ] Move legacy question-id tests to internal service coverage where still useful
- [ ] Add AI-led conversational E2E workflow test
- [ ] Add fixture AI conversation transcript
- [ ] Add fixture provider responses for complete conversation workflow
- [ ] Update example workspace guidance
- [ ] Update demo script to show AI-led conversation
- [ ] Update README usage examples for conversation-first flow
- [ ] Update good-first-issue docs that assume deterministic question UI
- [ ] Add regression test for no live provider calls
- [ ] Run full `pnpm check`

## Acceptance Checklist

- [ ] Full workflow can run with mocked or fixture AI conversation
- [ ] E2E tests no longer depend on user-facing question id commands
- [ ] Generated docs remain broad and auditable
- [ ] Diagnostics recommend conversational next steps
- [ ] Examples demonstrate AI-led intake
- [ ] `pnpm check` passes

---

## Phase 19 — Public Release

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

## Phase 20 — Post-Release Iteration

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
- [ ] User can complete AI-led conversational intake
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
- [ ] User can understand whether remote AI is configured
- [ ] User can see what context would be sent to a remote provider
- [ ] User can commit the workspace to Git
- [ ] Tests do not require live model calls by default
- [ ] Provider coupling is avoided
- [ ] Decision status and AI output status remain separate
- [ ] AI output is never silently treated as confirmed truth
