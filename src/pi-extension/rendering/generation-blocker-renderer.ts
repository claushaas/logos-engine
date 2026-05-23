/**
 * LOGOS Pi Extension — Generation blocker renderer (Step 9.2).
 *
 * Pure rendering function that formats Core preflight/generation blocker
 * data into a structured {@link LogosRenderedMessage}.  Displays:
 * - generation readiness status;
 * - completeness score;
 * - blocker codes and messages with actionable hints;
 * - warning codes and messages;
 * - missing/partial critical question IDs;
 * - unresolved contradiction IDs;
 * - required skipped question IDs;
 * - optional warnings;
 * - partial draft and confirmation flags.
 *
 * Rules:
 * - Does not run preflight or generate.
 * - Does not call Core APIs.
 * - Does not decide if generation can proceed.
 * - Does not ask confirmation.
 * - Does not write files.
 * - Preserves Core blockers/warnings structurally.
 *
 * Boundary:
 * - Must not import Core internals.
 * - Must not import Pi runtime values.
 * - Must not import CLI/TUI/Ink/React.
 */

import type { AssistantMessage } from '../../core/index.js';
import type { LogosRenderedMessage } from './render-core-result.js';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export type RenderGenerationBlockersInput = {
	message?: AssistantMessage;
	preflight?: unknown;
	generation?: unknown;
	blockers?: unknown[];
	warnings?: unknown[];
};

// ---------------------------------------------------------------------------
// Safe extraction helpers
// ---------------------------------------------------------------------------

type SafePreflight = {
	mode?: string;
	status?: string;
	ready?: boolean;
	completenessScore?: number;
	blockers?: unknown[];
	warnings?: unknown[];
	missingCriticalQuestions?: string[];
	partialCriticalQuestions?: string[];
	contradictions?: string[];
	requiredSkippedQuestions?: string[];
	optionalMissingQuestions?: string[];
	optionalSkippedQuestions?: string[];
	canGeneratePartialDraft?: boolean;
	requiresExplicitConfirmation?: boolean;
	checkedAt?: string;
};

function extractPreflight(data: unknown): SafePreflight | undefined {
	if (data === null || data === undefined) return undefined;
	if (typeof data !== 'object') return undefined;

	const d = data as Record<string, unknown>;

	// Check for preflight at top-level `data.preflight`.
	const preflightRaw =
		d.preflight !== undefined &&
		typeof d.preflight === 'object' &&
		d.preflight !== null
			? (d.preflight as Record<string, unknown>)
			: undefined;

	// If no preflight sub-object, check if the data itself IS a preflight shape.
	const source: Record<string, unknown> | undefined =
		preflightRaw !== undefined
			? preflightRaw
			: 'status' in d && ('ready' in d || 'completenessScore' in d)
				? d
				: undefined;

	if (source === undefined) return undefined;

	const result: SafePreflight = {};

	if (typeof source.mode === 'string') result.mode = source.mode;
	if (typeof source.status === 'string') result.status = source.status;
	if (typeof source.ready === 'boolean') result.ready = source.ready;
	if (typeof source.completenessScore === 'number')
		result.completenessScore = source.completenessScore;

	if (Array.isArray(source.blockers)) result.blockers = source.blockers;
	if (Array.isArray(source.warnings)) result.warnings = source.warnings;

	if (Array.isArray(source.missingCriticalQuestions))
		result.missingCriticalQuestions = source.missingCriticalQuestions;
	if (Array.isArray(source.partialCriticalQuestions))
		result.partialCriticalQuestions = source.partialCriticalQuestions;
	if (Array.isArray(source.contradictions))
		result.contradictions = source.contradictions;
	if (Array.isArray(source.requiredSkippedQuestions))
		result.requiredSkippedQuestions = source.requiredSkippedQuestions;
	if (Array.isArray(source.optionalMissingQuestions))
		result.optionalMissingQuestions = source.optionalMissingQuestions;
	if (Array.isArray(source.optionalSkippedQuestions))
		result.optionalSkippedQuestions = source.optionalSkippedQuestions;

	if (typeof source.canGeneratePartialDraft === 'boolean')
		result.canGeneratePartialDraft = source.canGeneratePartialDraft;
	if (typeof source.requiresExplicitConfirmation === 'boolean')
		result.requiresExplicitConfirmation = source.requiresExplicitConfirmation;
	if (typeof source.checkedAt === 'string') result.checkedAt = source.checkedAt;

	return result;
}

// ---------------------------------------------------------------------------
// Block code → actionable hint
// ---------------------------------------------------------------------------

