# Data Model

## Data Model Overview

LOGOS Engine uses a local, filesystem-backed data model. The product has no database, no hosted backend, no user accounts, no cloud sync, and no telemetry store in the MVP. Data is represented as versioned JSON state records, YAML profile contracts, Markdown canonical documents, derived HTML artifacts, derived Markdown agent packs, and generation/validation reports.

The model separates four data categories:

| Category | Source of Truth | Storage Role | Notes |
| --- | --- | --- | --- |
| Profile contracts | Profile YAML files | Contract source | Defines phases, document contracts, outputs, completion criteria, and review rules. |
| Project clarity state | Local structured JSON state | Durable product truth | Stores decisions, assumptions, open questions, risks, validation findings, diagnostics, generation status, and configuration metadata. |
| Canonical documents | Markdown under the configured LOGOS documentation root | Human-readable projection | Rendered from structured state and profile contracts. Canonical for review, but not the only state authority. |
| Derived outputs | HTML artifacts and agent packs under the configured root | Regenerable derived output | Must preserve caveats and traceability; never becomes source of truth. |

The default generated documentation root is `logos/`, and it is configurable. This root is distinct from internal workspace state. The recommended internal state root is `.logos/`, inherited from prior architecture material, but it remains an internal storage decision rather than a user-facing documentation root.

Most consequential data decisions:

- structured state, not chat history, drives continuity and generation;
- profile YAML drives document contracts but does not contain project truth;
- Markdown, HTML, and agent packs are generated outputs;
- deterministic validation findings are separate from AI diagnostics and AI proposals;
- AI provider configuration can persist only redacted metadata, never raw tokens;
- local state schema versioning and migration must be release-blocking because there is no database layer to absorb schema drift.

Open data questions:

- exact physical split between `.logos/state.json` and specialized JSON files remains implementation-level;
- whether raw intake turns are retained fully, summarized, or pruned requires privacy and recovery review;
- whether manual edits to Markdown should be merged, warned about, or overwritten after confirmation needs renderer and permission design;
- whether `.logos/` should be user-inspectable as a supported surface or remain an internal implementation detail needs support-model review.

## Data Storage Strategy

MVP storage is filesystem-only.

| Store | Storage Engine | Canonicality | Scope | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| Internal workspace state | JSON files under internal state root, recommended `.logos/` | canonical for structured project state | local-only | Preserve workspace config, decisions, assumptions, questions, risks, findings, output status, and reports. | committed |
| Profile contracts | YAML files in bundled or selected profile directories | canonical for document contracts | local-only | Define profile, phases, document schemas, outputs, quality checks, review rules. | committed |
| Canonical Markdown | Markdown files under configured root, default `logos/` | canonical human-readable projection | local-only | Reviewable project documentation generated from state and contracts. | committed |
| Derived HTML artifacts | HTML files under configured root outcomes path | derived | local-only | Navigable review artifacts regenerated from canonical inputs. | committed output / renderer provisional |
| Derived agent packs | Markdown files under configured root outcomes path | derived | local-only | Compact context packs for downstream agents. | committed concept |
| Temporary write files | Filesystem temp files beside target or in safe temp location | temporary | local-only | Support atomic writes and crash recovery. | committed concept |
| Remote provider data | Provider-owned transient request/response processing | external/transient | remote only when configured | Optional AI assistance. LOGOS does not own remote retention. | integration risk |
| Telemetry store | none | N/A | none | No telemetry or analytics by default. | excluded |
| Database/search/cache store | none | N/A | none | Not required for MVP scale or local-first posture. | excluded/deferred |

The storage strategy favors inspectability and Git-friendly files over query power. Query-like behavior must be implemented through schema-validated state reads and small in-memory indexes built at runtime, not through a database. If state grows beyond practical filesystem reads, the database decision must be reopened in Technical Stack and Data Model together.

## Domain-to-Data Mapping

| Domain Concept | Data Representation | Classification | Source | Notes |
| --- | --- | --- | --- | --- |
| Repository Workspace | `WorkspaceRecord` | canonical local state | Domain Model ENT-001 | Anchors repository path, workspace id, active root, active profile, and schema version. |
| LOGOS Documentation Root | `DocumentationRootConfig` | canonical local config | IA OBJ-003, FR-004 | Defaults to `logos/`; configurable with path safety checks. |
| Profile | `ProfileReference` and `ProfileLockRecord` | contract reference / lock | Profile YAML | Snapshot of active profile id, version, source path, and compatibility metadata. |
| Phase | `PhaseProgressRecord` | derived status | Profile contracts + state | Progress is computed from document and state readiness, not manually edited as truth. |
| Document Contract | `DocumentContractReference` | contract reference | Profile YAML | Persist only references/status; contract details remain in profile YAML. |
| Intake Session | `IntakeSessionRecord` and `IntakeTurnRecord` | canonical input / possibly summarized | User input + provider output | Stores enough context for continuity and traceability without making chat the source of truth. |
| Decision | `DecisionRecord` and `DecisionRevisionRecord` | canonical local state | User confirmation / proposal flow | Confirmed decisions require explicit user action. |
| Assumption | `AssumptionRecord` | canonical local state | User or AI proposal accepted as assumption | Must remain visibly caveated. |
| Open Question | `OpenQuestionRecord` | canonical local state | Unknown answer, validation gap, or diagnosis | Must remain visible when it affects required outputs. |
| Risk | `RiskRecord` | canonical local state | User, AI proposal, validation, or diagnostic source | Risk acceptance must preserve rationale. |
| Validation Finding | `ValidationRunRecord` and `ValidationFindingRecord` | deterministic result | Validation rules | Reproducible without live AI. |
| Diagnostic Finding | `DiagnosticRunRecord` and `DiagnosticFindingRecord` | advisory/local result | Diagnostics service | Explains gaps and next action; must not mutate confirmed state. |
| Generation Report | `GenerationRunRecord` and `OutputRecord` | canonical local status | Generation service | Tracks generated, skipped, blocked, failed, stale outputs. |
| HTML Artifact | `OutputRecord` plus file | derived | Renderer output | Regenerable from canonical inputs. |
| Agent Pack | `OutputRecord` plus file | derived | Renderer output | Regenerable and caveat-preserving. |
| Provider Configuration | `ProviderConfigRecord` | redacted local config | User configuration | Stores mode, endpoint/model metadata, token source reference, never raw token. |
| Domain Events | `AuditEventRecord` or embedded history | audit/history | Domain commands | Supports traceability, not event-sourced state in MVP. |

