# Operating Model

## Operating Objective

The day-to-day operating model for LOGOS Engine must preserve reliability, supportability, maintainability, accountability, and sustainability within the constraints of a founder-led, local-first, open-source MVP. Because there is no hosted service, operations centers on package integrity, release safety, issue triage, documentation accuracy, security boundary enforcement, and founder capacity management. The operating model should be executable by one person without requiring enterprise tooling, dedicated infrastructure, or a support team.

## Operating Principles

| Principle | Meaning | Trade-off Resolution |
|---|---|---|
| Local-first operations | All operational truth resides in the repository, local reports, and GitHub. No dashboards or telemetry required. | Accept limited observability to preserve privacy boundaries. |
| Async over real-time | Support, incidents, and decisions happen asynchronously. No on-call rotation or live chat. | Accept slower response to protect founder sustainability. |
| Automate safety, not theater | Automate tests, secret scans, and release gates. Do not automate complex workflows before manual workflows are understood. | Prefer manual runbooks over fragile automation for infrequent tasks. |
| Documentation as runbook | Operational knowledge is written down, versioned, and reviewable. No tribal knowledge. | Accept documentation maintenance cost to reduce single-person dependency. |
| Conservative release | Releases are gated, reversible, and communicated. No continuous deployment to a hosted service. | Accept slower release cadence for higher trust per release. |
| Explicit deferral | Processes that cannot be sustainably operated are marked deferred rather than performed poorly. | Accept operational gaps rather than theater. |

## Operating Scope

### Inside the Operating Model

- Day-to-day repository hygiene: issue triage, discussion responses, documentation updates.
- Release workflow: build, verify, publish, announce.
- Local test and verification: deterministic tests, smoke checks, secret scanning.
- Dependency and security maintenance: audit, patch, verify.
- Support workflow: intake, categorize, respond, escalate if needed.
- Knowledge preservation: runbooks, decision records, support notes.

### Shared with Product/Engineering/GTM

- Release readiness: Engineering owns code quality and gates; Operations owns coordination and communication.
- Security fixes: Engineering owns implementation; Operations owns disclosure and release timing.
- Onboarding guidance: Product owns UX truth; Operations owns installation and setup documentation.
- Launch communication: GTM owns messaging; Operations owns release notes and known limitations.

### Outside / Deferred

- Hosted service operation (excluded from MVP).
- Billing and subscription operations (deferred until revenue exists).
- Customer success automation (deferred until telemetry or cohort data exists).
- Enterprise support or SLAs (deferred until team capacity exists).
- Vendor management beyond npm/GitHub/platform dependencies (deferred).

## Ownership Model

See Operations Brief for detailed ownership records. At the operating model level, ownership is centralized and every operational area has a named primary owner, even if backup owners are absent.

| Area | Primary Owner | Backup Owner | Decision Rights | Escalation Owner | Responsibilities | Unresolved Gap | Downstream Document | Status |
|---|---|---|---|---|---|---|---|---|
| Daily repository hygiene | Founder | None | Founder | None | Issue triage, discussion responses, stale issue review | No backup | Support Model | Current |
| Release execution | Founder | None | Founder | None | Build, verify, publish, announce | No backup | Release Management | Current |
| Test and verification | Founder | None | Founder | None | Run deterministic tests, smoke checks, secret scans | No CI automation yet | Maintenance Plan | Current |
| Dependency maintenance | Founder | None | Founder | None | Audit, patch, verify compatibility | No automated CVE alerting configured | Maintenance Plan | Current |
| Support workflow | Founder | None | Founder | None | Intake, categorize, respond, document | No support staff | Support Model | Current |
| Knowledge preservation | Founder | Community (aspirational) | Founder | None | Maintain runbooks, decision records, FAQs | Contributor documentation incomplete | Knowledge Management | Current |
| Incident response | Founder | None | Founder | External contact if available | Declare, mitigate, communicate, review | No security specialist | Incident Response | Current |
| Financial tracking | Founder | None | Founder | Accountant if needed | Track costs, plan future revenue ops | No accounting integration | Financial Operations | Deferred |

