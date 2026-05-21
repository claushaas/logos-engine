# LOGOS Engine Post-Implementation Gap Roadmap

## 1. Purpose

This roadmap covers the product functionality that remains incomplete after the
main implementation roadmap reached its intended end state. It is a gap-closing
roadmap, not a replacement for `docs/roadmap/IMPLEMENTATION_ROADMAP.md`.

The scope is defined by:

- `docs/03-product/10-functional-requirements.md`
- `docs/03-product/11-non-functional-requirements.md`
- `docs/03-product/04-ux-model.md`
- `docs/03-product/06-interaction-model.md`
- `docs/03-product/07-ui-specification.md`
- `docs/03-product/08-design-system.md`
- live code under `src/`
- tests under `tests/`

The implementation goal is that every active MVP, supporting MVP, preferred MVP,
and post-baseline Executive requirement has either a complete implementation or
a documented, tested, product-approved deferral. Deferred and excluded items in
the requirements remain out of scope unless product scope governance changes.

## 2. Audit Summary

### Confirmed Implemented Baseline

The current repository has substantial coverage for the original roadmap:

- CLI/TUI entrypoint and slash routing exist.
- Workspace initialization, safe writes, state schema, migrations, backup and
  restore primitives exist.
- Profile registry and documentation contract loading exist.
- Canonical Markdown generation exists.
- Deterministic validation, diagnostics, dependency graph, staleness,
  regeneration planning, provenance, registers, traceability, repository
  scanning, import planning, HTML rendering primitives, agent pack rendering
  primitives, and Executive compilation/export services exist.
- CI, build, typecheck, tests, validation gate, CLI smoke, package smoke, and
  security check scripts exist.

### Remaining Product Gaps

The following gaps are active product requirements, not optional polish:

| Gap ID | Gap | Primary Requirements |
| --- | --- | --- |
| GAP-001 | Executive compiler hard-codes `profiles/standard/executive` paths instead of resolving the active profile's executive contract root. | FR-005, FR-051 through FR-055, FR-062 |
| GAP-002 | Custom profile runtime support is partial: contract loading supports explicit roots, but TUI/init/runtime flows do not expose complete custom profile selection, lock metadata, contract status, or package-safe custom profile paths. | FR-005, FR-062 |
| GAP-003 | `/config ai` is a recognized stub and does not provide provider setup, redacted status, connectivity tests, timeout configuration, disclosure consent, or no-provider recovery flow. | FR-016 through FR-018, FR-030, FR-035, FR-036, FR-042, FR-044; NFR-PERF-002, NFR-PRIV-002, NFR-PRIV-004, NFR-PRIV-005, NFR-SEC-001, NFR-SEC-002 |
| GAP-004 | The TUI startup briefing always uses deterministic fallback in the app shell; the AI-assisted startup briefing path exists as a service but is not wired to configured providers. | FR-060, FR-061 |
| GAP-005 | Free-form TUI text is still routed to an intake stub instead of persisting conversational turns, creating answers/proposals, and offering review. | FR-006 through FR-008, FR-014, FR-020, FR-024 through FR-025, FR-043, FR-045, FR-046, FR-058, FR-059 |
| GAP-006 | Proposal review and decision correction services exist, but the TUI lacks complete flows to list, accept, revise, reject, defer, or supersede proposals/decisions with affected-document reporting. | FR-008, FR-021, FR-028, FR-043; NFR-REL-002, NFR-OBS-001 |
| GAP-007 | Confirmation UX still depends on retyping commands such as `--confirm`; confirmation prompts are not keyboard-selectable yes/no controls with visible focus. | FR-003, FR-022, FR-023; NFR-ACC-001, NFR-ACC-003, NFR-SEC-004 |
| GAP-008 | The TUI shell is structurally minimal and does not yet implement the UI Specification's workbench layout, view model, panels, action area, focus management, loading states, state labels, or output/report browsing views. | FR-015, FR-026, FR-027, FR-029, FR-044; NFR-ACC-001 through NFR-ACC-005, NFR-PERF-003, NFR-PERF-004 |
| GAP-009 | Documentation root configuration is only available during `/init`; there is no complete post-init root configuration flow with path disclosure, confirmation, collision checks, and affected-output reporting. | FR-004, FR-023, FR-044 |
| GAP-010 | `/generate` currently focuses on canonical Markdown; HTML artifacts and agent packs have planners/renderers but are not fully wired into the normal generation/reporting flow. | FR-010, FR-011, FR-019, FR-027; NFR-OBS-002 |
| GAP-011 | Output browsing is not implemented as a first-class TUI view for canonical Markdown, HTML artifacts, agent packs, reports, and Executive outputs. | FR-029, UI-015 |
| GAP-012 | Provider timeout, retry, cancellation, and save-and-continue behavior are not expressed as runtime provider execution policy. | FR-030; NFR-PERF-002, NFR-REL-001, NFR-REL-005, NFR-AVA-002 |
| GAP-013 | Performance, accessibility, compatibility, and HTML accessibility targets are documented but lack measurement/release evidence. | NFR-PERF-001 through NFR-PERF-005, NFR-ACC-004, NFR-SCAL-002, NFR-SCAL-003, NFR-COMP-001, NFR-COMP-004 |

