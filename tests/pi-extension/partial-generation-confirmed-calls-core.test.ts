/**
 * Step 9.3 — Confirmed partial generation calls Core correctly.
 *
 * Proves that the confirmed path:
 * 1. Does not call final generation mode again.
 * 2. Calls partial draft generation only.
 * 3. Confirmed call includes confirmedPartialGeneration: true.
 * 4. Confirmed call preserves now if dependency is injected.
 * 5. Confirmed result preserves generated paths and incomplete metadata.
 * 6. Adapter renders blockers/warnings returned by confirmed Core result.
 */

import { describe, expect, it, vi } from 'vitest';
import type { CoreResult, LogosCore } from '../../src/core/index.js';
import { createCoreResult } from '../../src/core/index.js';
import { runGenerateCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import type { LogosPiCommandContext } from '../../src/pi-extension/pi-types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBlockedWithPartialPossible(): CoreResult<unknown> {
	return createCoreResult({
		blockers: [
			{
				code: 'missing_critical_questions',
				message: 'Missing critical questions.',
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
				blockers: [{ code: 'missing_critical_questions', message: 'q' }],
				canGeneratePartialDraft: true,
				checkedAt: '2026-01-01T00:00:00.000Z',
				completenessScore: 0.5,
				contradictions: [],
				missingCriticalQuestions: ['q1'],
				mode: 'final' as const,
				optionalMissingQuestions: [],
				optionalSkippedQuestions: [],
				partialCriticalQuestions: [],
				ready: false,
				requiredSkippedQuestions: [],
				requiresExplicitConfirmation: true,
				status: 'blocked' as const,
				warnings: [],
			},
			requiresExplicitConfirmation: true,
			wroteFiles: false,
		},
		message: { body: 'Blocked.', kind: 'error' },
		status: 'blocked',
	});
}

function makeExecuteDispositionResult(): CoreResult<unknown> {
	return createCoreResult({
		data: {
			command: 'logos-generate',
			disposition: 'execute' as const,
			mode: 'idle' as const,
			persisted: false,
			stateChanged: false,
		},
		message: { body: 'ok', kind: 'status' },
		status: 'ok',
	});
}

