import { describe, expect, it } from 'vitest';
import type { HandleIntakeCommandData } from '../../src/core/index.js';
import { createCoreResult } from '../../src/core/index.js';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
	createInterruptionResult,
} from './command-adapter-test-helpers.js';

describe('command disposition behavior', () => {
	it('execute disposition allows command-specific Core call', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
			'getStatus',
		]);
	});

	it('reaffirm disposition suppresses command-specific Core call', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
	});

	it('pause_and_execute allows command-specific Core call after interruption', async () => {
		const harness = createAdapterHarness({ disposition: 'pause_and_execute' });

		await runLifecycleCommandAdapter({
			command: 'logos-generate',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
			'generate',
		]);
	});

	it('confirm_required suppresses command-specific Core call', async () => {
		const harness = createAdapterHarness({ disposition: 'confirm_required' });

		await runLifecycleCommandAdapter({
			command: 'logos-init',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
	});

	it('block suppresses command-specific Core call', async () => {
		const harness = createAdapterHarness({ disposition: 'block' });

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
	});

	it('missing disposition fails safe and does not execute command-specific Core call', async () => {
		const harness = createAdapterHarness();
		harness.setInterruptionResult(
			createCoreResult({
				message: { body: 'missing disposition', kind: 'warning' },
				status: 'ok',
			}),
		);

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
	});

	it('unknown disposition fails safe and does not execute command-specific Core call', async () => {
		const harness = createAdapterHarness();
		const unknown = createInterruptionResult('execute');
		harness.setInterruptionResult({
			...unknown,
			data: {
				...unknown.data,
				disposition: 'unknown_disposition',
			} as HandleIntakeCommandData,
		});

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
	});
});
