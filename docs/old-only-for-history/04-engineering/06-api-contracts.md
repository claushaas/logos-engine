# API Contracts

## API Strategy

LOGOS Engine does not expose a public network API in the MVP. The API contract surface is an internal TypeScript/Zod contract system between the TUI, command router, application services, domain modules, ports, adapters, renderers, and AI provider integrations.

The selected strategy is:

- **Primary contract style:** typed command/query operations inside one local Node.js process.
- **Validation source of truth:** Zod schemas for runtime boundaries, backed by TypeScript types.
- **Serialization:** JSON for persisted state, command results, provider adapter payloads, diagnostics, validation findings, and generation reports.
- **Public network API:** excluded for MVP.
- **External provider API:** hidden behind provider-agnostic adapter contracts.
- **Agent contract:** derived Markdown agent packs plus review prompts; no agent-callable mutation API in MVP.
- **Executive contract:** portable Executive JSON plus export adapter results; no live task-management or sync API in MVP.
- **Documentation:** this Markdown document is the canonical API contract reference; generated HTML and agent review packs are derived.
- **Compatibility:** persisted state schemas, profile schemas, command result shapes, and adapter interfaces require compatibility tests before release.

API design constraints:

- TUI components must call application command/query contracts, not filesystem, provider, or renderer adapters directly.
- Slash commands are explicit operation contracts; non-slash input routes to conversational intake.
- AI output may create proposals and advisory records, but cannot confirm decisions.
- Deterministic validation contracts must run without live AI or network.
- Remote provider calls require explicit disclosure and safe context preview.
- Raw provider tokens must never appear in project files, logs, command responses, fixtures, or generated outputs.
- Generated output paths must resolve under the configured LOGOS documentation root, defaulting to `logos/`.
- Executive exports must resolve under the configured LOGOS documentation root and must not imply live external-tool sync.

Open API questions:

- exact TypeScript module names and exported function names remain implementation-level;
- whether internal schemas are published as package exports is deferred;
- whether support tooling needs a formal local export contract is review-needed;
- whether HTML artifact generation needs a formal browser-consumable JSON manifest is deferred.
- whether executive generation is triggered through `/generate` or a dedicated command remains product/interaction review-needed.

## Contract Taxonomy

| Contract Type | Audience | Boundary | Stability | Versioning Requirement | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TUI Command Contract | TUI and command router | presentation to application | stable MVP | app/schema version where persisted results change | Application/API | MVP |
| Application Command Contract | command router to services | application boundary | stable MVP | compatibility tests for result/error shape | Application/API | MVP |
| Application Query Contract | TUI/status views to services | application boundary | stable MVP | additive changes allowed; breaking changes tested | Application/API | MVP |
| Domain Command/Query Contract | application services to domain | domain boundary | stable inside module | version through code/tests, not external API version | Domain | MVP |
| State Repository Contract | services to filesystem-backed state | port boundary | stable | state schema version required | State/Data | MVP |
| Profile Loader Contract | services to YAML profile contracts | port boundary | stable | profile schema version and fixture tests | Profile | MVP |
| Renderer Contract | generation service to Markdown/HTML/agent renderers | port boundary | stable | output kind/version and golden tests | Generation | MVP |
| AI Provider Contract | intake/drafting to provider adapters | external adapter boundary | stable MVP | provider operation schema version | Integration | MVP |
| Credential/Environment Contract | config service to env/credential source | adapter boundary | stable | redacted metadata version | Security/Config | MVP |
| Agent Pack Contract | LOGOS to downstream agents | derived artifact boundary | stable enough for review | artifact version metadata recommended | Integration | MVP |
| Executive Plan Contract | LOGOS to export adapters | derived exchange-model boundary | stable enough for schema validation | executive schema version required | Executive Compiler/API | post-baseline |
| Executive Export Contract | LOGOS to external-tool import files | derived export boundary | adapter-specific | adapter version metadata recommended | Integration/API | post-baseline |
| Public HTTP API | external product clients | network boundary | N/A | N/A | N/A | excluded |
| Webhook/Async Contract | external systems | network/event boundary | N/A | N/A | N/A | excluded/deferred |
| Worker/Job Contract | background workers | process boundary | N/A | N/A | N/A | excluded |

Implementation-only interfaces can change without deprecation only when they do not cross module boundaries, persistence boundaries, provider boundaries, generated artifact boundaries, or documented command/query boundaries.

## Consumer / Producer Map

| Consumer | Producer | Contract | Trust Boundary | Auth Required | Permission Requirement | Sensitive Data | Owner | Downstream Implication |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User | TUI Shell | keyboard/text interaction | user to local app | no account auth | confirmation for risky actions | user input/project intent | Frontend | Accessibility and confirmation design. |
| TUI Shell | Command Router | input routing contract | presentation to application | no | slash/non-slash routing | user input | API/Frontend | Routing tests required. |
| Command Router | Application Services | command/query contracts | application boundary | no account auth | operation-level permission checks | project state refs | API | Typed result/error envelope. |
| Application Services | Domain Modules | domain commands/queries | module boundary | no | domain invariants | decisions/assumptions | Domain | State transition tests. |
| Application Services | State Repository Port | state load/save contract | application to adapter | no | safe writes/recovery | structured state | Data | Schema/migration tests. |
| Application Services | Profile Loader Port | profile load/validate contract | application to adapter | no | profile validity | profile contracts | Profile | Profile fixture tests. |
| Intake Orchestrator | AI Provider Port | provider operation contract | local app to provider | provider credential if remote | remote disclosure | project context/prompt | Integration/Security | Provider fakes and redaction tests. |
| Configuration Service | Credential Source Port | token resolution contract | local app to OS/env | external credential source | no raw persistence | token metadata | Security | Token redaction tests. |
| Generation Service | Renderer Ports | render contract | application to renderer | no | write confirmation via generation service | state snapshot/content | Generation | Golden output tests. |
| Executive Compiler Service | Executive Export Adapters | executive plan/export contract | application to adapter | no | write/export confirmation via generation service | normative docs, execution graph, source refs | Executive Compiler/Integration | Schema, adapter, and golden export tests. |
| Generation Service | File System Port | file write contract | app to repository filesystem | OS filesystem permission | path safety/overwrite consent | generated content | Infrastructure/Security | Safe-write tests. |
| Downstream Agent | Agent Pack File | derived context artifact | generated file to external agent | none enforced by LOGOS | user decides use | project context | Integration | Strong derived/caveat labels. |

