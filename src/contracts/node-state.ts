/**
 * Node lifecycle, prompt state, runtime state, and action types.
 *
 * Each node owns its own conversation, lifecycle, canonical answer,
 * completeness evaluation, extracted semantic data, and allowed actions.
 *
 * These types are consumed by the state engine, conversation runtime,
 * prompt orchestrator, and TUI render model builder.
 */
import type { NodeId } from '../shared/index.js';
import type { CanonicalAnswer } from './canonical-answer.js';
import type { CompletenessState, ExtractedNodeData } from './completeness.js';

// ─── Conversation entry placeholder ────────────────────────────────────────

/**
 * Opaque placeholder — concrete `NodeMessage` contract defined in Step 1.3.
 *
 * Lived here (not in `runtime-state.ts`) to avoid a type-level circular
 * dependency between `runtime-state.ts` and `node-state.ts`.
 */
export type NodeConversationEntry = unknown;

// ─── NodeLifecycle ──────────────────────────────────────────────────────────

/**
 * The lifecycle of a node — each state gates which actions are allowed
 * and which prompt state the agent uses.
 *
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §4}
 */
export type NodeLifecycle =
	| 'not_started'
	| 'active'
	| 'answered'
	| 'needs_clarification'
	| 'needs_refinement'
	| 'ready_for_synthesis'
	| 'synthesized'
	| 'accepted'
	| 'deferred'
	| 'blocked';

// ─── PromptState ────────────────────────────────────────────────────────────

/**
 * The prompt state determines which template the prompt orchestrator selects.
 *
 * It is derived from the node lifecycle and completeness evaluation.
 */
export type PromptState =
	| 'initial'
	| 'follow_up'
	| 'clarification'
	| 'refinement'
	| 'synthesis'
	| 'review'
	| 'repair'
	| 'blocked'
	| 'accepted';

// ─── NodeAction ─────────────────────────────────────────────────────────────

/**
 * All 14 actions that the state engine may permit based on the current
 * node lifecycle.
 *
 * The TUI renders only the actions returned by `getAllowedActions`.
 */
export type NodeAction =
	| 'answer'
	| 'accept'
	| 'edit'
	| 'regenerate'
	| 'defer'
	| 'reopen'
	| 'skip'
	| 'continue_next'
	| 'mark_as_assumption'
	| 'mark_as_decision'
	| 'open_prerequisite'
	| 'open_document_preview'
	| 'ask_for_example'
	| 'resume';

// ─── NodeDependencyState ────────────────────────────────────────────────────

/**
 * Runtime dependency state for a node — computed from the profile's
 * `NodeDependencyDefinition` and the current state of prerequisite nodes.
 */
export type NodeDependencyState = {
	/** Nodes that must be accepted before this node can be answered. */
	readonly requiredNodeIds: NodeId[];

	/** Nodes currently blocking progress (subset of `requiredNodeIds`). */
	readonly blockedBy: NodeId[];

	/** Nodes that will be unlocked when this node is accepted. */
	readonly unlocks: NodeId[];
};

// ─── NodeRuntimeState ───────────────────────────────────────────────────────

/**
 * Per-node runtime state — the core domain object that the state engine
 * transitions and that the TUI renders.
 *
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §3}
 */
export type NodeRuntimeState = {
	/** Unique node identifier (branded). */
	readonly nodeId: NodeId;

	/** Current lifecycle stage. */
	readonly lifecycle: NodeLifecycle;

	/**
	 * Opaque conversation entries.
	 *
	 * Concrete `NodeMessage[]` contract defined in Step 1.3.
	 */
	readonly conversation: NodeConversationEntry[];

	/** The canonical answer for this node, or `null` if not yet synthesized. */
	readonly canonicalAnswer: CanonicalAnswer | null;

	/** Completeness evaluation for the current conversation. */
	readonly completeness: CompletenessState;

	/** Semantic data extracted from the conversation (facts, assumptions, etc.). */
	readonly extracted: ExtractedNodeData;

	/** Current prompt state — derived from lifecycle and completeness. */
	readonly promptState: PromptState;

	/** Actions allowed in the current lifecycle. Computed by the state engine. */
	readonly allowedActions: NodeAction[];

	/** Runtime dependency state. */
	readonly dependencies: NodeDependencyState;

	/** ISO-8601 timestamp of the last state mutation for this node. */
	readonly updatedAt: string;
};
