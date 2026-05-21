# Customer Support

## Support Objective

Help users succeed with LOGOS Engine by removing blockers, answering questions, and turning bug reports into actionable issues—without inventing processes that require more people than exist.

## Support Principles

1. **Public by default.** Support happens in GitHub Issues and Discussions so answers are searchable.
2. **No SLA theater.** We do not promise response times we cannot reliably hit.
3. **Local-first respect.** We do not ask users to upload data. Reproduction steps should use public repos or minimal local examples.
4. **Structure over sympathy.** Every bug report should include version, environment, and reproduction steps. We guide users toward that structure rather than chasing vague reports.
5. **Founder bottleneck acknowledged.** One person handles support. When overloaded, priority goes to launch-critical bugs and active contributors.

## Support Scope

**In scope:**
- Installation and setup questions
- Bug reports and unexpected behavior
- Feature requests and roadmap questions
- Documentation gaps or errors
- CLI usage and profile configuration
- Decision-record workflow guidance

**Out of scope / deferred:**
- Custom development or consulting
- Debugging user repository content (we support the engine, not the project being documented)
- Third-party integrations not explicitly supported
- Urgent production incident response (no hosted service means no production environment to debug)

## Support Channels

| Channel | Purpose | Status | Owner |
|---------|---------|--------|-------|
| GitHub Issues | Bug reports, feature requests, tasks | `current` | Founder |
| GitHub Discussions | Q&A, ideas, community help | `current` | Founder |
| Email / Social DMs | Overflow, private security reports | `manual` | Founder |
| Live chat | N/A | `deferred` | — |
| Phone | N/A | `deferred` | — |

**Constraint:** GitHub is the preferred channel. DMs are discouraged except for security or privacy-sensitive matters.

## Support Intake

All support requests should enter through GitHub Issues or Discussions. Founder may create issues on behalf of users who report via email or social media, with attribution if appropriate.

**Intake steps:**
1. User opens GitHub Issue (bug) or Discussion (question).
2. If missing template data, founder asks for version, OS, Node version, and reproduction steps.
3. Founder labels and categorizes within 7 days.

## Ticketing Model

GitHub Issues serve as the ticket system. No separate ticketing platform.

- **Issue labels** define category and priority.
- **Milestones** map to releases for scheduling.
- **Assignee** is the founder unless delegated to a contributor.
- **State:** Open → In Progress → Closed (completed or not planned).

**Limitation:** No SLA tracking, no automated escalation, no queue depth alerting. Founder monitors manually.

## Ticket Categories

| Label | Meaning | Example |
|-------|---------|---------|
| `bug` | Something is broken | Crash on `logos init` |
| `enhancement` | Feature request | Add new decision template |
| `docs` | Documentation gap | Missing explanation of profiles |
| `question` | Usage clarification | How to structure assumptions? |
| `good first issue` | Suitable for new contributors | Typo fixes, small refactors |
| `decision-needed` | Requires product decision | Breaking change proposal |

## Priority Levels

Priority is set by the founder based on impact and effort, not by a rigid formula.

| Level | Criteria | Target Response | Target Resolution |
|-------|----------|-----------------|-------------------|
| `P0-critical` | Crash, data loss, security vulnerability | ASAP (within 48h if reproducible) | Hotfix release or workaround |
| `P1-high` | Major feature broken, widespread blocker | Within 7 days | Next release or documented workaround |
| `P2-medium` | Partial impact, has workaround | Within 14 days | Backlog or community PR |
| `P3-low` | Cosmetic, nice-to-have, unclear impact | Best effort | Future milestone or close as not planned |

**Assumption:** These are aspirational targets, not guarantees. If the founder is unavailable, targets slip.

## Triage Rules

1. **Check for duplicates.** Close duplicates with a reference link.
2. **Verify reproduction.** If a bug cannot be reproduced with the provided steps, ask for more detail and label `needs-repro`.
3. **Assess scope.** If the issue is about the user’s own project content (not the engine), redirect to Discussions or close with explanation.
4. **Label immediately.** Apply category and priority labels on first read.
5. **Milestone loosely.** Assign to a milestone only if it is likely to be worked in the next 30 days.

## Response Time Targets

| Channel | Target First Response | Fallback If Missed |
|---------|----------------------|--------------------|
| GitHub Issues (P0) | 48 hours | Public update on blockers |
| GitHub Issues (P1) | 7 days | Re-triage and scope reduction |
| GitHub Issues (P2/P3) | 14 days | Label `stale`; close if no activity after 30 days |
| GitHub Discussions | 14 days | None; community may answer |
| Security reports | 48 hours | Public advisory if fix is delayed |

