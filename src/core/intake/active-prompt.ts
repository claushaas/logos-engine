/**
 * LOGOS Core — Active prompt builder (Step 3.3).
 *
 * Pure-function helpers that construct {@link ActivePrompt} instances from
 * question records, follow-up state, and contradiction records.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosQuestion } from '../questions/question-types.js';
import type { IntakeContradictionRecord } from '../state/intake-state-types.js';
import type { ActivePrompt } from './prompt-selection-types.js';

// ---------------------------------------------------------------------------
// Question prompt
// ---------------------------------------------------------------------------

/**
 * Build an `ActivePrompt` for a normal unanswered question.
 *
 * The prompt text is the question's `question` field verbatim.
 * All metadata (phase, document, section, source, priority) is carried
 * through from the source {@link LogosQuestion}.
 */
export function createQuestionPrompt(question: LogosQuestion): ActivePrompt {
	return {
		documentId: question.documentId,
		kind: 'question',
		phaseId: question.phaseId,
		priority: question.priority,
		questionId: question.id,
		required: question.required,
		sectionId: question.sectionId,
		sourcePath: question.sourcePath,
		text: question.question,
	};
}

// ---------------------------------------------------------------------------
// Follow-up prompt
// ---------------------------------------------------------------------------

export type CreateFollowUpPromptInput = {
	question: LogosQuestion;
	missingAspects: string[];
	reason?: string;
	followUpId?: string;
};

/**
 * Build an `ActivePrompt` for a targeted follow-up.
 *
 * The prompt text includes deterministic language asking the user to expand
 * on the missing aspects. The originating question's metadata is preserved.
 *
 * This helper is deterministic and does not call AI.
 */
export function createFollowUpPrompt(
	input: CreateFollowUpPromptInput,
): ActivePrompt {
	const { question, missingAspects, reason, followUpId } = input;

	let text: string;

	if (reason !== undefined && reason.length > 0) {
		text = `I need one clarification before moving on: ${reason} Please expand your answer.`;
	} else if (missingAspects.length > 0) {
		const joined = missingAspects.join(', ');
		text = `I need one clarification before moving on: ${joined}. Please expand your answer.`;
	} else {
		// Fallback when no specific aspects are known.
		text = `I need more detail on: "${question.question}" Please expand your answer.`;
	}

	const prompt: ActivePrompt = {
		context: question.question,
		documentId: question.documentId,
		kind: 'follow_up',
		phaseId: question.phaseId,
		priority: question.priority,
		questionId: question.id,
		required: question.required,
		sectionId: question.sectionId,
		sourcePath: question.sourcePath,
		text,
	};

	if (followUpId !== undefined) {
		prompt.followUpId = followUpId;
	}

	return prompt;
}

// ---------------------------------------------------------------------------
// Contradiction prompt
// ---------------------------------------------------------------------------

export type CreateContradictionPromptInput = {
	question: LogosQuestion;
	contradiction: IntakeContradictionRecord;
};

/**
 * Build an `ActivePrompt` for a contradiction resolution.
 *
 * The prompt text asks the user to resolve the contradiction and includes
 * the contradiction summary. Conflicting question ids are noted in the
 * context field for potential rendering.
 */
export function createContradictionPrompt(
	input: CreateContradictionPromptInput,
): ActivePrompt {
	const { question, contradiction } = input;

	const text =
		`There is an unresolved contradiction for this question: ${contradiction.summary}. ` +
		`Please clarify which direction should be treated as authoritative.`;

	const conflictList = contradiction.conflictsWithQuestionIds.join(', ');

	return {
		context: `Conflicts with question ids: ${conflictList}`,
		contradictionId: contradiction.id,
		documentId: question.documentId,
		kind: 'contradiction_resolution',
		phaseId: question.phaseId,
		priority: question.priority,
		questionId: question.id,
		required: question.required,
		sectionId: question.sectionId,
		sourcePath: question.sourcePath,
		text,
	};
}
