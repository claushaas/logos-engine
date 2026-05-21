# Risk and Compliance

## Risk and Compliance Objective

Maintain a transparent, proportionate view of legal, regulatory, privacy, and security obligations for the LOGOS Engine MVP. Ensure no compliance claims are made before they are validated, and ensure risk acceptance is deliberate and documented.

## Compliance Disclaimer

**No compliance claims are currently made.** LOGOS Engine has not undergone legal review, third-party audit, or formal compliance assessment. No assertions of GDPR compliance, SOC 2 alignment, ISO 27001 conformance, or similar are stated or implied. Any compliance claims require legal review and evidence before publication.

## Risk and Compliance Scope

- In-scope: Open-source MVP distributed as source code and CLI; local-first data handling; privacy posture; security surface area of the local tool; dependency licensing.
- Out-of-scope: Hosted backend operations (none exists), enterprise contractual guarantees, SLAs, uptime commitments, financial regulatory compliance.
- Boundary: All data stays on the user's filesystem. The project does not operate infrastructure that processes user data.

## Risk Taxonomy

| Category | Description | Status |
|---|---|---|
| Legal / Regulatory | Licensing, copyright, patent, export control | current, review-needed |
| Privacy | Data collection, user consent, data residency | current |
| Security | Supply chain, dependency vulnerabilities, local secrets handling | current |
| Financial | Revenue recognition, tax, payment compliance | deferred (no revenue) |
| Operational | Process gaps, single points of failure | current |

## Obligation Inventory

| Obligation | Source | Owner | Evidence | Status |
|---|---|---|---|---|
| Open-source license compliance (MIT) | `LICENSE` file | Founder | Repository | current |
| Dependency license compliance | `package.json`, `pnpm-lock.yaml` | Founder | Lockfile + `pnpm licenses list` | manual, review-needed |
| No telemetry without consent | Privacy principle | Founder | Code review | current |
| No surprise data collection | Privacy principle | Founder | Architecture review | current |

**Unowned / deferred:**
- Trademark policy: no registered trademark; policy deferred.
- Contributor License Agreement (CLA): not required for MIT; deferred pending contributor volume.

## Legal and Regulatory Requirements

- LOGOS Engine is released under the MIT License.
- Users are responsible for compliance with their own local regulations when using the tool.
- No legal entity has reviewed this software for fitness for purpose or regulatory alignment.
- **Assumption:** MIT license terms are sufficient for MVP distribution.
- **Gap:** No formal terms of service or end-user license agreement exists beyond the repository LICENSE.

## Privacy Requirements

- **No telemetry by default.** The application must not transmit usage data, crash reports, or analytics without explicit user opt-in.
- **No accounts or identity collection.** The tool does not require user registration.
- All project data (decisions, assumptions, risks, generated docs) is stored in the user's repository under the configurable `logos/` directory.
- **Assumption:** Because data never leaves the local filesystem, standard data-residency obligations are user-managed, not project-managed.
- **Question:** Should an explicit privacy statement be published in the repository even for a local-first tool? (Status: review-needed.)

## Data Protection Requirements

- No centralized database or hosted storage. Data protection is achieved through architecture (local-first, filesystem-only).
- Users control their own backup, encryption-at-rest, and access policies via their operating system and Git configuration.
- The tool does not handle personally identifiable information (PII) by design, except what a user may choose to include in their own project documentation.
- **Gap:** No data-breach response plan exists because there is no central data store. Incident response for a future hosted offering is deferred.

## Security Compliance Interface

| Area | Status | Notes |
|---|---|---|
| Dependency scanning | manual | Run `pnpm audit` and `npm audit` ad hoc; not automated in CI yet. |
| Secrets in code | manual | Review via PR; no secrets detection in CI yet. |
| Local secrets handling | current | Tool does not request API keys by default; AI layer is optional. |
| Vulnerability disclosure policy | deferred | No security.md process defined yet beyond repository contact. |
| Signed releases | deferred | No GPG-signed tags or checksums published yet. |

## Financial Compliance Interface

- **Deferred entirely.** LOGOS Engine has no revenue, no billing system, no payment processor, and no financial operations.
- If a commercial tier is introduced, financial compliance (tax, revenue recognition, refund policies) must be designed and legally reviewed.

## Terms and Policies

| Document | Exists | Location | Status |
|---|---|---|---|
| LICENSE (MIT) | Yes | Repository root | current |
| CODE_OF_CONDUCT.md | Yes | Repository root | current |
| CONTRIBUTING.md | Yes | Repository root | current |
| SECURITY.md | Yes | Repository root | current (placeholder-level) |
| Privacy Policy | No | — | deferred |
| Terms of Service | No | — | deferred |
| Acceptable Use Policy | No | — | deferred |

## Vendor Compliance

- **No vendor agreements requiring compliance attestation.** Dependencies are open-source npm packages under their own licenses.
- **Question:** Should a Software Bill of Materials (SBOM) be generated for releases? (Status: deferred.)

## Contractual Obligations

- No customer contracts, enterprise agreements, or SLAs exist.
- Support is provided via GitHub Issues and Discussions on a best-effort basis.
- **Assumption:** Lack of formal contracts limits downstream liability for the MVP phase.

## Audit Trail

- All changes are tracked in Git.
- Compliance-relevant decisions (architecture, privacy, security) should be captured in Architecture Decision Records (ADRs) within the repository.
- **Gap:** No structured audit-log format exists beyond Git history and informal decision notes.

## Governance Rules

- Founder holds final decision authority on risk acceptance and compliance posture.
- All compliance claims must be reviewed by qualified legal counsel before publication.
- No team member may unilaterally assert compliance, security certification, or privacy guarantee.

## Exception Handling

- Exceptions to the no-telemetry and local-first principles require explicit founder approval and documentation.
- Any introduction of hosted services, accounts, or data collection is treated as a major architectural change requiring privacy and security review.

## Accepted Risks

| Risk | Rationale | Owner | Review Date |
|---|---|---|---|
| No formal legal review | Founder-led MVP; limited budget | Founder | Before any revenue or compliance claim |
| No automated dependency audit in CI | Limited CI capacity; manual checks suffice for now | Founder | Post-launch |
| No vulnerability disclosure process | Small surface area; contact via GitHub | Founder | Before v1.0 stable |
| No signed releases | Distribution via npm and GitHub; trust chain via npm | Founder | Before v1.0 stable |
| Single founder as compliance owner | Team capacity constraint; accepted for MVP | Founder | On first hire / funding |

## Compliance Review Cadence

- **Current:** Ad hoc, driven by feature changes or external events.
- **Target:** Quarterly self-assessment once the project reaches 100+ regular users or introduces any hosted component.
- **Trigger:** Any proposal to add telemetry, accounts, hosting, or payment processing forces an immediate compliance review.

## Compliance Evidence

- Evidence is maintained in this repository:
  - `LICENSE` — license terms
  - `docs/06-operations/10-risk-and-compliance.md` — this document
  - `docs/04-engineering/` — architecture and security decisions
  - `package.json` + lockfile — dependency provenance
- **Gap:** No centralized evidence index or compliance checklist exists. (Status: manual, review-needed.)