Concepts intentionally not persisted as canonical truth:

- raw LLM tokens or secrets;
- provider SDK request internals;
- terminal UI state;
- arbitrary repository source code;
- Git history;
- hosted account/session data;
- telemetry or analytics events.

## Entity Relationship Overview

| Source | Target | Relationship | Cardinality | Optionality | Ownership | Integrity Rule | Delete / Archive Behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WorkspaceRecord | DocumentationRootConfig | has active output root | 1:1 | required after initialization | Workspace owns config | Root path must resolve safely within allowed workspace policy. | Root change preserves prior reports and marks affected outputs unknown/stale. |
| WorkspaceRecord | ProfileLockRecord | has active profile lock | 1:1 | required for generation | Workspace owns lock reference | Profile id/version must resolve and validate. | Profile change preserves state but triggers compatibility validation. |
| ProfileLockRecord | DocumentContractReference | defines available document contracts | 1:many | required | Profile owns contract source | Document ids must exist in active profile. | Removed contracts mark prior outputs obsolete or orphaned for review. |
| WorkspaceRecord | IntakeSessionRecord | contains sessions | 1:many | optional | Workspace owns sessions | Session workspace id must match. | Sessions may be archived or summarized; confirmed state remains. |
| IntakeSessionRecord | IntakeTurnRecord | contains ordered turns | 1:many | optional | Session owns turns | Turn order must be stable within session. | Turn pruning must preserve source references or summaries. |
| IntakeTurnRecord | DecisionRecord | may source proposal | many:many | optional | Decision owns lifecycle | Source refs must not imply confirmation. | Source removal requires retained summary/evidence ref. |
| DecisionRecord | DecisionRevisionRecord | has revisions | 1:many | required after creation | Decision owns revisions | Confirmed revisions require explicit user action. | Revisions are deprecated/superseded, not silently deleted. |
| DecisionRecord | OutputRecord | affects output | many:many | optional | Output owns status; decision owns truth | Decision change marks affected outputs stale where known. | Output deletion does not delete decision. |
| AssumptionRecord | OpenQuestionRecord | may be resolved by question | many:many | optional | Each record owns status | Resolved question can update assumption caveat but not auto-confirm fact. | Assumptions remain until resolved/superseded. |
| RiskRecord | DecisionRecord | may affect or be accepted by decision | many:many | optional | Risk owns status | Accepted risk needs rationale. | Closed risk remains in history unless hard-deleted by user. |
| ValidationRunRecord | ValidationFindingRecord | contains findings | 1:many | optional | Run owns findings | Findings reference rule id and affected object. | New run supersedes prior snapshot. |
| DiagnosticRunRecord | DiagnosticFindingRecord | contains findings | 1:many | optional | Run owns findings | Findings remain advisory unless user acts. | New diagnosis may obsolete prior findings. |
| GenerationRunRecord | OutputRecord | records output results | 1:many | optional | Generation owns report; output owns latest status | Output path must be under configured root. | User file deletion marks output missing/stale on next status check. |
| OutputRecord | Generated file | tracks file | 1:1 | required after generation | User owns file; LOGOS tracks metadata | File checksum/mtime can detect external edits. | Manual deletion is allowed; next run reports missing. |

Logical relationships are enforced by schema validation and application/domain rules, not database foreign keys. Because storage is JSON/filesystem, referential integrity must be checked on state read, mutation, validation, and migration.

## Tables / Collections

The structures below are logical records/documents, not SQL tables.

