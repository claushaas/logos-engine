/**
 * Tests for follow-up selection (Step 3.3).
 *
 * Covers:
 * - Active unresolved follow-up beats new unanswered questions.
 * - Active follow-up is re-emitted without advancing.
 * - Active follow-up referencing missing question returns blocked with reason active_prompt_invalid.
 * - Partial question can produce deterministic follow-up prompt.
 * - Follow-up prompt includes original questionId.
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

describe('follow-up selection', () => {
	it('active unresolved follow-up beats new unanswered questions', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'important',
		});
		const q2 = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'critical',
		});
		const registry = makeRegistry([q1, q2]);
		const intakeState = makeIntakeState({
			activePrompt: {
				kind: 'follow_up',
				questionId: q1.id,
				startedAt: NOW,
				updatedAt: NOW,
			},
			partialQuestions: {
				[q1.id]: {
					missingAspects: ['more detail'],
					questionId: q1.id,
					reason: 'answer was too vague',
					recordedAt: NOW,
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		// The follow-up on q1 should be selected, even though q2 is critical.
		expect(result.prompt?.questionId).toBe(q1.id);
		expect(result.prompt?.kind).toBe('follow_up');
	});

	it('active follow-up is re-emitted without advancing', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'important',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			activePrompt: {
				kind: 'follow_up',
				questionId: q1.id,
				startedAt: NOW,
				updatedAt: NOW,
			},
			partialQuestions: {
				[q1.id]: {
					missingAspects: ['missing info'],
					questionId: q1.id,
					recordedAt: NOW,
				},
			},
		});

		// Call selector twice — should return same follow-up both times.
		const r1 = selectNextPrompt({ intakeState, registry });
		const r2 = selectNextPrompt({ intakeState, registry });
		expect(r1.prompt?.questionId).toBe(q1.id);
		expect(r1.prompt?.kind).toBe('follow_up');
		expect(r2.prompt?.questionId).toBe(q1.id);
		expect(r2.prompt?.kind).toBe('follow_up');
	});

	it('active follow-up referencing missing question returns blocked', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'important',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			activePrompt: {
				kind: 'follow_up',
				questionId: 'nonexistent.q99', // not in registry
				startedAt: NOW,
				updatedAt: NOW,
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('blocked');
		expect(result.reason).toBe('active_prompt_invalid');
	});

	it('partial question can produce deterministic follow-up prompt', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			answeredQuestions: {
				[q1.id]: {
					answer: 'incomplete answer',
					answeredAt: NOW,
					questionId: q1.id,
					status: 'partial',
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		expect(result.prompt?.kind).toBe('follow_up');
		expect(result.prompt?.questionId).toBe(q1.id);
		expect(result.prompt?.text).toContain('clarification');
	});

	it('follow-up prompt includes original questionId', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			activePrompt: {
				followUpId: 'fu-001',
				kind: 'follow_up',
				questionId: q1.id,
				startedAt: NOW,
				updatedAt: NOW,
			},
			partialQuestions: {
				[q1.id]: {
					missingAspects: ['more context'],
					questionId: q1.id,
					recordedAt: NOW,
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.prompt?.questionId).toBe(q1.id);
		expect(result.prompt?.followUpId).toBe('fu-001');
	});

	it('active question prompt with partial status produces follow-up', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const q2 = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'important',
		});
		const registry = makeRegistry([q1, q2]);
		const intakeState = makeIntakeState({
			activePrompt: {
				kind: 'question',
				questionId: q1.id,
				startedAt: NOW,
				updatedAt: NOW,
			},
			answeredQuestions: {
				[q1.id]: {
					answer: 'insufficient',
					answeredAt: NOW,
					questionId: q1.id,
					status: 'insufficient',
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		expect(result.prompt?.questionId).toBe(q1.id);
		expect(result.prompt?.kind).toBe('follow_up');
	});

	it('active question prompt with sufficient status falls through', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'important',
		});
		const q2 = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'critical',
		});
		const registry = makeRegistry([q1, q2]);
		const intakeState = makeIntakeState({
			activePrompt: {
				kind: 'question',
				questionId: q1.id,
				startedAt: NOW,
				updatedAt: NOW,
			},
			answeredQuestions: {
				[q1.id]: {
					answer: 'sufficient answer',
					answeredAt: NOW,
					questionId: q1.id,
					status: 'sufficient',
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		// Falls through to next unanswered question (q2).
		expect(result.prompt?.questionId).toBe(q2.id);
	});
});