## Roles and Responsibilities

| Role | Purpose | Responsibilities | Decision Rights | Recurring Outputs | Interfaces | Backup Role | Escalation Role | Unresolved Gaps | Status |
|---|---|---|---|---|---|---|---|---|---|
| Founder / Maintainer | Own overall operations, product, engineering, and GTM | All operational functions listed above; final decision authority | All operational decisions | Releases, issue responses, documentation updates, decision records | Users (GitHub), contributors (GitHub), npm registry, AI providers | None | External security or legal contact if needed | No redundancy | Current |
| Contributor (aspirational) | Submit code, docs, or profile improvements | PRs, issue reproduction, documentation fixes | None (contributions require review/merge by founder) | PRs, issue comments, documentation edits | Founder via GitHub | None | Founder | No structured onboarding for contributors yet | Deferred |
| User | Install, use, report issues, give feedback | Follow setup docs, report bugs with reproduction, respect boundaries | Product decisions remain founder-owned; users influence via feedback | Issues, discussions, examples | Founder via GitHub | Community self-help | None | None | Current |

## Operating Cadences

| Cadence | Frequency | Purpose | Participants | Inputs | Outputs | Owner | Escalation Condition | Downstream Document | Status |
|---|---|---|---|---|---|---|---|---|---|
| Daily sanity check | Daily (asynchronous) | Scan for critical issues, security alerts, or urgent user reports | Founder | GitHub notifications, security advisories | Mental note or quick response | Founder | Critical security alert or data-loss report | Incident Response | Current |
| Weekly backlog review | Weekly | Triage new issues, update stale items, plan next actions | Founder | Open issues, open discussions | Updated labels, comments, or closures | Founder | >5 new P1/P2 issues in one week | Support Model | Current |
| Monthly health review | Monthly | Review metrics, dependency health, documentation freshness, founder capacity | Founder | Metric scorecard, audit results, commit log | Notes, prioritized actions, Decision Record if needed | Founder | Red founder capacity or critical CVE unpatched >30 days | Risk Management | Current |
| Release cycle | Event-based | Prepare, verify, publish, and announce a release | Founder | Commit log, PRs, test results | Published package, release notes, tag | Founder | Release gate failure | Release Management | Current |
| Quarterly direction check | Quarterly | Review whether operations are sustainable and whether scope should be adjusted | Founder | Backlog trends, support load, personal bandwidth | Decision Record entries, scope adjustments | Founder | Founder capacity consistently Red | Risk Management | Current |
| Incident-triggered review | As needed | Respond to and learn from incidents | Founder | Incident report, user impact | Mitigation, advisory, post-incident notes | Founder | S1 incident | Incident Response | Current |

## Core Operational Functions

| Function | Purpose | Cadence | Trigger | Primary Owner | Backup Owner | Required Tools | Health Signal | Failure Signal | Fallback | Escalation Path | Downstream Document | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Issue triage | Ensure user problems are categorized and acknowledged | Weekly + continuous | New GitHub issue or discussion | Founder | None | GitHub, labels, templates | Issues labeled within 7 days | Unlabeled issues >7 days old | None | N/A | Support Model | Current |
| Release verification | Ensure only passing builds are published | Per release | Commit ready for release | Founder | None | pnpm, Node.js, Vitest, Biome, smoke script | All gates pass | Test failure, secret scan hit | Do not release | N/A | Release Management | Current |
| Dependency audit | Avoid vulnerable or outdated dependencies | Monthly + CVE-triggered | Calendar or security advisory | Founder | None | pnpm audit, npm audit, or equivalent | Zero high/critical CVEs | High/critical CVE found | Pin or patch dependency | N/A | Maintenance Plan | Current |
| Documentation refresh | Keep README, examples, and troubleshooting current | Per release + as needed | Release, user confusion, or stale content | Founder | None | Markdown editor, Git | Docs updated within 30 days of change | User reports of outdated docs | Quick fix or note in release | N/A | Maintenance Plan | Current |
| Support response | Answer questions and route bugs | Async, best-effort | New issue/discussion or follow-up | Founder | None | GitHub, templates, runbooks | Response within aspiration window | No response >14 days on P2 | Community self-help | N/A | Support Model | Current |
| Secret safety check | Prevent token leakage in source or artifacts | Per release + per PR | Build or release preparation | Founder | None | Secret scan, manual inspection | Zero raw tokens found | Token detected in artifact | Remove token, rotate if exposed, advisory | External security contact if available | Incident Response | Current |

