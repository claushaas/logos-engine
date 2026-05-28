/**
 * Tests for Step 15.3 — snapshot round-trip integrity.
 *
 * Covers:
 *  - saveSnapshot → loadSnapshot preserves all state fields.
 *  - Idle state round-trip.
 *  - Node-focused state round-trip with conversations and canonical answers.
 *  - Multiple node states round-trip.
 *  - Document states and export artifacts round-trip.
 *  - Global context round-trip.
 *  - Repeated saves overwrite with full state.
 *  - Special-character session IDs round-trip via encoded filenames.
 *  - Corrupted JSON returns PERSISTENCE_CORRUPT_SNAPSHOT.
 *  - Missing snapshot returns PERSISTENCE_SESSION_NOT_FOUND.
 *  - listSessions returns sessions with correct metadata.
 *  - schemaVersion is CURRENT_SCHEMA_VERSION.
 */
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type {
	CanonicalAnswer,
	DocumentRuntimeState,
	ExportRuntimeState,
	GeneratedArtifact,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
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
import { nowIso } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function tempDir(): Promise<string> {
	return realpath(await mkdtemp(join(tmpdir(), 'logos-snapshot-test-')));
}

async function freshStore(): Promise<SnapshotStore> {
	const dir = await tempDir();
	return createSnapshotStore({ sessionsDir: dir });
}

// ─── Rich state fixture — covers all state fields ──────────────────────────

/**
 * Build a fully-populated LogosRuntimeState that exercises every field:
 * idle/non-idle mode, multiple node states with conversations, accepted
 * canonical answers, document states, export artifacts, global context,
 * lastActiveNodeId, and updatedAt.
 */
function richState(sessionId = 'sess-rich'): LogosRuntimeState {
	// ── Canonical answer fixture ─────────────────────────────────────
	const canonicalAnswer: CanonicalAnswer = {
		accepted: true,
		acceptedAt: '2026-01-15T12:00:00Z',
		confidence: 'high',
		content: '## The Answer\n\nThis is the definitive answer for node n1.',
		format: 'markdown',
		generatedAt: '2026-01-15T11:00:00Z',
		generatedFromMessageIds: ['msg-1', 'msg-2'],
		stale: false,
	};

	// ── Node state n1 — accepted with conversation and canonical answer ─
	const n1State: NodeRuntimeState = {
		allowedActions: ['continue_next', 'reopen', 'open_document_preview'],
		canonicalAnswer,
		completeness: {
			blockingIssues: [],
			complete: true,
			missing: [],
			sufficient: ['topic-1', 'topic-2'],
			weak: [],
		},
		conversation: [
			{
				content: 'What is the problem we are solving?',
				createdAt: '2026-01-15T10:00:00Z',
				id: 'msg-1',
				role: 'user',
			},
			{
				content:
					'We are solving the problem of fragmented documentation workflows.',
				createdAt: '2026-01-15T10:01:00Z',
				id: 'msg-2',
				role: 'assistant',
			},
			{
				content: 'Who is the target audience?',
				createdAt: '2026-01-15T10:02:00Z',
				id: 'msg-3',
				role: 'user',
			},
			{
				content: 'Software teams writing technical documentation.',
				createdAt: '2026-01-15T10:03:00Z',
				id: 'msg-4',
				role: 'assistant',
			},
		],
		dependencies: {
			blockedBy: [],
			locks: [],
			requiredNodeIds: [],
			unlocks: ['n2' as NodeId],
		},
		extracted: {
			assumptions: ['Users prefer CLI tools'],
			decisions: ['Use TypeScript for type safety'],
			facts: ['Documentation is critical for onboarding'],
		},
		lastAssistantMessageId: 'msg-4',
		lastUserMessageId: 'msg-3',
		lifecycle: 'accepted',
		nodeId: 'n1' as NodeId,
		promptState: 'accepted',
		updatedAt: '2026-01-15T12:00:00Z',
	};

	// ── Node state n2 — active in progress, no canonical answer yet ──
	const n2State: NodeRuntimeState = {
		allowedActions: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			missing: ['topic-a', 'topic-b'],
			sufficient: [],
			weak: ['topic-c'],
		},
		conversation: [
			{
				content: 'Describe the solution approach.',
				createdAt: '2026-01-15T12:30:00Z',
				id: 'msg-5',
				role: 'user',
			},
		],
		dependencies: {
			blockedBy: [],
			locks: [],
			requiredNodeIds: ['n1' as NodeId],
			unlocks: [],
		},
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
		},
		lastAssistantMessageId: undefined,
		lastUserMessageId: 'msg-5',
		lifecycle: 'active',
		nodeId: 'n2' as NodeId,
		promptState: 'initial',
		updatedAt: '2026-01-15T12:30:00Z',
	};

	// ── Document state — ready for materialization ───────────────────
	const docState: DocumentRuntimeState = {
		documentId: 'd1' as DocumentId,
		draft: {
			content: '# Project Overview\n\nThis is a draft.',
			documentId: 'd1' as DocumentId,
			format: 'markdown',
			generatedAt: '2026-01-15T13:00:00Z',
			missingSections: [],
			sourceNodeIds: ['n1' as NodeId],
			stale: false,
		},
		missingRequiredNodeIds: [],
		requiredNodeIds: ['n1' as NodeId],
		optionalNodeIds: ['n2' as NodeId],
		sourceNodeIds: ['n1' as NodeId, 'n2' as NodeId],
		staleSourceNodeIds: [],
		status: 'drafted',
		updatedAt: '2026-01-15T13:00:00Z',
	};

	// ── Export state — one generated artifact ────────────────────────
	const artifact: GeneratedArtifact = {
		format: 'markdown',
		generatedAt: '2026-01-15T14:00:00Z',
		id: 'art-1',
		path: '/output/overview.md',
		sessionId: sessionId as SessionId,
		sourceDocumentIds: ['d1' as DocumentId],
		sourceNodeIds: ['n1' as NodeId],
		stale: false,
		type: 'markdown',
	};

	const exportState: ExportRuntimeState = {
		artifacts: [artifact],
	};

	// ── Assemble ─────────────────────────────────────────────────────
	return {
		activeNodeId: 'n2' as NodeId,
		documentStates: {
			['d1' as DocumentId]: docState,
		} as Record<DocumentId, DocumentRuntimeState>,
		exportState,
		globalContext: {
			preferences: {
				outputFormat: 'markdown',
				verbose: false,
			},
			projectName: 'LOGOS Engine',
			summary: 'A conversation-first documentation engine.',
		},
		lastActiveNodeId: 'n1' as NodeId,
		mode: 'node_focus',
		nodeStates: {
			['n1' as NodeId]: n1State,
			['n2' as NodeId]: n2State,
		} as Record<NodeId, NodeRuntimeState>,
		selectedProfileId: 'p1' as ProfileId,
		sessionId: sessionId as SessionId,
		updatedAt: '2026-01-15T14:00:00Z',
	};
}

