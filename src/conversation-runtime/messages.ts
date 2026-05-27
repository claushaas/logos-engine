/**
 * Node-scoped message management — append, retrieve, and inspect messages
 * within a node's conversation.
 *
 * All functions are pure: they return new `LogosRuntimeState` objects
 * (wrapped in `StateEngineResult`) and never mutate the input state.
 *
 * These helpers are consumed by the state engine's `dispatch()` and the
 * prompt orchestrator. They are the fundamental data container for all
 * user and agent interactions.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §4-5}
 */
import type {
	LogosRuntimeState,
	NodeMessage,
	NodeMessageMetadata,
	NodeMessageRole,
} from '../contracts/index.js';
import type { NodeId } from '../shared/index.js';
import { generateId, nowIso } from '../shared/index.js';
import type { StateEngineResult } from '../state-engine/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Result types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alias for `StateEngineResult` — the canonical result type for all
 * state-mutating operations in the engine.
 *
 * Imported as a type-only reference to avoid a runtime dependency on
 * `@logos/state-engine` while preserving API alignment.
 */
export type ConversationResult = StateEngineResult;

/**
 * Internal diagnostic shape — structurally compatible with
 * `RuntimeDiagnostic` and `StateDiagnostic`.
 */
type ConvDiag = {
	readonly code: string;
	readonly message: string;
	readonly severity: 'info' | 'warning' | 'error';
	readonly sourceId?: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic codes
// ═══════════════════════════════════════════════════════════════════════════

const DIAG_NOT_NODE_FOCUS = 'LOGOS_CONV_NOT_NODE_FOCUS';
const DIAG_NODE_MISMATCH = 'LOGOS_CONV_NODE_MISMATCH';
const DIAG_NODE_NOT_FOUND = 'LOGOS_CONV_NODE_NOT_FOUND';
const DIAG_MISSING_PROMPT_ID = 'LOGOS_CONV_MISSING_PROMPT_ID';
const DIAG_MISSING_PROMPT_STATE = 'LOGOS_CONV_MISSING_PROMPT_STATE';
const DIAG_MISSING_STRUCTURED_OUTPUT_ID =
	'LOGOS_CONV_MISSING_STRUCTURED_OUTPUT_ID';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Common guard for all append operations.
 *
 * Rejects when:
 * - The session is not in `node_focus` mode.
 * - The requested `nodeId` is not the active node.
 * - The node has no runtime state.
 *
 * Returns `null` on success (guard passes); returns an error `ConversationResult`
 * otherwise.
 */
function guardAppendTarget(
	state: LogosRuntimeState,
	nodeId: NodeId,
): StateEngineResult | null {
	if (state.mode !== 'node_focus') {
		return convErr(
			`Cannot append message: session mode is "${state.mode}", not "node_focus".`,
			[
				convDiag(
					DIAG_NOT_NODE_FOCUS,
					'Messages can only be appended in node-focused mode.',
					'error',
				),
			],
		);
	}

	if (state.activeNodeId !== nodeId) {
		return convErr(
			`Cannot append message: node "${nodeId}" is not the active node ("${state.activeNodeId ?? 'null'}").`,
			[
				convDiag(
					DIAG_NODE_MISMATCH,
					`Requested node "${nodeId}" does not match active node "${state.activeNodeId ?? 'null'}".`,
					'error',
					nodeId,
				),
			],
		);
	}

	const nodeState = state.nodeStates[nodeId];
	if (!nodeState) {
		return convErr(
			`Cannot append message: node "${nodeId}" has no runtime state.`,
			[
				convDiag(
					DIAG_NODE_NOT_FOUND,
					`Node "${nodeId}" has no runtime state. Select a node first.`,
					'error',
					nodeId,
				),
			],
		);
	}

	return null;
}

/**
 * Create a success `ConversationResult`.
 */
function convOk(state: LogosRuntimeState): StateEngineResult {
	return { ok: true, state };
}

/**
 * Create a failed `ConversationResult`.
 */
function convErr(
	error: string,
	diagnostics: ConvDiag[] = [],
): StateEngineResult {
	return { diagnostics, error, ok: false };
}

/**
 * Create a single diagnostic entry.
 */
function convDiag(
	code: string,
	message: string,
	severity: 'info' | 'warning' | 'error' = 'error',
	sourceId?: string,
): ConvDiag {
	return sourceId !== undefined
		? { code, message, severity, sourceId }
		: { code, message, severity };
}

// ═══════════════════════════════════════════════════════════════════════════
// Append operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Append a user message to the active node's conversation.
 *
 * Guards:
 * - The session must be in `node_focus` mode.
 * - `nodeId` must match `state.activeNodeId`.
 * - The node must exist in `state.nodeStates`.
 *
 * Side effects on the returned state:
 * - The message is appended to `nodeStates[nodeId].conversation`.
 * - `nodeStates[nodeId].lastUserMessageId` is updated.
 * - `updatedAt` is refreshed on both the node state and the root state.
 *
 * @param state  The current runtime state (not mutated).
 * @param nodeId The node to append to (must be the active node).
 * @param content The message body.
 * @returns A `ConversationResult` with the updated state on success.
 */
export function appendUserMessage(
	state: LogosRuntimeState,
	nodeId: NodeId,
	content: string,
): ConversationResult {
	const guardErr = guardAppendTarget(state, nodeId);
	if (guardErr) return guardErr;

	// At this point guardAppendTarget ensures nodeStates[nodeId] exists
	const existingNode = state.nodeStates[nodeId]!;

	const messageId = generateId();
	const now = nowIso();

	const message: NodeMessage = {
		content,
		createdAt: now,
		id: messageId,
		role: 'user' as NodeMessageRole,
	};

	const updatedNode = {
		...existingNode,
		conversation: [...existingNode.conversation, message],
		lastUserMessageId: messageId,
		updatedAt: now,
	};

	const newState: LogosRuntimeState = {
		...state,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: updatedNode,
		},
		updatedAt: now,
	};

	return convOk(newState);
}