## Manual Operations

| Operation | Purpose | Trigger | Steps Reference | Owner | Expected Evidence | Frequency | Error Risk | Fallback | Automation Candidate | Review Cadence | Downstream Document | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Release runbook execution | Publish a verified package release | Release candidate ready | Release Process document | Founder | Published package, GitHub release notes, tag | Event-based | Human error in version or tag | Roll forward with hotfix | Partial: automate test runs, but keep manual approval | Per release | Release Management | Current |
| Dependency audit review | Identify and assess vulnerable dependencies | Monthly or CVE alert | Check `pnpm audit`, evaluate severity, plan patch | Founder | Audit log or notes | Monthly | Missing a transitive vulnerability | Community report or incident response | Yes: automated CVE alerting in CI when implemented | Monthly | Maintenance Plan | Current |
| Issue triage and labeling | Categorize incoming support | New issue/discussion | Read issue, apply label, respond or plan | Founder | Labeled issue, comment | Continuous | Misclassification | Re-label on new information | Partial: issue templates help; full triage requires judgment | Weekly | Support Model | Current |
| Documentation update | Reflect changes in README/examples | Release or user confusion | Edit files, verify accuracy, commit | Founder | Updated Markdown, passing lint | As needed | Outdated screenshot or path | Quick follow-up fix | No: requires human judgment | Monthly | Maintenance Plan | Current |
| Provider compatibility check (optional) | Verify remote provider adapter behavior | Pre-release or adapter change | Configure provider, run synthetic prompt, verify output | Founder | Redacted notes | Optional pre-release | Accidental token exposure in notes | Use fixture tests instead | No: manual by design | Per release if done | Incident Response | Optional |
| Founder capacity check | Prevent operational overload | Weekly self-assessment | Review backlog, calendar, stress level | Founder | Subjective Green/Yellow/Red note | Weekly | Ignored until burnout | Pause non-essential work, communicate delay | No | Weekly | Risk Management | Current |

## Automated Operations

| Automation | Purpose | Tool or System | Trigger | Schedule | Owner | Monitored Signal | Failure Signal | Fallback | Data Touched | Privacy or Security Concern | Review Cadence | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Deterministic test suite | Verify core behavior without live AI | Vitest, fixtures, mocks | PR, merge, or manual `pnpm test` | On commit / manual | Founder | Test pass | Test failure | Debug locally; do not merge/release | Synthetic fixture data only | Fixtures must not contain real tokens | Per release | Current |
| Lint and format checks | Maintain code and Markdown quality | Biome, markdownlint | PR, merge, or manual | On commit / manual | Founder | Clean lint | Lint failure | Fix and re-run | Source files, Markdown | No secrets in source | Per release | Current |
| TypeScript build | Ensure compilation correctness | tsc | PR, merge, or manual | On commit / manual | Founder | Clean build | Build errors | Fix and re-run | Source files | No secrets in source | Per release | Current |
| CLI smoke test | Verify executable starts and basic commands work | `pnpm smoke:cli` | PR affecting CLI, or release prep | Manual | Founder | Smoke passes | Smoke failure | Debug locally | Temp repo, synthetic state | No real provider tokens | Per release | Current |
| Secret scan (if configured) | Detect accidental token commits | git-secrets, GitHub secret scanning, or equivalent | Commit or PR | On commit (if enabled) | Founder | No alerts | Alert fired | Investigate, rotate, remove | Commit diff | Alert may expose secret in notification | Per release | Review-needed |
| Profile contract validation | Ensure Standard profile YAML is valid | Profile loader + Zod schema | PR affecting profiles, or release prep | On commit / manual | Founder | Profile loads cleanly | Validation error | Fix profile or schema | Profile YAML | No sensitive data in profiles | Per release | Current |

