import type {
	DocumentDescriptorOutputAgentPack,
	DocumentDescriptorOutputArtifact,
	DocumentDescriptorOutputCanonical,
	DocumentDescriptorOutputData,
	DocumentDescriptorOutputExecutive,
} from './document-descriptor.js';
import type {
	CanonicalDocumentId,
	DocumentationContract,
	LoadedDocumentDescriptor,
} from './documentation-contract.js';
import type { ProfileStatusWorkflow } from './profile-registry.js';

// ---------------------------------------------------------------------------
// Status workflow
// ---------------------------------------------------------------------------

export type StatusValue = string;

export interface StatusTransition {
	from: StatusValue;
	to: StatusValue;
}

export interface StatusTransitionResult {
	allowed: boolean;
	reason?: string;
}

/**
 * Normalized status workflow derived from the profile registry.
 *
 * Assumption: when the registry defines explicit transitions, they are enforced.
 * When no explicit transitions are defined for a status, the conservative fallback
 * permits transitions from any allowed status to any other allowed status, except
 * that transitions *from* terminal statuses are disallowed unless explicitly listed.
 * This fallback is documented here and in the implementation report.
 */
export interface StatusWorkflow {
	allowedStatuses: ReadonlySet<StatusValue>;
	terminalStatuses: ReadonlySet<StatusValue>;
	transitions: ReadonlyMap<StatusValue, ReadonlySet<StatusValue>>;
}

// ---------------------------------------------------------------------------
// Output declarations
// ---------------------------------------------------------------------------

export type OutputDeclarationKind =
	| 'canonical'
	| 'artifact'
	| 'agentPack'
	| 'data'
	| 'executive';

export type OutputDeclarationRole = string;

export interface BaseOutputDeclaration {
	kind: OutputDeclarationKind;
	documentCanonicalId: CanonicalDocumentId;
	phaseId: string;
	sourcePath: string;
	fieldPath: string;
	outputId: string | undefined;
	format: string;
	path: string;
	purpose: string | undefined;
	role: OutputDeclarationRole | undefined;
	isCanonical: boolean;
	raw: Record<string, unknown>;
}

export interface CanonicalOutputDeclaration extends BaseOutputDeclaration {
	kind: 'canonical';
}

export interface ArtifactOutputDeclaration extends BaseOutputDeclaration {
	kind: 'artifact';
	audience: string | undefined;
	includes: string[] | undefined;
	generationMode: string | undefined;
}

export interface AgentPackOutputDeclaration extends BaseOutputDeclaration {
	kind: 'agentPack';
	agentRole: string | undefined;
	includes: string[] | undefined;
	constraints: string[] | undefined;
}

export interface DataOutputDeclaration extends BaseOutputDeclaration {
	kind: 'data';
	schemaRef: string | undefined;
}

export interface ExecutiveOutputDeclaration extends BaseOutputDeclaration {
	kind: 'executive';
	schemaRef: string | undefined;
}

export type OutputDeclaration =
	| CanonicalOutputDeclaration
	| ArtifactOutputDeclaration
	| AgentPackOutputDeclaration
	| DataOutputDeclaration
	| ExecutiveOutputDeclaration;

// ---------------------------------------------------------------------------
// Dependency references
// ---------------------------------------------------------------------------

export type DependencyReferenceKind = 'dependsOn' | 'feeds';
export type DependencyTargetKind = 'document' | 'output';

export interface DependencyReference {
	kind: DependencyReferenceKind;
	sourceDocumentCanonicalId: CanonicalDocumentId;
	targetDocumentId: string;
	/** Resolved canonical ID if the target is a document in the contract. */
	targetDocumentCanonicalId: CanonicalDocumentId | undefined;
	/** Resolved output declaration if the target is a declared output. */
	targetOutputId: string | undefined;
	targetOutputPath: string | undefined;
	targetKind: DependencyTargetKind | undefined;
	sourcePath: string;
	fieldPath: string;
	raw: unknown;
}

