# Integration Architecture

## Integration Overview

LOGOS Engine has a narrow integration landscape in the MVP. It is a local-first TUI application running as a single Node.js process in the target repository. Its core value must remain useful without hosted services, accounts, cloud sync, telemetry, background workers, webhooks, or a public API server.

The integration posture is **ports-and-adapters first**:

- external AI/model providers are accessed only through provider-agnostic ports;
- local filesystem, profile YAML, environment variables, and optional OS credential stores are accessed through adapters;
- generated HTML artifacts and agent packs are file outputs, not live external integrations;
- Executive Axis exports are file or payload outputs generated from Executive JSON, not live bidirectional integrations;
- npm/GitHub release channels are distribution dependencies, not runtime product integrations;
- Git is a user workflow tool; LOGOS does not control Git operations in MVP.

Critical and important integrations:

| Integration Area | Classification | Why It Matters |
| --- | --- | --- |
| Local filesystem / repository | critical | Persists state, profile reads, generated documents, HTML artifacts, and agent packs. |
| AI provider abstraction | important / MVP | Enables AI-led intake, proposal extraction, gap/risk identification, and drafting when configured. |
| Environment variables / credential source | important / MVP | Resolves provider credentials without storing raw tokens in project files. |
| Profile YAML files | critical internal-file integration | Profile contracts drive document phases, outputs, quality checks, and validation. |
| npm package distribution | important operational dependency | Distributes the `logos` binary and bundled profiles. |
| GitHub Releases / repository hosting | provisional operational dependency | Supports release notes, source distribution, and open-source workflow, but is not required at runtime. |
| Browser rendering of HTML artifacts | supporting output compatibility | Generated HTML must render in evergreen browsers but is not a hosted web app. |
| Downstream agents consuming agent packs | supporting / validation-required | Agent packs package context for reviewers/builders, but agents cannot call LOGOS to mutate state. |
| Executive export adapters | supporting / post-baseline | Markdown, HTML, GitHub Issue-compatible files, and agent packs transfer execution structure without live sync. |

Excluded or deferred integrations:

- public HTTP API;
- hosted backend;
- cloud sync;
- user accounts/auth providers;
- telemetry/analytics platforms;
- webhooks;
- event streams;
- queues/workers;
- external research APIs;
- live project-management sync, CRM, marketplace, or collaboration integrations.

Highest-risk integration dependencies are AI providers and credential handling. Provider failures must not corrupt local state, provider schemas must not leak into domain logic, and remote provider calls must not happen without explicit user disclosure.

## Integration Inventory