## Third-Party Dependencies

| Dependency | Dependency Type | Operational Purpose | Criticality | Owner | Failure Mode | Blast Radius | Monitoring Method | Fallback | Cost or Capacity Concern | Data or Privacy Concern | Exit or Replacement Consideration | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| npm registry | Platform | Package distribution | Critical | Founder | Registry outage, package removal, policy change | Users cannot install or update | npm status page, user reports | Manual install from GitHub source or tarball | Minimal | No user data sent to registry | Could migrate to GitHub Packages or other registry if needed | Current |
| GitHub | Platform | Repository hosting, issues, releases, discussions | Critical | Founder | Outage, account issue, policy change | Cannot collaborate, track issues, or publish releases | GitHub status page, user reports | Local Git mirror; communicate via alternative channels | Minimal for public repo | User issues are public; no private data hosted by LOGOS | Could mirror to GitLab or similar if needed | Current |
| Node.js runtime | Platform | Execution environment | Critical | Founder | Compatibility break, security vulnerability, deprecation | Package fails on affected version | Node release notes, security working group | Document supported range; advise version upgrade | None | None | Deno or Bun are not supported; would require significant rewrite | Current |
| pnpm | Tooling | Package manager, workspace scripts | High | Founder | Bug, compatibility issue with Node | Build/test failure | pnpm release notes, CI/local test | Use npm as fallback locally | None | None | npm is viable fallback | Current |
| Vitest | Tooling | Test runner | High | Founder | Bug, incompatible API change | Test suite failure | Release notes, test run | Pin version; patch or workaround | None | None | Jest or Node test runner could substitute | Current |
| Biome | Tooling | Linting and formatting | Medium | Founder | Bug, rule change causing false positives | Lint failure, formatting drift | Release notes, CI/local run | Pin version; disable problematic rule | None | None | Prettier/ESLint could substitute | Current |
| Ink / React | Library | TUI rendering | High | Founder | Bug, terminal compatibility issue | TUI fails or renders incorrectly | Issue reports, local testing | Patch or pin version | None | None | Alternative TUI libraries exist but would require rewrite | Current |
| Zod | Library | Schema validation | High | Founder | Bug, type inference break | Validation failures, type errors | Release notes, test run | Pin version | None | None | Joi, Valibot could substitute | Current |
| AI provider APIs (OpenAI, Anthropic, etc.) | External service | Optional remote AI features | Medium (optional) | End user / Founder for testing | Outage, rate limit, API change | Provider unavailable; user can switch or use local provider | Provider status pages, user reports | Local provider (Ollama/LM Studio), no-provider mode | Founder pays for manual tests only | User project context leaves machine only with explicit config and disclosure | Switch provider or use local model | Current |

## Standard Workflows