| Name | Storage Type | Storage Engine | Purpose | Source Concept | Owning Module | Classification | Lifecycle | Access Patterns | Relationships | Constraints | Indexes | Sensitivity Class | Retention Class | Migration Notes | Downstream Implications | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WorkspaceRecord | JSON object | local filesystem | Identify workspace, schema, repository, active root, active profile. | Repository Workspace | Workspace | canonical/local-only | created, active, recovery-needed, migrated | startup, status, init, root change | root, profile lock, state refs | one active root/profile; schema-valid before mutation | workspace id, repository path | sensitive project metadata | retain until user deletes workspace state | schema version required | Security, API, Infrastructure | MVP |
| DocumentationRootConfig | JSON object | local filesystem | Store output root and path safety metadata. | LOGOS Documentation Root | Configuration | canonical/local-only | proposed, active, invalid, changed | init, status, generation | workspace, outputs | default `logos/`; safe path; explicit change confirmation | normalized root path | local path metadata | retain current plus change history | root changes mark output status uncertain/stale | Security, Generation, Frontend | MVP |
| ProfileLockRecord | JSON object | local filesystem | Lock active profile id/version/source and compatibility. | Profile | Profile | canonical contract reference | selected, active, invalid, migrated | startup, validation, generation | profile contracts, documents | profile must validate before generation | profile id/version | low sensitivity | retain until profile change | profile migrations can obsolete document statuses | API, Test, Release | MVP |
| IntakeSessionRecord | JSON object or file per session | local filesystem | Preserve conversation continuity and source traceability. | Intake Session | Intake | canonical input / privacy-sensitive | open, paused, completed, failed, archived | `/continue`, proposal trace, support | turns, proposals, decisions | cannot confirm decisions directly | session id, updatedAt, status | sensitive project context | retention unresolved; default retain locally | raw/summarized retention policy needed | Security, Support | MVP / review-needed |
| IntakeTurnRecord | JSON embedded or append file | local filesystem | Store user/system turns or summaries. | Intake Turn | Intake | canonical input / possible temporary | recorded, summarized, redacted, pruned | intake resume, traceability | session, proposal source | source actor/time required; raw provider output minimized | session order, turn id | sensitive project context | retention unresolved | pruning requires source summaries | Security, Observability | review-needed |
| DecisionRecord | JSON collection | local filesystem | Store proposed, confirmed, rejected, deferred, superseded decisions. | Decision | Decision | canonical/local-only | proposed, confirmed, rejected, deferred, superseded | review, generation, validation, status | revisions, sources, outputs | explicit confirmation for confirmed status | id, status, affected docs | sensitive project intent | retain; deprecate not silent delete | status enum migration-sensitive | API, Test, Observability | MVP |
| DecisionRevisionRecord | JSON collection/embedded | local filesystem | Preserve decision mutation history. | Decision Revision | Decision | audit/history | created, active, superseded | audit, stale detection | decision, outputs, source event | no silent overwrite | decision id + revision order | sensitive project intent | retain with decision | older decisions need backfilled revision 1 | Observability, Support | MVP |
| AssumptionRecord | JSON collection | local filesystem | Store temporary planning statements. | Assumption | Decision/Knowledge Gap | canonical/local-only | proposed, active, challenged, resolved, superseded | generation, diagnostics, validation | questions, docs, risks | caveat required | id, status, affected docs | sensitive project intent | retain until resolved/superseded | caveat field required | Generation, Test | MVP |
| OpenQuestionRecord | JSON collection | local filesystem | Store known unknowns. | Open Question | Knowledge Gap | canonical/local-only | open, answered, deferred, obsolete | `/status`, diagnostics, generation caveats | assumptions, docs, decisions | affecting required docs must surface | id, status, affected docs | sensitive project intent | retain until resolved/obsolete | status evolution likely | Frontend, Test | MVP |
| RiskRecord | JSON collection | local filesystem | Store project/product/technical risks. | Risk | Knowledge Gap | canonical/local-only | identified, monitored, mitigated, accepted, closed | diagnostics, generation, reports | decisions, docs | accepted risk needs rationale | id, severity, affected docs | sensitive project context | retain with rationale | severity enum review | Risk Management | MVP |
| ValidationRunRecord | JSON object/history | local filesystem | Store deterministic validation snapshots. | Validation Run | Validation | canonical result / snapshot | running, complete, failed, obsolete | `/validate`, `/status`, gates | findings, profile, state version | no AI dependency | run id, timestamp, profile version | low to sensitive refs | latest required; history optional | version affected by rule changes | Test, Observability | MVP |
| ValidationFindingRecord | JSON collection | local filesystem | Store deterministic findings. | Validation Finding | Validation | canonical result | passing, warning, blocking, obsolete | diagnostics, status, generation preflight | run, affected object | rule id, severity, affected object required | deterministic key, severity | sensitive refs possible | latest snapshot; history optional | deterministic keys may change | Test, API | MVP |
| DiagnosticRunRecord | JSON object/history | local filesystem | Store diagnostic summaries and next actions. | Diagnostic Run | Diagnostics | advisory result | complete, failed, obsolete | `/diagnose`, status | findings, validation run | advisory, not state mutation | run id, timestamp | sensitive project context | latest required; history optional | separate deterministic vs AI advice | Frontend, Support | MVP |
| DiagnosticFindingRecord | JSON collection | local filesystem | Explain gaps, contradictions, risks, next actions. | Diagnostic Finding | Diagnostics | advisory/local-only | active, acknowledged, resolved, obsolete | TUI, reports | affected docs/state | severity and affected object required | severity, affected doc | sensitive project context | latest active retained | may be regenerated | Frontend, Support | MVP |
| GenerationRunRecord | JSON object/history | local filesystem | Record generation attempt and outcome. | Generation Report | Generation | canonical status/history | planned, running, partial, complete, failed, obsolete | `/generate`, `/status`, support | outputs, root, profile, state version | partial failures visible | run id, timestamp, status | local paths/project context | retain latest; history optional | stale metadata required | Observability, Support | MVP |
| OutputRecord | JSON collection | local filesystem | Track canonical and derived file status. | Generated Output | Generation | canonical status for generated files | planned, generated, skipped, blocked, failed, stale, missing | output browsing, generation, status | contract, run, file path | path under configured root; kind classified | output id/path, kind, status | local path/project content refs | retain while output exists; stale after changes | checksum/mtime strategy review-needed | Frontend, API, Test | MVP |
| ProviderConfigRecord | JSON object | local filesystem | Store provider mode, endpoint/model, redacted token source. | Provider Configuration | Configuration | canonical redacted config | unconfigured, configured, invalid, unavailable | `/config ai`, intake, status | workspace, provider port | no raw tokens; remote disclosure required | provider id/mode | secret-adjacent metadata | retain until cleared | token source shape may evolve | Security, Integration | MVP |
| AuditEventRecord | JSON collection or embedded history | local filesystem | Trace sensitive state changes and migrations. | Domain Events | State/Observability | audit/history | recorded, compacted, migrated | support, recovery, test fixtures | workspace, actor, command, affected object | actor/source/time/command required for material mutations | event id, aggregate id, timestamp | sensitive project context | retain for relevant state lifetime | can start embedded before separate log | Observability, Security | MVP / format review-needed |
| MigrationRecord | JSON collection or workspace metadata | local filesystem | Track state schema/profile migrations. | Migration | State | audit/history | planned, applied, failed, rolled-forward | startup, release support | workspace schema, profile lock | failed migration enters recovery | migration id, schema version | local project metadata | retain permanently or until major cleanup | release-blocking | Deployment, Release | MVP |

## Fields

Fields are grouped by logical record. Exact TypeScript/Zod syntax belongs in implementation, but these fields are material to the data contract.

