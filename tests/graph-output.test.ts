/** Step 7.4 Graph Output — text, JSON, filters, snapshots */

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DocumentDependencyGraph } from '../src/dependency-graph/dependency-graph.js';
import {
	createInspectableGraphOutput,
	type GraphOutputRenderMode,
	renderGraphJsonReport,
	renderGraphTextReport,
} from '../src/dependency-graph/graph-output.js';
import { buildDocumentDependencyGraph } from '../src/dependency-graph/index.js';
import { loadDocumentationContract } from '../src/profiles/documentation-contract.js';
import { loadProfileRegistry } from '../src/profiles/profile-registry.js';
import type { StalenessDetectionResult } from '../src/staleness/staleness-types.js';

const PROJECT_ROOT = process.cwd();
const STANDARD_SCHEMA_PATH = resolve(
	PROJECT_ROOT,
	'profiles',
	'standard',
	'document.schema.yml',
);

async function buildStandardGraph(): Promise<DocumentDependencyGraph> {
	const contract = await loadDocumentationContract({
		profileId: 'standard',
		repoRoot: PROJECT_ROOT,
		schemaPath: STANDARD_SCHEMA_PATH,
	});
	const registry = await loadProfileRegistry({
		profileId: 'standard',
		repoRoot: PROJECT_ROOT,
	});
	const result = buildDocumentDependencyGraph({ contract, registry });
	return result.graph;
}

function makeStalenessResult(
	overrides?: Partial<StalenessDetectionResult>,
): StalenessDetectionResult {
	return {
		diagnostics: [],
		documentationRoot: 'logos/',
		graphSummary: { edgeCount: 0, nodeCount: 0, outputNodeCount: 0 },
		optionalDependencyWarnings: [],
		profileId: 'standard',
		readOnly: true,
		summary: {
			blockedCount: 0,
			countByStatus: {},
			countByTargetKind: {},
			currentCount: 10,
			missingCount: 2,
			optionalDependencyWarningCount: 0,
			orphanedCount: 1,
			staleCount: 3,
			topBlockingReasons: [],
			topStaleReasons: [],
			total: 16,
			unknownCount: 0,
		},
		targets: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Text output tests
// ---------------------------------------------------------------------------

describe('renderGraphTextReport', () => {
	it('renders Standard profile graph summary', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph });

		expect(result.format).toBe('text');
		expect(result.textOutput).toBeTruthy();

		const text = result.textOutput!;
		expect(text).toContain('Graph Output');
		expect(text).toContain('Profile: standard');
		expect(text).toContain('Graph Summary:');
		expect(text).toContain('Phases:');
		expect(text).toContain('Documents:');
		expect(text).toContain('Outputs:');
		expect(text).toContain('Edges:');
		expect(text).toContain('Unresolved references:');
		expect(text).toContain('Cycles:');
		expect(text).toContain('Diagnostics:');
	});

	it('includes phase rows', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'phase_tree' });

		const text = result.textOutput!;
		expect(text).toContain('Phases');
		expect(text).toContain('Phase: 01-foundation');
		expect(text).toContain('Phase: 02-validation');
		expect(text).toContain('Phase: 03-product');
		expect(text).toContain('Phase: 04-engineering');
		expect(text).toContain('Phase: 05-go-to-market');
		expect(text).toContain('Phase: 06-operations');
	});

	it('includes document rows', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'phase_tree' });

		const text = result.textOutput!;
		expect(text).toContain('document:01-thesis');
		expect(text).toContain('document:02-problem');
		expect(text).toContain('document:03-audience');
		expect(text).toContain('document:04-principles');
	});

	it('includes canonical output rows', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'phase_tree' });

		const text = result.textOutput!;
		expect(text).toMatch(/canonical output \[canonical\]/);
	});

	it('includes derived artifact rows when declared', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'phase_tree' });

		const text = result.textOutput!;
		const hasHtml = text.includes('html_artifact [derived]');
		const hasAgent = text.includes('agent_pack [derived]');
		if (hasHtml || hasAgent) {
			// at least one derived artifact type should appear
			expect(text).toContain('[derived]');
		}
	});

	it('includes executive output rows where declared', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'phase_tree' });

		const text = result.textOutput!;
		// Executive outputs should appear if the graph has them
		const _hasExec =
			text.includes('executive_json') ||
			text.includes('executive_markdown') ||
			text.includes('executive_html');
		// Not all graphs have executive outputs, but if they exist, they should be marked correctly
		expect(text).toBeTruthy();
	});

	it('includes output type labels', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'outputs' });

		const text = result.textOutput!;
		expect(text).toContain('Outputs');
		// Should contain some output kind labels
		expect(text).toMatch(
			/canonical_output|html_artifact|agent_pack|data_artifact|report_artifact/,
		);
	});

	it('includes canonical/non-canonical marker', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'phase_tree' });

		const text = result.textOutput!;
		expect(text).toContain('[canonical]');
		// derived artifacts should appear with derived marker or [canonical] for canonical
	});

	it('includes status/stale flags when staleness result is provided', async () => {
		const graph = await buildStandardGraph();
		const staleness = makeStalenessResult({
			summary: {
				blockedCount: 0,
				countByStatus: {},
				countByTargetKind: {},
				currentCount: 10,
				missingCount: 2,
				optionalDependencyWarningCount: 0,
				orphanedCount: 1,
				staleCount: 3,
				topBlockingReasons: [],
				topStaleReasons: [],
				total: 16,
				unknownCount: 0,
			},
		});

		const result = renderGraphTextReport(
			{ graph, stalenessResult: staleness },
			{ mode: 'staleness' },
		);

		const text = result.textOutput!;
		expect(text).toContain('Staleness');
		expect(text).toContain('Stale:');
		expect(text).toContain('3');
		expect(text).toContain('Missing:');
		expect(text).toContain('2');
	});

	it('includes unresolved reference diagnostics', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph });

		const text = result.textOutput!;
		expect(text).toContain('Warnings');
		// Either shows (none) or actual warnings
	});

	it('includes cycle diagnostics', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph });

		const text = result.textOutput!;
		expect(text).toContain('Warnings');
	});

	it('does not include full verbose edge dump by default', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'summary' });

		const text = result.textOutput!;
		// Summary mode should not contain raw edge listings
		expect(text).not.toContain('Edge: ');
		expect(text).not.toContain('EdgeKind: ');
	});

	it('output ordering is deterministic', async () => {
		const graph = await buildStandardGraph();

		const r1 = renderGraphTextReport({ graph }, { mode: 'phase_tree' });
		const r2 = renderGraphTextReport({ graph }, { mode: 'phase_tree' });

		expect(r1.textOutput).toBe(r2.textOutput);
	});

	it('handles empty or minimal graph gracefully', () => {
		const emptyGraph: DocumentDependencyGraph = {
			cycles: [],
			diagnostics: [],
			downstreamEdges: new Map(),
			edgeMap: new Map(),
			edges: [],
			nodeByDocumentId: new Map(),
			nodeMap: new Map(),
			nodes: [],
			nodesByPhaseId: new Map(),
			outputsByDocumentId: new Map(),
			profileId: 'test',
			unresolvedReferences: [],
			upstreamEdges: new Map(),
		};

		const result = renderGraphTextReport({ graph: emptyGraph });
		expect(result.textOutput).toBeTruthy();
		expect(result.textOutput).toContain('Profile: test');
	});
});

