/**
 * Step 8.3 — Partial answer renders targeted follow-up.
 *
 * Proves that when Core returns a "follow_up" kind result from
 * handleIntakeMessage, the Pi extension renders the follow-up
 * without advancing to the next question and without synthetic
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

function createPartialAnswerFollowUpResult(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			activePrompt: {
				context: 'You gave the thesis but did not identify the audience.',
				documentId: '01-thesis',
				followUpId: 'fu-1',
				kind: 'follow_up',
				phaseId: '01-foundation',
				priority: 'important' as const,
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'You mentioned the thesis applies to software teams. Can you be more specific about which type of team?',
			},
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'You mentioned the thesis applies to software teams. Can you be more specific about which type of team?',
				kind: 'follow_up',
				metadata: { followUpId: 'fu-1', questionId: 'q1' },
				questionId: 'q1',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'follow_up_requested',
		},
		message: {
			body: 'You mentioned the thesis applies to software teams. Can you be more specific about which type of team?',
			kind: 'follow_up',
			metadata: { followUpId: 'fu-1', questionId: 'q1' },
		},
		status: 'ok',
	});
}

function createPartialAnswerWithSuggestedFollowUp(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			activePrompt: {
				context: 'Incomplete budget information.',
				documentId: '03-budget',
				followUpId: 'fu-budget-1',
				kind: 'follow_up',
				phaseId: '02-scoping',
				priority: 'important' as const,
				questionId: 'q5',
				required: true,
				sectionId: 'budget',
				text: 'Could you also provide information about budget and timeline?',
			},
			activeQuestionId: 'q5',
			assistantMessage: {
				body: 'Could you also provide information about budget and timeline?',
				kind: 'follow_up',
				questionId: 'q5',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'follow_up_requested',
		},
		message: {
			body: 'Could you also provide information about budget and timeline?',
			kind: 'follow_up',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 8.3 — partial answer renders follow-up', () => {
	it('calls handleIntakeMessage and renders follow-up result', async () => {
		const messageResult = createPartialAnswerFollowUpResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('My project is a documentation tool.'),
		});

		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(renderCoreResult).toHaveBeenCalledTimes(1);

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('follow_up');
		expect(renderedResult?.message.body).toContain('more specific');
	});

	it('rendered result preserves questionId', async () => {
		const messageResult = createPartialAnswerFollowUpResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Partial answer.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.assistantMessage?.questionId).toBe('q1');
		expect(renderedResult?.data?.activeQuestionId).toBe('q1');
	});

	it('rendered result preserves followUpId', async () => {
		const messageResult = createPartialAnswerFollowUpResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Partial.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.metadata?.followUpId).toBe('fu-1');
		expect(renderedResult?.data?.activePrompt?.followUpId).toBe('fu-1');
	});

	it('router returns handled', async () => {
		const messageResult = createPartialAnswerFollowUpResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Partial answer.'),
		});

		expect(result).toEqual({ action: 'handled' });
	});

	it('does not send synthetic user message', async () => {
		const messageResult = createPartialAnswerFollowUpResult();
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
			event: inputEvent('Partial.'),
		});

		expect(sentUserMessages).toHaveLength(0);
	});

	it('partial answer does not advance — activeQuestionId stays Q1', async () => {
		const messageResult = createPartialAnswerFollowUpResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Partial.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.activeQuestionId).toBe('q1');
		expect(renderedResult?.data?.transition).toBe('follow_up_requested');
	});

	it('renders suggested follow-up text from evaluator', async () => {
		const messageResult = createPartialAnswerWithSuggestedFollowUp();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Incomplete budget info.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('follow_up');
		expect(renderedResult?.message.body).toContain('budget and timeline');
	});
});