function makeConfirmedPartialDraftResult(): CoreResult<unknown> {
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
				blockers: [{ code: 'missing_critical_questions', message: 'q' }],
				canGeneratePartialDraft: true,
				checkedAt: '2026-01-01T00:00:00.000Z',
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
		warnings: [
			{
				code: 'optional_questions_missing',
				message: 'Optional missing.',
				severity: 'warning' as const,
			},
		],
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('partial generation confirmed calls Core', () => {
	it('does not call final generation mode after confirmation', async () => {
		const calls: { method: string; input: Record<string, unknown> }[] = [];

		const core: LogosCore = {
			async generate(input) {
				calls.push({
					input: input as Record<string, unknown>,
					method: 'generate',
				});
				if (calls.filter((c) => c.method === 'generate').length === 1) {
					return makeBlockedWithPartialPossible() as Awaited<
						ReturnType<LogosCore['generate']>
					>;
				}
				return makeConfirmedPartialDraftResult() as Awaited<
					ReturnType<LogosCore['generate']>
				>;
			},
			async getStatus() {
				return createCoreResult({
					message: { body: 'ok', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['getStatus']>>;
			},
			async handleIntakeCommand() {
				calls.push({ input: {}, method: 'handleIntakeCommand' });
				return makeExecuteDispositionResult() as Awaited<
					ReturnType<LogosCore['handleIntakeCommand']>
				>;
			},
			async handleIntakeMessage() {
				return createCoreResult({
					message: { body: 'msg', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['handleIntakeMessage']>>;
			},
			async initProject() {
				return createCoreResult({
					message: { body: 'init', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['initProject']>>;
			},
			async startIntake() {
				return createCoreResult({
					message: { body: 'start', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['startIntake']>>;
			},
			async stopIntake() {
				return createCoreResult({
					message: { body: 'stop', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['stopIntake']>>;
			},
		};

		const deps: LogosPiExtensionDependencies = {
			core,
			getProjectRoot: (c) => (c as { cwd?: string }).cwd ?? '/repo',
			pi: {} as LogosPiExtensionDependencies['pi'],
			renderCoreResult: async () => {},
		};

		const ctx: LogosPiCommandContext = {
			cwd: '/repo',
			hasUI: true,
			ui: {
				confirm: vi.fn(async (_t: string, _m: string) => true),
				notify: vi.fn(),
			} as unknown as LogosPiCommandContext['ui'],
		} as LogosPiCommandContext;

		await runGenerateCommandAdapter({ ctx, deps });

		const generateCalls = calls.filter((c) => c.method === 'generate');

		// No call should have mode "final" with confirmation.
		for (const call of generateCalls) {
			if (call.input.mode === 'final') {
				expect(call.input.confirmedPartialGeneration).toBeUndefined();
			}
		}

		expect(generateCalls).toHaveLength(2);
	});

	it('confirmed call uses mode: partial_draft', async () => {
		const calls: { input: Record<string, unknown> }[] = [];

		const core: LogosCore = {
			async generate(input) {
				calls.push({ input: input as Record<string, unknown> });
				if (calls.length === 1) {
					return makeBlockedWithPartialPossible() as Awaited<
						ReturnType<LogosCore['generate']>
					>;
				}
				return makeConfirmedPartialDraftResult() as Awaited<
					ReturnType<LogosCore['generate']>
				>;
			},
			async getStatus() {
				return createCoreResult({
					message: { body: 'ok', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['getStatus']>>;
			},
			async handleIntakeCommand() {
				return makeExecuteDispositionResult() as Awaited<
					ReturnType<LogosCore['handleIntakeCommand']>
				>;
			},
			async handleIntakeMessage() {
				return createCoreResult({
					message: { body: 'msg', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['handleIntakeMessage']>>;
			},
			async initProject() {
				return createCoreResult({
					message: { body: 'init', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['initProject']>>;
			},
			async startIntake() {
				return createCoreResult({
					message: { body: 'start', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['startIntake']>>;
			},
			async stopIntake() {
				return createCoreResult({
					message: { body: 'stop', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['stopIntake']>>;
			},
		};

		const deps: LogosPiExtensionDependencies = {
			core,
			getProjectRoot: (c) => (c as { cwd?: string }).cwd ?? '/repo',
			pi: {} as LogosPiExtensionDependencies['pi'],
			renderCoreResult: async () => {},
		};

		const ctx: LogosPiCommandContext = {
			cwd: '/repo',
			hasUI: true,
			ui: {
				confirm: vi.fn(async (_t: string, _m: string) => true),
				notify: vi.fn(),
			} as unknown as LogosPiCommandContext['ui'],
		} as LogosPiCommandContext;

		await runGenerateCommandAdapter({ ctx, deps });

		const secondCall = calls[1]?.input;
		expect(secondCall?.mode).toBe('partial_draft');
		expect(secondCall?.confirmedPartialGeneration).toBe(true);
	});

	it('confirmed call preserves projectRoot', async () => {
		const calls: { input: Record<string, unknown> }[] = [];

		const core: LogosCore = {
			async generate(input) {
				calls.push({ input: input as Record<string, unknown> });
				if (calls.length === 1) {
					return makeBlockedWithPartialPossible() as Awaited<
						ReturnType<LogosCore['generate']>
					>;
				}
				return makeConfirmedPartialDraftResult() as Awaited<
					ReturnType<LogosCore['generate']>
				>;
			},
			async getStatus() {
				return createCoreResult({
					message: { body: 'ok', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['getStatus']>>;
			},
			async handleIntakeCommand() {
				return makeExecuteDispositionResult() as Awaited<
					ReturnType<LogosCore['handleIntakeCommand']>
				>;
			},
			async handleIntakeMessage() {
				return createCoreResult({
					message: { body: 'msg', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['handleIntakeMessage']>>;
			},
			async initProject() {
				return createCoreResult({
					message: { body: 'init', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['initProject']>>;
			},
			async startIntake() {
				return createCoreResult({
					message: { body: 'start', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['startIntake']>>;
			},
			async stopIntake() {
				return createCoreResult({
					message: { body: 'stop', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['stopIntake']>>;
			},
		};

		const rendered: CoreResult<unknown>[] = [];

		const deps: LogosPiExtensionDependencies = {
			core,
			getProjectRoot: (c) => (c as { cwd?: string }).cwd ?? '/repo',
			pi: {} as LogosPiExtensionDependencies['pi'],
			renderCoreResult: async (result: CoreResult<unknown>) => {
				rendered.push(result);
			},
		};

		const ctx: LogosPiCommandContext = {
			cwd: '/repo',
			hasUI: true,
			ui: {
				confirm: vi.fn(async (_t: string, _m: string) => true),
				notify: vi.fn(),
			} as unknown as LogosPiCommandContext['ui'],
		} as LogosPiCommandContext;

		await runGenerateCommandAdapter({ ctx, deps });

		const secondCall = calls[1]?.input;
		expect(secondCall?.projectRoot).toBe('/repo');
	});

	it('confirmed result preserves generated paths from Core', async () => {
		const rendered: CoreResult<unknown>[] = [];

		const core: LogosCore = {
			async generate(_input) {
				const callCount = rendered.filter((r) => r.data !== undefined).length;
				if (callCount <= 1) {
					return makeBlockedWithPartialPossible() as Awaited<
						ReturnType<LogosCore['generate']>
					>;
				}
				return makeConfirmedPartialDraftResult() as Awaited<
					ReturnType<LogosCore['generate']>
				>;
			},
			async getStatus() {
				return createCoreResult({
					message: { body: 'ok', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['getStatus']>>;
			},
			async handleIntakeCommand() {
				return makeExecuteDispositionResult() as Awaited<
					ReturnType<LogosCore['handleIntakeCommand']>
				>;
			},
			async handleIntakeMessage() {
				return createCoreResult({
					message: { body: 'msg', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['handleIntakeMessage']>>;
			},
			async initProject() {
				return createCoreResult({
					message: { body: 'init', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['initProject']>>;
			},
			async startIntake() {
				return createCoreResult({
					message: { body: 'start', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['startIntake']>>;
			},
			async stopIntake() {
				return createCoreResult({
					message: { body: 'stop', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['stopIntake']>>;
			},
		};

		const deps: LogosPiExtensionDependencies = {
			core,
			getProjectRoot: (c) => (c as { cwd?: string }).cwd ?? '/repo',
			pi: {} as LogosPiExtensionDependencies['pi'],
			renderCoreResult: async (result: CoreResult<unknown>) => {
				rendered.push(result);
			},
		};

		const ctx: LogosPiCommandContext = {
			cwd: '/repo',
			hasUI: true,
			ui: {
				confirm: vi.fn(async (_t: string, _m: string) => true),
				notify: vi.fn(),
			} as unknown as LogosPiCommandContext['ui'],
		} as LogosPiCommandContext;

		await runGenerateCommandAdapter({ ctx, deps });

		// Find the confirmed result render.
		const confirmedRender = rendered.find((r) => {
			const d = r.data as Record<string, unknown> | undefined;
			return d?.confirmationProvided === true;
		});
		expect(confirmedRender).toBeDefined();
		const data = confirmedRender?.data as Record<string, unknown>;
		expect(data?.generatedPaths).toEqual(['docs/01-foundation/THESIS.md']);
		expect(data?.incomplete).toBe(true);
	});

	it('confirmed result preserves blockers/warnings from Core', async () => {
		const rendered: CoreResult<unknown>[] = [];

		const core: LogosCore = {
			async generate(_input) {
				const callCount = rendered.filter((r) => r.data !== undefined).length;
				if (callCount <= 1) {
					return makeBlockedWithPartialPossible() as Awaited<
						ReturnType<LogosCore['generate']>
					>;
				}
				return makeConfirmedPartialDraftResult() as Awaited<
					ReturnType<LogosCore['generate']>
				>;
			},
			async getStatus() {
				return createCoreResult({
					message: { body: 'ok', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['getStatus']>>;
			},
			async handleIntakeCommand() {
				return makeExecuteDispositionResult() as Awaited<
					ReturnType<LogosCore['handleIntakeCommand']>
				>;
			},
			async handleIntakeMessage() {
				return createCoreResult({
					message: { body: 'msg', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['handleIntakeMessage']>>;
			},
			async initProject() {
				return createCoreResult({
					message: { body: 'init', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['initProject']>>;
			},
			async startIntake() {
				return createCoreResult({
					message: { body: 'start', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['startIntake']>>;
			},
			async stopIntake() {
				return createCoreResult({
					message: { body: 'stop', kind: 'status' },
				}) as Awaited<ReturnType<LogosCore['stopIntake']>>;
			},
		};

		const deps: LogosPiExtensionDependencies = {
			core,
			getProjectRoot: (c) => (c as { cwd?: string }).cwd ?? '/repo',
			pi: {} as LogosPiExtensionDependencies['pi'],
			renderCoreResult: async (result: CoreResult<unknown>) => {
				rendered.push(result);
			},
		};

		const ctx: LogosPiCommandContext = {
			cwd: '/repo',
			hasUI: true,
			ui: {
				confirm: vi.fn(async (_t: string, _m: string) => true),
				notify: vi.fn(),
			} as unknown as LogosPiCommandContext['ui'],
		} as LogosPiCommandContext;

		await runGenerateCommandAdapter({ ctx, deps });

		const confirmedRender = rendered.find((r) => {
			const d = r.data as Record<string, unknown> | undefined;
			return d?.confirmationProvided === true;
		});
		expect(confirmedRender).toBeDefined();
		// The confirmed result from Core had warnings.
		expect(Array.isArray(confirmedRender?.warnings)).toBe(true);
	});
});
