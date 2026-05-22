/**
 * Step 8.3 — Insufficient answer renders clarification.
 *
 * Proves that when Core returns a "clarification" kind result (or a
 * non-advancing follow-up), the Pi extension renders it without
 * advancing to the next question, without calling handleIntakeMessage
 * a second time, and without synthetic user messages.
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

function createClarificationResult(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			activePrompt: {
				context: 'The answer was too vague to evaluate.',
				documentId: '01-thesis',
				kind: 'follow_up',
				phaseId: '01-foundation',
				priority: 'important' as const,
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'Could you be more specific? Your answer was too vague to determine if it covers the required aspects.',
			},
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'Could you be more specific? Your answer was too vague to determine if it covers the required aspects.',
				kind: 'clarification',
				questionId: 'q1',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'clarification_requested',
		},
		message: {
			body: 'Could you be more specific? Your answer was too vague to determine if it covers the required aspects.',
			kind: 'clarification',
		},
		status: 'ok',
	});
}

function createInsufficientFollowUpResult(): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		data: {
			activePrompt: {
				context: 'The answer needs more detail.',
				documentId: '02-scope',
				followUpId: 'fu-insuff-1',
				kind: 'follow_up',
				phaseId: '02-scoping',
				priority: 'important' as const,
				questionId: 'q5',
				required: true,
				sectionId: 'scope-details',
				text: 'Your scope answer was too broad. Could you narrow it to specific deliverables?',
			},
			activeQuestionId: 'q5',
			assistantMessage: {
				body: 'Your scope answer was too broad. Could you narrow it to specific deliverables?',
				kind: 'clarification',
				questionId: 'q5',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'clarification_requested',
		},
		message: {
			body: 'Your scope answer was too broad. Could you narrow it to specific deliverables?',
			kind: 'clarification',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 8.3 — insufficient answer renders clarification', () => {
	it('renders clarification result for vague answer', async () => {
		const messageResult = createClarificationResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('It should be good.'),
		});

		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(renderCoreResult).toHaveBeenCalledTimes(1);

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('clarification');
		expect(renderedResult?.message.body).toContain('more specific');
	});

	it('returns handled', async () => {
		const messageResult = createClarificationResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Vague answer.'),
		});

		expect(result).toEqual({ action: 'handled' });
	});

	it('does not call handleIntakeMessage a second time', async () => {
		const messageResult = createClarificationResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Vague.'),
		});

		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
	});

	it('does not send synthetic user message after clarification', async () => {
		const messageResult = createClarificationResult();
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
			event: inputEvent('Vague.'),
		});

		expect(sentUserMessages).toHaveLength(0);
	});

	it('clarification preserves active question — does not advance', async () => {
		const messageResult = createClarificationResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Vague.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.data?.activeQuestionId).toBe('q1');
		expect(renderedResult?.data?.assistantMessage?.questionId).toBe('q1');
	});

	it('clarification for insufficient scope answer renders correctly', async () => {
		const messageResult = createInsufficientFollowUpResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('Scope is the whole world.'),
		});

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('clarification');
		expect(renderedResult?.message.body).toContain('specific deliverables');
	});

	it('does not call generation or status APIs after clarification', async () => {
		const messageResult = createClarificationResult();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('Vague.'),
		});

		expect(fakeCore.generate).not.toHaveBeenCalled();
		// getStatus was called for the intake mode check, but handleIntakeCommand
		// was not.
		expect(fakeCore.handleIntakeCommand).not.toHaveBeenCalled();
	});
});
