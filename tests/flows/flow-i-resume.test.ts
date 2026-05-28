/**
 * Flow I — Resume Session
 *
 * Validates continuity across sessions: the user closes and reopens,
 * and their work is restored.
 *
 * Tests use an in-memory (temporary directory) snapshot store to avoid
 * filesystem pollution. No LLM credentials required.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.9}
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type {
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import {
	hasResumableSessions,
	type ResumeSessionOptions,
	resumeSessionWithDiagnostics,
} from '../../src/persistence/session-resume.js';
import {
	createSnapshotStore,
	type SnapshotStore,
} from '../../src/persistence/snapshot-store.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { generateId, nowIso } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

function createResumeTestProfile(): LogosProfile {
	return {
		description: 'Resume test profile.',
		documents: [
			{
				id: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-foundation',
				purpose: 'Testing',
				requiredNodeIds: ['node-thesis' as NodeId],
				title: 'Thesis Document',
			},
		],
		id: 'resume-profile' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What conviction makes this project necessary?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-thesis' as NodeId,
				order: 1,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis',
			},
		],
		phases: [
			{
				id: 'phase-foundation',
				order: 1,
				purpose: 'Foundation',
				title: 'Foundation',
			},
		],
		title: 'Resume Test Profile',
		version: '1.0.0',
	};
}

/**
 * Build a working session state with profile selected, node active,
 * and some conversation messages.
 */
