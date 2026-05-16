/** Artifact registry tests */

import { describe, expect, it } from 'vitest';
import {
	isArtifactCanonical,
	listArtifacts,
	registerArtifact,
	summarizeArtifacts,
	updateArtifactRecord,
} from '../src/state/artifact-registry.js';
import type { WorkspaceState } from '../src/state/workspace-state.schema.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';

function makeState(): WorkspaceState {
	return createDefaultWorkspaceState({
		createdAt: '2024-01-01T00:00:00.000Z',
		projectRootPath: '/tmp/test-repo',
		updatedAt: '2024-01-01T00:00:00.000Z',
		workspaceId: 'test-workspace',
	});
}

describe('artifact-registry', () => {
	describe('registerArtifact', () => {
		it('registers canonical Markdown artifact metadata', () => {
			const state = makeState();
			const result = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					path: 'logos/docs/frontend.md',
				},
				state,
			});
			expect(result.artifact.artifactType).toBe('canonical_markdown');
			expect(result.artifact.isCanonical).toBe(true);
		});

		it('registers HTML artifact metadata as non-canonical', () => {
			const state = makeState();
			const result = registerArtifact({
				input: {
					artifactType: 'html',
					path: 'logos/out/frontend.html',
				},
				state,
			});
			expect(result.artifact.isCanonical).toBe(false);
		});

		it('registers agent-pack artifact metadata as non-canonical', () => {
			const state = makeState();
			const result = registerArtifact({
				input: {
					artifactType: 'agent_pack',
					path: 'logos/out/agent-pack.md',
				},
				state,
			});
			expect(result.artifact.isCanonical).toBe(false);
		});

		it('registers executive artifact metadata as non-canonical', () => {
			const state = makeState();
			const result = registerArtifact({
				input: {
					artifactType: 'executive_json',
					path: 'logos/out/executive-plan.json',
				},
				state,
			});
			expect(result.artifact.isCanonical).toBe(false);
		});

		it('registers report/data artifact metadata', () => {
			const state = makeState();
			const result = registerArtifact({
				input: {
					artifactType: 'report',
					path: 'logos/out/report.md',
				},
				state,
			});
			expect(result.artifact.artifactType).toBe('report');
		});

		it('preserves source, path, status, checksum, generatedAt fields', () => {
			const state = makeState();
			const result = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					checksum: 'sha256:abc123',
					generatedAt: '2024-06-01T12:00:00.000Z',
					path: 'logos/docs/frontend.md',
					status: 'generated',
				},
				state,
			});
			expect(result.artifact.checksum).toBe('sha256:abc123');
			expect(result.artifact.generatedAt).toBe('2024-06-01T12:00:00.000Z');
			expect(result.artifact.path).toBe('logos/docs/frontend.md');
			expect(result.artifact.status).toBe('generated');
		});

		it('artifact registry does not create artifact files', () => {
			const state = makeState();
			const result = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					path: 'logos/docs/frontend.md',
				},
				state,
			});
			// No filesystem side effects
			expect(result.state.artifacts).toHaveLength(1);
		});

		it('artifact registry metadata does not make derived artifacts canonical', () => {
			const state = makeState();
			const result = registerArtifact({
				input: {
					artifactType: 'html',
					path: 'logos/out/frontend.html',
				},
				state,
			});
			// HTML must remain non-canonical even when registered
			expect(result.artifact.isCanonical).toBe(false);
			expect(isArtifactCanonical('html')).toBe(false);
		});
	});

	describe('updateArtifactRecord', () => {
		it('updates artifact status', () => {
			const state = makeState();
			const created = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					path: 'logos/docs/frontend.md',
					status: 'planned',
				},
				state,
			});
			const updated = updateArtifactRecord({
				artifactId: created.artifact.artifactId,
				state: created.state,
				updates: { status: 'generated' },
			});
			expect(updated.found).toBe(true);
			expect(updated.artifact.status).toBe('generated');
		});

		it('returns found false for unknown artifact', () => {
			const state = makeState();
			const result = updateArtifactRecord({
				artifactId: 'nonexistent',
				state,
				updates: { status: 'generated' },
			});
			expect(result.found).toBe(false);
		});
	});

	describe('listArtifacts', () => {
		it('lists artifacts in deterministic order', () => {
			let state = makeState();
			const a1 = registerArtifact({
				input: {
					artifactType: 'canonical_markdown',
					generatedAt: '2024-01-01T10:00:00.000Z',
					path: 'logos/a.md',
				},
				state,
			});
			state = a1.state;
			const a2 = registerArtifact({
				input: {
					artifactType: 'html',
					generatedAt: '2024-01-01T11:00:00.000Z',
					path: 'logos/b.html',
				},
				state,
			});
			state = a2.state;

			const list = listArtifacts({ state });
			expect(list.map((a) => a.artifactType)).toEqual([
				'html',
				'canonical_markdown',
			]);
		});

		it('filters by type', () => {
			let state = makeState();
			state = registerArtifact({
				input: { artifactType: 'canonical_markdown', path: 'a.md' },
				state,
			}).state;
			state = registerArtifact({
				input: { artifactType: 'html', path: 'b.html' },
				state,
			}).state;

			const list = listArtifacts({ filterByType: 'html', state });
			expect(list).toHaveLength(1);
			expect(list[0].artifactType).toBe('html');
		});
	});

	describe('summarizeArtifacts', () => {
		it('summarizes artifact counts by type and canonical/non-canonical marker', () => {
			let state = makeState();
			state = registerArtifact({
				input: { artifactType: 'canonical_markdown', path: 'a.md' },
				state,
			}).state;
			state = registerArtifact({
				input: { artifactType: 'html', path: 'b.html' },
				state,
			}).state;
			state = registerArtifact({
				input: { artifactType: 'agent_pack', path: 'c.md' },
				state,
			}).state;
			state = registerArtifact({
				input: { artifactType: 'report', path: 'd.md' },
				state,
			}).state;

			const summary = summarizeArtifacts(state);
			expect(summary.totalArtifacts).toBe(4);
			expect(summary.canonicalCount).toBe(1); // only canonical_markdown
			expect(summary.nonCanonicalCount).toBe(3); // html, agent_pack, report
			expect(summary.countsByType.canonical_markdown).toBe(1);
			expect(summary.countsByType.html).toBe(1);
			expect(summary.countsByType.agent_pack).toBe(1);
			expect(summary.countsByType.report).toBe(1);
		});
	});
});
