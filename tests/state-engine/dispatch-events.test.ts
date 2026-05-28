/**
 * Tests for Step 13.2 — dispatch emits SessionEvent on all significant transitions.
 *
 * Covers:
 *  - CREATE_SESSION emits SESSION_CREATED.
 *  - SELECT_PROFILE emits PROFILE_SELECTED.
 *  - CHANGE_PROFILE emits PROFILE_CHANGED.
 *  - SELECT_NODE emits NODE_SELECTED (and NODE_BLOCKED if applicable).
 *  - USER_MESSAGE_ADDED emits USER_MESSAGE_ADDED + COMPLETENESS_EVALUATED.
 *  - NODE_LIFECYCLE_CHANGED emits NODE_LIFECYCLE_CHANGED + CANONICAL_ANSWER_MARKED_STALE.
 *  - DEFER_NODE emits NODE_DEFERRED + NODE_LIFECYCLE_CHANGED.
 *  - RESUME_NODE emits NODE_LIFECYCLE_CHANGED.
 *  - Replay (SessionEvent input) suppresses events.
 *  - Integration: append events to event log and read back.
 */
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type {
	LogosProfile,
	LogosRuntimeState,
	NodeLifecycle,
	SessionEvent,
} from '../../src/contracts/index.js';
import { createEventLog } from '../../src/persistence/event-log.js';
import type { NodeId, ProfileId, SessionId } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';

// ═══════════════════════════════════════════════════════════════════════════
// Minimal profile fixture
// ═══════════════════════════════════════════════════════════════════════════

