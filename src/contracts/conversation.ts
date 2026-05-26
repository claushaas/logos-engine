/**
 * Conversation and message contracts — the raw material of node conversations.
 *
 * Messages are node-scoped. Each node owns its own conversation history
 * independent of other nodes. These types are consumed by the conversation
 * runtime, prompt orchestrator, and TUI render model builder.
 *
 * `AgentTurnOutput` (Step 1.3) references these types as the bridge between
 * LLM generation and state engine application.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §4–5}
 */
import type { NodeId, PromptId } from '../shared/index.js';
import type { PromptState } from './node-state.js';

// ─── NodeMessageRole ────────────────────────────────────────────────────────

/**
 * The sender of a node conversation message.
 *
 * `system` messages are internal and should not normally be rendered
 * as chat messages in the TUI.
 */
export type NodeMessageRole = 'user' | 'assistant' | 'system';

// ─── NodeMessageMetadata ────────────────────────────────────────────────────

/**
 * Optional metadata attached to a node message — captures the prompt state,
 * model, and structured output at the time the message was produced.
 *
 * `stateBefore` and `stateAfter` record lifecycle transitions as
 * opaque strings; concrete state snapshot types are defined in later phases.
 */
export type NodeMessageMetadata = {
	/** The prompt template ID used when producing this message. */
	readonly promptId?: PromptId;

	/** The prompt state at the time the message was produced. */
	readonly promptState?: PromptState;

	/** The model identifier (e.g., "claude-sonnet-4-20250514"). */
	readonly model?: string;

	/** ID linking this message to a structured LLM output record. */
	readonly structuredOutputId?: string;

	/** Lifecycle state before the turn (opaque, for tracing). */
	readonly stateBefore?: string;

	/** Lifecycle state after the turn (opaque, for tracing). */
	readonly stateAfter?: string;
};

// ─── NodeMessage ────────────────────────────────────────────────────────────

/**
 * A single message in a node conversation.
 *
 * Every message has a unique ID, a role, content, a creation timestamp,
 * and optional metadata for tracing and prompt attribution.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §5}
 */
export type NodeMessage = {
	/** Unique message identifier. */
	readonly id: string;

	/** Sender role. */
	readonly role: NodeMessageRole;

	/** Message body (plain text or Markdown). */
	readonly content: string;

	/** ISO-8601 timestamp of message creation. */
	readonly createdAt: string;

	/** Optional tracing and attribution metadata. */
	readonly metadata?: NodeMessageMetadata;
};

// ─── NodeConversation ───────────────────────────────────────────────────────

/**
 * The full conversation history for a node, including metadata for
 * efficient pointer maintenance and summary access.
 *
 * Note: `NodeRuntimeState.conversation` uses `NodeMessage[]` directly
 * (via the `NodeConversationEntry` alias), not this wrapper. This type
 * exists as a standalone serialization and transfer shape used by the
 * conversation runtime and prompt orchestrator.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §4}
 */
export type NodeConversation = {
	/** The node this conversation belongs to (branded). */
	readonly nodeId: NodeId;

	/** Time-ordered messages for this node. */
	readonly messages: NodeMessage[];

	/** Optional compressed summary for prompt budget management. */
	readonly summary?: string;

	/** ID of the most recent user message, if any. */
	readonly lastUserMessageId?: string;

	/** ID of the most recent assistant message, if any. */
	readonly lastAssistantMessageId?: string;
};
