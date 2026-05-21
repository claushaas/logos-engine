/** Generation Planner — read-only planning service for canonical Markdown generation */

import type { DependencyReference } from '../profiles/contract-graph.js';
import type { CanonicalDocumentId } from '../profiles/documentation-contract.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';
import type {
	DependencySatisfaction,
	GenerationAction,
	GenerationBlocker,
	GenerationDependencyState,
	GenerationDryRunSummary,
	GenerationGap,
	GenerationPlan,
	GenerationPlanDiagnostic,
	GenerationPlanInput,
	GenerationPlanItem,
	GenerationPlanOptions,
	GenerationPlanResult,
	GenerationPlanSummaryCounts,
	GenerationReadiness,
	GenerationStalenessReason,
} from './generation-planner-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zeroCounts(): GenerationPlanSummaryCounts {
	return {
		blocked: 0,
		failed: 0,
		generate: 0,
		incomplete: 0,
		skip: 0,
		stale: 0,
		update: 0,
	};
}

function createDiagnostic(
	code: string,
	severity: GenerationPlanDiagnostic['severity'],
	message: string,
	sourceDocumentId?: string | undefined,
	sourcePath?: string | undefined,
	fieldPath?: string | undefined,
	recoveryHint?: string | undefined,
): GenerationPlanDiagnostic {
	const d: GenerationPlanDiagnostic = { code, message, severity };
	if (sourceDocumentId !== undefined) d.sourceDocumentId = sourceDocumentId;
	if (sourcePath !== undefined) d.sourcePath = sourcePath;
	if (fieldPath !== undefined) d.fieldPath = fieldPath;
	if (recoveryHint !== undefined) d.recoveryHint = recoveryHint;
	return d;
}

function createBlocker(
	code: string,
	message: string,
	sourceDocumentId?: string | undefined,
	sourcePath?: string | undefined,
	fieldPath?: string | undefined,
	recoveryHint?: string | undefined,
): GenerationBlocker {
	const b: GenerationBlocker = { code, message };
	if (sourceDocumentId !== undefined) b.sourceDocumentId = sourceDocumentId;
	if (sourcePath !== undefined) b.sourcePath = sourcePath;
	if (fieldPath !== undefined) b.fieldPath = fieldPath;
	if (recoveryHint !== undefined) b.recoveryHint = recoveryHint;
	return b;
}

function createGap(
	code: string,
	message: string,
	sourceDocumentId?: string | undefined,
	sectionId?: string | undefined,
	inputId?: string | undefined,
	recoveryHint?: string | undefined,
): GenerationGap {
	const g: GenerationGap = { code, message };
	if (sourceDocumentId !== undefined) g.sourceDocumentId = sourceDocumentId;
	if (sectionId !== undefined) g.sectionId = sectionId;
	if (inputId !== undefined) g.inputId = inputId;
	if (recoveryHint !== undefined) g.recoveryHint = recoveryHint;
	return g;
}

function createStalenessReason(
	code: string,
	message: string,
	upstreamDocumentId?: string | undefined,
	upstreamTimestamp?: string | undefined,
	artifactTimestamp?: string | undefined,
): GenerationStalenessReason {
	const s: GenerationStalenessReason = { code, message };
	if (upstreamDocumentId !== undefined)
		s.upstreamDocumentId = upstreamDocumentId;
	if (upstreamTimestamp !== undefined) s.upstreamTimestamp = upstreamTimestamp;
	if (artifactTimestamp !== undefined) s.artifactTimestamp = artifactTimestamp;
	return s;
}

// ---------------------------------------------------------------------------
// Output path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a canonical output path from the descriptor into a documentation-root-relative path.
 *
 * The descriptor canonical path (e.g. `docs/03-product/01-product-brief.md`)
 * has its first segment stripped and replaced with the configured documentation root.
 */
