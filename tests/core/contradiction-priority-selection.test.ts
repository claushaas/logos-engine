/**
 * Tests for contradiction priority selection (Step 3.3).
 *
 * Covers:
 * - Unresolved contradiction beats all unanswered questions.
 * - Multiple contradictions are selected deterministically by createdAt, then id.
 * - Resolved contradictions are ignored.
 * - Contradiction prompt includes contradictionId.
 * - Contradiction prompt does not silently resolve anything.
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

describe('contradiction priority selection', () => {
	it('unresolved contradiction beats all unanswered questions', () => {
		resetSeq();
		const qCritical = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const qContradicted = q({
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'important',
		});
		const registry = makeRegistry([qCritical, qContradicted]);
		const intakeState = makeIntakeState({
			contradictions: {
				'contra-1': {
					conflictsWithQuestionIds: ['01-foundation.01-thesis.core-thesis.q03'],
					createdAt: '2026-01-01T00:00:00Z',
					id: 'contra-1',
					questionId: qContradicted.id,
					status: 'unresolved',
					summary: 'User gave conflicting priorities.',
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		expect(result.prompt?.questionId).toBe(qContradicted.id);
		expect(result.prompt?.kind).toBe('contradiction_resolution');
		expect(result.reason).toBe('unresolved_contradiction');
	});

	it('multiple contradictions are selected deterministically by createdAt, then id', () => {
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
		const intakeState = makeIntakeState({
			contradictions: {
				'contra-a': {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00Z',
					id: 'contra-a',
					questionId: q1.id,
					status: 'unresolved',
					summary: 'Earlier contradiction.',
				},
				'contra-b': {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-02T00:00:00Z',
					id: 'contra-b',
					questionId: q2.id,
					status: 'unresolved',
					summary: 'Later contradiction.',
				},
			},
		});

		// Earlier createdAt should be selected first.
		const result = selectNextPrompt({ intakeState, registry });
		expect(result.prompt?.questionId).toBe(q1.id);
		expect(result.prompt?.contradictionId).toBe('contra-a');

		// Same createdAt, different id — tie-break by id.
		const intakeState2 = makeIntakeState({
			contradictions: {
				'contra-a': {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00Z',
					id: 'contra-a',
					questionId: q1.id,
					status: 'unresolved',
					summary: 'A contradiction.',
				},
				'contra-z': {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00Z',
					id: 'contra-z',
					questionId: q2.id,
					status: 'unresolved',
					summary: 'Z contradiction.',
				},
			},
		});

		const result2 = selectNextPrompt({
			intakeState: intakeState2,
			registry,
		});
		expect(result2.prompt?.contradictionId).toBe('contra-a');
	});

	it('resolved contradictions are ignored', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			contradictions: {
				'contra-1': {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00Z',
					id: 'contra-1',
					questionId: q1.id,
					status: 'resolved',
					summary: 'Already resolved.',
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		// Should fall through to normal question selection.
		expect(result.status).toBe('selected');
		expect(result.prompt?.questionId).toBe(q1.id);
		expect(result.prompt?.kind).toBe('question');
	});

	it('contradiction prompt includes contradictionId', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'important',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			contradictions: {
				'contra-xyz': {
					conflictsWithQuestionIds: ['01-foundation.01-thesis.core-thesis.q02'],
					createdAt: '2026-01-01T00:00:00Z',
					id: 'contra-xyz',
					questionId: q1.id,
					status: 'unresolved',
					summary: 'Test contradiction.',
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		expect(result.prompt?.contradictionId).toBe('contra-xyz');
		expect(result.prompt?.text).toContain('Test contradiction');
	});

	it('contradiction prompt does not silently resolve anything', () => {
		resetSeq();
		const q1 = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState({
			contradictions: {
				'contra-1': {
					conflictsWithQuestionIds: [],
					createdAt: '2026-01-01T00:00:00Z',
					id: 'contra-1',
					questionId: q1.id,
					status: 'unresolved',
					summary: 'A contradiction exists.',
				},
			},
		});

		// Call selector twice — contradiction should still be there.
		const r1 = selectNextPrompt({ intakeState, registry });
		const r2 = selectNextPrompt({ intakeState, registry });
		expect(r1.prompt?.kind).toBe('contradiction_resolution');
		expect(r2.prompt?.kind).toBe('contradiction_resolution');
		// State was not mutated.
		expect(intakeState.contradictions['contra-1']?.status).toBe('unresolved');
	});
});
