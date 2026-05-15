# Engineering Brief

## Engineering Objective

Engineering must deliver a local-first, repository-oriented TUI product that turns AI-led clarification into structured project state, user-reviewed decisions, deterministic validation, canonical Markdown documentation, and derived HTML artifacts and agent packs.

The engineering objective is to make the LOGOS Engine MVP technically trustworthy enough that a user can run `logos` from a target repository, initialize or resume a workspace, configure AI explicitly, conduct bounded intake, review proposed decisions, generate outputs under the configured LOGOS documentation root, diagnose gaps, and continue later without silent data loss, hidden remote transmission, or false authority.

Engineering success is not product-market validation. The Validation Report states that LOGOS Engine is not yet externally validated. Engineering work can prove that the product can be built safely and coherently; it cannot prove that users want it, will adopt it, or will pay for it.

Engineering success means:

- the repository-local workflow works end to end;
- profile YAML contracts drive phases, document contracts, validations, Markdown outputs, HTML artifacts, and agent packs;
- structured local state is the durable source of project truth;
- generated Markdown is the canonical human-readable projection;
- derived HTML artifacts and agent packs remain regenerable, labeled, and non-canonical;
- AI assistance is provider-agnostic, explicit, bounded, and reviewable;
- deterministic validation remains usable without live AI;
- file writes, provider transmission, root changes, and overwrites require clear user intent;
- the default LOGOS documentation root is `logos/`, and it is configurable;
- release gates can be verified without live AI provider calls, network access, or raw tokens in fixtures.

Engineering failure means:

- chat transcripts become the only memory of decisions;
- AI output silently confirms decisions;
- generated documents hide assumptions, unsupported claims, or validation gaps;
- project context is sent to a remote provider without explicit configuration and disclosure;
- raw provider tokens are written to project files;
- generation writes to the wrong root or overwrites user work without confirmation;
- deterministic diagnostics or validation depend on live AI;
- the implementation drifts into hosted SaaS, project management, marketplace, or autonomous execution scope.

## Product Inputs

| Source | Product Decision or Requirement | Engineering Implication | Status |
| --- | --- | --- | --- |
| Foundation Boundaries | LOGOS is local-first, user-owned, and not a hosted SaaS by default. | Build filesystem-first storage and avoid cloud accounts, sync, telemetry, hosted identity, and server-side authorization in MVP. | committed |
| Product Scope SC-001 | LOGOS runs from the target repository directory. | The runtime must resolve the active repository, show it to the user, and scope workspace state and generated output to that directory. | committed |
| Product Scope SC-002 | The default LOGOS documentation root is `logos/`, configurable per workspace. | Path handling, generation, reports, root configuration, and overwrite protection must resolve against a configurable root. | committed |
| Product Scope SC-003 | The Standard profile is the initial document contract. | Engineering must load profile YAML, validate it, and use it to drive intake coverage, document contracts, outputs, quality checks, and validation. | committed |
| Product Scope SC-004 | Normal clarification is AI-led conversation. | The TUI must route non-slash text to conversational intake and support provider-backed interpretation without deterministic question-id UX. | committed / validation-required |
| Product Scope SC-005 | AI provider configuration is explicit and supports local and remote modes where available. | Provider abstraction, redacted status, transmission disclosure, token-source rules, and no-provider recovery are required. | committed |
| Product Scope SC-006 | Structured project state carries answers, summaries, decisions, assumptions, risks, and document status. | State schemas, migrations, safe writes, corruption handling, and traceability must be treated as core architecture. | committed |
| Product Scope SC-007 | AI-derived decisions remain proposed until user review. | State transitions must prevent proposed material from becoming confirmed without explicit user action. | committed |
| Product Scope SC-008 | Markdown is generated under the configured root from state and profile contracts. | Rendering must be deterministic, traceable, safe to regenerate, and clear about stale or incomplete outputs. | committed |
| Product Scope SC-009 | HTML artifacts are generated as derived outputs. | Artifact generation must be downstream of canonical Markdown and profile contracts, with stale/failed status. | committed / supporting |
| Product Scope SC-010 | Agent packs are generated as derived downstream context. | Agent pack generation must preserve caveats, dependencies, and source traceability without becoming canonical. | committed / supporting / validation-required |
| Functional Requirements | Slash commands include `/init`, `/continue`, `/generate`, `/diagnose`, `/validate`, `/status`, `/config ai`, `/help`, and `/exit`. | Command routing, help, error handling, and observable command outcomes are MVP surface requirements. | committed |
| Non-Functional Requirements | TUI startup, status, generation feedback, keyboard operation, privacy, token safety, and reliability have release impact. | Engineering must define measurable quality gates and failure-path tests, not only happy-path implementation. | committed / some thresholds provisional |
| Product Stack | Node.js >=22, TypeScript, Ink, React, Commander entrypoint, filesystem storage, Zod, YAML, Markdown, and provider abstraction are product-level commitments. | Detailed architecture can choose structure, but it must stay within these committed stack constraints unless explicitly changed. | committed |
| Acceptance Criteria | `pnpm check` or equivalent quality gate must pass without live AI, network, or raw tokens. | Tests must use mocked or fixture providers and cover state transitions, provider failure, validation, generation, and permissions. | committed |
| Validation Report | No external validation exists yet. | Engineering must avoid building scale, marketplace, hosted collaboration, pricing, or GTM infrastructure as if demand were proven. | committed constraint |

