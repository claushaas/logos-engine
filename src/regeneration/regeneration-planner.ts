/** Step 7.3 Regeneration Planning — core planner (read-only, no mutations) */

import type { DependencyGraphNodeId } from '../dependency-graph/dependency-graph.js';
import { assignSafeOrderIndices } from './regeneration-order.js';
import {
	buildReasons,
	buildSourceChanges,
	computeDerivedBlockingReason,
	stalenessStatusToDefaultAction,
	stalenessStatusToPlanStatus,
} from './regeneration-reasons.js';
import type {
	RegenerationPlan,
	RegenerationPlanBlockedReason,
	RegenerationPlanDependency,
	RegenerationPlanDiagnostic,
	RegenerationPlanDryRunSummary,
	RegenerationPlanInput,
	RegenerationPlanItem,
	RegenerationPlanOptions,
	RegenerationPlanResult,
	RegenerationPlanSkippedReason,
	RegenerationPlanSummary,
	RegenerationPlanTargetKind,
} from './regeneration-types.js';

// ---------------------------------------------------------------------------
// Create regeneration plan
// ---------------------------------------------------------------------------

export function createRegenerationPlan(
	input: RegenerationPlanInput,
	options: RegenerationPlanOptions = {},
): RegenerationPlanResult {
	const diagnostics: RegenerationPlanDiagnostic[] = [];
	const {
		dryRun = true,
		includeCurrent = false,
		includeDerived = true,
		includeOrphaned = true,
		includeUnknown = true,
		targetDocumentId,
		targetPhaseId,
		targetKind,
	} = options;

	// Build node lookup helpers
	const graphNodeMap = input.dependencyGraph.nodeMap;
	const nodeByDocId = new Map<string, DependencyGraphNodeId>();
	const outputsByDocId = new Map<string, DependencyGraphNodeId[]>();
	for (const [, node] of graphNodeMap) {
		if (node.documentCanonicalId) {
			nodeByDocId.set(node.documentCanonicalId, node.id);
			const existing = outputsByDocId.get(node.documentCanonicalId) ?? [];
			existing.push(node.id);
			outputsByDocId.set(node.documentCanonicalId, existing);
		}
	}

	// Build staleness target lookup by graphNodeId
	const stalenessByNodeId = new Map<
		DependencyGraphNodeId,
		RegenerationPlanInput['stalenessResult']['targets'][number]
	>();
	for (const t of input.stalenessResult.targets) {
		if (t.graphNodeId) {
			stalenessByNodeId.set(t.graphNodeId, t);
		}
	}

	// Build staleness target lookup by target id
	const stalenessById = new Map<
		string,
		RegenerationPlanInput['stalenessResult']['targets'][number]
	>();
	for (const t of input.stalenessResult.targets) {
		stalenessById.set(t.targetId, t);
	}

	// Filter staleness targets
	let filteredTargets = input.stalenessResult.targets;

	if (targetDocumentId) {
		const docNid = nodeByDocId.get(targetDocumentId);
		filteredTargets = filteredTargets.filter(
			(t) =>
				t.documentCanonicalId === targetDocumentId || t.graphNodeId === docNid,
		);
		if (filteredTargets.length === 0) {
			diagnostics.push({
				artifactId: undefined,
				code: 'regeneration_unknown_document_filter',
				documentCanonicalId: targetDocumentId,
				expected: undefined,
				fieldPath: undefined,
				graphNodeId: undefined,
				message: `No targets match document id filter: ${targetDocumentId}`,
				phaseId: undefined,
				received: undefined,
				recoveryHint:
					'Verify document canonical id exists in the dependency graph.',
				severity: 'warning',
				sourcePath: undefined,
				stalenessTargetId: undefined,
			});
		}
	}

	if (targetPhaseId) {
		filteredTargets = filteredTargets.filter(
			(t) => t.phaseId === targetPhaseId,
		);
		if (filteredTargets.length === 0) {
			diagnostics.push({
				artifactId: undefined,
				code: 'regeneration_unknown_phase_filter',
				documentCanonicalId: undefined,
				expected: undefined,
				fieldPath: undefined,
				graphNodeId: undefined,
				message: `No targets match phase id filter: ${targetPhaseId}`,
				phaseId: targetPhaseId,
				received: undefined,
				recoveryHint: 'Verify phase id exists in the active profile.',
				severity: 'warning',
				sourcePath: undefined,
				stalenessTargetId: undefined,
			});
		}
	}

	if (targetKind) {
		filteredTargets = filteredTargets.filter(
			(t) => t.targetKind === targetKind,
		);
		if (filteredTargets.length === 0) {
			diagnostics.push({
				artifactId: undefined,
				code: 'regeneration_unknown_target_kind_filter',
				documentCanonicalId: undefined,
				expected: undefined,
				fieldPath: undefined,
				graphNodeId: undefined,
				message: `No targets match target kind filter: ${targetKind}`,
				phaseId: undefined,
				received: undefined,
				recoveryHint: undefined,
				severity: 'warning',
				sourcePath: undefined,
				stalenessTargetId: undefined,
			});
		}
	}

	// Build plan items
	const items: RegenerationPlanItem[] = [];

	for (const staleTarget of filteredTargets) {
		const status = stalenessStatusToPlanStatus(staleTarget.status);

		// Skip current unless explicitly included
		if (status === 'not_needed' && !includeCurrent) {
			continue;
		}

		// Skip orphaned unless explicitly included
		if (
			status === 'skipped' &&
			!includeOrphaned &&
			staleTarget.status !== 'orphaned'
		) {
			continue;
		}

		// Skip unknown unless explicitly included
		if (status === 'unknown' && !includeUnknown) {
			continue;
		}

		// Check derived artifact filtering
		if (!includeDerived) {
			const tk = staleTarget.targetKind as RegenerationPlanTargetKind;
			if (tk !== 'canonical_markdown' && staleTarget.status === 'stale') {
				continue;
			}
		}

		// Determine action
		let action = stalenessStatusToDefaultAction(staleTarget.status);
		if (status === 'not_needed') {
			action = 'no_action';
		}

		// Determine derived blocking
		const canonicalSourceStatus = findCanonicalSourceStatus(
			staleTarget,
			input,
			stalenessById,
		);

		const derivedBlocking = computeDerivedBlockingReason(
			staleTarget.targetKind,
			staleTarget.status,
			canonicalSourceStatus,
		);

		if (
			derivedBlocking &&
			(action === 'regenerate' || action === 'generate_missing')
		) {
			action = 'block_until_canonical_current';
		}

		// Build upstream dependencies
		const upstreamDeps = buildUpstreamDependencies(
			staleTarget,
			input,
			stalenessById,
		);

		// Build downstream dependents
		const downstreamDeps = buildDownstreamDependents(
			staleTarget,
			input,
			stalenessById,
		);

		// Build reasons
		const reasons = buildReasons(staleTarget.reasons);

		// Collect reason codes
		const reasonCodes = reasons.map((r) => r.code);
		// Ensure we have a primary reason
		if (reasonCodes.length === 0) {
			reasonCodes.push(
				staleTarget.status === 'current'
					? 'not_stale'
					: staleTarget.status === 'stale'
						? 'target_stale'
						: staleTarget.status === 'missing'
							? 'target_missing'
							: staleTarget.status === 'blocked'
								? 'upstream_required_blocked'
								: staleTarget.status === 'orphaned'
									? 'target_orphaned'
									: 'target_unknown',
			);
		}

		// Build blockers
		const blockers = buildBlockers(
			staleTarget,
			action,
			derivedBlocking,
			upstreamDeps,
		);

		// Build skipped reasons
		const skippedReasons = buildSkippedReasons(staleTarget, action);

		// Build canonical prerequisites
		const canonicalPrereqs = findCanonicalPrerequisites(
			staleTarget,
			input,
			stalenessById,
		);

		// Build derived output prerequisites
		const derivedPrereqs = findDerivedPrerequisites(
			staleTarget,
			input,
			stalenessById,
		);

		const item: RegenerationPlanItem = {
			action,
			artifactId: staleTarget.artifactId,
			blockers,
			canonicalPrerequisites: canonicalPrereqs,
			derivedOutputPrerequisites: derivedPrereqs,
			diagnostics: staleTarget.diagnostics.map((d) => ({
				artifactId: d.artifactId,
				code: d.code,
				documentCanonicalId: d.documentCanonicalId,
				expected: d.expected,
				fieldPath: d.fieldPath,
				graphNodeId: d.graphNodeId,
				message: d.message,
				phaseId: d.phaseId,
				received: d.received,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
				sourcePath: d.sourcePath,
				stalenessTargetId: staleTarget.targetId,
			})),
			documentCanonicalId: staleTarget.documentCanonicalId,
			downstreamDependents: downstreamDeps,
			dryRun,
			graphNodeId: staleTarget.graphNodeId,
			outputPath: staleTarget.outputPath,
			phaseId: staleTarget.phaseId,
			reasonCodes,
			reasons,
			safeOrderIndex: 0,
			skippedReasons,
			sourceChangeRefs: [...staleTarget.changedSourceRefs],
			stalenessStatus: staleTarget.status,
			status,
			targetId: staleTarget.targetId,
			targetKind: staleTarget.targetKind as RegenerationPlanTargetKind,
			upstreamDependencies: upstreamDeps,
		};

		items.push(item);
	}

	// Assign ordering
	const orderedItems = assignSafeOrderIndices(items);

	// Build source changes
	const sourceChanges = buildSourceChanges(
		filteredTargets.map((t) => ({
			documentCanonicalId: t.documentCanonicalId,
			graphNodeId: t.graphNodeId,
			phaseId: t.phaseId,
			reasons: t.reasons.map((r) => ({
				code: r.code,
				message: r.message,
				severity: r.severity,
				sourceId: r.sourceId,
				sourceKind: r.sourceKind,
				sourcePath: r.sourcePath,
			})),
			targetId: t.targetId,
		})),
	);

	// Build summaries
	const countByAction: Record<string, number> = {};
	const countByStatus: Record<string, number> = {};
	const countByTargetKind: Record<string, number> = {};
	const countByReasonCode: Record<string, number> = {};

	for (const item of orderedItems) {
		countByAction[item.action] = (countByAction[item.action] ?? 0) + 1;
		countByStatus[item.status] = (countByStatus[item.status] ?? 0) + 1;
		countByTargetKind[item.targetKind] =
			(countByTargetKind[item.targetKind] ?? 0) + 1;
		for (const code of item.reasonCodes) {
			countByReasonCode[code] = (countByReasonCode[code] ?? 0) + 1;
		}
	}

	const dependencyImpactSummary: string[] = [];
	const blockedSummary: string[] = [];
	const orphanedManualReviewSummary: string[] = [];

	for (const item of orderedItems) {
		if (
			item.action === 'block_until_canonical_current' ||
			item.action === 'block_until_dependency_current'
		) {
			for (const blocker of item.blockers) {
				blockedSummary.push(
					`${item.targetId}: ${blocker.message}${blocker.recoveryHint ? ` (recovery: ${blocker.recoveryHint})` : ''}`,
				);
			}
		}
		if (item.action === 'skip_orphaned' || item.action === 'manual_review') {
			orphanedManualReviewSummary.push(
				`${item.targetId}: ${item.action} — ${item.status}`,
			);
		}
		for (const dep of item.upstreamDependencies) {
			if (dep.status !== 'not_needed') {
				dependencyImpactSummary.push(
					`${item.targetId} depends on ${dep.targetId} (${dep.status}, required=${dep.required})`,
				);
			}
		}
	}

	const plan: RegenerationPlan = {
		blockedSummary,
		countByAction,
		countByReasonCode,
		countByStatus,
		countByTargetKind,
		dependencyImpactSummary,
		diagnostics,
		documentationRoot: input.documentationRoot,
		dryRun,
		graphEdgeCount: input.dependencyGraph.edges.length,
		graphNodeCount: input.dependencyGraph.nodes.length,
		items: orderedItems,
		orphanedManualReviewSummary,
		profileId: input.profileId,
		sourceChanges,
	};

	const dryRunSummary = buildDryRunSummary(plan);

	return {
		diagnostics: plan.diagnostics,
		dryRunSummary,
		plan,
	};
}

