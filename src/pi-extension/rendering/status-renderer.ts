/**
 * LOGOS Pi Extension — Status renderer (Step 9.2).
 *
 * Pure rendering function that formats Core status result data into a
 * structured {@link LogosRenderedMessage}.  Displays:
 * - intake mode and active question;
 * - total progress and by-phase progress;
 * - sufficient / partial / missing / contradictory / skipped counts;
 * - completeness score;
 * - blockers and warnings.
 *
 * Rules:
 * - Does not compute progress from raw state.
 * - Does not call Core APIs.
 * - Does not mutate inputs.
 * - Does not access filesystem.
 * - Preserves structured metadata for downstream consumers.
 *
 * Boundary:
 * - Must not import Core internals.
 * - Must not import Pi runtime values.
 * - Must not import CLI/TUI/Ink/React.
 */

import type { AssistantMessage } from '../../core/index.js';
import {
	formatPhaseProgress,
	formatProgressSummary,
} from './progress-formatter.js';
import type { LogosRenderedMessage } from './render-core-result.js';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export type RenderStatusInput = {
	message: AssistantMessage;
	data?: unknown;
	blockers?: unknown[];
	warnings?: unknown[];
};

// ---------------------------------------------------------------------------
// Safe extraction helpers
// ---------------------------------------------------------------------------

type SafeProgress = {
	total?: number;
	sufficient?: number;
	partial?: number;
	missing?: number;
	contradictory?: number;
	skipped?: number;
	completenessScore?: number;
	byPhase?: Record<string, unknown>;
};

function extractProgress(data: unknown): SafeProgress | undefined {
	if (data === null || data === undefined) return undefined;
	if (typeof data !== 'object') return undefined;

	const d = data as Record<string, unknown>;

	// Check if we have a recognized progress shape.
	const hasProgress =
		d.progress !== undefined &&
		typeof d.progress === 'object' &&
		d.progress !== null;

	if (!hasProgress) return undefined;

	const p = d.progress as Record<string, unknown>;

	const result: SafeProgress = {};

	if (typeof p.total === 'number') result.total = p.total;
	if (typeof p.sufficient === 'number') result.sufficient = p.sufficient;
	if (typeof p.partial === 'number') result.partial = p.partial;
	if (typeof p.missing === 'number') result.missing = p.missing;
	if (typeof p.contradictory === 'number')
		result.contradictory = p.contradictory;
	if (typeof p.skipped === 'number') result.skipped = p.skipped;
	if (typeof p.completenessScore === 'number')
		result.completenessScore = p.completenessScore;
	if (p.byPhase !== undefined && typeof p.byPhase === 'object') {
		result.byPhase = p.byPhase as Record<string, unknown>;
	}

	// Also extract completenessScore at top level if not in progress.
	if (
		result.completenessScore === undefined &&
		typeof d.completenessScore === 'number'
	) {
		result.completenessScore = d.completenessScore;
	}

	return result;
}

function extractMode(data: unknown): string | undefined {
	if (data === null || data === undefined) return undefined;
	if (typeof data !== 'object') return undefined;
	const d = data as Record<string, unknown>;
	return typeof d.mode === 'string' ? d.mode : undefined;
}

function extractActiveQuestionId(data: unknown): string | undefined {
	if (data === null || data === undefined) return undefined;
	if (typeof data !== 'object') return undefined;
	const d = data as Record<string, unknown>;
	return typeof d.activeQuestionId === 'string'
		? d.activeQuestionId
		: undefined;
}

// ---------------------------------------------------------------------------
// Status renderer
// ---------------------------------------------------------------------------

/** Content block separator for multi-line bodies. */
const NL = '\n';
const _HR = `${NL}---${NL}`;

/**
 * Render Core status data as a {@link LogosRenderedMessage}.
 *
 * This function is **pure** and **deterministic**:
 * - It does not call Core APIs.
 * - It does not call Pi runtime methods.
 * - It does not access the filesystem.
 * - It does not mutate its input.
 *
 * @param input.message - The Core assistant message carrying the status body.
 * @param input.data   - Optional status-shaped data (GetStatusData-compatible).
 * @param input.blockers - Optional blockers to preserve.
 * @param input.warnings - Optional warnings to preserve.
 * @returns A structured {@link LogosRenderedMessage} ready for Pi delivery.
 */
export function renderStatus(input: RenderStatusInput): LogosRenderedMessage {
	const { message, data, blockers, warnings } = input;

	const progress = extractProgress(data);
	const mode = extractMode(data);
	const activeQuestionId = extractActiveQuestionId(data);

	// Build enriched body.
	const bodyParts: string[] = [];

	// Core message body always first.
	if (message.body.length > 0) {
		bodyParts.push(message.body);
	}

	// ---- intake mode ----
	if (mode !== undefined) {
		bodyParts.push('');
		bodyParts.push(`Mode: ${mode}`);
	}

	// ---- active question ----
	if (activeQuestionId !== undefined) {
		bodyParts.push(`Active question: ${activeQuestionId}`);
	}

	// ---- progress summary ----
	if (progress !== undefined) {
		const lines = formatProgressSummary(progress);
		if (lines.length > 0) {
			bodyParts.push('');
			bodyParts.push(...lines);
		}

		// ---- by-phase ----
		if (progress.byPhase !== undefined) {
			const phaseLines = formatPhaseProgress(progress.byPhase);
			if (phaseLines.length > 0) {
				bodyParts.push('');
				bodyParts.push('By phase:');
				bodyParts.push(...phaseLines);
			}
		}
	}

	const enrichedBody = bodyParts.join(NL);

	// Build metadata with structured status data.
	const metadata: Record<string, unknown> = {};

	// Preserve original message metadata.
	if (message.metadata !== undefined) {
		Object.assign(metadata, message.metadata);
	}

	// Preserve structured status info.
	if (mode !== undefined) {
		metadata.mode = mode;
	}
	if (activeQuestionId !== undefined) {
		metadata.activeQuestionId = activeQuestionId;
	}
	if (progress !== undefined) {
		metadata.progress = progress;
	}

	const rendered: LogosRenderedMessage = {
		body: enrichedBody,
		kind: message.kind,
		metadata,
		title: message.title ?? 'LOGOS status',
		type: 'logos',
	};

	// ---- preserve questionId ----
	if (activeQuestionId !== undefined) {
		rendered.questionId = activeQuestionId;
	}

	// ---- preserve blockers ----
	if (blockers !== undefined && blockers.length > 0) {
		rendered.blockers = [...blockers];
	}

	// ---- preserve warnings ----
	if (warnings !== undefined && warnings.length > 0) {
		rendered.warnings = [...warnings];
	}

	return rendered;
}
