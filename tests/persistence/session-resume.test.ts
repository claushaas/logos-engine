/**
 * Tests for Step 13.3 — session resume with validation and repair.
 *
 * Covers:
 *  - Resume from valid snapshot restores active node, profile, and node states.
 *  - Omitted sessionId loads the latest session.
 *  - Invalid activeNodeId is cleared with diagnostic.
 *  - Missing profile returns recoverable error with reselect recovery.
 *  - Accepted node missing canonical answer returns error.
 *  - Accepted node with `accepted: false` repairs flag with diagnostic.
 *  - Migration runs when schema version differs.
 *  - No sessions found returns appropriate error.
 */
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type {
	CanonicalAnswer,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { Migration } from '../../src/contracts/persistence.js';
import {
	resumeSession,
	resumeSessionWithDiagnostics,
} from '../../src/persistence/session-resume.js';
import {
	CURRENT_SCHEMA_VERSION,
	createSnapshotStore,
	type SnapshotStore,
} from '../../src/persistence/snapshot-store.js';
import type {
	DocumentId,
	NodeId,
	ProfileId,
	SessionId,
} from '../../src/shared/index.js';
import { err, nowIso, ok, type Result } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function tempDir(): Promise<string> {
	return realpath(await mkdtemp(join(tmpdir(), 'logos-resume-test-')));
}

async function freshStore(): Promise<SnapshotStore> {
	const dir = await tempDir();
	return createSnapshotStore({ sessionsDir: dir });
}

// ─── State fixtures ─────────────────────────────────────────────────────────

function idleState(sessionId = 'sess-1'): LogosRuntimeState {
	return {
		activeNodeId: null,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'idle',
		nodeStates: {},
		selectedProfileId: null,
		sessionId: sessionId as SessionId,
		updatedAt: nowIso(),
	};
}

function nodeFocusedState(
	sessionId = 'sess-1',
	activeNodeId: NodeId = 'n1' as NodeId,
	profileId: ProfileId = 'p1' as ProfileId,
): LogosRuntimeState {
	const nodeState: NodeRuntimeState = {
		allowedActions: ['answer'],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			missing: ['topic-1'],
			sufficient: [],
			weak: [],
		},
		conversation: [
			{
				content: 'Hello',
				createdAt: nowIso(),
				id: 'msg-1',
				role: 'user',
			},
			{
				content: 'Hi there!',
				createdAt: nowIso(),
				id: 'msg-2',
				role: 'assistant',
			},
		],
		dependencies: {
			blockedBy: [],
			locks: [],
			requiredNodeIds: [],
			unlocks: [],
		},
		extracted: { assumptions: [], decisions: [], facts: [] },
		lastAssistantMessageId: 'msg-2',
		lastUserMessageId: 'msg-1',
		lifecycle: 'active',
		nodeId: activeNodeId,
		promptState: 'follow_up',
		updatedAt: nowIso(),
	};

	return {
		activeNodeId,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'node_focus',
		nodeStates: {
			[activeNodeId]: nodeState,
		} as Record<NodeId, NodeRuntimeState>,
		selectedProfileId: profileId,
		sessionId: sessionId as SessionId,
		updatedAt: nowIso(),
	};
}

