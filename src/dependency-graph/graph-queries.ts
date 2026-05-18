import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type {
	DependencyGraphEdge,
	DependencyGraphNode,
	DependencyGraphNodeId,
	DocumentDependencyGraph,
} from './dependency-graph.js';

// ---------------------------------------------------------------------------
// Traversal types
// ---------------------------------------------------------------------------

export interface DependencyGraphTraversalOptions {
	readonly maxDepth?: number;
	readonly edgeKinds?: readonly string[];
	readonly includeSelf?: boolean;
}

export interface DependencyGraphTraversalResult {
	readonly nodes: readonly DependencyGraphNode[];
	readonly edges: readonly DependencyGraphEdge[];
	readonly depth: number;
}

// ---------------------------------------------------------------------------
// Node queries
// ---------------------------------------------------------------------------

export function getNode(
	graph: DocumentDependencyGraph,
	nodeId: DependencyGraphNodeId,
): DependencyGraphNode | undefined {
	return graph.nodeMap.get(nodeId);
}

export function getDocumentNode(
	graph: DocumentDependencyGraph,
	documentId: CanonicalDocumentId,
): DependencyGraphNode | undefined {
	return graph.nodeByDocumentId.get(documentId);
}

export function getPhaseDocuments(
	graph: DocumentDependencyGraph,
	phaseId: PhaseId,
): readonly DependencyGraphNode[] {
	return (graph.nodesByPhaseId.get(phaseId) ?? []).filter(
		(node) => node.kind === 'document',
	);
}

// ---------------------------------------------------------------------------
// Upstream / Downstream
// ---------------------------------------------------------------------------

function traverseDirection(
	graph: DocumentDependencyGraph,
	startNodeId: DependencyGraphNodeId,
	direction: 'upstream' | 'downstream',
	options?: DependencyGraphTraversalOptions,
): DependencyGraphTraversalResult {
	const maxDepth = options?.maxDepth ?? Number.POSITIVE_INFINITY;
	const includeSelf = options?.includeSelf ?? false;
	const allowedKinds =
		options?.edgeKinds !== undefined ? new Set(options.edgeKinds) : undefined;

	const visitedNodes = new Set<DependencyGraphNodeId>();
	const collectedNodes: DependencyGraphNode[] = [];
	const collectedEdges: DependencyGraphEdge[] = [];

	if (includeSelf) {
		const self = graph.nodeMap.get(startNodeId);
		if (self !== undefined) {
			visitedNodes.add(startNodeId);
			collectedNodes.push(self);
		}
	}

	// BFS to avoid infinite loops on cycles
	const queue: Array<{ nodeId: DependencyGraphNodeId; depth: number }> = [
		{ depth: 0, nodeId: startNodeId },
	];

	let maxDepthReached = 0;

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) continue;
		const { nodeId, depth } = current;

		if (depth >= maxDepth) continue;

		const neighborEdges =
			direction === 'upstream'
				? graph.upstreamEdges.get(nodeId)
				: graph.downstreamEdges.get(nodeId);

		if (neighborEdges === undefined) continue;

		for (const edge of neighborEdges) {
			if (allowedKinds !== undefined && !allowedKinds.has(edge.kind)) continue;

			const neighborId =
				direction === 'upstream' ? edge.fromNodeId : edge.toNodeId;

			if (visitedNodes.has(neighborId)) continue;
			visitedNodes.add(neighborId);

			const neighbor = graph.nodeMap.get(neighborId);
			if (neighbor !== undefined) {
				collectedNodes.push(neighbor);
				collectedEdges.push(edge);

				const newDepth = depth + 1;
				if (newDepth > maxDepthReached) maxDepthReached = newDepth;

				if (newDepth < maxDepth) {
					queue.push({ depth: newDepth, nodeId: neighborId });
				}
			}
		}
	}

	return {
		depth: maxDepthReached,
		edges: collectedEdges,
		nodes: collectedNodes,
	};
}

export function getUpstreamNodes(
	graph: DocumentDependencyGraph,
	nodeId: DependencyGraphNodeId,
	options?: DependencyGraphTraversalOptions,
): DependencyGraphTraversalResult {
	return traverseDirection(graph, nodeId, 'upstream', options);
}

export function getDownstreamNodes(
	graph: DocumentDependencyGraph,
	nodeId: DependencyGraphNodeId,
	options?: DependencyGraphTraversalOptions,
): DependencyGraphTraversalResult {
	return traverseDirection(graph, nodeId, 'downstream', options);
}

// ---------------------------------------------------------------------------
// Dependency queries
// ---------------------------------------------------------------------------

export function getDirectDependencies(
	graph: DocumentDependencyGraph,
	documentId: CanonicalDocumentId,
): readonly DependencyGraphNode[] {
	const docNid = `document:${documentId}`;
	const edgeSet = graph.upstreamEdges.get(docNid);
	if (edgeSet === undefined) return [];

	const nodes: DependencyGraphNode[] = [];
	for (const edge of edgeSet) {
		if (edge.kind !== 'depends_on') continue;
		const node = graph.nodeMap.get(edge.fromNodeId);
		if (node !== undefined) {
			nodes.push(node);
		}
	}

	return nodes;
}

