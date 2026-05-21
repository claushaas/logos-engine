# Knowledge Management

## Knowledge Objective

Ensure that project knowledge—decisions, processes, risks, and operational context—is findable, versioned, and owned. Minimize bus factor and reduce repeated explanations by keeping canonical sources in the repository.

## Knowledge Principles

1. **Git is the source of truth.** Documentation lives in the repository, not in siloed wikis or private notebooks.
2. **Structure over presentation.** Content is organized by domain and maturity, not by output format.
3. **Explicit over assumed.** Gaps, outdated sections, and deferred work are labeled explicitly.
4. **Minimal viable documentation.** Write what is needed to onboard a contributor or make a decision; omit operations theater.

## Knowledge Scope

- In-scope: Canonical docs under `docs/`, ADRs, runbooks, support knowledge, risk knowledge, engineering context.
- Out-of-scope: Transient chat logs, uncommitted local notes, private founder journals.
- Boundary: Knowledge that must survive team turnover belongs in the repo; ephemeral coordination belongs in GitHub Issues / Discussions.

## Knowledge Taxonomy

| Category | Location | Maturity | Owner |
|---|---|---|---|
| Product foundation | `docs/01-foundation/` | draft | Founder |
| Validation | `docs/02-validation/` | draft | Founder |
| Product specification | `docs/03-product/` | draft | Founder |
| Engineering | `docs/04-engineering/` | draft | Founder |
| Go-to-market | `docs/05-go-to-market/` | draft | Founder |
| Operations | `docs/06-operations/` | draft | Founder |
| Raw / working notes | `docs/raw/` | unstable | Founder |
| Old / superseded | `docs/old/` | archived | Founder |

## Canonical Sources

| Topic | Canonical Source | Status |
|---|---|---|
| Product vision and principles | `docs/01-foundation/` | current |
| Architecture and tech decisions | `docs/04-engineering/` | current |
| Risk and compliance | `docs/06-operations/10-risk-and-compliance.md` | current |
| Financial operations | `docs/06-operations/11-financial-operations.md` | current |
| Operational risks | `docs/06-operations/14-operational-risks.md` | current |
| API / behavior contracts | Source code + inline types (TypeScript) | current |
| UI behavior | Ink component source + tests | current |

## Documentation Sources

- **Repository docs:** Authoritative for strategy, architecture, and operations.
- **Code + tests:** Authoritative for runtime behavior.
- **README:** Authoritative for quick-start and high-level project description.
- **GitHub Issues / Discussions:** Authoritative for bug reproductions, feature requests, and community support threads.
- **Changelog / release notes:** Authoritative for release contents; generated from Git history and PR descriptions.

## Source of Truth Rules

1. If a document contradicts the code, the code wins until the document is updated.
2. If two documents contradict, the deeper path (more specific domain) wins.
3. If a document is marked `draft` or `review-needed`, it is not authoritative.
4. All changes to canonical docs should ideally be paired with a Git commit referencing the rationale.

## Runbooks

| Runbook | Exists | Location | Status |
|---|---|---|---|
| Local development setup | Partial | `README.md` + `CONTRIBUTING.md` | current |
| Release process | No | — | deferred |
| Incident response | No | — | deferred (local-first tool has no hosted infra to fail) |
| Dependency update | No | — | manual, review-needed |
| Security response | No | — | deferred |

## Decision Records

- Architecture and significant product decisions should be recorded as lightweight ADRs in `docs/04-engineering/` or an equivalent `docs/decisions/` directory.
- **Gap:** No formal ADR template or index exists yet. (Status: review-needed.)
- **Question:** Should ADRs be required for all architectural changes, or only for irreversible decisions? (Status: unresolved.)

## Support Knowledge Base

- **Primary channel:** GitHub Issues and Discussions.
- **Current approach:** Common questions are answered in Issues; recurring themes may be promoted to `docs/` or FAQ entries.
- **Gap:** No curated FAQ or support portal exists. (Status: manual.)
- **Future:** If support volume grows, a dedicated knowledge-base page or GitHub Discussions category structure should be introduced.

## Internal Notes

- Founder may maintain transient working notes in `docs/raw/`.
- `docs/raw/` is explicitly unstable and not canonical.
- **Rule:** Notes that become decisions or processes must be promoted to canonical docs and removed from `docs/raw/`.

## Customer-Facing Documentation

- **README.md:** Quick start, installation, basic usage.
- **`docs/03-product/`:** User-facing product documentation (concepts, workflows, CLI commands).
- **`examples/`:** Working examples of LOGOS Engine usage in repositories.
- **Status:** Incomplete. CLI command reference and tutorial content are needed before public launch.

## Incident Knowledge

- **Current posture:** Because LOGOS Engine is local-first with no hosted backend, traditional infrastructure incidents do not apply.
- Incident-like events are limited to:
  - Bug reports affecting user workflows.
  - Security vulnerabilities in dependencies.
- **Gap:** No formal incident classification or post-mortem template exists. (Status: deferred.)

## Process Knowledge

- Engineering process is described in `docs/04-engineering/` and enforced via code (tests, linting, TypeScript strictness) rather than ceremony.
- **Question:** Should a lightweight contributor workflow diagram be added to `CONTRIBUTING.md`? (Status: review-needed.)

## Financial Knowledge

- Documented in `docs/06-operations/11-financial-operations.md`.
- **Status:** Minimal, because there is no revenue and negligible cost.

## Privacy and Compliance Knowledge

- Documented in `docs/06-operations/10-risk-and-compliance.md`.
- Privacy posture is also embedded in architecture (no telemetry, no accounts, local-first).

## Risk Knowledge

- Operational risks: `docs/06-operations/14-operational-risks.md`.
- Accepted risks and compliance gaps: `docs/06-operations/10-risk-and-compliance.md`.
- Historical risk register items (overengineering, AI dependency, weak onboarding) are reflected in current risk taxonomy and mitigation plans.

## Documentation Ownership

| Domain | Owner | Backup | Condition for Transfer |
|---|---|---|---|
| All canonical docs | Founder | — | On first core hire or funding |
| Engineering docs | Founder | — | On first engineering hire |
| Product docs | Founder | — | On first product/design hire |
| Community / support docs | Founder | — | On first community hire |

**Risk:** Single owner for all knowledge. Mitigation: public repository, clear structure, and explicit labeling of gaps.

## Review Cadence

- **Ad hoc:** Docs are updated when decisions change or gaps are discovered.
- **Trigger-based:** Any architectural change, feature launch, or incident requires a documentation audit of affected sections.
- **Target cadence (post-launch):** Quarterly documentation review to remove stale content, promote `docs/raw/` notes, and validate canonical sources.