// ---------------------------------------------------------------------------
// Helper: find canonical source status for a staleness target
// ---------------------------------------------------------------------------

function findCanonicalSourceStatus(
	staleTarget: RegenerationPlanInput['stalenessResult']['targets'][number],
	input: RegenerationPlanInput,
	_stalenessById: Map<
		string,
		RegenerationPlanInput['stalenessResult']['targets'][number]
	>,
): string | undefined {
	const targetKind = staleTarget.targetKind;
	const docId = staleTarget.documentCanonicalId;

	if (!docId) return undefined;

	// For derived artifacts, look up the canonical markdown status for this doc
	if (
		targetKind === 'html_artifact' ||
		targetKind === 'agent_pack' ||
		targetKind === 'data_artifact' ||
		targetKind === 'report_artifact'
	) {
		for (const t of input.stalenessResult.targets) {
			if (
				t.documentCanonicalId === docId &&
				t.targetKind === 'canonical_markdown'
			) {
				return t.status;
			}
		}
		return undefined;
	}

	// For executive outputs, check upstream canonical prerequisites via graph
	if (
		targetKind === 'executive_json' ||
		targetKind === 'executive_markdown' ||
		targetKind === 'executive_html'
	) {
		// Check all canonical outputs as prerequisites for executive
		for (const t of input.stalenessResult.targets) {
			if (t.targetKind === 'canonical_markdown') {
				if (t.status !== 'current') {
					return t.status;
				}
			}
		}
	}

	return undefined;
}

