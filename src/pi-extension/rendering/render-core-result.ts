/**
 * LOGOS Pi Extension — Core result rendering boundary (Steps 8.3, 9.2).
 *
 * Handles rendering of conversational advancement results returned by
 * `core.handleIntakeMessage(...)`.  Supports all Core assistant message kinds
 * (question, follow_up, contradiction, clarification, completion, warning,
 * error, etc.) and preserves useful metadata through the rendering pipeline.
 *
 * Step 7.4 kept rendering intentionally minimal; Step 8.3 adds structured
 * metadata extraction for conversational advancement while keeping product
 * decisions in Core.
 *
 * Step 9.2 adds routing to specialized status and generation blocker
 * renderers when Core result data contains progress or preflight shapes.
 */

import type { CoreResult } from '../../core/index.js';
import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import type {
	LogosPiCommandContext,
	LogosPiEventContext,
} from '../pi-types.js';
import { renderGenerationBlockers } from './generation-blocker-renderer.js';
import { renderGenerationResult } from './generation-result-renderer.js';
import { renderStatus } from './status-renderer.js';

export type RenderCoreResultInput = {
	deps: LogosPiExtensionDependencies;
	ctx: LogosPiCommandContext | LogosPiEventContext;
	result: CoreResult<unknown>;
};

// ---------------------------------------------------------------------------
// LogosRenderedMessage — adapter-level presentation payload
// ---------------------------------------------------------------------------

/**
 * Known LOGOS rendered message kinds.
 *
 * Mirrors the Core {@link AssistantMessageKind} set from a presentation
 * perspective.  Unknown future kinds are represented by plain `string`.
 */
export type LogosRenderedMessageKind =
	| 'question'
	| 'follow_up'
	| 'clarification'
	| 'contradiction'
	| 'status'
	| 'warning'
	| 'error'
	| 'generation_result'
	| 'confirmation_request'
	| 'completion';

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
	kind: LogosRenderedMessageKind | string;
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
	rawResult?: CoreResult<unknown> | undefined;
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

function fallbackBlockerBody(result: CoreResult<unknown>): string | undefined {
	if (result.message.body.length > 0) return undefined;
	if (result.blockers.length === 0) return undefined;
	return 'LOGOS could not continue because blockers were returned by Core.';
}

/**
 * Detect whether Core result data carries generation result content
 * (i.e. generation has already run and produced output/path data).
 *
 * Distinct from preflight-only data: requires actual write-plan
 * operations, non-empty generated paths, or confirmed writes.
 */
function hasGenerationResultData(data: unknown): boolean {
	if (data === null || data === undefined) return false;
	if (typeof data !== 'object') return false;
	const d = data as Record<string, unknown>;

	// Strong signal: files were actually written.
	if (d.wroteFiles === true) return true;

	// Strong signal: non-empty generated paths.
	if (Array.isArray(d.generatedPaths) && d.generatedPaths.length > 0) {
		return true;
	}

	// Write plan with actual operations (post-preflight).
	if (
		'writePlan' in d &&
		d.writePlan !== null &&
		typeof d.writePlan === 'object'
	) {
		const wp = d.writePlan as Record<string, unknown>;
		if (
			'operations' in wp &&
			Array.isArray(wp.operations) &&
			wp.operations.length > 0
		) {
			return true;
		}
	}

	return false;
}

/**
 * Detect whether Core result data carries generation preflight content.
 */
function hasGenerationData(data: unknown): boolean {
	if (data === null || data === undefined) return false;
	if (typeof data !== 'object') return false;
	const d = data as Record<string, unknown>;
	// Check for preflight sub-object or top-level preflight-like shape.
	if (d.preflight !== undefined) return true;
	// Check for generation-specific fields.
	if ('generationMode' in d) return true;
	if ('writePlan' in d) return true;
	return false;
}

/**
 * Detect whether Core result data carries status/progress content.
 */
function hasStatusData(data: unknown): boolean {
	if (data === null || data === undefined) return false;
	if (typeof data !== 'object') return false;
	const d = data as Record<string, unknown>;
	// Check for progress sub-object.
	if (d.progress !== undefined && typeof d.progress === 'object') return true;
	// Check for generationReadiness which is status-specific.
	if (d.generationReadiness !== undefined) return true;
	// Check for mode + initialized combo (status result).
	if ('initialized' in d && 'mode' in d) return true;
	return false;
}

/**
 * Route a Core result through the appropriate specialized renderer when
 * recognizable data shapes are present, then produce a
 * {@link LogosRenderedMessage}.
 */
function routeToSpecializedRenderer(
	result: CoreResult<unknown>,
): LogosRenderedMessage | undefined {
	const data = result.data as Record<string, unknown> | undefined;

	// ---- Generation result data (post-generation paths, write plan with ops) --
	if (data !== undefined && hasGenerationResultData(data)) {
		return renderGenerationResult({
			blockers: result.blockers,
			changedPaths: result.changedPaths,
			data,
			message: result.message,
			warnings: result.warnings,
		});
	}

	// ---- Generation / preflight data → use generation blocker renderer ---
	if (data !== undefined && hasGenerationData(data)) {
		const preflight = data.preflight;
		return renderGenerationBlockers({
			blockers: result.blockers,
			generation: data,
			message: result.message,
			preflight,
			warnings: result.warnings,
		});
	}

	// Status / progress data → use status renderer.
	if (data !== undefined && hasStatusData(data)) {
		return renderStatus({
			blockers: result.blockers,
			data,
			message: result.message,
			warnings: result.warnings,
		});
	}

	// Error or warning with blockers that look generation-related.
	if (
		(result.message.kind === 'error' || result.message.kind === 'warning') &&
		result.blockers.length > 0
	) {
		// Check if any blocker code matches known generation blocker codes.
		const generationCodes = [
			'project_not_initialized',
			'profile_not_found',
			'profile_invalid',
			'intake_state_missing',
			'question_registry_empty',
			'missing_critical_questions',
			'partial_critical_questions',
			'unresolved_contradictions',
			'required_questions_skipped',
			'unsafe_output_path',
			'overwrite_risk',
			'manual_edit_risk',
		];
		const hasGenBlocker = result.blockers.some(
			(b) =>
				b !== null &&
				typeof b === 'object' &&
				typeof (b as Record<string, unknown>).code === 'string' &&
				generationCodes.includes((b as Record<string, unknown>).code as string),
		);
		if (hasGenBlocker) {
			return renderGenerationBlockers({
				blockers: result.blockers,
				message: result.message,
				warnings: result.warnings,
			});
		}
	}

	return undefined;
}

export async function renderCoreResult(
	input: RenderCoreResultInput,
): Promise<void> {
	if (input.deps.renderCoreResult !== undefined) {
		await input.deps.renderCoreResult(input.result, input.ctx);
		return;
	}

	// Try specialized renderer first (status, generation blockers).
	const specialized = routeToSpecializedRenderer(input.result);

	// Fall back to generic extractRenderedMessage when no specialized match.
	const rendered = specialized ?? extractRenderedMessage(input.result);

	// Fallback body when blockers exist but the message body is empty.
	const fallbackBody = fallbackBlockerBody(input.result);
	if (fallbackBody !== undefined) {
		rendered.body = fallbackBody;
	}

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