Product inputs requiring engineering clarification:

- the exact internal workspace state location and file layout;
- state schema versioning and migration policy;
- manual edit detection strategy for generated Markdown;
- HTML artifact generation implementation;
- agent pack format stability;
- cross-platform secret storage strategy;
- minimum supported Node.js version enforcement;
- screen reader feasibility for Ink-based TUI;
- acceptable local provider failure and timeout behavior;
- whether generation can be partial by default or should block on severity thresholds.

## Technical Scope

### MVP Technical Scope

| Area | Technical Responsibility | Source | Target Document |
| --- | --- | --- | --- |
| TUI runtime | Open `logos` in the current repository, render the shell, route input, show status, and support all MVP slash commands. | Product Stack, FR-001, FR-016 | Frontend Architecture, API Contracts |
| Workspace lifecycle | Initialize, detect, resume, validate, and recover local LOGOS workspace state. | SC-002, FR-002, FR-003 | System Architecture, Data Model |
| Documentation root handling | Default to `logos/`, allow configuration, validate paths, and prevent unsafe writes. | SC-001, SC-002, FR-004 | System Architecture, Security Architecture |
| Profile loading | Load and validate Standard profile YAML contracts, document schemas, phase definitions, outputs, and quality rules. | SC-003, FR-005 | System Architecture, Data Model |
| Structured state | Persist decisions, assumptions, open questions, risks, diagnostics, validation gaps, output status, and generation reports. | SC-006, FR-007 | Data Model |
| AI provider layer | Support provider configuration, redacted status, local/remote mode, disclosure, timeout, failure, and structured response validation. | SC-005, FR-017, NFR-PERF-002 | API Contracts, Integration Architecture, Security Architecture |
| Conversational intake | Support AI-led question clusters, unknown answers, assume-for-now answers, low-confidence labels, and proposal creation. | SC-004, FR-006, FR-024, FR-025 | System Architecture, API Contracts |
| Decision review | Enforce proposed, confirmed, rejected, deferred, revised, and superseded decision states. | SC-007, FR-008, FR-021 | Data Model, API Contracts |
| Validation and diagnostics | Run deterministic checks without live AI, report severity, affected documents, unsupported claims, and next actions. | SC-011, FR-012, FR-013 | Test Strategy, System Architecture |
| Markdown generation | Render canonical Markdown from profile contracts and structured state under configured root. | SC-008, FR-009 | System Architecture, Data Model |
| Derived outputs | Generate HTML artifacts and agent packs from canonical content and mark them as derived. | SC-009, SC-010, FR-010, FR-011 | System Architecture, Integration Architecture |
| Permission and recovery | Confirm writes, overwrites, root changes, and remote transmission; preserve state on interruption. | FR-018, FR-020, FR-022, FR-023 | Security Architecture, API Contracts |
| Quality gates | Provide automated and observable verification for release-blocking acceptance criteria. | Acceptance Criteria | Test Strategy, Release Management |

### Post-MVP or Deferred Scope

| Area | Classification | Rationale |
| --- | --- | --- |
| Hosted web dashboard | deferred / excluded from MVP | Requires hosted infrastructure and may weaken local-first source-of-truth model. |
| Multi-user collaboration | excluded from MVP | No accounts, comments, roles, shared workspaces, or cloud sync are in current scope. |
| Profile marketplace or broad profile authoring UI | deferred | The Standard profile must prove value before profile ecosystem work. |
| Programmatic API or batch mode | deferred | Risks bypassing conversation, review, and consent gates. |
| Native Windows terminal support outside WSL | excluded for MVP | Product Stack commits to macOS, Linux, and Windows via WSL first. |
| External research automation | excluded | LOGOS must not claim market, legal, or competitive research automation. |
| Telemetry or analytics platform | excluded | Privacy requirements prohibit telemetry by default. |
| Database-backed storage | excluded unless re-scoped | Filesystem-only JSON, Markdown, and YAML storage is the committed stack direction. |
| Authentication and authorization services | excluded | No hosted accounts or multi-user model exist in MVP. |

### Review-Needed Scope