// ---------------------------------------------------------------------------
// Helper: build upstream dependency references
// ---------------------------------------------------------------------------

function buildUpstreamDependencies(
	staleTarget: RegenerationPlanInput['stalenessResult']['targets'][number],
	_input: RegenerationPlanInput,
	stalenessById: Map<
		string,
		RegenerationPlanInput['stalenessResult']['targets'][number]
	>,
): RegenerationPlanDependency[] {
	const deps: RegenerationPlanDependency[] = [];

	for (const impact of staleTarget.upstreamImpacts) {
		const upstream = stalenessById.get(impact.upstreamTargetId);
		deps.push({
			graphNodeId: upstream?.graphNodeId,
			message: impact.message,
			required: impact.required,
			status: (upstream
				? stalenessStatusToPlanStatus(upstream.status)
				: 'unknown') as RegenerationPlanDependency['status'],
			targetId: impact.upstreamTargetId,
			targetKind: (upstream?.targetKind ??
				'canonical_markdown') as RegenerationPlanDependency['targetKind'],
		});
	}

	return deps;
}

// ---------------------------------------------------------------------------
// Helper: build downstream dependency references
// ---------------------------------------------------------------------------

function buildDownstreamDependents(
	staleTarget: RegenerationPlanInput['stalenessResult']['targets'][number],
	input: RegenerationPlanInput,
	_stalenessById: Map<
		string,
		RegenerationPlanInput['stalenessResult']['targets'][number]
	>,
): RegenerationPlanDependency[] {
	const deps: RegenerationPlanDependency[] = [];

	for (const t of input.stalenessResult.targets) {
		for (const impact of t.upstreamImpacts) {
			if (impact.upstreamTargetId === staleTarget.targetId) {
				deps.push({
					graphNodeId: t.graphNodeId,
					message: impact.message,
					required: impact.required,
					status: stalenessStatusToPlanStatus(
						t.status,
					) as RegenerationPlanDependency['status'],
					targetId: t.targetId,
					targetKind: t.targetKind as RegenerationPlanDependency['targetKind'],
				});
			}
		}
	}

	return deps;
}