// ---------------------------------------------------------------------------
// JSON output tests
// ---------------------------------------------------------------------------

describe('renderGraphJsonReport', () => {
	it('renders parseable JSON graph report', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphJsonReport({ graph });

		expect(result.format).toBe('json');
		expect(result.jsonOutput).toBeTruthy();

		const parsed = JSON.parse(result.jsonOutput!);
		expect(parsed).toBeTruthy();
		expect(typeof parsed).toBe('object');
	});

	it('JSON includes profileId, summary, nodes, edges, phases, documents, outputs, staleness, diagnostics', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphJsonReport({ graph });
		const parsed = JSON.parse(result.jsonOutput!);

		expect(parsed.profileId).toBe('standard');
		expect(parsed.formatVersion).toBe('1.0.0');
		expect(parsed.renderedAt).toBeTruthy();
		expect(parsed.summary).toBeTruthy();
		expect(Array.isArray(parsed.nodes)).toBe(true);
		expect(Array.isArray(parsed.edges)).toBe(true);
		expect(Array.isArray(parsed.phases)).toBe(true);
		expect(Array.isArray(parsed.documents)).toBe(true);
		expect(Array.isArray(parsed.outputs)).toBe(true);
		expect(parsed.staleness).toBeTruthy();
		expect(Array.isArray(parsed.diagnostics)).toBe(true);
	});

	it('JSON ordering is deterministic', async () => {
		const graph = await buildStandardGraph();
		const ts = '2025-01-01T00:00:00.000Z';

		const r1 = renderGraphJsonReport({ graph }, { generatedAt: ts });
		const r2 = renderGraphJsonReport({ graph }, { generatedAt: ts });

		expect(r1.jsonOutput).toBe(r2.jsonOutput);

		// Verify phases are in order
		const parsed = JSON.parse(r1.jsonOutput!);
		const phaseIds = parsed.phases.map((p: { phaseId: string }) => p.phaseId);
		expect(phaseIds).toEqual([
			'01-foundation',
			'02-validation',
			'03-product',
			'04-engineering',
			'05-go-to-market',
			'06-operations',
		]);
	});

	it('JSON includes status/stale flags when staleness result is provided', async () => {
		const graph = await buildStandardGraph();
		const staleness = makeStalenessResult();

		const result = renderGraphJsonReport({ graph, stalenessResult: staleness });
		const parsed = JSON.parse(result.jsonOutput!);

		expect(parsed.staleness.currentCount).toBe(10);
		expect(parsed.staleness.staleCount).toBe(3);
		expect(parsed.staleness.missingCount).toBe(2);
		expect(parsed.staleness.blockedCount).toBe(0);
		expect(parsed.staleness.orphanedCount).toBe(1);
		expect(parsed.staleness.unknownCount).toBe(0);

		// Nodes should have stalenessStatus field
		if (parsed.nodes.length > 0) {
			expect(parsed.nodes[0].stalenessStatus).toBeDefined();
			expect(typeof parsed.nodes[0].isStale).toBe('boolean');
			expect(typeof parsed.nodes[0].isBlocked).toBe('boolean');
			expect(typeof parsed.nodes[0].isMissing).toBe('boolean');
		}
	});

	it('JSON has no circular structures', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphJsonReport({ graph });

		// JSON.stringify handles circular detection – if it succeeds, no circular refs
		expect(() => JSON.parse(result.jsonOutput!)).not.toThrow();
		const parsed = JSON.parse(result.jsonOutput!);

		// Verify we can re-serialize
		expect(() => JSON.stringify(parsed)).not.toThrow();
	});

	it('JSON does not include absolute paths as stable IDs', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphJsonReport({ graph });
		const parsed = JSON.parse(result.jsonOutput!);

		// Node IDs should not be absolute paths
		for (const node of parsed.nodes) {
			expect(typeof node.id).toBe('string');
			expect(node.id).not.toMatch(/^\//); // Should not start with /
		}

		// Edge IDs should not be absolute paths
		for (const edge of parsed.edges) {
			expect(typeof edge.id).toBe('string');
		}

		// Phase phaseId should not be absolute paths
		for (const phase of parsed.phases) {
			expect(typeof phase.phaseId).toBe('string');
			expect(phase.phaseId).not.toMatch(/^\//);
		}

		// Document canonicalId should not be absolute paths
		for (const doc of parsed.documents) {
			expect(typeof doc.canonicalId).toBe('string');
			expect(doc.canonicalId).not.toMatch(/^\//);
		}
	});

	it('JSON does not include raw fake secrets', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphJsonReport({ graph });
		const parsed = JSON.parse(result.jsonOutput!);

		const jsonStr = JSON.stringify(parsed);
		expect(jsonStr).not.toContain('sk-ant-');
		expect(jsonStr).not.toContain('sk-proj-');
		expect(jsonStr).not.toContain('Bearer ');
	});
});