- Whether local debug logs are included in MVP and how they avoid sensitive context.
- Whether OS credential store support is MVP or env-var-first with credential store deferred.
- Whether output browsing is MVP or a generation-report affordance.
- Whether generated HTML artifacts require a dedicated renderer or a constrained Markdown-to-HTML pipeline.
- Whether manual edit conflict detection uses checksums, metadata, diff prompts, or overwrite-only confirmation.

## Architecture Direction

The preliminary architecture direction is a local, modular TypeScript application with a TUI shell, command router, profile loader, structured state layer, AI provider abstraction, validation engine, diagnostics engine, document renderer, derived-output renderer, and filesystem adapter.

This direction is intentionally high-level. Detailed system design belongs in System Architecture, Data Model, API Contracts, Security Architecture, Frontend Architecture, Infrastructure Architecture, Integration Architecture, and Test Strategy.

### Major Architectural Boundaries

| Boundary | Direction | Why It Matters |
| --- | --- | --- |
| TUI vs domain actions | The TUI routes user input and renders state; domain services own state transitions, validation, generation, and permissions. | Prevents UI shortcuts from bypassing confirmation and safety rules. |
| Conversation vs structured state | Conversation is input; structured state is durable truth. | Prevents chat transcript dependency and enables regeneration. |
| AI provider vs AI interpretation | Provider calls return candidate output; interpretation must be schema-validated and reviewed before state mutation. | Protects against malformed provider output and false authority. |
| Profile contract vs project content | Profile YAML defines document shape; project state defines project truth. | Prevents profiles from becoming strategy generators. |
| Deterministic validation vs AI diagnostics | Deterministic validators produce rule-based findings; AI may explain or advise separately. | Keeps validation reliable without live AI. |
| Canonical Markdown vs derived outputs | Markdown is the canonical human-readable projection; HTML artifacts and agent packs are derived. | Prevents stale artifacts from becoming source truth. |
| Internal workspace state vs documentation root | Internal state and generated documentation are separate product concepts; default generated root is `logos/`. | Prevents user confusion and accidental deletion or overwrite. |
| Local storage vs remote provider | Local files remain default; remote calls happen only through explicit provider configuration and disclosure. | Protects privacy and trust. |
| MVP local product vs hosted platform | No server-side accounts, permissions, sync, telemetry, or hosted collaboration in MVP. | Keeps architecture aligned with validation state and product boundaries. |

### Constrained Decisions

- Runtime: Node.js >=22.
- Language: TypeScript.
- Primary client: Ink-based TUI.
- Entrypoint parsing: Commander only before handing off to TUI.
- State/output formats: JSON, YAML, Markdown, and derived HTML/Markdown agent packs.
- Profile contracts: YAML validated by schemas.
- Validation: deterministic rules must run without live AI.
- AI provider layer: provider-agnostic abstraction with local and remote modes.
- Storage: filesystem-only for MVP.

### Decisions for Downstream Architecture

- exact module boundaries and dependency direction;
- internal workspace file layout;
- state schemas and migration format;
- command/action result contracts;
- provider abstraction request/response schemas;
- prompt/context assembly limits;
- renderer pipeline and overwrite protection;
- artifact and agent pack generation strategy;
- local debug logging policy;
- error taxonomy and recovery contracts;
- terminal layout and keyboard focus architecture.

## Engineering Constraints

| Constraint | Type | Classification | Engineering Impact | Target Document |
| --- | --- | --- | --- | --- |
| Local-first operation | product / privacy | hard | No hidden remote storage, telemetry, hosted dependency, or cloud sync in MVP. | Security Architecture, Infrastructure Architecture |
| Repository-directory execution | platform | hard | All workspace resolution and output paths must be scoped to the current target repository. | System Architecture |
| Configurable `logos/` default root | product / filesystem | hard | Path resolution, generation, root configuration, and reports must use configurable root semantics. | System Architecture, Data Model |
| User-confirmed decisions | product / safety | hard | State transition APIs must require explicit confirmation for canonical decisions. | Data Model, API Contracts |
| Explicit remote provider disclosure | privacy / security | hard | Remote calls need disclosure, provider status, and inspectable context boundaries. | Security Architecture, Integration Architecture |
| No raw tokens in project files | security | hard | Token sources must use env vars or validated credential-store strategy; all displays redact secrets. | Security Architecture |
| No live AI in default tests | testing | hard | Test providers, fixtures, and mocks are required for CI and release gates. | Test Strategy |
| No default telemetry | privacy / operations | hard | Observability must be local and user-inspectable, not analytics-driven. | Observability Plan |
| Keyboard-first TUI | accessibility | hard | All critical actions require keyboard paths and visible focus behavior. | Frontend Architecture |
| Text labels for state | accessibility | hard | Color cannot be the only carrier for proposed, confirmed, stale, failed, canonical, or derived states. | Frontend Architecture, Design System |
| Cross-platform target | compatibility | committed | macOS, Linux, and WSL path, terminal, and filesystem behavior must be tested. | Test Strategy, Deployment Plan |
| English-only MVP | i18n | committed | Templates, commands, and system text can be English-only, but UTF-8 user content must be supported. | Frontend Architecture, Data Model |
| No compliance claims | legal / trust | hard | Docs, UI, and generated artifacts must not imply GDPR, SOC2, CCPA, or legal compliance. | Security Architecture, Operations |
| Founder-origin validation basis | validation | hard | UX, docs, and release notes must avoid market-demand, pricing, or adoption claims. | Release Management, GTM handoff |