// ---------------------------------------------------------------------------
// Helper: build blockers
// ---------------------------------------------------------------------------

function buildBlockers(
	staleTarget: RegenerationPlanInput['stalenessResult']['targets'][number],
	action: RegenerationPlanItem['action'],
	derivedBlocking: string | undefined,
	upstreamDeps: RegenerationPlanDependency[],
): RegenerationPlanBlockedReason[] {
	const blockers: RegenerationPlanBlockedReason[] = [];

	if (
		action === 'block_until_canonical_current' ||
		action === 'block_until_dependency_current'
	) {
		if (derivedBlocking) {
			blockers.push({
				blockingReasonCode:
					derivedBlocking as RegenerationPlanBlockedReason['blockingReasonCode'],
				blockingTargetId: staleTarget.targetId,
				code: 'derived_blocked_by_canonical',
				message: `Derived output "${staleTarget.targetId}" is blocked because its canonical source is not current.`,
				recoveryHint: 'Regenerate the canonical source first.',
			});
		}

		for (const dep of upstreamDeps) {
			if (
				dep.status !== 'not_needed' &&
				dep.status !== 'planned' &&
				dep.required
			) {
				blockers.push({
					blockingReasonCode: 'upstream_required_blocked',
					blockingTargetId: dep.targetId,
					code: 'blocked_by_upstream',
					message: `Blocked by upstream dependency "${dep.targetId}": ${dep.message}`,
					recoveryHint: `Resolve upstream target ${dep.targetId} first.`,
				});
			}
		}
	}

	if (staleTarget.status === 'orphaned') {
		blockers.push({
			blockingReasonCode: 'target_orphaned',
			blockingTargetId: staleTarget.targetId,
			code: 'orphaned_output',
			message: `Output "${staleTarget.targetId}" is orphaned and has no active source in the dependency graph.`,
			recoveryHint:
				'Manual review required. Do not delete without confirmation.',
		});
	}

	if (staleTarget.status === 'unknown') {
		blockers.push({
			blockingReasonCode: 'target_unknown',
			blockingTargetId: staleTarget.targetId,
			code: 'unknown_status',
			message: `Output "${staleTarget.targetId}" has unknown staleness status.`,
			recoveryHint: 'Refresh metadata or re-run staleness detection.',
		});
	}

	return blockers;
}

