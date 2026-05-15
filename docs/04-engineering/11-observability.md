# Observability

## Observability Objective

LOGOS Engine observability must make local failures understandable without turning the product into a telemetry system. The MVP must help the user and maintainer answer:

- What command was run?
- What local state was read or changed?
- What failed, degraded, or became stale?
- What user-owned files were created, updated, skipped, blocked, or failed?
- Was the AI provider configured, unavailable, timed out, or rejected?
- Was project context sent remotely only after disclosure?
- Were secrets, raw tokens, prompts, provider payloads, and unrelated files kept out of logs and reports?
- What is the next safe action?

The maturity target for MVP is local diagnostic observability: structured command results, validation findings, diagnostics, generation reports, state/recovery labels, redacted provider status, and audit-style records for sensitive local actions. LOGOS does not have hosted observability, remote dashboards, external telemetry, SLO-backed operations, or centralized incident detection in the MVP.

Observability does not guarantee provider-side visibility, cloud uptime, legal compliance, managed backups, or automatic incident response. Those require future hosted architecture and operations design.

## Signal Taxonomy

| Signal | Purpose | MVP Position | Visibility | Notes |
| --- | --- | --- | --- | --- |
| Command result | Explain outcome and next action for slash commands. | Required. | User-visible/local. | Primary operational signal in TUI. |
| Status summary | Show repository, root, profile, provider, state health, progress, stale outputs. | Required. | User-visible/local. | `/status` is the main readiness signal. |
| Validation finding | Deterministic rule result with affected object and severity. | Required. | User-visible/local. | No AI dependency. |
| Diagnostic finding | Explain gaps, contradictions, risks, and next moves. | Required. | User-visible/local. | AI-assisted diagnostics are advisory when used. |
| Generation report | Show created, updated, skipped, blocked, failed, partial, stale, missing outputs. | Required. | User-visible/local. | Must distinguish canonical and derived outputs. |
| Audit event | Record sensitive state transitions and confirmations. | Required concept; exact storage format review-needed. | Local/support-visible. | Not telemetry. |
| Error result | Stable error code/message/recovery action. | Required. | User-visible/local. | Avoid raw stack/payload exposure. |
| Provider status/error | Show provider mode, availability, timeout/auth/malformed-output classes. | Required. | User-visible/local. | Redacted token source only. |
| Local debug log | Troubleshooting detail behind opt-in flag/config. | Optional/review-needed. | Local/support-visible. | Default produces no debug logs. |
| Metrics | Counters/timings for local performance and release testing. | Deferred/provisional. | Local/test-only if implemented. | No telemetry backend. |
| Traces | Cross-component timing/correlation. | Deferred. | Local/dev-only if implemented. | No distributed tracing in MVP. |
| Health checks | Startup/state/profile/provider health checks. | Local checks required; hosted endpoints N/A. | User-visible/local. | No liveness/readiness HTTP endpoints. |
| Alerts | Automatic operational alerting. | N/A for MVP. | N/A. | No hosted service or operator channel. |
| Dashboards | Operational/product/security dashboards. | N/A for MVP. | N/A. | Local reports/status replace dashboards. |
| Product analytics/business telemetry | Usage tracking and behavior analytics. | Prohibited by default. | N/A. | Requires future opt-in governance. |

Audit, diagnostics, and telemetry must not be confused. Audit records explain important local actions; telemetry would transmit usage data and is prohibited by default.

## Instrumentation Map