## Public APIs

There are no public product APIs in the MVP.

| API Surface | Status | Reason |
| --- | --- | --- |
| REST/GraphQL/gRPC server | excluded | No hosted backend or client/server architecture. |
| Browser/mobile API | excluded | Product is TUI-first and local. |
| Third-party extension API | deferred | Profile marketplace and plugin surfaces are out of MVP. |
| Public webhook API | excluded | No remote event delivery or integrations. |
| Public package exports for automation | review-needed | npm package exposes `logos` binary; library API stability is not yet committed. |

If a public API is introduced later, this document must be reopened to define authentication, authorization, versioning, rate limits, OpenAPI or equivalent documentation, deprecation, support, and security review.

## Internal APIs

Internal APIs are command/action, query, port, and adapter contracts inside the local application.

| Internal API | Consumer | Producer | Stability | Boundary Rule | Status |
| --- | --- | --- | --- | --- | --- |
| `routeInput` | TUI | Command Router | stable MVP | Returns command action or conversational input action; does not execute business logic. | MVP |
| Workspace Commands | Command Router | Workspace Service | stable MVP | Initialize/resume/status/root config through application service only. | MVP |
| Intake Commands | Command Router/TUI | Intake Orchestrator | stable MVP | Non-slash input becomes intake; provider output remains proposal/advisory. | MVP |
| Contextual Suggestion Commands | Intake/TUI | Contextual Suggestion Service | stable MVP / validation-required | Suggestions are optional, source-labeled, and route accept/edit through answer/proposal capture; they cannot confirm decisions. | MVP / validation-required |
| Startup Briefing Query | TUI | Startup Briefing Service | stable MVP / validation-required | Builds deterministic status first; AI summary is read-only, bounded, and never mutates state. | MVP / validation-required |
| Decision Commands | Review UI/Application | Decision Service | stable MVP | Confirm/revise/reject/defer require valid transitions and explicit user action. | MVP |
| Validation Queries/Commands | TUI/Application | Validation Service | stable MVP | No live AI/network dependency. | MVP |
| Diagnostics Queries/Commands | TUI/Application | Diagnostics Service | stable MVP | Advisory findings only; no confirmed state mutation. | MVP |
| Generation Commands | TUI/Application | Generation Service | stable MVP | Requires write/root/overwrite permission checks. | MVP |
| Configuration Commands | TUI/Application | Configuration Service | stable MVP | Provider metadata redacted; raw token values excluded. | MVP |
| State Repository Port | Services | File System Adapter | stable MVP | Versioned schemas and safe writes. | MVP |
| Renderer Ports | Generation Service | Markdown/HTML/Agent Pack Renderers | stable MVP | Render from snapshots and contracts, not raw chat truth. | MVP |
| Executive Compiler Commands | Command Router/TUI | Executive Compiler Service | post-baseline | Compile from normative baseline and export through mappings; no live sync. | post-baseline |
| Executive Export Adapter Ports | Executive Compiler Service | Markdown/HTML/GitHub/Linear/Notion/Agent Pack adapters | post-baseline | Transform Executive JSON into derived artifacts, preserving metadata. | supported/planned by adapter |
| AI Provider Port | Intake/AI Services | Provider Adapters | stable MVP | Provider-agnostic request/response with schema validation. | MVP |

Internal APIs must not expose persistence files as direct caller responsibilities. Consumers request domain/application operations and receive typed results, not file paths to mutate.

## Agent Contracts

MVP agent contracts are file-based and derived. LOGOS produces agent packs as Markdown artifacts under the configured root; it does not expose an agent-callable mutation API.

| Agent Contract | Consumer | Producer | Allowed Operations | Forbidden Operations | Permission / Audit | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Agent Pack Markdown | downstream coding/review agents | Agent Pack Renderer | Read compact canonical context, caveats, decisions, risks, and review instructions. | Mutate LOGOS state; confirm decisions; treat pack as source of truth. | Generated report records pack status; user chooses whether to give pack to an agent. | MVP |
| API Contract Review Prompt | reviewer agents | Derived agent pack output | Review whether API contracts align with docs and constraints. | Decide product scope or modify state without user review. | Derived output status and source refs. | MVP |
| Agent Tool API | future automation agents | none | N/A | Direct state mutation and file writes. | Would require explicit permission/audit model. | deferred |

Agent context rules:

- include only necessary project context;
- preserve assumption, confidence, validation, stale, and derived-output labels;
- include source document references where possible;
- exclude raw provider tokens, hidden local credentials, and unrelated repository contents;
- never frame AI-generated content as confirmed user decision unless state confirms it.

## Adapter Contracts

| Adapter Contract | Producer | Main Methods / Operations | Input | Output | Errors | Timeout / Retry | Credentials | Test Double |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| File System Port | File System Adapter | read JSON/YAML/text, safe write, list, stat, ensure dir, path resolve | normalized paths, content, write options | file result or typed error | not found, permission, parse, conflict, unsafe path | no automatic destructive retry | OS filesystem only | in-memory/fixture FS |
| State Repository Port | State Adapter | load snapshot, save mutation, migrate, validate state | workspace path, schema version, mutation | validated state snapshot/result | invalid schema, migration failed, conflict | retry only after explicit action | none | fixture repository |
| Profile Source Port | YAML Profile Adapter | load profile, validate profile, resolve document contract | profile id/path/version | profile snapshot or errors | missing profile, invalid YAML, invalid contract | no retry unless file changes | none | fixture profiles |
| AI Provider Port | Provider Adapters | complete structured operation, test connection, get provider status | operation id, prompt/context, schema, timeout | schema-valid AI result or provider error | timeout, unavailable, auth, invalid output, rate limit | bounded retry review-needed | env/credential ref, never raw persisted | mock/fixture provider |
| Credential Source Port | Environment/OS Adapter | resolve token source, describe redacted source | provider config metadata | token for in-memory use or redacted status | missing, inaccessible, unsafe source | no retry | env var or OS credential store | fake credential source |
| Markdown Renderer Port | Markdown Renderer | render canonical document | state snapshot, profile contract, output path metadata | text content plus render metadata | missing input, unsupported contract | no automatic retry | none | golden fixture renderer |
| HTML Renderer Port | HTML Renderer | render artifact | canonical/source snapshot, contract | HTML content plus metadata | render failure, unsupported artifact | no automatic retry | none | fixture renderer |
| Agent Pack Renderer Port | Agent Pack Renderer | render pack | canonical context, caveats, contract | Markdown pack plus metadata | missing source, unsafe context | no automatic retry | none | golden fixture renderer |
| Executive Compiler Port | Executive Compiler | compile execution graph | normative document snapshot, profile contracts, readiness policy | Executive JSON plus metadata | readiness failed, schema invalid, missing source docs | no automatic retry | none | executive schema fixtures |
| Executive Export Adapter Port | Export Adapters | export plan | Executive JSON, target mapping, output path metadata | derived export content plus metadata | unsupported target, mapping invalid, render failed | no automatic retry | none | golden export fixtures |

