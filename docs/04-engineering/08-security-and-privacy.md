# Security and Privacy

## Security and Privacy Objective

LOGOS Engine must protect the user's local project knowledge, decision history, generated documentation, provider credentials, and trust in the generation workflow while preserving the product's local-first operating model.

Security and privacy are product constraints, not optional hardening layers. The MVP has no hosted backend, no user accounts, no cloud sync, no telemetry platform, no public API server, no workers, and no marketplace. The primary runtime is a TUI launched from the target repository directory, with durable state and generated outputs stored on the local filesystem.

The security objective is to prevent the following release-blocking failures:

| Failure | Why It Blocks Release | Required Control |
| --- | --- | --- |
| Raw provider tokens are written to project files, logs, fixtures, generated docs, HTML artifacts, or agent packs. | Token exposure can compromise external AI provider accounts and break user trust. | Store only redacted token source references; resolve raw values in memory only. |
| Project context is sent to a remote provider without explicit configuration and disclosure. | Sensitive repository and product context may leave the user's machine unexpectedly. | Require provider configuration, local/remote labeling, and remote context preview acceptance before remote calls. |
| Generated files are written outside the configured documentation root. | Unsafe path handling could modify unrelated repository files. | Resolve and validate all output paths under the configured root, which defaults to `logos/` and may be customized. |
| AI output becomes confirmed product truth without user action. | The product promise depends on user-owned decisions, not provider authority. | Treat AI output as proposed, advisory, or invalid until explicitly confirmed by the user. |
| Deterministic validation depends on AI judgment. | Validation must remain reproducible, testable, and provider-independent. | Keep validation rules local, schema-based, and deterministic. |
| Hidden telemetry, analytics, or crash reporting is introduced. | This violates the documented privacy posture and local-first promise. | No external observability endpoint in the MVP. |
| Destructive writes, root changes, or overwrites happen without confirmation. | Users may lose manual edits or redirect generation unintentionally. | Require explicit confirmation and conflict reporting for risky operations. |
| The product claims compliance, encryption, penetration testing, or legal guarantees without evidence. | Unsupported claims create legal and trust risk. | Mark such areas as review-needed until validated. |

## Security Posture

LOGOS Engine uses a narrow security posture: minimize the runtime surface, make trust boundaries visible, validate data before mutation, require confirmation for risky actions, and avoid storing or transmitting data that the product does not need.

| Rule | Decision Impact | Enforcement Point | Release Impact |
| --- | --- | --- | --- |
| Local-first by default. | Core status, diagnostics, validation, and generation must work without network access. | TUI, command handlers, provider abstraction, tests. | Release-blocking if local operations require a remote service. |
| Explicit remote-provider consent. | Remote AI is opt-in and disclosed before project context is sent. | Provider configuration, context preview, intake orchestration. | Release-blocking if remote calls can happen silently. |
| No raw secret persistence. | Tokens never appear in project state, Markdown, HTML, agent packs, logs, fixtures, or snapshots. | Credential source adapter, config schema, redaction tests. | Release-blocking. |
| Profile YAML is data, not executable code. | Custom profiles can shape questions and outputs but must not execute arbitrary behavior. | Profile loader, schema validation, renderer. | Release-blocking for profile loading. |
| Markdown, Executive JSON, executive exports, HTML, and agent packs are outputs, not canonical state. | Generated artifacts and execution snapshots must not be treated as the source of truth for decisions or live task status. | Generation service, executive compiler, status service, downstream docs. | Release-blocking if output parsing becomes canonical state mutation. |
| AI is advisory. | AI may draft, classify, diagnose, or propose; it cannot confirm decisions or authorize writes. | Decision service, API contracts, TUI review flow. | Release-blocking. |
| Safe filesystem writes. | Output writes are bounded to the configured root and protected from overwrite surprises. | Path resolver, write service, generation report. | Release-blocking. |
| No hidden telemetry. | Observability is local diagnostics and explicit reports only. | Logging, error reporting, package defaults. | Release-blocking. |

Trust assumptions are intentionally limited:

- The local operating-system user is trusted to run LOGOS against a repository they control.
- The local filesystem, Git, editor, terminal emulator, shell history, and OS backups are outside LOGOS control.
- Remote AI providers are not trusted as security boundaries; their responses must be schema-validated and their policies must not be assumed.
- Local AI providers such as Ollama or LM Studio reduce external transmission risk but still must be treated as external processes behind an adapter boundary.
- Generated outputs may be committed to Git or shared by the user, so they must not contain secrets and must preserve caveat labels.

Risk acceptance must be explicit. Product-level security risks can be accepted only by the product owner for MVP scope. Engineering risks that affect token handling, path safety, remote transmission, AI confirmation, or validation determinism require engineering owner sign-off and release gating. Legal, compliance, encryption, and jurisdiction-specific privacy claims require external review before being presented as guarantees.

## Privacy Posture

LOGOS Engine's privacy posture is based on data minimization, local ownership, transparency, and user-controlled sharing. The product should collect and persist only the information required to create, validate, and regenerate project documentation.

| Privacy Principle | Product Rule | Implementation Consequence |
| --- | --- | --- |
| Purpose limitation | Data is collected to guide product and engineering documentation, not to profile users. | No behavioral analytics, hidden telemetry, or unrelated data collection. |
| Local ownership | Durable state and generated outputs live in the user's repository/workspace. | No hosted account, cloud workspace, operator console, or server-side retention in the MVP. |
| Minimal context | AI prompts include bounded project context relevant to the current task. | No arbitrary source-code ingestion, Git history ingestion, or whole-repository scraping without explicit inclusion. |
| Remote transparency | Users must know when project context may leave the machine. | Provider mode, endpoint class, and context implications are shown before remote calls. |
| Revocability | The user can stop using a provider by changing configuration or removing credentials. | Local deterministic commands remain available without a provider. |
| No unsupported legal claims | Privacy rights and compliance obligations vary by jurisdiction. | Access, deletion, portability, and notification rights are product behaviors or review needs, not legal guarantees. |