| ID | Name | Provider | Integration Type | Status | Purpose | Product Capability | Criticality | Owner or Review Target | Contract Type | Data Flow Direction | Authentication Model | Authorization Scopes | Credentials Required | Sensitive Data Involved | Rate Limits | Timeout Policy | Retry Policy | Idempotency Policy | Fallback Behavior | Degraded Mode | Observability Requirements | Testing Strategy | Replacement Strategy | Risks | Downstream Implications |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-001 | Local Repository Filesystem | OS filesystem | platform/filesystem | MVP | Read/write state, profiles, generated docs, artifacts, packs. | workspace, status, generation, validation, recovery | critical | Infrastructure/Security/Data | File System Port | local read/write | OS filesystem permissions | N/A | no app credential | sensitive project state/content | local resource limits only | local operations should fail fast and clearly | retry only after explicit user action | safe writes/path+checksum where relevant | block unsafe writes; preserve state | read-only/recovery mode | local errors, generation reports, migration records | fixture filesystem, path traversal, permission, collision tests | Node filesystem adapter replaceable by equivalent port | unsafe writes, manual edit loss, corruption | Security, Test, Observability, Deployment |
| INT-002 | Profile YAML Source | bundled/local profile files | file/profile contract | MVP | Load profile, phase, document, output, and quality contracts. | profile-driven documentation and validation | critical | Profile/API/Test | Profile Loader Port | local read | none | N/A | no | low to sensitive for custom profiles | local only | fail on parse/validation | no retry except after file change | N/A | block dependent operations | profile-invalid mode | profile validation findings | profile fixtures, malformed YAML tests | YAML parser can be replaced behind adapter | schema drift, invalid custom profiles | Test, Release |
| INT-003 | AI Provider Abstraction | local or remote providers | model provider | MVP / provider choices review-needed | Generate questions, interpret answers, propose decisions, identify gaps/risks, draft content. | AI-led intake and drafting support | important; not required for deterministic core | Integration/Security | AI Provider Port | outbound prompt/context, inbound structured output | none for local; token/API key for remote if required | provider-defined; minimal | env/credential ref only | sensitive project context | provider-defined/unknown | default 60s; configurable to 180s | bounded retry review-needed; user-triggered retry safe | request/turn ids prevent duplicate state writes | no-provider mode; retry/reconfigure | AI unavailable mode | provider status, timeout/error category, redacted request metadata | mock provider, fixture provider, optional live tests | provider-agnostic adapters | outage, invalid output, rate limits, privacy, cost | Security, Test, Observability |
| INT-004 | Environment Variable Token Source | OS shell/environment | credential source | MVP | Resolve provider tokens without persisting raw tokens. | `/config ai`, provider calls | important | Security/Configuration | Credential Source Port | local read into memory | environment access | N/A | yes, externally stored | secret | N/A | immediate lookup | no retry | N/A | provider unavailable/missing credential | provider unconfigured/invalid | redacted status only | fake env source and secret leakage tests | OS credential store can supplement | token leak or missing env var | Security, Support |
| INT-005 | OS Credential Store | OS keychain/credential manager | credential source | provisional/review-needed | Optional safer provider token storage. | provider configuration | optional | Security/Infrastructure | Credential Source Port | local read into memory | OS credential auth | N/A | yes | secret | N/A | platform-dependent | no retry unless user fixes | N/A | env var fallback where configured | provider unconfigured/invalid | redacted status, lookup error class | fake credential source; platform tests if adopted | env var fallback; temporary session input | platform variance, support burden | Security, Infrastructure |
| INT-006 | Generated HTML Artifact Browser | user's browser | file output/runtime compatibility | supporting MVP | Let user open navigable HTML artifacts locally. | artifact review | supporting | Frontend/Integration | File output contract | local file read by browser | none | N/A | no | generated project content | N/A | N/A | N/A | N/A | Markdown/report remains available | artifact unavailable/stale | generation report, render failures | golden HTML tests and manual browser smoke | Markdown fallback | accessibility/rendering drift | Frontend, Test |
| INT-007 | Downstream Agent Pack Consumption | user-selected coding/review agents | file exchange | supporting / validation-required | Provide compact context to agents without chat history. | agent handoff | important but derived | Integration/Product | Agent Pack File Contract | outbound file generated locally | none enforced by LOGOS | user-controlled | no LOGOS credential | sensitive project context | N/A | N/A | regenerate rather than retry | output id/source refs | canonical docs remain source projection; structured state remains durable truth | agent pack stale/derived mode | generation report, source refs | golden pack tests and reviewer prompts | regenerate from canonical inputs | agents treat pack as authoritative or ignore caveats | Test, Support |
| INT-008 | npm Registry | npm | distribution | MVP operational | Install and update the `logos` binary package. | distribution | important operational | Deployment/Release | package distribution | package download | npm ecosystem | N/A | no product secret | package metadata/code | npm limits/policies unknown | outside runtime | user retries install/update | N/A | manual install/update guidance | install unavailable | release notes/checks | package smoke tests | source install/future binaries | registry outage, supply chain | Deployment, Release |
| INT-009 | GitHub Repository/Releases | GitHub | source/release platform | provisional operational | Host source, release notes, issues, and open-source workflow. | open-source distribution/support | optional runtime / important ops | Release/Support | operational platform | maintainer upload, user download/read | maintainer auth outside product | repo permissions | maintainer credentials outside product | public project metadata | GitHub limits/policies unknown | outside runtime | maintainer/user retry | N/A | npm/source fallback | release channel degraded | release checks/issues | release process tests/checklist | mirror/source archive | platform dependency | Release, Support |
| INT-010 | Git User Workflow | user's Git CLI/tools | external user workflow | outside product | Users may review/version generated files. | inspectability | supporting external | Product/Support | no product contract | user-controlled file reads/writes | user Git auth if any | external | no product credential | generated docs/state if committed | external | external | external | N/A | no product action | N/A | no hidden Git operations | documentation guidance | no direct integration | LOGOS must not assume Git commit status | Support |
| INT-011 | Executive Export Files | local filesystem / user-selected import tools | file exchange | post-baseline | Generate Markdown, HTML, GitHub Issue-compatible files, Linear/Notion payloads when supported, and agent packs from Executive JSON. | executive handoff | supporting | Integration/API/Test | Executive Export Adapter | outbound local file | none enforced by LOGOS | user-controlled import | no product credential | sensitive project context | N/A | local operation budget review-needed | regenerate rather than retry | output id/source refs | canonical docs and Executive JSON remain source; exports can be regenerated | export unavailable/stale | generation report, adapter errors | schema and golden export tests | adapter mappings can be replaced | stale exports, unsupported target confusion | API, Test, Operations |
| INT-012 | External Execution Tools | GitHub Issues, Linear, Notion, CSV/spreadsheets | external operational surface | deferred/planned for live sync | Users may import generated execution exports into tools that own daily execution. | implementation handoff | optional/deferred | Product/Integration | no live LOGOS runtime contract in MVP | user-controlled import/export outside LOGOS | tool-specific user auth outside LOGOS | external | no LOGOS credential | project execution data | external | external | external | N/A | no product action | N/A | no LOGOS status sync | documentation guidance | generated file fallback | users expect bidirectional sync | Product, Support |

## Integration Classification

| Classification | Decision Rule | Engineering Consequence |
| --- | --- | --- |
| critical | Core product cannot initialize, persist, validate, or generate without it. | Release-blocking tests, explicit recovery, safe failure behavior. |
| important | Primary value is degraded but deterministic core can continue. | Mock/fake required, degraded mode required, provider errors mapped. |
| supporting | Improves review, distribution, or handoff but not core state integrity. | Golden/smoke tests; fallback must be clear. |
| optional | Useful but not committed for MVP operation. | Must not block core workflows. |
| deferred | Candidate future integration requiring scope/architecture review. | Document assumptions only; no implementation dependency. |
| excluded | Contradicts current MVP scope or boundaries. | Must not be implemented without product scope change. |
| replaceable | Adapter or workflow can be swapped with bounded change. | Keep provider-specific code isolated. |
| hard-to-replace | Migration would affect state, user workflow, or operational model. | Require replacement trigger and exit plan. |

