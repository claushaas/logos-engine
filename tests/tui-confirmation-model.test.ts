/**
 * Tests for confirmation model types and builders.
 *
 * Phase 4: Keyboard Confirmation Framework — Model tests.
 */

import { describe, expect, it } from 'vitest';
import {
	createConfirmationId,
	createTuiConfirmationRequest,
	redactConfirmationRequest,
	writeCollisionOptions,
	yesNoOptions,
} from '../src/tui/confirmation-model.js';

describe('confirmation model', () => {
	describe('createConfirmationId', () => {
		it('returns a deterministic id when _testId is provided', () => {
			const id = createConfirmationId({
				_testId: 'test-123',
				actionKind: 'workspace_init',
				sourceCommand: '/init',
			});
			expect(id).toBe('conf-test-123');
		});

		it('returns a timestamp-based id without _testId', () => {
			const id = createConfirmationId({
				actionKind: 'canonical_generation',
				sourceCommand: '/generate',
			});
			expect(id).toMatch(/^conf-canonical_generation-\d+$/);
		});
	});

	describe('createTuiConfirmationRequest', () => {
		it('creates a valid request with required fields', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'test-init',
				_testTimestamp: '2026-01-01T00:00:00.000Z',
				actionKind: 'workspace_init',
				message: 'Initialize the workspace.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				title: 'Initialize Workspace',
			});

			expect(request.id).toBe('conf-test-init');
			expect(request.actionKind).toBe('workspace_init');
			expect(request.title).toBe('Initialize Workspace');
			expect(request.message).toBe('Initialize the workspace.');
			expect(request.sourceCommand).toBe('/init');
			expect(request.createdAt).toBe('2026-01-01T00:00:00.000Z');
			expect(request.options).toHaveLength(2);
			expect(request.destructive).toBe(false);
			expect(request.sensitive).toBe(false);
		});

		it('sets default option correctly', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'gen-test',
				actionKind: 'canonical_generation',
				message: 'Generate docs.',
				options: yesNoOptions(),
				sourceCommand: '/generate',
				title: 'Generate',
			});

			expect(request.defaultOptionId).toBe('accept');
			expect(request.selectedOptionId).toBe('accept');
		});

		it('deterministic option ordering', () => {
			const opts = yesNoOptions();
			const request1 = createTuiConfirmationRequest({
				_testId: 'det',
				actionKind: 'workspace_init',
				message: 'test',
				options: opts,
				sourceCommand: '/init',
				title: 'Test',
			});
			const request2 = createTuiConfirmationRequest({
				_testId: 'det',
				actionKind: 'workspace_init',
				message: 'test',
				options: opts,
				sourceCommand: '/init',
				title: 'Test',
			});

			expect(request1.options.map((o) => o.id)).toEqual(
				request2.options.map((o) => o.id),
			);
		});

		it('marks destructive actions', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'dest',
				actionKind: 'decision_supersede',
				destructive: true,
				message: 'This is destructive.',
				options: yesNoOptions(),
				sourceCommand: '/decisions supersede',
				title: 'Supersede',
			});

			expect(request.destructive).toBe(true);
		});

		it('marks sensitive actions', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'sensitive',
				actionKind: 'provider_disclosure',
				message: 'Disclosure.',
				options: yesNoOptions(),
				sensitive: true,
				sourceCommand: '/config ai disclosure accept',
				title: 'Disclosure',
			});

			expect(request.sensitive).toBe(true);
		});

		it('includes target information', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'target',
				actionKind: 'workspace_init',
				message: 'Init.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				target: {
					id: 'ws-1',
					kind: 'workspace',
					path: '/test/logos',
				},
				title: 'Init',
			});

			expect(request.target?.id).toBe('ws-1');
			expect(request.target?.kind).toBe('workspace');
			expect(request.target?.path).toBe('/test/logos');
		});

		it('is JSON serializable', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'json',
				actionKind: 'workspace_init',
				message: 'Test.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				title: 'Test',
			});

			const json = JSON.stringify(request);
			const parsed = JSON.parse(json);

			expect(parsed.id).toBe('conf-json');
			expect(parsed.actionKind).toBe('workspace_init');
		});

		it('does not include raw secrets', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'sec',
				actionKind: 'provider_disclosure',
				message: 'Using token from env var.',
				options: yesNoOptions(),
				sensitive: true,
				sourceCommand: '/config ai disclosure accept',
				title: 'Disclosure',
			});

			const json = JSON.stringify(request);
			expect(json).not.toContain('sk-');
			expect(json).not.toContain('Bearer');
			expect(json).not.toContain('api_key');
		});
	});

	describe('yesNoOptions', () => {
		it('returns accept and cancel options', () => {
			const options = yesNoOptions();
			expect(options).toHaveLength(2);
			expect(options[0].id).toBe('accept');
			expect(options[0].isDefault).toBe(true);
			expect(options[1].id).toBe('cancel');
			expect(options[1].isDefault).toBe(false);
		});

		it('supports custom labels', () => {
			const options = yesNoOptions({
				acceptLabel: 'Proceed',
				cancelLabel: 'Abort',
			});
			expect(options[0].label).toBe('Proceed');
			expect(options[1].label).toBe('Abort');
		});
	});

	describe('writeCollisionOptions', () => {
		it('returns four options', () => {
			const options = writeCollisionOptions();
			expect(options).toHaveLength(4);
			expect(options[0].kind).toBe('skip');
			expect(options[1].kind).toBe('backup_and_write');
			expect(options[2].kind).toBe('overwrite');
			expect(options[3].kind).toBe('cancel');
		});

		it('marks overwrite as destructive', () => {
			const options = writeCollisionOptions();
			const overwrite = options.find((o) => o.kind === 'overwrite');
			expect(overwrite?.isDestructive).toBe(true);
			expect(overwrite?.label).toContain('destructive');
		});
	});

	describe('redactConfirmationRequest', () => {
		it('redacts sensitive content', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'redact',
				actionKind: 'provider_disclosure',
				message: 'Send context to api with key sk-abc123secret',
				options: yesNoOptions(),
				sensitive: true,
				sourceCommand: '/config ai disclosure accept',
				title: 'Disclosure',
			});

			const redactFn = (v: string) =>
				v.replace(/sk-[a-zA-Z0-9]+/, '[REDACTED]');

			const redacted = redactConfirmationRequest(request, redactFn);

			expect(redacted.message).not.toContain('sk-abc123secret');
			expect(redacted.message).toContain('[REDACTED]');
		});

		it('preserves non-sensitive fields', () => {
			const request = createTuiConfirmationRequest({
				_testId: 'noredact',
				actionKind: 'workspace_init',
				message: 'Normal message.',
				options: yesNoOptions(),
				sourceCommand: '/init',
				title: 'Init',
			});

			const redactFn = (v: string) => v;
			const redacted = redactConfirmationRequest(request, redactFn);

			expect(redacted.id).toBe('conf-noredact');
			expect(redacted.options).toHaveLength(2);
		});
	});
});
