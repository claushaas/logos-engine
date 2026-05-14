# Product Stack

## Product Stack Thesis

LOGOS Engine's product-level technology choices should preserve the local-first, inspectable, decision-centered workflow described in the Product Brief. The stack must support a terminal-based interactive experience, filesystem-only state, provider-agnostic AI assistance, and Git-friendly text outputs without introducing hidden remote dependencies, telemetry, or premature engineering architecture.

The organizing principle is simple: the product runs where the user works, stores what the user owns, and transmits only what the user explicitly configures. Technology choices should protect this principle rather than complicate it.

The stack must support:

- A keyboard-first TUI that runs inside the target repository directory.
- Local structured state and canonical Markdown outputs without a database or hosted backend.
- Explicit AI provider configuration with clear local versus remote behavior.
- Deterministic validation, diagnostics, and generation from profile YAML contracts.
- Cross-platform terminal execution on macOS, Linux, and Windows (via WSL).

The stack must avoid:

- Technology theater: fashionable choices without product rationale.
- Premature multi-client architecture when the primary journey is not yet validated.
- Hosted infrastructure, cloud sync, or accounts as default assumptions.
- Telemetry, hidden network calls, or opaque binary dependencies.
- Over-engineering storage or rendering before the core clarification loop is proven.

Technology trade-offs at the product level should favor inspectability, reversibility, and terminal compatibility over visual richness, browser-native affordances, or mobile reach. Engineering may optimize within these constraints; it should not silently relax them.

---

## Platform Strategy

### Target Platforms

| Platform | Role | Status | Release Order | Rationale |
|----------|------|--------|---------------|-----------|
| macOS | primary | committed | 1 | Founding development environment; strong terminal and developer tooling ecosystem. |
| Linux | primary | committed | 1 | Primary deployment and development platform for technical users; aligns with repository-local workflow. |
| Windows (WSL) | supported | provisional | 1 | Windows developers commonly use WSL for Node.js and terminal workflows; native Windows terminal support may vary. |
| Windows (native terminal) | unsupported | excluded | — | Native Windows terminal behavior, path handling, and terminal emulator compatibility are not guaranteed in MVP. |
| Web / Browser | unsupported | excluded | — | Would require hosted backend or bundling assumptions that violate Local First and current scope. |
| Mobile / Tablet | unsupported | excluded | — | Form factor, input modality, and local repository access are incompatible with the primary use case. |

### Platform Rationale

The target user is a technical or product-adjacent builder who already uses a terminal, Git, and local files. Terminal-based execution on desktop operating systems is the smallest viable platform surface that preserves the local-first promise and avoids building unvalidated hosted infrastructure.

### Platform Constraints

- The product requires a Node.js runtime (>=22) and a terminal emulator capable of rendering ANSI escape sequences for the TUI.
- Terminal accessibility varies by OS, terminal emulator, and screen reader; the product cannot guarantee universal accessibility but must design for keyboard-first operation.
- Filesystem path conventions differ across platforms; the product must handle path separators and permissions without assuming Unix-only behavior.
- WSL on Windows is treated as a Linux environment for path and runtime purposes; native Windows CMD/PowerShell compatibility is not a product commitment.

### Unsupported Platforms

Native Windows terminal, mobile operating systems, web browsers, and embedded devices are explicitly excluded from MVP. Expansion to any of these requires validated demand and an explicit scope decision that does not silently replace local-first behavior with hosted alternatives.

### Expansion Triggers

- Web or hosted surfaces: only if validated demand exists and a design preserves local source of truth.
- Native Windows terminal: only if WSL adoption proves insufficient for the intended audience.
- Mobile: only if the primary use case shifts to a context where mobile repository editing is material.

---

## Primary Client

### Choice

The primary client is a **Terminal User Interface (TUI)** built with **Ink** (React for terminals) and rendered inside a terminal emulator.

### Rationale

- The product runs from the target repository directory; a terminal is the natural execution context.
- The target user is already terminal-literate; a TUI respects their workflow instead of demanding a separate window system.
- Ink provides a React-based component model that supports state-driven rendering, keyboard handling, and layout within terminal constraints.
- A TUI keeps the product lightweight, local, and inspectable without browser engines, electron bundles, or mobile runtimes.
- The Interaction Model and UI Specification both assume a compact, keyboard-first interface with slash commands and conversational input.

### Capabilities Enabled