/**
 * Append an assistant message to the active node's conversation.
 *
 * Guards:
 * - The session must be in `node_focus` mode.
 * - `nodeId` must match `state.activeNodeId`.
 * - The node must exist in `state.nodeStates`.
 * - `metadata` must include non-empty `promptId`, `promptState`, and
 *   `structuredOutputId` (runtime validation).
 *
 * Side effects on the returned state:
 * - The message is appended to `nodeStates[nodeId].conversation`.
 * - `nodeStates[nodeId].lastAssistantMessageId` is updated.
 * - `updatedAt` is refreshed on both the node state and the root state.
 *
 * @param state    The current runtime state (not mutated).
 * @param nodeId   The node to append to (must be the active node).
 * @param content  The message body.
 * @param metadata Attribution metadata — must include `promptId`,
 *                 `promptState`, and `structuredOutputId`.
 * @returns A `ConversationResult` with the updated state on success.
 */
export function appendAssistantMessage(
	state: LogosRuntimeState,
	nodeId: NodeId,
	content: string,
	metadata: NodeMessageMetadata,
): ConversationResult {
	const guardErr = guardAppendTarget(state, nodeId);
	if (guardErr) return guardErr;

	// Runtime guard: assistant messages require promptId.
	// (`PromptId` is a branded string type — a defined value is
	// guaranteed non-empty by the type system.)
	if (!metadata.promptId) {
		return convErr(
			'Assistant message metadata must include a `promptId`.',
			[
				convDiag(
					DIAG_MISSING_PROMPT_ID,
					'Assistant messages must record the prompt ID that produced them.',
					'error',
					nodeId,
				),
			],
		);
	}

	// Runtime guard: assistant messages require promptState.
	// (`PromptState` is a union of non-empty string literals, so
	// a defined value is guaranteed non-empty by the type system.)
	if (!metadata.promptState) {
		return convErr(
			'Assistant message metadata must include a `promptState`.',
			[
				convDiag(
					DIAG_MISSING_PROMPT_STATE,
					'Assistant messages must record the prompt state at generation time.',
					'error',
					nodeId,
				),
			],
		);
	}

	// Runtime guard: assistant messages require structuredOutputId.
	if (!metadata.structuredOutputId || metadata.structuredOutputId === '') {
		return convErr(
			'Assistant message metadata must include a non-empty `structuredOutputId`.',
			[
				convDiag(
					DIAG_MISSING_STRUCTURED_OUTPUT_ID,
					'Assistant messages must link to the structured LLM output record.',
					'error',
					nodeId,
				),
			],
		);
	}

	// At this point guardAppendTarget ensures nodeStates[nodeId] exists
	const existingNode = state.nodeStates[nodeId]!;

	const messageId = generateId();
	const now = nowIso();

	const message: NodeMessage = {
		content,
		createdAt: now,
		id: messageId,
		metadata,
		role: 'assistant' as NodeMessageRole,
	};

	const updatedNode = {
		...existingNode,
		conversation: [...existingNode.conversation, message],
		lastAssistantMessageId: messageId,
		updatedAt: now,
	};

	const newState: LogosRuntimeState = {
		...state,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: updatedNode,
		},
		updatedAt: now,
	};

	return convOk(newState);
}