Vendor-specific provider payloads must be mapped to stable internal errors and normalized response shapes before entering application or domain state.

## Endpoint Register

The register uses operation names rather than HTTP methods/paths because MVP has no API server.

| ID | Name | Contract Type | Method | Path | Purpose | Consumer | Producer | Related Domain Command or Query | Related Requirement | Auth Required | Authorization Rule | Request Schema | Response Schema | Error Codes | Idempotency Required | Pagination | Filtering / Sorting | Rate Limit | Version | Observability Events | Compatibility Notes | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| API-001 | RouteInput | internal | N/A | N/A | Classify TUI input as slash command or conversation. | TUI | Command Router | route input | FR-045 | no | none | `RouteInputRequest` | `RouteInputResult` | `invalid_command` | no | none | none | none | command schema version | command routed | Additive command metadata only. | MVP |
| API-002 | InitializeWorkspace | internal command | N/A | N/A | Initialize or resume local workspace with the selected active profile. | Command Router | Workspace Service | InitializeWorkspace | FR-002, FR-003, FR-005 | no account auth | user confirmation for initialization/reinit and selected profile | `InitializeWorkspaceRequest` | `WorkspaceCommandResult` | `workspace_exists`, `unsafe_path`, `state_invalid`, `profile_invalid`, `profile_missing` | yes | none | none | none | state schema version | WorkspaceInitialized | Must remain idempotent and persist active profile id/version/source. | MVP |
| API-003 | GetWorkspaceStatus | internal query | N/A | N/A | Report repository, root, profile, provider, readiness, outputs. | TUI | Workspace/Status Service | workspace status query | FR-015, FR-044 | no | read local state | `WorkspaceStatusRequest` | `WorkspaceStatusResult` | `state_unreadable`, `profile_invalid` | no | none | optional sections | none | response schema version | StatusViewed optional local event | Add fields only with defaults. | MVP |
| API-003A | GetStartupBriefing | internal query | N/A | N/A | Return initialized startup status and an AI-generated briefing when provider rules allow it. | TUI | Startup Briefing Service | startup briefing query | FR-060, FR-061 | no | read local state; remote disclosure before remote AI call | `StartupBriefingRequest` | `StartupBriefingResult` | `state_unreadable`, `profile_invalid`, `provider_unconfigured`, `provider_timeout`, `remote_disclosure_required` | no | none | optional verbosity/sections | provider external limits | response schema version | StartupBriefingGenerated or StartupBriefingFallbackShown | Must not mutate state or replace deterministic status. | MVP / validation-required |
| API-004 | ChangeDocumentationRoot | internal command | N/A | N/A | Configure generated output root. | TUI/Command Router | Configuration Service | ChangeDocumentationRoot | FR-004, FR-023 | no | explicit confirmation | `ChangeDocumentationRootRequest` | `ConfigCommandResult` | `unsafe_path`, `path_conflict`, `confirmation_required` | yes | none | none | none | config schema version | DocumentationRootChanged | Must not assume `docs/`. | MVP |
| API-005 | ConfigureProvider | internal command | N/A | N/A | Set AI provider mode and redacted token source metadata. | TUI/Command Router | Configuration Service | ConfigureProvider | FR-017, FR-036 | provider credential resolved externally | token safety and disclosure | `ConfigureProviderRequest` | `ProviderConfigResult` | `unsafe_token_storage`, `provider_invalid`, `credential_missing` | yes | none | none | provider external limits | provider config schema version | ProviderConfigurationChanged | Raw tokens forbidden. | MVP |
| API-006 | TestProvider | adapter operation | N/A | N/A | Verify provider connectivity/configuration. | Configuration Service | AI Provider Adapter | provider status query | FR-042 | provider credential if needed | remote disclosure if context sent; test should send no project context | `TestProviderRequest` | `ProviderStatusResult` | `provider_timeout`, `provider_auth_failed`, `provider_unavailable` | no | none | none | provider external limits | provider contract version | ProviderTestCompleted | No live test in default suite. | MVP |
| API-007 | ContinueIntake | internal command | N/A | N/A | Process non-slash user input or resume conversation. | TUI/Command Router | Intake Orchestrator | RecordIntakeTurn / proposal interpretation / contextual suggestion creation | FR-006, FR-007, FR-014, FR-058 | no account auth | remote disclosure before provider call | `ContinueIntakeRequest` | `IntakeResult` | `provider_unconfigured`, `provider_timeout`, `invalid_ai_output` | yes for saved turns | none | none | provider external limits | intake schema version | IntakeTurnRecorded, ContextualSuggestionCreated | Must preserve input on provider failure; suggestions are optional and non-canonical. | MVP |
| API-008 | ReviewProposal | internal command | N/A | N/A | Confirm, revise, reject, or defer proposed decision/assumption. | TUI | Decision Service | ConfirmDecision / ReviseDecision / RejectDecision / DeferDecision | FR-008, FR-021, FR-043 | no | explicit user action | `ReviewProposalRequest` | `DecisionCommandResult` | `invalid_transition`, `proposal_not_found`, `confirmation_required` | yes | none | none | none | decision schema version | DecisionConfirmed/DecisionRevised | Confirmation semantics cannot loosen. | MVP |
| API-009 | RunValidation | internal command/query | N/A | N/A | Run deterministic validation against state/profile. | TUI/Generation | Validation Service | RunValidation | FR-013 | no | read local state | `RunValidationRequest` | `ValidationResult` | `state_invalid`, `profile_invalid`, `rule_failed` | no | finding list bounded | phase/document filters | none | validation rule/schema version | ValidationRunCompleted | No AI dependency. | MVP |
| API-010 | DiagnoseWorkspace | internal query/command | N/A | N/A | Explain gaps, contradictions, risks, and next actions. | TUI | Diagnostics Service | DiagnoseWorkspace | FR-012, FR-026 | no | read/advisory only | `DiagnoseWorkspaceRequest` | `DiagnosticResult` | `state_invalid`, `diagnostic_failed` | no | finding list bounded | severity/document filters | none | diagnostic schema version | DiagnosticFindingRaised | Advisory; no confirmed mutation. | MVP |
| API-011 | GenerateOutputs | internal command | N/A | N/A | Render canonical Markdown and derived HTML/agent packs. | TUI | Generation Service | GenerateOutputs | FR-009, FR-010, FR-011, FR-019, FR-022, FR-027, FR-031 | no | write/overwrite/root confirmation | `GenerateOutputsRequest` | `GenerationResult` | `write_denied`, `path_conflict`, `missing_inputs`, `partial_generation`, `render_failed` | yes | output list bounded | phase/document/output filters | none | generation schema version | GenerationCompleted/PartiallyCompleted | Output kinds must stay explicit. | MVP |
| API-012 | BrowseOutputs | internal query | N/A | N/A | List canonical and derived outputs under active root. | TUI | Generation/Status Service | output query | FR-029 | no | read local root | `BrowseOutputsRequest` | `BrowseOutputsResult` | `root_missing`, `state_invalid` | no | optional cursor if grows | kind/status filters | none | output schema version | OutputsViewed optional local event | Could remain preferred/could-have. | preferred MVP |
| API-013 | LoadProfile | internal query | N/A | N/A | Load and validate profile contracts. | Workspace/Profile Service | Profile Loader | ProfileLoaded | FR-005 | no | profile path safety | `LoadProfileRequest` | `ProfileLoadResult` | `profile_missing`, `invalid_yaml`, `invalid_contract` | no | none | none | none | profile schema version | ProfileLoaded/ProfileValidationFailed | Additive profile fields allowed. | MVP |
| API-014 | ResolveTokenSource | adapter operation | N/A | N/A | Resolve provider token into memory for call. | Configuration/Provider Adapter | Credential Source Adapter | credential lookup | FR-036 | credential source | raw token never returned to TUI/logs/state | `ResolveTokenSourceRequest` | `ResolvedCredentialResult` | `credential_missing`, `credential_inaccessible`, `unsafe_token_storage` | no | none | none | none | credential contract version | CredentialResolved redacted | Internal only; secret handling critical. | MVP |
| API-015 | GenerateExecutivePlan | internal command | N/A | N/A | Compile Executive JSON from the normative baseline. | TUI/Generation | Executive Compiler Service | CompileExecutivePlan | FR-051, FR-052, FR-053 | no | read normative docs; write confirmation for plan file | `GenerateExecutivePlanRequest` | `ExecutivePlanResult` | `baseline_not_ready`, `source_missing`, `schema_invalid`, `write_denied` | yes | output list bounded | phase/area filters deferred | none | executive schema version | ExecutivePlanGenerated/Blocked | Draft generation allowed; external export may be blocked. | post-baseline |
| API-016 | ExportExecutivePlan | internal command | N/A | N/A | Export Executive JSON through selected adapter mappings. | TUI/Generation | Executive Compiler / Export Adapters | ExportExecutivePlan | FR-054, FR-055, FR-056, FR-057 | no | plan schema-valid; target supported; write confirmation | `ExportExecutivePlanRequest` | `ExecutiveExportResult` | `unsupported_export_target`, `mapping_invalid`, `baseline_not_exportable`, `write_denied`, `render_failed` | yes | output list bounded | target/status filters | none | adapter schema version | ExecutivePlanExported/ExportBlocked | No bidirectional sync or live task mutation. | post-baseline |