**Note:** Response means acknowledgment or request for more info, not necessarily resolution.

## Resolution Expectations

- **Bugs:** Fixed in a release, closed with a reference to the version.
- **Features:** Closed when implemented, or labeled `not-planned` with rationale.
- **Questions:** Closed when answered, or converted to a docs issue.
- **Stale issues:** Labeled `stale` after 30 days of inactivity; closed after 60 days if no update.

## Escalation Rules

There is no higher tier of support. Escalation options are limited:

1. **Technical escalation:** If a bug is beyond the founder’s current capacity, mark `help wanted` and invite community contribution.
2. **Priority escalation:** If a user believes priority is wrong, they may comment with new evidence. Founder decides.
3. **Behavioral escalation:** Abusive or entitled communication results in issue closure and possible temporary interaction limits.

**Ownership Gap:** No second-level engineering support exists. No on-call rotation. No paid escalation path.

## Bug Reporting Flow

1. **User** opens GitHub Issue using the bug report template (if available) or free-form.
2. **Required info:**
   - LOGOS Engine version (`logos --version`)
   - Node.js version (`node --version`)
   - OS and terminal
   - Steps to reproduce
   - Expected vs. actual behavior
   - Error message or screenshot
3. **Founder** attempts reproduction within 7 days.
4. **If reproduced:** label `confirmed`, assign priority, schedule fix.
5. **If not reproduced:** ask for minimal repro repo or additional context.
6. **Fix:** PR → review → merge → release → close issue with version note.

**Deferred:** Automated regression test for every reported bug (aspirational, not required for MVP).

## Known Issue Handling

Known issues are tracked as open GitHub Issues with label `known-issue`. If a user reports a known issue, reference the original issue and close as duplicate.

If a workaround exists, document it in the issue description or a linked discussion. No separate known-issue page is maintained yet.

## Incident Handoff

Because LOGOS Engine is local-first with no hosted service, "incidents" are limited to:
- Broken releases (install fails, critical bug in latest version)
- Security vulnerabilities in dependencies or the engine itself
- Supply-chain issues (npm compromise, malicious dependency)

**Handoff process:**
1. Founder acknowledges the incident publicly (issue or discussion).
2. Founder assesses severity and decides between hotfix or rollback recommendation.
3. If fix is delayed > 48 hours, founder posts a public advisory with mitigation steps.
4. No separate incident commander. No postmortem required unless founder decides it is useful.

**Deferred:** Formal incident response playbook, status page, automated rollback pipeline.

## Refund and Billing Support

- **Status:** `deferred` / `not applicable`
- LOGOS Engine is currently free and open-source. No payments are accepted.
- No refunds, invoices, or billing disputes exist.
- **Threshold for Change:** First paid tier or sponsorship model triggers creation of billing support docs.

## Privacy and Data Requests

- **Status:** `manual`
- LOGOS Engine does not collect, store, or process user data centrally. All data lives in the user’s local repository.
- There is no account system. There is no database to query.
- If a user asks what data is held about them, the answer is: none by the project; only what GitHub stores for platform interactions (issues, discussions).
- **Assumption:** This remains true as long as the product stays local-first with no telemetry. Revisit if cloud features are introduced.

## Support Macros/Templates

GitHub Issue templates live in `.github/ISSUE_TEMPLATE/`.

**Current templates:**
- Bug report
- Feature request

**Planned:**
- Support question redirector (redirects to Discussions)

**Founder reply templates (informal):**

- **Needs reproduction:** "Thanks for the report. To help us diagnose this, could you provide your Node version, OS, and a minimal set of steps that reproduce the issue?"
- **Duplicate:** "This looks like a duplicate of #XXX. Let’s continue the conversation there."
- **Out of scope:** "This request relates to your specific project content rather than the LOGOS Engine itself. I’d recommend framing it as a general workflow question in Discussions."
- **Fixed:** "Fixed in vX.Y.Z. Please upgrade and let us know if you still see the issue."

## Unsupported Requests

The following are explicitly not supported. Requests will be closed with a polite redirect.

| Request Type | Reason | Redirect To |
|--------------|--------|-------------|
| Custom development | No capacity | Hire external consultant |
| Urgent phone/Zoom support | No staffed channel | GitHub Issues (P0 if truly critical) |
| Legal advice | Not qualified | Independent counsel |
| Data recovery from local repo | Tool does not interact with backups | User’s own version control (Git) |
| Non-English support | Founder capacity | Community Discussions (others may help) |
| Third-party plugin debugging | Not authored by this project | Plugin author |

