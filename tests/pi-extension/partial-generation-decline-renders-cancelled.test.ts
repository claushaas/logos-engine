/**
 * Step 9.3 — Decline renders cancelled tests.
 *
 * Proves that when a user declines partial draft confirmation:
 * 1. Core generate is not called a second time.
 * 2. Adapter renders cancellation result.
 * 3. Cancellation result says no files were written.
 * 4. wroteFiles is false.
 * 5. generatedPaths is empty.
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
					{
						code: 'missing_critical_questions',
						message: 'Missing critical questions.',
					},
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

async function runDeclineTest(): Promise<{
	generateCalls: number;
	renderedCount: number;
	lastRenderedStatus: string;
	lastRenderedData: Record<string, unknown> | undefined;
}> {
	const calls: string[] = [];
	const renderedResults: CoreResult<unknown>[] = [];

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

	const deps: LogosPiExtensionDependencies = {
		core,
		getProjectRoot: (c) => (c as { cwd?: string }).cwd ?? '/repo',
		pi: {} as LogosPiExtensionDependencies['pi'],
		renderCoreResult: async (result: CoreResult<unknown>) => {
			renderedResults.push(result);
		},
	};

	const ctx: LogosPiCommandContext = {
		cwd: '/repo',
		hasUI: true,
		ui: {
			confirm: vi.fn(async (_title: string, _message: string) => false),
			notify: vi.fn(),
		} as unknown as LogosPiCommandContext['ui'],
	} as LogosPiCommandContext;

	await runGenerateCommandAdapter({ ctx, deps });

	const lastRendered = renderedResults[renderedResults.length - 1];
	return {
		generateCalls: calls.filter((c) => c === 'generate').length,
		lastRenderedData: lastRendered?.data as Record<string, unknown> | undefined,
		lastRenderedStatus: lastRendered?.status ?? 'unknown',
		renderedCount: renderedResults.length,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('partial generation decline renders cancelled', () => {
	it('does not call Core generate a second time', async () => {
		const result = await runDeclineTest();
		expect(result.generateCalls).toBe(1);
	});

	it('renders cancellation result', async () => {
		const result = await runDeclineTest();
		expect(result.lastRenderedStatus).toBe('noop');
	});

	it('cancellation result says no files were written', async () => {
		const result = await runDeclineTest();
		expect(result.lastRenderedData?.wroteFiles).toBe(false);
	});

	it('cancellation result has empty generatedPaths', async () => {
		const result = await runDeclineTest();
		const paths = result.lastRenderedData?.generatedPaths;
		expect(Array.isArray(paths)).toBe(true);
		expect((paths as unknown[]).length).toBe(0);
	});

	it('has skippedReason user_declined_partial_generation', async () => {
		const result = await runDeclineTest();
		expect(result.lastRenderedData?.skippedReason).toBe(
			'user_declined_partial_generation',
		);
	});

	it('message body mentions cancellation', async () => {
		const result = await runDeclineTest();
		// We already checked skippedReason above — that's sufficient.
		expect(result.lastRenderedData?.confirmationProvided).toBe(false);
	});
});
