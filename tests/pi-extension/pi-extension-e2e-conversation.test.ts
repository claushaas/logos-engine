/**
 * Step 11.2 — Pi Extension E2E Harness: Conversation Flow.
 *
 * Proves the full init → start → natural input → advancement → follow-up
 * → slash command safety conversational loop end-to-end without real Pi
 * runtime, real Core, network, CLI, TUI, Ink, or React.
 *
 * Assertions:
 * 1. logos-init calls core.handleIntakeCommand, then core.initProject, renders result.
 * 2. logos-start asks first and renders Q1.
 * 3. Natural answer routes through input handler to core.handleIntakeMessage.
 * 4. Core returns Q2 and Pi renders Q2.
 * 5. Follow-up/clarification result is rendered without command-first advancement.
 * 6. Forbidden slash commands are not treated as answers.
 * 7. No command-first advancement occurs.
 * 8. sendUserMessage is never called for LOGOS advancement.
 * 9. projectRoot is always /repo.
 */

import { describe, expect, it } from 'vitest';
import { createLogosPiExtension } from '../../src/pi-extension/create-extension.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import {
	buildCoreFromScenario,
	createFakeCommandContext,
	createFakeCoreScenario,
	createFakePiHost,
	createInitStartQ1Scenario,
	makeFollowUpResult,
	makeIntakeActiveStatus,
	makeQ2Result,
	okResult,
	wireExtension,
} from './pi-extension-e2e-fixtures.js';

// ---------------------------------------------------------------------------
// Helper: build a scenario with init, start Q1, plus Q2 + follow-up
// ---------------------------------------------------------------------------

function buildFullConversationScenario() {
	const base = createInitStartQ1Scenario();

	// After startIntake, we expect:
	// - getStatus (for input router, returns intake_active)
	// - handleIntakeMessage (Q2 answer → advance to Q2)
	// - getStatus (for next input router check)
	// - handleIntakeMessage (partial answer → follow_up)
	base.steps.push(
		{
			method: 'getStatus',
			result: makeIntakeActiveStatus(),
		},
		{
			method: 'handleIntakeMessage',
			result: makeQ2Result(),
		},
		{
			method: 'getStatus',
			result: makeIntakeActiveStatus(),
		},
		{
			method: 'handleIntakeMessage',
			result: makeFollowUpResult(),
		},
	);

	return base;
}

// ---------------------------------------------------------------------------
// Helper: build a scenario with init + start Q1 + intake_active status
// ---------------------------------------------------------------------------

