# Business Processes

## Process Objective

Define how LOGOS Engine is operated as a founder-led, open-source MVP. This document inventories every business process, assigns ownership where possible, and marks gaps explicitly. Nothing here implies operational maturity the project does not have.

## Process Taxonomy

| Category | Description |
|----------|-------------|
| **User-facing** | Onboarding, support, feature requests, bug triage |
| **Release** | Versioning, communication, gating |
| **Financial** | Billing, payments, refunds—currently nonexistent |
| **Compliance** | Data export, deletion—currently minimal scope |
| **Vendor** | External dependencies and tools |
| **Internal** | Decision-making, prioritization, review |

## Process Inventory

| Process | Status | Owner | Trigger | Notes |
|---------|--------|-------|---------|-------|
| User Onboarding | **current** | Founder | User installs package | CLI-first, self-service |
| Bug Triage | **current** | Founder | GitHub issue opened | Ad hoc, time-constrained |
| Feature Request | **current** | Founder | GitHub discussion/issue | No committed roadmap yet |
| Release Communication | **current** | Founder | Tag pushed | GitHub Releases + changelog |
| Billing | **deferred** | — | — | No revenue model yet |
| Payment Failure | **deferred** | — | — | No payments accepted |
| Cancellation | **deferred** | — | — | No subscriptions |
| Refund | **deferred** | — | — | No paid offerings |
| Vendor Management | **manual** | Founder | Dependency alert | Ad hoc review |
| Data Export and Deletion | **manual** | Founder | User request | Local-first; user owns data |

## Process Prioritization

1. **Launch-critical**: Bug Triage, Release Communication, User Onboarding
2. **Post-launch**: Feature Request Process, Vendor Management
3. **Deferred until revenue**: Billing, Payment Failure, Cancellation, Refund
4. **Downstream-owned**: None yet; all processes are founder-owned

## Process Ownership

- All current processes are owned by the founder.
- **Assumption**: As the project grows, ownership may move to maintainers. No maintainer structure exists yet.
- **Gap**: No secondary owner for any process. If the founder is unavailable, processes stall.

## Process Trigger Model

| Trigger Type | Examples |
|--------------|----------|
| **User-initiated** | Install, open issue, open discussion, request data export |
| **System-initiated** | CI failure, dependency audit alert, scheduled release |
| **External** | Security advisory for a dependency |

## Standard Process Format

Each process below follows this structure when applicable:

1. **Objective** — what this process achieves
2. **Trigger** — how it starts
3. **Steps** — ordered actions
4. **Owner** — who is responsible
5. **Outcome** — what success looks like
6. **Exceptions** — what can go wrong and how it is handled
7. **Status** — current, required, deferred, blocked

## User Onboarding Process

**Status**: current, manual, launch-critical

**Objective**: Help a new user install LOGOS Engine and generate their first document.

**Trigger**: User discovers the project (npm, GitHub, word-of-mouth).

**Steps**:
1. User runs `npm install -g logos-engine` or `npx logos-engine`.
2. CLI displays help and a quick-start hint.
3. User runs `logos init` or `logos generate` in a repository.
4. Engine creates the default `logos/` directory and initial decision record.
5. User inspects generated Markdown.

**Owner**: Founder (product); user (self-service).

**Outcome**: User has a working install and a generated document.

**Exceptions**:
- Install fails due to Node.js version: CLI should warn on `<22`. **Review-needed**: validate pre-flight check.
- Generation fails due to malformed input: error surfaces with diagnostic severity. User opens GitHub issue.

## Billing Process

**Status**: deferred

**Objective**: Collect payment for commercial features or support.

**Trigger**: User selects a paid tier.

**Steps**: Not defined.

**Owner**: —

**Outcome**: —

**Exceptions**: —

**Assumption**: A revenue model may be introduced post-MVP. Until then, this process is intentionally absent.

## Payment Failure Process

**Status**: deferred

**Objective**: Recover from failed payments.

**Trigger**: Payment processor reports failure.

**Steps**: Not defined.

**Owner**: —

**Assumption**: No payment infrastructure exists. This process will be defined only after billing is implemented.

## Cancellation Process

**Status**: deferred

**Objective**: Allow users to cancel a subscription or paid plan.

**Trigger**: User requests cancellation.

**Steps**: Not defined.

**Owner**: —

**Assumption**: No subscriptions exist. Cancellation is irrelevant for the open-source MVP.

## Refund Process

**Status**: deferred

**Objective**: Process refunds for paid offerings.

**Trigger**: User requests refund or payment failure occurs.

**Steps**: Not defined.

**Owner**: —

**Assumption**: No paid offerings exist.

## Feature Request Process

**Status**: current, manual

**Objective**: Capture, classify, and prioritize feature requests from users and contributors.

