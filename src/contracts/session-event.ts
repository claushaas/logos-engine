/**
 * Session event contracts.
 *
 * Events record how the runtime state changed. They are used for
 * auditability, recovery, and future replay. Every important state
 * transition produces a typed event.
 *
 * @see {@link https://logos-engine/docs/09-session-events-and-persistence.md}
 */
import type {
	DocumentId,
	NodeId,
	ProfileId,
	SessionId,
} from '../shared/index.js';
import type { NodeLifecycle } from './node-state.js';

// ─── SessionEventType ──────────────────────────────────────────────────────

/**
 * All 17 event types from the canonical session events specification.
 *
 * @see {@link https://logos-engine/docs/09-session-events-and-persistence.md §6}
 */
export type SessionEventType =
	| 'SESSION_CREATED'
	| 'PROFILE_SELECTED'
	| 'PROFILE_CHANGED'
	| 'NODE_SELECTED'
	| 'USER_MESSAGE_ADDED'
	| 'ASSISTANT_MESSAGE_ADDED'
	| 'NODE_LIFECYCLE_CHANGED'
	| 'COMPLETENESS_EVALUATED'
	| 'CANONICAL_ANSWER_DRAFTED'
	| 'CANONICAL_ANSWER_ACCEPTED'
	| 'CANONICAL_ANSWER_MARKED_STALE'
	| 'NODE_DEFERRED'
	| 'NODE_BLOCKED'
	| 'DOCUMENT_PREVIEW_GENERATED'
	| 'DOCUMENT_MARKED_STALE'
	| 'EXPORT_GENERATED'
	| 'SETTINGS_UPDATED';

// ─── Event payloads ────────────────────────────────────────────────────────

/** Payload for `SESSION_CREATED`. */
export type SessionCreatedEventPayload = {
	/** ISO-8601 timestamp of session creation. */
	readonly createdAt: string;
};

/** Payload for `PROFILE_SELECTED`. */
export type ProfileSelectedEventPayload = {
	/** The selected profile identifier (branded). */
	readonly profileId: ProfileId;
};

/** Payload for `PROFILE_CHANGED`. */
export type ProfileChangedEventPayload = {
	/** The previous profile identifier, or `null` if none was selected. */
	readonly previousProfileId: ProfileId | null;

	/** The new profile identifier (branded). */
	readonly newProfileId: ProfileId;
};

/** Payload for `NODE_SELECTED`. */
export type NodeSelectedEventPayload = {
	/** The selected node identifier (branded). */
	readonly nodeId: NodeId;

	/** The previously active node, or `null` if none was active. */
	readonly previousNodeId: NodeId | null;
};

/** Payload for `USER_MESSAGE_ADDED`. */
export type UserMessageAddedEventPayload = {
	/** The node this message belongs to (branded). */
	readonly nodeId: NodeId;

	/** Unique message identifier. */
	readonly messageId: string;

	/** The user's message content. */
	readonly content: string;
};

/** Payload for `ASSISTANT_MESSAGE_ADDED`. */
export type AssistantMessageAddedEventPayload = {
	/** The node this message belongs to (branded). */
	readonly nodeId: NodeId;

	/** Unique message identifier. */
	readonly messageId: string;

	/** The prompt identifier that generated this response. */
	readonly promptId: string;

	/** The prompt state at the time of generation. */
	readonly promptState: string;

	/** The structured output identifier, if applicable. */
	readonly structuredOutputId: string;
};

/** Payload for `NODE_LIFECYCLE_CHANGED`. */
export type NodeLifecycleChangedEventPayload = {
	/** The node whose lifecycle changed (branded). */
	readonly nodeId: NodeId;

	/** The previous lifecycle state. */
	readonly from: NodeLifecycle;

	/** The new lifecycle state. */
	readonly to: NodeLifecycle;
};

/** Payload for `COMPLETENESS_EVALUATED`. */
export type CompletenessEvaluatedEventPayload = {
	/** The node that was evaluated (branded). */
	readonly nodeId: NodeId;

	/** Whether the conversation is complete. */
	readonly complete: boolean;
};