### Explicitly Deferred Or Excluded

These are listed in the requirements but should not be implemented by this
roadmap unless product scope changes:

- FR-033 through FR-041: autonomous decision-making, automatic product building,
  hosted SaaS, accounts, cloud workspace, collaboration, profile marketplace,
  automatic external research, and project-management-suite behavior.
- FR-047 through FR-049: search/retrieval, broad profile authoring UI or
  marketplace, and hosted collaboration.
- FR-056 and FR-057: Linear/Notion live sync, live task ownership, assignments,
  comments, notifications, calendar workflows, and bidirectional sync.
- NFR-SEC-005, NFR-SEC-006, NFR-AVA-003, NFR-AVA-004, NFR-SCAL-001,
  NFR-SCAL-004, NFR-OBS-004, NFR-OBS-005, NFR-I18N-003, NFR-COMPL-002,
  NFR-OPS-004, and NFR-OPS-005.

## 3. Implementation Strategy

Work should proceed in vertical slices that keep local-first behavior, profile
contracts, structured state, safe writes, and provider boundaries intact.

Implementation order:

1. Fix profile/runtime path ownership before expanding Executive behavior.
2. Complete provider configuration before wiring AI-assisted startup/intake.
3. Complete conversational intake and proposal review before broad TUI polish.
4. Replace retyped confirmation with shared keyboard confirmation primitives.
5. Rebuild the TUI layout around view state, focus, and reports.
6. Wire derived artifacts into generation and browsing.
7. Close NFR evidence gaps with measurement, accessibility, compatibility, and
   release checks.

## 4. Phase Overview

| Phase | Name | Goal | Depends On |
| --- | --- | --- | --- |
| Phase 1 | Active Profile Runtime And Executive Paths | Remove Standard-profile hard-coding and make Executive compilation resolve from the active profile contract. | Current baseline |
| Phase 2 | AI Provider Configuration | Implement `/config ai`, provider runtime policy, redacted status, timeout, test, disclosure, and no-provider recovery. | Phase 1 |
| Phase 3 | Conversational Intake And Proposal Review | Route free-form text into state-backed intake and expose proposal/decision review flows in the TUI. | Phase 2 |
| Phase 4 | Keyboard Confirmation Framework | Replace `--confirm` retyping for interactive TUI flows with focused yes/no controls and shared confirmation state. | Phase 3 |
| Phase 5 | TUI Workbench Redesign | Implement the UI Specification's orientation header, work area, context rail, action area, focus model, loading states, and report views. | Phase 4 |
| Phase 6 | Documentation Root Configuration | Add post-init documentation root configuration with disclosure, confirmation, safe path checks, and stale-output reporting. | Phase 5 |
| Phase 7 | Derived Artifact Generation And Browsing | Wire HTML artifacts and agent packs into generation, reporting, artifact registry, and output browser views. | Phase 6 |
| Phase 8 | NFR Evidence And Release Hardening | Add measurement, accessibility, compatibility, scaling, and release evidence for remaining NFRs. | Phase 7 |

