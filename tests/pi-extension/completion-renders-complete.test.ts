/**
 * Step 8.3 — Completion renders complete message.
 *
 * Proves that when Core returns a "completion" kind result from
 * handleIntakeMessage, the Pi extension renders a completion message
 * without calling generation or status APIs automatically, and
 * without synthetic user messages.
 */

import { describe, expect, it, vi } from 'vitest';
import type {
	HandleIntakeMessageData,
	HandleIntakeMessageResult,
} from '../../src/core/api.js';
import { createCoreResult } from '../../src/core/index.js';
import { routePiInput } from '../../src/pi-extension/input/input-router.js';
import {
	createFakeCore,
	ctx,
	inputEvent,
	makeDeps,
	statusResultForMode,
} from './input-routing-test-helpers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createCompletionResult(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			assistantMessage: {
				body: 'All intake questions have been answered. Run /logos-generate to produce documentation.',
				kind: 'completion',
			},
			mode: 'complete',
			stateChanged: true,
			transition: 'complete',
		},
		message: {
			body: 'All intake questions have been answered. Run /logos-generate to produce documentation.',
			kind: 'completion',
		},
		status: 'ok',
	});
}

function createCompletionWithWarnings(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			assistantMessage: {
				body: 'Intake is complete, but some non-critical questions were skipped. Run /logos-generate to produce documentation.',
				kind: 'completion',
			},
			mode: 'complete',
			stateChanged: true,
			transition: 'complete',
		},
		message: {
			body: 'Intake is complete, but some non-critical questions were skipped. Run /logos-generate to produce documentation.',
			kind: 'completion',
		},
		status: 'ok',
		warnings: [
			{
				code: 'skipped_optional',
				message:
					'3 optional questions were skipped — they will not appear in generated documentation.',
				severity: 'warning',
			},
		],
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 8.3 — completion renders complete message', () => {
	it('renders completion message when intake is complete', async () => {
		const messageResult = createCompletionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('My final answer.'),
		});

		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(renderCoreResult).toHaveBeenCalledTimes(1);

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('completion');
		expect(renderedResult?.message.body).toContain('/logos-generate');
		expect(renderedResult?.data?.mode).toBe('complete');
	});

	it('returns handled', async () => {
		const messageResult = createCompletionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Final answer.'),
		});

		expect(result).toEqual({ action: 'handled' });
	});

	it('does not call generation API automatically after completion', async () => {
		const messageResult = createCompletionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Final.'),
		});

		expect(fakeCore.generate).not.toHaveBeenCalled();
	});

	it('does not call status API beyond the initial mode check', async () => {
		const messageResult = createCompletionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Final.'),
		});

		// getStatus called once for the intake mode check.
		expect(fakeCore.getStatus).toHaveBeenCalledTimes(1);
	});

	it('does not send synthetic user message on completion', async () => {
		const messageResult = createCompletionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		const sentUserMessages: unknown[] = [];
		const fakePi = {
			commands: new Map(),
			inputHandlers: [] as Array<(...args: unknown[]) => unknown>,
			on() {},
			registerCommand() {},
			sendUserMessage: vi.fn((msg: unknown) => {
				sentUserMessages.push(msg);
			}),
		};

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({
				core: fakeCore.core,
				pi: fakePi as unknown as ReturnType<typeof makeDeps>['pi'],
				renderCoreResult: vi.fn(),
			}),
			event: inputEvent('Final.'),
		});

		expect(sentUserMessages).toHaveLength(0);
	});

	it('completion preserves transition metadata', async () => {
		const messageResult = createCompletionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Final.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.transition).toBe('complete');
		expect(renderedResult?.data?.stateChanged).toBe(true);
	});

	it('completion with warnings preserves warnings in rendered result', async () => {
		const messageResult = createCompletionWithWarnings();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Final.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.warnings).toHaveLength(1);
		expect(renderedResult?.warnings[0]?.code).toBe('skipped_optional');
		expect(renderedResult?.message.kind).toBe('completion');
	});
});