Current classification summary:

- **critical:** filesystem adapter, profile YAML source.
- **important:** AI provider abstraction, environment/credential source, npm distribution.
- **supporting:** HTML artifact browser compatibility, agent pack consumption, Git user workflow.
- **supporting/post-baseline:** Executive JSON and supported file exports.
- **deferred/excluded:** public APIs, webhooks, queues, hosted services, telemetry, external research APIs, cloud sync, auth providers, live project-management sync.

Classification affects release gates. Critical and important integrations need deterministic tests and failure simulation. Supporting integrations need golden/smoke tests. Deferred and excluded integrations must be called out so downstream documents do not silently add them.

## External Services

### AI Model Providers

AI providers are the only product-level external service class in the MVP. Supported provider categories are local providers, remote providers, and custom compatible endpoints. Exact provider SDK choices remain review-needed.

Provider capabilities used:

- structured conversation assistance;
- follow-up question generation;
- answer summarization;
- decision proposal extraction;
- assumption classification;
- gap and risk identification;
- document drafting support where configured.

Provider assumptions:

- local providers keep context on the user's machine, subject to the provider runtime;
- remote providers may process project context outside the user's machine;
- provider rate limits, retention, pricing, model behavior, API stability, and compliance posture vary and must not be treated as guaranteed;
- malformed provider output is expected and must be handled as a normal failure mode.

### Platform and Distribution Services

The OS filesystem, environment variables, optional OS credential store, npm registry, and GitHub are platform/operational services. They do not change product state semantics and must remain replaceable where feasible.

No external service provides canonical LOGOS state. Project state and generated outputs remain local by default.

## Integration Boundaries

Vendor-specific code is allowed only in adapter modules.

| Boundary | Allowed | Forbidden |
| --- | --- | --- |
| Domain layer | Provider-neutral concepts such as Proposal, Decision, Assumption, Validation Finding. | Provider SDK types, raw response payloads, model names, token logic, HTTP errors. |
| Application services | Provider-neutral ports, typed results, permission checks, redacted provider status. | Direct provider SDK calls, raw filesystem mutation from UI, raw token persistence. |
| Adapter layer | Provider SDKs/HTTP clients, filesystem APIs, YAML parser behavior, credential lookup details. | Confirming decisions, mutating domain state directly, bypassing schema validation. |
| TUI layer | Command/query results, redacted provider status, confirmation prompts. | Provider SDKs, raw credentials, direct filesystem writes. |
| Generated outputs | Rendered canonical/derived content with caveats and source labels. | Hidden tokens, unrelated repository content, raw provider internals. |

Anti-corruption rules:

- external provider responses are parsed into internal structured result schemas;
- provider errors map to stable internal error codes;
- provider confidence or fluency never becomes validation;
- provider-specific fields are ignored unless deliberately mapped;
- state changes pass through application services and domain transitions;
- generated files are outputs, not external integration state.

## Ports and Adapters

| Port | Domain-Facing Purpose | Adapter | Provider-Specific Concern | Allowed Dependencies | Forbidden Dependencies | Error Mapping | Timeout Policy | Retry Policy | Idempotency Policy | Mock or Fake | Test Contract | Replacement Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI Provider Port | Request structured AI assistance without provider leakage. | Local/remote/custom provider adapters. | endpoints, model names, auth, response shape, rate limits. | provider SDK/HTTP client inside adapter only. | domain mutation, UI, state writes. | timeout/auth/rate-limit/invalid-output to stable provider errors. | default 60s, configurable to 180s. | bounded/user-triggered; no unbounded retries. | request/turn ids; output remains proposal. | mock provider, fixture provider. | success, timeout, auth, rate limit, invalid output, malformed schema. | add providers by implementing port. |
| Credential Source Port | Resolve token source safely. | env var adapter; OS credential adapter review-needed. | platform credential APIs. | environment/OS APIs inside adapter. | project state raw token writes. | missing/inaccessible/unsafe source. | immediate lookup. | no automatic retry. | N/A. | fake credential source. | no raw token in state/logs/fixtures. | credential source can change without domain impact. |
| File System Port | Read/write files safely in workspace/root. | Node filesystem adapter. | OS path and permission behavior. | Node fs/path inside adapter. | TUI/domain direct writes. | unsafe path, permission, not found, conflict, parse. | local fail-fast. | explicit user retry only. | path+checksum/safe-write rules. | fixture/in-memory filesystem. | path traversal, collision, manual edit, corruption. | can swap implementation behind port. |
| Profile Source Port | Load/validate profile contracts. | YAML adapter. | parser behavior, file layout. | YAML parser, filesystem port. | executing profile code, mutating state. | missing/invalid YAML/invalid contract. | local fail-fast. | retry after file/profile change. | profile id/version. | fixture profiles. | valid/invalid profile contract tests. | profile format change requires migration. |
| Renderer Ports | Render Markdown, HTML, and agent packs. | Markdown/HTML/agent pack renderers. | output format details. | templates/serializers. | decision confirmation, provider calls for deterministic generation. | missing input, unsupported contract, render failed. | local operation budget review-needed. | no automatic hidden retry. | generation run/output ids. | golden renderers/fixtures. | golden outputs, caveat preservation. | renderer implementation replaceable. |
| Environment/Runtime Port | Read runtime metadata. | Node/process adapter. | Node, shell, platform differences. | Node process APIs. | domain logic hidden globals. | missing/unsupported runtime. | immediate. | no retry. | N/A. | fake runtime. | Node version/platform fixtures. | Deployment owns support matrix. |

