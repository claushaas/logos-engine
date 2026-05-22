/**
 * LOGOS Pi Extension — Core result rendering boundary (Step 8.3 enhanced).
 *
 * Handles rendering of conversational advancement results returned by
 * `core.handleIntakeMessage(...)`.  Supports all Core assistant message kinds
 * (question, follow_up, contradiction, clarification, completion, warning,
 * error, etc.) and preserves useful metadata through the rendering pipeline.
 *
 * Step 7.4 kept rendering intentionally minimal; Step 8.3 adds structured
 * metadata extraction for conversational advancement while keeping product
 * decisions in Core.
 */

import type { CoreResult } from '../../core/index.js';
import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import type {
	LogosPiCommandContext,
	LogosPiEventContext,
} from '../pi-types.js';

export type RenderCoreResultInput = {
	deps: LogosPiExtensionDependencies;
	ctx: LogosPiCommandContext | LogosPiEventContext;
	result: CoreResult<unknown>;
};

// ---------------------------------------------------------------------------
// LogosRenderedMessage — adapter-level presentation payload
// ---------------------------------------------------------------------------

/**
 * Adapter-level presentation payload extracted from a Core result.
 *
 * This type is Pi adapter presentation data only:
 * - It must not be imported by Core.
 * - It must not replace Core result contracts.
 * - It must be serializable.
 * - It must not contain raw errors or provider output.
 */
export type LogosRenderedMessage = {
	type: 'logos';
	kind: string;
	body: string;
	title?: string | undefined;
	questionId?: string | undefined;
	followUpId?: string | undefined;
	contradictionId?: string | undefined;
	phaseId?: string | undefined;
	documentId?: string | undefined;
	sectionId?: string | undefined;
	metadata?: Record<string, unknown>;
	blockers?: unknown[];
	warnings?: unknown[];
	rawResult: CoreResult<unknown>;
};

type NotifyType = 'info' | 'warning' | 'error';

type MinimalUiNotify = {
	notify(message: string, type?: NotifyType): void;
};

function notifyTypeForResult(result: CoreResult<unknown>): NotifyType {
	if (
		result.status === 'blocked' ||
		result.status === 'failed' ||
		result.message.kind === 'error'
	) {
		return 'error';
	}

	if (
		result.status === 'confirmation_required' ||
		result.message.kind === 'warning' ||
		result.message.kind === 'confirmation_request'
	) {
		return 'warning';
	}

	return 'info';
}

function getNotify(
	ctx: LogosPiCommandContext | LogosPiEventContext,
): MinimalUiNotify['notify'] | undefined {
	const maybeCtx = ctx as unknown as { ui?: Partial<MinimalUiNotify> };
	return typeof maybeCtx.ui?.notify === 'function'
		? maybeCtx.ui.notify.bind(maybeCtx.ui)
		: undefined;
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

/**
 * Extract a structured {@link LogosRenderedMessage} from a Core result.
 *
 * Preserves message.kind, message.body, and useful metadata from the
 * Core result (including `result.data.assistantMessage`, `result.data.activePrompt`,
 * and `result.data.activeQuestionId`) without making product decisions or
 * mutating the Core result.
 */
export function extractRenderedMessage(
	result: CoreResult<unknown>,
): LogosRenderedMessage {
	const data = result.data as Record<string, unknown> | undefined;

	// assistantMessage carries questionId and other per-message metadata.
	const assistant = data?.assistantMessage as
		| { questionId?: unknown; metadata?: Record<string, unknown> }
		| undefined;

	// activePrompt carries followUpId, contradictionId, and phase/doc/section context.
	const activePrompt = data?.activePrompt as
		| {
				followUpId?: unknown;
				contradictionId?: unknown;
				phaseId?: unknown;
				documentId?: unknown;
				sectionId?: unknown;
		  }
		| undefined;

	const questionId =
		typeof assistant?.questionId === 'string'
			? assistant.questionId
			: typeof data?.activeQuestionId === 'string'
				? data.activeQuestionId
				: undefined;

	const followUpId =
		typeof activePrompt?.followUpId === 'string'
			? activePrompt.followUpId
			: undefined;

	const contradictionId =
		typeof activePrompt?.contradictionId === 'string'
			? activePrompt.contradictionId
			: undefined;

	const phaseId =
		typeof activePrompt?.phaseId === 'string'
			? activePrompt.phaseId
			: undefined;

	const documentId =
		typeof activePrompt?.documentId === 'string'
			? activePrompt.documentId
			: undefined;

	const sectionId =
		typeof activePrompt?.sectionId === 'string'
			? activePrompt.sectionId
			: undefined;

	return {
		body: result.message.body,
		kind: result.message.kind,
		type: 'logos',
		...(result.message.title !== undefined
			? { title: result.message.title }
			: {}),
		...(questionId !== undefined ? { questionId } : {}),
		...(followUpId !== undefined ? { followUpId } : {}),
		...(contradictionId !== undefined ? { contradictionId } : {}),
		...(phaseId !== undefined ? { phaseId } : {}),
		...(documentId !== undefined ? { documentId } : {}),
		...(sectionId !== undefined ? { sectionId } : {}),
		...(result.message.metadata !== undefined
			? { metadata: result.message.metadata }
			: {}),
		...(result.blockers.length > 0 ? { blockers: [...result.blockers] } : {}),
		...(result.warnings.length > 0 ? { warnings: [...result.warnings] } : {}),
		rawResult: result,
	};
}

// ---------------------------------------------------------------------------
// Render boundary
// ---------------------------------------------------------------------------

export async function renderCoreResult(
	input: RenderCoreResultInput,
): Promise<void> {
	if (input.deps.renderCoreResult !== undefined) {
		await input.deps.renderCoreResult(input.result, input.ctx);
		return;
	}

	const rendered = extractRenderedMessage(input.result);

	if (typeof input.deps.pi.sendMessage === 'function') {
		input.deps.pi.sendMessage({
			content: rendered.body,
			customType: 'logos-core-result',
			details: rendered,
			display: true,
		});
		return;
	}

	const notify = getNotify(input.ctx);
	if (notify !== undefined) {
		notify(rendered.body, notifyTypeForResult(input.result));
	}
}