## 5. Detailed Phases

### Phase 1: Active Profile Runtime And Executive Paths

#### Goal

Make the active profile the owner of Executive contract paths. The Standard
profile remains the bundled default, but runtime code must not assume
`profiles/standard/executive`.

#### Work

- Introduce a profile runtime path object that includes profile root,
  registry path, phase registry directory, executive root, executive generation
  config path, executive schema path, mapping directory, and template directory.
- Resolve Executive paths from the active profile loaded from workspace state.
- Remove hard-coded `profiles/standard/executive` constants from:
  `src/executive/executive-compile-workflow.ts`,
  `src/executive/normative-baseline-readiness.ts`, and related diagnostics.
- Keep compatibility with the bundled Standard profile in packaged installs.
- Expose complete active profile metadata in state and status:
  id, version, source, registry path, profile root where safe, and contract
  validation status.
- Extend `/init` to support custom profile selection from an explicit local
  profile root while preserving `standard` as the default.
- Add diagnostics that distinguish missing active profile, invalid profile,
  missing executive config, invalid executive schema, and unsupported Executive
  contract.

#### Tests

- Custom profile fixture with its own `executive/` directory compiles without
  reading `profiles/standard/executive`.
- Standard profile still works from source checkout and packaged `dist`.
- Missing custom executive config blocks Executive compilation with active
  profile paths in diagnostics.
- Status output reports active profile metadata without leaking unsafe absolute
  paths in generated artifacts.

#### Validation

- `pnpm typecheck`
- Targeted profile and executive tests
- `pnpm check`

### Phase 2: AI Provider Configuration

#### Goal

Replace the `/config ai` stub with a complete local self-administration flow
for provider setup, redacted status, timeout policy, disclosure, testing, and
no-provider recovery.

#### Work

- Add provider configuration service and TUI command handlers for:
  status, set mode, set provider, set model, set endpoint, set token env var,
  set timeout, accept disclosure, decline disclosure, test provider, disable
  provider, and reset provider config.
- Store provider configuration in `.logos/workspace.json` using references only:
  env var names, provider ids, model ids, endpoint URLs, mode, timeout, and
  consent timestamps. Never store raw token values.
- Enforce timeout defaults: 60 seconds by default, configurable up to 180
  seconds.
- Add provider execution policy for timeout, retry guidance, cancellation-safe
  errors, and state preservation.
- Add provider registry metadata for fake/no-provider, local providers, and
  remote providers. Exact concrete providers should be kept behind the existing
  provider port.
- Add connectivity test behavior that uses synthetic context only and reports
  redacted diagnostics.
- Add remote disclosure preview that shows context categories and bounded
  summaries before remote provider execution.
- Update `/status`, startup briefing, and blocked AI flows to route users to
  `/config ai` with actionable recovery.

#### Tests

- `/config ai` no longer returns a stub.
- Provider token values are rejected; env var names are accepted.
- Provider status redacts token source.
- Remote provider execution is blocked until disclosure consent is accepted.
- Timeout config rejects values above 180 seconds and defaults to 60 seconds.
- Provider test uses synthetic context and does not require network in default
  tests.

#### Validation

- Targeted AI/provider/config tests
- Token-safety tests
- `pnpm check`

### Phase 3: Conversational Intake And Proposal Review

#### Goal

Make non-slash TUI input the normal state-backed intake path and expose review
actions for proposed decisions, assumptions, open questions, and risks.

#### Work

- Replace the free-form intake stub with conversation turn capture.
- Persist user turns as session/input evidence without treating transcript as
  canonical truth.
- Run bounded context building and provider/deterministic interpretation where
  configured and allowed.
- Map user answers and validated AI extractions into proposals using existing
  proposal mapper and repository services.