| Table or Collection | Field | Type | Nullable | Default | Derived | Validation Rules | Uniqueness | Sensitivity Class | Encryption or Masking | Indexed | API Exposure | Migration Notes | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WorkspaceRecord | schemaVersion | string | no | current version | no | supported by app version | no | low | none | yes | internal command/query | release-sensitive | Blocks mutation if unsupported. |
| WorkspaceRecord | workspaceId | string | no | generated | no | stable id | yes | low | none | yes | status | immutable after init | Opaque id preferred. |
| WorkspaceRecord | repositoryPath | string | no | current cwd | no | normalized absolute path | no | local path metadata | redact in support exports if needed | yes | status | path format cross-platform | `logos` runs from target repo directory. |
| WorkspaceRecord | documentationRoot | string/ref | no | `logos/` | no | safe relative or approved path | no | local path metadata | none | yes | status/generation | migrated from old `docs/` assumptions | Must not hard-code `docs/`. |
| WorkspaceRecord | activeProfile | object/ref | no | Standard profile | no | valid profile id/version | no | low | none | yes | status | profile compatibility sensitive | Links to lock. |
| DocumentationRootConfig | rootPath | string | no | `logos/` | no | normalized, safe, configurable | no | local path metadata | none | yes | status/generation | root changes affect outputs | User-facing path. |
| DocumentationRootConfig | isDefault | boolean | no | true | yes | derived from rootPath | no | low | none | no | status | none | Helps UI explain default/custom root. |
| DocumentationRootConfig | lastConfirmedAt | ISO datetime | yes | null | no | set on confirmed change | no | low | none | no | internal | add when introducing confirmation history | Supports permission audit. |
| ProfileLockRecord | profileId | string | no | `standard` | no | exists in profile source | no | low | none | yes | status | none | Contract identity. |
| ProfileLockRecord | profileVersion | string | yes | null | no | semver or profile-defined | no | low | none | yes | status | backfill if absent | Used for compatibility. |
| ProfileLockRecord | sourcePath | string | no | bundled path | no | readable profile directory/file | no | local path metadata | none | no | diagnostics | path migrations possible | Data only, never executable. |
| IntakeSessionRecord | sessionId | string | no | generated | no | unique in workspace | yes | sensitive project context | none by default | yes | `/continue` | stable id required | May use per-session file. |
| IntakeSessionRecord | status | enum | no | open | no | valid lifecycle value | no | low | none | yes | status | enum migration-sensitive | open, paused, completed, failed. |
| IntakeSessionRecord | summary | string | yes | null | yes/no | UTF-8 text | no | sensitive project context | redact in support exports | no | context preview | raw/summarized policy unresolved | Summary can replace raw turns later. |
| IntakeTurnRecord | actor | enum | no | user/system/provider | no | valid actor | no | sensitive refs | none | yes | internal | none | Distinguish user input from AI/provider output. |
| IntakeTurnRecord | content | string/object | yes | null | no | UTF-8, size-bounded | no | sensitive project context | minimize/log exclusion | no | context preview | retention decision needed | Raw provider output should be minimized. |
| IntakeTurnRecord | sourceRefs | string[] | no | [] | no | ids must resolve or be marked historical | no | sensitive refs | none | no | traceability | refs need migration | Supports lineage. |
| DecisionRecord | decisionId | string | no | generated or semantic id | no | unique in workspace | yes | sensitive project intent | none | yes | query/status | id stability required | Avoid path-like ids if not profile-defined. |
| DecisionRecord | statement | string | no | none | no | non-empty UTF-8 | no | sensitive project intent | redact in logs/support | search/runtime | TUI/API | may need summary field | Human-readable decision. |
| DecisionRecord | status | enum | no | proposed | no | proposed, confirmed, rejected, deferred, superseded | no | low | none | yes | TUI/API | enum migration-sensitive | Confirmed requires user action. |
| DecisionRecord | confidence | enum | yes | null | no | low/medium/high/advisory; must not imply validation | no | low | none | no | TUI/API | label may evolve | AI interpretation confidence. |
| DecisionRecord | affectedDocumentIds | string[] | no | [] | yes/no | profile document ids or historical refs | no | sensitive refs | none | yes | status/generation | profile changes can orphan refs | Drives stale outputs. |
| DecisionRecord | sourceRefs | string[] | no | [] | no | session/turn/proposal refs | no | sensitive refs | none | no | traceability | preserve through pruning | Evidence trace. |
| DecisionRevisionRecord | revisionId | string | no | generated | no | unique per decision | yes | sensitive project intent | none | yes | internal/status | backfill first revision | Supports no silent overwrite. |
| DecisionRevisionRecord | confirmedBy | enum/string | yes | null | no | user/system only for non-confirming statuses | no | low | none | no | audit | actor model may evolve | MVP actor is local user. |
| AssumptionRecord | caveat | string | no | generated label | no | must be visible | no | sensitive project intent | none | no | generation | required field | Prevents assumptions as facts. |
| OpenQuestionRecord | question | string | no | none | no | non-empty | no | sensitive project intent | none | runtime | TUI/generation | none | Unknowns are valid state. |
| RiskRecord | severity | enum | no | medium | no | valid severity | no | low | none | yes | diagnostics | enum review | Used for grouping. |
| ValidationFindingRecord | ruleId | string | no | none | no | exists in validation rule registry/profile | no | low | none | yes | `/validate` | rule renames require mapping | Deterministic source. |
| ValidationFindingRecord | affectedObjectRef | string | no | none | no | object exists or marked historical | no | sensitive refs | none | yes | diagnostics | refs can orphan after migration | Required for actionability. |
| DiagnosticFindingRecord | nextAction | string | yes | null | no | must not mutate state itself | no | sensitive project context | redact in logs | no | TUI | none | Advisory. |
| GenerationRunRecord | resultStatus | enum | no | planned | no | planned/running/partial/complete/failed | no | low | none | yes | generation report | none | Partial failure must be visible. |
| OutputRecord | outputPath | string | no | from contract/root | no | resolves under configured root | yes per kind/root | local path metadata | none | yes | output browsing | root migration-sensitive | Safety-critical. |
| OutputRecord | outputKind | enum | no | canonicalMarkdown | no | canonicalMarkdown/derivedHtml/derivedAgentPack/report | no | low | none | yes | report | enum may grow | Derived classification required. |
| OutputRecord | sourceVersionRefs | string[] | no | [] | no | refs to profile/state/generation | no | sensitive refs | none | no | status | checksum strategy review | Supports stale detection. |
| OutputRecord | checksum | string | yes | null | yes | hash if computed | no | low | none | no | internal | algorithm migration possible | Manual edit detection. |
| ProviderConfigRecord | providerMode | enum | no | unconfigured | no | local/remote/custom/unconfigured | no | secret-adjacent metadata | none | yes | `/config ai` | provider enum evolves | Remote mode requires disclosure. |
| ProviderConfigRecord | tokenSourceRef | object/string | yes | null | no | env var or credential ref only | no | secret-adjacent metadata | redacted display | no | status | format sensitive | Never raw token. |
| AuditEventRecord | eventType | string | no | none | no | known event type/version | no | sensitive refs | redact exported payloads | yes | diagnostics/support | event version required | Not telemetry. |
| MigrationRecord | fromVersion | string | no | none | no | supported migration path | no | low | none | yes | startup/release | release-sensitive | Failed migration enters recovery. |