**Trigger**: GitHub Discussion opened, GitHub Issue opened with `enhancement` label, or informal feedback.

**Steps**:
1. Request is logged in GitHub Discussions (preferred) or Issues.
2. Founder reviews weekly. Requests are tagged:
   - `idea` — no commitment
   - `accepted` — aligned with direction, may be implemented
   - `deferred` — valid but not in the next 90 days
   - `declined` — out of scope
3. Accepted requests are added to a lightweight backlog (GitHub Projects or markdown list).
4. If implemented, the request is closed with a reference to the release.

**Owner**: Founder.

**Outcome**: Every request gets a response label within one week (target, not guarantee).

**Gap**: No committed SLA. Response time depends on founder availability.

## Bug Triage Process

**Status**: current, manual, launch-critical

**Objective**: Reproduce, classify, and route bug reports efficiently.

**Trigger**: GitHub Issue opened with `bug` label or user reports error.

**Steps**:
1. User fills out issue template (if used) or free-form report.
2. Founder attempts reproduction with the reported Node.js version and OS.
3. Issue is labeled:
   - `confirmed` — reproduced
   - `needs-info` — insufficient detail
   - `wontfix` — expected behavior or out of scope
   - `duplicate` — linked to existing issue
4. Confirmed bugs are prioritized by severity:
   - `severity:critical` — crash or data loss
   - `severity:major` — broken core feature
   - `severity:minor` — cosmetic or edge case
5. Fix is committed, tested (`pnpm test`), and released in next semver-appropriate version.

**Owner**: Founder.

**Outcome**: Critical bugs addressed as soon as possible; others queued.

**Exceptions**:
- Cannot reproduce: issue stays `needs-info` for 14 days, then closed with a note.
- Critical bug in released version: emergency patch release.

## Release Communication Process

**Status**: current, semi-automated, launch-critical

**Objective**: Inform users of new releases clearly and accurately.

**Trigger**: Git tag `vX.Y.Z` is pushed and GitHub Release is drafted.

**Steps**:
1. Run release gates: `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli`.
2. Update `CHANGELOG.md` with changes since last tag.
3. Push tag. GitHub Actions builds artifacts.
4. Publish GitHub Release with:
   - Summary of changes
   - Migration notes if breaking
   - Link to full changelog
5. Optional: post to relevant community channels (GitHub Discussions, personal network).

**Owner**: Founder.

**Outcome**: Users can discover release notes and upgrade with confidence.

**Assumption**: No newsletter, no in-app update notification. Users rely on npm/GitHub.

## Vendor Management Process

**Status**: manual, ad hoc

**Objective**: Manage risks from external dependencies and tools.

**Trigger**: Dependabot alert, manual audit, or license concern.

**Steps**:
1. Review alert or concern.
2. Assess impact: does the dependency touch user data, network, or build output?
3. If high impact: update dependency and run full test suite.
4. If low impact: batch with next routine update.
5. Document exceptions in `docs/` or issue comments if unusual.

**Owner**: Founder.

**Outcome**: Dependency tree stays current enough to avoid known vulnerabilities.

**Gap**: No automated SCA beyond `pnpm audit`. No vendor contracts (all open-source deps).

## Data Export and Deletion Process

**Status**: manual, minimal scope

**Objective**: Respond to user requests for data export or deletion.

**Trigger**: User contacts via GitHub issue or discussion.

**Steps**:
1. Confirm request. Because LOGOS Engine is **local-first**, all user data resides in the user's repository under the `logos/` directory.
2. Advise user that they already own and control all data.
3. For export: user can copy `logos/` directory. No special format needed—it's canonical Markdown.
4. For deletion: user deletes `logos/` directory. Engine does not retain copies.
5. If the user has posted content in GitHub Issues/Discussions, that data is governed by GitHub's policies, not this process.

**Owner**: Founder.

**Outcome**: User understands they control their data.

**Assumption**: No hosted backend means no server-side data to export or delete.

## Process Controls

| Control | Status | Notes |
|---------|--------|-------|
| All changes go through Git | current | Enforced by workflow |
| Release gates run before publish | current | `pnpm check`, `pnpm typecheck`, `pnpm smoke:cli` |
| No raw tokens in repo | current | Verified by tests and review |
| No telemetry in default tests | current | Enforced by test configuration |
| Billing controls | deferred | No billing system |
| Access controls for production | N/A | No hosted production environment |

## Process Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Bug response time (first label) | < 7 days | tracked informally |
| Feature request response time | < 14 days | tracked informally |
| Release cadence | as needed | ad hoc |
| Dependency audit frequency | monthly | ad hoc |
| Onboarding drop-off | unknown | **review-needed**: no instrumentation |

**Gap**: No systematic metric collection. All targets are aspirations, not guarantees.