Known resource constraints are not yet documented beyond founder-led execution. Engineering planning should assume limited capacity and prefer risk-reducing vertical slices over broad parallel architecture work.

## Core Technical Capabilities

| ID | Capability | Category | Scope | Product Source | Technical Responsibility | Acceptance Mapping | Target Document | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ENG-CAP-001 | TUI shell and command router | frontend / interaction | MVP | FR-001, FR-016 | Render shell, route slash commands, route non-slash input to intake. | AC-FN-001, AC-FN-004, AC-FN-005 | Frontend Architecture, API Contracts | committed |
| ENG-CAP-002 | Workspace initialization and resume | state / filesystem | MVP | FR-002, FR-003, FR-014 | Detect, initialize, resume, and recover local workspace state idempotently. | AC-FN-002, AC-FN-013 | System Architecture, Data Model | committed |
| ENG-CAP-003 | Documentation root resolution | filesystem / permissions | MVP | FR-004, FR-023 | Default to `logos/`, allow configuration, validate safety, report active root. | AC-FN-003, AC-FN-020 | System Architecture, Security Architecture | committed |
| ENG-CAP-004 | Profile contract loading | profile / schema | MVP | FR-005 | Load, validate, and expose Standard profile contracts and output definitions. | AC-FN-025 | System Architecture, Data Model | committed |
| ENG-CAP-005 | Structured state persistence | data | MVP | FR-007, FR-020 | Store decisions, assumptions, questions, risks, diagnostics, validation gaps, and output status. | AC-FN-007 | Data Model | committed |
| ENG-CAP-006 | AI provider abstraction | integration / security | MVP | FR-017, FR-018 | Configure providers, enforce token rules, disclose remote transmission, handle timeout/failure. | AC-FN-015, AC-FN-016, AC-NF-PRIV-002 | Integration Architecture, Security Architecture | committed |
| ENG-CAP-007 | Conversational intake pipeline | AI / interaction | MVP / validation-required | FR-006, FR-046 | Build prompt/context flow, question clusters, response interpretation, and fallback behavior. | AC-FN-006, AC-UX-002 | System Architecture, API Contracts | committed |
| ENG-CAP-008 | Proposal and decision state machine | data / safety | MVP | FR-008, FR-021, FR-043 | Enforce proposed, confirmed, revised, rejected, deferred, and superseded transitions. | AC-FN-008, AC-FN-018, AC-FN-029, AC-FN-030 | Data Model, API Contracts | committed |
| ENG-CAP-009 | Deterministic validation engine | validation | MVP | FR-013, NFR-REL-006 | Run profile/state checks without AI and report validation gaps. | AC-FN-012 | System Architecture, Test Strategy | committed |
| ENG-CAP-010 | Diagnostics engine | validation / UX | MVP | FR-012, FR-026 | Group findings by severity and affected object with next-action recommendations. | AC-FN-011, AC-UX-006 | System Architecture, Test Strategy | committed |
| ENG-CAP-011 | Markdown renderer | generation | MVP | FR-009 | Render canonical Markdown from state and profile contracts under configured root. | AC-FN-009 | System Architecture, Data Model | committed |
| ENG-CAP-012 | Derived artifact generation | generation | MVP support | FR-010, FR-027 | Generate HTML artifacts from canonical content and mark derived status. | AC-FN-010, AC-UI-012 | System Architecture, Frontend Architecture | committed / implementation review-needed |
| ENG-CAP-013 | Agent pack generation | generation / agent context | MVP support / validation-required | FR-011, FR-027 | Generate compact downstream agent packs with caveats and source traceability. | AC-FN-010 | Integration Architecture | committed / format review-needed |
| ENG-CAP-014 | Generation report and stale tracking | generation / observability | MVP | FR-019, FR-027 | Report created, updated, skipped, incomplete, blocked, failed, stale, canonical, and derived outputs. | AC-FN-017, AC-FN-031 | Data Model, API Contracts | committed |
| ENG-CAP-015 | Permissioned writes and overwrite protection | security / reliability | MVP | FR-022, FR-031, NFR-SEC-004 | Require confirmations and detect or warn about unsafe writes and manual edits. | AC-FN-019, AC-FN-022, AC-UX-010 | Security Architecture | committed |
| ENG-CAP-016 | No-provider and failure recovery | reliability | MVP | FR-030, FR-042 | Preserve state and offer retry, reconfigure, or continue without AI. | AC-FN-021, AC-UX-011 | System Architecture, API Contracts | committed |
| ENG-CAP-017 | Release-quality test harness | testing | MVP | Acceptance Criteria | Run deterministic tests, mocked providers, lint, typecheck, build, smoke checks. | Gate 1 | Test Strategy, Release Management | committed |