/**
 * Minimal idle state for boundary tests.
 */
function idleState(sessionId = 'sess-idle'): LogosRuntimeState {
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

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('snapshot round-trip', () => {
	let store: SnapshotStore;

	afterEach(async () => {
		// OS tmp directory handles cleanup.
	});

	async function setupStore(): Promise<SnapshotStore> {
		store = await freshStore();
		return store;
	}

	// ─────────────────────────────────────────────────────────────────
	// Rich state round-trip — all fields preserved
	// ─────────────────────────────────────────────────────────────────

	describe('rich state round-trip', () => {
		it('should preserve all LogosRuntimeState fields on round-trip', async () => {
			const s = await setupStore();
			const state = richState('sess-all');

			const saveResult = await s.saveSnapshot('sess-all', state);
			expect(saveResult.ok).toBe(true);

			const loadResult = await s.loadSnapshot('sess-all');
			expect(loadResult.ok).toBe(true);
			if (!loadResult.ok) throw new Error('Expected success');

			const snapshot = loadResult.value;

			// ── Deep equality check — proves all state fields are preserved ─
			expect(snapshot.runtimeState).toEqual(state);

			// ── Top-level metadata ──────────────────────────────────
			expect(snapshot.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
			expect(snapshot.sessionId).toBe('sess-all');
			expect(typeof snapshot.savedAt).toBe('string');
			expect(snapshot.savedAt.length).toBeGreaterThan(0);

			const restored = snapshot.runtimeState;

			// ── Core identity fields ────────────────────────────────
			expect(restored.sessionId).toBe('sess-all');
			expect(restored.selectedProfileId).toBe('p1');
			expect(restored.activeNodeId).toBe('n2');
			expect(restored.mode).toBe('node_focus');
			expect(restored.lastActiveNodeId).toBe('n1');
			expect(restored.updatedAt).toBe('2026-01-15T14:00:00Z');

			// ── Global context ──────────────────────────────────────
			expect(restored.globalContext.projectName).toBe('LOGOS Engine');
			expect(restored.globalContext.summary).toBe(
				'A conversation-first documentation engine.',
			);
			expect(restored.globalContext.preferences).toEqual({
				outputFormat: 'markdown',
				verbose: false,
			});

			// ── Node states — n1 (accepted) ─────────────────────────
			const n1 = restored.nodeStates['n1' as NodeId];
			expect(n1).toBeDefined();
			expect(n1!.lifecycle).toBe('accepted');
			expect(n1!.promptState).toBe('accepted');
			expect(n1!.nodeId).toBe('n1');
			expect(n1!.conversation).toHaveLength(4);
			expect(n1!.conversation[0].content).toBe(
				'What is the problem we are solving?',
			);
			expect(n1!.conversation[0].role).toBe('user');
			expect(n1!.conversation[0].id).toBe('msg-1');
			expect(n1!.conversation[3].content).toBe(
				'Software teams writing technical documentation.',
			);
			expect(n1!.lastUserMessageId).toBe('msg-3');
			expect(n1!.lastAssistantMessageId).toBe('msg-4');

			// Canonical answer.
			expect(n1!.canonicalAnswer).not.toBeNull();
			expect(n1!.canonicalAnswer!.accepted).toBe(true);
			expect(n1!.canonicalAnswer!.acceptedAt).toBe('2026-01-15T12:00:00Z');
			expect(n1!.canonicalAnswer!.confidence).toBe('high');
			expect(n1!.canonicalAnswer!.content).toContain('The Answer');
			expect(n1!.canonicalAnswer!.format).toBe('markdown');
			expect(n1!.canonicalAnswer!.generatedAt).toBe('2026-01-15T11:00:00Z');
			expect(n1!.canonicalAnswer!.generatedFromMessageIds).toEqual([
				'msg-1',
				'msg-2',
			]);
			expect(n1!.canonicalAnswer!.stale).toBe(false);

			// Completeness.
			expect(n1!.completeness.complete).toBe(true);
			expect(n1!.completeness.sufficient).toEqual(['topic-1', 'topic-2']);
			expect(n1!.completeness.missing).toEqual([]);
			expect(n1!.completeness.weak).toEqual([]);
			expect(n1!.completeness.blockingIssues).toEqual([]);

			// Extracted data.
			expect(n1!.extracted.assumptions).toEqual(['Users prefer CLI tools']);
			expect(n1!.extracted.decisions).toEqual(['Use TypeScript for type safety']);
			expect(n1!.extracted.facts).toEqual([
				'Documentation is critical for onboarding',
			]);

			// Dependencies.
			expect(n1!.dependencies.requiredNodeIds).toEqual([]);
			expect(n1!.dependencies.blockedBy).toEqual([]);
			expect(n1!.dependencies.unlocks).toEqual(['n2']);

			// Allowed actions.
			expect(n1!.allowedActions).toContain('continue_next');
			expect(n1!.allowedActions).toContain('reopen');
			expect(n1!.allowedActions).toContain('open_document_preview');

			// ── Node states — n2 (active) ───────────────────────────
			const n2 = restored.nodeStates['n2' as NodeId];
			expect(n2).toBeDefined();
			expect(n2!.lifecycle).toBe('active');
			expect(n2!.promptState).toBe('initial');
			expect(n2!.nodeId).toBe('n2');
			expect(n2!.conversation).toHaveLength(1);
			expect(n2!.conversation[0].content).toBe(
				'Describe the solution approach.',
			);
			expect(n2!.lastUserMessageId).toBe('msg-5');
			expect(n2!.lastAssistantMessageId).toBeUndefined();
			expect(n2!.canonicalAnswer).toBeNull();
			expect(n2!.completeness.complete).toBe(false);
			expect(n2!.completeness.missing).toEqual(['topic-a', 'topic-b']);
			expect(n2!.completeness.weak).toEqual(['topic-c']);
			expect(n2!.dependencies.requiredNodeIds).toEqual(['n1']);
			expect(n2!.allowedActions).toContain('answer');
			expect(n2!.allowedActions).toContain('defer');

			// ── Document states ─────────────────────────────────────
			expect(Object.keys(restored.documentStates)).toHaveLength(1);
			const doc = restored.documentStates['d1' as DocumentId];
			expect(doc).toBeDefined();
			expect(doc!.documentId).toBe('d1');
			expect(doc!.status).toBe('drafted');
			expect(doc!.requiredNodeIds).toEqual(['n1']);
			expect(doc!.optionalNodeIds).toEqual(['n2']);
			expect(doc!.sourceNodeIds).toEqual(['n1', 'n2']);
			expect(doc!.missingRequiredNodeIds).toEqual([]);
			expect(doc!.staleSourceNodeIds).toEqual([]);

			// Document draft.
			expect(doc!.draft).toBeDefined();
			expect(doc!.draft!.content).toContain('Project Overview');
			expect(doc!.draft!.format).toBe('markdown');
			expect(doc!.draft!.documentId).toBe('d1');
			expect(doc!.draft!.sourceNodeIds).toEqual(['n1']);
			expect(doc!.draft!.missingSections).toEqual([]);
			expect(doc!.draft!.stale).toBe(false);

			// ── Export state ────────────────────────────────────────
			expect(restored.exportState.artifacts).toHaveLength(1);
			const art = restored.exportState.artifacts[0]!;
			expect(art.id).toBe('art-1');
			expect(art.type).toBe('markdown');
			expect(art.format).toBe('markdown');
			expect(art.path).toBe('/output/overview.md');
			expect(art.sourceDocumentIds).toEqual(['d1']);
			expect(art.sourceNodeIds).toEqual(['n1']);
			expect(art.sessionId).toBe('sess-all');
			expect(art.stale).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Idle state round-trip
	// ─────────────────────────────────────────────────────────────────

	describe('idle state round-trip', () => {
		it('should preserve an idle state exactly', async () => {
			const s = await setupStore();
			const state = idleState('sess-idle-test');
			await s.saveSnapshot('sess-idle-test', state);

			const result = await s.loadSnapshot('sess-idle-test');
			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			// Deep equality — proves idle state round-trips exactly.
			expect(result.value.runtimeState).toEqual(state);

			const restored = result.value.runtimeState;
			expect(restored.sessionId).toBe('sess-idle-test');
			expect(restored.selectedProfileId).toBeNull();
			expect(restored.activeNodeId).toBeNull();
			expect(restored.mode).toBe('idle');
			expect(restored.lastActiveNodeId).toBeNull();
			expect(Object.keys(restored.nodeStates)).toHaveLength(0);
			expect(Object.keys(restored.documentStates)).toHaveLength(0);
			expect(restored.exportState.artifacts).toEqual([]);
			expect(restored.globalContext.projectName).toBeNull();
			expect(restored.globalContext.summary).toBeNull();
			expect(restored.globalContext.preferences).toEqual({});
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// schemaVersion
	// ─────────────────────────────────────────────────────────────────

	describe('schemaVersion', () => {
		it('should write CURRENT_SCHEMA_VERSION on every save', async () => {
			const s = await setupStore();
			await s.saveSnapshot('sess-schema', idleState('sess-schema'));

			const result = await s.loadSnapshot('sess-schema');
			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Repeated saves overwrite
	// ─────────────────────────────────────────────────────────────────

	describe('repeated saves', () => {
		it('should overwrite snapshot with latest state while preserving full state', async () => {
			const s = await setupStore();
			const sid = 'sess-overwrite';

			// Save idle state first.
			await s.saveSnapshot(sid, idleState(sid));

			// Save a rich state next — should overwrite completely.
			const rich = richState(sid);
			await s.saveSnapshot(sid, rich);

			const result = await s.loadSnapshot(sid);
			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			const restored = result.value.runtimeState;
			// Should reflect the rich state, not the idle state.
			expect(restored.mode).toBe('node_focus');
			expect(restored.selectedProfileId).toBe('p1');
			expect(restored.activeNodeId).toBe('n2');
			expect(Object.keys(restored.nodeStates)).toEqual(['n1', 'n2']);
		});

		it('should update savedAt on each save', async () => {
			const s = await setupStore();
			const sid = 'sess-timestamps';

			await s.saveSnapshot(sid, idleState(sid));
			const first = await s.loadSnapshot(sid);
			expect(first.ok).toBe(true);
			if (!first.ok) throw new Error('Expected success');
			const firstSavedAt = first.value.savedAt;

			// Small delay to ensure different timestamp.
			await new Promise((resolve) => setTimeout(resolve, 5));

			await s.saveSnapshot(sid, richState(sid));
			const second = await s.loadSnapshot(sid);
			expect(second.ok).toBe(true);
			if (!second.ok) throw new Error('Expected success');

			expect(second.value.savedAt).not.toBe(firstSavedAt);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Special-character session IDs
	// ─────────────────────────────────────────────────────────────────

	describe('special-character session IDs', () => {
		it('should round-trip a session ID with special characters', async () => {
			const s = await setupStore();
			const sid = 'sess:with/special?chars=1&val=true';
			const state = idleState(sid);
			await s.saveSnapshot(sid, state);

			const result = await s.loadSnapshot(sid);
			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value.sessionId).toBe(sid);
			expect(result.value.runtimeState.sessionId).toBe(sid);
		});

		it('should round-trip a session ID with unicode characters', async () => {
			const s = await setupStore();
			const sid = 'sess-日本語-测试';
			const state = idleState(sid);
			await s.saveSnapshot(sid, state);

			const result = await s.loadSnapshot(sid);
			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value.sessionId).toBe(sid);
			expect(result.value.runtimeState.sessionId).toBe(sid);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Corrupted snapshot — missing / invalid JSON
	// ─────────────────────────────────────────────────────────────────

	describe('corrupted snapshot', () => {
		it('should return PERSISTENCE_CORRUPT_SNAPSHOT for invalid JSON', async () => {
			const { default: fs } = await import('node:fs/promises');
			const dir = await tempDir();
			const s = createSnapshotStore({ sessionsDir: dir });

			// Write a corrupted file directly.
			const sessionDir = dir;
			await fs.mkdir(sessionDir, { recursive: true });
			const filePath = join(
				sessionDir,
				`${encodeURIComponent('sess-corrupt')}.snapshot.json`,
			);
			await fs.writeFile(filePath, '{not valid json at all!!!');

			const result = await s.loadSnapshot('sess-corrupt');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('PERSISTENCE_CORRUPT_SNAPSHOT');
			expect(result.error.recoverable).toBe(true);
			expect(result.error.recoveryOptions).toContain(
				'Inspect and manually repair the snapshot file.',
			);
		});

		it('should return PERSISTENCE_CORRUPT_SNAPSHOT when data is not an object', async () => {
			const { default: fs } = await import('node:fs/promises');
			const dir = await tempDir();
			const s = createSnapshotStore({ sessionsDir: dir });

			await fs.mkdir(dir, { recursive: true });
			const filePath = join(
				dir,
				`${encodeURIComponent('sess-array')}.snapshot.json`,
			);
			await fs.writeFile(filePath, '["not an object"]');

			const result = await s.loadSnapshot('sess-array');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('PERSISTENCE_CORRUPT_SNAPSHOT');
		});

		it('should return PERSISTENCE_CORRUPT_SNAPSHOT when schemaVersion is missing', async () => {
			const { default: fs } = await import('node:fs/promises');
			const dir = await tempDir();
			const s = createSnapshotStore({ sessionsDir: dir });

			await fs.mkdir(dir, { recursive: true });
			const filePath = join(
				dir,
				`${encodeURIComponent('sess-no-schema')}.snapshot.json`,
			);
			await fs.writeFile(
				filePath,
				JSON.stringify({
					sessionId: 'sess-no-schema',
					savedAt: nowIso(),
					runtimeState: idleState('sess-no-schema'),
					// schemaVersion intentionally omitted.
				}),
			);

			const result = await s.loadSnapshot('sess-no-schema');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('PERSISTENCE_CORRUPT_SNAPSHOT');
		});

		it('should return PERSISTENCE_CORRUPT_SNAPSHOT when runtimeState is missing', async () => {
			const { default: fs } = await import('node:fs/promises');
			const dir = await tempDir();
			const s = createSnapshotStore({ sessionsDir: dir });

			await fs.mkdir(dir, { recursive: true });
			const filePath = join(
				dir,
				`${encodeURIComponent('sess-no-state')}.snapshot.json`,
			);
			await fs.writeFile(
				filePath,
				JSON.stringify({
					schemaVersion: CURRENT_SCHEMA_VERSION,
					sessionId: 'sess-no-state',
					savedAt: nowIso(),
					// runtimeState intentionally omitted.
				}),
			);

			const result = await s.loadSnapshot('sess-no-state');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('PERSISTENCE_CORRUPT_SNAPSHOT');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Missing snapshot
	// ─────────────────────────────────────────────────────────────────

	describe('missing snapshot', () => {
		it('should return PERSISTENCE_SESSION_NOT_FOUND for unknown session', async () => {
			const s = await setupStore();
			const result = await s.loadSnapshot('no-such-session');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('PERSISTENCE_SESSION_NOT_FOUND');
			expect(result.error.recoverable).toBe(true);
			expect(result.error.recoveryOptions).toContain(
				'Start a new session.',
			);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// listSessions
	// ─────────────────────────────────────────────────────────────────

	describe('listSessions', () => {
		it('should return empty array when no sessions exist', async () => {
			const s = await setupStore();
			const sessions = await s.listSessions();
			expect(sessions).toEqual([]);
		});

		it('should include saved session with correct metadata', async () => {
			const s = await setupStore();
			await s.saveSnapshot('sess-a', idleState('sess-a'));

			const sessions = await s.listSessions();
			expect(sessions).toHaveLength(1);
			expect(sessions[0]!.sessionId).toBe('sess-a');
			expect(sessions[0]!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
			expect(typeof sessions[0]!.savedAt).toBe('string');
		});

		it('should return multiple sessions', async () => {
			const s = await setupStore();
			await s.saveSnapshot('sess-x', idleState('sess-x'));
			await s.saveSnapshot('sess-y', idleState('sess-y'));
			await s.saveSnapshot('sess-z', idleState('sess-z'));

			const sessions = await s.listSessions();
			expect(sessions).toHaveLength(3);

			const ids = sessions.map((s) => s.sessionId).sort();
			expect(ids).toEqual(['sess-x', 'sess-y', 'sess-z']);

			// All should have schemaVersion.
			for (const session of sessions) {
				expect(session.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
				expect(typeof session.savedAt).toBe('string');
			}
		});

		it('should handle special-character session IDs in listing', async () => {
			const s = await setupStore();
			const sid = 'sess:with/special?chars=1&val=true';
			await s.saveSnapshot(sid, idleState(sid));

			const sessions = await s.listSessions();
			expect(sessions).toHaveLength(1);
			expect(sessions[0]!.sessionId).toBe(sid);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Deep state preservation — node with large conversation
	// ─────────────────────────────────────────────────────────────────

	describe('deep state preservation', () => {
		it('should preserve a large conversation across round-trip', async () => {
			const s = await setupStore();
			const sid = 'sess-large';

			// Build a state with 50 messages.
			const conversation = Array.from({ length: 50 }, (_, i) => ({
				content: `Message number ${i + 1} with some content.`,
				createdAt: `2026-01-15T${String(i).padStart(2, '0')}:00:00Z`,
				id: `msg-${i + 1}`,
				role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
			}));

			const nodeState: NodeRuntimeState = {
				allowedActions: ['continue_next', 'reopen', 'open_document_preview'],
				canonicalAnswer: {
					accepted: true,
					acceptedAt: nowIso(),
					confidence: 'high',
					content: 'The definitive answer.',
					format: 'markdown',
					generatedAt: nowIso(),
					generatedFromMessageIds: ['msg-1', 'msg-50'],
					stale: false,
				},
				completeness: {
					blockingIssues: [],
					complete: true,
					missing: [],
					sufficient: ['t1'],
					weak: [],
				},
				conversation,
				dependencies: {
					blockedBy: [],
					locks: [],
					requiredNodeIds: [],
					unlocks: [],
				},
				extracted: {
					assumptions: [],
					decisions: [],
					facts: [],
				},
				lastAssistantMessageId: 'msg-50',
				lastUserMessageId: 'msg-49',
				lifecycle: 'accepted',
				nodeId: 'n-large' as NodeId,
				promptState: 'accepted',
				updatedAt: nowIso(),
			};

			const state: LogosRuntimeState = {
				...idleState(sid),
				activeNodeId: 'n-large' as NodeId,
				mode: 'node_focus',
				nodeStates: {
					['n-large' as NodeId]: nodeState,
				} as Record<NodeId, NodeRuntimeState>,
				selectedProfileId: 'p1' as ProfileId,
			};

			await s.saveSnapshot(sid, state);
			const result = await s.loadSnapshot(sid);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			const restored = result.value.runtimeState;
			const restoredNode = restored.nodeStates['n-large' as NodeId];
			expect(restoredNode).toBeDefined();
			expect(restoredNode!.conversation).toHaveLength(50);

			// Verify message order and content preserved.
			for (let i = 0; i < 50; i++) {
				expect(restoredNode!.conversation[i]!.id).toBe(`msg-${i + 1}`);
				expect(restoredNode!.conversation[i]!.content).toBe(
					`Message number ${i + 1} with some content.`,
				);
			}
		});

		it('should preserve node states with empty arrays/objects', async () => {
			const s = await setupStore();
			const sid = 'sess-empty';

			const nodeState: NodeRuntimeState = {
				allowedActions: [],
				canonicalAnswer: null,
				completeness: {
					blockingIssues: [],
					complete: false,
					missing: [],
					sufficient: [],
					weak: [],
				},
				conversation: [],
				dependencies: {
					blockedBy: [],
					locks: [],
					requiredNodeIds: [],
					unlocks: [],
				},
				extracted: {
					assumptions: [],
					decisions: [],
					facts: [],
				},
				lastAssistantMessageId: undefined,
				lastUserMessageId: undefined,
				lifecycle: 'not_started',
				nodeId: 'n-empty' as NodeId,
				promptState: 'initial',
				updatedAt: nowIso(),
			};

			const state: LogosRuntimeState = {
				...idleState(sid),
				activeNodeId: 'n-empty' as NodeId,
				mode: 'node_focus',
				nodeStates: {
					['n-empty' as NodeId]: nodeState,
				} as Record<NodeId, NodeRuntimeState>,
				selectedProfileId: 'p1' as ProfileId,
			};

			await s.saveSnapshot(sid, state);
			const result = await s.loadSnapshot(sid);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');

			const restoredNode =
				result.value.runtimeState.nodeStates['n-empty' as NodeId];
			expect(restoredNode).toBeDefined();
			expect(restoredNode!.lifecycle).toBe('not_started');
			expect(restoredNode!.conversation).toEqual([]);
			expect(restoredNode!.allowedActions).toEqual([]);
			expect(restoredNode!.canonicalAnswer).toBeNull();
			expect(restoredNode!.completeness.complete).toBe(false);
			expect(restoredNode!.completeness.missing).toEqual([]);
			expect(restoredNode!.completeness.sufficient).toEqual([]);
			expect(restoredNode!.completeness.weak).toEqual([]);
			expect(restoredNode!.extracted.assumptions).toEqual([]);
		});
	});
});