- Real-time conversational intake with status indicators and command routing.
- Keyboard-first navigation and confirmation without pointer dependency.
- Compact rendering of status, diagnostics, generation reports, and provider configuration.
- Local execution without network-dependent UI assets.
- Terminal-native text output that works with screen readers where the emulator supports it.

### Capabilities Constrained

- Rich visual layout, color gradients, images, and complex typography are not available.
- Pointer and touch interactions are secondary; the product must not depend on them.
- Terminal width and height impose hard layout limits.
- Animation and motion are limited; status must not depend on animation alone.
- Accessibility depends on the terminal emulator and screen reader combination; the product cannot fully control this.

### Accessibility Implications

- Keyboard access is a first-class requirement; all critical actions must be operable without a pointer.
- Color must not be the sole carrier of meaning because terminal color support varies and some users use high-contrast or monochrome themes.
- Focus movement must be predictable; focus traps or hidden focus jumps violate the Interaction Model.
- Screen reader behavior depends on Ink's accessibility support and the terminal emulator; Engineering must validate this.

### Engineering Handoff

Frontend Architecture must inherit:

- Ink as the TUI rendering layer.
- React component model with terminal-specific constraints.
- Keyboard routing for slash commands and conversational input.
- Compact layout rules for status, diagnostics, reports, and configuration.
- No dependency on browser APIs, DOM, or CSS.

---

## Secondary Clients

### Status: Excluded or Deferred

LOGOS Engine does not define secondary clients for MVP. The following surfaces are explicitly excluded or deferred:

| Client | Status | Rationale |
|--------|--------|-----------|
| CLI batch / non-interactive mode | excluded | The product is designed around conversation, review, and confirmation. A non-interactive batch mode would bypass decision review and consent gates. |
| Web dashboard | excluded | Violates Local First and would require hosted infrastructure or bundling assumptions not validated. |
| API / programmatic interface | deferred | May be reconsidered after the core TUI workflow is validated, but not for MVP. |
| Mobile app | excluded | Form factor and repository access are incompatible with the primary use case. |
| Desktop GUI (Electron, Tauri, native) | excluded | Adds bundle size and complexity without validated user demand; TUI is sufficient for the target audience. |

### Shared Behavior Model

If a secondary client is introduced later, the following behaviors must remain consistent across all clients:

- Structured project state is the source of truth; no client may treat its local cache or rendered view as canonical.
- Decision confirmation requires explicit user action; no client may confirm decisions silently.
- AI output remains proposed or advisory until reviewed.
- Profile YAML contracts govern outputs; no client may invent document structure.
- Local-first defaults; any hosted or remote behavior requires explicit user configuration.

---

## Product-Level Technology Choices

The following choices are product-level commitments or provisional assumptions that shape user experience, scope, constraints, or downstream engineering. They are not implementation architecture.

### Committed Choices

