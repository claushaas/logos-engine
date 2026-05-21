# Sync and State

## State Strategy

LOGOS Engine uses a local-first, filesystem-backed state strategy. The MVP is not a distributed sync product: it has no LOGOS-owned remote store, no cloud workspace, no multi-device replication, no public API server, no background worker, no event stream, no telemetry store, and no collaboration backend.

The strategy is intentionally narrow:

- structured local JSON state is the durable product truth for project clarity;
- profile YAML is the source of truth for profile/document contracts;
- contextual suggestions are advisory and may be transient or persisted for suppression/source traceability, but they are not confirmed state;
- Markdown under the configured documentation root is a human-readable projection;
- Executive JSON is a portable execution exchange model derived from the Normative Axis;
- HTML artifacts and agent packs are derived, regenerable outputs;
- TUI presentation state is ephemeral and rebuilt from durable state;
- remote AI provider state is external/transient and never authoritative for LOGOS state;
- deterministic validation and generation must work without live network access.

This fits the Product Stack and NFRs because the product promise is local ownership, Git-friendly output, explicit AI provider use, and safe regeneration, not cloud collaboration. The trade-off is that LOGOS does not provide cross-device sync, server backup, remote invalidation, shared editing, or automatic recovery from local disk loss in the MVP.

State complexity intentionally avoided in MVP:

- bidirectional local/remote sync;
- mutation queues for remote replay;
- CRDTs, operational transform, vector clocks, or event sourcing;
- cache-as-authority patterns;
- background sync;
- multi-client conflict resolution;
- hosted operator recovery;
- telemetry-based state observability.

## State Taxonomy

| State Category | Description | Owner | Source of Truth | Persistence Class | Storage Location | Mutation Authority | Read Authority | Sync Behavior | Consistency Model | Sensitivity Class | User-Visible Trust Level | Recovery Behavior | Downstream Implications | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Profile contract state | Phase, document, completion, artifact, and agent pack definitions. | Product/profile maintainer or user for custom profiles. | Profile YAML. | Durable contract. | Bundled `profiles/` or selected profile path. | Profile loader/configuration only. | Profile service, validation, generation. | Local-only; no sync. | Immediate after profile load/validation. | Low; custom profiles may be confidential. | Contract authority. | Invalid profile blocks dependent commands. | Frontend, Test, Release. | MVP |
| Workspace configuration | Repository identity, active profile, documentation root, provider mode, redacted token source. | User. | Local structured state. | Durable local. | Internal state root, recommended `.logos/`. | Config/workspace services. | Status, generation, provider services. | Local-only; no sync. | Immediate after safe write. | Local metadata / secret-adjacent. | Current configuration. | Invalid config enters recovery or blocks affected command. | Security, API, Infrastructure. | MVP |
| Project clarity state | Decisions, assumptions, open questions, risks, dependencies, source references. | User. | Local structured state. | Durable local. | Internal JSON records. | Application/domain services after validation and confirmation. | Status, validation, generation, AI context builder. | Local-only; no sync. | Immediate after safe write. | Confidential project intent. | Canonical product truth. | Schema errors block mutation; recovery guidance shown. | Frontend, Test, Observability. | MVP |
| Intake/session state | Conversation turns, summaries, proposed interpretations, continuity metadata. | User. | Local structured state, with retention policy review-needed. | Durable or summarizable local. | Internal session records. | Intake service. | Intake, context builder, traceability. | Local-only; no sync. | Ordered within session. | Sensitive project context. | Source/evidence, not confirmed truth. | Provider failure preserves input and prior state. | Security, Support. | MVP / review-needed |
| AI proposal state | Provider-derived suggestions, drafts, proposed decisions, diagnostics. | LOGOS as proposed/advisory data; user controls confirmation. | Local structured proposal records after schema validation. | Durable until reviewed or pruned. | Internal state. | Intake/AI interpretation service; decision service for review result. | TUI, diagnostics, generation only when accepted/eligible. | Local-only; provider is not authority. | Proposed until explicit review. | Sensitive project context. | Advisory/proposed. | Invalid provider output rejected before mutation. | Security, Test. | MVP |
| Contextual suggestion state | Suggested answers/options generated for directly related questions from prior project state. | LOGOS as advisory data; user controls use. | Source-labeled suggestion record or transient response. | Transient or durable until reviewed/pruned. | Internal session state or in-memory response. | Contextual suggestion service; intake/decision services after user action. | TUI intake, proposal review, diagnostics follow-up. | Local-only; no sync. | Stale when source refs change. | Sensitive project context. | Optional/advisory. | Ask question without suggestion if state is stale or unavailable. | API, Frontend, Test. | MVP / validation-required |
| Validation state | Deterministic validation runs and findings. | LOGOS validation service. | Validation rules + current structured state/profile. | Snapshot/history local. | Internal reports/state. | Validation service. | Status, generation preflight, diagnostics. | Local-only; no AI dependency. | Recomputed snapshot. | Sensitive refs possible. | Deterministic result. | Rerun after state/profile change. | Test, Observability. | MVP |
| Generation state | Output records, generation runs, stale/failed/partial markers. | LOGOS generation service; user owns files. | Local structured generation report. | Durable local status. | Internal state plus generated files. | Generation service. | Status, output browsing, support. | Local-only; no sync. | Immediate after generation attempt. | Local path/project metadata. | Output status evidence. | Partial failures preserved and reported. | Frontend, Observability. | MVP |
| Canonical Markdown files | Human-readable generated documents. | User. | Rendered from structured state + profile contracts. | Durable generated output. | Configured root, default `logos/`. | Generation service after confirmation. | User/editor/Git; status may inspect metadata. | Local-only; no sync. | Projection can become stale. | User-owned project content. | Canonical review output, not sole state authority. | Regenerate from current state; manual edit policy review-needed. | Frontend, Support. | MVP |
| Derived HTML artifacts | Navigable rendered views. | User. | Canonical inputs and renderer. | Durable derived output. | Profile-defined outcomes path under configured root. | Generation/renderer service. | Browser/editor/user. | Local-only; no sync. | Regenerable derived projection. | User-owned project content. | Derived. | Rebuild or delete safely. | Frontend, Security. | MVP / renderer provisional |
| Derived agent packs | Compact downstream agent context. | User. | Canonical inputs and renderer. | Durable derived output. | Profile-defined outcomes path under configured root. | Generation/renderer service. | User/downstream agents. | Local-only; no sync. | Regenerable derived projection. | Sensitive project context. | Derived/non-authoritative. | Rebuild; stale status if source changes. | Agent Security, Operations. | MVP |
| Executive JSON and exports | Portable execution model and export snapshots. | User. | Normative documents, profile contracts, executive schema, and adapter mappings. | Durable derived/exchange output. | Profile-defined outcomes path under configured root. | Executive compiler/export adapters. | User/external import tools/downstream agents. | Local-only; no sync in MVP. | Regenerable derived execution projection. | Sensitive project execution context. | Exchange model and derived exports, not live task state. | Rebuild; stale status if normative source changes. | Integration, Operations. | post-baseline |
| Ephemeral TUI state | Focus, screen, command input, transient loading/error display. | Runtime. | In-memory runtime. | Ephemeral. | Process memory. | TUI components. | TUI only. | None. | Rebuilt from durable state on launch. | Low to sensitive while displayed. | Presentation only. | Discard on exit/crash. | Frontend Architecture. | MVP |
| Remote provider state | Provider-side request/response processing and possible provider retention. | External provider. | Provider system, not LOGOS. | External/transient or provider-retained. | Provider infrastructure. | Provider. | LOGOS receives normalized response only. | No LOGOS sync; one request/response interaction. | External and unverifiable by LOGOS. | Sensitive project context when remote. | Not authoritative. | Retry/reconfigure/continue without AI. | Security, Integration. | Optional MVP |
| Telemetry state | Product analytics, usage tracking, crash reporting. | N/A. | None. | Not collected. | N/A. | N/A. | N/A. | None. | N/A. | N/A. | Not available. | N/A. | Observability. | Excluded |