function buildWorkingState(profile: LogosProfile): LogosRuntimeState {
	const state = createSession();
	const now = nowIso();
	const nodeId = 'node-thesis' as NodeId;

	const r0 = dispatch(
		state,
		{ profileId: profile.id, type: 'SELECT_PROFILE' },
		profile,
	);
	expect(r0.ok).toBe(true);
	let s = r0.state!;

	const r1 = dispatch(s, { nodeId, type: 'SELECT_NODE' }, profile);
	expect(r1.ok).toBe(true);
	s = r1.state!;

	// Add some conversation messages
	const existing = s.nodeStates[nodeId]!;
	const updatedNode: NodeRuntimeState = {
		...existing,
		conversation: [
			{
				content: 'What conviction makes this project necessary?',
				createdAt: now,
				id: generateId(),
				metadata: { promptState: 'initial' },
				role: 'assistant',
			},
			{
				content:
					'We believe hiring filters for credentials instead of competence.',
				createdAt: now,
				id: generateId(),
				metadata: {},
				role: 'user',
			},
			{
				content: 'Can you be more specific about the tension?',
				createdAt: now,
				id: generateId(),
				metadata: { promptState: 'follow_up' },
				role: 'assistant',
			},
		],
		lifecycle: 'active',
		promptState: 'follow_up',
		updatedAt: now,
	};

	return {
		...s,
		nodeStates: {
			...s.nodeStates,
			[nodeId]: updatedNode,
		},
		updatedAt: now,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Flow I — Resume Session', () => {
	it('saves and restores session state end-to-end', async () => {
		const profile = createResumeTestProfile();
		const workingState = buildWorkingState(profile);

		// Create a temp directory for this test's snapshots
		const tempDir = join(tmpdir(), `logos-test-resume-${Date.now()}`);
		const store: SnapshotStore = createSnapshotStore({
			sessionsDir: tempDir,
		});

		try {
			// ── Save ──────────────────────────────────────────────
			const saveResult = await store.saveSnapshot(
				workingState.sessionId,
				workingState,
			);
			expect(saveResult.ok).toBe(true);

			// ── Check hasResumableSessions ────────────────────────
			const hasSessions = await hasResumableSessions(store);
			expect(hasSessions).toBe(true);

			// ── List sessions ─────────────────────────────────────
			const sessions = await store.listSessions();
			expect(sessions.length).toBeGreaterThanOrEqual(1);
			expect(
				sessions.find((s) => s.sessionId === workingState.sessionId),
			).toBeDefined();

			// ── Load snapshot directly ────────────────────────────
			const loadResult = await store.loadSnapshot(workingState.sessionId);
			expect(loadResult.ok).toBe(true);
			if (loadResult.ok) {
				const snapshot = loadResult.value;
				expect(snapshot.sessionId).toBe(workingState.sessionId);
				expect(snapshot.schemaVersion).toBeDefined();

				const restored = snapshot.runtimeState;
				expect(restored.selectedProfileId).toBe(profile.id);
				expect(restored.activeNodeId).toBe('node-thesis');

				const restoredNode = restored.nodeStates['node-thesis'];
				expect(restoredNode).toBeDefined();
				expect(restoredNode!.lifecycle).toBe('active');
				expect(restoredNode!.promptState).toBe('follow_up');
				expect(restoredNode!.conversation.length).toBe(3);
			}

			// ── Resume with diagnostics ───────────────────────────
			const options: ResumeSessionOptions = {
				loadProfile: (pid: ProfileId) => {
					if (pid === profile.id) {
						return { ok: true as const, value: profile };
					}
					return {
						error: `Unknown profile: ${pid}`,
						ok: false as const,
					};
				},
				store,
			};

			const resumeResult = await resumeSessionWithDiagnostics(
				workingState.sessionId,
				options,
			);
			expect(resumeResult.ok).toBe(true);
			if (resumeResult.ok) {
				const { state: resumed, diagnostics } = resumeResult.value;
				expect(resumed.selectedProfileId).toBe(profile.id);
				expect(resumed.activeNodeId).toBe('node-thesis');

				const nodeState = resumed.nodeStates['node-thesis']!;
				expect(nodeState.lifecycle).toBe('active');
				expect(nodeState.conversation.length).toBe(3);

				// Should have diagnostic about restored active node
				expect(diagnostics.length).toBeGreaterThan(0);
			}
		} finally {
			// Clean up temp directory
			await rm(tempDir, { force: true, recursive: true });
		}
	});

	it('detects no resumable sessions for empty store', async () => {
		const tempDir = join(tmpdir(), `logos-test-resume-empty-${Date.now()}`);
		const store: SnapshotStore = createSnapshotStore({
			sessionsDir: tempDir,
		});

		try {
			const hasSessions = await hasResumableSessions(store);
			expect(hasSessions).toBe(false);
		} finally {
			await rm(tempDir, { force: true, recursive: true });
		}
	});

	it('resume fails gracefully for unknown session ID', async () => {
		const tempDir = join(tmpdir(), `logos-test-resume-missing-${Date.now()}`);
		const store: SnapshotStore = createSnapshotStore({
			sessionsDir: tempDir,
		});

		try {
			const result = await resumeSessionWithDiagnostics(
				'non-existent-session',
				{ store },
			);
			expect(result.ok).toBe(false);
		} finally {
			await rm(tempDir, { force: true, recursive: true });
		}
	});

	it('resume preserves accepted canonical answers', async () => {
		const profile = createResumeTestProfile();
		const state = createSession();
		const nodeId = 'node-thesis' as NodeId;
		const now = nowIso();

		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r1 = dispatch(s, { nodeId, type: 'SELECT_NODE' }, profile);
		expect(r1.ok).toBe(true);
		s = r1.state!;

		const existing = s.nodeStates[nodeId]!;
		const acceptedState: NodeRuntimeState = {
			...existing,
			canonicalAnswer: {
				accepted: true,
				confidence: 'high',
				content:
					'The hiring industry evaluates credentials over competence. This project redefines evaluation to be skill-based.',
				format: 'markdown',
				generatedAt: now,
				generatedFromMessageIds: [],
				stale: false,
			},
			lifecycle: 'accepted',
			promptState: 'accepted',
			updatedAt: now,
		};

		const savedState: LogosRuntimeState = {
			...s,
			nodeStates: {
				...s.nodeStates,
				[nodeId]: acceptedState,
			},
			updatedAt: now,
		};

		const tempDir = join(tmpdir(), `logos-test-resume-accepted-${Date.now()}`);
		const store: SnapshotStore = createSnapshotStore({
			sessionsDir: tempDir,
		});

		try {
			const saveResult = await store.saveSnapshot(
				savedState.sessionId,
				savedState,
			);
			expect(saveResult.ok).toBe(true);

			const options: ResumeSessionOptions = {
				loadProfile: (pid: ProfileId) => {
					if (pid === profile.id) {
						return { ok: true as const, value: profile };
					}
					return {
						error: `Unknown profile: ${pid}`,
						ok: false as const,
					};
				},
				store,
			};

			const resumeResult = await resumeSessionWithDiagnostics(
				savedState.sessionId,
				options,
			);
			expect(resumeResult.ok).toBe(true);
			if (resumeResult.ok) {
				const restoredNode = resumeResult.value.state.nodeStates[nodeId]!;
				expect(restoredNode.lifecycle).toBe('accepted');
				expect(restoredNode.canonicalAnswer).not.toBeNull();
				expect(restoredNode.canonicalAnswer!.accepted).toBe(true);
				expect(restoredNode.canonicalAnswer!.content).toContain('skill-based');
			}
		} finally {
			await rm(tempDir, { force: true, recursive: true });
		}
	});
});