- Provide no-provider fallback that preserves the user's text and creates
  open questions or user-authored proposal candidates where safe.
- Add TUI review commands or actions for:
  list proposals, inspect proposal, accept, revise, reject, defer, and show
  affected documents.
- Add decision correction flows for confirmed decisions:
  revise/supersede decision, show affected documents, mark outputs stale, and
  preserve audit events.
- Surface low-confidence labels for AI interpretation.
- Keep contextual suggestions optional, source-labeled, caveated, and
  non-canonical until accepted or revised.

#### Tests

- Free-form input creates persisted intake evidence and reviewable proposals,
  not confirmed decisions.
- Unknown answers create open questions.
- Assume-for-now answers create visible assumptions.
- Accept/revise/reject/defer proposal flows mutate state only through lifecycle
  services.
- Revising confirmed decisions reports affected documents and stale outputs.
- Provider failure preserves input and offers retry, reconfiguration, or
  save-and-continue.

#### Validation

- Targeted intake/proposal/session tests
- TUI shell tests
- `pnpm check`

### Phase 4: Keyboard Confirmation Framework

#### Goal

Interactive TUI confirmations should use focused yes/no controls navigable by
arrow keys and confirmed with Enter. Users should not need to retype the same
command with `--confirm` during normal interactive use.

#### Work

- Add a shared confirmation model with action id, target, consequences,
  alternatives, default selection, and selected option.
- Add Ink components for yes/no or multi-action confirmation prompts with
  visible focus and keyboard handling.
- Wire `/init`, `/generate`, `/executive compile`, root changes, provider
  disclosure, overwrite/collision decisions, and decision confirmation through
  the shared confirmation model.
- Keep `--confirm` support for non-interactive tests, scripts, and explicit
  command-line compatibility.
- Ensure cancel/no preserves state and returns to the prior view with a safe
  next action.
- Add text labels so confirmation meaning never depends on color alone.

#### Tests

- `/init` preflight can be accepted with arrow/Enter in the TUI.
- `/generate` and `/executive compile` can be accepted or cancelled without
  retyping `--confirm`.
- Non-interactive `--confirm` behavior remains available.
- Focus remains predictable after yes, no, errors, and cancellation.

#### Validation

- TUI interaction tests with `ink-testing-library`
- Existing slash-router tests
- `pnpm check`

### Phase 5: TUI Workbench Redesign

#### Goal

Move the TUI from a minimal transcript shell to the product workbench described
by the UI Specification, while taking inspiration from modern coding-agent UX:
clear orientation, visible plan/status, compact action affordances, reviewable
changes, and calm progress feedback.

#### Work

- Introduce a TUI view model with explicit view types:
  startup, first-run, status, intake, proposal review, decision detail,
  generation confirmation, generation report, diagnostics, validation,
  provider config, root config, output browser, help, and recovery.
- Implement a stable layout:
  orientation header, primary work area, optional context rail, action area,
  feedback area, and command input.
- Always show active repository, documentation root, active profile, workspace
  status, and provider status where relevant.
- Add pending/loading indicators with text labels for provider calls,
  generation, validation, diagnostics, and Executive compilation.
- Add state labels for proposed, confirmed, assumed, unknown, incomplete,
  blocked, stale, canonical, derived, low-confidence, partial, and failed.
- Add compact/standard/wide terminal behavior.
- Add contextual help and next-action rendering per view.
- Keep the interface local-first and workbench-like; do not turn it into a SaaS
  dashboard, task board, or generic chat UI.

#### Tests

- Snapshot or structural tests for major view renderings.
- Focus tests for command input, action controls, confirmations, and recovery.
- Narrow terminal rendering preserves root, provider, status, and current action.
- Loading states include text equivalents.

#### Validation

- TUI tests
- Manual run of `logos` in a temp workspace
- `pnpm check`

### Phase 6: Documentation Root Configuration

#### Goal

Allow users to configure or change the LOGOS documentation root after
initialization with explicit path disclosure, confirmation, and stale-output
impact reporting.