Retention is local and user-controlled. LOGOS does not operate hosted retention, account deletion, legal holds, centralized backups, or operator restore. Users can remove local project files using normal filesystem tools; a dedicated safe deletion command is a future product decision, not an MVP compliance guarantee.

## Threat Model

| ID | Threat | Actor / Source | Surface | Assets at Risk | Controls | Detection | Residual Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | Raw provider token is persisted or exposed. | Bug, fixture, debug log, generated output. | Provider config, credential lookup, logs, tests. | Provider API token, provider account. | Token source refs only, redaction, secret tests, no raw tokens in fixtures. | Secret scanning, redaction tests, review of config/status output. | User shell history and OS credential storage remain outside LOGOS control. |
| T-002 | Project context is sent to a remote provider without consent. | Bug, hidden provider call, unclear UX. | Intake, provider adapter, diagnostics. | User answers, decisions, repo context. | Provider mode disclosure, context preview acceptance, no hidden network calls, mocked default tests. | Provider-call tests, local network-free test suite, operation events. | User may choose a remote provider whose policy LOGOS cannot control. |
| T-003 | Path traversal or bad root config writes outside the intended documentation root. | Malformed config, malicious profile, implementation bug. | Root config, generation, HTML/agent pack renderers. | Repository files outside LOGOS root. | Safe relative root validation, normalization, path containment checks, overwrite confirmation. | Path traversal tests, generation reports, `unsafe_path` errors. | OS-level symlink behavior requires engineering review during implementation. |
| T-004 | AI output bypasses user confirmation and becomes canonical truth. | Provider hallucination, implementation shortcut. | Intake, decision service, generation. | Product decisions, scope, acceptance criteria. | Proposal-only AI contract, explicit review actions, invalid transition tests. | Decision transition tests, audit events, status showing proposed vs confirmed. | User may manually accept low-quality advice; product must label confidence and source. |
| T-005 | Malformed provider output corrupts state. | Provider drift, prompt injection, adapter bug. | Provider adapter, schema parser, state writer. | Structured state, generated docs. | Zod validation, internal result schemas, reject-before-mutate behavior. | `invalid_ai_output` errors, fixture provider tests. | Valid but poor AI content still requires human review. |
| T-006 | Unrelated source code, secrets, or Git history enters prompts. | Overbroad context builder, future feature creep. | Prompt/context builder, diagnostics. | Repository secrets, proprietary code. | Bounded context rules, explicit inclusion for arbitrary files, no Git history ingestion by default. | Context preview, prompt builder tests. | Users may paste sensitive data voluntarily. |
| T-007 | Agent packs expose sensitive context or are treated as privileged tools. | User sharing, downstream agent misuse. | Derived agent pack outputs. | Product strategy, decisions, assumptions, risks. | Agent packs are labeled derived/regenerable, no raw tokens, no unrelated files, no execution authority. | Golden output tests, output metadata checks. | Downstream agents may misinterpret or overuse shared packs outside LOGOS control. |
| T-012 | Executive exports expose sensitive execution context or imply live external-tool sync. | User sharing, adapter wording, external tool import. | Executive JSON, Markdown snapshots, GitHub issue files, Linear/Notion payloads, agent task packs. | Roadmaps, priorities, risks, implementation tasks, source document refs. | Export labels, source refs, no credentials, no live sync claim, unsupported-target reporting. | Executive schema and golden export tests. | After import, external tools and users own access, sharing, and status updates. |
| T-008 | Local state corruption causes unsafe regeneration or data loss. | Crash, interrupted write, schema migration bug. | Filesystem state, migrations, generation. | `.logos/` state, generated docs. | Atomic write pattern, schema validation on load, migration checks, partial generation reporting. | State validation, migration tests, generation reports. | User-managed backups are needed for catastrophic local disk failure. |
| T-009 | Logs, diagnostics, or support artifacts disclose sensitive data. | Debug logging, support export, screenshots. | Local logs, diagnostics, error reports. | Paths, provider metadata, project content. | Redacted logs, no telemetry, support bundle opt-in if added. | Log snapshot tests, manual review. | Users can share screenshots or files outside product control. |
| T-010 | Dependency or package compromise affects local runtime. | Supply-chain attack. | npm package, dependencies, release process. | Local repository data, credentials resolved at runtime. | Lockfile review, dependency scanning, minimal dependencies, release provenance checks. | Dependency audit, CI checks, release review. | Full supply-chain hardening is review-needed before broader distribution claims. |
| T-011 | Malicious or invalid custom profile causes unsafe output or prompt content. | Custom profile author, corrupted YAML. | Profile loader, question/render contracts. | State quality, generated docs, provider context. | Profile schema validation, YAML-as-data rule, renderer escaping, no arbitrary code execution. | Profile compatibility fixtures, malformed YAML tests. | Custom profile content may still ask users to reveal sensitive information; warnings may be needed. |

## Asset Inventory

