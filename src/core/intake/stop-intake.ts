/**
 * LOGOS Core — Stop intake transition (Step 3.4).
 *
 * Implements the Core-owned stop/pause transition:
 *
 * 1. Load durable intake state.
 * 2. If mode is `intake_active`, set mode to `paused`, preserve
 *    `activePrompt` and `activeQuestionId`, and persist.
 * 3. If mode is already `paused`, `idle`, `complete`, or `generating`,
 *    return a noop result without mutation.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosFilesystem } from '../ports/filesystem.js';
import {
	loadIntakeState,
	saveIntakeState,
} from '../state/intake-state-persistence.js';
import type {
	ActivePromptState,
	IntakeProgress,
	LogosIntakeState,
} from '../state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export type StopIntakeTransitionInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	now: string;
	dryRun: boolean;
};

export type StopIntakeTransitionData = {
	mode: 'paused' | 'idle' | 'complete' | 'generating';
	activeQuestionId?: string | undefined;
	activePrompt?: ActivePromptState | undefined;
	progress: IntakeProgress;
	/** Whether state was changed by this call. */
	paused: boolean;
};

export type StopIntakeTransitionResult = {
	data: StopIntakeTransitionData;
	messageText: string;
	messageKind: string;
	warnings: string[];
};

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

/**
 * Execute the stop-intake transition.
 *
 * Does **not** wrap the result in a {@link CoreResult} envelope; the public
 * API layer (api.ts) is responsible for that.
 *
 * Required behaviour (from the spec):
 * - `stopIntake` must not require valid profile resolution to preserve state.
 * - `stopIntake` must not clear `activePrompt`.
 * - `stopIntake` must not clear `activeQuestionId`.
 * - `stopIntake` must not generate docs.
 * - `stopIntake` must not evaluate answers.
 * - `stopIntake` must persist updated mode and timestamp when pausing.
 *
 * When called while:
 * - `intake_active`: pauses, preserves active prompt, returns paused.
 * - `paused`: returns noop with active prompt preserved.
 * - `idle` / `complete` / `generating`: returns noop.
 */
export async function stopIntakeTransition(
	input: StopIntakeTransitionInput,
): Promise<StopIntakeTransitionResult> {
	const { projectRoot, filesystem, now, dryRun } = input;

	// Load intake state.  If it's missing (new project / never initialized),
	// return an idle noop.
	let intakeState: LogosIntakeState;
	try {
		const loadResult = await loadIntakeState({
			filesystem,
			now,
			projectRoot,
		});
		if (!loadResult.ok) {
			return {
				data: {
					mode: 'idle',
					paused: false,
					progress: {
						byPhase: {},
						contradictory: 0,
						missing: 0,
						partial: 0,
						skipped: 0,
						sufficient: 0,
						total: 0,
					},
				},
				messageKind: 'status',
				messageText: 'Intake is not active (failed to load intake state).',
				warnings: loadResult.errors,
			};
		}
		intakeState = loadResult.state;
	} catch {
		// If we can't load state at all, return idle noop.
		return {
			data: {
				mode: 'idle',
				paused: false,
				progress: {
					byPhase: {},
					contradictory: 0,
					missing: 0,
					partial: 0,
					skipped: 0,
					sufficient: 0,
					total: 0,
				},
			},
			messageKind: 'status',
			messageText: 'Intake is not active.',
			warnings: [],
		};
	}

	// ---- Already paused: noop ----
	if (intakeState.mode === 'paused') {
		return {
			data: {
				activePrompt: intakeState.activePrompt,
				activeQuestionId: intakeState.activeQuestionId,
				mode: 'paused',
				paused: false,
				progress: intakeState.progress,
			},
			messageKind: 'status',
			messageText: 'Intake is already paused.',
			warnings: [],
		};
	}

	// ---- idle / complete / generating: noop ----
	if (intakeState.mode !== 'intake_active') {
		return {
			data: {
				activePrompt: intakeState.activePrompt,
				activeQuestionId: intakeState.activeQuestionId,
				mode: intakeState.mode as 'idle' | 'complete' | 'generating',
				paused: false,
				progress: intakeState.progress,
			},
			messageKind: 'status',
			messageText: `Intake is not active (current mode: ${intakeState.mode}).`,
			warnings: [],
		};
	}

	// ---- intake_active: pause and preserve ----
	if (!dryRun) {
		intakeState = {
			...intakeState,
			mode: 'paused' as const,
			updatedAt: now,
		};

		await saveIntakeState({
			filesystem,
			projectRoot,
			state: intakeState,
		});
	}

	const progressSummary = formatProgressSummary(intakeState.progress);

	return {
		data: {
			activePrompt: intakeState.activePrompt,
			activeQuestionId: intakeState.activeQuestionId,
			mode: 'paused',
			paused: true,
			progress: intakeState.progress,
		},
		messageKind: 'status',
		messageText: `Intake paused. ${progressSummary}`,
		warnings: [],
	};
}

// ---------------------------------------------------------------------------
// Progress summary helper
// ---------------------------------------------------------------------------

function formatProgressSummary(progress: IntakeProgress): string {
	const parts: string[] = [];
	if (progress.sufficient > 0) {
		parts.push(`${progress.sufficient} sufficient`);
	}
	if (progress.partial > 0) {
		parts.push(`${progress.partial} partial`);
	}
	if (progress.missing > 0) {
		parts.push(`${progress.missing} missing`);
	}
	if (progress.contradictory > 0) {
		parts.push(`${progress.contradictory} contradictory`);
	}
	if (parts.length === 0) {
		return 'No questions answered yet.';
	}
	return `Progress: ${parts.join(', ')} (${progress.sufficient}/${progress.total} complete).`;
}
