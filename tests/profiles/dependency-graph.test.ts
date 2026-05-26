/**
 * Tests for `buildDependencyGraph` — node dependency resolution from profile.
 */
import { describe, expect, it } from 'vitest';
import type { LogosProfile } from '../../src/contracts/profile.js';
import { buildDependencyGraph } from '../../src/profiles/dependency-graph.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

/**
 * Build a minimal profile with the given node definitions.
 *
 * All nodes are assigned to a single phase and document so the profile
 * passes structural validation. Only node IDs and dependencies vary per test.
 */
function profileWithNodes(
	nodes: Array<{
		id: string;
		requiredNodeIds?: string[];
		recommendedNodeIds?: string[];
	}>,
): LogosProfile {
	return {
		documents: [
			{
				id: 'test-doc' as unknown as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'test-phase',
				purpose: 'Testing',
				requiredNodeIds: [],
				title: 'Test Doc',
			},
		],
		id: 'test-profile' as unknown as ProfileId,
		materializationRules: [],
		nodes: nodes.map((n, i) => ({
			canonicalQuestion: `What is ${n.id}?`,
			coverageTopics: [],
			dependencies: {
				recommendedNodeIds: (n.recommendedNodeIds ?? []) as unknown as NodeId[],
				requiredNodeIds: (n.requiredNodeIds ?? []) as unknown as NodeId[],
			},
			documentId: 'test-doc' as unknown as DocumentId,
			id: n.id as unknown as NodeId,
			order: i + 1,
			phaseId: 'test-phase',
			promptRefs: {},
			sufficiencyCriteria: [],
			title: `Node ${n.id}`,
		})),
		phases: [
			{
				id: 'test-phase',
				order: 1,
				purpose: 'Testing',
				title: 'Test Phase',
			},
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildDependencyGraph', () => {
	describe('getDependencies (required edges)', () => {
		it('returns an empty array for a node with no dependencies', () => {
			const profile = profileWithNodes([{ id: 'A' }]);
			const graph = buildDependencyGraph(profile);

			expect(graph.getDependencies('A' as unknown as NodeId)).toEqual([]);
		});

		it('returns required dependencies for a node', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', requiredNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			expect(graph.getDependencies('B' as unknown as NodeId)).toEqual([
				'A',
			] as unknown as NodeId[]);
		});

		it('returns multiple required dependencies', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B' },
				{ id: 'C', requiredNodeIds: ['A', 'B'] },
			]);
			const graph = buildDependencyGraph(profile);

			const deps = graph.getDependencies('C' as unknown as NodeId);
			expect(deps).toHaveLength(2);
			expect(deps).toContain('A' as unknown as NodeId);
			expect(deps).toContain('B' as unknown as NodeId);
		});

		it('does NOT return recommended dependencies from getDependencies', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', recommendedNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			expect(graph.getDependencies('B' as unknown as NodeId)).toEqual([]);
		});
	});

	describe('getRecommendedDependencies', () => {
		it('returns empty for a node with no recommended dependencies', () => {
			const profile = profileWithNodes([{ id: 'A' }]);
			const graph = buildDependencyGraph(profile);

			expect(
				graph.getRecommendedDependencies('A' as unknown as NodeId),
			).toEqual([]);
		});

		it('returns recommended dependencies separately', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', recommendedNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			expect(
				graph.getRecommendedDependencies('B' as unknown as NodeId),
			).toEqual(['A'] as unknown as NodeId[]);
		});

		it('recommended deps are independent of required deps', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B' },
				{
					id: 'C',
					recommendedNodeIds: ['B'],
					requiredNodeIds: ['A'],
				},
			]);
			const graph = buildDependencyGraph(profile);

			expect(graph.getDependencies('C' as unknown as NodeId)).toEqual([
				'A',
			] as unknown as NodeId[]);
			expect(
				graph.getRecommendedDependencies('C' as unknown as NodeId),
			).toEqual(['B'] as unknown as NodeId[]);
		});
	});

	describe('getDependents (reverse required edges)', () => {
		it('returns an empty array for a node with no dependents', () => {
			const profile = profileWithNodes([{ id: 'A' }, { id: 'B' }]);
			const graph = buildDependencyGraph(profile);

			expect(graph.getDependents('B' as unknown as NodeId)).toEqual([]);
		});

		it('returns nodes that list this node as a required dependency', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', requiredNodeIds: ['A'] },
				{ id: 'C', requiredNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			const deps = graph.getDependents('A' as unknown as NodeId);
			expect(deps).toHaveLength(2);
			expect(deps).toContain('B' as unknown as NodeId);
			expect(deps).toContain('C' as unknown as NodeId);
		});

		it('does NOT return recommended-only dependents', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', recommendedNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			expect(graph.getDependents('A' as unknown as NodeId)).toEqual([]);
		});
	});

	describe('getTopologicalOrder', () => {
		it('returns all nodes in any order when there are no dependencies', () => {
			const profile = profileWithNodes([{ id: 'A' }, { id: 'B' }, { id: 'C' }]);
			const graph = buildDependencyGraph(profile);

			const order = graph.getTopologicalOrder();
			expect(order).toHaveLength(3);
			expect(new Set(order)).toEqual(
				new Set(['A', 'B', 'C'] as unknown as NodeId[]),
			);
		});

		it('simple linear chain: dependencies before dependents', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', requiredNodeIds: ['A'] },
				{ id: 'C', requiredNodeIds: ['B'] },
			]);
			const graph = buildDependencyGraph(profile);

			const order = graph.getTopologicalOrder();
			const idxA = order.indexOf('A' as unknown as NodeId);
			const idxB = order.indexOf('B' as unknown as NodeId);
			const idxC = order.indexOf('C' as unknown as NodeId);

			expect(idxA).toBeLessThan(idxB);
			expect(idxB).toBeLessThan(idxC);
		});

		it('node with multiple prerequisites', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B' },
				{ id: 'C', requiredNodeIds: ['A', 'B'] },
			]);
			const graph = buildDependencyGraph(profile);

			const order = graph.getTopologicalOrder();
			const idxA = order.indexOf('A' as unknown as NodeId);
			const idxB = order.indexOf('B' as unknown as NodeId);
			const idxC = order.indexOf('C' as unknown as NodeId);

			expect(idxA).toBeLessThan(idxC);
			expect(idxB).toBeLessThan(idxC);
		});

		it('diamond dependency structure respects constraints', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', requiredNodeIds: ['A'] },
				{ id: 'C', requiredNodeIds: ['A'] },
				{ id: 'D', requiredNodeIds: ['B', 'C'] },
			]);
			const graph = buildDependencyGraph(profile);

			const order = graph.getTopologicalOrder();
			const idxA = order.indexOf('A' as unknown as NodeId);
			const idxB = order.indexOf('B' as unknown as NodeId);
			const idxC = order.indexOf('C' as unknown as NodeId);
			const idxD = order.indexOf('D' as unknown as NodeId);

			expect(idxA).toBeLessThan(idxB);
			expect(idxA).toBeLessThan(idxC);
			expect(idxB).toBeLessThan(idxD);
			expect(idxC).toBeLessThan(idxD);
		});

		it('recommended dependencies do NOT affect topological order', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', recommendedNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			const order = graph.getTopologicalOrder();
			// Both nodes have no required deps, so order is unconstrained.
			expect(order).toHaveLength(2);
			expect(new Set(order)).toEqual(
				new Set(['A', 'B'] as unknown as NodeId[]),
			);
		});
	});

	describe('detectCycles', () => {
		it('returns empty array for a cycle-free graph', () => {
			const profile = profileWithNodes([
				{ id: 'A' },
				{ id: 'B', requiredNodeIds: ['A'] },
				{ id: 'C', requiredNodeIds: ['B'] },
			]);
			const graph = buildDependencyGraph(profile);

			expect(graph.detectCycles()).toEqual([]);
		});

		it('returns empty array for nodes with no dependencies', () => {
			const profile = profileWithNodes([{ id: 'A' }, { id: 'B' }]);
			const graph = buildDependencyGraph(profile);

			expect(graph.detectCycles()).toEqual([]);
		});

		it('detects a simple 2-node cycle', () => {
			const profile = profileWithNodes([
				{ id: 'A', requiredNodeIds: ['B'] },
				{ id: 'B', requiredNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			const cycles = graph.detectCycles();
			expect(cycles.length).toBeGreaterThanOrEqual(1);

			// Each cycle should be [start, ..., start] (closed loop).
			for (const cycle of cycles) {
				expect(cycle[0]).toEqual(cycle[cycle.length - 1]);
			}
		});

		it('detects a 3-node cycle', () => {
			const profile = profileWithNodes([
				{ id: 'A', requiredNodeIds: ['B'] },
				{ id: 'B', requiredNodeIds: ['C'] },
				{ id: 'C', requiredNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			const cycles = graph.detectCycles();
			expect(cycles.length).toBeGreaterThanOrEqual(1);

			for (const cycle of cycles) {
				expect(cycle[0]).toEqual(cycle[cycle.length - 1]);
				expect(cycle.length).toBe(4); // 3 nodes + closing duplicate
			}
		});

		it('detects self-dependency as a cycle', () => {
			const profile = profileWithNodes([{ id: 'A', requiredNodeIds: ['A'] }]);
			const graph = buildDependencyGraph(profile);

			const cycles = graph.detectCycles();
			expect(cycles.length).toBeGreaterThanOrEqual(1);

			const cycle = cycles[0];
			expect(cycle[0]).toEqual(cycle[cycle.length - 1]);
		});

		it('recommended dependency cycles are NOT detected', () => {
			const profile = profileWithNodes([
				{ id: 'A', recommendedNodeIds: ['B'] },
				{ id: 'B', recommendedNodeIds: ['A'] },
			]);
			const graph = buildDependencyGraph(profile);

			expect(graph.detectCycles()).toEqual([]);
		});
	});

	describe('allNodeIds', () => {
		it('contains all node IDs from the profile', () => {
			const profile = profileWithNodes([{ id: 'A' }, { id: 'B' }, { id: 'C' }]);
			const graph = buildDependencyGraph(profile);

			expect(graph.allNodeIds.size).toBe(3);
			expect(graph.allNodeIds.has('A' as unknown as NodeId)).toBe(true);
			expect(graph.allNodeIds.has('B' as unknown as NodeId)).toBe(true);
			expect(graph.allNodeIds.has('C' as unknown as NodeId)).toBe(true);
		});
	});
});
