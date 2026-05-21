/** Step 11.2 — Executive Plan JSON compiler */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
	ExecutivePlanBlocker,
	ExecutivePlanCompilationStatus,
	ExecutivePlanCompileInput,
	ExecutivePlanCompileOptions,
	ExecutivePlanCompileResult,
	ExecutivePlanDiagnostic,
	ExecutivePlanJson,
	ExecutivePlanJsonArtifact,
	ExecutivePlanJsonDecision,
	ExecutivePlanJsonExportConfig,
	ExecutivePlanJsonInitiative,
	ExecutivePlanJsonItem,
	ExecutivePlanJsonMilestone,
	ExecutivePlanJsonRisk,
	ExecutivePlanJsonRoadmap,
	ExecutivePlanJsonSource,
	ExecutivePlanJsonWorkstream,
	ExecutivePlanReadinessSnapshot,
} from './executive-plan-model.js';
import type { NormativeBaselineReadinessResult } from './executive-readiness-types.js';

// ---------------------------------------------------------------------------
// Stable hash for deterministic IDs
// ---------------------------------------------------------------------------

function stableHash(input: string): string {
	return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// Deterministic plan ID
// ---------------------------------------------------------------------------

function generatePlanId(
	profileId: string,
	readinessHash: string,
	timestamp: string,
): string {
	const short = createHash('sha256')
		.update(`${profileId}:${readinessHash}:${timestamp}`)
		.digest('hex')
		.slice(0, 8);
	return `exec-plan-${profileId}-${short}`;
}

// ---------------------------------------------------------------------------
// Baseline fingerprint
// ---------------------------------------------------------------------------

function computeBaselineFingerprint(
	readiness: NormativeBaselineReadinessResult,
): string {
	const parts: string[] = [
		readiness.activeProfileId,
		readiness.profileVersion ?? 'unknown',
		readiness.executiveProfileVersion ?? 'unknown',
		readiness.status,
		...readiness.requiredDocumentIds,
	];
	// Include document readiness
	for (const doc of readiness.documentReadiness) {
		parts.push(
			`${doc.documentCanonicalId}:${doc.status}:${doc.stalenessStatus ?? 'unknown'}`,
		);
	}
	// Include blocker kinds
	for (const b of readiness.blockers) {
		parts.push(`blk:${b.kind}`);
	}
	// Include warning kinds
	for (const w of readiness.warnings) {
		parts.push(`wrn:${w.kind}`);
	}
	// Include register counts
	parts.push(
		`reg:d${readiness.registerCoverage.totalDecisions}`,
		`reg:a${readiness.registerCoverage.totalAssumptions}`,
		`reg:h${readiness.registerCoverage.totalHypotheses}`,
		`reg:r${readiness.registerCoverage.totalRisks}`,
		`reg:q${readiness.registerCoverage.totalOpenQuestions}`,
	);
	return stableHash(parts.join('|'));
}

// ---------------------------------------------------------------------------
// Phase title lookup
// ---------------------------------------------------------------------------

function _buildPhaseTitleMap(
	readiness: NormativeBaselineReadinessResult,
): Map<string, string> {
	const map = new Map<string, string>();
	for (const pr of readiness.phaseReadiness) {
		map.set(pr.phaseId, pr.phaseTitle);
	}
	return map;
}

// ---------------------------------------------------------------------------
// Work item ID generation
// ---------------------------------------------------------------------------

function generateWorkItemId(
	prefix: string,
	sourceKind: string,
	sourceId: string,
	index: number,
): string {
	return `wi-${prefix}-${sourceKind}-${stableHash(sourceId).slice(0, 6)}-${String(index).padStart(3, '0')}`;
}

function _generateDependencyId(
	fromId: string,
	toId: string,
	depType: string,
): string {
	return `dep-${stableHash(`${fromId}:${toId}:${depType}`)}`;
}

function generateBlockerId(readinessBlockerIndex: number): string {
	return `blk-exec-${String(readinessBlockerIndex).padStart(4, '0')}`;
}

function _generateRiskId(registerItemId: string): string {
	return `risk-exec-${stableHash(registerItemId)}`;
}

function _generateAcceptanceCriterionId(
	sourceDocId: string,
	index: number,
): string {
	return `ac-${stableHash(sourceDocId).slice(0, 8)}-${String(index).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Determine if readiness blocks compilation
// ---------------------------------------------------------------------------

function readinessBlocksCompilation(
	readinessStatus: string,
	mode: 'strict' | 'diagnostic_preview',
): boolean {
	if (mode === 'diagnostic_preview') return false;
	if (readinessStatus === 'ready') return false;
	if (readinessStatus === 'ready_with_warnings') return false;
	return true;
}

// ---------------------------------------------------------------------------
// Determine compilation status
// ---------------------------------------------------------------------------

function _determineCompilationStatus(
	isBlocked: boolean,
	hasWarnings: boolean,
	hasErrors: boolean,
): ExecutivePlanCompilationStatus {
	if (hasErrors) return 'failed';
	if (isBlocked) return 'blocked';
	if (hasWarnings) return 'compiled_with_warnings';
	return 'compiled';
}

// ---------------------------------------------------------------------------
// Build readiness snapshot
// ---------------------------------------------------------------------------

function buildReadinessSnapshot(
	readiness: NormativeBaselineReadinessResult,
): ExecutivePlanReadinessSnapshot {
	return {
		blockedDocuments: readiness.summary.blockedDocuments,
		blockedPhases: readiness.summary.blockedPhases,
		blockerCount: readiness.summary.blockerCount,
		blockingOpenQuestionCount: readiness.summary.blockingOpenQuestionCount,
		documentationRoot: readiness.documentationRoot,
		evaluatedAt: readiness.evaluatedAt,
		executiveProfileVersion: readiness.executiveProfileVersion,
		gateStatus: readiness.executiveCompilationGateStatus,
		profileId: readiness.activeProfileId,
		profileVersion: readiness.profileVersion,
		readinessStatus: readiness.status,
		satisfiedDocuments: readiness.summary.satisfiedDocuments,
		satisfiedPhases: readiness.summary.satisfiedPhases,
		staleNormativeDocCount: readiness.summary.staleNormativeDocCount,
		totalDocuments: readiness.summary.totalDocuments,
		totalPhases: readiness.summary.totalPhases,
		unknownDocuments: readiness.summary.unknownDocuments,
		unknownPhases: readiness.summary.unknownPhases,
		warningCount: readiness.summary.warningCount,
		warningDocuments: readiness.summary.warningDocuments,
		warningPhases: readiness.summary.warningPhases,
	};
}

// ---------------------------------------------------------------------------
// Build source
// ---------------------------------------------------------------------------

function buildSource(
	readiness: NormativeBaselineReadinessResult,
): ExecutivePlanJsonSource {
	return {
		generationPromptId: null,
		normativeDocuments: readiness.requiredDocumentIds as string[],
		readinessStatus: readiness.status,
		sourceCommit: null,
		warnings: readiness.warnings.map((w) => w.message),
	};
}

// ---------------------------------------------------------------------------
// Build project info
// ---------------------------------------------------------------------------

function buildProject(
	readiness: NormativeBaselineReadinessResult,
	input: ExecutivePlanCompileInput,
): { id: string; name: string; description: string } {
	return {
		description: input.projectDescription ?? '',
		id: input.projectId ?? readiness.activeProfileId,
		name: input.projectName ?? readiness.activeProfileId,
	};
}

// ---------------------------------------------------------------------------
// Build roadmaps
// ---------------------------------------------------------------------------

function buildRoadmaps(
	readiness: NormativeBaselineReadinessResult,
	milestoneIds: string[],
): ExecutivePlanJsonRoadmap[] {
	return [
		{
			description: `Normative baseline roadmap compiled from ${readiness.activeProfileId} profile`,
			horizon: 'normative_baseline',
			id: `roadmap-${readiness.activeProfileId}`,
			milestoneIds,
			status: readiness.status === 'ready' ? 'ready' : 'planned',
			title: `${readiness.activeProfileId} Normative Baseline Roadmap`,
		},
	];
}

// ---------------------------------------------------------------------------
// Build milestones from phases
// ---------------------------------------------------------------------------

function buildMilestones(
	readiness: NormativeBaselineReadinessResult,
): ExecutivePlanJsonMilestone[] {
	const milestones: ExecutivePlanJsonMilestone[] = [];
	for (const pr of readiness.phaseReadiness) {
		const phaseDocs = readiness.documentReadiness.filter(
			(d) => d.phaseId === pr.phaseId,
		);
		const docExitCriteria = phaseDocs.map(
			(d) =>
				`${d.descriptorTitle}: ${d.status}${d.stalenessStatus ? ` (${d.stalenessStatus})` : ''}`,
		);

		let status: 'draft' | 'planned' | 'ready' | 'blocked' | 'reviewing' =
			'planned';
		if (pr.status === 'satisfied') status = 'ready';
		else if (pr.status === 'blocked') status = 'blocked';
		else if (pr.status === 'warning') status = 'reviewing';
		else if (pr.status === 'unknown') status = 'draft';

		milestones.push({
			exitCriteria: [
				`All ${pr.phaseTitle} canonical documents generated and current`,
				...docExitCriteria,
			],
			id: `milestone-${pr.phaseId}`,
			initiativeIds: [],
			objective: `Complete ${pr.phaseTitle} phase normative documentation`,
			status,
			title: `Phase: ${pr.phaseTitle}`,
		});
	}

	return milestones;
}

// ---------------------------------------------------------------------------
// Build workstreams from phases
// ---------------------------------------------------------------------------

function buildWorkstreams(
	readiness: NormativeBaselineReadinessResult,
): ExecutivePlanJsonWorkstream[] {
	return readiness.phaseReadiness.map((pr) => ({
		description: `${pr.phaseTitle} normative documentation workstream`,
		id: `workstream-${pr.phaseId}`,
		relatedNormativeAreas: [pr.phaseId],
		title: pr.phaseTitle,
		type: 'normative_documentation',
	}));
}

// ---------------------------------------------------------------------------
// Build initiatives
// ---------------------------------------------------------------------------

function buildInitiatives(
	readiness: NormativeBaselineReadinessResult,
	workItemIdsByPhase: Map<string, string[]>,
	milestoneIdByPhase: Map<string, string>,
	workstreamIdByPhase: Map<string, string>,
): ExecutivePlanJsonInitiative[] {
	const initiatives: ExecutivePlanJsonInitiative[] = [];

	for (const pr of readiness.phaseReadiness) {
		const itemIds = workItemIdsByPhase.get(pr.phaseId) ?? [];
		const milestoneId = milestoneIdByPhase.get(pr.phaseId);
		const workstreamId = workstreamIdByPhase.get(pr.phaseId);

		let status: 'draft' | 'planned' | 'ready' | 'blocked' | 'reviewing' =
			'planned';
		if (pr.status === 'satisfied') status = 'ready';
		else if (pr.status === 'blocked') status = 'blocked';
		else if (pr.status === 'warning') status = 'reviewing';
		else if (pr.status === 'unknown') status = 'draft';

		initiatives.push({
			deliverables: pr.documentIds,
			id: `initiative-${pr.phaseId}`,
			itemIds,
			milestoneId,
			purpose: `Generate and validate ${pr.phaseTitle} normative documents`,
			status,
			title: `${pr.phaseTitle} Documentation`,
			workstreamId,
		});
	}

	return initiatives;
}

// ---------------------------------------------------------------------------
// Map work item status to schema item status
// ---------------------------------------------------------------------------

function _mapWorkItemStatusToSchemaStatus(
	status: string,
	_readiness: NormativeBaselineReadinessResult,
):
	| 'draft'
	| 'planned'
	| 'ready'
	| 'blocked'
	| 'reviewing'
	| 'done'
	| 'cancelled'
	| 'superseded' {
	switch (status) {
		case 'blocked':
			return 'blocked';
		case 'requires_review':
			return 'reviewing';
		case 'deferred':
			return 'draft';
		case 'not_applicable':
			return 'cancelled';
		case 'satisfied':
			return 'done';
		default:
			return 'planned';
	}
}

// ---------------------------------------------------------------------------
// Build work items from readiness blockers
// ---------------------------------------------------------------------------

function buildWorkItemsFromBlockers(
	readiness: NormativeBaselineReadinessResult,
	_diagnosticOnly: boolean,
): ExecutivePlanJsonItem[] {
	const items: ExecutivePlanJsonItem[] = [];

	for (let i = 0; i < readiness.blockers.length; i++) {
		const b = readiness.blockers[i];
		if (!b) continue;
		const wiId = generateWorkItemId('blk', b.kind, b.message, i);

		items.push({
			acceptanceCriteria: [
				`Blocker "${b.kind}" resolved`,
				`No validation finding with severity ${b.severity} for this issue`,
			],
			dependsOn: [],
			description: `${b.message}${b.recoveryHint ? `\n\nRecovery: ${b.recoveryHint}` : ''}`,
			id: wiId,
			initiativeId: b.phaseId ? `initiative-${b.phaseId}` : undefined,
			metadata: {
				blockerKind: b.kind,
				blockerSeverity: b.severity,
				documentCanonicalId: b.documentCanonicalId,
				phaseId: b.phaseId,
			},
			origin: 'derived' as const,
			priority:
				b.severity === 'fatal'
					? 'critical'
					: b.severity === 'error'
						? 'high'
						: 'medium',
			requiresReview: false,
			softDependsOn: [],
			sourceNormativeDocuments: b.documentCanonicalId
				? [b.documentCanonicalId]
				: [],
			sourceRationale: `Derived from readiness gate blocker: ${b.kind}`,
			status: 'blocked' as const,
			suggestedExecutor: { agentProfile: 'human', type: 'human' },
			suggestedExports: {},
			title: `Resolve: ${b.message.slice(0, 80)}`,
			type: 'blocker' as const,
			workstreamId: b.phaseId ? `workstream-${b.phaseId}` : undefined,
		});
	}

	return items;
}

// ---------------------------------------------------------------------------
// Build work items from validation findings
// ---------------------------------------------------------------------------

function _buildWorkItemsFromValidationFindings(): ExecutivePlanJsonItem[] {
	// Validation findings are already captured in readiness blockers/warnings.
	// No separate work items needed here to avoid duplication.
	return [];
}

// ---------------------------------------------------------------------------
// Build work items from missing sources
// ---------------------------------------------------------------------------

function buildWorkItemsFromSourceGaps(
	readiness: NormativeBaselineReadinessResult,
	_baselineIndex: number,
): ExecutivePlanJsonItem[] {
	const items: ExecutivePlanJsonItem[] = [];
	let idx = 0;

	// Source coverage: review-required and inferred sources
	const totalReviewRequired = readiness.sourceCoverage.reviewRequiredCount;
	if (totalReviewRequired > 0) {
		const wiId = generateWorkItemId(
			'src',
			'review_required',
			'source_gap',
			idx++,
		);
		items.push({
			acceptanceCriteria: ['All review-required sources confirmed or rejected'],
			dependsOn: [],
			description: `${readiness.sourceCoverage.reviewRequiredCount} source(s) require review. Review and confirm or reject them.`,
			id: wiId,
			initiativeId: undefined,
			metadata: { sourceCoverage: readiness.sourceCoverage },
			origin: 'inferred',
			priority: 'medium',
			requiresReview: true,
			softDependsOn: [],
			sourceNormativeDocuments: [],
			sourceRationale: 'Derived from source coverage review-required count',
			status: 'reviewing',
			suggestedExecutor: { agentProfile: 'human', type: 'human' },
			suggestedExports: {},
			title: 'Review sources marked as requiring review',
			type: 'review',
			workstreamId: undefined,
		});
	}

	// Source coverage: missing source claims
	const missingClaims = readiness.sourceCoverage.missingSourceClaimCount;
	if (missingClaims > 0) {
		const wiId = generateWorkItemId(
			'src',
			'missing_claims',
			'source_gap',
			idx++,
		);
		items.push({
			acceptanceCriteria: ['All claims have source links'],
			dependsOn: [],
			description: `${missingClaims} claim(s) have no source links. Add source evidence.`,
			id: wiId,
			initiativeId: undefined,
			metadata: { missingClaimCount: missingClaims },
			origin: 'inferred',
			priority: 'low',
			requiresReview: false,
			softDependsOn: [],
			sourceNormativeDocuments: [],
			sourceRationale: 'Derived from source coverage missing claim count',
			status: 'planned',
			suggestedExecutor: { agentProfile: 'human', type: 'human' },
			suggestedExports: {},
			title: 'Add source evidence to claims without sources',
			type: 'task',
			workstreamId: undefined,
		});
	}

	return items;
}

// ---------------------------------------------------------------------------
// Build work items from register gaps
// ---------------------------------------------------------------------------

function buildWorkItemsFromRegisterGaps(
	readiness: NormativeBaselineReadinessResult,
	_baselineIndex: number,
): ExecutivePlanJsonItem[] {
	const items: ExecutivePlanJsonItem[] = [];
	let idx = 0;

	// Blocking open questions
	const blockingCount = readiness.registerCoverage.blockingOpenQuestions;
	if (blockingCount > 0) {
		const wiId = generateWorkItemId(
			'reg',
			'blocking_questions',
			'register_gap',
			idx++,
		);
		items.push({
			acceptanceCriteria: ['No unresolved blocking open questions'],
			dependsOn: [],
			description: `${blockingCount} blocking open question(s) unresolved. Resolve before Executive Axis generation.`,
			id: wiId,
			initiativeId: undefined,
			metadata: { blockingOpenQuestionCount: blockingCount },
			origin: 'derived',
			priority: 'critical',
			requiresReview: false,
			softDependsOn: [],
			sourceNormativeDocuments: [],
			sourceRationale:
				'Derived from register coverage blocking open question count',
			status: 'blocked',
			suggestedExecutor: { agentProfile: 'human', type: 'human' },
			suggestedExports: {},
			title: 'Resolve blocking open questions',
			type: 'blocker',
			workstreamId: undefined,
		});
	}

	// Accepted risks without mitigation
	const risksWithoutMitigation =
		readiness.registerCoverage.risksWithoutMitigation;
	if (risksWithoutMitigation > 0) {
		const wiId = generateWorkItemId(
			'reg',
			'risks_no_mitigation',
			'register_gap',
			idx++,
		);
		items.push({
			acceptanceCriteria: ['All accepted risks have mitigation plans'],
			dependsOn: [],
			description: `${risksWithoutMitigation} accepted risk(s) have no mitigation plan. Add mitigation plans.`,
			id: wiId,
			initiativeId: undefined,
			metadata: { risksWithoutMitigation },
			origin: 'derived',
			priority: 'high',
			requiresReview: false,
			softDependsOn: [],
			sourceNormativeDocuments: [],
			sourceRationale:
				'Derived from register coverage risks without mitigation',
			status: 'planned',
			suggestedExecutor: { agentProfile: 'human', type: 'human' },
			suggestedExports: {},
			title: 'Add mitigation plans for accepted risks',
			type: 'task',
			workstreamId: undefined,
		});
	}

	// Review-required register items
	const reviewRequiredItems = readiness.registerCoverage.reviewRequiredItems;
	if (reviewRequiredItems > 0) {
		const wiId = generateWorkItemId(
			'reg',
			'review_required',
			'register_gap',
			idx++,
		);
		items.push({
			acceptanceCriteria: ['All review-required register items reviewed'],
			dependsOn: [],
			description: `${reviewRequiredItems} register item(s) require review.`,
			id: wiId,
			initiativeId: undefined,
			metadata: { reviewRequiredItems },
			origin: 'derived',
			priority: 'medium',
			requiresReview: true,
			softDependsOn: [],
			sourceNormativeDocuments: [],
			sourceRationale: 'Derived from register coverage review-required items',
			status: 'reviewing',
			suggestedExecutor: { agentProfile: 'human', type: 'human' },
			suggestedExports: {},
			title: 'Review register items requiring review',
			type: 'review',
			workstreamId: undefined,
		});
	}

	// Decisions without sources
	const decisionsWithoutSource =
		readiness.registerCoverage.decisionsWithoutSource;
	if (decisionsWithoutSource > 0) {
		const wiId = generateWorkItemId(
			'reg',
			'decisions_no_source',
			'register_gap',
			idx++,
		);
		items.push({
			acceptanceCriteria: ['All confirmed decisions have source links'],
			dependsOn: [],
			description: `${decisionsWithoutSource} confirmed decision(s) have no source links.`,
			id: wiId,
			initiativeId: undefined,
			metadata: { decisionsWithoutSource },
			origin: 'derived',
			priority: 'low',
			requiresReview: false,
			softDependsOn: [],
			sourceNormativeDocuments: [],
			sourceRationale:
				'Derived from register coverage decisions without source',
			status: 'planned',
			suggestedExecutor: { agentProfile: 'human', type: 'human' },
			suggestedExports: {},
			title: 'Add source links to decisions without sources',
			type: 'task',
			workstreamId: undefined,
		});
	}

	return items;
}

// ---------------------------------------------------------------------------
// Build work items from document generation gaps
// ---------------------------------------------------------------------------

function buildWorkItemsFromDocumentGaps(
	readiness: NormativeBaselineReadinessResult,
	_baselineIndex: number,
): ExecutivePlanJsonItem[] {
	const items: ExecutivePlanJsonItem[] = [];
	let idx = 0;

	for (const doc of readiness.documentReadiness) {
		// Missing canonical documents
		if (doc.status === 'blocked' || doc.status === 'unknown') {
			if (!doc.hasCanonicalOutput) {
				const wiId = generateWorkItemId(
					'doc',
					'missing_output',
					doc.documentCanonicalId,
					idx++,
				);
				items.push({
					acceptanceCriteria: [
						`${doc.descriptorTitle} canonical Markdown generated`,
						`Document passes validation`,
					],
					dependsOn: [],
					description: `Generate canonical Markdown for "${doc.descriptorTitle}" (${doc.documentCanonicalId}). Current status: ${doc.status}.`,
					id: wiId,
					initiativeId: doc.phaseId ? `initiative-${doc.phaseId}` : undefined,
					metadata: {
						documentCanonicalId: doc.documentCanonicalId,
						documentStatus: doc.status,
						phaseId: doc.phaseId,
					},
					origin: 'derived',
					priority: 'high',
					requiresReview: false,
					softDependsOn: [],
					sourceNormativeDocuments: [doc.documentCanonicalId],
					sourceRationale: `Derived from document readiness: ${doc.status}`,
					status: 'blocked',
					suggestedExecutor: { agentProfile: 'human', type: 'human' },
					suggestedExports: {},
					title: `Generate canonical document: ${doc.descriptorTitle}`,
					type: 'doc_update',
					workstreamId: doc.phaseId ? `workstream-${doc.phaseId}` : undefined,
				});
			} else if (doc.stalenessStatus === 'stale') {
				const wiId = generateWorkItemId(
					'doc',
					'stale',
					doc.documentCanonicalId,
					idx++,
				);
				items.push({
					acceptanceCriteria: [
						`${doc.descriptorTitle} regenerated and current`,
						`Document passes validation`,
					],
					dependsOn: [],
					description: `Regenerate stale canonical document "${doc.descriptorTitle}" (${doc.documentCanonicalId}).`,
					id: wiId,
					initiativeId: doc.phaseId ? `initiative-${doc.phaseId}` : undefined,
					metadata: {
						documentCanonicalId: doc.documentCanonicalId,
						stalenessStatus: doc.stalenessStatus,
					},
					origin: 'derived',
					priority: 'medium',
					requiresReview: false,
					softDependsOn: [],
					sourceNormativeDocuments: [doc.documentCanonicalId],
					sourceRationale: 'Derived from document staleness status',
					status: 'blocked',
					suggestedExecutor: { agentProfile: 'human', type: 'human' },
					suggestedExports: {},
					title: `Regenerate stale document: ${doc.descriptorTitle}`,
					type: 'doc_update',
					workstreamId: doc.phaseId ? `workstream-${doc.phaseId}` : undefined,
				});
			}
		}
	}

	return items;
}

// ---------------------------------------------------------------------------
// Build decisions from readiness/register data
// ---------------------------------------------------------------------------

function buildDecisions(
	readiness: NormativeBaselineReadinessResult,
): ExecutivePlanJsonDecision[] {
	// Decisions are aggregated from register coverage.
	// The readiness result includes register coverage but not individual decision details.
	// We add a summary decision for each confirmed decision count.
	const decisions: ExecutivePlanJsonDecision[] = [];
	const count = readiness.registerCoverage.confirmedDecisions;
	if (count > 0) {
		decisions.push({
			affectedNormativeDocuments: readiness.requiredDocumentIds as string[],
			consequences: [
				`${readiness.registerCoverage.confirmedDecisions} decisions confirmed`,
			],
			context: `Normative baseline has ${readiness.registerCoverage.totalDecisions} total decisions`,
			decision: `${readiness.registerCoverage.confirmedDecisions} decisions confirmed as normative baseline inputs`,
			id: 'decision-normative-baseline',
			status: 'done',
			title: 'Normative Baseline Decisions',
		});
	}
	// If there are unresolved decisions, add a review item
	if (
		readiness.registerCoverage.totalDecisions >
		readiness.registerCoverage.confirmedDecisions
	) {
		decisions.push({
			affectedNormativeDocuments: [],
			consequences: ['May affect Executive Axis accuracy'],
			context: 'Some decisions are not yet confirmed',
			decision: `Review ${readiness.registerCoverage.totalDecisions - readiness.registerCoverage.confirmedDecisions} unconfirmed decisions`,
			id: 'decision-unconfirmed-review',
			status: 'reviewing',
			title: 'Review Unconfirmed Decisions',
		});
	}
	return decisions;
}

// ---------------------------------------------------------------------------
// Build risks from readiness/register data
// ---------------------------------------------------------------------------

function buildRisks(
	readiness: NormativeBaselineReadinessResult,
): ExecutivePlanJsonRisk[] {
	const risks: ExecutivePlanJsonRisk[] = [];

	// Add risk based on register assessment
	if (readiness.registerCoverage.totalRisks > 0) {
		risks.push({
			description: `${readiness.registerCoverage.totalRisks} risks in register (${readiness.registerCoverage.acceptedRisks} accepted, ${readiness.registerCoverage.risksWithoutMitigation} without mitigation)`,
			id: 'risk-register-status',
			impact:
				readiness.registerCoverage.risksWithoutMitigation > 0
					? 'high'
					: 'medium',
			likelihood: 'medium',
			mitigation:
				readiness.registerCoverage.risksWithoutMitigation > 0
					? 'Add mitigation plans for all accepted risks'
					: 'Monitor accepted risks',
			sourceNormativeDocuments: [],
			title: 'Risk Register Coverage',
		});
	}

	// Add risk based on stale documents
	if (readiness.stalenessCoverage.staleCount > 0) {
		risks.push({
			description: `${readiness.stalenessCoverage.staleCount} canonical documents are stale`,
			id: 'risk-stale-documents',
			impact: 'medium',
			likelihood: 'high',
			mitigation: 'Regenerate stale documents with /generate',
			sourceNormativeDocuments: readiness.requiredDocumentIds as string[],
			title: 'Stale Canonical Documents',
		});
	}

	// Add risk based on missing documents
	if (readiness.stalenessCoverage.missingCount > 0) {
		risks.push({
			description: `${readiness.stalenessCoverage.missingCount} canonical documents are missing`,
			id: 'risk-missing-documents',
			impact: 'high',
			likelihood: 'high',
			mitigation: 'Generate missing documents with /generate',
			sourceNormativeDocuments: readiness.requiredDocumentIds as string[],
			title: 'Missing Canonical Documents',
		});
	}

	// Add risk based on validation findings
	if (readiness.validationCoverage.releaseBlockingCount > 0) {
		risks.push({
			description: `${readiness.validationCoverage.releaseBlockingCount} release-blocking validation findings`,
			id: 'risk-validation-findings',
			impact: 'high',
			likelihood: 'high',
			mitigation: 'Address validation findings and re-run /validate',
			sourceNormativeDocuments: readiness.requiredDocumentIds as string[],
			title: 'Release-Blocking Validation Findings',
		});
	}

	return risks;
}

// ---------------------------------------------------------------------------
// Build artifacts from readiness/register data
// ---------------------------------------------------------------------------

function buildArtifacts(
	readiness: NormativeBaselineReadinessResult,
): ExecutivePlanJsonArtifact[] {
	const artifacts: ExecutivePlanJsonArtifact[] = [];

	// Document artifacts
	for (const doc of readiness.documentReadiness) {
		if (doc.hasCanonicalOutput && doc.canonicalOutputPath) {
			artifacts.push({
				generatedFrom: [doc.documentCanonicalId],
				id: `artifact-${doc.documentCanonicalId}`,
				path: doc.canonicalOutputPath,
				relatedItemIds: [],
				status:
					doc.status === 'satisfied'
						? 'done'
						: doc.status === 'warning'
							? 'reviewing'
							: 'blocked',
				title: doc.descriptorTitle,
				type: 'canonical_markdown',
			});
		}
	}

	return artifacts;
}

// ---------------------------------------------------------------------------
// Build exports
// ---------------------------------------------------------------------------

function buildExports(
	readiness: NormativeBaselineReadinessResult,
): Record<string, ExecutivePlanJsonExportConfig> {
	const exports: Record<string, ExecutivePlanJsonExportConfig> = {};

	// Known supported exports
	const supportedExports: Array<{
		id: string;
		mappingProfile: string;
	}> = [
		{
			id: 'markdown',
			mappingProfile: 'executive/mappings/markdown.mapping.yml',
		},
		{
			id: 'githubIssues',
			mappingProfile: 'executive/mappings/github-issues.mapping.yml',
		},
		{ id: 'html', mappingProfile: 'executive/mappings/html.mapping.yml' },
		{
			id: 'agentPack',
			mappingProfile: 'executive/mappings/agent-pack.mapping.yml',
		},
	];

	const plannedExports = readiness.executiveScopeCheck.plannedMappings;
	const enabledTargets = supportedExports.map((e) => e.id);

	for (const exp of supportedExports) {
		exports[exp.id] = {
			enabled: enabledTargets.includes(exp.id),
			mappingProfile: exp.mappingProfile,
			supportStatus: 'supported_now',
		};
	}

	// Planned adapter contracts
	for (const planned of plannedExports) {
		const mappingPath =
			planned === 'linear'
				? 'executive/mappings/linear.mapping.yml'
				: 'executive/mappings/notion.mapping.yml';
		exports[planned] = {
			enabled: false,
			mappingProfile: mappingPath,
			supportStatus: 'planned_adapter_contract',
		};
	}

	return exports;
}

// ---------------------------------------------------------------------------
// Build confidence
// ---------------------------------------------------------------------------

function buildConfidence(readiness: NormativeBaselineReadinessResult): {
	overall: 'low' | 'medium' | 'high';
	byArea: Record<string, 'low' | 'medium' | 'high'>;
} {
	const byArea: Record<string, 'low' | 'medium' | 'high'> = {};
	let areaScores = 0;
	let areaCount = 0;

	// Foundation phase
	if (readiness.phaseReadiness.length > 0) {
		for (const pr of readiness.phaseReadiness) {
			const score =
				pr.status === 'satisfied'
					? 'high'
					: pr.status === 'warning'
						? 'medium'
						: 'low';
			byArea[pr.phaseId] = score;
			areaScores += score === 'high' ? 3 : score === 'medium' ? 2 : 1;
			areaCount++;
		}
	}

	const avg = areaCount > 0 ? areaScores / areaCount : 1;
	const overall: 'low' | 'medium' | 'high' =
		avg >= 2.5 ? 'high' : avg >= 1.5 ? 'medium' : 'low';

	return { byArea, overall };
}

// ---------------------------------------------------------------------------
// Build metadata
// ---------------------------------------------------------------------------

function buildMetadata(
	readiness: NormativeBaselineReadinessResult,
	planId: string,
	fingerprint: string,
	compilationMode: string,
	diagnosticOnly: boolean,
	executorVersion: string | undefined,
	profileSource: string | undefined,
): Record<string, unknown> {
	return {
		baselineFingerprint: fingerprint,
		compilationMode,
		derivedSnapshot: true,
		diagnosticOnly,
		documentationRoot: readiness.documentationRoot,
		executiveProfileVersion: readiness.executiveProfileVersion ?? 'unknown',
		executorVersion: executorVersion ?? 'logos-engine',
		exportReady: !diagnosticOnly && readiness.status === 'ready',
		generatedAt: readiness.evaluatedAt,
		generatedBy: 'logos-engine',
		nonCanonical: true,
		planId,
		profileId: readiness.activeProfileId,
		profileSource: profileSource ?? 'unknown',
		profileVersion: readiness.profileVersion ?? 'unknown',
		readinessStatus: readiness.status,
		readinessSummary: readiness.summary,
		schemaVersion: '1.0.0',
		sourceOfTruthWarning:
			'This Executive Plan JSON is a derived snapshot. The canonical source of truth is the normative documentation baseline.',
		summary: {
			artifactCount: readiness.documentReadiness.length,
			blockerCount: readiness.summary.blockerCount,
			criterionCount: readiness.requiredDocumentIds.length,
			milestoneCount: readiness.phaseReadiness.length,
			riskCount: readiness.registerCoverage.totalRisks,
			workItemCount: 0, // populated after compilation
		},
	};
}

// ---------------------------------------------------------------------------
// Security check
// ---------------------------------------------------------------------------

function _looksLikeSecret(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	const lower = value.toLowerCase();
	if (lower.startsWith('sk-')) return true;
	if (lower.startsWith('sk_')) return true;
	if (lower.startsWith('bearer ')) return true;
	if (lower.startsWith('basic ')) return true;
	if (lower.startsWith('api-')) return true;
	if (lower.startsWith('api_')) return true;
	if (/^(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl|AKIA)/.test(value)) return true;
	return (
		value.length > 40 &&
		!value.includes('_') &&
		/[a-zA-Z0-9+/]{30,}/.test(value)
	);
}

function checkSecurity(plan: ExecutivePlanJson): {
	passed: boolean;
	diagnostics: ExecutivePlanDiagnostic[];
} {
	const diagnostics: ExecutivePlanDiagnostic[] = [];

	// Check for secrets in the plan
	const jsonStr = JSON.stringify(plan);
	const secretPatterns = [
		/sk-[a-zA-Z0-9]{20,}/g,
		/sk_[a-zA-Z0-9]{20,}/g,
		/bearer [a-zA-Z0-9_.-]{20,}/gi,
		/ghp_[a-zA-Z0-9]{36}/g,
		/xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/g,
		/AKIA[A-Z0-9]{16}/g,
	];

	for (const pattern of secretPatterns) {
		if (pattern.test(jsonStr)) {
			diagnostics.push({
				code: 'executive_plan_secret_leak',
				message: 'Compiled Executive Plan JSON contains secret-like values',
				severity: 'fatal',
			});
			return { diagnostics, passed: false };
		}
	}

	// Check for path traversal
	if (jsonStr.includes('..')) {
		diagnostics.push({
			code: 'executive_plan_path_traversal',
			message: 'Compiled Executive Plan JSON contains path traversal patterns',
			severity: 'fatal',
		});
		return { diagnostics, passed: false };
	}

	// Check for absolute local paths
	const absPathMatch = jsonStr.match(/\/[a-zA-Z]+\/[a-zA-Z0-9_/.-]{10,}/g);
	if (absPathMatch && absPathMatch.length > 20) {
		diagnostics.push({
			code: 'executive_plan_absolute_paths',
			message: 'Compiled Executive Plan JSON may contain absolute local paths',
			severity: 'warning',
		});
	}

	return { diagnostics, passed: true };
}

// ---------------------------------------------------------------------------
// Validate against executive-plan.schema.json (lazy loaded)
// ---------------------------------------------------------------------------

let _cachedSchema: Record<string, unknown> | null = null;
let _schemaLoadAttempted = false;
let _cachedSchemaPath: string | undefined;

function _loadExecutiveSchema(
	explicitPath?: string,
): Record<string, unknown> | null {
	if (_schemaLoadAttempted && explicitPath === _cachedSchemaPath)
		return _cachedSchema;
	if (explicitPath) {
		try {
			const raw = readFileSync(explicitPath, 'utf-8');
			_cachedSchema = JSON.parse(raw);
			_cachedSchemaPath = explicitPath;
			return _cachedSchema;
		} catch {
			// fall through to default
		}
	}
	if (_schemaLoadAttempted) return _cachedSchema;
	_schemaLoadAttempted = true;
	try {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const schemaPath = resolve(
			__dirname,
			'../../profiles/standard/executive/executive-plan.schema.json',
		);
		const raw = readFileSync(schemaPath, 'utf-8');
		_cachedSchema = JSON.parse(raw);
		return _cachedSchema;
	} catch {
		return null;
	}
}

function validateAgainstSchema(
	plan: ExecutivePlanJson,
	_explicitSchemaPath?: string,
): {
	valid: boolean;
	diagnostics: ExecutivePlanDiagnostic[];
} {
	const diagnostics: ExecutivePlanDiagnostic[] = [];

	// Basic structural validation without full JSON Schema validator
	// Full validation uses the schema's structure

	if (!plan.id || typeof plan.id !== 'string') {
		diagnostics.push({
			code: 'executive_plan_schema_invalid',
			expected: 'non-empty string',
			message: 'Plan id is required and must be a non-empty string',
			pointer: '/id',
			received: String(plan.id),
			severity: 'error',
		});
	}

	if (!plan.version || typeof plan.version !== 'string') {
		diagnostics.push({
			code: 'executive_plan_schema_invalid',
			expected: 'non-empty string',
			message: 'Plan version is required and must be a non-empty string',
			pointer: '/version',
			received: String(plan.version),
			severity: 'error',
		});
	}

	if (!plan.project?.id || !plan.project.name) {
		diagnostics.push({
			code: 'executive_plan_schema_invalid',
			expected: 'object with id and name',
			message: 'Project is required and must have id and name',
			pointer: '/project',
			received: JSON.stringify(plan.project),
			severity: 'error',
		});
	}

	if (!plan.generatedAt || typeof plan.generatedAt !== 'string') {
		diagnostics.push({
			code: 'executive_plan_schema_invalid',
			expected: 'ISO date-time string',
			message: 'generatedAt is required and must be a date-time string',
			pointer: '/generatedAt',
			received: String(plan.generatedAt),
			severity: 'error',
		});
	}

	if (!plan.source || !Array.isArray(plan.source.normativeDocuments)) {
		diagnostics.push({
			code: 'executive_plan_schema_invalid',
			expected: 'object with normativeDocuments array',
			message: 'Source is required with normativeDocuments array',
			pointer: '/source',
			received: JSON.stringify(plan.source),
			severity: 'error',
		});
	}

	if (!plan.execution) {
		diagnostics.push({
			code: 'executive_plan_schema_invalid',
			expected: 'execution object',
			message: 'Execution is required',
			pointer: '/execution',
			received: 'undefined',
			severity: 'error',
		});
	} else {
		if (!Array.isArray(plan.execution.roadmaps)) {
			diagnostics.push({
				code: 'executive_plan_schema_invalid',
				expected: 'array',
				message: 'execution.roadmaps must be an array',
				pointer: '/execution/roadmaps',
				received: typeof plan.execution.roadmaps,
				severity: 'error',
			});
		}
		if (!Array.isArray(plan.execution.milestones)) {
			diagnostics.push({
				code: 'executive_plan_schema_invalid',
				expected: 'array',
				message: 'execution.milestones must be an array',
				pointer: '/execution/milestones',
				received: typeof plan.execution.milestones,
				severity: 'error',
			});
		}
		if (!Array.isArray(plan.execution.workstreams)) {
			diagnostics.push({
				code: 'executive_plan_schema_invalid',
				expected: 'array',
				message: 'execution.workstreams must be an array',
				pointer: '/execution/workstreams',
				received: typeof plan.execution.workstreams,
				severity: 'error',
			});
		}
		if (!Array.isArray(plan.execution.initiatives)) {
			diagnostics.push({
				code: 'executive_plan_schema_invalid',
				expected: 'array',
				message: 'execution.initiatives must be an array',
				pointer: '/execution/initiatives',
				received: typeof plan.execution.initiatives,
				severity: 'error',
			});
		}
		if (!Array.isArray(plan.execution.items)) {
			diagnostics.push({
				code: 'executive_plan_schema_invalid',
				expected: 'array',
				message: 'execution.items must be an array',
				pointer: '/execution/items',
				received: typeof plan.execution.items,
				severity: 'error',
			});
		}
	}

	return { diagnostics, valid: diagnostics.length === 0 };
}

// ---------------------------------------------------------------------------
// Main compiler function
// ---------------------------------------------------------------------------

export function compileExecutivePlan(
	input: ExecutivePlanCompileInput,
	options: ExecutivePlanCompileOptions = {},
): ExecutivePlanCompileResult {
	const diagnostics: ExecutivePlanDiagnostic[] = [];
	const readiness = input.readinessResult;
	const compilationMode = input.compilationMode;
	const isBlocked = readinessBlocksCompilation(
		readiness.status,
		compilationMode,
	);
	const readinessHasBlockers =
		readiness.status === 'blocked' || readiness.status === 'unknown';
	const diagnosticOnly =
		compilationMode === 'diagnostic_preview' && readinessHasBlockers;
	const timestamp = input.clock();

	// Compute fingerprint
	const fingerprint = computeBaselineFingerprint(readiness);

	// Generate plan ID
	const planId =
		options.injectPlanId ??
		generatePlanId(readiness.activeProfileId, fingerprint, timestamp);

	// Build readiness snapshot
	const readinessSnapshot = buildReadinessSnapshot(readiness);

	// Build source
	const source = buildSource(readiness);

	// Build project info
	const project = buildProject(readiness, input);

	// Build milestones from phases
	const milestones = buildMilestones(readiness);
	const allMilestoneIds = milestones.map((m) => m.id);
	const milestoneIdByPhase = new Map<string, string>();
	for (const pr of readiness.phaseReadiness) {
		milestoneIdByPhase.set(pr.phaseId, `milestone-${pr.phaseId}`);
	}

	// Build workstreams
	const workstreams = buildWorkstreams(readiness);
	const workstreamIdByPhase = new Map<string, string>();
	for (const pr of readiness.phaseReadiness) {
		workstreamIdByPhase.set(pr.phaseId, `workstream-${pr.phaseId}`);
	}

	// Build work items
	const itemsFromBlockers = buildWorkItemsFromBlockers(
		readiness,
		diagnosticOnly,
	);
	const itemsFromSourceGaps = buildWorkItemsFromSourceGaps(
		readiness,
		itemsFromBlockers.length,
	);
	const itemsFromRegisterGaps = buildWorkItemsFromRegisterGaps(
		readiness,
		itemsFromBlockers.length + itemsFromSourceGaps.length,
	);
	const itemsFromDocGaps = buildWorkItemsFromDocumentGaps(
		readiness,
		itemsFromBlockers.length +
			itemsFromSourceGaps.length +
			itemsFromRegisterGaps.length,
	);
	const allItems = [
		...itemsFromBlockers,
		...itemsFromSourceGaps,
		...itemsFromRegisterGaps,
		...itemsFromDocGaps,
	];

	// Build work item IDs by phase
	const workItemIdsByPhase = new Map<string, string[]>();
	for (const item of allItems) {
		const phaseId = (item.metadata?.phaseId as string) ?? '';
		if (phaseId) {
			const ids = workItemIdsByPhase.get(phaseId) ?? [];
			ids.push(item.id);
			workItemIdsByPhase.set(phaseId, ids);
		}
	}

	// Build initiatives
	const initiatives = buildInitiatives(
		readiness,
		workItemIdsByPhase,
		milestoneIdByPhase,
		workstreamIdByPhase,
	);

	// Build roadmaps
	const roadmaps = buildRoadmaps(readiness, allMilestoneIds);

	// Build decisions
	const decisions = buildDecisions(readiness);

	// Build risks
	const risks = buildRisks(readiness);

	// Build artifacts
	const artifacts = buildArtifacts(readiness);

	// Build confidence
	const confidence = buildConfidence(readiness);

	// Build exports
	const exports = buildExports(readiness);

	// Build metadata
	const metadata = buildMetadata(
		readiness,
		planId,
		fingerprint,
		compilationMode,
		diagnosticOnly,
		input.executorVersion,
		options.profileSource,
	);
	(metadata.summary as Record<string, unknown>).workItemCount = allItems.length;

	// Assemble plan
	const plan: ExecutivePlanJson = {
		confidence,
		execution: {
			artifacts,
			decisions,
			initiatives,
			items: allItems,
			milestones,
			risks,
			roadmaps,
			workstreams,
		},
		exports,
		generatedAt: timestamp,
		id: planId,
		metadata,
		project,
		source,
		version: '1.0.0',
	};

	// Schema validation
	const schemaResult = validateAgainstSchema(plan, options.executiveSchemaPath);
	diagnostics.push(...schemaResult.diagnostics);

	// Security check
	const securityResult = checkSecurity(plan);
	diagnostics.push(...securityResult.diagnostics);

	// Determine compilation status
	const hasBlockers = isBlocked || readiness.blockers.length > 0;
	const hasWarnings = readiness.warnings.length > 0;
	const hasErrors = !schemaResult.valid || !securityResult.passed;

	let compilationStatus: ExecutivePlanCompilationStatus;
	if (hasErrors) {
		compilationStatus = 'failed';
	} else if (hasBlockers && !diagnosticOnly) {
		compilationStatus = 'blocked';
	} else if (hasWarnings) {
		compilationStatus = 'compiled_with_warnings';
	} else {
		compilationStatus = 'compiled';
	}

	// Build executive blockers from readiness blockers
	const executiveBlockers: ExecutivePlanBlocker[] = readiness.blockers.map(
		(b, i) => ({
			affectedDocumentIds: b.documentCanonicalId ? [b.documentCanonicalId] : [],
			affectedPhaseIds: b.phaseId ? [b.phaseId] : [],
			affectedWorkItemIds: [],
			blockerId: generateBlockerId(i),
			kind: b.kind,
			message: b.message,
			recoveryHint: b.recoveryHint,
			releaseBlocking: b.severity === 'fatal' || b.severity === 'error',
			severity: b.severity,
			sourceFindingId: b.validationFindingId ?? b.consistencyFindingId,
			sourceRegisterId: b.registerItemId as
				| import('../registers/register-types.js').RegisterItemId
				| undefined,
			sourceSourceId: b.sourceId as
				| import('../provenance/provenance-types.js').SourceId
				| undefined,
		}),
	);

	// Build warnings from diagnostics
	const warnings: ExecutivePlanDiagnostic[] = readiness.warnings.map((w) => ({
		code: `executive_plan_${w.kind}`,
		documentCanonicalId: w.documentCanonicalId,
		message: w.message,
		phaseId: w.phaseId,
		recoveryHint: w.recoveryHint,
		severity: 'warning' as const,
		sourcePath: w.sourcePath,
	}));

	const exportReady =
		!diagnosticOnly &&
		compilationStatus !== 'failed' &&
		compilationStatus !== 'blocked';

	return {
		blockers: executiveBlockers,
		changedPaths: [],
		compilationMode,
		diagnosticOnly,
		diagnostics,
		exportReady,
		plan: hasErrors && compilationMode === 'strict' ? null : plan,
		readinessSnapshot,
		readOnly: true,
		status: compilationStatus,
		warnings,
	};
}

/**
 * Assert that an executive compilation is allowed.
 * In strict mode, blocks if readiness is not ready/ready_with_warnings.
 * In diagnostic_preview mode, always allows.
 */
export function assertExecutiveCompilation(
	readinessStatus: string,
	compilationMode: 'strict' | 'diagnostic_preview',
): { allowed: boolean; reason?: string } {
	if (compilationMode === 'diagnostic_preview') return { allowed: true };
	if (
		readinessStatus === 'ready' ||
		readinessStatus === 'ready_with_warnings'
	) {
		return { allowed: true };
	}
	return {
		allowed: false,
		reason: `Normative baseline readiness is "${readinessStatus}". Run in strict mode requires "ready" or "ready_with_warnings". Use diagnostic_preview mode for preview.`,
	};
}
