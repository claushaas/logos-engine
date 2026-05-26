/**
 * Dependency graph — computes node dependency relationships from a LogosProfile.
 *
 * The dependency graph answers:
 * - Which nodes must be completed before this node?
 * - Which nodes are unlocked when this node is accepted?
 * - What is the topological work order?
 * - Are there any circular dependency chains?
 *
 * The state engine uses this graph to determine blocked states,
 * recommend next nodes, and validate prerequisite chains.
 */
import type { LogosProfile, NodeDefinition } from '../contracts/index.js';
import type { NodeId } from '../shared/index.js';

// ─── NodeDependencyGraph ────────────────────────────────────────────────────

/**
 * A computed dependency graph for all nodes in a profile.
 *
 * Returned by `buildDependencyGraph(profile)`.
 * All methods operate on the graph's internal adjacency structures.
 */
export type NodeDependencyGraph = {
	/**
	 * Returns the required dependency node IDs for a given node.
	 *
	 * These are nodes that MUST be accepted before this node can be worked on.
	 */
	getDependencies(nodeId: NodeId): NodeId[];

	/**
	 * Returns the recommended (optional) dependency node IDs for a given node.
	 *
	 * These are nodes that provide better context but are NOT required.
	 * They do NOT affect topological ordering or cycle detection.
	 */
	getRecommendedDependencies(nodeId: NodeId): NodeId[];

	/**
	 * Returns all node IDs that list this node as a required dependency.
	 *
	 * These nodes will be unlocked when this node is accepted.
	 */
	getDependents(nodeId: NodeId): NodeId[];

	/**
	 * Returns all node IDs in topological order.
	 *
	 * A node's required dependencies always appear before it in the order.
	 * Only required dependency edges are considered for ordering.
	 */
	getTopologicalOrder(): NodeId[];

	/**
	 * Detects circular dependency chains in the required dependency graph.
	 *
	 * Returns an array of cycles, where each cycle is an array of node IDs
	 * forming a closed loop (e.g., `[A, B, C, A]`).
	 *
	 * Returns an empty array if no cycles exist.
	 * Only required dependency edges are checked for cycles.
	 */
	detectCycles(): NodeId[][];

	/**
	 * The set of all node IDs in the profile.
	 */
	readonly allNodeIds: Set<NodeId>;
};

// ─── Internal adjacency helpers ─────────────────────────────────────────────

/**
 * Build the required-dependency forward adjacency map.
 *
 * Maps nodeId → set of nodeIds it depends on (required edges only).
 */
function buildRequiredForwardAdj(
	nodes: readonly NodeDefinition[],
): Map<NodeId, Set<NodeId>> {
	const adj = new Map<NodeId, Set<NodeId>>();

	for (const node of nodes) {
		const deps = node.dependencies?.requiredNodeIds ?? [];
		adj.set(node.id, new Set(deps));
	}

	return adj;
}

/**
 * Build the recommended-dependency forward adjacency map.
 *
 * Maps nodeId → set of nodeIds it recommends (optional edges only).
 */
function buildRecommendedForwardAdj(
	nodes: readonly NodeDefinition[],
): Map<NodeId, Set<NodeId>> {
	const adj = new Map<NodeId, Set<NodeId>>();

	for (const node of nodes) {
		const recs = node.dependencies?.recommendedNodeIds ?? [];
		adj.set(node.id, new Set(recs));
	}

	return adj;
}

/**
 * Build the required-dependency reverse adjacency map (dependents).
 *
 * Maps nodeId → set of nodeIds that list it as a required dependency.
 */
function buildRequiredReverseAdj(
	nodes: readonly NodeDefinition[],
): Map<NodeId, Set<NodeId>> {
	const adj = new Map<NodeId, Set<NodeId>>();

	// Initialise empty sets for all nodes.
	for (const node of nodes) {
		adj.set(node.id, new Set());
	}

	// For each node, iterate its required deps and add itself as a dependent.
	for (const node of nodes) {
		const deps = node.dependencies?.requiredNodeIds ?? [];
		for (const dep of deps) {
			const dependents = adj.get(dep);
			if (dependents) {
				dependents.add(node.id);
			}
		}
	}

	return adj;
}

