/**
 * Tests for confirmation resolver.
 *
 * Phase 4: Keyboard Confirmation Framework — Resolver tests.
 */

import { describe, expect, it } from 'vitest';
import {
	createTuiConfirmationRequest,
	yesNoOptions,
} from '../src/tui/confirmation-model.js';
import {
	getConfirmedCommand,
	resolveTuiConfirmation,
} from '../src/tui/confirmation-resolver.js';
import {
	createConfirmationState,
	setPendingConfirmation,
} from '../src/tui/confirmation-state.js';

function makeStateWithRequest(requestId = 'conf-test') {
	const state = createConfirmationState();
	const request = createTuiConfirmationRequest({
		_testId: requestId,
		actionKind: 'workspace_init',
		message: 'Test.',
		options: yesNoOptions(),
		sourceCommand: '/init',
		title: 'Test',
	});
	return {
		request,
		state: setPendingConfirmation(state, request),
	};
}

describe('confirmation resolver', () => {
	describe('resolveTuiConfirmation', () => {
		it('accepts valid confirmation', () => {
			const { request, state } = makeStateWithRequest('valid');

			const result = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request,
				selectedOptionId: 'accept',
				state,
			});

			expect(result.outcome).toBe('accepted');
			expect(result.selectedOptionId).toBe('accept');
		});

		it('cancels when cancel option selected', () => {
			const { request, state } = makeStateWithRequest('cancel-test');

			const result = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request,
				selectedOptionId: 'cancel',
				state,
			});

			expect(result.outcome).toBe('cancelled');
			expect(result.messages).toContain(
				'No files were written, no state was changed.',
			);
		});

		it('rejects stale confirmation id mismatch', () => {
			const { state } = makeStateWithRequest('real');

			const staleRequest = createTuiConfirmationRequest({
				_testId: 'stale',
				actionKind: 'workspace_init',
				message: 'Stale.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				title: 'Stale',
			});

			const result = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request: staleRequest,
				selectedOptionId: 'accept',
				state,
			});

			expect(result.outcome).toBe('stale');
		});

		it('rejects invalid option', () => {
			const { request, state } = makeStateWithRequest('invalid-opt');

			const result = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request,
				selectedOptionId: 'nonexistent',
				state,
			});

			expect(result.outcome).toBe('invalid_option');
		});

		it('rejects expired confirmation', () => {
			const { state } = makeStateWithRequest('expired');
			const expiredRequest = createTuiConfirmationRequest({
				_testId: 'expired',
				_testTimestamp: '2020-01-01T00:00:00.000Z',
				actionKind: 'workspace_init',
				message: 'Expired.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				title: 'Expired',
			});
			const expiredState = setPendingConfirmation(state, expiredRequest);

			const result = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request: expiredRequest,
				selectedOptionId: 'accept',
				state: expiredState,
			});

			expect(result.outcome).toBe('expired');
		});

		it('cancel does not produce accepted outcome', () => {
			const { request, state } = makeStateWithRequest('cancel-safe');

			const result = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request,
				selectedOptionId: 'cancel',
				state,
			});

			expect(result.outcome).not.toBe('accepted');
		});

		it('produces diagnostic for accepted outcome', () => {
			const { request, state } = makeStateWithRequest('accepted');

			const result = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request,
				selectedOptionId: 'accept',
				state,
			});

			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0].code).toBe('LOGOS_CONFIRMATION_ACCEPTED');
		});

		it('produces diagnostic for cancelled outcome', () => {
			const { request, state } = makeStateWithRequest('cancelled');

			const result = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request,
				selectedOptionId: 'cancel',
				state,
			});

			expect(result.diagnostics[0].code).toBe('LOGOS_CONFIRMATION_CANCELLED');
		});
	});

	describe('getConfirmedCommand', () => {
		it('maps workspace_init to /init --confirm', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'cmd-init',
				actionKind: 'workspace_init',
				message: 'Test.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				title: 'Test',
			});

			const cmd = getConfirmedCommand(request);
			expect(cmd).toBeDefined();
			expect(cmd?.command).toBe('/init');
			expect(cmd?.args).toContain('--confirm');
		});

		it('maps canonical_generation to /generate --confirm', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'cmd-gen',
				actionKind: 'canonical_generation',
				message: 'Test.',
				options: yesNoOptions(),
				sourceCommand: '/generate --policy skip',
				title: 'Test',
			});

			const cmd = getConfirmedCommand(request);
			expect(cmd).toBeDefined();
			expect(cmd?.args).toContain('--confirm');
			expect(cmd?.args).toContain('--policy');
			expect(cmd?.args).toContain('skip');
		});

		it('maps executive_compile to /executive compile --confirm', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'cmd-exec',
				actionKind: 'executive_compile',
				message: 'Test.',
				options: yesNoOptions(),
				sourceCommand: '/executive compile --mode strict',
				title: 'Test',
			});

			const cmd = getConfirmedCommand(request);
			expect(cmd).toBeDefined();
			expect(cmd?.args).toContain('--confirm');
			expect(cmd?.args).toContain('compile');
		});

		it('maps provider_disclosure to config ai disclosure accept', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'cmd-disc',
				actionKind: 'provider_disclosure',
				message: 'Test.',
				options: yesNoOptions(),
				sourceCommand: '/config ai disclosure accept',
				title: 'Test',
			});

			const cmd = getConfirmedCommand(request);
			expect(cmd).toBeDefined();
			expect(cmd?.command).toBe('/config');
			expect(cmd?.args).toContain('ai');
			expect(cmd?.args).toContain('disclosure');
			expect(cmd?.args).toContain('accept');
		});

		it('preserves proposal accept command', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'cmd-prop',
				actionKind: 'proposal_accept',
				message: 'Test.',
				options: yesNoOptions(),
				sourceCommand: '/proposals accept prop-123',
				title: 'Test',
			});

			const cmd = getConfirmedCommand(request);
			expect(cmd?.command).toBe('/proposals');
			expect(cmd?.args).toContain('accept');
			expect(cmd?.args).toContain('prop-123');
		});
	});
});