## Contract Mapping

| Provider Contract | Internal Contract | Version | Mapped Fields | Transformations | Validation Rules | Error Mapping | Unsupported Provider Fields | Compatibility Risk | Update Monitoring |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Provider chat/completion request | `AI Provider Port` structured operation request | provider-specific / internal operation schema | prompt, context, model, timeout, output schema | internal prompt/context to provider payload | context minimized; schema expectation attached where possible | provider timeout/auth/rate-limit/unavailable | raw provider knobs not in internal contract | medium/high | provider adapter tests and release notes |
| Provider structured response | `IntakeResult` / proposal batch / draft result | internal schema version | generated questions, summaries, decisions, assumptions, gaps, risks, drafts | parse, validate, normalize, classify as draft/proposed/advisory | Zod validation before use | invalid output to `invalid_ai_output` | hidden chain-of-thought, raw token usage, provider metadata | high | fixture responses and schema tests |
| Provider auth failure | `ApiError` provider category | error schema version | provider code/message, redacted source | sanitize and normalize | no raw credential exposure | `provider_auth_failed` | full provider error body if sensitive | medium | adapter failure fixtures |
| Provider rate-limit response | `ApiError` provider category | error schema version | retry-after if safely available | normalize retry guidance | do not invent provider limits | provider/rate-limit error | proprietary quota metadata | medium | optional live/sandbox review |
| Local file read/write | File System Port result | internal schema version | path, operation, content/checksum | normalize path and enforce root | path safety and schema parse | `unsafe_path`, `write_denied`, `path_conflict` | OS-specific raw messages if noisy/sensitive | medium | cross-platform tests |
| YAML profile parse | Profile Load Result | profile schema version | profile id, phases, docs, outputs, checks | YAML to profile snapshot | schema-valid; no executable code | `invalid_yaml`, `invalid_contract` | parser internals | medium | profile fixtures |
| Agent pack artifact | Agent Pack file contract | artifact version review-needed | canonical context, caveats, source refs | compact, label, redact | caveat/source preservation | render failure to generation result | raw provider transcript, hidden state | medium | golden tests |

## Data Mapping

| Boundary | Outbound Data | Inbound Data | Persistence Rule | Redaction / Minimization | Lineage / Audit |
| --- | --- | --- | --- | --- | --- |
| AI Provider | selected project context, profile/document context, user input, constraints, output schema | structured questions, summaries, proposals, assumptions, gaps, risks, drafts | inbound data becomes proposal/advisory only after schema validation; raw provider internals minimized | send only necessary context; never send raw tokens; disclose remote transmission | session/turn refs, provider mode, operation id, redacted status |
| Credential Source | provider id/token source request | token in memory or redacted status | raw token never persisted | display source ref only | provider config changed/resolved redacted event |
| Filesystem | state/output writes | file contents, metadata, parse results | structured state is durable; outputs are generated; safe writes required | avoid writing secrets; output caveats preserved | generation reports, migration records, checksums if adopted |
| Profile YAML | profile path/id | profile contract snapshot | profile definitions remain contract source; not project truth | profiles are data, never executable | profile id/version/source path in state/report |
| Agent Pack | compact project context | none from agent in MVP | generated pack is derived and regenerable | exclude unrelated repo files and raw provider tokens | output record with source refs |
| Executive Export | Executive JSON and selected target mapping | none from external tool in MVP | generated export is derived and regenerable | include only source refs, acceptance criteria, dependencies, caveats, and metadata required by adapter | executive plan id, adapter id/version, source normative docs |
| npm/GitHub | package/release artifacts | package download/release metadata | no runtime product state | no project state included | release management records outside runtime |

Remote provider data must not be trusted because it came from a provider. It must be validated, normalized, and routed through user review and domain rules.

## Authentication with External Services

| Integration | Auth Mechanism | Credential Lifecycle | Expiration / Revocation | Security Handoff |
| --- | --- | --- | --- | --- |
| Local AI provider | often none or local endpoint-specific | user-configured endpoint/model | provider-specific | disclose local mode assumptions and endpoint risks |
| Remote AI provider | API key/token or compatible provider credential | read from environment variable or OS credential source; raw value never persisted | provider-specific; user rotates outside LOGOS | define token source, redaction, compromised credential guidance |
| Environment variable source | shell/runtime environment | user sets/removes variable | user-controlled | prevent logging raw values |
| OS credential store | OS-specific credential APIs | user/OS-managed | OS/provider-specific | review platform support and fallback |
| npm/GitHub operational accounts | maintainer-owned outside runtime | outside product | outside product | Deployment/Release owns maintainer credential process |

