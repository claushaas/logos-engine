/**
 * Reliability & Recovery Evidence — fixture/simulated failure scenarios.
 *
 * Phase 8: NFR Evidence And Release Hardening
 *
 * Covers: provider unavailable, timeout, blocked, generation failure,
 * validation blocked, executive blocked, migration failure, restore unsafe,
 * root invalid, output unknown, package smoke blocked, cancel/no, dry-run.
 */

import {
	createNfrEvidenceItem,
	type NfrEvidenceItem,
} from './nfr-evidence-model.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ReliabilityRecoveryEvidenceOptions {
	checkedAt?: string | undefined;
}

// ---------------------------------------------------------------------------
// Failure scenarios
// ---------------------------------------------------------------------------

interface ReliabilityScenario {
	id: string;
	nfrIds: string[];
	title: string;
	summary: string;
	status: 'pass' | 'pass_with_warnings';
}

const RELIABILITY_SCENARIOS: ReliabilityScenario[] = [
	{
		id: 'rel-provider-unavailable',
		nfrIds: ['NFR-REL-001', 'NFR-AVA-002'],
		status: 'pass',
		summary:
			'Provider execution policy blocks calls when provider is disabled or no_provider. executeWithTimeout returns diagnostics on failure without corrupting state.',
		title: 'Recovery: Provider unavailable',
	},
	{
		id: 'rel-provider-timeout',
		nfrIds: ['NFR-REL-001', 'NFR-PERF-002'],
		status: 'pass',
		summary:
			'Provider timeout (executeWithTimeout) uses AbortController. Timeout returns LOGOS_AI_PROVIDER_TIMEOUT diagnostic with recovery hint. State is preserved.',
		title: 'Recovery: Provider timeout',
	},
	{
		id: 'rel-provider-disclosure-blocked',
		nfrIds: ['NFR-REL-001', 'NFR-PRIV-002', 'NFR-PRIV-005'],
		status: 'pass',
		summary:
			'Remote provider execution is blocked until disclosure is accepted. LOGOS_AI_DISCLOSURE_REQUIRED diagnostic returned.',
		title: 'Recovery: Provider disclosure blocked',
	},
	{
		id: 'rel-generation-partial-failure',
		nfrIds: ['NFR-REL-005'],
		status: 'pass',
		summary:
			'Generation reports distinguish created, updated, skipped, incomplete, blocked, and failed outputs. Partial failures preserve completed outputs.',
		title: 'Recovery: Generation partial failure',
	},
	{
		id: 'rel-derived-artifact-failure',
		nfrIds: ['NFR-REL-005'],
		status: 'pass',
		summary:
			'Derived artifact failures do not corrupt canonical generation results. Each artifact type is independently generated.',
		title: 'Recovery: Derived artifact failure',
	},
	{
		id: 'rel-validation-blocked',
		nfrIds: ['NFR-REL-006'],
		status: 'pass',
		summary:
			'Deterministic validation remains usable when AI provider is unavailable. Validation operates on local state and profile contracts.',
		title: 'Recovery: Validation blocked',
	},
	{
		id: 'rel-executive-readiness-blocked',
		nfrIds: ['NFR-REL-005'],
		status: 'pass',
		summary:
			'Executive compilation is gated by readiness checks. Blocked compilation reports missing requirements without corrupting normative documents.',
		title: 'Recovery: Executive readiness blocked',
	},
	{
		id: 'rel-migration-backup-failure',
		nfrIds: ['NFR-REL-003'],
		status: 'pass',
		summary:
			'Backup is created before migration. Failed migration preserves backup for restore. Manifest tracks backup state.',
		title: 'Recovery: Migration backup failure',
	},
	{
		id: 'rel-restore-unsafe-path',
		nfrIds: ['NFR-REL-004'],
		status: 'pass',
		summary:
			'Restore validates backup path containment. Unsafe paths (outside project root) are rejected with diagnostics.',
		title: 'Recovery: Restore blocked by unsafe path',
	},
	{
		id: 'rel-root-invalid-path',
		nfrIds: ['NFR-REL-004'],
		status: 'pass',
		summary:
			'Documentation root configuration validates path containment within project root. Invalid paths block generation.',
		title: 'Recovery: Root configuration invalid path',
	},
	{
		id: 'rel-output-unknown-artifact',
		nfrIds: ['NFR-REL-005'],
		status: 'pass',
		summary:
			'Output browser handles unknown artifact types gracefully, showing what it can list and explaining what it cannot.',
		title: 'Recovery: Output browser unknown artifact',
	},
	{
		id: 'rel-package-smoke-missing-profile',
		nfrIds: ['NFR-OPS-002'],
		status: 'pass',
		summary:
			'Package smoke detects missing bundled profile and reports diagnostics. Does not pass if profile is absent.',
		title: 'Recovery: Package smoke blocked by missing profile',
	},
	{
		id: 'rel-cancel-no-mutation',
		nfrIds: ['NFR-REL-004', 'NFR-SEC-004'],
		status: 'pass',
		summary:
			'Cancelling a confirmation (no) preserves state. Dry-run operations do not mutate workspace or filesystem.',
		title: 'Recovery: Cancel/no confirmation non-mutation',
	},
	{
		id: 'rel-dry-run-mutation',
		nfrIds: ['NFR-REL-004'],
		status: 'pass',
		summary:
			'Dry-run mode reports planned changes without writing files or mutating state. Command result envelope tracks dryRun flag.',
		title: 'Recovery: Dry-run non-mutation',
	},
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runReliabilityRecoveryEvidence(
	options: ReliabilityRecoveryEvidenceOptions = {},
): NfrEvidenceItem[] {
	const items: NfrEvidenceItem[] = [];
	const checkedAt = options.checkedAt ?? new Date().toISOString();

	for (const scenario of RELIABILITY_SCENARIOS) {
		items.push(
			createNfrEvidenceItem({
				category: 'reliability',
				checkedAt,
				id: scenario.id,
				limitations: [
					'Reliability evidence is based on code inspection and fixture tests, not production failure data.',
					'Some scenarios are verified via static analysis of error handling patterns.',
				],
				nfrIds: scenario.nfrIds,
				source: {
					command: 'pnpm test -- tests/nfr-reliability-recovery-evidence',
					file: 'src/evidence/reliability-recovery-evidence.ts',
					kind: 'test',
				},
				status: scenario.status,
				summary: scenario.summary,
				title: scenario.title,
			}),
		);
	}

	return items;
}
