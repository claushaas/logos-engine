import { describe, expect, it } from 'vitest';
import type { LogosError, LogosErrorCode } from '../../src/core/errors.js';
import type {
	AssistantAction,
	AssistantActionKind,
	AssistantMessage,
} from '../../src/core/messages.js';
import type {
	ChangedPath,
	CoreResult,
	CoreResultStatus,
	LogosBlocker,
	LogosWarning,
} from '../../src/core/result.js';
import {
	createCoreResult,
	createLogosBlocker,
	createLogosError,
	createLogosWarning,
} from '../../src/core/result.js';

describe('core result contracts', () => {
	it('creates a serializable result with safe defaults', () => {
		const result = createCoreResult({
			message: {
				body: 'Ready.',
				kind: 'status',
			},
			status: 'ok',
		});

		expect(result.warnings).toEqual([]);
		expect(result.blockers).toEqual([]);
		expect(result.errors).toEqual([]);
		expect(result.changedPaths).toEqual([]);
		expect(result.dryRun).toBe(false);
		expect(JSON.parse(JSON.stringify(result))).toEqual(result);
	});

	it('returns arrays for warnings, blockers, errors, and changedPaths when provided', () => {
		const warning: LogosWarning = createLogosWarning({
			code: 'test_warning',
			message: 'Something looks off.',
		});

		const blocker: LogosBlocker = createLogosBlocker({
			code: 'test_blocker',
			message: 'Cannot proceed.',
		});

		const error: LogosError = createLogosError({
			code: 'profile_not_found',
			message: 'Profile missing.',
		});

		const changedPath: ChangedPath = {
			kind: 'created',
			path: '/docs/output.md',
			reason: 'Generated during intake.',
		};

		const result = createCoreResult({
			blockers: [blocker],
			changedPaths: [changedPath],
			errors: [error],
			message: {
				body: 'Blocked by missing profile.',
				kind: 'error',
			},
			status: 'blocked',
			warnings: [warning],
		});

		expect(result.warnings).toHaveLength(1);
		expect(result.blockers).toHaveLength(1);
		expect(result.errors).toHaveLength(1);
		expect(result.changedPaths).toHaveLength(1);
		expect(result.warnings[0]).toEqual(warning);
		expect(result.blockers[0]).toEqual(blocker);
		expect(result.errors[0]).toEqual(error);
		expect(result.changedPaths[0]).toEqual(changedPath);
	});

	it('defaults dryRun to false when not provided', () => {
		const result = createCoreResult({
			message: {
				body: 'Done.',
				kind: 'status',
			},
			status: 'ok',
		});

		expect(result.dryRun).toBe(false);
	});

	it('respects dryRun: true when provided', () => {
		const result = createCoreResult({
			dryRun: true,
			message: {
				body: 'No changes.',
				kind: 'status',
			},
			status: 'noop',
		});

		expect(result.dryRun).toBe(true);
	});

	it('can carry typed data', () => {
		type TestData = { profileId: string; phaseCount: number };

		const result = createCoreResult<TestData>({
			data: { phaseCount: 6, profileId: 'standard' },
			message: {
				body: 'Profile loaded.',
				kind: 'status',
			},
			status: 'ok',
		});

		expect(result.data).toEqual({ phaseCount: 6, profileId: 'standard' });
		expect(result.data?.profileId).toBe('standard');
		expect(result.data?.phaseCount).toBe(6);
	});

	it('produces plain serializable assistant messages', () => {
		const action: AssistantAction = {
			description: 'Confirm this action',
			destructive: false,
			id: 'action-1',
			kind: 'confirm',
			label: 'Confirm',
			metadata: { key: 'value' },
		};

		const message: AssistantMessage = {
			actions: [action],
			body: 'What is the primary goal?',
			kind: 'question',
			metadata: { priority: 'critical' },
			questionId: 'phase-1-doc-1-q-0',
			title: 'Project Goal',
		};

		const serialized = JSON.parse(JSON.stringify(message));
		expect(serialized).toEqual(message);
		expect(serialized.kind).toBe('question');
		expect(serialized.body).toBe('What is the primary goal?');
		expect(serialized.questionId).toBe('phase-1-doc-1-q-0');
		expect(serialized.actions).toHaveLength(1);
		expect(serialized.actions[0].kind).toBe('confirm');
	});

	it('does not require Pi, Ink, React, CLI, or TUI imports to use contracts', () => {
		// This test verifies by construction that the imported modules compile
		// and contain only plain data types. The boundary test in
		// core-boundary.test.ts checks for forbidden imports at the file level.
		const result: CoreResult = createCoreResult({
			message: {
				body: 'Contracts are plain data.',
				kind: 'status',
			},
			status: 'ok',
		});

		expect(result).toBeDefined();
		expect(typeof result.status).toBe('string');
		expect(typeof result.message.body).toBe('string');
	});

	it('does not require raw Error objects in error contracts', () => {
		const error = createLogosError({
			cause: 'ENOENT',
			code: 'state_read_failed',
			details: 'File not found',
			message: 'Could not read state.',
		});

		expect(error.code).toBe('state_read_failed');
		expect(error.message).toBe('Could not read state.');
		expect(error.cause).toBe('ENOENT');
		expect(error).not.toHaveProperty('stack');
	});

	it('represents a blocker result without throwing', () => {
		const blocker = createLogosBlocker({
			code: 'missing_profile',
			message: 'The active profile does not exist.',
			path: 'profiles/custom',
		});

		const result = createCoreResult({
			blockers: [blocker],
			message: {
				body: 'Cannot proceed because the active profile is missing.',
				kind: 'error',
			},
			status: 'blocked',
		});

		expect(result.status).toBe('blocked');
		expect(result.blockers[0]?.severity).toBe('blocker');
		expect(result.blockers[0]?.path).toBe('profiles/custom');
	});

	it('supports all defined message kinds', () => {
		const kinds: AssistantMessage['kind'][] = [
			'question',
			'follow_up',
			'clarification',
			'contradiction',
			'status',
			'warning',
			'error',
			'generation_result',
			'confirmation_request',
			'completion',
		];

		for (const kind of kinds) {
			const msg: AssistantMessage = { body: 'test', kind };
			expect(JSON.parse(JSON.stringify(msg)).kind).toBe(kind);
		}
	});

	it('supports all defined action kinds', () => {
		const kinds: AssistantActionKind[] = [
			'confirm',
			'cancel',
			'continue',
			'pause',
			'resume',
			'generate',
			'open_path',
			'show_status',
		];

		for (const kind of kinds) {
			const action: AssistantAction = {
				id: `act-${kind}`,
				kind,
				label: kind,
			};
			expect(JSON.parse(JSON.stringify(action)).kind).toBe(kind);
		}
	});

	it('supports all defined error codes', () => {
		const codes: LogosErrorCode[] = [
			'project_not_initialized',
			'invalid_project_root',
			'profile_not_found',
			'profile_invalid',
			'intake_not_started',
			'intake_already_complete',
			'active_question_missing',
			'question_registry_invalid',
			'state_read_failed',
			'state_write_failed',
			'evaluation_failed',
			'preflight_blocked',
			'generation_failed',
			'pi_extension_api_unavailable',
			'unknown_error',
		];

		for (const code of codes) {
			const error = createLogosError({ code, message: 'test' });
			expect(error.code).toBe(code);
		}
	});

	it('supports all defined changed path kinds', () => {
		const kinds: ChangedPath['kind'][] = [
			'created',
			'updated',
			'deleted',
			'unchanged',
			'skipped',
		];

		for (const kind of kinds) {
			const cp: ChangedPath = { kind, path: '/tmp/test' };
			expect(JSON.parse(JSON.stringify(cp)).kind).toBe(kind);
		}
	});

	it('supports all defined result statuses', () => {
		const statuses: CoreResultStatus[] = [
			'ok',
			'blocked',
			'confirmation_required',
			'failed',
			'noop',
		];

		for (const status of statuses) {
			const result = createCoreResult({
				message: { body: 'test', kind: 'status' },
				status,
			});
			expect(result.status).toBe(status);
		}
	});
});
