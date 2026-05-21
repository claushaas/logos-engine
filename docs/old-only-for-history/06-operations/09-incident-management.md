# Incident Management

## Incident Objective

Respond to problems that materially affect users or the integrity of the project. Because LOGOS Engine is a local-first CLI tool with no hosted infrastructure, "incidents" are primarily: critical defects, security vulnerabilities, and broken releases. This document defines how they are detected, declared, and resolved without operations theater.

## Incident Principles

1. **Fix over process**: A quick patch is better than a perfect incident report.
2. **Local-first impact**: An incident is defined by user impact, not server downtime.
3. **No blame**: Incidents reveal gaps in tests or gates, not personal failure.
4. **Transparent**: Security issues and critical bugs are disclosed via GitHub with clear severity.
5. **Minimal ceremony**: Post-incident reviews are short and actionable.

## Incident Scope

**In scope**:
- Critical bugs in a released version (crash, data loss, incorrect canonical output)
- Security vulnerabilities in dependencies or in the engine itself
- Broken release artifacts (npm publish failure, missing files, bad tag)
- Compromised repository or release pipeline

**Out of scope**:
- User error or misunderstanding (support issue, not incident)
- Minor bugs with workarounds (bug issue, not incident)
- Feature requests (discussion, not incident)
- Individual user environment problems (support issue)

## Incident Definition

An incident is an event that:
1. Affects multiple users or risks user data integrity, **or**
2. Involves an unpatched high or critical security advisory, **or**
3. Renders the latest release unusable for its core purpose.

**Assumption**: Because there is no telemetry, impact is estimated from issue volume and severity reports.

## Incident Taxonomy

| Category | Examples |
|----------|----------|
| **Defect** | Crash during generation, corruption of user documents |
| **Security** | Dependency CVE, token exposure in build artifact |
| **Release** | Broken npm package, failed smoke test after tag |
| **Supply chain** | Compromised dependency, compromised GitHub Actions runner |
| **Local state** | Corrupt `.logos/` state, failed migration, invalid workspace |
| **Command failure** | `/generate` partial failure, `/executive compile` blocked, doctor diagnostic warnings |
| **Provider** | Provider unavailable, misconfigured credential, timeout during intake |

## Severity Levels

| Level | Criteria | Example | Response Target |
|-------|----------|---------|-----------------|
| **sev-1 (critical)** | Data loss, unpatched critical CVE, broken release with no workaround | Engine overwrites user files incorrectly | 24 hours to patch |
| **sev-2 (major)** | Core feature broken, workaround exists | Markdown renderer fails on valid input | 7 days to patch |
| **sev-3 (minor)** | Edge case failure, low user impact | Formatting glitch in diagnostic output | Next scheduled release |
| **sev-4 (informational)** | Near miss or vulnerability in unused dependency path | CVE in dev-only tool with no exploit path | Next dependency update |

**Gap**: Response targets are best-effort. Founder availability is the limiting factor.

## Incident Declaration

Anyone can declare an incident by:
1. Opening a GitHub issue with the `incident` label, **or**
2. The founder applying the label to an existing issue that meets the definition.

No approval is needed to declare. Declaring starts the response clock.

## Incident Roles

| Role | Responsibility | Current Assignment |
|------|---------------|-------------------|
| **Declarer** | Identifies and reports the incident | Anyone (user, contributor, founder) |
| **Responder** | Investigates, patches, and communicates | Founder |
| **Communicator** | Writes updates and release notes | Founder |
| **Reviewer** | Writes post-incident review | Founder |

**Gap**: Single point of failure. If the founder is unavailable, response stalls.

## Detection Sources

| Source | What it detects | Frequency |
|--------|----------------|-----------|
| GitHub Issues | User-reported crashes, defects | continuous |
| GitHub Dependabot | Security advisories in dependencies | continuous |
| `pnpm audit` | Known vulnerabilities | manual / CI |
| CI failure | Release gate failure | per commit / per release |
| `pnpm smoke:cli` | Broken CLI behavior | per release |
| `pnpm security:check` | Secret exposure, telemetry patterns, package safety | per release |
| `pnpm smoke:package` | Release candidate package integrity | per release |
| Manual code review | Security-sensitive changes | per PR |

**Assumption**: No runtime alerting, no error telemetry, no automated intrusion detection.

## Triage and Classification

Upon declaration:

1. Confirm the report is accurate (reproduce if possible).
2. Assign severity using the table above.
3. If sev-1 or sev-2: treat as active incident. Add `incident:active` label.
4. If sev-3 or sev-4: may be handled as a normal bug. Add `incident:tracking` label if context is useful.
5. Link to any related issues or CVEs.

## Response Process

