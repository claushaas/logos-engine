# Team and Responsibilities

## Responsibility Objective

Define who is accountable for what, with enough constraint and context that decisions do not stall when only one person is available. This document is the source of truth for ownership, escalation paths, and known gaps.

## Responsibility Model

Flat. The project is founder-led with no hierarchy. All operational functions roll up to the founder. Where external contributors exist, ownership is advisory or downstream until a merge decision is required.

**Status:** `current` | `manual` | `launch-critical`

## Team Context

- **Stage:** Pre-revenue open-source MVP. No external funding. No hired employees.
- **Capacity:** Effectively one full-time equivalent (founder) covering engineering, product, support, and go-to-market.
- **Location:** Distributed by default. No office. No timezone coverage guarantees.
- **Assumption:** Until a second committed contributor emerges, every operational role is either performed by the founder or explicitly deferred.

## Role Taxonomy

| Role | Definition | Status |
|------|-----------|--------|
| Founder | Accountable for all outcomes. Executes engineering, product, support, GTM, and operations. | `current` |
| Contributor | External developer who opens PRs, files issues, or proposes features. No binding ownership. | `downstream-owned` |
| User / Community Member | Provides feedback, reports bugs, participates in discussions. Not responsible for delivery. | `downstream-owned` |
| Advisor | Informal sounding board for product or GTM decisions. No operational duty. | `deferred` |

## Current Team

| Name / Handle | Capacity | Primary Focus | Secondary Focus | Constraint |
|---------------|----------|---------------|-----------------|------------|
| Founder | ~1.0 FTE | Engineering & Product | Support & GTM | No dedicated ops, legal, or finance support |

**Ownership Gap:** No designated owner for security incident response, vendor negotiations, or financial audit. Fallback is the founder with community disclosure where appropriate.

## Capacity Model

Capacity is measured in founder hours per week. This is an estimate, not a contract.

| Function | Estimated Hours/Week | Status | Notes |
|----------|---------------------|--------|-------|
| Engineering (code, review, release) | 20–30 | `current` | Includes bug fixes and feature work |
| Product (roadmap, specs, decisions) | 5–10 | `current` | Includes canonical doc maintenance |
| Support (issues, discussions, email) | 2–5 | `current` | Scales with adoption; may cap |
| GTM (content, launch, community) | 2–5 | `current` | Staged launch reduces initial load |
| Operations (infra, vendor, finance) | 0–2 | `manual` | Deferred until post-launch traction |

**Constraint:** If support load exceeds 5 hours/week consistently, the founder must either reduce engineering bandwidth or defer lower-priority issues. No escalation pool exists yet.

## Responsibility Matrix

| Function | Owner | Fallback | Signal That It Is Overloaded | Threshold for Change |
|----------|-------|----------|------------------------------|----------------------|
| Product vision & roadmap | Founder | N/A | Roadmap items age > 30 days without update | Second contributor commits > 5 hrs/week |
| Core engineering | Founder | Contributor PRs | Release cadence drops below monthly | Hire or contract engineering help |
| Code review & merge | Founder | N/A | PR review time > 7 days | Add trusted maintainer |
| Release management | Founder | N/A | Release blocked > 3 days by single person | Automate more of the pipeline |
| Documentation | Founder | Contributors | Docs lag release by > 1 release | Require doc updates in PR template |
| Community support | Founder | N/A | Unresponded issues > 10 open > 14 days | Recruit community moderator |
| Security response | Founder | Public disclosure | CVE or high-severity report received | Establish security advisory process |
| Finance / Billing | Founder | N/A | N/A (no revenue) | N/A |
| Legal / Compliance | Founder | N/A | N/A (no external obligations) | Engage counsel if revenue starts |

## Operational Roles

Operational roles are abstract definitions. Where a role has no dedicated human, it is marked `unstaffed` and the founder acts as interim owner.

| Role | Staffed By | Status |
|------|-----------|--------|
| On-call engineer | Founder | `current` |
| Incident commander | Founder | `current` |
| Support lead | Founder | `current` |
| Community manager | Founder | `current` |
| Security officer | Founder | `current` |
| Finance operator | Founder | `manual` |
| Legal counsel | None | `deferred` / `unstaffed` |
| HR / People ops | None | `deferred` / `unstaffed` |

## Product Responsibilities

- **Owner:** Founder
- **Cadence:** Continuous; weekly review of open decisions
- **Scope:** Roadmap prioritization, feature scoping, canonical document maintenance, decision records, and profile definitions.
- **Constraint:** Product decisions are made in public where possible (decision records in `docs/` or GitHub discussions). No private backlog.
- **Deferred:** Formal user research program, A/B testing infrastructure, dedicated UX design.

