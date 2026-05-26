/**
 * Tests for Step 3.1 — session initialization and profile selection.
 *
 * Covers:
 *  - `createSession()` produces valid idle state.
 *  - `selectProfile()` transitions to `structure_overview`.
 *  - `selectProfile()` with invalid profile ID returns error.
 *  - `selectProfile()` with empty profile directory returns error.
 *  - `selectNode()` before profile selection returns error.
 *  - `changeProfile()` resets node/document state.
 *  - Immutability: input state is never mutated.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { LogosRuntimeState } from '../../src/contracts/index.js';
import type { NodeId, ProfileId } from '../../src/shared/index.js';
import {
	changeProfile,
	createSession,
	selectNode,
	selectProfile,
} from '../../src/state-engine/state-engine.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

let tempDir: string;

/** Create a fresh temporary directory for profile fixtures. */
function makeTempDir(): string {
	return mkdtempSync(join(tmpdir(), 'logos-state-engine-test-'));
}

/** Write a minimal valid YAML profile to the given directory. */
function writeMinimalProfile(dir: string, id: string): string {
	const profileYml = `
id: ${id}
title: "Test Profile"
version: "1.0.0"
phases:
  - id: phase-1
    title: "Phase 1"
    order: 1
    purpose: "Testing"
documents:
  - id: ${id}-doc
    phaseId: phase-1
    title: "Test Document"
    order: 1
    purpose: "Testing"
    outputPath: /dev/null
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
  - id: ${id}-node-1
    phaseId: phase-1
    documentId: ${id}-doc
    title: "Test Node 1"
    order: 1
    canonicalQuestion: "What is the answer?"
    sufficiencyCriteria: []
    coverageTopics: []
    promptRefs: {}
    dependencies:
      requiredNodeIds: []
      recommendedNodeIds: []
materializationRules: []
`;
	const filePath = join(dir, `${id}.yml`);
	writeFileSync(filePath, profileYml, 'utf-8');
	return filePath;
}

/** Deep-clone a state object so we can detect mutations. */
function cloneState(state: LogosRuntimeState): LogosRuntimeState {
	return JSON.parse(JSON.stringify(state));
}

beforeEach(() => {
	tempDir = makeTempDir();
});

afterEach(() => {
	rmSync(tempDir, { force: true, recursive: true });
});

// ─── createSession ─────────────────────────────────────────────────────────

describe('createSession', () => {
	it('returns an idle session with no profile and no active node', () => {
		const state = createSession();
		expect(state.mode).toBe('idle');
		expect(state.selectedProfileId).toBeNull();
		expect(state.activeNodeId).toBeNull();
		expect(state.lastActiveNodeId).toBeNull();
		expect(state.nodeStates).toEqual({});
		expect(state.documentStates).toEqual({});
		expect(state.sessionId).toBeTypeOf('string');
		expect(state.sessionId.length).toBeGreaterThan(0);
		expect(state.updatedAt).toBeTypeOf('string');
		// ISO-8601 timestamp check
		expect(new Date(state.updatedAt).toISOString()).toBe(state.updatedAt);
	});

	it('produces a state with valid GlobalContext', () => {
		const state = createSession();

		expect(state.globalContext).toEqual({
			preferences: {},
			projectName: null,
			summary: null,
		});
	});

	it('produces a state with empty exportState', () => {
		const state = createSession();

		expect(state.exportState).toEqual({ artifacts: [] });
	});

	it('generates unique session IDs across calls', () => {
		const s1 = createSession();
		const s2 = createSession();

		expect(s1.sessionId).not.toBe(s2.sessionId);
	});
});

// ─── selectProfile ─────────────────────────────────────────────────────────