function resolveOutputTarget(
	canonicalOutputPath: string,
	documentationRoot: string,
): string {
	const segments = canonicalOutputPath.split('/');
	if (segments.length <= 1) {
		return `${documentationRoot.replace(/\/$/, '')}/${canonicalOutputPath}`;
	}
	const withoutFirstSegment = segments.slice(1).join('/');
	const root = documentationRoot.endsWith('/')
		? documentationRoot
		: `${documentationRoot}/`;
	return `${root}${withoutFirstSegment}`;
}

// ---------------------------------------------------------------------------
// Confirmed state lookup helpers
// ---------------------------------------------------------------------------

function getConfirmedDecisionIds(
	canonicalId: CanonicalDocumentId,
	state: WorkspaceState,
): string[] {
	return state.decisions
		.filter(
			(d) =>
				d.status === 'confirmed' && d.affectedDocumentIds.includes(canonicalId),
		)
		.map((d) => d.id);
}

function getActiveAssumptionIds(
	canonicalId: CanonicalDocumentId,
	state: WorkspaceState,
): string[] {
	return state.assumptions
		.filter(
			(a) =>
				a.status === 'active' && a.affectedDocumentIds.includes(canonicalId),
		)
		.map((a) => a.id);
}

function getUnresolvedQuestionIds(
	canonicalId: CanonicalDocumentId,
	state: WorkspaceState,
): string[] {
	return state.openQuestions
		.filter(
			(q) => q.status === 'open' && q.affectedDocumentIds.includes(canonicalId),
		)
		.map((q) => q.id);
}

function getRelatedRiskIds(
	canonicalId: CanonicalDocumentId,
	state: WorkspaceState,
): string[] {
	return state.risks
		.filter((r) => r.affectedDocumentIds.includes(canonicalId))
		.map((r) => r.id);
}

function getAcceptedProposalsForDocument(
	canonicalId: CanonicalDocumentId,
	state: WorkspaceState,
): string[] {
	return state.proposals
		.filter(
			(p) =>
				p.status === 'accepted' &&
				(p.sourceDocumentCanonicalId === canonicalId ||
					(p.sourceDocumentCanonicalId === undefined &&
						p.sourcePhaseId === canonicalId)),
		)
		.map((p) => p.proposalId);
}

// ---------------------------------------------------------------------------
// Dependency evaluation
// ---------------------------------------------------------------------------

function evaluateDependencyState(
	dep: DependencyReference,
	alreadyPlanned: Map<CanonicalDocumentId, GenerationPlanItem>,
	diagnostics: GenerationPlanDiagnostic[],
): GenerationDependencyState {
	const targetId = dep.targetDocumentCanonicalId;

	if (targetId === undefined) {
		const diag = createDiagnostic(
			'E_GENPLAN_UNRESOLVED_DEPENDENCY',
			'error',
			`Dependency target "${dep.targetDocumentId}" does not resolve to a known document`,
			dep.sourceDocumentCanonicalId,
			dep.sourcePath,
			dep.fieldPath,
			'Verify the dependency target is a valid canonical document ID in the profile contract',
		);
		diagnostics.push(diag);
		const ds: GenerationDependencyState = {
			dependencyCanonicalId: undefined,
			dependencyRawId: dep.targetDocumentId,
			satisfied: false,
			status: 'unknown',
		};
		ds.reason = `Unresolved dependency target: ${dep.targetDocumentId}`;
		return ds;
	}

	const planned = alreadyPlanned.get(targetId);

	if (planned === undefined) {
		// Dependency exists in contract but hasn't been evaluated yet.
		// This shouldn't happen with topological order, but handle defensively.
		const ds: GenerationDependencyState = {
			dependencyCanonicalId: targetId,
			dependencyRawId: dep.targetDocumentId,
			satisfied: false,
			status: 'unknown',
		};
		ds.reason = `Dependency "${targetId}" has not been evaluated yet`;
		return ds;
	}

	// Map the dependency's planned action to a satisfaction status.
	const status = planActionToDependencyStatus(planned.action);
	const ds: GenerationDependencyState = {
		dependencyCanonicalId: targetId,
		dependencyRawId: dep.targetDocumentId,
		satisfied: satisfactionIsFulfilled(status),
		status,
	};
	if (status !== 'satisfied') {
		ds.reason = `Dependency "${targetId}" is ${planned.action}`;
	}
	return ds;
}