| Asset | Classification | Owner | Storage / Processing Location | Access Path | Exposure | Retention / Audit |
| --- | --- | --- | --- | --- | --- | --- |
| Provider API tokens | Secret | User / provider | Environment variable or OS credential store; resolved in memory. | Credential source adapter. | Token leak, provider account compromise. | Never stored by LOGOS in project files; rotation handled by provider/user. |
| Token source references | Secret-adjacent | User | Workspace config/state. | Config service, provider status. | Reveals credential location or provider choice. | Persist redacted metadata only; audit config changes locally. |
| User intake answers | Confidential project context | User | Local structured state under internal workspace storage. | Intake, status, generation, AI prompt builder. | Remote provider transmission, generated docs, logs. | Local/user-managed; included only when needed. |
| Confirmed decisions | Confidential project intent | User | Local structured state; rendered into Markdown and derived outputs. | Decision service, validation, generation. | Shared docs, agent packs, Git commits. | Durable project truth until user edits/removes state. |
| Assumptions, risks, questions | Confidential project intent | User | Local structured state and generated docs. | Status, validation, generation. | Shared outputs; provider context. | Retain while relevant; staleness tracked in status/generation. |
| Generated Markdown under `logos/` or custom root | User-owned project output | User | Filesystem in configured root. | Generation service, editor, Git. | Manual sharing, Git commit, overwrite. | Regenerable but may contain user edits; overwrite requires care. |
| Derived HTML artifacts | User-owned derived output | User | Filesystem under generated outcomes path. | Renderer, browser/editor. | Browser rendering, sharing, Git. | Regenerable from canonical content; must escape rendered content. |
| Derived agent packs | User-owned derived output | User | Filesystem under generated outcomes path. | Generation service, downstream agents. | Sensitive context copied into other tools. | Regenerable; must be labeled as derived and non-authoritative. |
| Executive JSON and exports | User-owned derived/exchange output | User | Filesystem under generated outcomes path. | Executive compiler, export adapters, external import tools. | Sensitive execution context copied into external tools. | Regenerable from normative baseline; must be labeled as derived/export snapshot. |
| Profile YAML contracts | Internal/profile contract; custom profiles may be confidential | Product maintainers / user for custom profiles | Bundled profiles or user-selected profile path. | Profile loader, validation, generation. | Malformed contracts, prompt manipulation. | Versioned; validated before use. |
| Local paths and repository metadata | Sensitive local metadata | User | Config, reports, errors. | Status, diagnostics, generation reports. | Logs/screenshots. | Redact where not necessary; avoid telemetry. |
| Validation and generation reports | Sensitive diagnostic data | User | Local state or generated report files. | Status, validation, generation. | May reference documents, paths, missing inputs. | Local/user-managed; no external reporting by default. |
| Provider prompts and normalized responses | Sensitive transient processing data | User / provider | In memory locally; remote provider processing when configured. | Provider adapter. | External provider retention/policy, prompt leakage. | Do not persist raw provider payloads by default; provider policy review required. |
| Logs and debug diagnostics | Sensitive operational metadata | User | Local only if enabled. | CLI/TUI, support workflows. | Secret or context leakage. | Minimal, redacted, user-controlled; no default external upload. |
| Package and release artifacts | Public/internal software supply-chain asset | Maintainers | npm/GitHub/CI. | Installation and updates. | Dependency compromise. | Release review and dependency scanning required. |

## Trust Boundaries

| Boundary | Data / Control Crossing | Trust Assumption | Required Controls |
| --- | --- | --- | --- |
| User terminal to TUI | Slash commands, free-text answers, confirmations. | The local OS user is authorized for the repository. | Parse commands strictly, preserve user input on failures, require explicit confirmation for risky actions. |
| TUI to application services | Command/query requests and operation results. | In-process boundary, but contracts still matter. | Zod validation, typed internal APIs, stable error envelopes. |
| Application services to filesystem | State reads/writes, generated Markdown, HTML, agent packs. | Filesystem permissions are OS-controlled; paths can be unsafe if mishandled. | Root containment, atomic writes, overwrite detection, partial failure reporting. |
| Application services to profile YAML | Phase/document contracts, output definitions, validation rules. | Bundled profiles are trusted product assets; custom profiles are untrusted data. | Schema validation, version checks, no code execution, clear profile errors. |
| Application services to remote AI provider | Bounded project context, prompts, normalized responses. | Provider is external and not inherently trusted. | Explicit configuration, disclosure, context preview, HTTPS where applicable, timeout, schema validation, redaction. |
| Application services to local AI provider | Prompts and responses through localhost endpoint. | Local provider is outside LOGOS process and may have its own storage/logging. | Provider mode labeling, endpoint validation, timeout, schema validation. |
| Application services to credential source | Token source reference in; raw token out in memory. | Environment/OS credential store is external. | Resolve only when needed, never expose raw value to TUI/state/logs, redact source metadata. |
| Generated outputs to browser/editor/Git | Markdown, Executive JSON, executive exports, HTML, agent packs. | User controls sharing, but derived outputs can leak context. | Escape HTML, label derived/export artifacts, no secrets, warn on overwrites/stale outputs. |
| Package install to local runtime | Executable dependency code runs on the user's machine. | Supply chain is a material risk. | Lockfile discipline, dependency review, secret scanning, release integrity checks. |

## Identity and Authentication

LOGOS Engine does not include product user accounts, sessions, cookies, JWTs, SSO, MFA, tenant identity, or admin login in the MVP. Authentication is mostly delegated to the local operating system and to external provider credential mechanisms.

| Identity Type | Authentication Model | Credential Lifecycle | Notes |
| --- | --- | --- | --- |
| Local user | OS user running the TUI in a repository directory. | Managed by the OS, shell, and filesystem permissions. | LOGOS does not verify human identity beyond local execution context. |
| Product admin | Not applicable in MVP. | None. | No hosted admin console or operator role exists. |
| Internal services/workers | Not applicable as network identities. | None. | Components run in a single local process. |
| Remote AI provider adapter | Provider API token resolved from env var or OS credential store. | Created, rotated, and revoked by user/provider. | Token source metadata may persist; raw token must not. |
| Local AI provider adapter | Local endpoint and optional credential if the provider requires one. | User-managed. | Treated as an external process, even on localhost. |
| Downstream agents consuming agent packs | No runtime authentication by LOGOS. | None. | Agent packs are files shared by the user, not live tool access grants. |
| CI/release maintainer | Outside product runtime. | Managed by repository/package infrastructure. | Relevant to release security, not end-user runtime auth. |

Unauthenticated surfaces are intentional: local commands are available to the OS user who launched the TUI. Provider authentication is integration authentication, not LOGOS account authentication.

## Authorization and Access Control

Authorization in the MVP is a local permission and consent model. The system authorizes operations based on repository boundary, configured documentation root, command intent, confirmation state, profile validity, and provider disclosure state.

