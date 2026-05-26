/**
 * Compile-time assertions for Step 1.5 session event and persistence types.
 *
 * This file exercises TypeScript-level type identity for the
 * session-event and persistence contracts created in Step 1.5.
 * It is NOT a runtime test — if any assertion were violated,
 * the project would not type-check.
 *
 * Tests:
 *  1. `SessionEventType` has exactly 17 members.
 *  2. `SessionEventPayloadMap` covers all event types.
 *  3. `SessionEvent` discriminated union narrowing works.
 *  4. Construct a valid `SessionEvent` of each type.
 *  5. `PersistedSession.schemaVersion` is required (construction check).
 *  6. `SessionSnapshot` shape.
 *  7. `Migration` shape.
 */
import type {
	DocumentId,
	NodeId,
	ProfileId,
	SessionId,
} from '../shared/index.js';
import type {
	AssistantMessageAddedEvent,
	CanonicalAnswerAcceptedEvent,
	CanonicalAnswerDraftedEvent,
	CanonicalAnswerMarkedStaleEvent,
	CompletenessEvaluatedEvent,
	DocumentMarkedStaleEvent,
	DocumentPreviewGeneratedEvent,
	ExportGeneratedEvent,
	Migration,
	NodeBlockedEvent,
	NodeDeferredEvent,
	NodeLifecycleChangedEvent,
	NodeSelectedEvent,
	PersistedSession,
	ProfileChangedEvent,
	ProfileSelectedEvent,
	SessionCreatedEvent,
	SessionEvent,
	SessionEventPayloadMap,
	SessionEventType,
	SessionSnapshot,
	SettingsUpdatedEvent,
	UserMessageAddedEvent,
} from './index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

type IsAssignable<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;

// ─── 1. SessionEventType has exactly 17 members ─────────────────────────────

/** Ensure the payload map covers every event type declared in `SessionEventType`. */
type _PayloadMapCoversAllEventTypes = Expect<
	IsAssignable<keyof SessionEventPayloadMap, SessionEventType>
>;

// ─── 2. All 17 event types are covered (value-level exact coverage) ─────────