State that must never persist in project files: raw provider tokens, auth headers, full environment dumps, hidden provider SDK payloads, unrelated repository source code, Git history, and telemetry identifiers.

## Source of Truth

| Data or State Type | Authoritative Source | Mutation Authority | Read Fallback | Conflict Authority | Offline Authority | Stale Behavior | Enforcement Mechanism | User-Visible Implication | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Profile/document contracts | Active profile YAML. | Profile selection/loader. | None; invalid profile blocks. | Profile schema and active profile lock. | Local profile files. | Profile change invalidates compatibility/status. | YAML schema validation and profile lock. | User sees active profile and validation errors. | MVP |
| Documentation root | Local workspace configuration. | Config service after confirmation. | Default `logos/` on init only. | Config service. | Local config. | Root change makes old outputs stale/unknown. | Path validation and confirmation. | Status shows root and custom/default state. | MVP |
| Confirmed decisions | Local structured decision records. | Decision service after explicit user action. | None; Markdown cannot override state. | Decision service invariants. | Local state. | Changes mark affected outputs stale. | Transition rules and audit/revision records. | User sees confirmed/proposed/rejected/deferred labels. | MVP |
| AI proposals | Schema-validated local proposal records. | Intake/AI service creates; user review resolves. | Provider raw output is not fallback truth. | Decision service/user review. | Local proposal state. | Stale if source context changes. | Provider output schema and proposal status. | User sees advisory/proposed status. | MVP |
| Contextual suggestions | Bounded prior state plus current question context. | Contextual suggestion service creates; user accept/edit/reject/ignore resolves. | No suggestion is safer than weak or stale suggestion. | Source refs and user action. | Local state. | Stale when referenced decisions, assumptions, questions, documents, or findings change. | Source-basis validation and suggestion status. | User sees optional suggested answer with caveat/source text. | MVP / validation-required |
| Validation findings | Deterministic validation run over current state/profile. | Validation service. | Latest prior run can be displayed as stale only. | Current validation run. | Local rules and state. | Stale after state/profile change. | Rule ids, state/profile version refs. | Findings show current/stale status. | MVP |
| Generation output status | Local generation report/output records. | Generation service. | Filesystem inspection may update missing/manual-edit flags. | Generation service plus filesystem metadata. | Local filesystem. | Stale after source change or root/profile change. | Source version refs, checksums/mtime where implemented. | User sees generated/stale/failed/partial/missing. | MVP |
| Canonical Markdown content | Generated projection from structured state + profile. | Generation service after confirmation. | Existing file can be read by user but not treated as structured truth. | Structured state wins; manual merge policy unresolved. | Local filesystem. | Stale when source changes. | Output metadata and overwrite warnings. | User may review/edit but regeneration may warn. | MVP / merge review-needed |
| Derived HTML/agent packs | Renderer output from canonical inputs. | Generation/renderer service. | Regenerate from canonical inputs. | Canonical inputs win. | Local filesystem. | Stale when source changes. | Derived output classification. | User sees derived/non-authoritative status. | MVP |
| Provider configuration | Local redacted config plus external credential source. | Config service. | Unconfigured/no-provider mode. | Config service/security rules. | Local deterministic mode. | Provider status may become unavailable. | Token source refs only, status checks. | User sees provider mode/status without token. | MVP |
| Remote provider response | External provider response normalized by adapter. | Provider adapter creates normalized result; LOGOS validates. | Retry or no-provider path. | LOGOS schemas and user review. | None for live AI. | Response not reused as authority unless accepted into local state. | Schema validation and confirmation gates. | Provider output is advisory. | MVP |

Fallback reads never become authority. If local structured state and generated output disagree, LOGOS must treat generated output as stale or manually edited rather than silently importing it as truth.

## Local State

Local state is the primary runtime model. The recommended internal root remains `.logos/`, while the generated documentation root defaults to `logos/` and is configurable.