| Actor | Operation | Object / Boundary | Required Authorization | Deny Behavior | Audit / Evidence |
| --- | --- | --- | --- | --- | --- |
| Local user | Read status, diagnostics, profile metadata. | Current repository and LOGOS state. | Local execution context. | Return state/profile errors without mutation. | Local status/diagnostic event. |
| Local user | Initialize workspace. | Internal LOGOS state. | Explicit command; destructive reinit requires stronger confirmation. | `confirmation_required` or existing-workspace message. | Workspace init record. |
| Local user | Change documentation root. | Generated output root. | Explicit confirmation; safe relative path. | `unsafe_path`, `path_conflict`, or `confirmation_required`. | Config change record with old/new root. |
| Local user | Generate Markdown, HTML, and agent packs. | Configured root, default `logos/`. | Explicit generation intent; overwrite confirmation when needed. | `write_denied`, `path_conflict`, `partial_generation`. | Generation report. |
| Local user | Confirm, revise, reject, or defer proposals. | Decision state. | Explicit review action. | `invalid_transition` or `confirmation_required`. | Decision transition record. |
| AI provider | Suggest/propose/draft/diagnose. | Proposed state only. | Provider call after consent; no write authority. | Invalid output rejected before mutation. | Provider operation result, redacted. |
| Provider adapter | Resolve token. | Credential source. | Internal operation only; provider configured. | `credential_missing`, `credential_inaccessible`, `unsafe_token_storage`. | Redacted credential resolution event. |
| Renderer | Write output files. | Configured root only. | Generation service authorization. | Unsafe paths denied; partial report returned. | Output manifest/generation report. |
| Downstream agent | Consume agent pack. | Derived file shared by user. | Outside LOGOS runtime. | No live authorization surface. | Output metadata only. |

There is no tenant, organization, server-side role, or object-level access model in the MVP. Future hosted or collaborative modes must define authentication, authorization, tenant isolation, audit logging, and deletion behavior before implementation.

## Service-to-Service Security

The MVP has no deployed service mesh, backend service calls, queues, workers, cron jobs, webhooks, or hosted internal APIs. Runtime components communicate in-process through typed application interfaces.

Even without networked services, internal boundaries still need controls:

- Application services must validate inputs and return stable errors instead of throwing raw implementation details into the TUI.
- Provider adapters are not trusted just because they are called by local code; their responses must be normalized and schema-validated.
- Filesystem adapters must enforce path safety and safe-write behavior.
- Credential adapters must expose raw secret values only to the provider call path and only in memory.
- Renderer components must escape generated HTML and avoid loading external assets by default.

If future versions introduce background jobs, webhooks, remote collaboration, hosted APIs, or sync services, this section must be replaced with service identity, mutual authentication, least privilege, replay protection, queue isolation, retry policy, rate limits, and operational audit requirements.

## Agent Security

LOGOS includes AI-assisted behavior and generated agent packs, but the MVP must not grant agents independent authority over durable project truth or filesystem side effects.

| Agent Surface | Allowed | Prohibited | Required Controls |
| --- | --- | --- | --- |
| AI intake/drafting | Ask questions, interpret answers, propose decisions, draft content, identify gaps. | Confirm decisions, authorize writes, bypass validation, store raw provider payloads as truth. | Proposal status, schema validation, explicit user review. |
| AI diagnostics | Explain validation gaps and suggest next actions. | Replace deterministic validation or mark validation passed. | Separate AI diagnostics from deterministic validation result. |
| Provider tools | Provider API call through adapter only. | Direct filesystem access, direct credential access, hidden network calls. | Provider abstraction, context preview, timeout, redaction. |
| Generated agent packs | Package context for downstream agents as derived files. | Include raw tokens, unrelated files, hidden prompts, or live tool credentials. | Derived labels, source references, no secret fields, regeneration metadata. |
| Future automation agents | Not in MVP. | Irreversible side effects without confirmation. | Future design must define sandboxing, permissions, audit, and rate limits. |

Prompt injection risk is handled by keeping profile YAML and user-provided content as data, validating provider output against internal schemas, and preventing provider text from directly executing commands or mutating state. Agent-readable context must remain bounded to the active phase/document and must not automatically include arbitrary source code, Git history, shell environment, or secrets.

## Integration Security

The only product-level external integration class in the MVP is AI provider access. LOGOS has no SaaS integrations, no external research APIs, no webhooks, no cloud sync, no telemetry endpoint, no payment provider, and no collaboration service.

| Integration | Credential / Scope | Shared Data | Security Controls | Review Needs |
| --- | --- | --- | --- | --- |
| OpenAI API | API token from env var or OS credential store. | Bounded project context, prompts, normalized responses. | Remote disclosure, HTTPS, timeout, redaction, schema validation, no raw token persistence. | Provider privacy/retention policy review before compliance claims. |
| Anthropic API | API token from env var or OS credential store. | Bounded project context, prompts, normalized responses. | Same as OpenAI. | Provider policy review. |
| OpenRouter API | API token from env var or OS credential store. | Bounded project context routed through aggregator. | Same controls plus clear aggregator disclosure. | Higher third-party routing ambiguity; user must understand endpoint trust. |
| Ollama | Local endpoint, usually no token. | Local prompts and responses. | Local-provider labeling, endpoint timeout, schema validation. | Local provider may log/cache outside LOGOS. |
| LM Studio | Local endpoint, usually no token. | Local prompts and responses. | Same as Ollama. | Local provider storage/logging review. |
| Custom OpenAI-compatible endpoint | User-defined token/endpoint. | Depends on endpoint. | Display endpoint class, require disclosure, validate responses, redact credentials. | User responsible for endpoint trust; no LOGOS compliance claim. |

External provider errors must be mapped to stable internal error codes and must not leak raw tokens, full prompts, or unredacted provider payloads. Provider streaming is deferred/review-needed; if added, raw chunks must not become durable project state and final structured output must still be validated before use.

## Data Classification