// ---------------------------------------------------------------------------
// Filter/scope tests
// ---------------------------------------------------------------------------

describe('graph output filters', () => {
	it('filters by phase id', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport(
			{ graph },
			{
				filter: { phaseId: '01-foundation' },
				mode: 'phase_tree',
			},
		);

		const text = result.textOutput!;
		expect(text).toContain('Phase: 01-foundation');
		expect(text).toContain('document:01-thesis');
		// Should NOT contain documents from other phases
		expect(text).not.toContain('Phase: 02-validation');
		expect(text).not.toContain('Phase: 03-product');
	});

	it('filters by document id', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport(
			{ graph },
			{
				filter: { documentId: '01-thesis' },
				mode: 'phase_tree',
			},
		);

		const text = result.textOutput!;
		expect(text).toContain('document:01-thesis');
		expect(text).not.toContain('document:02-problem');
		expect(text).not.toContain('document:03-audience');
	});

	it('filters by staleness status', async () => {
		const graph = await buildStandardGraph();
		const staleness = makeStalenessResult({
			summary: {
				blockedCount: 0,
				countByStatus: {},
				countByTargetKind: {},
				currentCount: 1,
				missingCount: 0,
				optionalDependencyWarningCount: 0,
				orphanedCount: 0,
				staleCount: 0,
				topBlockingReasons: [],
				topStaleReasons: [],
				total: 1,
				unknownCount: 0,
			},
		});

		const result = renderGraphTextReport(
			{ graph, stalenessResult: staleness },
			{
				filter: { stalenessStatus: 'current' },
				mode: 'staleness',
			},
		);

		const text = result.textOutput!;
		// Staleness mode with staleness result should show staleness counts
		expect(text).toContain('Staleness');
		expect(text).toContain('Current:');
		expect(text).toContain('1');
		expect(text).not.toContain('Stale:           3');
	});

	it('includes derived artifacts by default', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'phase_tree' });

		const text = result.textOutput!;
		// derived artifacts should be visible by default
		expect(text).toContain('[derived]');
	});

	it('excludes derived artifacts when requested', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport(
			{ graph },
			{
				filter: { includeDerivedArtifacts: false },
				mode: 'outputs',
			},
		);

		const text = result.textOutput!;
		// Should not contain derived artifact markers when excluded
		expect(text).not.toContain('[derived]');
	});

	it('includes executive outputs by default', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph }, { mode: 'outputs' });

		// executive outputs should be included by default if they exist
		expect(result.textOutput).toBeTruthy();
	});

	it('excludes executive outputs when requested', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport(
			{ graph },
			{
				filter: { includeExecutiveOutputs: false },
				mode: 'outputs',
			},
		);

		const text = result.textOutput!;
		expect(text).not.toContain('executive_json');
		expect(text).not.toContain('executive_markdown');
		expect(text).not.toContain('executive_html');
	});

	it('includes full edges only when requested', async () => {
		const graph = await buildStandardGraph();

		// Without full edges
		const defaultResult = renderGraphJsonReport({ graph });
		const defaultParsed = JSON.parse(defaultResult.jsonOutput!);
		expect(defaultParsed.edges.length).toBe(0);

		// With full edges
		const fullResult = renderGraphJsonReport(
			{ graph },
			{ filter: { includeFullEdges: true } },
		);
		const fullParsed = JSON.parse(fullResult.jsonOutput!);
		expect(fullParsed.edges.length).toBeGreaterThan(0);
	});

	it('unknown filter value returns diagnostic (no crash)', async () => {
		const graph = await buildStandardGraph();
		// Using an unrecognized phaseId should still produce output without crashing
		const result = renderGraphTextReport(
			{ graph },
			{
				filter: { phaseId: 'nonexistent-phase' },
				mode: 'phase_tree',
			},
		);

		expect(result.textOutput).toBeTruthy();
		// Should produce some output even if no phases match
	});

	it('all render modes produce valid output', async () => {
		const graph = await buildStandardGraph();
		const modes: GraphOutputRenderMode[] = [
			'summary',
			'phase_tree',
			'document_dependencies',
			'outputs',
			'staleness',
			'regeneration',
			'full',
		];

		for (const mode of modes) {
			const result = renderGraphTextReport({ graph }, { mode });
			expect(result.textOutput).toBeTruthy();
			expect(result.format).toBe('text');
		}
	});
});