## Constraints

| Constraint | Applies To | Constraint Type | Source Rule | Enforcement Location | Violation Behavior | Consistency Model | Test Implication | Downstream Implications |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace state must be schema-valid before mutation. | WorkspaceRecord and state files | schema/integrity | Domain invariant | State repository and command handlers | Enter recovery mode; block mutation. | immediate | corrupted-state fixtures | API, Test |
| Generated output root defaults to `logos/` and remains configurable. | DocumentationRootConfig | business/config | FR-004 | Workspace/config service | Reject hard-coded `docs/` generated root behavior. | immediate | root config tests | Security, Frontend |
| Output paths must resolve under configured root. | OutputRecord and file writes | path safety | FR-009, FR-022 | Generation planning and filesystem adapter | Block write and report. | immediate | traversal and collision tests | Security |
| Profile must validate before generation. | ProfileLockRecord | schema/contract | Profile contract rules | Profile service and generation preflight | Block generation. | immediate | invalid profile fixtures | API, Test |
| Confirmed decisions require explicit user action. | DecisionRecord | domain invariant | FR-008, FR-033 | Decision service | Reject transition. | immediate | transition tests | Frontend, API |
| AI output cannot directly mutate confirmed state. | IntakeTurnRecord, DecisionRecord | trust boundary | Foundation/FR-043 | Intake and proposal interpretation | Downgrade to proposal or reject malformed output. | immediate | mocked provider tests | Security, Test |
| Assumptions must remain caveated. | AssumptionRecord and outputs | domain/content | FR-025, FR-050 | Knowledge gap service, renderer, validation | Warn/block if caveat would be hidden. | immediate at generation | golden output tests | Generation, Frontend |
| Validation must not require live AI. | ValidationRunRecord | architecture constraint | NFR-REL-006 | Validation service | Fail implementation review/test. | immediate | no-provider validation tests | Test |
| Raw provider tokens must never be stored. | ProviderConfigRecord | security/privacy | FR-036, NFR-SEC-001 | Configuration service and persistence adapter | Reject unsafe config; redact status. | immediate | secret scanning fixtures | Security |
| Remote provider transmission requires disclosure. | ProviderConfigRecord, IntakeSessionRecord | privacy/permission | FR-018, NFR-PRIV-002 | Permission/config/intake services | Block provider call. | immediate | remote disclosure tests | Security, Integration |
| Derived outputs cannot become canonical state. | OutputRecord | classification | FR-027 | Generation/reporting/state model | Mark as derived; do not read as project truth. | immediate | output classification tests | Integration |
| Partial generation failure must be visible. | GenerationRunRecord | reliability/observability | FR-019, NFR-REL-005 | Generation service | Report partial/failed categories. | immediate | failure-path tests | Observability |
| Decision revisions preserve history. | DecisionRevisionRecord | audit/integrity | NFR-REL-002 | Decision service | Create revision/supersession; never silent overwrite. | immediate | revision tests | Observability |
| Logical references must resolve or be marked historical/orphaned. | All `*Ref` fields | referential integrity | Data model integrity | State validation and migration | Warn/block depending severity. | checked on read/validate | orphan fixture tests | Diagnostics |

## Indexes

There are no database indexes in MVP. Runtime indexes are in-memory lookup maps built from JSON state after schema validation. They must be treated as derived and disposable.

| Index | Applies To | Index Type | Fields | Query Patterns | Uniqueness | Sort Order | Selectivity Assumption | Write Cost | Maintenance Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace by id | WorkspaceRecord | in-memory lookup | workspaceId | startup/status | unique | N/A | one workspace per repository | none beyond state write | low | MVP |
| Decision by id/status | DecisionRecord | in-memory lookup | decisionId, status | review, generation, diagnostics | id unique | status grouping | hundreds of decisions | rebuild on read | low | MVP |
| Output by path/kind/status | OutputRecord | in-memory lookup | outputPath, outputKind, status | output browsing, stale reports | path unique per root/kind | status grouping | dozens to hundreds of outputs | rebuild on read | low | MVP |
| Findings by severity/affected object | ValidationFindingRecord, DiagnosticFindingRecord | in-memory grouping | severity, affectedObjectRef | `/status`, `/diagnose`, `/validate` | no | severity then document | findings remain small | rebuild on read | low | MVP |
| Session by updatedAt/status | IntakeSessionRecord | in-memory sort/group | status, updatedAt | `/continue`, recovery | id unique | newest first | few active sessions | rebuild on read | low | MVP |
| Profile document by id | DocumentContractReference | in-memory lookup | documentId | generation and validation | unique within profile version | N/A | Standard profile document count is small | rebuild on profile load | low | MVP |

If runtime state grows enough that rebuilding these maps causes perceptible delay, the first escalation should be state partitioning and lazy reads, not immediate database adoption.

## Local Data

All LOGOS-owned MVP data is local by default.

| Local Data | Durable or Temporary | Source of Truth | Structure | Invalidation / Recovery | Notes |
| --- | --- | --- | --- | --- | --- |
| Workspace metadata | durable | structured JSON | WorkspaceRecord and config records | invalid schema enters recovery | Required for startup and `/status`. |
| Project clarity state | durable | structured JSON | decisions, assumptions, questions, risks, findings, reports | schema validation; migrations; safe writes | Main durable product truth. |
| Profile contracts | durable/read-only in bundled profile | YAML | profile/phase/document contract files | invalid profile blocks dependent commands | Profiles are data, not code. |
| Canonical Markdown | durable generated output | rendered from structured state/profile | files under configured root | stale when source changes; manual edit warning | Human-readable projection. |
| HTML artifacts | durable derived output | regenerated from canonical inputs | files under configured root outcomes path | stale when source changes | Derived only. |
| Agent packs | durable derived output | regenerated from canonical inputs | Markdown under configured root outcomes path | stale when source changes | Derived only. |
| Provider config metadata | durable | redacted config state | provider mode, model/endpoint, token source ref | invalid/unavailable status | No raw token values. |
| Temporary write files | temporary | none | temp files | cleanup after success/failure | Must avoid secret leakage. |
| Presentation state | temporary | none | in-memory TUI state | discarded on exit | Reconstructed from durable state. |