| Data Category | Classification | Storage | May Be Logged | May Be Sent to Remote Provider | Export / Output Handling | Retention |
| --- | --- | --- | --- | --- | --- | --- |
| Raw provider tokens | Secret | Not stored by LOGOS; env/OS credential source only. | No. | Used only as auth header/credential, never as prompt content. | Never included. | User/provider controlled. |
| Token source metadata | Secret-adjacent | Local config/state. | Redacted only. | No. | Redacted status allowed. | Until user changes provider config. |
| User answers/intake | Confidential project context | Local structured state. | Avoid full content; summaries only if needed. | Yes only after remote disclosure/consent and bounded context selection. | May appear in generated docs if relevant. | User-managed. |
| Confirmed decisions | Confidential project truth | Local structured state; Markdown outputs. | IDs/status allowed; content minimized. | Yes only if needed and disclosed. | Included in canonical docs and derived outputs. | User-managed. |
| Assumptions/questions/risks | Confidential project intent | Local state and outputs. | Minimized. | Yes only if needed and disclosed. | Included with caveat/status labels. | User-managed. |
| Generated Markdown | User-owned project output | `logos/` or custom root. | Paths/status only by default. | May be used as context after disclosure. | Primary rendered output. | User-managed. |
| Derived HTML | User-owned derived output | Generated outcomes path. | Paths/status only. | Not needed for provider prompts by default. | Regenerable, escaped HTML. | User-managed. |
| Agent packs | User-owned derived output | Generated outcomes path. | Paths/status only. | Not needed for provider prompts by default. | Regenerable; sensitive when shared. | User-managed. |
| Profile YAML | Contract data; custom profiles may be confidential | Bundled profile or custom path. | Path and validation errors only. | Minimal excerpts if needed and disclosed. | Not normally user export content. | Versioned. |
| Local paths | Sensitive local metadata | Config, reports. | Redacted or relative where possible. | Avoid unless needed and disclosed. | Generation reports may include relative paths. | User-managed. |
| Diagnostics/reports | Sensitive operational metadata | Local files/state. | Already diagnostic; redact secrets. | No by default. | User-controlled. | User-managed. |
| Telemetry/analytics | Not collected in MVP | N/A. | N/A. | N/A. | N/A. | N/A. |

## Data Minimization

LOGOS should collect the smallest durable state needed to guide documentation generation and validation.

Required data:

- active repository path and configured documentation root;
- active profile and profile version metadata;
- user-provided answers relevant to phase/document decisions;
- proposed and confirmed decisions, assumptions, questions, risks, and evidence links;
- validation findings and generation reports required to explain status and regenerate outputs;
- provider mode and redacted credential source metadata.

Data that must not be collected or persisted by default:

- raw provider API tokens;
- arbitrary source files unrelated to the active documentation task;
- full Git history;
- shell environment values beyond named credential source references;
- raw provider request/response payloads as durable state;
- behavioral analytics, usage telemetry, crash reports, or product tracking identifiers;
- hidden browser, editor, or terminal activity.

Minimization is enforced through bounded context builders, profile-scoped document contracts, provider disclosure, schema validation, redacted logs, and tests that prove default validation/generation runs without live network access.

## Encryption and Key Management

LOGOS must not overstate encryption guarantees.

| Area | MVP Position | Required Handling | Review Need |
| --- | --- | --- | --- |
| Data in transit to remote providers | Remote provider calls must use HTTPS or provider-supported secure transport. | Do not support plaintext remote API endpoints by default; show provider class. | Verify exact SDK/HTTP behavior per adapter. |
| Data in transit to local providers | Localhost HTTP may be used for Ollama/LM Studio. | Label as local provider; do not imply encrypted transport. | Review risks for non-local custom endpoints. |
| Local state at rest | LOGOS does not implement application-level encryption in MVP. | Rely on OS/filesystem protections; document that local files may be readable to local users/tools with filesystem access. | Decide whether field-level encryption is needed after user validation. |
| Generated Markdown/HTML/agent packs | Plaintext files by design. | Never include raw secrets; warn that outputs may be committed/shared by user. | Future export controls if enterprise usage appears. |
| Backups | User-managed through Git, filesystem, or OS backup tools. | LOGOS does not encrypt backups. | Backup security belongs to user environment or future operations doc. |
| Secrets | Raw tokens not stored by LOGOS in project files. | Prefer env vars initially; OS credential store support is provisional. | Select and validate cross-platform credential storage library. |
| Key management | LOGOS does not generate or manage encryption keys in MVP. | Provider tokens are user/provider managed. | Future hosted/collaborative modes must define key ownership, rotation, recovery, and revocation. |

## Secrets Management

| Secret / Credential | Storage | Runtime Access | Rotation / Revocation | Forbidden Locations | Incident Handling |
| --- | --- | --- | --- | --- | --- |
| Remote provider API token | Environment variable or OS credential store; never project config. | Resolved in memory by credential adapter for provider call. | User rotates/revokes through provider and updates source. | Project files, generated docs, logs, fixtures, screenshots, telemetry. | Stop provider use, remove leaked file/log, rotate token, add regression test. |
| Custom provider token | Same as remote provider token. | Same as above. | User/provider controlled. | Same as above. | Same as above, plus endpoint trust review. |
| Local provider credential if required | User-managed env/credential source. | Adapter-specific. | User/provider controlled. | Same as above. | Treat as secret leak. |
| CI/package credentials | Outside product runtime. | Release automation only. | Maintainer/platform controlled. | Source tree, fixtures, logs. | Revoke credential, rotate package token, audit release artifact. |
| OS credential store reference | Local config may store redacted reference only. | Used to locate secret, not reveal it. | User removes or updates credential. | Raw token field in config/state. | Clear reference if unsafe storage detected. |

Commands such as provider status and configuration display must show only redacted provider metadata. Error objects must never embed raw headers, tokens, provider request payloads, or full environment values.

## Secure Logging and Telemetry Privacy

The MVP has local diagnostics, not telemetry. There is no external analytics endpoint, crash reporter, session tracking, behavioral profiling, or product usage stream.