// ---------------------------------------------------------------------------
// Graph primitives
// ---------------------------------------------------------------------------

export interface ContractGraphDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	path: string;
	fieldPath: string | undefined;
	expected?: string | undefined;
	received?: string | undefined;
	/** Present for circular-dependency diagnostics. */
	cyclePath?: string[];
	/** Present for circular-dependency diagnostics. */
	sourcePaths?: string[];
	/** Present for circular-dependency diagnostics. */
	recoveryHint?: string;
}

export interface ContractGraphNode {
	document: LoadedDocumentDescriptor;
	statusValid: boolean;
	statusDiagnostics: ContractGraphDiagnostic[];
}

export interface ContractGraphEdge {
	sourceCanonicalId: CanonicalDocumentId;
	targetCanonicalId: CanonicalDocumentId;
	kind: DependencyReferenceKind;
}

export interface ContractGraph {
	nodes: ContractGraphNode[];
	edges: ContractGraphEdge[];
	outputs: OutputDeclaration[];
	dependencies: DependencyReference[];
	statusWorkflow: StatusWorkflow;
	diagnostics: ContractGraphDiagnostic[];

	/** Query helper: get node by canonical document ID. */
	getNodeByCanonicalId(
		canonicalId: CanonicalDocumentId,
	): ContractGraphNode | undefined;
	/** Query helper: get outputs owned by a document. */
	getOutputsByDocumentId(canonicalId: CanonicalDocumentId): OutputDeclaration[];
	/** Query helper: get outgoing dependencies from a document. */
	getDependenciesBySourceDocumentId(
		canonicalId: CanonicalDocumentId,
	): DependencyReference[];
	/** Query helper: get incoming dependencies to a document. */
	getDependentsByTargetDocumentId(
		canonicalId: CanonicalDocumentId,
	): DependencyReference[];
}

export type BuildContractGraphOptions = Record<string, never>;

export interface BuildContractGraphResult {
	graph: ContractGraph;
	diagnostics: ContractGraphDiagnostic[];
}

// ---------------------------------------------------------------------------
// Status workflow helpers
// ---------------------------------------------------------------------------

export function buildStatusWorkflow(
	profileWorkflow: ProfileStatusWorkflow,
): StatusWorkflow {
	const allowedStatuses = new Set<string>(profileWorkflow.allowed);
	const terminalStatuses = new Set<string>(profileWorkflow.terminal);
	const transitions = new Map<string, Set<string>>();

	for (const [from, tos] of Object.entries(profileWorkflow.transitions)) {
		transitions.set(from, new Set(tos));
	}

	return {
		allowedStatuses,
		terminalStatuses,
		transitions,
	};
}

/**
 * Determine whether a status transition is permitted by the workflow.
 *
 * Rules (in order of precedence):
 * 1. If `fromStatus` is not in `allowedStatuses`, transition is disallowed.
 * 2. If `toStatus` is not in `allowedStatuses`, transition is disallowed.
 * 3. If `fromStatus` equals `toStatus`, transition is allowed (idempotent).
 * 4. If explicit transitions exist for `fromStatus`:
 *    - `toStatus` must be listed in those transitions.
 * 5. If no explicit transitions exist for `fromStatus` (conservative fallback):
 *    - `fromStatus` is terminal → disallowed (terminal statuses should not transition).
 *    - Otherwise → allowed to any other allowed status.
 */