#### Work

- Add root configuration service and TUI command/action surface.
- Show current root, proposed root, absolute resolved path, default/custom
  status, collision state, and affected generated outputs.
- Validate containment inside the project root.
- Require interactive confirmation before changing root.
- Mark existing generated artifacts stale, orphaned, or moved-planned according
  to safe policy; do not silently move or delete files.
- Update workspace state only through validated repository updates.

#### Tests

- Root change rejects traversal outside the project root.
- Root change requires confirmation.
- Cancelling root change preserves existing root.
- Changing root reports affected canonical and derived outputs.
- Status and generation use the new root after confirmation.

#### Validation

- Targeted root/state/path tests
- Generation tests
- `pnpm check`

### Phase 7: Derived Artifact Generation And Browsing

#### Goal

Make HTML artifacts and agent packs part of the normal generation and review
experience, clearly separated from canonical Markdown and Executive exports.

#### Work

- Wire HTML artifact planning/rendering into `/generate` after canonical
  Markdown readiness is evaluated.
- Wire agent pack planning/rendering into `/generate` after canonical sources
  and profile contracts are available.
- Preserve deterministic ordering:
  canonical Markdown first, then derived HTML, then agent packs, then Executive
  outputs when explicitly requested.
- Extend generation reports to show created, updated, skipped, incomplete,
  blocked, failed, stale, canonical, and derived categories.
- Register derived artifacts with non-canonical metadata and source references.
- Add `/outputs` or equivalent output browser view to list canonical Markdown,
  HTML artifacts, agent packs, reports, graph artifacts, and Executive outputs
  under the active root.
- Support filters by artifact type, status, canonical/derived, stale/current,
  phase, and document where the state model already supports it.
- Ensure derived artifacts never become canonical inputs when canonical
  Markdown or structured state exists.

#### Tests

- `/generate` produces and reports HTML artifacts and agent packs when profile
  declarations and sources are ready.
- Derived artifact failures do not corrupt canonical generation results.
- Output browser distinguishes canonical and derived outputs.
- Manual edits to canonical Markdown are protected before derived regeneration.
- HTML escaping/security tests remain passing.
- Agent pack token-safety tests remain passing.

#### Validation

- Generation, HTML, agent-pack, artifact registry, and TUI tests
- Snapshot updates for intentional report changes
- `pnpm check`

### Phase 8: NFR Evidence And Release Hardening

#### Goal

Turn documented non-functional requirements into release evidence instead of
aspirational claims.

#### Work

- Add startup/status/generation timing measurements or manual release evidence
  scripts for provisional performance requirements.
- Add provider timeout tests using fake delayed providers.
- Add accessibility review tests for TUI state labels, focus behavior,
  keyboard-only confirmations, and loading text equivalents.
- Add HTML readability/accessibility review for generated HTML artifacts without
  claiming full WCAG compliance unless tested.
- Add compatibility evidence for macOS, Linux, and Windows WSL. CI may remain
  Linux-only if manual evidence is recorded, but broader release should include
  a compatibility checklist or matrix.
- Add scale fixtures for the Standard profile document tree and hundreds of
  decisions, assumptions, and open questions.
- Add release notes/migration notes requirements for any state/profile schema
  changes introduced by this roadmap.
- Keep telemetry, hosted dashboards, accounts, collaboration, and cloud
  infrastructure absent by default.

#### Tests

- Provider timeout defaults and limits are covered.
- Startup/status/generation performance checks produce evidence.
- TUI accessibility assertions cover text labels and focus.
- HTML artifacts render in modern browser smoke tests or static artifact checks.
- Large local state fixture remains responsive enough for status and planning
  operations.

#### Validation

- `pnpm check`
- `pnpm security:check`
- Manual TUI smoke evidence for core workflows
- Compatibility evidence recorded in release checklist or docs

## 6. Requirement Coverage Checklist

### Functional Requirements

