import { describe, expect, it, vi } from 'vitest';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import type { LogosPiCommandContext } from '../../src/pi-extension/pi-types.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
} from './command-adapter-test-helpers.js';

describe('command project context', () => {
	it('ctx.cwd is passed to handleIntakeCommand', async () => {
		const harness = createAdapterHarness();

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls[0]?.input).toEqual(
			expect.objectContaining({ projectRoot: '/repo' }),
		);
	});

	it('ctx.cwd is passed to command-specific Core methods', async () => {
		const harness = createAdapterHarness();

		await runLifecycleCommandAdapter({
			command: 'logos-generate',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls[1]?.input).toEqual(
			expect.objectContaining({ projectRoot: '/repo' }),
		);
	});

	it('custom getProjectRoot dependency is honored when provided', async () => {
		const harness = createAdapterHarness({ projectRoot: '/custom-root' });

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls[0]?.input).toEqual(
			expect.objectContaining({ projectRoot: '/custom-root' }),
		);
		expect(harness.calls[1]?.input).toEqual(
			expect.objectContaining({ projectRoot: '/custom-root' }),
		);
	});

	it('adapter does not hardcode project root', async () => {
		const first = createAdapterHarness();
		const second = createAdapterHarness();

		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext('/repo-a'),
			deps: first.deps,
		});
		await runLifecycleCommandAdapter({
			command: 'logos-status',
			ctx: createFakeCommandContext('/repo-b'),
			deps: second.deps,
		});

		expect(first.calls[0]?.input).toEqual(
			expect.objectContaining({ projectRoot: '/repo-a' }),
		);
		expect(second.calls[0]?.input).toEqual(
			expect.objectContaining({ projectRoot: '/repo-b' }),
		);
	});

	it('missing cwd follows existing project-root helper policy', async () => {
		const spy = vi.spyOn(process, 'cwd').mockReturnValue('/fallback-cwd');
		const harness = createAdapterHarness();
		const { getProjectRoot: _omit, ...depsWithoutRoot } = harness.deps;

		try {
			await runLifecycleCommandAdapter({
				command: 'logos-status',
				ctx: { ui: { notify: () => {} } } as LogosPiCommandContext,
				deps: depsWithoutRoot as LogosPiExtensionDependencies,
			});
		} finally {
			spy.mockRestore();
		}

		expect(harness.calls[0]?.input).toEqual(
			expect.objectContaining({ projectRoot: '/fallback-cwd' }),
		);
	});
});