| ID | Decision | Category | Status | Product Rationale | User Experience Impact | Scope Impact | Constraints Created | Risks |
|----|----------|----------|--------|-------------------|------------------------|--------------|---------------------|-------|
| STK-001 | Node.js (>=22) runtime | platform runtime | committed | TypeScript execution, large ecosystem, cross-platform desktop support, familiar to target users. | Requires Node.js installation; clear error if missing. | Limits execution to Node.js-capable machines. | Must handle version compatibility and path differences across OS. | Users on older Node.js versions cannot run the product. |
| STK-002 | TypeScript (sole language) | language | committed | Strong typing for schema modeling, good CLI/TUI ecosystem, Markdown/JSON tooling, familiar to web developers. | None direct; affects error quality and maintainability. | Enables strict schema validation and type-safe state modeling. | Build step required; runtime is compiled JavaScript. | Build complexity; type errors must not leak to user as crashes. |
| STK-003 | Ink (React for terminals) | TUI framework | committed | React component model, state-driven rendering, keyboard handling, active maintenance, strong terminal ecosystem. | Compact, interactive terminal UI with command routing and status views. | Constrains visual richness to terminal capabilities. | Terminal emulator compatibility required; layout limited by terminal size. | Accessibility depends on terminal + Ink; rendering bugs may block interaction. |
| STK-004 | React (Ink's peer dependency) | UI library | committed | Required by Ink; component model for TUI screens. | Enables structured component hierarchy for TUI views. | Couples TUI to React lifecycle and patterns. | React version must stay compatible with Ink. | React major version changes may require Ink updates. |
| STK-005 | Commander (entrypoint only) | CLI parser | committed | Parses `logos` bin entry and minimal arguments before handing off to TUI. | User runs `logos` from repository directory; no complex CLI flags required. | No CLI batch mode; all operations happen inside TUI. | Commander scope must not expand into a full CLI alternative to the TUI. | Risk of expanding into CLI batch mode if not bounded. |
| STK-006 | Filesystem-only storage (JSON + Markdown + YAML) | storage | committed | Local First, Git Friendly, inspectable, no database or hosted backend required. | Users can read, diff, and version all state and outputs. | Excludes database features, search indexing, and cloud sync. | Must handle safe writes, corruption recovery, and path safety without DB transactions. | File corruption, concurrent access, or unsafe writes may lose state. |
| STK-007 | Zod (schema validation) | validation | committed | Runtime type safety for profile schemas, AI output validation, state shape enforcement. | Malformed AI output or invalid profile is caught before corrupting state. | Enables strict contracts between AI, state, and generation. | Schema changes require migration consideration for existing project state. | Overly strict schemas may reject valid but unexpected provider output. |
| STK-008 | YAML (profile contracts) | contract format | committed | Human-readable profile definitions; phases, documents, questions, validations, and outputs are defined in YAML. | Users can inspect profile contracts if desired; agents can read them. | Profile system is YAML-native; no GUI profile editor in MVP. | Requires robust YAML parser; malformed profile must fail clearly. | YAML parsing errors or schema drift may break profile loading. |
| STK-009 | Provider-agnostic AI abstraction | AI layer | committed | Avoids lock-in to a single provider; supports local and remote modes; preserves user choice. | Users can choose local (Ollama, LM Studio) or remote (OpenAI, Anthropic, OpenRouter) providers. | Requires abstraction layer and per-provider configuration. | Each provider has different API shapes, rate limits, and privacy policies. | Abstraction may lag behind provider features; local provider setup may frustrate users. |
| STK-010 | Markdown (canonical output) | document format | committed | Human-readable, Git-friendly, diffable, editable with care, universally supported. | Users read and optionally edit generated documents with standard tools. | All canonical documents are Markdown; no rich-text or proprietary format. | Must preserve manual edits safely during regeneration. | Manual edit conflicts with regeneration require careful handling. |

### Provisional Assumptions

| ID | Decision | Category | Status | Rationale | Revisit Trigger |
|----|----------|----------|--------|-----------|---------------|
| STK-011 | HTML artifact generation from Markdown | rendering | provisional | Profile YAMLs define HTML artifacts as navigable review views. Exact HTML generation approach is not yet fixed. | Engineering must select a Markdown-to-HTML approach that preserves caveat labels and accessibility. |
| STK-012 | OS credential store / keychain for token storage | secrets | provisional | Preferred over env vars for persistent token storage, but implementation varies by OS and requires engineering validation. | Engineering review of cross-platform secret storage libraries and UX flow. |
| STK-013 | Default timeout (60s) for AI provider calls | performance | provisional | Prevents indefinite hangs; actual acceptable latency depends on provider, model, and context size. | User feedback or prototype evidence that timeout is too aggressive or too lenient. |

### Excluded Choices

| Decision | Category | Reason |
|----------|----------|--------|
| Database (SQLite, PostgreSQL, etc.) | storage | Violates filesystem-only commitment; adds complexity without validated need. |
| Electron / Tauri / native GUI | client | Adds bundle size and platform complexity; TUI is sufficient for target audience. |
| Cloud sync / hosted backend | infrastructure | Violates Local First and current scope. |
| Telemetry / analytics platform | observability | Violates privacy boundaries and no-telemetry requirements. |
| Authentication / authorization service | identity | No accounts or multi-user model in scope. |
| Real-time communication (WebSockets, SSE) | communication | No real-time collaboration or streaming requirements in MVP. |

---

## UX-Relevant Technical Constraints

### Latency and Connectivity

- AI provider calls may take seconds to tens of seconds depending on model, context size, and network conditions. The TUI must show pending status and allow safe cancellation where possible.
- Local providers (Ollama, LM Studio) may have high latency on consumer hardware; the product must not assume remote providers are always faster.
- A default timeout of 60 seconds applies to provider calls; users may configure this via `/config ai`.

### Offline and Local-First

- The product operates fully offline except when a remote AI provider is explicitly configured and used.
- Non-AI operations — status, diagnostics, validation, generation from existing state — must work without network access.
- No hidden network calls for telemetry, updates, or asset loading.

### Terminal Resource Limits

- Terminal width and height constrain layout; long lines wrap, and tall outputs scroll.
- The TUI must degrade gracefully in small terminals: essential information remains visible, and scrolling is predictable.
- Terminal color support varies (256-color, true-color, monochrome); color must not be the only status indicator.

### Permission and Path Constraints

- The product requires read/write access to the current repository directory and the configured LOGOS documentation root.
- Filesystem permissions may block writes; the product must report permission errors clearly and avoid silent failures.
- Path separators and case sensitivity differ across platforms; path handling must be platform-aware.

### AI Confidence and Degradation

- Low-confidence AI interpretations must be labeled as such; the user must not mistake them for confirmed state.
- Provider failure must not block local operations; the product should route to no-provider guidance or local status review.
- Malformed AI output must be rejected before state mutation; the user sees an explanation, not a crash.

### Graceful Degradation

| Constraint | Normal Behavior | Degraded Behavior |
|------------|-----------------|-------------------|
| Terminal too small | Full TUI layout | Essential info visible; scrolling enabled. |
| No AI provider configured | AI-led intake | Local status, diagnostics, and `/config ai` guidance. |
| AI provider timeout | Retry or switch | Preserve input; suggest config or local provider. |
| Filesystem permission denied | Write to documentation root | Report error; suggest path or permission fix. |
| Monochrome terminal | Color-coded status | Text labels and symbols remain distinguishable. |
| Screen reader in use | Visual TUI | Keyboard commands and text feedback remain operable. |

---

## Integration Surface

### External Integrations

The product integrates with external systems only through AI providers. There are no SaaS integrations, cloud APIs, auth services, or telemetry endpoints.

| Integration | Purpose | Status | Data Flow | Protocol | Auth Model | User-Visible Impact | Failure Modes | Fallback Behavior | Privacy / Security Concerns |
|-------------|---------|--------|-----------|----------|------------|---------------------|---------------|-------------------|------------------------------|
| OpenAI API | Remote AI questions, interpretation, drafting | committed | Outbound: project context, prompts. Inbound: AI responses. | HTTPS REST / OpenAI SDK pattern | API token via env var or OS credential store | Provider status shown; transmission disclosed before first remote call. | Timeout, rate limit, invalid token, service outage. | Route to `/config ai`; preserve local state; allow deterministic validation without AI. | Project context leaves local machine; user must explicitly configure and consent. |
| Anthropic API | Remote AI questions, interpretation, drafting | committed | Outbound: project context, prompts. Inbound: AI responses. | HTTPS REST / Anthropic SDK pattern | API token via env var or OS credential store | Provider status shown; transmission disclosed before first remote call. | Timeout, rate limit, invalid token, service outage. | Route to `/config ai`; preserve local state. | Project context leaves local machine; user must explicitly configure and consent. |
| OpenRouter API | Remote AI questions via aggregated provider access | committed | Outbound: project context, prompts. Inbound: AI responses. | HTTPS REST / OpenAI-compatible pattern | API token via env var or OS credential store | Provider status shown; transmission disclosed before first remote call. | Timeout, rate limit, invalid token, service outage. | Route to `/config ai`; preserve local state. | Project context leaves local machine; user must explicitly configure and consent. |
| Ollama (local) | Local AI execution without network transmission | committed | Local only: prompts and responses stay on machine. | HTTP to local Ollama server | None (local) | Provider status shown as local. | Ollama not installed, model not pulled, insufficient RAM. | Route to `/config ai`; suggest remote provider or no-provider mode. | No external transmission; user controls all data. |
| LM Studio (local) | Local AI execution without network transmission | committed | Local only: prompts and responses stay on machine. | HTTP to local LM Studio server | None (local) | Provider status shown as local. | LM Studio not running, model not loaded, insufficient RAM. | Route to `/config ai`; suggest remote provider or no-provider mode. | No external transmission; user controls all data. |
| Custom provider (OpenAI-compatible) | User-defined remote or local endpoint | committed | Outbound/Inbound depending on endpoint. | HTTPS REST / OpenAI-compatible pattern | API token via env var or OS credential store | Provider status shown; transmission disclosed. | Endpoint unreachable, auth failure, incompatible response format. | Route to `/config ai`; preserve local state. | User responsible for endpoint trust and privacy policy. |

### Integration Rules

- Remote provider use requires explicit configuration and must not happen without user consent.
- Raw API tokens must not be stored in project files; token sources are environment variables or OS credential stores.
- The product must disclose transmission behavior before the first remote call for a given project session.
- No integration sends telemetry, usage analytics, or crash reports to external systems.
- Git is a user workflow dependency, not a product integration; the product does not call Git commands.

---

## Tooling Assumptions

The following tooling assumptions affect product scope, quality, release, or operations. Detailed engineering tooling selection belongs in Engineering documents.

| Tool / Assumption | Purpose | Product Relevance | Status | Constraints |
|-------------------|---------|-------------------|--------|-------------|
| pnpm | Package manager and script runner | Required for installation and build scripts; `pnpm check` runs linting, tests, and build. | committed | Users installing from source need pnpm; end users installing via npm may not. |
| Biome | Linting and formatting for TypeScript, JavaScript, JSON | Affects code quality and consistency; `pnpm lint:biome` is a quality gate. | committed | Must not silently reformat generated Markdown or YAML. |
| markdownlint | Markdown linting for documentation | Affects quality of canonical Markdown and generated docs. | committed | Generated Markdown must pass lint rules or generation must report violations. |
| Vitest | Test runner | Affects confidence in deterministic behavior; default tests must run without live AI or network. | committed | Test policy requires mocked providers and fixtures. |
| TypeScript compiler | Type checking and build | Affects correctness; `pnpm typecheck` and `pnpm build` are quality gates. | committed | Build failures block release. |
| GitHub Releases | Distribution channel for release notes and binaries | Affects release visibility and changelog delivery. | provisional | Release process depends on Engineering and Operations decisions. |
| npm registry | Primary distribution channel | End users install `logos-engine` via npm. | committed | Published package must include `dist`, `profiles`, `docs`, README, and LICENSE. |

### Tooling Decisions Deferred to Engineering

| Decision | Reason | Target Document |
|----------|--------|-----------------|
| Exact CI/CD pipeline and release automation | Engineering owns build and deploy orchestration. | Engineering Brief, Release Management |
| Exact test coverage thresholds | Engineering owns test strategy and quality gates. | Test Strategy |
| Accessibility test harness for TUI | Requires engineering research into terminal accessibility testing tools. | Test Strategy, Frontend Architecture |
| Exact Markdown-to-HTML generation library | Product requires HTML artifacts; Engineering selects the renderer. | Frontend Architecture, Engineering Brief |
| Exact OS credential store abstraction | Product requires safe token storage; Engineering selects the library. | Security Architecture, Engineering Brief |

---

## Deferred Engineering Decisions

| Decision | Reason Deferred | Information Needed | Revisit Trigger | Risk of Deferral | Blocked Work | Allowed Work | Target Document |
|----------|-----------------|-------------------|---------------|------------------|--------------|--------------|-----------------|
| HTML artifact rendering engine | Product requires derived HTML but does not mandate a specific renderer. | Engineering evaluation of Markdown-to-HTML libraries that preserve caveat labels and accessibility. | Engineering brief reaches frontend architecture section. | HTML artifacts may be delayed or use a suboptimal renderer in early builds. | Rich HTML navigation and styling. | Canonical Markdown generation; basic HTML output if a simple renderer is chosen. | Frontend Architecture |
| OS credential store integration | Cross-platform secret storage requires library evaluation. | Review of `keytar`, `keychain`, `libsecret`, or built-in Node.js alternatives across macOS, Linux, Windows. | Security Architecture review. | Users may rely solely on env vars longer than ideal; token management friction persists. | Persistent secure token storage UX. | Env-var-based token configuration; local provider use without tokens. | Security Architecture |
| TUI accessibility validation | Terminal accessibility depends on emulator, screen reader, and framework behavior that requires testing. | Engineering research into accessible terminal patterns and Ink's accessibility support. | UI implementation reaches testing stage. | Accessibility claims remain unverified; some users may have a degraded experience. | Accessibility certification or guarantees. | Keyboard-first design; text-label status indicators; reduced-motion respect in future visual surfaces. | Test Strategy, Frontend Architecture |
| Structured state migration strategy | State schema may evolve; migration tooling is not needed for initial prototype. | Evidence of schema changes in real use and evaluation of migration approaches (JSON patches, versioned schemas, etc.). | First breaking schema change after MVP. | Schema changes may require manual migration or state loss in early versions. | None for MVP. | Versioned state format; simple additive schema changes. | Data Model, Engineering Brief |
| Semantic search or retrieval | Not required for MVP scale (~100s of decisions). | Evidence that browsing and diagnostics are insufficient at scale. | User feedback or state size exceeds practical browsing. | Users may struggle to find decisions in large projects later. | Search UI or indexing infrastructure. | Status views; diagnostics with affected document links; structured state browsing. | System Architecture |

---

## Stack Risks

| ID | Risk | Affected Choice | Risk Type | User Impact | Product Impact | Engineering Impact | Early Signal | Mitigation | Target Document |
|----|------|---------------|-----------|-------------|----------------|--------------------|--------------|------------|-----------------|
| STK-RISK-001 | Ink/React TUI has limited or inconsistent accessibility across terminal emulators | Ink, React | accessibility | Some users cannot operate or perceive critical states. | Product fails accessibility expectations for keyboard and screen reader users. | Must build alternative text feedback paths; cannot rely on visual layout alone. | Keyboard navigation fails; screen reader does not announce status changes. | Text-equivalent status for all visual states; keyboard-only command paths; explicit focus management. | Frontend Architecture, Test Strategy |
| STK-RISK-002 | AI provider abstraction cannot keep pace with provider API changes | Provider abstraction | integration | New provider features or fixes are unavailable. | Product appears stale or forces provider lock-in despite abstraction intent. | Maintenance burden of per-provider adapters and schema mapping. | Provider errors increase after upstream API changes; lag in supporting new models. | Abstraction layer with clear extension points; prompt contracts decoupled from provider specifics. | Integration Architecture, API Contracts |
| STK-RISK-003 | Node.js version requirement blocks adoption on older systems | Node.js runtime | compatibility | User cannot install or run the product. | Reduced addressable audience. | Must document and enforce minimum version; potential bundling trade-offs. | Installation errors citing Node.js version. | Clear error messages; document Node.js >=22 requirement; consider future bundling. | Engineering Brief, Release Management |
| STK-RISK-004 | Filesystem-only storage corrupts or loses state on unsafe writes or crashes | Filesystem storage | reliability | User loses project decisions and context. | Trust in local-first promise breaks. | Must implement safe writes, atomic operations, and recovery without database transactions. | Reports of missing state, incomplete files, or generation failures after crashes. | Safe write patterns (write-then-rename); backup or recovery files; state validation on load. | Data Model, Engineering Brief |
| STK-RISK-005 | Terminal emulator incompatibility breaks TUI rendering | Ink, terminal | compatibility | TUI is unreadable or unusable. | Product appears broken on certain terminals. | Must handle terminal capability detection and graceful fallback. | Garbled output, missing colors, broken layout on specific terminals. | Conservative terminal assumptions; plain-text fallback paths; terminal capability detection if available. | Frontend Architecture, Test Strategy |
| STK-RISK-006 | Local provider setup (Ollama, LM Studio) is too complex for non-expert users | Local AI providers | adoption | Users abandon because local AI setup is hard. | Local-first value proposition weakens. | Must provide clear setup guidance without becoming a support desk. | Users repeatedly fail local provider configuration in prototype sessions. | Clear documentation; local provider diagnostics; suggest remote providers as fallback. | Engineering Brief, Operations |
| STK-RISK-007 | Markdown generation conflicts with manual edits | Markdown canonical output | trust | User loses work or avoids regeneration. | Git-friendly promise weakens. | Must implement manual-edit detection and safe regeneration without over-engineering. | Reports of overwritten manual edits; users avoid `/generate`. | Warning before overwrite; affected-files preview; manual-section preservation where feasible. | Data Model, Engineering Brief |
| STK-RISK-008 | Profile YAML schema drift breaks existing projects | Profile YAML, Zod | reliability | Existing projects fail to load after profile or engine update. | Backward compatibility promise breaks. | Must version profiles and state schemas; define migration or deprecation policy. | Invalid profile errors after engine update; existing decisions not loaded. | Profile versioning; schema evolution rules; clear error messages for incompatible profiles. | System Architecture, Data Model |
| STK-RISK-009 | Dependency on React/Ink ecosystem creates lock-in or upgrade friction | React, Ink | lock-in | Future React or Ink versions introduce breaking changes. | TUI framework may require significant rewrite. | Must track upstream releases and plan upgrade cycles. | Ink or React major version release with breaking changes for terminal apps. | Keep React usage bounded to TUI components; avoid deep ecosystem dependencies. | Frontend Architecture |
| STK-RISK-010 | Remote provider cost or rate limits surprise users | Remote AI providers | cost / trust | Unexpected charges or blocked operations. | User trust erodes; product blamed for provider costs. | Cannot control provider pricing; must surface rate-limit and cost awareness where possible. | Users report unexpected API bills or rate-limit errors. | Transmission disclosure; provider status visibility; cost-awareness documentation. | Operations, Permission Model |

---

## Downstream Handoff

### Engineering Brief

Must inherit:

- Local-first, repository-directory, TUI-first product direction.
- Node.js >=22 runtime; TypeScript sole language.
- Ink (React) as TUI rendering layer; Commander bounded to entrypoint only.
- Filesystem-only storage (JSON + Markdown + YAML); no database or hosted backend.
- Provider-agnostic AI abstraction with explicit local/remote disclosure.
- Zod for runtime schema validation.
- Safe write patterns and state recovery requirements.
- No telemetry, no hidden network calls, no raw token storage in project files.

Must not assume:

- Database requirements.
- Web dashboard or hosted infrastructure.
- CLI batch mode as a primary interface.
- Telemetry or analytics pipelines.

### System Architecture

Must inherit:

- Product module boundaries from Product Architecture.
- State model objects and lifecycle transitions.
- Profile YAML as contract input.
- Deterministic validation separate from AI-assisted diagnostics.
- Safe recovery and partial failure handling.

### Data Model

Must inherit:

- Filesystem-only persistence; no database schema.
- JSON for structured state; Markdown for canonical docs; YAML for profile contracts.
- Versioned state format for future migration.
- Safe write semantics.

### API Contracts

Must inherit:

- Command/action result shapes with status, messages, affected objects, and recovery options.
- AI output status as proposed/advisory/needs-review.
- Generation result categories (created, updated, skipped, incomplete, blocked, failed).
- Provider disclosure metadata without raw secrets.
- Confirmation requirements for state-changing operations.

### Integration Architecture

Must inherit:

- Provider-agnostic abstraction with per-provider configuration.
- OpenAI, Anthropic, OpenRouter, Ollama, LM Studio, and custom (OpenAI-compatible) as supported modes.
- Explicit transmission disclosure before first remote call.
- Token storage via env vars or OS credential store; never in project files.
- Timeout, retry, and fallback behavior for provider failures.

### Security Architecture

Must inherit:

- No raw token storage in project files.
- OS credential store integration for persistent token storage (provisional).
- Bounded context for AI prompts; no arbitrary source-code ingestion.
- Safe file-write permissions and path validation.

### Frontend Architecture

Must inherit:

- Ink + React as TUI framework.
- Keyboard-first interaction; no pointer dependency for critical actions.
- Compact terminal layout with graceful degradation for small terminals.
- Text-equivalent status for all visual states.
- No browser APIs, DOM, or CSS dependencies.

### Test Strategy

Must inherit:

- Default tests must run without live AI or network calls.
- Mocked providers and fixtures required.
- No raw API tokens in fixtures or project files.
- TUI accessibility assumptions require validation.

### Observability Plan

Must inherit:

- Local debug logging only (opt-in).
- No operational metrics, no telemetry, no dashboards.
- Decision audit trail and generation reports as local observability.

### Operations / Release Management

Must inherit:

- Semantic versioning for the engine.
- Profile versioning separate from engine versioning.
- npm registry + GitHub Releases as distribution channels.
- No hosted infrastructure or SaaS operations in MVP.
- Support for provider setup problems and file overwrite confusion.

### Unresolved Stack Questions

- Which Markdown-to-HTML library best preserves caveat labels and accessibility in derived artifacts?
- What is the exact feasibility of Ink-based TUI accessibility with common screen readers and terminal emulators?
- How should the product behave when the user switches from one AI provider to another mid-session?
- What is the migration path when profile YAML schema or structured state schema changes?
- Should the product bundle Node.js in the future to remove the runtime installation barrier?