/** Payload for `CANONICAL_ANSWER_DRAFTED`. */
export type CanonicalAnswerDraftedEventPayload = {
	/** The node this draft belongs to (branded). */
	readonly nodeId: NodeId;

	/** Unique canonical answer identifier. */
	readonly canonicalAnswerId: string;

	/** Source message IDs this draft was derived from. */
	readonly sourceMessageIds: string[];
};

/** Payload for `CANONICAL_ANSWER_ACCEPTED`. */
export type CanonicalAnswerAcceptedEventPayload = {
	/** The node this answer belongs to (branded). */
	readonly nodeId: NodeId;

	/** Unique canonical answer identifier. */
	readonly canonicalAnswerId: string;
};

/** Payload for `CANONICAL_ANSWER_MARKED_STALE`. */
export type CanonicalAnswerMarkedStaleEventPayload = {
	/** The node whose answer is now stale (branded). */
	readonly nodeId: NodeId;

	/** Unique canonical answer identifier. */
	readonly canonicalAnswerId: string;
};

/** Payload for `NODE_DEFERRED`. */
export type NodeDeferredEventPayload = {
	/** The deferred node (branded). */
	readonly nodeId: NodeId;

	/** Optional reason for deferral. */
	readonly reason?: string;
};

/** Payload for `NODE_BLOCKED`. */
export type NodeBlockedEventPayload = {
	/** The blocked node (branded). */
	readonly nodeId: NodeId;

	/** Nodes blocking progress. */
	readonly blockedBy: NodeId[];
};

/** Payload for `DOCUMENT_PREVIEW_GENERATED`. */
export type DocumentPreviewGeneratedEventPayload = {
	/** The document identifier (branded). */
	readonly documentId: DocumentId;
};

/** Payload for `DOCUMENT_MARKED_STALE`. */
export type DocumentMarkedStaleEventPayload = {
	/** The document identifier (branded). */
	readonly documentId: DocumentId;

	/** Source node IDs whose canonical answers are stale (branded). */
	readonly staleNodeIds: NodeId[];
};

/** Payload for `EXPORT_GENERATED`. */
export type ExportGeneratedEventPayload = {
	/** The artifact identifier. */
	readonly artifactId: string;

	/** Output format. */
	readonly format: 'markdown' | 'html' | 'agent_pack';

	/** Filesystem path. */
	readonly path: string;
};

/** Payload for `SETTINGS_UPDATED`. */
export type SettingsUpdatedEventPayload = {
	/** Keys that were changed. */
	readonly changedKeys: string[];
};

// ─── Event payload map ─────────────────────────────────────────────────────

/**
 * Maps each `SessionEventType` to its typed payload.
 *
 * Used to derive a fully-typed discriminated union via mapped types.
 */
export type SessionEventPayloadMap = {
	readonly SESSION_CREATED: SessionCreatedEventPayload;
	readonly PROFILE_SELECTED: ProfileSelectedEventPayload;
	readonly PROFILE_CHANGED: ProfileChangedEventPayload;
	readonly NODE_SELECTED: NodeSelectedEventPayload;
	readonly USER_MESSAGE_ADDED: UserMessageAddedEventPayload;
	readonly ASSISTANT_MESSAGE_ADDED: AssistantMessageAddedEventPayload;
	readonly NODE_LIFECYCLE_CHANGED: NodeLifecycleChangedEventPayload;
	readonly COMPLETENESS_EVALUATED: CompletenessEvaluatedEventPayload;
	readonly CANONICAL_ANSWER_DRAFTED: CanonicalAnswerDraftedEventPayload;
	readonly CANONICAL_ANSWER_ACCEPTED: CanonicalAnswerAcceptedEventPayload;
	readonly CANONICAL_ANSWER_MARKED_STALE: CanonicalAnswerMarkedStaleEventPayload;
	readonly NODE_DEFERRED: NodeDeferredEventPayload;
	readonly NODE_BLOCKED: NodeBlockedEventPayload;
	readonly DOCUMENT_PREVIEW_GENERATED: DocumentPreviewGeneratedEventPayload;
	readonly DOCUMENT_MARKED_STALE: DocumentMarkedStaleEventPayload;
	readonly EXPORT_GENERATED: ExportGeneratedEventPayload;
	readonly SETTINGS_UPDATED: SettingsUpdatedEventPayload;
};

