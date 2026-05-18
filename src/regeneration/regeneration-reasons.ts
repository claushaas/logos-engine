/** Step 7.3 Regeneration Planning — deterministic reason code mapping */

import type {
	RegenerationPlanItem,
	RegenerationPlanReason,
	RegenerationPlanReasonCode,
	RegenerationPlanSourceChange,
} from './regeneration-types.js';

// ---------------------------------------------------------------------------
// Reason code from staleness status
// ---------------------------------------------------------------------------

function stalenessStatusToPlanStatus(
	stalenessStatus: string,
): RegenerationPlanItem['status'] {
	switch (stalenessStatus) {
		case 'current':
			return 'not_needed';
		case 'stale':
			return 'planned';
		case 'missing':
			return 'missing_source';
		case 'blocked':
			return 'blocked';
		case 'orphaned':
			return 'skipped';
		case 'unknown':
			return 'unknown';
		default:
			return 'unknown';
	}
}

// ---------------------------------------------------------------------------
// Status to default action (without ordering context)
// ---------------------------------------------------------------------------

function stalenessStatusToDefaultAction(
	stalenessStatus: string,
): RegenerationPlanItem['action'] {
	switch (stalenessStatus) {
		case 'current':
			return 'no_action';
		case 'stale':
			return 'regenerate';
		case 'missing':
			return 'generate_missing';
		case 'blocked':
			return 'block_until_dependency_current';
		case 'orphaned':
			return 'skip_orphaned';
		case 'unknown':
			return 'manual_review';
		default:
			return 'manual_review';
	}
}

// ---------------------------------------------------------------------------
// Map staleness reason codes to regeneration reason codes
// ---------------------------------------------------------------------------

function mapStalenessReasonCode(code: string): RegenerationPlanReasonCode {
	switch (code) {
		case 'profile_contract_changed':
			return 'profile_contract_changed';
		case 'document_descriptor_changed':
			return 'document_descriptor_changed';
		case 'dependency_graph_changed':
			return 'dependency_graph_changed';
		case 'workspace_state_changed':
			return 'workspace_state_changed';
		case 'decision_changed':
			return 'decision_changed';
		case 'assumption_changed':
			return 'assumption_changed';
		case 'open_question_changed':
			return 'open_question_changed';
		case 'risk_changed':
			return 'risk_changed';
		case 'accepted_proposal_changed':
			return 'accepted_proposal_changed';
		case 'generation_metadata_missing':
			return 'generated_metadata_missing';
		case 'generation_metadata_invalid':
			return 'generated_metadata_invalid';
		case 'artifact_registry_missing':
			return 'insufficient_metadata';
		case 'artifact_registry_mismatch':
			return 'artifact_registry_mismatch';
		case 'output_file_missing':
			return 'target_missing';
		case 'output_checksum_mismatch':
			return 'output_checksum_mismatch';
		case 'upstream_required_stale':
			return 'upstream_required_stale';
		case 'upstream_required_missing':
			return 'upstream_required_missing';
		case 'upstream_required_blocked':
			return 'upstream_required_blocked';
		case 'upstream_optional_changed':
			return 'upstream_optional_changed';
		case 'orphaned_document':
			return 'target_orphaned';
		case 'orphaned_output':
			return 'target_orphaned';
		case 'unsafe_output_path':
			return 'unsafe_output_path';
		case 'insufficient_metadata':
			return 'insufficient_metadata';
		default:
			return 'target_unknown';
	}
}

// ---------------------------------------------------------------------------
// Build regeneration reasons from staleness reasons
// ---------------------------------------------------------------------------

