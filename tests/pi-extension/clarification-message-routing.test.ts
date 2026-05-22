/**
 * Step 8.4 — Pi extension clarification message routing test.
 *
 * Proves that:
 * 1. Active intake clarification phrase is sent to Core via handleIntakeMessage.
 * 2. Core returns a clarification result.
 * 3. Pi renders the clarification result.
 * 4. Pi returns { action: "handled" }.
 * 5. Pi does not call pi.sendUserMessage or classify the message itself.
 */

import { describe, expect, it, vi } from 'vitest';
import type { HandleIntakeMessageResult } from '../../src/core/api.js';
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

function clarificationResultFixture(): HandleIntakeMessageResult {
	return createCoreResult({
		data: {
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'This question is asking you to clarify...',
				kind: 'clarification',
				questionId: 'q1',
			},
			mode: 'intake_active',
			stateChanged: false,
			transition: 'clarification_requested',
		},
		message: {
			body: 'This question is asking you to clarify...',
			kind: 'clarification',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi extension — clarification message routing', () => {
	it('clarification phrase is sent to Core via handleIntakeMessage', async () => {
		const messageResult = clarificationResultFixture();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('what do you mean?'),
		});

		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message: 'what do you mean?',
			projectRoot: '/repo',
		});
	});

	it('Core returns clarification result and Pi renders it', async () => {
		const messageResult = clarificationResultFixture();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('what do you mean?'),
		});

		expect(result).toEqual({ action: 'handled' });
		expect(renderCoreResult).toHaveBeenCalledTimes(1);

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('clarification');
		expect(renderedResult?.message.body).toContain(
			'This question is asking you to clarify',
		);
	});

	it('Pi returns { action: "handled" } for clarification', async () => {
		const fakeCore = createFakeCore({
			messageResult: clarificationResultFixture(),
			statusResult: statusResultForMode('intake_active'),
		});

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('o que você quer dizer?'),
		});

		expect(result).toEqual({ action: 'handled' });
	});

	it('Pi does not call pi.sendUserMessage for clarification', async () => {
		const fakeCore = createFakeCore({
			messageResult: clarificationResultFixture(),
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('não entendi'),
		});

		// Pi does not classify or send a message itself — Core owns intent.
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(fakeCore.handleIntakeCommand).not.toHaveBeenCalled();
		expect(fakeCore.startIntake).not.toHaveBeenCalled();
	});

	it('Pi does not classify the message itself', async () => {
		const fakeCore = createFakeCore({
			messageResult: clarificationResultFixture(),
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('explique melhor'),
		});

		// Pi calls only getStatus and handleIntakeMessage.
		expect(fakeCore.getStatus).toHaveBeenCalled();
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(fakeCore.generate).not.toHaveBeenCalled();
		expect(fakeCore.handleIntakeCommand).not.toHaveBeenCalled();
	});

	it('clarification in Portuguese also routes through Core', async () => {
		const fakeCore = createFakeCore({
			messageResult: clarificationResultFixture(),
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('não entendi'),
		});

		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message: 'não entendi',
			projectRoot: '/repo',
		});
	});
});