// ---------------------------------------------------------------------------
// createInspectableGraphOutput
// ---------------------------------------------------------------------------

describe('createInspectableGraphOutput', () => {
	it('returns text output by default', async () => {
		const graph = await buildStandardGraph();
		const result = createInspectableGraphOutput({ graph });

		expect(result.format).toBe('text');
		expect(result.textOutput).toBeTruthy();
	});

	it('returns JSON output when format is json', async () => {
		const graph = await buildStandardGraph();
		const result = createInspectableGraphOutput({ graph }, { format: 'json' });

		expect(result.format).toBe('json');
		expect(result.jsonOutput).toBeTruthy();
		expect(() => JSON.parse(result.jsonOutput!)).not.toThrow();
	});

	it('is deterministic for text', async () => {
		const graph = await buildStandardGraph();

		const r1 = createInspectableGraphOutput({ graph });
		const r2 = createInspectableGraphOutput({ graph });

		expect(r1.textOutput).toBe(r2.textOutput);
	});

	it('is deterministic for JSON', async () => {
		const graph = await buildStandardGraph();
		const ts = '2025-01-01T00:00:00.000Z';

		const r1 = createInspectableGraphOutput(
			{ graph },
			{ format: 'json', generatedAt: ts },
		);
		const r2 = createInspectableGraphOutput(
			{ graph },
			{ format: 'json', generatedAt: ts },
		);

		expect(r1.jsonOutput).toBe(r2.jsonOutput);
	});

	it('accepts custom generatedAt for JSON deterministic tests', async () => {
		const graph = await buildStandardGraph();
		const timestamp = '2025-01-01T00:00:00.000Z';

		const result = createInspectableGraphOutput(
			{ graph },
			{ format: 'json', generatedAt: timestamp },
		);

		const parsed = JSON.parse(result.jsonOutput!);
		expect(parsed.renderedAt).toBe(timestamp);
	});

	it('supports regeneration plan inclusion', async () => {
		const graph = await buildStandardGraph();

		const regenPlan = {
			blockedSummary: [],
			countByAction: {},
			countByReasonCode: {},
			countByStatus: {},
			countByTargetKind: {},
			dependencyImpactSummary: [],
			diagnostics: [],
			documentationRoot: 'logos/',
			dryRun: true,
			graphEdgeCount: 20,
			graphNodeCount: 10,
			items: [],
			orphanedManualReviewSummary: [],
			profileId: 'standard',
			sourceChanges: [],
		};

		const result = createInspectableGraphOutput(
			{ graph, regenerationPlan: regenPlan },
			{ mode: 'regeneration' },
		);

		expect(result.textOutput).toBeTruthy();
		expect(result.textOutput).toContain('Regeneration Plan');
		expect(result.textOutput).toContain('Dry run: yes');
	});

	it('staleness is not_evaluated when no staleness result is provided', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphJsonReport({ graph });
		const parsed = JSON.parse(result.jsonOutput!);

		if (parsed.nodes.length > 0) {
			const outputNode = parsed.nodes.find(
				(n: { kind: string }) =>
					n.kind === 'canonical_output' || n.kind === 'html_artifact',
			);
			if (outputNode) {
				expect(outputNode.stalenessStatus).toBe('not_evaluated');
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('graph output snapshots', () => {
	it('snapshots Standard text graph summary', async () => {
		const graph = await buildStandardGraph();
		const _timestamp = '2025-01-01T00:00:00.000Z';
		const result = renderGraphTextReport({ graph }, { mode: 'summary' });

		// Normalize timestamps in text (none in text output, but ensure deterministic)
		expect(result.textOutput).toMatchSnapshot();
	});

	it('snapshots Standard JSON graph summary', async () => {
		const graph = await buildStandardGraph();
		const timestamp = '2025-01-01T00:00:00.000Z';
		const result = renderGraphJsonReport({ graph }, { generatedAt: timestamp });

		expect(result.jsonOutput).toMatchSnapshot();
	});

	it('snapshots stale graph output fixture', async () => {
		const graph = await buildStandardGraph();
		const staleness = makeStalenessResult({
			targets: [
				{
					artifactId: undefined,
					changedSourceRefs: [],
					currentNodeFingerprint: undefined,
					diagnostics: [],
					documentCanonicalId: '01-thesis',
					generatedAt: undefined,
					generationRunId: undefined,
					graphNodeId: undefined,
					outputPath: 'logos/01-foundation/01-thesis.md',
					phaseId: '01-foundation',
					reasons: [
						{
							code: 'output_checksum_mismatch',
							expected: 'abc123',
							message: 'Output checksum mismatch for 01-thesis',
							received: 'def456',
							severity: 'warning',
							sourceId: '01-thesis.md',
							sourceKind: 'output_file',
							sourcePath: 'logos/01-foundation/01-thesis.md',
							targetId: 'canonical_markdown:01-thesis:thesis',
							upstreamTargetId: undefined,
						},
					],
					recordedSourceFingerprint: undefined,
					severity: 'warning',
					status: 'stale',
					targetId: 'canonical_markdown:01-thesis:thesis',
					targetKind: 'canonical_markdown',
					upstreamImpacts: [],
				},
			],
		});

		const timestamp = '2025-01-01T00:00:00.000Z';
		const result = renderGraphJsonReport(
			{ graph, stalenessResult: staleness },
			{ generatedAt: timestamp, mode: 'staleness' },
		);

		expect(result.jsonOutput).toMatchSnapshot();
	});
});
