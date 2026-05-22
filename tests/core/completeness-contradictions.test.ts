/**
 * Step 6.1 — Completeness contradiction tests.
 *
 * Tests:
 * 1. Unresolved contradiction makes question status contradictory.
 * 2. Contradictory question score is 0.
 * 3. Contradictory question is blocking.
 * 4. Contradiction id is included in question completeness.
 * 5. Resolved contradiction does not block if question is otherwise sufficient.
 * 6. Contradictory question id appears in contradictoryQuestionIds.
 */

import { describe, expect, it } from 'vitest';

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

describe('calculateIntakeCompleteness — contradictions', () => {
	// --- 1. Unresolved contradiction → contradictory ---
	it('unresolved contradiction makes question status contradictory', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			contradictions: {
				c1: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'q1',
					status: 'unresolved',
					summary: 'contradiction with prior',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.contradictory).toBe(1);
		expect(result.byQuestion.q1?.status).toBe('contradictory');
	});

	// --- 2. Contradictory score is 0 ---
	it('contradictory question score is 0', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			contradictions: {
				c1: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'q1',
					status: 'unresolved',
					summary: 'conflict',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.completenessScore).toBe(0);
		expect(result.completenessScore).toBe(0);
	});

	// --- 3. Contradictory question is blocking ---
	it('contradictory question is blocking', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			contradictions: {
				c1: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'q1',
					status: 'unresolved',
					summary: 'conflict',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.blocking).toBe(true);
		expect(result.blockingQuestionIds).toContain('q1');
	});

	// --- 4. Contradiction id in question completeness ---
	it('contradiction id is included in question completeness', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			contradictions: {
				contra_123: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'contra_123',
					questionId: 'q1',
					status: 'unresolved',
					summary: 'conflict',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.contradictionIds).toContain('contra_123');
	});

	// --- 5. Resolved contradiction does not block if otherwise sufficient ---
	it('resolved contradiction does not block when question is sufficient', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'resolved answer',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q1',
					status: 'sufficient',
				},
			},
			contradictions: {
				c1: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'q1',
					resolution: 'User chose option A',
					resolvedAt: '2026-01-02T00:00:00.000Z',
					status: 'resolved',
					summary: 'old conflict',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.contradictory).toBe(0);
		expect(result.byQuestion.q1?.status).toBe('sufficient');
		expect(result.byQuestion.q1?.completenessScore).toBe(1);
		expect(result.byQuestion.q1?.blocking).toBe(false);
		expect(result.byQuestion.q1?.contradictionIds).toHaveLength(0);
	});

	// --- 6. Contradictory in contradictoryQuestionIds ---
	it('contradictory question id appears in contradictoryQuestionIds', () => {
		const questions = [createQuestion('q1'), createQuestion('q2')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q2: {
					answer: 'good',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q2',
					status: 'sufficient',
				},
			},
			contradictions: {
				c1: {
					conflictsWithQuestionIds: ['q2'],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'q1',
					status: 'unresolved',
					summary: 'contradicts q2',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.contradictoryQuestionIds).toContain('q1');
		expect(result.contradictoryQuestionIds).not.toContain('q2');
	});

	// --- Additional: multiple contradictions on the same question ---
	it('multiple unresolved contradictions are all included', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			contradictions: {
				c1: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'q1',
					status: 'unresolved',
					summary: 'conflict A',
				},
				c2: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c2',
					questionId: 'q1',
					status: 'unresolved',
					summary: 'conflict B',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.status).toBe('contradictory');
		expect(result.byQuestion.q1?.contradictionIds).toHaveLength(2);
		expect(result.byQuestion.q1?.contradictionIds).toContain('c1');
		expect(result.byQuestion.q1?.contradictionIds).toContain('c2');
	});

	// --- Additional: resolved contradiction + missing answer → still missing ---
	it('resolved contradiction without sufficient answer → still missing', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			contradictions: {
				c1: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'q1',
					resolution: 'resolved',
					resolvedAt: '2026-01-02T00:00:00.000Z',
					status: 'resolved',
					summary: 'old conflict',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		// No sufficient answer → missing
		expect(result.contradictory).toBe(0);
		expect(result.byQuestion.q1?.status).toBe('missing');
		expect(result.byQuestion.q1?.contradictionIds).toHaveLength(0);
	});

	// --- Additional: contradiction wins over sufficient answer ---
	it('unresolved contradiction wins over existing sufficient answer', () => {
		const questions = [createQuestion('q1')];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				q1: {
					answer: 'previously sufficient',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'q1',
					status: 'sufficient',
				},
			},
			contradictions: {
				c1: {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'c1',
					questionId: 'q1',
					status: 'unresolved',
					summary: 'new contradiction',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byQuestion.q1?.status).toBe('contradictory');
		expect(result.contradictory).toBe(1);
		expect(result.sufficient).toBe(0);
		expect(result.blockingQuestionIds).toContain('q1');
	});
});