## Cross-Cutting Concerns

| Concern | Applies To | Required Engineering Treatment | Risk if Fragmented | Target Document |
| --- | --- | --- | --- | --- |
| State integrity | workspace, AI, decisions, generation, validation | Centralize state transitions, schema validation, safe writes, and migration policy. | Corruption, stale docs, unrecoverable sessions. | Data Model |
| Permission and consent | provider calls, file writes, root changes, overwrites | Use consistent confirmation and disclosure patterns across commands and conversation. | Trust loss, privacy breach, accidental overwrite. | Security Architecture, API Contracts |
| Privacy | AI context, logs, telemetry, file reads | Minimize context, prohibit default telemetry, avoid unrelated source ingestion, disclose transmission. | Hidden data movement and boundary violations. | Security Architecture |
| Secret handling | provider config, status, logs, fixtures | Never store raw tokens in project files; redact displays and logs. | Credential leak and release blocker. | Security Architecture |
| Validation separation | diagnostics, intake, generation, reports | Keep deterministic validation independent from AI-generated advice. | False confidence and untestable readiness claims. | Test Strategy, System Architecture |
| Error handling | TUI, provider, filesystem, profile, renderer | Define error taxonomy, preserved state, next safe action, and retry behavior. | User cannot recover or trust state. | API Contracts |
| Observability | generation, decisions, validation, failures | Provide local audit trails and reports without telemetry or sensitive logs. | Debugging depends on hidden or unsafe logs. | Observability Plan |
| Accessibility | TUI, HTML artifacts, status states | Ensure keyboard operation, text labels, focus behavior, readable HTML structure. | Critical actions become inaccessible or ambiguous. | Frontend Architecture, Design System |
| Compatibility | macOS, Linux, WSL, Node, terminal emulators | Test path handling, terminal layout, ANSI rendering, Node version, and permissions. | MVP works only on founder machine. | Test Strategy, Deployment Plan |
| Supportability | install, provider setup, generation errors | Produce actionable error messages and support diagnostics without leaking sensitive context. | Support burden grows faster than validation learning. | Support Model |
| Scope governance | all modules | Keep deferred and excluded work out of MVP implementation. | Engineering builds unvalidated platform surface. | Release Management, Risk Management |

## Initial Implementation Strategy

The first engineering iteration should reduce the largest trust and feasibility risks before polishing secondary surfaces. Build order should preserve the local-first core, prove state integrity, and avoid dependence on live AI for default verification.

### Recommended Build Slices

| Slice | Build Focus | Dependencies | Validation Gate | Why First |
| --- | --- | --- | --- | --- |
| 1 | Entrypoint, TUI shell, command router, `/help`, `/status` skeleton | Node, Ink, Commander | TUI opens from repo; slash vs non-slash routing works. | Establishes the user surface and command model. |
| 2 | Workspace initialization, repository detection, configured root defaulting to `logos/` | Slice 1 | `/init` is idempotent; active repo/root/profile visible. | Locks path safety and local-first behavior early. |
| 3 | Profile loading and schema validation | Slice 2 | Standard profile loads; invalid profile blocks clearly. | Everything downstream depends on profile contracts. |
| 4 | Structured state model and decision state machine | Slice 2, Slice 3 | Proposed decisions cannot become confirmed without explicit action. | Protects source-of-truth and AI boundary. |
| 5 | Deterministic validation and diagnostics baseline | Slice 3, Slice 4 | Validation runs without AI and reports severity/affected object. | Creates a useful no-provider core. |
| 6 | Mock/fixture AI provider and conversational intake pipeline | Slice 3, Slice 4 | Fixture conversation produces proposed state only. | Tests AI workflow safely before live providers. |
| 7 | Provider configuration and remote/local provider adapters | Slice 6 | Timeout, disclosure, no-token-storage, and failure recovery verified. | Adds real AI after safety boundaries exist. |
| 8 | Canonical Markdown renderer and generation report | Slice 3, Slice 4, Slice 5 | Markdown writes under configured root with confirmation and report. | Delivers core output value. |
| 9 | Derived HTML artifact and agent pack generation | Slice 8 | Derived outputs are generated, labeled, and traceable. | Completes profile-defined output model. |
| 10 | Recovery, stale output tracking, manual edit protection | Slice 4, Slice 8, Slice 9 | Revised state marks affected outputs stale; overwrite warnings work. | Hardens repeat use and trust. |
| 11 | Cross-platform, accessibility, and release gates | all prior slices | `pnpm check`, smoke tests, keyboard checks, no network/default telemetry checks. | Converts prototype into release candidate. |