## Engineering Responsibilities

- **Owner:** Founder
- **Cadence:** Continuous; monthly release target
- **Scope:** Architecture, implementation, testing, code review, CI/CD, dependency management, and local-first data model integrity.
- **Fallback:** External contributors may open PRs; founder retains merge authority.
- **Threshold:** If contributor PR velocity exceeds review capacity, founder may declare a review freeze or reduce release scope.
- **Blocked:** None currently.

## Support Responsibilities

- **Owner:** Founder
- **Cadence:** Ad-hoc; at least weekly sweep of open issues/discussions
- **Scope:** GitHub issues, GitHub Discussions, and any email or social mentions.
- **Constraint:** No guaranteed response time. See [Customer Support](./04-customer-support.md) for targets.
- **Deferred:** Live chat, phone support, paid support tiers, SLAs.

## Customer Success Responsibilities

- **Owner:** Founder
- **Cadence:** Monthly check-in with active users during soft launch
- **Scope:** Onboarding guidance, activation tracking, feedback collection, and churn signal monitoring.
- **Constraint:** No dedicated CS tooling. Success is inferred from GitHub activity, discussion participation, and informal conversations.
- **Deferred:** Formal health scoring, automated nurture campaigns, expansion revenue tracking.
- **See also:** [Customer Success](./05-customer-success.md)

## GTM Responsibilities

- **Owner:** Founder
- **Cadence:** Campaign-by-campaign; no standing pipeline
- **Scope:** Launch planning, content creation, community outreach, and beachhead segment engagement (indie hackers, product-minded engineers, technical founders).
- **Constraint:** No paid acquisition budget. No marketing automation stack.
- **Deferred:** Paid ads, partnership program, events, formal PR.

## Financial Responsibilities

- **Owner:** Founder
- **Status:** `manual` | `deferred`
- **Scope:** Personal expense tracking for domain, tooling, and infrastructure. No revenue collection.
- **Constraint:** No business bank account, no accounting software, no billing infrastructure.
- **Threshold for Change:** First dollar of revenue triggers formal bookkeeping and legal entity review.

## Data and Privacy Responsibilities

- **Owner:** Founder
- **Scope:** Ensuring the product remains local-first with no telemetry, no accounts, and no external data collection by default.
- **Constraint:** The engine operates on the user’s repository. No hosted database. No cloud sync unless the user configures it independently.
- **Deferred:** Formal privacy policy review by counsel, GDPR/LGPD compliance audit, data processing agreements.
- **Assumption:** Because no personal data is collected centrally, regulatory obligations are minimal. This assumption must be revisited if any cloud or sync feature is added.

## Release Responsibilities

- **Owner:** Founder
- **Cadence:** Monthly target; semver via npm and GitHub Releases
- **Scope:** Version bump, changelog, tag, npm publish, GitHub release notes, and docs update.
- **Constraint:** Release is manual with some scripted steps. No fully automated publish gate.
- **Fallback:** If founder is unavailable, releases stall. No alternative publisher is authorized.
- **Review-needed:** Automate npm publish via GitHub Actions with required checks.

## Incident Responsibilities

- **Owner:** Founder
- **Scope:** Security vulnerabilities, critical bugs, broken releases, or supply-chain issues.
- **Signal:** User report, CI failure, dependency advisory, or manual detection.
- **Threshold:** Security issues are addressed immediately. Critical bugs within 48 hours if reproducible.
- **Fallback:** Public disclosure via GitHub Security Advisory or issue if fix is delayed.
- **Deferred:** Formal incident postmortem template, dedicated status page, on-call rotation.

## Vendor Responsibilities

- **Owner:** Founder
- **Scope:** npm registry, GitHub, domain registrar, and any development tooling subscriptions.
- **Constraint:** No enterprise contracts. All vendors are pay-as-you-go or free tier.
- **Risk:** Single point of failure on founder’s personal accounts. No shared org owner yet.
- **Deferred:** Vendor risk assessments, backup account policies, enterprise tier migration.

## Risk Responsibilities

- **Owner:** Founder
- **Scope:** Identifying and documenting project-level risks in canonical docs and decision records.
- **Cadence:** Reviewed when a new risk is raised or quarterly, whichever comes first.
- **Current Risks:**
  - Single-person bus factor.
  - No legal entity exposing founder to personal liability.
  - No revenue model proven.
  - Support scalability ceiling.
- **Mitigation:** Document everything publicly, keep code simple, staged launch to control load.
- **Deferred:** Formal risk register, insurance, legal separation, board oversight.
