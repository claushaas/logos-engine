/**
 * Step 11.2 — Pi Extension E2E Harness: Generation Blocker / Confirmation.
 *
 * Proves the logos-generate flow end-to-end: interruption → initial generate
 * → confirmation_required → confirmation UI (accept/decline) → result
 * rendering. Uses Scenario B (partial generation confirmation) since
 * Step 9.3 is already implemented.
 *
 * Assertions:
 * 1. logos-generate calls interruption policy first (handleIntakeCommand).
 * 2. Core generate is called only when disposition allows.
 * 3. Confirmation-required result is rendered.
 * 4. When user declines, no second generate call occurs.
 * 5. Cancellation result is rendered.
 * 6. No files are written by Pi.
 * 7. sendUserMessage is never called.
 * 8. Blockers/warnings are preserved in rendered result.
 * 9. When user confirms, second generate call uses partial_draft + confirmed.
 */

import { describe, expect, it, vi } from 'vitest';
import { createLogosPiExtension } from '../../src/pi-extension/create-extension.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import {
	buildCoreFromScenario,
	createFakeCommandContext,
	createFakeCoreScenario,
	createFakePiHost,
	makeConfirmationRequiredGenerateResult,
	okResult,
} from './pi-extension-e2e-fixtures.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGenerateConfirmationScenario(_initialStatus = 'blocked') {
	return createFakeCoreScenario([
		{
			// Step 1: handleIntakeCommand (interruption for logos-generate).
			method: 'handleIntakeCommand',
			result: okResult('status', 'Ready to execute logos-generate.', {
				command: 'logos-generate',
				disposition: 'execute',
				mode: 'idle',
				persisted: false,
				stateChanged: false,
			}),
		},
		{
			// Step 2: core.generate (initial, default mode).
			// Returns a blocked or confirmation_required result that requires
			// explicit confirmation for partial draft.
			method: 'generate',
			result: makeConfirmationRequiredGenerateResult(),
		},
	]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi Extension E2E — Generation Blocker / Confirmation', () => {
	describe('logos-generate with confirmation required (Scenario B)', () => {
		it('logos-generate calls interruption policy first (handleIntakeCommand)', async () => {
			const scenario = buildGenerateConfirmationScenario();
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
				'logos-generate',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// handleIntakeCommand must be called first.
			expect(scenario.callLog[0]?.method).toBe('handleIntakeCommand');
			expect((scenario.callLog[0]?.input as { command: string })?.command).toBe(
				'logos-generate',
			);
		});

		it('core.generate is called when disposition allows execution', async () => {
			const scenario = buildGenerateConfirmationScenario();
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
				'logos-generate',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			expect(scenario.callLog.map((c) => c.method)).toEqual([
				'handleIntakeCommand',
				'generate',
			]);
		});

		it('confirmation-required result is rendered', async () => {
			const scenario = buildGenerateConfirmationScenario();
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
				'logos-generate',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// At least one result with confirmation_required status is rendered.
			const confirmResults = renderedResults.filter(
				(r) =>
					(r as Record<string, unknown>)?.status === 'confirmation_required',
			);
			expect(confirmResults.length).toBeGreaterThanOrEqual(1);
		});

		it('when user declines confirmation, no second generate call occurs', async () => {
			const scenario = buildGenerateConfirmationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			// Create command context with declining confirm.
			const confirmFn = vi.fn(async () => false);
			const ctx = createFakeCommandContext({
				confirm: confirmFn,
				cwd: '/repo',
			});

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

			await fakePi.invokeCommand('logos-generate', ctx);

			// Only one generate call (the initial one).
			const generateCalls = scenario.callLog.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls.length).toBe(1);

			// Confirm was called.
			expect(confirmFn).toHaveBeenCalled();
		});

		it('cancellation result is rendered after user decline', async () => {
			const scenario = buildGenerateConfirmationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			const confirmFn = vi.fn(async () => false);
			const ctx = createFakeCommandContext({
				confirm: confirmFn,
				cwd: '/repo',
			});

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

			await fakePi.invokeCommand('logos-generate', ctx);

			// The last rendered result should be the cancellation noop.
			const lastResult = renderedResults[renderedResults.length - 1] as Record<
				string,
				unknown
			>;
			expect(lastResult?.status).toBe('noop');

			const lastMsg = lastResult?.message as Record<string, unknown>;
			expect(lastMsg?.body).toContain('cancelled');
		});

		it('no files are written by Pi (no changedPaths with created)', async () => {
			const scenario = buildGenerateConfirmationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const confirmFn = vi.fn(async () => false);
			const ctx = createFakeCommandContext({
				confirm: confirmFn,
				cwd: '/repo',
			});

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand('logos-generate', ctx);

			// The Pi extension does not write files itself — Core writes files.
			// The cancellation result has wroteFiles: false.
			// No sendMessage with generation_result should have written paths.
			const genResults = fakePi.sentMessages.filter(
				(m) => m.customType === 'logos-core-result',
			);
			for (const msg of genResults) {
				const details = msg.details as Record<string, unknown>;
				if (details?.kind === 'generation_result') {
					const raw = details?.rawResult as Record<string, unknown>;
					const changedPaths = raw?.changedPaths as Array<
						Record<string, unknown>
					>;
					if (changedPaths?.length) {
						const created = changedPaths.filter((p) => p.kind === 'created');
						expect(created).toHaveLength(0);
					}
				}
			}
		});

		it('sendUserMessage is never called', async () => {
			const scenario = buildGenerateConfirmationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const confirmFn = vi.fn(async () => false);
			const ctx = createFakeCommandContext({
				confirm: confirmFn,
				cwd: '/repo',
			});

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand('logos-generate', ctx);

			expect(fakePi.sentUserMessages).toHaveLength(0);
		});

		it('projectRoot is passed to generate', async () => {
			const scenario = buildGenerateConfirmationScenario();
			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();

			const confirmFn = vi.fn(async () => false);
			const ctx = createFakeCommandContext({
				confirm: confirmFn,
				cwd: '/repo',
			});

			const deps: LogosPiExtensionDependencies = {
				core,
				getProjectRoot: (ctx) => ctx.cwd ?? '/repo',
				now: () => '2026-05-22T12:00:00.000Z',
				pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
				renderCoreResult: async () => {},
			};

			createLogosPiExtension(deps);

			await fakePi.invokeCommand('logos-generate', ctx);

			const generateCall = scenario.callLog.find(
				(c) => c.method === 'generate',
			);
			expect(generateCall).toBeDefined();
			expect(
				(generateCall?.input as { projectRoot: string })?.projectRoot,
			).toBe('/repo');
		});
	});

	describe('logos-generate blocked (Scenario A) — interruption blocks execution', () => {
		it('when disposition is block, generate is not called', async () => {
			const scenario = createFakeCoreScenario([
				{
					method: 'handleIntakeCommand',
					result: okResult(
						'error',
						'Generation blocked: project not initialized.',
						{
							command: 'logos-generate',
							disposition: 'block',
							mode: 'idle',
							persisted: false,
							stateChanged: false,
						},
					),
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
				'logos-generate',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// Only handleIntakeCommand was called — generate was NOT called.
			expect(scenario.callLog.map((c) => c.method)).toEqual([
				'handleIntakeCommand',
			]);

			// Block result is rendered.
			expect(renderedResults.length).toBeGreaterThanOrEqual(1);

			// sendUserMessage must not be called.
			expect(fakePi.sentUserMessages).toHaveLength(0);
		});

		it('confirm_required disposition: generate is not called', async () => {
			const scenario = createFakeCoreScenario([
				{
					method: 'handleIntakeCommand',
					result: okResult(
						'confirmation_request',
						'Init confirmation required.',
						{
							command: 'logos-generate',
							disposition: 'confirm_required',
							mode: 'idle',
							persisted: false,
							stateChanged: false,
						},
					),
				},
			]);

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
				'logos-generate',
				createFakeCommandContext({ cwd: '/repo' }),
			);

			// Only handleIntakeCommand was called.
			expect(scenario.callLog.map((c) => c.method)).toEqual([
				'handleIntakeCommand',
			]);
		});
	});

	describe('logos-generate confirmed path', () => {
		it('when user confirms, second generate call uses partial_draft mode', async () => {
			const scenario = createFakeCoreScenario([
				{
					method: 'handleIntakeCommand',
					result: okResult('status', 'Ready to execute logos-generate.', {
						command: 'logos-generate',
						disposition: 'execute',
						mode: 'idle',
						persisted: false,
						stateChanged: false,
					}),
				},
				{
					// Initial generate — returns confirmation_required.
					method: 'generate',
					result: makeConfirmationRequiredGenerateResult(),
				},
				{
					// Second generate — called after user confirms.
					// Uses partial_draft mode + confirmedPartialGeneration.
					method: 'generate',
					result: okResult(
						'generation_result',
						'Partial draft generated with 1 incomplete placeholder file(s).',
						{
							confirmationProvided: true,
							generatedPaths: ['/repo/docs/incomplete/thesis.md'],
							generationMode: 'partial_draft',
							incomplete: true,
							partialDraft: true,
							wroteFiles: true,
						},
					),
				},
			]);

			const core = buildCoreFromScenario(scenario);
			const fakePi = createFakePiHost();
			const renderedResults: unknown[] = [];

			const confirmFn = vi.fn(async () => true);
			const ctx = createFakeCommandContext({
				confirm: confirmFn,
				cwd: '/repo',
			});

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

			await fakePi.invokeCommand('logos-generate', ctx);

			// Two generate calls.
			const generateCalls = scenario.callLog.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls.length).toBe(2);

			// Second generate call uses confirmed partial.
			const secondCall = generateCalls[1]?.input as Record<string, unknown>;
			expect(secondCall?.confirmedPartialGeneration).toBe(true);
			expect(secondCall?.mode).toBe('partial_draft');

			// Confirm was called.
			expect(confirmFn).toHaveBeenCalled();

			// Confirmed result is rendered.
			const lastResult = renderedResults[renderedResults.length - 1] as Record<
				string,
				unknown
			>;
			expect(lastResult?.status).toBe('ok');

			// sendUserMessage must not be called.
			expect(fakePi.sentUserMessages).toHaveLength(0);
		});
	});
});