| Workflow | Purpose | Trigger | Inputs | Steps | Owner | Tools | Expected Output | Quality Check | Internal Target or SLA | Escalation Rule | Downstream Handoff | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bug report handling | Turn user-reported bugs into fixes or documented limitations | GitHub issue labeled `bug` | Issue text, reproduction steps, environment info | 1. Acknowledge. 2. Request reproduction if missing. 3. Reproduce locally. 4. Categorize (code, docs, profile). 5. Fix or document. 6. Close with note. | Founder | GitHub, local dev environment | Closed issue or open fix PR | Reproduction confirmed before fix claim | 14 days for P2 bugs | If fix requires scope change, route to Product/Decision Record | Continuous Improvement if pattern; Incident Response if security | Current |
| Feature request handling | Track and prioritize ideas without committing prematurely | GitHub issue/discussion labeled `enhancement` or `idea` | Request text, use case, affected area | 1. Acknowledge. 2. Evaluate against boundaries and scope. 3. Label `deferred`, `accepted`, or `out-of-scope`. 4. If accepted, add to backlog. 5. Close or leave open with label. | Founder | GitHub, labels, Decision Record | Labeled issue with clear disposition | Decision is traceable to a boundary or scope rule | 30 days for categorization | If conflict with scope, route to Decision Record | Continuous Improvement | Current |
| Security report handling | Assess and fix security or privacy issues | Private report or public issue with security label | Report text, affected version, impact assessment | 1. Acknowledge within 24h. 2. Assess severity. 3. Develop fix or mitigation. 4. Prepare advisory if user action needed. 5. Release patch. 6. Publish advisory. 7. Close with reference. | Founder | GitHub, local dev, release process | Patch release + advisory | Fix verified; no regression | 48h for S2, immediate for S1 | If beyond founder expertise, seek external help | Incident Response | Current |
| Release preparation | Produce a verified, safe release | Sufficient changes merged; readiness gates achievable | Commit log, PRs, test results, profile changes | 1. Verify all gates pass. 2. Update version. 3. Update changelog. 4. Run full verification. 5. Build and inspect package. 6. Tag. 7. Publish. 8. Create GitHub release. 9. Announce. | Founder | pnpm, Node.js, Git, GitHub | Published package + release notes | Install smoke passes; no secrets | Per release event | If gate fails, do not release | Release Management | Current |
| Documentation fix | Correct misleading or outdated docs | User report, release change, or monthly review | Outdated file, new behavior, or confusion pattern | 1. Identify affected files. 2. Edit. 3. Run Markdown lint. 4. Preview. 5. Commit. | Founder | Markdown editor, Git, markdownlint | Updated docs | Accurate and lint-free | 7 days for critical doc errors | If docs reflect product bug, route to Engineering | Maintenance Plan | Current |

## Decision Rights

| Decision Category | Decision Examples | Default Owner | Approval Required | Escalation Required | Risk Acceptance Required | Documentation Required | Downstream Document | Status |
|---|---|---|---|---|---|---|---|---|
| Routine release | Patch or minor version release | Founder | No (self-approved) | No | No | Release notes | Release Management | Current |
| Breaking release | Major version or breaking change | Founder | No (self-approved, but requires migration notes) | No | Yes (user disruption risk) | Migration notes + release notes | Release Management | Current |
| Security fix release | Patch for vulnerability | Founder | No (urgent) | External if needed | Yes | Advisory + release notes | Incident Response | Current |
| Scope change | Add or remove product capability | Founder | Yes (Decision Record) | No | Yes | Decision Record entry | Risk Management | Current |
| Support scope change | Expand or limit what is supported | Founder | No | No | No | Update support docs | Support Model | Current |
| Operational process change | Add or remove a recurring process | Founder | No | No | No | Update Operating Model or relevant doc | Operating Model | Current |
| Legal/compliance claim | Make any compliance or regulatory claim | Founder | Yes (external legal review) | Legal counsel | Yes | Compliance review artifact | Risk and Compliance | Deferred / blocked |
| Revenue model change | Introduce pricing, billing, or paid tier | Founder | Yes (Decision Record + validation evidence) | No | Yes | Decision Record + Business Model update | Financial Operations | Deferred |
| Vendor change | Switch critical tooling or platform | Founder | No | No | No | Notes in Knowledge Management | Operating Model | Current |
| Incident declaration | Classify and declare incident severity | Founder | No | No | Yes if accepting residual risk | Incident record | Incident Response | Current |

## Escalation Paths