| Requirement Range | Roadmap Coverage |
| --- | --- |
| FR-001 through FR-005 | Phase 1 and Phase 6 close active profile/custom root gaps while preserving existing startup/init behavior. |
| FR-006 through FR-008 | Phase 3 completes state-backed conversational intake and reviewable proposal flows. |
| FR-009 through FR-011 | Phase 7 completes derived HTML and agent pack generation after existing canonical Markdown generation. |
| FR-012 through FR-013 | Existing diagnostics/validation remain, with Phase 5 improving report UI and Phase 8 adding NFR evidence. |
| FR-014 through FR-016 | Phase 3 and Phase 5 complete resume/intake UX; Phase 2 replaces `/config ai` stub. |
| FR-017 through FR-018 | Phase 2 implements provider configuration and remote disclosure. |
| FR-019 | Phase 7 expands generation reports across canonical and derived outputs. |
| FR-020 through FR-028 | Phase 3, Phase 4, and Phase 5 complete recovery, revision, assumptions, open questions, diagnostics grouping, canonical/derived labels, and low-confidence labels. |
| FR-029 | Phase 7 implements the preferred MVP output browser. |
| FR-030 through FR-036 | Phase 2 and Phase 3 complete provider failure/recovery and preserve token/remote-call boundaries. |
| FR-037 through FR-041 | Explicitly excluded; no implementation. |
| FR-042 through FR-046 | Phase 2, Phase 3, and Phase 5 complete no-provider recovery, correction before confirmation, orientation, routing, and contextual question clusters. |
| FR-047 through FR-049 | Deferred/won't-have; no implementation in this roadmap. |
| FR-050 | Existing validation/generation labels are preserved; Phase 5 and Phase 7 improve visibility in UI/reports. |
| FR-051 through FR-057 | Phase 1 fixes active-profile Executive contracts; existing live-sync exclusions remain enforced. |
| FR-058 through FR-061 | Phase 2 and Phase 3 wire provider-safe startup/intake assistance; Phase 5 renders it correctly. |
| FR-062 | Phase 1 completes active profile metadata and custom profile support. |

### Non-Functional Requirements

| Requirement Area | Roadmap Coverage |
| --- | --- |
| Performance | Phase 2 implements provider timeout policy; Phase 5 adds pending states; Phase 8 adds measurement evidence. |
| Accessibility | Phase 4 and Phase 5 implement keyboard confirmation, focus, labels, and loading text; Phase 8 records evidence. |
| Privacy and Security | Phase 2 enforces provider config, disclosure, redaction, token references, and context preview. Existing safe-write and token guards remain. |
| Reliability and Availability | Phase 2 and Phase 3 cover provider failures, timeout recovery, no-provider mode, and state preservation. |
| Scalability | Phase 8 adds Standard-profile and large-state fixtures. |
| Compatibility | Phase 8 adds platform/runtime evidence. |
| Observability | Phase 3 and Phase 7 improve audit trail and generation report coverage; telemetry remains excluded. |
| Internationalization | English-only MVP remains unchanged; UTF-8 support should be preserved by tests. |
| Compliance | No new compliance claims; local data ownership remains unchanged. |
| Operational Constraints | Phase 8 adds migration/release evidence for any new state/profile changes. |

## 7. Release Gate

This gap roadmap is complete only when:

- `/config ai` is no longer a stub.
- Free-form TUI input persists state-backed intake evidence and proposals.
- Users can review, accept, revise, reject, and defer proposals or decisions
  through the TUI.
- Interactive confirmations use keyboard-selectable controls instead of
  requiring command re-entry.
- Custom profiles can own Executive configuration, mappings, schema, and
  templates without Standard-profile path assumptions.
- `/generate` and reports cover canonical Markdown, HTML artifacts, and agent
  packs.
- Output browsing distinguishes canonical and derived artifacts.
- TUI orientation, focus, loading, recovery, and report views match the UI
  Specification at MVP depth.
- NFR evidence is recorded for timeout, accessibility, performance,
  compatibility, privacy/security, and release gates.
- `pnpm check` passes.