// ─── SessionEvent (discriminated union) ────────────────────────────────────

/**
 * A session event — records a single state transition with a typed payload.
 *
 * The discriminated union ensures that narrowing on `type` also narrows
 * `payload` to the correct shape. No `payload: unknown`.
 */
export type SessionEvent = {
	[T in SessionEventType]: {
		/** Unique event identifier. */
		readonly id: string;

		/** The session this event belongs to (branded). */
		readonly sessionId: SessionId;

		/** Event type discriminator. */
		readonly type: T;

		/** Typed payload for this event. */
		readonly payload: SessionEventPayloadMap[T];

		/** ISO-8601 timestamp of when the event occurred. */
		readonly createdAt: string;
	};
}[SessionEventType];

// ─── Convenience event type aliases ────────────────────────────────────────

/** `SESSION_CREATED` event. */
export type SessionCreatedEvent = Extract<
	SessionEvent,
	{ type: 'SESSION_CREATED' }
>;

/** `PROFILE_SELECTED` event. */
export type ProfileSelectedEvent = Extract<
	SessionEvent,
	{ type: 'PROFILE_SELECTED' }
>;

/** `PROFILE_CHANGED` event. */
export type ProfileChangedEvent = Extract<
	SessionEvent,
	{ type: 'PROFILE_CHANGED' }
>;

/** `NODE_SELECTED` event. */
export type NodeSelectedEvent = Extract<
	SessionEvent,
	{ type: 'NODE_SELECTED' }
>;

/** `USER_MESSAGE_ADDED` event. */
export type UserMessageAddedEvent = Extract<
	SessionEvent,
	{ type: 'USER_MESSAGE_ADDED' }
>;

/** `ASSISTANT_MESSAGE_ADDED` event. */
export type AssistantMessageAddedEvent = Extract<
	SessionEvent,
	{ type: 'ASSISTANT_MESSAGE_ADDED' }
>;

/** `NODE_LIFECYCLE_CHANGED` event. */
export type NodeLifecycleChangedEvent = Extract<
	SessionEvent,
	{ type: 'NODE_LIFECYCLE_CHANGED' }
>;

/** `COMPLETENESS_EVALUATED` event. */
export type CompletenessEvaluatedEvent = Extract<
	SessionEvent,
	{ type: 'COMPLETENESS_EVALUATED' }
>;

/** `CANONICAL_ANSWER_DRAFTED` event. */
export type CanonicalAnswerDraftedEvent = Extract<
	SessionEvent,
	{ type: 'CANONICAL_ANSWER_DRAFTED' }
>;

/** `CANONICAL_ANSWER_ACCEPTED` event. */
export type CanonicalAnswerAcceptedEvent = Extract<
	SessionEvent,
	{ type: 'CANONICAL_ANSWER_ACCEPTED' }
>;

/** `CANONICAL_ANSWER_MARKED_STALE` event. */
export type CanonicalAnswerMarkedStaleEvent = Extract<
	SessionEvent,
	{ type: 'CANONICAL_ANSWER_MARKED_STALE' }
>;

/** `NODE_DEFERRED` event. */
export type NodeDeferredEvent = Extract<
	SessionEvent,
	{ type: 'NODE_DEFERRED' }
>;

/** `NODE_BLOCKED` event. */
export type NodeBlockedEvent = Extract<SessionEvent, { type: 'NODE_BLOCKED' }>;

/** `DOCUMENT_PREVIEW_GENERATED` event. */
export type DocumentPreviewGeneratedEvent = Extract<
	SessionEvent,
	{ type: 'DOCUMENT_PREVIEW_GENERATED' }
>;

/** `DOCUMENT_MARKED_STALE` event. */
export type DocumentMarkedStaleEvent = Extract<
	SessionEvent,
	{ type: 'DOCUMENT_MARKED_STALE' }
>;

/** `EXPORT_GENERATED` event. */
export type ExportGeneratedEvent = Extract<
	SessionEvent,
	{ type: 'EXPORT_GENERATED' }
>;

/** `SETTINGS_UPDATED` event. */
export type SettingsUpdatedEvent = Extract<
	SessionEvent,
	{ type: 'SETTINGS_UPDATED' }
>;