function planActionToDependencyStatus(
	action: GenerationAction,
): DependencySatisfaction {
	switch (action) {
		case 'generate':
			return 'satisfied';
		case 'update':
			return 'satisfied';
		case 'skip':
			return 'satisfied';
		case 'incomplete':
			return 'incomplete';
		case 'blocked':
			return 'blocked';
		case 'failed':
			return 'failed';
		case 'stale':
			return 'stale';
	}
}

function satisfactionIsFulfilled(status: DependencySatisfaction): boolean {
	return status === 'satisfied';
}

function isBlockingDependencyStatus(status: DependencySatisfaction): boolean {
	return status === 'blocked' || status === 'failed' || status === 'missing';
}

// ---------------------------------------------------------------------------
// Input/section evaluation
// ---------------------------------------------------------------------------

interface InputEvaluation {
	requiredInputIds: string[];
	unsatisfiedRequiredInputs: { id: string; type: string }[];
}

function evaluateRequiredInputs(
	_canonicalId: CanonicalDocumentId,
	descriptorInputs:
		| { id: string; type: string; required?: boolean }[]
		| undefined,
): InputEvaluation {
	const requiredInputIds: string[] = [];
	const unsatisfiedRequiredInputs: { id: string; type: string }[] = [];

	if (descriptorInputs === undefined || descriptorInputs.length === 0) {
		return { requiredInputIds, unsatisfiedRequiredInputs };
	}

	for (const input of descriptorInputs) {
		if (input.required) {
			requiredInputIds.push(input.id);
			// Required inputs that need confirmed state are unsatisfied by default.
			// A downstream module (renderer) fills content; the planner marks gaps.
			unsatisfiedRequiredInputs.push({ id: input.id, type: input.type });
		}
	}

	return { requiredInputIds, unsatisfiedRequiredInputs };
}

interface SectionEvaluation {
	requiredSectionIds: string[];
}

function evaluateRequiredSections(
	descriptorSections: { id: string; required?: boolean }[] | undefined,
): SectionEvaluation {
	const requiredSectionIds: string[] = [];

	if (descriptorSections === undefined || descriptorSections.length === 0) {
		return { requiredSectionIds };
	}

	for (const section of descriptorSections) {
		if (section.required !== false) {
			requiredSectionIds.push(section.id);
		}
	}

	return { requiredSectionIds };
}

// ---------------------------------------------------------------------------
// Artifact staleness evaluation
// ---------------------------------------------------------------------------

function findExistingArtifact(
	canonicalId: CanonicalDocumentId,
	resolvedPath: string,
	state: WorkspaceState,
): WorkspaceState['artifacts'][number] | undefined {
	for (const artifact of state.artifacts) {
		if (
			artifact.isCanonical &&
			artifact.artifactType === 'canonical_markdown' &&
			(artifact.path === resolvedPath ||
				artifact.sourceDocumentIds.includes(canonicalId))
		) {
			return artifact;
		}
	}
	return undefined;
}