function buildInitStartScenario() {
	const base = createInitStartQ1Scenario();

	// After start, we'll need getStatus for input router.
	base.steps.push({
		method: 'getStatus',
		result: makeIntakeActiveStatus(),
	});

	return base;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi Extension E2E — Conversation Flow', () => {
	describe('logos-init and logos-start', () => {
		it('logos-init calls handleIntakeCommand then initProject, passes projectRoot', async () => {
			const scenario = createInitStartQ1Scenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async (result) => {
					renderedResults.push(result);
				},
			};

			createLogosPiExtension(deps);

			const ctx = createFakeCommandContext({ cwd: '/repo' });
			const handler = fakePi.commands.get('logos-init');
			expect(handler).toBeDefined();
			await handler?.('', ctx);

			// Verify call order.
			expect(scenario.callLog.map((c) => c.method)).toEqual([
				'handleIntakeCommand',
				'initProject',
			]);

			// Verify projectRoot is passed to both calls.
			const hciInput = scenario.callLog[0]?.input as {
				command: string;
				projectRoot: string;
			};
			expect(hciInput?.command).toBe('logos-init');
			expect(hciInput?.projectRoot).toBe('/repo');

			const initInput = scenario.callLog[1]?.input as {
				projectRoot: string;
			};
			expect(initInput?.projectRoot).toBe('/repo');

			// Verify rendering occurred.
			expect(renderedResults.length).toBeGreaterThanOrEqual(1);

			// sendUserMessage must not be called.
			expect(fakePi.sentUserMessages).toHaveLength(0);
		});

		it('logos-start asks first and renders Q1', async () => {
			const scenario = buildInitStartScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async (result) => {
					renderedResults.push(result);
				},
			};

			createLogosPiExtension(deps);

			// Run logos-init first.
			const initHandler = fakePi.commands.get('logos-init');
			expect(initHandler).toBeDefined();
			await initHandler?.('', createFakeCommandContext({ cwd: '/repo' }));

			// Run logos-start.
			const startHandler = fakePi.commands.get('logos-start');
			expect(startHandler).toBeDefined();
			await startHandler?.('', createFakeCommandContext({ cwd: '/repo' }));

			// Verify call order: handleIntakeCommand(init), initProject,
			// handleIntakeCommand(start), startIntake.
			const methods = scenario.callLog.map((c) => c.method);
			expect(methods).toEqual([
				'handleIntakeCommand',
				'initProject',
				'handleIntakeCommand',
				'startIntake',
			]);

			// startIntake projectRoot.
			const startInput = scenario.callLog[3]?.input as {
				projectRoot: string;
			};
			expect(startInput?.projectRoot).toBe('/repo');

			// The last rendered result should be the Q1 question.
			const lastRendered = renderedResults[
				renderedResults.length - 1
			] as Record<string, unknown>;
			const msg = lastRendered?.message as Record<string, unknown> | undefined;
			expect(msg?.kind).toBe('question');
			expect(msg?.body).toContain('central thesis');

			// sendUserMessage must not be called.
			expect(fakePi.sentUserMessages).toHaveLength(0);
		});

		it('logos-start renders Q1 immediately (not a passive toggle)', async () => {
			const scenario = buildInitStartScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async (result) => {
					renderedResults.push(result);
				},
			};

			createLogosPiExtension(deps);

			// Run init + start.
			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// The rendered result for startIntake is present.
			const questionRenders = renderedResults.filter(
				(r) =>
					(r as Record<string, unknown>)?.message !== undefined &&
					((r as Record<string, unknown>).message as Record<string, unknown>)
						?.kind === 'question',
			);
			expect(questionRenders.length).toBeGreaterThan(0);

			// No handleIntakeMessage calls.
			expect(
				scenario.callLog.some((c) => c.method === 'handleIntakeMessage'),
			).toBe(false);
		});
	});

	describe('natural input advancement', () => {
		it('natural answer routes through input handler to core.handleIntakeMessage', async () => {
			const scenario = buildFullConversationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async (result) => {
					renderedResults.push(result);
				},
			};

			createLogosPiExtension(deps);

			// Run init + start.
			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// Now emit natural input.
			const result = await fakePi.emitInput(
				'The project exists to turn unclear product ideas into structured documentation.',
				{ cwd: '/repo' },
			);

			// Input handler should claim the event.
			expect(result?.action).toBe('handled');

			// Verify handleIntakeMessage was called with the correct text.
			const msgCall = scenario.callLog.find(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCall).toBeDefined();
			const msgInput = msgCall?.input as {
				message: string;
				projectRoot: string;
			};
			expect(msgInput?.message).toBe(
				'The project exists to turn unclear product ideas into structured documentation.',
			);
			expect(msgInput?.projectRoot).toBe('/repo');

			// sendUserMessage must not be called.
			expect(fakePi.sentUserMessages).toHaveLength(0);
		});

		it('Core returns Q2 and Pi renders it', async () => {
			const scenario = buildFullConversationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async (result) => {
					renderedResults.push(result);
				},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// Emit answer.
			await fakePi.emitInput('A clear answer to Q1.', { cwd: '/repo' });

			// Check Q2 was rendered.
			const questionRenders = renderedResults.filter(
				(r) =>
					(r as Record<string, unknown>)?.message !== undefined &&
					((r as Record<string, unknown>).message as Record<string, unknown>)
						?.kind === 'question',
			);
			expect(questionRenders.length).toBeGreaterThanOrEqual(1);

			const q2Render = renderedResults.find(
				(r) =>
					(r as Record<string, unknown>)?.message !== undefined &&
					((r as Record<string, unknown>).message as Record<string, unknown>)
						?.body === 'Who is the primary audience for this project?',
			);
			expect(q2Render).toBeDefined();
		});
	});

	describe('follow-up / non-advancing result', () => {
		it('follow-up result is rendered after second natural input', async () => {
			const scenario = buildFullConversationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async (result) => {
					renderedResults.push(result);
				},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// First answer → Q2.
			await fakePi.emitInput('A clear answer to Q1.', { cwd: '/repo' });

			// Second answer → follow_up.
			await fakePi.emitInput('Software teams.', { cwd: '/repo' });

			// Check follow_up was rendered.
			const followUpRender = renderedResults.find(
				(r) =>
					(r as Record<string, unknown>)?.message !== undefined &&
					((r as Record<string, unknown>).message as Record<string, unknown>)
						?.kind === 'follow_up',
			);
			expect(followUpRender).toBeDefined();

			// sendUserMessage must not be called.
			expect(fakePi.sentUserMessages).toHaveLength(0);
		});

		it('no command-first advancement for follow-up', async () => {
			const scenario = buildFullConversationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// Emit answers.
			await fakePi.emitInput('Clear answer.', { cwd: '/repo' });
			await fakePi.emitInput('Software teams.', { cwd: '/repo' });

			// No /logos-next or /logos-answer was ever called.
			// The advancement happened through natural input only.
			const msgCalls = scenario.callLog.filter(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCalls.length).toBe(2);
		});
	});

	describe('slash command safety', () => {
		it('forbidden slash command /logos-next returns continue (not treated as answer)', async () => {
			const scenario = buildInitStartScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// Count handleIntakeMessage calls before emitting slash.
			const beforeCount = scenario.callLog.filter(
				(c) => c.method === 'handleIntakeMessage',
			).length;

			const result = await fakePi.emitInput('/logos-next', { cwd: '/repo' });

			expect(result?.action).toBe('continue');

			// handleIntakeMessage should NOT have been called.
			const afterCount = scenario.callLog.filter(
				(c) => c.method === 'handleIntakeMessage',
			).length;
			expect(afterCount).toBe(beforeCount);
		});

		it('forbidden /logos-answer slash command is not treated as answer', async () => {
			const scenario = buildInitStartScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			const beforeCount = scenario.callLog.filter(
				(c) => c.method === 'handleIntakeMessage',
			).length;

			const result = await fakePi.emitInput('/logos-answer', { cwd: '/repo' });

			expect(result?.action).toBe('continue');
			expect(
				scenario.callLog.filter((c) => c.method === 'handleIntakeMessage')
					.length,
			).toBe(beforeCount);
		});

		it('/logos-skip forbidden command is not treated as answer', async () => {
			const scenario = buildInitStartScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			const beforeCount = scenario.callLog.filter(
				(c) => c.method === 'handleIntakeMessage',
			).length;

			const result = await fakePi.emitInput('/logos-skip', { cwd: '/repo' });

			expect(result?.action).toBe('continue');
			expect(
				scenario.callLog.filter((c) => c.method === 'handleIntakeMessage')
					.length,
			).toBe(beforeCount);
		});

		it('unknown slash command returns continue', async () => {
			const scenario = buildInitStartScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			const result = await fakePi.emitInput('/unknown', { cwd: '/repo' });

			expect(result?.action).toBe('continue');
		});

		it('forbidden commands are not registered in fake Pi command map', async () => {
			const { fakePi } = wireExtension(createLogosPiExtension);

			const forbidden = [
				'logos-next',
				'logos-answer',
				'logos-continue',
				'logos-question',
				'logos-phase',
				'logos-doc',
				'logos-set-answer',
				'logos-skip',
				'logos-followup',
			];

			for (const cmd of forbidden) {
				expect(
					fakePi.commands.has(cmd),
					`Forbidden command "${cmd}" must not be registered`,
				).toBe(false);
			}
		});
	});

	describe('projectRoot pass-through', () => {
		it('initProject receives /repo', async () => {
			const scenario = buildInitStartScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			const initCall = scenario.callLog.find((c) => c.method === 'initProject');
			expect(initCall).toBeDefined();
			expect((initCall?.input as { projectRoot: string })?.projectRoot).toBe(
				'/repo',
			);
		});

		it('startIntake receives /repo', async () => {
			const scenario = buildInitStartScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			const startCall = scenario.callLog.find(
				(c) => c.method === 'startIntake',
			);
			expect(startCall).toBeDefined();
			expect((startCall?.input as { projectRoot: string })?.projectRoot).toBe(
				'/repo',
			);
		});

		it('handleIntakeMessage receives /repo', async () => {
			const scenario = buildFullConversationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand(
				'logos-init',
				createFakeCommandContext({ cwd: '/repo' }),
			);
			await fakePi.invokeCommand(
				'logos-start',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			await fakePi.emitInput('An answer.', { cwd: '/repo' });

			const msgCall = scenario.callLog.find(
				(c) => c.method === 'handleIntakeMessage',
			);
			expect(msgCall).toBeDefined();
			expect((msgCall?.input as { projectRoot: string })?.projectRoot).toBe(
				'/repo',
			);
		});
	});
});

