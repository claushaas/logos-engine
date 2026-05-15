# Customer Success

## Customer Success Objective

Maximize the number of users who move from installation to active, structured decision-making in their own projects—and capture enough signal to know whether the engine is delivering value.

## Customer Success Principles

1. **Success is adoption, not revenue.** There is no paid tier yet. Success means users finish onboarding, create decisions, and keep using the engine.
2. **Manual until painful.** All success activities are founder-driven and lightweight. Automation is deferred until volume justifies it.
3. **Public and documented.** Feedback loops happen in public (GitHub Discussions, issues) so the community benefits.
4. **No surveillance.** Because the product is local-first with no telemetry, success signals are inferred from public behavior and voluntary check-ins, not automated tracking.

## Customer Success Scope

**In scope:**
- Onboarding guidance for new users
- Activation milestone definition and tracking
- Feedback collection and synthesis
- Community health (discussion quality, contributor growth)
- Churn signal detection (stopped usage, unanswered blockers)

**Out of scope / deferred:**
- Revenue expansion and upsell
- Formal account management
- Automated health scoring dashboards
- NPS or CSAT surveying at scale
- Customer advisory boards

## Customer Lifecycle

| Stage | Definition | Success Signal | Owner |
|-------|-----------|----------------|-------|
| Awareness | Learns about LOGOS Engine | Star or mention on GitHub/social | Founder / Community |
| Installation | Installs via npm | `npm install -g logos-engine` succeeds | User |
| First Run | Executes `logos init` or equivalent | Initial docs scaffold created | User |
| Activation | Creates first decision or assumption record | Decision file committed to repo | User |
| Habituation | Uses engine across multiple sessions | Multiple commits over > 14 days | User |
| Advocacy | Recommends engine, opens issues/PRs, answers others’ questions | Referral mention, contribution, discussion reply | User |

**Assumption:** Because there is no telemetry, stage transitions are inferred from GitHub activity, discussion participation, and direct conversations during soft launch.

## Customer Segments and Cohorts

| Segment | Description | Size Estimate | Priority |
|---------|-------------|---------------|----------|
| Indie Hackers | Solo builders validating ideas | Unknown | `launch-critical` |
| Product-Minded Engineers | Engineers who want structure before coding | Unknown | `launch-critical` |
| Technical Founders | Pre-product founders planning MVPs | Unknown | `launch-critical` |
| Open Source Maintainers | Using LOGOS to document project intent | Unknown | `post-launch` |
| Enterprise Teams | Evaluating for internal use | Unknown | `deferred` |

**Cohorts** are grouped by month of first known interaction (e.g., "2026-05 cohort"). No automated cohort tracking exists yet.

## Onboarding Model

**Status:** `manual` | `launch-critical`

1. **Installation:** `npm install -g logos-engine` (or local install).
2. **Initialization:** `logos init` scaffolds the default docs structure under `logos/`.
3. **First Decision:** User is guided to create their first decision record via CLI or manual file creation.
4. **Validation:** User runs `logos validate` or equivalent to check structure.
5. **Commit:** User commits the new docs to their repository.

**Friction points to watch:**
- Node.js version incompatibility (< 22)
- Terminal/environment issues (Ink requires compatible terminal)
- Confusion about `logos/` directory vs. existing docs
- Unclear how to transition from blank template to first real decision

**Deferred:** Interactive tutorial, video walkthrough, guided CLI wizard beyond basic init.

## Activation Milestones

Activation is defined as the user committing at least one canonical decision or assumption file to their repository after initialization.

| Milestone | Evidence | Tracking Method |
|-----------|----------|-----------------|
| M0: Installed | `npm` download or issue mention | npm stats (approximate), GitHub stars |
| M1: Initialized | `logos init` run | Voluntary report, discussion post |
| M2: First Decision | Decision file exists in repo | User shares, or founder asks in check-in |
| M3: Validated | `logos validate` passes | User report |
| M4: Habitual | 3+ decisions over 30 days | Soft-launch check-ins only |

**Ownership Gap:** No automated product analytics. Activation rate is estimated, not measured precisely. This is an explicit trade-off for local-first principles.

## Onboarding Follow-up

During the soft launch, the founder will manually reach out to known installers within 7 days via GitHub Discussion or email (if shared).

**Follow-up questions:**
- Did installation work?
- Did you run `logos init`?
- What blockers did you hit?
- What would you document first?

**Status:** `current` for soft launch; `deferred` for public launch unless tooling is added.

## Health Signals

Because there is no telemetry, health signals are indirect:

| Signal | Source | Interpretation |
|--------|--------|----------------|
| GitHub star velocity | GitHub API | Growing awareness |
| Issue/discussion open rate | GitHub | Engagement or friction |
| PR contributions | GitHub | Community investment |
| Repeat issue reporters | GitHub | Sticky usage |
| Social mentions | Manual search | Word of mouth |
| Direct feedback | Email/Discord/DMs | Qualitative value signal |

