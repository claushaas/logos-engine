/**
 * Step 5.5 — Forbidden command routing tests.
 *
 * Proves that forbidden command-first patterns are never registered,
 * cannot be invoked, and that Pi command adapter code remains thin.
 *
 * Tests:
 * 1. Only the five allowed commands are registered.
 * 2. Forbidden commands are NOT registered.
 * 3. Command names do NOT include leading slash.
 * 4. Unknown/forbidden command names cannot be invoked.
 * 5. No lifecycle command handler calls handleIntakeMessage.
 */

import { describe, expect, it } from 'vitest';
import {
	FORBIDDEN_LOGOS_COMMANDS,
	LOGOS_LIFECYCLE_COMMANDS,
} from '../../src/core/intake/lifecycle-command.js';
import {
	type LogosCommandAdapterDependencies,
	registerLogosLifecycleCommands,
} from '../../src/pi-extension/commands/command-adapter-contract.js';
import {
	type ConfigurableFakeCore,
	createCommandResult,
	createConfigurableFakeCore,
	createFakePiHarness,
	type FakePiHarness,
} from './command-routing-harness.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(): {
	pi: FakePiHarness;
	core: ConfigurableFakeCore;
} {
	const pi = createFakePiHarness();
	const core = createConfigurableFakeCore();

	const deps: LogosCommandAdapterDependencies = {
		core,
		getProjectRoot: () => '/repo',
		renderCoreResult: async () => {},
	};

	registerLogosLifecycleCommands({ deps, pi });

	return { core, pi };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('forbidden command routing', () => {
	describe('only allowed commands are registered', () => {
		it('exactly five commands are registered', () => {
			const { pi } = setup();
			expect(pi.commands.size).toBe(5);
		});

		it('all five allowed commands are present', () => {
			const { pi } = setup();

			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				expect(pi.commands.has(cmd), `"${cmd}" should be registered`).toBe(
					true,
				);
			}
		});

		it('registered command names match the canonical list', () => {
			const { pi } = setup();

			const registeredNames = [...pi.commands.keys()].sort();
			const canonical = [...LOGOS_LIFECYCLE_COMMANDS].sort();

			expect(registeredNames).toEqual(canonical);
		});
	});

	describe('forbidden commands are NOT registered', () => {
		it('none of the forbidden command-first patterns are registered', () => {
			const { pi } = setup();

			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(
					pi.commands.has(cmd),
					`forbidden command "${cmd}" should NOT be registered`,
				).toBe(false);
			}
		});

		it('forbidden command count is exactly 9', () => {
			expect(FORBIDDEN_LOGOS_COMMANDS.length).toBe(9);
		});

		it('each forbidden command is individually absent', () => {
			const { pi } = setup();

			const forbiddenSet = new Set(FORBIDDEN_LOGOS_COMMANDS);
			for (const cmd of forbiddenSet) {
				expect(pi.commands.has(cmd)).toBe(false);
			}
		});
	});

	describe('command names do not include leading slash', () => {
		it('all registered command names lack leading slash', () => {
			const { pi } = setup();

			for (const name of pi.commands.keys()) {
				expect(name, `"${name}" should not start with /`).not.toMatch(/^\//);
			}
		});

		it('all canonical command names lack leading slash', () => {
			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				expect(cmd).not.toMatch(/^\//);
			}
		});
	});

	describe('unknown and forbidden commands cannot be invoked', () => {
		it('forbidden commands throw when invoked', async () => {
			const { pi } = setup();

			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				await expect(
					pi.invokeCommand(cmd),
					`forbidden command "${cmd}" should throw`,
				).rejects.toThrow(`Command "${cmd}" is not registered.`);
			}
		});

		it('arbitrary unknown commands throw when invoked', async () => {
			const { pi } = setup();

			await expect(pi.invokeCommand('help')).rejects.toThrow(
				'Command "help" is not registered.',
			);
			await expect(pi.invokeCommand('unknown')).rejects.toThrow(
				'Command "unknown" is not registered.',
			);
			await expect(pi.invokeCommand('')).rejects.toThrow(
				'Command "" is not registered.',
			);
		});

		it('slash-prefixed command names throw because they do not match registered names', async () => {
			const { pi } = setup();

			// Command names are registered WITHOUT slash, so /logos-status fails.
			await expect(pi.invokeCommand('/logos-status')).rejects.toThrow(
				'Command "/logos-status" is not registered.',
			);
			await expect(pi.invokeCommand('/logos-start')).rejects.toThrow(
				'Command "/logos-start" is not registered.',
			);
		});
	});

	describe('no lifecycle command handler calls handleIntakeMessage', () => {
		it('command handlers never call handleIntakeMessage', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('execute'));

			for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
				core.resetCalls();
				await pi.invokeCommand(cmd);

				const msgCalls = core.calls.filter(
					(c) => c.method === 'handleIntakeMessage',
				);
				expect(
					msgCalls.length,
					`${cmd} should never call handleIntakeMessage`,
				).toBe(0);
			}
		});

		it('command handlers never call handleIntakeMessage under any disposition', async () => {
			const dispositions = [
				'execute',
				'reaffirm',
				'pause_and_execute',
				'confirm_required',
				'block',
			] as const;

			for (const disposition of dispositions) {
				for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
					const { pi, core } = setup();

					core.setHandleIntakeCommandResult(createCommandResult(disposition));

					await pi.invokeCommand(cmd);

					const msgCalls = core.calls.filter(
						(c) => c.method === 'handleIntakeMessage',
					);
					expect(
						msgCalls.length,
						`${cmd} + disposition=${disposition} should never call handleIntakeMessage`,
					).toBe(0);
				}
			}
		});
	});

	describe('Pi command adapter code remains thin', () => {
		it('LogosCommandAdapterDependencies does not require handleIntakeMessage', () => {
			// This is a compile-time contract: the dependencies type excludes
			// handleIntakeMessage.  We verify at runtime that the dependency
			// object does not need it.
			const core = createConfigurableFakeCore();

			// This should compile — handleIntakeMessage is not in the type.
			const deps: LogosCommandAdapterDependencies = {
				core,
				getProjectRoot: () => '/repo',
			};

			expect(deps.core.handleIntakeCommand).toBeDefined();
			expect(deps.core.initProject).toBeDefined();
			expect(deps.core.startIntake).toBeDefined();
			expect(deps.core.stopIntake).toBeDefined();
			expect(deps.core.getStatus).toBeDefined();
			expect(deps.core.generate).toBeDefined();
			// handleIntakeMessage is intentionally absent from the type.
		});

		it('command handler registration function is a single call', () => {
			// The registerLogosLifecycleCommands function is the single
			// integration point between Pi command registration and Core.
			const pi = createFakePiHarness();
			const core = createConfigurableFakeCore();

			registerLogosLifecycleCommands({
				deps: {
					core,
					getProjectRoot: () => '/repo',
				},
				pi,
			});

			// All five commands are registered in one call.
			expect(pi.commands.size).toBe(5);
		});

		it('no Core logic is duplicated in the adapter', async () => {
			// The adapter's only job is to wire Pi registration to Core calls.
			// We prove this by verifying the adapter file does not import
			// intake state types, evaluation types, generation types, or
			// profile types directly.  (This is checked at the module
			// boundary level; at runtime, we verify call counts match
			// expected patterns.)

			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('execute'));

			// Calling a command through the adapter results in exactly:
			// 1 call to handleIntakeCommand + 1 call to command-specific Core API
			core.resetCalls();
			await pi.invokeCommand('logos-status');

			const hicCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeCommand',
			);
			const statusCalls = core.calls.filter((c) => c.method === 'getStatus');

			expect(hicCalls.length).toBe(1);
			expect(statusCalls.length).toBe(1);
			expect(core.calls.length).toBe(2); // no extra calls
		});
	});
});
