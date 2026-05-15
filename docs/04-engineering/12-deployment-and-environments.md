# Deployment and Environments

## Deployment Objective

LOGOS Engine deployment must produce a reproducible, verified local CLI/TUI package that users can run inside a target repository with the `logos` command. For the MVP, "production" means a released package and documented local runtime behavior, not a hosted backend deployment.

Deployment must guarantee:

- the package builds from committed source using Node.js and pnpm;
- the `logos` binary points to the compiled CLI entrypoint;
- bundled profiles, schemas, docs, README, LICENSE, and runtime assets needed by the CLI are included;
- release gates pass without live AI provider calls, hidden network access, or raw provider tokens;
- users retain local ownership of state under the target repository;
- no telemetry, hosted service, background worker, cloud sync, dashboard, queue, or public API is introduced accidentally;
- provider credentials remain user-managed and are never bundled, committed, logged, or embedded in artifacts;
- rollback is possible through package version pinning or hotfix release, with state migration limits documented honestly.

Deployment success is a package/build concern. Release success also requires tests, smoke checks, security/privacy checks, profile compatibility, manual acceptance, and clear release notes. Operational success requires users to install/run the package locally and recover from local errors with status, validation, diagnostics, and generation reports.

## Environment Strategy

The MVP environment strategy is simple and local-first:

1. Developers work in local repository checkouts.
2. CI validates source and package readiness with deterministic tests.
3. Optional provider test environments may be used manually with user-owned credentials.
4. Release candidates are built from source and verified through release gates.
5. Published package versions are the production distribution channel.
6. End-user runtime happens on the user's machine inside their target repository.

There are no hosted preview, staging, production, recovery, or observability environments in MVP. Those are deferred until LOGOS validates hosted/collaborative features.

Environment principles:

- keep local, CI, and release environments free of raw provider tokens by default;
- use fakes/fixtures for default provider testing;
- treat external provider calls as optional manual checks;
- separate package release artifacts from user-generated project artifacts;
- do not use production user data in tests, previews, staging, or examples;
- make unsupported hosted environments explicit rather than implicit.

## Environment Matrix

| Environment | Purpose | Lifecycle | Isolation Level | Data Policy | Access Policy | Deployment Trigger | Promotion Source | External Integration Mode | Secrets Policy | Observability Level | Cost Policy | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local development | Build, test, run CLI/TUI in a checkout. | Long-lived per developer. | Developer machine/repo. | Synthetic fixtures and local test workspaces only. | Developer. | Manual commands. | Source checkout. | Fakes by default; local/remote providers only if explicitly configured. | Env vars/OS credential store; never project files. | Local command output and optional debug logs. | Developer machine only. | Engineering. | MVP |
| CI validation | Deterministic quality gates. | Per PR/merge/release run. | CI runner. | Synthetic fixtures, no real user data. | Maintainers/CI. | PR, merge, tag, manual release. | Source checkout. | No live provider/network by default. | No raw provider tokens required. | CI logs/artifacts. | CI minutes only. | Engineering. | Required/proposed |
| Release candidate | Verify package artifact before publication. | Per release. | Release workspace/runner. | Synthetic fixtures and generated release evidence. | Maintainers. | Manual or tagged release. | Passing CI commit. | Optional redacted provider sandbox check only. | Release credentials outside repo. | Release evidence checklist. | Minimal. | Product/engineering. | MVP |
| Published package | Production distribution artifact. | Semver version lifetime. | npm/package registry. | Contains code, bundled profiles, docs; no user state or secrets. | Package maintainers publish; users install. | Approved release. | Release candidate artifact. | None at publish time. | Publishing tokens managed by registry/maintainer; never in package. | Registry/download signals outside MVP. | Registry costs if any. | Maintainer. | MVP |
| End-user local runtime | User runs `logos` in target repository. | Per user/workspace. | User machine/repository. | User-owned `.logos/` state and generated root, default `logos/`. | Local OS user. | User installs/runs package. | Published package. | Local/remote providers only by explicit user config. | User-managed env/OS credential store. | Local status/reports only. | User/provider costs. | User; product supports via docs. | MVP |
| Provider sandbox/manual test | Optional release/provider compatibility check. | On demand. | External provider account/endpoint. | Synthetic prompts only. | Maintainer with explicit credentials. | Manual pre-release. | Release candidate. | Live provider or local provider. | User/maintainer-owned token outside repo. | Redacted notes only. | Provider cost controlled manually. | Engineering/product. | Optional |
| Preview environment | Hosted PR review environment. | N/A. | N/A. | N/A. | N/A. | None. | N/A. | N/A. | N/A. | N/A. | N/A. | None. | Unsupported MVP |
| Staging environment | Hosted production-like rehearsal. | N/A. | N/A. | N/A. | N/A. | None. | N/A. | N/A. | N/A. | N/A. | N/A. | None. | Deferred |
| Hosted production runtime | LOGOS-operated service. | N/A. | N/A. | N/A. | N/A. | None. | N/A. | N/A. | N/A. | N/A. | N/A. | None. | Excluded MVP |
| Recovery environment | Disaster recovery/restore environment. | N/A. | N/A. | User restores locally from Git/filesystem/OS backup. | User. | Manual local recovery. | Installed package + user backup. | N/A. | User-managed. | Local reports. | User environment. | User/support docs. | Deferred as managed environment |

