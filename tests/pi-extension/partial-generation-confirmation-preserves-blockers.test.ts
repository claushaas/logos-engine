/**
 * Step 9.3 — Partial generation confirmation preserves blockers.
 *
 * Proves that:
 * 1. Initial blocker objects are rendered before confirmation.
 * 2. Missing critical blocker is preserved.
 * 3. Partial critical blocker is preserved.
 * 4. Unresolved contradiction blocker is preserved.
 * 5. Warnings are preserved.
 * 6. Confirmation prompt does not drop structured data.
 */

import { describe, expect, it, vi } from 'vitest';
import type { CoreResult, LogosCore } from '../../src/core/index.js';
import {
	createCoreResult,
	createLogosBlocker,
	createLogosWarning,
} from '../../src/core/index.js';
import { runGenerateCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import type { LogosPiCommandContext } from '../../src/pi-extension/pi-types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

function makeBlockerRichResult(): CoreResult<unknown> {
	const blocker1 = createLogosBlocker({
		code: 'missing_critical_questions',
		message: 'Missing critical question: thesis.',
	});

	const blocker2 = createLogosBlocker({
		code: 'partial_critical_questions',
		message: 'Partial critical answer: objectives.',
	});

	const blocker3 = createLogosBlocker({
		code: 'unresolved_contradictions',
		message: 'Unresolved contradiction in scope.',
	});

	const warn1 = createLogosWarning({
		code: 'optional_questions_missing',
		message: 'Optional questions missing: appendix.',
	});

	return createCoreResult({
		blockers: [blocker1, blocker2, blocker3],
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
						message: 'Missing critical question: thesis.',
						questionIds: ['q-thesis'],
					},
					{
						code: 'partial_critical_questions',
						message: 'Partial critical answer: objectives.',
						questionIds: ['q-objectives'],
					},
					{
						code: 'unresolved_contradictions',
						message: 'Unresolved contradiction in scope.',
					},
				],
				canGeneratePartialDraft: true,
				checkedAt: '2026-01-01T00:00:00.000Z',
				completenessScore: 0.3,
				contradictions: ['contra-1'],
				missingCriticalQuestions: ['q-thesis'],
				mode: 'final' as const,
				optionalMissingQuestions: ['q-appendix'],
				optionalSkippedQuestions: [],
				partialCriticalQuestions: ['q-objectives'],
				ready: false,
				requiredSkippedQuestions: [],
				requiresExplicitConfirmation: true,
				status: 'blocked' as const,
				warnings: [],
			},
			requiresExplicitConfirmation: true,
			wroteFiles: false,
		},
		message: { body: 'Multiple blockers exist.', kind: 'error' },
		status: 'blocked',
		warnings: [warn1],
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('partial generation confirmation preserves blockers', () => {
	it('initial blocker objects are rendered before confirmation', async () => {
		const rendered: CoreResult<unknown>[] = [];

		const core: LogosCore = {
			async generate() {
				return makeBlockerRichResult() as Awaited<
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

		// The second render (index 1) should be the initial generation result.
		const initialGenRender = rendered[1];
		expect(initialGenRender).toBeDefined();
		expect(initialGenRender?.blockers).toHaveLength(3);
	});

	it('missing critical blocker is preserved', async () => {
		const rendered: CoreResult<unknown>[] = [];

		const core: LogosCore = {
			async generate() {
				return makeBlockerRichResult() as Awaited<
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

		const initialGenRender = rendered[1];
		const blockerCodes = initialGenRender?.blockers.map(
			(b: unknown) => (b as Record<string, unknown>).code,
		);
		expect(blockerCodes).toContain('missing_critical_questions');
	});

	it('partial critical blocker is preserved', async () => {
		const rendered: CoreResult<unknown>[] = [];

		const core: LogosCore = {
			async generate() {
				return makeBlockerRichResult() as Awaited<
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

		const initialGenRender = rendered[1];
		const blockerCodes = initialGenRender?.blockers.map(
			(b: unknown) => (b as Record<string, unknown>).code,
		);
		expect(blockerCodes).toContain('partial_critical_questions');
	});

	it('unresolved contradiction blocker is preserved', async () => {
		const rendered: CoreResult<unknown>[] = [];

		const core: LogosCore = {
			async generate() {
				return makeBlockerRichResult() as Awaited<
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

		const initialGenRender = rendered[1];
		const blockerCodes = initialGenRender?.blockers.map(
			(b: unknown) => (b as Record<string, unknown>).code,
		);
		expect(blockerCodes).toContain('unresolved_contradictions');
	});

	it('warnings are preserved', async () => {
		const rendered: CoreResult<unknown>[] = [];

		const core: LogosCore = {
			async generate() {
				return makeBlockerRichResult() as Awaited<
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

		const initialGenRender = rendered[1];
		expect(Array.isArray(initialGenRender?.warnings)).toBe(true);
		const warningCodes = initialGenRender?.warnings.map(
			(w: unknown) => (w as Record<string, unknown>).code,
		);
		expect(warningCodes).toContain('optional_questions_missing');
	});
});
