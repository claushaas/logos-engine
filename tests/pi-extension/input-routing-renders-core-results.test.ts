/**
 * Step 8.3 — Input routing renders all Core result message kinds.
 *
 * Proves that the input router forwards all relevant Core message kinds
 * to the renderer, preserves blockers and warnings in the rendered
 * payload, uses the renderer injection when provided, and does not
 * implement product logic in the renderer.
 */

import { describe, expect, it, vi } from 'vitest';
import type {
	HandleIntakeMessageData,
	HandleIntakeMessageResult,
} from '../../src/core/api.js';
import {
	createCoreResult,
	createLogosBlocker,
	createLogosWarning,
} from '../../src/core/index.js';
import { routePiInput } from '../../src/pi-extension/input/input-router.js';
import { extractRenderedMessage } from '../../src/pi-extension/rendering/render-core-result.js';
import {
	createFakeCore,
	ctx,
	inputEvent,
	makeDeps,
	statusResultForMode,
} from './input-routing-test-helpers.js';

// ---------------------------------------------------------------------------
// Fixtures: one per Core message kind
// ---------------------------------------------------------------------------

function resultFixture(options: {
	kind: string;
	body: string;
	data?: Partial<HandleIntakeMessageData>;
	blockers?: Array<{ code: string; message: string }>;
	warnings?: Array<{ code: string; message: string }>;
}): HandleIntakeMessageResult {
	return createCoreResult<HandleIntakeMessageData>({
		blockers: options.blockers?.map((b) =>
			createLogosBlocker({ code: b.code, message: b.message }),
		),
		data: {
			activeQuestionId: 'q1',
			assistantMessage: {
				body: options.body,
				kind: options.kind as HandleIntakeMessageData['assistantMessage'] extends
					| { kind: infer K }
					| undefined
					? K
					: never,
				questionId: 'q1',
			},
			mode: 'intake_active',
			stateChanged: true,
			transition: 'answer_accepted',
			...options.data,
		},
		message: {
			body: options.body,
			kind: options.kind as HandleIntakeMessageResult['message']['kind'],
		},
		status: options.blockers?.length ? 'blocked' : 'ok',
		warnings: options.warnings?.map((w) =>
			createLogosWarning({ code: w.code, message: w.message }),
		),
	});
}

const ALL_KINDS = [
	{ body: 'What is your thesis?', kind: 'question' },
	{ body: 'Can you elaborate on the audience?', kind: 'follow_up' },
	{
		body: 'This conflicts with your earlier statement.',
		kind: 'contradiction',
	},
	{
		body: 'Your answer was too vague. Please clarify.',
		kind: 'clarification',
	},
	{
		body: 'All questions answered. Run /logos-generate.',
		kind: 'completion',
	},
	{ body: 'Intake is in progress.', kind: 'status' },
] as const;

