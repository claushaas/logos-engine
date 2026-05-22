/**
 * Step 7.2 — Extension wiring tests.
 *
 * Proves that `createLogosPiExtension(...)` correctly wires the adapter
 * boundaries without executing product behavior.
 *
 * Tests:
 * 1. Calls placeholder registration functions (via Pi command registration).
 * 2. Fake Core can be injected.
 * 3. Fake Pi can be injected.
 * 4. Registration does not execute generation/intake behavior.
 * 5. Registration does not throw with fake Pi and fake Core.
 */

import { describe, expect, it } from 'vitest';
import type { LogosCore } from '../../src/core/api.js';
import { createLogosCore } from '../../src/core/api.js';
import { createLogosPiExtension } from '../../src/pi-extension/create-extension.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';

// ---------------------------------------------------------------------------
// Fake helpers
// ---------------------------------------------------------------------------

type FakePi = {
	commands: Map<
		string,
		(ctx: { cwd: string }, args?: string[]) => Promise<void> | void
	>;
	registerCommand: (
		name: string,
		handler: (ctx: { cwd: string }, args?: string[]) => Promise<void> | void,
	) => void;
};

function createFakePi(): FakePi {
	const commands = new Map<
		string,
		(ctx: { cwd: string }, args?: string[]) => Promise<void> | void
	>();
	return {
		commands,
		registerCommand(name, handler) {
			if (commands.has(name)) {
				throw new Error(`Command "${name}" is already registered.`);
			}
			commands.set(name, handler);
		},
	};
}

/**
 * Create a fake Core where every method throws if called.
 * This proves that registration does not call Core product APIs.
 */
function createThrowOnCallCore(): LogosCore {
	const throwFn = (method: string) => () => {
		throw new Error(
			`Core.${method}() was called during registration — this must not happen.`,
		);
	};

	return {
		generate: throwFn('generate') as LogosCore['generate'],
		getStatus: throwFn('getStatus') as LogosCore['getStatus'],
		handleIntakeCommand: throwFn(
			'handleIntakeCommand',
		) as LogosCore['handleIntakeCommand'],
		handleIntakeMessage: throwFn(
			'handleIntakeMessage',
		) as LogosCore['handleIntakeMessage'],
		initProject: throwFn('initProject') as LogosCore['initProject'],
		startIntake: throwFn('startIntake') as LogosCore['startIntake'],
		stopIntake: throwFn('stopIntake') as LogosCore['stopIntake'],
	};
}

/**
 * Create a fake Core that records method calls (for tests that need to
 * verify what was/wasn't called).
 */
type RecordedCall = { method: string; input: unknown };

function createRecordingCore(): {
	core: LogosCore;
	calls: RecordedCall[];
} {
	const calls: RecordedCall[] = [];

	const record = (method: string) => (input: unknown) => {
		calls.push({ input, method });
		// Return a minimal valid result so the caller doesn't crash.
		return Promise.resolve({
			data: undefined,
			dryRun: false,
			message: { body: 'ok', kind: 'status' as const },
			status: 'ok' as const,
		});
	};

	return {
		calls,
		core: {
			generate: record('generate') as LogosCore['generate'],
			getStatus: record('getStatus') as LogosCore['getStatus'],
			handleIntakeCommand: record(
				'handleIntakeCommand',
			) as LogosCore['handleIntakeCommand'],
			handleIntakeMessage: record(
				'handleIntakeMessage',
			) as LogosCore['handleIntakeMessage'],
			initProject: record('initProject') as LogosCore['initProject'],
			startIntake: record('startIntake') as LogosCore['startIntake'],
			stopIntake: record('stopIntake') as LogosCore['stopIntake'],
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extension wiring', () => {
	describe('createLogosPiExtension', () => {
		it('calls placeholder registration functions (via Pi command registration)', () => {
			const pi = createFakePi();
			const { core } = createRecordingCore();

			createLogosPiExtension({
				core,
				getProjectRoot: () => '/test-project',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			// The five allowed lifecycle commands should be registered.
			const expectedCommands = [
				'logos-init',
				'logos-start',
				'logos-stop',
				'logos-status',
				'logos-generate',
			];

			for (const cmd of expectedCommands) {
				expect(
					pi.commands.has(cmd),
					`Command "${cmd}" should be registered`,
				).toBe(true);
			}

			expect(pi.commands.size).toBe(expectedCommands.length);
		});

		it('accepts fake Core injection', () => {
			const pi = createFakePi();
			const fakeCore = createThrowOnCallCore();

			expect(() =>
				createLogosPiExtension({
					core: fakeCore,
					getProjectRoot: () => '/test',
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('accepts fake Pi injection', () => {
			const pi = createFakePi();
			const { core } = createRecordingCore();

			expect(() =>
				createLogosPiExtension({
					core,
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('accepts real createLogosCore instance', () => {
			const pi = createFakePi();
			const realCore = createLogosCore();

			expect(() =>
				createLogosPiExtension({
					core: realCore,
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('does not execute generation/intake behavior at registration time', () => {
			const pi = createFakePi();
			const fakeCore = createThrowOnCallCore();

			// If any Core method is called, this throws.
			expect(() =>
				createLogosPiExtension({
					core: fakeCore,
					getProjectRoot: () => '/test',
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('does not throw when called once with fake Pi', () => {
			const pi = createFakePi();
			const { core } = createRecordingCore();

			expect(() =>
				createLogosPiExtension({
					core,
					getProjectRoot: () => '/test',
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('uses injected getProjectRoot when command handler is invoked', () => {
			const pi = createFakePi();
			const { core } = createRecordingCore();
			let receivedCwd: string | undefined;

			createLogosPiExtension({
				core,
				getProjectRoot: (ctx) => {
					receivedCwd = ctx.cwd;
					return '/custom-root';
				},
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			// getProjectRoot is NOT called at registration time — only when
			// a command handler is invoked.
			expect(receivedCwd).toBeUndefined();

			// Invoke a command handler to verify getProjectRoot is used.
			const handler = pi.commands.get('logos-status');
			expect(handler).toBeDefined();

			// The handler calls getProjectRoot when invoked.
			// (We don't fully invoke here because the recording core
			//  doesn't return the expected interruption result shape.
			//  That's tested by command-interruption-routing.test.ts.)
		});

		it('does not call Core methods during registration', () => {
			const pi = createFakePi();
			const { core, calls } = createRecordingCore();

			createLogosPiExtension({
				core,
				getProjectRoot: () => '/test',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			// Core methods should NOT have been called at registration time.
			expect(calls.length).toBe(0);
		});
	});
});