Local encryption at rest is not implemented by LOGOS in MVP and relies on the user's OS/filesystem protections. Security Architecture must decide whether additional encryption is required.

Corruption behavior:

- if state cannot be parsed, LOGOS must avoid destructive repair;
- safe commands should show recovery guidance;
- mutations are blocked until the affected state is repaired or migrated;
- generation from corrupted state is blocked unless a validated prior snapshot exists, which is not committed for MVP.

## Remote Data

LOGOS Engine has no LOGOS-owned remote store in MVP.

| Remote Data Category | Exists in MVP | Owner | Canonicality | Access Pattern | Retention / Restore Implication |
| --- | --- | --- | --- | --- | --- |
| LOGOS backend data | no | N/A | N/A | none | No hosted backend, backup, or operator restore. |
| Cloud workspace sync | no | N/A | N/A | none | Deferred until separately validated. |
| Remote AI provider request/response processing | optional | external provider | not LOGOS-owned canonical state | explicit provider call after disclosure | Provider retention is external and must be disclosed/configured; LOGOS should minimize transmitted context. |
| Telemetry/analytics | no | N/A | N/A | none | Prohibited by default. |
| Marketplace/profile registry | no | N/A | N/A | none | Excluded/deferred. |

Remote provider data must never be treated as durable project truth. Only validated, schema-shaped proposals or summaries that pass through LOGOS review flows may enter local state, and confirmed decisions still require user action.

## Synchronization Model

There is no local/remote synchronization model in MVP because LOGOS has no owned remote store and no multi-device cloud workspace.

The only reconciliation model is local file reconciliation:

| Scenario | Source of Truth | Conflict Detection | Resolution Rule | Recovery |
| --- | --- | --- | --- | --- |
| Existing generated file under configured root | structured state + profile for regeneration; user owns file | path exists, checksum/mtime differs, overwrite risk | warn and require confirmation before overwrite | skip, overwrite after confirmation, or change root |
| Manual edit to canonical Markdown | structured state remains durable truth; Markdown is review projection | checksum/mtime/source marker mismatch | warn before overwriting; future merge policy unresolved | preserve file and mark stale/conflict |
| Profile version changes | profile lock + new profile contract | profile id/version mismatch, missing document ids | validate compatibility, mark outputs stale/obsolete | migrate or block generation |
| State edited externally | local JSON state | schema validation, orphan refs, invalid transitions | enter diagnostic/recovery mode | user repairs or accepts migration |
| Provider failure during intake | prior local state | operation timeout/error | preserve user input and prior state | retry, reconfigure, or continue no-provider |

Idempotency applies to local commands:

- repeated `/init` must not destroy existing state without explicit confirmation;
- repeated validation reads current state and writes a new or superseding snapshot;
- repeated generation may update outputs only after write confirmation and must produce a new report;
- decision confirmation is idempotent only for the same decision revision and actor action.

Future cloud sync would require a new source-of-truth model, conflict policy, actor identity model, and security architecture review.

## Event Sourcing Considerations

Event sourcing is not used as the source of truth in MVP. Current state records remain canonical. However, audit events or embedded mutation history are required for decision revisions, migrations, generation reports, and sensitive configuration changes.

Recommended event envelope for audit/history records:

| Field | Purpose | Required |
| --- | --- | --- |
| eventId | Stable id for the recorded event. | yes |
| eventType | Domain event name, such as `DecisionConfirmed` or `GenerationPartiallyCompleted`. | yes |
| eventVersion | Version of event payload shape. | yes |
| aggregateId | Affected aggregate/entity id. | yes |
| aggregateType | Workspace, Decision, Generation, Validation, etc. | yes |
| actorId | Local user/system/provider-adapter actor label. | yes |
| causationId | Command or event that caused this event. | optional |
| correlationId | Flow/run/session id grouping related events. | optional |
| idempotencyKey | Key used to avoid duplicate command effects where needed. | optional |
| occurredAt | Domain event time. | yes |
| recordedAt | Persistence time. | yes |
| payload | Minimal changed data or references. | yes, minimized |
| metadata | Schema/profile/app version and redaction flags. | yes |
| schemaVersion | State schema version. | yes |
| conflictMetadata | Conflict or stale marker if applicable. | optional |
| privacyClassification | Sensitivity class for payload. | yes |

Replay is not required for MVP. Events/history are used for auditability and diagnostics, not for rebuilding state. If event sourcing is introduced later, Data Model must be reopened to define replay, projection, compaction, deletion, redaction, ordering, and migration policies.

## Migration Strategy

Migrations are local schema/profile/state migrations.

| Migration | Type | Scope | Forward Plan | Rollback or Roll-Forward Plan | Backfill Plan | Compatibility Risk | Test Plan | Release Impact | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace schema version migration | local schema | internal state files | Detect old schema, validate, transform to new schema, record MigrationRecord. | Prefer roll-forward; keep pre-migration backup/snapshot if implemented. | Add missing required fields with explicit defaults and caveats. | high if state cannot load | fixture migrations and corrupted-state tests | release-blocking | MVP |
| Profile lock migration | profile compatibility | profile id/version/document ids | Validate old lock against current profile; map renamed docs if mapping exists. | Block and ask user if unsafe. | Mark orphan outputs obsolete/historical. | medium/high | old profile lock fixtures | release-blocking when incompatible | MVP |
| Decision revision backfill | data backfill | decisions without revisions | Create initial revision from current decision value/status. | Roll-forward; do not delete decision. | revision 1 from existing content. | medium | fixture with old decisions | release-blocking if decisions exist | likely |
| Output status migration | local schema | output records/generation reports | Map older statuses to current enum. | Mark unknown statuses as review-needed/stale. | Recompute from file existence where possible. | medium | stale/missing output fixtures | release-blocking for generation | MVP |
| Event/audit history introduction | local schema | embedded or separate history | Start recording new events; optionally backfill summary events. | Roll-forward; old records remain valid without full history. | Backfill only minimal migration event. | low/medium | history-optional tests | non-blocking unless invariant depends on it | provisional |
| Remote data migration | remote | none | N/A | N/A | N/A | N/A | N/A | N/A | excluded |