const BLOCKER_ERROR_KINDS = [
	{
		body: 'Some questions remain unanswered.',
		kind: 'warning',
		warnings: [{ code: 'incomplete', message: 'Partial intake.' }],
	},
	{
		blockers: [
			{ code: 'profile_not_found', message: 'Active profile missing.' },
		],
		body: 'Profile not found.',
		kind: 'error',
	},
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 8.3 — input routing renders Core results for all message kinds', () => {
	describe.each(ALL_KINDS)('kind: $kind', ({
		kind,
		body,
	}: {
		kind: string;
		body: string;
	}) => {
		it(`renders Core result with message kind "${kind}"`, async () => {
			const messageResult = resultFixture({ body, kind });
			const fakeCore = createFakeCore({
				messageResult,
				statusResult: statusResultForMode('intake_active'),
			});
			const renderCoreResult = vi.fn();

			await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({
					core: fakeCore.core,
					renderCoreResult,
				}),
				event: inputEvent('Natural answer.'),
			});

			expect(renderCoreResult).toHaveBeenCalledTimes(1);
			const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
				| HandleIntakeMessageResult
				| undefined;
			expect(renderedResult?.message.kind).toBe(kind);
			expect(renderedResult?.message.body).toBe(body);
		});

		it(`router returns handled for kind "${kind}"`, async () => {
			const messageResult = resultFixture({ body, kind });
			const fakeCore = createFakeCore({
				messageResult,
				statusResult: statusResultForMode('intake_active'),
			});

			const result = await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({
					core: fakeCore.core,
					renderCoreResult: vi.fn(),
				}),
				event: inputEvent('Answer.'),
			});

			expect(result).toEqual({ action: 'handled' });
		});
	});

	describe.each(BLOCKER_ERROR_KINDS)('kind: $kind', ({
		kind,
		body,
		blockers,
		warnings,
	}: {
		kind: string;
		body: string;
		blockers?: Array<{ code: string; message: string }>;
		warnings?: Array<{ code: string; message: string }>;
	}) => {
		it(`renders Core result with blockers/warnings for kind "${kind}"`, async () => {
			const messageResult = resultFixture({ blockers, body, kind, warnings });
			const fakeCore = createFakeCore({
				messageResult,
				statusResult: statusResultForMode('intake_active'),
			});
			const renderCoreResult = vi.fn();

			await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({
					core: fakeCore.core,
					renderCoreResult,
				}),
				event: inputEvent('Natural.'),
			});

			const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
				| HandleIntakeMessageResult
				| undefined;
			expect(renderedResult?.message.kind).toBe(kind);

			if (blockers) {
				expect(renderedResult?.blockers).toHaveLength(blockers.length);
			}
			if (warnings) {
				expect(renderedResult?.warnings).toHaveLength(warnings.length);
			}
		});
	});

	describe('blocker and warning preservation', () => {
		it('preserves blockers in rendered result', async () => {
			const messageResult = resultFixture({
				blockers: [
					{ code: 'profile_not_found', message: 'Profile missing.' },
					{
						code: 'project_not_initialized',
						message: 'Not initialized.',
					},
				],
				body: 'Blocked.',
				kind: 'error',
			});
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

			const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
				| HandleIntakeMessageResult
				| undefined;
			expect(renderedResult?.blockers).toHaveLength(2);
			expect(renderedResult?.blockers[0]?.code).toBe('profile_not_found');
			expect(renderedResult?.blockers[1]?.code).toBe('project_not_initialized');
		});

		it('preserves warnings in rendered result', async () => {
			const messageResult = resultFixture({
				body: 'Warning.',
				kind: 'warning',
				warnings: [
					{ code: 'missing_optional', message: 'Optional skipped.' },
					{ code: 'partial_phase', message: 'Phase incomplete.' },
				],
			});
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

			const renderedResult = renderCoreResult.mock.calls[0]?.[0] as
				| HandleIntakeMessageResult
				| undefined;
			expect(renderedResult?.warnings).toHaveLength(2);
			expect(renderedResult?.warnings[0]?.code).toBe('missing_optional');
		});
	});

	describe('renderer injection', () => {
		it('uses injected renderCoreResult when provided', async () => {
			const messageResult = resultFixture({
				body: 'Rendered via injection.',
				kind: 'question',
			});
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

			expect(renderCoreResult).toHaveBeenCalledTimes(1);
			expect(renderCoreResult).toHaveBeenCalledWith(
				messageResult,
				expect.objectContaining({ cwd: '/repo' }),
			);
		});

		it('passes ctx to injected renderer', async () => {
			const messageResult = resultFixture({
				body: 'With context.',
				kind: 'status',
			});
			const fakeCore = createFakeCore({
				messageResult,
				statusResult: statusResultForMode('intake_active'),
			});
			const renderCoreResult = vi.fn();

			await routePiInput({
				ctx: ctx('/specific-project'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult }),
				event: inputEvent('Answer.'),
			});

			expect(renderCoreResult).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ cwd: '/specific-project' }),
			);
		});
	});

	describe('no product logic in renderer', () => {
		it('adapter does not call Core beyond handleIntakeMessage for rendering', async () => {
			const messageResult = resultFixture({
				body: 'Question rendered.',
				kind: 'question',
			});
			const fakeCore = createFakeCore({
				messageResult,
				statusResult: statusResultForMode('intake_active'),
			});

			await routePiInput({
				ctx: ctx('/repo'),
				deps: makeDeps({ core: fakeCore.core, renderCoreResult: vi.fn() }),
				event: inputEvent('Answer.'),
			});

			// Only getStatus (for mode check) and handleIntakeMessage should be called.
			expect(fakeCore.startIntake).not.toHaveBeenCalled();
			expect(fakeCore.generate).not.toHaveBeenCalled();
			expect(fakeCore.handleIntakeCommand).not.toHaveBeenCalled();
			expect(fakeCore.handleIntakeMessage).toHaveBeenCalledTimes(1);
		});
	});

	describe('LogosRenderedMessage extraction', () => {
		it('extractRenderedMessage extracts kind and body', () => {
			const result = resultFixture({
				body: 'Extracted body.',
				kind: 'clarification',
			});
			const rendered = extractRenderedMessage(result);
			expect(rendered.type).toBe('logos');
			expect(rendered.kind).toBe('clarification');
			expect(rendered.body).toBe('Extracted body.');
		});

		it('extractRenderedMessage extracts questionId from assistantMessage', () => {
			const result = createCoreResult<HandleIntakeMessageData>({
				data: {
					activeQuestionId: 'qa',
					assistantMessage: {
						body: 'Question text.',
						kind: 'question',
						questionId: 'qa',
					},
					mode: 'intake_active',
					stateChanged: false,
					transition: 'answer_accepted',
				},
				message: { body: 'Question text.', kind: 'question' },
				status: 'ok',
			});

			const rendered = extractRenderedMessage(result);
			expect(rendered.questionId).toBe('qa');
		});

		it('extractRenderedMessage extracts activeQuestionId as fallback', () => {
			const result = createCoreResult<HandleIntakeMessageData>({
				data: {
					activeQuestionId: 'qb',
					mode: 'intake_active',
					stateChanged: false,
					transition: 'answer_accepted',
				},
				message: { body: 'No assistant message.', kind: 'status' },
				status: 'ok',
			});

			const rendered = extractRenderedMessage(result);
			expect(rendered.questionId).toBe('qb');
		});

		it('extractRenderedMessage extracts followUpId and contradictionId', () => {
			const result = createCoreResult<HandleIntakeMessageData>({
				data: {
					activePrompt: {
						context: 'test',
						contradictionId: 'c-99',
						followUpId: 'fu-42',
						kind: 'follow_up',
						phaseId: 'phase-1',
						questionId: 'q-x',
						text: 'Follow up text.',
					},
					activeQuestionId: 'q-x',
					mode: 'intake_active',
					stateChanged: false,
					transition: 'follow_up_requested',
				},
				message: { body: 'Follow up.', kind: 'follow_up' },
				status: 'ok',
			});

			const rendered = extractRenderedMessage(result);
			expect(rendered.followUpId).toBe('fu-42');
			expect(rendered.contradictionId).toBe('c-99');
			expect(rendered.phaseId).toBe('phase-1');
		});

		it('extractRenderedMessage includes blockers and warnings', () => {
			const result = createCoreResult<HandleIntakeMessageData>({
				blockers: [createLogosBlocker({ code: 'b1', message: 'Blocker 1.' })],
				data: {
					mode: 'idle',
					stateChanged: false,
					transition: 'blocked',
				},
				message: { body: 'Blocked.', kind: 'error' },
				status: 'blocked',
				warnings: [createLogosWarning({ code: 'w1', message: 'Warning 1.' })],
			});

			const rendered = extractRenderedMessage(result);
			expect(rendered.blockers).toHaveLength(1);
			expect(rendered.warnings).toHaveLength(1);
		});

		it('extractRenderedMessage includes rawResult for full access', () => {
			const result = resultFixture({
				body: 'Full result.',
				kind: 'question',
			});
			const rendered = extractRenderedMessage(result);
			expect(rendered.rawResult).toBe(result);
		});
	});
});
