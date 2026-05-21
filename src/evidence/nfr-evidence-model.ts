/**
 * NFR Evidence Model — structured local evidence for non-functional requirements.
 *
 * Phase 8: NFR Evidence And Release Hardening
 *
 * Provides a JSON-serializable, deterministic, redacted evidence model that
 * proves or qualifies the repository's NFR posture at MVP depth.
 *
 * All types are provider-free, network-free, and telemetry-free.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type NfrEvidenceCategory =
	| 'performance'
	| 'accessibility'
	| 'compatibility'
	| 'scalability'
	| 'reliability'
	| 'availability'
	| 'observability'
	| 'privacy'
	| 'security'
	| 'html_accessibility'
	| 'release_gate'
	| 'unknown';

export const NFR_EVIDENCE_CATEGORIES: readonly NfrEvidenceCategory[] = [
	'performance',
	'accessibility',
	'compatibility',
	'scalability',
	'reliability',
	'availability',
	'observability',
	'privacy',
	'security',
	'html_accessibility',
	'release_gate',
	'unknown',
];

export const NFR_EVIDENCE_CATEGORY_ORDER: Record<NfrEvidenceCategory, number> =
	{
		accessibility: 1,
		availability: 4,
		compatibility: 2,
		html_accessibility: 3,
		observability: 6,
		performance: 0,
		privacy: 7,
		release_gate: 10,
		reliability: 5,
		scalability: 9,
		security: 8,
		unknown: 11,
	};

// ---------------------------------------------------------------------------
// Evidence status
// ---------------------------------------------------------------------------

export type NfrEvidenceStatus =
	| 'pass'
	| 'pass_with_warnings'
	| 'fail'
	| 'blocked'
	| 'skipped'
	| 'manual'
	| 'unknown';

export const NFR_EVIDENCE_STATUS_ORDER: Record<NfrEvidenceStatus, number> = {
	blocked: 0,
	fail: 1,
	manual: 2,
	pass: 3,
	pass_with_warnings: 4,
	skipped: 5,
	unknown: 6,
};

// ---------------------------------------------------------------------------
// Source kind
// ---------------------------------------------------------------------------

export type NfrEvidenceSourceKind =
	| 'test'
	| 'script'
	| 'manual_checklist'
	| 'static_analysis'
	| 'fixture'
	| 'unknown';

// ---------------------------------------------------------------------------
// Environment summary
// ---------------------------------------------------------------------------

export interface NfrEvidenceEnvironment {
	nodeVersion: string;
	platform: string;
	arch: string;
	/** No hostname, username, or absolute private path */
	summary: string;
}

// ---------------------------------------------------------------------------
// Expectation
// ---------------------------------------------------------------------------

export interface NfrEvidenceExpectation {
	/** Human-readable description of the expected behavior */
	description: string;
	/** Threshold value if applicable */
	threshold?: string | undefined;
	/** Whether this expectation was met */
	met: boolean;
}

// ---------------------------------------------------------------------------
// Diagnostic (lightweight, stable-code based)
// ---------------------------------------------------------------------------