## Request Schemas

All request contracts are local TypeScript/Zod structures. Unknown fields should be rejected at runtime boundaries unless the specific schema marks extension metadata as allowed.

| Field | Type | Location | Required | Nullable | Default | Validation Rules | Allowed Values | Sensitive | Deprecated | Description | Example |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `requestId` | string | envelope | yes | no | generated | unique per operation attempt | opaque id | no | no | Correlates result, error, and local events. | `req_01` |
| `operation` | string | envelope | yes | no | none | must match registered operation | API operation id/name | no | no | Names the command/query/adapter operation. | `GenerateOutputs` |
| `schemaVersion` | string | envelope | yes | no | current | supported by application version | semver or internal version | no | no | Enables compatibility and migration checks. | `1` |
| `workspacePath` | string | request | yes for workspace operations | no | current cwd | normalized; must not be blindly trusted | path string | local path metadata | no | Target repository path where `logos` is running. | `/repo/app` |
| `documentationRoot` | string | request | no | no | `logos/` | safe relative path unless future policy allows otherwise | path string | local path metadata | no | Configured generated output root. | `logos/` |
| `profileId` | string | request | no for default init, yes for explicit selection | no | `standard` | must resolve to a valid available profile id | profile id | no | no | Active profile selected during initialization or profile change. | `standard` |
| `commandText` | string | request | yes for routing | no | none | UTF-8; size-bounded | any text | possibly sensitive | no | Raw TUI input before routing. | `/status` |
| `conversationInput` | string | request | yes for intake | no | none | UTF-8; size-bounded; non-slash for normal intake | any text | sensitive project context | no | User clarification text. | `I am building...` |
| `confirmation` | object | request | required for risky operations | no | none | must match pending action/id | confirm/cancel/review | no | no | Explicit consent for write/root/remote/destructive operation. | `{ "confirmed": true }` |
| `providerMode` | enum | request | config only | no | unconfigured | local/remote/custom/unconfigured | fixed enum | secret-adjacent | no | AI provider mode. | `remote` |
| `tokenSourceRef` | object/string | request | no | yes | null | env var or credential ref only; never raw token | safe token source ref | secret-adjacent | no | Redacted token source metadata. | `LOGOS_LLM_API_KEY` |
| `decisionId` | string | request | proposal/decision operations | no | none | existing decision/proposal id | opaque id | sensitive ref | no | Target decision/proposal. | `dec_123` |
| `reviewAction` | enum | request | proposal review | no | none | valid transition | confirm/revise/reject/defer | no | no | User-selected proposal action. | `confirm` |
| `targetPhaseId` | string | request | optional | yes | null | must exist in profile if provided | profile phase id | no | no | Optional phase filter. | `04-engineering` |
| `targetDocumentId` | string | request | optional | yes | null | must exist in profile if provided | profile document id | no | no | Optional document filter. | `06-api-contracts` |
| `outputKinds` | string[] | request | optional | no | all eligible | valid output kind list | canonicalMarkdown/executiveJson/executiveExport/derivedHtml/derivedAgentPack | no | no | Limits generation/browsing to output kinds. | `["canonicalMarkdown"]` |
| `executiveExportTargets` | string[] | request | optional | no | supported file exports | valid executive export target list | markdown/html/githubIssues/agentPack/linear/notion | no | no | Limits executive export generation to selected adapter targets. | `["markdown", "githubIssues"]` |
| `executiveReadinessMode` | enum | request | optional | no | baseline_ready | draft/baseline_ready/execution_ready | fixed enum | no | no | Controls whether draft executive generation is allowed and whether external exports can run. | `baseline_ready` |
| `overwritePolicy` | enum | request | generation | no | safe | must align with confirmation | safe/confirm/force-after-confirmation | no | no | File collision policy. | `safe` |
| `providerContextPreviewAccepted` | boolean | request | conditional | no | false | true only after disclosure | true/false | no | no | Confirms user saw remote context implications before a remote provider call. | `true` |

