/**
 * Step 8.4 — Pi extension natural control intent routing test.
 *
 * Proves that:
 * 1. Active intake natural pause phrase is sent to Core and rendered.
 * 2. Active intake natural status phrase is sent to Core and rendered.
 * 3. Active intake natural generation phrase is sent to Core and rendered.
 * 4. Active intake natural skip phrase is sent to Core and rendered.
 * 5. Slash /logos-status still returns { action: "continue" } (not sent to handleIntakeMessage).
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

function pauseResultFixture(): HandleIntakeMessageResult {
	return createCoreResult({
		data: {
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'Intake paused.',
				kind: 'status',
				questionId: 'q1',
			},
			mode: 'paused',
			stateChanged: true,
			transition: 'pause_requested',
		},
		message: { body: 'Intake paused.', kind: 'status' },
		status: 'ok',
	});
}

function statusResultFixture(): HandleIntakeMessageResult {
	return createCoreResult({
		data: {
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'Status request detected.',
				kind: 'status',
				questionId: 'q1',
			},
			mode: 'intake_active',
			stateChanged: false,
			transition: 'status_requested',
		},
		message: { body: 'Status request detected.', kind: 'status' },
		status: 'ok',
	});
}

function generationResultFixture(): HandleIntakeMessageResult {
	return createCoreResult({
		data: {
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'Generation request detected.',
				kind: 'status',
				questionId: 'q1',
			},
			mode: 'intake_active',
			stateChanged: false,
			transition: 'generation_requested',
		},
		message: { body: 'Generation request detected.', kind: 'status' },
		status: 'ok',
	});
}

function skipResultFixture(): HandleIntakeMessageResult {
	return createCoreResult({
		data: {
			activeQuestionId: 'q2',
			assistantMessage: {
				body: 'Skipped. Next question.',
				kind: 'question',
				questionId: 'q2',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'skipped',
		},
		message: { body: 'Skipped. Next question.', kind: 'question' },
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi extension — natural control intent routing', () => {
	describe('natural pause', () => {
		it('"pause" is sent to Core and rendered', async () => {
			const messageResult = pauseResultFixture();
			const fakeCore = createFakeCore({
				messageResult,
				statusResult: statusResultForMode('intake_active'),
			});
			const renderCoreResult = vi.fn();

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
				event: inputEvent('pause'),
			});

			expect(result).toEqual({ action: 'handled' });
			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
				message: 'pause',
				projectRoot: '/repo',
			});
			expect(renderCoreResult).toHaveBeenCalledTimes(1);

			const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
				| HandleIntakeMessageResult
				| undefined;
			expect(renderedResult?.message.kind).toBe('status');
		});

		it('"pausar" is sent to Core', async () => {
			const fakeCore = createFakeCore({
				messageResult: pauseResultFixture(),
				statusResult: statusResultForMode('intake_active'),
			});

			await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('pausar'),
			});

			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
				message: 'pausar',
				projectRoot: '/repo',
			});
		});
	});

	describe('natural status', () => {
		it('"status" is sent to Core and rendered', async () => {
			const fakeCore = createFakeCore({
				messageResult: statusResultFixture(),
				statusResult: statusResultForMode('intake_active'),
			});
			const renderCoreResult = vi.fn();

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
				event: inputEvent('status'),
			});

			expect(result).toEqual({ action: 'handled' });
			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
				message: 'status',
				projectRoot: '/repo',
			});
			expect(renderCoreResult).toHaveBeenCalledTimes(1);
		});

		it('"onde estamos?" is sent to Core', async () => {
			const fakeCore = createFakeCore({
				messageResult: statusResultFixture(),
				statusResult: statusResultForMode('intake_active'),
			});

			await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('onde estamos?'),
			});

			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
				message: 'onde estamos?',
				projectRoot: '/repo',
			});
		});
	});

	describe('natural generation', () => {
		it('"gerar documentação" is sent to Core and rendered', async () => {
			const fakeCore = createFakeCore({
				messageResult: generationResultFixture(),
				statusResult: statusResultForMode('intake_active'),
			});
			const renderCoreResult = vi.fn();

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
				event: inputEvent('gerar documentação'),
			});

			expect(result).toEqual({ action: 'handled' });
			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
				message: 'gerar documentação',
				projectRoot: '/repo',
			});
			expect(renderCoreResult).toHaveBeenCalledTimes(1);
		});

		it('"generate docs" is sent to Core', async () => {
			const fakeCore = createFakeCore({
				messageResult: generationResultFixture(),
				statusResult: statusResultForMode('intake_active'),
			});

			await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('generate docs'),
			});

			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
				message: 'generate docs',
				projectRoot: '/repo',
			});
		});
	});

	describe('natural skip', () => {
		it('"skip this" is sent to Core and rendered', async () => {
			const fakeCore = createFakeCore({
				messageResult: skipResultFixture(),
				statusResult: statusResultForMode('intake_active'),
			});
			const renderCoreResult = vi.fn();

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
				event: inputEvent('skip this'),
			});

			expect(result).toEqual({ action: 'handled' });
			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
				message: 'skip this',
				projectRoot: '/repo',
			});
			expect(renderCoreResult).toHaveBeenCalledTimes(1);
		});

		it('"deixa pendente" is sent to Core', async () => {
			const fakeCore = createFakeCore({
				messageResult: skipResultFixture(),
				statusResult: statusResultForMode('intake_active'),
			});

			await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('deixa pendente'),
			});

			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledWith({
				message: 'deixa pendente',
				projectRoot: '/repo',
			});
		});
	});

	describe('slash command still returns continue', () => {
		it('/logos-status returns { action: "continue" }', async () => {
			const fakeCore = createFakeCore({
				statusResult: statusResultForMode('intake_active'),
			});

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('/logos-status'),
			});

			expect(result).toEqual({ action: 'continue' });
			// Slash command is NOT sent to handleIntakeMessage.
			expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		});

		it('/logos-start returns { action: "continue" }', async () => {
			const fakeCore = createFakeCore({
				statusResult: statusResultForMode('intake_active'),
			});

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('/logos-start'),
			});

			expect(result).toEqual({ action: 'continue' });
			expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		});

		it('/logos-generate returns { action: "continue" }', async () => {
			const fakeCore = createFakeCore({
				statusResult: statusResultForMode('intake_active'),
			});

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('/logos-generate'),
			});

			expect(result).toEqual({ action: 'continue' });
			expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		});

		it('/logos-stop returns { action: "continue" }', async () => {
			const fakeCore = createFakeCore({
				statusResult: statusResultForMode('intake_active'),
			});

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('/logos-stop'),
			});

			expect(result).toEqual({ action: 'continue' });
			expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		});

		it('/logos-next (forbidden) returns { action: "continue" }', async () => {
			const fakeCore = createFakeCore({
				statusResult: statusResultForMode('intake_active'),
			});

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('/logos-next'),
			});

			expect(result).toEqual({ action: 'continue' });
			expect(fakeCore.handleIntakeMessage).not.toHaveBeenCalled();
		});
	});
});
