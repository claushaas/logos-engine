/**
 * Output Browser Tests — Phase 7: Derived Artifact Generation And Browsing
 *
 * Tests for:
 * - listOutputs with filters (type, canonicality, status)
 * - getOutput detail view
 * - getOutputSources view
 * - listStaleOutputs view
 * - summarizeOutputs
 * - Output browser is read-only (no writes, no mutation)
 * - Display kind normalization
 * - Canonical/derived distinction
 * - Empty state handling
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	getOutput,
	getOutputSources,
	listOutputs,
	listStaleOutputs,
	summarizeOutputs,
} from '../src/artifacts/output-browser.js';
import {
	canonicalityLabel,
	matchesOutputFilter,
	normalizeDisplayKind,
	toOutputBrowserItem,
	toOutputDetailView,
} from '../src/artifacts/output-browser-model.js';
import { initWorkspace } from '../src/init/init-execute.js';
import { registerArtifact } from '../src/state/artifact-registry.js';
import type { WorkspaceState } from '../src/state/workspace-state.schema.js';
import { readWorkspaceState } from '../src/state/workspace-state-repository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempWorkspace(): { projectRoot: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), 'logos-output-browser-'));
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

async function initializeTempWorkspace(
	projectRoot: string,
): Promise<WorkspaceState> {
	const result = await initWorkspace({
		confirm: true,
		projectRoot,
	});
	if (result.status !== 'success') {
		throw new Error(
			`Failed to initialize workspace: ${result.messages.join('; ')}`,
		);
	}
	const read = await readWorkspaceState({ projectRoot });
	if (!read.success || !read.state) {
		throw new Error('Failed to read workspace state after init');
	}
	return read.state;
}

// ---------------------------------------------------------------------------
// Display kind normalization
// ---------------------------------------------------------------------------

describe('output browser model — normalizeDisplayKind', () => {
	it('maps canonical_markdown to canonical_markdown display kind', () => {
		const artifact = {
			artifactId: 'a1',
			artifactType: 'canonical_markdown' as const,
			isCanonical: true,
			path: 'logos/test.md',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(normalizeDisplayKind(artifact)).toBe('canonical_markdown');
	});

	it('maps html to html_artifact display kind', () => {
		const artifact = {
			artifactId: 'a2',
			artifactType: 'html' as const,
			isCanonical: false,
			path: 'logos/test.html',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(normalizeDisplayKind(artifact)).toBe('html_artifact');
	});

	it('maps agent_pack to agent_pack display kind', () => {
		const artifact = {
			artifactId: 'a3',
			artifactType: 'agent_pack' as const,
			isCanonical: false,
			path: 'logos/test.pack.md',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(normalizeDisplayKind(artifact)).toBe('agent_pack');
	});

	it('maps report to report display kind', () => {
		const artifact = {
			artifactId: 'a4',
			artifactType: 'report' as const,
			isCanonical: false,
			path: 'logos/report.md',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(normalizeDisplayKind(artifact)).toBe('report');
	});

	it('maps executive_json to executive_output display kind', () => {
		const artifact = {
			artifactId: 'a5',
			artifactType: 'executive_json' as const,
			isCanonical: false,
			path: 'logos/exec.json',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(normalizeDisplayKind(artifact)).toBe('executive_output');
	});

	it('maps executive_markdown to executive_output', () => {
		const artifact = {
			artifactId: 'a6',
			artifactType: 'executive_markdown' as const,
			isCanonical: false,
			path: 'logos/exec.md',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(normalizeDisplayKind(artifact)).toBe('executive_output');
	});

	it('maps data with graph_artifact subtype to graph_artifact', () => {
		const artifact = {
			artifactId: 'a7',
			artifactType: 'data' as const,
			isCanonical: false,
			metadata: { subtype: 'graph_artifact' },
			path: 'logos/graph.json',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(normalizeDisplayKind(artifact)).toBe('graph_artifact');
	});
});

// ---------------------------------------------------------------------------
// Canonicality labels
// ---------------------------------------------------------------------------

describe('output browser model — canonicalityLabel', () => {
	it('returns canonical for canonical_markdown', () => {
		const artifact = {
			artifactId: 'a1',
			artifactType: 'canonical_markdown' as const,
			isCanonical: true,
			path: 'logos/test.md',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(canonicalityLabel(artifact)).toBe('canonical');
	});

	it('returns derived for html', () => {
		const artifact = {
			artifactId: 'a2',
			artifactType: 'html' as const,
			isCanonical: false,
			path: 'logos/test.html',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(canonicalityLabel(artifact)).toBe('derived');
	});

	it('returns derived for agent_pack', () => {
		const artifact = {
			artifactId: 'a3',
			artifactType: 'agent_pack' as const,
			isCanonical: false,
			path: 'logos/test.pack.md',
			sourceDocumentIds: [],
			status: 'generated' as const,
		};
		expect(canonicalityLabel(artifact)).toBe('derived');
	});
});

// ---------------------------------------------------------------------------
// toOutputBrowserItem
// ---------------------------------------------------------------------------

describe('output browser model — toOutputBrowserItem', () => {
	it('includes canonicality and display kind', () => {
		const artifact = {
			artifactId: 'a1',
			artifactType: 'canonical_markdown' as const,
			generatedAt: '2024-01-01T00:00:00Z',
			isCanonical: true,
			path: 'logos/doc.md',
			sourceDocumentIds: ['doc1'],
			status: 'generated' as const,
		};
		const item = toOutputBrowserItem(artifact);
		expect(item.artifactId).toBe('a1');
		expect(item.canonicality).toBe('canonical');
		expect(item.displayKind).toBe('canonical_markdown');
		expect(item.status).toBe('generated');
	});

	it('adds stale diagnostic for stale artifacts', () => {
		const artifact = {
			artifactId: 'a2',
			artifactType: 'html' as const,
			isCanonical: false,
			path: 'logos/doc.html',
			sourceDocumentIds: ['doc1'],
			status: 'stale' as const,
		};
		const item = toOutputBrowserItem(artifact);
		expect(item.diagnostics.length).toBeGreaterThan(0);
		expect(item.diagnostics.some((d) => d.code === 'LOGOS_OUTPUT_STALE')).toBe(
			true,
		);
	});

	it('adds failed diagnostic for failed artifacts', () => {
		const artifact = {
			artifactId: 'a3',
			artifactType: 'html' as const,
			isCanonical: false,
			path: 'logos/doc.html',
			sourceDocumentIds: ['doc1'],
			status: 'failed' as const,
		};
		const item = toOutputBrowserItem(artifact);
		expect(item.diagnostics.some((d) => d.code === 'LOGOS_OUTPUT_FAILED')).toBe(
			true,
		);
	});

	it('adds blocked diagnostic for blocked artifacts', () => {
		const artifact = {
			artifactId: 'a4',
			artifactType: 'agent_pack' as const,
			isCanonical: false,
			path: 'logos/pack.md',
			sourceDocumentIds: ['doc1'],
			status: 'blocked' as const,
		};
		const item = toOutputBrowserItem(artifact);
		expect(
			item.diagnostics.some((d) => d.code === 'LOGOS_OUTPUT_BLOCKED'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// toOutputDetailView
// ---------------------------------------------------------------------------

describe('output browser model — toOutputDetailView', () => {
	it('includes next actions', () => {
		const artifact = {
			artifactId: 'a1',
			artifactType: 'canonical_markdown' as const,
			generatedAt: '2024-01-01T00:00:00Z',
			isCanonical: true,
			path: 'logos/doc.md',
			sourceDocumentIds: ['doc1'],
			status: 'generated' as const,
		};
		const detail = toOutputDetailView(artifact, ['src1']);
		expect(detail.nextActions.length).toBeGreaterThan(0);
		expect(detail.nextActions.some((a) => a.includes('/outputs sources'))).toBe(
			true,
		);
		expect(detail.sourceArtifactIds).toEqual(['src1']);
	});

	it('includes regenerate action for stale artifacts', () => {
		const artifact = {
			artifactId: 'a2',
			artifactType: 'html' as const,
			isCanonical: false,
			path: 'logos/doc.html',
			sourceDocumentIds: ['doc1'],
			status: 'stale' as const,
		};
		const detail = toOutputDetailView(artifact);
		expect(detail.nextActions.some((a) => a === '/generate')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// matchesOutputFilter
// ---------------------------------------------------------------------------

describe('output browser model — matchesOutputFilter', () => {
	const canonicalArtifact = {
		artifactId: 'a1',
		artifactType: 'canonical_markdown' as const,
		generatedAt: '2024-01-01T00:00:00Z',
		isCanonical: true,
		path: 'logos/doc.md',
		sourceDocumentIds: ['doc1'],
		status: 'generated' as const,
	};
	const htmlArtifact = {
		artifactId: 'a2',
		artifactType: 'html' as const,
		generatedAt: '2024-01-01T00:00:00Z',
		isCanonical: false,
		path: 'logos/doc.html',
		sourceDocumentIds: ['doc1'],
		status: 'generated' as const,
	};
	const staleHtmlArtifact = {
		artifactId: 'a3',
		artifactType: 'html' as const,
		isCanonical: false,
		path: 'logos/doc2.html',
		sourceDocumentIds: ['doc2'],
		status: 'stale' as const,
	};

	it('filters by artifactType', () => {
		expect(
			matchesOutputFilter(canonicalArtifact, {
				artifactType: 'canonical_markdown',
			}),
		).toBe(true);
		expect(
			matchesOutputFilter(htmlArtifact, { artifactType: 'canonical_markdown' }),
		).toBe(false);
	});

	it('filters by canonicality', () => {
		expect(
			matchesOutputFilter(canonicalArtifact, { canonicality: 'canonical' }),
		).toBe(true);
		expect(
			matchesOutputFilter(htmlArtifact, { canonicality: 'canonical' }),
		).toBe(false);
		expect(matchesOutputFilter(htmlArtifact, { canonicality: 'derived' })).toBe(
			true,
		);
	});

	it('filters by status', () => {
		expect(matchesOutputFilter(staleHtmlArtifact, { status: 'stale' })).toBe(
			true,
		);
		expect(matchesOutputFilter(htmlArtifact, { status: 'stale' })).toBe(false);
	});

	it('filters by documentId', () => {
		expect(matchesOutputFilter(canonicalArtifact, { documentId: 'doc1' })).toBe(
			true,
		);
		expect(matchesOutputFilter(canonicalArtifact, { documentId: 'doc2' })).toBe(
			false,
		);
	});

	it('returns true for empty filter', () => {
		expect(matchesOutputFilter(canonicalArtifact, {})).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Output browser service (integration, read-only)
// ---------------------------------------------------------------------------

describe('output browser service', () => {
	it('listOutputs returns empty list for uninitialized workspace', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			const result = await listOutputs({ projectRoot });
			expect('error' in result).toBe(true);
		} finally {
			cleanup();
		}
	});

	it('listOutputs returns artifacts from initialized workspace', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			const state = await initializeTempWorkspace(projectRoot);

			// Register a canonical artifact
			const regResult = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					checksum: 'abc123',
					generatedAt: '2024-01-01T00:00:00Z',
					isCanonical: true,
					path: 'logos/01-foundation/test.md',
					sourceDocumentIds: ['doc1'],
					status: 'generated',
				},
				state,
			});

			// Persist the updated state
			await initWorkspace({ confirm: true, projectRoot }); // re-init to get fresh
			// Actually, we need to write the state - let's use updateWorkspaceState
			const { updateWorkspaceState } = await import(
				'../src/state/workspace-state-repository.js'
			);
			await updateWorkspaceState({
				clock: { now: () => '2024-01-01T00:00:00Z' },
				policy: 'overwrite',
				projectRoot,
				updater: () => regResult.state,
			});

			const result = await listOutputs({ projectRoot });
			expect('error' in result).toBe(false);
			if ('items' in result) {
				expect(result.totalCount).toBeGreaterThanOrEqual(1);
				const canonical = result.items.filter(
					(i) => i.canonicality === 'canonical',
				);
				expect(canonical.length).toBeGreaterThanOrEqual(1);
			}
		} finally {
			cleanup();
		}
	});

	it('listOutputs with status filter returns only matching artifacts', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			const state = await initializeTempWorkspace(projectRoot);

			// Register artifacts with different statuses
			let s = state;
			const r1 = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					checksum: 'a1',
					generatedAt: '2024-01-01T00:00:00Z',
					isCanonical: true,
					path: 'logos/a.md',
					sourceDocumentIds: ['d1'],
					status: 'generated',
				},
				state: s,
			});
			s = r1.state;
			const r2 = registerArtifact({
				input: {
					artifactType: 'html',
					checksum: 'b1',
					generatedAt: '2024-01-01T00:00:00Z',
					isCanonical: false,
					path: 'logos/b.html',
					sourceDocumentIds: ['d1'],
					status: 'stale',
				},
				state: s,
			});
			s = r2.state;

			await (
				await import('../src/state/workspace-state-repository.js')
			).updateWorkspaceState({
				clock: { now: () => '2024-01-01T00:00:00Z' },
				policy: 'overwrite',
				projectRoot,
				updater: () => s,
			});

			const generatedResult = await listOutputs({
				filter: { status: 'generated' },
				projectRoot,
			});
			expect('error' in generatedResult).toBe(false);
			if ('items' in generatedResult) {
				expect(
					generatedResult.items.every((i) => i.status === 'generated'),
				).toBe(true);
			}

			const staleResult = await listOutputs({
				filter: { status: 'stale' },
				projectRoot,
			});
			expect('error' in staleResult).toBe(false);
			if ('items' in staleResult) {
				expect(staleResult.items.every((i) => i.status === 'stale')).toBe(true);
			}
		} finally {
			cleanup();
		}
	});

	it('getOutput returns detail for existing artifact', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			const state = await initializeTempWorkspace(projectRoot);
			const regResult = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					checksum: 'abc123',
					generatedAt: '2024-01-01T00:00:00Z',
					isCanonical: true,
					path: 'logos/test.md',
					sourceDocumentIds: ['doc1'],
					status: 'generated',
				},
				state,
			});

			await (
				await import('../src/state/workspace-state-repository.js')
			).updateWorkspaceState({
				clock: { now: () => '2024-01-01T00:00:00Z' },
				policy: 'overwrite',
				projectRoot,
				updater: () => regResult.state,
			});

			const result = await getOutput(
				projectRoot,
				regResult.artifact.artifactId,
			);
			expect('error' in result).toBe(false);
			if ('artifactId' in result) {
				expect(result.artifactId).toBe(regResult.artifact.artifactId);
				expect(result.canonicality).toBe('canonical');
				expect(result.nextActions.length).toBeGreaterThan(0);
			}
		} finally {
			cleanup();
		}
	});

	it('getOutput returns error for unknown artifact', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initializeTempWorkspace(projectRoot);
			const result = await getOutput(projectRoot, 'nonexistent-id');
			expect('error' in result).toBe(true);
			if ('error' in result) {
				expect(result.error).toContain('not found');
			}
		} finally {
			cleanup();
		}
	});

	it('getOutputSources returns source information', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			const state = await initializeTempWorkspace(projectRoot);
			const regResult = registerArtifact({
				input: {
					artifactType: 'html',
					checksum: 'html123',
					generatedAt: '2024-01-01T00:00:00Z',
					isCanonical: false,
					path: 'logos/test.html',
					sourceDocumentIds: ['doc1', 'doc2'],
					status: 'generated',
				},
				state,
			});

			await (
				await import('../src/state/workspace-state-repository.js')
			).updateWorkspaceState({
				clock: { now: () => '2024-01-01T00:00:00Z' },
				policy: 'overwrite',
				projectRoot,
				updater: () => regResult.state,
			});

			const result = await getOutputSources(
				projectRoot,
				regResult.artifact.artifactId,
			);
			expect('error' in result).toBe(false);
			if ('sourceDocumentIds' in result) {
				expect(result.sourceDocumentIds).toContain('doc1');
				expect(result.sourceDocumentIds).toContain('doc2');
			}
		} finally {
			cleanup();
		}
	});

	it('listStaleOutputs returns stale artifacts', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			const state = await initializeTempWorkspace(projectRoot);

			let s = state;
			const r1 = registerArtifact({
				input: {
					artifactType: 'html',
					isCanonical: false,
					path: 'logos/stale.html',
					sourceDocumentIds: ['d1'],
					status: 'stale',
				},
				state: s,
			});
			s = r1.state;
			const r2 = registerArtifact({
				input: {
					artifactType: 'agent_pack',
					isCanonical: false,
					path: 'logos/blocked.pack.md',
					sourceDocumentIds: ['d1'],
					status: 'blocked',
				},
				state: s,
			});
			s = r2.state;

			await (
				await import('../src/state/workspace-state-repository.js')
			).updateWorkspaceState({
				clock: { now: () => '2024-01-01T00:00:00Z' },
				policy: 'overwrite',
				projectRoot,
				updater: () => s,
			});

			const result = await listStaleOutputs(projectRoot);
			expect('error' in result).toBe(false);
			if ('staleCount' in result) {
				expect(result.staleCount).toBeGreaterThanOrEqual(1);
				expect(result.items.length).toBeGreaterThanOrEqual(1);
				expect(result.nextActions.length).toBeGreaterThan(0);
			}
		} finally {
			cleanup();
		}
	});

	it('summarizeOutputs returns counts by type and status', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			const state = await initializeTempWorkspace(projectRoot);

			let s = state;
			s = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					isCanonical: true,
					path: 'logos/a.md',
					sourceDocumentIds: [],
					status: 'generated',
				},
				state: s,
			}).state;
			s = registerArtifact({
				input: {
					artifactType: 'html',
					isCanonical: false,
					path: 'logos/a.html',
					sourceDocumentIds: [],
					status: 'generated',
				},
				state: s,
			}).state;

			await (
				await import('../src/state/workspace-state-repository.js')
			).updateWorkspaceState({
				clock: { now: () => '2024-01-01T00:00:00Z' },
				policy: 'overwrite',
				projectRoot,
				updater: () => s,
			});

			const result = await summarizeOutputs(projectRoot);
			expect('error' in result).toBe(false);
			if ('canonicalCount' in result) {
				expect(result.canonicalCount).toBeGreaterThanOrEqual(1);
				expect(result.derivedCount).toBeGreaterThanOrEqual(1);
				expect(result.totalArtifacts).toBeGreaterThanOrEqual(2);
				expect(result.countsByType).toBeDefined();
				expect(result.countsByStatus).toBeDefined();
			}
		} finally {
			cleanup();
		}
	});

	it('output browser is read-only (does not mutate state)', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			await initializeTempWorkspace(projectRoot);

			// Read state before
			const before = await readWorkspaceState({ projectRoot });

			// Call multiple read operations
			await listOutputs({ projectRoot });
			await listStaleOutputs(projectRoot);
			await summarizeOutputs(projectRoot);

			// Read state after
			const after = await readWorkspaceState({ projectRoot });

			// State should be unchanged
			if (before.success && before.state && after.success && after.state) {
				expect(after.state.artifacts.length).toBe(
					before.state.artifacts.length,
				);
				// Metadata might be undefined in some states
				if (before.state.metadata && after.state.metadata) {
					expect(after.state.metadata.updatedAt).toBe(
						before.state.metadata.updatedAt,
					);
				}
			}
		} finally {
			cleanup();
		}
	});

	it('derived artifacts are never shown as canonical', async () => {
		const { projectRoot, cleanup } = createTempWorkspace();
		try {
			const state = await initializeTempWorkspace(projectRoot);

			let s = state;
			s = registerArtifact({
				input: {
					artifactType: 'html',
					isCanonical: false,
					path: 'logos/a.html',
					sourceDocumentIds: [],
					status: 'generated',
				},
				state: s,
			}).state;
			s = registerArtifact({
				input: {
					artifactType: 'agent_pack',
					isCanonical: false,
					path: 'logos/a.pack.md',
					sourceDocumentIds: [],
					status: 'generated',
				},
				state: s,
			}).state;

			await (
				await import('../src/state/workspace-state-repository.js')
			).updateWorkspaceState({
				clock: { now: () => '2024-01-01T00:00:00Z' },
				policy: 'overwrite',
				projectRoot,
				updater: () => s,
			});

			const result = await listOutputs({ projectRoot });
			expect('error' in result).toBe(false);
			if ('items' in result) {
				const derivedItems = result.items.filter(
					(i) => i.artifactType === 'html' || i.artifactType === 'agent_pack',
				);
				for (const item of derivedItems) {
					expect(item.canonicality).toBe('derived');
				}
			}
		} finally {
			cleanup();
		}
	});
});