| Local State | Storage Engine | Lifecycle | Sensitive Handling | Migration | Reset / Deletion | Corruption Handling | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace metadata | JSON filesystem record. | Created by `/init`; read on startup/status. | Contains local path metadata. | Schema version required. | User deletes internal state or future reset command. | Block mutation and show recovery. | MVP |
| Profile lock | JSON record referencing YAML profile. | Created/updated on profile selection/init. | Low sensitivity; custom paths may reveal local metadata. | Profile compatibility validation. | Recreate on init/profile change. | Invalid profile blocks dependent commands. | MVP |
| Decisions/assumptions/questions/risks | JSON collections or partitioned files. | Mutated by application services. | Sensitive project intent; not logged wholesale. | Release-blocking state migrations. | User-managed until reset/delete command exists. | Block mutation; validation/repair guidance. | MVP |
| Intake sessions/turns | JSON session records or summaries. | Open, paused, completed, archived/pruned. | Sensitive; raw retention review-needed. | Must preserve source refs if pruned. | User-managed; future privacy cleanup needed. | Preserve prior state if provider fails. | MVP / review-needed |
| Validation/diagnostic/generation reports | JSON snapshots/history. | Recomputed by commands; latest status visible. | May include paths and sensitive refs. | Report schema versioned. | History retention optional. | Rerun when safe; block if source invalid. | MVP |
| Provider config | JSON redacted metadata. | Configured through `/config ai`. | No raw tokens; token source ref only. | Provider enum/source shape may evolve. | Clear config or remove token source externally. | Unsafe token storage rejected. | MVP |
| Generated files | Markdown/Executive JSON/executive export/HTML/agent pack files. | Written by `/generate`; user may edit/delete. | No secrets; project content may be sensitive. | Regeneration can update shape. | User deletes files manually. | Missing/manual edit detected where metadata exists. | MVP / post-baseline by output kind |
| Temporary write files | Temp files during atomic write. | Created during write, removed after success/failure. | Must not contain secrets; same content sensitivity as target. | N/A. | Cleanup after interrupted write. | Detect leftover temp files and report/cleanup safely. | MVP |
| TUI presentation state | Memory only. | Per process/session. | Avoid persisting secrets/input buffers unnecessarily. | N/A. | Discard on exit. | Rehydrate from durable state. | MVP |

LOGOS does not implement application-level encryption at rest in MVP. It relies on OS/filesystem protections and must avoid persisting secrets.

## Remote State

LOGOS-owned remote state is unsupported in the MVP.

| Remote State Category | Exists in MVP | Owner | Canonicality | Access / Mutation Path | Consistency | Degraded Behavior | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LOGOS cloud workspace | No. | N/A. | N/A. | None. | N/A. | Local state continues. | Excluded |
| Multi-device sync store | No. | N/A. | N/A. | None. | N/A. | User may use Git/filesystem manually outside LOGOS. | Deferred |
| Hosted auth/session state | No. | N/A. | N/A. | None. | N/A. | Local OS user model only. | Excluded |
| Remote AI provider processing | Optional. | External provider. | Not LOGOS canonical. | Explicit provider call after configuration/disclosure. | Provider-defined. | Retry, reconfigure, or continue without AI where possible. | MVP optional |
| Remote telemetry/analytics | No. | N/A. | N/A. | None. | N/A. | No telemetry. | Excluded |
| Package/release registry | Yes, outside runtime. | Maintainers/npm/GitHub. | Software distribution only. | Install/update. | Platform-defined. | User keeps installed version. | Runtime-adjacent |

Remote provider retention, backup, deletion, and restore are governed by provider policy, not by LOGOS. LOGOS must minimize transmitted context and cannot claim provider-side deletion or consistency guarantees.

## Cache Strategy

LOGOS avoids persistent caches in MVP. Runtime lookup maps and computed views may exist, but they are derived from validated local state and can be discarded.

| Cache Name | Cached Data | Cache Type | Population Rule | Invalidation Rule | TTL | Stale-While-Revalidate | Eviction Rule | Persistence | Stale Labeling | Poisoning Prevention | Bypass Rule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Runtime state indexes | Maps by decision id, output path, severity, profile document id. | In-memory derived index. | Build after schema-valid state/profile read. | Rebuild after mutation, reload, migration, or profile change. | Process lifetime. | No. | Discard on exit. | None. | Not user-visible. | Build only from validated state. | Bypass by reading/validating source files. |
| Profile contract lookup | Parsed profile contracts. | In-memory read-through. | Load active/bundled profile. | Invalidate on profile selection/version/path change. | Process lifetime. | No. | Discard on exit. | None. | Profile errors shown if invalid. | YAML schema validation. | Re-read profile files for validation/generation. |
| Provider status result | Last provider test/status. | Ephemeral status cache. | Populate on `/config ai --test` or status check. | Invalidate on provider config change or timeout. | Short/session-scoped; exact TTL review-needed. | Display as last-known if implemented. | Discard on exit. | None. | Must label last-known/unavailable. | No raw tokens in cached result. | Bypass with explicit provider test. |
| Generated output metadata | Checksum/mtime/source refs. | Durable metadata, not content cache. | Record after generation. | Invalidate when source state/profile/root/file metadata changes. | Until next generation/status check. | Yes only as stale marker. | Supersede with new generation report. | Local JSON. | Stale/missing/manual-edit labels. | Path containment and source refs. | Bypass by filesystem inspection. |

No cache may masquerade as fresh canonical data. If a cache/index and source state disagree, source state wins and the cache is rebuilt or marked invalid.

## Derived State

Derived state is useful but non-authoritative.

| Derived State | Source Dependencies | Recompute Trigger | Persistence Rule | Invalidation Rule | Correctness Rule | Drift Detection | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase/document progress | Profile contracts, decisions, findings, output status. | `/status`, validation, generation, state change. | May be computed on read or stored as status snapshot. | State/profile/output changes. | Cannot override canonical records. | Compare source version refs. | MVP |
| Validation summary | Validation findings. | `/validate`, `/status` if needed. | Snapshot allowed. | State/profile/rule version changes. | Deterministic and provider-independent. | Rule/state version mismatch. | MVP |
| Diagnostic summary | State, validation findings, optional AI advisory result. | `/diagnose` or status guidance. | Snapshot allowed. | State/profile/provider context changes. | Advisory only; no mutation. | Source refs/stale marker. | MVP |
| Generated Markdown | Structured state + profile contracts + renderer. | `/generate`. | Durable file projection. | Source state/profile/root changes; manual edit detection. | Projection must preserve caveats and labels. | Output source refs/checksum/mtime. | MVP |
| Executive JSON and exports | Normative documents + executive schema + adapter mappings. | `/generate` or future executive command. | Durable derived/exchange files. | Normative source/profile/root changes. | Export snapshots must preserve source refs and no-live-sync labels. | Executive plan/export metadata. | post-baseline |
| HTML artifacts | Canonical/generated content + renderer. | `/generate`. | Durable derived files. | Source output/state changes. | Derived, escaped, no telemetry. | Output metadata. | MVP |
| Agent packs | Canonical/generated content + renderer. | `/generate`. | Durable derived files. | Source output/state changes. | Derived, no secrets, bounded context. | Output metadata. | MVP |
| TUI view models | Durable state + current command context. | Screen render. | In-memory only. | Any relevant state change. | Presentation only. | Re-render from source. | MVP |