LOGOS does not create provider accounts, manage OAuth flows, or hold user sessions in MVP.

## Authorization and Scopes

LOGOS has no server-side role/scope authorization in MVP. External authorization is provider-specific and minimized.

| Integration | Scope / Permission | Least-Privilege Rule | Missing Permission Behavior |
| --- | --- | --- | --- |
| Remote AI provider | model invocation only | request only the credential capability needed for configured model endpoint | `provider_auth_failed` or provider unavailable guidance |
| Local AI provider | local endpoint access | do not assume network exposure is safe; user owns endpoint | provider unavailable/config guidance |
| OS credential store | read configured secret reference | read only named credential/token source | credential missing/inaccessible error |
| Filesystem | read/write configured workspace/root | operate only under repository and configured root policies | unsafe path/write denied/path conflict |
| npm/GitHub operations | maintainer release permissions | outside runtime; least privilege in Release Management | release process failure, not product runtime failure |

Provider permissions must not grant LOGOS authority to perform external research, send unrelated repository files, or mutate external systems.

## Credential Management

Credential management architecture:

- raw provider tokens are not stored in project files;
- token source metadata may be stored only when redacted and safe;
- default token source is environment variable, with `LOGOS_LLM_API_KEY` as a generic candidate and provider-specific aliases review-needed;
- OS credential store support is provisional and must be hidden behind the credential source port;
- CI/default tests must not require live credentials;
- compromised/invalid credentials produce provider configuration errors and no state corruption.

| Environment | Credential Policy |
| --- | --- |
| Local development | environment variables or fake credential source; no raw tokens in fixtures. |
| CI | no live provider credentials in default suite; optional integration tests must be separately configured. |
| User runtime | user-provided environment or credential source; redacted status display. |
| Sandbox/provider test | optional and provider-specific; no production data required. |
| Production hosted runtime | N/A; no hosted runtime in MVP. |

Emergency revocation is provider/user-managed: remove or rotate the external token source and clear LOGOS provider metadata if needed.

## Webhooks

LOGOS consumes and emits no webhooks in MVP.

| Webhook | Direction | Producer | Consumer | Event Types | Endpoint or Destination | Auth or Signature | Payload Schema | Validation Rules | Idempotency Key | Ordering Rule | Retry Rule | Replay Protection | Dead Letter Handling | Observability Events | Failure Behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Product webhooks | none | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | excluded |

Future webhook support requires a reopened API Contracts and Security Architecture review before implementation.

## Event Streams

External event streams are not used in MVP. Internal domain events exist only as local audit/history concepts and are not delivered through an event bus.

| Event Stream | Status | Delivery Guarantee | Notes |
| --- | --- | --- | --- |
| External provider events | excluded | N/A | AI provider calls are request/response through adapters. |
| Queue/event bus | excluded | N/A | No worker or queue runtime. |
| Domain audit events | MVP local concept | best-effort durable local record where implemented | Supports traceability, not event sourcing or external delivery. |
| Telemetry events | excluded | N/A | No analytics or telemetry by default. |

If event streams are introduced later, they must define envelope versioning, idempotency, ordering, replay, dead-letter handling, privacy classification, and migration policy.

## File and Batch Exchange

LOGOS uses local file exchange as its main non-provider integration mode.

| Exchange | Direction | Format | Validation | Partial Failure | Retention | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Profile loading | inbound local file | YAML | profile/schema validation | invalid profile blocks dependent operations | profile file user/package controlled | MVP |
| Structured state | local read/write | JSON | state schema validation | corrupted state enters recovery | local until user deletes | MVP |
| Canonical documents | outbound local file | Markdown | renderer/generation checks | generation report lists skipped/blocked/failed | user-owned files | MVP |
| HTML artifacts | outbound local file | HTML | renderer checks/accessibility review downstream | partial generation report | derived/regenerable | MVP |
| Agent packs | outbound local file | Markdown | caveat/source preservation | partial generation report | derived/regenerable | MVP |
| Executive JSON | outbound local file | JSON | executive schema validation and source document checks | blocked/failed executive report | derived exchange model | post-baseline |
| Executive Markdown snapshots | outbound local file | Markdown | adapter mapping and source traceability checks | partial export report | derived snapshot | post-baseline |
| GitHub Issue-compatible exports | outbound local file | Markdown | adapter mapping and metadata preservation | partial export report | user imports manually | post-baseline |
| Linear/Notion payloads | outbound local file | JSON/CSV or future API payload | adapter mapping when implemented | unsupported/planned until validated | user imports manually | planned |
| Import from external systems | inbound | N/A | N/A | N/A | N/A | excluded |
| Scheduled/bulk sync | bidirectional | N/A | N/A | N/A | N/A | excluded |

Generated outputs are written under the configured LOGOS documentation root, default `logos/`, not a hard-coded `docs/` folder.

## Rate Limits and Quotas