function evaluateStaleness(
	canonicalId: CanonicalDocumentId,
	existing: WorkspaceState['artifacts'][number] | undefined,
	state: WorkspaceState,
): {
	stale: boolean;
	reasons: GenerationStalenessReason[];
} {
	const reasons: GenerationStalenessReason[] = [];

	if (existing === undefined || existing.generatedAt === undefined) {
		return { reasons, stale: false };
	}

	const generatedAt = existing.generatedAt;

	// Check if any confirmed decision has been updated after generation.
	for (const decision of state.decisions) {
		if (
			decision.status === 'confirmed' &&
			decision.affectedDocumentIds.includes(canonicalId) &&
			decision.updatedAt !== undefined &&
			decision.updatedAt > generatedAt
		) {
			reasons.push(
				createStalenessReason(
					'E_GENPLAN_STALE_DECISION',
					`Confirmed decision "${decision.id}" was updated after artifact generation`,
					canonicalId,
					decision.updatedAt,
					generatedAt,
				),
			);
		}
	}

	// Check if any active assumption has been updated after generation.
	for (const assumption of state.assumptions) {
		if (
			assumption.status === 'active' &&
			assumption.affectedDocumentIds.includes(canonicalId) &&
			assumption.updatedAt !== undefined &&
			assumption.updatedAt > generatedAt
		) {
			reasons.push(
				createStalenessReason(
					'E_GENPLAN_STALE_ASSUMPTION',
					`Active assumption "${assumption.id}" was updated after artifact generation`,
					canonicalId,
					assumption.updatedAt,
					generatedAt,
				),
			);
		}
	}

	return { reasons, stale: reasons.length > 0 };
}

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

/**
 * Sort document canonical IDs in topological order based on dependsOn edges.
 * Documents with no dependencies or with satisfied reverse-topological order
 * come first. Fallback to original document order when cycles exist.
 */
function topologicalDocumentOrder(
	canonicalIds: CanonicalDocumentId[],
	deps: DependencyReference[],
): CanonicalDocumentId[] {
	const adjacency = new Map<CanonicalDocumentId, CanonicalDocumentId[]>();
	const inDegree = new Map<CanonicalDocumentId, number>();

	for (const id of canonicalIds) {
		adjacency.set(id, []);
		inDegree.set(id, 0);
	}

	for (const dep of deps) {
		if (dep.kind !== 'dependsOn') continue;
		if (dep.targetDocumentCanonicalId === undefined) continue;
		const sourceList = adjacency.get(dep.targetDocumentCanonicalId);
		if (sourceList !== undefined) {
			sourceList.push(dep.sourceDocumentCanonicalId);
		}
		const currentDegree = inDegree.get(dep.sourceDocumentCanonicalId);
		if (currentDegree !== undefined) {
			inDegree.set(dep.sourceDocumentCanonicalId, currentDegree + 1);
		}
	}

	// Kahn's algorithm
	const queue: CanonicalDocumentId[] = [];
	for (const [id, degree] of inDegree) {
		if (degree === 0) {
			queue.push(id);
		}
	}

	const sorted: CanonicalDocumentId[] = [];
	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) break;
		sorted.push(current);
		for (const neighbor of adjacency.get(current) ?? []) {
			const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
			inDegree.set(neighbor, newDegree);
			if (newDegree === 0) {
				queue.push(neighbor);
			}
		}
	}

	// If sorted doesn't contain all IDs (cycle detected), fall back to original order.
	if (sorted.length !== canonicalIds.length) {
		return canonicalIds;
	}

	return sorted;
}

// ---------------------------------------------------------------------------
// Main planning logic
// ---------------------------------------------------------------------------

