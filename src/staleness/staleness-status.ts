/** Step 7.2 Staleness Status — read-only staleness summary for /status integration */

import type {
	StalenessDetectionResult,
	StalenessSummary,
} from './staleness-types.js';

export interface StalenessStatusSummary {
	stalenessSummary: StalenessSummary;
	organicSummary: string[];
}

export function buildStalenessStatusSummary(
	result: StalenessDetectionResult,
): StalenessStatusSummary {
	const s = result.summary;

	const lines: string[] = [
		`Staleness:`,
		`  Total outputs:    ${s.total}`,
		`  Current:          ${s.currentCount}`,
		`  Stale:            ${s.staleCount}`,
		`  Missing:          ${s.missingCount}`,
		`  Blocked:          ${s.blockedCount}`,
		`  Orphaned:         ${s.orphanedCount}`,
		`  Unknown:          ${s.unknownCount}`,
	];

	if (s.optionalDependencyWarningCount > 0) {
		lines.push(`  Optional dep warnings: ${s.optionalDependencyWarningCount}`);
	}

	if (s.topStaleReasons.length > 0) {
		lines.push('  Top stale reasons:');
		for (const reason of s.topStaleReasons) {
			lines.push(`    - ${reason}`);
		}
	}

	if (s.topBlockingReasons.length > 0) {
		lines.push('  Top blocking reasons:');
		for (const reason of s.topBlockingReasons) {
			lines.push(`    - ${reason}`);
		}
	}

	if (s.total === 0) {
		lines.push(
			'  (no generated outputs exist yet; run /generate to create outputs)',
		);
	}

	return {
		organicSummary: lines,
		stalenessSummary: s,
	};
}
