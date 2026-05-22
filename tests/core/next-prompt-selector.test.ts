/**
 * Tests for the next prompt selector (Step 3.3).
 *
 * Covers:
 * - Empty registry returns blocked with reason registry_empty.
 * - First unanswered important question is selected when no contradictions/follow-ups exist.
 * - Critical unanswered beats important unanswered.
 * - Important unanswered beats optional unanswered.
 * - Partial critical beats important unanswered if priority order says so.
 * - Complete state returns complete.
 * - Selector returns only one prompt.
 * - Selection is deterministic across repeated calls.
 * - Skipped optional questions are not selected.
 * - Skipped required questions are treated as partial.
 */

import { describe, expect, it } from 'vitest';
import { selectNextPrompt } from '../../src/core/intake/next-prompt-selector.js';
import type { LogosQuestionRegistry } from '../../src/core/questions/question-registry.js';
import type { LogosQuestion } from '../../src/core/questions/question-types.js';
import { createDefaultIntakeState } from '../../src/core/state/intake-state-defaults.js';
import type { LogosIntakeState } from '../../src/core/state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00Z';
const ROOT = '/project';

let questionSeq = 0;

function q(overrides?: Partial<LogosQuestion>): LogosQuestion {
	questionSeq += 1;
	const idx = questionSeq;
	const id =
		overrides?.id ??
		`01-foundation.01-thesis.core-thesis.q${String(idx).padStart(2, '0')}`;
	return {
		acceptanceCriteria: [],
		completionSignals: [],
		documentId: '01-thesis',
		followUpPolicy: {
			askForExamples: true,
			askForTradeoffs: true,
			maxFollowUps: 3,
		},
		id,
		insufficiencySignals: [],
		phaseId: '01-foundation',
		priority: 'important',
		profileId: 'standard',
		purpose: 'Test question',
		question: `Test question ${idx}?`,
		required: true,
		sectionId: 'core-thesis',
		sourcePath: '/project/profiles/standard/phases/01-foundation/01-thesis.yml',
		...overrides,
	};
}

function makeRegistry(questions: LogosQuestion[]): LogosQuestionRegistry {
	const byId: Record<string, LogosQuestion> = {};
	const byPhase: Record<string, string[]> = {};
	const byDocument: Record<string, string[]> = {};
	const bySection: Record<string, string[]> = {};

	for (const qn of questions) {
		byId[qn.id] = qn;
		if (byPhase[qn.phaseId] === undefined) byPhase[qn.phaseId] = [];
		byPhase[qn.phaseId].push(qn.id);
		if (byDocument[qn.documentId] === undefined) byDocument[qn.documentId] = [];
		byDocument[qn.documentId].push(qn.id);
		const sectionKey = `${qn.documentId}.${qn.sectionId}`;
		if (bySection[sectionKey] === undefined) bySection[sectionKey] = [];
		bySection[sectionKey].push(qn.id);
	}

	return {
		byDocument,
		byId,
		byPhase,
		bySection,
		profileId: 'standard',
		questions,
		warnings: [],
	};
}

function makeIntakeState(
	overrides?: Partial<LogosIntakeState>,
): LogosIntakeState {
	return {
		...createDefaultIntakeState({ now: NOW, projectRoot: ROOT }),
		...overrides,
	};
}