| Step | Action | Owner |
|------|--------|-------|
| 1. Acknowledge | Comment on issue with severity and ETA | Founder |
| 2. Contain | Identify workaround or disable affected feature | Founder |
| 3. Fix | Write patch, run `pnpm test`, run `pnpm smoke:cli` | Founder |
| 4. Verify | Confirm fix resolves the issue locally | Founder |
| 5. Release | Tag patch version, publish, update changelog | Founder |
| 6. Close | Close incident issue with resolution summary | Founder |

## Coordination Rules

- All coordination happens in the GitHub issue thread.
- If a security issue is sensitive before patch (e.g., active exploit), use GitHub Security Advisory workflow or private communication instead of public issue.
- No separate chat channel or on-call rotation exists.

## Mitigation and Containment

| Situation | Containment Action |
|-----------|-------------------|
| Broken latest release | Publish a patch release immediately; advise users to upgrade |
| Critical bug with no immediate fix | Document workaround in issue and README |
| Dependency CVE | Update dependency; if no fix available, document risk and evaluate removal |
| Data-loss bug | Warn users immediately; advise backup before running engine |
| Corrupt `.logos/` state | Advise restore from backup; run `/diagnose` to assess damage |
| Failed migration | Preserve prior state copy; document recovery path in issue |
| Provider unavailable | Advise `/config ai` reconfiguration or no-provider mode |
| Security check failure | Remove exposed secret; rotate token; add regression test |

## Rollback and Pause Rules

| Trigger | Action |
|---------|--------|
| Release introduces critical regression | Publish patch if fix is fast; otherwise, document downgrade instructions (`npm install logos-engine@previous`) |
| CI failing on main for > 24 hours | Pause releases until green |
| Founder unavailable during active sev-1 | Leave clear status in issue; community may fork or pin previous version |

**Assumption**: npm does not unpublish versions except in extreme cases. Downgrade is the primary rollback mechanism for users.

## Communication Rules

1. **Public by default**: Issues and fixes are discussed in public unless there is an active security exploit.
2. **Clear severity**: Every incident update states the current severity.
3. **No speculation**: Communicate what is known, what is being done, and what users should do.
4. **Concise**: Users do not need a narrative. They need impact and action.

## Status Updates

| Severity | Update Frequency |
|----------|-----------------|
| sev-1 | Every 24 hours until resolved, or after each significant change |
| sev-2 | Every 48–72 hours |
| sev-3 / sev-4 | On resolution only |

Updates are posted as comments on the incident issue.

## Customer Communication

- There is no email list, in-app notification, or status page.
- Communication is via GitHub issue comments and GitHub Releases.
- For sev-1, a note may be added to the README temporarily to warn new users.

**Gap**: No direct user notification mechanism beyond what users subscribe to on GitHub.

## Privacy and Security Incidents

**Status**: required, minimal scope

Examples:
- Accidental inclusion of a test token in a release
- Dependency with a critical CVE
- User reports unexpected network call from the engine

Response:
1. Assess if user data was exposed. Because the product is local-first, exposure is limited to the user's own machine.
2. If a secret was leaked in a release: rotate the secret, document in release notes.
3. If a dependency CVE: update or remove dependency; disclose in release notes.
4. If the engine itself has a vulnerability: patch and disclose.

**Assumption**: No user accounts or hosted data means privacy incidents are primarily local or supply-chain in nature.

## Billing and Payment Incidents

**Status**: N/A

No billing system, payment processor, or financial transactions exist. This section is reserved for future commercial offerings.

## Post-Incident Review

**Required for**: sev-1 and sev-2 incidents.
**Optional for**: sev-3 and sev-4.

Template:
- **Incident**: one-line summary
- **Severity**: final severity
- **Timeline**: detection → acknowledgment → fix → release
- **Impact**: who was affected and how
- **Root cause**: the underlying reason
- **What went well**: detection, fix, communication
- **What went poorly**: delays, gaps, confusion
- **Corrective actions**: specific changes with owners

The review is posted as a comment on the incident issue or committed to `docs/incidents/` if it teaches a broader lesson.

## Corrective Actions

Every post-incident review must produce at least one corrective action:
- A test that would have caught the bug
- A release gate adjustment
- A documentation update
- A process change

Actions are filed as GitHub issues and linked to the incident.

## Incident Metrics

See [07-operational-metrics.md](./07-operational-metrics.md) for how incidents are measured.

Summary of tracked metrics:
- Count of incidents by severity per quarter
- Time to acknowledge (first response)
- Time to patch (fix merged and released)
- Post-incident review completion rate
- Corrective action completion rate

**Gap**: Metrics are informal. A dedicated incident log does not yet exist.