| Signal | Signal Type | Source | Purpose | Fields or Labels | Sensitivity Class | Cardinality Risk | Retention Rule | Owner | Dashboard | Alert Rule | Runbook | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WorkspaceInitialized | audit/event | `/init`, workspace service. | Prove workspace creation or existing-state refusal. | eventId, command, repository path/redacted path, profile id, root, outcome. | Local path metadata. | Low. | Local/user-managed. | Engineering. | None. | None. | Workspace recovery. | MVP |
| WorkspaceStateReadFailed | error/event | Startup/status/state reader. | Diagnose corrupt or missing state. | error code, state category, schema version, safe file ref. | Sensitive local metadata. | Low. | Local/user-managed. | Engineering. | None. | None. | State recovery. | MVP |
| ProfileValidationFailed | validation/error | Profile loader. | Explain invalid profile contract. | profile id/path, schema error summary, affected document id. | Profile metadata. | Medium if full paths included. | Local. | Engineering. | None. | None. | Profile repair. | MVP |
| ProviderConfigured | audit/event | `/config ai`. | Trace provider mode/config changes. | provider mode, endpoint class, model id if safe, redacted token source, outcome. | Secret-adjacent. | Low. | Local. | Engineering/security. | None. | None. | Provider setup. | MVP |
| RemoteProviderDisclosureAccepted | audit/event | Provider/intake flow. | Prove remote context consent. | provider mode, session id, disclosure version, accepted true/false. | Sensitive metadata. | Low. | Local. | Product/security. | None. | None. | Privacy incident. | MVP |
| ProviderCallFailed | error/event | Provider adapter. | Explain timeout/auth/unavailable/malformed output. | provider mode, error class, timeoutMs, operation id, retryable flag. | Secret-adjacent. | Medium. | Local; no raw payload. | Engineering. | None. | None. | Provider recovery. | MVP |
| ConversationTurnRecorded | audit/event | Intake/conversation service. | Preserve continuity and source traceability. | session id, turn id, actor, status, source refs. | Sensitive project context. | Medium. | Local; retention review-needed. | Engineering/product. | None. | None. | Intake recovery. | MVP |
| DecisionTransitioned | audit/event | Decision service. | Trace confirmation/revision/rejection/defer. | decision id, prior status, new status, actor type, source refs, affected docs. | Sensitive project intent. | Medium. | Local; retain with decision. | Engineering/product. | None. | None. | Decision recovery. | MVP |
| ValidationRunCompleted | report/event | Validation service. | Show deterministic readiness. | run id, profile version, severity counts, affected docs, blocking status. | Sensitive refs possible. | Low. | Local latest/history optional. | Engineering. | None. | None. | Validation remediation. | MVP |
| DiagnosticsCompleted | report/event | Diagnostics service. | Explain gaps and next action. | run id, severity counts, affected docs, next action. | Sensitive project context. | Low/medium. | Local latest/history optional. | Engineering/product. | None. | None. | Support diagnosis. | MVP |
| GenerationCompleted | report/event | Generation service. | Explain output writes and partial failures. | run id, root, output kind counts, file statuses, source refs. | Local path/project metadata. | Medium. | Local latest/history optional. | Engineering. | None. | None. | Generation recovery. | MVP |
| OutputManualEditDetected | event/finding | Generation/status service. | Prevent silent overwrite. | output id/path, kind, checksum/mtime state, source refs. | Local path metadata. | Medium. | Local. | Engineering. | None. | None. | Manual edit recovery. | Review-needed |
| UnsafePathDenied | security event | Root/generation filesystem guard. | Prove path containment. | requested path category, root, normalized-safe reason, command. | Local path metadata. | Low. | Local. | Engineering/security. | None. | None. | Security incident. | MVP |
| DebugLogEntry | log | Opt-in debug logging. | Troubleshooting. | level, timestamp, operation, safe error code, redacted context. | Sensitive if mishandled. | Variable. | Local/short-lived if implemented. | Engineering. | None. | None. | Support. | Deferred/review-needed |

Blind spots: there is no central operator view, no automatic alerting, no provider-side trace, no external telemetry, and no proof of user environment health beyond local command results.

## Logging Strategy

Default MVP behavior should not emit persistent debug logs. Local logs are optional and must be opt-in.

| Log Type | Level | Source | Required Fields | Optional Fields | Forbidden Fields | Correlation Fields | Redaction Rules | Sampling Rule | Retention Rule | Access Rule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Command log | info/warn/error | Command handler. | timestamp, command, status, error code if any. | operation id, duration. | user answers, raw prompt, raw response, token, full env. | operation id/session id. | Redact token source; avoid full paths unless needed. | No sampling if local and opt-in. | User-managed local. | Local user only. |
| Provider log | info/warn/error | Provider adapter. | provider mode, operation, status, timeoutMs, retryable. | redacted provider id/model. | token, auth header, prompt, raw response, request body. | provider operation id/session id. | Token source redacted; payload excluded. | No sampling for failures. | User-managed local. | Local user only. |
| State log | warn/error | State reader/writer. | state category, schema version, outcome, safe error code. | relative file ref. | full sensitive state payload. | operation id. | Do not dump JSON contents. | No sampling for failures. | User-managed local. | Local user only. |
| Generation log | info/warn/error | Generation service. | run id, root, output counts, status. | relative output paths. | generated document body, secrets. | generation run id. | Paths relative to root where possible. | No sampling for failures. | User-managed local. | Local user only. |
| Security/privacy log | warn/error | Permission/path/credential guards. | event type, outcome, reason, command. | redacted target/category. | secret values, prompt payloads, sensitive project content. | operation id. | Mandatory redaction. | Never sample away if implemented. | User-managed local. | Local user only. |