| Signal Type | Allowed | Forbidden | Retention / Access |
| --- | --- | --- | --- |
| Local operation events | Command name, status, safe error code, document id, relative output path, redacted provider mode. | Raw tokens, full prompts, raw provider responses, unrelated source code, full environment, hidden user activity. | Local/user-managed if persisted. |
| Validation findings | Rule id, severity, affected document, message, recommended action. | Secrets or full unrelated files. | Local reports/state. |
| Generation reports | Created/updated/skipped/failed outputs, root, partial failures, stale markers. | Raw generated content in logs unless explicitly requested by user. | Local/user-managed. |
| Provider diagnostics | Provider mode, timeout, status class, redacted token source. | Token values, auth headers, complete prompt/response payloads. | Local and minimized. |
| Security/audit events | Confirmation decisions, root changes, provider config changes, unsafe path denials, invalid provider output. | Sensitive payloads beyond what is needed to explain the event. | Local evidence for support/debugging. |
| Product telemetry | None in MVP. | Any automatic external analytics or crash reporting. | N/A. |

If support bundles are added later, they must be explicit user exports with preview, redaction, scope selection, expiration guidance, and no automatic upload.

## Backup Security

LOGOS does not operate backups in the MVP. Backup behavior is inherited from the user's filesystem, Git repository, editor, cloud-drive setup, or OS backup tools.

| Backup Source | Security Responsibility | LOGOS Requirement | Residual Risk |
| --- | --- | --- | --- |
| Git commits/remotes | User/repository host. | Do not write secrets into files that users may commit. | Generated docs may expose sensitive project context if committed. |
| OS filesystem backup | User/OS. | Document that local state and generated outputs are plaintext unless OS encrypts storage. | LOGOS cannot delete or encrypt existing backups. |
| Editor/IDE backups | User/tool. | Avoid secret persistence so tool backups do not capture secrets. | Manual edits and generated content may be copied by editor backups. |
| Future support export | LOGOS if implemented. | Must require explicit export, preview, redaction, and user-controlled delivery. | Not available in MVP. |

Restore authorization is outside LOGOS in the MVP because restore is performed through filesystem/Git tools. Future managed backup or sync features must define encryption, retention, deletion propagation, restore audit, and access control before implementation.

## Data Export

Current export behavior is file-based:

- canonical Markdown is generated under the configured documentation root, defaulting to `logos/`;
- derived HTML artifacts are generated under profile-defined outcomes paths;
- derived agent packs are generated under profile-defined outcomes paths;
- reports and diagnostics are local artifacts when generated.

These exports are user-controlled files, not hosted downloads. Authorization is the local user's explicit generation command and any required overwrite/root confirmation.

| Export Type | Included | Excluded | Safeguards |
| --- | --- | --- | --- |
| Generated Markdown | Confirmed documentation content, caveats, validation-relevant references. | Raw tokens, hidden provider payloads, unrelated files. | Path containment, overwrite confirmation, caveat labels. |
| HTML artifacts | Rendered view of generated documentation. | Raw tokens, external tracking, hidden remote assets. | HTML escaping, derived-output labeling, no telemetry scripts. |
| Agent packs | Bounded context for downstream agents. | Secrets, live credentials, unrelated repository content, execution authority. | Derived labels, source metadata, sensitivity warnings where appropriate. |
| Support/debug export | Not defined for MVP. | N/A. | Must be designed separately before implementation. |

Completeness guarantees are limited to the active profile, phase/document scope, and current local state. LOGOS does not provide formal privacy portability guarantees until legal/product review defines the requirement.

## Data Deletion

Deletion in the MVP is local and user-managed. The user can remove generated files, internal state directories, provider configuration references, and repository content using filesystem/Git tools.

| Data | MVP Deletion Behavior | Verification | Review Need |
| --- | --- | --- | --- |
| Generated Markdown/HTML/agent packs | User deletes files under `logos/` or custom root. | Filesystem/Git status. | Safe product command for cleanup may be added later. |
| Internal structured state | User deletes internal LOGOS state directory if they want to reset the project. | Next startup/status reports missing/uninitialized state. | Product reset command should define backup and confirmation behavior. |
| Provider token source reference | User changes/removes provider config. | Provider status shows unconfigured/redacted state. | OS credential deletion is handled outside LOGOS. |
| Raw provider token | Not stored by LOGOS in project files. | Secret scans and config tests. | User must revoke/delete token at provider or credential store. |
| Remote provider copies | Governed by provider policy. | Not verifiable by LOGOS. | Provider privacy policy and legal review required for formal claims. |
| Backups | User-managed. | Outside LOGOS. | No deletion propagation guarantee in MVP. |

LOGOS must not claim GDPR/CCPA deletion compliance or provider-side deletion guarantees without legal review and implementation evidence.

## Consent and User Rights

Product-level consent is required for actions that move data across trust boundaries or create risky side effects.

| Consent Event | When Required | Revocation / Change | Evidence |
| --- | --- | --- | --- |
| Remote provider use | Before project context is sent to a remote/custom provider. | Change provider to local/unconfigured; remove token source. | Provider config and context preview acceptance. |
| Documentation root change | Before changing from `logos/` to a custom root or between custom roots. | Change root again with confirmation. | Config change record. |
| Output overwrite | Before replacing existing files or resolving conflicts. | Cancel generation or choose skip/review. | Generation report. |
| Decision confirmation | Before proposed AI/user-derived content becomes confirmed state. | Revise/reject/defer through decision flow. | Decision transition record. |
| Destructive reset/repair | Before deleting or rewriting state. | Cancel or restore from user backup. | Operation event and confirmation. |
| Future support export | Before packaging diagnostics or project context for support. | Delete export locally; do not send. | Export manifest if implemented. |

User rights such as access, correction, export, deletion, restriction, objection, portability, and consent withdrawal are product behaviors or legal review topics depending on jurisdiction. For the MVP, LOGOS supports practical local access and correction because files and state live in the user's workspace, but it must not present this as formal legal compliance.

## Abuse Prevention