Migration rules:

- state files must carry `schemaVersion`;
- migrations must run before state mutation;
- failed migrations enter recovery mode and must not silently discard data;
- destructive migrations require explicit user confirmation;
- profile contract changes must mark affected outputs stale, obsolete, or review-needed;
- migration notes are required for release when persisted state shape changes.

## Data Retention

Retention is local and user-owned. LOGOS does not offer legal hold, hosted retention, operator restore, or compliance-specific deletion guarantees in MVP.

| Data Category | Default Retention | Delete Behavior | Archive Behavior | Anonymization / Redaction | Restore Window | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Workspace metadata | until user deletes workspace state | manual deletion by user; future command deferred | none committed | support exports should redact local paths if needed | none unless user has filesystem/Git backup | Required for `/continue`. |
| Decisions and revisions | retain with workspace | deprecate/supersede rather than silent delete | none committed | redact in support contexts only | none committed | Auditability depends on history. |
| Assumptions/open questions/risks | retain until resolved/obsolete, then keep history by default | manual hard delete outside product | none committed | redact for exports/support | none committed | Keeps caveats visible. |
| Intake sessions/turns | unresolved | likely retain locally by default, with future pruning controls | possible summary archive | raw provider/user content may need minimization | none committed | Privacy review required. |
| Validation/diagnostic runs | latest required; history optional | old snapshots may be compacted | none committed | avoid broad sensitive payloads | none committed | Findings can be regenerated. |
| Generation reports | latest required; history optional | old reports may be compacted | none committed | local path redaction in support exports | none committed | Useful for recovery. |
| Generated Markdown/HTML/agent packs | persist until user deletes files | manual deletion by user | Git/user workflow | not anonymized by product | user filesystem/Git only | Outputs are user-owned repository files. |
| Provider config metadata | until cleared or workspace deleted | clear config command should remove metadata | none | token source display redacted | none | Raw tokens excluded. |
| Temporary files | remove after operation | cleanup after success/failure | none | no secrets | none | Stale temps may be cleaned on startup. |

Cascade behavior:

- deleting generated files does not delete structured state;
- deleting internal workspace state makes `/continue` unavailable but does not delete generated docs;
- changing documentation root does not delete prior generated files;
- removing a profile contract does not delete outputs automatically; it marks them orphaned/obsolete for review.

## Data Sensitivity

| Data Category | Sensitivity Class | Protection Expectation | Logging/Export Rule | Security Architecture Inheritance |
| --- | --- | --- | --- | --- |
| User answers and intake content | sensitive project context | local-only by default; disclose before remote provider use | exclude from debug logs unless explicit/redacted | context preview, minimization, redaction |
| Decisions, assumptions, questions, risks | sensitive project intent | local filesystem; user owns repository | redact in support bundles by default | local file permissions, export rules |
| Repository path and output paths | local path metadata | avoid unnecessary disclosure | redact in support artifacts if requested | path disclosure and traversal controls |
| Profile contracts | low sensitivity | validate as data, no execution | safe to include in reports unless custom profile sensitive | profile trust model |
| Validation/diagnostic findings | sensitive refs possible | minimize payload; reference affected object | logs must avoid broad context dumps | diagnostic redaction |
| Generated Markdown/HTML/agent packs | user-owned project content | local files; may be committed by user | no telemetry upload | output warnings and caveat preservation |
| Provider config metadata | secret-adjacent | redact token source display; never store raw token | never log token value | credential resolution and redaction |
| Raw provider tokens | secret | must not be stored in project files | never log/export | environment/credential-store rules |
| Audit/migration events | sensitive project metadata | minimize payload | redact support exports | event retention and protection |
| Telemetry/analytics | N/A | not collected by default | none | maintain exclusion |

Encryption guarantees must not be overstated. MVP relies on local filesystem and OS protections unless Security Architecture introduces stronger controls.

## Backup and Restore

LOGOS does not provide hosted backup or disaster recovery in MVP. Backup and restore are primarily the user's local filesystem, Git, and operating-system backup workflow.

| Scope | Backup Source | Frequency | RPO/RTO | Restore Behavior | Testing Expectation | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Internal workspace state | user filesystem/Git if included | user-controlled | no product guarantee | restore by restoring `.logos/` state files | fixture restore tests for readable state | Users may choose whether to commit internal state. |
| Generated docs and outcomes | user filesystem/Git | user-controlled | no product guarantee | restore by restoring files or regenerating from state | generation/regeneration tests | Derived outputs can be regenerated. |
| Profile contracts | package install / selected local profile | package/user-controlled | reinstall or restore profile dir | reload profile and validate | profile loading fixtures | Custom profiles need user backup. |
| Provider tokens | environment/OS credential store | external | no product guarantee | user reconfigures token source | redaction/config tests | Raw token values not restorable from LOGOS state. |
| Temporary files | none | N/A | N/A | cleanup | safe-write failure tests | Not backed up. |
| Remote provider data | provider-owned | external | no LOGOS guarantee | provider-specific | N/A | LOGOS should not depend on provider restore. |

Restore authorization is local user control: whoever can modify the repository can restore or replace files. Future support tooling must avoid taking ownership of user backups or implying compliance-grade recovery.

## Data Lineage and Auditability

Auditability supports user trust, recovery, and support without creating telemetry.

