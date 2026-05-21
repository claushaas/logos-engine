# Reporting and Cadence

## Reporting Objective

Establish a sustainable rhythm for operating LOGOS Engine as a founder-led open-source project. Reports exist only to drive decisions and surface blockers. If a report does not change behavior, it is eliminated.

## Reporting Principles

1. **Local first**: Reports live in the repo or in local notes, not in cloud dashboards.
2. **No operations theater**: If there is nothing to report, the report is skipped.
3. **Action over aesthetics**: A plaintext list of blockers is better than a polished chart with no owner.
4. **Founder bandwidth is the constraint**: Cadences are designed to fit irregular availability.
5. **Git as source of truth**: Release status, issue backlog, and code health are all visible in GitHub.

## Cadence Taxonomy

| Cadence | Purpose | Owner |
|---------|---------|-------|
| Daily | Sanity checks: CI, critical issues | Founder |
| Weekly | Backlog hygiene, dependency alerts | Founder |
| Monthly | Health scorecard, metric review | Founder |
| Quarterly | Direction review, documentation audit | Founder |
| Per-release | Release gates, changelog, communication | Founder |
| Per-incident | Post-incident review | Founder |

## Report Inventory

| Report | Cadence | Status | Location |
|--------|---------|--------|----------|
| Daily sanity check | daily | current | mental / GitHub mobile |
| Weekly backlog review | weekly | current | GitHub Issues/Projects |
| Monthly health scorecard | monthly | current | `docs/` or private notes |
| Quarterly direction review | quarterly | current | `docs/` or private notes |
| Release notes | per release | current | GitHub Releases + `CHANGELOG.md` |
| Post-incident review | per incident | required | `docs/` or GitHub issue |
| Financial review | monthly | deferred | — |
| Customer success review | monthly | deferred | — |

## Daily Checks

**Status**: current, informal

**Time budget**: 5 minutes.

**Checklist**:
- [ ] CI status on `main` is green.
- [ ] No new `severity:critical` issues in the last 24 hours.
- [ ] No unpatched high-severity security advisories.
- [ ] No urgent direct messages or mentions requiring response.

**Outcome**: If any item fails, it becomes the priority for the next available work block.

**Gap**: No automated notification system. Founder checks manually.

## Weekly Review

**Status**: current, informal

**Time budget**: 30 minutes.

**Agenda**:
1. Review open issues and discussions. Label anything unlabeled.
2. Check `pnpm audit` for new advisories.
3. Review open PRs. Merge, request changes, or close stale ones.
4. Confirm no releases are blocked.
5. Note top 1–3 priorities for the coming week.

**Outcome**: A short list of priorities for the week.

**Assumption**: If the founder has no time in a given week, the review is deferred, not replaced with a status report.

## Monthly Review

**Status**: current, manual

**Time budget**: 1–2 hours.

**Agenda**:
1. Compile health scorecard (see [07-operational-metrics.md](./07-operational-metrics.md)).
2. Count downloads, new stars, new issues, new discussions.
3. Review deferred feature requests. Promote or decline any that have aged.
4. Assess founder capacity. Adjust roadmap if needed.
5. Update `docs/` if any operational reality has drifted from documentation.

**Outcome**: Updated understanding of project health and adjusted priorities.

**Gap**: No automated data collection. Metrics are gathered manually from GitHub and npm.

## Quarterly Review

**Status**: current, manual

**Time budget**: 2–4 hours.

**Agenda**:
1. Re-read the engineering brief and product direction.
2. Decide what stays in scope for the next quarter.
3. Identify processes or metrics that are not adding value and should be cut.
4. Review documentation for accuracy.
5. Decide if any deferred processes (billing, hosted features, etc.) should move to "required."

**Outcome**: A lightweight written decision record, possibly committed to `docs/decisions/`.

## Launch-Window Cadence

**Status**: review-needed

If a significant release or public announcement is planned, a temporary cadence applies for the 2 weeks before and 1 week after:

- Daily: check issues more frequently.
- Every 2 days: review new discussions.
- Before launch: confirm all release gates pass.
- After launch: monitor for critical bugs for 72 hours.

**Assumption**: This cadence is applied only when a launch is actively planned. There is no fixed launch calendar yet.

## Release Review Cadence

**Status**: current

Every release triggers a short review:

1. Confirm release gates passed.
2. Confirm changelog is accurate.
3. After 7 days, check for new issues attributed to the release.
4. If issues exist, decide on patch release or documentation fix.

## Incident Review Cadence

**Status**: required, but rare

After any incident (security advisory, critical bug, broken release):

1. Within 24 hours: mitigate or patch.
2. Within 7 days: write a brief post-incident review covering:
   - What happened
   - How it was detected
   - How it was resolved
   - What should change to prevent recurrence
3. File any resulting work as GitHub issues.

**Gap**: No formal incident tracker. Reviews live in GitHub issues or `docs/`.

## Support Review Cadence

**Status**: manual

Weekly, review:
- Unresponded issues and discussions
- Common questions that might need FAQ or documentation updates
- Bugs that might need prioritization

**Outcome**: Documentation improvements or bug priority adjustments.

## Customer Success Review Cadence

**Status**: deferred

Traditional customer success review is not applicable without accounts, telemetry, or a hosted product.

**Review-needed**: Define a lightweight proxy for "are users succeeding?" such as:
- Ratio of issues to stars
- Qualitative feedback in discussions
- Community contributions

## Financial Review Cadence

**Status**: deferred

No revenue, no meaningful expenses. A financial review will be established only after:
- Paid offerings exist, or
- Significant costs (hosting, tooling, contractors) are introduced

## Data and Privacy Review Cadence

**Status**: manual, minimal

Quarterly, confirm:
- No telemetry has been introduced accidentally.
- No user data leaves the local machine in unexpected ways.
- Dependencies have not introduced network calls not accounted for in their documentation.

**Outcome**: Brief note in quarterly review or a decision record if changes are needed.

## Risk Review Cadence

**Status**: manual

Quarterly, review:
- Dependency risk (single-maintainer deps, deprecated packages)
- Founder bus factor
- License compatibility of dependencies
- Security posture (secrets, token handling)

**Outcome**: Issues filed or documentation updated.

## Process Review Cadence

**Status**: manual

Quarterly, ask:
- Is each process in [06-business-processes.md](./06-business-processes.md) still useful?
- Is the cadence of any report too heavy or too light?
- Are there processes that should be automated?

**Outcome**: Updates to operational documentation.

## Metrics Dashboard

**Status**: deferred

There is no dashboard. All metrics are fetched manually from:
- GitHub Issues / Discussions / Releases
- `pnpm audit`, `pnpm outdated`
- npm registry download counts
- Local test output

**Assumption**: A dashboard is not worth the maintenance cost at this stage.

## Decision Meetings

**Status**: N/A

There are no recurring meetings. Decisions are made:
- Asynchronously via GitHub issues and discussions
- In the founder's own notes
- Through decision records committed to `docs/decisions/`

**Assumption**: If additional maintainers join, a lightweight async decision process (e.g., RFC issues) will be established.
