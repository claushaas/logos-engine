# NFR Evidence And Release Hardening

## Purpose

This document provides structured, deterministic, local evidence for LOGOS Engine's non-functional requirements (NFRs). It is Phase 8 of the Post-Implementation Gap Roadmap and closes GAP-013: documented NFR targets that previously lacked measurement or release evidence.

All evidence is:

- **Local** — runs on developer/CI machines without network access.
- **Deterministic** — same inputs produce same outputs.
- **Provider-free** — no AI provider calls, credentials, or remote services.
- **Non-mutating** — does not modify real workspace files or project state.
- **Redacted** — no raw secrets, tokens, or private paths in evidence output.

This document and the evidence it references do **not** constitute:

- A formal security audit or penetration test.
- Full WCAG 2.2 AA compliance certification.
- An external CVE or dependency vulnerability scan.
- A SaaS readiness or production operations assessment.
- Automated macOS or Windows native support claims (CI is Linux-only; broader platform evidence is manual).

## Automated Evidence Commands

| Command | Purpose | Mutating | Network | Notes |
|---|---|---|---|---|
| `pnpm nfr:evidence` | Run all NFR evidence checks | No | No | Requires `pnpm build` first |
| `pnpm nfr:evidence --json` | Run all checks, JSON output | No | No | Machine-readable report |
| `pnpm nfr:evidence --category performance` | Run performance evidence only (if implemented) | No | No | Category filtering |
| `pnpm security:check` | Deterministic security/privacy release check | No | No | Reused by privacy/security evidence |
| `pnpm smoke:package` | Release candidate package smoke | No | No | Reused by compatibility evidence |
| `pnpm check` | Full quality gate | No | No | Required release gate script |

## Manual Evidence Checklist

These items require human review and cannot be fully automated in CI:

### Compatibility

- [ ] macOS: Run `pnpm install && pnpm build && pnpm test && pnpm check`.
- [ ] macOS: Run `logos` TUI and verify slash commands in iTerm2 and Terminal.app.
- [ ] Windows WSL: Run `pnpm install && pnpm build && pnpm test && pnpm check`.
- [ ] Windows WSL: Run `logos` TUI in Windows Terminal.
- [ ] Check terminal emulator rendering in GNOME Terminal (Linux).
- [ ] Verify symlink behavior in project paths (macOS/Linux).

### TUI Accessibility

- [ ] Verify keyboard-only navigation through all slash commands.
- [ ] Verify focus is visible and recovers after confirm/cancel/error states.
- [ ] Verify loading states have text equivalents.
- [ ] Verify destructive action warnings are text-visible.
- [ ] Verify compact terminal layout preserves essential context (repo, root, profile, provider).

### HTML Accessibility

- [ ] Review generated HTML artifacts for readable structure in modern browsers (Chrome, Firefox, Safari, Edge).
- [ ] Verify heading hierarchy is present and logical.
- [ ] Verify derived/non-canonical labels are visible.

### Release Gate

- [ ] Review known limitations and accept residual risk.
- [ ] Verify that all evidence items marked `manual` have been reviewed.
- [ ] Confirm no raw secrets appear in any generated artifact, snapshot, or report.

## NFR Coverage Matrix

| NFR Area | NFR IDs Covered | Evidence Category | Automated | Manual |
|---|---|---|---|---|
| Performance | NFR-PERF-001, NFR-PERF-002, NFR-PERF-003, NFR-PERF-004 | performance | Partial (broad thresholds) | Yes (exact latencies) |
| Accessibility | NFR-ACC-001, NFR-ACC-002, NFR-ACC-003, NFR-ACC-005 | accessibility | Static assertions | Yes (keyboard/focus) |
| HTML Accessibility | NFR-ACC-004 | html_accessibility | Static HTML checks | Yes (browser review) |
| Privacy | NFR-PRIV-001, NFR-PRIV-002, NFR-PRIV-003, NFR-PRIV-004, NFR-PRIV-005, NFR-PRIV-006 | privacy, security | Yes (static analysis) | No |
| Security | NFR-SEC-001, NFR-SEC-002, NFR-SEC-003, NFR-SEC-004 | security | Yes (static analysis) | No |
| Reliability | NFR-REL-001, NFR-REL-002, NFR-REL-003, NFR-REL-004, NFR-REL-005, NFR-REL-006 | reliability | Yes (fixtures/inspection) | No |
| Availability | NFR-AVA-001, NFR-AVA-002 | reliability | Yes (inspection) | No |
| Scalability | NFR-SCAL-002, NFR-SCAL-003 | scalability | Yes (fixtures) | No |
| Compatibility | NFR-COMP-001, NFR-COMP-002, NFR-COMP-003, NFR-COMP-004, NFR-COMP-005 | compatibility | Partial (Linux CI) | Yes (macOS, WSL, terminals) |
| Observability | NFR-OBS-001, NFR-OBS-002 | release_gate, reliability | Yes (inspection) | No |
| Operations | NFR-OPS-001, NFR-OPS-002, NFR-OPS-003 | release_gate | Yes (script presence) | No |

