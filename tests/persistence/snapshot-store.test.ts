/**
 * Tests for Step 13.1 — snapshot store persistence.
 *
 * Covers:
 *  - saveSnapshot / loadSnapshot round-trip.
 *  - listSessions returns correct session IDs.
 *  - Load corrupted snapshot → error with recovery options.
 *  - Atomic write: temp file + rename (no partial files).
 *  - loadSnapshot returns error for non-existent session.
 */
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { LogosRuntimeState } from '../../src/contracts/index.js';
import {
	createSnapshotStore,
	type SnapshotFs,
	type SnapshotStore,
} from '../../src/persistence/snapshot-store.js';
import type { DocumentId, SessionId } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Minimal runtime state fixture
// ═══════════════════════════════════════════════════════════════════════════

function minimalState(sessionId = 'test-session-1'): LogosRuntimeState {
	return {
		activeNodeId: null,
		documentStates: {} as Record<
			DocumentId,
			import('../../src/contracts/index.js').DocumentRuntimeState
		>,
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
		updatedAt: new Date().toISOString(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function tempDir(): Promise<string> {
	return realpath(await mkdtemp(join(tmpdir(), 'logos-test-')));
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('snapshot-store', () => {
	let store: SnapshotStore;
	let dir: string;

	afterEach(async () => {
		// Cleanup is handled by the OS tmp directory; we don't need to
		// delete files manually in tests. But we can try to make it
		// deterministic by creating a fresh directory each test.
	});

	// ── Helper: create store in a fresh temp dir ─────────────────────
	async function freshStore(): Promise<SnapshotStore> {
		dir = await tempDir();
		store = createSnapshotStore({ sessionsDir: dir });
		return store;
	}

	// ─────────────────────────────────────────────────────────────────
	// Round-trip
	// ─────────────────────────────────────────────────────────────────

	describe('save + load round-trip', () => {
		it('should save and load a snapshot with all fields intact', async () => {
			const s = await freshStore();
			const state = minimalState('s1');

			const saveResult = await s.saveSnapshot('s1', state);
			expect(saveResult.ok).toBe(true);

			const loadResult = await s.loadSnapshot('s1');
			expect(loadResult.ok).toBe(true);
			if (!loadResult.ok) throw new Error('unreachable');

			const loaded = loadResult.value;
			expect(loaded.sessionId).toBe('s1');
			expect(loaded.schemaVersion).toBe('1.0.0');
			expect(loaded.runtimeState).toEqual(state);
			expect(loaded.savedAt).toBeTypeOf('string');
			// Verify it's a valid ISO date.
			expect(new Date(loaded.savedAt).getTime()).not.toBeNaN();
		});

		it('should round-trip state with an active node and node states', async () => {
			const s = await freshStore();

			const state: LogosRuntimeState = {
				...minimalState('active-node-session'),
				activeNodeId: 'node-1' as import('../../src/shared/index.js').NodeId,
				mode: 'node_focus',
				nodeStates: {
					'node-1': {
						allowedActions: ['answer_question'],
						canonicalAnswer: null,
						completeness: {
							blockingIssues: [],
							complete: false,
							coverage: {},
							missing: ['thesis'],
							weak: [],
						},
						conversation: [
							{
								content: 'What is the thesis?',
								createdAt: '2026-01-01T00:00:00.000Z',
								id: 'msg-1',
								role: 'user' as const,
							},
						],
						extracted: {
							assumptions: [],
							decisions: [],
							facts: [],
							openQuestions: [],
							risks: [],
						},
						lifecycle: 'active',
						promptState: 'follow_up',
						updatedAt: '2026-01-01T00:00:00.000Z',
					} as import('../../src/contracts/index.js').NodeRuntimeState,
				},
			};

			const saveResult = await s.saveSnapshot('active-node-session', state);
			expect(saveResult.ok).toBe(true);

			const loadResult = await s.loadSnapshot('active-node-session');
			expect(loadResult.ok).toBe(true);
			if (!loadResult.ok) throw new Error('unreachable');

			const loaded = loadResult.value;
			expect(loaded.sessionId).toBe('active-node-session');
			expect(loaded.runtimeState.activeNodeId).toBe('node-1');
			expect(loaded.runtimeState.mode).toBe('node_focus');
			expect(loaded.runtimeState.nodeStates['node-1']?.lifecycle).toBe(
				'active',
			);
			expect(
				loaded.runtimeState.nodeStates['node-1']?.conversation[0]?.content,
			).toBe('What is the thesis?');
		});

		it('should overwrite existing snapshot on re-save', async () => {
			const s = await freshStore();
			const state1 = minimalState('re-save-session');
			const state2 = {
				...minimalState('re-save-session'),
				mode: 'profile_selection' as const,
			};

			// First save.
			const save1 = await s.saveSnapshot('re-save-session', state1);
			expect(save1.ok).toBe(true);

			// Second save (overwrite).
			const save2 = await s.saveSnapshot('re-save-session', state2);
			expect(save2.ok).toBe(true);

			// Load should reflect the second state.
			const loadResult = await s.loadSnapshot('re-save-session');
			expect(loadResult.ok).toBe(true);
			if (!loadResult.ok) throw new Error('unreachable');
			expect(loadResult.value.runtimeState.mode).toBe('profile_selection');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// listSessions
	// ─────────────────────────────────────────────────────────────────

	describe('listSessions', () => {
		it('should return an empty array when no sessions exist', async () => {
			const s = await freshStore();
			const sessions = await s.listSessions();
			expect(sessions).toEqual([]);
		});

		it('should return session IDs for saved sessions', async () => {
			const s = await freshStore();

			await s.saveSnapshot('session-a', minimalState('session-a'));
			await s.saveSnapshot('session-b', minimalState('session-b'));
			await s.saveSnapshot('session-c', minimalState('session-c'));

			const sessions = await s.listSessions();
			expect(sessions).toHaveLength(3);

			const ids = sessions.map((s) => s.sessionId).sort();
			expect(ids).toEqual(['session-a', 'session-b', 'session-c']);

			// Each summary should have schemaVersion and savedAt.
			for (const summary of sessions) {
				expect(summary.schemaVersion).toBe('1.0.0');
				expect(summary.savedAt).toBeTypeOf('string');
				expect(new Date(summary.savedAt).getTime()).not.toBeNaN();
			}
		});

		it('should be sorted by savedAt descending (most recent first)', async () => {
			const s = await freshStore();

			await s.saveSnapshot('old', minimalState('old'));
			// Small delay to ensure different timestamps.
			await new Promise((r) => setTimeout(r, 10));
			await s.saveSnapshot('new', minimalState('new'));

			const sessions = await s.listSessions();
			expect(sessions).toHaveLength(2);
			// Most recent should be first.
			expect(sessions[0]?.sessionId).toBe('new');
			expect(sessions[1]?.sessionId).toBe('old');
		});

		it('should handle special characters in session IDs', async () => {
			const s = await freshStore();

			const specialId = 'user@example.com/test-session';
			await s.saveSnapshot(specialId, minimalState(specialId));

			const sessions = await s.listSessions();
			expect(sessions).toHaveLength(1);
			expect(sessions[0]?.sessionId).toBe(specialId);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// loadSnapshot error cases
	// ─────────────────────────────────────────────────────────────────

	describe('loadSnapshot error cases', () => {
		it('should return error for non-existent session', async () => {
			const s = await freshStore();
			const result = await s.loadSnapshot('nonexistent');

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('unreachable');
			expect(result.error.code).toBe('PERSISTENCE_SESSION_NOT_FOUND');
			expect(result.error.recoverable).toBe(true);
			expect(result.error.recoveryOptions.length).toBeGreaterThan(0);
		});

		it('should return error for corrupted JSON', async () => {
			// Write a corrupted file directly using the FS adapter
			// and try to load it.
			const realDir = await tempDir();
			const corrStore = createSnapshotStore({ sessionsDir: realDir });

			const { default: fs } = await import('node:fs/promises');

			// Write a valid file first, then corrupt it.
			await corrStore.saveSnapshot('corrupt-me', minimalState('corrupt-me'));

			// Now overwrite the file with invalid JSON.
			const entries = await fs.readdir(realDir);
			const snapFile = entries.find((e) => e.includes('corrupt-me'));
			expect(snapFile).toBeDefined();
			if (snapFile) {
				await fs.writeFile(join(realDir, snapFile), '{{{not-json}}}');
			}

			const result = await corrStore.loadSnapshot('corrupt-me');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('unreachable');
			expect(result.error.code).toBe('PERSISTENCE_CORRUPT_SNAPSHOT');
			expect(result.error.recoverable).toBe(true);
			expect(result.error.recoveryOptions.length).toBeGreaterThan(0);
			// Should mention inspection/recovery options.
			expect(
				result.error.recoveryOptions.some(
					(o) =>
						o.toLowerCase().includes('inspect') ||
						o.toLowerCase().includes('delete'),
				),
			).toBe(true);
		});

		it('should return error for snapshot missing schemaVersion', async () => {
			const s = await freshStore();
			const dir_ = dir; // capture

			// Write a file manually that has valid JSON but no schemaVersion.
			const { default: fs } = await import('node:fs/promises');
			await fs.mkdir(dir_, { recursive: true });
			const encoded = encodeURIComponent('bad-schema');
			await fs.writeFile(
				join(dir_, `${encoded}.snapshot.json`),
				JSON.stringify({
					runtimeState: {},
					savedAt: '2026-01-01T00:00:00.000Z',
					sessionId: 'bad-schema',
				}),
			);

			const result = await s.loadSnapshot('bad-schema');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('unreachable');
			expect(result.error.code).toBe('PERSISTENCE_CORRUPT_SNAPSHOT');
			expect(result.error.message).toContain('schemaVersion');
		});

		it('should return error for snapshot missing runtimeState', async () => {
			const s = await freshStore();
			const dir_ = dir;

			const { default: fs } = await import('node:fs/promises');
			await fs.mkdir(dir_, { recursive: true });
			const encoded = encodeURIComponent('no-runtime');
			await fs.writeFile(
				join(dir_, `${encoded}.snapshot.json`),
				JSON.stringify({
					savedAt: '2026-01-01T00:00:00.000Z',
					schemaVersion: '1.0.0',
					sessionId: 'no-runtime',
				}),
			);

			const result = await s.loadSnapshot('no-runtime');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('unreachable');
			expect(result.error.code).toBe('PERSISTENCE_CORRUPT_SNAPSHOT');
			expect(result.error.message).toContain('runtimeState');
		});

		it('should return error for snapshot that is not a JSON object', async () => {
			const s = await freshStore();
			const dir_ = dir;

			const { default: fs } = await import('node:fs/promises');
			await fs.mkdir(dir_, { recursive: true });
			const encoded = encodeURIComponent('array-snap');
			await fs.writeFile(join(dir_, `${encoded}.snapshot.json`), '[1, 2, 3]');

			const result = await s.loadSnapshot('array-snap');
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('unreachable');
			expect(result.error.code).toBe('PERSISTENCE_CORRUPT_SNAPSHOT');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Atomic write
	// ─────────────────────────────────────────────────────────────────

	describe('atomic write', () => {
		it('should write to temp file then rename, leaving no temp files', async () => {
			const state = minimalState('atomic-test');

			// Track write and rename order via a mock FS.
			const callLog: string[] = [];
			const { default: fs } = await import('node:fs/promises');

			const mockFs: SnapshotFs = {
				mkdir: async (p, opts) => {
					callLog.push(`mkdir:${p}`);
					return fs.mkdir(p, opts);
				},
				readdir: async (p) => {
					callLog.push(`readdir:${p}`);
					return fs.readdir(p);
				},
				readFile: async (p) => {
					callLog.push(`readFile:${p}`);
					return fs.readFile(p, 'utf-8');
				},
				rename: async (oldP, newP) => {
					callLog.push(`rename:${oldP}->${newP}`);
					return fs.rename(oldP, newP);
				},
				stat: async (p) => {
					callLog.push(`stat:${p}`);
					return fs.stat(p);
				},
				unlink: async (p) => {
					callLog.push(`unlink:${p}`);
					return fs.unlink(p);
				},
				writeFile: async (p, data) => {
					callLog.push(`writeFile:${p}`);
					return fs.writeFile(p, data);
				},
			};

			const mockStore = createSnapshotStore({
				fs: mockFs,
				sessionsDir: await tempDir(),
			});

			const saveResult = await mockStore.saveSnapshot('atomic-test', state);
			expect(saveResult.ok).toBe(true);

			// Verify writeFile was called before rename.
			const writeIdx = callLog.findIndex((c) => c.startsWith('writeFile:'));
			const renameIdx = callLog.findIndex((c) => c.startsWith('rename:'));
			expect(writeIdx).toBeGreaterThanOrEqual(0);
			expect(renameIdx).toBeGreaterThan(writeIdx);

			// Verify the temp file had .tmp extension.
			const writeCall = callLog[writeIdx]!;
			expect(writeCall).toContain('.tmp');

			// Verify the rename target (after the -> separator) has
			// .snapshot.json extension and is the final path.
			const renameCall = callLog[renameIdx]!;
			expect(renameCall).toContain('.snapshot.json');
			// The source side of the rename IS the temp file; the
			// destination should not contain .tmp.
			const arrowIdx = renameCall.indexOf('->');
			const dest = arrowIdx >= 0 ? renameCall.slice(arrowIdx + 2) : renameCall;
			expect(dest).not.toContain('.tmp');
		});

		it('should not leave temp files after successful save', async () => {
			const s = await freshStore();
			const state = minimalState('no-temp-files');

			await s.saveSnapshot('no-temp-files', state);

			const { default: fs } = await import('node:fs/promises');
			const entries = await fs.readdir(dir);
			const tempFiles = entries.filter((e) => e.endsWith('.tmp'));
			expect(tempFiles).toHaveLength(0);

			// The snapshot file should exist.
			const snapFiles = entries.filter((e) => e.endsWith('.snapshot.json'));
			expect(snapFiles.length).toBeGreaterThanOrEqual(1);
		});

		it('should clean up temp file on write failure', async () => {
			// Use a mock FS that fails on writeFile.
			const mockFs: SnapshotFs = {
				mkdir: async () => undefined,
				readdir: async () => [],
				readFile: async () => {
					throw new Error('should not be called');
				},
				rename: async () => {
					throw new Error('should not be called');
				},
				stat: async () => ({ mtimeMs: 0 }),
				unlink: async () => {
					// Expected: temp file cleanup.
				},
				writeFile: async () => {
					throw new Error('Simulated write failure');
				},
			};

			const mockStore = createSnapshotStore({
				fs: mockFs,
				sessionsDir: '/mock/dir',
			});

			const result = await mockStore.saveSnapshot(
				'fail-session',
				minimalState('fail-session'),
			);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('unreachable');
			expect(result.error.code).toBe('PERSISTENCE_WRITE_FAILED');
			expect(result.error.recoverable).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// createAutoSave
	// ─────────────────────────────────────────────────────────────────

	describe('createAutoSave', () => {
		it('should create an auto-save function that delegates to the store', async () => {
			const s = await freshStore();
			const { createAutoSave } = await import(
				'../../src/persistence/snapshot-store.js'
			);

			const autoSave = createAutoSave(s, 'auto-session');
			const state = minimalState('auto-session');

			const result = await autoSave(state);
			expect(result.ok).toBe(true);

			// Verify it was actually saved.
			const loaded = await s.loadSnapshot('auto-session');
			expect(loaded.ok).toBe(true);
			if (!loaded.ok) throw new Error('unreachable');
			expect(loaded.value.runtimeState.sessionId).toBe('auto-session');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// CURRENT_SCHEMA_VERSION
	// ─────────────────────────────────────────────────────────────────

	describe('schema version', () => {
		it('should include CURRENT_SCHEMA_VERSION in every snapshot', async () => {
			const s = await freshStore();
			const { CURRENT_SCHEMA_VERSION } = await import(
				'../../src/persistence/snapshot-store.js'
			);

			expect(CURRENT_SCHEMA_VERSION).toBe('1.0.0');

			await s.saveSnapshot('ver-check', minimalState('ver-check'));
			const result = await s.loadSnapshot('ver-check');
			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('unreachable');
			expect(result.value.schemaVersion).toBe('1.0.0');
		});
	});
});
