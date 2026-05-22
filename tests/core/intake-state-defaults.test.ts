import { describe, expect, it } from 'vitest';
import { createDefaultIntakeState } from '../../src/core/state/intake-state-defaults.js';

describe('createDefaultIntakeState', () => {
	const now = '2026-05-22T00:00:00Z';
	const projectRoot = '/project';

	it('produces version 1', () => {
		const state = createDefaultIntakeState({ now, projectRoot });
		expect(state.version).toBe(1);
	});

	it('produces mode idle', () => {
		const state = createDefaultIntakeState({ now, projectRoot });
		expect(state.mode).toBe('idle');
	});

	it('has no active prompt', () => {
		const state = createDefaultIntakeState({ now, projectRoot });
		expect(state.activePrompt).toBeUndefined();
		expect(state.activeQuestionId).toBeUndefined();
	});

	it('has empty answer/partial/skipped/contradiction records', () => {
		const state = createDefaultIntakeState({ now, projectRoot });
		expect(Object.keys(state.answeredQuestions)).toHaveLength(0);
		expect(Object.keys(state.partialQuestions)).toHaveLength(0);
		expect(Object.keys(state.skippedQuestions)).toHaveLength(0);
		expect(Object.keys(state.contradictions)).toHaveLength(0);
	});

	it('has zero progress counts', () => {
		const state = createDefaultIntakeState({ now, projectRoot });
		expect(state.progress.total).toBe(0);
		expect(state.progress.sufficient).toBe(0);
		expect(state.progress.partial).toBe(0);
		expect(state.progress.missing).toBe(0);
		expect(state.progress.contradictory).toBe(0);
		expect(state.progress.skipped).toBe(0);
		expect(Object.keys(state.progress.byPhase)).toHaveLength(0);
	});

	it('uses provided now for timestamps', () => {
		const state = createDefaultIntakeState({ now, projectRoot });
		expect(state.initializedAt).toBe(now);
		expect(state.updatedAt).toBe(now);
	});

	it('is JSON-serializable and round-trips', () => {
		const state = createDefaultIntakeState({ now, projectRoot });
		const json = JSON.stringify(state);
		const parsed = JSON.parse(json);
		expect(parsed).toEqual(state);
	});
});
