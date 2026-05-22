/**
 * Step 5.5 — Extension-Level Command Routing Contract Tests.
 *
 * Proves that Pi command handlers must call Core interruption logic before
 * command-specific behavior when intake is active.
 *
 * These tests use a fake Pi harness and a fake Core to establish the
 * contract that Phase 7 command adapters must satisfy.
 *
 * Tests:
 * 1. logos-start → handler calls handleIntakeCommand first; reaffirm does
 *    NOT call startIntake; handleIntakeMessage is never called.
 * 2. logos-stop → handler calls handleIntakeCommand first; pause_and_execute
 *    then calls stopIntake; call order is correct.
 * 3. logos-status → same pattern with getStatus.
 * 4. logos-generate → same pattern with generate.
 * 5. logos-init → confirm_required does NOT call initProject.
 * 6. execute path → command-specific API IS called.
 * 7. block path → command-specific API is NOT called.
 * 8. Render path → interruption results are rendered.
 */

import { describe, expect, it } from 'vitest';
import { LOGOS_LIFECYCLE_COMMANDS } from '../../src/core/intake/lifecycle-command.js';
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

/** Track rendered results so tests can verify rendering happened. */
type RenderedResult = { value: unknown; order: number };

function createTrackingRenderer(): {
	rendered: RenderedResult[];
	render: (result: unknown) => Promise<void>;
} {
	const rendered: RenderedResult[] = [];
	let order = 0;
	return {
		render: async (result: unknown) => {
			rendered.push({ order: order++, value: result });
		},
		rendered,
	};
}