// ---------------------------------------------------------------------------
// Helper: build skipped reasons
// ---------------------------------------------------------------------------

function buildSkippedReasons(
	staleTarget: RegenerationPlanInput['stalenessResult']['targets'][number],
	action: RegenerationPlanItem['action'],
): RegenerationPlanSkippedReason[] {
	const reasons: RegenerationPlanSkippedReason[] = [];

	if (action === 'skip_orphaned') {
		reasons.push({
			code: 'orphaned',
			message: `Output "${staleTarget.targetId}" is orphaned.`,
			reason: 'Orphaned outputs are not regenerated automatically.',
		});
	}

	if (action === 'no_action') {
		reasons.push({
			code: 'current',
			message: `Output "${staleTarget.targetId}" is current.`,
			reason: 'No regeneration needed.',
		});
	}

	return reasons;
}

// ---------------------------------------------------------------------------
// Helper: find canonical prerequisites for a target
// ---------------------------------------------------------------------------

function findCanonicalPrerequisites(
	staleTarget: RegenerationPlanInput['stalenessResult']['targets'][number],
	input: RegenerationPlanInput,
	stalenessById: Map<
		string,
		RegenerationPlanInput['stalenessResult']['targets'][number]
	>,
): string[] {
	const prereqs: string[] = [];

	// Derived artifacts need their canonical markdown prerequisite
	if (
		staleTarget.targetKind !== 'canonical_markdown' &&
		staleTarget.documentCanonicalId
	) {
		for (const t of input.stalenessResult.targets) {
			if (
				t.documentCanonicalId === staleTarget.documentCanonicalId &&
				t.targetKind === 'canonical_markdown'
			) {
				prereqs.push(t.targetId);
			}
		}
	}

	// Executive outputs need canonical markdown prerequisites
	if (
		staleTarget.targetKind === 'executive_json' ||
		staleTarget.targetKind === 'executive_markdown' ||
		staleTarget.targetKind === 'executive_html'
	) {
		for (const t of input.stalenessResult.targets) {
			if (
				t.targetKind === 'canonical_markdown' &&
				!prereqs.includes(t.targetId)
			) {
				prereqs.push(t.targetId);
			}
		}
	}

	// For upstream impacts that are required
	for (const impact of staleTarget.upstreamImpacts) {
		if (impact.required && !prereqs.includes(impact.upstreamTargetId)) {
			const upstream = stalenessById.get(impact.upstreamTargetId);
			if (upstream?.targetKind === 'canonical_markdown') {
				prereqs.push(impact.upstreamTargetId);
			}
		}
	}

	return prereqs;
}

// ---------------------------------------------------------------------------
// Helper: find derived output prerequisites
// ---------------------------------------------------------------------------

function findDerivedPrerequisites(
	staleTarget: RegenerationPlanInput['stalenessResult']['targets'][number],
	input: RegenerationPlanInput,
	_stalenessById: Map<
		string,
		RegenerationPlanInput['stalenessResult']['targets'][number]
	>,
): string[] {
	const prereqs: string[] = [];

	if (
		staleTarget.targetKind === 'executive_markdown' ||
		staleTarget.targetKind === 'executive_html'
	) {
		for (const t of input.stalenessResult.targets) {
			if (t.targetKind === 'executive_json') {
				prereqs.push(t.targetId);
			}
		}
	}

	return prereqs;
}

