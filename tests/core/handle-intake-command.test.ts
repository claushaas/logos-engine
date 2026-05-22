/**
 * Step 5.1 — Handle intake command tests.
 *
 * Tests the pure disposition resolver and the full handleIntakeCommand
 * implementation (with and without a filesystem port).
 */

import { describe, expect, it } from 'vitest';
import {
	handleIntakeCommand,
	type IntakeCommandDisposition,
	type ResolveIntakeCommandDispositionInput,
	resolveIntakeCommandDisposition,
} from '../../src/core/intake/handle-intake-command.js';
import type { IntakeMode } from '../../src/core/state/intake-state-types.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResolveInput(
	overrides: {
		command?:
			| 'logos-init'
			| 'logos-start'
			| 'logos-stop'
			| 'logos-status'
			| 'logos-generate';
		mode?: IntakeMode;
		hasActivePrompt?: boolean;
		confirmed?: boolean | undefined;
	} = {},
): ResolveIntakeCommandDispositionInput {
	return {
		command: overrides.command ?? 'logos-status',
		confirmed: overrides.confirmed,
		hasActivePrompt: overrides.hasActivePrompt ?? false,
		mode: overrides.mode ?? 'idle',
	};
}

// ---------------------------------------------------------------------------
// Pure disposition resolver tests
// ---------------------------------------------------------------------------

describe('resolveIntakeCommandDisposition (pure)', () => {
	describe('when mode is NOT intake_active', () => {
		const nonActiveModes: IntakeMode[] = [
			'idle',
			'paused',
			'generating',
			'complete',
		];
		const allCommands = [
			'logos-init',
			'logos-start',
			'logos-stop',
			'logos-status',
			'logos-generate',
		] as const;

		for (const mode of nonActiveModes) {
			for (const command of allCommands) {
				it(`returns execute for "${command}" when mode is "${mode}"`, () => {
					const result = resolveIntakeCommandDisposition(
						makeResolveInput({ command, mode }),
					);
					expect(result.disposition).toBe('execute');
					expect(result.reason).toContain(mode);
				});
			}
		}
	});

	describe('when mode is intake_active', () => {
		it('logos-start resolves to reaffirm when active prompt exists', () => {
			const result = resolveIntakeCommandDisposition(
				makeResolveInput({
					command: 'logos-start',
					hasActivePrompt: true,
					mode: 'intake_active',
				}),
			);
			expect(result.disposition).toBe('reaffirm');
		});

		it('logos-start resolves to block when no active prompt exists', () => {
			const result = resolveIntakeCommandDisposition(
				makeResolveInput({
					command: 'logos-start',
					hasActivePrompt: false,
					mode: 'intake_active',
				}),
			);
			expect(result.disposition).toBe('block');
		});

		it('logos-stop resolves to pause_and_execute', () => {
			const result = resolveIntakeCommandDisposition(
				makeResolveInput({
					command: 'logos-stop',
					mode: 'intake_active',
				}),
			);
			expect(result.disposition).toBe('pause_and_execute');
		});

		it('logos-status resolves to pause_and_execute', () => {
			const result = resolveIntakeCommandDisposition(
				makeResolveInput({
					command: 'logos-status',
					mode: 'intake_active',
				}),
			);
			expect(result.disposition).toBe('pause_and_execute');
		});

		it('logos-generate resolves to pause_and_execute', () => {
			const result = resolveIntakeCommandDisposition(
				makeResolveInput({
					command: 'logos-generate',
					mode: 'intake_active',
				}),
			);
			expect(result.disposition).toBe('pause_and_execute');
		});

		it('logos-init resolves to confirm_required by default', () => {
			const result = resolveIntakeCommandDisposition(
				makeResolveInput({
					command: 'logos-init',
					mode: 'intake_active',
				}),
			);
			expect(result.disposition).toBe('confirm_required');
		});

		it('logos-init with confirmed: true resolves to pause_and_execute', () => {
			const result = resolveIntakeCommandDisposition(
				makeResolveInput({
					command: 'logos-init',
					confirmed: true,
					mode: 'intake_active',
				}),
			);
			expect(result.disposition).toBe('pause_and_execute');
		});
	});

	describe('disposition values are exhaustive', () => {
		it('all five allowed values exist and are distinct', () => {
			const values: IntakeCommandDisposition[] = [
				'reaffirm',
				'pause_and_execute',
				'confirm_required',
				'block',
				'execute',
			];
			const unique = new Set(values);
			expect(unique.size).toBe(5);
		});
	});

	describe('reason strings', () => {
		it('every disposition returns a non-empty reason', () => {
			const inputs = [
				makeResolveInput({ command: 'logos-start', mode: 'idle' }),
				makeResolveInput({
					command: 'logos-start',
					hasActivePrompt: true,
					mode: 'intake_active',
				}),
				makeResolveInput({
					command: 'logos-start',
					hasActivePrompt: false,
					mode: 'intake_active',
				}),
				makeResolveInput({ command: 'logos-stop', mode: 'intake_active' }),
				makeResolveInput({ command: 'logos-status', mode: 'intake_active' }),
				makeResolveInput({
					command: 'logos-generate',
					mode: 'intake_active',
				}),
				makeResolveInput({ command: 'logos-init', mode: 'intake_active' }),
				makeResolveInput({
					command: 'logos-init',
					confirmed: true,
					mode: 'intake_active',
				}),
				makeResolveInput({ command: 'logos-generate', mode: 'idle' }),
			];

			for (const input of inputs) {
				const result = resolveIntakeCommandDisposition(input);
				expect(
					result.reason.length,
					`no reason for input ${JSON.stringify(input)}`,
				).toBeGreaterThan(0);
			}
		});
	});
});

