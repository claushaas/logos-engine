/**
 * Step 8.3 — Contradiction renders resolution request.
 *
 * Proves that when Core returns a "contradiction" kind result from
 * handleIntakeMessage, the Pi extension renders the contradiction-resolution
 * prompt without advancing to the next question and without synthetic
 * user messages.
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

function createContradictionResult(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			activePrompt: {
				context: 'A previously accepted answer conflicts with this response.',
				contradictionId: 'contra-1',
				documentId: '01-thesis',
				kind: 'contradiction_resolution',
				phaseId: '01-foundation',
				priority: 'critical' as const,
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'Your answer to the thesis question conflicts with your earlier problem statement. Which one should take priority?',
			},
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'Your answer to the thesis question conflicts with your earlier problem statement. Which one should take priority?',
				kind: 'contradiction',
				metadata: { contradictionId: 'contra-1', questionId: 'q1' },
				questionId: 'q1',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'contradiction_recorded',
		},
		message: {
			body: 'Your answer to the thesis question conflicts with your earlier problem statement. Which one should take priority?',
			kind: 'contradiction',
			metadata: { contradictionId: 'contra-1', questionId: 'q1' },
		},
		status: 'ok',
	});
}

function createContradictionWithMinimalMetadata(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			activePrompt: {
				context: 'Simplified contradiction.',
				contradictionId: 'contra-min',
				kind: 'contradiction_resolution',
				phaseId: '01-foundation',
				priority: 'critical' as const,
				questionId: 'q2',
				required: true,
				text: 'This conflicts with your earlier answer. Please resolve.',
			},
			activeQuestionId: 'q2',
			assistantMessage: {
				body: 'This conflicts with your earlier answer. Please resolve.',
				kind: 'contradiction',
				questionId: 'q2',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'contradiction_recorded',
		},
		message: {
			body: 'This conflicts with your earlier answer. Please resolve.',
			kind: 'contradiction',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 8.3 — contradiction renders resolution request', () => {
	it('calls handleIntakeMessage and renders contradiction result', async () => {
		const messageResult = createContradictionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Actually, the opposite of what I said earlier.'),
		});

		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(renderCoreResult).toHaveBeenCalledTimes(1);

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('contradiction');
		expect(renderedResult?.message.body).toContain('conflicts');
	});

	it('rendered result preserves questionId', async () => {
		const messageResult = createContradictionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Contradictory.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.assistantMessage?.questionId).toBe('q1');
		expect(renderedResult?.data?.activeQuestionId).toBe('q1');
	});

	it('rendered result preserves contradictionId', async () => {
		const messageResult = createContradictionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Contradictory.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.metadata?.contradictionId).toBe('contra-1');
		expect(renderedResult?.data?.activePrompt?.contradictionId).toBe(
			'contra-1',
		);
	});

	it('router does not advance — returns handled without side effects', async () => {
		const messageResult = createContradictionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Contradiction.'),
		});

		expect(result).toEqual({ action: 'handled' });
		expect(fakeCore.startIntake).not.toHaveBeenCalled();
		expect(fakeCore.generate).not.toHaveBeenCalled();
	});

	it('does not send synthetic user message', async () => {
		const messageResult = createContradictionResult();
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
			event: inputEvent('Contradiction.'),
		});

		expect(sentUserMessages).toHaveLength(0);
	});

	it('contradiction result preserves transition metadata', async () => {
		const messageResult = createContradictionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Contradiction.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.transition).toBe('contradiction_recorded');
		expect(renderedResult?.data?.activePrompt?.kind).toBe(
			'contradiction_resolution',
		);
	});

	it('renders contradiction with minimal metadata preserved', async () => {
		const messageResult = createContradictionWithMinimalMetadata();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Conflicting answer.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('contradiction');
		expect(renderedResult?.data?.activePrompt?.contradictionId).toBe(
			'contra-min',
		);
	});
});