Forbidden request fields:

- raw token values;
- hidden provider SDK payloads;
- arbitrary repository file content unless explicitly selected in a future scoped contract;
- direct filesystem paths for generated outputs that bypass configured root resolution;
- confirmed decision status in AI/provider-generated payloads.

## Response Schemas

All operation responses use a consistent local result envelope.

```ts
type OperationResult<T> =
  | {
      ok: true;
      requestId: string;
      operation: string;
      schemaVersion: string;
      data: T;
      warnings?: ApiWarning[];
      meta?: ApiResultMeta;
    }
  | {
      ok: false;
      requestId: string;
      operation: string;
      schemaVersion: string;
      error: ApiError;
      warnings?: ApiWarning[];
      meta?: ApiResultMeta;
    };
```

| Response Shape | Used By | Required Fields | Notes |
| --- | --- | --- | --- |
| `WorkspaceStatusResult` | status/startup | repository path, root, profile, provider status, state health, next action | Must show `logos/` or custom root clearly. |
| `StartupBriefingResult` | initialized startup | deterministic status snapshot, generated or fallback briefing text, next action, unresolved items, provider mode, source/caveat labels | Read-only; must not hide deterministic status or send remote context before disclosure. |
| `ConfigCommandResult` | root/provider config | prior value, new value, confirmation status, warnings | Must redact token metadata. |
| `IntakeResult` | conversation | saved turn status, provider status, proposals, assumptions, open questions, contextual suggestions, next prompt | Low confidence, source basis, suggestion caveats, and provider failure represented explicitly. |
| `DecisionCommandResult` | proposal review | decision id, old status, new status, affected docs, stale outputs | No silent confirmation. |
| `ValidationResult` | validation | run id, summary counts, findings, blocking status | Deterministic and provider-independent. |
| `DiagnosticResult` | diagnostics | run id, severity groups, affected objects, next actions | Advisory; must not claim confirmed changes. |
| `GenerationResult` | generation | run id, root, created/updated/skipped/blocked/failed/stale outputs | Partial success is first-class. |
| `ExecutivePlanResult` | executive generation | run id, root, plan path, readiness, confidence, source normative documents, schema status, warnings, blocked exports | Executive JSON is portable exchange output, not live task state. |
| `ExecutiveExportResult` | executive exports | run id, source executive plan path, selected targets, generated/skipped/unsupported/blocked/failed files, adapter metadata | Exports are derived snapshots and must preserve source metadata. |
| `ProviderStatusResult` | provider config/test | mode, endpoint/model if safe, redacted token source, availability | No raw token. |
| `BrowseOutputsResult` | output browsing | root, output groups by kind/status, stale/missing markers | Derived outputs labeled. |

Response evolution rules:

- adding optional fields is allowed if consumers tolerate unknown fields;
- changing enum values, required fields, or status semantics is breaking;
- low-confidence, warning, partial, blocked, stale, and recovery states must be explicit, not hidden in prose;
- contextual suggestions must expose status, source basis, confidence or caveat, and available actions instead of appearing as accepted answers;
- sensitive data is excluded by default and included only through explicit future export contracts.

## Error Model

```ts
type ApiError = {
  code: string;
  category:
    | "validation"
    | "permission"
    | "domain"
    | "conflict"
    | "dependency"
    | "timeout"
    | "state"
    | "profile"
    | "provider"
    | "filesystem"
    | "internal";
  retryable: boolean;
  userSafeMessage: string;
  developerMessage?: string;
  details?: Record<string, unknown>;
  remediation?: string;
};
```

