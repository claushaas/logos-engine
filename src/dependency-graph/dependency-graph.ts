import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import type {
	ContractGraph,
	OutputDeclaration,
} from '../profiles/contract-graph.js';
import { buildContractGraph } from '../profiles/contract-graph.js';
import type {
	CanonicalDocumentId,
	DocumentationContract,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { ProfileRegistry } from '../profiles/profile-registry.js';

// ---------------------------------------------------------------------------
// Node identity and kinds
// ---------------------------------------------------------------------------

export type DependencyGraphNodeId = string;

export type DependencyGraphNodeKind =
	| 'phase'
	| 'document'
	| 'canonical_output'
	| 'html_artifact'
	| 'agent_pack'
	| 'data_artifact'
	| 'report_artifact'
	| 'executive_output'
	| 'executive_json'
	| 'executive_markdown'
	| 'executive_html'
	| 'external_reference';

export interface DependencyGraphNode {
	readonly id: DependencyGraphNodeId;
	readonly kind: DependencyGraphNodeKind;
	readonly label: string;
	readonly title: string;
	readonly profileId: string;
	readonly phaseId: PhaseId | undefined;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly sourcePath: string | undefined;
	readonly fieldPath: string | undefined;
	readonly outputType: string | undefined;
	readonly outputRole: string | undefined;
	readonly outputTargetPath: string | undefined;
	readonly isCanonical: boolean | undefined;
	readonly sourceDeclarationKind: string;
	readonly orderIndex: number;
}

// ---------------------------------------------------------------------------
// Edge identity and kinds
// ---------------------------------------------------------------------------

export type DependencyGraphEdgeId = string;

export type DependencyGraphEdgeKind =
	| 'contains'
	| 'depends_on'
	| 'feeds'
	| 'input_to'
	| 'outputs_to'
	| 'derived_from'
	| 'executive_depends_on'
	| 'mapping_outputs_to'
	| 'references'
	| 'unknown';

export interface DependencyGraphEdge {
	readonly id: DependencyGraphEdgeId;
	readonly kind: DependencyGraphEdgeKind;
	readonly fromNodeId: DependencyGraphNodeId;
	readonly toNodeId: DependencyGraphNodeId;
	readonly sourceDeclarationKind: string;
	readonly sourcePath: string | undefined;
	readonly fieldPath: string | undefined;
	readonly required: boolean | undefined;
	readonly orderIndex: number;
	readonly recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostics and Cycle types
// ---------------------------------------------------------------------------

export interface DependencyGraphCycle {
	readonly id: string;
	readonly nodeIds: readonly DependencyGraphNodeId[];
	readonly edgeIds: readonly DependencyGraphEdgeId[];
	readonly sourcePaths: readonly string[];
	readonly severity: 'error' | 'warning';
}

export interface DependencyGraphUnresolvedReference {
	readonly code: string;
	readonly severity: 'error' | 'warning' | 'info';
	readonly message: string;
	readonly sourcePath: string | undefined;
	readonly fieldPath: string | undefined;
	readonly referenceValue: string;
	readonly referenceKind: string;
	readonly recoveryHint: string | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly nodeId: DependencyGraphNodeId | undefined;
	readonly edgeId: DependencyGraphEdgeId | undefined;
}

export interface DependencyGraphDiagnostic {
	readonly code: string;
	readonly severity: 'error' | 'warning' | 'info';
	readonly message: string;
	readonly sourcePath: string | undefined;
	readonly fieldPath: string | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly nodeId: DependencyGraphNodeId | undefined;
	readonly edgeId: DependencyGraphEdgeId | undefined;
	readonly expected: string | undefined;
	readonly received: string | undefined;
	readonly recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Graph structure
// ---------------------------------------------------------------------------

export interface DocumentDependencyGraph {
	readonly profileId: string;
	readonly nodes: readonly DependencyGraphNode[];
	readonly edges: readonly DependencyGraphEdge[];
	readonly cycles: readonly DependencyGraphCycle[];
	readonly unresolvedReferences: readonly DependencyGraphUnresolvedReference[];
	readonly diagnostics: readonly DependencyGraphDiagnostic[];

	readonly nodeMap: ReadonlyMap<DependencyGraphNodeId, DependencyGraphNode>;
	readonly edgeMap: ReadonlyMap<DependencyGraphEdgeId, DependencyGraphEdge>;
	readonly nodeByDocumentId: ReadonlyMap<
		CanonicalDocumentId,
		DependencyGraphNode
	>;
	readonly nodesByPhaseId: ReadonlyMap<PhaseId, readonly DependencyGraphNode[]>;
	readonly outputsByDocumentId: ReadonlyMap<
		CanonicalDocumentId,
		readonly DependencyGraphNode[]
	>;
	readonly upstreamEdges: ReadonlyMap<
		DependencyGraphNodeId,
		readonly DependencyGraphEdge[]
	>;
	readonly downstreamEdges: ReadonlyMap<
		DependencyGraphNodeId,
		readonly DependencyGraphEdge[]
	>;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface DependencyGraphSummary {
	readonly profileId: string;
	readonly phaseCount: number;
	readonly documentCount: number;
	readonly outputCountByKind: Record<DependencyGraphNodeKind, number>;
	readonly edgeCountByKind: Record<DependencyGraphEdgeKind, number>;
	readonly unresolvedReferenceCount: number;
	readonly cycleCount: number;
	readonly canonicalOutputCount: number;
	readonly derivedArtifactCount: number;
	readonly executiveOutputCount: number;
	readonly diagnosticCountBySeverity: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Build input / options / result
// ---------------------------------------------------------------------------

export interface ExecutiveGenerationConfig {
	readonly sourcePath: string;
	readonly outputs: ExecutiveCfgOutput[];
	readonly exportTargets: ExecutiveCfgExportTarget[];
	readonly raw: Record<string, unknown>;
}

export interface ExecutiveCfgOutput {
	readonly format: string;
	readonly path: string;
	readonly kind: 'executive_json';
}

export interface ExecutiveCfgExportTarget {
	readonly id: string;
	readonly format: string;
	readonly path: string;
	readonly kind:
		| 'executive_markdown'
		| 'executive_html'
		| 'agent_pack'
		| 'external_reference';
	readonly adapter: string;
	readonly status: string;
}

export interface DependencyGraphBuildInput {
	readonly registry: ProfileRegistry;
	readonly contract: DocumentationContract;
	readonly contractGraph?: ContractGraph;
	readonly executiveConfig?: ExecutiveGenerationConfig;
}

export interface DependencyGraphBuildOptions {
	readonly optionalRefSeverity?: 'warning' | 'info' | 'diagnostic';
}

export interface DependencyGraphBuildResult {
	readonly graph: DocumentDependencyGraph;
	readonly diagnostics: readonly DependencyGraphDiagnostic[];
}

// ---------------------------------------------------------------------------
// Internal builders (mutable state during construction)
// ---------------------------------------------------------------------------

interface MutableGraph {
	nodes: DependencyGraphNode[];
	edges: DependencyGraphEdge[];
	cycles: DependencyGraphCycle[];
	unresolvedReferences: DependencyGraphUnresolvedReference[];
	diagnostics: DependencyGraphDiagnostic[];
	nodeMap: Map<DependencyGraphNodeId, DependencyGraphNode>;
	edgeMap: Map<DependencyGraphEdgeId, DependencyGraphEdge>;
	nodeByDocumentId: Map<CanonicalDocumentId, DependencyGraphNode>;
	nodesByPhaseId: Map<PhaseId, DependencyGraphNode[]>;
	outputsByDocumentId: Map<CanonicalDocumentId, DependencyGraphNode[]>;
	upstreamEdges: Map<DependencyGraphNodeId, DependencyGraphEdge[]>;
	downstreamEdges: Map<DependencyGraphNodeId, DependencyGraphEdge[]>;
	edgeCount: number;
	nodeCount: number;
}

function createMutableGraph(): MutableGraph {
	return {
		cycles: [],
		diagnostics: [],
		downstreamEdges: new Map(),
		edgeCount: 0,
		edgeMap: new Map(),
		edges: [],
		nodeByDocumentId: new Map(),
		nodeCount: 0,
		nodeMap: new Map(),
		nodes: [],
		nodesByPhaseId: new Map(),
		outputsByDocumentId: new Map(),
		unresolvedReferences: [],
		upstreamEdges: new Map(),
	};
}

function addNode(mg: MutableGraph, node: DependencyGraphNode): void {
	mg.nodes.push(node);
	mg.nodeMap.set(node.id, node);
	mg.nodeCount++;

	if (node.kind === 'document' && node.documentCanonicalId !== undefined) {
		mg.nodeByDocumentId.set(node.documentCanonicalId, node);
	}

	if (node.phaseId !== undefined) {
		const list = mg.nodesByPhaseId.get(node.phaseId);
		if (list !== undefined) {
			list.push(node);
		} else {
			mg.nodesByPhaseId.set(node.phaseId, [node]);
		}
	}

	if (
		node.documentCanonicalId !== undefined &&
		(node.kind === 'canonical_output' ||
			node.kind === 'html_artifact' ||
			node.kind === 'agent_pack' ||
			node.kind === 'data_artifact' ||
			node.kind === 'report_artifact' ||
			node.kind === 'executive_output' ||
			node.kind === 'executive_json' ||
			node.kind === 'executive_markdown' ||
			node.kind === 'executive_html')
	) {
		const list = mg.outputsByDocumentId.get(node.documentCanonicalId);
		if (list !== undefined) {
			list.push(node);
		} else {
			mg.outputsByDocumentId.set(node.documentCanonicalId, [node]);
		}
	}
}

function addEdge(mg: MutableGraph, edge: DependencyGraphEdge): void {
	mg.edges.push(edge);
	mg.edgeMap.set(edge.id, edge);
	mg.edgeCount++;

	const upList = mg.upstreamEdges.get(edge.toNodeId);
	if (upList !== undefined) {
		upList.push(edge);
	} else {
		mg.upstreamEdges.set(edge.toNodeId, [edge]);
	}

	const downList = mg.downstreamEdges.get(edge.fromNodeId);
	if (downList !== undefined) {
		downList.push(edge);
	} else {
		mg.downstreamEdges.set(edge.fromNodeId, [edge]);
	}
}

function nextEdgeId(mg: MutableGraph, prefix: string): string {
	mg.edgeCount++;
	return `${prefix}_${mg.edgeCount}`;
}

function addDiagnostic(
	mg: MutableGraph,
	diag: DependencyGraphDiagnostic,
): void {
	mg.diagnostics.push(diag);
}

function addUnresolvedRef(
	mg: MutableGraph,
	ref: DependencyGraphUnresolvedReference,
): void {
	mg.unresolvedReferences.push(ref);

	addDiagnostic(mg, {
		code: ref.code,
		documentCanonicalId: ref.documentCanonicalId,
		edgeId: ref.edgeId,
		expected: undefined,
		fieldPath: ref.fieldPath,
		message: ref.message,
		nodeId: ref.nodeId,
		phaseId: ref.phaseId,
		received: ref.referenceValue,
		recoveryHint: ref.recoveryHint,
		severity: ref.severity,
		sourcePath: ref.sourcePath,
	});
}

// ---------------------------------------------------------------------------
// Node ID helpers
// ---------------------------------------------------------------------------

function phaseNodeId(phaseId: PhaseId): DependencyGraphNodeId {
	return `phase:${phaseId}`;
}

function documentNodeId(
	canonicalId: CanonicalDocumentId,
): DependencyGraphNodeId {
	return `document:${canonicalId}`;
}

function canonicalOutputNodeId(
	canonicalId: CanonicalDocumentId,
): DependencyGraphNodeId {
	return `output:canonical:${canonicalId}:canonical`;
}

function artifactOutputNodeId(
	canonicalId: CanonicalDocumentId,
	outputId: string,
): DependencyGraphNodeId {
	const safeId = outputId.replace(/[/:\\]/g, '_');
	return `output:html:${canonicalId}:${safeId}`;
}

function agentPackOutputNodeId(
	canonicalId: CanonicalDocumentId,
	outputId: string,
): DependencyGraphNodeId {
	const safeId = outputId.replace(/[/:\\]/g, '_');
	return `output:agent-pack:${canonicalId}:${safeId}`;
}

function dataOutputNodeId(
	canonicalId: CanonicalDocumentId,
	outputId: string,
): DependencyGraphNodeId {
	const safeId = outputId.replace(/[/:\\]/g, '_');
	return `output:data:${canonicalId}:${safeId}`;
}

function executiveOutputNodeId(
	canonicalId: CanonicalDocumentId,
	outputId: string,
): DependencyGraphNodeId {
	const safeId = outputId.replace(/[/:\\]/g, '_');
	return `output:executive:${canonicalId}:${safeId}`;
}

function executiveGenOutputNodeId(
	prefix: string,
	idOrPath: string,
): DependencyGraphNodeId {
	const safe = idOrPath.replace(/[/:\\]/g, '_');
	return `executive:${prefix}:${safe}`;
}

function externalRefNodeId(id: string): DependencyGraphNodeId {
	const safeId = id.replace(/[/:\\]/g, '_');
	return `external_reference:${safeId}`;
}

// ---------------------------------------------------------------------------
// Node kind classification from output declaration
// ---------------------------------------------------------------------------

function outputDeclToNodeKind(
	decl: OutputDeclaration,
): DependencyGraphNodeKind {
	switch (decl.kind) {
		case 'canonical':
			return 'canonical_output';
		case 'artifact': {
			const format = (decl.raw as Record<string, unknown>)?.format;
			if (typeof format === 'string' && format === 'report') {
				return 'report_artifact';
			}
			return 'html_artifact';
		}
		case 'agentPack':
			return 'agent_pack';
		case 'data':
			return 'data_artifact';
		case 'executive': {
			const format = (decl.raw as Record<string, unknown>)?.format;
			if (typeof format === 'string') {
				const f = format.toLowerCase();
				if (f === 'json') return 'executive_json';
				if (f === 'markdown' || f === 'md') return 'executive_markdown';
				if (f === 'html') return 'executive_html';
			}
			return 'executive_output';
		}
		default:
			return 'external_reference';
	}
}

// ---------------------------------------------------------------------------
// Deterministic edge ID
// ---------------------------------------------------------------------------

function _edgeId(
	fromNode: DependencyGraphNodeId,
	kind: DependencyGraphEdgeKind,
	toNode: DependencyGraphNodeId,
	uniqueSuffix: number,
): DependencyGraphEdgeId {
	return `${kind}:${fromNode}->${toNode}:${uniqueSuffix}`;
}

// ---------------------------------------------------------------------------
// Executive generation parsing
// ---------------------------------------------------------------------------

function loadExecutiveGenerationConfig(
	profileRoot: string,
): ExecutiveGenerationConfig | undefined {
	const genPath = resolve(profileRoot, 'executive', 'executive-generation.yml');

	let rawContent: string;
	try {
		rawContent = readFileSync(genPath, 'utf-8');
	} catch {
		return undefined;
	}

	let parsed: unknown;
	try {
		parsed = YAML.parse(rawContent);
	} catch {
		return undefined;
	}

	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return undefined;
	}

	const raw = parsed as Record<string, unknown>;

	const gen = raw.generation as Record<string, unknown> | undefined;
	const outputsCfg: ExecutiveCfgOutput[] = [];

	if (
		gen?.output !== undefined &&
		typeof gen.output === 'object' &&
		gen.output !== null &&
		!Array.isArray(gen.output)
	) {
		const out = gen.output as Record<string, unknown>;
		const format = typeof out.format === 'string' ? out.format : 'json';
		const path =
			typeof out.path === 'string' ? out.path : 'executive-plan.json';
		outputsCfg.push({
			format,
			kind: 'executive_json' as const,
			path,
		});
	}

	const exportsCfg = raw.exports as Record<string, unknown> | undefined;
	const targetsRaw: Array<Record<string, unknown>> | undefined =
		exportsCfg?.targets as Array<Record<string, unknown>> | undefined;
	const enabledList = (
		Array.isArray(exportsCfg?.enabled) ? exportsCfg.enabled : []
	) as string[];

	const exportTargets: ExecutiveCfgExportTarget[] = [];

	if (targetsRaw !== undefined) {
		for (const [key, val] of Object.entries(targetsRaw)) {
			if (val === null || typeof val !== 'object' || Array.isArray(val)) {
				continue;
			}
			const t = val as Record<string, unknown>;
			const id = String(key);
			const mapping = typeof t.mapping === 'string' ? t.mapping : '';
			const outputPath = typeof t.outputPath === 'string' ? t.outputPath : '';

			let format = 'unknown';
			let kind: ExecutiveCfgExportTarget['kind'] = 'external_reference';

			if (id === 'markdown') {
				format = 'markdown';
				kind = 'executive_markdown';
			} else if (id === 'html') {
				format = 'html';
				kind = 'executive_html';
			} else if (id === 'agentPack') {
				format = 'markdown';
				kind = 'agent_pack';
			} else {
				format = 'unknown';
				kind = 'external_reference';
			}

			const status = enabledList.includes(id) ? 'supported' : 'planned';

			exportTargets.push({
				adapter: mapping,
				format,
				id,
				kind,
				path: outputPath,
				status,
			});
		}
	}

	return {
		exportTargets,
		outputs: outputsCfg,
		raw,
		sourcePath: genPath,
	};
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildDocumentDependencyGraph(
	input: DependencyGraphBuildInput,
	options?: DependencyGraphBuildOptions,
): DependencyGraphBuildResult {
	const mg = createMutableGraph();
	const contract = input.contract;
	const contractGraph =
		input.contractGraph ?? buildContractGraph(contract).graph;

	const rawOptionalSeverity = options?.optionalRefSeverity ?? 'warning';
	const optionalRefSeverity: 'warning' | 'info' =
		rawOptionalSeverity === 'diagnostic' ? 'info' : rawOptionalSeverity;

	const profileId = contract.profileId;

	// -----------------------------------------------------------------------
	// 1. Phase nodes
	// -----------------------------------------------------------------------

	for (const phase of contract.phases) {
		addNode(mg, {
			documentCanonicalId: undefined,
			fieldPath: undefined,
			id: phaseNodeId(phase.id),
			isCanonical: undefined,
			kind: 'phase' as const,
			label: phase.title,
			orderIndex: mg.nodeCount,
			outputRole: undefined,
			outputTargetPath: undefined,
			outputType: undefined,
			phaseId: phase.id,
			profileId,
			sourceDeclarationKind: 'phase_descriptor',
			sourcePath: phase.sourcePath,
			title: phase.title,
		});
	}

	// -----------------------------------------------------------------------
	// 2. Document nodes
	// -----------------------------------------------------------------------

	for (const node of contractGraph.nodes) {
		const doc = node.document;
		addNode(mg, {
			documentCanonicalId: doc.canonicalId,
			fieldPath: undefined,
			id: documentNodeId(doc.canonicalId),
			isCanonical: undefined,
			kind: 'document' as const,
			label: doc.descriptor.title,
			orderIndex: mg.nodeCount,
			outputRole: undefined,
			outputTargetPath: undefined,
			outputType: undefined,
			phaseId: doc.phaseId,
			profileId,
			sourceDeclarationKind: 'document_descriptor',
			sourcePath: doc.sourcePath,
			title: doc.descriptor.title,
		});
	}

	// -----------------------------------------------------------------------
	// 3. Phase → Document contains edges
	// -----------------------------------------------------------------------

	for (const doc of contract.documents) {
		const phaseNid = phaseNodeId(doc.phaseId);
		const docNid = documentNodeId(doc.canonicalId);

		if (mg.nodeMap.has(phaseNid) && mg.nodeMap.has(docNid)) {
			addEdge(mg, {
				fieldPath: undefined,
				fromNodeId: phaseNid,
				id: nextEdgeId(mg, 'e'),
				kind: 'contains' as const,
				orderIndex: mg.edgeCount,
				recoveryHint: undefined,
				required: true,
				sourceDeclarationKind: 'phase_descriptor',
				sourcePath: doc.sourcePath,
				toNodeId: docNid,
			});
		}
	}

	// -----------------------------------------------------------------------
	// 4. Output nodes + document → output edges
	// -----------------------------------------------------------------------

	for (const decl of contractGraph.outputs) {
		let nid: DependencyGraphNodeId;
		const kind = outputDeclToNodeKind(decl);

		const dKind = decl.kind;
		const outputId =
			'outputId' in decl ? (decl as { outputId?: string }).outputId : undefined;

		if (dKind === 'canonical') {
			nid = canonicalOutputNodeId(decl.documentCanonicalId);
		} else if (dKind === 'artifact') {
			const oid = outputId ?? `artifacts_${mg.nodeCount}`;
			nid = artifactOutputNodeId(decl.documentCanonicalId, oid);
		} else if (dKind === 'agentPack') {
			const oid = outputId ?? `agentPack_${mg.nodeCount}`;
			nid = agentPackOutputNodeId(decl.documentCanonicalId, oid);
		} else if (dKind === 'data') {
			const oid = outputId ?? `data_${mg.nodeCount}`;
			nid = dataOutputNodeId(decl.documentCanonicalId, oid);
		} else if (dKind === 'executive') {
			const oid = outputId ?? `executive_${mg.nodeCount}`;
			nid = executiveOutputNodeId(decl.documentCanonicalId, oid);
		} else {
			const oid: string = outputId ?? `unknown_${mg.nodeCount}`;
			nid = externalRefNodeId(oid);
		}

		if (mg.nodeMap.has(nid)) {
			// Duplicate node ID — skip
			continue;
		}

		addNode(mg, {
			documentCanonicalId: decl.documentCanonicalId,
			fieldPath: decl.fieldPath,
			id: nid,
			isCanonical: decl.isCanonical,
			kind,
			label: decl.path,
			orderIndex: mg.nodeCount,
			outputRole: decl.role ?? undefined,
			outputTargetPath: decl.path,
			outputType: decl.format,
			phaseId: decl.phaseId,
			profileId,
			sourceDeclarationKind: 'output_declaration',
			sourcePath: decl.sourcePath,
			title: decl.path,
		});

		const docNid = documentNodeId(decl.documentCanonicalId);
		if (mg.nodeMap.has(docNid)) {
			addEdge(mg, {
				fieldPath: decl.fieldPath,
				fromNodeId: docNid,
				id: nextEdgeId(mg, 'e'),
				kind: 'outputs_to' as const,
				orderIndex: mg.edgeCount,
				recoveryHint: undefined,
				required: true,
				sourceDeclarationKind: 'output',
				sourcePath: decl.sourcePath,
				toNodeId: nid,
			});
		}

		// Canonical output → derived artifact: derived_from edge. Graph traversal
		// treats fromNodeId as upstream/source and toNodeId as downstream/affected.
		if (!decl.isCanonical) {
			const canonicalNid = canonicalOutputNodeId(decl.documentCanonicalId);
			if (mg.nodeMap.has(canonicalNid)) {
				addEdge(mg, {
					fieldPath: decl.fieldPath,
					fromNodeId: canonicalNid,
					id: nextEdgeId(mg, 'e'),
					kind: 'derived_from' as const,
					orderIndex: mg.edgeCount,
					recoveryHint: undefined,
					required: true,
					sourceDeclarationKind: 'output',
					sourcePath: decl.sourcePath,
					toNodeId: nid,
				});
			}
		}
	}

	// -----------------------------------------------------------------------
	// 5. dependsOn edges
	// -----------------------------------------------------------------------

	for (const dep of contractGraph.dependencies) {
		if (dep.kind !== 'dependsOn') continue;

		const sourceNid = documentNodeId(dep.sourceDocumentCanonicalId);
		const sourceNode = mg.nodeMap.get(sourceNid);
		if (sourceNode === undefined) continue;

		if (dep.targetDocumentCanonicalId !== undefined) {
			const targetNid = documentNodeId(dep.targetDocumentCanonicalId);
			if (mg.nodeMap.has(targetNid)) {
				addEdge(mg, {
					fieldPath: dep.fieldPath,
					fromNodeId: targetNid,
					id: nextEdgeId(mg, 'e'),
					kind: 'depends_on' as const,
					orderIndex: mg.edgeCount,
					recoveryHint: undefined,
					required: true,
					sourceDeclarationKind: 'dependsOn',
					sourcePath: dep.sourcePath,
					toNodeId: sourceNid,
				});

				const targetCanonicalNid = canonicalOutputNodeId(
					dep.targetDocumentCanonicalId,
				);
				const sourceCanonicalNid = canonicalOutputNodeId(
					dep.sourceDocumentCanonicalId,
				);
				if (
					mg.nodeMap.has(targetCanonicalNid) &&
					mg.nodeMap.has(sourceCanonicalNid)
				) {
					addEdge(mg, {
						fieldPath: dep.fieldPath,
						fromNodeId: targetCanonicalNid,
						id: nextEdgeId(mg, 'e'),
						kind: 'depends_on' as const,
						orderIndex: mg.edgeCount,
						recoveryHint: undefined,
						required: true,
						sourceDeclarationKind: 'dependsOn',
						sourcePath: dep.sourcePath,
						toNodeId: sourceCanonicalNid,
					});
				}
			} else {
				addUnresolvedRef(mg, {
					code: 'E_DEP_GRAPH_UNRESOLVED_DEPENDS_ON',
					documentCanonicalId: dep.sourceDocumentCanonicalId,
					edgeId: undefined,
					fieldPath: dep.fieldPath,
					message: `Document "${dep.sourceDocumentCanonicalId}" depends on unknown document "${dep.targetDocumentId}"`,
					nodeId: sourceNid,
					phaseId: sourceNode.phaseId,
					recoveryHint:
						'Add the referenced document descriptor or correct the dependency target',
					referenceKind: 'dependsOn',
					referenceValue: dep.targetDocumentId,
					severity: 'error',
					sourcePath: dep.sourcePath,
				});
			}
		} else {
			addUnresolvedRef(mg, {
				code: 'E_DEP_GRAPH_UNRESOLVED_DEPENDS_ON',
				documentCanonicalId: dep.sourceDocumentCanonicalId,
				edgeId: undefined,
				fieldPath: dep.fieldPath,
				message: `Document "${dep.sourceDocumentCanonicalId}" depends on unresolvable target "${dep.targetDocumentId}"`,
				nodeId: sourceNid,
				phaseId: sourceNode.phaseId,
				recoveryHint:
					'Add the referenced document descriptor or correct the dependency target',
				referenceKind: 'dependsOn',
				referenceValue: dep.targetDocumentId,
				severity: 'error',
				sourcePath: dep.sourcePath,
			});
		}
	}

	// -----------------------------------------------------------------------
	// 6. feeds edges
	// -----------------------------------------------------------------------

	for (const feed of contractGraph.dependencies) {
		if (feed.kind !== 'feeds') continue;

		const sourceNid = documentNodeId(feed.sourceDocumentCanonicalId);
		const sourceNode = mg.nodeMap.get(sourceNid);
		if (sourceNode === undefined) continue;

		if (feed.targetDocumentCanonicalId !== undefined) {
			const targetNid = documentNodeId(feed.targetDocumentCanonicalId);
			if (mg.nodeMap.has(targetNid)) {
				addEdge(mg, {
					fieldPath: feed.fieldPath,
					fromNodeId: sourceNid,
					id: nextEdgeId(mg, 'e'),
					kind: 'feeds' as const,
					orderIndex: mg.edgeCount,
					recoveryHint: undefined,
					required: false,
					sourceDeclarationKind: 'feeds',
					sourcePath: feed.sourcePath,
					toNodeId: targetNid,
				});
			} else {
				addUnresolvedRef(mg, {
					code: 'E_DEP_GRAPH_UNRESOLVED_FEED',
					documentCanonicalId: feed.sourceDocumentCanonicalId,
					edgeId: undefined,
					fieldPath: feed.fieldPath,
					message: `Document "${feed.sourceDocumentCanonicalId}" feeds unresolvable target "${feed.targetDocumentId}"`,
					nodeId: sourceNid,
					phaseId: sourceNode.phaseId,
					recoveryHint:
						'Verify the feed target references an existing document or output',
					referenceKind: 'feeds',
					referenceValue: feed.targetDocumentId,
					severity: optionalRefSeverity,
					sourcePath: feed.sourcePath,
				});
			}
		} else if (
			feed.targetOutputId !== undefined &&
			feed.targetOutputPath !== undefined
		) {
			// Feed to a specific output
			addUnresolvedRef(mg, {
				code: 'E_DEP_GRAPH_UNRESOLVED_FEED_OUTPUT',
				documentCanonicalId: feed.sourceDocumentCanonicalId,
				edgeId: undefined,
				fieldPath: feed.fieldPath,
				message: `Document "${feed.sourceDocumentCanonicalId}" feeds output "${feed.targetOutputId}" (${feed.targetOutputPath}) which could not be mapped to a graph node`,
				nodeId: sourceNid,
				phaseId: sourceNode.phaseId,
				recoveryHint:
					'Feed output target resolution is not yet implemented for output-level references',
				referenceKind: 'feeds',
				referenceValue: feed.targetOutputPath,
				severity: optionalRefSeverity,
				sourcePath: feed.sourcePath,
			});
		} else {
			addUnresolvedRef(mg, {
				code: 'E_DEP_GRAPH_UNRESOLVED_FEED',
				documentCanonicalId: feed.sourceDocumentCanonicalId,
				edgeId: undefined,
				fieldPath: feed.fieldPath,
				message: `Document "${feed.sourceDocumentCanonicalId}" feeds unresolvable target "${feed.targetDocumentId}"`,
				nodeId: sourceNid,
				phaseId: sourceNode.phaseId,
				recoveryHint:
					'Verify the feed target references an existing document or output',
				referenceKind: 'feeds',
				referenceValue: feed.targetDocumentId,
				severity: optionalRefSeverity,
				sourcePath: feed.sourcePath,
			});
		}
	}

	// -----------------------------------------------------------------------
	// 7. Input edges from descriptor inputs
	// -----------------------------------------------------------------------

	for (const node of contractGraph.nodes) {
		const doc = node.document;
		const inputs = doc.descriptor.inputs;
		if (!Array.isArray(inputs)) continue;

		const docNid = documentNodeId(doc.canonicalId);
		if (!mg.nodeMap.has(docNid)) continue;

		for (let i = 0; i < inputs.length; i++) {
			const inp = inputs[i];
			if (inp === undefined) continue;

			const inputType = inp.type;
			const inputId = inp.id;
			const required = inp.required ?? false;

			// Only create input edges for document-type inputs that resolve to known documents
			if (inputType === 'document') {
				const targetNid = documentNodeId(inputId);
				if (mg.nodeMap.has(targetNid)) {
					addEdge(mg, {
						fieldPath: `inputs[${i}]`,
						fromNodeId: targetNid,
						id: nextEdgeId(mg, 'e'),
						kind: 'input_to' as const,
						orderIndex: mg.edgeCount,
						recoveryHint: undefined,
						required,
						sourceDeclarationKind: 'input',
						sourcePath: doc.sourcePath,
						toNodeId: docNid,
					});
				} else if (required) {
					addUnresolvedRef(mg, {
						code: 'E_DEP_GRAPH_UNRESOLVED_INPUT',
						documentCanonicalId: doc.canonicalId,
						edgeId: undefined,
						fieldPath: `inputs[${i}]`,
						message: `Document "${doc.canonicalId}" has a required input "${inputId}" of type "${inputType}" that does not resolve to a known document`,
						nodeId: docNid,
						phaseId: doc.phaseId,
						recoveryHint:
							'Add the referenced document or change the input type',
						referenceKind: 'input',
						referenceValue: inputId,
						severity: 'error',
						sourcePath: doc.sourcePath,
					});
				}
			}
		}
	}

	// -----------------------------------------------------------------------
	// 8. Executive output nodes and edges
	// -----------------------------------------------------------------------

	const executiveConfig =
		input.executiveConfig ??
		loadExecutiveGenerationConfig(contract.profileRoot);

	if (executiveConfig !== undefined) {
		// Executive JSON output node
		for (const out of executiveConfig.outputs) {
			const nid = executiveGenOutputNodeId('json', out.path);

			if (mg.nodeMap.has(nid)) continue;

			addNode(mg, {
				documentCanonicalId: undefined,
				fieldPath: 'generation.output',
				id: nid,
				isCanonical: false,
				kind: 'executive_json' as const,
				label: out.path,
				orderIndex: mg.nodeCount,
				outputRole: 'executive',
				outputTargetPath: out.path,
				outputType: out.format,
				phaseId: undefined,
				profileId,
				sourceDeclarationKind: 'executive',
				sourcePath: executiveConfig.sourcePath,
				title: out.path,
			});

			// Link canonical outputs to executive JSON
			for (const doc of contract.documents) {
				const canonicalNid = canonicalOutputNodeId(doc.canonicalId);
				if (mg.nodeMap.has(canonicalNid)) {
					addEdge(mg, {
						fieldPath: undefined,
						fromNodeId: canonicalNid,
						id: nextEdgeId(mg, 'e'),
						kind: 'executive_depends_on' as const,
						orderIndex: mg.edgeCount,
						recoveryHint: undefined,
						required: false,
						sourceDeclarationKind: 'executive',
						sourcePath: executiveConfig.sourcePath,
						toNodeId: nid,
					});
				}
			}
		}

		// Executive export target nodes and mapping edges
		for (const target of executiveConfig.exportTargets) {
			let nid: DependencyGraphNodeId;
			let nodeKind: DependencyGraphNodeKind;

			if (target.id === 'markdown') {
				nid = executiveGenOutputNodeId('markdown', 'executive_exports');
				nodeKind = 'executive_markdown';
			} else if (target.id === 'html') {
				nid = executiveGenOutputNodeId('html', 'executive_exports');
				nodeKind = 'executive_html';
			} else if (target.id === 'agentPack') {
				nid = executiveGenOutputNodeId('agent_pack', 'executive_exports');
				nodeKind = 'agent_pack';
			} else {
				nid = executiveGenOutputNodeId(target.id, target.path);
				nodeKind = 'external_reference';
			}

			if (mg.nodeMap.has(nid)) continue;

			addNode(mg, {
				documentCanonicalId: undefined,
				fieldPath: `exports.targets.${target.id}`,
				id: nid,
				isCanonical: false,
				kind: nodeKind,
				label: target.path,
				orderIndex: mg.nodeCount,
				outputRole: target.id,
				outputTargetPath: target.path,
				outputType: target.format,
				phaseId: undefined,
				profileId,
				sourceDeclarationKind: 'executive',
				sourcePath: executiveConfig.sourcePath,
				title: target.path,
			});

			// Mapping edge: executive JSON → export target
			for (const out of executiveConfig.outputs) {
				const jsonNid = executiveGenOutputNodeId('json', out.path);
				if (mg.nodeMap.has(jsonNid)) {
					addEdge(mg, {
						fieldPath: `exports.targets.${target.id}`,
						fromNodeId: jsonNid,
						id: nextEdgeId(mg, 'e'),
						kind: 'mapping_outputs_to' as const,
						orderIndex: mg.edgeCount,
						recoveryHint: undefined,
						required: false,
						sourceDeclarationKind: 'mapping',
						sourcePath: executiveConfig.sourcePath,
						toNodeId: nid,
					});
				}
			}
		}
	} else {
		addDiagnostic(mg, {
			code: 'E_DEP_GRAPH_NO_EXECUTIVE_CONFIG',
			documentCanonicalId: undefined,
			edgeId: undefined,
			expected: undefined,
			fieldPath: undefined,
			message:
				'Executive generation configuration not found or could not be parsed; executive output nodes omitted from dependency graph',
			nodeId: undefined,
			phaseId: undefined,
			received: undefined,
			recoveryHint:
				'Ensure profiles/standard/executive/executive-generation.yml exists and is valid YAML',
			severity: 'info',
			sourcePath: undefined,
		});
	}

	// -----------------------------------------------------------------------
	// 9. Cycle detection
	// -----------------------------------------------------------------------

	const cycles = detectDependencyCycles(mg);
	for (const cycle of cycles) {
		mg.cycles.push(cycle);
	}

	// -----------------------------------------------------------------------
	// 10. Freeze and return
	// -----------------------------------------------------------------------

	const nodeMap = new Map(mg.nodeMap);
	const edgeMap = new Map(mg.edgeMap);
	const nodeByDocumentId = new Map(mg.nodeByDocumentId);
	const nodesByPhaseId = new Map(mg.nodesByPhaseId);
	const outputsByDocumentId = new Map(mg.outputsByDocumentId);
	const upstreamEdges = new Map(mg.upstreamEdges);
	const downstreamEdges = new Map(mg.downstreamEdges);

	const graph: DocumentDependencyGraph = {
		cycles: mg.cycles,
		diagnostics: mg.diagnostics,
		downstreamEdges,
		edgeMap,
		edges: mg.edges,
		nodeByDocumentId,
		nodeMap,
		nodes: mg.nodes,
		nodesByPhaseId,
		outputsByDocumentId,
		profileId,
		unresolvedReferences: mg.unresolvedReferences,
		upstreamEdges,
	};

	return { diagnostics: mg.diagnostics, graph };
}

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

function detectDependencyCycles(mg: MutableGraph): DependencyGraphCycle[] {
	const cycles: DependencyGraphCycle[] = [];

	// Build adjacency for dependsOn edges only
	const adjacency = new Map<DependencyGraphNodeId, DependencyGraphNodeId[]>();
	for (const node of mg.nodes) {
		adjacency.set(node.id, []);
	}

	for (const edge of mg.edges) {
		if (edge.kind !== 'depends_on') continue;
		const list = adjacency.get(edge.fromNodeId);
		if (list !== undefined) {
			list.push(edge.toNodeId);
		}
	}

	const WHITE = 0;
	const GRAY = 1;
	const BLACK = 2;
	const color = new Map<DependencyGraphNodeId, number>();
	for (const node of mg.nodes) {
		color.set(node.id, WHITE);
	}

	const path: DependencyGraphNodeId[] = [];
	const reportedCycleKeys = new Set<string>();
	let cycleIdCounter = 0;

	function dfs(nodeId: DependencyGraphNodeId): void {
		color.set(nodeId, GRAY);
		path.push(nodeId);

		const neighbors = adjacency.get(nodeId) ?? [];
		for (const neighbor of neighbors) {
			const c = color.get(neighbor);
			if (c === undefined || c === BLACK) continue;
			if (c === GRAY) {
				const cycleStart = path.indexOf(neighbor);
				if (cycleStart < 0) continue;

				const cyclePath = path.slice(cycleStart);
				const cycleKey = [...cyclePath].sort().join('#');
				if (reportedCycleKeys.has(cycleKey)) continue;
				reportedCycleKeys.add(cycleKey);

				cycleIdCounter++;

				const involvedEdges: DependencyGraphEdgeId[] = [];
				for (let i = 0; i < cyclePath.length; i++) {
					const from = cyclePath[i];
					const to = cyclePath[(i + 1) % cyclePath.length];
					if (from === undefined || to === undefined) continue;
					for (const e of mg.edges) {
						if (
							e.kind === 'depends_on' &&
							e.fromNodeId === from &&
							e.toNodeId === to
						) {
							involvedEdges.push(e.id);
							break;
						}
					}
				}

				const sourcePaths: string[] = [];
				for (const nid of cyclePath) {
					const node = mg.nodeMap.get(nid);
					if (
						node?.sourcePath !== undefined &&
						!sourcePaths.includes(node.sourcePath)
					) {
						sourcePaths.push(node.sourcePath);
					}
				}

				cycles.push({
					edgeIds: involvedEdges,
					id: `cycle_${cycleIdCounter}`,
					nodeIds: [...cyclePath],
					severity: 'error',
					sourcePaths,
				});
			} else {
				dfs(neighbor);
			}
		}

		path.pop();
		color.set(nodeId, BLACK);
	}

	for (const node of mg.nodes) {
		if (color.get(node.id) === WHITE) {
			dfs(node.id);
		}
	}

	return cycles;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function summarizeDependencyGraph(
	graph: DocumentDependencyGraph,
): DependencyGraphSummary {
	const outputCountByKind: Record<string, number> = {};
	const edgeCountByKind: Record<string, number> = {};
	const diagnosticCountBySeverity: Record<string, number> = {};

	let canonicalOutputCount = 0;
	let derivedArtifactCount = 0;
	let executiveOutputCount = 0;

	for (const node of graph.nodes) {
		if (
			node.kind === 'canonical_output' ||
			node.kind === 'html_artifact' ||
			node.kind === 'agent_pack' ||
			node.kind === 'data_artifact' ||
			node.kind === 'report_artifact' ||
			node.kind === 'executive_output' ||
			node.kind === 'executive_json' ||
			node.kind === 'executive_markdown' ||
			node.kind === 'executive_html'
		) {
			outputCountByKind[node.kind] = (outputCountByKind[node.kind] ?? 0) + 1;

			if (node.isCanonical === true) {
				canonicalOutputCount++;
			} else if (
				node.kind === 'executive_json' ||
				node.kind === 'executive_markdown' ||
				node.kind === 'executive_html' ||
				node.kind === 'executive_output'
			) {
				executiveOutputCount++;
			} else {
				derivedArtifactCount++;
			}
		}
	}

	for (const edge of graph.edges) {
		edgeCountByKind[edge.kind] = (edgeCountByKind[edge.kind] ?? 0) + 1;
	}

	for (const diag of graph.diagnostics) {
		const sev = diag.severity;
		diagnosticCountBySeverity[sev] = (diagnosticCountBySeverity[sev] ?? 0) + 1;
	}

	const documentCount = graph.nodes.filter((n) => n.kind === 'document').length;
	const phaseCount = graph.nodes.filter((n) => n.kind === 'phase').length;

	return {
		canonicalOutputCount,
		cycleCount: graph.cycles.length,
		derivedArtifactCount,
		diagnosticCountBySeverity,
		documentCount,
		edgeCountByKind: edgeCountByKind as Record<DependencyGraphEdgeKind, number>,
		executiveOutputCount,
		outputCountByKind: outputCountByKind as Record<
			DependencyGraphNodeKind,
			number
		>,
		phaseCount,
		profileId: graph.profileId,
		unresolvedReferenceCount: graph.unresolvedReferences.length,
	};
}