describe('selectProfile', () => {
	it('selects a valid profile and transitions to structure_overview', () => {
		writeMinimalProfile(tempDir, 'test-profile');
		const initial = createSession();

		const result = selectProfile(initial, 'test-profile' as ProfileId, {
			profileDirectory: tempDir,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.mode).toBe('structure_overview');
		expect(result.state.selectedProfileId).toBe('test-profile');
		expect(result.state.activeNodeId).toBeNull();
		expect(result.state.lastActiveNodeId).toBeNull();
		expect(result.state.nodeStates).toEqual({});
		expect(result.state.documentStates).toEqual({});
	});

	it('returns error for a non-existent profile ID', () => {
		writeMinimalProfile(tempDir, 'existing');
		const initial = createSession();

		const result = selectProfile(initial, 'nonexistent' as ProfileId, {
			profileDirectory: tempDir,
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('Failed to load profile');
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe('LOGOS_STATE_PROFILE_LOAD_FAILED');
	});

	it('returns error when profile directory is empty', () => {
		const initial = createSession();

		const result = selectProfile(initial, 'any' as ProfileId, {
			profileDirectory: tempDir,
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe(
			'LOGOS_STATE_NO_PROFILES_AVAILABLE',
		);
	});

	it('does not mutate the input state', () => {
		writeMinimalProfile(tempDir, 'test-profile');
		const initial = createSession();

		const original = cloneState(initial);

		const result = selectProfile(initial, 'test-profile' as ProfileId, {
			profileDirectory: tempDir,
		});
		expect(result.ok).toBe(true);

		// The input state must be identical to the snapshot taken before the call.
		expect(initial).toEqual(original);
	});

	it('resets state when selecting a different profile (no carry-over)', () => {
		writeMinimalProfile(tempDir, 'first');
		writeMinimalProfile(tempDir, 'second');

		const initial = createSession();

		const r1 = selectProfile(initial, 'first' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!r1.ok) throw new Error('Expected ok');

		// Now switch to a different profile.
		const r2 = selectProfile(r1.state, 'second' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!r2.ok) throw new Error('Expected ok');

		expect(r2.state.selectedProfileId).toBe('second');
		expect(r2.state.mode).toBe('structure_overview');
		expect(r2.state.nodeStates).toEqual({});
		expect(r2.state.documentStates).toEqual({});
	});

	it('preserves the original session ID across profile selection', () => {
		writeMinimalProfile(tempDir, 'test-profile');
		const initial = createSession();

		const result = selectProfile(initial, 'test-profile' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.sessionId).toBe(initial.sessionId);
	});
});

// ─── changeProfile ─────────────────────────────────────────────────────────

describe('changeProfile', () => {
	it('behaves identically to selectProfile for a fresh switch', () => {
		writeMinimalProfile(tempDir, 'alpha');
		writeMinimalProfile(tempDir, 'beta');

		const initial = createSession();

		// Select alpha first.
		const selectResult = selectProfile(initial, 'alpha' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!selectResult.ok) throw new Error('Expected ok');

		// Then change to beta.
		const changeResult = changeProfile(
			selectResult.state,
			'beta' as ProfileId,
			{ profileDirectory: tempDir },
		);

		expect(changeResult.ok).toBe(true);
		if (!changeResult.ok) throw new Error('Expected ok');

		expect(changeResult.state.mode).toBe('structure_overview');
		expect(changeResult.state.selectedProfileId).toBe('beta');
		expect(changeResult.state.nodeStates).toEqual({});
		expect(changeResult.state.documentStates).toEqual({});
	});

	it('returns error for invalid profile ID', () => {
		writeMinimalProfile(tempDir, 'alpha');
		const initial = createSession();

		const result = changeProfile(initial, 'nonexistent' as ProfileId, {
			profileDirectory: tempDir,
		});

		expect(result.ok).toBe(false);
	});
});

// ─── selectNode ─────────────────────────────────────────────────────

describe('selectNode', () => {
	it('returns error when no profile is selected', () => {
		const initial = createSession();

		const result = selectNode(initial, 'any-node' as NodeId);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain(
			'Cannot select a node without a selected profile',
		);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe('LOGOS_STATE_NO_PROFILE_SELECTED');
	});

	it('sets activeNodeId and transitions to node_focus when profile is selected', () => {
		writeMinimalProfile(tempDir, 'test-profile');
		const initial = createSession();

		const profileResult = selectProfile(initial, 'test-profile' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!profileResult.ok) throw new Error('Expected ok');

		const nodeResult = selectNode(
			profileResult.state,
			'test-profile-node-1' as NodeId,
			{ profileDirectory: tempDir },
		);

		expect(nodeResult.ok).toBe(true);
		if (!nodeResult.ok) throw new Error('Expected ok');

		// Full implementation (Step 3.3): state is now mutated — activeNodeId
		// is set, NodeRuntimeState is initialised, and mode transitions to
		// node_focus.
		expect(nodeResult.state.activeNodeId).toBe('test-profile-node-1');
		expect(nodeResult.state.mode).toBe('node_focus');
		expect(nodeResult.state.nodeStates['test-profile-node-1']).toBeDefined();
		expect(nodeResult.state.nodeStates['test-profile-node-1']?.lifecycle).toBe(
			'not_started',
		);
	});

	it('does not mutate input state', () => {
		const initial = createSession();

		const original = cloneState(initial);

		selectNode(initial, 'any-node' as NodeId);

		expect(initial).toEqual(original);
	});
});