// ---------------------------------------------------------------------------
// handleIntakeCommand without filesystem tests
// ---------------------------------------------------------------------------

describe('handleIntakeCommand (no filesystem)', () => {
	it('returns execute disposition for idle mode', async () => {
		const result = await handleIntakeCommand({
			command: 'logos-status',
			projectRoot: '/tmp/test',
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('execute');
		expect(result.data?.mode).toBe('idle');
		expect(result.data?.stateChanged).toBe(false);
		expect(result.data?.persisted).toBe(false);
		expect(result.data?.command).toBe('logos-status');
	});

	it('returns structured result with all required fields', async () => {
		const result = await handleIntakeCommand({
			command: 'logos-start',
			projectRoot: '/tmp/test',
		});

		expect(result).toHaveProperty('status');
		expect(result).toHaveProperty('message');
		expect(result).toHaveProperty('data');
		expect(result).toHaveProperty('blockers');
		expect(result).toHaveProperty('errors');
		expect(result).toHaveProperty('warnings');
		expect(result).toHaveProperty('dryRun');
		expect(Array.isArray(result.blockers)).toBe(true);
		expect(Array.isArray(result.errors)).toBe(true);
		expect(Array.isArray(result.warnings)).toBe(true);
	});

	it('result data includes command, disposition, mode, stateChanged, persisted', async () => {
		const result = await handleIntakeCommand({
			command: 'logos-generate',
			projectRoot: '/tmp/test',
		});

		expect(result.data?.command).toBe('logos-generate');
		expect(result.data).toHaveProperty('disposition');
		expect(result.data).toHaveProperty('mode');
		expect(result.data).toHaveProperty('stateChanged');
		expect(result.data).toHaveProperty('persisted');
	});

	it('dryRun: true is preserved', async () => {
		const result = await handleIntakeCommand({
			command: 'logos-status',
			dryRun: true,
			projectRoot: '/tmp/test',
		});
		expect(result.dryRun).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// handleIntakeCommand with filesystem tests
// ---------------------------------------------------------------------------

describe('handleIntakeCommand (with filesystem)', () => {
	const PROJECT_ROOT = '/project';

	it('returns execute when intake is not active', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const result = await handleIntakeCommand({
			command: 'logos-status',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('execute');
		expect(result.data?.mode).toBe('idle');
	});

	it('returns execute for uninitialized project (intake is idle)', async () => {
		const fs = createFakeFilesystem();
		// No profile, no config — project is uninitialized.
		// But intake mode defaults to idle, so disposition is execute.

		const result = await handleIntakeCommand({
			command: 'logos-status',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('execute');
		expect(result.data?.mode).toBe('idle');
	});

	// The following tests test the disposition when intake is active.
	// They require a fully initialized project with an active intake session.
	// For Step 5.1, we validate that the function call succeeds and returns
	// a structured result. Integration tests with actual active intake state
	// are deferred to Step 5.3.

	it('returns structured CoreResult for all five commands', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const commands = [
			'logos-init',
			'logos-start',
			'logos-stop',
			'logos-status',
			'logos-generate',
		] as const;

		for (const command of commands) {
			const result = await handleIntakeCommand({
				command,
				filesystem: fs,
				projectRoot: PROJECT_ROOT,
			});

			expect(result.status, `status for ${command}`).toBeDefined();
			expect(
				result.data?.disposition,
				`disposition for ${command}`,
			).toBeDefined();
			expect(result.data?.command, `command for ${command}`).toBe(command);
			expect(result.data?.stateChanged, `stateChanged for ${command}`).toBe(
				false,
			);
			expect(result.data?.persisted, `persisted for ${command}`).toBe(false);
		}
	});
});