export function createGenerationPlan(
	input: GenerationPlanInput,
	options: GenerationPlanOptions = {},
): GenerationPlanResult {
	const diagnostics: GenerationPlanDiagnostic[] = [];
	const { contract, graph, state } = input;

	const documentationRoot =
		options.documentationRootOverride ?? state.documentation.rootPath;
	const dryRun = options.dryRun ?? true;
	const generatedAt = options.generatedAt ?? new Date().toISOString();

	// Validate inputs
	if (contract.documents.length === 0) {
		diagnostics.push(
			createDiagnostic(
				'E_GENPLAN_EMPTY_CONTRACT',
				'error',
				'Documentation contract contains no documents',
				undefined,
				contract.registryPath,
				undefined,
				'Verify the profile contract is correctly loaded with document descriptors',
			),
		);
	}

	if (graph.nodes.length === 0 && contract.documents.length > 0) {
		diagnostics.push(
			createDiagnostic(
				'E_GENPLAN_EMPTY_GRAPH',
				'error',
				'Contract graph contains no nodes despite loaded contract documents',
				undefined,
				contract.registryPath,
				undefined,
				'Rebuild the contract graph from the documentation contract',
			),
		);
	}

	if (
		!state.documentation.rootPath ||
		state.documentation.rootPath.length === 0
	) {
		diagnostics.push(
			createDiagnostic(
				'E_GENPLAN_MISSING_ROOT',
				'error',
				'Documentation root is not configured in workspace state',
				undefined,
				undefined,
				'documentation.rootPath',
				'Run /init or configure documentation root in workspace state',
			),
		);
	}

	// Get documents in deterministic order, then topologically sort by dependencies.
	const orderedIds = contract.documents.map((d) => d.canonicalId);
	const topoSortedIds = topologicalDocumentOrder(
		orderedIds,
		graph.dependencies,
	);

	const alreadyPlanned = new Map<CanonicalDocumentId, GenerationPlanItem>();
	const items: GenerationPlanItem[] = [];

	for (let orderIdx = 0; orderIdx < topoSortedIds.length; orderIdx++) {
		const canonicalId = topoSortedIds[orderIdx];
		if (canonicalId === undefined) continue;
		const doc = contract.documentsByCanonicalId.get(canonicalId);
		const node = graph.getNodeByCanonicalId(canonicalId);

		if (doc === undefined || node === undefined) {
			diagnostics.push(
				createDiagnostic(
					'E_GENPLAN_MISSING_DOCUMENT',
					'error',
					`Document "${canonicalId}" is referenced but not found in the contract or graph`,
					canonicalId,
				),
			);
			continue;
		}

		// Find canonical output.
		const outputs = graph.getOutputsByDocumentId(canonicalId);
		const canonicalOutput = outputs.find((o) => o.kind === 'canonical');

		if (canonicalOutput === undefined) {
			const blockers: GenerationBlocker[] = [
				createBlocker(
					'E_GENPLAN_MISSING_CANONICAL_OUTPUT',
					`Document "${canonicalId}" has no canonical output declaration`,
					canonicalId,
					doc.sourcePath,
					'outputs.canonical',
					'Add a canonical output declaration to the document descriptor',
				),
			];
			const planItem = createFailedItem(
				input,
				options,
				doc.sourcePath,
				canonicalId,
				doc.descriptor.id,
				doc.phaseId,
				'',
				'',
				orderIdx,
				blockers,
				diagnostics,
			);
			items.push(planItem);
			alreadyPlanned.set(canonicalId, planItem);
			continue;
		}

		const canonicalOutputPath = canonicalOutput.path;
		const resolvedPath = resolveOutputTarget(
			canonicalOutputPath,
			documentationRoot,
		);

		// Evaluate dependencies.
		const sourceDeps = graph.getDependenciesBySourceDocumentId(canonicalId);
		const dependsOnDeps = sourceDeps.filter((d) => d.kind === 'dependsOn');

		const dependencyStates: GenerationDependencyState[] = [];
		const allDepsSatisfied = evaluateDocumentDependencies(
			dependsOnDeps,
			alreadyPlanned,
			dependencyStates,
			diagnostics,
		);

		// Evaluate required inputs.
		const inputEval = evaluateRequiredInputs(
			canonicalId,
			doc.descriptor.inputs,
		);

		// Evaluate required sections.
		const sectionEval = evaluateRequiredSections(doc.descriptor.sections);

		// Gather confirmed state.
		const confirmedDecisions = getConfirmedDecisionIds(canonicalId, state);
		const confirmedAssumptions = getActiveAssumptionIds(canonicalId, state);
		const unresolvedQuestions = getUnresolvedQuestionIds(canonicalId, state);
		const relatedRisks = getRelatedRiskIds(canonicalId, state);
		const acceptedProposals = getAcceptedProposalsForDocument(
			canonicalId,
			state,
		);

		// Check for proposed (unaccepted) proposals referencing this document.
		const proposedProposals = state.proposals.filter(
			(p) =>
				p.status === 'proposed' && p.sourceDocumentCanonicalId === canonicalId,
		);
		if (proposedProposals.length > 0) {
			diagnostics.push(
				createDiagnostic(
					'E_GENPLAN_PROPOSED_AS_CONFIRMED',
					'warning',
					`${proposedProposals.length} proposed (unaccepted) proposal(s) reference document "${canonicalId}" but are not treated as confirmed state`,
					canonicalId,
					doc.sourcePath,
					undefined,
					'Accept proposals via /continue or via API to convert to confirmed state',
				),
			);
		}

		// Check for gaps in required inputs.
		const blockers: GenerationBlocker[] = [];
		const gaps: GenerationGap[] = [];

		for (const input of inputEval.unsatisfiedRequiredInputs) {
			gaps.push(
				createGap(
					'E_GENPLAN_REQUIRED_INPUT_UNSATISFIED',
					`Required input "${input.id}" (type: ${input.type}) has no confirmed state`,
					canonicalId,
					undefined,
					input.id,
					'Provide confirmed decisions, assumptions, or intake answers for this input',
				),
			);
		}

		// Check for required sections without reasonable confirmed state support.
		// If there are required sections but no confirmed decisions, assumptions, or accepted
		// proposals, each required section becomes a gap.
		const hasConfirmedContent =
			confirmedDecisions.length > 0 ||
			confirmedAssumptions.length > 0 ||
			acceptedProposals.length > 0;

		if (!hasConfirmedContent && sectionEval.requiredSectionIds.length > 0) {
			for (const sectionId of sectionEval.requiredSectionIds) {
				gaps.push(
					createGap(
						'E_GENPLAN_REQUIRED_SECTION_UNSATISFIED',
						`Required section "${sectionId}" has no confirmed state to draw from`,
						canonicalId,
						sectionId,
						undefined,
						'Provide confirmed decisions, assumptions, or accepted proposals relevant to this document',
					),
				);
			}
		}

		// Check for unresolved questions that affect this document.
		if (unresolvedQuestions.length > 0) {
			for (const questionId of unresolvedQuestions) {
				const q = state.openQuestions.find((o) => o.id === questionId);
				if (q !== undefined) {
					gaps.push(
						createGap(
							'E_GENPLAN_UNRESOLVED_QUESTION',
							`Unresolved question "${q.question}" (id: ${questionId}) may affect document content`,
							canonicalId,
							undefined,
							questionId,
							'Answer the question or mark it as deferred/obsolete',
						),
					);
				}
			}
		}

		// Check for existing artifact and staleness.
		const existingArtifact = findExistingArtifact(
			canonicalId,
			resolvedPath,
			state,
		);
		const stalenessResult = evaluateStaleness(
			canonicalId,
			existingArtifact,
			state,
		);

		// Evaluate dependency blockers.
		for (const depState of dependencyStates) {
			if (isBlockingDependencyStatus(depState.status)) {
				blockers.push(
					createBlocker(
						'E_GENPLAN_DEPENDENCY_BLOCKED',
						`Dependency "${depState.dependencyRawId}" is ${depState.status}`,
						canonicalId,
						doc.sourcePath,
						'dependsOn',
						`Resolve the ${depState.status} status of the dependency first`,
					),
				);
			}
		}

		// Check blocked/incomplete transitive dependency effect.
		for (const depState of dependencyStates) {
			if (depState.status === 'incomplete') {
				gaps.push(
					createGap(
						'E_GENPLAN_DEPENDENCY_INCOMPLETE',
						`Dependency "${depState.dependencyRawId}" is incomplete; downstream content may be affected`,
						canonicalId,
						undefined,
						depState.dependencyRawId,
					),
				);
			}
		}

		// Determine the action.
		const action = classifyAction(
			blockers,
			gaps,
			dependencyStates,
			existingArtifact,
			stalenessResult,
			hasConfirmedContent,
		);

		const planItem: GenerationPlanItem = {
			action,
			blockers,
			canonicalOutputPath,
			confirmedAssumptionIds: confirmedAssumptions,
			confirmedDecisionIds: confirmedDecisions,
			dependencyState: dependencyStates,
			descriptorSourcePath: doc.sourcePath,
			documentationRootRelativePath: resolvedPath,
			documentCanonicalId: canonicalId,
			documentId: doc.descriptor.id,
			dryRun,
			gaps,
			orderIndex: orderIdx,
			phaseId: doc.phaseId,
			readiness: buildReadiness(allDepsSatisfied, gaps.length > 0, blockers),
			relatedRiskIds: relatedRisks,
			requiredInputIds: inputEval.requiredInputIds,
			requiredSectionIds: sectionEval.requiredSectionIds,
			staleReasons: stalenessResult.reasons,
			unresolvedQuestionIds: unresolvedQuestions,
		};

		items.push(planItem);
		alreadyPlanned.set(canonicalId, planItem);
	}

	// Build plan summary.
	const actionCounts = { ...zeroCounts() };
	for (const item of items) {
		actionCounts[item.action]++;
	}

	const blockersSummary: GenerationBlocker[] = [];
	const gapsSummary: GenerationGap[] = [];
	const staleSummary: GenerationStalenessReason[] = [];

	for (const item of items) {
		blockersSummary.push(...item.blockers);
		gapsSummary.push(...item.gaps);
		staleSummary.push(...item.staleReasons);
	}

	const plan: GenerationPlan = {
		actionCounts,
		blockersSummary,
		diagnostics,
		documentationRoot,
		dryRun,
		gapsSummary,
		generatedAt,
		items,
		profileId: contract.profileId,
		staleSummary,
		totalDocumentCount: items.length,
	};

	return { diagnostics, plan };
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function createFailedItem(
	_input: GenerationPlanInput,
	_options: GenerationPlanOptions,
	descriptorSourcePath: string,
	canonicalId: string,
	documentId: string,
	phaseId: string,
	canonicalOutputPath: string,
	resolvedPath: string,
	orderIndex: number,
	blockers: GenerationBlocker[],
	diagnostics: GenerationPlanDiagnostic[],
): GenerationPlanItem {
	for (const blocker of blockers) {
		diagnostics.push(
			createDiagnostic(
				blocker.code as string,
				'error',
				blocker.message,
				canonicalId,
				descriptorSourcePath,
				blocker.fieldPath,
				blocker.recoveryHint,
			),
		);
	}

	return {
		action: 'failed',
		blockers,
		canonicalOutputPath,
		confirmedAssumptionIds: [],
		confirmedDecisionIds: [],
		dependencyState: [],
		descriptorSourcePath,
		documentationRootRelativePath: resolvedPath,
		documentCanonicalId: canonicalId,
		documentId,
		dryRun: _options.dryRun ?? true,
		gaps: [],
		orderIndex,
		phaseId,
		readiness: {
			blockers,
			dependencyReady: false,
			gaps: [],
			inputsReady: false,
			ready: false,
			sectionsReady: false,
		},
		relatedRiskIds: [],
		requiredInputIds: [],
		requiredSectionIds: [],
		staleReasons: [],
		unresolvedQuestionIds: [],
	};
}

function evaluateDocumentDependencies(
	dependsOnDeps: DependencyReference[],
	alreadyPlanned: Map<CanonicalDocumentId, GenerationPlanItem>,
	dependencyStates: GenerationDependencyState[],
	diagnostics: GenerationPlanDiagnostic[],
): boolean {
	let allSatisfied = true;

	for (const dep of dependsOnDeps) {
		const depState = evaluateDependencyState(dep, alreadyPlanned, diagnostics);
		dependencyStates.push(depState);
		if (!depState.satisfied) {
			allSatisfied = false;
		}
	}

	return allSatisfied;
}

function classifyAction(
	blockers: GenerationBlocker[],
	gaps: GenerationGap[],
	dependencyStates: GenerationDependencyState[],
	existingArtifact: WorkspaceState['artifacts'][number] | undefined,
	stalenessResult: { stale: boolean; reasons: GenerationStalenessReason[] },
	hasConfirmedContent: boolean,
): GenerationAction {
	// Check for blocking dependencies.
	const hasBlockingDep = dependencyStates.some(
		(ds) => isBlockingDependencyStatus(ds.status) || ds.status === 'unknown',
	);
	if (hasBlockingDep) {
		return 'blocked';
	}

	// If there are structural blockers (missing canonical output, etc.), fail.
	const hasStructuralBlocker = blockers.some((b) =>
		b.code?.startsWith('E_GENPLAN_MISSING'),
	);
	if (hasStructuralBlocker) {
		return 'failed';
	}

	// If dependencies are blocking (marked in blockers list), return blocked.
	if (blockers.length > 0) {
		return 'blocked';
	}

	// No existing artifact → generate or incomplete.
	if (existingArtifact === undefined) {
		if (gaps.length > 0 && !hasConfirmedContent) {
			return 'incomplete';
		}
		return 'generate';
	}

	// Existing artifact exists.
	const artifactStatus = existingArtifact.status;

	// If artifact was previously failed, try again.
	if (artifactStatus === 'failed') {
		return 'generate';
	}

	// Check staleness.
	if (stalenessResult.stale) {
		// If stale but we can update, or if gaps make it incomplete.
		if (gaps.length > 0 && !hasConfirmedContent) {
			return 'incomplete';
		}
		return 'stale';
	}

	// Artifact exists and is not stale.
	if (hasConfirmedContent) {
		// Check if confirmed state timestamps postdate artifact generation.
		const artifactGenTime = existingArtifact.generatedAt;
		if (artifactGenTime !== undefined && stalenessResult.reasons.length > 0) {
			return 'update';
		}
		// If artifact exists and state hasn't meaningfully changed → skip.
		if (gaps.length > 0) {
			return 'incomplete';
		}
		return 'skip';
	}

	// No confirmed content but artifact exists → skip (preserve existing output).
	// Gaps are informational for existing artifacts without new content.
	return 'skip';
}

function buildReadiness(
	dependencyReady: boolean,
	hasGaps: boolean,
	blockers: GenerationBlocker[],
): GenerationReadiness {
	return {
		blockers,
		dependencyReady,
		gaps: [],
		inputsReady: !hasGaps,
		ready: dependencyReady && !hasGaps && blockers.length === 0,
		sectionsReady: !hasGaps,
	};
}

// ---------------------------------------------------------------------------
// Summary / dry-run
// ---------------------------------------------------------------------------

export function summarizeGenerationPlan(
	plan: GenerationPlan,
): GenerationDryRunSummary {
	const warnings: string[] = [];

	if (plan.diagnostics.length > 0) {
		for (const diag of plan.diagnostics) {
			if (diag.severity === 'warning' || diag.severity === 'error') {
				warnings.push(`[${diag.code}] ${diag.message}`);
			}
		}
	}

	if (plan.totalDocumentCount === 0) {
		warnings.push('Plan contains no documents');
	}

	return {
		blockers: plan.blockersSummary,
		gaps: plan.gapsSummary,
		plannedActions: plan.actionCounts,
		plannedTargetPaths: plan.items.map((i) => i.documentationRootRelativePath),
		totalDocuments: plan.totalDocumentCount,
		warnings,
	};
}

export function planDocumentGeneration(
	input: GenerationPlanInput,
	options?: GenerationPlanOptions,
): GenerationPlanResult {
	return createGenerationPlan(input, options);
}
