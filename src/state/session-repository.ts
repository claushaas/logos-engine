/** Session Metadata Primitives — create, update, list, and summarize sessions */

import type {
	WorkspaceSession,
	WorkspaceState,
} from './workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionType = WorkspaceSession['sessionType'];
export type SessionStatus = WorkspaceSession['status'];

export interface SessionRecordInput {
	sessionType: SessionType;
	status?: SessionStatus;
	startedAt?: string;
	endedAt?: string | undefined;
	commandOrTrigger?: string | undefined;
	summary?: string | undefined;
	relatedRunIds?: string[];
	relatedArtifactIds?: string[];
	relatedDecisionIds?: string[];
	relatedQuestionIds?: string[];
}

export interface CreateSessionRecordOptions {
	state: WorkspaceState;
	input: SessionRecordInput;
	idFactory?: () => string;
	clock?: Clock;
}

export interface UpdateSessionRecordOptions {
	state: WorkspaceState;
	sessionId: string;
	updates: Partial<Omit<WorkspaceSession, 'sessionId'>>;
}

export interface ListSessionRecordsOptions {
	state: WorkspaceState;
	filterByType?: SessionType | undefined;
	filterByStatus?: SessionStatus | undefined;
}

export interface SessionSummary {
	totalSessions: number;
	activeSessions: number;
	latestSession?: WorkspaceSession | undefined;
}

export interface Clock {
	now(): string;
}

const defaultClock: Clock = {
	now: () => new Date().toISOString(),
};

function defaultIdFactory(): string {
	return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function createSessionRecord(options: CreateSessionRecordOptions): {
	state: WorkspaceState;
	session: WorkspaceSession;
} {
	const clock = options.clock ?? defaultClock;
	const idFactory = options.idFactory ?? defaultIdFactory;
	const now = clock.now();

	const session: WorkspaceSession = {
		commandOrTrigger: options.input.commandOrTrigger,
		endedAt: options.input.endedAt,
		relatedArtifactIds: options.input.relatedArtifactIds ?? [],
		relatedDecisionIds: options.input.relatedDecisionIds ?? [],
		relatedQuestionIds: options.input.relatedQuestionIds ?? [],
		relatedRunIds: options.input.relatedRunIds ?? [],
		sessionId: idFactory(),
		sessionType: options.input.sessionType,
		startedAt: options.input.startedAt ?? now,
		status: options.input.status ?? 'open',
		summary: options.input.summary,
	};

	const nextState: WorkspaceState = {
		...options.state,
		sessions: [...options.state.sessions, session],
	};

	return { session, state: nextState };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export function updateSessionRecord(options: UpdateSessionRecordOptions): {
	state: WorkspaceState;
	session: WorkspaceSession;
	found: boolean;
} {
	let found = false;
	let updatedSession: WorkspaceSession | undefined;

	const nextSessions = options.state.sessions.map((s) => {
		if (s.sessionId !== options.sessionId) return s;
		found = true;
		updatedSession = { ...s, ...options.updates };
		return updatedSession;
	});

	if (!found) {
		return {
			found: false,
			session: undefined as unknown as WorkspaceSession,
			state: options.state,
		};
	}

	const nextState: WorkspaceState = {
		...options.state,
		sessions: nextSessions,
	};

	return {
		found: true,
		session: updatedSession as WorkspaceSession,
		state: nextState,
	};
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function listSessionRecords(
	options: ListSessionRecordsOptions,
): WorkspaceSession[] {
	let result = [...options.state.sessions];

	if (options.filterByType) {
		result = result.filter((s) => s.sessionType === options.filterByType);
	}

	if (options.filterByStatus) {
		result = result.filter((s) => s.status === options.filterByStatus);
	}

	// Sort by startedAt descending for determinism
	result.sort((a, b) => {
		if (a.startedAt < b.startedAt) return 1;
		if (a.startedAt > b.startedAt) return -1;
		return a.sessionId.localeCompare(b.sessionId);
	});

	return result;
}

// ---------------------------------------------------------------------------
// Summarize
// ---------------------------------------------------------------------------

export function getCurrentSessionSummary(
	state: WorkspaceState,
): SessionSummary {
	const sessions = listSessionRecords({ state });
	const activeSessions = sessions.filter(
		(s) => s.status === 'open' || s.status === 'paused',
	).length;

	return {
		activeSessions,
		latestSession: sessions[0],
		totalSessions: sessions.length,
	};
}