### Parallelizable Work

- Profile schema validation and fixture profile tests can proceed alongside TUI shell work after the contract is stable.
- Data model drafting can proceed alongside command routing, as long as state mutation APIs are not bypassed.
- Test fixtures and mocked provider harness should be built before live provider adapters.
- HTML artifact and agent pack format review can proceed once canonical renderer contracts are known.
- Accessibility review can begin with early TUI shells and continue through every UI slice.

### Work That Must Wait

- Hosted collaboration, profile marketplace, telemetry, accounts, and database storage must wait for explicit scope change.
- Live provider integrations should wait until mocked provider flows and state validation are stable.
- Batch/programmatic API should wait until command/action contracts prove stable through TUI use.
- Detailed infrastructure planning should remain minimal because there is no hosted MVP service.

### Quality Gates Between Slices

- No slice may store raw provider tokens in project files.
- No state-changing AI output may bypass schema validation and user review.
- No generation slice may write outside the configured root.
- No default test may require live AI, network, or private tokens.
- No release candidate may pass without lint, typecheck, tests, build, Markdown lint for generated/canonical docs where applicable, and smoke workflow evidence.

## Engineering Risks

| Risk | Category | Affected Scope | Likelihood | Impact | Early Signal | Mitigation | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| State corruption or schema drift breaks trust. | data / reliability | workspace, decisions, generation | medium | high | Sessions cannot resume; generated docs contradict status. | Version state schemas, validate writes, add fixture migrations and corruption diagnostics. | Data Model | release-blocking |
| AI output mutates state incorrectly. | AI / safety | intake, decisions | high | high | Proposed decisions appear confirmed or malformed output changes state. | Validate AI output with schemas; require explicit transition APIs. | API Contracts, Test Strategy | release-blocking |
| Remote provider use violates privacy expectations. | privacy / integration | AI provider layer | medium | high | First remote call happens before disclosure; context preview missing. | Explicit provider config, transmission disclosure, context minimization, tests. | Security Architecture | release-blocking |
| Token handling leaks secrets. | security | provider config, logs, fixtures | medium | high | Token appears in project files, status, logs, or fixtures. | Env/credential-store sources, redaction, secret scanning, fixture policy. | Security Architecture | release-blocking |
| Filesystem writes overwrite user work. | reliability / filesystem | generation, root config | medium | high | Regeneration replaces manual edits without warning. | Safe writes, metadata/checksums or explicit overwrite prompts, generation reports. | System Architecture | release-blocking if destructive |
| `docs/` and `logos/` root concepts regress. | product / path | workspace, generation | medium | high | Code defaults to `docs/` for user outputs or hides active root. | Centralize root resolution and test default/configured paths. | System Architecture | release-blocking |
| Deterministic validation depends on AI. | testability / validation | diagnostics, validation | medium | high | `/validate` fails without provider. | Keep validators pure and provider-independent; mock AI only for advisory diagnosis. | Test Strategy | release-blocking |
| TUI accessibility is weaker than expected. | accessibility / frontend | all TUI screens | medium | medium | Keyboard traps, focus jumps, state shown only by color. | Keyboard-first tests, text labels, compact layout review, accepted-risk record for screen reader gaps. | Frontend Architecture | release-blocking for critical actions |
| Cross-platform path and terminal behavior diverge. | compatibility | macOS, Linux, WSL | medium | medium | Tests pass only on one OS; path separators or ANSI rendering fail. | Platform abstraction, CI matrix where feasible, WSL smoke guidance. | Test Strategy, Deployment Plan | feature-blocking / release-risk |
| Product stack decisions are over-specified too early. | architecture | system design | low | medium | Engineering brief becomes detailed architecture. | Route detailed decisions to downstream docs and mark unknowns. | System Architecture | monitor |
| Derived artifacts become stale or treated as canonical. | generation / product trust | HTML, agent packs | medium | medium | Users edit HTML/packs or downstream agents cite stale context. | Derived labels, stale markers, regeneration metadata, source links. | Data Model, Integration Architecture | degrade gracefully |
| Validation caveats disappear from generated docs. | content / trust | generation, diagnostics | medium | high | Founder assumptions read as externally validated facts. | Preserve evidence labels and unsupported-claim warnings in renderers. | Test Strategy | release-blocking for false claims |
| Implementation exceeds unvalidated product scope. | scope / delivery | all modules | medium | high | Work starts on accounts, marketplace, hosted dashboard, telemetry, or task boards. | Scope guard in roadmap, acceptance criteria, and release review. | Release Management | release-blocking if included by default |

## Deferred Technical Decisions