// ---------------------------------------------------------------------------
// Build dry-run summary
// ---------------------------------------------------------------------------

function buildDryRunSummary(
	plan: RegenerationPlan,
): RegenerationPlanDryRunSummary {
	const plannedCount =
		plan.countByAction.regenerate ??
		0 + (plan.countByAction.generate_missing ?? 0);
	const blockedCount =
		plan.countByAction.block_until_canonical_current ??
		0 + (plan.countByAction.block_until_dependency_current ?? 0);
	const skippedCount =
		plan.countByAction.skip_orphaned ??
		0 + (plan.countByAction.skip_current ?? 0);
	const missingCount = plan.countByAction.generate_missing ?? 0;
	const manualReviewCount =
		plan.countByAction.manual_review ??
		0 + (plan.countByAction.refresh_metadata ?? 0);
	const unknownCount = plan.countByAction.refresh_metadata ?? 0;
	const notNeededCount = plan.countByAction.no_action ?? 0;

	// Generate safe order descriptions
	const safeOrderDescriptions: string[] = [];
	for (const item of plan.items) {
		if (
			item.action !== 'no_action' &&
			item.action !== 'skip_orphaned' &&
			item.action !== 'skip_current' &&
			item.action !== 'manual_review'
		) {
			safeOrderDescriptions.push(
				`${item.safeOrderIndex}. [${item.targetKind}] ${item.targetId}: ${item.action}`,
			);
		}
	}

	// Top reasons
	const topReasons = Object.entries(plan.countByReasonCode)
		.filter(([, count]) => count > 0 && count)
		.sort(([, a], [, b]) => (b as number) - (a as number))
		.slice(0, 5)
		.map(([code]) => code);

	return {
		blockedCount,
		changedPaths: [],
		manualReviewCount,
		missingCount,
		notNeededCount,
		plannedCount,
		safeOrderDescriptions,
		skippedCount,
		topReasons,
		totalTargets: plan.items.length,
		unknownCount,
	};
}

// ---------------------------------------------------------------------------
// Build a concise summary for integration
// ---------------------------------------------------------------------------

export function summarizeRegenerationPlan(
	plan: RegenerationPlan,
): RegenerationPlanSummary {
	const plannedCount =
		plan.countByAction.regenerate ??
		0 + (plan.countByAction.generate_missing ?? 0);
	const blockedCount =
		plan.countByAction.block_until_canonical_current ??
		0 + (plan.countByAction.block_until_dependency_current ?? 0);
	const skippedCount =
		plan.countByAction.skip_orphaned ??
		0 + (plan.countByAction.skip_current ?? 0);
	const missingCount = plan.countByAction.generate_missing ?? 0;

	const staleCanonicalDocIds = plan.items
		.filter(
			(item) =>
				item.targetKind === 'canonical_markdown' &&
				(item.status === 'planned' || item.status === 'missing_source'),
		)
		.map((item) => item.documentCanonicalId)
		.filter((id): id is string => id !== undefined);

	const outOfScopeTargetKinds = plan.items
		.filter(
			(item) =>
				item.status === 'blocked' && item.targetKind !== 'canonical_markdown',
		)
		.map((item) => item.targetKind)
		.filter((v, i, arr) => arr.indexOf(v) === i);

	const safeOrderNote = plan.dryRun
		? 'Safe order: canonical Markdown documents before derived artifacts (HTML, agent packs, executive outputs). Derived artifacts are blocked until canonical sources are current.'
		: '';

	const futurePhasesNeeded: string[] = [];
	if ((plan.countByTargetKind.html_artifact ?? 0) > 0)
		futurePhasesNeeded.push('html-generation');
	if ((plan.countByTargetKind.agent_pack ?? 0) > 0)
		futurePhasesNeeded.push('agent-pack-generation');
	if (
		(plan.countByTargetKind.executive_json ?? 0) > 0 ||
		(plan.countByTargetKind.executive_markdown ?? 0) > 0 ||
		(plan.countByTargetKind.executive_html ?? 0) > 0
	) {
		futurePhasesNeeded.push('executive-axis-generation');
	}

	return {
		blockedCount,
		futurePhasesNeeded,
		missingCount,
		outOfScopeTargetKinds,
		plannedCount,
		safeOrderNote,
		skippedCount,
		staleCanonicalDocIds,
		totalTargets: plan.items.length,
	};
}
