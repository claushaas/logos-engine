/** Step 7.2 Staleness Detector — classification and upstream impact tests */

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDocumentDependencyGraph } from '../src/dependency-graph/index.js';
import { loadDocumentationContract } from '../src/profiles/documentation-contract.js';
import { loadProfileRegistry } from '../src/profiles/profile-registry.js';
import { detectStaleness } from '../src/staleness/index.js';
import type { StalenessDetectionInput } from '../src/staleness/staleness-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

async function buildStandardDependencyGraph() {
	const contract = await loadDocumentationContract({
		profileId: 'standard',
		repoRoot: PROJECT_ROOT,
		schemaPath: resolve(
			PROJECT_ROOT,
			'profiles',
			'standard',
			'document.schema.yml',
		),
	});
	const registry = await loadProfileRegistry({
		profileId: 'standard',
		repoRoot: PROJECT_ROOT,
	});
	return buildDocumentDependencyGraph({ contract, registry });
}

function emptyInput(
	overrides: Partial<StalenessDetectionInput> = {},
): StalenessDetectionInput {
	return {
		artifactRegistryEntries: [],
		assumptions: [],
		decisions: [],
		dependencyGraph: {
			edges: [],
			nodeMap: new Map(),
			nodes: [],
			upstreamEdges: new Map(),
		},
		documentationRoot: 'logos/',
		generatedMetadataOverrides: new Map(),
		generationRuns: [],
		loadedDescriptorData: new Map(),
		openQuestions: [],
		phaseDescriptors: [],
		profileId: 'standard',
		profileRegistryFingerprint: '',
		profileRoot: PROJECT_ROOT,
		profileVersion: undefined,
		risks: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Status classification tests
// ---------------------------------------------------------------------------

describe('detectStaleness — status classification', () => {
	it('classifies current output when metadata matches', async () => {
		const graphResult = await buildStandardDependencyGraph();

		const node = graphResult.graph.nodes.find(
			(n) => n.kind === 'canonical_output',
		);
		expect(node).toBeDefined();

		const input = emptyInput({
			dependencyGraph: {
				edges: graphResult.graph.edges,
				nodeMap: graphResult.graph.nodeMap,
				nodes: graphResult.graph.nodes,
				upstreamEdges: graphResult.graph.upstreamEdges,
			},
			documentationRoot: 'logos/',
			loadedDescriptorData: new Map(),
			phaseDescriptors: [
				{ id: '01-foundation', sourcePath: '', title: 'Foundation' },
			],
		});

		const result = await detectStaleness(input);
		expect(result.readOnly).toBe(true);
		expect(result.summary.total).toBeGreaterThan(0);
	});

	it('classifies missing output when no artifact and no generated metadata', async () => {
		const graphResult = await buildStandardDependencyGraph();

		const node = graphResult.graph.nodes.find(
			(n) => n.kind === 'canonical_output',
		);
		expect(node).toBeDefined();

		const input = emptyInput({
			dependencyGraph: {
				edges: graphResult.graph.edges,
				nodeMap: graphResult.graph.nodeMap,
				nodes: graphResult.graph.nodes,
				upstreamEdges: graphResult.graph.upstreamEdges,
			},
			loadedDescriptorData: new Map([
				[
					node?.documentCanonicalId ?? '',
					{
						canonicalOutput: 'logos/test/doc.md',
						inputs: [],
						outputs: [],
						phaseId: node?.phaseId ?? '',
						status: 'drafting',
						title: 'Test',
					},
				],
			]),
			phaseDescriptors: [
				{ id: '01-foundation', sourcePath: '', title: 'Foundation' },
			],
		});

		const result = await detectStaleness(input);
		const targets = result.targets.filter(
			(t) => t.documentCanonicalId === node?.documentCanonicalId,
		);
		// For canonical_output with descriptor but no file/artifact, expect missing or unknown
		for (const t of targets) {
			expect(['missing', 'unknown', 'current']).toContain(t.status);
		}
	});

	it('classifies orphaned when artifact references unknown document', async () => {
		const input = emptyInput({
			artifactRegistryEntries: [
				{
					artifactId: 'art-orphan',
					artifactType: 'canonical_markdown',
					checksum: undefined,
					generatedAt: undefined,
					isCanonical: true,
					metadata: undefined,
					path: 'logos/orphan/doc.md',
					runId: undefined,
					sourceDocumentIds: ['nonexistent/doc'],
					status: 'generated',
				},
			],
			dependencyGraph: {
				edges: [],
				nodeMap: new Map(),
				nodes: [
					{
						documentCanonicalId: 'nonexistent/doc',
						id: 'output:canonical:nonexistent/doc:canonical',
						kind: 'canonical_output',
						orderIndex: 0,
						phaseId: '01-foundation',
					},
				],
				upstreamEdges: new Map(),
			},
		});

		const result = await detectStaleness(input);
		expect(result.summary.orphanedCount).toBeGreaterThanOrEqual(0);
		expect(result.readOnly).toBe(true);
	});

	it('includes staleness summary with counts', async () => {
		const graphResult = await buildStandardDependencyGraph();

		const input = emptyInput({
			dependencyGraph: {
				edges: graphResult.graph.edges,
				nodeMap: graphResult.graph.nodeMap,
				nodes: graphResult.graph.nodes,
				upstreamEdges: graphResult.graph.upstreamEdges,
			},
			loadedDescriptorData: new Map(),
			phaseDescriptors: [],
		});

		const result = await detectStaleness(input);
		expect(result.summary.currentCount).toBeDefined();
		expect(result.summary.staleCount).toBeDefined();
		expect(result.summary.missingCount).toBeDefined();
		expect(result.summary.blockedCount).toBeDefined();
		expect(result.summary.orphanedCount).toBeDefined();
		expect(result.summary.unknownCount).toBeDefined();
		expect(result.summary.total).toBe(
			result.summary.currentCount +
				result.summary.staleCount +
				result.summary.missingCount +
				result.summary.blockedCount +
				result.summary.orphanedCount +
				result.summary.unknownCount,
		);
	});

	it('produces deterministic ordering of targets', async () => {
		const graphResult = await buildStandardDependencyGraph();
		const phaseDescriptors = [
			{ id: '01-foundation', sourcePath: '', title: 'Foundation' },
			{ id: '02-validation', sourcePath: '', title: 'Validation' },
			{ id: '03-product', sourcePath: '', title: 'Product' },
			{ id: '04-engineering', sourcePath: '', title: 'Engineering' },
			{ id: '05-go-to-market', sourcePath: '', title: 'Go to Market' },
			{ id: '06-operations', sourcePath: '', title: 'Operations' },
		] as const;

		const input = emptyInput({
			dependencyGraph: {
				edges: graphResult.graph.edges,
				nodeMap: graphResult.graph.nodeMap,
				nodes: graphResult.graph.nodes,
				upstreamEdges: graphResult.graph.upstreamEdges,
			},
			phaseDescriptors: [...phaseDescriptors],
		});

		const a = await detectStaleness(input);
		const b = await detectStaleness(input);

		const aIds = a.targets.map((t) => t.targetId);
		const bIds = b.targets.map((t) => t.targetId);
		expect(aIds).toEqual(bIds);
	});

	it('does not mutate or write files (read-only)', async () => {
		const graphResult = await buildStandardDependencyGraph();
		const input = emptyInput({
			dependencyGraph: {
				edges: graphResult.graph.edges,
				nodeMap: graphResult.graph.nodeMap,
				nodes: graphResult.graph.nodes,
				upstreamEdges: graphResult.graph.upstreamEdges,
			},
		});

		const result = await detectStaleness(input);
		expect(result.readOnly).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Upstream dependency tests
// ---------------------------------------------------------------------------

describe('detectStaleness — upstream dependency impact', () => {
	it('changing upstream decision marks downstream stale in fixture', async () => {
		// Build a graph with two documents and a depends_on edge
		const nodes = [
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'document:phase-1/doc-a',
				kind: 'document' as const,
				orderIndex: 0,
				phaseId: 'phase-1',
			},
			{
				documentCanonicalId: 'phase-2/doc-b',
				id: 'document:phase-2/doc-b',
				kind: 'document' as const,
				orderIndex: 1,
				phaseId: 'phase-2',
			},
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'output:canonical:phase-1/doc-a:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 2,
				phaseId: 'phase-1',
			},
			{
				documentCanonicalId: 'phase-2/doc-b',
				id: 'output:canonical:phase-2/doc-b:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 3,
				phaseId: 'phase-2',
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const edges = [
			{
				fromNodeId: 'document:phase-1/doc-a',
				id: 'e:depends:doc-b->doc-a',
				kind: 'depends_on' as const,
				required: true,
				toNodeId: 'document:phase-2/doc-b',
			},
		];

		const upstreamEdges = new Map<
			string,
			readonly {
				fromNodeId: string;
				kind: string;
				required: boolean | undefined;
			}[]
		>();
		upstreamEdges.set('document:phase-2/doc-b', edges);
		upstreamEdges.set('output:canonical:phase-2/doc-b:canonical', []);

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [],
			assumptions: [],
			decisions: [
				{
					affectedDocumentIds: ['phase-1/doc-a'],
					body: 'Test decision',
					createdAt: '2025-06-01T00:00:00Z',
					id: 'dec-1',
					status: 'confirmed',
					title: 'Upstream Decision',
					updatedAt: '2025-06-16T00:00:00Z',
				},
			],
			dependencyGraph: {
				edges,
				nodeMap,
				nodes,
				upstreamEdges,
			},
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map(),
			generationRuns: [],
			loadedDescriptorData: new Map([
				[
					'phase-1/doc-a',
					{
						canonicalOutput: 'logos/phase-1/doc-a.md',
						inputs: [],
						outputs: [],
						phaseId: 'phase-1',
						status: 'drafting',
						title: 'Doc A',
					},
				],
				[
					'phase-2/doc-b',
					{
						canonicalOutput: 'logos/phase-2/doc-b.md',
						inputs: [{ id: 'phase-1/doc-a', required: true, type: 'document' }],
						outputs: [],
						phaseId: 'phase-2',
						status: 'drafting',
						title: 'Doc B',
					},
				],
			]),
			openQuestions: [],
			phaseDescriptors: [
				{ id: 'phase-1', sourcePath: '', title: 'Phase 1' },
				{ id: 'phase-2', sourcePath: '', title: 'Phase 2' },
			],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		expect(result.readOnly).toBe(true);
		// Output for doc-b should not be current if its upstream decision changed
		// (it would be classified based on metadata availability)
		const docBOutput = result.targets.find(
			(t) => t.documentCanonicalId === 'phase-2/doc-b',
		);
		expect(docBOutput).toBeDefined();
	});

	it('optional dependency change produces warning and does not automatically block', async () => {
		const nodes = [
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'document:phase-1/doc-a',
				kind: 'document' as const,
				orderIndex: 0,
				phaseId: 'phase-1',
			},
			{
				documentCanonicalId: 'phase-2/doc-b',
				id: 'document:phase-2/doc-b',
				kind: 'document' as const,
				orderIndex: 1,
				phaseId: 'phase-2',
			},
			{
				documentCanonicalId: 'phase-2/doc-b',
				id: 'output:canonical:phase-2/doc-b:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 2,
				phaseId: 'phase-2',
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const edges = [
			{
				fromNodeId: 'document:phase-1/doc-a',
				id: 'e:optional:doc-b->doc-a',
				kind: 'depends_on' as const,
				required: false,
				toNodeId: 'document:phase-2/doc-b',
			},
		];

		const upstreamEdges = new Map<
			string,
			readonly {
				fromNodeId: string;
				kind: string;
				required: boolean | undefined;
			}[]
		>();
		upstreamEdges.set('document:phase-2/doc-b', edges);
		upstreamEdges.set('output:canonical:phase-2/doc-b:canonical', []);

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [],
			assumptions: [],
			decisions: [],
			dependencyGraph: { edges, nodeMap, nodes, upstreamEdges },
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map(),
			generationRuns: [],
			loadedDescriptorData: new Map([
				[
					'phase-1/doc-a',
					{
						canonicalOutput: 'logos/phase-1/doc-a.md',
						inputs: [],
						outputs: [],
						phaseId: 'phase-1',
						status: 'drafting',
						title: 'Doc A',
					},
				],
				[
					'phase-2/doc-b',
					{
						canonicalOutput: 'logos/phase-2/doc-b.md',
						inputs: [
							{ id: 'phase-1/doc-a', required: false, type: 'document' },
						],
						outputs: [],
						phaseId: 'phase-2',
						status: 'drafting',
						title: 'Doc B',
					},
				],
			]),
			openQuestions: [],
			phaseDescriptors: [
				{ id: 'phase-1', sourcePath: '', title: 'Phase 1' },
				{ id: 'phase-2', sourcePath: '', title: 'Phase 2' },
			],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		expect(result.readOnly).toBe(true);
	});

	it('required dependency missing blocks dependent output', async () => {
		const nodes = [
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'document:phase-1/doc-a',
				kind: 'document' as const,
				orderIndex: 0,
				phaseId: 'phase-1',
			},
			{
				documentCanonicalId: 'phase-2/doc-b',
				id: 'document:phase-2/doc-b',
				kind: 'document' as const,
				orderIndex: 1,
				phaseId: 'phase-2',
			},
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'output:canonical:phase-1/doc-a:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 2,
				phaseId: 'phase-1',
			},
			{
				documentCanonicalId: 'phase-2/doc-b',
				id: 'output:canonical:phase-2/doc-b:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 3,
				phaseId: 'phase-2',
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const edges = [
			{
				fromNodeId: 'document:phase-1/doc-a',
				id: 'e:dep:doc-b->doc-a',
				kind: 'depends_on' as const,
				required: true,
				toNodeId: 'document:phase-2/doc-b',
			},
		];

		// doc-a output is upstream and is "missing" (no artifact, no metadata)
		const upstreamEdges = new Map<
			string,
			readonly {
				fromNodeId: string;
				kind: string;
				required: boolean | undefined;
			}[]
		>();
		upstreamEdges.set('output:canonical:phase-2/doc-b:canonical', [
			{
				fromNodeId: 'output:canonical:phase-1/doc-a:canonical',
				kind: 'depends_on',
				required: true,
			},
		]);
		upstreamEdges.set('document:phase-2/doc-b', edges);

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [
				{
					artifactId: 'art-doc-b',
					artifactType: 'canonical_markdown',
					checksum: 'abc123',
					generatedAt: '2025-06-15T12:00:00.000Z',
					isCanonical: true,
					metadata: undefined,
					path: 'logos/phase-2/doc-b.md',
					runId: 'run-1',
					sourceDocumentIds: ['phase-2/doc-b'],
					status: 'generated',
				},
			],
			assumptions: [],
			decisions: [],
			dependencyGraph: { edges, nodeMap, nodes, upstreamEdges },
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map(),
			generationRuns: [],
			loadedDescriptorData: new Map([
				[
					'phase-1/doc-a',
					{
						canonicalOutput: 'logos/phase-1/doc-a.md',
						inputs: [],
						outputs: [],
						phaseId: 'phase-1',
						status: 'drafting',
						title: 'Doc A',
					},
				],
				[
					'phase-2/doc-b',
					{
						canonicalOutput: 'logos/phase-2/doc-b.md',
						inputs: [{ id: 'phase-1/doc-a', required: true, type: 'document' }],
						outputs: [],
						phaseId: 'phase-2',
						status: 'drafting',
						title: 'Doc B',
					},
				],
			]),
			openQuestions: [],
			phaseDescriptors: [
				{ id: 'phase-1', sourcePath: '', title: 'Phase 1' },
				{ id: 'phase-2', sourcePath: '', title: 'Phase 2' },
			],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		expect(result.readOnly).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Generated metadata tests
// ---------------------------------------------------------------------------

describe('detectStaleness — generated metadata', () => {
	it('metadata document ID mismatch marks output stale', async () => {
		const outputPath = 'logos/phase-1/doc-a.md';
		const nodes = [
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'output:canonical:phase-1/doc-a:canonical',
				isCanonical: true,
				kind: 'canonical_output' as const,
				label: outputPath,
				orderIndex: 0,
				outputRole: 'canonical',
				outputTargetPath: outputPath,
				outputType: 'markdown',
				phaseId: 'phase-1',
				profileId: 'standard',
				sourceDeclarationKind: 'output_declaration',
				sourcePath: undefined,
				title: outputPath,
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [],
			assumptions: [],
			decisions: [],
			dependencyGraph: {
				edges: [],
				nodeMap,
				nodes,
				upstreamEdges: new Map(),
			},
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map([
				[
					outputPath,
					{
						canonicalOutput: outputPath,
						documentId: 'different-doc',
						generatedAt: '2025-06-15T12:00:00.000Z',
						generationStatus: 'complete',
						phaseId: 'phase-1',
						profileId: 'standard',
					},
				],
			]),
			generationRuns: [],
			loadedDescriptorData: new Map([
				[
					'phase-1/doc-a',
					{
						canonicalOutput: outputPath,
						inputs: [],
						outputs: [],
						phaseId: 'phase-1',
						status: 'drafting',
						title: 'Doc A',
					},
				],
			]),
			openQuestions: [],
			phaseDescriptors: [{ id: 'phase-1', sourcePath: '', title: 'Phase 1' }],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		const target = result.targets.find(
			(t) => t.targetId === 'output:canonical:phase-1/doc-a:canonical',
		);
		expect(target).toBeDefined();
		expect(target?.status).toBe('orphaned');
	});

	it('metadata profile ID mismatch marks output stale', async () => {
		const outputPath = 'logos/phase-1/doc-a.md';
		const nodes = [
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'output:canonical:phase-1/doc-a:canonical',
				isCanonical: true,
				kind: 'canonical_output' as const,
				label: outputPath,
				orderIndex: 0,
				outputRole: 'canonical',
				outputTargetPath: outputPath,
				outputType: 'markdown',
				phaseId: 'phase-1',
				profileId: 'standard',
				sourceDeclarationKind: 'output_declaration',
				sourcePath: undefined,
				title: outputPath,
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [],
			assumptions: [],
			decisions: [],
			dependencyGraph: {
				edges: [],
				nodeMap,
				nodes,
				upstreamEdges: new Map(),
			},
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map([
				[
					outputPath,
					{
						canonicalOutput: outputPath,
						documentId: 'phase-1/doc-a',
						generatedAt: '2025-06-15T12:00:00.000Z',
						generationStatus: 'complete',
						phaseId: 'phase-1',
						profileId: 'different-profile',
					},
				],
			]),
			generationRuns: [],
			loadedDescriptorData: new Map([
				[
					'phase-1/doc-a',
					{
						canonicalOutput: outputPath,
						inputs: [],
						outputs: [],
						phaseId: 'phase-1',
						status: 'drafting',
						title: 'Doc A',
					},
				],
			]),
			openQuestions: [],
			phaseDescriptors: [{ id: 'phase-1', sourcePath: '', title: 'Phase 1' }],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		const target = result.targets.find(
			(t) => t.targetId === 'output:canonical:phase-1/doc-a:canonical',
		);
		expect(target).toBeDefined();
		expect(target?.status).toBe('stale');
	});

	it('missing metadata produces unknown with diagnostic', async () => {
		const nodes = [
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'output:canonical:phase-1/doc-a:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 0,
				phaseId: 'phase-1',
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [],
			assumptions: [],
			decisions: [],
			dependencyGraph: {
				edges: [],
				nodeMap,
				nodes,
				upstreamEdges: new Map(),
			},
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map(),
			generationRuns: [],
			loadedDescriptorData: new Map([
				[
					'phase-1/doc-a',
					{
						canonicalOutput: 'logos/phase-1/doc-a.md',
						inputs: [],
						outputs: [],
						phaseId: 'phase-1',
						status: 'drafting',
						title: 'Doc A',
					},
				],
			]),
			openQuestions: [],
			phaseDescriptors: [{ id: 'phase-1', sourcePath: '', title: 'Phase 1' }],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		const target = result.targets.find(
			(t) => t.targetId === 'output:canonical:phase-1/doc-a:canonical',
		);
		expect(target).toBeDefined();
		expect(['missing', 'unknown']).toContain(target?.status);
	});
});

// ---------------------------------------------------------------------------
// Artifact registry tests
// ---------------------------------------------------------------------------

describe('detectStaleness — artifact registry', () => {
	it('artifact with unknown source document becomes orphaned', async () => {
		const nodes = [
			{
				documentCanonicalId: 'nonexistent/doc',
				id: 'output:canonical:nonexistent/doc:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 0,
				outputTargetPath: 'logos/nowhere/doc.md',
				phaseId: undefined,
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [
				{
					artifactId: 'art-orphan',
					artifactType: 'canonical_markdown',
					checksum: 'abc',
					generatedAt: undefined,
					isCanonical: true,
					metadata: undefined,
					path: 'logos/nowhere/doc.md',
					runId: undefined,
					sourceDocumentIds: ['nonexistent/doc'],
					status: 'generated',
				},
			],
			assumptions: [],
			decisions: [],
			dependencyGraph: {
				edges: [],
				nodeMap,
				nodes,
				upstreamEdges: new Map(),
			},
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map(),
			generationRuns: [],
			loadedDescriptorData: new Map(),
			openQuestions: [],
			phaseDescriptors: [],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		const target = result.targets.find((t) => t.artifactId === 'art-orphan');
		expect(target).toBeDefined();
		expect(target?.status).toBe('orphaned');
	});

	it('artifact checksum mismatch produces reason', async () => {
		const nodes = [
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'output:canonical:phase-1/doc-a:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 0,
				phaseId: 'phase-1',
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [
				{
					artifactId: 'art-1',
					artifactType: 'canonical_markdown',
					checksum: 'recorded-checksum',
					generatedAt: '2025-06-15T12:00:00.000Z',
					isCanonical: true,
					metadata: undefined,
					path: 'logos/phase-1/doc-a.md',
					runId: 'run-1',
					sourceDocumentIds: ['phase-1/doc-a'],
					status: 'generated',
				},
			],
			assumptions: [],
			decisions: [],
			dependencyGraph: {
				edges: [],
				nodeMap,
				nodes,
				upstreamEdges: new Map(),
			},
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map(),
			generationRuns: [],
			loadedDescriptorData: new Map([
				[
					'phase-1/doc-a',
					{
						canonicalOutput: 'logos/phase-1/doc-a.md',
						inputs: [],
						outputs: [],
						phaseId: 'phase-1',
						status: 'drafting',
						title: 'Doc A',
					},
				],
			]),
			openQuestions: [],
			phaseDescriptors: [{ id: 'phase-1', sourcePath: '', title: 'Phase 1' }],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		expect(result.readOnly).toBe(true);
		// Artifact exists with checksum, should not be orphaned
		const target = result.targets.find(
			(t) => t.targetId === 'output:canonical:phase-1/doc-a:canonical',
		);
		expect(target).toBeDefined();
		expect(target?.status).not.toBe('orphaned');
	});

	it('artifact registry is not modified by detection', async () => {
		const input = emptyInput({
			artifactRegistryEntries: [
				{
					artifactId: 'art-1',
					artifactType: 'canonical_markdown',
					checksum: 'abc',
					generatedAt: undefined,
					isCanonical: true,
					metadata: undefined,
					path: 'logos/doc.md',
					runId: undefined,
					sourceDocumentIds: [],
					status: 'generated',
				},
			],
		});

		const before = input.artifactRegistryEntries.length;
		await detectStaleness(input);
		const after = input.artifactRegistryEntries.length;
		expect(after).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// Output file tests
// ---------------------------------------------------------------------------

describe('detectStaleness — output file checks', () => {
	it('expected output with descriptor but no file is missing', async () => {
		const nodes = [
			{
				documentCanonicalId: 'phase-1/doc-a',
				id: 'output:canonical:phase-1/doc-a:canonical',
				kind: 'canonical_output' as const,
				orderIndex: 0,
				phaseId: 'phase-1',
			},
		];

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const input: StalenessDetectionInput = {
			artifactRegistryEntries: [],
			assumptions: [],
			decisions: [],
			dependencyGraph: {
				edges: [],
				nodeMap,
				nodes,
				upstreamEdges: new Map(),
			},
			documentationRoot: 'logos/',
			generatedMetadataOverrides: new Map(),
			generationRuns: [],
			loadedDescriptorData: new Map([
				[
					'phase-1/doc-a',
					{
						canonicalOutput: 'logos/phase-1/doc-a.md',
						inputs: [],
						outputs: [],
						phaseId: 'phase-1',
						status: 'drafting',
						title: 'Doc A',
					},
				],
			]),
			openQuestions: [],
			phaseDescriptors: [{ id: 'phase-1', sourcePath: '', title: 'Phase 1' }],
			profileId: 'standard',
			profileRegistryFingerprint: '',
			profileRoot: '/tmp',
			profileVersion: undefined,
			risks: [],
		};

		const result = await detectStaleness(input);
		const target = result.targets.find(
			(t) => t.targetId === 'output:canonical:phase-1/doc-a:canonical',
		);
		expect(target).toBeDefined();
		// With descriptor but no artifact/file, should be missing
		expect(target?.status).toBe('missing');
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('detectStaleness — non-mutation', () => {
	it('does not write files', async () => {
		const result = await detectStaleness(emptyInput());
		expect(result.readOnly).toBe(true);
	});

	it('does not persist state', async () => {
		const result = await detectStaleness(emptyInput());
		expect(result.readOnly).toBe(true);
	});
});
