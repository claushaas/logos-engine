/**
 * Step 9.1 — renderCoreResult preserves metadata, blockers, and warnings.
 *
 * Proves that `renderCoreResult`:
 * 1. Forwards Core result to injected renderer seam.
 * 2. Message metadata is preserved.
 * 3. Blockers are preserved.
 * 4. Warnings are preserved.
 * 5. Unknown message kind is rendered generically without throwing.
 * 6. pi.sendUserMessage is not called.
 */

import { describe, expect, it, vi } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import {
	createCoreResult,
	createLogosBlocker,
	createLogosWarning,
} from '../../src/core/index.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import type { LogosPiCommandContext } from '../../src/pi-extension/pi-types.js';
import {
	extractRenderedMessage,
	renderCoreResult,
} from '../../src/pi-extension/rendering/render-core-result.js';

// ---------------------------------------------------------------------------
// Fake helpers
// ---------------------------------------------------------------------------

function fakeCtx(
	overrides?: Partial<LogosPiCommandContext>,
): LogosPiCommandContext {
	return {
		cwd: '/test-project',
		...overrides,
	} as LogosPiCommandContext;
}

function makeDeps(options?: {
	renderCoreResult?: LogosPiExtensionDependencies['renderCoreResult'];
	piSendMessage?: ReturnType<typeof vi.fn>;
	piSendUserMessage?: ReturnType<typeof vi.fn>;
}): LogosPiExtensionDependencies {
	const pi: Record<string, unknown> = {};

	if (options?.piSendMessage) {
		pi.sendMessage = options.piSendMessage;
	}
	if (options?.piSendUserMessage) {
		pi.sendUserMessage = options.piSendUserMessage;
	}

	return {
		core: {} as LogosPiExtensionDependencies['core'],
		pi: pi as LogosPiExtensionDependencies['pi'],
		...(options?.renderCoreResult !== undefined
			? { renderCoreResult: options.renderCoreResult }
			: {}),
	};
}