| Decision | Reason Deferred | Information Needed | Revisit Trigger | Risk of Deferral | Blocked Work | Allowed Work | Target Engineering Document | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Internal workspace file layout | Product documents define objects, not exact storage structure. | Data model, migration needs, corruption recovery requirements. | Data Model drafting. | Poor early layout may require migration. | Final state schema and migrations. | Workspace abstraction and fixture examples. | Data Model | deferred |
| State migration/versioning strategy | No existing user state scale yet. | Expected schema evolution and compatibility policy. | First breaking state schema change. | Existing workspaces could become unreadable. | Release-ready state compatibility. | Include schema version fields from the start. | Data Model, Release Management | deferred |
| Manual edit conflict strategy | Product requires safety but not exact mechanism. | Renderer metadata approach, checksum feasibility, UX prompts. | Markdown renderer design. | Regeneration may be unsafe or overly blocked. | Final overwrite policy. | Conservative confirmation and generation reports. | System Architecture, API Contracts | review-needed |
| HTML artifact renderer | Product commits to derived HTML but not library or template engine. | Accessibility needs, style constraints, Markdown conversion needs. | Artifact generation slice. | Derived artifacts may lag or be inconsistent. | Final artifact pipeline. | Define artifact contract and stale status. | Frontend Architecture, System Architecture | deferred |
| Agent pack format | Product commits to agent packs but usefulness is validation-required. | Downstream agent needs and review prompt structure. | First agent-pack review loop. | Packs may be too broad or misleading. | Stable agent pack schema. | Generate minimal caveat-preserving Markdown packs. | Integration Architecture | deferred |
| OS credential store support | Preferred but cross-platform implementation risk exists. | Library evaluation, UX flow, WSL behavior. | Provider configuration architecture. | Env-var-only UX may be less friendly; credential store may be brittle. | Persistent secure token storage. | Env var token source and redacted status. | Security Architecture | review-needed |
| Local debug logging | Helpful for support but privacy-sensitive. | Support needs, log redaction design, user opt-in model. | Support Model drafting or first difficult support issue. | Harder debugging without logs; unsafe logs if rushed. | Default debug logs. | Local generation reports and diagnostics. | Observability Plan | deferred |
| CI/platform matrix | Product targets macOS, Linux, WSL but capacity may be limited. | Build infrastructure and release capacity. | Release candidate planning. | Platform regressions may be missed. | Full release confidence. | Local smoke scripts and documented manual checks. | Test Strategy, Deployment Plan | review-needed |
| Streaming provider responses | Product needs responsiveness, not necessarily streaming. | Provider adapter complexity and TUI behavior. | Intake latency proves unacceptable. | Non-streaming calls may feel slow. | Streaming UX. | Pending states, timeout, retry, cancellation if feasible. | Integration Architecture, Frontend Architecture | deferred |
| Search/retrieval across LOGOS content | Deferred product capability. | User evidence that status/diagnostics/output reports are insufficient. | Post-MVP usage evidence. | None for MVP if status remains useful. | Search UI/indexing. | Direct status and output browsing. | System Architecture | deferred |

## Engineering Success Criteria

| Criterion | Category | Source | Verification Method | Evidence Required | Release Impact | Owner / Reviewer | Target Document | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Running `logos` from a target repository opens the TUI and shows repository, root, profile, and provider orientation. | functional / UX | AC-FN-001, AC-UI-002 | observable test | Smoke workflow recording or checklist. | release-blocking | founder/user | Test Strategy | draft |
| `/init` is idempotent and never destroys existing state without explicit confirmation. | reliability | AC-FN-002, NFR-REL-003 | automated + observable test | Init/re-init test fixtures. | release-blocking | engineering | Test Strategy | draft |
| The default documentation root is `logos/`, configurable before generation, and visible before writes. | filesystem / permission | AC-FN-003, AC-UX-010 | inspection + observable test | Root config fixture and generation confirmation. | release-blocking | founder/user | System Architecture | draft |
| Profile YAML contracts load, validate, and drive document/output expectations. | profile / schema | FR-005, AC-FN-025 | automated test | Valid/invalid profile fixtures. | feature-blocking | engineering | System Architecture | draft |
| AI-led intake works with fixture providers and creates proposed state only. | AI / safety | FR-006, AC-FN-006, AC-FN-008 | automated + prototype evidence | Fixture conversation and state transition tests. | release-blocking | founder/user | API Contracts | draft |
| Remote provider calls require explicit configuration and disclosure before context leaves the machine. | privacy | AC-FN-016, AC-NF-PRIV-002 | observable test | Provider setup flow evidence. | release-blocking | founder/user | Security Architecture | draft |
| Raw provider tokens never appear in project files, fixtures, logs, or status output. | security | AC-FN-015, AC-NF-PRIV-004 | inspection | Secret scan and manual inspection. | release-blocking | engineering | Security Architecture | draft |
| Deterministic validation and diagnostics work without live AI or network. | validation / availability | FR-012, FR-013, NFR-REL-006 | automated test | No-provider validation tests. | release-blocking | engineering | Test Strategy | draft |
| Markdown generation writes canonical documents under configured root with a generation report. | generation | AC-FN-009, AC-FN-017 | inspection | Generated output fixture and report snapshot. | release-blocking | founder/user | System Architecture | draft |
| HTML artifacts and agent packs are generated as derived, traceable, and stale-aware outputs. | generation / integration | AC-FN-010 | inspection + review | Derived output fixtures and labels. | degrade gracefully unless profile-complete release requires them | founder/user | Integration Architecture | draft |
| Provider timeout or failure preserves user input and confirmed state. | reliability | AC-UX-011, NFR-REL-001 | automated + observable test | Timeout/failure fixture. | release-blocking | engineering | Test Strategy | draft |
| Manual edits or existing files are not overwritten silently. | filesystem / trust | AC-FN-022 | observable test | Conflict/overwrite scenario evidence. | release-blocking if destructive | founder/user | Security Architecture | draft |
| TUI critical actions are keyboard-operable and state labels do not rely on color alone. | accessibility | AC-NF-ACC-001, AC-NF-ACC-002 | review + observable test | Keyboard walkthrough and UI review. | release-blocking for critical actions | founder/user | Frontend Architecture | draft |
| Default release gate passes without live AI, network, or raw tokens. | release | Product Release Gates | automated test | `pnpm check` or documented equivalent. | release-blocking | engineering | Release Management | draft |
| Generated docs and reports preserve assumptions, unsupported claims, validation caveats, and next actions. | content / trust | FR-050, AC-FN-023 | review | Output review checklist. | release-blocking for false claims; otherwise degrade gracefully | founder/user | Test Strategy | draft |

