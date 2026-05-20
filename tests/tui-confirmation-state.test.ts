/**
 * Tests for confirmation state pure functions.
 *
 * Phase 4: Keyboard Confirmation Framework — State tests.
 */

import { describe, expect, it } from 'vitest';
import {
	createTuiConfirmationRequest,
	yesNoOptions,
} from '../src/tui/confirmation-model.js';
import {
	cancelConfirmation,
	clearConfirmation,
	createConfirmationState,
	getSelectedOption,
	hasPendingConfirmation,
	isConfirmationExpired,
	resolveConfirmation,
	selectConfirmationOption,
	selectNextConfirmationOption,
	selectPreviousConfirmationOption,
	setPendingConfirmation,
	validateConfirmationId,
	validateConfirmationOption,
} from '../src/tui/confirmation-state.js';

function makeTestRequest(id = 'conf-test') {
	return createTuiConfirmationRequest({
		_testId: id,
		actionKind: 'workspace_init',
		message: 'Test.',
		options: yesNoOptions(),
		sourceCommand: '/init',
		title: 'Test',
	});
}

describe('confirmation state', () => {
	describe('createConfirmationState', () => {
		it('has no pending confirmation initially', () => {
			const state = createConfirmationState();
			expect(state.pending).toBeUndefined();
			expect(state.inputBlocked).toBe(false);
			expect(state.lastResult).toBeUndefined();
		});

		it('hasPendingConfirmation returns false', () => {
			const state = createConfirmationState();
			expect(hasPendingConfirmation(state)).toBe(false);
		});
	});

	describe('setPendingConfirmation', () => {
		it('sets a pending confirmation and blocks input', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();

			const next = setPendingConfirmation(state, request);

			expect(next.pending).toEqual(request);
			expect(next.inputBlocked).toBe(true);
			expect(hasPendingConfirmation(next)).toBe(true);
		});

		it('clears any previous result', () => {
			const state = createConfirmationState();
			const resolved = resolveConfirmation(state, {
				confirmationId: 'test',
				diagnostics: [],
				messages: [],
				nextActions: [],
				outcome: 'cancelled',
			});

			const request = makeTestRequest();
			const next = setPendingConfirmation(resolved, request);

			expect(next.lastResult).toBeUndefined();
		});
	});

	describe('selectConfirmationOption', () => {
		it('updates selected option by index', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			// Default is accept (index 0)
			expect(current.pending?.selectedOptionId).toBe('accept');

			// Select cancel (index 1)
			current = selectConfirmationOption(current, 1);
			expect(current.pending?.selectedOptionId).toBe('cancel');
		});

		it('ignores out-of-bounds index', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			current = selectConfirmationOption(current, 99);
			expect(current.pending?.selectedOptionId).toBe('accept');

			current = selectConfirmationOption(current, -1);
			expect(current.pending?.selectedOptionId).toBe('accept');
		});

		it('returns state unchanged when no pending confirmation', () => {
			const state = createConfirmationState();
			const next = selectConfirmationOption(state, 0);
			expect(next.pending).toBeUndefined();
		});
	});

	describe('selectNextConfirmationOption', () => {
		it('moves to the next option', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			expect(current.pending?.selectedOptionId).toBe('accept');

			current = selectNextConfirmationOption(current);
			expect(current.pending?.selectedOptionId).toBe('cancel');
		});

		it('wraps around to the first option', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			// Move to cancel (last)
			current = selectConfirmationOption(current, 1);
			expect(current.pending?.selectedOptionId).toBe('cancel');

			// Wrap to first
			current = selectNextConfirmationOption(current);
			expect(current.pending?.selectedOptionId).toBe('accept');
		});
	});

	describe('selectPreviousConfirmationOption', () => {
		it('moves to the previous option', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			// Default is accept (first), previous wraps to cancel (last)
			current = selectPreviousConfirmationOption(current);
			expect(current.pending?.selectedOptionId).toBe('cancel');
		});

		it('wraps around to the last option', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			// First -> previous wraps to last
			current = selectPreviousConfirmationOption(current);
			expect(current.pending?.selectedOptionId).toBe('cancel');

			// Previous again should go to accept
			current = selectPreviousConfirmationOption(current);
			expect(current.pending?.selectedOptionId).toBe('accept');
		});
	});

	describe('resolveConfirmation', () => {
		it('clears pending and stores result', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			const result = {
				confirmationId: request.id,
				diagnostics: [],
				messages: ['Accepted.'],
				nextActions: [],
				outcome: 'accepted' as const,
				selectedOptionId: 'accept',
			};

			current = resolveConfirmation(current, result);

			expect(current.pending).toBeUndefined();
			expect(current.inputBlocked).toBe(false);
			expect(current.lastResult).toEqual(result);
		});
	});

	describe('cancelConfirmation', () => {
		it('clears pending and stores cancelled result', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			current = cancelConfirmation(current);

			expect(current.pending).toBeUndefined();
			expect(current.inputBlocked).toBe(false);
			expect(current.lastResult?.outcome).toBe('cancelled');
		});
	});

	describe('clearConfirmation', () => {
		it('resets to initial state', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			let current = setPendingConfirmation(state, request);

			current = clearConfirmation(current);

			expect(current.pending).toBeUndefined();
			expect(current.lastResult).toBeUndefined();
			expect(current.inputBlocked).toBe(false);
		});
	});

	describe('validateConfirmationId', () => {
		it('returns true when ids match', () => {
			const state = createConfirmationState();
			const request = makeTestRequest('match');
			const current = setPendingConfirmation(state, request);

			expect(validateConfirmationId(current, 'conf-match')).toBe(true);
		});

		it('returns false when ids do not match', () => {
			const state = createConfirmationState();
			const request = makeTestRequest('match');
			const current = setPendingConfirmation(state, request);

			expect(validateConfirmationId(current, 'conf-mismatch')).toBe(false);
		});

		it('returns false when no pending confirmation', () => {
			const state = createConfirmationState();
			expect(validateConfirmationId(state, 'conf-any')).toBe(false);
		});
	});

	describe('validateConfirmationOption', () => {
		it('returns true for valid option', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			const current = setPendingConfirmation(state, request);

			expect(validateConfirmationOption(current, 'accept')).toBe(true);
			expect(validateConfirmationOption(current, 'cancel')).toBe(true);
		});

		it('returns false for invalid option', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			const current = setPendingConfirmation(state, request);

			expect(validateConfirmationOption(current, 'invalid')).toBe(false);
		});
	});

	describe('getSelectedOption', () => {
		it('returns the selected option', () => {
			const state = createConfirmationState();
			const request = makeTestRequest();
			const current = setPendingConfirmation(state, request);

			const option = getSelectedOption(current);
			expect(option?.id).toBe('accept');
		});

		it('returns undefined when no pending', () => {
			const state = createConfirmationState();
			expect(getSelectedOption(state)).toBeUndefined();
		});
	});

	describe('isConfirmationExpired', () => {
		it('returns false for recent confirmation', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'fresh',
				_testTimestamp: new Date().toISOString(),
				actionKind: 'workspace_init',
				message: 'Test.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				title: 'Test',
			});

			expect(isConfirmationExpired(request, new Date().toISOString())).toBe(
				false,
			);
		});

		it('returns true for expired confirmation', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'old',
				_testTimestamp: '2020-01-01T00:00:00.000Z',
				actionKind: 'workspace_init',
				message: 'Test.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				title: 'Test',
			});

			expect(isConfirmationExpired(request, new Date().toISOString())).toBe(
				true,
			);
		});
	});
});