Persisted derived state must be safely discardable. Regeneration should rebuild it from structured state and profile contracts, not from previous derived files.

## Hydration

Hydration is local startup/readiness, not client/server hydration.

| Scenario | Sequence | Available Before Completion | Failure Behavior | User-Visible State |
| --- | --- | --- | --- | --- |
| First launch, no workspace | Detect repository, show orientation, offer `/init`. | Help, orientation, provider guidance. | Missing state is not an error. | Uninitialized / ready to initialize. |
| `/init` | Confirm creation, create internal state, lock profile, set root default `logos/`. | Help/status. | Preserve existing state; refuse destructive reinit without confirmation. | Initialized or existing workspace. |
| Returning launch | Read workspace config, profile lock, state files, provider metadata, output metadata. | Minimal shell/help if reads are pending. | Invalid/corrupt state enters recovery; mutations blocked. | Ready, degraded, or recovery-needed. |
| After provider config | Read redacted provider config; optionally test provider. | Local commands continue. | Provider unavailable does not corrupt state. | Provider configured/unavailable/unconfigured. |
| After state migration | Validate schema version, apply migration only if safe and confirmed where destructive. | Recovery/status. | Failed migration blocks mutation and preserves evidence. | Migration needed/failed/complete. |
| After root change | Validate path, update config, mark prior outputs stale/unknown where needed. | Status and validation. | Unsafe path denied. | Root changed; outputs stale/unknown. |
| After reset/delete | Future behavior; not fully defined. | Help/init. | Must require strong confirmation. | Uninitialized or reset-complete. |

Readiness states exposed to UI/API consumers should include: uninitialized, loading, ready, degraded, provider-unavailable, profile-invalid, state-invalid, migration-needed, recovery-needed, generating, partial, and failed.

## Offline Behavior

LOGOS is offline-capable by default because it is local-first. This is not the same as offline sync.

| Capability | Offline State | Behavior | User Messaging |
| --- | --- | --- | --- |
| Launch TUI | Available. | Read local state/profile. | Show repository/root/profile/provider status. |
| `/init` | Available. | Create local state. | Confirm local writes. |
| `/status` | Available. | Inspect local state and output metadata. | Show local status and stale/missing outputs. |
| `/validate` | Available. | Run deterministic validation. | Provider-independent validation. |
| `/diagnose` | Available/degraded. | Local deterministic diagnostics available; AI-assisted diagnostics require provider. | Label no-provider or provider-unavailable mode. |
| AI-led `/continue` | Depends on provider mode. | Local provider can work if available; remote provider requires network; no-provider mode preserves input/guidance. | Explain provider requirement and recovery path. |
| `/generate` | Available if state/profile valid. | Generate local Markdown, HTML artifacts, agent packs. | Report created/updated/skipped/failed/stale. |
| Remote provider calls | Disabled without network/provider. | Block/retry/reconfigure. | Preserve input and show safe next action. |
| Cloud sync/multi-device replication | Unsupported. | No queue or replay. | Do not promise sync. |

Offline mutations are local state writes only. There is no remote replay queue in MVP because no LOGOS remote store exists. When connectivity returns, LOGOS does not auto-sync; the user may retry provider operations manually.

## Mutation Queue

There is no remote mutation queue in MVP. State-changing commands execute locally through application services and safe filesystem writes.

| Mutation Type | Source Action | Queue Name | Ordering Key | Idempotency Key | Payload | Persistence | Encryption Required | Retry Policy | Cancellation Rule | Compaction Rule | Replay Rule | Failure State | User-Visible State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace init | `/init` | None; synchronous local command. | Workspace id/path. | Command/request id if implemented. | Workspace/profile/root metadata. | Durable state after success. | No app encryption; no secrets. | Retry after failure only if no partial unsafe state. | Cancel before confirmation/write. | Repeated init is idempotent/refusal-based. | No remote replay. | Existing/failed/recovery-needed. | Initialized/existing/failed. |
| Decision review | confirm/revise/reject/defer. | None. | Decision id. | Decision transition id/revision id. | Decision change and source refs. | Durable state after success. | No app encryption. | Retry only if prior write outcome known. | Cancel before confirmation. | Supersede/revision history, no silent overwrite. | No remote replay. | Invalid transition/write failure. | Proposed/confirmed/rejected/deferred/failed. |
| Provider config | `/config ai`. | None. | Workspace/provider id. | Config change id. | Redacted provider config only. | Durable metadata after success. | Raw token forbidden. | Retry config/test separately. | Cancel before save. | Same config no-op. | No remote replay. | Unsafe token storage/provider unavailable. | Configured/unavailable/unconfigured. |
| Generation | `/generate`. | None; generation plan local. | Output path/root/profile/state version. | Generation run id + output path. | Render plan and content. | Files + generation report. | No secrets. | Retry generation after fixing state/path. | Cancel before writes where supported. | Same content no-op; changed existing file needs confirmation. | No remote replay. | Partial/failed/stale. | Created/updated/skipped/blocked/partial/failed. |
| Provider request | AI intake/diagnosis. | None; request/response call. | Session/operation id. | Provider operation id if implemented. | Bounded prompt context. | Raw payload not persisted by default. | Token in memory only. | Retry manually with timeout/backoff. | Cancel if provider call supports abort. | Do not merge duplicate provider proposals silently. | No durable replay. | Timeout/auth failure/invalid output. | Retry/reconfigure/no-provider. |

If future remote sync is introduced, this section must be replaced with a durable encrypted/minimized queue model, replay semantics, idempotency retention, cancellation, compaction, conflict handling, and user-visible pending states.

## Sync Protocol

MVP sync protocol: none for LOGOS-owned state.

The system does have local reconciliation flows:

| Flow | Direction | Trigger | Source | Destination | Transport | Payload | Cursor or Checkpoint | Ordering Rule | Acknowledgement Rule | Retry Policy | Idempotency Rule | Failure Behavior | Observability Events | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| State read/rehydration | filesystem to runtime | startup/status/command | Internal JSON state | Application services | Local filesystem | Structured records | Schema version | Read config/profile before dependent state. | Successful parse/validation. | Retry after repair/migration. | Read-only. | Recovery-needed; block mutation. | StateReadSucceeded/Failed. | MVP |
| State mutation/write | runtime to filesystem | state-changing command | Application service result | Internal JSON state | Local filesystem safe write | Updated record(s) | State schema/version refs | Command-specific invariant order. | Write success + re-read if needed. | Retry only with known prior outcome. | Request/revision ids where needed. | Preserve prior state if write fails. | StateWriteSucceeded/Failed. | MVP |
| Generation | state/profile to files | `/generate` | Structured state + profile | Markdown/HTML/agent packs | Local filesystem safe write | Rendered files + report | Source version refs/checksums | Plan before write; report per output. | Output write result. | Retry per failed output/generation run. | Output path + content checksum. | Partial generation visible. | GenerationCompleted/Partial/Failed. | MVP |
| Provider interaction | local runtime to external provider and back | AI command after consent | Bounded prompt context | Provider endpoint; normalized result returns | HTTP/provider SDK | Prompt/context and response | Provider operation id/request id if implemented | Single request/response; streaming deferred. | Response received and schema-validated. | Timeout/backoff/retry manual or bounded. | Provider operation id; proposals dedupe by source. | Preserve input/prior state; invalid output rejected. | ProviderCallStarted/Succeeded/Failed. | Optional MVP |

Unsupported sync behaviors: bidirectional cloud sync, delta replication, event-stream sync, webhooks, push notifications, background sync, cross-device invalidation, CRDT/OT merge, server-issued cursors, and sync-driven deletion propagation.

## Cursors and Checkpoints

There are no remote cursors in MVP. Checkpoints are local version/source references used for safety, stale detection, and recovery.

| Checkpoint | Storage | Advancement Rule | Rollback / Invalidation | Expiration | Replay Behavior | Observability |
| --- | --- | --- | --- | --- | --- | --- |
| State schema version | Workspace/state records. | Advanced only through explicit migration. | Failed migration blocks mutation; manual recovery required. | Never within workspace lifetime. | No replay; migrate/repair. | Startup/migration status. |
| Profile version/source ref | Profile lock. | Advanced on confirmed profile change. | Invalid profile blocks generation/validation. | Until profile change. | Revalidate with selected profile. | Profile status. |
| Decision revision id | Decision records. | Advanced on decision transition/revision. | Supersede instead of silent rollback. | Retained with decision. | No replay without explicit command. | Decision history/audit. |
| Generation run id | Generation report. | Advanced per generation attempt. | Prior run becomes historical; outputs may be partial/stale. | Latest required; history optional. | Retry creates new run. | Generation report/status. |
| Output source refs/checksum | Output records. | Advanced after successful output write/metadata update. | Invalidated by state/profile/root/file changes. | Until next generation/status update. | Regenerate from current source. | Stale/manual edit/missing labels. |
| Provider operation id | Provider result/proposal metadata if persisted. | Set per provider call. | Invalid output not promoted. | Retention review-needed. | Retry creates new operation; no hidden replay. | Provider failure/status. |

If checkpoint metadata is corrupted or lost, LOGOS must prefer conservative stale/unknown labels over false freshness.

## Conflict Detection

Since there is no remote replication, MVP conflicts are local consistency and authority conflicts.

| Conflict Type | Affected Data | Detection Mechanism | Automatic Resolution | Manual Resolution | Precedence Rule | Invariant Protection | User Notification | Audit Event | Test Implication | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Generated file collision | Markdown/HTML/agent pack path. | Target path exists before write. | Skip or no-op if identical content. | Confirm overwrite, change root, or skip. | Existing file protected until confirmed. | Path under configured root only. | Conflict/overwrite prompt. | Generation conflict event. | Collision fixtures. | MVP |
| Manual edit to generated file | Canonical Markdown or derived output. | Checksum/mtime/source marker mismatch where available. | Mark stale/manual-edit; do not overwrite silently. | Confirm overwrite or future merge. | Structured state remains product truth; user owns file. | No silent data loss. | Manual edit warning. | OutputStale/ManualEditDetected. | Metadata tests. | MVP / merge review-needed |
| State schema mismatch | Internal JSON state. | Schema version/parse validation. | None if unsafe. | Repair/migrate after confirmation. | Valid schema required before mutation. | Block corrupt mutation. | Recovery-needed state. | StateReadFailed/MigrationFailed. | Corrupt-state fixtures. | MVP |
| AI proposal vs confirmed decision | Decisions/proposals. | Proposed content contradicts confirmed state or invalid transition. | Keep as proposal/diagnostic gap. | User revises/rejects/confirms explicitly. | Confirmed user decision wins until changed by user. | AI cannot auto-confirm. | Proposed/conflict label. | ProposalConflictDetected. | Decision transition tests. | MVP |
| Profile contract vs existing state | Document ids, required sections, validation rules. | Profile compatibility validation. | Mark orphaned/stale where safe. | User resolves profile/root/state choices. | Active profile controls future generation. | Do not delete existing state silently. | Profile compatibility warning. | ProfileCompatibilityFinding. | Profile migration fixtures. | MVP |
| Root change vs prior outputs | Output metadata/files. | Root config change. | Mark prior outputs unknown/stale/orphaned. | User browses old root manually or regenerates new root. | Active root controls future generation. | No cross-root overwrite. | Root changed/stale outputs. | RootChanged. | Root change tests. | MVP |
| Provider response malformed | AI proposals/intake. | Response schema validation. | Reject before mutation. | Retry/reconfigure/continue manually. | Local state remains unchanged. | No state corruption. | Invalid AI output message. | ProviderInvalidOutput. | Malformed provider fixtures. | MVP |

Conflicts that are unsupported/deferred: multi-device write/write conflicts, server delete/update conflicts, remote permission conflicts, CRDT merge conflicts, webhook replay conflicts, and cross-client stale writes.

## Conflict Resolution

LOGOS must never use unqualified last-write-wins for meaningful project state. Resolution must preserve user agency and avoid silent loss.

