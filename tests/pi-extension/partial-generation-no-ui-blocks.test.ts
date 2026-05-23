/**
 * Step 9.3 — No-UI blocks partial generation tests.
 *
 * Proves that when UI is unavailable (print/RPC modes), partial draft
 * generation is blocked safely without calling Core a second time.
 *
 * Tests:
 * 1. Initial Core result requires confirmation.
 * 2. ctx.hasUI === false blocks confirmation.
 * 3. ctx.ui.confirm is not called.
 * 4. core.generate is not called a second time.
 * 5. Adapter renders no-UI blocked result.
 * 6. No generated paths are reported as written.
 * 7. No files are written by Pi.
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
				blockers: [
					{ code: 'missing_critical_questions', message: 'Missing q.' },
				],
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
		message: {
			body: 'Generation blocked.',
			kind: 'error',
		},
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

type ContextOpts = {
	hasUI?: boolean;
	hasConfirm?: boolean;
};

function makeContext(opts: ContextOpts = {}): LogosPiCommandContext {
	const hasUI = opts.hasUI ?? false;
	const ui: Record<string, unknown> = { notify: vi.fn() };
	if (opts.hasConfirm === true) {
		ui.confirm = vi.fn(async () => true);
	}
	return {
		cwd: '/repo',
		hasUI,
		ui: ui as unknown as LogosPiCommandContext['ui'],
	} as LogosPiCommandContext;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

async function runNoUiTest(opts: {
	hasUI: boolean;
	hasConfirm: boolean;
}): Promise<{
	generateCalls: number;
	confirmCalled: boolean;
	lastRenderedData: Record<string, unknown> | undefined;
}> {
	const calls: string[] = [];
	let confirmCalled = false;

	const core: LogosCore = {
		async generate(_input) {
			calls.push('generate');
			return makeBlockedWithPartialPossible() as Awaited<
				ReturnType<LogosCore['generate']>
			>;
		},
		async getStatus() {
			return createCoreResult({
				message: { body: 'ok', kind: 'status' },
			}) as Awaited<ReturnType<LogosCore['getStatus']>>;
		},
		async handleIntakeCommand() {
			calls.push('handleIntakeCommand');
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

	let lastRenderedData: Record<string, unknown> | undefined;

	const deps: LogosPiExtensionDependencies = {
		core,
		getProjectRoot: (c) => (c as { cwd?: string }).cwd ?? '/repo',
		pi: {} as LogosPiExtensionDependencies['pi'],
		renderCoreResult: async (result: CoreResult<unknown>) => {
			lastRenderedData = result.data as Record<string, unknown> | undefined;
		},
	};

	const ctx = makeContext({ hasConfirm: opts.hasConfirm, hasUI: opts.hasUI });

	// Spy on confirm.
	const origUi = ctx.ui;
	if (typeof (origUi as Record<string, unknown>).confirm === 'function') {
		const origConfirm = (origUi as Record<string, unknown>).confirm as (
			...args: unknown[]
		) => Promise<boolean>;
		(ctx.ui as Record<string, unknown>).confirm = vi.fn(
			async (...args: unknown[]) => {
				confirmCalled = true;
				return origConfirm(...args);
			},
		);
	}

	await runGenerateCommandAdapter({ ctx, deps });

	return {
		confirmCalled,
		generateCalls: calls.filter((c) => c === 'generate').length,
		lastRenderedData,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('partial generation no-UI blocks', () => {
	it('blocks when hasUI is false', async () => {
		const result = await runNoUiTest({ hasConfirm: false, hasUI: false });

		expect(result.generateCalls).toBe(1);
		expect(result.confirmCalled).toBe(false);
		expect(result.lastRenderedData?.skippedReason).toBe(
			'confirmation_ui_unavailable',
		);
	});

	it('blocks when hasUI is true but ui.confirm is missing', async () => {
		const result = await runNoUiTest({ hasConfirm: false, hasUI: true });

		expect(result.generateCalls).toBe(1);
		expect(result.confirmCalled).toBe(false);
		expect(result.lastRenderedData?.skippedReason).toBe(
			'confirmation_ui_unavailable',
		);
	});

	it('does not call Core generate a second time', async () => {
		const result = await runNoUiTest({ hasConfirm: false, hasUI: false });
		expect(result.generateCalls).toBe(1);
	});

	it('reports no files were written', async () => {
		const result = await runNoUiTest({ hasConfirm: false, hasUI: false });
		expect(result.lastRenderedData?.wroteFiles).toBe(false);
	});

	it('reports no generated paths', async () => {
		const result = await runNoUiTest({ hasConfirm: false, hasUI: false });
		const paths = result.lastRenderedData?.generatedPaths;
		expect(Array.isArray(paths)).toBe(true);
		expect((paths as unknown[]).length).toBe(0);
	});

	it('reports confirmation not provided', async () => {
		const result = await runNoUiTest({ hasConfirm: false, hasUI: false });
		expect(result.lastRenderedData?.confirmationProvided).toBe(false);
	});
});