export interface NfrEvidenceDiagnostic {
	/** Stable diagnostic code */
	code: string;
	/** Severity */
	severity: 'info' | 'warning' | 'error' | 'fatal';
	/** Human-readable message */
	message: string;
	/** Optional pointer to NFR id or evidence id */
	nfrId?: string | undefined;
	/** Optional evidence id reference */
	evidenceId?: string | undefined;
	/** Recovery hint */
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Evidence item
// ---------------------------------------------------------------------------

export interface NfrEvidenceItem {
	/** Unique evidence identifier */
	id: string;
	/** Referenced NFR IDs */
	nfrIds: string[];
	/** Evidence category */
	category: NfrEvidenceCategory;
	/** Human-readable title */
	title: string;
	/** Evidence status */
	status: NfrEvidenceStatus;
	/** ISO timestamp of check */
	checkedAt: string;
	/** Source of evidence */
	source: {
		kind: NfrEvidenceSourceKind;
		command?: string | undefined;
		file?: string | undefined;
	};
	/** Environment summary (redacted) */
	environment: NfrEvidenceEnvironment;
	/** Expectations this evidence validates */
	expectations: NfrEvidenceExpectation[];
	/** Human-readable result summary */
	summary: string;
	/** Associated diagnostics */
	diagnostics: NfrEvidenceDiagnostic[];
	/** Known limitations */
	limitations: string[];
	/** Recommended next actions */
	nextActions: string[];
}

// ---------------------------------------------------------------------------
// Evidence report
// ---------------------------------------------------------------------------

export interface NfrEvidenceReport {
	/** Report generation timestamp */
	generatedAt: string;
	/** Package name */
	packageName: string;
	/** Package version */
	packageVersion: string;
	/** Overall status (worst of all items) */
	status: NfrEvidenceStatus;
	/** All evidence items */
	items: NfrEvidenceItem[];
	/** Counts by category */
	countsByCategory: Record<NfrEvidenceCategory, number>;
	/** Counts by status */
	countsByStatus: Record<NfrEvidenceStatus, number>;
	/** Summary lines for human consumption */
	summaryLines: string[];
	/** Overall limitations */
	limitations: string[];
	/** Overall next actions */
	nextActions: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a redacted environment summary.
 * Never includes hostname, username, or absolute private paths.
 */
export function createNfrEvidenceEnvironment(): NfrEvidenceEnvironment {
	return {
		arch: process.arch,
		nodeVersion: process.version,
		platform: process.platform,
		summary: `Node ${process.version} on ${process.platform} ${process.arch}`,
	};
}

/**
 * Determine the worst status from a set of items.
 */
export function rollupNfrEvidenceStatus(
	items: NfrEvidenceItem[],
): NfrEvidenceStatus {
	if (items.length === 0) return 'unknown';

	const hasBlocked = items.some((i) => i.status === 'blocked');
	if (hasBlocked) return 'blocked';

	const hasFail = items.some((i) => i.status === 'fail');
	if (hasFail) return 'fail';

	const hasUnknown = items.some((i) => i.status === 'unknown');
	if (hasUnknown) return 'unknown';

	const hasManual = items.some((i) => i.status === 'manual');
	if (hasManual) return 'pass_with_warnings';

	const hasWarnings = items.some((i) => i.status === 'pass_with_warnings');
	if (hasWarnings) return 'pass_with_warnings';

	const allPassed = items.every((i) => i.status === 'pass');
	if (allPassed) return 'pass';

	return 'unknown';
}

/**
 * Compare two evidence items deterministically by category then id.
 */
export function compareNfrEvidenceItem(
	a: NfrEvidenceItem,
	b: NfrEvidenceItem,
): number {
	const catA = NFR_EVIDENCE_CATEGORY_ORDER[a.category] ?? 99;
	const catB = NFR_EVIDENCE_CATEGORY_ORDER[b.category] ?? 99;
	if (catA !== catB) return catA - catB;
	return a.id.localeCompare(b.id);
}

/**
 * Sort evidence items deterministically.
 */
export function sortNfrEvidenceItems(
	items: NfrEvidenceItem[],
): NfrEvidenceItem[] {
	return [...items].sort(compareNfrEvidenceItem);
}

/**
 * Build an evidence item with required fields.
 */
export function createNfrEvidenceItem(params: {
	id: string;
	nfrIds: string[];
	category: NfrEvidenceCategory;
	title: string;
	status: NfrEvidenceStatus;
	checkedAt?: string | undefined;
	source?: NfrEvidenceItem['source'] | undefined;
	expectations?: NfrEvidenceExpectation[] | undefined;
	summary?: string | undefined;
	diagnostics?: NfrEvidenceDiagnostic[] | undefined;
	limitations?: string[] | undefined;
	nextActions?: string[] | undefined;
}): NfrEvidenceItem {
	return {
		category: params.category,
		checkedAt: params.checkedAt ?? new Date().toISOString(),
		diagnostics: params.diagnostics ?? [],
		environment: createNfrEvidenceEnvironment(),
		expectations: params.expectations ?? [],
		id: params.id,
		limitations: params.limitations ?? [],
		nextActions: params.nextActions ?? [],
		nfrIds: params.nfrIds,
		source: params.source ?? { kind: 'unknown' },
		status: params.status,
		summary: params.summary ?? '',
		title: params.title,
	};
}

/**
 * Build an evidence diagnostic with stable code.
 */
export function nfrEvidenceDiagnostic(params: {
	code: string;
	severity: 'info' | 'warning' | 'error' | 'fatal';
	message: string;
	nfrId?: string | undefined;
	evidenceId?: string | undefined;
	recoveryHint?: string | undefined;
}): NfrEvidenceDiagnostic {
	return {
		code: params.code,
		evidenceId: params.evidenceId,
		message: params.message,
		nfrId: params.nfrId,
		recoveryHint: params.recoveryHint,
		severity: params.severity,
	};
}

/**
 * Build an evidence report from items.
 */
export function createNfrEvidenceReport(params: {
	items: NfrEvidenceItem[];
	packageName?: string | undefined;
	packageVersion?: string | undefined;
	generatedAt?: string | undefined;
}): NfrEvidenceReport {
	const sorted = sortNfrEvidenceItems(params.items);
	const status = rollupNfrEvidenceStatus(sorted);

	// Counts by category
	const countsByCategory = {} as Record<NfrEvidenceCategory, number>;
	for (const cat of NFR_EVIDENCE_CATEGORIES) {
		countsByCategory[cat] = sorted.filter((i) => i.category === cat).length;
	}

	// Counts by status
	const countsByStatus = {} as Record<NfrEvidenceStatus, number>;
	const allStatuses: NfrEvidenceStatus[] = [
		'pass',
		'pass_with_warnings',
		'fail',
		'blocked',
		'skipped',
		'manual',
		'unknown',
	];
	for (const st of allStatuses) {
		countsByStatus[st] = sorted.filter((i) => i.status === st).length;
	}

	// Summary lines
	const summaryLines: string[] = [];
	summaryLines.push(`NFR Evidence Report — Status: ${status.toUpperCase()}`);
	summaryLines.push(
		`${sorted.length} evidence item(s) across ${NFR_EVIDENCE_CATEGORIES.filter((c) => countsByCategory[c] > 0).length} categories`,
	);
	for (const st of allStatuses) {
		if (countsByStatus[st] > 0) {
			summaryLines.push(`  ${st}: ${countsByStatus[st]}`);
		}
	}

	// Overall limitations
	const limitations: string[] = [
		'This is local, deterministic evidence. It does not constitute a formal security audit, WCAG compliance certification, or external penetration test.',
		'Performance measurements are broad and intended to catch severe regressions, not micro-optimize.',
		'Manual evidence items require human review and are not validated automatically.',
	];

	// Overall next actions
	const nextActions: string[] = [];
	if (status === 'blocked' || status === 'fail') {
		nextActions.push('Resolve failing/blocked evidence items before release.');
	}
	const manualItems = sorted.filter((i) => i.status === 'manual');
	if (manualItems.length > 0) {
		nextActions.push(
			`Complete ${manualItems.length} manual evidence review(s).`,
		);
	}
	const warningItems = sorted.filter((i) => i.status === 'pass_with_warnings');
	if (warningItems.length > 0) {
		nextActions.push(
			`Review ${warningItems.length} warning-level evidence item(s).`,
		);
	}
	if (nextActions.length === 0) {
		nextActions.push('All automated evidence checks passed.');
	}

	return {
		countsByCategory,
		countsByStatus,
		generatedAt: params.generatedAt ?? new Date().toISOString(),
		items: sorted,
		limitations,
		nextActions,
		packageName: params.packageName ?? 'logos-engine',
		packageVersion: params.packageVersion ?? '0.1.0',
		status,
		summaryLines,
	};
}