## Downstream Handoff

### System Architecture

System Architecture must inherit the module boundaries from this brief: TUI shell, command router, profile loader, state layer, AI provider abstraction, validation engine, diagnostics engine, renderer, derived-output generator, and filesystem adapter. It must not introduce hosted backend, database storage, telemetry, accounts, or collaboration by default.

### Data Model

Data Model must define repository workspace configuration, active documentation root, profile identity, phase progress, document contracts, decisions, assumptions, open questions, risks, diagnostics, validation gaps, output metadata, generation reports, derived artifact metadata, state versioning, and stale-output relationships.

### Security Architecture

Security Architecture must own provider token safety, redaction, context disclosure, permissioned writes, overwrite protection, root changes, local privacy boundaries, no-telemetry default, and safe handling of logs or diagnostics.

### API Contracts

API Contracts must define command results, state transition commands, confirmation requirements, provider configuration status, AI interpretation result shape, validation findings, diagnostics, generation reports, error taxonomy, and recovery paths.

### Integration Architecture

Integration Architecture must define AI provider adapters, local versus remote provider behavior, timeout handling, structured provider output validation, no-provider fallback, derived agent pack generation, and external transmission disclosure.

### Frontend Architecture

Frontend Architecture must map the TUI screens, command routing, keyboard interactions, focus behavior, compact terminal layouts, state labels, provider/root/status indicators, generation confirmation, diagnostics, validation, and recovery surfaces.

### Infrastructure Architecture

Infrastructure Architecture should remain intentionally small for MVP. It should cover local runtime requirements, package distribution, Node version enforcement, filesystem assumptions, cross-platform execution, and the absence of hosted infrastructure.

### Test Strategy

Test Strategy must cover deterministic tests without live AI or network, fixture providers, malformed AI output, state transitions, validation rules, generation reports, safe writes, root configuration, provider failure, no-token storage, cross-platform smoke checks, Markdown linting, and release gates.

### Engineering Design System

The Engineering Design System must translate Product Design System rules into implementable Ink/TUI components and derived HTML artifact conventions, including semantic state labels, keyboard-first behavior, non-color-only meaning, and compact layout behavior.

### Observability Plan

Observability must be local and privacy-preserving. It should define generation reports, decision audit trail, validation outputs, diagnostic severity, optional debug logs if approved, and support artifacts that do not leak secrets or unrelated project context.

### Deployment Plan

Deployment Plan must define packaging, install path, supported platforms, Node.js version checks, release scripts, smoke tests, migration notes, and user-facing setup guidance for AI providers.

### Operations, Release, Support, and Risk Management

Operations and release documents must inherit the validation caveat that the product is not externally validated. Release Management must require quality gates. Support Model must handle provider setup, path/root confusion, generation failures, and state recovery. Risk Management must track AI false authority, privacy, data loss, scope creep, and validation overclaiming.

### Go-To-Market Restriction

GTM must not claim validated demand, validated willingness to pay, enterprise readiness, hosted collaboration, compliance readiness, or proven local-first preference until evidence exists and engineering acceptance gates are met.