/**
 * Append a system message to the active node's conversation.
 *
 * System messages are internal and should not normally be rendered
 * as chat messages in the TUI.
 *
 * Guards:
 * - The session must be in `node_focus` mode.
 * - `nodeId` must match `state.activeNodeId`.
 * - The node must exist in `state.nodeStates`.
 *
 * Note: system messages do not update `lastUserMessageId` or
 * `lastAssistantMessageId`.
 *
 * @param state  The current runtime state (not mutated).
 * @param nodeId The node to append to (must be the active node).
 * @param content The message body.
 * @returns A `ConversationResult` with the updated state on success.
 */
export function appendSystemMessage(
	state: LogosRuntimeState,
	nodeId: NodeId,
	content: string,
): ConversationResult {
	const guardErr = guardAppendTarget(state, nodeId);
	if (guardErr) return guardErr;

	// At this point guardAppendTarget ensures nodeStates[nodeId] exists
	const existingNode = state.nodeStates[nodeId]!;

	const messageId = generateId();
	const now = nowIso();

	const message: NodeMessage = {
		content,
		createdAt: now,
		id: messageId,
		role: 'system' as NodeMessageRole,
	};

	const updatedNode = {
		...existingNode,
		conversation: [...existingNode.conversation, message],
		updatedAt: now,
	};

	const newState: LogosRuntimeState = {
		...state,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: updatedNode,
		},
		updatedAt: now,
	};

	return convOk(newState);
}

// ═══════════════════════════════════════════════════════════════════════════
// Query operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return the full conversation for a node in chronological order.
 *
 * Messages are sorted by `createdAt` ascending (earliest first), with
 * `id` as a tiebreaker for messages created in the same millisecond.
 *
 * Returns an empty array for missing nodes — this function never throws
 * and never returns an error.
 *
 * @param state  The current runtime state.
 * @param nodeId The node to query.
 * @returns A new array of messages in chronological order.
 */
export function getConversation(
	state: LogosRuntimeState,
	nodeId: NodeId,
): NodeMessage[] {
	const nodeState = state.nodeStates[nodeId];
	if (!nodeState) return [];

	const messages = [...nodeState.conversation];

	// Sort chronologically by createdAt, then by id as tiebreaker.
	messages.sort((a, b) => {
		const dateCmp = a.createdAt.localeCompare(b.createdAt);
		if (dateCmp !== 0) return dateCmp;
		return a.id.localeCompare(b.id);
	});

	return messages;
}

/**
 * Return the most recent messages for a node, up to `limit`.
 *
 * Delegates to `getConversation` for ordering. Returns the last `limit`
 * messages in chronological order (earliest of the limited set first).
 *
 * - `limit <= 0` returns `[]`.
 * - Missing node returns `[]`.
 *
 * @param state  The current runtime state.
 * @param nodeId The node to query.
 * @param limit  Maximum number of messages to return.
 * @returns A new array with at most `limit` messages, chronologically ordered.
 */
export function getRecentMessages(
	state: LogosRuntimeState,
	nodeId: NodeId,
	limit: number,
): NodeMessage[] {
	if (limit <= 0) return [];

	const all = getConversation(state, nodeId);
	if (all.length <= limit) return all;

	return all.slice(all.length - limit);
}
