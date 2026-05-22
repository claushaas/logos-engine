/**
 * Step 6.1 — Completeness critical/required tests.
 *
 * Tests:
 * 1. Critical required missing question appears in missingCriticalQuestionIds.
 * 2. Critical required partial question appears in partialCriticalQuestionIds.
 * 3. Critical sufficient question increments criticalSufficient.
 * 4. Important required missing question is blocking but not listed as critical.
 * 5. Optional missing question is not blocking.
 * 6. Required skipped question appears in skippedRequiredQuestionIds.
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

describe('calculateIntakeCompleteness — critical/required', () => {
	// --- 1. Critical required missing → missingCriticalQuestionIds ---
	it('critical required missing appears in missingCriticalQuestionIds', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.missingCriticalQuestionIds).toContain('q1');
		expect(result.criticalTotal).toBe(1);
		expect(result.criticalSufficient).toBe(0);
	});

	// --- 2. Critical required partial → partialCriticalQuestionIds ---
	it('critical required partial appears in partialCriticalQuestionIds', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
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

		expect(result.partialCriticalQuestionIds).toContain('q1');
		expect(result.missingCriticalQuestionIds).not.toContain('q1');
		expect(result.criticalTotal).toBe(1);
		expect(result.criticalSufficient).toBe(0);
	});

	// --- 3. Critical sufficient → criticalSufficient ---
	it('critical sufficient increments criticalSufficient', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
			createQuestion('q2', { priority: 'critical', required: true }),
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
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.criticalTotal).toBe(2);
		expect(result.criticalSufficient).toBe(1);
		expect(result.missingCriticalQuestionIds).toContain('q2');
	});

	// --- 4. Important required missing → blocking but not critical ---
	it('important required missing is blocking but not listed as critical', () => {
		const questions = [
			createQuestion('q1', { priority: 'important', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		// Blocking because required
		expect(result.blockingQuestionIds).toContain('q1');
		// Not generationCritical
		expect(result.byQuestion.q1?.generationCritical).toBe(false);
		// Not in missingCriticalQuestionIds (only critical missing go there)
		expect(result.missingCriticalQuestionIds).not.toContain('q1');
		// Not in partialCriticalQuestionIds
		expect(result.partialCriticalQuestionIds).not.toContain('q1');
	});

	// --- 5. Optional missing → not blocking ---
	it('optional missing is not blocking', () => {
		const questions = [
			createQuestion('q1', { priority: 'optional', required: false }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState();

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.blockingQuestionIds).not.toContain('q1');
		expect(result.byQuestion.q1?.blocking).toBe(false);
		expect(result.byQuestion.q1?.generationCritical).toBe(false);
	});

	// --- 6. Required skipped → skippedRequiredQuestionIds ---
	it('required skipped appears in skippedRequiredQuestionIds', () => {
		const questions = [
			createQuestion('q1', { priority: 'critical', required: true }),
			createQuestion('q2', { priority: 'important', required: true }),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			skippedQuestions: {
				q1: {
					questionId: 'q1',
					reason: 'cannot answer',
					skippedAt: '2026-01-01T00:00:00.000Z',
				},
				q2: {
					questionId: 'q2',
					reason: 'cannot answer',
					skippedAt: '2026-01-01T00:00:00.000Z',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		expect(result.skippedRequiredQuestionIds).toContain('q1');
		expect(result.skippedRequiredQuestionIds).toContain('q2');
		expect(result.blockingQuestionIds).toContain('q1');
		expect(result.blockingQuestionIds).toContain('q2');
	});

	// --- Additional: critical required still blocking when important and optional present ---
	it('only required/critical missing are blocking', () => {
		const questions = [
			createQuestion('crit_miss', {
				priority: 'critical',
				required: true,
			}),
			createQuestion('imp_miss', {
				priority: 'important',
				required: true,
			}),
			createQuestion('opt_miss', {
				priority: 'optional',
				required: false,
			}),
			createQuestion('opt_suff', {
				priority: 'optional',
				required: false,
			}),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				opt_suff: {
					answer: 'ok',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'opt_suff',
					status: 'sufficient',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });

		// Blocking: only crit_miss and imp_miss (both required)
		expect(result.blockingQuestionIds).toHaveLength(2);
		expect(result.blockingQuestionIds).toContain('crit_miss');
		expect(result.blockingQuestionIds).toContain('imp_miss');
		expect(result.blockingQuestionIds).not.toContain('opt_miss');
		expect(result.blockingQuestionIds).not.toContain('opt_suff');

		// generationCritical: only crit_miss
		expect(result.byQuestion.crit_miss?.generationCritical).toBe(true);
		expect(result.byQuestion.imp_miss?.generationCritical).toBe(false);
		expect(result.byQuestion.opt_miss?.generationCritical).toBe(false);
	});

	// --- Additional: byPhase critical arrays ---
	it('phase-level critical arrays are populated', () => {
		const questions = [
			createQuestion('cq', {
				phaseId: '01-foundation',
				priority: 'critical',
				required: true,
			}),
			createQuestion('cp', {
				phaseId: '01-foundation',
				priority: 'critical',
				required: true,
			}),
		];
		const registry = createRegistry(questions);
		const intakeState = createIntakeState({
			answeredQuestions: {
				cp: {
					answer: 'partial',
					answeredAt: '2026-01-01T00:00:00.000Z',
					questionId: 'cp',
					status: 'partial',
				},
			},
		});

		const result = calculateIntakeCompleteness({ intakeState, registry });
		const phase = result.byPhase['01-foundation'];

		expect(phase).toBeDefined();
		expect(phase?.criticalTotal).toBe(2);
		expect(phase?.criticalSufficient).toBe(0);
		expect(phase?.missingCriticalQuestionIds).toContain('cq');
		expect(phase?.partialCriticalQuestionIds).toContain('cp');
	});
});
