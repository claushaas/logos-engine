/**
 * LOGOS Core — Rebuild active prompt from persisted state (Step 5.2).
 *
 * Pure helper that reconstructs a full renderable {@link ActivePrompt} from
 * a persisted {@link ActivePromptState}, the question registry, and current
 * intake state (partials, answers, contradictions).
 *
 * Used by both {@link startIntakeTransition} and
 * {@link handleIntakeCommand} so that active-intake re-emission behaves
 * consistently across the two entry points.
 *
 * Returns `undefined` when the referenced question (or contradiction) no
 * longer exists in the registry.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosQuestionRegistry } from '../questions/question-registry.js';
import type {
	ActivePromptState,
	LogosIntakeState,
} from '../state/intake-state-types.js';
import {
	createContradictionPrompt,
	createFollowUpPrompt,
	createQuestionPrompt,
} from './active-prompt.js';
import type { ActivePrompt } from './prompt-selection-types.js';

/**
 * Rebuild a renderable {@link ActivePrompt} from a persisted
 * {@link ActivePromptState} and the question registry.
 *
 * Returns `undefined` when the referenced question (or contradiction)
 * no longer exists in the registry.
 */
export function rebuildActivePrompt(
	promptState: ActivePromptState,
	registry: LogosQuestionRegistry,
	intakeState: LogosIntakeState,
): ActivePrompt | undefined {
	const question = registry.byId[promptState.questionId];
	if (question === undefined) {
		return undefined;
	}

	switch (promptState.kind) {
		case 'question': {
			return createQuestionPrompt(question);
		}
		case 'follow_up': {
			const partialRecord =
				intakeState.partialQuestions[promptState.questionId];
			const answerRecord =
				intakeState.answeredQuestions[promptState.questionId];
			const missingAspects = partialRecord?.missingAspects ?? [];
			const reason = partialRecord?.reason ?? answerRecord?.status;

			const p = createFollowUpPrompt({
				missingAspects,
				question,
				...(reason !== undefined ? { reason } : {}),
			});
			if (promptState.followUpId !== undefined) {
				p.followUpId = promptState.followUpId;
			}
			return p;
		}
		case 'contradiction_resolution': {
			const contradictionId =
				promptState.contradictionId ??
				Object.keys(intakeState.contradictions).find(
					(cid) => intakeState.contradictions[cid]?.questionId === question.id,
				);

			const contradiction =
				contradictionId !== undefined
					? intakeState.contradictions[contradictionId]
					: undefined;

			if (contradiction === undefined) {
				return undefined;
			}

			return createContradictionPrompt({ contradiction, question });
		}
	}
}
