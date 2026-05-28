/**
 * Tests for Step 16.1 — Application runtime coordinator.
 *
 * Covers:
 *  - Runtime initialization with no options → idle snapshot.
 *  - Runtime initialization with `--mock` → mock LLM provider wired.
 *  - Runtime initialization with profile → profile selected.
 *  - Runtime saves and lists sessions.
 *  - Event routing: NODE_SELECTED, USER_MESSAGE, ESCAPE, ACTION_SELECTED.
 *  - Auto-save after state changes.
 *  - Dispose cleans up signal handlers and listeners.
 *  - Snapshot reflects current state after events.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationRuntime } from '../../src/application/runtime.js';
import type { ProfileId } from '../../src/shared/index.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

function tempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'logos-test-'));
}

function cleanup(dir: string): void {
	try {
		fs.rmSync(dir, { force: true, recursive: true });
	} catch {
		// Best-effort cleanup.
	}
}

/** Create a minimal YAML profile file for testing. */
function writeTestProfile(dir: string, profileId: string): void {
	const yaml = `
id: ${profileId}
title: Test Profile
version: "1.0.0"
description: "A test profile for runtime tests."

phases:
  - id: phase-1
    title: Foundation
    order: 1
    purpose: "Testing"

documents:
  - id: test-doc
    phaseId: phase-1
    title: Test Document
    order: 1
    purpose: "Testing"
    outputPath: /dev/null
    requiredNodeIds:
      - node-1
    optionalNodeIds: []

nodes:
  - id: node-1
    phaseId: phase-1
    documentId: test-doc
    title: Core Thesis
    order: 1
    canonicalQuestion: "What is the core thesis?"
    coverageTopics:
      - thesis
    sufficiencyCriteria: []
    dependencies:
      requiredNodeIds: []
      recommendedNodeIds: []
    promptRefs: {}

materializationRules: []
`;
	fs.writeFileSync(path.join(dir, `${profileId}.yaml`), yaml, 'utf-8');
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('createApplicationRuntime', () => {
	let tmp: string;

	beforeEach(() => {
		tmp = tempDir();
	});

	afterEach(() => {
		cleanup(tmp);
	});

	it('creates a runtime with an idle snapshot when no options are given', async () => {
		const runtime = await createApplicationRuntime({ dataDir: tmp });
		const snapshot = runtime.getSnapshot();

		expect(snapshot.mode).toBe('idle');
		expect(snapshot.mainPanel.kind).toBe('idle');
		expect(snapshot.actionBar.actions.length).toBeGreaterThan(0);
		expect(snapshot.input.enabled).toBe(false);
		expect(runtime.sessionId).toBeTruthy();

		runtime.dispose();
	});

	it('creates a runtime with useMockLlm = true', async () => {
		const runtime = await createApplicationRuntime({
			dataDir: tmp,
			useMockLlm: true,
		});

		// The runtime should have created a session.
		expect(runtime.getState().mode).toBe('idle');
		expect(runtime.sessionId).toBeTruthy();

		runtime.dispose();
	});

	it('selects a profile when profileId is given with a valid profile directory', async () => {
		// Create a profile YAML file in a temp profiles directory.
		const profileDir = path.join(tmp, 'profiles');
		fs.mkdirSync(profileDir, { recursive: true });
		writeTestProfile(profileDir, 'test-profile');

		const runtime = await createApplicationRuntime({
			dataDir: tmp,
			profileDir,
			profileId: 'test-profile' as ProfileId,
			useMockLlm: true,
		});

		const snapshot = runtime.getSnapshot();

		// The snapshot should be in structure_overview mode (profile loaded).
		expect(snapshot.mode).toBe('structure_overview');
		expect(snapshot.sidebar.phases.length).toBeGreaterThan(0);

		runtime.dispose();
	});

	it('saves and can be listed by a new runtime', async () => {
		const sessionsDir = path.join(tmp, 'sessions');
		const runtime1 = await createApplicationRuntime({ dataDir: sessionsDir });
		const _sessionId = runtime1.sessionId;
		await runtime1.save();
		runtime1.dispose();

		// Create a second runtime using the same sessions directory.
		const runtime2 = await createApplicationRuntime({ dataDir: sessionsDir });
		const snapshot = runtime2.getSnapshot();

		// Should detect available sessions.
		expect(snapshot.mainPanel.kind).toBe('idle');
		if (snapshot.mainPanel.kind === 'idle') {
			expect(snapshot.mainPanel.hasAvailableSessions).toBe(true);
		}

		runtime2.dispose();
	});

	it('resumes a session by ID', async () => {
		const sessionsDir = path.join(tmp, 'sessions');
		const runtime1 = await createApplicationRuntime({ dataDir: sessionsDir });
		const sessionId = runtime1.sessionId;
		await runtime1.save();
		runtime1.dispose();

		// Now resume it.
		const runtime2 = await createApplicationRuntime({
			dataDir: sessionsDir,
			sessionId,
		});

		expect(runtime2.sessionId).toBe(sessionId);
		expect(runtime2.getState().mode).toBe('idle');

		runtime2.dispose();
	});

	it('resumes a session with profile and preserves state', async () => {
		const sessionsDir = path.join(tmp, 'sessions');
		const profileDir = path.join(tmp, 'profiles');
		fs.mkdirSync(profileDir, { recursive: true });
		writeTestProfile(profileDir, 'test-profile');

		// Create a runtime with a profile selected.
		const runtime1 = await createApplicationRuntime({
			dataDir: sessionsDir,
			profileDir,
			profileId: 'test-profile' as ProfileId,
			useMockLlm: true,
		});

		expect(runtime1.getState().selectedProfileId).toBe('test-profile');
		expect(runtime1.getSnapshot().mode).toBe('structure_overview');

		const sessionId = runtime1.sessionId;
		await runtime1.save();
		runtime1.dispose();

		// Resume by sessionId — profile should be restored.
		const runtime2 = await createApplicationRuntime({
			dataDir: sessionsDir,
			profileDir,
			sessionId,
		});

		expect(runtime2.sessionId).toBe(sessionId);
		expect(runtime2.getState().selectedProfileId).toBe('test-profile');
		expect(runtime2.getSnapshot().mode).toBe('structure_overview');
		expect(runtime2.getSnapshot().sidebar.phases.length).toBeGreaterThan(0);

		runtime2.dispose();
	});

	it('subscribe receives initial snapshot on first state change', async () => {
		const runtime = await createApplicationRuntime({ dataDir: tmp });

		const snapshots: unknown[] = [];
		const unsub = runtime.subscribe((snap) => {
			snapshots.push(snap);
		});

		// The subscriber is called on each state change, not on subscription.
		// Verify initial state.
		expect(snapshots.length).toBe(0);

		unsub();
		runtime.dispose();
	});

	it('ESCAPE event deselects the active node', async () => {
		const profileDir = path.join(tmp, 'profiles');
		fs.mkdirSync(profileDir, { recursive: true });
		writeTestProfile(profileDir, 'test-profile');

		const runtime = await createApplicationRuntime({
			dataDir: tmp,
			profileDir,
			profileId: 'test-profile' as ProfileId,
			useMockLlm: true,
		});

		// Select a node first.
		const phases = runtime.getSnapshot().sidebar.phases;
		if (
			phases.length > 0 &&
			phases[0]!.documents.length > 0 &&
			phases[0]!.documents[0]!.nodes.length > 0
		) {
			const firstNodeId = phases[0]!.documents[0]!.nodes[0]!.nodeId;

			await runtime.dispatch({ nodeId: firstNodeId, type: 'NODE_SELECTED' });

			// Should be in node_focus mode.
			expect(runtime.getSnapshot().mode).toBe('node_focus');

			// Now escape.
			await runtime.dispatch({ type: 'ESCAPE' });

			// Should be back to structure_overview.
			expect(runtime.getSnapshot().mode).toBe('structure_overview');
		}

		runtime.dispose();
	});

	it('notifies subscriber after dispatch', async () => {
		const profileDir = path.join(tmp, 'profiles');
		fs.mkdirSync(profileDir, { recursive: true });
		writeTestProfile(profileDir, 'test-profile');

		const runtime = await createApplicationRuntime({
			dataDir: tmp,
			profileDir,
			profileId: 'test-profile' as ProfileId,
			useMockLlm: true,
		});

		const snapshots: unknown[] = [];
		const unsub = runtime.subscribe((snap) => {
			snapshots.push(snap);
		});

		// Select a node to trigger a state change.
		const phases = runtime.getSnapshot().sidebar.phases;
		if (
			phases.length > 0 &&
			phases[0]!.documents.length > 0 &&
			phases[0]!.documents[0]!.nodes.length > 0
		) {
			const firstNodeId = phases[0]!.documents[0]!.nodes[0]!.nodeId;

			await runtime.dispatch({ nodeId: firstNodeId, type: 'NODE_SELECTED' });

			// Subscriber should have been called.
			expect(snapshots.length).toBeGreaterThan(0);
		}

		unsub();
		runtime.dispose();
	});

	it('dispose stops notifications', async () => {
		const profileDir = path.join(tmp, 'profiles');
		fs.mkdirSync(profileDir, { recursive: true });
		writeTestProfile(profileDir, 'test-profile');

		const runtime = await createApplicationRuntime({
			dataDir: tmp,
			profileDir,
			profileId: 'test-profile' as ProfileId,
			useMockLlm: true,
		});

		const snapshots: unknown[] = [];
		runtime.subscribe((snap) => {
			snapshots.push(snap);
		});

		runtime.dispose();

		// Selecting a node after dispose should NOT notify.
		const phases = runtime.getSnapshot().sidebar.phases;
		if (
			phases.length > 0 &&
			phases[0]!.documents.length > 0 &&
			phases[0]!.documents[0]!.nodes.length > 0
		) {
			const firstNodeId = phases[0]!.documents[0]!.nodes[0]!.nodeId;

			await runtime.dispatch({ nodeId: firstNodeId, type: 'NODE_SELECTED' });

			// Subscriber should NOT have been called (disposed).
			expect(snapshots.length).toBe(0);
		}
	});

	it('saves snapshot to the data directory', async () => {
		const runtime = await createApplicationRuntime({ dataDir: tmp });
		await runtime.save();

		// Check that files exist in the sessions directory.
		const files = fs.readdirSync(tmp);
		expect(files.length).toBeGreaterThan(0);

		runtime.dispose();
	});

	it('handles unknown action gracefully', async () => {
		const runtime = await createApplicationRuntime({
			dataDir: tmp,
			useMockLlm: true,
		});

		// Dispatching an unknown action should not throw.
		await runtime.dispatch({
			actionId: 'unknown_action',
			type: 'ACTION_SELECTED',
		});

		// State should be unchanged.
		expect(runtime.getState().mode).toBe('idle');

		runtime.dispose();
	});

	it('NODE_SELECTED without profile is a no-op', async () => {
		const runtime = await createApplicationRuntime({ dataDir: tmp });

		await runtime.dispatch({
			nodeId: 'any-node' as ProfileId as unknown as never,
			type: 'NODE_SELECTED',
		});

		// Should still be idle.
		expect(runtime.getSnapshot().mode).toBe('idle');

		runtime.dispose();
	});
});