const BLOCKER_HINTS: Record<string, string> = {
	intake_state_missing: 'Start intake with /logos-start.',
	manual_edit_risk: 'Review existing manually edited files before overwriting.',
	missing_critical_questions:
		'Answer the missing critical questions before generating.',
	overwrite_risk:
		'Review existing generated paths or use explicit confirmation.',
	partial_critical_questions:
		'Complete critical partial answers before generating.',
	profile_invalid: 'Fix the active profile contract under profiles/<id>/.',
	profile_not_found:
		'Check activeProfileId in .logos/config.yml and verify profiles/<id>/ exists.',
	project_not_initialized: 'Run /logos-init first.',
	question_registry_empty:
		'Check profile question contracts under the active profile.',
	required_questions_skipped:
		'Revisit required skipped questions before generating.',
	unresolved_contradictions: 'Resolve contradictions before final generation.',
	unsafe_output_path: 'Fix unsafe output paths in profile contracts.',
};

function blockerHint(code: string | undefined): string | undefined {
	if (code === undefined) return undefined;
	return BLOCKER_HINTS[code];
}

// ---------------------------------------------------------------------------
// Types for blocker/warning objects
// ---------------------------------------------------------------------------

type SafeIssue = {
	code?: string;
	message?: string;
	questionIds?: unknown;
};

// ---------------------------------------------------------------------------
// Generation blocker renderer
// ---------------------------------------------------------------------------

const NL = '\n';

/**
 * Render a list of blocker/warning issues as formatted lines.
 */
function formatIssues(issues: unknown[] | undefined, label: string): string[] {
	if (issues === undefined || issues.length === 0) return [];

	const lines: string[] = [];

	for (const issue of issues) {
		if (issue === null || issue === undefined) continue;
		if (typeof issue === 'string') {
			lines.push(`- ${label}: ${issue}`);
		} else if (typeof issue === 'object') {
			const i = issue as SafeIssue;
			const code = i.code ?? 'unknown';
			const msg = i.message ?? '';
			lines.push(`- [${code}] ${msg}`);
			const hint = blockerHint(i.code);
			if (hint !== undefined) {
				lines.push(`  → ${hint}`);
			}
		}
	}

	return lines;
}

/**
 * Render a list of IDs as formatted lines.
 */
function formatIdList(ids: string[] | undefined, label: string): string[] {
	if (ids === undefined || ids.length === 0) return [];

	const lines: string[] = [];
	lines.push(`${label}:`);

	for (const id of ids) {
		lines.push(`  - ${id}`);
	}

	return lines;
}

/**
 * Render Core preflight/generation blocker data as a
 * {@link LogosRenderedMessage}.
 *
 * This function is **pure** and **deterministic**:
 * - It does not call Core APIs.
 * - It does not call Pi runtime methods.
 * - It does not access the filesystem.
 * - It does not mutate its input.
 *
 * @param input - The generation blocker render input.
 * @returns A structured {@link LogosRenderedMessage} ready for Pi delivery.
 */
