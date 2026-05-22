import { describe, expect, it } from 'vitest';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import { renderCoreResult } from '../../src/pi-extension/rendering/render-core-result.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
	createResult,
} from './command-adapter-test-helpers.js';

describe('command rendering boundary', () => {
	it('interruption result is rendered', async () => {
		const harness = createAdapterHarness({ disposition: 'block' });

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.rendered).toHaveLength(1);
		expect(harness.rendered[0]?.result.message.body).toBe('Disposition: block');
	});

	it('command-specific result is rendered when Core call is allowed', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		const commandResult = createResult({ body: 'status result' });
		harness.setCommandResult(commandResult);

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.rendered.map((entry) => entry.result.message.body)).toEqual([
			'Disposition: execute',
			'status result',
		]);
	});

	it('reaffirm renders only the interruption result', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.rendered.map((entry) => entry.result.message.body)).toEqual([
			'Disposition: reaffirm',
		]);
	});

	it('confirm_required renders only the confirmation result', async () => {
		const harness = createAdapterHarness({ disposition: 'confirm_required' });

		await runLifecycleCommandAdapter({
			command: 'logos-init',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.rendered.map((entry) => entry.result.message.body)).toEqual([
			'Disposition: confirm_required',
		]);
	});

	it('renderer injection is used when provided', async () => {
		const harness = createAdapterHarness({ disposition: 'block' });

		await renderCoreResult({
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
			result: createResult({ body: 'forward me' }),
		});

		expect(harness.rendered).toHaveLength(1);
		expect(harness.rendered[0]?.result.message.body).toBe('forward me');
	});

	it('adapter forwards Core results without adding custom rendering data', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		const commandResult = createResult({ body: 'unchanged command result' });
		harness.setCommandResult(commandResult);

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext(),
			deps: harness.deps,
		});

		expect(harness.rendered[1]?.result).toBe(commandResult);
	});
});
