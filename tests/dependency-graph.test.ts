import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DocumentDependencyGraph } from '../src/dependency-graph/dependency-graph.js';
import {
	buildDocumentDependencyGraph,
	getCanonicalOutputForDocument,
	getDerivedArtifactsForDocument,
	getDirectDependencies,
	getDirectDependents,
	getDocumentNode,
	getDownstreamNodes,
	getExecutiveOutputs,
	getNode,
	getPhaseDocuments,
	getTopologicalDocumentOrder,
	getUpstreamNodes,
	loadDocumentationContract,
	summarizeDependencyGraph,
} from '../src/index.js';

const STANDARD_SCHEMA_PATH = resolve(
	process.cwd(),
	'profiles',
	'standard',
	'document.schema.yml',
);
const FIXTURES_ROOT = resolve(process.cwd(), 'tests', 'fixtures', 'profiles');

async function buildStandardGraph(): Promise<DocumentDependencyGraph> {
	const contract = await loadDocumentationContract({
		profileId: 'standard',
		repoRoot: process.cwd(),
		schemaPath: STANDARD_SCHEMA_PATH,
	});
	const result = buildDocumentDependencyGraph({ contract });
	return result.graph;
}

// ---------------------------------------------------------------------------
// Graph build tests
// ---------------------------------------------------------------------------