export function canTransitionStatus(
	workflow: StatusWorkflow,
	fromStatus: StatusValue,
	toStatus: StatusValue,
): StatusTransitionResult {
	if (!workflow.allowedStatuses.has(fromStatus)) {
		return {
			allowed: false,
			reason: `Source status "${fromStatus}" is not in the allowed status list`,
		};
	}

	if (!workflow.allowedStatuses.has(toStatus)) {
		return {
			allowed: false,
			reason: `Target status "${toStatus}" is not in the allowed status list`,
		};
	}

	if (fromStatus === toStatus) {
		return { allowed: true };
	}

	const explicitTargets = workflow.transitions.get(fromStatus);
	if (explicitTargets !== undefined) {
		if (explicitTargets.has(toStatus)) {
			return { allowed: true };
		}
		return {
			allowed: false,
			reason: `Transition from "${fromStatus}" to "${toStatus}" is not explicitly allowed in the status workflow`,
		};
	}

	// Conservative fallback: no explicit transitions defined for this status.
	if (workflow.terminalStatuses.has(fromStatus)) {
		return {
			allowed: false,
			reason: `Source status "${fromStatus}" is terminal and no explicit transitions are defined`,
		};
	}

	return { allowed: true };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: ContractGraphDiagnostic['severity'],
	message: string,
	path: string,
	fieldPath: string | undefined,
	expected?: string,
	received?: string,
): ContractGraphDiagnostic {
	return { code, expected, fieldPath, message, path, received, severity };
}

// ---------------------------------------------------------------------------
// Output normalization
// ---------------------------------------------------------------------------

function normalizeCanonicalOutput(
	doc: LoadedDocumentDescriptor,
	canonical: DocumentDescriptorOutputCanonical,
): CanonicalOutputDeclaration {
	return {
		documentCanonicalId: doc.canonicalId,
		fieldPath: 'outputs.canonical',
		format: canonical.format,
		isCanonical: true,
		kind: 'canonical',
		outputId: undefined,
		path: canonical.path,
		phaseId: doc.phaseId,
		purpose: canonical.purpose,
		raw: canonical as unknown as Record<string, unknown>,
		role: 'canonical',
		sourcePath: doc.sourcePath,
	};
}

function normalizeArtifactOutput(
	doc: LoadedDocumentDescriptor,
	artifact: DocumentDescriptorOutputArtifact,
	index: number,
): ArtifactOutputDeclaration {
	return {
		audience: artifact.audience,
		documentCanonicalId: doc.canonicalId,
		fieldPath: `outputs.artifacts[${index}]`,
		format: artifact.format,
		generationMode: artifact.generationMode,
		includes: artifact.includes,
		isCanonical: false,
		kind: 'artifact',
		outputId: artifact.id,
		path: artifact.path,
		phaseId: doc.phaseId,
		purpose: artifact.purpose,
		raw: artifact as unknown as Record<string, unknown>,
		role: 'presentation',
		sourcePath: doc.sourcePath,
	};
}

function normalizeAgentPackOutput(
	doc: LoadedDocumentDescriptor,
	agentPack: DocumentDescriptorOutputAgentPack,
	index: number,
): AgentPackOutputDeclaration {
	return {
		agentRole: agentPack.agentRole,
		constraints: agentPack.constraints,
		documentCanonicalId: doc.canonicalId,
		fieldPath: `outputs.agentPacks[${index}]`,
		format: agentPack.format,
		includes: agentPack.includes,
		isCanonical: false,
		kind: 'agentPack',
		outputId: agentPack.id,
		path: agentPack.path,
		phaseId: doc.phaseId,
		purpose: agentPack.purpose,
		raw: agentPack as unknown as Record<string, unknown>,
		role: 'agentPack',
		sourcePath: doc.sourcePath,
	};
}

function normalizeDataOutput(
	doc: LoadedDocumentDescriptor,
	data: DocumentDescriptorOutputData,
	index: number,
): DataOutputDeclaration {
	return {
		documentCanonicalId: doc.canonicalId,
		fieldPath: `outputs.data[${index}]`,
		format: data.format,
		isCanonical: false,
		kind: 'data',
		outputId: data.id,
		path: data.path,
		phaseId: doc.phaseId,
		purpose: data.purpose,
		raw: data as unknown as Record<string, unknown>,
		role: 'data',
		schemaRef: data.schemaRef,
		sourcePath: doc.sourcePath,
	};
}