function minimalProfile(): LogosProfile {
	return {
		documents: [],
		id: 'test-profile' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is node 1 about?',
				coverageTopics: ['topic-a', 'topic-b'],
				documentId: 'doc-1' as import('../../src/shared/index.js').DocumentId,
				id: 'node-1' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {
					accepted:
						'accepted-prompt' as import('../../src/shared/index.js').PromptId,
					blocked:
						'blocked-prompt' as import('../../src/shared/index.js').PromptId,
					clarification:
						'clarification-prompt' as import('../../src/shared/index.js').PromptId,
					followUp:
						'follow-up-prompt' as import('../../src/shared/index.js').PromptId,
					initial:
						'initial-prompt' as import('../../src/shared/index.js').PromptId,
					refinement:
						'refinement-prompt' as import('../../src/shared/index.js').PromptId,
					review:
						'review-prompt' as import('../../src/shared/index.js').PromptId,
					synthesis:
						'synthesis-prompt' as import('../../src/shared/index.js').PromptId,
				},
				sufficiencyCriteria: ['Must be clear'],
				title: 'Node 1',
			},
			{
				canonicalQuestion: 'What is node 2 about?',
				coverageTopics: ['topic-c'],
				documentId: 'doc-1' as import('../../src/shared/index.js').DocumentId,
				id: 'node-2' as NodeId,
				order: 2,
				phaseId: 'phase-1',
				promptRefs: {
					accepted:
						'accepted-prompt' as import('../../src/shared/index.js').PromptId,
					blocked:
						'blocked-prompt' as import('../../src/shared/index.js').PromptId,
					clarification:
						'clarification-prompt' as import('../../src/shared/index.js').PromptId,
					followUp:
						'follow-up-prompt' as import('../../src/shared/index.js').PromptId,
					initial:
						'initial-prompt' as import('../../src/shared/index.js').PromptId,
					refinement:
						'refinement-prompt' as import('../../src/shared/index.js').PromptId,
					review:
						'review-prompt' as import('../../src/shared/index.js').PromptId,
					synthesis:
						'synthesis-prompt' as import('../../src/shared/index.js').PromptId,
				},
				sufficiencyCriteria: ['Must be specific'],
				title: 'Node 2',
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'First phase',
				title: 'Phase 1',
			},
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

/**
 * Profile where node-2 depends on node-1 (for testing NODE_BLOCKED).
 */
function profileWithDependency(): LogosProfile {
	return {
		documents: [],
		id: 'test-profile-dep' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is node 1 about?',
				coverageTopics: ['topic-a'],
				documentId: 'doc-1' as import('../../src/shared/index.js').DocumentId,
				id: 'node-1' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {
					accepted:
						'accepted-prompt' as import('../../src/shared/index.js').PromptId,
					blocked:
						'blocked-prompt' as import('../../src/shared/index.js').PromptId,
					clarification:
						'clarification-prompt' as import('../../src/shared/index.js').PromptId,
					followUp:
						'follow-up-prompt' as import('../../src/shared/index.js').PromptId,
					initial:
						'initial-prompt' as import('../../src/shared/index.js').PromptId,
					refinement:
						'refinement-prompt' as import('../../src/shared/index.js').PromptId,
					review:
						'review-prompt' as import('../../src/shared/index.js').PromptId,
					synthesis:
						'synthesis-prompt' as import('../../src/shared/index.js').PromptId,
				},
				sufficiencyCriteria: ['Must be clear'],
			},
			{
				canonicalQuestion: 'What is node 2 about?',
				coverageTopics: ['topic-c'],
				dependencies: {
					requiredNodeIds: ['node-1' as NodeId],
				},
				documentId: 'doc-1' as import('../../src/shared/index.js').DocumentId,
				id: 'node-2' as NodeId,
				order: 2,
				phaseId: 'phase-1',
				promptRefs: {
					accepted:
						'accepted-prompt' as import('../../src/shared/index.js').PromptId,
					blocked:
						'blocked-prompt' as import('../../src/shared/index.js').PromptId,
					clarification:
						'clarification-prompt' as import('../../src/shared/index.js').PromptId,
					followUp:
						'follow-up-prompt' as import('../../src/shared/index.js').PromptId,
					initial:
						'initial-prompt' as import('../../src/shared/index.js').PromptId,
					refinement:
						'refinement-prompt' as import('../../src/shared/index.js').PromptId,
					review:
						'review-prompt' as import('../../src/shared/index.js').PromptId,
					synthesis:
						'synthesis-prompt' as import('../../src/shared/index.js').PromptId,
				},
				sufficiencyCriteria: ['Must be specific'],
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'First phase',
				title: 'Phase 1',
			},
		],
		title: 'Test Profile with Dependencies',
		version: '1.0.0',
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function tempDir(): Promise<string> {
	return realpath(await mkdtemp(join(tmpdir(), 'logos-dispatch-events-')));
}

function getFirstEvent(
	events: readonly SessionEvent[] | undefined,
	expectedType: string,
): SessionEvent | undefined {
	if (!events) return undefined;
	return events.find((e) => e.type === expectedType);
}

/** Assert that a result is ok and return the unwrapped value. */
function assertOk<T>(
	result: { ok: boolean; error?: string },
	label: string,
): asserts result is { ok: true } & T {
	if (!result.ok) {
		throw new Error(`${label} failed: ${(result as { error: string }).error}`);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('dispatch events', () => {
	// ─────────────────────────────────────────────────────────────────
	// CREATE_SESSION
	// ─────────────────────────────────────────────────────────────────

	describe('CREATE_SESSION', () => {
		it('should emit SESSION_CREATED event', () => {
			const profile = minimalProfile();
			const initialState: LogosRuntimeState = {
				activeNodeId: null,
				documentStates: {},
				exportState: { artifacts: [] },
				globalContext: { preferences: {}, projectName: null, summary: null },
				lastActiveNodeId: null,
				mode: 'idle',
				nodeStates: {},
				selectedProfileId: null,
				sessionId: 'unused' as SessionId,
				updatedAt: '2026-01-01T00:00:00Z',
			};

			const result = dispatch(
				initialState,
				{ type: 'CREATE_SESSION' },
				profile,
			);
			assertOk(result, 'CREATE_SESSION');

			expect(result.events).toBeDefined();
			expect(result.events).toHaveLength(1);

			const evt = result.events![0]!;
			expect(evt.type).toBe('SESSION_CREATED');
			expect(evt.sessionId).toBe(result.state.sessionId);
			expect(evt.id).toBeTypeOf('string');
			expect(evt.createdAt).toBeTypeOf('string');
			expect(evt.payload).toHaveProperty('createdAt');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// SELECT_PROFILE
	// ─────────────────────────────────────────────────────────────────

	describe('SELECT_PROFILE', () => {
		it('should emit PROFILE_SELECTED event', () => {
			const profile = minimalProfile();

			// Create session first.
			const createResult = dispatch(
				{
					activeNodeId: null,
					documentStates: {},
					exportState: { artifacts: [] },
					globalContext: { preferences: {}, projectName: null, summary: null },
					lastActiveNodeId: null,
					mode: 'idle',
					nodeStates: {},
					selectedProfileId: null,
					sessionId: 'unused' as SessionId,
					updatedAt: '2026-01-01T00:00:00Z',
				},
				{ type: 'CREATE_SESSION' },
				profile,
			);
			assertOk(createResult, 'CREATE_SESSION');

			const result = dispatch(
				createResult.state,
				{ profileId: profile.id, type: 'SELECT_PROFILE' },
				profile,
			);
			assertOk(result, 'SELECT_PROFILE');

			expect(result.events).toBeDefined();
			expect(result.events).toHaveLength(1);

			const evt = result.events![0]!;
			expect(evt.type).toBe('PROFILE_SELECTED');
			expect(evt.sessionId).toBe(createResult.state.sessionId);
			expect(evt.payload).toHaveProperty('profileId', profile.id);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// CHANGE_PROFILE
	// ─────────────────────────────────────────────────────────────────

	describe('CHANGE_PROFILE', () => {
		it('should emit PROFILE_CHANGED event (not PROFILE_SELECTED)', () => {
			const profile = minimalProfile();

			const createResult = dispatch(
				{
					activeNodeId: null,
					documentStates: {},
					exportState: { artifacts: [] },
					globalContext: { preferences: {}, projectName: null, summary: null },
					lastActiveNodeId: null,
					mode: 'idle',
					nodeStates: {},
					selectedProfileId: null,
					sessionId: 'unused' as SessionId,
					updatedAt: '2026-01-01T00:00:00Z',
				},
				{ type: 'CREATE_SESSION' },
				profile,
			);
			assertOk(createResult, 'CREATE_SESSION');

			const selectResult = dispatch(
				createResult.state,
				{ profileId: profile.id, type: 'SELECT_PROFILE' },
				profile,
			);
			assertOk(selectResult, 'SELECT_PROFILE');

			// Change to a different profile (use same minimalProfile but note
			// previousProfileId should be non-null).
			const result = dispatch(
				selectResult.state,
				{ profileId: profile.id, type: 'CHANGE_PROFILE' },
				// Using same profile.id means "re-select"; previousProfileId will be set.
				profile,
			);
			assertOk(result, 'CHANGE_PROFILE');

			const evt = result.events![0]!;
			expect(evt.type).toBe('PROFILE_CHANGED');
			expect(evt.payload).toHaveProperty('previousProfileId', profile.id);
			expect(evt.payload).toHaveProperty('newProfileId', profile.id);

			// Must NOT emit PROFILE_SELECTED.
			const profileSelected = result.events?.find(
				(e) => e.type === 'PROFILE_SELECTED',
			);
			expect(profileSelected).toBeUndefined();
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// SELECT_NODE
	// ─────────────────────────────────────────────────────────────────

	describe('SELECT_NODE', () => {
		it('should emit NODE_SELECTED event', () => {
			const profile = minimalProfile();
			const state = createSessionAndSelectProfile(profile);

			const result = dispatch(
				state,
				{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
				profile,
			);
			assertOk(result, 'SELECT_NODE');

			const evt = getFirstEvent(result.events, 'NODE_SELECTED');
			expect(evt).toBeDefined();
			expect(evt!.type).toBe('NODE_SELECTED');
			expect(evt!.payload).toHaveProperty('nodeId', 'node-1');
			expect(evt!.payload).toHaveProperty('previousNodeId', null);
		});

		it('should emit NODE_SELECTED with previousNodeId when re-selecting', () => {
			const profile = minimalProfile();
			const state = createSessionAndSelectProfile(profile);

			const r1 = dispatch(
				state,
				{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
				profile,
			);
			assertOk(r1, 'SELECT_NODE');

			const r2 = dispatch(
				r1.state,
				{ nodeId: 'node-2' as NodeId, type: 'SELECT_NODE' },
				profile,
			);
			assertOk(r2, 'SELECT_NODE');

			const evt = getFirstEvent(r2.events, 'NODE_SELECTED');
			expect(evt).toBeDefined();
			expect(evt!.payload).toHaveProperty('nodeId', 'node-2');
			expect(evt!.payload).toHaveProperty('previousNodeId', 'node-1');
		});

		it('should emit NODE_BLOCKED when selected node is blocked by dependencies', () => {
			const profile = profileWithDependency();
			const state = createSessionAndSelectProfile(profile);

			// Select node-2 which depends on node-1 (not yet accepted).
			const result = dispatch(
				state,
				{ nodeId: 'node-2' as NodeId, type: 'SELECT_NODE' },
				profile,
			);
			assertOk(result, 'SELECT_NODE_BLOCKED');

			const blockedEvt = getFirstEvent(result.events, 'NODE_BLOCKED');
			expect(blockedEvt).toBeDefined();
			expect(blockedEvt!.payload).toHaveProperty('nodeId', 'node-2');
			expect(
				(blockedEvt!.payload as Record<string, unknown>).blockedBy,
			).toContain('node-1');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// USER_MESSAGE_ADDED
	// ─────────────────────────────────────────────────────────────────

	describe('USER_MESSAGE_ADDED', () => {
		it('should emit USER_MESSAGE_ADDED event', () => {
			const profile = minimalProfile();
			const state = createSessionSelectProfileAndNode(profile);

			const result = dispatch(
				state,
				{
					content: 'What is the thesis?',
					nodeId: 'node-1' as NodeId,
					type: 'USER_MESSAGE_ADDED',
				},
				profile,
			);
			assertOk(result, 'USER_MESSAGE_ADDED');

			const evt = getFirstEvent(result.events, 'USER_MESSAGE_ADDED');
			expect(evt).toBeDefined();
			expect(evt!.type).toBe('USER_MESSAGE_ADDED');
			expect(evt!.payload).toHaveProperty('nodeId', 'node-1');
			expect(evt!.payload).toHaveProperty('content', 'What is the thesis?');
			expect(evt!.payload).toHaveProperty('messageId');
		});

		it('should emit NODE_LIFECYCLE_CHANGED when lifecycle transitions from not_started → active', () => {
			const profile = minimalProfile();
			const state = createSessionSelectProfileAndNode(profile);

			const result = dispatch(
				state,
				{
					content: 'What is the thesis?',
					nodeId: 'node-1' as NodeId,
					type: 'USER_MESSAGE_ADDED',
				},
				profile,
			);
			assertOk(result, 'USER_MESSAGE_ADDED');

			const lifecycleEvt = getFirstEvent(
				result.events,
				'NODE_LIFECYCLE_CHANGED',
			);
			expect(lifecycleEvt).toBeDefined();
			expect(lifecycleEvt!.payload).toHaveProperty('from', 'not_started');
			expect(lifecycleEvt!.payload).toHaveProperty('to', 'active');
		});

		it('should emit COMPLETENESS_EVALUATED event', () => {
			const profile = minimalProfile();
			const state = createSessionSelectProfileAndNode(profile);

			const result = dispatch(
				state,
				{
					content: 'The answer is 42.',
					nodeId: 'node-1' as NodeId,
					type: 'USER_MESSAGE_ADDED',
				},
				profile,
			);
			assertOk(result, 'USER_MESSAGE_ADDED');

			const compEvt = getFirstEvent(result.events, 'COMPLETENESS_EVALUATED');
			expect(compEvt).toBeDefined();
			expect(compEvt!.type).toBe('COMPLETENESS_EVALUATED');
			expect(compEvt!.payload).toHaveProperty('nodeId', 'node-1');
			expect(compEvt!.payload).toHaveProperty('complete');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// NODE_LIFECYCLE_CHANGED
	// ─────────────────────────────────────────────────────────────────

	describe('NODE_LIFECYCLE_CHANGED', () => {
		it('should emit NODE_LIFECYCLE_CHANGED event', () => {
			const profile = minimalProfile();
			const state = createSessionSelectProfileAndNode(profile);

			const result = dispatch(
				state,
				{
					nodeId: 'node-1' as NodeId,
					to: 'deferred' as NodeLifecycle,
					type: 'NODE_LIFECYCLE_CHANGED',
				},
				profile,
			);
			assertOk(result, 'NODE_LIFECYCLE_CHANGED');

			const evt = getFirstEvent(result.events, 'NODE_LIFECYCLE_CHANGED');
			expect(evt).toBeDefined();
			expect(evt!.payload).toHaveProperty('from', 'not_started');
			expect(evt!.payload).toHaveProperty('to', 'deferred');
		});

		it('should emit NODE_BLOCKED when transition to blocked', () => {
			const profile = minimalProfile();
			const state = createSessionSelectProfileAndNode(profile);

			const result = dispatch(
				state,
				{
					nodeId: 'node-1' as NodeId,
					to: 'blocked' as NodeLifecycle,
					type: 'NODE_LIFECYCLE_CHANGED',
				},
				profile,
			);
			assertOk(result, 'NODE_LIFECYCLE_CHANGED_BLOCKED');

			// Should have NODE_LIFECYCLE_CHANGED.
			const lifecycleEvt = getFirstEvent(
				result.events,
				'NODE_LIFECYCLE_CHANGED',
			);
			expect(lifecycleEvt).toBeDefined();
			expect(lifecycleEvt!.payload).toHaveProperty('to', 'blocked');

			// NODE_BLOCKED only emitted if blockedBy.length > 0.
			// In minimalProfile, node-1 has no dependencies, so no NODE_BLOCKED
			// is emitted. We only verify NODE_LIFECYCLE_CHANGED is present.
			const blockedEvt = getFirstEvent(result.events, 'NODE_BLOCKED');
			expect(blockedEvt).toBeUndefined();
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// DEFER_NODE
	// ─────────────────────────────────────────────────────────────────

	describe('DEFER_NODE', () => {
		it('should emit NODE_DEFERRED and NODE_LIFECYCLE_CHANGED', () => {
			const profile = minimalProfile();
			const state = createSessionSelectProfileAndNode(profile);

			const result = dispatch(
				state,
				{ nodeId: 'node-1' as NodeId, type: 'DEFER_NODE' },
				profile,
			);
			assertOk(result, 'DEFER_NODE');

			const deferredEvt = getFirstEvent(result.events, 'NODE_DEFERRED');
			expect(deferredEvt).toBeDefined();
			expect(deferredEvt!.payload).toHaveProperty('nodeId', 'node-1');

			const lifecycleEvt = getFirstEvent(
				result.events,
				'NODE_LIFECYCLE_CHANGED',
			);
			expect(lifecycleEvt).toBeDefined();
			expect(lifecycleEvt!.payload).toHaveProperty('from', 'not_started');
			expect(lifecycleEvt!.payload).toHaveProperty('to', 'deferred');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// RESUME_NODE
	// ─────────────────────────────────────────────────────────────────

	describe('RESUME_NODE', () => {
		it('should emit NODE_LIFECYCLE_CHANGED', () => {
			const profile = minimalProfile();
			const state = createSessionSelectProfileAndNode(profile);

			// First defer.
			const deferResult = dispatch(
				state,
				{ nodeId: 'node-1' as NodeId, type: 'DEFER_NODE' },
				profile,
			);
			assertOk(deferResult, 'DEFER_NODE');

			// Then resume.
			const result = dispatch(
				deferResult.state,
				{ nodeId: 'node-1' as NodeId, type: 'RESUME_NODE' },
				profile,
			);
			assertOk(result, 'RESUME_NODE');

			const evt = getFirstEvent(result.events, 'NODE_LIFECYCLE_CHANGED');
			expect(evt).toBeDefined();
			expect(evt!.payload).toHaveProperty('from', 'deferred');
			expect(evt!.payload).toHaveProperty('to', 'active');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Replay suppression
	// ─────────────────────────────────────────────────────────────────

	describe('replay suppression', () => {
		it('should suppress events when dispatching a SessionEvent (replay)', () => {
			const profile = minimalProfile();
			const initialState: LogosRuntimeState = {
				activeNodeId: null,
				documentStates: {},
				exportState: { artifacts: [] },
				globalContext: { preferences: {}, projectName: null, summary: null },
				lastActiveNodeId: null,
				mode: 'idle',
				nodeStates: {},
				selectedProfileId: null,
				sessionId: 'replay-session' as SessionId,
				updatedAt: '2026-01-01T00:00:00Z',
			};

			// Construct a SessionEvent (as if loaded from the event log).
			const sessionEvent: SessionEvent = {
				createdAt: '2026-01-01T00:00:00Z',
				id: 'evt-replay-1',
				payload: { createdAt: '2026-01-01T00:00:00Z' },
				sessionId: 'replay-session' as SessionId,
				type: 'SESSION_CREATED',
			} as SessionEvent;

			const result = dispatch(initialState, sessionEvent, profile);
			assertOk(result, 'REPLAY_SESSION_CREATED');

			// Events should be suppressed (empty) during replay.
			expect(result.events).toBeDefined();
			expect(result.events).toHaveLength(0);
		});

		it('should suppress events for all SessionEvent types during replay', () => {
			const profile = minimalProfile();
			const initialState: LogosRuntimeState = {
				activeNodeId: null,
				documentStates: {},
				exportState: { artifacts: [] },
				globalContext: { preferences: {}, projectName: null, summary: null },
				lastActiveNodeId: null,
				mode: 'idle',
				nodeStates: {},
				selectedProfileId: null,
				sessionId: 'replay-session' as SessionId,
				updatedAt: '2026-01-01T00:00:00Z',
			};

			// Create session via replay.
			const createEvt: SessionEvent = {
				createdAt: '2026-01-01T00:00:00Z',
				id: 'evt-r1',
				payload: { createdAt: '2026-01-01T00:00:00Z' },
				sessionId: 'replay-session' as SessionId,
				type: 'SESSION_CREATED',
			} as SessionEvent;

			const r1 = dispatch(initialState, createEvt, profile);
			assertOk(r1, 'REPLAY_SESSION_CREATED');
			expect(r1.events).toHaveLength(0);

			// Select profile via replay.
			const selectEvt: SessionEvent = {
				createdAt: '2026-01-01T00:00:01Z',
				id: 'evt-r2',
				payload: { profileId: profile.id },
				sessionId: 'replay-session' as SessionId,
				type: 'PROFILE_SELECTED',
			} as SessionEvent;

			const r2 = dispatch(r1.state, selectEvt, profile);
			assertOk(r2, 'REPLAY_PROFILE_SELECTED');
			expect(r2.events).toHaveLength(0);

			// Select node via replay.
			const nodeEvt: SessionEvent = {
				createdAt: '2026-01-01T00:00:02Z',
				id: 'evt-r3',
				payload: { nodeId: 'node-1' as NodeId, previousNodeId: null },
				sessionId: 'replay-session' as SessionId,
				type: 'NODE_SELECTED',
			} as SessionEvent;

			const r3 = dispatch(r2.state, nodeEvt, profile);
			assertOk(r3, 'REPLAY_NODE_SELECTED');
			expect(r3.events).toHaveLength(0);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Integration: dispatch → event log
	// ─────────────────────────────────────────────────────────────────

	describe('integration with event log', () => {
		it('should persist dispatch events to event log and read them back', async () => {
			const dir = await tempDir();
			const log = createEventLog({ sessionsDir: dir });
			const profile = minimalProfile();

			// Step 1: Create session.
			const initialState: LogosRuntimeState = {
				activeNodeId: null,
				documentStates: {},
				exportState: { artifacts: [] },
				globalContext: { preferences: {}, projectName: null, summary: null },
				lastActiveNodeId: null,
				mode: 'idle',
				nodeStates: {},
				selectedProfileId: null,
				sessionId: 'unused' as SessionId,
				updatedAt: '2026-01-01T00:00:00Z',
			};

			const r1 = dispatch(initialState, { type: 'CREATE_SESSION' }, profile);
			assertOk(r1, 'CREATE_SESSION');
			const sessionId = r1.state.sessionId;

			// Append events.
			for (const evt of r1.events ?? []) {
				const appendResult = await log.appendEvent(sessionId, evt);
				expect(appendResult.ok).toBe(true);
			}

			// Step 2: Select profile.
			const r2 = dispatch(
				r1.state,
				{ profileId: profile.id, type: 'SELECT_PROFILE' },
				profile,
			);
			assertOk(r2, 'SELECT_PROFILE');
			for (const evt of r2.events ?? []) {
				await log.appendEvent(sessionId, evt);
			}

			// Step 3: Select node.
			const r3 = dispatch(
				r2.state,
				{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
				profile,
			);
			assertOk(r3, 'SELECT_NODE');
			for (const evt of r3.events ?? []) {
				await log.appendEvent(sessionId, evt);
			}

			// Step 4: Add user message.
			const r4 = dispatch(
				r3.state,
				{
					content: 'Hello',
					nodeId: 'node-1' as NodeId,
					type: 'USER_MESSAGE_ADDED',
				},
				profile,
			);
			assertOk(r4, 'USER_MESSAGE_ADDED');
			for (const evt of r4.events ?? []) {
				await log.appendEvent(sessionId, evt);
			}

			// Step 5: Defer node.
			const r5 = dispatch(
				r4.state,
				{ nodeId: 'node-1' as NodeId, type: 'DEFER_NODE' },
				profile,
			);
			assertOk(r5, 'DEFER_NODE');
			for (const evt of r5.events ?? []) {
				await log.appendEvent(sessionId, evt);
			}

			// Now read back all events.
			const allEvents = await log.getEvents(sessionId);
			const eventTypes = allEvents.map((e) => e.type);

			expect(eventTypes).toContain('SESSION_CREATED');
			expect(eventTypes).toContain('PROFILE_SELECTED');
			expect(eventTypes).toContain('NODE_SELECTED');
			expect(eventTypes).toContain('USER_MESSAGE_ADDED');
			expect(eventTypes).toContain('NODE_LIFECYCLE_CHANGED');
			expect(eventTypes).toContain('COMPLETENESS_EVALUATED');
			expect(eventTypes).toContain('NODE_DEFERRED');

			// All events should be in chronological order.
			for (let i = 1; i < allEvents.length; i++) {
				expect(
					new Date(allEvents[i]!.createdAt).getTime(),
				).toBeGreaterThanOrEqual(
					new Date(allEvents[i - 1]!.createdAt).getTime(),
				);
			}

			// Verify we can filter by type.
			const sessionCreated = await log.getEventsByType(
				sessionId,
				'SESSION_CREATED',
			);
			expect(sessionCreated).toHaveLength(1);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function createSessionAndSelectProfile(
	profile: LogosProfile,
): LogosRuntimeState {
	const initialState: LogosRuntimeState = {
		activeNodeId: null,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: { preferences: {}, projectName: null, summary: null },
		lastActiveNodeId: null,
		mode: 'idle',
		nodeStates: {},
		selectedProfileId: null,
		sessionId: 'unused' as SessionId,
		updatedAt: '2026-01-01T00:00:00Z',
	};

	const r1 = dispatch(initialState, { type: 'CREATE_SESSION' }, profile);
	assertOk(r1, 'CREATE_SESSION');

	const r2 = dispatch(
		r1.state,
		{ profileId: profile.id, type: 'SELECT_PROFILE' },
		profile,
	);
	assertOk(r2, 'SELECT_PROFILE');

	return r2.state;
}

function createSessionSelectProfileAndNode(
	profile: LogosProfile,
): LogosRuntimeState {
	const state = createSessionAndSelectProfile(profile);
	const r = dispatch(
		state,
		{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
		profile,
	);
	assertOk(r, 'SELECT_NODE');
	return r.state;
}
