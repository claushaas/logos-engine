/**
 * Step 7.3 — Forbidden commands not registered tests.
 *
 * Proves that none of the forbidden command-first patterns are registered
 * by the Pi extension and that slash-prefixed variants are also absent.
 *
 * Tests:
 * 1. None of the nine forbidden commands are registered.
 * 2. Slash-prefixed variants are not registered (e.g., /logos-next,
 *    /logos-answer, /logos-start, /logos-init).
 * 3. Forbidden command list does not overlap with allowed lifecycle
 *    command list.
 * 4. Unknown command names are absent from the Pi command registry.
 */

import { describe, expect, it } from 'vitest';
import {
	FORBIDDEN_LOGOS_COMMANDS,
	LOGOS_LIFECYCLE_COMMANDS,
} from '../../src/core/index.js';
import { registerLogosCommands } from '../../src/pi-extension/commands/register-commands.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';

// ---------------------------------------------------------------------------
// Fake helpers
// ---------------------------------------------------------------------------

type RegisteredHandler = (
	ctx: { cwd: string },
	args?: string[],
) => Promise<void> | void;

type FakePi = {
	commands: Map<string, RegisteredHandler>;
	registerCommand: (
		name: string,
		options: { handler: RegisteredHandler; description?: string },
	) => void;
};

function createFakePi(): FakePi {
	const commands = new Map<string, RegisteredHandler>();
	return {
		commands,
		registerCommand(name, options) {
			if (commands.has(name)) {
				throw new Error(`Command "${name}" is already registered.`);
			}
			commands.set(name, options.handler);
		},
	};
}

function createNoopCore() {
	const noop = () =>
		Promise.resolve({
			data: undefined,
			dryRun: false,
			message: { body: 'ok', kind: 'status' as const },
			status: 'ok' as const,
		});
	return {
		generate: noop,
		getStatus: noop,
		handleIntakeCommand: noop,
		handleIntakeMessage: noop,
		initProject: noop,
		startIntake: noop,
		stopIntake: noop,
	};
}

function setup(): FakePi {
	const pi = createFakePi();

	registerLogosCommands({
		core: createNoopCore() as LogosPiExtensionDependencies['core'],
		getProjectRoot: () => '/test-project',
		pi: pi as unknown as LogosPiExtensionDependencies['pi'],
	});

	return pi;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('forbidden commands not registered', () => {
	describe('forbidden command-first patterns are absent', () => {
		it('none of the nine forbidden commands are registered', () => {
			const pi = setup();

			expect(
				FORBIDDEN_LOGOS_COMMANDS.length,
				'Expected nine forbidden commands',
			).toBe(9);

			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(
					pi.commands.has(cmd),
					`Forbidden command "${cmd}" should NOT be registered`,
				).toBe(false);
			}
		});

		it('each forbidden command is individually absent', () => {
			const pi = setup();

			const forbiddenSet = new Set(FORBIDDEN_LOGOS_COMMANDS);
			for (const cmd of forbiddenSet) {
				expect(
					pi.commands.has(cmd),
					`Forbidden command "${cmd}" found in registry`,
				).toBe(false);
			}
		});

		it('total registered commands do not exceed allowed count', () => {
			const pi = setup();
			expect(pi.commands.size).toBe(LOGOS_LIFECYCLE_COMMANDS.length);
		});

		it('no forbidden command is accidentally registered', () => {
			const pi = setup();

			for (const name of pi.commands.keys()) {
				expect(
					FORBIDDEN_LOGOS_COMMANDS.includes(
						name as (typeof FORBIDDEN_LOGOS_COMMANDS)[number],
					),
					`"${name}" is in the registry but is forbidden`,
				).toBe(false);
			}
		});
	});

	describe('slash-prefixed variants are not registered', () => {
		it('slash-prefixed forbidden commands are not registered', () => {
			const pi = setup();

			const slashForbidden = FORBIDDEN_LOGOS_COMMANDS.map((c) => `/${c}`);
			for (const cmd of slashForbidden) {
				expect(
					pi.commands.has(cmd),
					`Slash-prefixed forbidden command "${cmd}" should NOT be registered`,
				).toBe(false);
			}
		});

		it('slash-prefixed lifecycle commands are not registered', () => {
			const pi = setup();

			// Registered command names do not include leading slash, so
			// /logos-start, /logos-init, etc. should not exist as keys.
			const slashLifecycle = LOGOS_LIFECYCLE_COMMANDS.map((c) => `/${c}`);
			for (const cmd of slashLifecycle) {
				expect(
					pi.commands.has(cmd),
					`Slash-prefixed lifecycle command "${cmd}" should NOT be registered (names lack leading slash)`,
				).toBe(false);
			}
		});

		it('only non-slash names are registered', () => {
			const pi = setup();

			for (const name of pi.commands.keys()) {
				expect(name, `"${name}" must not start with /`).not.toMatch(/^\//);
			}
		});
	});

	describe('forbidden and allowed command lists do not overlap', () => {
		it('no forbidden command is in the allowed lifecycle list', () => {
			const allowedSet = new Set<string>(LOGOS_LIFECYCLE_COMMANDS);
			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(
					allowedSet.has(cmd),
					`"${cmd}" is forbidden but appears in LOGOS_LIFECYCLE_COMMANDS`,
				).toBe(false);
			}
		});

		it('no allowed command is in the forbidden list', () => {
			const forbiddenSet = new Set<string>(FORBIDDEN_LOGOS_COMMANDS);
			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				expect(
					forbiddenSet.has(cmd),
					`"${cmd}" is an allowed command but appears in FORBIDDEN_LOGOS_COMMANDS`,
				).toBe(false);
			}
		});

		it('allowed and forbidden lists are disjoint', () => {
			const allowedSet = new Set(LOGOS_LIFECYCLE_COMMANDS);
			const forbiddenSet = new Set(FORBIDDEN_LOGOS_COMMANDS);
			const intersection = [...allowedSet].filter((c) => forbiddenSet.has(c));
			expect(intersection).toEqual([]);
		});
	});

	describe('unknown command names are absent from registry', () => {
		it('arbitrary unknown commands are not registered', () => {
			const pi = setup();

			const unknownCommands = [
				'help',
				'unknown',
				'logos-help',
				'logos-reset',
				'logos-config',
				'logos-export',
				'logos-debug',
			];

			for (const cmd of unknownCommands) {
				expect(
					pi.commands.has(cmd),
					`Unknown command "${cmd}" should not be registered`,
				).toBe(false);
			}
		});

		it('empty string is not registered', () => {
			const pi = setup();
			expect(pi.commands.has('')).toBe(false);
		});

		it('only the five allowed commands are registered', () => {
			const pi = setup();
			const registeredNames = [...pi.commands.keys()];
			const allowedSet = new Set(LOGOS_LIFECYCLE_COMMANDS);

			for (const name of registeredNames) {
				expect(
					allowedSet.has(name),
					`"${name}" is registered but not in the allowed lifecycle commands`,
				).toBe(true);
			}
		});
	});
});