// ─── Topological sort (Kahn's algorithm) ────────────────────────────────────

/**
 * Compute a topological ordering of all nodes by required dependency edges.
 *
 * Returns `{ order, remaining }` where `remaining` contains nodes
 * still in cycles (if any).
 */
function kahnSort(
	nodeIds: readonly NodeId[],
	forwardAdj: Map<NodeId, Set<NodeId>>,
): { order: NodeId[]; remaining: Set<NodeId> } {
	// Compute in-degree for every node.
	const inDegree = new Map<NodeId, number>();
	for (const id of nodeIds) {
		inDegree.set(id, 0);
	}
	for (const id of nodeIds) {
		const deps = forwardAdj.get(id) ?? new Set();
		for (const dep of deps) {
			// Only count edges where the dependency exists in our node set.
			if (inDegree.has(dep)) {
				inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
			}
		}
	}

	// Seed queue with nodes that have in-degree 0.
	const queue: NodeId[] = [];
	for (const [id, deg] of inDegree) {
		if (deg === 0) {
			queue.push(id);
		}
	}

	const order: NodeId[] = [];

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) continue;
		order.push(current);

		// For every node that depends on `current` (i.e., `current` is a REQUIRED dep of `dependent`):
		// We use the forward adjacency (dependent → dep), so we need to find
		// dependents by scanning the forward adjacency.
		for (const [dependent, deps] of forwardAdj) {
			if (deps.has(current)) {
				const newDegree = (inDegree.get(dependent) ?? 0) - 1;
				inDegree.set(dependent, newDegree);
				if (newDegree === 0 && !queue.includes(dependent)) {
					queue.push(dependent);
				}
			}
		}
	}

	// Remaining nodes (in cycles) are those with in-degree > 0.
	const remaining = new Set<NodeId>();
	for (const [id, deg] of inDegree) {
		if (deg > 0) {
			remaining.add(id);
		}
	}

	return { order, remaining };
}

// ─── Cycle detection (DFS) ──────────────────────────────────────────────────

/**
 * Detect all cycles in the required dependency graph using DFS.
 *
 * Each cycle is returned as a path `[start, ..., start]` where the first
 * and last elements are the same node.
 */
function detectCyclesInternal(
	forwardAdj: Map<NodeId, Set<NodeId>>,
): NodeId[][] {
	const cycles: NodeId[][] = [];
	const visited = new Set<NodeId>(); // Fully processed nodes.
	const stack = new Set<NodeId>(); // Nodes currently in the DFS recursion stack.

	function dfs(
		node: NodeId,
		path: NodeId[],
		pathIndex: Map<NodeId, number>,
	): void {
		visited.add(node);
		stack.add(node);
		pathIndex.set(node, path.length);
		path.push(node);

		const deps = forwardAdj.get(node);
		if (deps) {
			for (const dep of deps) {
				if (stack.has(dep)) {
					// Cycle detected: extract the cycle from the path.
					const cycleStartIdx = pathIndex.get(dep);
					if (cycleStartIdx !== undefined) {
						const cycle = [
							...path.slice(cycleStartIdx),
							dep, // close the cycle
						];
						cycles.push(cycle);
					}
				} else if (!visited.has(dep)) {
					dfs(dep, path, pathIndex);
				}
			}
		}

		path.pop();
		pathIndex.delete(node);
		stack.delete(node);
	}

	for (const [node] of forwardAdj) {
		if (!visited.has(node)) {
			dfs(node, [], new Map());
		}
	}

	// Deduplicate cycles (a single SCC may produce multiple rotations).
	return deduplicateCycles(cycles);
}