| Integration | Known or Assumed Limits | Handling | Status |
| --- | --- | --- | --- |
| Remote AI providers | provider-defined; unknown until provider selected | map rate-limit errors, preserve state, offer retry/reconfigure/no-provider path | review-needed by provider |
| Local AI providers | local resource limits; endpoint behavior varies | timeout, provider unavailable, user retry/reconfigure | review-needed |
| Filesystem | OS capacity/permissions/path limits | actionable filesystem errors; no silent corruption | MVP |
| npm/GitHub | platform-defined limits/policies | outside runtime; release/support guidance | operational |
| Webhooks/queues/server quotas | N/A | no hosted API | excluded |

The system must avoid retry storms. Rate-limit handling should prefer clear user feedback and explicit retry over hidden repeated calls.

## Retry Strategy

| Integration Class | Retryable Errors | Non-Retryable Errors | Backoff / Max Attempts | Escalation |
| --- | --- | --- | --- | --- |
| AI provider | timeout, transient unavailable, provider rate limit when safe retry guidance exists | invalid credentials, malformed output after validation, unsafe remote disclosure missing | bounded retry review-needed; user-triggered retry always acceptable | show retry/reconfigure/no-provider options |
| Credential source | transient OS access if known | missing credential, unsafe token source | no hidden retry | ask user to fix token source |
| Filesystem | transient permission/path availability only after user action | unsafe path, schema corruption, collision without confirmation | no destructive retry | recovery/diagnostics |
| Profile YAML | retry after file/profile changes | invalid schema/contract | no automatic retry loop | show validation errors |
| Renderer | retry after state/profile/input changes | unsupported contract or missing required input | no hidden retry | generation report |

Prohibited retry behavior:

- unbounded provider retries;
- retrying non-idempotent state writes blindly;
- retrying remote provider calls after disclosure was declined;
- hiding repeated failures behind a spinner;
- converting provider retry success into confirmed state without review.

## Idempotency

| Operation | Idempotency Requirement | Key / Scope | Behavior |
| --- | --- | --- | --- |
| Provider interpretation for an intake turn | required for persisted turn effects | session id + turn id/request id | duplicate provider result must not create duplicate confirmed/proposed records. |
| Provider test connection | not strict | provider config snapshot | repeated tests update status only. |
| File writes | required | target path + generation run/output id/checksum | same content can be no-op; changed existing file requires confirmation. |
| Generated output report | required per generation run | generation run id | duplicate run/report must not hide partial failure. |
| Credential resolution | not persisted side-effect | provider config snapshot | repeated lookup does not persist token. |
| Webhooks/queues | N/A | N/A | excluded. |

Idempotency storage is local and limited to state/generation/session metadata. There is no server-side idempotency-key cache.

## Timeouts and Circuit Breakers

| Integration | Timeout | Retry Policy | Backoff | Max Attempts | Retry Budget | Idempotency Requirement | Circuit Breaker Rule | Bulkhead Rule | Fallback | Degraded Mode | Escalation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI provider | default 60s; configurable to 180s | bounded/user-triggered | review-needed by provider | review-needed | avoid repeated hidden calls | turn/request scoped | conceptual: repeated failures mark provider unavailable | isolate provider calls from validation/generation state | no-provider mode | AI unavailable | prompt `/config ai`, retry, continue manually |
| Filesystem | local fail-fast; no long remote timeout | explicit user retry | N/A | N/A | N/A | safe-write/path scoped | N/A | all writes through adapter | recovery/read-only mode | state/root unavailable | diagnostics/recovery |
| Credential source | immediate or platform bounded | user fixes source | N/A | N/A | N/A | N/A | N/A | credential lookup isolated from state mutation | provider unconfigured | provider invalid | `/config ai` |
| Renderer | local operation budget review-needed | retry after input change | N/A | N/A | N/A | generation run scoped | N/A | render failure contained to output | partial generation report | output partial/failed | review report |

Circuit breakers are conceptual for MVP. A full circuit-breaker implementation is review-needed; the required behavior is that repeated provider failures do not freeze the TUI, corrupt state, or block deterministic commands.

## Fallback Strategy

| Failure Class | Fallback | User-Visible Behavior | Data Consistency Impact |
| --- | --- | --- | --- |
| AI provider unconfigured | no-provider mode | show `/config ai` guidance; allow status/validation/generation from existing state | no provider-derived proposals created |
| AI provider timeout/unavailable | preserve input and current state | offer retry, reconfigure, or continue manually | no confirmed state mutation |
| AI provider invalid output | reject/downgrade provider output | show safe error and ask for retry/manual clarification | malformed output not persisted as truth |
| Remote disclosure not accepted | block remote call | explain context movement and options | no remote data transfer |
| Missing/invalid credential | provider invalid mode | redacted credential status and recovery steps | no provider calls |
| Filesystem write conflict | skip/block/ask confirmation | show path and consequence | no silent overwrite |
| Profile invalid | block profile-dependent operations | show validation errors | state preserved |
| HTML artifact render failure | continue canonical Markdown where possible | partial generation report | derived artifact failed/stale only |
| Agent pack render failure | continue canonical docs where possible | partial generation report | derived pack failed/stale only |
| npm/GitHub unavailable | outside runtime | install/update/release guidance | no runtime state impact |

## Degraded Modes

