import { describe, expect, it } from 'vitest';
import {
	type NormalizeIntakeStateInput,
	normalizeIntakeState,
} from '../../src/core/state/intake-state-schema.js';
import type { LogosIntakeState } from '../../src/core/state/intake-state-types.js';

const now = '2026-05-22T00:00:00Z';
const projectRoot = '/project';

function makeValidState(): LogosIntakeState {
	return {
		activePrompt: {
			kind: 'question',
			questionId: 'q-1',
			startedAt: now,
			updatedAt: now,
		},
		activeQuestionId: 'q-1',
		answeredQuestions: {
			'q-1': {
				answer: 'Test answer',
				answeredAt: now,
				questionId: 'q-1',
				status: 'sufficient',
			},
		},
		contradictions: {
			'c-1': {
				conflictsWithQuestionIds: ['q-4'],
				createdAt: now,
				id: 'c-1',
				questionId: 'q-1',
				status: 'unresolved',
				summary: 'Conflicting requirements',
			},
		},
		initializedAt: now,
		mode: 'idle',
		partialQuestions: {
			'q-2': {
				missingAspects: ['aspect-a'],
				questionId: 'q-2',
				recordedAt: now,
			},
		},
		progress: {
			byPhase: {
				'phase-1': {
					contradictory: 1,
					missing: 1,
					partial: 0,
					phaseId: 'phase-1',
					skipped: 0,
					sufficient: 1,
					total: 3,
				},
			},
			contradictory: 1,
			missing: 2,
			partial: 1,
			skipped: 0,
			sufficient: 1,
			total: 5,
		},
		projectRoot,
		skippedQuestions: {
			'q-3': {
				questionId: 'q-3',
				reason: 'Not applicable',
				skippedAt: now,
			},
		},
		updatedAt: now,
		version: 1,
	};
}

function normalize(
	input: Omit<NormalizeIntakeStateInput, 'projectRoot' | 'now'> &
		Partial<Pick<NormalizeIntakeStateInput, 'projectRoot' | 'now'>>,
) {
	return normalizeIntakeState({
		now,
		projectRoot,
		...input,
	});
}

describe('normalizeIntakeState', () => {
	it('normalizes a valid intake state successfully', () => {
		const state = makeValidState();
		const result = normalize({ raw: state });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.version).toBe(1);
			expect(result.state.mode).toBe('idle');
			expect(result.state.answeredQuestions['q-1']).toBeDefined();
			expect(result.state.progress.total).toBe(5);
			expect(result.state.progress.byPhase['phase-1'].phaseId).toBe('phase-1');
		}
	});

	it('defaults missing records to empty records', () => {
		const raw = {
			initializedAt: now,
			mode: 'idle',
			progress: {
				byPhase: {},
				contradictory: 0,
				missing: 0,
				partial: 0,
				skipped: 0,
				sufficient: 0,
				total: 0,
			},
			projectRoot,
			updatedAt: now,
			version: 1,
		};

		const result = normalize({ raw });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Object.keys(result.state.answeredQuestions)).toHaveLength(0);
			expect(Object.keys(result.state.partialQuestions)).toHaveLength(0);
			expect(Object.keys(result.state.skippedQuestions)).toHaveLength(0);
			expect(Object.keys(result.state.contradictions)).toHaveLength(0);
		}
	});

	it('defaults missing progress to zero progress', () => {
		const raw = {
			answeredQuestions: {},
			contradictions: {},
			initializedAt: now,
			mode: 'idle',
			partialQuestions: {},
			projectRoot,
			skippedQuestions: {},
			updatedAt: now,
			version: 1,
		};

		const result = normalize({ raw });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.progress.total).toBe(0);
			expect(result.state.progress.sufficient).toBe(0);
			expect(result.state.progress.partial).toBe(0);
			expect(result.state.progress.missing).toBe(0);
			expect(result.state.progress.contradictory).toBe(0);
			expect(result.state.progress.skipped).toBe(0);
			expect(Object.keys(result.state.progress.byPhase)).toHaveLength(0);
			expect(result.warnings).toContain(
				'progress missing, defaulting to zero counts.',
			);
		}
	});

	it('fails for invalid mode', () => {
		const result = normalize({ raw: { mode: 'bogus' } });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('Invalid intake mode');
		}
	});

	it('fails for invalid active prompt kind', () => {
		const result = normalize({
			raw: {
				activePrompt: {
					kind: 'bogus',
					questionId: 'q-1',
					startedAt: now,
					updatedAt: now,
				},
				mode: 'idle',
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('Invalid activePrompt.kind');
		}
	});

	it('fails when activeQuestionId does not match activePrompt.questionId', () => {
		const result = normalize({
			raw: {
				activePrompt: {
					kind: 'question',
					questionId: 'q-1',
					startedAt: now,
					updatedAt: now,
				},
				activeQuestionId: 'q-2',
				mode: 'idle',
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain(
				'activeQuestionId must match activePrompt.questionId',
			);
		}
	});

	it('fails for negative progress count', () => {
		const result = normalize({
			raw: {
				mode: 'idle',
				progress: {
					byPhase: {},
					contradictory: 0,
					missing: 0,
					partial: 0,
					skipped: 0,
					sufficient: 0,
					total: -1,
				},
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain(
				'progress.total must be a non-negative number',
			);
		}
	});

	it('fails for non-object metadata', () => {
		const result = normalize({
			raw: {
				metadata: 'not-an-object',
				mode: 'idle',
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('metadata must be a plain object');
		}
	});

	it('fails for unsupported version', () => {
		const result = normalize({ raw: { version: 99 } });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('Unsupported intake state version');
		}
	});

	it('fails for non-object raw value', () => {
		for (const raw of [null, undefined, 'string', 42, true, []]) {
			const result = normalize({ raw });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain(
					'Intake state must be a plain object',
				);
			}
		}
	});

	it('accepts valid metadata as plain object', () => {
		const result = normalize({
			raw: {
				metadata: { source: 'test' },
				mode: 'idle',
			},
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.metadata).toEqual({ source: 'test' });
		}
	});

	it('defaults missing initializedAt and updatedAt to now', () => {
		const result = normalize({
			raw: {
				mode: 'idle',
			},
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.initializedAt).toBe(now);
			expect(result.state.updatedAt).toBe(now);
			expect(result.warnings).toContain(
				'initializedAt missing or invalid, defaulting to now.',
			);
			expect(result.warnings).toContain(
				'updatedAt missing or invalid, defaulting to now.',
			);
		}
	});

	it('defaults missing projectRoot to input projectRoot', () => {
		const result = normalize({
			raw: {
				mode: 'idle',
			},
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.projectRoot).toBe(projectRoot);
		}
	});

	it('allows activePrompt with followUpId and contradictionId', () => {
		const result = normalize({
			raw: {
				activePrompt: {
					contradictionId: 'cd-1',
					followUpId: 'fu-1',
					kind: 'follow_up',
					questionId: 'q-1',
					startedAt: now,
					updatedAt: now,
				},
				activeQuestionId: 'q-1',
				mode: 'intake_active',
			},
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.activePrompt?.kind).toBe('follow_up');
			expect(result.state.activePrompt?.followUpId).toBe('fu-1');
			expect(result.state.activePrompt?.contradictionId).toBe('cd-1');
		}
	});
});