Because LOGOS is local-first and has no public API, many hosted abuse classes are not applicable in the MVP: spam, credential stuffing against LOGOS accounts, public scraping, tenant enumeration, and hosted DDoS are out of scope.

Material abuse and misuse cases still exist:

| Abuse Case | Surface | Control | False Positive / User Impact |
| --- | --- | --- | --- |
| Prompt injection attempts to force unsafe state mutation. | User/profile/provider text. | Schema validation, proposal-only AI, explicit confirmation. | Some legitimate unusual output may be rejected and require manual entry. |
| Unbounded provider calls create cost or rate-limit surprises. | AI provider adapter. | Timeout, clear pending status, no hidden calls, provider errors mapped to user guidance. | Conservative timeouts may require retry for slow local models. |
| Malicious profile requests excessive or sensitive context. | Custom profile YAML. | Profile schema validation, context preview, no arbitrary file ingestion by default. | Custom profile power remains limited until trust model matures. |
| Unsafe file paths attempt overwrite outside root. | Root config, renderer, profile output paths. | Path containment, `unsafe_path`, overwrite confirmation. | Some advanced path setups may be blocked until reviewed. |
| Secret leakage through screenshots/support artifacts. | TUI status, logs, reports. | Redaction, no raw tokens in output, local-only diagnostics. | Users may still share sensitive generated content manually. |
| Dependency compromise. | npm/package runtime. | Dependency review, lockfile, scanning, minimized dependency set. | Requires ongoing maintainer discipline. |

If future hosted features are added, rate limits, CAPTCHA/challenges, account lockout, bot detection, abuse monitoring, and escalation paths must be designed before launch.

## Security Testing

| Test Category | Method | Evidence | Cadence / Owner | Release Blocking |
| --- | --- | --- | --- | --- |
| Secret redaction | Unit and snapshot tests for config/status/errors/logs/generated outputs. | No raw token strings in state, logs, fixtures, Markdown, HTML, or agent packs. | Every relevant change; engineering. | Yes. |
| Path containment | Unit/integration tests for root config, renderer output paths, traversal, symlink review cases. | Unsafe paths denied; writes stay under configured root. | Every generation/filesystem change; engineering. | Yes. |
| Remote disclosure | Integration tests with fake providers. | Remote calls require configured provider and preview acceptance. | Provider/intake changes; engineering. | Yes. |
| No live network by default | Test environment blocks live providers/network unless explicitly opted in. | Default suite passes offline with mocks/fixtures. | CI/default local checks; engineering. | Yes. |
| AI output validation | Fixture provider tests for malformed, malicious, incomplete, and low-confidence output. | Invalid output rejected before state mutation. | Provider/prompt schema changes; engineering. | Yes. |
| Decision confirmation | State transition tests. | AI proposals cannot become confirmed without user review action. | Decision service changes; engineering. | Yes. |
| Deterministic validation separation | Validation tests with no provider configured. | Validation results do not depend on AI. | Validation changes; engineering. | Yes. |
| Profile schema safety | Bundled/custom/malformed profile fixtures. | YAML parsed as data, schema errors clear, no execution. | Profile loader changes; engineering. | Yes. |
| Generated output safety | Golden tests for Markdown, HTML, and agent packs. | Derived labels, no secrets, correct root, escaped HTML. | Renderer changes; engineering. | Yes. |
| Dependency and secret scanning | Package audit/scanner and repository secret scan. | No committed secrets; dependency findings triaged. | Release and dependency changes; maintainers. | High/critical findings block unless accepted. |
| Privacy regression | Tests/assertions for no telemetry endpoints, no hidden analytics, no automatic upload. | No external telemetry code path in MVP. | Observability/package changes; engineering. | Yes. |
| Manual threat review | Checklist against this document. | Updated risks and accepted residual risks. | Before MVP release and major architecture changes. | Required for release. |

Penetration testing is not claimed for the MVP. If a public API, hosted service, sync layer, or account system is introduced, security testing must expand to include authz testing, DAST, abuse testing, infrastructure scanning, and incident runbooks.

## Vulnerability Management

Vulnerability management is intentionally lightweight but must be explicit.

| Step | Behavior | Owner | Evidence |
| --- | --- | --- | --- |
| Intake | Vulnerabilities may be found through dependency scans, tests, code review, user reports, or maintainer review. | Engineering/maintainer. | Issue, finding, or local report. |
| Triage | Classify by affected asset, exploitability, user impact, and whether token/path/remote/provider/validation boundaries are involved. | Engineering owner. | Severity and release impact recorded. |
| Severity | Critical issues include raw token leaks, silent remote transmission, arbitrary writes outside root, AI confirmation bypass, or supply-chain compromise. | Engineering/product owner. | Release blocker unless fixed or formally accepted. |
| Remediation | Patch code, add regression tests, update docs if user behavior changes. | Engineering. | Test evidence and change summary. |
| Dependency updates | Review high/critical findings, update packages where safe, document accepted risk. | Maintainer. | Audit/scanner result. |
| Emergency patch | Stop unsafe release path, revoke exposed credentials if applicable, ship patch, communicate risk plainly. | Maintainer/product owner. | Incident note and regression test. |
| Disclosure | No formal public SLA is claimed yet. | Product owner. | Future security policy required before broader distribution. |

External SLA, bug bounty, security contact, and coordinated disclosure policies are review-needed before LOGOS makes public security-program claims.

## Incident Response

The MVP has no central operator visibility, so incident response is mostly a maintainer and user-guided process. Incidents are detected through local errors, tests, user reports, release checks, or repository review.

