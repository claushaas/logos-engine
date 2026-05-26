/**
 * Tests for Step 3.5 — allowed actions computation.
 *
 * Covers:
 *  - `getAllowedActions`: exact action set for every lifecycle.
 *  - `isActionAllowed`: per-lifecycle per-action correctness.
 *  - Acceptance criteria:
 *    - `accept` is only available in `synthesized`.
 *    - `reopen` is available in `synthesized` and `accepted`.
 *    - `continue_next` is available in `accepted` and `deferred`.
 *    - `accept` is NOT in `active` action set.
 *    - `answer` is in `not_started`, `active`, `answered`,
 *      `needs_clarification`, `needs_refinement`.
 *  - Immutability: returned arrays are fresh copies.
 *  - Pure functions: repeated calls produce identical results.
 *  - Edge cases: `ready_for_synthesis` returns empty array.
 */
import { describe, expect, it } from 'vitest';

import type { NodeAction, NodeLifecycle } from '../../src/contracts/index.js';
import {
	getAllowedActions,
	isActionAllowed,
} from '../../src/state-engine/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Canonical action map — the source of truth for assertion
// ═══════════════════════════════════════════════════════════════════════════

const EXPECTED_ACTIONS: Readonly<
	Record<NodeLifecycle, readonly NodeAction[]>
> = {
	accepted: ['continue_next', 'reopen', 'open_document_preview'],
	active: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	answered: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	blocked: ['open_prerequisite', 'defer'],
	deferred: ['resume', 'continue_next'],
	needs_clarification: ['answer', 'defer', 'open_prerequisite'],
	needs_refinement: ['answer', 'defer', 'ask_for_example'],
	not_started: ['answer', 'skip', 'ask_for_example'],
	ready_for_synthesis: [],
	synthesized: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
};

const ALL_LIFECYCLES: readonly NodeLifecycle[] = [
	'not_started',
	'active',
	'answered',
	'needs_clarification',
	'needs_refinement',
	'ready_for_synthesis',
	'synthesized',
	'accepted',
	'deferred',
	'blocked',
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// getAllowedActions — exact sets for every lifecycle
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllowedActions', () => {
	for (const lifecycle of ALL_LIFECYCLES) {
		it(`returns the correct action set for lifecycle "${lifecycle}"`, () => {
			expect(getAllowedActions(lifecycle)).toEqual(
				EXPECTED_ACTIONS[lifecycle],
			);
		});
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// getAllowedActions — acceptance criteria
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllowedActions — acceptance criteria', () => {
	it('"accept" is only available in "synthesized"', () => {
		for (const lifecycle of ALL_LIFECYCLES) {
			const actions = getAllowedActions(lifecycle);
			if (lifecycle === 'synthesized') {
				expect(actions).toContain('accept');
			} else {
				expect(actions).not.toContain('accept');
			}
		}
	});

	it('"reopen" is available in "synthesized" and "accepted"', () => {
		for (const lifecycle of ALL_LIFECYCLES) {
			const actions = getAllowedActions(lifecycle);
			if (lifecycle === 'synthesized' || lifecycle === 'accepted') {
				expect(actions).toContain('reopen');
			} else {
				expect(actions).not.toContain('reopen');
			}
		}
	});

	it('"continue_next" is available in "accepted" and "deferred"', () => {
		for (const lifecycle of ALL_LIFECYCLES) {
			const actions = getAllowedActions(lifecycle);
			if (lifecycle === 'accepted' || lifecycle === 'deferred') {
				expect(actions).toContain('continue_next');
			} else {
				expect(actions).not.toContain('continue_next');
			}
		}
	});

	it('"accept" is NOT in "active" action set', () => {
		const actions = getAllowedActions('active');
		expect(actions).not.toContain('accept');
	});

	it('"answer" is in not_started, active, answered, needs_clarification, needs_refinement', () => {
		const answerStates: NodeLifecycle[] = [
			'not_started',
			'active',
			'answered',
			'needs_clarification',
			'needs_refinement',
		];
		const nonAnswerStates = ALL_LIFECYCLES.filter(
			(l) => !answerStates.includes(l),
		);

		for (const lifecycle of answerStates) {
			expect(getAllowedActions(lifecycle)).toContain('answer');
		}
		for (const lifecycle of nonAnswerStates) {
			expect(getAllowedActions(lifecycle)).not.toContain('answer');
		}
	});

	it('"ready_for_synthesis" returns an empty action set', () => {
		expect(getAllowedActions('ready_for_synthesis')).toEqual([]);
	});

	it('"not_started" includes skip and ask_for_example', () => {
		const actions = getAllowedActions('not_started');
		expect(actions).toContain('skip');
		expect(actions).toContain('ask_for_example');
	});

	it('"blocked" includes open_prerequisite and defer', () => {
		const actions = getAllowedActions('blocked');
		expect(actions).toContain('open_prerequisite');
		expect(actions).toContain('defer');
		expect(actions).toHaveLength(2);
	});

	it('"deferred" includes resume and continue_next', () => {
		const actions = getAllowedActions('deferred');
		expect(actions).toContain('resume');
		expect(actions).toContain('continue_next');
		expect(actions).toHaveLength(2);
	});

	it('every lifecycle returns a non-overlapping, correct set', () => {
		// Verify each lifecycle returns exactly the expected set.
		for (const lifecycle of ALL_LIFECYCLES) {
			const actual = getAllowedActions(lifecycle);
			const expected = EXPECTED_ACTIONS[lifecycle];
			expect(actual).toEqual(expected);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// isActionAllowed — per-lifecycle per-action correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('isActionAllowed', () => {
	for (const lifecycle of ALL_LIFECYCLES) {
		const allowed = EXPECTED_ACTIONS[lifecycle];

		for (const action of allowed) {
			it(`${action} is allowed in "${lifecycle}"`, () => {
				expect(isActionAllowed(lifecycle, action)).toBe(true);
			});
		}

		// Test a few known-disallowed actions for each lifecycle
		const disallowed = allowed.length > 0 ? [] : ['answer'];
		if (!allowed.includes('accept')) disallowed.push('accept');
		if (!allowed.includes('defer')) disallowed.push('defer');
		if (!allowed.includes('reopen')) disallowed.push('reopen');

		for (const action of [...new Set(disallowed)]) {
			it(`${action} is NOT allowed in "${lifecycle}"`, () => {
				expect(isActionAllowed(lifecycle, action)).toBe(false);
			});
		}
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// Immutability and purity
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllowedActions — immutability and purity', () => {
	it('returns a fresh copy — mutating the result does not affect subsequent calls', () => {
		const first = getAllowedActions('active');
		const snapshot = [...first];

		// Mutate the returned array
		first.push('accept' as NodeAction);

		const second = getAllowedActions('active');
		expect(second).toEqual(snapshot);
		expect(second).not.toContain('accept');
	});

	it('repeated calls return identical results', () => {
		const a = getAllowedActions('synthesized');
		const b = getAllowedActions('synthesized');
		expect(a).toEqual(b);
		// Also verify they are not the same reference
		expect(a).not.toBe(b);
	});
});
