/**
 * Tests for Step 3.2 — active node mode resolution.
 *
 * Covers:
 *  - `resolveSessionMode()` compact form: idle, structure_overview,
 *    node_focus, error modes.
 *  - `resolveSessionModeWithDiagnostics()`: diagnostic contents for
 *    each error condition.
 *  - Edge cases: active node without profile, profile mismatch, node
 *    not in profile, missing profile definition.
 *  - Immutability: input state is never mutated.
 *  - Integration: `selectProfile` uses the resolver instead of
 *    hardcoding mode.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
	LogosProfile,
	LogosRuntimeState,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import {
	resolveSessionMode,
	resolveSessionModeWithDiagnostics,
	type SessionModeResolution,
} from '../../src/state-engine/session-mode.js';
import {
	changeProfile,
	createSession,
	selectProfile,
} from '../../src/state-engine/state-engine.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deep-clone a state object so we can detect mutations.
 */
function cloneState(state: LogosRuntimeState): LogosRuntimeState {
	return JSON.parse(JSON.stringify(state));
}

/**
 * Build a minimal `LogosProfile` for testing mode resolution.
 *
 * The profile contains a single node so `resolveSessionMode` can validate
 * `activeNodeId` membership.
 */
function minimalProfile(overrides?: Partial<LogosProfile>): LogosProfile {
	const profileId = (overrides?.id ?? 'test-profile') as ProfileId;
	const docId = `${profileId}-doc` as DocumentId;
	const nodeId = `${profileId}-node-1` as NodeId;

	return {
		documents: [
			{
				id: docId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: [],
				title: 'Test Document',
			},
		],
		id: profileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is the answer?',
				coverageTopics: [],
				documentId: docId,
				id: nodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Test Node 1',
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'Testing',
				title: 'Phase 1',
			},
		],
		title: 'Test Profile',
		version: '1.0.0',
		...overrides,
	};
}

/**
 * Patch a few fields on the runtime state for testing.
 *
 * Returns a deep clone with the overrides applied — the original is
 * never mutated.
 */
function patchRuntimeState(
	base: LogosRuntimeState,
	overrides: Partial<LogosRuntimeState>,
): LogosRuntimeState {
	return { ...JSON.parse(JSON.stringify(base)), ...overrides };
}

// ═══════════════════════════════════════════════════════════════════════════
// Temp dir for selectProfile integration tests
// ═══════════════════════════════════════════════════════════════════════════

let tempDir: string;

function makeTempDir(): string {
	return mkdtempSync(join(tmpdir(), 'logos-session-mode-test-'));
}