## Local Development

Local development is the primary engineering environment.

Prerequisites:

- Node.js `>=22`;
- pnpm `10.33.2` or the package-manager version declared by the repository;
- repository checkout;
- no live AI provider credentials for default tests;
- optional local provider such as Ollama/LM Studio or remote provider token only for manual provider checks.

Bootstrap flow:

1. Install dependencies with `pnpm install`.
2. Run `pnpm check` for lint, Markdown lint, tests, and build.
3. Run `pnpm typecheck` when validating strict type behavior separately.
4. Run `pnpm smoke:cli` before release or CLI wiring changes.
5. Use `pnpm test:watch` during development.
6. Test runtime behavior in temporary repositories rather than real user data.

Local reset:

- remove temporary test repositories;
- delete generated temp workspaces;
- clear local provider env vars if used;
- do not delete user-owned `.logos/` or `logos/` directories unless intentionally testing reset behavior.

Troubleshooting should start with `pnpm check`, `pnpm test`, `pnpm build`, `pnpm typecheck`, and targeted Vitest suites.

## Preview Environments

Hosted preview environments are unsupported in MVP. LOGOS is not a web service and has no preview deployment surface.

Equivalent review mechanisms:

- branch/PR CI checks;
- local checkout review;
- generated fixture outputs;
- `pnpm smoke:cli`;
- manual TUI review in a temp repository;
- package dry-run or release-candidate install check when implemented.

No production data, user state, provider tokens, or live remote provider calls should be used for preview-like review.

## Staging

There is no hosted staging environment in MVP.

The release-candidate environment acts as a staging substitute:

- build from the release commit;
- run deterministic release gates;
- run smoke CLI;
- inspect packaged files;
- run generated output checks against synthetic fixture workspaces;
- optionally run a manual provider compatibility check using synthetic context and explicit credentials.

Staging parity claims are not made. If hosted/collaborative LOGOS is introduced later, staging must define data seeding, integration modes, access controls, telemetry, rollback, and release rehearsal before launch.

## Production

MVP production is the published package plus the user's local runtime.

Deployable units:

| Unit | Runtime | Production Meaning | Scaling Assumption | Access |
| --- | --- | --- | --- | --- |
| npm/package artifact | Node.js package with `bin.logos -> ./dist/cli.js`. | Version users install. | Single-user local CLI invocation. | Public/private registry based on release decision. |
| Bundled profiles | YAML/document schema files included in package. | Contract source for generation. | Local filesystem reads. | Read by CLI runtime. |
| Documentation and examples | Packaged docs/README/examples as support material. | User/developer reference. | Static files. | Read by users/maintainers. |
| End-user workspace state | User local `.logos/` state. | User-owned runtime state, not deployed by LOGOS. | Per repository. | Local OS user. |
| Generated outputs | User local `logos/` or custom root. | User-owned generated docs/artifacts. | Per repository. | Local OS user. |

Production constraints:

- no LOGOS-operated server;
- no hosted database;
- no accounts/sessions;
- no cloud sync;
- no telemetry/analytics;
- no production secrets bundled into artifacts;
- no external SLA or maintenance window.

## Recovery Environments

Managed recovery environments are not applicable in MVP. Recovery is local and user-managed.

Recovery paths:

- reinstall or pin a prior package version;
- restore user workspace from Git/filesystem/OS backup;
- rerun `/status`, `/validate`, `/diagnose`, or `/generate` after restoring valid state;
- remove invalid generated outputs and regenerate from structured state;
- rotate provider tokens externally if exposed.

Restore testing is limited to local fixture tests and manual recovery checks. A managed recovery environment, operator access, cloud backup, and disaster recovery process are deferred until hosted features exist.

## Configuration Management

Configuration is split into package configuration, project workspace configuration, and external provider configuration.

| Config Class | Source | Build-Time or Runtime | Validation | Drift Detection | Secret Boundary |
| --- | --- | --- | --- | --- | --- |
| Package metadata | `package.json`, lockfile, tsconfig. | Build/release. | Build/typecheck/package inspection. | CI diff/review. | No secrets. |
| Runtime defaults | Code/config constants. | Runtime. | Unit/contract tests. | Regression tests. | No secrets. |
| Profile contracts | Bundled `profiles/standard` YAML/schema. | Runtime read/package artifact. | Profile loader/schema tests. | Snapshot/contract tests. | Custom profile paths may be sensitive. |
| Workspace config | Local `.logos/config.json` or equivalent. | Runtime/user workspace. | Zod/schema validation. | `/status`/state validation. | Redacted token source only. |
| Documentation root | Workspace config; default `logos/`. | Runtime. | Path safety validation. | Root/status/generation tests. | Local path metadata. |
| Provider config | Workspace/user config. | Runtime. | Provider mode/endpoint/token-source validation. | `/config ai --test` if used. | Raw token external only. |

Configuration defaults must be safe. Missing provider config should degrade to no-provider guidance, not crash local commands. Missing/invalid profile or state should block unsafe dependent operations and show recovery guidance.

## Environment Variables

| Name | Purpose | Type | Required | Environments | Default | Validation Rule | Sensitivity Class | Build-Time or Runtime | Failure Behavior | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `LOGOS_LLM_API_KEY` | Optional default remote provider token source. | string token | No. | Local user runtime, optional manual provider tests. | none | Present only when user chooses matching provider mode. | Secret. | Runtime. | Provider auth unavailable; local operations continue. | User |
| Provider-specific token env vars | Optional convenience token sources for provider adapters. | string token | No. | Local/manual provider test. | none | Adapter-specific, never persisted raw. | Secret. | Runtime. | Provider unavailable until configured. | User |
| `NODE_ENV` | Node ecosystem mode if used by tooling/runtime. | enum-ish string | No. | Local/CI/release. | tooling-defined | Must not alter safety semantics. | Low. | Runtime/build. | Build/test behavior may differ; review if used. | Engineering |
| `CI` | Indicates CI environment. | boolean-ish | No. | CI. | platform-defined | Used only for test/tool behavior. | Low. | Build/test. | No production behavior dependency. | Engineering |
| Future debug flag | Enable local debug logging if implemented. | boolean/path | No. | Local user runtime. | disabled | Explicit opt-in only. | Sensitive-adjacent. | Runtime. | No debug logs by default. | Engineering |

Sensitive values are secrets, not ordinary config. They must not be committed, bundled, logged, snapshotted, or written to `.logos/`, `logos/`, generated HTML artifacts, or agent packs.

## Secrets Per Environment

| Secret | Purpose | Environments | Owner | Storage Location | Injection Method | Rotation Rule | Revocation Rule | Audit Requirement | Emergency Replacement | Forbidden Exposure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User AI provider token | Authenticate optional provider calls. | End-user local runtime. | User. | Env var or OS credential store. | Runtime credential lookup. | User/provider controlled. | User revokes at provider/removes env/credential. | Redacted local config/status only. | User rotates token. | Code, package, logs, fixtures, `.logos/`, `logos/`, generated docs. |
| Maintainer package registry token | Publish package. | Release candidate/publish environment. | Maintainer. | Registry/CI secret store, not repo. | CI/manual publish environment. | Maintainer/platform policy. | Revoke in registry. | Release/publish audit. | Rotate token and audit release. | Source tree, package artifact, logs. |
| Optional provider sandbox token | Manual provider compatibility test. | Manual provider test only. | Maintainer/user running test. | Env/OS credential store. | Manual runtime env. | Provider/user controlled. | Revoke provider token. | Redacted notes only. | Rotate token. | CI default, fixtures, release artifact. |