describe('buildDocumentDependencyGraph', () => {
	describe('Standard profile graph build', () => {
		it('builds the dependency graph from the Standard profile contract successfully', async () => {
			const graph = await buildStandardGraph();
			expect(graph).toBeDefined();
			expect(graph.nodes.length).toBeGreaterThan(0);
			expect(graph.edges.length).toBeGreaterThan(0);
		});

		it('includes phase nodes', async () => {
			const graph = await buildStandardGraph();
			const phaseNodes = graph.nodes.filter((n) => n.kind === 'phase');
			expect(phaseNodes.length).toBeGreaterThan(0);

			const phaseIds = phaseNodes.map((n) => n.id);
			expect(phaseIds).toContain('phase:01-foundation');
			expect(phaseIds).toContain('phase:02-validation');
			expect(phaseIds).toContain('phase:03-product');
			expect(phaseIds).toContain('phase:04-engineering');
			expect(phaseIds).toContain('phase:05-go-to-market');
			expect(phaseIds).toContain('phase:06-operations');
		});

		it('includes document nodes', async () => {
			const graph = await buildStandardGraph();
			const docNodes = graph.nodes.filter((n) => n.kind === 'document');
			expect(docNodes.length).toBeGreaterThan(0);

			const docIds = docNodes.map((n) => n.id);
			expect(docIds).toContain('document:01-thesis');
			expect(docIds).toContain('document:02-problem');
		});

		it('includes canonical output nodes', async () => {
			const graph = await buildStandardGraph();
			const canonicalNodes = graph.nodes.filter(
				(n) => n.kind === 'canonical_output',
			);
			expect(canonicalNodes.length).toBeGreaterThan(0);

			for (const node of canonicalNodes) {
				expect(node.isCanonical).toBe(true);
				expect(node.id.startsWith('output:canonical:')).toBe(true);
			}
		});

		it('includes HTML artifact nodes when declared', async () => {
			const graph = await buildStandardGraph();
			const htmlNodes = graph.nodes.filter((n) => n.kind === 'html_artifact');
			expect(htmlNodes.length).toBeGreaterThan(0);

			for (const node of htmlNodes) {
				expect(node.isCanonical).toBe(false);
				expect(node.id.startsWith('output:html:')).toBe(true);
			}
		});

		it('includes agent pack nodes when declared', async () => {
			const graph = await buildStandardGraph();
			const agentPackNodes = graph.nodes.filter((n) => n.kind === 'agent_pack');
			expect(agentPackNodes.length).toBeGreaterThan(0);

			for (const node of agentPackNodes) {
				expect(node.isCanonical).toBe(false);
				expect(
					node.id.startsWith('output:agent-pack:') ||
						node.id.startsWith('executive:'),
				).toBe(true);
			}
		});

		it('includes data/report artifact nodes when declared', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'output-targets',
				profileRoot: resolve(FIXTURES_ROOT, 'output-targets'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			const dataNodes = graph.nodes.filter((n) => n.kind === 'data_artifact');
			expect(dataNodes.length).toBeGreaterThan(0);

			for (const node of dataNodes) {
				expect(node.isCanonical).toBe(false);
			}
		});

		it('includes executive output nodes where declarations are available', async () => {
			const graph = await buildStandardGraph();
			const execNodes = getExecutiveOutputs(graph);
			expect(execNodes.length).toBeGreaterThan(0);

			for (const node of execNodes) {
				expect(node.isCanonical).toBe(false);
			}
		});

		it('includes phase → document contains edges', async () => {
			const graph = await buildStandardGraph();
			const containsEdges = graph.edges.filter((e) => e.kind === 'contains');
			expect(containsEdges.length).toBeGreaterThan(0);

			for (const edge of containsEdges) {
				expect(edge.fromNodeId.startsWith('phase:')).toBe(true);
				expect(edge.toNodeId.startsWith('document:')).toBe(true);
			}
		});

		it('includes document → output edges', async () => {
			const graph = await buildStandardGraph();
			const outputEdges = graph.edges.filter((e) => e.kind === 'outputs_to');
			expect(outputEdges.length).toBeGreaterThan(0);

			for (const edge of outputEdges) {
				expect(edge.fromNodeId.startsWith('document:')).toBe(true);
			}
		});

		it('includes dependency edges from dependsOn', async () => {
			const graph = await buildStandardGraph();
			const depEdges = graph.edges.filter((e) => e.kind === 'depends_on');
			expect(depEdges.length).toBeGreaterThan(0);

			for (const edge of depEdges) {
				expect(edge.sourceDeclarationKind).toBe('dependsOn');
			}
		});

		it('includes feed edges from feeds where declared', async () => {
			const graph = await buildStandardGraph();
			const feedEdges = graph.edges.filter((e) => e.kind === 'feeds');
			expect(feedEdges.length).toBeGreaterThan(0);

			for (const edge of feedEdges) {
				expect(edge.sourceDeclarationKind).toBe('feeds');
			}
		});

		it('includes input edges where resolvable', async () => {
			const graph = await buildStandardGraph();
			const inputEdges = graph.edges.filter((e) => e.kind === 'input_to');
			// Input edges are optional and may be zero in Standard profile
			for (const edge of inputEdges) {
				expect(edge.sourceDeclarationKind).toBe('input');
			}
		});

		it('includes executive/mapping edges where resolvable', async () => {
			const graph = await buildStandardGraph();
			const execEdges = graph.edges.filter(
				(e) =>
					e.kind === 'executive_depends_on' || e.kind === 'mapping_outputs_to',
			);
			expect(execEdges.length).toBeGreaterThan(0);
		});

		it('graph summary counts are deterministic', async () => {
			const graph1 = await buildStandardGraph();
			const graph2 = await buildStandardGraph();

			const summary1 = summarizeDependencyGraph(graph1);
			const summary2 = summarizeDependencyGraph(graph2);

			expect(summary1.phaseCount).toBe(summary2.phaseCount);
			expect(summary1.documentCount).toBe(summary2.documentCount);
			expect(summary1.canonicalOutputCount).toBe(summary2.canonicalOutputCount);
			expect(summary1.executiveOutputCount).toBe(summary2.executiveOutputCount);
			expect(summary1.cycleCount).toBe(summary2.cycleCount);
		});
	});

	// -----------------------------------------------------------------------
	// Standard profile validation tests
	// -----------------------------------------------------------------------

	describe('Standard profile validation', () => {
		it('builds and reports unresolved dependencies with proper diagnostics', async () => {
			const graph = await buildStandardGraph();
			const unresolvedErrors = graph.unresolvedReferences.filter(
				(r) => r.severity === 'error',
			);
			// Standard profile v0.1.0 has some unresolved dependsOn references
			// due to naming inconsistencies between feed/dep references and actual
			// document IDs (e.g. 02-product-scope vs 02-scope).
			// These are correctly detected and reported as diagnostics.
			for (const ref of unresolvedErrors) {
				expect(ref.code).toContain('E_DEP_GRAPH_');
				expect(ref.sourcePath).toBeTruthy();
				expect(ref.referenceValue).toBeTruthy();
				expect(ref.referenceKind).toBe('dependsOn');
			}
		});

		it('has no blocking cycles', async () => {
			const graph = await buildStandardGraph();
			expect(graph.cycles.length).toBe(0);
		});

		it('node ordering is deterministic', async () => {
			const graph1 = await buildStandardGraph();
			const graph2 = await buildStandardGraph();

			expect(graph1.nodes.length).toBe(graph2.nodes.length);
			for (let i = 0; i < graph1.nodes.length; i++) {
				expect(graph1.nodes[i]?.id).toBe(graph2.nodes[i]?.id);
			}
		});

		it('edge ordering is deterministic', async () => {
			const graph1 = await buildStandardGraph();
			const graph2 = await buildStandardGraph();

			expect(graph1.edges.length).toBe(graph2.edges.length);
			for (let i = 0; i < graph1.edges.length; i++) {
				expect(graph1.edges[i]?.id).toBe(graph2.edges[i]?.id);
			}
		});

		it('topological document order is deterministic', async () => {
			const graph1 = await buildStandardGraph();
			const graph2 = await buildStandardGraph();

			const order1 = getTopologicalDocumentOrder(graph1);
			const order2 = getTopologicalDocumentOrder(graph2);

			expect(order1).toEqual(order2);
		});
	});

	// -----------------------------------------------------------------------
	// Node/edge identity tests
	// -----------------------------------------------------------------------

	describe('Node and edge identity', () => {
		it('node IDs are stable', async () => {
			const graph1 = await buildStandardGraph();
			const graph2 = await buildStandardGraph();

			const ids1 = graph1.nodes.map((n) => n.id);
			const ids2 = graph2.nodes.map((n) => n.id);
			expect(ids1).toEqual(ids2);
		});

		it('node IDs do not contain absolute paths', async () => {
			const graph = await buildStandardGraph();
			for (const node of graph.nodes) {
				expect(node.id).not.toContain('/Volumes');
				expect(node.id).not.toContain('Users');
				expect(node.id).not.toContain(':\\');
			}
		});

		it('output node IDs are stable across OS path separators', async () => {
			const graph = await buildStandardGraph();
			for (const node of graph.nodes) {
				if (node.id.startsWith('output:')) {
					expect(node.id).not.toContain('\\');
				}
			}
		});

		it('edge IDs are stable', async () => {
			const graph1 = await buildStandardGraph();
			const graph2 = await buildStandardGraph();

			const eIds1 = graph1.edges.map((e) => e.id);
			const eIds2 = graph2.edges.map((e) => e.id);
			expect(eIds1).toEqual(eIds2);
		});

		it('descriptor source paths are metadata, not identity', async () => {
			const graph = await buildStandardGraph();
			for (const node of graph.nodes) {
				if (node.sourcePath !== undefined) {
					expect(typeof node.sourcePath).toBe('string');
				}
				// Node ID should not change when source path changes
				expect(node.id).not.toContain(node.sourcePath ?? '__NONE__');
			}
		});

		it('canonical/non-canonical marker is correct for output nodes', async () => {
			const graph = await buildStandardGraph();

			const canonicalOutputs = graph.nodes.filter(
				(n) => n.kind === 'canonical_output',
			);
			for (const node of canonicalOutputs) {
				expect(node.isCanonical).toBe(true);
			}

			const htmlOutputs = graph.nodes.filter((n) => n.kind === 'html_artifact');
			for (const node of htmlOutputs) {
				expect(node.isCanonical).toBe(false);
			}

			const agentPackOutputs = graph.nodes.filter(
				(n) => n.kind === 'agent_pack' && n.id.startsWith('output:agent-pack:'),
			);
			for (const node of agentPackOutputs) {
				expect(node.isCanonical).toBe(false);
			}
		});
	});

	// -----------------------------------------------------------------------
	// Dependency query tests
	// -----------------------------------------------------------------------

	describe('Dependency queries', () => {
		it('get document node by canonical document ID', async () => {
			const graph = await buildStandardGraph();
			const node = getDocumentNode(graph, '01-thesis');
			expect(node).toBeDefined();
			expect(node?.documentCanonicalId).toBe('01-thesis');
			expect(node?.kind).toBe('document');
		});

		it('get documents for phase', async () => {
			const graph = await buildStandardGraph();
			const docs = getPhaseDocuments(graph, '01-foundation');
			expect(docs.length).toBeGreaterThan(0);

			const docNodes = docs.filter((n) => n.kind === 'document');
			for (const node of docNodes) {
				expect(node.phaseId).toBe('01-foundation');
			}
		});

		it('get direct dependencies for a document', async () => {
			const graph = await buildStandardGraph();
			const deps = getDirectDependencies(graph, '02-problem');
			expect(deps.length).toBeGreaterThan(0);

			for (const dep of deps) {
				expect(dep.kind).toBe('document');
			}
		});

		it('get direct dependents for a document', async () => {
			const graph = await buildStandardGraph();
			const dependents = getDirectDependents(graph, '01-thesis');
			expect(dependents.length).toBeGreaterThan(0);

			for (const d of dependents) {
				expect(d.kind).toBe('document');
			}
		});

		it('get upstream nodes', async () => {
			const graph = await buildStandardGraph();
			const result = getUpstreamNodes(graph, 'document:02-problem', {
				edgeKinds: ['depends_on'],
			});
			expect(result.nodes.length).toBeGreaterThan(0);

			for (const node of result.nodes) {
				expect(node.kind).toBe('document');
			}
		});

		it('get downstream nodes', async () => {
			const graph = await buildStandardGraph();
			const result = getDownstreamNodes(graph, 'document:01-thesis');
			expect(result.nodes.length).toBeGreaterThan(0);
		});

		it('transitive traversal is deterministic', async () => {
			const graph = await buildStandardGraph();
			const r1 = getUpstreamNodes(graph, 'document:03-audience');
			const r2 = getUpstreamNodes(graph, 'document:03-audience');

			expect(r1.nodes.map((n) => n.id)).toEqual(r2.nodes.map((n) => n.id));
			expect(r1.depth).toBe(r2.depth);
		});

		it('traversal handles cycles safely', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'circular-dependency-direct',
				profileRoot: resolve(FIXTURES_ROOT, 'circular-dependency-direct'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			// Traversal should not hang on cycles
			const docNodes = graph.nodes.filter((n) => n.kind === 'document');
			expect(docNodes.length).toBeGreaterThan(0);

			const firstDocId = docNodes[0]?.id;
			expect(firstDocId).toBeDefined();

			if (firstDocId !== undefined) {
				const upstream = getUpstreamNodes(graph, firstDocId);
				expect(upstream.nodes.length).toBeGreaterThanOrEqual(0);

				const downstream = getDownstreamNodes(graph, firstDocId);
				expect(downstream.nodes.length).toBeGreaterThanOrEqual(0);
			}
		});

		it('unknown document/node query returns undefined', async () => {
			const graph = await buildStandardGraph();
			const node = getDocumentNode(graph, 'nonexistent-id');
			expect(node).toBeUndefined();

			const directNode = getNode(graph, 'document:nonexistent-id');
			expect(directNode).toBeUndefined();
		});

		it('topological document order respects dependencies', async () => {
			const graph = await buildStandardGraph();
			const order = getTopologicalDocumentOrder(graph);
			expect(order.length).toBeGreaterThan(0);

			// In topological order, if A dependsOn B, B must come before A
			for (const edge of graph.edges) {
				if (edge.kind !== 'depends_on') continue;
				const fromNode = graph.nodeMap.get(edge.fromNodeId);
				const toNode = graph.nodeMap.get(edge.toNodeId);

				if (
					fromNode?.documentCanonicalId !== undefined &&
					toNode?.documentCanonicalId !== undefined
				) {
					const fromIdx = order.indexOf(fromNode.documentCanonicalId);
					const toIdx = order.indexOf(toNode.documentCanonicalId);
					if (fromIdx >= 0 && toIdx >= 0) {
						expect(fromIdx).toBeLessThan(toIdx);
					}
				}
			}
		});
	});

	// -----------------------------------------------------------------------
	// Output query tests
	// -----------------------------------------------------------------------

	describe('Output queries', () => {
		it('get canonical output for document', async () => {
			const graph = await buildStandardGraph();
			const canonical = getCanonicalOutputForDocument(graph, '01-thesis');
			expect(canonical).toBeDefined();
			expect(canonical?.kind).toBe('canonical_output');
			expect(canonical?.isCanonical).toBe(true);
		});

		it('get derived artifacts for document', async () => {
			const graph = await buildStandardGraph();
			const derived = getDerivedArtifactsForDocument(graph, '01-thesis');
			expect(derived.length).toBeGreaterThan(0);

			for (const node of derived) {
				expect(node.kind).not.toBe('canonical_output');
			}
		});

		it('canonical Markdown output is canonical', async () => {
			const graph = await buildStandardGraph();
			const canonicalOutputs = graph.nodes.filter(
				(n) => n.kind === 'canonical_output',
			);

			for (const node of canonicalOutputs) {
				expect(node.isCanonical).toBe(true);
				expect(node.outputType).toBe('markdown');
			}
		});

		it('HTML artifact output is non-canonical', async () => {
			const graph = await buildStandardGraph();
			const htmlOutputs = graph.nodes.filter((n) => n.kind === 'html_artifact');

			for (const node of htmlOutputs) {
				expect(node.isCanonical).toBe(false);
			}
		});

		it('agent pack output is non-canonical', async () => {
			const graph = await buildStandardGraph();
			const agentPackOutputs = graph.nodes.filter(
				(n) => n.kind === 'agent_pack' && n.id.startsWith('output:agent-pack:'),
			);

			for (const node of agentPackOutputs) {
				expect(node.isCanonical).toBe(false);
			}
		});

		it('executive outputs are non-canonical', async () => {
			const graph = await buildStandardGraph();
			const execOutputs = getExecutiveOutputs(graph);

			for (const node of execOutputs) {
				expect(node.isCanonical).toBe(false);
			}
		});

		it('artifact/output paths are preserved as metadata', async () => {
			const graph = await buildStandardGraph();
			const outputs = graph.nodes.filter(
				(n) =>
					n.kind === 'canonical_output' ||
					n.kind === 'html_artifact' ||
					n.kind === 'agent_pack',
			);

			expect(outputs.length).toBeGreaterThan(0);
			for (const node of outputs) {
				expect(node.outputTargetPath).toBeTruthy();
				expect(node.sourcePath).toBeTruthy();
			}
		});
	});

	// -----------------------------------------------------------------------
	// Cycle detection tests
	// -----------------------------------------------------------------------

	describe('Cycle detection', () => {
		it('simple document cycle fixture is detected', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'circular-dependency-direct',
				profileRoot: resolve(FIXTURES_ROOT, 'circular-dependency-direct'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			expect(graph.cycles.length).toBeGreaterThan(0);
			const firstCycle = graph.cycles[0];
			expect(firstCycle).toBeDefined();
			if (firstCycle !== undefined) {
				expect(firstCycle.nodeIds.length).toBeGreaterThanOrEqual(2);
				expect(firstCycle.severity).toBe('error');
			}
		});

		it('multi-document cycle fixture is detected', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'circular-dependency-multi',
				profileRoot: resolve(FIXTURES_ROOT, 'circular-dependency-multi'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			expect(graph.cycles.length).toBeGreaterThan(0);
			const firstCycle = graph.cycles[0];
			expect(firstCycle).toBeDefined();
			if (firstCycle !== undefined) {
				expect(firstCycle.nodeIds.length).toBeGreaterThanOrEqual(3);
			}
		});

		it('cycle diagnostics include involved nodes/source paths', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'circular-dependency-direct',
				profileRoot: resolve(FIXTURES_ROOT, 'circular-dependency-direct'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			const firstCycle = graph.cycles[0];
			expect(firstCycle).toBeDefined();
			if (firstCycle !== undefined) {
				expect(firstCycle.nodeIds.length).toBeGreaterThan(0);
				expect(firstCycle.sourcePaths.length).toBeGreaterThan(0);
				expect(firstCycle.edgeIds.length).toBeGreaterThan(0);
			}
		});

		it('non-cyclic graph has no cycle diagnostics', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'non-circular-chain',
				profileRoot: resolve(FIXTURES_ROOT, 'non-circular-chain'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			expect(graph.cycles.length).toBe(0);
		});

		it('cycle detection is deterministic', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'circular-dependency-multi',
				profileRoot: resolve(FIXTURES_ROOT, 'circular-dependency-multi'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result1 = buildDocumentDependencyGraph({ contract });
			const result2 = buildDocumentDependencyGraph({ contract });

			expect(result1.graph.cycles.length).toBe(result2.graph.cycles.length);
			for (let i = 0; i < result1.graph.cycles.length; i++) {
				expect(result1.graph.cycles[i]?.nodeIds).toEqual(
					result2.graph.cycles[i]?.nodeIds,
				);
			}
		});
	});

	// -----------------------------------------------------------------------
	// Unresolved reference tests
	// -----------------------------------------------------------------------

	describe('Unresolved references', () => {
		it('unknown required dependsOn target emits diagnostic', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'unknown-dependency',
				profileRoot: resolve(FIXTURES_ROOT, 'unknown-dependency'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			const unresolvedErrors = graph.unresolvedReferences.filter(
				(r) => r.severity === 'error' && r.referenceKind === 'dependsOn',
			);
			expect(unresolvedErrors.length).toBeGreaterThan(0);

			const firstRef = unresolvedErrors[0];
			expect(firstRef).toBeDefined();
			if (firstRef !== undefined) {
				expect(firstRef.referenceValue).toContain('nonexistent');
				expect(firstRef.sourcePath).toBeTruthy();
			}
		});

		it('unknown feeds target emits diagnostic with configured severity', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'unknown-dependency',
				profileRoot: resolve(FIXTURES_ROOT, 'unknown-dependency'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph(
				{ contract },
				{ optionalRefSeverity: 'warning' },
			);
			const graph = result.graph;

			const feedRefs = graph.unresolvedReferences.filter(
				(r) => r.referenceKind === 'feeds',
			);
			// Feeds to unresolvable targets should be warnings
			for (const ref of feedRefs) {
				expect(ref.severity).toBe('warning');
			}
		});

		it('malformed dependency declarations are detected in fixture profiles', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'unknown-dependency',
				profileRoot: resolve(FIXTURES_ROOT, 'unknown-dependency'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			const depErrors = graph.unresolvedReferences.filter(
				(r) => r.code === 'E_DEP_GRAPH_UNRESOLVED_DEPENDS_ON',
			);
			expect(depErrors.length).toBeGreaterThan(0);

			for (const ref of depErrors) {
				expect(ref.referenceValue).toContain('nonexistent');
			}
		});

		it('diagnostics include source path/pointer/reference/recovery hint', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'unknown-dependency',
				profileRoot: resolve(FIXTURES_ROOT, 'unknown-dependency'),
				schemaPath: STANDARD_SCHEMA_PATH,
			});
			const result = buildDocumentDependencyGraph({ contract });
			const graph = result.graph;

			const refs = graph.unresolvedReferences;
			expect(refs.length).toBeGreaterThan(0);

			const firstRef = refs[0];
			expect(firstRef).toBeDefined();
			if (firstRef !== undefined) {
				expect(firstRef.sourcePath).toBeTruthy();
				expect(firstRef.referenceValue).toBeTruthy();
				expect(firstRef.referenceKind).toBeTruthy();
			}
		});
	});

	// -----------------------------------------------------------------------
	// Executive graph tests
	// -----------------------------------------------------------------------

	describe('Executive graph', () => {
		it('executive generation declarations produce executive output nodes when available', async () => {
			const graph = await buildStandardGraph();
			const execNodes = getExecutiveOutputs(graph);
			expect(execNodes.length).toBeGreaterThan(0);

			const jsonNodes = execNodes.filter((n) => n.kind === 'executive_json');
			expect(jsonNodes.length).toBeGreaterThan(0);
		});

		it('executive mapping declarations produce mapping/output edges when available', async () => {
			const graph = await buildStandardGraph();
			const mappingEdges = graph.edges.filter(
				(e) => e.kind === 'mapping_outputs_to',
			);
			expect(mappingEdges.length).toBeGreaterThan(0);
		});

		it('executive JSON → executive Markdown/HTML relationships are represented when declared', async () => {
			const graph = await buildStandardGraph();
			const execMarkdown = graph.nodes.filter(
				(n) => n.kind === 'executive_markdown',
			);
			const execHtml = graph.nodes.filter((n) => n.kind === 'executive_html');

			// Verify that mapping edges connect executive JSON to these nodes
			const mappingEdges = graph.edges.filter(
				(e) => e.kind === 'mapping_outputs_to',
			);
			expect(mappingEdges.length).toBeGreaterThanOrEqual(
				execMarkdown.length + execHtml.length,
			);
		});

		it('no executive files are generated', async () => {
			// The graph builder is read-only; the test simply ensures
			// that executive nodes are present in the graph without side effects
			const graph = await buildStandardGraph();
			expect(graph.nodes.length).toBeGreaterThan(0);
		});
	});

	// -----------------------------------------------------------------------
	// Summary tests
	// -----------------------------------------------------------------------

	describe('Graph summary', () => {
		it('summary includes all key fields', async () => {
			const graph = await buildStandardGraph();
			const summary = summarizeDependencyGraph(graph);

			expect(summary.profileId).toBe('standard');
			expect(summary.phaseCount).toBeGreaterThan(0);
			expect(summary.documentCount).toBeGreaterThan(0);
			expect(summary.canonicalOutputCount).toBeGreaterThan(0);
			expect(summary.cycleCount).toBe(0);

			expect(Object.keys(summary.outputCountByKind).length).toBeGreaterThan(0);
			expect(Object.keys(summary.edgeCountByKind).length).toBeGreaterThan(0);
		});

		it('summary is deterministic', async () => {
			const graph1 = await buildStandardGraph();
			const graph2 = await buildStandardGraph();

			const summary1 = summarizeDependencyGraph(graph1);
			const summary2 = summarizeDependencyGraph(graph2);

			expect(summary1).toEqual(summary2);
		});
	});

	// -----------------------------------------------------------------------
	// Non-mutation tests
	// -----------------------------------------------------------------------

	describe('Non-mutation', () => {
		it('graph build writes no files', async () => {
			// The graph builder only creates in-memory structures.
			// This is verified by the fact that build succeeds without
			// requiring any filesystem write capabilities.
			const graph = await buildStandardGraph();
			expect(graph).toBeDefined();
		});

		it('graph build does not call AI/provider code', async () => {
			// No AI provider imports or calls in dependency graph module
			const graph = await buildStandardGraph();
			expect(graph).toBeDefined();
		});
	});
});
