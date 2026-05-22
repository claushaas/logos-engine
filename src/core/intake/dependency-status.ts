/**
 * LOGOS Core — Dependency status helper (Step 3.3).
 *
 * Checks whether a question's dependencies are satisfied so it can be
 * selected by the next-prompt selector.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosQuestionRegistry } from '../questions/question-registry.js';
import type { LogosQuestion } from '../questions/question-types.js';
import type { LogosIntakeState } from '../state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Dependency resolution status for a single question.
 *
 * - `satisfied`: no dependencies, or all dependencies have sufficient answers.
 * - `blocked`: at least one dependency exists but does not have a sufficient
 *    answer.
 * - `unknown`: a dependency id references a question that does not exist in
 *    the registry.
 */
export type DependencyStatus = 'satisfied' | 'blocked' | 'unknown';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type CheckDependencyStatusInput = {
	question: LogosQuestion;
	registry: LogosQuestionRegistry;
	intakeState: LogosIntakeState;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Check whether a question is eligible for selection based on its dependencies.
 *
 * Rules:
 * - If the question has no `dependsOn`, it is immediately `satisfied`.
 * - For each dependency id:
 *   - If the dependency question is not in the registry → `unknown`.
 *   - If the dependency does not have a `sufficient` answer record → `blocked`.
 * - All dependencies must be `satisfied` for the question to be eligible.
 */
export function checkDependencyStatus(
	input: CheckDependencyStatusInput,
): DependencyStatus {
	const { question, registry, intakeState } = input;

	if (question.dependsOn === undefined || question.dependsOn.length === 0) {
		return 'satisfied';
	}

	let hasUnknown = false;

	for (const depId of question.dependsOn) {
		const depQuestion = registry.byId[depId];
		if (depQuestion === undefined) {
			hasUnknown = true;
			continue;
		}

		const answerRecord = intakeState.answeredQuestions[depId];
		if (answerRecord === undefined || answerRecord.status !== 'sufficient') {
			return 'blocked';
		}
	}

	if (hasUnknown) {
		return 'unknown';
	}

	return 'satisfied';
}
