/**
 * Step 8.4 — Pi extension out-of-scope message routing test.
 *
 * Proves that:
 * 1. Active intake out-of-scope message is sent to Core via handleIntakeMessage.
 * 2. Core returns a warning/clarification out-of-scope result.
 * 3. Pi renders the out-of-scope result.
 * 4. Pi returns { action: "handled" }.
 * 5. Pi does not advance or call other Core APIs itself.
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

function outOfScopeResultFixture(): HandleIntakeMessageResult {
	return createCoreResult({
		data: {
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'LOGOS intake is active. This message does not appear...',
				kind: 'warning',
				questionId: 'q1',
			},
			mode: 'intake_active',
			stateChanged: false,
			transition: 'out_of_scope',
		},
		message: {
			body: 'LOGOS intake is active. This message does not appear...',
			kind: 'warning',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi extension — out-of-scope message routing', () => {
	it('out-of-scope message is sent to Core via handleIntakeMessage', async () => {
		const messageResult = outOfScopeResultFixture();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});

		const renderCoreResult = vi.fn();

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('write a function to sort arrays'),
		});

		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message: 'write a function to sort arrays',
			projectRoot: '/repo',
		});
	});

	it('Core returns warning out-of-scope result and Pi renders it', async () => {
		const messageResult = outOfScopeResultFixture();
		const fakeCore = createFakeCore({
			messageResult,
			statusResult: statusResultForMode('intake_active'),
		});
		const renderCoreResult = vi.fn();

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
			event: inputEvent('fix the bug'),
		});

		expect(result).toEqual({ action: 'handled' });
		expect(renderCoreResult).toHaveBeenCalledTimes(1);

		const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
			| HandleIntakeMessageResult
			| undefined;
		expect(renderedResult?.message.kind).toBe('warning');
		expect(renderedResult?.message.body).toContain('LOGOS intake is active');
	});

	it('Pi returns { action: "handled" } for out-of-scope', async () => {
		const fakeCore = createFakeCore({
			messageResult: outOfScopeResultFixture(),
			statusResult: statusResultForMode('intake_active'),
		});

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('refactor the database'),
		});

		expect(result).toEqual({ action: 'handled' });
	});

	it('Pi does not advance or call other Core APIs for out-of-scope', async () => {
		const fakeCore = createFakeCore({
			messageResult: outOfScopeResultFixture(),
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('write a microservice'),
		});

		expect(fakeCore.getStatus).toHaveBeenCalled();
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		expect(fakeCore.generate).not.toHaveBeenCalled();
		expect(fakeCore.handleIntakeCommand).not.toHaveBeenCalled();
		expect(fakeCore.startIntake).not.toHaveBeenCalled();
	});

	it('Pi does not classify the message as out-of-scope itself', async () => {
		const fakeCore = createFakeCore({
			messageResult: outOfScopeResultFixture(),
			statusResult: statusResultForMode('intake_active'),
		});

		await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('build a new UI component'),
		});

		// The raw text "build a new UI component" is sent verbatim to Core.
		expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
			message: 'build a new UI component',
			projectRoot: '/repo',
		});
	});

	it('inactive intake returns { action: "continue" }', async () => {
		const fakeCore = createFakeCore({
			statusResult: statusResultForMode('idle'),
		});

		const result = await routePiInput({
			ctx: ctx('/repo'),
			deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
			event: inputEvent('write a function'),
		});

		expect(result).toEqual({ action: 'continue' });
		expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
	});
});