function testProfile(): LogosProfile {
	return {
		description: 'Test profile',
		documents: [
			{
				id: 'd1' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'ph1',
				purpose: 'Testing',
				requiredNodeIds: ['n1' as NodeId],
				title: 'Doc 1',
			},
		],
		id: 'p1' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What?',
				coverageTopics: ['topic-1'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'd1' as DocumentId,
				id: 'n1' as NodeId,
				order: 1,
				phaseId: 'ph1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node 1',
			},
		],
		phases: [
			{
				id: 'ph1',
				order: 1,
				purpose: 'Phase 1',
				title: 'Phase 1',
			},
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

/**
 * Profile loader that always succeeds with a test profile.
 */
function testProfileLoader(): (
	profileId: ProfileId,
) => Result<LogosProfile, unknown> {
	return (profileId) => {
		// Only match 'p1'.
		if (profileId === 'p1') return ok(testProfile());
		return err(new Error(`Profile "${profileId}" not found`));
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('resumeSessionWithDiagnostics', () => {
	let store: SnapshotStore;

	afterEach(async () => {
		// OS tmp directory handles cleanup.
	});

	async function setupStore(): Promise<SnapshotStore> {
		store = await freshStore();
		return store;
	}

	// ─────────────────────────────────────────────────────────────────
	// Valid resume
	// ─────────────────────────────────────────────────────────────────

	describe('valid resume', () => {
		it('should restore active node, profile, and node states', async () => {
			const s = await setupStore();
			const state = nodeFocusedState('sess-1');
			await s.saveSnapshot('sess-1', state);

			const result = await resumeSessionWithDiagnostics('sess-1', {
				loadProfile: testProfileLoader(),
				store: s,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			const restored = result.value;
			expect(restored.state.activeNodeId).toBe('n1');
			expect(restored.state.selectedProfileId).toBe('p1');
			expect(restored.state.mode).toBe('node_focus');

			const nodeState = restored.state.nodeStates['n1' as NodeId];
			expect(nodeState).toBeDefined();
			expect(nodeState!.lifecycle).toBe('active');
			expect(nodeState!.conversation).toHaveLength(2);

			// Should have diagnostic about restored active node.
			expect(restored.diagnostics.length).toBeGreaterThanOrEqual(1);
			expect(
				restored.diagnostics.some(
					(d) => d.code === 'LOGOS_RESUME_RESTORED_ACTIVE_NODE',
				),
			).toBe(true);
		});

		it('should restore conversation messages intact', async () => {
			const s = await setupStore();
			const state = nodeFocusedState('sess-conv');
			await s.saveSnapshot('sess-conv', state);

			const result = await resumeSessionWithDiagnostics('sess-conv', {
				loadProfile: testProfileLoader(),
				store: s,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			const nodeState = result.value.state.nodeStates['n1' as NodeId];
			expect(nodeState).toBeDefined();
			expect(nodeState!.conversation[0].content).toBe('Hello');
			expect(nodeState!.conversation[1].content).toBe('Hi there!');
		});

		it('resumeSession contract returns LogosRuntimeState directly', async () => {
			const s = await setupStore();
			const state = nodeFocusedState('sess-contract');
			await s.saveSnapshot('sess-contract', state);

			const result = await resumeSession('sess-contract', {
				loadProfile: testProfileLoader(),
				store: s,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			// resumeSession returns LogosRuntimeState directly, not wrapped in ResumeResult.
			const runtimeState = result.value;
			expect(runtimeState.sessionId).toBe('sess-contract');
			expect(runtimeState.activeNodeId).toBe('n1');
			expect(runtimeState.selectedProfileId).toBe('p1');
			expect(runtimeState.mode).toBe('node_focus');

			const nodeState = runtimeState.nodeStates['n1' as NodeId];
			expect(nodeState).toBeDefined();
			expect(nodeState!.lifecycle).toBe('active');
			expect(nodeState!.conversation).toHaveLength(2);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Omitted sessionId — load latest
	// ─────────────────────────────────────────────────────────────────

	describe('omitted sessionId', () => {
		it('should load the latest session when sessionId is omitted', async () => {
			const s = await setupStore();
			// Save two sessions — the later one should be loaded.
			await s.saveSnapshot('old-session', idleState('old-session'));
			await s.saveSnapshot(
				'latest-session',
				nodeFocusedState('latest-session'),
			);

			const result = await resumeSessionWithDiagnostics(undefined, {
				loadProfile: testProfileLoader(),
				store: s,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value.state.sessionId).toBe('latest-session');
		});

		it('should error when no sessions exist', async () => {
			const s = await setupStore();
			// No sessions saved.

			const result = await resumeSessionWithDiagnostics(undefined, {
				store: s,
			});

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('RESUME_NO_SESSIONS');
			expect(result.error.recoverable).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Invalid activeNodeId — cleared with diagnostic
	// ─────────────────────────────────────────────────────────────────

	describe('invalid activeNodeId', () => {
		it('should clear activeNodeId when node not in profile', async () => {
			const s = await setupStore();
			// State references 'n99' which does not exist in the test profile.
			const state = nodeFocusedState('sess-bad-node', 'n99' as NodeId);
			await s.saveSnapshot('sess-bad-node', state);

			const result = await resumeSessionWithDiagnostics('sess-bad-node', {
				loadProfile: testProfileLoader(),
				store: s,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			expect(result.value.state.activeNodeId).toBeNull();
			expect(result.value.state.mode).toBe('structure_overview');
			expect(
				result.value.diagnostics.some(
					(d) => d.code === 'LOGOS_RESUME_CLEARED_INVALID_ACTIVE_NODE',
				),
			).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Missing profile — recoverable error
	// ─────────────────────────────────────────────────────────────────

	describe('missing profile', () => {
		it('should return recoverable error when profile cannot be loaded', async () => {
			const s = await setupStore();
			const state = nodeFocusedState(
				'sess-no-profile',
				'n1' as NodeId,
				'unknown-p' as ProfileId,
			);
			await s.saveSnapshot('sess-no-profile', state);

			const result = await resumeSessionWithDiagnostics('sess-no-profile', {
				loadProfile: testProfileLoader(), // Only matches 'p1'.
				store: s,
			});

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('RESUME_PROFILE_NOT_FOUND');
			expect(result.error.recoveryOptions).toContain('select_new_profile');

			// Should include a repaired state (profile cleared).
			expect(result.error.repairedState).toBeDefined();
			expect(result.error.repairedState!.selectedProfileId).toBeNull();
		});

		it('should return idle state when selectedProfileId is null', async () => {
			const s = await setupStore();
			await s.saveSnapshot(
				'sess-no-profile-null',
				idleState('sess-no-profile-null'),
			);

			const result = await resumeSessionWithDiagnostics(
				'sess-no-profile-null',
				{
					store: s,
				},
			);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value.state.mode).toBe('idle');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Accepted node missing canonical answer — error
	// ─────────────────────────────────────────────────────────────────

	describe('accepted node missing canonical answer', () => {
		it('should return error for accepted node without canonical answer', async () => {
			const s = await setupStore();

			// Build a state with an accepted node but no canonical answer.
			const state = nodeFocusedState('sess-missing-ca');
			const nodeState = state.nodeStates['n1' as NodeId]!;
			state.nodeStates = {
				['n1' as NodeId]: {
					...nodeState,
					canonicalAnswer: null,
					lifecycle: 'accepted' as const,
				},
			} as Record<NodeId, NodeRuntimeState>;

			await s.saveSnapshot('sess-missing-ca', state);

			const result = await resumeSessionWithDiagnostics('sess-missing-ca', {
				loadProfile: testProfileLoader(),
				store: s,
			});

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe(
				'RESUME_ACCEPTED_NODE_MISSING_CANONICAL_ANSWER',
			);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Accepted node with `accepted: false` — repaired
	// ─────────────────────────────────────────────────────────────────

	describe('repair accepted node with accepted: false', () => {
		it('should repair accepted flag on canonical answer', async () => {
			const s = await setupStore();

			const ca: CanonicalAnswer = {
				accepted: false, // Should be true for an accepted node.
				acceptedAt: undefined,
				confidence: 'high',
				content: 'The answer',
				format: 'markdown',
				generatedAt: nowIso(),
				generatedFromMessageIds: ['msg-1'],
				stale: false,
			};

			const state = nodeFocusedState('sess-repair-ca');
			const nodeState = state.nodeStates['n1' as NodeId]!;
			state.nodeStates = {
				['n1' as NodeId]: {
					...nodeState,
					canonicalAnswer: ca,
					lifecycle: 'accepted' as const,
				},
			} as Record<NodeId, NodeRuntimeState>;

			await s.saveSnapshot('sess-repair-ca', state);

			const result = await resumeSessionWithDiagnostics('sess-repair-ca', {
				loadProfile: testProfileLoader(),
				store: s,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			const repairedNode = result.value.state.nodeStates['n1' as NodeId];
			expect(repairedNode).toBeDefined();
			expect(repairedNode!.canonicalAnswer!.accepted).toBe(true);

			// Should have repair diagnostic.
			expect(
				result.value.diagnostics.some(
					(d) => d.code === 'LOGOS_RESUME_REPAIRED_CANONICAL_ANSWER_ACCEPTED',
				),
			).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Migration
	// ─────────────────────────────────────────────────────────────────

	describe('migration', () => {
		it('should run migration when schema version differs', async () => {
			const s = await setupStore();

			// Save a snapshot with a fake schema version.
			const state = idleState('sess-migrate');
			await s.saveSnapshot('sess-migrate', state);

			// Override the schema version in the saved file.
			// We need to patch the loaded snapshot. Since the store's loadSnapshot
			// validates schemaVersion, we need a mock store for this test.
			// For a simpler approach, we'll create a custom store with injection.
			//
			// Actually, the snapshot-store writes CURRENT_SCHEMA_VERSION.
			// For migration tests we need to test runMigrations directly, or
			// create a fake snapshot store. Let's use an in-memory store.

			const snapshots = new Map<string, string>();
			const fakeStore: SnapshotStore = {
				listSessions: async () => {
					const entries: {
						sessionId: string;
						savedAt: string;
						schemaVersion: string;
					}[] = [];
					for (const [sid, json] of snapshots) {
						const parsed = JSON.parse(json);
						entries.push({
							savedAt: parsed.savedAt ?? nowIso(),
							schemaVersion: parsed.schemaVersion ?? CURRENT_SCHEMA_VERSION,
							sessionId: sid,
						});
					}
					entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
					return entries;
				},
				loadSnapshot: async (sid: string) => {
					const raw = snapshots.get(sid);
					if (raw === undefined) {
						return err({
							code: 'PERSISTENCE_SESSION_NOT_FOUND',
							message: `Session "${sid}" not found.`,
							recoverable: true,
							recoveryOptions: [],
						});
					}
					const parsed = JSON.parse(raw);
					return ok({
						runtimeState: parsed.runtimeState,
						savedAt: parsed.savedAt,
						schemaVersion: parsed.schemaVersion,
						sessionId: sid as SessionId,
					});
				},
				saveSnapshot: async (_sid, _state) => ok(undefined),
			};

			// Save a snapshot with an older schema version.
			const oldState = idleState('sess-migrate');
			snapshots.set(
				'sess-migrate',
				JSON.stringify({
					runtimeState: oldState,
					savedAt: nowIso(),
					schemaVersion: '0.9.0',
					sessionId: 'sess-migrate',
				}),
			);

			const migration: Migration = {
				from: '0.9.0',
				migrate: (data: unknown) => {
					const s2 = data as LogosRuntimeState;
					return {
						...s2,
						globalContext: {
							...s2.globalContext,
							projectName: 'migrated',
						},
					} as LogosRuntimeState;
				},
				to: '1.0.0',
			};

			const result = await resumeSessionWithDiagnostics('sess-migrate', {
				migrations: [migration],
				store: fakeStore,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value.state.globalContext.projectName).toBe('migrated');
			expect(
				result.value.diagnostics.some(
					(d) => d.code === 'LOGOS_RESUME_MIGRATION_APPLIED',
				),
			).toBe(true);
		});
	});
});
