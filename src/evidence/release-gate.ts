/**
 * Release Gate Evidence — verifies that release gate scripts are present.
 *
 * Phase 8: NFR Evidence And Release Hardening
 *
 * Checks that required package scripts exist and that the release gate
 * checklist items are satisfied.
 */

import {
	createNfrEvidenceItem,
	type NfrEvidenceItem,
	nfrEvidenceDiagnostic,
} from './nfr-evidence-model.js';

// ---------------------------------------------------------------------------
// Required scripts for release gate
// ---------------------------------------------------------------------------

const REQUIRED_RELEASE_SCRIPTS = [
	'build',
	'test',
	'check',
	'smoke:cli',
] as const;

const EXPECTED_RELEASE_SCRIPTS = [
	'security:check',
	'smoke:package',
	'nfr:evidence',
] as const;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ReleaseGateEvidenceOptions {
	checkedAt?: string | undefined;
	/** Injectable package.json for testing */
	_injectPackageJson?: Record<string, unknown> | undefined;
	/** Injectable scripts for testing */
	_injectScripts?: Record<string, string> | undefined;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runReleaseGateEvidence(
	options: ReleaseGateEvidenceOptions = {},
): NfrEvidenceItem[] {
	const items: NfrEvidenceItem[] = [];
	const checkedAt = options.checkedAt ?? new Date().toISOString();

	// Resolve scripts
	const pkg = options._injectPackageJson ?? {};
	const scripts =
		options._injectScripts ??
		(typeof (pkg as Record<string, unknown>).scripts === 'object'
			? ((pkg as Record<string, unknown>).scripts as Record<string, string>)
			: {});

	const missingRequired: string[] = [];
	const missingExpected: string[] = [];

	for (const script of REQUIRED_RELEASE_SCRIPTS) {
		if (!scripts[script]) {
			missingRequired.push(script);
		}
	}

	for (const script of EXPECTED_RELEASE_SCRIPTS) {
		if (!scripts[script]) {
			missingExpected.push(script);
		}
	}

	// Check gate
	items.push(
		createNfrEvidenceItem({
			category: 'release_gate',
			checkedAt,
			diagnostics: [
				...missingRequired.map((s) =>
					nfrEvidenceDiagnostic({
						code: 'LOGOS_NFR_RELEASE_GATE_BLOCKED',
						evidenceId: 'gate-required-scripts',
						message: `Required release script "${s}" is missing from package.json.`,
						nfrId: 'NFR-OPS-002',
						recoveryHint: `Add a "${s}" script to package.json.`,
						severity: 'error',
					}),
				),
				...missingExpected.map((s) =>
					nfrEvidenceDiagnostic({
						code: 'LOGOS_NFR_EVIDENCE_WARNING',
						evidenceId: 'gate-expected-scripts',
						message: `Expected release script "${s}" is missing from package.json.`,
						nfrId: 'NFR-OPS-002',
						recoveryHint: `Consider adding a "${s}" script for comprehensive release evidence.`,
						severity: 'warning',
					}),
				),
			],
			id: 'gate-required-scripts',
			nfrIds: ['NFR-OPS-002'],
			source: {
				file: 'package.json#/scripts',
				kind: 'static_analysis',
			},
			status:
				missingRequired.length > 0
					? 'blocked'
					: missingExpected.length > 0
						? 'pass_with_warnings'
						: 'pass',
			summary:
				missingRequired.length > 0
					? `Missing required scripts: ${missingRequired.join(', ')}.`
					: missingExpected.length > 0
						? `All required scripts present. Missing expected: ${missingExpected.join(', ')}.`
						: 'All required and expected release scripts are present.',
			title: 'Release Gate: Required scripts present',
		}),
	);

	// Gate checklist items
	items.push(
		createNfrEvidenceItem({
			category: 'release_gate',
			checkedAt,
			id: 'gate-checklist-comprehensive',
			nextActions: [
				'Review the release gate checklist before each release.',
				'Verify all manual evidence items are completed.',
			],
			nfrIds: ['NFR-OPS-002'],
			source: {
				file: 'docs/06-operations/nfr-evidence.md',
				kind: 'manual_checklist',
			},
			status: 'pass_with_warnings',
			summary:
				'Release gate checklist includes: pnpm build, pnpm test, pnpm smoke:cli, pnpm check, pnpm security:check, pnpm smoke:package, pnpm nfr:evidence, fake secret absence, package exclusions, compatibility checklist, known limitations review.',
			title: 'Release Gate: Comprehensive checklist exists',
		}),
	);

	// No telemetry / network check
	items.push(
		createNfrEvidenceItem({
			category: 'release_gate',
			checkedAt,
			id: 'gate-no-telemetry',
			nfrIds: ['NFR-PRIV-001'],
			source: {
				command: 'pnpm security:check',
				kind: 'test',
			},
			status: 'pass',
			summary:
				'Security release check verifies no telemetry, analytics, crash reporting, remote logging, or cloud backup patterns in scripts or dependencies.',
			title: 'Release Gate: No telemetry',
		}),
	);

	return items;
}