| Conflict Type | Automatic Resolution | Manual Resolution | Precedence Rule | Invariant Protection | User Notification | Audit Event | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Identical generated file content | No-op; record skipped/unchanged. | None needed. | Same content equals safe idempotent write. | No data loss. | Report skipped/unchanged. | OutputSkipped. | MVP |
| Existing different file | None by default. | Confirm overwrite, skip, or change root. | Existing file protected until confirmation. | Prevents silent overwrite. | Affected-file preview. | OutputConflict. | MVP |
| Manual Markdown edit | Mark stale/manual-edit. | Confirm overwrite or future merge workflow. | Structured state drives regeneration; manual file is preserved until confirmed. | Prevents hidden source-of-truth drift. | Warning before regeneration overwrite. | ManualEditDetected. | MVP / merge review-needed |
| AI contradiction | Keep as proposal/diagnostic issue. | User confirms/revises/rejects/defer. | Confirmed decisions win. | AI cannot mutate confirmed state. | Conflict/proposal label. | ProposalReviewed. | MVP |
| Invalid/corrupt state | Block mutation. | Repair from backup, migrate, or reset after confirmation. | Valid prior state wins if recoverable. | Prevents compounding corruption. | Recovery-needed guidance. | StateRecoveryNeeded. | MVP |
| Profile incompatibility | Mark affected docs/outputs stale/orphaned. | User chooses profile/root/state remediation. | Active valid profile controls future output. | Generation blocked if contract invalid. | Compatibility warnings. | ProfileCompatibilityFinding. | MVP |

Unresolved conflicts should block only affected unsafe operations. Safe reads, help, status, and recovery guidance should remain available.

## Idempotency

Idempotency is local-command idempotency, not distributed sync idempotency.