Log levels:

- `info`: successful high-level local operation when debug logging is enabled.
- `warn`: recoverable degradation such as stale output, provider unavailable, skipped output, manual edit detected.
- `error`: failed command, invalid state/profile, unsafe path, rejected provider output, write failure.
- `debug`: detailed developer-only signal; disabled by default and still redacted.

## Metrics Strategy

There is no runtime metrics pipeline in MVP. Metrics are local/test/release signals if implemented.

| Metric | Type | Source | Purpose | Labels | Cardinality Risk | Aggregation | Unit | SLI Related | Alert Related | Dashboard | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| command.duration | histogram | Command wrapper. | Detect slow startup/status/generation. | command, outcome. | Low. | local/pre-release. | ms. | Internal local performance. | No. | Deferred. | Engineering |
| validation.findings.count | gauge/counter | Validation service. | Summarize readiness by severity. | severity, profile id. | Low. | per run. | count. | Internal quality. | No. | Status/report. | Engineering |
| generation.outputs.count | counter | Generation service. | Summarize created/updated/skipped/failed/stale outputs. | output kind, status. | Low. | per run. | count. | Internal reliability. | No. | Generation report. | Engineering |
| provider.call.duration | histogram | Provider adapter. | Understand provider timeout/performance. | provider mode, outcome. | Medium if provider ids vary. | local only. | ms. | Internal provider health. | No. | Deferred. | Engineering |
| provider.failures.count | counter | Provider adapter. | Diagnose timeout/auth/malformed output rates in local reports. | error class, provider mode. | Low. | per session/run if recorded. | count. | Internal reliability. | No. | Deferred. | Engineering |
| state.read.failures.count | counter | State reader. | Detect state corruption/recovery needs. | state category, error class. | Low. | local. | count. | Internal reliability. | No. | Status/report. | Engineering |

Business metrics, product analytics, usage funnels, retention metrics, and behavioral telemetry are prohibited by default. High-cardinality labels such as full file path, raw document id from custom profiles, prompt text, user input, or provider request payload are not allowed.

## Tracing Strategy

Distributed tracing is not applicable in MVP because LOGOS runs as a local single-process TUI with optional provider calls and no hosted backend, queues, workers, or webhooks.

Trace-like local correlation may be useful later:

| Trace Area | Root Span | Child Spans | Propagation Format | Required Attributes | Forbidden Attributes | Sampling Rule | Correlation Fields | Retention Rule | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Command execution | command operation id. | state read, provider call, validation, generation write. | local operation id. | command, outcome, duration, safe error code. | prompt text, raw response, token, full state. | Keep failures if opt-in tracing exists. | operation id, session id, generation run id. | Local/user-managed. | Engineering |
| Provider call | provider operation id. | request prepare, remote call, response validation. | provider operation id only. | provider mode, timeoutMs, result class. | token, auth header, full request/response. | Keep failures only if implemented. | session id, provider operation id. | Local/user-managed. | Engineering |
| Generation | generation run id. | plan, render, safe write, report. | generation run id. | root, output kind, result counts. | document body/secrets. | Keep per run in report. | source refs, output ids. | Local/user-managed. | Engineering |

If future hosted mode exists, tracing must be redesigned with a standard propagation format and cross-service privacy rules.

## Error Reporting

MVP error reporting is local command/report output, not automatic upload.

