/**
 * LOGOS Pi Extension — Assistant message renderer (Step 9.1).
 *
 * Pure rendering function that maps a Core {@link AssistantMessage} into
 * a Pi-adapter {@link LogosRenderedMessage}.  No Core APIs, no Pi runtime
 * calls, no filesystem access, no state mutation.
 *
 * Boundary:
 * - Imports only public Core types (`AssistantMessage`).
 * - Must not import Core internals.
 * - Must not import Pi runtime values.
 * - Must not import CLI/TUI/Ink/React.
 */

import type { AssistantMessage } from '../../core/index.js';
import type { LogosRenderedMessage } from './render-core-result.js';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export type RenderAssistantMessageInput = {
	message: AssistantMessage;
	blockers?: unknown[];
	warnings?: unknown[];
};

// ---------------------------------------------------------------------------
// Kind → title mapping
// ---------------------------------------------------------------------------

const KIND_TITLES: Record<string, string> = {
	clarification: 'LOGOS clarification',
	completion: 'LOGOS complete',
	confirmation_request: 'LOGOS confirmation required',
	contradiction: 'LOGOS contradiction',
	error: 'LOGOS error',
	follow_up: 'LOGOS follow-up',
	generation_result: 'LOGOS generation result',
	question: 'LOGOS question',
	status: 'LOGOS status',
	warning: 'LOGOS warning',
};

const DEFAULT_TITLE = 'LOGOS message';

// ---------------------------------------------------------------------------
// Public renderer
// ---------------------------------------------------------------------------

/**
 * Render a Core {@link AssistantMessage} as a Pi-adapter
 * {@link LogosRenderedMessage}.
 *
 * This function is **pure** and **deterministic**:
 * - It does not call Core APIs.
 * - It does not call Pi runtime methods.
 * - It does not access the filesystem.
 * - It does not mutate its input.
 * - It does not select prompts, evaluate answers, or decide advancement.
 *
 * @param input.message - The Core assistant message to render.
 * @param input.blockers - Optional blockers to preserve in the rendered payload.
 * @param input.warnings - Optional warnings to preserve in the rendered payload.
 * @returns A structured {@link LogosRenderedMessage} ready for Pi delivery.
 */
export function renderAssistantMessage(
	input: RenderAssistantMessageInput,
): LogosRenderedMessage {
	const { message, blockers, warnings } = input;

	const title = message.title ?? KIND_TITLES[message.kind] ?? DEFAULT_TITLE;

	const rendered: LogosRenderedMessage = {
		body: message.body,
		kind: message.kind,
		title,
		type: 'logos',
	};

	// ---- preserve questionId on the rendered payload ----
	if (message.questionId !== undefined) {
		rendered.questionId = message.questionId;
	}

	// ---- preserve Core metadata opaque bag ----
	if (message.metadata !== undefined) {
		// Shallow-copy to avoid mutating the original.
		rendered.metadata = { ...message.metadata };
	}

	// ---- preserve blockers when supplied ----
	if (blockers !== undefined && blockers.length > 0) {
		rendered.blockers = [...blockers];
	}

	// ---- preserve warnings when supplied ----
	if (warnings !== undefined && warnings.length > 0) {
		rendered.warnings = [...warnings];
	}

	return rendered;
}