| Code | Category | HTTP Status | Retryable | User-Safe Message | Developer Message | Details Shape | Logging Level | Telemetry Event | Remediation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `invalid_request` | validation | N/A | no | The request is not valid. | Schema validation failed. | field errors | warn | none | Correct request fields. |
| `invalid_command` | validation | N/A | no | This slash command is not recognized. | Route parser failed. | command text, suggestions | info | none | Show `/help`. |
| `confirmation_required` | permission | N/A | yes after confirmation | This action needs confirmation. | Pending action lacks confirmation. | pending action id | info | none | Ask user to confirm/review. |
| `unsafe_path` | permission/filesystem | N/A | no | The path is outside the allowed workspace boundary. | Path resolution failed safety check. | normalized path, root | warn | none | Choose a safe path. |
| `path_conflict` | conflict/filesystem | N/A | yes after user choice | A file already exists or may be overwritten. | Collision/manual edit detected. | path, checksum/mtime | warn | none | Skip, review, or confirm overwrite. |
| `state_invalid` | state | N/A | no until repaired | Workspace state needs repair before this action. | State schema or invariant failed. | schema errors, file refs | error | none | Run diagnostics/recovery. |
| `migration_failed` | state | N/A | no until repaired | State migration failed and needs review. | Migration threw or produced invalid state. | migration id, versions | error | none | Restore/repair state. |
| `profile_invalid` | profile | N/A | no | The active profile is invalid. | Profile schema/contract validation failed. | profile path, errors | error | none | Fix/select profile. |
| `invalid_transition` | domain | N/A | no | This state change is not allowed. | Domain state machine rejected transition. | entity id/status | warn | none | Choose valid action. |
| `stale_suggestion` | domain/conflict | N/A | yes after refresh | This suggestion is based on stale or changed context. | Contextual suggestion source refs changed. | suggestion id, source refs | info | none | Refresh suggestion or answer manually. |
| `provider_unconfigured` | provider | N/A | yes after config | AI provider is not configured. | Provider config missing. | provider mode | info | none | Run `/config ai`. |
| `provider_timeout` | timeout/provider | N/A | yes | The AI provider timed out. | Provider call exceeded timeout. | timeoutMs, operation | warn | none | Retry/reconfigure/save. |
| `provider_auth_failed` | provider | N/A | no until fixed | Provider credentials failed. | External provider auth rejected. | provider id, redacted source | warn | none | Fix token source. |
| `invalid_ai_output` | provider/validation | N/A | yes with retry | AI output could not be safely used. | Provider response failed schema validation. | operation, schema errors | warn | none | Retry or continue manually. |
| `write_denied` | filesystem/permission | N/A | no until permissions change | LOGOS could not write the file. | Filesystem permission denied. | path, operation | error | none | Fix permissions/root. |
| `render_failed` | internal | N/A | maybe | A document could not be rendered. | Renderer failed for contract/output. | document id, output kind | error | none | Inspect missing inputs/report. |
| `partial_generation` | conflict/internal | N/A | yes | Some outputs were generated and others failed or were skipped. | Generation aggregate completed partially. | output result groups | warn | none | Review report and retry. |

`HTTP Status` is `N/A` because there is no HTTP API in MVP. If a network API is introduced, this table must gain explicit HTTP mappings.

## Authentication

There is no LOGOS user authentication in MVP.

| Surface | Authentication | Credential Placement | Notes |
| --- | --- | --- | --- |
| TUI command/query operations | none | local process/user shell | Single-user local app; OS user controls repository. |
| Internal module contracts | none | in-process | Type/schema boundaries, not identity boundaries. |
| File system adapter | OS filesystem permissions | OS | LOGOS reports permission failures but does not authenticate users. |
| AI provider adapter | provider-specific token if required | environment variable or OS credential store; never project file | Provider auth is integration auth, not LOGOS account auth. |
| Agent packs | none enforced by LOGOS | file access | User decides which agents receive generated packs. |
| Public network API | none | N/A | Excluded. |
| Webhooks | none | N/A | Excluded. |

Security Architecture must expand token resolution, redaction, credential storage, and remote context disclosure. API Contracts must not introduce accounts, sessions, cookies, JWTs, or server-side auth in MVP.

## Authorization

MVP authorization means local operation permission and explicit user consent, not roles or accounts.

| Operation Class | Authorization Rule | Failure Shape | Notes |
| --- | --- | --- | --- |
| Read status/profile/local state | allowed if workspace files readable | `state_invalid`, `profile_invalid`, `write_denied` where applicable | No account boundary. |
| Initialize workspace | requires explicit user intent; reinit/destructive action requires stronger confirmation | `confirmation_required`, `workspace_exists` | Idempotent by default. |
| Change documentation root | explicit confirmation required | `confirmation_required`, `unsafe_path`, `path_conflict` | Root defaults to `logos/`. |
| Write/overwrite generated outputs | explicit generation intent and overwrite confirmation when needed | `confirmation_required`, `path_conflict`, `write_denied` | Paths must resolve under configured root. |
| Remote provider transmission | provider configured plus disclosure/preview acceptance | `confirmation_required`, `provider_unconfigured` | Sensitive project context may leave machine. |
| Confirm/revise/reject/defer decisions | explicit user action required | `invalid_transition`, `confirmation_required` | AI cannot authorize this. |
| Accept/edit/reject contextual suggestion | allowed as an intake action; confirmation depends on resulting state transition | `stale_suggestion`, `invalid_transition` | Accepting/editing captures input or proposals; it does not confirm decisions directly. |
| Store provider token | prohibited in project files | `unsafe_token_storage` | Only token source refs persist. |
| Diagnostics/validation | allowed; no confirmed state mutation | `state_invalid`, `profile_invalid` | Deterministic validation remains local. |

Future multi-user, team, or hosted authorization is explicitly deferred and requires product scope change.

## Pagination, Filtering, and Sorting

Most MVP operations return bounded local result sets, so cursor pagination is not required initially. List-like responses must still define predictable filters and ordering.

| Operation | Pagination | Default Ordering | Filters | Maximums | Notes |
| --- | --- | --- | --- | --- | --- |
| `GetWorkspaceStatus` | none | N/A | optional section flags | one workspace | Summary response. |
| `GetStartupBriefing` | none | status priority then next action | optional verbosity/sections | one workspace | Uses bounded status context; returns fallback when AI is unavailable. |
| `RunValidation` | none initially | severity, affected document | phase/document/severity | bounded by profile/state size | Add cursor only if findings grow. |
| `DiagnoseWorkspace` | none initially | severity then affected object | severity/document | bounded by profile/state size | Must group findings predictably. |
| `GenerateOutputs` | none | active profile order then output kind | phase/document/output kind | Standard profile scale for MVP; future profile scale TBD | Report every planned output. |
| `BrowseOutputs` | optional future cursor | phase/profile order, then kind/status | kind/status/document | review-needed | If output list grows, add cursor without changing existing fields. |
| `ContinueIntake` | none | current session order | active session | one active response | Question clusters should remain small. |

Invalid filters return `invalid_request`; empty filtered results return successful empty data with warnings only if the filter may indicate misconfiguration.

