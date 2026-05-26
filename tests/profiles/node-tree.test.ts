/**
 * Tests for `buildNodeTree` — nested Phase → Document → Node structure.
 */
import { describe, expect, it } from 'vitest';
import type { LogosProfile } from '../../src/contracts/profile.js';
import { buildNodeTree } from '../../src/profiles/node-tree.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

/**
 * Build a profile with explicit phases, documents, and nodes for tree testing.
 */
function profileWithStructure(config: {
	phases: Array<{ id: string; title: string; order: number }>;
	documents: Array<{
		id: string;
		phaseId: string;
		title: string;
		order: number;
	}>;
	nodes: Array<{
		id: string;
		documentId: string;
		title: string;
		order: number;
	}>;
}): LogosProfile {
	return {
		documents: config.documents.map((d) => ({
			id: d.id as unknown as DocumentId,
			optionalNodeIds: [],
			order: d.order,
			outputPath: '/dev/null',
			phaseId: d.phaseId,
			purpose: 'Testing',
			requiredNodeIds: [],
			title: d.title,
		})),
		id: 'test-profile' as unknown as ProfileId,
		materializationRules: [],
		nodes: config.nodes.map((n) => ({
			canonicalQuestion: `What is ${n.id}?`,
			coverageTopics: [],
			documentId: n.documentId as unknown as DocumentId,
			id: n.id as unknown as NodeId,
			order: n.order,
			phaseId: '',
			promptRefs: {},
			sufficiencyCriteria: [],
			title: n.title,
		})),
		phases: config.phases.map((p) => ({
			id: p.id,
			order: p.order,
			purpose: 'Testing',
			title: p.title,
		})),
		title: 'Test Profile',
		version: '1.0.0',
	};
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildNodeTree', () => {
	it('returns an empty phases array for a profile with no nodes', () => {
		const profile = profileWithStructure({
			documents: [],
			nodes: [],
			phases: [],
		});

		const tree = buildNodeTree(profile);
		expect(tree.phases).toEqual([]);
	});

	it('excludes phases that have no documents', () => {
		const profile = profileWithStructure({
			documents: [],
			nodes: [],
			phases: [{ id: 'empty-phase', order: 1, title: 'Empty' }],
		});

		const tree = buildNodeTree(profile);
		expect(tree.phases).toEqual([]);
	});

	it('excludes documents that have no nodes', () => {
		const profile = profileWithStructure({
			documents: [
				{
					id: 'empty-doc',
					order: 1,
					phaseId: 'phase-1',
					title: 'Empty Doc',
				},
			],
			nodes: [],
			phases: [{ id: 'phase-1', order: 1, title: 'Phase 1' }],
		});

		const tree = buildNodeTree(profile);
		expect(tree.phases).toEqual([]);
	});

	it('builds a single phase with a single document and node', () => {
		const profile = profileWithStructure({
			documents: [
				{
					id: 'thesis',
					order: 1,
					phaseId: 'foundation',
					title: 'Thesis',
				},
			],
			nodes: [
				{
					documentId: 'thesis',
					id: 'core-thesis',
					order: 1,
					title: 'Core Thesis',
				},
			],
			phases: [{ id: 'foundation', order: 1, title: 'Foundation' }],
		});

		const tree = buildNodeTree(profile);

		expect(tree.phases).toHaveLength(1);
		expect(tree.phases[0].phaseId).toBe('foundation');
		expect(tree.phases[0].title).toBe('Foundation');
		expect(tree.phases[0].documents).toHaveLength(1);
		expect(tree.phases[0].documents[0].documentId).toBe(
			'thesis' as unknown as DocumentId,
		);
		expect(tree.phases[0].documents[0].nodes).toHaveLength(1);
		expect(tree.phases[0].documents[0].nodes[0].nodeId).toBe(
			'core-thesis' as unknown as NodeId,
		);
		expect(tree.phases[0].documents[0].nodes[0].title).toBe('Core Thesis');
	});

	it('preserves canonical question on nodes', () => {
		const profile = profileWithStructure({
			documents: [{ id: 'd1', order: 1, phaseId: 'p1', title: 'Doc' }],
			nodes: [
				{
					documentId: 'd1',
					id: 'n1',
					order: 1,
					title: 'Node 1',
				},
			],
			phases: [{ id: 'p1', order: 1, title: 'Phase' }],
		});

		const tree = buildNodeTree(profile);
		expect(tree.phases[0].documents[0].nodes[0].canonicalQuestion).toBe(
			'What is n1?',
		);
	});

	describe('sorting by order', () => {
		it('sorts phases by order', () => {
			const profile = profileWithStructure({
				documents: [
					{ id: 'd1', order: 1, phaseId: 'phase-a', title: 'Doc' },
					{ id: 'd2', order: 1, phaseId: 'phase-b', title: 'Doc' },
					{ id: 'd3', order: 1, phaseId: 'phase-c', title: 'Doc' },
				],
				nodes: [
					{ documentId: 'd1', id: 'n1', order: 1, title: 'N1' },
					{ documentId: 'd2', id: 'n2', order: 1, title: 'N2' },
					{ documentId: 'd3', id: 'n3', order: 1, title: 'N3' },
				],
				phases: [
					{ id: 'phase-c', order: 3, title: 'C' },
					{ id: 'phase-a', order: 1, title: 'A' },
					{ id: 'phase-b', order: 2, title: 'B' },
				],
			});

			const tree = buildNodeTree(profile);
			expect(tree.phases[0].phaseId).toBe('phase-a');
			expect(tree.phases[1].phaseId).toBe('phase-b');
			expect(tree.phases[2].phaseId).toBe('phase-c');
		});

		it('sorts documents within a phase by order', () => {
			const profile = profileWithStructure({
				documents: [
					{ id: 'd3', order: 3, phaseId: 'p1', title: 'Doc 3' },
					{ id: 'd1', order: 1, phaseId: 'p1', title: 'Doc 1' },
					{ id: 'd2', order: 2, phaseId: 'p1', title: 'Doc 2' },
				],
				nodes: [
					{ documentId: 'd1', id: 'n1', order: 1, title: 'N1' },
					{ documentId: 'd2', id: 'n2', order: 1, title: 'N2' },
					{ documentId: 'd3', id: 'n3', order: 1, title: 'N3' },
				],
				phases: [{ id: 'p1', order: 1, title: 'Phase' }],
			});

			const tree = buildNodeTree(profile);
			const docs = tree.phases[0].documents;
			expect(docs[0].title).toBe('Doc 1');
			expect(docs[1].title).toBe('Doc 2');
			expect(docs[2].title).toBe('Doc 3');
		});

		it('sorts nodes within a document by order', () => {
			const profile = profileWithStructure({
				documents: [{ id: 'd1', order: 1, phaseId: 'p1', title: 'Doc' }],
				nodes: [
					{ documentId: 'd1', id: 'n3', order: 3, title: 'N3' },
					{ documentId: 'd1', id: 'n2', order: 2, title: 'N2' },
					{ documentId: 'd1', id: 'n1', order: 1, title: 'N1' },
				],
				phases: [{ id: 'p1', order: 1, title: 'Phase' }],
			});

			const tree = buildNodeTree(profile);
			const nodes = tree.phases[0].documents[0].nodes;
			expect(nodes[0].order).toBe(1);
			expect(nodes[1].order).toBe(2);
			expect(nodes[2].order).toBe(3);
		});
	});

	describe('grouping preservation', () => {
		it('groups nodes under correct documents', () => {
			const profile = profileWithStructure({
				documents: [
					{ id: 'd1', order: 1, phaseId: 'p1', title: 'Doc One' },
					{ id: 'd2', order: 2, phaseId: 'p1', title: 'Doc Two' },
				],
				nodes: [
					{
						documentId: 'd1',
						id: 'n-a',
						order: 1,
						title: 'Node A',
					},
					{
						documentId: 'd1',
						id: 'n-b',
						order: 2,
						title: 'Node B',
					},
					{
						documentId: 'd2',
						id: 'n-c',
						order: 1,
						title: 'Node C',
					},
				],
				phases: [{ id: 'p1', order: 1, title: 'Phase' }],
			});

			const tree = buildNodeTree(profile);
			const [doc1, doc2] = tree.phases[0].documents;

			expect(doc1.nodes).toHaveLength(2);
			expect(doc1.nodes[0].nodeId).toBe('n-a' as unknown as NodeId);
			expect(doc1.nodes[1].nodeId).toBe('n-b' as unknown as NodeId);

			expect(doc2.nodes).toHaveLength(1);
			expect(doc2.nodes[0].nodeId).toBe('n-c' as unknown as NodeId);
		});

		it('groups documents under correct phases', () => {
			const profile = profileWithStructure({
				documents: [
					{
						id: 'd-f',
						order: 1,
						phaseId: 'phase-foundation',
						title: 'Foundation Doc',
					},
					{
						id: 'd-v',
						order: 1,
						phaseId: 'phase-validation',
						title: 'Validation Doc',
					},
				],
				nodes: [
					{ documentId: 'd-f', id: 'nf', order: 1, title: 'NF' },
					{ documentId: 'd-v', id: 'nv', order: 1, title: 'NV' },
				],
				phases: [
					{
						id: 'phase-foundation',
						order: 1,
						title: 'Foundation',
					},
					{
						id: 'phase-validation',
						order: 2,
						title: 'Validation',
					},
				],
			});

			const tree = buildNodeTree(profile);

			expect(tree.phases[0].phaseId).toBe('phase-foundation');
			expect(tree.phases[0].documents[0].documentId).toBe(
				'd-f' as unknown as DocumentId,
			);

			expect(tree.phases[1].phaseId).toBe('phase-validation');
			expect(tree.phases[1].documents[0].documentId).toBe(
				'd-v' as unknown as DocumentId,
			);
		});

		it('preserves phaseId on documents', () => {
			const profile = profileWithStructure({
				documents: [{ id: 'd1', order: 1, phaseId: 'p1', title: 'D1' }],
				nodes: [{ documentId: 'd1', id: 'n1', order: 1, title: 'N1' }],
				phases: [{ id: 'p1', order: 1, title: 'P1' }],
			});

			const tree = buildNodeTree(profile);
			expect(tree.phases[0].documents[0].phaseId).toBe('p1');
		});
	});

	describe('edge cases', () => {
		it('handles a node referencing a non-existent document gracefully', () => {
			const profile = profileWithStructure({
				documents: [{ id: 'd1', order: 1, phaseId: 'p1', title: 'Doc' }],
				nodes: [
					{
						documentId: 'nonexistent',
						id: 'orphan',
						order: 1,
						title: 'Orphan',
					},
				],
				phases: [{ id: 'p1', order: 1, title: 'Phase' }],
			});

			const tree = buildNodeTree(profile);
			// The orphaned node should not cause a crash and should be silently
			// excluded since its document does not exist in the tree.
			const docs = tree.phases[0]?.documents ?? [];
			const allNodeIds = docs.flatMap((d) => d.nodes.map((n) => n.nodeId));
			expect(allNodeIds).not.toContain('orphan' as unknown as NodeId);
		});

		it('handles profile with only one node', () => {
			const profile = profileWithStructure({
				documents: [{ id: 'd1', order: 1, phaseId: 'p1', title: 'Single Doc' }],
				nodes: [{ documentId: 'd1', id: 'n1', order: 1, title: 'Only Node' }],
				phases: [{ id: 'p1', order: 1, title: 'Single Phase' }],
			});

			const tree = buildNodeTree(profile);
			expect(tree.phases).toHaveLength(1);
			expect(tree.phases[0].documents).toHaveLength(1);
			expect(tree.phases[0].documents[0].nodes).toHaveLength(1);
		});
	});
});