| Error Class | Capture Point | Enrichment | Grouping | Owner | User Impact | Retryability | Incident Link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| State invalid/corrupt | Startup/status/state read. | state category, schema version, safe file ref. | state error code. | Engineering. | Blocks unsafe mutation. | Retry after repair/migration. | State corruption incident if widespread. |
| Profile invalid | Profile loader/generation preflight. | profile id/version/path category, schema summary. | profile error. | Engineering/profile owner. | Blocks validation/generation. | Retry after profile fix. | Release issue if bundled profile. |
| Provider timeout/auth/unavailable | Provider adapter/intake. | provider mode, timeoutMs, redacted source, retryable flag. | provider error code. | Engineering/integration. | AI action degraded. | Retry/reconfigure/no-provider. | Privacy/security if token leakage involved. |
| Invalid AI output | Provider response parser. | operation id, schema error summary. | invalid_ai_output. | Engineering. | Proposal not used. | Retry/continue manually. | Release blocker if state mutates. |
| Unsafe path/write denied | Filesystem adapter/generation. | root, path category, operation, safe reason. | path/write error. | Engineering/security. | Output blocked/partial. | Fix root/permissions/regenerate. | Security incident if write escapes root. |
| Render/generation failure | Renderer/generation service. | document id, output kind, stage. | render_failed/partial_generation. | Engineering. | Output missing/partial. | Fix state/profile/renderer and rerun. | Release issue if canonical docs fail. |
| Validation/diagnostics failure | Validation/diagnostics service. | rule id/service stage, safe message. | validation/diagnostic error. | Engineering. | User loses guidance. | Rerun after fix. | Release issue if core validation unavailable. |

Error reports must never include raw provider tokens, auth headers, full prompts, raw provider payloads, unrelated source files, or full sensitive state dumps.

## Audit Events

Audit events are local traceability records for important actions. Exact physical storage belongs to Data Model/Infrastructure, but the required event shape is architectural.

| Event | Category | Actor | Target | Action | Outcome | Source | Reason | Metadata | Timestamp | Retention Rule | Access Rule | Immutability Expectation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WorkspaceInitialized | state | local user/system | workspace | create/detect existing | created/exists/failed | `/init` | workspace setup | profile id, root, schema version | required | local/user-managed | local user | append or record history where practical |
| DocumentationRootChanged | permission/state | local user | root config | change | accepted/rejected | root config command | output location | old/new root, stale impact | required | local | local user | preserve change evidence |
| ProviderConfigured | security/integration | local user | provider config | configure/test | accepted/failed | `/config ai` | AI setup | provider mode, redacted token source | required | local | local user | preserve current config history where practical |
| RemoteDisclosureAccepted | privacy | local user | provider operation/session | accept/reject disclosure | accepted/rejected | intake/provider flow | remote context consent | disclosure version, provider mode | required | local | local user | must be inspectable |
| ConversationTurnRecorded | state | local user/provider/system | session | record turn | saved/failed | intake | continuity | session id, turn id, actor, status | required | local retention review-needed | local user | source refs preserved or summarized |
| DecisionTransitioned | audit/data | local user | decision | confirm/revise/reject/defer/supersede | success/failed | decision service | user review | prior/new status, affected docs | required | retain with decision | local user | no silent overwrite |
| ValidationRunCompleted | quality | system | validation run | validate | complete/failed | `/validate` | readiness | severity counts, profile version | required | latest required/history optional | local user | snapshot can be superseded |
| GenerationRunCompleted | output | system/local user | output set | generate | complete/partial/failed | `/generate` | render docs | root, output counts, source refs | required | latest required/history optional | local user | report preserved until superseded |
| UnsafePathDenied | security | system | filesystem path | deny write/root | denied | path guard | root safety | path category, root, command | required | local | local user | security evidence |
| DestructiveActionConfirmed | permission | local user | state/output | confirm destructive action | accepted/cancelled | confirmation flow | user consent | action id, affected object category | required when implemented | local | local user | must be inspectable |

Audit events must be payload-minimized. They are for local investigation, not behavioral analytics.

## Health Checks

MVP health checks are local command checks rather than HTTP endpoints.

| Check | Type | What It Proves | What It Does Not Prove | Failure Behavior | Status |
| --- | --- | --- | --- | --- | --- |
| TUI startup check | startup/local | CLI/TUI can start in a repository context. | Does not prove profile/state validity. | Show help/orientation or startup error. | MVP |
| Workspace state check | readiness/local | `.logos` state exists and validates enough for commands. | Does not prove generated outputs are fresh. | Recovery-needed; block unsafe mutation. | MVP |
| Profile check | readiness/local | Active profile YAML/schema can load. | Does not prove every doc is complete. | Block validation/generation dependent on profile. | MVP |
| Provider config check | dependency/local/remote optional | Provider mode and redacted config are present; optional test can reach provider. | Does not prove provider privacy/quality/cost. | Mark unavailable/unconfigured; local commands continue. | MVP |
| Validation check | quality/local | Deterministic rules can run. | Does not prove AI content quality. | Report validation failure or service error. | MVP |
| Generation check | output/local | Renderer can produce files under configured root. | Does not prove docs are externally validated. | Partial/failed generation report. | MVP |
| Telemetry health | N/A | No telemetry pipeline exists. | N/A. | N/A. | Excluded |
| Hosted liveness/readiness | N/A | No hosted service exists. | N/A. | N/A. | Excluded |