function fakeCoreResult<TData>(overrides: {
	body?: string;
	kind?: AssistantMessage['kind'];
	data?: TData;
	blockers?: ReturnType<typeof createLogosBlocker>[];
	warnings?: ReturnType<typeof createLogosWarning>[];
	metadata?: Record<string, unknown>;
}): ReturnType<typeof createCoreResult<TData>> {
	return createCoreResult<TData>({
		blockers: overrides.blockers,
		data: overrides.data,
		message: {
			body: overrides.body ?? 'Test message.',
			kind: overrides.kind ?? 'status',
			metadata: overrides.metadata,
		},
		status: overrides.blockers?.length ? 'blocked' : 'ok',
		warnings: overrides.warnings,
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.1 — renderCoreResult preserves metadata', () => {
	describe('injected renderer seam', () => {
		it('forwards Core result to injected renderCoreResult', async () => {
			const result = fakeCoreResult({ body: 'Forwarded.', kind: 'question' });
			const injected = vi.fn();

			await renderCoreResult({
				ctx: fakeCtx(),
				deps: makeDeps({ renderCoreResult: injected }),
				result,
			});

			expect(injected).toHaveBeenCalledTimes(1);
			expect(injected).toHaveBeenCalledWith(
				result,
				expect.objectContaining({ cwd: '/test-project' }),
			);
		});

		it('passes ctx to injected renderer', async () => {
			const result = fakeCoreResult({ body: 'With ctx.', kind: 'status' });
			const injected = vi.fn();
			const ctxVal = fakeCtx({ cwd: '/specific-path' });

			await renderCoreResult({
				ctx: ctxVal,
				deps: makeDeps({ renderCoreResult: injected }),
				result,
			});

			expect(injected).toHaveBeenCalledWith(result, ctxVal);
		});
	});

	describe('pi.sendMessage fallback', () => {
		it('calls pi.sendMessage when injected renderer is absent', async () => {
			const result = fakeCoreResult({ body: 'Send me.', kind: 'question' });
			const sendMessage = vi.fn();

			await renderCoreResult({
				ctx: fakeCtx(),
				deps: makeDeps({ piSendMessage: sendMessage }),
				result,
			});

			expect(sendMessage).toHaveBeenCalledTimes(1);
			expect(sendMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					content: 'Send me.',
					customType: 'logos-core-result',
					display: true,
				}),
			);
		});

		it('pi.sendMessage payload includes rendered details', async () => {
			const result = fakeCoreResult({
				body: 'Detailed.',
				kind: 'question',
				metadata: { questionId: 'q1' },
			});
			const sendMessage = vi.fn();

			await renderCoreResult({
				ctx: fakeCtx(),
				deps: makeDeps({ piSendMessage: sendMessage }),
				result,
			});

			const callArg = sendMessage.mock.calls[0]?.[0] as
				| { details?: { kind: string; body: string } }
				| undefined;
			expect(callArg?.details).toBeDefined();
			expect(callArg?.details?.kind).toBe('question');
			expect(callArg?.details?.body).toBe('Detailed.');
		});
	});

	describe('message metadata preservation', () => {
		it('extractRenderedMessage preserves message kind and body', () => {
			const result = fakeCoreResult({
				body: 'Preserved body.',
				kind: 'clarification',
			});

			const rendered = extractRenderedMessage(result);

			expect(rendered.kind).toBe('clarification');
			expect(rendered.body).toBe('Preserved body.');
		});

		it('extractRenderedMessage preserves message metadata', () => {
			const result = fakeCoreResult({
				body: 'With metadata.',
				kind: 'question',
				metadata: { customKey: 'customValue' },
			});

			const rendered = extractRenderedMessage(result);

			expect(rendered.metadata).toEqual({ customKey: 'customValue' });
		});
	});

	describe('blocker preservation', () => {
		it('preserves blockers in extractRenderedMessage', () => {
			const result = fakeCoreResult({
				blockers: [
					createLogosBlocker({ code: 'b1', message: 'Blocker 1.' }),
					createLogosBlocker({ code: 'b2', message: 'Blocker 2.' }),
				],
				body: 'Blocked.',
				kind: 'error',
			});

			const rendered = extractRenderedMessage(result);

			expect(rendered.blockers).toHaveLength(2);
			expect((rendered.blockers?.[0] as { code: string }).code).toBe('b1');
			expect((rendered.blockers?.[1] as { code: string }).code).toBe('b2');
		});

		it('preserves blockers in renderCoreResult pi.sendMessage payload', async () => {
			const result = fakeCoreResult({
				blockers: [
					createLogosBlocker({
						code: 'profile_not_found',
						message: 'Missing profile.',
					}),
				],
				body: 'Blocked.',
				kind: 'error',
			});
			const sendMessage = vi.fn();

			await renderCoreResult({
				ctx: fakeCtx(),
				deps: makeDeps({ piSendMessage: sendMessage }),
				result,
			});

			const callArg = sendMessage.mock.calls[0]?.[0] as {
				details?: { blockers?: unknown[] };
			};
			expect(callArg?.details?.blockers).toHaveLength(1);
		});
	});

	describe('warning preservation', () => {
		it('preserves warnings in extractRenderedMessage', () => {
			const result = fakeCoreResult({
				body: 'Warning.',
				kind: 'warning',
				warnings: [
					createLogosWarning({ code: 'w1', message: 'Warning 1.' }),
					createLogosWarning({ code: 'w2', message: 'Warning 2.' }),
				],
			});

			const rendered = extractRenderedMessage(result);

			expect(rendered.warnings).toHaveLength(2);
			expect((rendered.warnings?.[0] as { code: string }).code).toBe('w1');
		});

		it('preserves warnings in renderCoreResult pi.sendMessage payload', async () => {
			const result = fakeCoreResult({
				body: 'Warning.',
				kind: 'warning',
				warnings: [
					createLogosWarning({
						code: 'skipped_optional',
						message: 'Optional skipped.',
					}),
				],
			});
			const sendMessage = vi.fn();

			await renderCoreResult({
				ctx: fakeCtx(),
				deps: makeDeps({ piSendMessage: sendMessage }),
				result,
			});

			const callArg = sendMessage.mock.calls[0]?.[0] as {
				details?: { warnings?: unknown[] };
			};
			expect(callArg?.details?.warnings).toHaveLength(1);
		});
	});

	describe('unknown message kind', () => {
		it('renders unknown message kind generically without throwing', () => {
			const result = createCoreResult({
				message: {
					body: 'Some future message kind.',
					kind: 'future_kind' as AssistantMessage['kind'],
					metadata: { custom: true },
				},
				status: 'ok',
			});

			expect(() => extractRenderedMessage(result)).not.toThrow();

			const rendered = extractRenderedMessage(result);
			expect(rendered.kind).toBe('future_kind');
			expect(rendered.body).toBe('Some future message kind.');
			expect(rendered.metadata).toEqual({ custom: true });
		});

		it('renderCoreResult does not throw for unknown kind', async () => {
			const result = createCoreResult({
				message: {
					body: 'Unknown kind body.',
					kind: 'unknown_kind' as AssistantMessage['kind'],
				},
				status: 'ok',
			});
			const injected = vi.fn();

			await expect(
				renderCoreResult({
					ctx: fakeCtx(),
					deps: makeDeps({ renderCoreResult: injected }),
					result,
				}),
			).resolves.toBeUndefined();
		});
	});

	describe('pi.sendUserMessage is not called', () => {
		it('renderCoreResult never calls pi.sendUserMessage', async () => {
			const result = fakeCoreResult({ body: 'Test.', kind: 'question' });
			const sendUserMessage = vi.fn();
			const sendMessage = vi.fn();

			await renderCoreResult({
				ctx: fakeCtx(),
				deps: makeDeps({
					piSendMessage: sendMessage,
					piSendUserMessage: sendUserMessage,
				}),
				result,
			});

			expect(sendUserMessage).not.toHaveBeenCalled();
		});
	});
});
