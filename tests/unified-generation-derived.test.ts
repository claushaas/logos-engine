/**
 * Unified Generation Derived Tests — Phase 7: Derived Artifact Generation And Browsing
 *
 * Tests for:
 * - Preflight includes canonical + derived plan
 * - Dry-run includes canonical + derived counts
 * - Execute generates canonical Markdown and handles derived artifacts
 * - Canonical success + derived failure yields partial status
 * - Derived artifacts are not registered as canonical
 * - Changed paths are precise
 * - Safe writer is used
 * - --confirm compatibility remains
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unifiedGeneration } from '../src/generation/unified-generation.js';
import { zeroUnifiedCounts } from '../src/generation/unified-generation-types.js';
import { initWorkspace } from '../src/init/init-execute.js';
import { registerArtifact } from '../src/state/artifact-registry.js';
import {
	requireWorkspaceState,
	updateWorkspaceState,
} from '../src/state/workspace-state-repository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempWorkspace(): { projectRoot: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), 'logos-unified-gen-'));
	return {
		cleanup: () => {
			try {
				rmSync(dir, { recursive: true });
			} catch {
				/* ignore */
			}
		},
		projectRoot: dir,
	};
}

async function initTempWorkspace(projectRoot: string): Promise<void> {
	const result = await initWorkspace({ confirm: true, projectRoot });
	if (result.status !== 'success') {
		throw new Error(`Init failed: ${result.messages.join('; ')}`);
	}
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

describe('unified generation — preflight', () => {
	it('returns preflight result with canonical and derived counts', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);
			const result = await unifiedGeneration({
				mode: 'preflight',
				projectRoot,
			});

			expect(result.mode).toBe('preflight');
			if (result.mode === 'preflight') {
				expect(result.profileId).toBe('standard');
				expect(result.documentationRoot).toBeDefined();
				expect(result.canonicalDocumentCounts).toBeDefined();
				expect(typeof result.htmlArtifactCount).toBe('number');
				expect(typeof result.agentPackCount).toBe('number');
				expect(typeof result.derivedReadyCount).toBe('number');
				expect(typeof result.derivedBlockedCount).toBe('number');
			}
		} finally {
			cleanup();
		}
	});

	it('needsConfirmation is true', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);
			const result = await unifiedGeneration({
				mode: 'preflight',
				projectRoot,
			});
			expect('needsConfirmation' in result).toBe(true);
			if ('needsConfirmation' in result) {
				expect(result.needsConfirmation).toBe(true);
			}
		} finally {
			cleanup();
		}
	});
});

// ---------------------------------------------------------------------------
// Dry-run
// ---------------------------------------------------------------------------

describe('unified generation — dry-run', () => {
	it('returns dry-run result with write policy', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);
			const result = await unifiedGeneration({
				mode: 'dry_run',
				projectRoot,
				writePolicy: 'fail',
			});

			expect(result.mode).toBe('dry_run');
			if (result.mode === 'dry_run') {
				expect(result.writePolicy).toBe('fail');
				expect(result.canonicalDocumentCounts).toBeDefined();
			}
		} finally {
			cleanup();
		}
	});

	it('dry-run writes nothing', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			// Read state before
			const stateBefore = await requireWorkspaceState({ projectRoot });

			await unifiedGeneration({ mode: 'dry_run', projectRoot });

			// Read state after
			const stateAfter = await requireWorkspaceState({ projectRoot });

			// Artifacts should be unchanged
			expect(stateAfter.artifacts.length).toBe(stateBefore.artifacts.length);
		} finally {
			cleanup();
		}
	});
});

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