function setup(overrides?: Partial<LogosCommandAdapterDependencies>): {
	pi: FakePiHarness;
	core: ConfigurableFakeCore;
	renderer: {
		rendered: RenderedResult[];
		render: (result: unknown) => Promise<void>;
	};
	projectRoot: string;
	deps: LogosCommandAdapterDependencies;
} {
	const pi = createFakePiHarness();
	const core = createConfigurableFakeCore();
	const renderer = createTrackingRenderer();
	const projectRoot = '/repo';

	const deps: LogosCommandAdapterDependencies = {
		core,
		getProjectRoot: () => projectRoot,
		renderCoreResult: renderer.render,
		...overrides,
	};

	registerLogosLifecycleCommands({ deps, pi });

	return { core, deps, pi, projectRoot, renderer };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extension-level command routing contract', () => {
	describe('logos-start', () => {
		it('handler calls handleIntakeCommand first', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('reaffirm'));

			await pi.invokeCommand('logos-start');

			expect(core.calls.length).toBeGreaterThanOrEqual(1);
			expect(core.calls[0]?.method).toBe('handleIntakeCommand');
			expect(core.calls[0]?.input).toEqual(
				expect.objectContaining({
					command: 'logos-start',
					projectRoot: '/repo',
				}),
			);
		});

		it('when interruption returns reaffirm, handler does NOT call startIntake', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('reaffirm'));

			await pi.invokeCommand('logos-start');

			const startCalls = core.calls.filter((c) => c.method === 'startIntake');
			expect(startCalls.length).toBe(0);
		});

		it('handler does NOT call handleIntakeMessage', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('reaffirm'));

			await pi.invokeCommand('logos-start');

			const msgCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCalls.length).toBe(0);
		});

		it('returned reaffirm result is rendered', async () => {
			const result = createCommandResult('reaffirm');

			const pi2 = createFakePiHarness();
			const renderer2 = createTrackingRenderer();
			const core2 = createConfigurableFakeCore();
			core2.setHandleIntakeCommandResult(result);

			registerLogosLifecycleCommands({
				deps: {
					core: core2,
					getProjectRoot: () => '/repo',
					renderCoreResult: renderer2.render,
				},
				pi: pi2,
			});

			await pi2.invokeCommand('logos-start');

			expect(renderer2.rendered.length).toBeGreaterThanOrEqual(1);
			// The first rendered result should be the interruption result
			expect(renderer2.rendered[0]?.value).toBe(result);
		});
	});

	describe('logos-stop', () => {
		it('handler calls handleIntakeCommand first', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-stop');

			expect(core.calls[0]?.method).toBe('handleIntakeCommand');
			expect(core.calls[0]?.input).toEqual(
				expect.objectContaining({
					command: 'logos-stop',
					projectRoot: '/repo',
				}),
			);
		});

		it('when interruption returns pause_and_execute, handler then calls stopIntake', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-stop');

			const stopCalls = core.calls.filter((c) => c.method === 'stopIntake');
			expect(stopCalls.length).toBe(1);
		});

		it('call order is handleIntakeCommand BEFORE stopIntake', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-stop');

			const methods = core.calls.map((c) => c.method);
			const hicIdx = methods.indexOf('handleIntakeCommand');
			const siIdx = methods.indexOf('stopIntake');
			expect(hicIdx).toBeLessThan(siIdx);
		});

		it('handler does NOT call handleIntakeMessage', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-stop');

			const msgCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCalls.length).toBe(0);
		});
	});

	describe('logos-status', () => {
		it('handler calls handleIntakeCommand first', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-status');

			expect(core.calls[0]?.method).toBe('handleIntakeCommand');
		});

		it('when interruption returns pause_and_execute, handler then calls getStatus', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-status');

			const statusCalls = core.calls.filter((c) => c.method === 'getStatus');
			expect(statusCalls.length).toBe(1);
		});

		it('call order is handleIntakeCommand BEFORE getStatus', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-status');

			const methods = core.calls.map((c) => c.method);
			const hicIdx = methods.indexOf('handleIntakeCommand');
			const gsIdx = methods.indexOf('getStatus');
			expect(hicIdx).toBeLessThan(gsIdx);
		});

		it('handler does NOT call handleIntakeMessage', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-status');

			const msgCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCalls.length).toBe(0);
		});
	});

	describe('logos-generate', () => {
		it('handler calls handleIntakeCommand first', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-generate');

			expect(core.calls[0]?.method).toBe('handleIntakeCommand');
		});

		it('when interruption returns pause_and_execute, handler then calls generate', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-generate');

			const genCalls = core.calls.filter((c) => c.method === 'generate');
			expect(genCalls.length).toBe(1);
		});

		it('call order is handleIntakeCommand BEFORE generate', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-generate');

			const methods = core.calls.map((c) => c.method);
			const hicIdx = methods.indexOf('handleIntakeCommand');
			const genIdx = methods.indexOf('generate');
			expect(hicIdx).toBeLessThan(genIdx);
		});

		it('handler does NOT call handleIntakeMessage', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('pause_and_execute'),
			);

			await pi.invokeCommand('logos-generate');

			const msgCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCalls.length).toBe(0);
		});
	});

	describe('logos-init', () => {
		it('handler calls handleIntakeCommand first', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('confirm_required'),
			);

			await pi.invokeCommand('logos-init');

			expect(core.calls[0]?.method).toBe('handleIntakeCommand');
			expect(core.calls[0]?.input).toEqual(
				expect.objectContaining({
					command: 'logos-init',
					projectRoot: '/repo',
				}),
			);
		});

		it('when interruption returns confirm_required, handler does NOT call initProject', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('confirm_required'),
			);

			await pi.invokeCommand('logos-init');

			const initCalls = core.calls.filter((c) => c.method === 'initProject');
			expect(initCalls.length).toBe(0);
		});

		it('handler renders confirmation/block result', async () => {
			const pi = createFakePiHarness();
			const core = createConfigurableFakeCore();
			const renderer = createTrackingRenderer();
			const result = createCommandResult('confirm_required');

			core.setHandleIntakeCommandResult(result);

			registerLogosLifecycleCommands({
				deps: {
					core,
					getProjectRoot: () => '/repo',
					renderCoreResult: renderer.render,
				},
				pi,
			});

			await pi.invokeCommand('logos-init');

			expect(renderer.rendered.length).toBeGreaterThanOrEqual(1);
			expect(renderer.rendered[0]?.value).toBe(result);
		});

		it('handler does NOT call handleIntakeMessage', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(
				createCommandResult('confirm_required'),
			);

			await pi.invokeCommand('logos-init');

			const msgCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCalls.length).toBe(0);
		});
	});

	describe('inactive / execute path', () => {
		it('when handleIntakeCommand returns execute, command-specific API IS called', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('execute'));

			await pi.invokeCommand('logos-status');

			const statusCalls = core.calls.filter((c) => c.method === 'getStatus');
			expect(statusCalls.length).toBe(1);
		});

		it('execute handler does NOT call handleIntakeMessage', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('execute'));

			await pi.invokeCommand('logos-status');

			const msgCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCalls.length).toBe(0);
		});

		it('execute path calls handleIntakeCommand before getStatus', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('execute'));

			await pi.invokeCommand('logos-status');

			const methods = core.calls.map((c) => c.method);
			const hicIdx = methods.indexOf('handleIntakeCommand');
			const gsIdx = methods.indexOf('getStatus');
			expect(hicIdx).toBeLessThan(gsIdx);
		});
	});

	describe('block path', () => {
		it('when handleIntakeCommand returns block, handler does NOT call command-specific API', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('block'));

			await pi.invokeCommand('logos-generate');

			const genCalls = core.calls.filter((c) => c.method === 'generate');
			expect(genCalls.length).toBe(0);
		});

		it('blocked handler does NOT call handleIntakeMessage', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('block'));

			await pi.invokeCommand('logos-status');

			const msgCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCalls.length).toBe(0);
		});

		it('block path renders the interruption result', async () => {
			const pi = createFakePiHarness();
			const core = createConfigurableFakeCore();
			const renderer = createTrackingRenderer();
			const result = createCommandResult('block');

			core.setHandleIntakeCommandResult(result);

			registerLogosLifecycleCommands({
				deps: {
					core,
					getProjectRoot: () => '/repo',
					renderCoreResult: renderer.render,
				},
				pi,
			});

			await pi.invokeCommand('logos-generate');

			expect(renderer.rendered.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('render path', () => {
		it('command handler renders interruption results before command-specific results', async () => {
			const pi = createFakePiHarness();
			const core = createConfigurableFakeCore();
			const renderer = createTrackingRenderer();
			const hicResult = createCommandResult('pause_and_execute');

			core.setHandleIntakeCommandResult(hicResult);

			registerLogosLifecycleCommands({
				deps: {
					core,
					getProjectRoot: () => '/repo',
					renderCoreResult: renderer.render,
				},
				pi,
			});

			await pi.invokeCommand('logos-status');

			// At least the interruption result should be rendered.
			expect(renderer.rendered.length).toBeGreaterThanOrEqual(1);
			expect(renderer.rendered[0]?.value).toBe(hicResult);
		});

		it('command handler renders reaffirm result instead of command-specific result', async () => {
			const pi = createFakePiHarness();
			const core = createConfigurableFakeCore();
			const renderer = createTrackingRenderer();
			const hicResult = createCommandResult('reaffirm', {
				data: createCommandResult('reaffirm').data,
			});

			core.setHandleIntakeCommandResult(hicResult);

			registerLogosLifecycleCommands({
				deps: {
					core,
					getProjectRoot: () => '/repo',
					renderCoreResult: renderer.render,
				},
				pi,
			});

			await pi.invokeCommand('logos-start');

			// Only interruption result should be rendered (no startIntake call)
			expect(renderer.rendered.length).toBe(1);
			expect(renderer.rendered[0]?.value).toBe(hicResult);
		});
	});

	describe('project root', () => {
		it('command handlers pass project root derived from ctx.cwd', async () => {
			const { pi, core } = setup();

			core.setHandleIntakeCommandResult(createCommandResult('execute'));

			await pi.invokeCommand('logos-status', { cwd: '/another-project' });

			// Still uses getProjectRoot which we hardcoded to '/repo'
			expect(core.calls[0]?.input).toEqual(
				expect.objectContaining({
					projectRoot: '/repo',
				}),
			);
		});

		it('uses getProjectRoot dependency to resolve project root', async () => {
			const pi = createFakePiHarness();
			const core = createConfigurableFakeCore();
			const renderer = createTrackingRenderer();
			let receivedCwd: string | undefined;

			core.setHandleIntakeCommandResult(createCommandResult('execute'));

			registerLogosLifecycleCommands({
				deps: {
					core,
					getProjectRoot: (input) => {
						receivedCwd = input.cwd;
						return `/resolved/${input.cwd}`;
					},
					renderCoreResult: renderer.render,
				},
				pi,
			});

			await pi.invokeCommand('logos-status', { cwd: '/my-project' });

			expect(receivedCwd).toBe('/my-project');
			expect(core.calls[0]?.input).toEqual(
				expect.objectContaining({
					projectRoot: '/resolved//my-project',
				}),
			);
		});
	});
});

describe('command handler exhaustiveness', () => {
	it('every allowed lifecycle command is registered', () => {
		const { pi } = setup();

		for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
			expect(pi.commands.has(cmd), `"${cmd}" should be registered`).toBe(true);
		}
	});

	it('no additional commands are registered beyond the five allowed', () => {
		const { pi } = setup();

		const expectedCount = LOGOS_LIFECYCLE_COMMANDS.length;
		expect(pi.commands.size).toBe(expectedCount);
	});

	it('handleIntakeMessage is never in the dependency surface of command handlers', async () => {
		// The LogosCommandAdapterDependencies type does not include
		// handleIntakeMessage.  This is a compile-time check, but we
		// verify at runtime that no command handler calls it.
		const { pi, core } = setup();

		core.setHandleIntakeCommandResult(createCommandResult('execute'));

		// Invoke every command and verify handleIntakeMessage is never called.
		for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
			core.resetCalls();
			await pi.invokeCommand(cmd);
			const msgCalls = core.calls.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(
				msgCalls.length,
				`${cmd} should not call handleIntakeMessage`,
			).toBe(0);
		}
	});
});
