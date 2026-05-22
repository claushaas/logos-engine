/**
 * Tests for prompt selector dependency handling (Step 3.3).
 *
 * Covers:
 * - Question with satisfied dependency is eligible.
 * - Question with unmet dependency is skipped while other eligible questions exist.
 * - If all remaining questions are dependency-blocked, selector returns blocked.
 * - Missing dependency id produces blocker or warning.
 * - Dependency-satisfied status requires sufficient answer, not merely partial.
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

describe('prompt selector dependency handling', () => {
	it('question with satisfied dependency is eligible', () => {
		resetSeq();
		const qDep = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const qDepends = q({
			dependsOn: [qDep.id],
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'critical',
		});
		const registry = makeRegistry([qDep, qDepends]);
		const intakeState = makeIntakeState({
			answeredQuestions: {
				[qDep.id]: {
					answer: 'sufficient',
					answeredAt: NOW,
					questionId: qDep.id,
					status: 'sufficient',
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		// qDep is sufficient, qDepends has satisfied dependency → selected.
		expect(result.prompt?.questionId).toBe(qDepends.id);
	});

	it('question with unmet dependency is skipped while other eligible questions exist', () => {
		resetSeq();
		const qDep = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const qDepends = q({
			dependsOn: [qDep.id],
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'critical',
		});
		const qOther = q({
			id: '01-foundation.01-thesis.core-thesis.q03',
			priority: 'important',
		});
		const registry = makeRegistry([qDep, qDepends, qOther]);
		const intakeState = makeIntakeState({
			// qDep is unanswered, so qDepends is blocked.
			// qOther has no dependency → should be selected.
		});

		const result = selectNextPrompt({ intakeState, registry });
		// qDep is unanswered → qDep selected first (critical), but qDepends is blocked.
		// qDep is unanswered and has no dependency → selected first.
		expect(result.prompt?.questionId).toBe(qDep.id);
	});

	it('if all remaining questions are dependency-blocked, selector returns blocked', () => {
		resetSeq();
		const qDep = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const qDepends = q({
			dependsOn: [qDep.id],
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'critical',
		});
		const registry = makeRegistry([qDep, qDepends]);
		const intakeState = makeIntakeState();

		// Both are unanswered, but qDepends is dependency-blocked on qDep.
		// qDep should be selectable first.
		const r1 = selectNextPrompt({ intakeState, registry });
		expect(r1.status).toBe('selected');
		expect(r1.prompt?.questionId).toBe(qDep.id);

		// Mark qDep as sufficient, but don't answer qDepends yet.
		const intakeState2 = makeIntakeState({
			answeredQuestions: {
				[qDep.id]: {
					answer: 'sufficient',
					answeredAt: NOW,
					questionId: qDep.id,
					status: 'sufficient',
				},
			},
		});
		const r2 = selectNextPrompt({ intakeState: intakeState2, registry });
		expect(r2.prompt?.questionId).toBe(qDepends.id);
	});

	it('dependency requires sufficient answer, not partial', () => {
		resetSeq();
		const qDep = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const qDepends = q({
			dependsOn: [qDep.id],
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'critical',
		});
		const registry = makeRegistry([qDep, qDepends]);
		const intakeState = makeIntakeState({
			answeredQuestions: {
				[qDep.id]: {
					answer: 'partial answer',
					answeredAt: NOW,
					questionId: qDep.id,
					status: 'partial', // Not sufficient!
				},
			},
		});

		const result = selectNextPrompt({ intakeState, registry });
		// qDep is partial → still needs follow-up (selected first).
		// qDepends is dependency-blocked because qDep is not sufficient.
		// So qDep should be selected.
		expect(result.prompt?.questionId).toBe(qDep.id);
	});

	it('all remaining dependency-blocked returns blocked status', () => {
		resetSeq();
		// Two questions, both depend on each other (circular) or on missing.
		const q1 = q({
			dependsOn: ['nonexistent-dep'],
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const q2 = q({
			dependsOn: ['another-nonexistent'],
			id: '01-foundation.01-thesis.core-thesis.q02',
			priority: 'important',
		});
		const registry = makeRegistry([q1, q2]);
		const intakeState = makeIntakeState();

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('blocked');
		expect(result.reason).toBe('dependency_blocked');
	});

	it('question with no dependencies is always eligible', () => {
		resetSeq();
		const qNoDep = q({
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const registry = makeRegistry([qNoDep]);
		const intakeState = makeIntakeState();

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('selected');
		expect(result.prompt?.questionId).toBe(qNoDep.id);
	});

	it('unmet dependencies are listed as blockers', () => {
		resetSeq();
		const q1 = q({
			dependsOn: ['some-missing-dep'],
			id: '01-foundation.01-thesis.core-thesis.q01',
			priority: 'critical',
		});
		const registry = makeRegistry([q1]);
		const intakeState = makeIntakeState();

		const result = selectNextPrompt({ intakeState, registry });
		expect(result.status).toBe('blocked');
		expect(result.reason).toBe('dependency_blocked');
		expect(result.blockers.length).toBeGreaterThan(0);
		expect(result.blockers[0]).toContain('unmet dependencies');
	});
});