Deployment health checks for package release belong to Deployment Plan and Release Management.

## SLOs, SLIs, and Error Budgets

LOGOS MVP should not publish external SLOs. Internal provisional SLO-style targets can guide release testing.

| SLO | User Outcome | SLI | Target | Measurement Window | Error Budget | Burn Rate Alerts | Exclusions | Reporting Cadence | Release Impact | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local status responsiveness | User can understand state without waiting. | `/status` local execution time. | Provisional `< 500ms` from NFR-PERF-003. | Pre-release test runs. | Not formal. | None. | Very large/corrupt state. | Release checklist. | Review/block if clearly unusable. | Engineering |
| Provider timeout bound | User is not trapped by provider calls. | Provider call timeout behavior. | Default 60s, configurable to 180s. | Provider fake/optional live check. | Not formal. | None. | Provider-specific outages. | Release checklist. | Release-blocking if timeout corrupts state. | Engineering |
| No-provider local operation | User can work locally without remote AI. | Status/validate/generate with valid local state and no provider. | 100% for required local commands. | Default test suite. | No budget for regression. | None. | AI-only drafting actions. | PR/release. | Release-blocking. | Engineering |
| Safe generation | User can see created/updated/skipped/failed outputs. | Generation report completeness. | 100% of generation attempts report outcome categories. | Tests/release. | No budget for silent failure. | None. | Renderer feature deferred explicitly. | Release checklist. | Release-blocking for silent failure. | Engineering |

Error budgets and burn-rate alerts are N/A until LOGOS has hosted services or operational metrics.

## Alerts

Automatic alerts are not part of the MVP because there is no hosted service, telemetry backend, or operator duty cycle.

The equivalent MVP "alerts" are user-visible blocking/warning states:

| Alert | Severity | Symptom | Signal Source | Threshold or Rule | Duration | Route | Escalation | Expected Action | Linked Dashboard | Linked Runbook | Suppression Rule | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| StateRecoveryNeeded | high | State cannot be parsed/validated. | State read error. | Any unsafe state read failure. | Immediate. | TUI/status. | Support if user cannot repair. | Stop mutation, show recovery guidance. | None. | State recovery. | Do not suppress. | Engineering |
| ProviderUnavailable | medium | AI action cannot proceed. | Provider adapter/status. | Timeout/auth/unavailable. | Per operation. | TUI. | Provider setup support. | Retry/reconfigure/no-provider. | None. | Provider setup. | Deduplicate in same command. | Engineering |
| UnsafePathDenied | high | Root/write escapes allowed boundary. | Path guard. | Any unsafe path. | Immediate. | TUI. | Security review if bug. | Deny write, choose safe root. | None. | Filesystem safety. | Do not suppress. | Engineering/security |
| GenerationPartialFailed | medium/high | Some outputs failed. | Generation report. | Any failed/blocked output. | Per generation. | TUI/report. | Support if persistent. | Review failed files, fix, rerun. | None. | Generation recovery. | Group by run. | Engineering |
| RemoteDisclosureRequired | high/privacy | Remote call attempted without consent. | Provider permission gate. | Consent missing. | Immediate. | TUI. | Privacy review if bypassed. | Block call, show disclosure. | None. | Privacy incident. | Do not suppress. | Product/security |

Future hosted mode must define real alert routes, severity, responder, escalation, dashboards, and runbooks before launch.

## Dashboards

Hosted dashboards are excluded in MVP. Local status and reports serve the dashboard role.

