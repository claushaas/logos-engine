/**
 * Step 6.1 — Completeness calculation tests.
 *
 * Tests:
 * 1. Empty registry returns score 0 and warning.
 * 2. All missing required questions produce score 0.
 * 3. Sufficient answers produce score 1.
 * 4. Partial answers produce partial score and partial count.
 * 5. Insufficient/needs-clarification answers do not count as sufficient.
 * 6. Optional skipped questions are not blocking.
 * 7. Required skipped questions are blocking and listed.
 * 8. Overall counts are correct.
 * 9. byQuestion includes every registry question.
 * 10. Function does not mutate input registry or intake state.
 */

import { describe, expect, it } from 'vitest';
import type { QuestionCompleteness } from '../../src/core/generation/completeness.js';
import { calculateIntakeCompleteness } from '../../src/core/generation/completeness.js';
import type { LogosQuestionRegistry } from '../../src/core/questions/question-registry.js';
import type { LogosQuestion } from '../../src/core/questions/question-types.js';
import type { LogosIntakeState } from '../../src/core/state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function createQuestion(
	id: string,
	overrides?: Partial<LogosQuestion>,
): LogosQuestion {
	return {
		acceptanceCriteria: [],
		completionSignals: [],
		documentId: overrides?.documentId ?? 'doc',
		followUpPolicy: {
			askForExamples: true,
			askForTradeoffs: true,
			maxFollowUps: 3,
		},
		id,
		insufficiencySignals: [],
		phaseId: overrides?.phaseId ?? '01-foundation',
		priority: overrides?.priority ?? 'critical',
		profileId: 'standard',
		purpose: `Purpose for ${id}`,
		question: `Question ${id}?`,
		required: overrides?.required ?? true,
		sectionId: overrides?.sectionId ?? 'sec',
		sourcePath: `/profiles/standard/doc.yml`,
		...overrides,
	};
}

