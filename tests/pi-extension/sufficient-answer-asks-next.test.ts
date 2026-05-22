/**
 * Step 8.3 — Sufficient answer asks next question automatically.
 *
 * Proves that when Core returns a "question" kind result from
 * handleIntakeMessage, the Pi extension renders the next question
 * immediately without requiring /logos-next or synthetic user messages.
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

/**
 * Core result fixture: sufficient answer → next question Q2.
 *
 * Simulates what Core returns when the user gives a sufficient answer
 * to Q1 and the prompt selector picks the next unresolved question.
 */
function createSufficientAnswerNextQuestionResult(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			activePrompt: {
				context: 'Now that we know the thesis, who is the audience?',
				documentId: '01-thesis',
				kind: 'question',
				phaseId: '01-foundation',
				priority: 'critical' as const,
				questionId: 'q2',
				required: true,
				sectionId: 'audience',
				text: 'Who is the primary audience for this project?',
			},
			activeQuestionId: 'q2',
			assistantMessage: {
				body: 'Who is the primary audience for this project?',
				kind: 'question',
				questionId: 'q2',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'answer_accepted',
		},
		message: {
			body: 'Who is the primary audience for this project?',
			kind: 'question',
		},
		status: 'ok',
	});
}

/**
 * Core result fixture: sufficient answer → next question Q2 with metadata
 * preserved on the top-level message.
 */
function createSufficientAnswerWithMetadata(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			activePrompt: {
				context: 'Project scope question.',
				documentId: '02-scope',
				kind: 'question',
				phaseId: '02-scoping',
				priority: 'important' as const,
				questionId: 'q3',
				required: true,
				sectionId: 'scope-boundaries',
				text: 'What are the scope boundaries for this project?',
			},
			activeQuestionId: 'q3',
			assistantMessage: {
				body: 'What are the scope boundaries for this project?',
				kind: 'question',
				metadata: { phaseId: '02-scoping', questionId: 'q3' },
				questionId: 'q3',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'answer_accepted',
		},
		message: {
			body: 'What are the scope boundaries for this project?',
			kind: 'question',
			metadata: { phaseId: '02-scoping', questionId: 'q3' },
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 8.3 — sufficient answer asks next question', () => {
	it('renders next question result immediately after sufficient answer', async () => {
		const messageResult = createSufficientAnswerNextQuestionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent(
				'My project thesis is to make documentation more conversational.',
			),
		});

		// Core must have been called.
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message:
				'My project thesis is to make documentation more conversational.',
			projectRoot: '/repo',
		});

		// Renderer must have been called with the Q2 result.
		expect(renderCoreResult).toHaveBeenCalledTimes(1);
		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('question');
		expect(renderedResult?.message.body).toBe(
			'Who is the primary audience for this project?',
		);

		// Router returns handled.
		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Another answer.'),
		});
		expect(result).toEqual({ action: 'handled' });
	});

	it('activeQuestionId changes from Q1 to Q2 after sufficient answer', async () => {
		const messageResult = createSufficientAnswerNextQuestionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('My clear and specific thesis.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.activeQuestionId).toBe('q2');
		expect(renderedResult?.data?.assistantMessage?.questionId).toBe('q2');
	});

	it('does not call /logos-next or inject synthetic user message', async () => {
		const messageResult = createSufficientAnswerNextQuestionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		// Track any attempt to send a user message through the fake Pi.
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
			event: inputEvent('Sufficient answer.'),
		});

		// No synthetic user messages must be sent.
		expect(sentUserMessages).toHaveLength(0);

		// handleIntakeMessage is called only once — no re-invocation.
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
	});

	it('does not select Q2 itself — only renders Core result', async () => {
		const messageResult = createSufficientAnswerNextQuestionResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Answer.'),
		});

		// The Pi adapter only called handleIntakeMessage — it did not
		// call startIntake, generate, or any other Core API to select Q2.
		expect(fakeCore.startIntake).not.toHaveBeenCalled();
		expect(fakeCore.generate).not.toHaveBeenCalled();
		expect(fakeCore.handleIntakeCommand).not.toHaveBeenCalled();

		// Q2 came from the rendered Core result, not from Pi logic.
		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.activeQuestionId).toBe('q2');
	});

	it('renderer preserves questionId metadata', async () => {
		const messageResult = createSufficientAnswerWithMetadata();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('My answer.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.assistantMessage?.questionId).toBe('q3');
		expect(renderedResult?.message.kind).toBe('question');
		expect(renderedResult?.message.metadata?.questionId).toBe('q3');
	});

	it('non-active intake natural messages continue to normal Pi', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('idle'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Normal chat message.'),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		expect(renderCoreResult).not.toHaveBeenCalled();
	});
});