| Incident Type | Examples | Immediate Containment | Recovery | Communication / Review |
| --- | --- | --- | --- | --- |
| Credential leak | Token appears in config, log, fixture, generated output, or package. | Stop using provider, remove artifact, revoke/rotate token. | Patch redaction path, add regression test, review release artifacts. | Tell affected user to rotate token; no legal notification claims without review. |
| Unintended remote transmission | Project context sent without disclosure/consent. | Disable provider path, preserve evidence, stop release. | Patch consent gate, add provider-call test, review affected context. | Explain what data may have been sent; provider retention depends on provider. |
| Unsafe write/path traversal | Files written outside configured root or unexpected overwrite. | Stop generation, preserve report, advise restore from Git/backup. | Patch path resolver/write service, add traversal test. | Release note if shipped; product owner acceptance if residual risk remains. |
| State corruption/data loss | Invalid migration, interrupted write, malformed provider output mutation. | Stop mutation path, preserve broken state copy. | Restore from user backup/Git if possible, patch atomic/migration behavior. | Document recovery steps. |
| Package/dependency compromise | Malicious dependency or release artifact. | Unpublish/deprecate if possible, rotate maintainer credentials, warn users. | Patch dependency, publish fixed release, audit package. | Maintainer-led disclosure; external process review needed. |
| Privacy exposure through logs/support | Sensitive context included in diagnostics or export. | Delete artifact, stop export path, redact. | Patch logging/export rules, add snapshot tests. | Notify affected user when known. |

Incident evidence should include version, command, provider mode, redacted config, affected file paths, error code, generation/validation report, and reproduction steps. Evidence must not include raw tokens or unrelated repository files.

## Security and Privacy Risks

| ID | Risk | Affected Area | Mitigation | Residual Risk | Acceptance Owner | Release Impact | Target Document |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-RISK-001 | OS credential store support is provisional, so early users may rely on env vars. | Secrets management. | Never store raw tokens in project files; redact env source metadata. | Env vars may appear in shell history or process environments outside LOGOS. | Product/engineering owner. | Acceptable for MVP if documented; raw token persistence remains blocking. | Technical Stack, Deployment Plan. |
| SEC-RISK-002 | Local plaintext state and outputs may expose sensitive project context. | Data at rest, generated outputs. | Local-first transparency, no secrets in outputs, user-managed filesystem permissions. | Other local tools/users/backups may access files. | Product owner. | Acceptable for MVP; encryption claims blocked. | Data Model, Operations. |
| SEC-RISK-003 | Remote provider privacy varies by provider and cannot be controlled by LOGOS. | AI integrations. | Explicit configuration, disclosure, context preview, local-provider alternatives. | Provider retention/training policies remain external. | Product owner with legal review if claims are made. | Blocks compliance claims, not remote-provider MVP if disclosed. | Integration Architecture, Support Model. |
| SEC-RISK-004 | Agent packs may be shared with tools that over-trust or overexpose context. | Derived outputs/agents. | Label as derived, exclude secrets, include source/caveat metadata. | Downstream agents and user sharing are outside LOGOS control. | Product owner. | Acceptable with warnings; blocks any claim of agent sandboxing. | Frontend Architecture, Operations. |
| SEC-RISK-005 | Symlink and filesystem edge cases may bypass naive path checks. | Filesystem writes. | Normalize paths, containment checks, dedicated path tests, implementation review. | Cross-platform filesystem behavior can be subtle. | Engineering owner. | Release-blocking until tested. | Infrastructure Architecture, Test Strategy. |
| SEC-RISK-006 | Custom profiles may request sensitive information or shape unsafe prompts. | Profile system. | Schema validation, context preview, no code execution, profile provenance display. | Users can still choose untrusted profiles. | Product/engineering owner. | MVP bundled profile safe; custom profile UX needs review. | Profile System, Security Testing. |
| SEC-RISK-007 | No formal vulnerability disclosure/SLA exists yet. | Operations/security program. | Internal triage and release blocker rules. | External reporters may lack a clear path. | Product owner. | Acceptable before broad public launch; review before wider distribution. | Operations, Release Management. |
| SEC-RISK-008 | HTML artifact rendering may introduce XSS-like local content issues if escaping is weak. | Derived HTML. | Use safe renderer/escaping, no external scripts/telemetry, golden tests. | Browser execution context still matters when user opens files. | Engineering owner. | Release-blocking for HTML artifact generation. | Frontend Architecture, Test Strategy. |

## Downstream Handoff

Frontend Architecture must inherit:

- visible provider mode and remote transmission disclosure;
- confirmation flows for root changes, overwrites, destructive actions, and decision confirmation;
- clear status labels for proposed, confirmed, stale, invalid, derived, and partial outputs;
- redacted provider configuration/status display;
- no hidden telemetry or external assets in generated HTML artifacts.

Infrastructure Architecture must inherit:

- local filesystem boundaries, safe path resolution, atomic writes, and symlink review;
- no hosted backend, public API, queue, worker, sync, telemetry, or account infrastructure in the MVP;
- package/release supply-chain checks;
- OS credential store evaluation as provisional, not assumed complete.

Test Strategy must inherit:

- release-blocking tests for token redaction, no raw tokens in files, path containment, no hidden remote calls, remote disclosure, AI output validation, decision confirmation, deterministic validation, generated output safety, and no telemetry;
- default test suite must run without live AI providers or network;
- fixture providers must cover timeout, auth failure, invalid output, malformed JSON/schema, and rate-limit mapping.

Observability Plan must inherit:

- local diagnostics only by default;
- no analytics, crash reporting, hidden upload, behavioral tracking, or external telemetry;
- redaction rules for provider status, paths, prompts, responses, and logs;
- audit-style local events for risky operations without sensitive payloads.

Deployment and Release Management must inherit:

- secret scanning and dependency review before release;
- no package artifacts containing fixtures with tokens or sensitive project context;
- release blockers for token leaks, silent remote calls, unsafe writes, AI confirmation bypass, and validation/provider coupling;
- clear release notes for any provider, root, credential, or output behavior change.

Support Model, Incident Response, Risk Management, and Operations must inherit:

- support artifacts are local and user-controlled unless a future explicit export is designed;
- incidents involving tokens, unintended remote transmission, unsafe writes, state corruption, package compromise, or privacy exposure require containment and regression tests;
- legal/compliance notification obligations are review-needed and must not be invented by product docs;
- residual risks in this document must stay visible until accepted, mitigated, or routed to future scope.