| Escalation Level | Trigger | Severity | Owner | Backup Owner | Communication Channel | Response Expectation | Decision Required | Customer Communication Required | Downstream Procedure | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 — Normal operation | Standard bugs, questions, docs fixes | Low / Routine | Founder | None | GitHub issues/discussions | Best-effort, async | Fix or defer | No | Support Model | Current |
| L2 — Urgent fix | P2 bug or doc error causing significant confusion | Medium | Founder | None | GitHub issue + direct follow-up if needed | 48h acknowledgment | Fix or workaround | No (issue comment sufficient) | Support Model | Current |
| L3 — Security/privacy incident | Token leak, undisclosed transmission, CVE exploitation | High / Critical | Founder | External security contact if available | Private channel first, then public advisory | 24h acknowledgment | Mitigation + patch + advisory | Yes (advisory via release notes/GitHub) | Incident Response | Current |
| L4 — Founder unavailable | Founder cannot respond for >14 days | Operational | None defined | None defined | Public repository notice if possible | N/A | Pause releases, communicate status | Yes (repository notice) | Risk Management | Unresolved gap |

## Operational Metrics

| Metric | Metric Type | Purpose | Formula or Measurement | Source | Threshold | Cadence | Owner | Decision Implication | Downstream Document | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Release gate pass rate | Quality | Verify release discipline | Passing gates / total release attempts | Release checklist | 100% | Per release | Founder | Block release if <100% | Release Management | Current |
| Open issue age (P1/P2) | Support | Track backlog health | Days since oldest open P1/P2 issue | GitHub Issues | <14 days | Weekly | Founder | Seek help or reduce scope if exceeded | Support Model | Current |
| Test pass rate (default suite) | Quality | Verify deterministic behavior | Passing tests / total tests | Vitest output | 100% | Per commit / release | Founder | Block merge/release if <100% | Maintenance Plan | Current |
| Secret scan findings | Security | Prevent credential exposure | Count of raw token findings | Secret scan / inspection | 0 | Per release | Founder | Block release if >0 | Incident Response | Current |
| High/critical CVE count | Security | Avoid known vulnerabilities | Count from dependency audit | `pnpm audit` or equivalent | 0 | Monthly | Founder | Patch immediately if >0 | Maintenance Plan | Current |
| Documentation freshness | Maintenance | Keep guidance current | Days since last docs update | Git commit log | <30 days | Monthly | Founder | Schedule update if stale | Maintenance Plan | Current |
| Install smoke pass rate | Reliability | Verify package installability | Successful smokes / total attempts | Smoke test | 100% | Per release | Founder | Block release if <100% | Release Management | Current |
| Founder capacity score | Capacity | Prevent operational overload | Subjective Green/Yellow/Red | Self-assessment | Green/Yellow | Weekly | Founder | Reduce scope or pause if Red | Risk Management | Current |
| New issue rate | Support | Measure demand trends | Issues opened per week | GitHub Issues | <10/week | Weekly | Founder | If sustained high, improve docs or limit promotion | Support Model | Current |

## Operating Constraints

| Constraint | Constraint Type | Affected Area | Source | Operational Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| Single founder | Staffing | All | Resource reality | No redundancy, no specialization, limited throughput | Async processes, documented runbooks, explicit deferral | Founder | Current |
| No operational budget | Budget | Tooling, services | Revenue deferred | Cannot purchase premium tools or services | Free/open-source tiers only | Founder | Current |
| Local-first architecture | Technical | Observability, support, success | Product boundary | No runtime telemetry, no usage data, no centralized logs | Rely on voluntary feedback and GitHub signals | Founder | Current |
| No hosted backend | Technical | Deployment, monitoring, incidents | Product boundary | No server metrics, no staging environment, no runtime alerts | Package-level quality gates, local smoke tests | Founder | Current |
| No telemetry by default | Privacy | Metrics, customer success | Privacy principle | Cannot measure activation, retention, or usage automatically | Manual outreach, voluntary surveys, GitHub activity | Founder | Current |
| English-only MVP | Knowledge | Support, docs | Product commitment | Limited accessibility for non-English speakers | Accept limitation; mark for future | Founder | Current |
| No legal/compliance review | Regulatory | Claims, enterprise, contracts | Explicit boundary | Cannot make compliance claims or sign enterprise agreements | Avoid claims; defer legal review | Founder | Current |
| macOS/Linux/WSL target | Platform | Support, testing | Product commitment | No native Windows support | Document WSL path; accept limitation | Founder | Current |
| Minimal CI (if any) | Process | Verification | Resource reality | Dependent on local verification | Local preflight discipline; add CI when feasible | Founder | Current |