function resetSeq(): void {
	questionSeq = 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectNextPrompt', () => {
	it('empty registry returns blocked with reason registry_empty', () => {
		const registry = makeRegistry([]);
		const intakeState = makeIntakeState();
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('blocked');
		expect(result.reason).toBe('registry_empty');
		expect(result.prompt).toBeUndefined();
	});

	it('selects first unanswered question by default', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'important',
		});
		const q2 = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'important',
		});
		const registry = makeRegistry([q1, q2]);
		const intakeState = makeIntakeState();
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		expect(result.reason).toBe('important_unanswered');
		expect(result.prompt?.questionId).toBe(q1.id);
	});

	it('critical unanswered beats important unanswered', () => {
		resetSeq();
		const qCritical = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const qImportant = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'important',
		});
		const registry = makeRegistry([qImportant, qCritical]); // order shouldn't matter
		const intakeState = makeIntakeState();
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.prompt?.questionId).toBe(qCritical.id);
		expect(result.reason).toBe('critical_unanswered');
	});

	it('important unanswered beats optional unanswered', () => {
		resetSeq();
		const qImportant = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'important',
		});
		const qOptional = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'optional',
		});
		const registry = makeRegistry([qOptional, qImportant]);
		const intakeState = makeIntakeState();
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.prompt?.questionId).toBe(qImportant.id);
		expect(result.reason).toBe('important_unanswered');
	});

	it('partial critical beats important unanswered', () => {
		resetSeq();
		const qCritical = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const qImportant = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'important',
		});
		const registry = makeRegistry([qImportant, qCritical]);
		const intakeState = makeIntakeState({
			answeredQuestions: {
				[qCritical.id]: {
					answer: 'incomplete',
					answeredAt: NOW,
					questionId: qCritical.id,
					status: 'partial',
				},
			},
		});
		const result = selectNextPrompt({ intakeState, registry });
		// Partial critical should still be selected before an important unanswered.
		expect(result.prompt?.questionId).toBe(qCritical.id);
		expect(result.prompt?.kind).toBe('follow_up');
	});

	it('returns complete when all questions are sufficient', () => {
		resetSeq();
		const q1 = q({ id: '01-foundation.01-thesis.core-thesis.q01' });
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			answeredQuestions: {
				[q1.id]: {
					answer: 'a sufficient answer',
					answeredAt: NOW,
					questionId: q1.id,
					status: 'sufficient',
				},
			},
		});
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('complete');
		expect(result.reason).toBe('complete');
	});

	it('returns only one prompt', () => {
		resetSeq();
		const questions = Array.from({ length: 10 }, (_, i) =>
			q({
				id: `01-foundation.01-thesis.core-thesis.q${String(i + 1).padStart(2, '0')}`,
				priority: 'important',
			}),
		);
		const registry = makeRegistry(questions);
		const intakeState = makeIntakeState();
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		expect(result.prompt).toBeDefined();
		// Only one prompt, not a dump of all questions.
	});

	it('is deterministic across repeated calls', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const q2 = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'critical',
		});
		const registry = makeRegistry([q1, q2]);
		const intakeState = makeIntakeState();

		const results = Array.from({ length: 5 }, () =>
			selectNextPrompt({ intakeState, registry }),
		);
		for (const r of results) {
			expect(r.prompt?.questionId).toBe(q1.id);
		}
	});

	it('skipped optional questions are not selected', () => {
		resetSeq();
		const qOptional = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'optional',
			required: false,
		});
		const qImportant = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'important',
		});
		const registry = makeRegistry([qOptional, qImportant]);
		const intakeState = makeIntakeState({
			skippedQuestions: {
				[qOptional.id]: {
					questionId: qOptional.id,
					reason: 'not relevant',
					skippedAt: NOW,
				},
			},
		});
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.prompt?.questionId).toBe(qImportant.id);
	});

	it('skipped required questions are treated as partial', () => {
		resetSeq();
		const qRequired = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
			required: true,
		});
		const qNext = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'important',
		});
		const registry = makeRegistry([qRequired, qNext]);
		const intakeState = makeIntakeState({
			skippedQuestions: {
				[qRequired.id]: {
					questionId: qRequired.id,
					reason: 'skipped',
					skippedAt: NOW,
				},
			},
		});
		const result = selectNextPrompt({ intakeState, registry });
		// Skipped required → partial → still selected before important unanswered.
		expect(result.prompt?.questionId).toBe(qRequired.id);
		expect(result.prompt?.kind).toBe('follow_up');
	});

	it('sufficient answer is not re-selected', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const q2 = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'critical',
		});
		const registry = makeRegistry([q1, q2]);
		const intakeState = makeIntakeState({
			answeredQuestions: {
				[q1.id]: {
					answer: 'a sufficient answer',
					answeredAt: NOW,
					questionId: q1.id,
					status: 'sufficient',
				},
			},
		});
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.prompt?.questionId).toBe(q2.id);
	});

	it('partial question produces follow-up prompt', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			answeredQuestions: {
				[q1.id]: {
					answer: 'vague',
					answeredAt: NOW,
					questionId: q1.id,
					status: 'insufficient',
				},
			},
		});
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		expect(result.prompt?.kind).toBe('follow_up');
		expect(result.prompt?.questionId).toBe(q1.id);
	});
});