function createRegistry(questions: LogosQuestion[]): LogosQuestionRegistry {
	const byId: Record<string, LogosQuestion> = {};
	const byPhase: Record<string, string[]> = {};
	const byDocument: Record<string, string[]> = {};
	const bySection: Record<string, string[]> = {};

	for (const q of questions) {
		byId[q.id] = q;
		let phaseList = byPhase[q.phaseId];
		if (phaseList === undefined) {
			phaseList = [];
			byPhase[q.phaseId] = phaseList;
		}
		phaseList.push(q.id);
		let docList = byDocument[q.documentId];
		if (docList === undefined) {
			docList = [];
			byDocument[q.documentId] = docList;
		}
		docList.push(q.id);
		const secKey = `${q.documentId}.${q.sectionId}`;
		let secList = bySection[secKey];
		if (secList === undefined) {
			secList = [];
			bySection[secKey] = secList;
		}
		secList.push(q.id);
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

function createIntakeState(
	overrides?: Partial<LogosIntakeState>,
): LogosIntakeState {
	return {
		answeredQuestions: {},
		contradictions: {},
		initializedAt: '2026-01-01T00:00:00.000Z',
		mode: 'intake_active',
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
		projectRoot: '/project',
		skippedQuestions: {},
		updatedAt: '2026-01-01T00:00:00.000Z',
		version: 1,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateIntakeCompleteness', () => {
	// --- 1. Empty registry ---
	it('returns score 0 and warning for empty registry', () => {
		const registry = createRegistry([]);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.total).toBe(0);
		expect(result.completenessScore).toBe(0);
		expect(result.warnings).toContain('question_registry_empty');
		expect(Object.keys(result.byQuestion)).toHaveLength(0);
		expect(Object.keys(result.byPhase)).toHaveLength(0);
	});

	// --- 2. All missing required → score 0 ---
	it('all missing required questions produce score 0', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
			createQuestion('q2', { priority: 'critical', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.completenessScore).toBe(0);
		expect(result.sufficient).toBe(0);
		expect(result.missing).toBe(2);
		expect(result.missingCriticalQuestionIds).toHaveLength(2);
		expect(result.missingCriticalQuestionIds).toContain('q1');
		expect(result.missingCriticalQuestionIds).toContain('q2');
		expect(result.blockingQuestionIds).toHaveLength(2);
	});

	// --- 3. Sufficient answers → score 1 ---
	it('all sufficient answers produce score 1', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
			createQuestion('q2', { priority: 'important', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'answer 1',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q1',
					status: 'sufficient',
				},
				q2: {
					answer: 'answer 2',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q2',
					status: 'sufficient',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.completenessScore).toBeCloseTo(1, 5);
		expect(result.sufficient).toBe(2);
		expect(result.missing).toBe(0);
		expect(result.requiredSufficient).toBe(2);
		expect(result.criticalSufficient).toBe(1);
		expect(result.blockingQuestionIds).toHaveLength(0);
	});

	// --- 4. Partial answers → partial score and count ---
	it('partial answers produce partial score and count', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
			createQuestion('q2', { priority: 'important', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'partial answer',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q1',
					status: 'partial',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.sufficient).toBe(0);
		expect(result.partial).toBe(1);
		expect(result.missing).toBe(1);
		expect(result.completenessScore).toBeCloseTo(0.25, 5); // (0.5 + 0) / 2
		expect(result.partialCriticalQuestionIds).toContain('q1');
	});

	// --- 5. Insufficient/needs-clarification do not count as sufficient ---
	it('insufficient answer does not count as sufficient', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'vague',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q1',
					status: 'insufficient',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.sufficient).toBe(0);
		expect(result.partial).toBe(1); // insufficient → partial
		expect(result.completenessScore).toBeCloseTo(0.25, 5);
	});

	it('needs_clarification answer does not count as sufficient', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'huh?',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q1',
					status: 'needs_clarification',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.sufficient).toBe(0);
		expect(result.partial).toBe(1);
		expect(result.completenessScore).toBeCloseTo(0.25, 5);
	});

	// --- 6. Optional skipped → not blocking ---
	it('optional skipped questions are not blocking', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
			createQuestion('q2', { priority: 'optional', required: false }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			skippedQuestions: {
				q2: {
					questionId: 'q2',
					reason: 'not needed',
					skippedAt: '2026-01-01T00:00:00.000Z',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.skipped).toBe(1);
		expect(result.blockingQuestionIds).not.toContain('q2');
		expect(result.byQuestion.q2?.status).toBe('skipped');
		expect(result.byQuestion.q2?.blocking).toBe(false);
		expect(result.byQuestion.q2?.completenessScore).toBe(1);
	});

	// --- 7. Required skipped → blocking ---
	it('required skipped questions are blocking and listed', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			skippedQuestions: {
				q1: {
					questionId: 'q1',
					reason: 'cannot answer now',
					skippedAt: '2026-01-01T00:00:00.000Z',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.blockingQuestionIds).toContain('q1');
		expect(result.skippedRequiredQuestionIds).toContain('q1');
		expect(result.byQuestion.q1?.status).toBe('partial'); // required skipped → partial
		expect(result.byQuestion.q1?.blocking).toBe(true);
		expect(result.byQuestion.q1?.completenessScore).toBe(0);
	});

	// --- 8. Overall counts are correct ---
	it('overall counts match question status distribution', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }), // sufficient
			createQuestion('q2', { priority: 'important', required: true }), // partial
			createQuestion('q3', { priority: 'critical', required: true }), // missing
			createQuestion('q4', { priority: 'optional', required: false }), // skipped (optional)
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'good',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q1',
					status: 'sufficient',
				},
				q2: {
					answer: 'partial',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q2',
					status: 'partial',
				},
			},
			skippedQuestions: {
				q4: {
					questionId: 'q4',
					reason: 'skip',
					skippedAt: '2026-01-01T00:00:00.000Z',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.total).toBe(4);
		expect(result.sufficient).toBe(1);
		expect(result.partial).toBe(1);
		expect(result.missing).toBe(1);
		expect(result.skipped).toBe(1);
		expect(result.contradictory).toBe(0);
		expect(result.requiredTotal).toBe(3);
		expect(result.requiredSufficient).toBe(1);
		expect(result.criticalTotal).toBe(2);
		expect(result.criticalSufficient).toBe(1);
	});

	// --- 9. byQuestion includes every registry question ---
	it('byQuestion includes every registry question', () => {
		const questions = [
			createQuestion('a.q'),
			createQuestion('b.q'),
			createQuestion('c.q'),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(Object.keys(result.byQuestion)).toHaveLength(3);
		expect(result.byQuestion['a.q']).toBeDefined();
		expect(result.byQuestion['b.q']).toBeDefined();
		expect(result.byQuestion['c.q']).toBeDefined();
	});

	// --- 10. Immutability ---
	it('does not mutate input registry or intake state', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'answer',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q1',
					status: 'sufficient',
				},
			},
		});

		const registrySnapshot = JSON.stringify(registry);
		const stateSnapshot = JSON.stringify(intakeState);

		calculateIntakeCompleteness({ intakeState, registry });

		expect(JSON.stringify(registry)).toBe(registrySnapshot);
		expect(JSON.stringify(intakeState)).toBe(stateSnapshot);
	});

	// --- Additional: evaluation completeness score carried through metadata ---
	it('uses completenessScore from answer metadata when present', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'partial with score',
					answeredAt: '2026-01-01T00:00:00.000Z',
					metadata: { completenessScore: 0.8 },
					questionId: 'q1',
					status: 'partial',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.completenessScore).toBe(0.8);
		expect(result.completenessScore).toBeCloseTo(0.8, 5);
	});

	// --- Additional: negative scores clamped to 0, >1 clamped to 1 ---
	it('clamps invalid completeness scores', () => {
		const questions = [createQuestion('q1'), createQuestion('q2')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'a',
					answeredAt: '2026-01-01T00:00:00.000Z',
					metadata: { completenessScore: -0.5 },
					questionId: 'q1',
					status: 'partial',
				},
				q2: {
					answer: 'b',
					answeredAt: '2026-01-01T00:00:00.000Z',
					metadata: { completenessScore: 2.5 },
					questionId: 'q2',
					status: 'partial',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.completenessScore).toBe(0);
		expect(result.byQuestion.q2?.completenessScore).toBe(1);
	});

	// --- Additional: cross-validation warnings for unknown references
	it('warns on records referencing unknown question ids', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			activeQuestionId: 'also_unknown',
			answeredQuestions: {
				unknown_q: {
					answer: 'orphan',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'unknown_q',
					status: 'sufficient',
				},
			},
			contradictions: {
				c1: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'ghost_q',
					status: 'unresolved',
					summary: 'ghost',
				},
			},
			partialQuestions: {
				unknown_p: {
					missingAspects: [],
					questionId: 'unknown_p',
					recordedAt: '2026-01-01T00:00:00.000Z',
				},
			},
			skippedQuestions: {
				unknown_s: {
					questionId: 'unknown_s',
					reason: 'skip',
					skippedAt: '2026-01-01T00:00:00.000Z',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.warnings).toEqual(
			expect.arrayContaining([
				expect.stringContaining('unknown_q'),
				expect.stringContaining('unknown_p'),
				expect.stringContaining('unknown_s'),
				expect.stringContaining('ghost_q'),
				expect.stringContaining('also_unknown'),
			]),
		);
	});

	// --- Additional: byQuestion status is deterministic for each status type
	it('correctly classifies each status type', () => {
		const questions = [
			createQuestion('q_sufficient', {
				phaseId: 'p1',
				priority: 'critical',
				required: true,
			}),
			createQuestion('q_missing', {
				phaseId: 'p1',
				priority: 'critical',
				required: true,
			}),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q_sufficient: {
					answer: 'ok',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q_sufficient',
					status: 'sufficient',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		const sufficientQc = result.byQuestion.q_sufficient as QuestionCompleteness;
		expect(sufficientQc.status).toBe('sufficient');
		expect(sufficientQc.completenessScore).toBe(1);
		expect(sufficientQc.blocking).toBe(false);
		expect(sufficientQc.generationCritical).toBe(true);

		const missingQc = result.byQuestion.q_missing as QuestionCompleteness;
		expect(missingQc.status).toBe('missing');
		expect(missingQc.completenessScore).toBe(0);
		expect(missingQc.blocking).toBe(true);
		expect(missingQc.generationCritical).toBe(true);
	});

	// --- Additional: generationCritical only when required + priority critical
	it('generationCritical is false for important required', () => {
		const questions = [
			createQuestion('q1', { priority: 'important', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.generationCritical).toBe(false);
	});

	it('generationCritical is false for optional with any priority', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: false }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.generationCritical).toBe(false);
	});
});