function normalizeExecutiveOutput(
	doc: LoadedDocumentDescriptor,
	executive: DocumentDescriptorOutputExecutive,
	index: number,
): ExecutiveOutputDeclaration {
	return {
		documentCanonicalId: doc.canonicalId,
		fieldPath: `outputs.executive[${index}]`,
		format: executive.format,
		isCanonical: false,
		kind: 'executive',
		outputId: executive.id,
		path: executive.path,
		phaseId: doc.phaseId,
		purpose: executive.purpose,
		raw: executive as unknown as Record<string, unknown>,
		role: executive.role ?? 'executive',
		schemaRef: executive.schemaRef,
		sourcePath: doc.sourcePath,
	};
}

function normalizeDocumentOutputs(
	doc: LoadedDocumentDescriptor,
	_diagnostics: ContractGraphDiagnostic[],
): OutputDeclaration[] {
	const outputs: OutputDeclaration[] = [];
	const descriptorOutputs = doc.descriptor.outputs;

	// Canonical output is required by the schema.
	if (descriptorOutputs.canonical !== undefined) {
		outputs.push(normalizeCanonicalOutput(doc, descriptorOutputs.canonical));
	}

	if (Array.isArray(descriptorOutputs.artifacts)) {
		for (let i = 0; i < descriptorOutputs.artifacts.length; i++) {
			const artifact = descriptorOutputs.artifacts[i];
			if (artifact !== undefined) {
				outputs.push(normalizeArtifactOutput(doc, artifact, i));
			}
		}
	}

	if (Array.isArray(descriptorOutputs.agentPacks)) {
		for (let i = 0; i < descriptorOutputs.agentPacks.length; i++) {
			const agentPack = descriptorOutputs.agentPacks[i];
			if (agentPack !== undefined) {
				outputs.push(normalizeAgentPackOutput(doc, agentPack, i));
			}
		}
	}

	if (Array.isArray(descriptorOutputs.data)) {
		for (let i = 0; i < descriptorOutputs.data.length; i++) {
			const data = descriptorOutputs.data[i];
			if (data !== undefined) {
				outputs.push(normalizeDataOutput(doc, data, i));
			}
		}
	}

	if (Array.isArray(descriptorOutputs.executive)) {
		for (let i = 0; i < descriptorOutputs.executive.length; i++) {
			const executive = descriptorOutputs.executive[i];
			if (executive !== undefined) {
				outputs.push(normalizeExecutiveOutput(doc, executive, i));
			}
		}
	}

	return outputs;
}

// ---------------------------------------------------------------------------
// Dependency normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw dependency target string into a canonical document ID.
 *
 * The Standard profile uses `<phase>/<document-id>` notation in dependsOn/feeds.
 * We first try the raw value as-is, then fall back to the segment after the last slash.
 */
interface ResolvedReferenceTarget {
	targetDocumentCanonicalId: CanonicalDocumentId | undefined;
	targetOutputId: string | undefined;
	targetOutputPath: string | undefined;
	targetKind: DependencyTargetKind | undefined;
}