CI default checks must not require provider tokens.

## Build Process

Build flow:

1. Install dependencies from lockfile with pnpm.
2. Run lint/format checks with Biome and markdownlint.
3. Run deterministic tests with Vitest.
4. Run TypeScript build with `pnpm build`.
5. Run `pnpm typecheck` as an explicit release gate because the current `pnpm check` script does not include it.
6. Run `pnpm smoke:cli` before release/CLI changes.
7. Inspect/package artifacts before publish.

| Input | Command / Process | Output | Failure Behavior |
| --- | --- | --- | --- |
| TypeScript source | `pnpm build` / `tsc -p tsconfig.json` | `dist/` JavaScript/types as configured. | Block release. |
| Tests | `pnpm test` | Vitest results. | Block release for unaccepted failures. |
| Markdown docs | `pnpm lint:md` | markdownlint result. | Block release unless accepted docs-only exception. |
| Source formatting/lint | `pnpm lint:biome` | Biome result / possible writes due current script. | Review generated changes; block if unresolved. |
| CLI smoke | `pnpm smoke:cli` | CLI preflight evidence. | Block release for CLI wiring failure. |
| Package metadata | package inspection / pack dry-run when added. | Package contents/provenance. | Block publish if required files missing or secrets included. |

Build cache must not hide stale generated outputs. Release builds should start from a clean checkout/CI runner where feasible.

## Artifact Strategy