| Operation Scope | Key Generation | Key Retention | Replay Behavior | Duplicate Handling | Payload Mismatch Behavior | Data/API Implication | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/init` | Workspace path/id and init request. | Workspace lifetime. | Re-running reports existing workspace unless destructive reinit confirmed. | No duplicate workspace creation. | Different profile/root requires explicit change flow. | Init is refusal/idempotent by default. | MVP |
| Config change | Config change id or normalized target config. | Config history optional; current config required. | Same config is no-op/status. | No duplicate side effect. | Different config requires confirmation where risky. | Redacted config records. | MVP |
| Decision transition | Decision id + revision/transition id. | Decision lifetime. | Retry should not create duplicate confirmed transitions if prior success known. | Existing revision recognized. | Same key/different payload rejected if keys implemented. | Decision revisions required. | MVP |
| Generation output write | Output path + source version + content checksum. | Latest output metadata; history optional. | Same content no-op; failed output can retry. | Skipped/unchanged. | Changed existing file requires confirmation. | Output records need source refs/checksum. | MVP |
| Provider request | Provider operation id/session turn id if persisted. | Retention review-needed. | Retry creates new advisory result unless deduped by source. | Duplicate proposals should not auto-confirm. | Treat as separate proposal or reject duplicate key mismatch. | Provider result metadata. | Review-needed |
| Future remote sync | Not implemented. | N/A. | N/A. | N/A. | N/A. | Must define before feature. | Deferred |

Retries must not duplicate irreversible side effects. If LOGOS cannot determine whether a prior local write succeeded, it must re-read state/files before retrying.

## Ordering and Causality

Ordering is local and command-scoped in MVP.

| State / Flow | Ordering Rule | Clock Assumption | Causation / Correlation | Out-of-Order Handling | Not Guaranteed |
| --- | --- | --- | --- | --- | --- |
| Intake turns | Stable session turn order. | Timestamps are metadata, not authority. | Session id and turn id connect proposals to source turns. | Invalid/missing order enters recovery or sorted by stored order field. | Cross-device turn ordering. |
| Decision revisions | Revision order per decision. | Timestamp useful for display only. | Revision references prior decision state and source action. | Reject invalid transition. | Concurrent remote edits. |
| State writes | Command handler applies invariants before write. | Filesystem mtime not authoritative for domain order. | Command/request id if implemented. | Re-read state before retry. | Distributed transaction ordering. |
| Generation | Plan outputs from one source snapshot; report per output. | Generation timestamp is report metadata. | Generation run id and source refs. | Partial outputs reported individually. | All-or-nothing multi-file transaction. |
| Provider calls | Request/response within operation. | Provider timing not domain authority. | Provider operation id, session id, source refs. | Late/invalid response cannot auto-mutate confirmed state. | Provider ordering across retries/streaming. |
| Output file metadata | Checksum/source refs preferred; mtime is supporting signal. | Clock skew exists across tools/OS/Git. | Output record connects file to generation run. | Conservative stale/manual-edit label. | mtime-only freshness. |

LOGOS should avoid relying on timestamps as authoritative ordering. If future remote/multi-client sync appears, the design must define server-issued sequence numbers, vector/Lamport clocks, or another explicit causality mechanism before implementation.

## Background Sync

Background sync is unsupported in the MVP.

| Sync Mode | MVP Behavior | Reason | User-Visible Expectation |
| --- | --- | --- | --- |
| Foreground local operations | Supported. | TUI command flow is the product surface. | User sees command progress and result. |
| App-start hydration | Supported. | Startup reads local state/profile. | User sees ready/degraded/recovery-needed. |
| Manual provider retry | Supported where provider configured. | User controls remote calls. | Retry/reconfigure/no-provider options. |
| Scheduled background sync | Unsupported. | No remote store, no daemon, no worker. | No automatic freshness promise. |
| Push/webhook sync | Unsupported. | No public endpoint or webhooks. | No remote invalidation. |
| OS background jobs | Unsupported. | TUI is foreground process. | Closing TUI stops runtime activity. |

If background work is introduced later, it must define lifecycle, cancellation, retry windows, process ownership, privacy-safe observability, battery/network constraints, and user-visible freshness.

## Multi-Client Behavior

Multi-client and multi-device behavior is deferred. The MVP assumes one local workspace state at a time under the repository filesystem.

| Scenario | MVP Behavior | Risk | Required Future Design |
| --- | --- | --- | --- |
| Same repository opened in two LOGOS TUI processes | Not formally supported. | Concurrent writes may race or overwrite state if locking is absent. | Workspace lock, stale read detection, write conflict handling. |
| Same repository edited through Git on multiple machines | Outside LOGOS sync. | Git merge conflicts in `.logos/` or generated docs. | Git-aware merge guidance or sync model. |
| Generated files edited by user/editor while TUI runs | Partially supported through overwrite/manual-edit detection where metadata exists. | Manual edits can become stale. | Stronger file watcher or checksum policy. |
| Agent consumes agent pack while LOGOS regenerates | File-level user responsibility. | Agent may use stale context. | Output version metadata and freshness guidance. |
| Remote provider used from multiple sessions | Provider account external. | Provider rate limits/costs; no shared LOGOS state. | Provider usage tracking if needed without telemetry. |
| Hosted collaboration | Unsupported. | N/A. | Auth, tenancy, conflict resolution, audit, deletion, sync protocol. |

There is no remote logout, account switch, permission propagation, or cross-client invalidation in MVP because there are no LOGOS accounts or remote sessions.

## State Recovery

| Scenario | Detection | Affected State | Automatic Recovery | Manual Recovery | Data Loss Risk | User Communication | Support Escalation | Audit or Telemetry | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Missing workspace state | Startup/status cannot find internal state. | Workspace metadata. | Treat as uninitialized if no partial state exists. | Run `/init` or restore files. | Low unless files were deleted. | Show uninitialized/recovery guidance. | Support if unexpected. | Local event only. | MVP |
| Corrupt JSON state | Parse/schema validation failure. | Affected state file/category. | None if unsafe. | Restore from Git/backup, repair manually, or future reset/repair command. | Medium/high. | Explain file/category and block mutation. | Support if user cannot repair. | StateReadFailed local event. | Release-blocking if common. |
| Interrupted write | Temp file or partial report detected. | Target state/output file. | Prefer last valid file; clean temp only if safe. | Inspect/restore from Git. | Medium. | Report partial/interrupted state. | Support if generated content lost. | WriteInterrupted event. | Release-blocking for unsafe writes. |
| Failed migration | Migration record/error on startup. | Workspace/profile/state schema. | Roll forward only if deterministic and safe. | Restore previous version/backup or run explicit repair. | Medium/high. | Migration failed; mutation blocked. | Maintainer/support. | MigrationFailed. | Release-blocking. |
| Provider timeout/failure | Provider error/timeout. | Current intake operation. | Preserve user input and prior state. | Retry, reconfigure, switch provider, continue without AI where possible. | Low if input preserved. | Show retry/reconfigure/no-provider path. | Provider setup support. | ProviderCallFailed redacted. | Release-blocking if state corrupts. |
| Invalid provider output | Schema validation failure. | Proposed AI result only. | Reject before state mutation. | Retry or answer manually. | Low. | Explain invalid output safely. | Engineering if repeated. | InvalidAiOutput. | Release-blocking if mutation occurs. |
| Generation partial failure | Generation report has failed/skipped outputs. | Generated files/output status. | Preserve successful outputs and report failures. | Fix path/state/profile and regenerate. | Low/medium. | Created/updated/skipped/failed list. | Support for file/path issues. | GenerationPartial/Failed. | Release-blocking if silent. |
| Manual file deletion | Output missing during status/generation. | Generated output file. | Mark missing/stale. | Regenerate. | Low if state intact. | Output missing; regenerate available. | Rare. | OutputMissing. | MVP |
| Root misconfiguration | Unsafe/unreadable path. | Documentation root/output planning. | Reject unsafe path. | Choose safe root or fix permissions. | Low. | `unsafe_path`/write-denied guidance. | Support for path issues. | RootConfigFailed. | Release-blocking if unsafe path allowed. |

Support artifacts are local and redacted. LOGOS must not upload recovery data automatically.

## Sync Observability

Observability is local diagnostics and user-visible state, not telemetry.

| Area | Observable Signals | User Visible | Support / Debug Detail | Privacy Rule | Status |
| --- | --- | --- | --- | --- | --- |
| Hydration | workspace found, profile valid, state valid, migration needed, provider configured. | Orientation/status header. | Schema/profile error ids, redacted paths where needed. | No secrets/full prompts. | MVP |
| State writes | command, success/failure, affected object id/type. | Success/error and next action. | Redacted operation event. | No sensitive payload in logs by default. | MVP |
| Generation | run id, root, created/updated/skipped/blocked/failed/stale outputs. | Generation report. | Output paths relative to root, failure codes. | No raw tokens or hidden payloads. | MVP |
| Provider operations | mode, timeout/auth/unavailable/invalid-output. | Provider status/recovery path. | Provider id, redacted token source, error class. | No raw token, auth header, full prompt, or raw response. | MVP |
| Conflict/manual edits | path conflict, manual edit, stale output. | Warning and confirmation options. | Checksum/mtime/source ref if implemented. | Local path metadata handled carefully. | MVP |
| Corruption/migration | invalid schema, migration needed/failed. | Recovery-needed state. | File/category/schema version. | Avoid dumping file contents. | MVP |
| Queue/sync lag/conflicts | N/A for remote sync. | N/A. | N/A. | No telemetry. | Excluded |

Metrics, alerts, dashboards, traces, and external telemetry are excluded from the MVP. Future hosted sync would require queue depth, sync lag, cursor health, conflict count, retry count, stale-state count, and privacy-safe alerting.

## Sync Testing

| Test Category | Scope | Fixture / Method | Release Blocking |
| --- | --- | --- | --- |
| State schema validation | Workspace/config/decision/session/report records. | Valid and corrupt JSON fixtures. | Yes. |
| Safe writes | State and generated output writes. | Interrupted write, permission denied, partial failure fixtures. | Yes. |
| Root containment | Generated outputs under `logos/` or custom root. | Traversal, absolute path, collision tests. | Yes. |
| Init idempotency | Repeated `/init`. | Existing workspace fixture. | Yes. |
| Decision transitions | Proposed/confirmed/rejected/deferred/superseded states. | Transition table tests. | Yes. |
| AI proposal boundary | Provider output cannot confirm decisions. | Mock provider/proposal fixtures. | Yes. |
| Provider failure preservation | Timeout/auth failure/invalid output. | Fake provider responses. | Yes. |
| No live network default | Validation/generation/status tests. | Default test suite with no provider/network. | Yes. |
| Stale output detection | Decision/profile/root changes. | Source version/checksum/mtime fixtures. | Yes for status correctness. |
| Manual edit/collision handling | Existing generated files. | Differing file content and metadata. | Yes for overwrite safety. |
| Derived output classification | Markdown vs HTML vs agent pack. | Golden generation reports. | Yes. |
| Migration recovery | Old schema/profile lock/state records. | Migration fixtures and failed migration fixture. | Yes. |
| Privacy state tests | Token redaction/no telemetry/no raw prompt persistence. | Secret scanning and snapshot tests. | Yes. |
| Multi-client sync | Not applicable. | Explicit unsupported behavior tests if needed. | No, unless concurrent process support is added. |
| Remote sync protocol | Not applicable. | None in MVP. | No, until feature exists. |

Test Strategy must inherit that failures around state corruption, token persistence, unsafe paths, silent overwrite, AI confirmation bypass, and hidden remote calls are release blockers.

## Sync Risks

| Risk | Affected State or Flow | Risk Type | Source | Likelihood | Impact | Early Signal | Mitigation | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local JSON state corrupts and blocks work. | Internal structured state. | Data loss/recovery. | Interrupted writes, schema bugs, manual edits. | Medium. | High. | Parse failures, recovery-needed reports. | Atomic writes, schema validation, migration tests, Git/backup guidance. | Infrastructure, Test, Support. | Release-blocking if unsafe mutation follows. |
| Manual edits to Markdown drift from structured state. | Canonical Markdown. | Divergence/stale decisions. | User edits generated docs. | High. | Medium/high. | Checksum mismatch, stale output reports. | Warn before overwrite; future merge policy review. | Frontend, Generation, Support. | Must at least warn for MVP. |
| Root default regresses to `docs/`. | Output planning/config. | Contract regression. | Old docs/tooling assumptions. | Medium. | High. | Tests or docs mention `docs/` default. | Root default tests and status copy. | API, Test, Frontend. | Release-blocking. |
| Remote sync gets implied by "sync" language. | Product expectations. | Scope/trust risk. | Ambiguous documentation. | Medium. | Medium. | Users expect multi-device sync. | Explicit unsupported/deferred sections. | Product, Support. | Blocks misleading claims. |
| Provider failures lose current input. | Intake/session state. | Data loss. | Timeout, invalid output, crash. | Medium. | High. | User reports lost answer. | Persist/preserve user input before risky provider step where feasible. | Frontend, Test. | Release-blocking if reproducible. |
| Derived outputs are treated as canonical. | HTML/agent packs. | Source-of-truth drift. | Downstream agents or code reads generated files as truth. | Medium. | High. | Agent/output consumers cite derived artifact as authority. | Derived labels, source refs, docs/tests. | Agent Security, Frontend. | Release-blocking if product does it. |
| Hidden cache masks stale state. | Runtime indexes/output metadata. | Stale data. | Cache not invalidated. | Low/medium. | Medium. | Status disagrees after mutation. | Rebuild indexes from validated source; stale labels. | Frontend, Test. | Release-blocking for decisions/outputs. |
| Concurrent TUI processes race on state files. | Local state writes. | Corruption/conflict. | Multiple local sessions. | Unknown. | High. | Intermittent state corruption. | Document unsupported; future workspace lock review. | Infrastructure, Test. | Review-needed before broad release. |
| Migration silently changes decision meaning. | State migrations. | Semantic data loss. | Schema evolution. | Medium. | High. | Post-upgrade decisions differ/stale. | Migration tests, explicit migration records, confirmation for destructive changes. | Release Management, Test. | Release-blocking. |
| Provider context persists more than intended. | Remote provider state. | Privacy. | Provider policy/external retention. | Medium. | High. | User concern or provider policy change. | Minimize context, disclose remote behavior, local provider option. | Security, Integration, Support. | Blocks unsupported privacy claims. |
| Lack of support export makes recovery harder. | Recovery/support. | Operational blind spot. | Local-only diagnostics. | Medium. | Medium. | User cannot provide enough debug context. | Redacted local diagnostic report design later. | Support, Observability. | Acceptable MVP if diagnostics are inspectable. |

## Downstream Handoff

Frontend Architecture must inherit:

- display state labels for proposed, confirmed, assumed, unknown, incomplete, blocked, stale, canonical, derived, partial, failed, missing, and recovery-needed;
- show active repository, active documentation root, profile, provider mode/status, and output freshness;
- preserve confirmation flows for state changes, root changes, overwrites, remote provider use, and decision review;
- avoid implying cloud sync, background sync, or multi-client freshness;
- distinguish generated Markdown from derived HTML artifacts and agent packs.

Infrastructure Architecture must inherit:

- internal state root and generated documentation root are distinct;
- generated root defaults to `logos/` and is configurable;
- filesystem adapters need safe writes, path containment, collision detection, and migration/corruption handling;
- workspace locking/concurrent TUI protection is review-needed;
- no remote sync infrastructure, queue, worker, webhook, or event stream exists in MVP.

Test Strategy must inherit:

- release-blocking tests for state schema validity, safe writes, root containment, init idempotency, decision transitions, provider failure preservation, stale output detection, manual edit warnings, migration recovery, no live network by default, and no raw token persistence;
- explicit unsupported/deferred coverage for remote sync, background sync, and multi-client behavior if tests might otherwise assume them.

Observability Plan must inherit:

- observability is local and privacy-safe;
- no metrics pipeline, traces, dashboards, alerts, crash reporting, or telemetry in MVP;
- status/generation/validation/recovery reports are the primary diagnostic surfaces;
- provider diagnostics must be redacted and must not persist raw prompts/responses by default.

Deployment and Release Management must inherit:

- schema/profile migrations are release-sensitive;
- breaking changes to state shape, root behavior, output classification, or decision status semantics require migration notes and compatibility tests;
- package releases must not include fixtures with raw tokens or sensitive project context.

Support Model, Incident Response, Risk Management, and Operations must inherit:

- user recovery is local-first through status, validation, generation reports, Git/filesystem backup, and future repair/reset commands;
- support should not assume operator access to user state;
- incidents include state corruption, unsafe overwrite, root regression, provider context exposure, token persistence, and migration failure;
- future sync/cloud/collaboration features require a new architecture decision before implementation.