function resolveDependencyTarget(
	rawTarget: string,
	knownIds: ReadonlySet<CanonicalDocumentId>,
	knownOutputs: ReadonlyMap<string, OutputDeclaration>,
	kind: DependencyReferenceKind,
): ResolvedReferenceTarget {
	const trimmed = rawTarget.trim();
	if (trimmed.length === 0) {
		return {
			targetDocumentCanonicalId: undefined,
			targetKind: undefined,
			targetOutputId: undefined,
			targetOutputPath: undefined,
		};
	}

	if (knownIds.has(trimmed)) {
		return {
			targetDocumentCanonicalId: trimmed,
			targetKind: 'document',
			targetOutputId: undefined,
			targetOutputPath: undefined,
		};
	}

	const lastSlash = trimmed.lastIndexOf('/');
	if (lastSlash >= 0) {
		const candidate = trimmed.slice(lastSlash + 1);
		if (knownIds.has(candidate)) {
			return {
				targetDocumentCanonicalId: candidate,
				targetKind: 'document',
				targetOutputId: undefined,
				targetOutputPath: undefined,
			};
		}
	}

	if (kind === 'feeds') {
		const output = knownOutputs.get(trimmed);
		if (output !== undefined) {
			return {
				targetDocumentCanonicalId: undefined,
				targetKind: 'output',
				targetOutputId: output.outputId,
				targetOutputPath: output.path,
			};
		}
	}

	return {
		targetDocumentCanonicalId: undefined,
		targetKind: undefined,
		targetOutputId: undefined,
		targetOutputPath: undefined,
	};
}

function normalizeDocumentDependencies(
	doc: LoadedDocumentDescriptor,
	knownIds: ReadonlySet<CanonicalDocumentId>,
	knownOutputs: ReadonlyMap<string, OutputDeclaration>,
	diagnostics: ContractGraphDiagnostic[],
): DependencyReference[] {
	const refs: DependencyReference[] = [];

	function addRefs(
		rawValues: string[] | undefined,
		kind: DependencyReferenceKind,
		fieldPrefix: string,
	): void {
		if (!Array.isArray(rawValues)) return;

		for (let i = 0; i < rawValues.length; i++) {
			const raw = rawValues[i];
			if (typeof raw !== 'string') continue;

			const resolved = resolveDependencyTarget(
				raw,
				knownIds,
				knownOutputs,
				kind,
			);
			const fieldPath = `${fieldPrefix}[${i}]`;

			if (resolved.targetKind === undefined) {
				diagnostics.push(
					createDiagnostic(
						'E_GRAPH_UNKNOWN_DEPENDENCY_TARGET',
						'error',
						`Dependency target "${raw}" does not resolve to a known document in the contract`,
						doc.sourcePath,
						fieldPath,
						kind === 'feeds'
							? 'known canonical document ID or output id/path'
							: 'known canonical document ID',
						raw,
					),
				);
			}

			refs.push({
				fieldPath,
				kind,
				raw,
				sourceDocumentCanonicalId: doc.canonicalId,
				sourcePath: doc.sourcePath,
				targetDocumentCanonicalId: resolved.targetDocumentCanonicalId,
				targetDocumentId: raw,
				targetKind: resolved.targetKind,
				targetOutputId: resolved.targetOutputId,
				targetOutputPath: resolved.targetOutputPath,
			});
		}
	}

	addRefs(doc.descriptor.dependsOn, 'dependsOn', 'dependsOn');
	addRefs(doc.descriptor.feeds, 'feeds', 'feeds');

	return refs;
}

// ---------------------------------------------------------------------------
// Circular dependency detection
// ---------------------------------------------------------------------------

/**
 * Detect cycles in the dependency graph using DFS.
 *
 * Only `dependsOn` edges are checked for cycles. `feeds` edges express the same
 * relationships in reverse and are excluded to avoid redundant / false-positive
 * cycle detection.
 *
 * Unknown dependency targets are skipped during cycle detection so that unresolved
 * nodes do not produce misleading cycle diagnostics.
 */