**Limitation:** We cannot distinguish between "installed and happy" and "installed and abandoned." This is a known blind spot.

## Health Scoring

**Status:** `deferred`

A formal health score is not implemented. If volume justifies it post-launch, a lightweight score might be:

- **Green:** Active in discussions, opened issues/PRs, or responded to check-in.
- **Yellow:** Installed but silent; no public activity in 30 days.
- **Red:** Reported a blocker that was never resolved; or explicitly said they stopped using.

**Constraint:** Score is manual and subjective until a second person can validate it.

## At-Risk Customer Signals

A user is considered at risk if:

1. They reported a blocker (bug, confusion, missing feature) and received no response within 14 days.
2. They explicitly stated they are stopping usage or switching tools.
3. They opened a support request that was closed as `not-planned` without a workaround.

**Response:** Founder manually reaches out to apologize, clarify, and capture learnings. No automated save campaign exists.

## Retention Actions

**Status:** `manual` | `deferred`

| Action | Trigger | Owner | Status |
|--------|---------|-------|--------|
| Personal check-in | Soft-launch user goes quiet for 14 days | Founder | `current` |
| Blocker resolution | P1 bug reported by active user | Founder | `current` |
| Docs improvement | Repeated confusion on same topic | Founder | `current` |
| Newsletter / changelog | Major release | Founder | `post-launch` |
| Re-engagement email | Silent user > 90 days | None | `deferred` |

## Expansion Opportunities

**Status:** `deferred`

Because there is no paid tier, "expansion" means deeper usage, not revenue:

- Using advanced profiles (e.g., moving from `standard` to custom)
- Adopting decision workflows across multiple repos
- Contributing templates back to the project

These opportunities are noted during conversations but not systematically pursued.

## Satisfaction Measurement

**Status:** `deferred` | `manual`

No formal NPS or CSAT survey is deployed.

**Current methods:**
- Ask soft-launch users directly: "Is this saving you time or mental overhead?"
- Read tone of GitHub issues and discussions.
- Track whether users return after first contact.

**Deferred:** In-product (or in-docs) feedback prompt; quarterly survey.

## Feedback Loops

1. **GitHub Issues:** Structured bug reports and feature requests. Synthesized into roadmap.
2. **GitHub Discussions:** Open-ended feedback, workflow sharing, and Q&A.
3. **Soft-launch check-ins:** Founder interviews or async questions with early users.
4. **Decision Records:** Product decisions themselves are documented in `docs/`, making the process transparent.

**Cadence:** Founder reviews open issues and discussions weekly. Qualitative themes are logged informally; no formal synthesis report exists yet.

## Churn Prevention

**Status:** `manual`

Because the product is free, churn is silent (users stop using without telling us). Prevention relies on:

- Removing installation and setup friction
- Clear documentation for the first decision
- Responsive support for blockers
- Regular releases that show the project is alive

**Fallback:** If a user explicitly says they are leaving, founder asks why and logs the reason in a private note or anonymized issue.

## Churn Analysis

**Status:** `deferred` | `blocked`

Formal churn analysis is not possible without usage telemetry or a paid subscription model.

**Proxy metrics:**
- Drop-off in return contributions from a known user
- Uninstalls (not trackable via npm)
- Negative feedback in discussions

**Assumption:** Low retention in an open-source MVP is expected. The goal is to learn from explicit departures, not to optimize a funnel we cannot see.

## Customer Success Cadences

| Activity | Frequency | Owner | Status |
|----------|-----------|-------|--------|
| Issue/Discussion sweep | Weekly | Founder | `current` |
| Soft-launch user check-in | Ad-hoc (per user, ~7 days post-install) | Founder | `current` |
| Release notes and changelog | Per release | Founder | `current` |
| Qualitative synthesis | None formalized | Founder | `deferred` |
| Community highlight / shout-out | None formalized | Founder | `deferred` |
| Quarterly business review | N/A | — | `deferred` |

## Customer Success Metrics

| Metric | Definition | Current Tracking | Status |
|--------|-----------|------------------|--------|
| GitHub Stars | Awareness proxy | GitHub API | `manual` |
| npm Downloads | Installation proxy | npm (approximate) | `manual` |
| Active Issues/Discussions | Engagement proxy | GitHub | `current` |
| Contributor Count | Community investment | GitHub | `current` |
| Activation Rate | % of installers who create first decision | Estimated only | `manual` / `blocked` |
| Time to First Decision | Days from install to first committed decision | Estimated only | `manual` / `blocked` |
| Support Response Time | Median time to first response on issues | Founder estimates | `manual` |
| Retention Rate | % of users active after 30 days | Unknown | `blocked` |

**Ownership Gap:** No analytics infrastructure. No telemetry. Metrics are manually inferred or publicly available proxies. This is an intentional local-first trade-off, but it limits optimization ability.

**Threshold for Change:** If the project moves toward hosted features or paid tiers, revisit telemetry and analytics policy explicitly.
