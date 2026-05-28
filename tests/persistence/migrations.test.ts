/**
 * Tests for Step 13.3 — schema migrations.
 *
 * Covers:
 *  - Identity (same version) returns data unchanged.
 *  - Migration runs on schema mismatch.
 *  - Migration preserves messages and accepted canonical answers.
 *  - Missing migration path returns error.
 *  - Newer version than target returns error.
 *  - Migration that drops data returns error.
 */
import { describe, expect, it } from 'vitest';

import type {
	LogosRuntimeState,
	Migration,
} from '../../src/contracts/index.js';
import { runMigrations } from '../../src/persistence/migrations.js';
import { CURRENT_SCHEMA_VERSION } from '../../src/persistence/snapshot-store.js';
import type { NodeId, SessionId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

function makeRuntimeState(
	sessionId = 'sess-test',
	messages = 0,
	acceptedCount = 0,
): LogosRuntimeState {
	const conversation = Array.from({ length: messages }, (_, i) => ({
		content: `Message ${i + 1}`,
		createdAt: nowIso(),
		id: `msg-${i + 1}`,
		role: 'user' as const,
	}));

	// Build a node state for each accepted node.
	const nodeStates: Record<string, unknown> = {};

	for (let i = 1; i <= acceptedCount; i++) {
		nodeStates[`n${i}`] = {
			allowedActions: [],
			canonicalAnswer: {
				accepted: true,
				acceptedAt: nowIso(),
				confidence: 'high' as const,
				content: `Answer for n${i}`,
				format: 'markdown' as const,
				generatedAt: nowIso(),
				generatedFromMessageIds: ['msg-1'],
				stale: false,
			},
			completeness: {
				blockingIssues: [],
				complete: true,
				missing: [],
				sufficient: ['topic-1'],
				weak: [],
			},
			conversation,
			dependencies: {
				blockedBy: [],
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
			lifecycle: 'accepted' as const,
			nodeId: `n${i}` as NodeId,
			promptState: 'accepted' as const,
			updatedAt: nowIso(),
		};
	}

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
		mode: 'idle' as const,
		nodeStates: nodeStates as LogosRuntimeState['nodeStates'],
		selectedProfileId: null,
		sessionId: sessionId as SessionId,
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('runMigrations', () => {
	// ─────────────────────────────────────────────────────────────────
	// Identity
	// ─────────────────────────────────────────────────────────────────

	describe('identity (same version)', () => {
		it('should return data unchanged when versions match', () => {
			const state = makeRuntimeState();
			const result = runMigrations(state, CURRENT_SCHEMA_VERSION);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value).toBe(state); // Same reference — no copy needed.
		});

		it('should return data unchanged with explicit toVersion', () => {
			const state = makeRuntimeState();
			const result = runMigrations(
				state,
				CURRENT_SCHEMA_VERSION,
				CURRENT_SCHEMA_VERSION,
			);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value).toBe(state);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Migration execution
	// ─────────────────────────────────────────────────────────────────

	describe('migration execution', () => {
		it('should run a migration when versions differ', () => {
			const state = makeRuntimeState();
			const migration: Migration = {
				from: '0.9.0',
				migrate: (data: unknown) => {
					// Append a marker to the project name.
					const s = data as LogosRuntimeState;
					return {
						...s,
						globalContext: {
							...s.globalContext,
							projectName: 'migrated',
						},
					} as LogosRuntimeState;
				},
				to: '1.0.0',
			};

			const result = runMigrations(state, '0.9.0', '1.0.0', [migration]);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value.globalContext.projectName).toBe('migrated');
		});

		it('should run multiple migrations in sequence', () => {
			const state = makeRuntimeState();
			const m1: Migration = {
				from: '0.9.0',
				migrate: (data: unknown) => {
					const s = data as LogosRuntimeState;
					return {
						...s,
						globalContext: {
							...s.globalContext,
							projectName: 'step1',
						},
					} as LogosRuntimeState;
				},
				to: '0.9.5',
			};
			const m2: Migration = {
				from: '0.9.5',
				migrate: (data: unknown) => {
					const s = data as LogosRuntimeState;
					return {
						...s,
						globalContext: {
							...s.globalContext,
							summary: 'step2',
						},
					} as LogosRuntimeState;
				},
				to: '1.0.0',
			};

			const result = runMigrations(state, '0.9.0', '1.0.0', [m1, m2]);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('Expected success');
			expect(result.value.globalContext.projectName).toBe('step1');
			expect(result.value.globalContext.summary).toBe('step2');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Preservation
	// ─────────────────────────────────────────────────────────────────

	describe('preservation', () => {
		it('should preserve conversation messages across migration', () => {
			const state = makeRuntimeState('sess-test', 5, 0);
			const migration: Migration = {
				from: '0.9.0',
				migrate: (data: unknown) => data, // identity transformation
				to: '1.0.0',
			};

			const result = runMigrations(state, '0.9.0', '1.0.0', [migration]);

			expect(result.ok).toBe(true);
		});

		it('should preserve accepted canonical answers across migration', () => {
			const state = makeRuntimeState('sess-test', 3, 2);
			const migration: Migration = {
				from: '0.9.0',
				migrate: (data: unknown) => data,
				to: '1.0.0',
			};

			const result = runMigrations(state, '0.9.0', '1.0.0', [migration]);

			expect(result.ok).toBe(true);
		});

		it('should error if migration drops conversation messages', () => {
			const state = makeRuntimeState('sess-test', 5, 1);
			const migration: Migration = {
				from: '0.9.0',
				migrate: (data: unknown) => {
					const s = data as LogosRuntimeState;
					// Drop conversations.
					const emptyStates: Record<string, unknown> = {};
					for (const key of Object.keys(s.nodeStates)) {
						const ns = s.nodeStates[key as NodeId];
						emptyStates[key] = {
							...ns,
							conversation: [], // Dropped!
						};
					}
					return {
						...s,
						nodeStates: emptyStates,
					} as LogosRuntimeState;
				},
				to: '1.0.0',
			};

			const result = runMigrations(state, '0.9.0', '1.0.0', [migration]);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('MIGRATION_DATA_LOSS');
		});

		it('should error if migration drops accepted canonical answers', () => {
			const state = makeRuntimeState('sess-test', 2, 2);
			const migration: Migration = {
				from: '0.9.0',
				migrate: (data: unknown) => {
					const s = data as LogosRuntimeState;
					// Drop canonical answers.
					const emptyStates: Record<string, unknown> = {};
					for (const key of Object.keys(s.nodeStates)) {
						const ns = s.nodeStates[key as NodeId];
						emptyStates[key] = {
							...ns,
							canonicalAnswer: null, // Dropped!
						};
					}
					return {
						...s,
						nodeStates: emptyStates,
					} as LogosRuntimeState;
				},
				to: '1.0.0',
			};

			const result = runMigrations(state, '0.9.0', '1.0.0', [migration]);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('MIGRATION_DATA_LOSS');
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Error cases
	// ─────────────────────────────────────────────────────────────────

	describe('error cases', () => {
		it('should error when no migration path exists', () => {
			const state = makeRuntimeState();
			const result = runMigrations(state, '0.5.0', '1.0.0', []);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('MIGRATION_PATH_NOT_FOUND');
		});

		it('should error when schema version is newer than target', () => {
			const state = makeRuntimeState();
			const result = runMigrations(state, '2.0.0', '1.0.0');

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('MIGRATION_NEWER_VERSION');
		});

		it('should error when migration throws', () => {
			const state = makeRuntimeState();
			const broken: Migration = {
				from: '0.9.0',
				migrate: () => {
					throw new Error('boom');
				},
				to: '1.0.0',
			};

			const result = runMigrations(state, '0.9.0', '1.0.0', [broken]);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('Expected failure');
			expect(result.error.code).toBe('MIGRATION_EXECUTION_FAILED');
		});
	});
});