## Performance Evidence

Performance evidence uses broad thresholds to catch severe regressions. Exact latencies vary by machine and load.

Thresholds are **generous** by design:

- Most operations: broad threshold ~5-10s, hard threshold ~10-30s.
- Generation operations: broad threshold ~30s, hard threshold ~60s.
- CLI startup: broad threshold ~5s, hard threshold ~10s.

See `src/evidence/performance-evidence.ts` for threshold definitions.

**Not microbenchmarking.** These thresholds are intended to catch extreme degradation (e.g., accidental synchronous blocking), not to measure sub-second variances.

## Accessibility Evidence

### TUI Accessibility

Static evidence covers:

- Confirmation prompts use keyboard-navigable controls (verified via tui-confirmation tests).
- State labels are text-visible, not color-only (verified via design system tokens).
- Focus state is implemented in the TUI focus model (verified via tui-focus-model tests).
- Loading states include text equivalents.
- Help text exposes keyboard actions.
- Compact layout preserves context (repository, root, profile, provider, current view).

**Not claimed:** Full screen-reader support. TUI accessibility in terminal environments has inherent limitations. See `src/evidence/accessibility-evidence.ts`.

### HTML Accessibility

Static HTML checks verify:

- Document title (`<title>`).
- Language attribute (`<html lang="...">`).
- Heading structure.
- Viewport meta tag where applicable.
- Readable text content.
- No `<script>` tags.
- No inline event handlers (`on*=`).
- No remote assets (`https://...` to external domains).
- No iframes or forms.
- No unsafe URLs (`javascript:`, `vbscript:`).
- Derived/non-canonical label visible.
- Source metadata visible.
- Content escaping via `html-escaping` module.

**Not claimed:** Full WCAG 2.2 AA compliance. These are "accessibility smoke checks." Browser rendering and screen-reader testing are manual.

## Compatibility Evidence

### Automated (Linux CI)

- `pnpm check` passes on Linux in CI.
- Node.js >=22, pnpm as declared package manager.
- Package smoke verifies install, build, and profile presence.

### Manual (macOS, Windows WSL)

Checklist items in `src/evidence/compatibility-evidence.ts` and the manual checklist above.

**Explicitly stated:** Native Windows (non-WSL) is not claimed as supported. CI remains Linux-only.

## Scalability Evidence

Scale fixtures verify:

- Hundreds (500) of decisions, assumptions, open questions, and risks.
- Hundreds (500) of proposals.
- Hundreds (100+) of artifacts.
- Many (200+) diagnostic findings.

Each fixture verifies:

- Deterministic ordering.
- Bounded output (no huge raw dumps).
- No crashes or pathological behavior.
- Broad performance threshold.

See `src/evidence/scalability-evidence.ts`.

## Reliability/Recovery Evidence

Covers 14 failure scenarios:

1. Provider unavailable (mode: disabled/no_provider).
2. Provider timeout (executeWithTimeout, AbortController).
3. Provider disclosure blocked (remote without consent).
4. Generation partial failure (report distinguishes categories).
5. Derived artifact failure (independent generation).
6. Validation blocked (deterministic, no AI dependency).
7. Executive readiness blocked (gated by normative readiness).
8. Migration backup failure (backup created, restore available).
9. Restore unsafe path (path containment validation).
10. Root invalid path (containment within project root).
11. Output unknown artifact (graceful unknown handling).
12. Package smoke missing profile (detected and reported).
13. Cancel/no confirmation non-mutation (state preserved).
14. Dry-run non-mutation (planned changes only).

Each scenario asserts: stable diagnostic code, recovery hint, no false success, no mutation on cancel/dry-run.