| Dashboard | Audience | Purpose | Panels | Signal Sources | Linked Alerts | Linked Runbooks | Refresh Cadence | Owner | Maintenance Cadence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/status` view | User/founder | Understand workspace, root, profile, provider, progress, next action. | State health, provider status, decisions/progress, stale outputs. | Local state, profile, output metadata. | User-visible warnings. | Status recovery. | On command. | Engineering/product. | Each UX change. |
| `/validate` report | User/engineering | Determine deterministic readiness and blockers. | Findings by severity/affected object. | Validation service. | Blocking findings. | Validation remediation. | On command. | Engineering. | Rule changes. |
| `/diagnose` report | User/engineering | Explain gaps, contradictions, risks, next conversational moves. | Findings, next action, affected docs. | Diagnostics service + validation. | Critical/error findings. | Diagnostic remediation. | On command. | Engineering/product. | Diagnostics changes. |
| Generation report | User/engineering | Understand output writes and partial failures. | Created/updated/skipped/blocked/failed/stale/missing. | Generation service/output records. | Partial/failed generation. | Generation recovery. | On `/generate`. | Engineering. | Renderer changes. |
| Release evidence checklist | Founder/engineering | Validate release readiness. | Test gates, security/privacy checks, manual acceptance. | Testing strategy outputs. | Release blockers. | Release management. | Pre-release. | Product/engineering. | Each release. |

No executive/product analytics dashboard exists because product analytics are prohibited by default.

## Incident and Runbook Hooks

MVP incidents are user/maintainer-reported, not automatically detected. Observability should still provide enough local evidence to investigate.

| Signal | Incident Hook | Context To Attach | First Diagnostic Action | Runbook Target |
| --- | --- | --- | --- | --- |
| Raw token found in state/output/log | Security/privacy incident. | file category, command, provider mode, redacted source, version. | Stop provider use, rotate token, remove artifact, add regression test. | Incident Response, Security. |
| Remote provider called without disclosure | Privacy incident. | operation id, provider mode, disclosure state, context category. | Disable path, inspect what may have been sent, patch gate. | Incident Response, Privacy. |
| Unsafe write outside root | Security/data-loss incident. | command, root, normalized path category, output kind. | Stop generation, preserve report, patch containment. | Filesystem safety. |
| State corruption after command | Reliability incident. | command, state category, schema version, error code. | Preserve state copy, identify last write/migration, restore/repair. | State recovery. |
| Generation silently loses/overwrites content | Data-loss incident. | generation run id, output paths, overwrite confirmation state. | Stop regeneration, inspect report/checksum, restore from Git if possible. | Generation recovery. |
| Provider failure corrupts state | Reliability/security incident. | provider error class, session id, affected state refs. | Confirm prior state, patch reject-before-mutate path. | Provider recovery. |
| Bundled profile invalid | Release incident. | profile id/version, schema errors, affected docs. | Block release, patch profile, rerun contract tests. | Release Management. |

Runbook procedures belong to Operations and Incident Response. This document defines what evidence must exist.

## Privacy-Safe Telemetry and Sensitive Data Rules

Default telemetry is prohibited. Observability data must be local, minimized, and redacted.

Never collect or log:

- raw AI provider tokens, auth headers, API keys, or secret values;
- full prompts, full provider responses, or raw provider payloads;
- unrelated repository source files or Git history;
- full user answer text in debug logs;
- full generated document bodies in logs;
- environment dumps;
- telemetry identifiers, behavioral profiles, session tracking, or analytics events;
- hidden network calls for crash reporting, analytics, update checks, or usage tracking.

Allowed local observability data:

- command name and status;
- safe error code and recovery action;
- profile id/version and document id;
- output kind and relative path where needed;
- severity counts and affected object references;
- provider mode, timeout, redacted token source, and error class;
- decision id/status transition metadata;
- generation run id and output counts.

Export, deletion, and retention are local/user-managed. If a future support export is added, it must require preview, redaction, explicit user action, and no automatic upload.

## Sampling and Cardinality

Sampling and cardinality controls matter less in MVP because there is no high-volume telemetry backend, but the rules still prevent future mistakes.

| Signal Area | Sampling Rule | Cardinality Rule | Must Never Sample Away | Notes |
| --- | --- | --- | --- | --- |
| Audit events | Do not sample material events. | Use stable ids/categories, not raw text. | Decision transitions, root changes, provider config, remote disclosure, unsafe path denial. | Local volume is low. |
| Error results | Do not sample command errors. | Error code/category only; avoid full path/user text labels. | State corruption, invalid profile, unsafe path, token leak, provider mutation failure. | User needs exact recovery. |
| Debug logs | If enabled, may limit verbose repeated entries. | Avoid arbitrary user content and full file paths as labels. | Security/privacy failures. | Opt-in only. |
| Metrics | Aggregate by command/status/kind/severity. | Do not label by full path, prompt, user input, raw provider id, token source value. | N/A in MVP. | Future metrics only. |
| Traces | Keep failure traces if local tracing exists. | No payload attributes. | Security/privacy failure traces. | Deferred. |

Cost and privacy both benefit from low cardinality and payload minimization.

## Retention and Access

| Signal Class | Retention | Access | Deletion / Export | Environment Separation |
| --- | --- | --- | --- | --- |
| Command results | Shown immediately; persisted only if reports/history record them. | Local user. | User deletes local state/reports. | Local workspace only. |
| Validation/diagnostic reports | Latest required; history optional. | Local user. | User-managed local deletion. | Local/test fixtures separate. |
| Generation reports | Latest required; history optional. | Local user. | User-managed local deletion. | Local workspace only. |
| Audit events | Retain with affected state where practical. | Local user/support if user shares. | User-managed; formal deletion command deferred. | Local workspace only. |
| Debug logs | Disabled by default; if enabled, short/local retention recommended. | Local user only. | User deletes local log files. | Must not use real secrets in test logs. |
| Metrics/traces/dashboards/alerts | Not stored in MVP. | N/A. | N/A. | N/A. |
| Provider-side observability | External provider-owned. | Provider/user account. | Governed by provider policy. | Outside LOGOS. |

Legal retention, compliance export, and deletion guarantees are review-needed and not claimed in MVP.

## Cost Controls

MVP observability cost is near-zero because there is no hosted telemetry, metrics backend, trace store, or dashboard service.

Cost controls:

- no default telemetry ingestion;
- no external observability vendors in MVP;
- no high-cardinality metrics pipeline;
- no persistent debug logs by default;
- local reports are generated on command, not continuously streamed;
- provider diagnostics do not retry indefinitely or emit hidden calls.

Future cost risks if hosted observability is added:

- high-cardinality labels from paths, document ids, provider ids, user input, or custom profile fields;
- verbose logs containing generated content;
- trace sampling misconfiguration;
- long retention on sensitive logs;
- noisy alerts and dashboards nobody uses.

Any future hosted observability spend must have explicit budget, retention, sampling, and owner review.

## Observability Testing

| Test or Check | Target Signal | Method | Trigger | Expected Evidence | Failure Consequence | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Command result shape test | Command results/errors. | Vitest contract tests. | PR/release. | Status, error code, recovery action present. | Block release for core commands. | Engineering. | MVP |
| Validation report test | ValidationRunCompleted/finding shape. | Validation fixtures. | PR/release. | Severity counts and affected refs. | Block release if deterministic validation loses actionability. | Engineering. | MVP |
| Generation report test | GenerationCompleted. | Golden/temp output fixtures. | PR/release. | Output kind/status counts and root. | Block release for silent/unsafe generation. | Engineering. | MVP |
| Provider redaction test | ProviderConfigured/ProviderCallFailed. | Fake provider and snapshot assertions. | PR/release. | No token/auth/prompt/raw response. | Block release. | Engineering/security. | MVP |
| No telemetry test/review | Prohibited telemetry. | Static review and optional network guard. | Release. | No hidden network calls except explicit provider. | Block release. | Engineering/product. | Review-needed automation. |
| Unsafe path event test | UnsafePathDenied. | Path traversal fixtures. | PR/release. | Write denied and safe reason shown. | Block release. | Engineering/security. | MVP |
| Decision audit test | DecisionTransitioned. | Decision service tests. | PR/release. | Prior/new status and source traceability. | Block release. | Engineering. | MVP |
| Debug log redaction test | DebugLogEntry if implemented. | Snapshot/secret fixtures. | Before debug logging release. | No raw secrets/sensitive payloads. | Block debug logging feature. | Engineering. | Deferred |
| Dashboard/alert test | Alerts/dashboards. | N/A until hosted observability. | Future. | N/A. | Required before hosted launch. | Operations. | Deferred |

Observability testing must not use real provider tokens or real user project data.

## Ownership

| Area | Owner | Maintenance Responsibility | Review Cadence |
| --- | --- | --- | --- |
| Command result/error shape | Engineering. | Keep errors actionable and stable. | Every API/command change. |
| Status/validation/diagnostics reports | Engineering + product owner. | Preserve user-facing clarity and next actions. | Every UX/status change. |
| Generation reports/output metadata | Engineering. | Maintain output kind/status/root evidence. | Renderer/generation changes. |
| Security/privacy events and redaction | Engineering + product owner. | Prevent sensitive data leaks. | Every provider/logging/support change. |
| Audit event model | Engineering. | Preserve decision/root/provider/action traceability. | State model changes. |
| Debug logging | Engineering. | Keep opt-in, local, redacted. | Before enabling. |
| SLOs/metrics/dashboards/alerts | No MVP owner because feature excluded. | Assign before any hosted or telemetry feature. | Future architecture review. |
| Release observability evidence | Engineering + product owner. | Verify reports/tests before release. | Each release. |

No critical signal should be added without an owner and a test or review path.

## Observability Risks

| Risk | Affected Signal or Area | Risk Type | Source | Likelihood | Impact | Early Signal | Mitigation | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Observability language implies hosted telemetry. | Product/docs. | Trust/privacy. | Generic observability templates. | Medium. | High. | Mentions dashboards/alerts/SLOs as active runtime features. | Explicit MVP local-only framing. | Product/Operations. | Blocks misleading release claims. |
| Debug logs leak sensitive project context. | Logs. | Privacy/security. | Overly verbose local logging. | Medium. | High. | Logs contain answers/prompts/provider payloads. | Opt-in only, redaction tests, forbidden fields. | Security, Testing. | Release-blocking if logging ships. |
| Missing audit trail weakens recovery. | Decisions/root/provider changes. | Supportability. | Audit events not persisted consistently. | Medium. | High. | User cannot explain why outputs changed. | Decision/root/provider event model and tests. | Data Model, Support. | Release-blocking for decision history. |
| No automated egress guard misses telemetry regression. | Privacy/no-telemetry. | Blind spot. | Future dependency or feature. | Medium. | High. | Unexpected network call in manual review. | Add static/network guard in testing strategy. | Testing, Security. | Release-blocking once detected. |
| Local reports become too noisy. | Status/diagnostics/generation. | UX/support. | Too many low-value findings. | Medium. | Medium. | Users ignore warnings. | Severity model, grouping, next action. | Frontend, Support. | Review-needed. |
| Provider errors are too vague. | Provider recovery. | Diagnosability. | Error mapping lacks classes. | Medium. | Medium/high. | Users cannot distinguish auth/timeout/config. | Stable provider error codes and redacted metadata. | API, Integration. | Release-blocking for provider MVP. |
| No central operator visibility limits support. | Support/incident response. | Operational limitation. | Local-first architecture. | High. | Medium. | Maintainer cannot inspect user issue remotely. | Redacted support export future; clear local reports now. | Support Model. | Accepted MVP risk. |
| Future hosted observability costs explode. | Metrics/traces/logs. | Cost. | High-cardinality labels/retention. | Low now, medium future. | Medium/high. | Large ingestion bills/noisy dashboards. | Cardinality and sampling rules before hosted launch. | Infrastructure, Operations. | Future release blocker. |

## Downstream Handoff

Frontend Architecture must inherit:

- `/status`, `/validate`, `/diagnose`, and generation reports as primary user-visible observability surfaces;
- text labels for state, recovery, provider, stale, partial, failed, canonical, and derived statuses;
- no hidden telemetry or analytics;
- generated HTML artifacts must not include telemetry scripts or external tracking.

Infrastructure Architecture must inherit:

- no hosted observability backend in MVP;
- local optional debug logging only if redacted and opt-in;
- filesystem/state/report storage requirements for local observability;
- future hosted mode must define metrics, traces, dashboards, alerts, retention, and access before implementation.

Deployment Plan and Release Management must inherit:

- release evidence from `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli`, validation/generation/security/privacy tests, and manual acceptance;
- no external SLO commitments for MVP;
- bundled profile validity, generation report correctness, and no-telemetry checks as release evidence.

Support Model must inherit:

- support is based on local user-visible reports and redacted artifacts, not operator dashboards;
- provider setup, state corruption, file overwrite confusion, and generation failures need local diagnostic guidance;
- any support export must be explicit, previewable, redacted, and user-initiated.

Incident Response and Risk Management must inherit:

- incident triggers for token leaks, hidden remote calls, unsafe writes, state corruption, provider mutation failures, invalid bundled profiles, and silent generation failures;
- required incident evidence must exclude secrets and sensitive payloads;
- accepted MVP blind spot: no central operator telemetry.

Operations must inherit:

- dashboards, alerts, SLOs, error budgets, telemetry pipelines, and hosted observability are deferred until there is a hosted/runtime operation model;
- future observability must preserve local-first privacy, minimization, redaction, and explicit consent.