| Mode | Trigger | Available Features | Disabled / Limited Features | Recovery |
| --- | --- | --- | --- | --- |
| No-provider mode | no AI provider configured | `/status`, `/validate`, `/diagnose`, `/generate` from existing state, `/config ai` guidance | AI-led intake/drafting that requires provider | configure provider or continue manually where supported |
| Provider-unavailable mode | timeout/auth/rate-limit/unavailable | local deterministic commands, saved input, retry/reconfigure | live AI operation | retry, reconfigure, wait, switch provider |
| Read-only/recovery mode | state invalid or filesystem write unsafe | diagnostics, state/profile error display, safe reads | mutation/generation writes | repair/migrate/confirm safe recovery |
| Profile-invalid mode | profile cannot load/validate | workspace status, profile diagnostics | profile-dependent validation/generation/intake context | fix/select valid profile |
| Partial-generation mode | some outputs fail or are skipped | generated successful outputs, report, retry | failed/stale outputs remain incomplete | fix cause and regenerate |
| Derived-output degraded mode | HTML/agent pack renderer fails | canonical Markdown generation/review | derived artifact/pack output | fix renderer/input and regenerate |

Degraded modes must be represented as expected product states, not as crashes.

## Vendor Lock-in Risks

| Integration | Lock-In Risk | Replacement Strategy | Replacement Trigger |
| --- | --- | --- | --- |
| Remote AI provider | prompt behavior, structured output quirks, pricing, rate limits, API deprecations | provider-agnostic port, fixture tests, provider presets | costs/privacy/provider reliability unacceptable |
| Local AI provider | local endpoint behavior and model capability variance | same provider port; capability metadata | local provider cannot meet schema/latency needs |
| YAML profile format | profile ecosystem and fixtures tied to YAML | schema versioning; future migration possible | YAML becomes limiting or unsafe |
| Node filesystem storage | JSON/file migration complexity | state repository port; future embedded DB trigger | state size/concurrency/migration complexity exceeds file model |
| npm registry | package distribution availability | source install, future alternative packages/binaries | npm availability/trust concerns |
| GitHub Releases | release/support discoverability | npm plus mirrored release notes/source archives | GitHub platform dependency becomes unacceptable |

Accepted lock-in for MVP: Node/npm/TypeScript ecosystem and filesystem JSON/YAML/Markdown are deliberate choices for local-first speed and inspectability.

## Mocking Strategy

| Integration | Mock / Fake | Scenarios | CI Requirement |
| --- | --- | --- | --- |
| AI provider | mock provider and fixture response provider | success, timeout, auth failure, rate limit, malformed response, invalid schema, low confidence | required; no live provider in default suite |
| Credential source | fake env/credential source | token present, missing, inaccessible, unsafe raw token attempt | required |
| Filesystem | fixture or in-memory filesystem | init, safe writes, path traversal, conflicts, corruption, permissions | required |
| Profile loader | profile fixtures | valid profile, invalid YAML, invalid contract, version mismatch | required |
| Renderers | golden fixtures | Markdown, HTML, agent pack, missing input, caveat preservation | required |
| npm/GitHub | release checklist/smoke, not runtime mocks | package content, install smoke | release pipeline |

Mocks must stay aligned with contracts through schema validation and fixture review. They should simulate failures aggressively enough that provider unavailability is not a surprise path.

## Sandbox and Test Environments

| Environment | Integration Behavior |
| --- | --- |
| Local development | fixture filesystem, mock provider, fake credentials by default; optional real provider manually configured. |
| CI | deterministic tests only by default; no live provider, no network, no raw tokens. |
| Optional provider integration tests | separately configured credentials; no production project data; non-blocking unless explicitly promoted. |
| Preview/staging | N/A for MVP; no hosted service. |
| Production runtime | user's local machine and chosen provider. |
| Provider sandbox | provider-specific and review-needed; do not assume availability. |

Test data must not include real user project secrets or raw provider tokens.

## Observability

Integration observability is local and privacy-preserving.

| Integration | Logs / Events | Metrics | Health Checks | Privacy Rule |
| --- | --- | --- | --- | --- |
| AI provider | provider status, operation id, timeout/error category, redacted provider id, optional provider request id if safe | counts/durations locally if logging enabled | `/config ai --test` or equivalent | no prompt dumps or raw tokens by default |
| Credential source | redacted source status, missing/inaccessible errors | none required | config status | never log secret value |
| Filesystem | path-safe errors, generation reports, migration records | optional durations/counts | startup/status checks | redact paths in support exports if needed |
| Profile loader | profile validation errors and version/source | validation counts | profile validation | custom profile content may be sensitive |
| Renderers | output status, skipped/blocked/failed categories | generation duration/counts optional | generation smoke/golden tests | generated content is user-owned |
| npm/GitHub | release checklist/status outside runtime | release process metrics optional | package smoke | maintainer operational data only |

No telemetry or analytics are collected by default. Observability Plan must define optional local debug logging and support bundle redaction, if adopted.

## Privacy and Compliance

Known concerns:

- remote AI provider calls may send sensitive project context outside the user's machine;
- provider terms, data processing, retention, residency, training use, and deletion behavior are provider-specific and review-needed;
- raw provider tokens are secrets and must never enter project files or generated artifacts;
- generated Markdown, HTML, and agent packs may contain sensitive project context and are user-owned local files;
- support/debug artifacts must be opt-in and redacted.