/**
 * Remove duplicate cycles (rotations and reversals of the same cycle).
 *
 * Two cycles are considered duplicates if they contain the same set of nodes
 * (ignoring the repeated closing node) and the same order up to rotation.
 *
 * We use a canonical form: the smallest node ID becomes the start, and we
 * take both directions, picking the lexicographically smaller rotation.
 */
function deduplicateCycles(cycles: NodeId[][]): NodeId[][] {
	const seen = new Set<string>();
	const result: NodeId[][] = [];

	for (const cycle of cycles) {
		const norm = normalizeCycle(cycle.slice(0, -1)); // Drop the closing duplicate.
		if (!seen.has(norm)) {
			seen.add(norm);
			// Reconstruct the closed cycle.
			const nodes = norm.split(',').filter(Boolean) as NodeId[];
			const first = nodes[0];
			if (first !== undefined) {
				result.push([...nodes, first]);
			}
		}
	}

	return result;
}

/**
 * Normalise a cycle (without the closing duplicate) to a canonical string.
 *
 * Returns the lexicographically smallest rotation as a comma-separated string.
 */
function normalizeCycle(nodes: NodeId[]): string {
	if (nodes.length === 0) return '';

	let best = nodes.join(',');

	for (let i = 1; i < nodes.length; i++) {
		const rotated = [...nodes.slice(i), ...nodes.slice(0, i)].join(',');
		if (rotated < best) {
			best = rotated;
		}
	}

	return best;
}

// ─── buildDependencyGraph ───────────────────────────────────────────────────

/**
 * Build a `NodeDependencyGraph` from a loaded `LogosProfile`.
 *
 * The graph resolves required dependency edges (`NodeDependencyDefinition.requiredNodeIds`)
 * and recommended dependency edges (`NodeDependencyDefinition.recommendedNodeIds`).
 *
 * Required edges drive:
 * - Topological ordering (dependencies before dependents).
 * - Cycle detection.
 * - `getDependencies()` / `getDependents()`.
 *
 * Recommended edges are available via `getRecommendedDependencies()` and
 * do NOT affect ordering or cycle detection.
 *
 * @param profile - A validated `LogosProfile` (from Step 2.1).
 * @returns A `NodeDependencyGraph` with query methods.
 */
export function buildDependencyGraph(
	profile: LogosProfile,
): NodeDependencyGraph {
	const nodes = profile.nodes;
	const nodeIds = nodes.map((n) => n.id);

	const requiredForward = buildRequiredForwardAdj(nodes);
	const recommendedForward = buildRecommendedForwardAdj(nodes);
	const requiredReverse = buildRequiredReverseAdj(nodes);
	const allNodeIds = new Set(nodeIds);

	// ── Cached computations ─────────────────────────────────────────────

	let cachedTopo: { order: NodeId[]; remaining: Set<NodeId> } | null = null;

	function topo(): { order: NodeId[]; remaining: Set<NodeId> } {
		if (cachedTopo === null) {
			cachedTopo = kahnSort(nodeIds, requiredForward);
		}
		return cachedTopo;
	}

	// ── Public API ─────────────────────────────────────────────────────

	return {
		allNodeIds,

		detectCycles(): NodeId[][] {
			// Use DFS for precise cycle chain extraction.
			return detectCyclesInternal(requiredForward);
		},

		getDependencies(nodeId: NodeId): NodeId[] {
			const deps = requiredForward.get(nodeId);
			return deps ? [...deps] : [];
		},

		getDependents(nodeId: NodeId): NodeId[] {
			const deps = requiredReverse.get(nodeId);
			return deps ? [...deps] : [];
		},

		getRecommendedDependencies(nodeId: NodeId): NodeId[] {
			const recs = recommendedForward.get(nodeId);
			return recs ? [...recs] : [];
		},

		getTopologicalOrder(): NodeId[] {
			return [...topo().order];
		},
	};
}