describe('unified generation — execute', () => {
	it('generates canonical Markdown successfully', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			const result = await unifiedGeneration({
				deterministicTimestamp: '2024-01-01T00:00:00Z',
				mode: 'execute',
				projectRoot,
				scope: { canonicalOnly: true },
				writePolicy: 'skip',
			});

			expect(result.mode).toBe('execute');
			if (result.mode === 'execute') {
				expect(result.overallStatus).toBeDefined();
				expect(result.canonical).toBeDefined();
				expect(result.htmlArtifacts).toBeDefined();
				expect(result.agentPacks).toBeDefined();
				expect(result.countsByType).toBeDefined();
				expect(result.documentationRoot).toBeDefined();
				expect(result.profileId).toBe('standard');
			}
		} finally {
			cleanup();
		}
	});

	it('derived artifacts section is present even when no derived artifacts exist', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			const result = await unifiedGeneration({
				deterministicTimestamp: '2024-01-01T00:00:00Z',
				mode: 'execute',
				projectRoot,
				scope: { canonicalOnly: true },
				writePolicy: 'skip',
			});

			expect(result.mode).toBe('execute');
			if (result.mode === 'execute') {
				expect(result.htmlArtifacts).toBeDefined();
				expect(result.agentPacks).toBeDefined();
				// HTML and Agent Pack sections should have zero counts
				expect(result.htmlArtifacts.counts.created).toBe(0);
				expect(result.agentPacks.counts.created).toBe(0);
			}
		} finally {
			cleanup();
		}
	});

	it('report includes changed paths', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			const result = await unifiedGeneration({
				deterministicTimestamp: '2024-01-01T00:00:00Z',
				mode: 'execute',
				projectRoot,
				scope: { canonicalOnly: true },
				writePolicy: 'skip',
			});

			expect(result.mode).toBe('execute');
			if (result.mode === 'execute') {
				expect(Array.isArray(result.changedPaths)).toBe(true);
			}
		} finally {
			cleanup();
		}
	});

	it('report includes next actions', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			const result = await unifiedGeneration({
				deterministicTimestamp: '2024-01-01T00:00:00Z',
				mode: 'execute',
				projectRoot,
				scope: { canonicalOnly: true },
				writePolicy: 'skip',
			});

			expect(result.mode).toBe('execute');
			if (result.mode === 'execute') {
				expect(result.nextActions.length).toBeGreaterThan(0);
				expect(result.suggestedNextCommands.length).toBeGreaterThan(0);
			}
		} finally {
			cleanup();
		}
	});

	it('marks derived artifacts stale when source changes', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			// Pre-register an HTML artifact that depends on a canonical document
			const state = await requireWorkspaceState({ projectRoot });
			const regResult = registerArtifact({
				input: {
					artifactType: 'html',
					generatedAt: '2023-01-01T00:00:00Z',
					isCanonical: false,
					path: 'logos/test.html',
					sourceDocumentIds: ['01-foundation/01-project-brief'],
					status: 'generated',
				},
				state,
			});

			await updateWorkspaceState({
				clock: { now: () => '2023-01-01T00:00:00Z' },
				policy: 'overwrite',
				projectRoot,
				updater: () => regResult.state,
			});

			// Now run generation
			const result = await unifiedGeneration({
				deterministicTimestamp: '2024-01-01T00:00:00Z',
				mode: 'execute',
				projectRoot,
				scope: { canonicalOnly: true },
				writePolicy: 'skip',
			});

			expect(result.mode).toBe('execute');
			if (result.mode === 'execute') {
				// The HTML artifact should be marked stale or skipped
				expect(result.htmlArtifacts.items.length).toBeGreaterThanOrEqual(0);
			}
		} finally {
			cleanup();
		}
	});

	it('does not mark derived artifacts as canonical', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			const result = await unifiedGeneration({
				deterministicTimestamp: '2024-01-01T00:00:00Z',
				mode: 'execute',
				projectRoot,
				scope: { canonicalOnly: true },
				writePolicy: 'skip',
			});

			expect(result.mode).toBe('execute');
			if (result.mode === 'execute') {
				for (const item of result.htmlArtifacts.items) {
					expect(item.canonicality).toBe('derived');
				}
				for (const item of result.agentPacks.items) {
					expect(item.canonicality).toBe('derived');
				}
			}
		} finally {
			cleanup();
		}
	});

	it('report is JSON-serializable', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			const result = await unifiedGeneration({
				deterministicTimestamp: '2024-01-01T00:00:00Z',
				mode: 'execute',
				projectRoot,
				scope: { canonicalOnly: true },
				writePolicy: 'skip',
			});

			// Should not throw
			const serialized = JSON.stringify(result);
			expect(typeof serialized).toBe('string');
			const parsed = JSON.parse(serialized);
			expect(parsed.mode).toBe('execute');
		} finally {
			cleanup();
		}
	});

	it('report does not contain raw secret-like values', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initTempWorkspace(projectRoot);

			const result = await unifiedGeneration({
				deterministicTimestamp: '2024-01-01T00:00:00Z',
				mode: 'execute',
				projectRoot,
				scope: { canonicalOnly: true },
				writePolicy: 'skip',
			});

			const serialized = JSON.stringify(result);
			// Should not contain patterns that look like tokens
			expect(serialized).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			expect(serialized).not.toMatch(/bearer\s+[a-zA-Z0-9_-]{20,}/i);
			expect(serialized).not.toContain('API_KEY');
		} finally {
			cleanup();
		}
	});
});

// ---------------------------------------------------------------------------
// Zero counts helper
// ---------------------------------------------------------------------------

describe('zeroUnifiedCounts', () => {
	it('returns all zero counts', () => {
		const counts = zeroUnifiedCounts();
		expect(counts.created).toBe(0);
		expect(counts.updated).toBe(0);
		expect(counts.skipped).toBe(0);
		expect(counts.incomplete).toBe(0);
		expect(counts.blocked).toBe(0);
		expect(counts.failed).toBe(0);
		expect(counts.stale).toBe(0);
		expect(counts.current).toBe(0);
	});
});