| Change | Required Lineage | User Visible | Internal Only | Retention |
| --- | --- | --- | --- | --- |
| Workspace initialization | timestamp, schema version, profile, root | yes in status/report | migration details | workspace lifetime |
| Documentation root change | old root, new root, confirmation timestamp, affected output status | yes | normalized path metadata | workspace lifetime |
| Provider config change | provider mode, endpoint/model, redacted token source, disclosure status | yes, redacted | credential source technical detail | until cleared/history policy |
| Intake turn recorded | actor, timestamp, session, source refs | summary visible | raw/summarized content depending policy | unresolved |
| Decision proposed | source turn/proposal, confidence, affected docs | yes | provider interpretation details | decision lifetime |
| Decision confirmed/revised/rejected/deferred | actor, timestamp, revision, prior status, affected docs | yes | event envelope | decision lifetime |
| Assumption/open question/risk update | source, status, affected docs, rationale where needed | yes | event details | record lifetime |
| Validation run | profile/state version, rule ids, findings | yes | deterministic keys | latest required/history optional |
| Diagnostic run | affected docs, severity, next action | yes | grouping metadata | latest required/history optional |
| Generation run | root, profile version, state version, outputs, failures | yes | checksums/write metadata | latest required/history optional |
| Migration | from/to schema version, migration id, result, failure details | yes if recovery needed | full migration record | workspace lifetime |

Lineage must not imply surveillance. Events and histories are local product records, not analytics events.

## Data Model Risks

| Risk | Affected Data Structure | Risk Type | Source | Likelihood | Impact | Early Signal | Mitigation | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Confusing internal `.logos/` state with generated `logos/` documentation root. | WorkspaceRecord, DocumentationRootConfig, OutputRecord | integrity/UX | product root change | medium | high | users expect generated docs in wrong folder or state files in docs root | keep terms distinct, show root in status, path tests | Frontend Architecture, Security Architecture | release-blocking if hard-coded incorrectly |
| Treating Markdown as the only source of truth. | Canonical Markdown, DecisionRecord | data integrity | old docs and generated docs workflow | medium | high | manual edits overwrite structured state or decisions disappear | state-first generation, stale/manual edit warnings | Generation, API Contracts | release-blocking |
| Retaining too much raw intake/provider content. | IntakeTurnRecord | privacy | AI-led conversation | medium | medium/high | support exports contain broad context | define retention/minimization; redaction rules | Security Architecture, Support Model | release review |
| Insufficient migration policy for JSON state. | WorkspaceRecord, DecisionRecord, OutputRecord | migration/reliability | filesystem storage | medium | high | new version cannot read old state | schemaVersion, fixtures, recovery mode, migration records | Deployment Plan, Test Strategy | release-blocking |
| Orphaned references after profile changes. | ProfileLockRecord, OutputRecord, DecisionRecord | referential integrity | profile versioning | medium | medium | validation reports unknown document ids | compatibility checks and orphan status | API Contracts, Test Strategy | release-blocking for generation |
| Derived agent packs used as canonical truth by downstream agents. | Agent Pack OutputRecord | trust/integration | agent pack feature | medium | high | downstream agent ignores caveats or state provenance | strong labels, source refs, review prompt rules | Integration Architecture | release-blocking for agent packs |
| Manual edits to generated Markdown lost on regeneration. | Canonical Markdown OutputRecord | reliability/trust | local files | medium | high | checksum mismatch before generation | warn/confirm overwrite; future merge policy | Frontend Architecture, Security Architecture | release-blocking for overwrite behavior |
| No database indexes may become slow for large projects. | DecisionRecord, Findings, OutputRecord | performance | filesystem-only stack | low/medium | medium | `/status` latency rises | runtime indexes, partition files, revisit DB trigger | Infrastructure, Test Strategy | monitor/prototype |
| Provider config accidentally stores raw token. | ProviderConfigRecord | security | AI provider setup | low/medium | critical | token appears in `.logos/config.json` or logs | redacted schema, tests, secret scan fixtures | Security Architecture | release-blocking |
| Validation and diagnostics collapse into AI opinion. | ValidationRunRecord, DiagnosticFindingRecord | correctness/trust | AI-assisted product | medium | high | `/validate` requires provider or produces non-reproducible result | enforce deterministic validation store and no-provider tests | Test Strategy | release-blocking |

## Downstream Handoff

Security Architecture must inherit:

- sensitivity classes for user answers, decisions, generated files, provider config, and audit records;
- prohibition on raw token persistence;
- path safety requirements for configured roots and generated outputs;
- remote provider disclosure and context preview requirements;
- redaction requirements for logs, support exports, and diagnostics.

API Contracts must inherit:

- command/query payloads for workspace, root config, profile lock, decisions, assumptions, questions, risks, findings, generation reports, outputs, provider status, and migrations;
- schema validation and typed error behavior for state read/mutation;
- idempotency expectations for `/init`, validation, generation, and decision confirmation;
- separation between deterministic validation results and advisory diagnostics.

Integration Architecture must inherit:

- provider request/response data is external/transient and not canonical;
- AI outputs enter only as schema-validated proposals or advisory records;
- agent packs are derived outputs with source references and caveats;
- remote data ownership belongs to the provider, not LOGOS.

Frontend Architecture must inherit:

- active repository, configured root, active profile, provider status, state health, output status, and stale/manual-edit warnings are first-class UI state;
- status labels must distinguish proposed, confirmed, assumed, open, stale, derived, failed, and blocked;
- root changes, overwrites, remote transmission, and destructive repair require explicit confirmation.

Infrastructure, Deployment, and Release Management must inherit:

- no database, no hosted backend, no telemetry, and no remote restore in MVP;
- Node/package releases must include profile contracts and support state schema migration notes;
- persisted schema changes are release-sensitive and require migration tests;
- package installation must not create hidden remote state.

Test Strategy must inherit:

- schema validation fixtures for every persisted record;
- corrupted-state, migration, stale-output, manual-edit, root-safety, no-provider, provider-failure, and raw-token tests;
- deterministic validation tests that run without live AI or network;
- golden output tests that prove assumptions and caveats remain visible.

Observability Plan and Support Model must inherit:

- local generation reports, validation runs, diagnostic findings, migration records, and audit history are the primary support evidence;
- support artifacts must be redacted and opt-in;
- no telemetry dashboards or hidden analytics are available in MVP.

Unresolved items to carry forward:

- exact internal state file split under `.logos/`;
- retention/minimization policy for raw intake turns and provider responses;
- manual-edit merge versus warning-only behavior for generated Markdown;
- backup snapshot strategy before migrations;
- whether audit events are stored as a separate log or embedded histories in MVP.