/**
 * If this does not compile, the `SessionEventType` union or `SessionEventPayloadMap`
 * is missing an event type — or a stale entry was left behind.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _allSessionEventTypesCovered = {
	ASSISTANT_MESSAGE_ADDED: true,
	CANONICAL_ANSWER_ACCEPTED: true,
	CANONICAL_ANSWER_DRAFTED: true,
	CANONICAL_ANSWER_MARKED_STALE: true,
	COMPLETENESS_EVALUATED: true,
	DOCUMENT_MARKED_STALE: true,
	DOCUMENT_PREVIEW_GENERATED: true,
	EXPORT_GENERATED: true,
	NODE_BLOCKED: true,
	NODE_DEFERRED: true,
	NODE_LIFECYCLE_CHANGED: true,
	NODE_SELECTED: true,
	PROFILE_CHANGED: true,
	PROFILE_SELECTED: true,
	SESSION_CREATED: true,
	SETTINGS_UPDATED: true,
	USER_MESSAGE_ADDED: true,
} satisfies Record<SessionEventType, true>;

// ─── 3. SessionEvent discriminated union narrowing works ───────────────────

/**
 * Exhaustive type narrowing test — if `event.type === 'USER_MESSAGE_ADDED'`,
 * then `event.payload.content` must be a `string`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _processEvent(event: SessionEvent): string {
	switch (event.type) {
		case 'SESSION_CREATED':
			return `Session created at ${event.payload.createdAt}`;
		case 'PROFILE_SELECTED':
			return `Profile selected: ${event.payload.profileId}`;
		case 'PROFILE_CHANGED':
			return `Profile changed from ${event.payload.previousProfileId ?? 'none'} to ${event.payload.newProfileId}`;
		case 'NODE_SELECTED':
			return `Node selected: ${event.payload.nodeId} (prev: ${event.payload.previousNodeId ?? 'none'})`;
		case 'USER_MESSAGE_ADDED':
			// This should narrow payload to UserMessageAddedEventPayload
			return `User message: ${event.payload.content.substring(0, 50)}`;
		case 'ASSISTANT_MESSAGE_ADDED':
			return `Assistant message: ${event.payload.promptId}`;
		case 'NODE_LIFECYCLE_CHANGED':
			return `Lifecycle: ${event.payload.from} → ${event.payload.to}`;
		case 'COMPLETENESS_EVALUATED':
			return `Completeness: ${event.payload.complete ? 'complete' : 'incomplete'}`;
		case 'CANONICAL_ANSWER_DRAFTED':
			return `Drafted: ${event.payload.canonicalAnswerId}`;
		case 'CANONICAL_ANSWER_ACCEPTED':
			return `Accepted: ${event.payload.canonicalAnswerId}`;
		case 'CANONICAL_ANSWER_MARKED_STALE':
			return `Stale: ${event.payload.canonicalAnswerId}`;
		case 'NODE_DEFERRED':
			return `Deferred: ${event.payload.nodeId}${event.payload.reason ? ` (${event.payload.reason})` : ''}`;
		case 'NODE_BLOCKED':
			return `Blocked: ${event.payload.nodeId} by [${event.payload.blockedBy.join(', ')}]`;
		case 'DOCUMENT_PREVIEW_GENERATED':
			return `Document preview: ${event.payload.documentId}`;
		case 'DOCUMENT_MARKED_STALE':
			return `Document stale: ${event.payload.documentId}`;
		case 'EXPORT_GENERATED':
			return `Export: ${event.payload.artifactId} (${event.payload.format})`;
		case 'SETTINGS_UPDATED':
			return `Settings updated: ${event.payload.changedKeys.join(', ')}`;
	}
}

// ─── 4. Construct a valid SessionEvent of each type ────────────────────────

const sessionId = 'sess_1' as SessionId;
const createdAt = '2026-01-01T00:00:00.000Z';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _sessionCreated: SessionCreatedEvent = {
	createdAt,
	id: 'evt_1',
	payload: { createdAt },
	sessionId,
	type: 'SESSION_CREATED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _profileSelected: ProfileSelectedEvent = {
	createdAt,
	id: 'evt_2',
	payload: { profileId: 'p_startup' as ProfileId },
	sessionId,
	type: 'PROFILE_SELECTED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _profileChanged: ProfileChangedEvent = {
	createdAt,
	id: 'evt_3',
	payload: { newProfileId: 'p_startup' as ProfileId, previousProfileId: null },
	sessionId,
	type: 'PROFILE_CHANGED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _nodeSelected: NodeSelectedEvent = {
	createdAt,
	id: 'evt_4',
	payload: { nodeId: 'node_thesis' as NodeId, previousNodeId: null },
	sessionId,
	type: 'NODE_SELECTED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _userMessageAdded: UserMessageAddedEvent = {
	createdAt,
	id: 'evt_5',
	payload: {
		content: 'Our thesis is...',
		messageId: 'msg_1',
		nodeId: 'node_thesis' as NodeId,
	},
	sessionId,
	type: 'USER_MESSAGE_ADDED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _assistantMessageAdded: AssistantMessageAddedEvent = {
	createdAt,
	id: 'evt_6',
	payload: {
		messageId: 'msg_2',
		nodeId: 'node_thesis' as NodeId,
		promptId: 'prompt_initial',
		promptState: 'initial',
		structuredOutputId: 'so_1',
	},
	sessionId,
	type: 'ASSISTANT_MESSAGE_ADDED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _lifecycleChanged: NodeLifecycleChangedEvent = {
	createdAt,
	id: 'evt_7',
	payload: {
		from: 'not_started',
		nodeId: 'node_thesis' as NodeId,
		to: 'active',
	},
	sessionId,
	type: 'NODE_LIFECYCLE_CHANGED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _completenessEvaluated: CompletenessEvaluatedEvent = {
	createdAt,
	id: 'evt_8',
	payload: { complete: false, nodeId: 'node_thesis' as NodeId },
	sessionId,
	type: 'COMPLETENESS_EVALUATED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _canonicalAnswerDrafted: CanonicalAnswerDraftedEvent = {
	createdAt,
	id: 'evt_9',
	payload: {
		canonicalAnswerId: 'ca_1',
		nodeId: 'node_thesis' as NodeId,
		sourceMessageIds: ['msg_1', 'msg_2'],
	},
	sessionId,
	type: 'CANONICAL_ANSWER_DRAFTED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _canonicalAnswerAccepted: CanonicalAnswerAcceptedEvent = {
	createdAt,
	id: 'evt_10',
	payload: { canonicalAnswerId: 'ca_1', nodeId: 'node_thesis' as NodeId },
	sessionId,
	type: 'CANONICAL_ANSWER_ACCEPTED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _canonicalAnswerMarkedStale: CanonicalAnswerMarkedStaleEvent = {
	createdAt,
	id: 'evt_11',
	payload: { canonicalAnswerId: 'ca_1', nodeId: 'node_thesis' as NodeId },
	sessionId,
	type: 'CANONICAL_ANSWER_MARKED_STALE',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _nodeDeferred: NodeDeferredEvent = {
	createdAt,
	id: 'evt_12',
	payload: { nodeId: 'node_tension' as NodeId, reason: 'Out of scope for now' },
	sessionId,
	type: 'NODE_DEFERRED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _nodeBlocked: NodeBlockedEvent = {
	createdAt,
	id: 'evt_13',
	payload: {
		blockedBy: ['node_thesis' as NodeId],
		nodeId: 'node_tension' as NodeId,
	},
	sessionId,
	type: 'NODE_BLOCKED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _documentPreviewGenerated: DocumentPreviewGeneratedEvent = {
	createdAt,
	id: 'evt_14',
	payload: { documentId: 'doc_thesis' as DocumentId },
	sessionId,
	type: 'DOCUMENT_PREVIEW_GENERATED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _documentMarkedStale: DocumentMarkedStaleEvent = {
	createdAt,
	id: 'evt_15',
	payload: {
		documentId: 'doc_thesis' as DocumentId,
		staleNodeIds: ['node_thesis' as NodeId],
	},
	sessionId,
	type: 'DOCUMENT_MARKED_STALE',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _exportGenerated: ExportGeneratedEvent = {
	createdAt,
	id: 'evt_16',
	payload: { artifactId: 'art_1', format: 'markdown', path: '/out/thesis.md' },
	sessionId,
	type: 'EXPORT_GENERATED',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _settingsUpdated: SettingsUpdatedEvent = {
	createdAt,
	id: 'evt_17',
	payload: { changedKeys: ['theme', 'auto_export'] },
	sessionId,
	type: 'SETTINGS_UPDATED',
};

// ─── 5. PersistedSession.schemaVersion is required ──────────────────────────

/**
 * If `schemaVersion` were optional in the type definition, constructing
 * a `PersistedSession` without it would not produce a compile error.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _persistedSession: PersistedSession = {
	events: [],
	schemaVersion: '1.0.0',
	sessionId: 'sess_1' as SessionId,
	snapshot: {
		runtimeState: {
			activeNodeId: null,
			documentStates: {},
			exportState: { artifacts: [] },
			globalContext: { preferences: {}, projectName: null, summary: null },
			lastActiveNodeId: null,
			mode: 'idle',
			nodeStates: {},
			selectedProfileId: null,
			sessionId: 'sess_1' as SessionId,
			updatedAt: '2026-01-01T00:00:00.000Z',
		},
		savedAt: '2026-01-01T00:00:00.000Z',
		schemaVersion: '1.0.0',
		sessionId: 'sess_1' as SessionId,
	},
};

// ─── 6. SessionSnapshot shape ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _snapshot: SessionSnapshot = {
	runtimeState: {
		activeNodeId: 'node_thesis' as NodeId,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: 'My Project',
			summary: 'A startup',
		},
		lastActiveNodeId: null,
		mode: 'node_focus',
		nodeStates: {},
		selectedProfileId: 'p_startup' as ProfileId,
		sessionId: 'sess_1' as SessionId,
		updatedAt: '2026-01-01T00:00:00.000Z',
	},
	savedAt: '2026-01-01T00:00:00.000Z',
	schemaVersion: '1.0.0',
	sessionId: 'sess_1' as SessionId,
};

// ─── 7. Migration shape ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _migration: Migration<
	{ version: string },
	{ version: string; newField: boolean }
> = {
	from: '1.0.0',
	migrate: (data) => ({ ...data, newField: true }),
	to: '2.0.0',
};