| Artifact | Produced By | Source Ref | Version | Metadata | Storage Location | Immutability Rule | Retention Rule | Promotion Rule | Verification Rule | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dist/` build output | `pnpm build`. | Git commit. | Package version. | Build command, Node/pnpm versions. | Local/CI workspace; package artifact. | Rebuilt from source; do not hand-edit. | CI/release retention. | Included in package if tests pass. | Build + smoke. | Engineering |
| npm/package tarball | package/publish process. | Git tag/commit. | Semver package version. | package.json, lockfile ref, CI evidence. | Package registry/release artifacts. | Immutable after publish; use new version for fixes. | Registry policy. | Publish only after release gates. | Pack inspection, smoke install if added. | Maintainer |
| Bundled profiles | Source tree packaged with release. | Git commit/profile version. | Package version/profile version. | Schema version. | Package artifact. | Immutable per package version. | Package lifetime. | Promote with package. | Profile contract tests. | Engineering/profile owner |
| Release evidence bundle | CI/release checklist. | Git commit/tag. | Release version. | Test outputs, smoke result, manual sign-off, known risks. | Release notes/CI artifacts. | Append-only after release. | Release policy. | Required for release. | Checklist review. | Product/engineering |
| Generated user docs/artifacts | User runtime `/generate`. | User workspace state/profile. | User local generation run. | Output kind/status/source refs. | User repository root, default `logos/`. | User-owned, not package artifact. | User-managed. | N/A. | Generation report. | User |

No artifact may contain raw provider tokens, auth headers, local secret values, or unredacted provider payloads.

## CI/CD Pipeline

There is CI validation design, but no hosted CD deployment in MVP.

Current repository status: the repo contains GitHub templates and metadata, but no checked-in GitHub Actions workflow is present. Until a CI workflow exists, CI/CD items in this section are required deployment design and release-management requirements, not evidence that automation is already implemented.

| Stage | Trigger | Inputs | Actions | Required Checks | Artifacts Produced | Evidence Captured | Failure Consequence | Approval Required | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local preflight | Developer before handoff. | Working tree. | Focused tests, lint/build as needed. | Changed-area tests. | Local output. | Command output in handoff. | Fix or report blocker. | No. | Engineer |
| PR/default CI | PR/merge candidate. | Source checkout. | Install, lint, test, build. | `pnpm lint:biome`, `pnpm lint:md`, `pnpm test`, `pnpm build`, `pnpm typecheck` if separate. | CI logs. | Check status. | Block merge unless accepted. | Maintainer for exception. | Engineering |
| Release candidate | Tag/manual release prep. | Passing commit. | Full release gate, smoke CLI, package inspection. | `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli`, security/privacy checks, manual acceptance. | Build/package/evidence. | Release checklist. | Block release. | Product/engineering owner. | Product/engineering |
| Optional provider compatibility | Manual. | Release candidate + explicit provider credentials. | Synthetic provider call/config test. | Redacted pass/fail. | Redacted notes. | Provider status. | Blocks only provider-specific claims. | Product/engineering. | Engineering |
| Publish | Manual/approved release. | Verified artifact/version. | Publish package/release. | Release approval and clean working tree/tag policy. | Published package. | Registry/release record. | Stop/rollback via version/hotfix if failure after publish. | Maintainer. | Maintainer |

CD to servers is N/A.

## Deployment Strategy

The MVP rollout model is package publish, not rolling/canary/blue-green deployment.

| Rollout | Strategy | Target Environment | Promotion Source | Gate Criteria | Smoke Tests | Health Checks | Monitoring Window | Rollback Trigger | Approval Authority | Communication Requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Package release | Semver package publish. | Package registry/users. | Release candidate. | Release gates pass, no raw secrets, no telemetry, profile valid. | `pnpm smoke:cli`, optional install smoke. | Local CLI smoke only. | Post-release issue/support watch. | Broken install/CLI, token leak, severe state corruption, invalid bundled profile. | Product/engineering owner. | Release notes/changelog. |
| Documentation/profile update | Package release or docs-only release. | Package/docs users. | Source commit. | markdownlint, profile tests, manual review. | N/A or CLI if package affected. | N/A. | Review issue reports. | Wrong contract/profile breaks generation. | Product/engineering. | Release notes if user-facing. |
| Provider adapter update | Package release. | Users who configure provider. | Release candidate. | fake contract tests, optional live provider check. | Provider config/status smoke with fake. | Provider optional. | Support watch. | Adapter breaks provider flow or leaks token. | Engineering/product. | Provider change notes. |

There are no deployment windows for hosted service availability because there is no hosted service. Users choose when to install or update.

## Migration Process

Migrations are local state/profile/package compatibility concerns, not database deployments.

| Migration Type | Scope | Timing | Compatibility Requirement | Forward Plan | Rollback or Roll-Forward Plan | Backfill Plan | Failure Detection | Recovery Plan | Retest Requirement | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace state schema | `.logos/` JSON state. | On startup/command after package update. | New app must detect old/unsupported schema. | Versioned migration or recovery guidance. | Prefer roll-forward; package downgrade may not read migrated state. | Backfill required fields deterministically. | Schema validation/migration record. | Preserve prior state copy where feasible; block mutation on failure. | Old-state fixtures and migration tests. | Release-blocking when schema changes. |
| Profile contract/schema | Bundled profile YAML/document schema. | Package release/profile load. | Existing state refs should become stale/orphaned, not silently deleted. | Compatibility validation and migration notes. | Install prior package/profile if needed. | Map renamed docs/fields where defined. | Profile validation and compatibility tests. | Block generation or show remediation. | Profile snapshot/contract tests. | Release-blocking for Standard profile. |
| Generated output format | Markdown/HTML/agent pack shape. | Next `/generate`. | Existing outputs may be stale/manual-edited. | Regenerate with confirmation and report. | Use prior package or restore generated files from Git. | N/A; outputs derived. | Generation report/stale detection. | Regenerate or skip/confirm overwrite. | Golden output tests. | Release-blocking for canonical docs if breaking. |
| Provider config shape | `.logos/config.json` redacted metadata. | Provider config read/test. | Raw token must never be introduced. | Validate/migrate token source refs. | Clear/reconfigure provider. | N/A. | Provider config validation. | Route to `/config ai`. | Provider config fixtures. | Release-blocking if token safety affected. |
| Hosted/database migration | Hosted database. | N/A. | N/A. | N/A. | N/A. | N/A. | N/A. | N/A. | N/A. | Excluded MVP |

Destructive migrations require strong confirmation and migration notes. Silent destructive repair is not allowed.

## Release Promotion

Promotion path for MVP:

1. Source change lands in repository.
2. Local/focused tests pass.
3. PR/default checks pass.
4. Release candidate is selected from a clean commit.
5. Release quality gate runs.
6. Manual acceptance and risk review are completed.
7. Package is built/inspected.
8. Package is published.
9. Release notes document changes, migrations, known risks, and provider/profile implications.

Promotion blockers:

- failing `pnpm check`, `pnpm test`, `pnpm build`, `pnpm typecheck`, or `pnpm smoke:cli`;
- relying on `pnpm check` alone for release while `typecheck` and `smoke:cli` remain outside that script;
- raw token or secret in source, fixtures, logs, package, or generated artifacts;
- hidden telemetry/network behavior;
- default root regression from `logos/`;
- invalid bundled profile/schema;
- AI output can silently confirm decisions;
- unsafe write/path behavior;
- provider failure corrupts state;
- unreviewed state/profile migration.

## Release Verification

| Phase | Checks | Evidence | Failure Consequence |
| --- | --- | --- | --- |
| Pre-release | `pnpm check`, `pnpm typecheck`, focused release-blocking tests, profile validation, no-secret inspection. | CI/local command output. | Block release. |
| Package verification | Build artifact exists, `bin.logos` points to `dist/cli.js`, required files included, no secrets. | Package inspection/dry-run when implemented. | Block publish. |
| Smoke verification | `pnpm smoke:cli`; optional install/run smoke in temp directory. | Smoke output. | Block release for CLI failure. |
| Security/privacy verification | no raw tokens, no telemetry, remote provider disclosure tests, path safety tests. | Test/review evidence. | Block release. |
| Generated output verification | Markdown generation, derived output classification, root `logos/`, stale/partial report behavior. | Golden/report tests. | Block or accept deferral for derived outputs only. |
| Manual acceptance | Founder/product owner primary journey and generated docs review. | Checklist/notes. | Block must-have journey failures. |
| Post-release | Watch issues/support/manual install checks. | Issue/support notes. | Hotfix/new version if severe. |

No hosted post-deploy health endpoint exists in MVP.

## Smoke Tests

| Smoke Test | Environment | Core Path | Data / Credentials | Blocking Behavior |
| --- | --- | --- | --- | --- |
| CLI help/version smoke | Local/CI/release candidate. | `logos` executable starts and help/version routes work. | None. | Blocks release if CLI cannot start. |
| TUI shell smoke | Local/CI where possible. | Running `logos` opens usable shell without workspace state. | Temp repo. | Blocks CLI/TUI release. |
| Init/status smoke | Temp local repo. | `/init` creates state; `/status` reads it. | Synthetic temp repo. | Blocks release. |
| Validation smoke | Temp fixture state. | `/validate` runs without provider. | Synthetic state. | Blocks release. |
| Generation smoke | Temp fixture state. | `/generate` writes under `logos/` or custom root. | Synthetic state. | Blocks release for canonical generation. |
| Provider config smoke | Fake provider. | `/config ai`/provider status redacts tokens. | Fake token source only. | Blocks provider feature release. |
| Package install smoke | Release candidate. | Installed package exposes `logos`. | No provider token. | Recommended before publish. |

Smoke tests must be fast and deterministic. Live provider calls are optional manual checks, not default smoke tests.

## Feature Flags

There is no dedicated feature flag platform in MVP. Runtime feature control is handled by explicit configuration and command availability.

| Flag | Purpose | Type | Owner | Environments | Default State | Targeting Rule | Kill Switch | Test Requirement | Audit Requirement | Cleanup Trigger | Expiration Date or Review Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Provider mode config | Enable local/remote/custom/unconfigured provider behavior. | Configuration flag. | Engineering/product. | Local runtime. | unconfigured/no-provider guidance. | Workspace/user config. | Set provider unconfigured or remove token source. | Provider config/failure tests. | Provider config event. | N/A; core config. | Review when providers change. |
| Debug logging opt-in | Enable local redacted debug logs if implemented. | Ops/debug flag. | Engineering. | Local runtime. | disabled. | Explicit env/CLI/config if implemented. | Disable flag/remove config. | Redaction tests before release. | Debug enabled event if persisted. | Remove if unused/unsafe. | Before debug logging ships. |
| Experimental renderer/provider features | Gate provisional implementation if needed. | Release/config flag. | Engineering/product. | Local/release candidate. | disabled until ready. | Explicit config/experimental command. | Disable feature. | Contract + workflow tests. | Config/change event. | Remove when stable or dropped. | Each release. |

Experiment/analytics flags are not supported because telemetry/analytics are prohibited by default.

## Rollback Strategy

| Rollback Scenario | Trigger | Authority | Rollback Method | Data Migration Constraint | Feature Flag Action | Verification Steps | Communication Requirement | Support Impact | Monitoring Requirement | Postmortem Requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Broken package install/CLI start | Users/maintainers cannot run `logos`. | Maintainer/product owner. | Publish hotfix or advise pinning prior version. | Usually none. | N/A. | Install/run smoke. | Release note/advisory. | Installation support. | Watch issues. | Required if released publicly. |
| Invalid bundled profile/schema | Generation/profile loading fails. | Product/engineering. | Hotfix package/profile; advise previous version. | Existing state may be compatible with prior profile. | N/A. | Profile tests/generation smoke. | Release note with affected profile/docs. | Profile support. | Watch issues. | Required. |
| State migration failure | Updated package cannot read/migrate `.logos`. | Engineering/product. | Roll forward with fix; advise restore/pin if safe. | Downgrade may not read migrated state. | N/A. | Old-state fixture tests. | Migration advisory. | High support impact. | Issue/support monitoring. | Required. |
| Token/privacy leak | Secret appears in artifact/log/output. | Product/security owner. | Unpublish/deprecate if possible, rotate affected tokens, hotfix. | N/A. | Disable affected provider path if possible. | Secret scan/redaction tests. | Security advisory to affected users. | High. | Watch reports. | Required. |
| Unsafe write/root regression | Writes outside configured root or overwrites silently. | Engineering/product. | Hotfix; advise stop generation and restore from Git/backup. | User local files may be affected. | Disable generation feature only if flag exists. | Path/collision tests. | Urgent advisory. | High. | Watch issues. | Required. |
| Provider adapter regression | Provider calls fail or mutate state incorrectly. | Engineering/product. | Hotfix; advise switch provider/no-provider mode. | State corruption must be repaired separately. | Set provider unconfigured/disable adapter if supported. | Provider fake/live optional checks. | Provider-specific release note. | Medium/high. | Watch provider issues. | Required if state affected. |

Rollback cannot guarantee recovery of user local files unless users have Git/filesystem/OS backups. Release notes must be honest about migration and local-state constraints.

## Post-Deploy Monitoring

There is no hosted post-deploy monitoring in MVP. Post-release monitoring is maintainer review of local evidence and user reports.

Monitoring window:

- immediately after publish: install/package smoke where feasible;
- first 24-72 hours after public release: watch issues/support/community reports;
- before next release: review regressions, provider issues, state/migration reports, and docs confusion.

Signals:

- package install/start failures;
- issue reports about `.logos` state read/migration;
- provider config/token redaction issues;
- generation failures or root regressions;
- profile/schema validation failures;
- smoke/CI regressions;
- support questions around local setup, provider setup, or overwrites.

No dashboards, alerts, SLO burn rates, or telemetry review exist in MVP.

## Deployment Runbooks

| Runbook | Trigger | Owner | Expected Inputs | Expected Outputs | Linked Dashboards / Alerts | Required Before Production Release |
| --- | --- | --- | --- | --- | --- | --- |
| Release package | Approved release candidate. | Maintainer/product owner. | Passing gates, version, release notes, package inspection. | Published package and release evidence. | None; local release checklist. | Yes |
| Hotfix release | Critical package/runtime bug. | Maintainer/engineering. | Failing report, fix, focused regression test. | New patch version. | Issue/support reports. | Yes |
| State migration failure | User/CI reports unreadable state after update. | Engineering. | State schema version, error, package version, redacted fixture. | Patch/migration guidance. | None. | Before schema migrations ship |
| Secret/token leak | Secret in source/artifact/output/log. | Product/security. | Affected files/artifacts, token class, package version. | Token rotation guidance and patched release. | None. | Yes |
| Provider outage/regression | Provider adapter fails or remote provider unavailable. | Engineering/product. | Provider mode, error class, package version. | No-provider/reconfigure guidance or patch. | None. | Yes |
| Unsafe write/generation failure | Root/path overwrite issue. | Engineering. | Root, output kind, generation report, package version. | Recovery guidance and patch if product bug. | None. | Yes |
| Package deprecation/unpublish | Broken or unsafe published package. | Maintainer/product owner. | Version, impact, replacement version. | Deprecation/advisory. | Registry/release records. | Yes |

Detailed step-by-step procedures belong in Operations and Release Management.

## Deployment Risks

| Risk | Affected Environment or Stage | Risk Type | Source | Likelihood | Impact | Early Signal | Mitigation | Rollback or Recovery Path | Target Document | Release Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Package omits required runtime files. | Package artifact. | Broken release. | Incorrect `files` config/build output. | Medium. | High. | Install/package smoke fails. | Pack inspection, smoke install. | Publish hotfix. | Release Management. | Release-blocking. |
| `pnpm check` excludes smoke/typecheck expectations. | CI/release gate. | Gate gap. | Script drift. | Medium. | Medium. | Release checklist differs from CI. | Explicit release gate includes `typecheck` and `smoke:cli`. | Rerun gate/hotfix process. | Testing, Release. | Review-needed/block if unresolved. |
| Raw token or secret enters package/log/fixture. | Build/artifact/release. | Security/privacy. | Bad fixture/config/logging. | Low/medium. | Critical. | Secret scan/manual inspection finds token. | Secret scanning, redaction tests, package inspection. | Rotate token, deprecate/hotfix. | Security, Incident Response. | Release-blocking. |
| Root default regresses to `docs/`. | Runtime/generation. | Product contract regression. | Old assumptions. | Medium. | High. | Tests or user output show docs root default. | Root tests, docs review, release checklist. | Hotfix and migration guidance. | Testing, Support. | Release-blocking. |
| State migration corrupts user `.logos`. | User runtime after update. | Data loss. | Schema change. | Medium when migrations exist. | Critical. | State read failures after update. | Old-state fixtures, migration notes, preserve prior state. | Roll forward/hotfix; user restore from backup. | Data Model, Release. | Release-blocking. |
| Provider adapter changes break live users despite fakes. | Optional provider runtime. | Integration drift. | Provider API changes. | Medium. | Medium/high. | Provider failures after release. | Contract fakes plus optional live provider check. | Advise reconfigure/no-provider; hotfix. | Integration, Support. | Blocks provider-specific claims. |
| Published package introduces hidden network/telemetry. | User runtime. | Privacy/trust. | Dependency/feature change. | Low/medium. | Critical. | Network inspection/user report. | Static review, no-telemetry tests, dependency review. | Hotfix/remove feature/advisory. | Security, Observability. | Release-blocking. |
| No hosted support visibility slows incident diagnosis. | Post-release support. | Operational blind spot. | Local-first design. | High. | Medium. | User cannot provide enough local evidence. | Clear local reports and future redacted support export. | User shares redacted reports; patch docs. | Support Model. | Accepted MVP risk. |
| OS/Node compatibility issues appear after release. | End-user local runtime. | Compatibility. | Limited environment coverage. | Medium. | Medium. | Install/start failures on OS/runtime. | Node `>=22`, smoke on macOS/Linux at minimum, docs. | Patch or adjust engine range. | Release, Support. | Degrade gracefully/review. |

## Downstream Handoff

Operating Model must inherit:

- MVP operation is package/local-runtime support, not hosted service operation;
- maintainers support installation, provider setup, state recovery, generation issues, and release hotfixes through local evidence;
- no operator dashboards, hosted logs, telemetry, or cloud restore exist.

Maintenance Plan must inherit:

- dependency updates require `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli`, and package inspection when release-affecting;
- Node.js engine range and pnpm workflow must be maintained;
- profile/schema changes require compatibility tests and migration notes.

Release Management must inherit:

- semver release discipline;
- release candidate gate with tests, typecheck, smoke CLI, package inspection, no-secret/no-telemetry checks, manual acceptance;
- release notes must call out migrations, profile changes, provider behavior, root behavior, known risks, and rollback/pinning guidance.

Support Model must inherit:

- user local reports are the support source of truth;
- support should ask for redacted status/validation/diagnostics/generation reports, not raw tokens or full project dumps;
- provider setup and file overwrite/root confusion are expected support topics.

Incident Response must inherit:

- package/token/privacy/unsafe-write/state-migration/provider-regression incidents have hotfix and advisory paths;
- incident evidence must exclude secrets and sensitive payloads;
- no hosted telemetry means incident detection is user/maintainer reported.

Risk Management must inherit:

- accepted MVP risks: no hosted staging, no hosted rollback, no central monitoring, no managed backup/restore, limited OS coverage until validated;
- release-blocking risks: token leak, hidden telemetry, unsafe write, root default regression, state migration corruption, invalid bundled profile, broken package binary.
