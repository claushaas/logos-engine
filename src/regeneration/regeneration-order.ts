/** Step 7.3 Regeneration Planning — deterministic safe ordering */

import type {
	RegenerationPlanAction,
	RegenerationPlanItem,
	RegenerationPlanTargetKind,
} from './regeneration-types.js';

// ---------------------------------------------------------------------------
// Target kind rank for ordering
// ---------------------------------------------------------------------------

const TARGET_KIND_RANK: Record<RegenerationPlanTargetKind, number> = {
	agent_pack: 30,
	canonical_markdown: 10,
	data_artifact: 40,
	executive_html: 60,
	executive_json: 50,
	executive_markdown: 55,
	html_artifact: 20,
	report_artifact: 45,
};

// ---------------------------------------------------------------------------
// Action rank for ordering
// ---------------------------------------------------------------------------

const ACTION_RANK: Record<RegenerationPlanAction, number> = {
	block_until_canonical_current: 200,
	block_until_dependency_current: 210,
	generate_missing: 20,
	manual_review: 300,
	no_action: 400,
	refresh_metadata: 310,
	regenerate: 10,
	skip_current: 410,
	skip_orphaned: 420,
};

// ---------------------------------------------------------------------------
// Deterministic safe order comparator
// ---------------------------------------------------------------------------

export function compareRegenerationOrder(
	a: RegenerationPlanItem,
	b: RegenerationPlanItem,
): number {
	// 1. Action priority — actionable items first
	const actionRankA = ACTION_RANK[a.action] ?? 500;
	const actionRankB = ACTION_RANK[b.action] ?? 500;
	if (actionRankA !== actionRankB) return actionRankA - actionRankB;

	// 2. Target kind priority — canonical before derived
	const kindRankA = TARGET_KIND_RANK[a.targetKind] ?? 99;
	const kindRankB = TARGET_KIND_RANK[b.targetKind] ?? 99;
	if (kindRankA !== kindRankB) return kindRankA - kindRankB;

	// 3. Upstream dependencies before downstream (approximated by node order)
	if (a.safeOrderIndex !== b.safeOrderIndex) {
		return a.safeOrderIndex - b.safeOrderIndex;
	}

	// 4. Stable tie-break by target ID
	return a.targetId.localeCompare(b.targetId);
}

// ---------------------------------------------------------------------------
// Assign safe order indices (0-based) to items
// ---------------------------------------------------------------------------

export function assignSafeOrderIndices(
	items: RegenerationPlanItem[],
): RegenerationPlanItem[] {
	const sorted = [...items];
	sorted.sort(compareRegenerationOrder);

	const result: RegenerationPlanItem[] = [];
	for (let i = 0; i < sorted.length; i++) {
		const item = sorted[i];
		if (!item) continue;
		result.push({
			action: item.action,
			artifactId: item.artifactId,
			blockers: item.blockers,
			canonicalPrerequisites: item.canonicalPrerequisites,
			derivedOutputPrerequisites: item.derivedOutputPrerequisites,
			diagnostics: item.diagnostics,
			documentCanonicalId: item.documentCanonicalId,
			downstreamDependents: item.downstreamDependents,
			dryRun: item.dryRun,
			graphNodeId: item.graphNodeId,
			outputPath: item.outputPath,
			phaseId: item.phaseId,
			reasonCodes: item.reasonCodes,
			reasons: item.reasons,
			safeOrderIndex: i,
			skippedReasons: item.skippedReasons,
			sourceChangeRefs: item.sourceChangeRefs,
			stalenessStatus: item.stalenessStatus,
			status: item.status,
			targetId: item.targetId,
			targetKind: item.targetKind,
			upstreamDependencies: item.upstreamDependencies,
		});
	}

	return result;
}

// ---------------------------------------------------------------------------
// Check if item A must precede item B in safe order
// ---------------------------------------------------------------------------

export function mustPrecede(
	a: RegenerationPlanItem,
	b: RegenerationPlanItem,
): boolean {
	// Canonical markdown always before non-canonical derived artifacts
	const aCanonical = a.targetKind === 'canonical_markdown';
	const bNonCanonical = b.targetKind !== 'canonical_markdown';
	if (aCanonical && bNonCanonical) return true;

	// Canonical markdown before HTML artifacts
	if (
		a.targetKind === 'canonical_markdown' &&
		b.targetKind === 'html_artifact'
	) {
		return true;
	}

	// Canonical markdown before agent packs
	if (a.targetKind === 'canonical_markdown' && b.targetKind === 'agent_pack') {
		return true;
	}

	// Canonical before executive JSON
	if (
		a.targetKind === 'canonical_markdown' &&
		b.targetKind === 'executive_json'
	) {
		return true;
	}

	// Executive JSON before executive markdown/html
	if (
		a.targetKind === 'executive_json' &&
		(b.targetKind === 'executive_markdown' || b.targetKind === 'executive_html')
	) {
		return true;
	}

	// Canonical before executive markdown/html
	if (
		a.targetKind === 'canonical_markdown' &&
		(b.targetKind === 'executive_markdown' || b.targetKind === 'executive_html')
	) {
		return true;
	}

	// Upstream before downstream for same kind
	if (a.targetKind === b.targetKind && a.targetKind === 'canonical_markdown') {
		for (const dep of b.canonicalPrerequisites) {
			if (dep === a.targetId) return true;
		}
	}

	// Data/report after canonical
	if (
		a.targetKind === 'canonical_markdown' &&
		(b.targetKind === 'data_artifact' || b.targetKind === 'report_artifact')
	) {
		return true;
	}

	// Blocked actions go after non-blocked of same kind
	const aBlocked =
		a.action === 'block_until_canonical_current' ||
		a.action === 'block_until_dependency_current';
	const bBlocked =
		b.action === 'block_until_canonical_current' ||
		b.action === 'block_until_dependency_current';
	if (!aBlocked && bBlocked) return true;

	return false;
}