## Idempotency

| Operation | Idempotency Required | Key Location | Scope | Retention Window | Duplicate Behavior | Conflict Behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `InitializeWorkspace` | yes | request id or derived workspace path | repository workspace | workspace lifetime | report existing initialized state | destructive reinit requires confirmation |
| `ChangeDocumentationRoot` | yes | request id plus target root | workspace config | latest config/history | same root is no-op | different root with same key returns conflict |
| `ConfigureProvider` | yes | request id plus provider config hash | workspace config | latest config/history | same config is no-op | different payload with same key returns conflict |
| `ContinueIntake` | yes for persisted turns | turn id/request id | session | session lifetime | duplicate turn returns existing result or duplicate warning | different content same key rejected |
| `ReviewProposal` | yes | decision/proposal id plus action/revision | decision | decision lifetime | same action returns current status | invalid status transition rejected |
| `RunValidation` | no strict requirement | run id generated | workspace/profile snapshot | latest/history optional | rerun creates/supersedes run | N/A |
| `DiagnoseWorkspace` | no strict requirement | run id generated | workspace snapshot | latest/history optional | rerun creates/supersedes diagnosis | N/A |
| `GenerateOutputs` | yes for side effects | generation request id | workspace/root/profile/state version | generation history optional | same request may replay/report current status | different payload same key rejected |
| File writes | yes | target path + content/checksum | configured root | operation lifetime | same content no-op/update report | changed existing file requires confirmation |

There is no server-side idempotency-key cache in MVP. Idempotency is implemented through persisted local records, deterministic state checks, and operation-specific conflict detection.

## Versioning and Compatibility

| Version Area | Version Location | Breaking Change Definition | Additive Change Policy | Deprecation Policy | Sunset Policy | Migration Path | Consumer Notification | Compatibility Test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Command/query schemas | `schemaVersion` in request/result or package version | removing/renaming required fields, changing enum semantics, changing error shape | optional fields allowed | release notes before removal | tied to package major/minor policy | code migration and fixtures | release notes/docs | schema fixture tests |
| State schemas | persisted `schemaVersion` | incompatible read/write or invalid old state | additive fields with defaults allowed | migration notes required | unsupported old versions enter recovery | local migrations | release notes | migration fixtures |
| Profile schemas | profile schema/version | invalidating bundled/known profiles without migration | optional profile fields allowed | profile compatibility note | old profiles blocked only with clear error | profile migration/mapping | docs/release notes | profile contract tests |
| Provider adapter contract | provider operation schema version | changing provider request/response normalization | additive metadata allowed | adapter docs/release notes | no silent removal of supported provider mode | adapter compatibility tests | docs/release notes | mock/fixture provider tests |
| Renderer contracts | output schema/output kind version | changing output kind semantics or report shape | new output metadata allowed | output format notes | old output metadata treated historical/stale | regeneration or migration | generation report/release notes | golden output tests |
| Agent pack contract | artifact version metadata | removing caveat/source labels or changing trust semantics | additive sections allowed | review prompt notes | old packs can be regenerated | regenerate from canonical state | generated report | pack golden tests |
| Public API | N/A | N/A | N/A | N/A | N/A | N/A | N/A | excluded |

Breaking changes to safety semantics, confirmation behavior, root path behavior, token handling, or validation/provider separation are release-blocking regardless of schema compatibility.

## Realtime and Streaming

Realtime network APIs are not part of MVP.

| Surface | Status | Contract Rule |
| --- | --- | --- |
| WebSocket/SSE product API | excluded | No hosted or browser client. |
| Push notifications | excluded | No server or account model. |
| Background progress stream | local in-process only | TUI may show pending/progress states through application result updates; no network stream. |
| Streaming LLM output | deferred/review-needed | Provider adapters may receive vendor streaming internally later, but application contracts should expose stable pending/final/error states first. |
| Cancellation/backpressure | review-needed | Frontend/API must define before long-running operations rely on it. |

If provider streaming is added, it must not expose raw provider chunks as project state and must preserve schema validation before proposals or generated content enter durable state.

## Webhooks and Async Contracts

Webhooks, queues, workers, callbacks, and external async event contracts are excluded from MVP.

Domain events such as `DecisionConfirmed`, `ValidationRunCompleted`, and `GenerationPartiallyCompleted` are local audit/observability records, not delivered webhooks.

| Async Surface | Status | Reason |
| --- | --- | --- |
| External webhooks | excluded | No hosted integration surface. |
| Queue messages | excluded | No worker/job runtime. |
| Scheduled jobs | excluded | No background scheduler. |
| Integration callbacks | excluded | No external integrations beyond provider adapters. |
| Local audit events | MVP | Stored locally for traceability; no delivery guarantee beyond state write/reporting. |

Future async contracts must define signatures, retries, ordering, idempotency, replay, dead-letter behavior, privacy, and observability before implementation.

## Rate Limits and Quotas

LOGOS does not enforce account, tenant, IP, or server quotas in MVP because it has no hosted API. Limits are local safety/performance bounds and external provider constraints.

| Limit Area | Scope | Limit | Exceeded Behavior | Status |
| --- | --- | --- | --- | --- |
| Conversation question cluster size | intake operation | 3 to 12 questions, ideal 5 to 8 | ask fewer questions or split turns | required by NFR |
| Provider timeout | provider call | default 60s, configurable to 180s | `provider_timeout`, preserve state/input | required |
| Provider rate limits | external provider | provider-defined | map to provider error with retry guidance if available | integration-dependent |
| Local list sizes | validation/diagnostics/output lists | bounded by project/profile size | add filtering or future cursor if needed | provisional |
| File write attempts | generation operation | one planned write per output per run | partial generation report | required |
| Telemetry/event quotas | N/A | none | N/A | excluded |

No `X-RateLimit-*` headers exist because there is no HTTP API.

## Contract Testing

