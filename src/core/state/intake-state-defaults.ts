/**
 * LOGOS Core — Intake state defaults.
 *
 * Factory for creating a default LogosIntakeState for new projects.
 */

import type { LogosIntakeState } from './intake-state-types.js';

export type CreateDefaultIntakeStateInput = {
	projectRoot: string;
	now: string;
};

/**
 * Create a default intake state for a new project.
 *
 * - version: 1
 * - mode: "idle"
 * - empty records for answers, partials, skipped, contradictions
 * - zero progress counts
 * - no active prompt
 */
export function createDefaultIntakeState(
	input: CreateDefaultIntakeStateInput,
): LogosIntakeState {
	return {
		answeredQuestions: {},
		contradictions: {},
		initializedAt: input.now,
		mode: 'idle',
		partialQuestions: {},
		progress: {
			byPhase: {},
			contradictory: 0,
			missing: 0,
			partial: 0,
			skipped: 0,
			sufficient: 0,
			total: 0,
		},
		projectRoot: input.projectRoot,
		skippedQuestions: {},
		updatedAt: input.now,
		version: 1,
	};
}