// ---------------------------------------------------------------------------
// Status command during active intake test
// ---------------------------------------------------------------------------

describe('Pi Extension E2E — Status During Active Intake', () => {
	it('logos-status calls handleIntakeCommand, then getStatus on pause_and_execute', async () => {
		const scenario = createFakeCoreScenario([
			{
				method: 'handleIntakeCommand',
				result: okResult('status', 'Paused intake for status command.', {
					command: 'logos-status',
					disposition: 'pause_and_execute',
					mode: 'paused',
					persisted: true,
					stateChanged: true,
				}),
			},
			{
				method: 'getStatus',
				result: okResult('status', 'Intake is paused. Q1 is active.', {
					activeQuestionId: 'q1',
					generationReadiness: {
						blockers: [],
						completenessScore: 0.3,
						ready: false,
						warnings: [],
					},
					initialized: true,
					mode: 'paused',
					progress: {
						byPhase: {},
						contradictory: 0,
						missing: 5,
						partial: 0,
						skipped: 0,
						sufficient: 1,
						total: 6,
					},
				}),
			},
		]);

		const core = buildCoreFromScenario(scenario);
		const fakePi = createFakePiHost();
		const renderedResults: unknown[] = [];

		const deps: LogosPiExtensionDependencies = {
			core,
			getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
			now: () => '2026-05-22T12:00:00.000Z',
			pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
			renderCoreResult: async (result) => {
				renderedResults.push(result);
			},
		};

		createLogosPiExtension(deps);

		await fakePi.invokeCommand(
			'logos-status',
			createFakeCommandContext({ cwd: '/repo' }),
		);

		// Verify call order.
		expect(scenario.callLog.map((c) => c.method)).toEqual([
			'handleIntakeCommand',
			'getStatus',
		]);

		// Verify projectRoot.
		expect(
			(scenario.callLog[0]?.input as { projectRoot: string })?.projectRoot,
		).toBe('/repo');
		expect(
			(scenario.callLog[1]?.input as { projectRoot: string })?.projectRoot,
		).toBe('/repo');

		// Results are rendered.
		expect(renderedResults.length).toBeGreaterThanOrEqual(1);

		// sendUserMessage must not be called.
		expect(fakePi.sentUserMessages).toHaveLength(0);
	});
});
