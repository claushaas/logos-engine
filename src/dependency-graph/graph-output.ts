/** Step 7.4 Graph Output — read-only text and JSON graph output renderers */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { RegenerationPlan } from '../regeneration/regeneration-types.js';
import type { StalenessDetectionResult } from '../staleness/staleness-types.js';
import type {
	DependencyGraphDiagnostic,
	DependencyGraphNode,
	DependencyGraphNodeKind,
	DocumentDependencyGraph,
} from './dependency-graph.js';
import { getTopologicalDocumentOrder } from './graph-queries.js';

// ---------------------------------------------------------------------------
// Output formats
// ---------------------------------------------------------------------------

export type GraphOutputFormat = 'text' | 'json';

// ---------------------------------------------------------------------------
// Render modes
// ---------------------------------------------------------------------------

export type GraphOutputRenderMode =
	| 'summary'
	| 'phase_tree'
	| 'document_dependencies'
	| 'outputs'
	| 'staleness'
	| 'regeneration'
	| 'full';

// ---------------------------------------------------------------------------
// Status per node
// ---------------------------------------------------------------------------

export type GraphOutputStatus =
	| 'current'
	| 'stale'
	| 'missing'
	| 'blocked'
	| 'orphaned'
	| 'unknown'
	| 'not_evaluated';

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface GraphOutputFilter {
	readonly phaseId?: PhaseId | undefined;
	readonly documentId?: CanonicalDocumentId | undefined;
	readonly outputKind?: DependencyGraphNodeKind | undefined;
	readonly stalenessStatus?: GraphOutputStatus | undefined;
	readonly includeDerivedArtifacts?: boolean;
	readonly includeExecutiveOutputs?: boolean;
	readonly includeUnresolvedReferences?: boolean;
	readonly includeCycles?: boolean;
	readonly includeFullEdges?: boolean;
	readonly includeTransitiveDependencies?: boolean;
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export type GraphOutputScope =
	| 'all'
	| 'phases'
	| 'documents'
	| 'outputs'
	| 'edges'
	| 'staleness'
	| 'diagnostics';

// ---------------------------------------------------------------------------
// Node / edge / document / output summaries
// ---------------------------------------------------------------------------

export interface GraphOutputNodeSummary {
	readonly id: string;
	readonly kind: DependencyGraphNodeKind;
	readonly label: string;
	readonly title: string;
	readonly phaseId: PhaseId | undefined;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly isCanonical: boolean | undefined;
	readonly outputTargetPath: string | undefined;
	readonly stalenessStatus: GraphOutputStatus;
	readonly isStale: boolean;
	readonly isBlocked: boolean;
	readonly isMissing: boolean;
}

export interface GraphOutputEdgeSummary {
	readonly id: string;
	readonly kind: string;
	readonly fromNodeId: string;
	readonly toNodeId: string;
	readonly required: boolean | undefined;
}

export interface GraphOutputDocumentSummary {
	readonly canonicalId: CanonicalDocumentId;
	readonly title: string;
	readonly phaseId: PhaseId;
	readonly upstreamCount: number;
	readonly downstreamCount: number;
	readonly outputCount: number;
	readonly canonicalOutputs: readonly string[];
	readonly derivedOutputs: readonly string[];
	readonly stalenessStatus: GraphOutputStatus;
}

export interface GraphOutputPhaseSummary {
	readonly phaseId: PhaseId;
	readonly title: string;
	readonly documentCount: number;
	readonly documents: readonly GraphOutputDocumentSummary[];
}

export interface GraphOutputStalenessItem {
	readonly targetId: string;
	readonly status: GraphOutputStatus;
	readonly documentId: CanonicalDocumentId | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly outputKind: string;
	readonly outputPath: string | undefined;
}

// ---------------------------------------------------------------------------
// Section and row types
// ---------------------------------------------------------------------------

export interface GraphOutputSection {
	readonly title: string;
	readonly rows: readonly string[];
	readonly diagnosticCount: number;
}

export interface GraphOutputRow {
	readonly text: string;
	readonly indent: number;
	readonly severity?: 'info' | 'warning' | 'error' | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface GraphOutputDiagnostic {
	readonly code: string;
	readonly severity: 'info' | 'warning' | 'error';
	readonly message: string;
	readonly sourcePath: string | undefined;
	readonly pointer: string | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly nodeId: string | undefined;
	readonly relatedOutputId: string | undefined;
	readonly recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface GraphOutputSummary {
	readonly profileId: string;
	readonly phaseCount: number;
	readonly documentCount: number;
	readonly outputCount: number;
	readonly outputCountByKind: Record<string, number>;
	readonly edgeCount: number;
	readonly edgeCountByKind: Record<string, number>;
	readonly unresolvedReferenceCount: number;
	readonly cycleCount: number;
	readonly stalenessCurrentCount: number;
	readonly stalenessStaleCount: number;
	readonly stalenessMissingCount: number;
	readonly stalenessBlockedCount: number;
	readonly stalenessOrphanedCount: number;
	readonly stalenessUnknownCount: number;
}

// ---------------------------------------------------------------------------
// Input / Options / Result
// ---------------------------------------------------------------------------

export interface GraphOutputInput {
	readonly graph: DocumentDependencyGraph;
	readonly stalenessResult?: StalenessDetectionResult | undefined;
	readonly regenerationPlan?: RegenerationPlan | undefined;
}

export interface GraphOutputOptions {
	readonly format?: GraphOutputFormat;
	readonly mode?: GraphOutputRenderMode;
	readonly filter?: GraphOutputFilter;
	readonly scope?: GraphOutputScope;
	readonly generatedAt?: string | undefined;
}

export interface GraphTextReport {
	readonly profileId: string;
	readonly sections: readonly GraphOutputSection[];
	readonly renderMode: GraphOutputRenderMode;
	readonly hasDiagnostics: boolean;
	readonly diagnosticCount: number;
}

export interface GraphJsonReport {
	readonly profileId: string;
	readonly formatVersion: string;
	readonly renderedAt: string;
	readonly summary: GraphOutputSummary;
	readonly nodes: readonly GraphOutputNodeSummary[];
	readonly edges: readonly GraphOutputEdgeSummary[];
	readonly phases: readonly GraphOutputPhaseSummary[];
	readonly documents: readonly GraphOutputDocumentSummary[];
	readonly outputs: readonly GraphOutputNodeSummary[];
	readonly staleness: {
		readonly items: readonly GraphOutputStalenessItem[];
		readonly currentCount: number;
		readonly staleCount: number;
		readonly missingCount: number;
		readonly blockedCount: number;
		readonly orphanedCount: number;
		readonly unknownCount: number;
	};
	readonly diagnostics: readonly GraphOutputDiagnostic[];
}

export interface GraphOutputResult {
	readonly format: GraphOutputFormat;
	readonly textReport?: GraphTextReport | undefined;
	readonly jsonReport?: GraphJsonReport | undefined;
	readonly textOutput?: string | undefined;
	readonly jsonOutput?: string | undefined;
	readonly diagnostics: readonly GraphOutputDiagnostic[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const FORMAT_VERSION = '1.0.0';

function resolveStalenessStatus(
	node: DependencyGraphNode,
	stalenessResult?: StalenessDetectionResult,
): GraphOutputStatus {
	if (!stalenessResult) return 'not_evaluated';

	const targetKind = graphNodeKindToStalenessKind(node.kind);
	if (!targetKind) return 'not_evaluated';

	const targetId =
		node.id ||
		`${targetKind}:${node.documentCanonicalId ?? 'unknown'}:${node.label}`;

	const target = stalenessResult.targets.find(
		(t) =>
			t.targetId === targetId ||
			(t.graphNodeId === node.id && t.targetKind === targetKind),
	);

	if (!target) return 'not_evaluated';
	return target.status as GraphOutputStatus;
}

function graphNodeKindToStalenessKind(kind: string): string | undefined {
	const map: Record<string, string> = {
		agent_pack: 'agent_pack',
		canonical_output: 'canonical_markdown',
		data_artifact: 'data_artifact',
		executive_html: 'executive_html',
		executive_json: 'executive_json',
		executive_markdown: 'executive_markdown',
		executive_output: 'executive_json',
		html_artifact: 'html_artifact',
		report_artifact: 'report_artifact',
	};
	return map[kind];
}

function isOutputKind(kind: DependencyGraphNodeKind): boolean {
	switch (kind) {
		case 'canonical_output':
		case 'html_artifact':
		case 'agent_pack':
		case 'data_artifact':
		case 'report_artifact':
		case 'executive_output':
		case 'executive_json':
		case 'executive_markdown':
		case 'executive_html':
			return true;
		default:
			return false;
	}
}

function isExecutiveKind(kind: DependencyGraphNodeKind): boolean {
	switch (kind) {
		case 'executive_output':
		case 'executive_json':
		case 'executive_markdown':
		case 'executive_html':
			return true;
		default:
			return false;
	}
}

function canonicalId(node: DependencyGraphNode): string {
	return node.documentCanonicalId ?? node.label;
}

const STATUS_DISPLAY: Record<GraphOutputStatus, string> = {
	blocked: '[BLOCKED]',
	current: '[OK]',
	missing: '[MISSING]',
	not_evaluated: '[--]',
	orphaned: '[ORPHANED]',
	stale: '[STALE]',
	unknown: '[UNKNOWN]',
};

function formatDocumentRow(
	node: DependencyGraphNode,
	_graph: DocumentDependencyGraph,
	upstreamCount: number,
	downstreamCount: number,
	outputCount: number,
	status: GraphOutputStatus,
): string {
	const label = node.title || node.label;
	return `  document:${canonicalId(node)} – ${label} (up:${upstreamCount}, down:${downstreamCount}, out:${outputCount}) ${STATUS_DISPLAY[status] ?? '[--]'}`;
}

function formatOutputRow(
	node: DependencyGraphNode,
	status: GraphOutputStatus,
): string {
	const label = node.title || node.label;
	const isCan = node.isCanonical === true;
	const canMarker = isCan ? 'canonical' : 'derived';
	const kindStr = node.kind.replace(/_/g, ' ');
	const pathStr = node.outputTargetPath ?? '';
	const idStr = node.id;
	return `    ${kindStr} [${canMarker}] ${label} ${pathStr ? `(${pathStr})` : ''} ${idStr ? `#${idStr}` : ''} ${STATUS_DISPLAY[status] ?? '[--]'}`;
}

// ---------------------------------------------------------------------------
// Text report builder
// ---------------------------------------------------------------------------

function buildTextSections(
	graph: DocumentDependencyGraph,
	options: GraphOutputOptions,
	stalenessResult?: StalenessDetectionResult,
	regenerationPlan?: RegenerationPlan,
): { sections: GraphOutputSection[]; diagnostics: GraphOutputDiagnostic[] } {
	const mode = options.mode ?? 'summary';
	const filter = options.filter;
	const diagnostics: GraphOutputDiagnostic[] = [];

	const docNodes = graph.nodes.filter((n) => n.kind === 'document');
	const phaseNodes = graph.nodes.filter((n) => n.kind === 'phase');
	const outputNodes = graph.nodes.filter((n) => isOutputKind(n.kind));
	const execNodes = outputNodes.filter((n) => isExecutiveKind(n.kind));

	const includeExec = filter?.includeExecutiveOutputs !== false;
	const includeDerived = filter?.includeDerivedArtifacts !== false;

	const sections: GraphOutputSection[] = [];

	// Summary section (always present)
	sections.push(buildSummarySection(graph, stalenessResult));

	// Phase tree section
	if (mode === 'summary' || mode === 'phase_tree' || mode === 'full') {
		sections.push(
			buildPhaseTreeSection(
				graph,
				phaseNodes,
				docNodes,
				outputNodes,
				execNodes,
				filter,
				stalenessResult,
				includeExec,
				includeDerived,
			),
		);
	}

	// Document dependencies section
	if (mode === 'document_dependencies' || mode === 'full') {
		sections.push(
			buildDocumentDependenciesSection(graph, docNodes, stalenessResult),
		);
	}

	// Outputs section
	if (mode === 'outputs' || mode === 'full') {
		sections.push(
			buildOutputsSection(
				graph,
				outputNodes,
				execNodes,
				filter,
				stalenessResult,
				includeExec,
				includeDerived,
			),
		);
	}

	// Staleness section
	if ((mode === 'staleness' || mode === 'full') && stalenessResult) {
		sections.push(buildStalenessSection(stalenessResult, filter));
	}

	// Regeneration section
	if ((mode === 'regeneration' || mode === 'full') && regenerationPlan) {
		sections.push(buildRegenerationSection(regenerationPlan));
	}

	// Warnings section (always present if there are warnings)
	const warningSection = buildWarningsSection(graph, stalenessResult, filter);
	if (warningSection) {
		sections.push(warningSection);
	}

	return { diagnostics, sections };
}

function buildSummarySection(
	graph: DocumentDependencyGraph,
	stalenessResult?: StalenessDetectionResult,
): GraphOutputSection {
	const summary = graphSummaryFromGraph(graph, stalenessResult);
	const rows: string[] = [
		'Graph Output',
		'============',
		`Profile: ${summary.profileId}`,
		'',
		'Graph Summary:',
		`  Phases: ${summary.phaseCount}`,
		`  Documents: ${summary.documentCount}`,
		`  Outputs: ${summary.outputCount} (canonical: ${summary.outputCountByKind.canonical_output ?? 0}, derived: ${(summary.outputCountByKind.html_artifact ?? 0) + (summary.outputCountByKind.agent_pack ?? 0) + (summary.outputCountByKind.data_artifact ?? 0) + (summary.outputCountByKind.report_artifact ?? 0)}, executive: ${(summary.outputCountByKind.executive_json ?? 0) + (summary.outputCountByKind.executive_markdown ?? 0) + (summary.outputCountByKind.executive_html ?? 0) + (summary.outputCountByKind.executive_output ?? 0)})`,
		`  Edges: ${summary.edgeCount} (contains: ${summary.edgeCountByKind.contains ?? 0}, depends_on: ${summary.edgeCountByKind.depends_on ?? 0}, feeds: ${summary.edgeCountByKind.feeds ?? 0}, input_to: ${summary.edgeCountByKind.input_to ?? 0}, outputs_to: ${summary.edgeCountByKind.outputs_to ?? 0}, derived_from: ${summary.edgeCountByKind.derived_from ?? 0}, executive_depends_on: ${summary.edgeCountByKind.executive_depends_on ?? 0}, mapping_outputs_to: ${summary.edgeCountByKind.mapping_outputs_to ?? 0}, references: ${summary.edgeCountByKind.references ?? 0})`,
		`  Unresolved references: ${summary.unresolvedReferenceCount}`,
		`  Cycles: ${summary.cycleCount}`,
		`  Diagnostics: ${graph.diagnostics.length}`,
	];

	if (stalenessResult) {
		rows.push('');
		rows.push('Staleness Summary:');
		rows.push(`  Current:  ${summary.stalenessCurrentCount}`);
		rows.push(`  Stale:    ${summary.stalenessStaleCount}`);
		rows.push(`  Missing:  ${summary.stalenessMissingCount}`);
		rows.push(`  Blocked:  ${summary.stalenessBlockedCount}`);
		rows.push(`  Orphaned: ${summary.stalenessOrphanedCount}`);
		rows.push(`  Unknown:  ${summary.stalenessUnknownCount}`);
	}

	return {
		diagnosticCount: 0,
		rows,
		title: 'Summary',
	};
}

function buildPhaseTreeSection(
	graph: DocumentDependencyGraph,
	phaseNodes: readonly DependencyGraphNode[],
	docNodes: readonly DependencyGraphNode[],
	_outputNodes: readonly DependencyGraphNode[],
	_execNodes: readonly DependencyGraphNode[],
	filter: GraphOutputFilter | undefined,
	stalenessResult: StalenessDetectionResult | undefined,
	includeExec: boolean,
	includeDerived: boolean,
): GraphOutputSection {
	const rows: string[] = [];

	rows.push('');
	rows.push('Phases');
	rows.push('------');

	for (const phase of phaseNodes) {
		if (filter?.phaseId && phase.phaseId !== filter.phaseId) continue;

		const phaseDocs = docNodes.filter(
			(d) => d.phaseId === (phase.phaseId ?? phase.label),
		);
		rows.push(
			`Phase: ${phase.phaseId ?? phase.id} – ${phase.title || phase.label}`,
		);

		for (const doc of phaseDocs) {
			if (filter?.documentId && doc.documentCanonicalId !== filter.documentId)
				continue;

			const docId = doc.documentCanonicalId ?? '';
			const upstreamCount =
				graph.upstreamEdges.get(doc.id)?.filter((e) => e.kind === 'depends_on')
					.length ?? 0;
			const downstreamCount =
				graph.downstreamEdges
					.get(doc.id)
					?.filter((e) => e.kind === 'depends_on').length ?? 0;
			const docOutputs = graph.outputsByDocumentId.get(docId) ?? [];
			const outputCount = docOutputs.length;
			const status = resolveStalenessStatus(doc, stalenessResult);

			rows.push(
				formatDocumentRow(
					doc,
					graph,
					upstreamCount,
					downstreamCount,
					outputCount,
					status,
				),
			);

			// Show outputs for this document
			for (const outNode of docOutputs) {
				if (!includeDerived && outNode.kind !== 'canonical_output') continue;
				if (!includeExec && isExecutiveKind(outNode.kind)) continue;
				if (filter?.outputKind && outNode.kind !== filter.outputKind) continue;

				const outStatus = resolveStalenessStatus(outNode, stalenessResult);
				rows.push(formatOutputRow(outNode, outStatus));
			}
		}
		rows.push('');
	}

	return {
		diagnosticCount: 0,
		rows,
		title: 'Phases',
	};
}

function buildDocumentDependenciesSection(
	graph: DocumentDependencyGraph,
	_docNodes: readonly DependencyGraphNode[],
	stalenessResult: StalenessDetectionResult | undefined,
): GraphOutputSection {
	const rows: string[] = [];
	rows.push('');
	rows.push('Document Dependencies');
	rows.push('---------------------');

	const topoOrder = getTopologicalDocumentOrder(graph);

	for (const docId of topoOrder) {
		const doc = graph.nodeByDocumentId.get(docId);
		if (!doc) continue;

		const upstreamNodes =
			graph.upstreamEdges
				.get(doc.id)
				?.filter((e) => e.kind === 'depends_on')
				.map((e) => graph.nodeMap.get(e.fromNodeId))
				.filter(Boolean) ?? [];

		const status = resolveStalenessStatus(doc, stalenessResult);
		rows.push(
			`  document:${docId} – ${doc.title || doc.label} ${STATUS_DISPLAY[status] ?? '[--]'}`,
		);

		if (upstreamNodes.length > 0) {
			rows.push('    depends on:');
			for (const upNode of upstreamNodes) {
				if (!upNode) continue;
				rows.push(
					`      document:${upNode.documentCanonicalId ?? upNode.label}`,
				);
			}
		}
	}

	return {
		diagnosticCount: 0,
		rows,
		title: 'Document Dependencies',
	};
}

function buildOutputsSection(
	_graph: DocumentDependencyGraph,
	outputNodes: readonly DependencyGraphNode[],
	_execNodes: readonly DependencyGraphNode[],
	filter: GraphOutputFilter | undefined,
	stalenessResult: StalenessDetectionResult | undefined,
	includeExec: boolean,
	includeDerived: boolean,
): GraphOutputSection {
	const rows: string[] = [];
	rows.push('');
	rows.push('Outputs');
	rows.push('-------');

	// Gather all outputs from the graph
	for (const outNode of outputNodes) {
		if (!includeDerived && outNode.kind !== 'canonical_output') continue;
		if (!includeExec && isExecutiveKind(outNode.kind)) continue;
		if (filter?.outputKind && outNode.kind !== filter.outputKind) continue;

		const _docId = outNode.documentCanonicalId ?? '';
		const status = resolveStalenessStatus(outNode, stalenessResult);
		rows.push(formatOutputRow(outNode, status));
	}

	return {
		diagnosticCount: 0,
		rows,
		title: 'Outputs',
	};
}

function buildStalenessSection(
	stalenessResult: StalenessDetectionResult,
	filter: GraphOutputFilter | undefined,
): GraphOutputSection {
	const rows: string[] = [];
	rows.push('');
	rows.push('Staleness');
	rows.push('---------');

	const s = stalenessResult.summary;
	rows.push(`  Total outputs:    ${s.total}`);
	rows.push(`  Current:          ${s.currentCount}`);
	rows.push(`  Stale:            ${s.staleCount}`);
	rows.push(`  Missing:          ${s.missingCount}`);
	rows.push(`  Blocked:          ${s.blockedCount}`);
	rows.push(`  Orphaned:         ${s.orphanedCount}`);
	rows.push(`  Unknown:          ${s.unknownCount}`);

	if (s.topStaleReasons.length > 0) {
		rows.push('');
		rows.push('  Top stale reasons:');
		for (const reason of s.topStaleReasons) {
			rows.push(`    - ${reason}`);
		}
	}

	if (s.topBlockingReasons.length > 0) {
		rows.push('');
		rows.push('  Top blocking reasons:');
		for (const reason of s.topBlockingReasons) {
			rows.push(`    - ${reason}`);
		}
	}

	// Per-target staleness rows
	for (const target of stalenessResult.targets) {
		if (filter?.stalenessStatus && target.status !== filter.stalenessStatus)
			continue;
		if (filter?.documentId && target.documentCanonicalId !== filter.documentId)
			continue;
		if (filter?.phaseId && target.phaseId !== filter.phaseId) continue;

		const statusLabel =
			STATUS_DISPLAY[target.status as GraphOutputStatus] ??
			`[${target.status.toUpperCase()}]`;
		rows.push(
			`  ${target.targetId} (${target.targetKind}) -> ${statusLabel} ${target.outputPath ? `at ${target.outputPath}` : ''}`,
		);

		for (const reason of target.reasons) {
			rows.push(`    ${reason.severity}: ${reason.message}`);
		}
	}

	return {
		diagnosticCount: stalenessResult.diagnostics.length,
		rows,
		title: 'Staleness',
	};
}

function buildRegenerationSection(plan: RegenerationPlan): GraphOutputSection {
	const rows: string[] = [];
	rows.push('');
	rows.push('Regeneration Plan');
	rows.push('-----------------');

	rows.push(`  Profile: ${plan.profileId}`);
	rows.push(`  Dry run: ${plan.dryRun ? 'yes' : 'no'}`);
	rows.push(`  Total items: ${plan.items.length}`);
	rows.push(`  Graph nodes: ${plan.graphNodeCount}`);

	rows.push('');
	rows.push('  Counts by action:');
	for (const [action, count] of Object.entries(plan.countByAction)) {
		rows.push(`    ${action}: ${count}`);
	}

	rows.push('');
	rows.push('  Counts by status:');
	for (const [status, count] of Object.entries(plan.countByStatus)) {
		rows.push(`    ${status}: ${count}`);
	}

	if (plan.items.length > 0) {
		rows.push('');
		rows.push('  Plan items (safe order):');
		for (const item of plan.items) {
			const actLabel = item.action;
			const statusLabel =
				STATUS_DISPLAY[item.status as unknown as GraphOutputStatus] ??
				`[${item.status.toUpperCase()}]`;
			rows.push(
				`    #${item.safeOrderIndex} ${item.targetId} (${item.targetKind}) -> ${actLabel} ${statusLabel}`,
			);

			if (item.reasons.length > 0) {
				for (const reason of item.reasons) {
					rows.push(`      ${reason.severity}: ${reason.message}`);
				}
			}

			if (item.blockers.length > 0) {
				for (const blocker of item.blockers) {
					rows.push(`      BLOCKED by: ${blocker.message}`);
				}
			}
		}
	}

	return {
		diagnosticCount: plan.diagnostics.length,
		rows,
		title: 'Regeneration Plan',
	};
}

function buildWarningsSection(
	graph: DocumentDependencyGraph,
	stalenessResult: StalenessDetectionResult | undefined,
	filter: GraphOutputFilter | undefined,
): GraphOutputSection | null {
	const rows: string[] = [];
	const _diagnostics: DependencyGraphDiagnostic[] = [];
	let diagnosticCount = 0;

	// Unresolved references
	if (
		graph.unresolvedReferences.length > 0 &&
		filter?.includeUnresolvedReferences !== false
	) {
		rows.push('');
		rows.push('Warnings');
		rows.push('--------');
		rows.push(`  Unresolved references: ${graph.unresolvedReferences.length}`);
		for (const ref of graph.unresolvedReferences) {
			rows.push(
				`    [${ref.severity.toUpperCase()}] ${ref.message} (ref: ${ref.referenceValue})`,
			);
			diagnosticCount++;
		}
	}

	// Cycles
	if (graph.cycles.length > 0 && filter?.includeCycles !== false) {
		if (rows.length === 0) {
			rows.push('');
			rows.push('Warnings');
			rows.push('--------');
		}
		rows.push(`  Cycles detected: ${graph.cycles.length}`);
		for (const cycle of graph.cycles) {
			rows.push(
				`    [${cycle.severity.toUpperCase()}] Cycle involving: ${cycle.nodeIds.join(' -> ')}`,
			);
			diagnosticCount++;
		}
	}

	// Staleness warnings
	if (stalenessResult) {
		if (stalenessResult.optionalDependencyWarnings.length > 0) {
			if (rows.length === 0) {
				rows.push('');
				rows.push('Warnings');
				rows.push('--------');
			}
			rows.push(
				`  Optional dependency warnings: ${stalenessResult.optionalDependencyWarnings.length}`,
			);
			for (const warn of stalenessResult.optionalDependencyWarnings) {
				rows.push(`    [${warn.severity.toUpperCase()}] ${warn.message}`);
				diagnosticCount++;
			}
		}

		// Top staleness diagnostics
		for (const diag of stalenessResult.diagnostics.slice(0, 5)) {
			if (rows.length === 0) {
				rows.push('');
				rows.push('Warnings');
				rows.push('--------');
			}
			rows.push(
				`    [${diag.severity.toUpperCase()}] ${diag.message}${diag.recoveryHint ? ` (recovery: ${diag.recoveryHint})` : ''}`,
			);
			diagnosticCount++;
		}
	}

	// Graph diagnostics
	for (const diag of graph.diagnostics) {
		if (rows.length === 0) {
			rows.push('');
			rows.push('Warnings');
			rows.push('--------');
		}
		rows.push(
			`    [${diag.severity.toUpperCase()}] ${diag.message}${diag.recoveryHint ? ` (recovery: ${diag.recoveryHint})` : ''}`,
		);
		diagnosticCount++;
	}

	if (rows.length === 0) {
		rows.push('');
		rows.push('Warnings');
		rows.push('--------');
		rows.push('  (none)');
	}

	return {
		diagnosticCount,
		rows,
		title: 'Warnings',
	};
}

function graphSummaryFromGraph(
	graph: DocumentDependencyGraph,
	stalenessResult?: StalenessDetectionResult,
): GraphOutputSummary {
	const outputCountByKind: Record<string, number> = {};
	const edgeCountByKind: Record<string, number> = {};

	for (const node of graph.nodes) {
		if (isOutputKind(node.kind)) {
			outputCountByKind[node.kind] = (outputCountByKind[node.kind] ?? 0) + 1;
		}
	}

	for (const edge of graph.edges) {
		edgeCountByKind[edge.kind] = (edgeCountByKind[edge.kind] ?? 0) + 1;
	}

	const outputCount = graph.nodes.filter((n) => isOutputKind(n.kind)).length;

	return {
		cycleCount: graph.cycles.length,
		documentCount: graph.nodes.filter((n) => n.kind === 'document').length,
		edgeCount: graph.edges.length,
		edgeCountByKind,
		outputCount,
		outputCountByKind,
		phaseCount: graph.nodes.filter((n) => n.kind === 'phase').length,
		profileId: graph.profileId,
		stalenessBlockedCount: stalenessResult?.summary.blockedCount ?? 0,
		stalenessCurrentCount: stalenessResult?.summary.currentCount ?? 0,
		stalenessMissingCount: stalenessResult?.summary.missingCount ?? 0,
		stalenessOrphanedCount: stalenessResult?.summary.orphanedCount ?? 0,
		stalenessStaleCount: stalenessResult?.summary.staleCount ?? 0,
		stalenessUnknownCount: stalenessResult?.summary.unknownCount ?? 0,
		unresolvedReferenceCount: graph.unresolvedReferences.length,
	};
}

// ---------------------------------------------------------------------------
// JSON report builder
// ---------------------------------------------------------------------------

function buildJsonReport(
	graph: DocumentDependencyGraph,
	options: GraphOutputOptions,
	stalenessResult?: StalenessDetectionResult,
): GraphJsonReport {
	const filter = options.filter;
	const includeExec = filter?.includeExecutiveOutputs !== false;
	const includeDerived = filter?.includeDerivedArtifacts !== false;
	const generatedAt = options.generatedAt ?? new Date().toISOString();

	// Summary
	const summary = graphSummaryFromGraph(graph, stalenessResult);

	// Nodes
	const nodes: GraphOutputNodeSummary[] = [];
	for (const node of graph.nodes) {
		if (filter?.phaseId && node.phaseId !== filter.phaseId) continue;
		if (filter?.documentId && node.documentCanonicalId !== filter.documentId)
			continue;

		const status = resolveStalenessStatus(node, stalenessResult);
		nodes.push({
			documentCanonicalId: node.documentCanonicalId,
			id: node.id,
			isBlocked: status === 'blocked',
			isCanonical: node.isCanonical,
			isMissing: status === 'missing',
			isStale:
				status === 'stale' || status === 'blocked' || status === 'missing',
			kind: node.kind,
			label: node.label,
			outputTargetPath: node.outputTargetPath,
			phaseId: node.phaseId,
			stalenessStatus: status,
			title: node.title,
		});
	}

	// Edges
	const edges: GraphOutputEdgeSummary[] = [];
	if (filter?.includeFullEdges) {
		for (const edge of graph.edges) {
			edges.push({
				fromNodeId: edge.fromNodeId,
				id: edge.id,
				kind: edge.kind,
				required: edge.required,
				toNodeId: edge.toNodeId,
			});
		}
	}

	// Phases
	const phases: GraphOutputPhaseSummary[] = [];
	for (const phaseNode of graph.nodes.filter((n) => n.kind === 'phase')) {
		if (filter?.phaseId && phaseNode.phaseId !== filter.phaseId) continue;

		const phaseId = phaseNode.phaseId ?? phaseNode.label;
		const phaseDocs = graph.nodes.filter(
			(d) => d.kind === 'document' && d.phaseId === phaseId,
		);
		const documents: GraphOutputDocumentSummary[] = [];

		for (const doc of phaseDocs) {
			if (filter?.documentId && doc.documentCanonicalId !== filter.documentId)
				continue;

			const docId = doc.documentCanonicalId ?? '';
			const upstreamCount =
				graph.upstreamEdges.get(doc.id)?.filter((e) => e.kind === 'depends_on')
					.length ?? 0;
			const downstreamCount =
				graph.downstreamEdges
					.get(doc.id)
					?.filter((e) => e.kind === 'depends_on').length ?? 0;
			const outputs = graph.outputsByDocumentId.get(docId) ?? [];
			const status = resolveStalenessStatus(doc, stalenessResult);

			documents.push({
				canonicalId: docId,
				canonicalOutputs: outputs
					.filter((o) => o.kind === 'canonical_output')
					.map((o) => o.id),
				derivedOutputs: outputs
					.filter((o) => o.kind !== 'canonical_output')
					.map((o) => o.id),
				downstreamCount,
				outputCount: outputs.length,
				phaseId,
				stalenessStatus: status,
				title: doc.title || doc.label,
				upstreamCount,
			});
		}

		phases.push({
			documentCount: documents.length,
			documents,
			phaseId,
			title: phaseNode.title || phaseNode.label,
		});
	}

	// Documents (flat list, filtered)
	const allDocuments: GraphOutputDocumentSummary[] = [];
	for (const doc of graph.nodes.filter((n) => n.kind === 'document')) {
		if (filter?.documentId && doc.documentCanonicalId !== filter.documentId)
			continue;
		if (filter?.phaseId && doc.phaseId !== filter.phaseId) continue;

		const docId = doc.documentCanonicalId ?? '';
		const outputs = graph.outputsByDocumentId.get(docId) ?? [];
		const status = resolveStalenessStatus(doc, stalenessResult);

		allDocuments.push({
			canonicalId: docId,
			canonicalOutputs: outputs
				.filter((o) => o.kind === 'canonical_output')
				.map((o) => o.id),
			derivedOutputs: outputs
				.filter((o) => o.kind !== 'canonical_output')
				.map((o) => o.id),
			downstreamCount:
				graph.downstreamEdges
					.get(doc.id)
					?.filter((e) => e.kind === 'depends_on').length ?? 0,
			outputCount: outputs.length,
			phaseId: doc.phaseId ?? '',
			stalenessStatus: status,
			title: doc.title || doc.label,
			upstreamCount:
				graph.upstreamEdges.get(doc.id)?.filter((e) => e.kind === 'depends_on')
					.length ?? 0,
		});
	}

	// Outputs
	const outputSummaries: GraphOutputNodeSummary[] = [];
	for (const outNode of graph.nodes.filter((n) => isOutputKind(n.kind))) {
		if (!includeDerived && outNode.kind !== 'canonical_output') continue;
		if (!includeExec && isExecutiveKind(outNode.kind)) continue;
		if (filter?.outputKind && outNode.kind !== filter.outputKind) continue;
		if (filter?.phaseId && outNode.phaseId !== filter.phaseId) continue;
		if (filter?.documentId && outNode.documentCanonicalId !== filter.documentId)
			continue;

		const status = resolveStalenessStatus(outNode, stalenessResult);
		outputSummaries.push({
			documentCanonicalId: outNode.documentCanonicalId,
			id: outNode.id,
			isBlocked: status === 'blocked',
			isCanonical: outNode.isCanonical,
			isMissing: status === 'missing',
			isStale:
				status === 'stale' || status === 'blocked' || status === 'missing',
			kind: outNode.kind,
			label: outNode.label,
			outputTargetPath: outNode.outputTargetPath,
			phaseId: outNode.phaseId,
			stalenessStatus: status,
			title: outNode.title,
		});
	}

	// Staleness items
	const stalenessItems: GraphOutputStalenessItem[] = [];
	if (stalenessResult) {
		for (const target of stalenessResult.targets) {
			if (filter?.stalenessStatus && target.status !== filter.stalenessStatus)
				continue;
			if (
				filter?.documentId &&
				target.documentCanonicalId !== filter.documentId
			)
				continue;
			if (filter?.phaseId && target.phaseId !== filter.phaseId) continue;

			stalenessItems.push({
				documentId: target.documentCanonicalId,
				outputKind: target.targetKind,
				outputPath: target.outputPath,
				phaseId: target.phaseId,
				status: target.status as GraphOutputStatus,
				targetId: target.targetId,
			});
		}
	}

	// Diagnostics
	const outputDiagnostics: GraphOutputDiagnostic[] = [];

	for (const diag of graph.diagnostics) {
		outputDiagnostics.push({
			code: diag.code,
			documentCanonicalId: diag.documentCanonicalId,
			message: diag.message,
			nodeId: diag.nodeId,
			phaseId: diag.phaseId,
			pointer: diag.fieldPath,
			recoveryHint: diag.recoveryHint,
			relatedOutputId: diag.edgeId,
			severity: diag.severity,
			sourcePath: diag.sourcePath,
		});
	}

	if (stalenessResult) {
		for (const diag of stalenessResult.diagnostics) {
			outputDiagnostics.push({
				code: diag.code,
				documentCanonicalId: diag.documentCanonicalId,
				message: diag.message,
				nodeId: diag.graphNodeId,
				phaseId: diag.phaseId,
				pointer: diag.fieldPath,
				recoveryHint: diag.recoveryHint,
				relatedOutputId: diag.artifactId,
				severity: diag.severity,
				sourcePath: diag.sourcePath,
			});
		}
	}

	return {
		diagnostics: outputDiagnostics,
		documents: allDocuments,
		edges,
		formatVersion: FORMAT_VERSION,
		nodes,
		outputs: outputSummaries,
		phases,
		profileId: graph.profileId,
		renderedAt: generatedAt,
		staleness: {
			blockedCount: stalenessResult?.summary.blockedCount ?? 0,
			currentCount: stalenessResult?.summary.currentCount ?? 0,
			items: stalenessItems,
			missingCount: stalenessResult?.summary.missingCount ?? 0,
			orphanedCount: stalenessResult?.summary.orphanedCount ?? 0,
			staleCount: stalenessResult?.summary.staleCount ?? 0,
			unknownCount: stalenessResult?.summary.unknownCount ?? 0,
		},
		summary,
	};
}

// ---------------------------------------------------------------------------
// Public render functions
// ---------------------------------------------------------------------------

export function renderGraphTextReport(
	input: GraphOutputInput,
	options: GraphOutputOptions = {},
): GraphOutputResult {
	const { graph, stalenessResult, regenerationPlan } = input;
	const mode = options.mode ?? 'summary';

	const { sections, diagnostics } = buildTextSections(
		graph,
		options,
		stalenessResult,
		regenerationPlan,
	);

	const textReport: GraphTextReport = {
		diagnosticCount: diagnostics.length,
		hasDiagnostics: diagnostics.length > 0,
		profileId: graph.profileId,
		renderMode: mode,
		sections,
	};

	const textOutput = `${sections.map((s) => s.rows.join('\n')).join('\n')}\n`;

	return {
		diagnostics,
		format: 'text',
		textOutput,
		textReport,
	};
}

export function renderGraphJsonReport(
	input: GraphOutputInput,
	options: GraphOutputOptions = {},
): GraphOutputResult {
	const { graph, stalenessResult } = input;

	const jsonReport = buildJsonReport(graph, options, stalenessResult);

	const jsonOutput = `${JSON.stringify(jsonReport, null, 2)}\n`;

	return {
		diagnostics: jsonReport.diagnostics,
		format: 'json',
		jsonOutput,
		jsonReport,
	};
}

export function createInspectableGraphOutput(
	input: GraphOutputInput,
	options: GraphOutputOptions = {},
): GraphOutputResult {
	const format = options.format ?? 'text';

	if (format === 'json') {
		return renderGraphJsonReport(input, options);
	}

	return renderGraphTextReport(input, options);
}