## Operating Model Risks

| Risk | Risk Type | Source | Affected Area | Likelihood | Impact | Early Signal | Mitigation | Contingency | Owner | Downstream Document | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Founder overload from manual processes | Team/Capacity | Single owner, many manual workflows | All operations | High | Critical | Capacity score Red, missed response targets | Limit scope, automate tests, async support | Pause promotion; reduce release cadence | Founder | Risk Management | Current |
| Automation gap in release verification | Process | Limited CI, manual smoke checks | Release quality | Medium | High | Release gate variance between runs | Document exact local preflight steps | Add CI when feasible | Founder | Release Management | Current |
| No backup owner for any function | Team/Capacity | Single founder | All operations | Certain | High | Founder unavailable for >14 days | Document runbooks thoroughly | Public status notice; community triage | Founder | Risk Management | Current |
| Dependency drift between audits | Process | Monthly cadence may miss urgent CVEs | Security | Medium | High | CVE published between audits | Monitor advisory feeds; check on release | Emergency patch release | Founder | Maintenance Plan | Current |
| Support expectations exceed capacity | Process | Aspirational response targets | User trust | Medium | High | Backlog >20 P1/P2, repeated complaints | Improve self-service docs; limit channels | Reduce response aspirations publicly | Founder | Support Model | Current |
| Knowledge loss if founder stops | Knowledge | All operational knowledge is founder-held | Continuity | Medium | Critical | Missing runbooks, undocumented decisions | Write down everything in repo | Archive state for potential handoff | Founder | Knowledge Management | Current |
| Third-party platform lock-in (npm/GitHub) | Vendor | No alternative distribution | Availability | Low | Medium | Platform outage or policy change | Maintain local Git mirror; document alternatives | Migrate to alternative registry/platform | Founder | Risk Management | Current |
| Token leak during manual testing | Security | Manual provider checks | Privacy/Trust | Low | Critical | Secret scan hit | Use fixture providers; redact all outputs | Rotate tokens; publish advisory | Founder | Incident Response | Current |
| Profile marketplace deferred indefinitely | Process | No resources to build ecosystem | Growth | Medium | Medium | No new profiles after launch | Keep profile system extensible | Re-evaluate after core engine proven | Founder | Risk Management | Deferred |

## Downstream Handoff

| Handoff Target | Context to Preserve | Required Action | Owner | Timing | Unresolved Question | Risk or Constraint | Status |
|---|---|---|---|---|---|---|---|
| Customer Success | No telemetry, local-first, manual onboarding | Define onboarding, activation, and retention without usage data | Founder | Before public launch | How to measure activation manually | Privacy constraint | Current |
| Support Model | Async support, GitHub-only, aspirational targets | Define intake, triage, macros, and escalation concretely | Founder | Before public launch | Whether targets are sustainable | Founder capacity | Current |
| Maintenance Plan | Dependency audit, docs freshness, token checks | Define exact recurring tasks and schedules | Founder | Before public launch | Whether monthly cadence holds | Founder capacity | Current |
| Release Management | Semver, gates, smoke checks, rollback via hotfix | Define step-by-step release runbook | Founder | Before next release | Whether CI will exist | Resource constraint | Current |
| Incident Response | Severity classes, S1/S2 triggers, no hosted service | Define incident declaration, response, and review steps | Founder | Before public launch | Whether security incidents can be handled alone | No security specialist | Current |
| Data and Privacy Operations | Local-first, no telemetry, token safety | Define privacy incident handling | Founder | Before public launch | Future telemetry governance | Privacy principle | Current |
| Financial Operations | No revenue, no billing, minimal costs | Define cost tracking and future revenue placeholder | Founder | Deferred until revenue | When to monetize | Validation required | Deferred |
| Risk Management | Operational risk register, accepted risks | Consolidate and review risks regularly | Founder | Before public launch | Whether risk review cadence is sustainable | Founder capacity | Current |
