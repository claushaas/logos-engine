import { describe, expect, it } from 'vitest';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
	createInterruptionResult,
} from './command-adapter-test-helpers.js';

describe('command interruption routing', () => {
	it('logos-start + reaffirm renders interruption and does not call startIntake', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
		expect(harness.rendered).toHaveLength(1);
	});

	it('logos-stop + pause_and_execute calls stopIntake and renders both results', async () => {
		const harness = createAdapterHarness({ disposition: 'pause_and_execute' });

		await runLifecycleCommandAdapter({
			command: 'logos-stop',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
			'stopIntake',
		]);
		expect(harness.rendered).toHaveLength(2);
	});

	it('logos-status + pause_and_execute calls getStatus and renders both results', async () => {
		const harness = createAdapterHarness({ disposition: 'pause_and_execute' });

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
			'getStatus',
		]);
		expect(harness.rendered).toHaveLength(2);
	});

	it('logos-generate + pause_and_execute calls generate and renders both results', async () => {
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
		expect(harness.rendered).toHaveLength(2);
	});

	it('logos-init + confirm_required renders confirmation and does not call initProject', async () => {
		const harness = createAdapterHarness({ disposition: 'confirm_required' });

		await runLifecycleCommandAdapter({
			command: 'logos-init',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
		expect(harness.rendered).toHaveLength(1);
	});

	it('block disposition renders interruption and does not call command-specific Core API', async () => {
		const harness = createAdapterHarness();
		harness.setInterruptionResult(
			createInterruptionResult('block', 'logos-generate'),
		);

		await runLifecycleCommandAdapter({
			command: 'logos-generate',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
		expect(harness.rendered).toHaveLength(1);
	});
});