See `src/evidence/reliability-recovery-evidence.ts`.

## Privacy/Security Evidence

Consolidates Phase 13 security checks and Gap Phase 2/7 checks.

### Privacy (12 items)

- No raw provider tokens in state, artifacts, reports, backups, or snapshots.
- `.env` contents not read, backed up, or packaged.
- Provider tests use synthetic context only.
- Remote provider disclosure required before transmission.
- HTML artifacts are static local files.
- Agent Packs exclude secrets and arbitrary repository files.
- Package contents exclude `.env`, `.logos`, backups, coverage, `node_modules`, `.git`.
- Derived artifacts remain non-canonical.
- Output browser is read-only.
- No telemetry, analytics, crash reporting, remote logging, or cloud backup.

### Security (4 items)

- Token source restricted to environment variables.
- Token redaction in status displays and logs.
- Bounded context ingestion (no automatic `src/` or `.git/` scanning).
- Destructive action confirmation required.

**Not claimed:** Formal security audit, penetration test, or CVE scan. Encryption at rest is OS-level only.

## Release Gate

The release gate requires:

1. `pnpm build` passes.
2. `pnpm test` passes (all ~3270 tests).
3. `pnpm smoke:cli` passes.
4. `pnpm check` passes (lint + typecheck + test + validation + build + smoke:cli + smoke:package).
5. `pnpm security:check` passes.
6. `pnpm smoke:package` passes.
7. `pnpm nfr:evidence` produces no `fail` or `blocked` status.
8. No fake/raw secrets appear in snapshots, reports, or generated artifacts.
9. Package `files` field excludes `.env`, `.logos`, backups, coverage, `node_modules`, `.git`.
10. Compatibility manual checklist is reviewed.
11. Known limitations are documented and accepted.

## Limitations

1. **Performance**: Thresholds are broad. Exact latencies vary by machine. Not a production performance benchmark.
2. **Accessibility**: TUI accessibility is limited by terminal capabilities. Screen-reader compatibility is not tested. HTML accessibility is static-only, not browser-tested.
3. **Compatibility**: CI is Linux-only. macOS and Windows WSL evidence is manual. Native Windows not supported.
4. **Scalability**: Fixtures are moderate (hundreds, not thousands or millions). Extreme scale behavior not tested.
5. **Security**: Not a formal security audit. No penetration testing. No CVE scanning via network. Dependency audit (`pnpm audit`) is manual.
6. **Provider timeout**: Evidence uses static analysis and injectable fake providers. Real network timeouts are not tested in CI.
7. **Generated artifacts**: Snapshot tests verify output shape at a point in time. Manual review is needed for quality.
8. **Manual evidence**: Items marked `manual` require human review and are not gated automatically.

## Deferred/Excluded NFRs

The following NFRs from `docs/03-product/11-non-functional-requirements.md` are explicitly excluded or deferred:

| NFR ID | Status | Reason |
|---|---|---|
| NFR-SEC-005 | Excluded | No user accounts or sessions in MVP. |
| NFR-SEC-006 | Excluded | Single-user local product. |
| NFR-SEC-007 | Deferred | OS-level encryption assumed; product-level encryption deferred. |
| NFR-AVA-003 | Excluded | No hosted SLA. |
| NFR-AVA-004 | Excluded | No hosted service. |
| NFR-SCAL-001 | Excluded | Single-user local operation. |
| NFR-SCAL-004 | Excluded | No request throughput/concurrency requirements. |
| NFR-OBS-004 | Excluded | No hosted dashboards. |
| NFR-OBS-005 | Excluded | Telemetry prohibited by default. |
| NFR-I18N-003 | Deferred | Translation readiness deferred until profile value validated. |
| NFR-COMPL-002 | Excluded | Data residency N/A (local-only). |
| NFR-OPS-004 | Excluded | No hosting infrastructure. |
| NFR-OPS-005 | Deferred | Formal support model deferred. |

## References

- `docs/03-product/11-non-functional-requirements.md` — NFR definitions and classifications.
- `docs/roadmap/POST_IMPLEMENTATION_GAP_ROADMAP.md` — Phase 8 scope and GAP-013.
- `src/evidence/` — NFR evidence model, runner, and category modules.
- `src/security/` — Security and privacy release checks (Phase 13).
- `scripts/nfr-evidence.js` — CLI evidence runner script.
- `scripts/security-check.js` — Security release check script.