Explicit non-claims:

- LOGOS does not claim GDPR, SOC2, CCPA, HIPAA, or other named compliance status;
- local-first operation does not mean all providers are private;
- OS/filesystem encryption is not controlled by LOGOS in MVP;
- downstream agents receiving agent packs are outside LOGOS control.

Privacy rules:

- disclose remote transmission before remote provider use;
- minimize outbound provider context;
- do not send unrelated repository files, Git history, or arbitrary source code without future explicit inclusion contracts;
- keep deterministic validation usable without provider calls;
- preserve assumption and validation caveats in generated outputs and agent packs.

## Integration Risks

| Risk | Affected Integration | Risk Type | Source | Likelihood | Impact | Early Signal | Mitigation | Replacement or Exit Plan | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Remote provider receives sensitive project context unexpectedly. | AI Provider | privacy/trust | remote AI integration | medium | critical | provider call without disclosure/context preview | disclosure gate, minimization, redaction tests | local/no-provider mode | Security Architecture | release-blocking |
| Provider output schema changes or malformed response corrupts flow. | AI Provider | reliability/data | provider variability | medium | high | invalid structured output, proposal parser failures | schema validation and proposal-only state | switch provider/fixture update | Test Strategy | release-blocking |
| Provider outage blocks primary intake. | AI Provider | availability | external dependency | medium | medium/high | timeouts/unavailable errors | no-provider mode, retry/reconfigure | local/manual continuation | Frontend/Support | degrade gracefully |
| Raw token leaks into state, logs, fixtures, or generated files. | Credential Source / Provider Config | security | credential handling | low/medium | critical | token-like strings in `.logos/`, logs, fixtures | secret redaction schema/tests | revoke token and rotate source | Security Architecture | release-blocking |
| Filesystem unsafe path writes outside configured root. | File System Port | security/data integrity | local writes | low/medium | high | traversal/collision tests fail | path normalization/root checks | block write/change root | Security/Test | release-blocking |
| Agent packs are treated as authoritative source by downstream agents. | Agent Pack | trust/integration | derived artifact | medium | high | agent ignores caveats/source labels | derived labels, source refs, review prompts | regenerate/revise pack format | Integration/Test | release-blocking for packs |
| Mock provider diverges from real provider behavior. | AI Provider Test Doubles | test fragility | mocks/fixtures | medium | medium | live optional tests reveal gaps | fixture review, schema-first contracts | provider-specific adapter updates | Test Strategy | monitor/release risk |
| npm/GitHub disruption affects installation/releases. | Distribution | operational | external platform | low/medium | medium | install/release failures | release checklist, source fallback | alternate distribution if needed | Deployment/Release | not runtime blocking |
| External research integration appears through scope creep. | Excluded research APIs | product boundary | user demand/feature creep | medium | high | API keys or providers added for market/legal research | keep FR-040 exclusion; require scope review | manual evidence entry | Product/Risk | release-blocking if silent |

## Downstream Handoff

Security Architecture must inherit:

- remote provider disclosure and context minimization requirements;
- credential source rules, redaction, rotation/revocation guidance, and compromised credential behavior;
- no raw token persistence in project files, logs, fixtures, or outputs;
- path safety and overwrite confirmation for filesystem writes;
- provider privacy/compliance concerns without inventing legal conclusions.

Frontend Architecture must inherit:

- provider status, no-provider mode, provider-unavailable mode, and recovery actions;
- disclosure UI before remote provider calls;
- visible partial-generation and derived-output failure states;
- redacted provider/token status;
- user-facing distinction between local state, canonical Markdown, derived HTML, and agent packs.

Infrastructure Architecture must inherit:

- no hosted integration runtime, no queues, no webhooks, no API server, no telemetry service;
- Node filesystem/env/credential adapters as runtime boundaries;
- optional OS credential store support as provisional;
- npm/GitHub as distribution/release dependencies, not runtime services.

Test Strategy must inherit:

- mock provider and fixture response provider requirements;
- default tests with no live provider, no network, no credentials;
- provider failure tests for timeout, auth failure, rate limit, invalid output, malformed schema;
- filesystem path safety, safe-write, collision, manual-edit, and corruption tests;
- golden tests for Markdown, HTML artifacts, and agent packs.

Observability Plan and Support Model must inherit:

- local-only integration observability by default;
- redacted provider status and error categories;
- generation reports, validation findings, diagnostic reports, migration records, and provider status as support evidence;
- no hidden telemetry or analytics.

Deployment Plan and Release Management must inherit:

- npm package distribution dependency and package content checks;
- optional GitHub release note/source workflow;
- migration and compatibility review when provider contracts, state schemas, or profile schemas change;
- release-blocking gates for token safety, provider abstraction, no-live-provider default tests, and root path safety.

Unresolved integration questions:

- exact provider SDK versus generic HTTP-client strategy;
- exact supported provider list for MVP;
- OS credential store support timing and platform scope;
- whether optional live provider tests become part of release qualification;
- whether support exports need a formal schema;
- whether provider streaming is needed or should remain deferred.