export function getDirectDependents(
	graph: DocumentDependencyGraph,
	documentId: CanonicalDocumentId,
): readonly DependencyGraphNode[] {
	const docNid = `document:${documentId}`;
	const edgeSet = graph.downstreamEdges.get(docNid);
	if (edgeSet === undefined) return [];

	const nodes: DependencyGraphNode[] = [];
	for (const edge of edgeSet) {
		if (edge.kind !== 'depends_on') continue;
		const node = graph.nodeMap.get(edge.toNodeId);
		if (node !== undefined) {
			nodes.push(node);
		}
	}

	return nodes;
}

// ---------------------------------------------------------------------------
// Output queries
// ---------------------------------------------------------------------------

export function getOutputsForDocument(
	graph: DocumentDependencyGraph,
	documentId: CanonicalDocumentId,
): readonly DependencyGraphNode[] {
	return graph.outputsByDocumentId.get(documentId) ?? [];
}

export function getCanonicalOutputForDocument(
	graph: DocumentDependencyGraph,
	documentId: CanonicalDocumentId,
): DependencyGraphNode | undefined {
	const outputs = graph.outputsByDocumentId.get(documentId);
	if (outputs === undefined) return undefined;
	return outputs.find((n) => n.kind === 'canonical_output');
}

export function getDerivedArtifactsForDocument(
	graph: DocumentDependencyGraph,
	documentId: CanonicalDocumentId,
): readonly DependencyGraphNode[] {
	const outputs = graph.outputsByDocumentId.get(documentId);
	if (outputs === undefined) return [];
	return outputs.filter((n) => n.kind !== 'canonical_output');
}

// ---------------------------------------------------------------------------
// Executive output queries
// ---------------------------------------------------------------------------

export function getExecutiveOutputs(
	graph: DocumentDependencyGraph,
): readonly DependencyGraphNode[] {
	return graph.nodes.filter(
		(n) =>
			n.kind === 'executive_json' ||
			n.kind === 'executive_markdown' ||
			n.kind === 'executive_html' ||
			n.kind === 'executive_output',
	);
}

// ---------------------------------------------------------------------------
// Topological order (Kahn's algorithm on depends_on edges)
// ---------------------------------------------------------------------------

export function getTopologicalDocumentOrder(
	graph: DocumentDependencyGraph,
): readonly CanonicalDocumentId[] {
	const docNodes = graph.nodes.filter((n) => n.kind === 'document');

	// Build in-degree map for depends_on edges among documents
	const inDegree = new Map<DependencyGraphNodeId, number>();
	const adjacency = new Map<DependencyGraphNodeId, DependencyGraphNodeId[]>();

	for (const node of docNodes) {
		inDegree.set(node.id, 0);
		adjacency.set(node.id, []);
	}

	for (const edge of graph.edges) {
		if (edge.kind !== 'depends_on') continue;
		if (!inDegree.has(edge.fromNodeId)) continue;
		if (!inDegree.has(edge.toNodeId)) continue;

		const list = adjacency.get(edge.fromNodeId);
		if (list !== undefined) {
			list.push(edge.toNodeId);
		}

		inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) ?? 0) + 1);
	}

	// Kahn's algorithm
	const queue: DependencyGraphNodeId[] = [];
	for (const [nid, deg] of inDegree) {
		if (deg === 0) {
			queue.push(nid);
		}
	}

	// Sort queue deterministically by node order index
	queue.sort((a, b) => {
		const na = graph.nodeMap.get(a);
		const nb = graph.nodeMap.get(b);
		return (na?.orderIndex ?? 0) - (nb?.orderIndex ?? 0);
	});

	const result: CanonicalDocumentId[] = [];

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) continue;

		const node = graph.nodeMap.get(current);
		if (node?.documentCanonicalId !== undefined) {
			result.push(node.documentCanonicalId);
		}

		const neighbors = adjacency.get(current) ?? [];
		for (const neighbor of neighbors) {
			const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
			inDegree.set(neighbor, newDeg);
			if (newDeg === 0) {
				queue.push(neighbor);
			}
		}

		// Re-sort
		queue.sort((a, b) => {
			const na = graph.nodeMap.get(a);
			const nb = graph.nodeMap.get(b);
			return (na?.orderIndex ?? 0) - (nb?.orderIndex ?? 0);
		});
	}

	// If there are remaining nodes (cycles), add them by order index
	const remainingCanonicalIds = new Set(
		docNodes
			.filter((n) => !result.includes(n.documentCanonicalId ?? ''))
			.map((n) => n.documentCanonicalId),
	);

	for (const id of remainingCanonicalIds) {
		if (id !== undefined) {
			result.push(id);
		}
	}

	return result;
}
