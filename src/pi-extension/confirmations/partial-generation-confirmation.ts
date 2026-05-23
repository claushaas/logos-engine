/**
 * LOGOS Pi Extension — Partial generation confirmation detection (Step 9.3).
 *
 * Provides a structured detection helper that looks at Core generation
 * result data (not message text) to decide whether partial draft
 * generation requires explicit user confirmation.
 *
 * Also provides adapter-level safe result creators for cancellation
 * and no-UI-blocked paths.  These are Pi adapter presentation results,
 * not Core product state.
 *
 * Boundary: must not import Core internals, Pi runtime values, or
 * legacy CLI/TUI/Ink/React modules.
 */

import type { CoreResult } from '../../core/index.js';
import { createCoreResult } from '../../core/index.js';

// ---------------------------------------------------------------------------
// Detection helper
// ---------------------------------------------------------------------------

/**
 * Structured detection result for partial generation confirmation.
 *
 * `required: true` means the adapter must ask the user for explicit
 * confirmation via `ctx.ui.confirm(...)` before calling
 * `core.generate(...)` with a partial draft confirmation flag.
 */
export type PartialGenerationConfirmationRequirement =
	| {
			required: true;
			canGeneratePartialDraft: boolean;
			reason: string;
	  }
	| {
			required: false;
	  };

/**
 * Inspect a Core generation result and decide whether partial draft
 * generation requires explicit user confirmation.
 *
 * Detection relies on structured result data (`status`,
 * `data.requiresExplicitConfirmation`, `data.preflight`,
 * `data.partialDraft`, `message.kind`), never on message body text.
 *
 * Recognised patterns:
 * 1. `status: "confirmation_required"` with `message.kind:
 *    "confirmation_request"` — Core is asking for confirmation before
 *    partial draft generation.
 * 2. `status: "blocked"` from a final-mode generate where preflight
 *    indicates `requiresExplicitConfirmation: true` and
 *    `canGeneratePartialDraft: true` — final is blocked but partial
 *    draft is possible with confirmation.
 *
 * If the shape is unrecognised, returns `{ required: false }`.
 * Does not mutate the result.
 */
export function getPartialGenerationConfirmationRequirement(
	result: CoreResult<unknown>,
): PartialGenerationConfirmationRequirement {
	const data = result.data as Record<string, unknown> | undefined;

	// Pattern 1: explicit confirmation_required from Core (partial_draft
	// mode without confirmation).
	if (
		result.status === 'confirmation_required' &&
		result.message.kind === 'confirmation_request' &&
		data !== undefined &&
		data.requiresExplicitConfirmation === true
	) {
		const preflight = data.preflight as Record<string, unknown> | undefined;
		return {
			canGeneratePartialDraft: preflight?.canGeneratePartialDraft === true,
			reason:
				preflight !== undefined &&
				Array.isArray(preflight.blockers) &&
				preflight.blockers.length > 0
					? 'Final generation is blocked, but an incomplete partial draft can be created.'
					: 'Partial draft generation requires explicit confirmation.',
			required: true,
		};
	}

	// Pattern 2: blocked final generation where partial draft is possible.
	// Core returns status "blocked" with preflight.canGeneratePartialDraft
	// and requiresExplicitConfirmation.
	if (
		result.status === 'blocked' &&
		data !== undefined &&
		data.requiresExplicitConfirmation === true
	) {
		const preflight = data.preflight as Record<string, unknown> | undefined;
		if (preflight?.canGeneratePartialDraft === true) {
			return {
				canGeneratePartialDraft: true,
				reason:
					Array.isArray(preflight.blockers) && preflight.blockers.length > 0
						? 'Final generation is blocked, but an incomplete partial draft can be created.'
						: 'Partial draft generation requires explicit confirmation.',
				required: true,
			};
		}
	}

	return { required: false };
}

// ---------------------------------------------------------------------------
// Adapter-level safe result creators
// ---------------------------------------------------------------------------

/**
 * Create a Pi-adapter-level result for when the user declines partial
 * draft confirmation.
 *
 * This is NOT a Core product state — it is adapter feedback rendered to
 * the user.  No files are written.  Core is not called again.
 */
export function createPartialGenerationCancelledResult(): CoreResult<{
	mode: 'partial_draft';
	generatedPaths: [];
	wroteFiles: false;
	confirmationProvided: false;
	skippedReason: string;
}> {
	return createCoreResult({
		data: {
			confirmationProvided: false,
			generatedPaths: [],
			mode: 'partial_draft',
			skippedReason: 'user_declined_partial_generation',
			wroteFiles: false,
		},
		message: {
			body: 'Partial draft generation cancelled. No files were written.',
			kind: 'status',
		},
		status: 'noop',
	});
}

/**
 * Create a Pi-adapter-level result for when confirmation UI is
 * unavailable and partial generation cannot proceed.
 *
 * This is NOT a Core product state — it is adapter feedback rendered to
 * the user.  No files are written.  Core is not called again.
 */
export function createNoUiBlockedResult(): CoreResult<{
	mode: 'partial_draft';
	generatedPaths: [];
	wroteFiles: false;
	confirmationProvided: false;
	requiresExplicitConfirmation: true;
	skippedReason: string;
}> {
	return createCoreResult({
		data: {
			confirmationProvided: false,
			generatedPaths: [],
			mode: 'partial_draft',
			requiresExplicitConfirmation: true,
			skippedReason: 'confirmation_ui_unavailable',
			wroteFiles: false,
		},
		message: {
			body: 'Partial draft generation requires interactive confirmation, but no UI confirmation channel is available. No files were written.',
			kind: 'warning',
		},
		status: 'blocked',
	});
}
