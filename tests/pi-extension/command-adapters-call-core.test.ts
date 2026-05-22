import { describe, expect, it } from 'vitest';
import type { LogosLifecycleCommand } from '../../src/core/index.js';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
} from './command-adapter-test-helpers.js';

const methodByCommand: Record<LogosLifecycleCommand, string> = {
	'logos-generate': 'generate',
	'logos-init': 'initProject',
	'logos-start': 'startIntake',
	'logos-status': 'getStatus',
	'logos-stop': 'stopIntake',
};

describe('command adapters call Core', () => {
	for (const command of Object.keys(
		methodByCommand,
	) as LogosLifecycleCommand[]) {
		it(`${command} execute path calls handleIntakeCommand first, then command Core API`, async () => {
			const harness = createAdapterHarness({ projectRoot: '/repo' });

			await runLifecycleCommandAdapter({
				command,
				ctx: createFakeCommandContext('/repo'),
				deps: harness.deps,
			});

			expect(harness.calls.map((call) => call.method)).toEqual([
				'handleIntakeCommand',
				methodByCommand[command],
			]);
			expect(harness.calls[0]?.input).toEqual(
				expect.objectContaining({ command, projectRoot: '/repo' }),
			);
			expect(harness.calls[1]?.input).toEqual(
				expect.objectContaining({ projectRoot: '/repo' }),
			);
		});
	}

	it('never calls handleIntakeMessage for any lifecycle command', async () => {
		for (const command of Object.keys(
			methodByCommand,
		) as LogosLifecycleCommand[]) {
			const harness = createAdapterHarness({ projectRoot: '/repo' });

			await runLifecycleCommandAdapter({
				command,
				ctx: createFakeCommandContext('/repo'),
				deps: harness.deps,
			});

			expect(
				harness.calls.some((call) => call.method === 'handleIntakeMessage'),
			).toBe(false);
		}
	});
});
