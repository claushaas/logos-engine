/**
 * Step 6.1 — Completeness by-phase tests.
 *
 * Tests:
 * 1. Completeness is grouped by phase.
 * 2. Each phase has correct total/sufficient/partial/missing/contradictory/skipped counts.
 * 3. Each phase score is calculated from its own questions.
 * 4. byPhase includes all phases represented in the registry.
 * 5. Blocking question ids are grouped per phase.
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

describe('calculateIntakeCompleteness — by phase', () => {
	// --- 1 & 2: Grouped by phase with correct counts ---
	it('groups completeness by phase with correct counts', () => {
		const questions = [
			// Phase 1: 3 questions (1 sufficient, 1 partial, 1 missing)
			createQuestion('p1.q1', {
				phaseId: '01-foundation',
				priority: 'critical',
				required: true,
			}),
			createQuestion('p1.q2', {
				phaseId: '01-foundation',
				priority: 'important',
				required: true,
			}),
			createQuestion('p1.q3', {
				phaseId: '01-foundation',
				priority: 'optional',
				required: false,
			}),
			// Phase 2: 2 questions (both sufficient)
			createQuestion('p2.q1', {
				phaseId: '02-validation',
				priority: 'critical',
				required: true,
			}),
			createQuestion('p2.q2', {
				phaseId: '02-validation',
				priority: 'important',
				required: true,
			}),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				'p1.q1': {
					answer: 'good',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'p1.q1',
					status: 'sufficient',
				},
				'p1.q2': {
					answer: 'partial',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'p1.q2',
					status: 'partial',
				},
				'p2.q1': {
					answer: 'good',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'p2.q1',
					status: 'sufficient',
				},
				'p2.q2': {
					answer: 'good',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'p2.q2',
					status: 'sufficient',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		// Phase 1
		const p1 = result.byPhase['01-foundation'];
		expect(p1).toBeDefined();
		expect(p1?.total).toBe(3);
		expect(p1?.sufficient).toBe(1);
		expect(p1?.partial).toBe(1);
		expect(p1?.missing).toBe(1);
		expect(p1?.contradictory).toBe(0);
		expect(p1?.skipped).toBe(0);
		expect(p1?.requiredTotal).toBe(2);

		// Phase 2
		const p2 = result.byPhase['02-validation'];
		expect(p2).toBeDefined();
		expect(p2?.total).toBe(2);
		expect(p2?.sufficient).toBe(2);
		expect(p2?.partial).toBe(0);
		expect(p2?.missing).toBe(0);
		expect(p2?.contradictory).toBe(0);
		expect(p2?.skipped).toBe(0);
		expect(p2?.requiredTotal).toBe(2);
	});

	// --- 3: Phase score calculated from own questions ---
	it('each phase score is calculated from its own questions', () => {
		const questions = [
			// Phase 1: 2 missing → score 0
			createQuestion('p1.q1', {
				phaseId: '01-foundation',
				priority: 'critical',
				required: true,
			}),
			createQuestion('p1.q2', {
				phaseId: '01-foundation',
				priority: 'critical',
				required: true,
			}),
			// Phase 2: 2 sufficient → score 1
			createQuestion('p2.q1', {
				phaseId: '02-validation',
				priority: 'critical',
				required: true,
			}),
			createQuestion('p2.q2', {
				phaseId: '02-validation',
				priority: 'critical',
				required: true,
			}),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				'p2.q1': {
					answer: 'good',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'p2.q1',
					status: 'sufficient',
				},
				'p2.q2': {
					answer: 'good',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'p2.q2',
					status: 'sufficient',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byPhase['01-foundation']?.completenessScore).toBeCloseTo(
			0,
			5,
		);
		expect(result.byPhase['02-validation']?.completenessScore).toBeCloseTo(
			1,
			5,
		);
		// Overall should be 0.5
		expect(result.completenessScore).toBeCloseTo(0.5, 5);
	});

	// --- 4: byPhase includes all phases ---
	it('byPhase includes all phases represented in the registry', () => {
		const questions = [
			createQuestion('a.q', { phaseId: '01-foundation' }),
			createQuestion('b.q', { phaseId: '03-product' }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(Object.keys(result.byPhase)).toHaveLength(2);
		expect(result.byPhase['01-foundation']).toBeDefined();
		expect(result.byPhase['03-product']).toBeDefined();
	});

	// --- 5: Blocking per phase ---
	it('blocking question ids are grouped per phase', () => {
		const questions = [
			createQuestion('p1.blocking', {
				phaseId: '01-foundation',
				priority: 'critical',
				required: true,
			}),
			createQuestion('p1.sufficient', {
				phaseId: '01-foundation',
				priority: 'important',
				required: true,
			}),
			createQuestion('p2.blocking', {
				phaseId: '02-validation',
				priority: 'critical',
				required: true,
			}),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				'p1.sufficient': {
					answer: 'good',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'p1.sufficient',
					status: 'sufficient',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		const p1 = result.byPhase['01-foundation'];
		expect(p1?.blockingQuestionIds).toContain('p1.blocking');
		expect(p1?.blockingQuestionIds).not.toContain('p1.sufficient');

		const p2 = result.byPhase['02-validation'];
		expect(p2?.blockingQuestionIds).toContain('p2.blocking');
	});

	// --- Additional: single phase only ---
	it('works correctly with a single phase', () => {
		const questions = [
			createQuestion('q1', { phaseId: '01-foundation' }),
			createQuestion('q2', { phaseId: '01-foundation' }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(Object.keys(result.byPhase)).toHaveLength(1);
		expect(result.byPhase['01-foundation']?.total).toBe(2);
	});

	// --- Additional: phase with no questions is not present ---
	it('phases with no questions are absent from byPhase', () => {
		const questions = [createQuestion('q1', { phaseId: '01-foundation' })];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.byPhase['02-validation']).toBeUndefined();
	});

	// --- Additional: critical counts per phase ---
	it('critical counts are per-phase', () => {
		const questions = [
			createQuestion('p1.crit', {
				phaseId: '01-foundation',
				priority: 'critical',
				required: true,
			}),
			createQuestion('p1.imp', {
				phaseId: '01-foundation',
				priority: 'important',
				required: true,
			}),
			createQuestion('p2.crit', {
				phaseId: '02-validation',
				priority: 'critical',
				required: true,
			}),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				'p1.crit': {
					answer: 'ok',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'p1.crit',
					status: 'sufficient',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		const p1 = result.byPhase['01-foundation'];
		expect(p1?.criticalTotal).toBe(1);
		expect(p1?.criticalSufficient).toBe(1);
		expect(p1?.missingCriticalQuestionIds).toHaveLength(0);

		const p2 = result.byPhase['02-validation'];
		expect(p2?.criticalTotal).toBe(1);
		expect(p2?.criticalSufficient).toBe(0);
		expect(p2?.missingCriticalQuestionIds).toContain('p2.crit');
	});
});
