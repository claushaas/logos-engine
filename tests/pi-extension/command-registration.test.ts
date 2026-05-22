/**
 * Step 7.3 — Command registration tests.
 *
 * Proves that `registerLogosCommands` registers exactly the five allowed
 * LOGOS lifecycle commands, each with a callable handler, and that
 * registration time does not execute Core product behavior.
 *
 * Tests:
 * 1. registerLogosCommands registers exactly five commands.
 * 2. Registered commands are logos-init, logos-start, logos-stop,
 *    logos-status, logos-generate.
 * 3. Registered command names do not include leading slash.
 * 4. Each registered command has a callable handler.
 * 5. Registration does not call Core product methods.
 * 6. createLogosPiExtension registers the five commands through the
 *    command registration boundary.
 */

import { describe, expect, it } from 'vitest';
import type { LogosCore } from '../../src/core/api.js';
import { createLogosCore } from '../../src/core/api.js';
import { LOGOS_LIFECYCLE_COMMANDS } from '../../src/core/index.js';
import { registerLogosCommands } from '../../src/pi-extension/commands/register-commands.js';
import { createLogosPiExtension } from '../../src/pi-extension/create-extension.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';

// ---------------------------------------------------------------------------
// Fake Pi harness
// ---------------------------------------------------------------------------

type RegisteredHandler = (
	ctx: { cwd: string },
	args?: string[],
) => Promise<void> | void;

type FakePi = {
	commands: Map<string, RegisteredHandler>;
	registerCommand: (name: string, handler: RegisteredHandler) => void;
};

function createFakePi(): FakePi {
	const commands = new Map<string, RegisteredHandler>();
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

// ---------------------------------------------------------------------------
// Fake Core that throws if any method is called
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('command registration', () => {
	describe('registerLogosCommands', () => {
		it('registers exactly five commands', () => {
			const pi = createFakePi();
			const core = createThrowOnCallCore();

			registerLogosCommands({
				core,
				getProjectRoot: () => '/test-project',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			expect(pi.commands.size).toBe(LOGOS_LIFECYCLE_COMMANDS.length);
		});

		it('registered command names match LOGOS_LIFECYCLE_COMMANDS', () => {
			const pi = createFakePi();
			const core = createThrowOnCallCore();

			registerLogosCommands({
				core,
				getProjectRoot: () => '/test-project',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			const registeredNames = [...pi.commands.keys()].sort();
			const canonical = [...LOGOS_LIFECYCLE_COMMANDS].sort();

			expect(registeredNames).toEqual(canonical);
		});

		it('registered command names do not include leading slash', () => {
			const pi = createFakePi();
			const core = createThrowOnCallCore();

			registerLogosCommands({
				core,
				getProjectRoot: () => '/test-project',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			for (const name of pi.commands.keys()) {
				expect(name, `"${name}" should not start with /`).not.toMatch(/^\//);
			}
		});

		it('each registered command has a callable handler', () => {
			const pi = createFakePi();
			const core = createThrowOnCallCore();

			registerLogosCommands({
				core,
				getProjectRoot: () => '/test-project',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			for (const [name, handler] of pi.commands) {
				expect(typeof handler, `Handler for "${name}" should be callable`).toBe(
					'function',
				);
			}
		});

		it('registration does not call Core product methods', () => {
			const pi = createFakePi();
			const core = createThrowOnCallCore();

			// If any Core method is called, the throw-on-call Core will throw.
			expect(() =>
				registerLogosCommands({
					core,
					getProjectRoot: () => '/test-project',
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('each required command is individually registered', () => {
			const pi = createFakePi();
			const core = createThrowOnCallCore();

			registerLogosCommands({
				core,
				getProjectRoot: () => '/test-project',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			const required = [
				'logos-init',
				'logos-start',
				'logos-stop',
				'logos-status',
				'logos-generate',
			];

			for (const cmd of required) {
				expect(
					pi.commands.has(cmd),
					`Required command "${cmd}" should be registered`,
				).toBe(true);
			}
		});

		it('uses the LOGOS_LIFECYCLE_COMMANDS source of truth from Core', () => {
			// The canonical lifecycle command list must have exactly five entries
			// and they must match the expected MVP command surface.
			expect(LOGOS_LIFECYCLE_COMMANDS).toEqual([
				'logos-init',
				'logos-start',
				'logos-stop',
				'logos-status',
				'logos-generate',
			]);
		});
	});

	describe('createLogosPiExtension integration', () => {
		it('registers the five allowed commands through the extension factory', () => {
			const pi = createFakePi();
			const core = createThrowOnCallCore();

			createLogosPiExtension({
				core,
				getProjectRoot: () => '/test',
				pi: pi as unknown as LogosPiExtensionDependencies['pi'],
			});

			const expectedCommands = [...LOGOS_LIFECYCLE_COMMANDS].sort();
			const registeredCommands = [...pi.commands.keys()].sort();

			expect(registeredCommands).toEqual(expectedCommands);
			expect(pi.commands.size).toBe(LOGOS_LIFECYCLE_COMMANDS.length);
		});

		it('factory registration does not call Core product methods', () => {
			const pi = createFakePi();
			const core = createThrowOnCallCore();

			expect(() =>
				createLogosPiExtension({
					core,
					getProjectRoot: () => '/test',
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();
		});

		it('accepts real createLogosCore instance without throwing', () => {
			const pi = createFakePi();
			const realCore = createLogosCore();

			expect(() =>
				createLogosPiExtension({
					core: realCore,
					pi: pi as unknown as LogosPiExtensionDependencies['pi'],
				}),
			).not.toThrow();

			expect(pi.commands.size).toBe(LOGOS_LIFECYCLE_COMMANDS.length);
		});
	});
});
