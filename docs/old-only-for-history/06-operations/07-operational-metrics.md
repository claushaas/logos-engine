# Operational Metrics

## Operational Health Objective

Track only what can be acted upon. Because LOGOS Engine is a local-first, open-source MVP with no hosted infrastructure, many traditional operational metrics do not apply. This document defines what is measured, what is deferred, and what is explicitly out of scope.

## Metric Taxonomy

| Category | Scope | Status |
|----------|-------|--------|
| Support | GitHub issues, discussions | current |
| Release | Version tags, test results, smoke tests | current |
| Maintenance | Dependency health, open issues/PRs | current |
| Code Quality | Test coverage, type errors, lint violations | current |
| Reliability | — | N/A (no hosted service) |
| Incident | Security advisories, critical bug fallout | current |
| Financial | — | deferred (no revenue) |
| Cost and Capacity | Founder time | manual estimate |
| SLA/SLO | — | N/A |
| Data and Privacy | User data handling | minimal scope |

## Metric Inventory

| Metric | Source | Frequency | Owner | Status |
|--------|--------|-----------|-------|--------|
| Open issues by label | GitHub API | weekly | Founder | current |
| Time to first response on issues | GitHub API | monthly | Founder | current |
| Release test pass rate | CI / local | per release | Founder | current |
| Smoke test pass rate | `pnpm smoke:cli` | per release | Founder | current |
| Type error count | `pnpm typecheck` | per commit | Founder | current |
| Lint violation count | `pnpm check` | per commit | Founder | current |
| Dependency vulnerabilities | `pnpm audit` | weekly | Founder | current |
| Outdated dependencies | `pnpm outdated` | monthly | Founder | manual |
| Download count (npm) | npm registry | monthly | Founder | manual |
| Critical bug count | GitHub issues | weekly | Founder | current |
| Security advisory count | GitHub Dependabot | weekly | Founder | current |
| Founder hours available | calendar estimate | monthly | Founder | manual |

## Health Scorecard

A lightweight, manual scorecard reviewed monthly.

| Dimension | Green | Yellow | Red |
|-----------|-------|--------|-----|
| Issue backlog | < 10 open | 10–25 | > 25 |
| Unresponded issues | 0 | 1–3 | > 3 |
| CI passing | yes | flaky | failing |
| Type errors | 0 | 1–5 | > 5 |
| Critical security advisories | 0 | 1 low-sev | any high-sev unpatched |
| Founder capacity | > 10 hrs/wk | 5–10 hrs/wk | < 5 hrs/wk |

**Assumption**: Thresholds are guesses. They will be adjusted after 3 months of data.

## Support Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Open support issues | GitHub issues labeled `bug` or `question` | < 10 |
| Median time to first response | Hours from open to first comment | < 168 hours (7 days) |
| Median time to close for confirmed bugs | Hours from `confirmed` to close | no target yet |
| Issues needing info | Count labeled `needs-info` | < 5 |

**Gap**: No automated support dashboard. Metrics are computed ad hoc via GitHub search.

## Customer Success Metrics

**Status**: deferred

Because there is no hosted product, no accounts, and no onboarding funnel instrumentation, traditional customer success metrics (activation rate, retention, NPS) are not collected.

**Review-needed**: Define a lightweight "first success" indicator, such as:
- User stars the repo
- User opens a discussion
- User generates a document and commits it

These proxies are not currently tracked.

## Reliability Metrics

**Status**: N/A

LOGOS Engine runs entirely on the user's machine. There is no hosted backend, no API uptime, no service availability.

| Metric | Status | Rationale |
|--------|--------|-----------|
| Uptime | N/A | No hosted service |
| Error rate | N/A | No telemetry |
| Latency (API) | N/A | No API |
| Latency (local generation) | manual | Can be timed locally; not collected at scale |

**Assumption**: Users report slowness via issues if it becomes a problem.

## Incident Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Security advisories (unpatched) | High/critical CVEs in dependencies | 0 |
| Critical bugs in latest release | Bugs labeled `severity:critical` | 0 |
| Post-incident reviews completed | Reviews written after critical issues | 100% of critical issues |
| Time to patch critical dependency | Days from advisory to merged fix | < 7 days |

## Release Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Releases per quarter | Count of semver tags | no target; demand-driven |
| Release gate pass rate | `%` of releases where `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli` pass before tag | 100% |
| Post-release hotfixes | Count of patch releases within 7 days of a minor/major | 0 |
| Changelog completeness | Releases with a changelog entry | 100% |

## Maintenance Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Open PRs | Count | < 5 |
| Stale branches | Count | < 3 |
| Dependency age (max) | Days since last update of any direct dependency | < 90 |
| Test pass rate (main branch) | `%` | 100% |

## Business Process Metrics

See [06-business-processes.md](./06-business-processes.md) for process-level metrics.

## Financial Operations Metrics

**Status**: deferred

| Metric | Status | Notes |
|--------|--------|-------|
| Revenue | deferred | No paid offerings |
| Cost of goods sold | deferred | No hosting costs |
| Payment failure rate | deferred | No payments |
| Refund rate | deferred | No refunds |

## Data and Privacy Metrics

**Status**: minimal scope

| Metric | Definition | Target |
|--------|------------|--------|
| Data export requests | Count per quarter | — |
| Data deletion requests | Count per quarter | — |
| Telemetry events emitted | Count | 0 in default build |

**Assumption**: Local-first architecture makes most privacy metrics irrelevant. User data never leaves their machine unless they choose to commit or share it.

## Cost and Capacity Metrics

| Metric | Definition | Status |
|--------|------------|--------|
| Founder hours per week | Estimated time on project | manual |
| CI minutes used | GitHub Actions usage | manual |
| Tooling costs | Domain, email, etc. | manual |

**Gap**: No systematic time tracking. Costs are low enough to be eyeballed.

## SLA/SLO Metrics

**Status**: N/A

No service level agreements or objectives are offered. LOGOS Engine is provided as-is under its open-source license.

**Assumption**: If a commercial support tier is introduced, SLAs will be defined at that time. Until then, all response times are best-effort.

## Guardrail Metrics

Metrics that, if crossed, trigger an explicit review.

| Guardrail | Threshold | Action |
|-----------|-----------|--------|
| Unpatched high-severity CVE | > 0 | Emergency dependency update |
| Critical bug in latest release | > 0 | Emergency patch release |
| CI failing on main | > 0 days | Stop releases until green |
| Issue backlog | > 25 | Triage session required |
| Founder capacity | < 5 hrs/wk for 2+ weeks | Re-scope roadmap |

## Metric Ownership

All metrics are owned by the founder. Collection is manual or semi-automated via GitHub and local scripts.

**Gap**: No automated dashboard. No alerting.

## Reporting Cadence

| Report | Frequency | Audience | Format |
|--------|-----------|----------|--------|
| Issue backlog snapshot | weekly | Founder | GitHub search |
| Dependency audit | weekly | Founder | `pnpm audit` |
| Health scorecard | monthly | Founder | markdown in `docs/` or notes |
| Release retrospective | per release | Founder | mental or brief notes |
| Quarterly review | quarterly | Founder | `docs/` update if needed |

**Assumption**: Reporting is for internal clarity, not stakeholders or investors. As the project grows, cadence and audience may expand.