| Contract | Producer | Consumers | Test Type | Fixture or Mock | Schema Validation | Compatibility Gate | CI Requirement | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Command routing | Command Router | TUI | unit/contract | command strings and conversation strings | route result schema | slash and non-slash regression | yes | release-blocking |
| Workspace commands | Workspace Service | TUI/Command Router | integration | fixture repositories | workspace result/error schemas | old/new workspace state | yes | release-blocking |
| State repository | State Adapter | application services | integration/migration | valid, invalid, old state files | Zod state schemas | migration fixtures | yes | release-blocking |
| Profile loader | Profile Adapter | workspace/generation/validation | contract | bundled and malformed profiles | profile/document schemas | profile compatibility fixtures | yes | release-blocking |
| AI provider port | Provider Adapters | Intake/AI services | unit/integration with fakes | mock provider, fixture responses | request/response schemas | invalid output and provider failure | yes, no live provider | release-blocking |
| Decision commands | Decision Service | review flows/generation | unit/contract | decision/proposal fixtures | transition schemas | no silent confirmation/revision history | yes | release-blocking |
| Validation contract | Validation Service | TUI/generation | unit/integration | state/profile fixtures | finding/result schemas | no-provider guarantee | yes | release-blocking |
| Diagnostics contract | Diagnostics Service | TUI/support | unit/integration | gap/risk fixtures | diagnostic result schemas | advisory/no mutation guarantee | yes | release-blocking |
| Generation contract | Generation Service/Renderers | TUI/output files | integration/golden | fixture state/profile/output root | generation result/output schemas | root, overwrite, stale, partial failure | yes | release-blocking |
| Agent pack contract | Agent Pack Renderer | downstream agents/reviewers | golden/review | canonical docs/state fixtures | artifact metadata/content checks | caveat/source preservation | yes when enabled | release-blocking for packs |
| Error envelope | all producers | all consumers | unit/contract | error fixtures | common error schema | code/category/retryable/user message | yes | release-blocking |

Default tests must not call live AI providers or network services. Provider behavior must be tested through mocks, fixture providers, and explicit optional integration tests.

## API Risks

| Risk | Affected Contract | Risk Type | Source | Likelihood | Impact | Early Signal | Mitigation | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Treating API Contracts as HTTP endpoints and overbuilding a server. | All public API sections | scope/architecture | YAML template breadth vs MVP stack | medium | high | REST paths/auth appear in implementation | State no public API; operation register uses internal contracts | Infrastructure, Deployment | release-blocking if server added silently |
| TUI bypasses application services and writes files directly. | TUI/Application contracts | boundary/integrity | System Architecture | medium | high | UI imports filesystem adapter | enforce module boundaries and tests | Frontend, Test | release-blocking |
| AI provider output bypasses proposal review. | AI Provider Port, IntakeResult, ReviewProposal | trust/safety | Domain invariants | medium | critical | provider response creates confirmed decision | schema + proposal-only contract + transition tests | Security, Test | release-blocking |
| Error shapes diverge by module. | Error Model | reliability/UX | multiple services | medium | medium | TUI special-cases many errors | shared error envelope and fixtures | Frontend, Test | release-blocking if user recovery suffers |
| Raw tokens leak through config or provider errors. | ConfigureProvider, ResolveTokenSource, ProviderStatusResult | security/privacy | provider config | low/medium | critical | token value in state/log/test fixture | redacted schemas and secret tests | Security | release-blocking |
| Generated root contract regresses to `docs/`. | ChangeDocumentationRoot, GenerateOutputs | data/path integrity | prior docs default | medium | high | output path defaults to docs | root schema default `logos/` and tests | Frontend, Data, Test | release-blocking |
| Agent packs imply authoritative state. | Agent Pack Contract | integration/trust | derived output feature | medium | high | downstream agent ignores caveats | labels, source refs, review prompt rules | Integration | release-blocking for packs |
| No compatibility discipline for state/profile schemas. | State/Profile contracts | migration | filesystem state | medium | high | new release cannot read old workspace | schema versions, migration fixtures | Deployment, Release | release-blocking |
| Provider-specific details leak into domain/application contracts. | AI Provider Port | vendor lock-in | provider adapters | medium | medium/high | domain imports SDK fields | provider-agnostic port and mapping tests | Integration | release-blocking for provider layer |
| Long local result lists become slow without pagination. | Validation/Diagnostics/BrowseOutputs | performance | filesystem/no DB | low/medium | medium | `/status` or reports lag | bounded lists, filters, future cursor | Infrastructure, Test | monitor |

## Downstream Handoff

Security Architecture must inherit:

- no user account/session auth in MVP;
- provider credentials are external integration credentials, not LOGOS auth;
- raw token values are forbidden in requests, responses, state, logs, fixtures, and generated artifacts;
- remote provider transmission requires disclosure and context preview;
- write, overwrite, root change, destructive repair, and decision confirmation are permission/consent contracts.

Integration Architecture must inherit:

- AI provider access goes through provider-agnostic adapter contracts;
- external provider errors must map into stable internal error codes;
- provider streaming is deferred/review-needed and cannot bypass schema validation;
- agent packs are derived file contracts, not live tool APIs.

Frontend Architecture must inherit:

- command/query result envelopes, warning/error shapes, and recovery messages;
- slash command routing versus conversational input;
- confirmation requirements for high-risk operations;
- explicit display of root, provider, state health, stale outputs, partial generation, and low-confidence results.

Infrastructure Architecture and Deployment Plan must inherit:

- no API server, no background worker, no webhooks, no hosted rate limits, and no telemetry platform in MVP;
- package exports should not accidentally imply a stable public library API unless explicitly documented;
- persisted schema and command/result compatibility changes require release notes and migration tests.

Test Strategy must inherit:

- contract tests for every command/query, port, adapter, renderer, error envelope, and persisted schema;
- no live provider/network in default tests;
- fixture providers for provider success, timeout, auth failure, invalid output, and rate limit mapping;
- golden tests for Markdown, HTML, and agent pack output contracts;
- root safety, token redaction, confirmation, and no-AI-validation tests as release blockers.

Observability Plan and Support Model must inherit:

- operation results and local audit events are support evidence, not telemetry;
- logs/debug bundles must use the common error envelope and redaction rules;
- generation reports, validation runs, diagnostic results, and migration records are the primary local support artifacts.

Unresolved items to carry forward:

- exact exported TypeScript names and package boundaries;
- whether internal API schemas are generated into documentation artifacts;
- whether support exports require a formal schema;
- whether future provider streaming needs a stable in-process event contract;
- whether `BrowseOutputs` is MVP or remains preferred/could-have.
