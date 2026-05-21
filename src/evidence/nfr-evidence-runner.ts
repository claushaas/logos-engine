/**
 * NFR Evidence Runner — orchestrates deterministic NFR evidence checks.
 *
 * Phase 8: NFR Evidence And Release Hardening
 *
 * Runs selected evidence checks, returns structured reports, and never:
 * - calls AI providers
 * - accesses network
 * - requires credentials
 * - mutates real workspace files
 * - collects telemetry
 */

import { runAccessibilityEvidence } from './accessibility-evidence.js';
import { runCompatibilityEvidence } from './compatibility-evidence.js';
import { runHtmlAccessibilityEvidence } from './html-accessibility-evidence.js';
import {
	createNfrEvidenceReport,
	NFR_EVIDENCE_CATEGORIES,
	type NfrEvidenceCategory,
	type NfrEvidenceItem,
	type NfrEvidenceReport,
} from './nfr-evidence-model.js';
import { runPerformanceEvidence } from './performance-evidence.js';
import { runPrivacySecurityEvidence } from './privacy-security-evidence.js';
import { runReleaseGateEvidence } from './release-gate.js';
import { runReliabilityRecoveryEvidence } from './reliability-recovery-evidence.js';
import { runScalabilityEvidence } from './scalability-evidence.js';

// ---------------------------------------------------------------------------
// Runner options
// ---------------------------------------------------------------------------

export interface NfrEvidenceRunnerOptions {
	/** Only run these categories (default: all) */
	categories?: NfrEvidenceCategory[] | undefined;
	/** ISO timestamp for deterministic tests */
	checkedAt?: string | undefined;
	/** Package name for report */
	packageName?: string | undefined;
	/** Package version for report */
	packageVersion?: string | undefined;
	/** Whether to produce JSON output */
	json?: boolean | undefined;
	/** Inject durations for performance tests */
	_injectDurations?: Record<string, number> | undefined;
	/** Inject fake provider for timeout tests */
	_injectFakeProvider?: unknown | undefined;
	/** Inject platform for compatibility tests */
	_injectPlatform?: string | undefined;
	/** Inject package.json for release gate tests */
	_injectPackageJson?: Record<string, unknown> | undefined;
	/** Inject scripts for release gate tests */
	_injectScripts?: Record<string, string> | undefined;
	/** Inject check content for scalability / HTML tests */
	_injectCheckContent?: Record<string, string> | undefined;
	/** Inject security result for privacy/security evidence */
	_injectSecurityResult?: unknown | undefined;
	/** Inject TUI accessibility fixture data */
	_injectTuiAccessibilityData?: unknown | undefined;
	/** Inject scale fixture data */
	_injectScaleData?:
		| {
				decisions?: unknown[];
				assumptions?: unknown[];
				openQuestions?: unknown[];
				risks?: unknown[];
				proposals?: unknown[];
				artifacts?: unknown[];
				findings?: unknown[];
		  }
		| undefined;
	/** Inject compatibility platform info */
	_injectCompatibilityPlatform?: string | undefined;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run all evidence checks (or selected categories) and return a structured report.
 */
export function runNfrEvidence(
	options: NfrEvidenceRunnerOptions = {},
): NfrEvidenceReport {
	const selectedCategories = options.categories ?? [...NFR_EVIDENCE_CATEGORIES];
	const checkedAt = options.checkedAt ?? new Date().toISOString();

	const allItems: NfrEvidenceItem[] = [];

	// Track which evidence function has already been called to avoid duplicates
	// (reliability+availability share a runner, privacy+security share a runner)
	const calledRunners = new Set<string>();

	for (const category of selectedCategories) {
		let categoryItems: NfrEvidenceItem[] = [];

		switch (category) {
			case 'performance':
				categoryItems = runPerformanceEvidence({
					_injectDurations: options._injectDurations,
					checkedAt,
				});
				break;
			case 'accessibility':
				categoryItems = runAccessibilityEvidence({
					_injectTuiData: options._injectTuiAccessibilityData,
					checkedAt,
				});
				break;
			case 'html_accessibility':
				categoryItems = runHtmlAccessibilityEvidence({
					_injectContent: options._injectCheckContent,
					checkedAt,
				});
				break;
			case 'compatibility':
				categoryItems = runCompatibilityEvidence({
					_injectPlatform: options._injectCompatibilityPlatform,
					checkedAt,
				});
				break;
			case 'scalability':
				categoryItems = runScalabilityEvidence({
					_injectScaleData: options._injectScaleData,
					checkedAt,
				});
				break;
			case 'reliability':
			case 'availability': {
				if (calledRunners.has('reliability-availability')) break;
				calledRunners.add('reliability-availability');
				categoryItems = runReliabilityRecoveryEvidence({
					checkedAt,
				});
				break;
			}
			case 'privacy':
			case 'security': {
				if (calledRunners.has('privacy-security')) break;
				calledRunners.add('privacy-security');
				categoryItems = runPrivacySecurityEvidence({
					_injectSecurityResult: options._injectSecurityResult,
					checkedAt,
				});
				break;
			}
			case 'release_gate':
				categoryItems = runReleaseGateEvidence({
					_injectPackageJson: options._injectPackageJson,
					_injectScripts: options._injectScripts,
					checkedAt,
				});
				break;
			default:
				categoryItems = [];
				break;
		}

		allItems.push(...categoryItems);
	}

	return createNfrEvidenceReport({
		generatedAt: checkedAt,
		items: allItems,
		packageName: options.packageName,
		packageVersion: options.packageVersion,
	});
}
