/**
 * Canonical answer management — create, accept, mark stale, and regenerate
 * canonical answers for node conversations.
 *
 * Canonical answers are the clean, synthesised output of a node's conversation.
 * They are stored separately from raw messages, tracked for staleness, and
 * linked to source messages via `generatedFromMessageIds`.
 *
 * All functions are pure: they return new `LogosRuntimeState` objects
 * (wrapped in `StateEngineResult`) and never mutate the input state.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §8-9}
 * @see {@link https://logos-engine/docs/06-agent-turn-contract.md §5}
 */
import type {
	CanonicalAnswer,
	CanonicalAnswerDraft,
	LogosRuntimeState,
	NodeLifecycle,
} from '../contracts/index.js';
import type { NodeId } from '../shared/index.js';
import { nowIso } from '../shared/index.js';
import type { StateEngineResult } from '../state-engine/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Result helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Alias for `StateEngineResult` — the canonical result type. */
export type CanonicalAnswerResult = StateEngineResult;

/** Internal diagnostic shape. */
type CaDiag = {
	readonly code: string;
	readonly message: string;
	readonly severity: 'info' | 'warning' | 'error';
	readonly sourceId?: string;
};

function caOk(state: LogosRuntimeState): StateEngineResult {
	return { ok: true, state };
}

function caErr(error: string, diagnostics: CaDiag[] = []): StateEngineResult {
	return { diagnostics, error, ok: false };
}

function caDiag(
	code: string,
	message: string,
	severity: 'info' | 'warning' | 'error' = 'error',
	sourceId?: string,
): CaDiag {
	return sourceId !== undefined
		? { code, message, severity, sourceId }
		: { code, message, severity };
}

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic codes
// ═══════════════════════════════════════════════════════════════════════════

const DIAG_NODE_NOT_FOUND = 'LOGOS_CA_NODE_NOT_FOUND';
const DIAG_WRONG_LIFECYCLE_FOR_DRAFT = 'LOGOS_CA_WRONG_LIFECYCLE_FOR_DRAFT';
const DIAG_WRONG_LIFECYCLE_FOR_ACCEPT = 'LOGOS_CA_WRONG_LIFECYCLE_FOR_ACCEPT';
const DIAG_NO_CANONICAL_ANSWER = 'LOGOS_CA_NO_CANONICAL_ANSWER';
const DIAG_WRONG_LIFECYCLE_FOR_REGENERATE =
	'LOGOS_CA_WRONG_LIFECYCLE_FOR_REGENERATE';

// ═══════════════════════════════════════════════════════════════════════════
// Guard helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Guard: the node must exist in `state.nodeStates`.
 *
 * Returns `null` on pass, error `StateEngineResult` on fail.
 */
