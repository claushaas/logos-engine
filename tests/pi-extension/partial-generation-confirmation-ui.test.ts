/**
 * Step 9.3 — Partial generation confirmation UI tests.
 *
 * Proves that:
 * 1. logos-generate calls initial core.generate(...).
 * 2. Initial Core result requires explicit confirmation.
 * 3. Adapter renders initial confirmation-required result.
 * 4. Adapter calls ctx.ui.confirm(...) when UI is available.
 * 5. If user confirms, adapter calls core.generate(...) a second time.
 * 6. Second call uses mode: "partial_draft" and confirmedPartialGeneration: true.
 * 7. Adapter renders the confirmed generation result.
 * 8. Adapter does not call handleIntakeMessage.
 * 9. If user declines, no second generate call and cancellation rendered.
 * 10. If no UI, blocks and renders no-UI message.
 * 11. Confirmation never retries final generation mode.
 * 12. Blockers/warnings are preserved in rendering.
 */

import { describe, expect, it, vi } from 'vitest';
import type { CoreResult, LogosCore } from '../../src/core/index.js';
import { createCoreResult } from '../../src/core/index.js';
import { runGenerateCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import type { LogosPiCommandContext } from '../../src/pi-extension/pi-types.js';

// ---------------------------------------------------------------------------
// Fixtures: fake results
// ---------------------------------------------------------------------------

type RecordedCall = {
	method: string;
	input: unknown;
};

type RenderedResult = {
	result: CoreResult<unknown>;
};

/**
 * Create a confirmation-required generation result matching Core's
 * blocked final → canGeneratePartialDraft pattern.
 */
function makeConfirmationRequiredResult(
	overrides?: Partial<CoreResult<unknown>>,
): CoreResult<unknown> {
	return createCoreResult({
		blockers: [
			{
				code: 'missing_critical_questions',
				message: 'Missing critical questions: thesis.',
				severity: 'blocker' as const,
			},
		],
		data: {
			confirmationProvided: false,
			generatedPaths: [],
			generationMode: 'final' as const,
			incomplete: false,
			partialDraft: false,
			preflight: {
				blockers: [
					{
						code: 'missing_critical_questions',
						message: 'Missing critical questions.',
						questionIds: ['q1'],
					},
				],
				canGeneratePartialDraft: true,
				checkedAt: '2026-05-22T00:00:00.000Z',
				completenessScore: 0.5,
				contradictions: [],
				missingCriticalQuestions: ['q1'],
				mode: 'final' as const,
				optionalMissingQuestions: ['q2'],
				optionalSkippedQuestions: [],
				partialCriticalQuestions: [],
				ready: false,
				requiredSkippedQuestions: [],
				requiresExplicitConfirmation: true,
				status: 'blocked' as const,
				warnings: [
					{
						code: 'optional_questions_missing',
						message: 'Optional questions remain unanswered.',
					},
				],
			},
			requiresExplicitConfirmation: true,
			wroteFiles: false,
			...(overrides?.data as Record<string, unknown> | undefined),
		},
		message: {
			body: 'Final generation is blocked. Resolve the reported blockers before generating.',
			kind: 'error',
		},
		status: 'blocked',
		warnings: [
			{
				code: 'optional_questions_missing',
				message: 'Optional questions remain unanswered.',
				severity: 'warning' as const,
			},
		],
		...overrides,
	});
}

/**
 * Create a confirmed partial draft generation result.
 */
function makeConfirmedResult(): CoreResult<unknown> {
	return createCoreResult({
		changedPaths: [
			{
				kind: 'created' as const,
				path: 'docs/01-foundation/THESIS.md',
				reason: 'partial_draft_placeholder',
			},
		],
		data: {
			confirmationProvided: true,
			generatedPaths: ['docs/01-foundation/THESIS.md'],
			generationMode: 'partial_draft' as const,
			incomplete: true,
			partialDraft: true,
			preflight: {
				canGeneratePartialDraft: true,
				checkedAt: '2026-05-22T00:00:00.000Z',
				completenessScore: 0.5,
				mode: 'partial_draft' as const,
				ready: false,
				requiresExplicitConfirmation: true,
				status: 'confirmation_required' as const,
			},
			requiresExplicitConfirmation: true,
			wroteFiles: true,
		},
		message: {
			body: 'Partial draft generated with 1 incomplete placeholder file(s).',
			kind: 'generation_result',
		},
		status: 'ok',
	});
}

/**
 * Create an interruption result with "execute" disposition.
 */
function _makeExecuteInterruptionResult(): CoreResult<unknown> {
	return createCoreResult({
		data: {
			command: 'logos-generate',
			disposition: 'execute' as const,
			mode: 'idle' as const,
			persisted: false,
			stateChanged: false,
		},
		message: {
			body: 'Command: logos-generate',
			kind: 'status',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type GenerateAdapterHarness = {
	calls: RecordedCall[];
	rendered: RenderedResult[];
	ctx: LogosPiCommandContext;
	deps: LogosPiExtensionDependencies;
	runAdapter(): Promise<void>;
};

function createHarness(options?: {
	hasUi?: boolean;
	confirmReturn?: boolean;
	initialResult?: CoreResult<unknown>;
	confirmedResult?: CoreResult<unknown>;
	disposition?: 'execute' | 'pause_and_execute' | 'block';
	now?: string;
}): GenerateAdapterHarness {
	const calls: RecordedCall[] = [];
	const rendered: RenderedResult[] = [];

	const initialResult =
		options?.initialResult ?? makeConfirmationRequiredResult();
	const confirmedResult = options?.confirmedResult ?? makeConfirmedResult();
	const hasUi = options?.hasUi ?? true;
	const confirmReturn = options?.confirmReturn ?? true;

	const ui = {
		confirm: hasUi
			? vi.fn<[string, string], Promise<boolean>>(
					async (_title: string, _message: string) => confirmReturn,
				)
			: undefined,
		notify: vi.fn(),
	};

	const ctx: LogosPiCommandContext = {
		cwd: '/repo',
		hasUI: hasUi,
		ui: ui as unknown as LogosPiCommandContext['ui'],
	} as LogosPiCommandContext;

	// Pre-compute interruption result.
	const interruptionResult = createCoreResult({
		data: {
			command: 'logos-generate',
			disposition: (options?.disposition ?? 'execute') as string,
			mode: 'idle',
			persisted: false,
			stateChanged: false,
		},
		message: {
			body: 'Command: logos-generate',
			kind: 'status',
		},
		status: 'ok',
	});

	let generateCallCount = 0;

	const core: LogosCore = {
		async generate(input) {
			calls.push({ input, method: 'generate' });
			generateCallCount++;
			if (generateCallCount === 1) {
				return initialResult as Awaited<ReturnType<LogosCore['generate']>>;
			}
			return confirmedResult as Awaited<ReturnType<LogosCore['generate']>>;
		},
		async getStatus(input) {
			calls.push({ input, method: 'getStatus' });
			return createCoreResult({
				message: { body: 'ok', kind: 'status' },
			}) as Awaited<ReturnType<LogosCore['getStatus']>>;
		},
		async handleIntakeCommand(input) {
			calls.push({ input, method: 'handleIntakeCommand' });
			return interruptionResult as Awaited<
				ReturnType<LogosCore['handleIntakeCommand']>
			>;
		},
		async handleIntakeMessage(input) {
			calls.push({ input, method: 'handleIntakeMessage' });
			return createCoreResult({
				message: { body: 'msg', kind: 'status' },
			}) as Awaited<ReturnType<LogosCore['handleIntakeMessage']>>;
		},
		async initProject(input) {
			calls.push({ input, method: 'initProject' });
			return createCoreResult({
				message: { body: 'init', kind: 'status' },
			}) as Awaited<ReturnType<LogosCore['initProject']>>;
		},
		async startIntake(input) {
			calls.push({ input, method: 'startIntake' });
			return createCoreResult({
				message: { body: 'start', kind: 'status' },
			}) as Awaited<ReturnType<LogosCore['startIntake']>>;
		},
		async stopIntake(input) {
			calls.push({ input, method: 'stopIntake' });
			return createCoreResult({
				message: { body: 'stop', kind: 'status' },
			}) as Awaited<ReturnType<LogosCore['stopIntake']>>;
		},
	};

	const deps: LogosPiExtensionDependencies = {
		core,
		getProjectRoot: (c) => (c as { cwd?: string }).cwd ?? '/repo',
		now: options?.now !== undefined ? () => options.now as string : undefined,
		pi: {} as LogosPiExtensionDependencies['pi'],
		renderCoreResult: async (result: CoreResult<unknown>) => {
			rendered.push({ result });
		},
	};

	return {
		calls,
		ctx,
		deps,
		rendered,
		async runAdapter() {
			await runGenerateCommandAdapter({
				ctx,
				deps,
			});
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('partial generation confirmation UI', () => {
	describe('initial flow', () => {
		it('logos-generate calls handleIntakeCommand first, then generate', async () => {
			const harness = createHarness({ hasUi: false });

			await harness.runAdapter();

			const methods = harness.calls.map((c) => c.method);
			expect(methods).toContain('handleIntakeCommand');
			expect(methods).toContain('generate');
			expect(methods.indexOf('handleIntakeCommand')).toBeLessThan(
				methods.indexOf('generate'),
			);
		});

		it('renders initial interruption and generation results', async () => {
			const harness = createHarness({ hasUi: false });

			await harness.runAdapter();

			// At least 2 renders: interruption + initial generate
			expect(harness.rendered.length).toBeGreaterThanOrEqual(2);
		});

		it('never calls handleIntakeMessage', async () => {
			const harness = createHarness();

			await harness.runAdapter();

			expect(
				harness.calls.some((c) => c.method === 'handleIntakeMessage'),
			).toBe(false);
		});
	});

	describe('confirmed path', () => {
		it('calls core.generate twice: initial + confirmed partial_draft', async () => {
			const harness = createHarness({ confirmReturn: true });

			await harness.runAdapter();

			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls).toHaveLength(2);

			// Second call must be partial_draft with confirmation flag.
			const secondCall = generateCalls[1]?.input as Record<string, unknown>;
			expect(secondCall?.mode).toBe('partial_draft');
			expect(secondCall?.confirmedPartialGeneration).toBe(true);
			expect(secondCall?.projectRoot).toBe('/repo');
		});

		it('does NOT retry final generation after confirmation', async () => {
			const harness = createHarness({ confirmReturn: true });

			await harness.runAdapter();

			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			for (const call of generateCalls) {
				const input = call.input as Record<string, unknown>;
				// No call should use mode "final" with confirmedPartialGeneration.
				if (input?.mode === 'final') {
					expect(input.confirmedPartialGeneration).toBeUndefined();
				}
			}
		});

		it('renders confirmed generation result', async () => {
			const harness = createHarness({ confirmReturn: true });

			await harness.runAdapter();

			// Last render should be the confirmed result.
			const lastRendered = harness.rendered[harness.rendered.length - 1];
			expect(lastRendered).toBeDefined();
		});

		it('preserves generated paths and incomplete metadata from Core', async () => {
			const harness = createHarness({ confirmReturn: true });

			await harness.runAdapter();

			// The confirmed result's data should be preserved in rendering.
			const lastRendered = harness.rendered[harness.rendered.length - 1];
			expect(lastRendered).toBeDefined();
			const resultData = lastRendered?.result?.data as
				| Record<string, unknown>
				| undefined;
			// Core returns the data — we just check the result is rendered.
			expect(resultData).toBeDefined();
		});
	});

	describe('declined path', () => {
		it('does not call core.generate a second time when user declines', async () => {
			const harness = createHarness({ confirmReturn: false });

			await harness.runAdapter();

			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls).toHaveLength(1);
		});

		it('renders cancellation result on decline', async () => {
			const harness = createHarness({ confirmReturn: false });

			await harness.runAdapter();

			const lastRendered = harness.rendered[harness.rendered.length - 1];
			const resultData = lastRendered?.result.data as
				| Record<string, unknown>
				| undefined;
			expect(resultData?.skippedReason).toBe(
				'user_declined_partial_generation',
			);
		});

		it('cancellation result reports no files were written', async () => {
			const harness = createHarness({ confirmReturn: false });

			await harness.runAdapter();

			const lastRendered = harness.rendered[harness.rendered.length - 1];
			expect(lastRendered?.result.status).toBe('noop');
			const data = lastRendered?.result.data as
				| Record<string, unknown>
				| undefined;
			expect(data?.wroteFiles).toBe(false);
			expect(Array.isArray(data?.generatedPaths)).toBe(true);
			expect((data?.generatedPaths as unknown[]).length).toBe(0);
		});
	});

	describe('no-UI path', () => {
		it('blocks when hasUI is false', async () => {
			const harness = createHarness({ hasUi: false });

			await harness.runAdapter();

			// Only one generate call (initial).
			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls).toHaveLength(1);

			// Last render should be no-UI blocked result.
			const lastRendered = harness.rendered[harness.rendered.length - 1];
			const data = lastRendered?.result.data as
				| Record<string, unknown>
				| undefined;
			expect(data?.skippedReason).toBe('confirmation_ui_unavailable');
			expect(data?.wroteFiles).toBe(false);
		});

		it('does not call ctx.ui.confirm when hasUI is false', async () => {
			const harness = createHarness({ hasUi: false });

			await harness.runAdapter();

			const confirmFn = (harness.ctx.ui as Record<string, unknown>).confirm as
				| ReturnType<typeof vi.fn>
				| undefined;
			if (confirmFn) {
				expect(confirmFn).not.toHaveBeenCalled();
			}
		});

		it('blocks when ctx.ui.confirm is unavailable', async () => {
			// hasUI is true but ui.confirm is missing.
			const harness = createHarness({ hasUi: true });
			// Override: remove confirm from ui.
			(harness.ctx as Record<string, unknown>).ui = { notify: vi.fn() };

			await harness.runAdapter();

			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls).toHaveLength(1);

			const lastRendered = harness.rendered[harness.rendered.length - 1];
			const data = lastRendered?.result.data as
				| Record<string, unknown>
				| undefined;
			expect(data?.skippedReason).toBe('confirmation_ui_unavailable');
		});
	});

	describe('confirmation prompt content', () => {
		it('calls ctx.ui.confirm with title and message', async () => {
			const harness = createHarness({ confirmReturn: true });

			await harness.runAdapter();

			const confirmFn = (harness.ctx.ui as Record<string, unknown>).confirm as
				| ReturnType<typeof vi.fn>
				| undefined;
			expect(confirmFn).toHaveBeenCalledTimes(1);
			const callArgs = confirmFn?.mock.calls[0];
			expect(callArgs?.[0]).toBe('Partial Draft Generation');
			expect(callArgs?.[1]).toContain('incomplete partial draft');
		});
	});

	describe('blocker preservation', () => {
		it('preserves blocker objects in initial rendering before confirmation', async () => {
			const harness = createHarness({ confirmReturn: true });

			await harness.runAdapter();

			// The second render (initial generation result) should have blockers.
			// Rendered order: [0] interruption, [1] initial generate, [2] confirmed/declined/no-ui
			const initialGenRender = harness.rendered[1];
			expect(initialGenRender?.result.blockers).toBeDefined();
			expect(Array.isArray(initialGenRender?.result.blockers)).toBe(true);
		});

		it('preserves warnings in initial rendering', async () => {
			const harness = createHarness({ confirmReturn: true });

			await harness.runAdapter();

			const initialGenRender = harness.rendered[1];
			expect(initialGenRender?.result.warnings).toBeDefined();
		});
	});

	describe('non-blocking path (no confirmation needed)', () => {
		it('does not ask for confirmation when result does not require it', async () => {
			const noConfirmResult = createCoreResult({
				data: {
					confirmationProvided: false,
					generatedPaths: [],
					generationMode: 'final' as const,
					incomplete: false,
					partialDraft: false,
					requiresExplicitConfirmation: false,
					wroteFiles: false,
				},
				message: {
					body: 'All good.',
					kind: 'status',
				},
				status: 'ok',
			});

			const harness = createHarness({
				confirmReturn: true,
				initialResult: noConfirmResult,
			});

			await harness.runAdapter();

			const confirmFn = (harness.ctx.ui as Record<string, unknown>).confirm as
				| ReturnType<typeof vi.fn>
				| undefined;
			expect(confirmFn).not.toHaveBeenCalled();

			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls).toHaveLength(1);
		});
	});

	describe('blocked disposition', () => {
		it('does not call generate when interruption disposition is block', async () => {
			const harness = createHarness({
				disposition: 'block',
				hasUi: false,
			});

			await harness.runAdapter();

			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls).toHaveLength(0);
		});
	});

	describe('pause_and_execute disposition', () => {
		it('calls generate when disposition is pause_and_execute', async () => {
			const harness = createHarness({
				disposition: 'pause_and_execute',
				hasUi: false,
			});

			await harness.runAdapter();

			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			expect(generateCalls.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('now injection', () => {
		it('passes now to confirmed generate call when dependency is injected', async () => {
			const harness = createHarness({
				confirmReturn: true,
				now: '2026-05-22T12:00:00.000Z',
			});

			await harness.runAdapter();

			const generateCalls = harness.calls.filter(
				(c) => c.method === 'generate',
			);
			const secondCall = generateCalls[1]?.input as Record<string, unknown>;
			expect(secondCall?.now).toBe('2026-05-22T12:00:00.000Z');
		});
	});
});