export function renderGenerationBlockers(
	input: RenderGenerationBlockersInput,
): LogosRenderedMessage {
	const {
		message,
		preflight: preflightRaw,
		generation,
		blockers,
		warnings,
	} = input;

	// Determine preflight data (prefer explicit preflight → generation → input blockers).
	const p = extractPreflight(preflightRaw) ?? extractPreflight(generation);

	const bodyParts: string[] = [];

	// ---- Core message body ----
	if (message !== undefined && message.body.length > 0) {
		bodyParts.push(message.body);
	}

	// ---- generation readiness status ----
	if (p !== undefined && p.status !== undefined) {
		const statusLabel =
			p.status === 'confirmation_required' ? 'confirmation required' : p.status;
		bodyParts.push('');
		bodyParts.push(`Generation readiness: ${statusLabel}`);
	} else {
		// Infer readiness from ready flag.
		if (p?.ready === true) {
			bodyParts.push('');
			bodyParts.push('Generation readiness: ready');
		} else if (p?.ready === false && p?.status === undefined) {
			bodyParts.push('');
			bodyParts.push('Generation readiness: blocked');
		}
	}

	// ---- completeness score ----
	if (p?.completenessScore !== undefined) {
		const pct = Math.round(p.completenessScore * 100);
		bodyParts.push(`Completeness: ${pct}%`);
	}

	// ---- partial draft + confirmation flags ----
	if (p?.canGeneratePartialDraft === true) {
		bodyParts.push('Partial draft: available');
	}
	if (p?.requiresExplicitConfirmation === true) {
		bodyParts.push('Explicit confirmation: required');
	}

	// ---- blockers ----
	if (p?.blockers !== undefined && p.blockers.length > 0) {
		bodyParts.push('');
		bodyParts.push('Blockers:');
		bodyParts.push(...formatIssues(p.blockers, 'blocker'));
	}

	// ---- warnings ----
	if (p?.warnings !== undefined && p.warnings.length > 0) {
		bodyParts.push('');
		bodyParts.push('Warnings:');
		bodyParts.push(...formatIssues(p.warnings, 'warning'));
	}

	// ---- missing critical questions ----
	if (
		p?.missingCriticalQuestions !== undefined &&
		p.missingCriticalQuestions.length > 0
	) {
		bodyParts.push('');
		bodyParts.push(
			...formatIdList(p.missingCriticalQuestions, 'Missing critical questions'),
		);
	}

	// ---- partial critical questions ----
	if (
		p?.partialCriticalQuestions !== undefined &&
		p.partialCriticalQuestions.length > 0
	) {
		bodyParts.push('');
		bodyParts.push(
			...formatIdList(p.partialCriticalQuestions, 'Partial critical questions'),
		);
	}

	// ---- unresolved contradictions ----
	if (p?.contradictions !== undefined && p.contradictions.length > 0) {
		bodyParts.push('');
		bodyParts.push(
			...formatIdList(p.contradictions, 'Unresolved contradictions'),
		);
	}

	// ---- required skipped questions ----
	if (
		p?.requiredSkippedQuestions !== undefined &&
		p.requiredSkippedQuestions.length > 0
	) {
		bodyParts.push('');
		bodyParts.push(
			...formatIdList(p.requiredSkippedQuestions, 'Required skipped questions'),
		);
	}

	// ---- optional missing ----
	if (
		p?.optionalMissingQuestions !== undefined &&
		p.optionalMissingQuestions.length > 0
	) {
		bodyParts.push('');
		bodyParts.push(
			...formatIdList(p.optionalMissingQuestions, 'Optional missing questions'),
		);
	}

	// ---- optional skipped ----
	if (
		p?.optionalSkippedQuestions !== undefined &&
		p.optionalSkippedQuestions.length > 0
	) {
		bodyParts.push('');
		bodyParts.push(
			...formatIdList(p.optionalSkippedQuestions, 'Optional skipped questions'),
		);
	}

	const enrichedBody = bodyParts.join(NL);

	// Determine message kind.
	const msgKind =
		message?.kind ??
		(p?.status === 'blocked' || p?.ready === false ? 'error' : 'warning');

	// Build metadata.
	const metadata: Record<string, unknown> = {};
	if (message?.metadata !== undefined) {
		Object.assign(metadata, message.metadata);
	}
	if (p !== undefined) {
		metadata.preflight = {
			canGeneratePartialDraft: p.canGeneratePartialDraft,
			checkedAt: p.checkedAt,
			completenessScore: p.completenessScore,
			ready: p.ready,
			requiresExplicitConfirmation: p.requiresExplicitConfirmation,
			status: p.status,
			...(p.mode !== undefined ? { mode: p.mode } : {}),
		};
		metadata.blockerCodes = p.blockers;
		metadata.warningCodes = p.warnings;
		if (p.missingCriticalQuestions !== undefined) {
			metadata.missingCriticalQuestions = p.missingCriticalQuestions;
		}
		if (p.partialCriticalQuestions !== undefined) {
			metadata.partialCriticalQuestions = p.partialCriticalQuestions;
		}
		if (p.contradictions !== undefined) {
			metadata.contradictions = p.contradictions;
		}
		if (p.requiredSkippedQuestions !== undefined) {
			metadata.requiredSkippedQuestions = p.requiredSkippedQuestions;
		}
	}

	const title =
		message?.title ??
		(p?.status === 'blocked' || p?.ready === false
			? 'LOGOS generation blocked'
			: 'LOGOS generation blockers');

	const rendered: LogosRenderedMessage = {
		body: enrichedBody,
		kind: msgKind,
		metadata,
		title,
		type: 'logos',
	};

	// ---- preserve blockers/warnings ----
	if (blockers !== undefined && blockers.length > 0) {
		rendered.blockers = [...blockers];
	} else if (p?.blockers !== undefined) {
		rendered.blockers = [...p.blockers];
	}

	if (warnings !== undefined && warnings.length > 0) {
		rendered.warnings = [...warnings];
	} else if (p?.warnings !== undefined) {
		rendered.warnings = [...p.warnings];
	}

	return rendered;
}