function guardNodeExists(
	state: LogosRuntimeState,
	nodeId: NodeId,
): StateEngineResult | null {
	if (!state.nodeStates[nodeId]) {
		return caErr(
			`Cannot operate on canonical answer: node "${nodeId}" has no runtime state.`,
			[
				caDiag(
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
 * Guard: the node lifecycle must be one of the allowed lifecycles for
 * drafting a canonical answer (`ready_for_synthesis` or `synthesized`).
 *
 * Returns `null` on pass, error `StateEngineResult` on fail.
 */
function guardLifecycleForDraft(
	lifecycle: NodeLifecycle,
	nodeId: NodeId,
): StateEngineResult | null {
	const allowed: NodeLifecycle[] = ['ready_for_synthesis', 'synthesized'];
	if (!allowed.includes(lifecycle)) {
		return caErr(
			`Cannot set canonical answer draft: lifecycle is "${lifecycle}", must be "ready_for_synthesis" or "synthesized".`,
			[
				caDiag(
					DIAG_WRONG_LIFECYCLE_FOR_DRAFT,
					`Canonical answer drafts can only be set during "ready_for_synthesis" or "synthesized" lifecycles.`,
					'error',
					nodeId,
				),
			],
		);
	}
	return null;
}

/**
 * Guard: the node lifecycle must be exactly `synthesized` (for accept).
 *
 * Returns `null` on pass, error `StateEngineResult` on fail.
 */
function guardLifecycleForAccept(
	lifecycle: NodeLifecycle,
	nodeId: NodeId,
): StateEngineResult | null {
	if (lifecycle !== 'synthesized') {
		return caErr(
			`Cannot accept canonical answer: lifecycle is "${lifecycle}", must be "synthesized".`,
			[
				caDiag(
					DIAG_WRONG_LIFECYCLE_FOR_ACCEPT,
					'Canonical answers can only be accepted when the node is in "synthesized" lifecycle.',
					'error',
					nodeId,
				),
			],
		);
	}
	return null;
}

/**
 * Guard: the node must have an existing canonical answer.
 *
 * Returns `null` on pass, error `StateEngineResult` on fail.
 */
function guardHasCanonicalAnswer(
	nodeId: NodeId,
	canonicalAnswer: CanonicalAnswer | null,
): StateEngineResult | null {
	if (!canonicalAnswer) {
		return caErr(
			`Cannot operate on canonical answer: node "${nodeId}" has no canonical answer.`,
			[
				caDiag(
					DIAG_NO_CANONICAL_ANSWER,
					`Node "${nodeId}" has no canonical answer to accept / mark stale / regenerate.`,
					'error',
					nodeId,
				),
			],
		);
	}
	return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Set a canonical answer draft on the node.
 *
 * Converts a `CanonicalAnswerDraft` (proposed by the LLM) into a
 * `CanonicalAnswer` with `accepted: false` and `stale: false`.
 * The draft's `generatedAt` and `generatedFromMessageIds` are preserved.
 *
 * Guards:
 * - The node must exist in `state.nodeStates`.
 * - The node lifecycle must be `ready_for_synthesis` or `synthesized`.
 *
 * Side effects on the returned state:
 * - `nodeStates[nodeId].canonicalAnswer` is set to the new answer.
 * - `updatedAt` is refreshed on both the node state and the root state.
 * - Node lifecycle is NOT mutated — the caller is responsible for lifecycle
 *   transitions (e.g., via `applyLifecycleTransition`).
 *
 * @param state  The current runtime state (not mutated).
 * @param nodeId The node to set the draft on.
 * @param draft  The draft canonical answer from the LLM.
 * @returns A `CanonicalAnswerResult` with the updated state on success.
 */
export function setCanonicalAnswerDraft(
	state: LogosRuntimeState,
	nodeId: NodeId,
	draft: CanonicalAnswerDraft,
): CanonicalAnswerResult {
	const nodeErr = guardNodeExists(state, nodeId);
	if (nodeErr) return nodeErr;

	// After guardNodeExists, we know nodeStates[nodeId] exists
	// biome-ignore lint/style/noNonNullAssertion: guarded above
	const existingNode = state.nodeStates[nodeId]!;

	const lcErr = guardLifecycleForDraft(existingNode.lifecycle, nodeId);
	if (lcErr) return lcErr;

	const now = nowIso();

	const canonicalAnswer: CanonicalAnswer = {
		accepted: false,
		confidence: draft.confidence,
		content: draft.content,
		format: draft.format,
		generatedAt: draft.generatedAt,
		generatedFromMessageIds: draft.generatedFromMessageIds,
		stale: false,
	};

	const updatedNode = {
		...existingNode,
		canonicalAnswer,
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

	return caOk(newState);
}

/**
 * Accept the canonical answer for a node.
 *
 * Sets `accepted: true`, `stale: false`, and records `acceptedAt`.
 *
 * Guards:
 * - The node must exist in `state.nodeStates`.
 * - The node lifecycle must be exactly `synthesized`.
 * - The node must have an existing canonical answer.
 *
 * Side effects on the returned state:
 * - `nodeStates[nodeId].canonicalAnswer.accepted` → `true`
 * - `nodeStates[nodeId].canonicalAnswer.stale` → `false`
 * - `nodeStates[nodeId].canonicalAnswer.acceptedAt` is set.
 * - `updatedAt` is refreshed on both the node state and the root state.
 * - Node lifecycle is NOT mutated — the caller is responsible for lifecycle
 *   transitions (e.g., via `applyLifecycleTransition`).
 *
 * @param state  The current runtime state (not mutated).
 * @param nodeId The node whose canonical answer to accept.
 * @returns A `CanonicalAnswerResult` with the updated state on success.
 */
export function acceptCanonicalAnswer(
	state: LogosRuntimeState,
	nodeId: NodeId,
): CanonicalAnswerResult {
	const nodeErr = guardNodeExists(state, nodeId);
	if (nodeErr) return nodeErr;

	// biome-ignore lint/style/noNonNullAssertion: guarded above
	const existingNode = state.nodeStates[nodeId]!;

	const lcErr = guardLifecycleForAccept(existingNode.lifecycle, nodeId);
	if (lcErr) return lcErr;

	const caErr_ = guardHasCanonicalAnswer(nodeId, existingNode.canonicalAnswer);
	if (caErr_) return caErr_;

	const now = nowIso();

	const updatedAnswer: CanonicalAnswer = {
		// biome-ignore lint/style/noNonNullAssertion: guarded above
		...existingNode.canonicalAnswer!,
		accepted: true,
		acceptedAt: now,
		stale: false,
	};

	const updatedNode = {
		...existingNode,
		canonicalAnswer: updatedAnswer,
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

	return caOk(newState);
}

/**
 * Mark the canonical answer for a node as stale.
 *
 * A stale answer must not be used for final export without regeneration
 * or explicit user re-acceptance.
 *
 * Guards:
 * - The node must exist in `state.nodeStates`.
 *
 * If no canonical answer exists, the operation is idempotent — it returns
 * success with the state unchanged.
 *
 * Side effects on the returned state:
 * - `nodeStates[nodeId].canonicalAnswer.stale` → `true` (if answer exists).
 * - `nodeStates[nodeId].canonicalAnswer.accepted` is preserved.
 * - `updatedAt` is refreshed on both the node state and the root state.
 *
 * @param state  The current runtime state (not mutated).
 * @param nodeId The node whose canonical answer to mark stale.
 * @returns A `CanonicalAnswerResult` with the updated state on success.
 */
export function markCanonicalAnswerStale(
	state: LogosRuntimeState,
	nodeId: NodeId,
): CanonicalAnswerResult {
	const nodeErr = guardNodeExists(state, nodeId);
	if (nodeErr) return nodeErr;

	// biome-ignore lint/style/noNonNullAssertion: guarded above
	const existingNode = state.nodeStates[nodeId]!;

	// Idempotent: if no canonical answer, return success unchanged.
	if (!existingNode.canonicalAnswer) {
		return caOk(state);
	}

	const now = nowIso();

	const updatedAnswer: CanonicalAnswer = {
		...existingNode.canonicalAnswer,
		stale: true,
	};

	const updatedNode = {
		...existingNode,
		canonicalAnswer: updatedAnswer,
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

	return caOk(newState);
}

/**
 * Regenerate a canonical answer — mark the existing answer as stale
 * so the caller can subsequently call `setCanonicalAnswerDraft` with a
 * replacement.
 *
 * Regeneration happens during `synthesized` state when the user requests
 * Edit or Regenerate on a draft answer. The old answer is preserved
 * for audit but marked stale; a new `setCanonicalAnswerDraft` call
 * replaces it.
 *
 * Guards:
 * - The node must exist in `state.nodeStates`.
 * - The node lifecycle must be exactly `synthesized`.
 * - The node must have an existing canonical answer.
 *
 * Side effects on the returned state:
 * - `nodeStates[nodeId].canonicalAnswer.stale` → `true`.
 * - `updatedAt` is refreshed on both the node state and the root state.
 *
 * @param state  The current runtime state (not mutated).
 * @param nodeId The node whose canonical answer to regenerate.
 * @returns A `CanonicalAnswerResult` with the updated state on success.
 */
export function regenerateCanonicalAnswer(
	state: LogosRuntimeState,
	nodeId: NodeId,
): CanonicalAnswerResult {
	const nodeErr = guardNodeExists(state, nodeId);
	if (nodeErr) return nodeErr;

	// biome-ignore lint/style/noNonNullAssertion: guarded above
	const existingNode = state.nodeStates[nodeId]!;

	const lcErr = guardLifecycleForAccept(existingNode.lifecycle, nodeId);
	if (lcErr) {
		return caErr(
			`Cannot regenerate canonical answer: lifecycle is "${existingNode.lifecycle}", must be "synthesized".`,
			[
				caDiag(
					DIAG_WRONG_LIFECYCLE_FOR_REGENERATE,
					'Canonical answers can only be regenerated when the node is in "synthesized" lifecycle.',
					'error',
					nodeId,
				),
			],
		);
	}

	const caErr_ = guardHasCanonicalAnswer(nodeId, existingNode.canonicalAnswer);
	if (caErr_) return caErr_;

	// reuse the markCanonicalAnswerStale logic
	return markCanonicalAnswerStale(state, nodeId);
}
