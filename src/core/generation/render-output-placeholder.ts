/**
 * LOGOS Core — Minimal partial draft placeholder renderer (Step 6.4).
 *
 * Produces deterministic, visibly incomplete placeholder content for
 * partial draft generation.  Used by the partial draft write executor.
 *
 * Does **not** implement full documentation generation, call AI, or
 * execute templates.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { createIncompleteDraftHeader } from './partial-draft.js';
import type { GenerationPreflightIssue } from './preflight-result.js';
import type { WritePlanOperation } from './write-plan.js';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type RenderPartialDraftPlaceholderInput = {
	operation: WritePlanOperation;
	preflight: {
		blockers: GenerationPreflightIssue[];
		warnings: GenerationPreflightIssue[];
		completenessScore: number;
		checkedAt: string;
	};
	now: string;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Render minimal incomplete placeholder content for a single write plan
 * operation.
 *
 * Content includes:
 * - Incomplete draft header (front-matter + visible marker)
 * - Operation output kind / phase / document ids
 * - Preflight completeness score
 * - Blocker and warning codes
 * - Note that full generation rendering is not implemented yet
 *
 * The output is deterministic for the same inputs.
 */
export function renderPartialDraftPlaceholder(
	input: RenderPartialDraftPlaceholderInput,
): string {
	const { operation, preflight, now } = input;

	const header = createIncompleteDraftHeader({
		blockers: preflight.blockers,
		checkedAt: preflight.checkedAt,
		reason:
			'This file was generated as a partial draft because critical intake information is missing, partial, or contradictory.',
		warnings: preflight.warnings,
	});

	const outputKind = operation.outputKind;
	const phaseId = operation.phaseId ?? '(none)';
	const documentId = operation.documentId ?? '(none)';
	const scorePct = Math.round(preflight.completenessScore * 100);

	const blockerCodes = preflight.blockers.map((b) => b.code).join(', ');
	const warningCodes = preflight.warnings.map((w) => w.code).join(', ');

	return [
		header,
		'',
		'---',
		'',
		'## Placeholder Content',
		'',
		`- **Output kind**: \`${outputKind}\``,
		`- **Phase**: \`${phaseId}\``,
		`- **Document**: \`${documentId}\``,
		`- **Completeness score**: ${scorePct}%`,
		`- **Generated at**: ${now}`,
		'',
		'### Blocker Codes',
		'',
		blockerCodes.length > 0 ? blockerCodes : '(none)',
		'',
		'### Warning Codes',
		'',
		warningCodes.length > 0 ? warningCodes : '(none)',
		'',
		'---',
		'',
		'## Note',
		'',
		'Full document generation rendering is not implemented yet.',
		'This placeholder was written by the LOGOS Engine partial draft',
		'confirmation boundary (Step 6.4).',
		'',
	].join('\n');
}