function detectCircularDependencies(
	nodes: ContractGraphNode[],
	dependencies: DependencyReference[],
): ContractGraphDiagnostic[] {
	const diagnostics: ContractGraphDiagnostic[] = [];

	// Build adjacency list for dependsOn edges with resolved targets only.
	const adjacency = new Map<CanonicalDocumentId, CanonicalDocumentId[]>();
	for (const node of nodes) {
		adjacency.set(node.document.canonicalId, []);
	}

	for (const dep of dependencies) {
		if (dep.kind !== 'dependsOn') continue;
		if (dep.targetDocumentCanonicalId === undefined) continue;
		const list = adjacency.get(dep.sourceDocumentCanonicalId);
		if (list !== undefined) {
			list.push(dep.targetDocumentCanonicalId);
		}
	}

	const visited = new Set<CanonicalDocumentId>();
	const inStack = new Set<CanonicalDocumentId>();
	// Track the full DFS path so we can reconstruct cycles.
	const path: CanonicalDocumentId[] = [];
	// Keep track of which nodes have been reported in a cycle to avoid duplicate reports.
	const reportedCycles = new Set<string>();

	function dfs(nodeId: CanonicalDocumentId): void {
		visited.add(nodeId);
		inStack.add(nodeId);
		path.push(nodeId);

		const neighbors = adjacency.get(nodeId) ?? [];
		for (const neighbor of neighbors) {
			if (!visited.has(neighbor)) {
				dfs(neighbor);
			} else if (inStack.has(neighbor)) {
				// Found a cycle. Reconstruct it.
				const cycleStart = path.indexOf(neighbor);
				if (cycleStart < 0) continue;

				const cyclePath = path.slice(cycleStart).concat([neighbor]);
				const cycleKey = cyclePath.join('->');
				if (reportedCycles.has(cycleKey)) continue;
				reportedCycles.add(cycleKey);

				// Collect source paths involved in the cycle.
				const sourcePaths: string[] = [];
				for (const id of cyclePath.slice(0, -1)) {
					const n = nodes.find((n) => n.document.canonicalId === id);
					if (n !== undefined) {
						sourcePaths.push(n.document.sourcePath);
					}
				}

				diagnostics.push({
					code: 'E_GRAPH_CIRCULAR_DEPENDENCY',
					cyclePath,
					expected: 'acyclic dependency graph',
					fieldPath: 'dependsOn',
					message: `Circular dependency detected: ${cyclePath.join(' → ')}`,
					path: sourcePaths[0] ?? '<unknown>',
					recoveryHint:
						'Remove or restructure the dependency chain so that no document transitively depends on itself.',
					severity: 'error',
					sourcePaths,
				});
			}
		}

		path.pop();
		inStack.delete(nodeId);
	}

	for (const node of nodes) {
		if (!visited.has(node.document.canonicalId)) {
			dfs(node.document.canonicalId);
		}
	}

	return diagnostics;
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export function buildContractGraph(
	contract: DocumentationContract,
	_options?: BuildContractGraphOptions,
): BuildContractGraphResult {
	const diagnostics: ContractGraphDiagnostic[] = [];

	// Build status workflow from registry.
	const statusWorkflow = buildStatusWorkflow(contract.statusWorkflow);

	// Pre-compute known canonical IDs for dependency resolution.
	const knownIds = new Set<CanonicalDocumentId>();
	for (const doc of contract.documents) {
		knownIds.add(doc.canonicalId);
	}

	// Build nodes with status validation.
	const nodes: ContractGraphNode[] = [];
	for (const doc of contract.documents) {
		const status = doc.descriptor.status;
		const statusDiagnostics: ContractGraphDiagnostic[] = [];
		let statusValid = true;

		if (!statusWorkflow.allowedStatuses.has(status)) {
			statusValid = false;
			statusDiagnostics.push(
				createDiagnostic(
					'E_GRAPH_INVALID_STATUS',
					'error',
					`Document status "${status}" is not in the allowed status list`,
					doc.sourcePath,
					'status',
					Array.from(statusWorkflow.allowedStatuses).join(', '),
					status,
				),
			);
		}

		nodes.push({
			document: doc,
			statusDiagnostics,
			statusValid,
		});
	}

	// Collect all diagnostics from nodes.
	for (const node of nodes) {
		diagnostics.push(...node.statusDiagnostics);
	}

	// Normalize outputs (deterministic: document order, then descriptor field order).
	const outputs: OutputDeclaration[] = [];
	for (const node of nodes) {
		const docOutputs = normalizeDocumentOutputs(node.document, diagnostics);
		outputs.push(...docOutputs);
	}

	const knownOutputs = new Map<string, OutputDeclaration>();
	for (const output of outputs) {
		if (output.outputId !== undefined) {
			knownOutputs.set(output.outputId, output);
		}
		knownOutputs.set(output.path, output);
	}

	// Normalize dependencies (deterministic: document order, then field order).
	const dependencies: DependencyReference[] = [];
	for (const node of nodes) {
		const docDeps = normalizeDocumentDependencies(
			node.document,
			knownIds,
			knownOutputs,
			diagnostics,
		);
		dependencies.push(...docDeps);
	}

	// Build edges from resolved dependsOn references.
	const edges: ContractGraphEdge[] = [];
	for (const dep of dependencies) {
		if (dep.targetDocumentCanonicalId !== undefined) {
			edges.push({
				kind: dep.kind,
				sourceCanonicalId: dep.sourceDocumentCanonicalId,
				targetCanonicalId: dep.targetDocumentCanonicalId,
			});
		}
	}

	// Detect circular dependencies.
	const circularDiagnostics = detectCircularDependencies(nodes, dependencies);
	diagnostics.push(...circularDiagnostics);

	// Build lookup maps for query helpers.
	const nodeById = new Map<CanonicalDocumentId, ContractGraphNode>();
	const outputsByDocId = new Map<CanonicalDocumentId, OutputDeclaration[]>();
	const depsBySource = new Map<CanonicalDocumentId, DependencyReference[]>();
	const depsByTarget = new Map<CanonicalDocumentId, DependencyReference[]>();

	for (const node of nodes) {
		nodeById.set(node.document.canonicalId, node);
	}

	for (const output of outputs) {
		const list = outputsByDocId.get(output.documentCanonicalId);
		if (list !== undefined) {
			list.push(output);
		} else {
			outputsByDocId.set(output.documentCanonicalId, [output]);
		}
	}

	for (const dep of dependencies) {
		const sourceList = depsBySource.get(dep.sourceDocumentCanonicalId);
		if (sourceList !== undefined) {
			sourceList.push(dep);
		} else {
			depsBySource.set(dep.sourceDocumentCanonicalId, [dep]);
		}

		if (dep.targetDocumentCanonicalId !== undefined) {
			const targetList = depsByTarget.get(dep.targetDocumentCanonicalId);
			if (targetList !== undefined) {
				targetList.push(dep);
			} else {
				depsByTarget.set(dep.targetDocumentCanonicalId, [dep]);
			}
		}
	}

	const graph: ContractGraph = {
		dependencies,
		diagnostics,
		edges,

		getDependenciesBySourceDocumentId(
			canonicalId: CanonicalDocumentId,
		): DependencyReference[] {
			return depsBySource.get(canonicalId) ?? [];
		},

		getDependentsByTargetDocumentId(
			canonicalId: CanonicalDocumentId,
		): DependencyReference[] {
			return depsByTarget.get(canonicalId) ?? [];
		},

		getNodeByCanonicalId(
			canonicalId: CanonicalDocumentId,
		): ContractGraphNode | undefined {
			return nodeById.get(canonicalId);
		},

		getOutputsByDocumentId(
			canonicalId: CanonicalDocumentId,
		): OutputDeclaration[] {
			return outputsByDocId.get(canonicalId) ?? [];
		},
		nodes,
		outputs,
		statusWorkflow,
	};

	return { diagnostics, graph };
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ContractGraphError extends Error {
	diagnostics: ContractGraphDiagnostic[];

	constructor(diagnostics: ContractGraphDiagnostic[]) {
		super(diagnostics.map((d) => d.message).join('; '));
		this.diagnostics = diagnostics;
		this.name = 'ContractGraphError';
	}
}