function writeMinimalProfile(dir: string, id: string): string {
	const yml = `\
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
	writeFileSync(filePath, yml, 'utf-8');
	return filePath;
}

beforeEach(() => {
	tempDir = makeTempDir();
});

afterEach(() => {
	rmSync(tempDir, { force: true, recursive: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// resolveSessionMode — compact form
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveSessionMode', () => {
	// ── idle ───────────────────────────────────────────────────────────

	it('returns "idle" when no profile and no active node', () => {
		const state = createSession();
		expect(state.selectedProfileId).toBeNull();
		expect(state.activeNodeId).toBeNull();

		const mode = resolveSessionMode(state);
		expect(mode).toBe('idle');
	});

	// ── structure_overview ─────────────────────────────────────────────

	it('returns "structure_overview" when profile selected and no active node', () => {
		const state = createSession();
		const withProfile = patchRuntimeState(state, {
			selectedProfileId: 'my-profile' as ProfileId,
		});

		const mode = resolveSessionMode(withProfile);
		expect(mode).toBe('structure_overview');
	});

	// ── node_focus ─────────────────────────────────────────────────────

	it('returns "node_focus" when valid activeNodeId with matching profile', () => {
		const profile = minimalProfile();
		const state = patchRuntimeState(createSession(), {
			activeNodeId: `${profile.id}-node-1` as NodeId,
			selectedProfileId: profile.id,
		});

		const mode = resolveSessionMode(state, profile);
		expect(mode).toBe('node_focus');
	});

	// ── error (active node without profile) ────────────────────────────

	it('returns "error" when activeNodeId is set but no profile selected', () => {
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'orphan-node' as NodeId,
		});
		expect(state.selectedProfileId).toBeNull();
		expect(state.activeNodeId).not.toBeNull();

		const mode = resolveSessionMode(state);
		expect(mode).toBe('error');
	});

	// ── error (active node + no profile definition) ────────────────────

	it('returns "error" when activeNodeId is set but profile definition not supplied', () => {
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'some-node' as NodeId,
			selectedProfileId: 'some-profile' as ProfileId,
		});

		// No profile supplied — cannot validate the node.
		const mode = resolveSessionMode(state); // one-arg form
		expect(mode).toBe('error');
	});

	// ── error (invalid activeNodeId) ───────────────────────────────────

	it('returns "error" when activeNodeId does not exist in profile', () => {
		const profile = minimalProfile();
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'nonexistent-node' as NodeId,
			selectedProfileId: profile.id,
		});

		const mode = resolveSessionMode(state, profile);
		expect(mode).toBe('error');
	});

	// ── error (profile mismatch) ───────────────────────────────────────

	it('returns "error" when profile.id != state.selectedProfileId', () => {
		const profile = minimalProfile({ id: 'profile-a' as ProfileId });
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'profile-a-node-1' as NodeId,
			selectedProfileId: 'profile-b' as ProfileId,
		});

		const mode = resolveSessionMode(state, profile);
		expect(mode).toBe('error');
	});

	// ── immutability ───────────────────────────────────────────────────

	it('does not mutate the input state', () => {
		const profile = minimalProfile();
		const state = patchRuntimeState(createSession(), {
			activeNodeId: `${profile.id}-node-1` as NodeId,
			selectedProfileId: profile.id,
		});
		const original = cloneState(state);

		resolveSessionMode(state, profile);
		expect(state).toEqual(original);
	});

	// ── determinism ────────────────────────────────────────────────────

	it('is deterministic — same inputs always produce the same output', () => {
		const profile = minimalProfile();
		const state = patchRuntimeState(createSession(), {
			activeNodeId: `${profile.id}-node-1` as NodeId,
			selectedProfileId: profile.id,
		});

		const r1 = resolveSessionMode(state, profile);
		const r2 = resolveSessionMode(state, profile);
		const r3 = resolveSessionMode(state, profile);

		expect(r1).toBe(r2);
		expect(r2).toBe(r3);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// resolveSessionModeWithDiagnostics — full form
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveSessionModeWithDiagnostics', () => {
	// ── idle ───────────────────────────────────────────────────────────

	it('returns idle with no diagnostics', () => {
		const state = createSession();
		const result = resolveSessionModeWithDiagnostics(state);

		expect(result.mode).toBe('idle');
		expect(result.diagnostics).toEqual([]);
	});

	// ── structure_overview ─────────────────────────────────────────────

	it('returns structure_overview with no diagnostics', () => {
		const state = patchRuntimeState(createSession(), {
			selectedProfileId: 'p' as ProfileId,
		});

		const result = resolveSessionModeWithDiagnostics(state);

		expect(result.mode).toBe('structure_overview');
		expect(result.diagnostics).toEqual([]);
	});

	// ── node_focus ─────────────────────────────────────────────────────

	it('returns node_focus with no diagnostics for valid active node', () => {
		const profile = minimalProfile();
		const state = patchRuntimeState(createSession(), {
			activeNodeId: `${profile.id}-node-1` as NodeId,
			selectedProfileId: profile.id,
		});

		const result = resolveSessionModeWithDiagnostics(state, profile);

		expect(result.mode).toBe('node_focus');
		expect(result.diagnostics).toEqual([]);
	});

	// ── error: active node without profile ─────────────────────────────

	it('returns error with diagnostic for active node without profile', () => {
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'orphan' as NodeId,
		});

		const result = resolveSessionModeWithDiagnostics(state);

		expect(result.mode).toBe('error');
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe(
			'LOGOS_STATE_ACTIVE_NODE_WITHOUT_PROFILE',
		);
		expect(result.diagnostics[0]?.severity).toBe('error');
		expect(result.diagnostics[0]?.sourceId).toBe('orphan');
	});

	// ── error: missing profile definition ──────────────────────────────

	it('returns error with diagnostic when profile definition is missing', () => {
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'n' as NodeId,
			selectedProfileId: 'p' as ProfileId,
		});

		const result = resolveSessionModeWithDiagnostics(state); // no profile

		expect(result.mode).toBe('error');
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe(
			'LOGOS_STATE_PROFILE_DEFINITION_REQUIRED',
		);
	});

	// ── error: profile mismatch ────────────────────────────────────────

	it('returns error with diagnostic for profile ID mismatch', () => {
		const profile = minimalProfile({ id: 'alpha' as ProfileId });
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'alpha-node-1' as NodeId,
			selectedProfileId: 'beta' as ProfileId,
		});

		const result = resolveSessionModeWithDiagnostics(state, profile);

		expect(result.mode).toBe('error');
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe('LOGOS_STATE_PROFILE_MISMATCH');
	});

	// ── error: node not in profile ─────────────────────────────────────

	it('returns error with diagnostic for node not in profile', () => {
		const profile = minimalProfile();
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'ghost-node' as NodeId,
			selectedProfileId: profile.id,
		});

		const result = resolveSessionModeWithDiagnostics(state, profile);

		expect(result.mode).toBe('error');
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe('LOGOS_STATE_NODE_NOT_IN_PROFILE');
		expect(result.diagnostics[0]?.sourceId).toBe('ghost-node');
	});

	// ── multiple errors are not accumulated (first error wins) ────────

	it('reports only the first error (active-node-without-profile)', () => {
		// activeNodeId set, selectedProfileId null → first guard triggers.
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'orphan' as NodeId,
		});

		const result = resolveSessionModeWithDiagnostics(state);

		expect(result.mode).toBe('error');
		// Only one diagnostic — the first guard that failed.
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe(
			'LOGOS_STATE_ACTIVE_NODE_WITHOUT_PROFILE',
		);
	});

	// ── immutability ───────────────────────────────────────────────────

	it('does not mutate input state or profile', () => {
		const profile = minimalProfile();
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'ghost' as NodeId,
			selectedProfileId: profile.id,
		});
		const originalState = cloneState(state);
		const originalProfile = JSON.parse(JSON.stringify(profile));

		resolveSessionModeWithDiagnostics(state, profile);

		expect(state).toEqual(originalState);
		expect(profile).toEqual(originalProfile);
	});

	// ── determinism ────────────────────────────────────────────────────

	it('is deterministic across calls', () => {
		const profile = minimalProfile();
		const state = patchRuntimeState(createSession(), {
			activeNodeId: `${profile.id}-node-1` as NodeId,
			selectedProfileId: profile.id,
		});

		const r1 = resolveSessionModeWithDiagnostics(state, profile);
		const r2 = resolveSessionModeWithDiagnostics(state, profile);

		expect(r1.mode).toBe(r2.mode);
		expect(r1.diagnostics).toEqual(r2.diagnostics);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Mode transitions (profile changes)
// ═══════════════════════════════════════════════════════════════════════════

describe('mode transitions', () => {
	it('returns error when activeNodeId is stale (different profile selected)', () => {
		// Simulate a state where the user had a node active for profile A,
		// then changed to profile B without clearing activeNodeId.
		const profileB = minimalProfile({ id: 'profile-b' as ProfileId });
		const state = patchRuntimeState(createSession(), {
			activeNodeId: 'profile-a-node-1' as NodeId, // stale — belongs to profile-a
			selectedProfileId: 'profile-b' as ProfileId,
		});

		const result = resolveSessionModeWithDiagnostics(state, profileB);

		expect(result.mode).toBe('error');
		// The profile IDs match, but the node doesn't exist in profile B.
		expect(result.diagnostics[0]?.code).toBe('LOGOS_STATE_NODE_NOT_IN_PROFILE');
	});

	it('transitions from node_focus to structure_overview after changeProfile', () => {
		writeMinimalProfile(tempDir, 'alpha');
		writeMinimalProfile(tempDir, 'beta');

		// Start session, select alpha, then change to beta.
		const initial = createSession();

		const selectResult = selectProfile(initial, 'alpha' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!selectResult.ok) throw new Error('Expected ok');

		// After selectProfile, mode should be structure_overview.
		expect(selectResult.state.mode).toBe('structure_overview');

		// Changing to beta should also yield structure_overview.
		const changeResult = changeProfile(
			selectResult.state,
			'beta' as ProfileId,
			{ profileDirectory: tempDir },
		);
		if (!changeResult.ok) throw new Error('Expected ok');
		expect(changeResult.state.mode).toBe('structure_overview');
	});

	it('selectProfile uses resolveSessionMode to compute mode', () => {
		writeMinimalProfile(tempDir, 'test-profile');
		const initial = createSession();

		const result = selectProfile(initial, 'test-profile' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!result.ok) throw new Error('Expected ok');

		// After selecting a profile with no active node, mode is structure_overview.
		expect(result.state.mode).toBe('structure_overview');
		expect(result.state.activeNodeId).toBeNull();
		expect(result.state.selectedProfileId).toBe('test-profile');
	});

	it('mode remains structure_overview when changing between profiles', () => {
		writeMinimalProfile(tempDir, 'first');
		writeMinimalProfile(tempDir, 'second');

		const initial = createSession();

		const r1 = selectProfile(initial, 'first' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!r1.ok) throw new Error('Expected ok');
		expect(r1.state.mode).toBe('structure_overview');

		const r2 = selectProfile(r1.state, 'second' as ProfileId, {
			profileDirectory: tempDir,
		});
		if (!r2.ok) throw new Error('Expected ok');
		// Mode should still be structure_overview — changing profiles
		// resets activeNodeId, so we land back in structure_overview.
		expect(r2.state.mode).toBe('structure_overview');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// SessionModeResolution type
// ═══════════════════════════════════════════════════════════════════════════

describe('SessionModeResolution type', () => {
	it('is a valid type with mode and diagnostics', () => {
		const resolution: SessionModeResolution = {
			diagnostics: [],
			mode: 'idle',
		};
		expect(resolution.mode).toBe('idle');
		expect(resolution.diagnostics).toEqual([]);
	});
});
