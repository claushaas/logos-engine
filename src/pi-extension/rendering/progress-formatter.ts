/**
 * LOGOS Pi Extension — Progress formatter (Step 9.2).
 *
 * Pure formatting helpers that convert Core progress shapes into readable
 * display lines.  No Core APIs, no Pi runtime calls, no filesystem access,
 * no state mutation.
 *
 * Boundary:
 * - Must not import Core internals.
 * - Must not import Pi runtime values.
 * - Must not import CLI/TUI/Ink/React.
 * - Must not compute missing values from source registries.
 * - Must not mutate input objects.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ProgressSummary = {
	total?: number;
	sufficient?: number;
	partial?: number;
	missing?: number;
	contradictory?: number;
	skipped?: number;
	completenessScore?: number;
	byPhase?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

/**
 * Format a progress summary into an array of human-readable lines.
 *
 * Rules:
 * - If a field is absent, omit it.
 * - If `completenessScore` exists, display as percentage text but keep the
 *   original numeric value out of the string (callers preserve it in metadata).
 * - Does not mutate the input.
 * - Does not compute missing values.
 *
 * @param progress - A partial or complete progress summary.
 * @returns Array of formatted lines.
 */
export function formatProgressSummary(progress: ProgressSummary): string[] {
	const lines: string[] = [];

	// ---- total + sufficient ----
	const total = progress.total;
	const sufficient = progress.sufficient;
	if (total !== undefined && sufficient !== undefined) {
		lines.push(`Progress: ${sufficient}/${total} sufficient`);
	} else if (total !== undefined) {
		lines.push(`Progress: ${total} total`);
	} else if (sufficient !== undefined) {
		lines.push(`Progress: ${sufficient} sufficient`);
	}

	// ---- individual counts ----
	if (progress.partial !== undefined && progress.partial > 0) {
		lines.push(`Partial: ${progress.partial}`);
	}
	if (progress.missing !== undefined && progress.missing > 0) {
		lines.push(`Missing: ${progress.missing}`);
	}
	if (progress.contradictory !== undefined && progress.contradictory > 0) {
		lines.push(`Contradictions: ${progress.contradictory}`);
	}
	if (progress.skipped !== undefined && progress.skipped > 0) {
		lines.push(`Skipped: ${progress.skipped}`);
	}
	if (progress.completenessScore !== undefined) {
		const pct = Math.round(progress.completenessScore * 100);
		lines.push(`Completeness: ${pct}%`);
	}

	return lines;
}

// ---------------------------------------------------------------------------
// By-phase formatting
// ---------------------------------------------------------------------------

/** Per-phase progress shape (subset of {@link IntakePhaseProgress}). */
export type PhaseProgress = {
	phaseId?: string;
	total?: number;
	sufficient?: number;
	partial?: number;
	missing?: number;
	contradictory?: number;
	completenessScore?: number;
};

const MAX_PHASES = 8;

/**
 * Format by-phase progress into display lines.
 *
 * @param byPhase - Phase progress map from Core.
 * @returns Array of formatted phase summary lines.
 */
export function formatPhaseProgress(
	byPhase: Record<string, unknown> | undefined,
): string[] {
	if (byPhase === undefined) return [];

	const entries = Object.entries(byPhase);

	if (entries.length === 0) return [];

	const sorted = entries.sort(([a], [b]) => a.localeCompare(b));

	const lines: string[] = [];

	for (const [phaseId, raw] of sorted) {
		if (lines.length >= MAX_PHASES) break;

		const phase = raw as PhaseProgress | undefined;
		if (phase === undefined || typeof phase !== 'object') continue;

		const total = typeof phase.total === 'number' ? phase.total : undefined;
		const sufficient =
			typeof phase.sufficient === 'number' ? phase.sufficient : undefined;
		const partial =
			typeof phase.partial === 'number' ? phase.partial : undefined;
		const missing =
			typeof phase.missing === 'number' ? phase.missing : undefined;

		let summary = `${phaseId}: `;
		const parts: string[] = [];

		if (sufficient !== undefined && total !== undefined) {
			parts.push(`${sufficient}/${total} sufficient`);
		} else if (total !== undefined) {
			parts.push(`${total} total`);
		}

		if (partial !== undefined && partial > 0) {
			parts.push(`${partial} partial`);
		}
		if (missing !== undefined && missing > 0) {
			parts.push(`${missing} missing`);
		}
		if (
			phase.contradictory !== undefined &&
			typeof phase.contradictory === 'number' &&
			phase.contradictory > 0
		) {
			parts.push(`${phase.contradictory} contradictions`);
		}

		if (parts.length > 0) {
			summary += parts.join(', ');
		} else {
			summary += 'no data';
		}

		lines.push(summary);
	}

	if (sorted.length > MAX_PHASES) {
		lines.push(`... and ${sorted.length - MAX_PHASES} more phase(s)`);
	}

	return lines;
}