export function buildReasons(
	reasons: readonly {
		readonly code: string;
		readonly severity: string;
		readonly message: string;
		readonly sourceKind: string;
		readonly sourceId: string | undefined;
		readonly sourcePath: string | undefined;
		readonly targetId: string;
		readonly expected: string | undefined;
		readonly received: string | undefined;
		readonly upstreamTargetId: string | undefined;
	}[],
): RegenerationPlanReason[] {
	const seen = new Set<string>();
	const result: RegenerationPlanReason[] = [];
	for (const r of reasons) {
		const planCode = mapStalenessReasonCode(r.code);
		const key = `${planCode}:${r.targetId}:${r.upstreamTargetId ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push({
			code: planCode,
			expected: r.expected,
			message: r.message,
			received: r.received,
			severity: r.severity as 'info' | 'warning' | 'error',
			sourceId: r.sourceId,
			sourceKind: r.sourceKind,
			sourcePath: r.sourcePath,
			targetId: r.targetId,
			upstreamTargetId: r.upstreamTargetId,
		});
	}
	return result;
}

// ---------------------------------------------------------------------------
// Build source change records from staleness targets
// ---------------------------------------------------------------------------

export function buildSourceChanges(
	targets: readonly {
		readonly targetId: string;
		readonly documentCanonicalId: string | undefined;
		readonly phaseId: string | undefined;
		readonly graphNodeId: string | undefined;
		readonly reasons: readonly {
			readonly code: string;
			readonly sourceKind: string;
			readonly sourceId: string | undefined;
			readonly sourcePath: string | undefined;
			readonly severity: string;
			readonly message: string;
		}[];
	}[],
): RegenerationPlanSourceChange[] {
	const changeMap = new Map<string, RegenerationPlanSourceChange>();

	for (const target of targets) {
		for (const reason of target.reasons) {
			const planCode = mapStalenessReasonCode(reason.code);
			const key = `${reason.sourceKind}:${reason.sourceId ?? ''}:${planCode}`;
			const existing = changeMap.get(key);

			const affectedIds = existing
				? [...existing.affectedTargetIds, target.targetId]
				: [target.targetId];

			changeMap.set(key, {
				affectedTargetIds: affectedIds,
				changedFingerprint: undefined,
				changedTimestamp: undefined,
				documentCanonicalId: (target.documentCanonicalId ?? undefined) as
					| string
					| undefined,
				graphNodeId: (target.graphNodeId ?? undefined) as string | undefined,
				phaseId: (target.phaseId ?? undefined) as string | undefined,
				reasonCode: planCode,
				recoveryHint: reason.message,
				severity: reason.severity as 'info' | 'warning' | 'error',
				sourceId: reason.sourceId,
				sourceKind: reason.sourceKind,
			});
		}
	}

	return [...changeMap.values()];
}

// ---------------------------------------------------------------------------
// Determine derived artifact gating
// ---------------------------------------------------------------------------

export function computeDerivedBlockingReason(
	targetKind: string,
	stalenessStatus: string,
	canonicalSourceStatus: string | undefined,
): RegenerationPlanReasonCode | undefined {
	if (stalenessStatus !== 'stale' && stalenessStatus !== 'missing') {
		return undefined;
	}

	if (
		canonicalSourceStatus === 'stale' ||
		canonicalSourceStatus === 'missing'
	) {
		return 'canonical_source_not_current';
	}

	if (
		targetKind === 'html_artifact' ||
		targetKind === 'agent_pack' ||
		targetKind === 'data_artifact' ||
		targetKind === 'report_artifact'
	) {
		if (canonicalSourceStatus === undefined) {
			return 'no_declared_output';
		}
		if (canonicalSourceStatus !== 'current') {
			return 'derived_artifact_after_canonical';
		}
	}

	if (
		targetKind === 'executive_json' &&
		canonicalSourceStatus !== undefined &&
		canonicalSourceStatus !== 'current'
	) {
		return 'executive_requires_normative_current';
	}

	if (
		(targetKind === 'executive_markdown' || targetKind === 'executive_html') &&
		canonicalSourceStatus !== undefined &&
		canonicalSourceStatus !== 'current'
	) {
		return 'executive_requires_normative_current';
	}

	return undefined;
}

// ---------------------------------------------------------------------------
// Expose status/action mapping helpers
// ---------------------------------------------------------------------------

export { stalenessStatusToDefaultAction, stalenessStatusToPlanStatus };
