/** Step 12.1 — Import Planner: read-only orchestration of import planning */

import { classifyImportCandidates } from './import-candidate-classification.js';
import { discoverImportCandidates } from './import-candidate-discovery.js';
import {
	detectImportConflicts,
	resetConflictIdCounter,
} from './import-conflict-detection.js';
import { mapImportCandidates } from './import-mapping.js';
import type {
	DocumentationImportActionKind,
	DocumentationImportBlocker,
	DocumentationImportCandidate,
	DocumentationImportCandidateStatus,
	DocumentationImportConflict,
	DocumentationImportDiagnostic,
	DocumentationImportMapping,
	DocumentationImportPlan,
	DocumentationImportPlanInput,
	DocumentationImportPlanOptions,
	DocumentationImportPlanResult,
	DocumentationImportProposedAction,
	DocumentationImportReadiness,
	DocumentationImportSummary,
	DocumentationImportWarning,
} from './import-model.js';
import { IMPORT_ACTION_KIND_ORDER } from './import-model.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildActionId(
	candidateId: string,
	actionKind: string,
	suffix?: string,
): string {
	const base = `import-action-${candidateId}-${actionKind}`;
	return suffix ? `${base}-${suffix}` : base;
}

function nowISO(): string {
	return new Date().toISOString();
}

function computeSummary(
	candidates: DocumentationImportCandidate[],
	conflicts: DocumentationImportConflict[],
	blockers: DocumentationImportBlocker[],
	warnings: DocumentationImportWarning[],
	diagnostics: DocumentationImportDiagnostic[],
	proposedActions: DocumentationImportProposedAction[],
): DocumentationImportSummary {
	const counts: Record<string, number> = {
		ambiguous: 0,
		blocked: 0,
		duplicate: 0,
		mapped: 0,
		unmapped: 0,
		unsafe: 0,
		unsupported: 0,
	};

	for (const c of candidates) {
		counts[c.status] = (counts[c.status] ?? 0) + 1;
	}

	return {
		ambiguousCandidates: counts.ambiguous ?? 0,
		blockedCandidates: counts.blocked ?? 0,
		duplicateCandidates: counts.duplicate ?? 0,
		mappedCandidates: counts.mapped ?? 0,
		totalBlockers: blockers.length,
		totalCandidates: candidates.length,
		totalConflicts: conflicts.length,
		totalDiagnostics: diagnostics.length,
		totalProposedActions: proposedActions.length,
		totalWarnings: warnings.length,
		unmappedCandidates: counts.unmapped ?? 0,
		unsafeCandidates: counts.unsafe ?? 0,
		unsupportedCandidates: counts.unsupported ?? 0,
	};
}

function computeReadiness(
	candidates: DocumentationImportCandidate[],
	blockers: DocumentationImportBlocker[],
	summary: DocumentationImportSummary,
): DocumentationImportReadiness {
	if (candidates.length === 0) return 'empty';

	const hasFatalBlockers = blockers.some((b) => b.severity === 'fatal');
	if (hasFatalBlockers) return 'blocked';

	const hasAmbiguous = summary.ambiguousCandidates > 0;
	const hasUnmapped = summary.unmappedCandidates > 0;
	const hasUnsafe = summary.unsafeCandidates > 0;

	if (hasUnsafe) return 'blocked';
	if (hasAmbiguous || hasUnmapped) return 'requires_manual_review';

	const hasMapped = summary.mappedCandidates > 0;
	if (hasMapped) return 'ready_for_review';

	return 'unknown';
}

// ---------------------------------------------------------------------------
// Proposed action generation
// ---------------------------------------------------------------------------

function generateProposedActions(
	candidates: DocumentationImportCandidate[],
	mappings: DocumentationImportMapping[],
	_diagnostics: DocumentationImportDiagnostic[],
): DocumentationImportProposedAction[] {
	const actions: DocumentationImportProposedAction[] = [];

	for (const candidate of candidates) {
		const candidateMappings = mappings.filter(
			(m) => m.candidateId === candidate.id,
		);

		if (candidate.status === 'blocked' || candidate.status === 'unsafe') {
			actions.push({
				blockers: candidate.blockers,
				candidateId: candidate.id,
				candidatePath: candidate.relativePath,
				confidence: 0,
				evidence: [
					{
						reason: 'Candidate is blocked or unsafe',
						signal: 'blocked_or_unsafe',
					},
				],
				expectedFutureMutation: 'none',
				id: buildActionId(candidate.id, 'blocked_no_action'),
				kind: 'blocked_no_action',
				requiresUserReview: true,
				warnings: candidate.warnings,
			});
			continue;
		}

		if (candidate.status === 'unsupported') {
			actions.push({
				blockers: [],
				candidateId: candidate.id,
				candidatePath: candidate.relativePath,
				confidence: 0,
				evidence: [
					{
						reason: 'Unsupported candidate format',
						signal: 'unsupported_format',
					},
				],
				expectedFutureMutation: 'none',
				id: buildActionId(candidate.id, 'unsupported_deferred'),
				kind: 'unsupported_deferred',
				requiresUserReview: false,
				warnings: [],
			});
			continue;
		}

		if (candidate.kind === 'transcript') {
			actions.push({
				blockers: [],
				candidateId: candidate.id,
				candidatePath: candidate.relativePath,
				confidence: 0,
				evidence: [
					{
						reason:
							'Transcript import is deferred; extraction not supported yet',
						signal: 'transcript_deferred',
					},
				],
				expectedFutureMutation: 'none',
				id: buildActionId(candidate.id, 'unsupported_deferred'),
				kind: 'unsupported_deferred',
				requiresUserReview: false,
				warnings: [
					{
						candidateId: candidate.id,
						code: 'import_transcript_deferred',
						message:
							'Transcript import is deferred until transcript extraction is specified',
						sourcePath: candidate.relativePath,
					},
				],
			});
			continue;
		}

		if (candidate.kind === 'raw_note') {
			actions.push({
				blockers: [],
				candidateId: candidate.id,
				candidatePath: candidate.relativePath,
				confidence: 0.3,
				evidence: [
					{
						reason: 'Raw note can be proposed as reference source',
						signal: 'raw_note_reference',
					},
				],
				expectedFutureMutation: 'propose_as_reference',
				id: buildActionId(candidate.id, 'propose_import_as_reference'),
				kind: 'propose_import_as_reference',
				requiresUserReview: true,
				warnings: [],
			});
			continue;
		}

		if (
			candidate.kind === 'profile_registry' ||
			candidate.kind === 'phase_descriptor' ||
			candidate.kind === 'document_descriptor' ||
			candidate.kind === 'executive_descriptor'
		) {
			actions.push({
				blockers: [],
				candidateId: candidate.id,
				candidatePath: candidate.relativePath,
				confidence: 0.5,
				evidence: [
					{
						reason: `Descriptor candidate of kind "${candidate.kind}" requires manual review`,
						signal: 'descriptor_manual_review',
					},
				],
				expectedFutureMutation: 'review_and_potentially_reference',
				id: buildActionId(candidate.id, 'manual_review_required'),
				kind: 'manual_review_required',
				requiresUserReview: true,
				warnings: [
					{
						candidateId: candidate.id,
						code: 'import_descriptor_manual_review',
						message: `Profile/descriptor import requires manual review before any action`,
						sourcePath: candidate.relativePath,
					},
				],
			});
			continue;
		}

		if (candidate.status === 'ambiguous') {
			actions.push({
				blockers: [],
				candidateId: candidate.id,
				candidatePath: candidate.relativePath,
				confidence: 0.3,
				evidence: [
					{
						reason: 'Ambiguous mapping requires manual resolution',
						signal: 'ambiguous_mapping',
					},
				],
				expectedFutureMutation: 'manual_document_selection',
				id: buildActionId(candidate.id, 'manual_review_required'),
				kind: 'manual_review_required',
				requiresUserReview: true,
				warnings: [],
			});
			continue;
		}

		if (candidate.status === 'unmapped' || candidateMappings.length === 0) {
			actions.push({
				blockers: [],
				candidateId: candidate.id,
				candidatePath: candidate.relativePath,
				confidence: 0,
				evidence: [
					{
						reason: 'No mapping could be determined for this candidate',
						signal: 'unmapped',
					},
				],
				expectedFutureMutation: 'manual_review_or_skip',
				id: buildActionId(candidate.id, 'manual_review_required'),
				kind: 'manual_review_required',
				requiresUserReview: true,
				warnings: [],
			});
			continue;
		}

		// Mapped candidates — generate propose_map_to_document actions
		for (const mapping of candidateMappings) {
			if (mapping.status === 'not_applicable' || mapping.status === 'blocked') {
				continue;
			}

			const actionKind: DocumentationImportActionKind =
				mapping.status === 'high_confidence'
					? 'propose_import_as_canonical_source'
					: 'propose_map_to_document';

			actions.push({
				blockers: mapping.blockers,
				candidateId: candidate.id,
				candidatePath: candidate.relativePath,
				confidence: mapping.confidence,
				evidence: mapping.evidence,
				expectedFutureMutation:
					mapping.status === 'high_confidence'
						? 'import_as_canonical_source_after_review'
						: 'map_to_document_after_review',
				id: buildActionId(candidate.id, actionKind, mapping.id),
				kind: actionKind,
				mappingId: mapping.id,
				requiresUserReview: true,
				targetDocumentId: mapping.targetDocumentCanonicalId,
				targetPhaseId: mapping.targetPhaseId,
				warnings: mapping.warnings,
			});
		}
	}

	// Sort actions deterministically
	actions.sort((a, b) => {
		// 1. Blocker severity
		const aHasBlockers = a.blockers.length > 0 ? 1 : 0;
		const bHasBlockers = b.blockers.length > 0 ? 1 : 0;
		if (aHasBlockers !== bHasBlockers) return bHasBlockers - aHasBlockers;

		// 2. Action kind order
		const kindDiff =
			(IMPORT_ACTION_KIND_ORDER[a.kind] ?? 99) -
			(IMPORT_ACTION_KIND_ORDER[b.kind] ?? 99);
		if (kindDiff !== 0) return kindDiff;

		// 3. Candidate path
		const pathDiff = a.candidatePath.localeCompare(b.candidatePath);
		if (pathDiff !== 0) return pathDiff;

		// 4. Stable action id
		return a.id.localeCompare(b.id);
	});

	return actions;
}

// ---------------------------------------------------------------------------
// Main planner
// ---------------------------------------------------------------------------

/**
 * Plan the import of existing documentation files into a LOGOS profile contract.
 *
 * This is a read-only, deterministic planner. It:
 * - Discovers candidate files from explicit paths, doc roots, or fixtures
 * - Classifies each candidate by type and role
 * - Maps candidates to known profile documents using deterministic heuristics
 * - Detects conflicts with existing canonical outputs
 * - Produces proposed actions, blockers, warnings, and diagnostics
 *
 * It does NOT:
 * - Import, create, or rewrite files
 * - Mutate workspace state, artifact registry, or canonical Markdown
 * - Generate HTML, Agent Packs, or Executive exports
 * - Call AI providers or perform external research
 * - Scan arbitrary repository source code
 */
export function planDocumentationImport(
	input: DocumentationImportPlanInput,
	options?: DocumentationImportPlanOptions,
): DocumentationImportPlanResult {
	const dryRun = options?.dryRun ?? true;
	const evaluatedAt = input.evaluatedAt ?? nowISO();

	// Reset deterministic counters
	resetConflictIdCounter();

	// 1. Discover candidates
	const discoveryResult = discoverImportCandidates({
		candidatePaths: input.candidatePaths,
		documentationRoots: input.documentationRoots,
		fixtures: input.fixtures,
		pathPolicy: options?.pathPolicy,
		projectRoot: input.projectRoot,
	});

	let candidates = discoveryResult.candidates;
	const blockers: DocumentationImportBlocker[] = [...discoveryResult.blockers];
	const warnings: DocumentationImportWarning[] = [...discoveryResult.warnings];
	const diagnostics: DocumentationImportDiagnostic[] = [
		...discoveryResult.diagnostics,
	];

	// 2. Classify candidates
	const classificationResult = classifyImportCandidates({ candidates });
	candidates = classificationResult.candidates;
	diagnostics.push(...classificationResult.diagnostics);

	// 3. Map candidates to profile documents
	const mappingResult = mapImportCandidates({
		candidates,
		documentationContract: input.documentationContract,
		documentationRoot: input.documentationRoot,
		existingCanonicalOutputs: input.existingCanonicalOutputs,
	});
	candidates = mappingResult.candidates;
	const mappings = mappingResult.mappings;
	diagnostics.push(...mappingResult.diagnostics);

	// 4. Detect conflicts
	const conflictResult = detectImportConflicts({
		candidates,
		documentationContract: input.documentationContract,
		documentationRoot: input.documentationRoot,
		existingCanonicalOutputs: input.existingCanonicalOutputs,
		manualEditStatuses: input.manualEditStatuses,
		mappings,
		projectRoot: input.projectRoot,
	});
	const conflicts = conflictResult.conflicts;
	blockers.push(...conflictResult.blockers);
	warnings.push(...conflictResult.warnings);
	diagnostics.push(...conflictResult.diagnostics);

	// 5. Update candidate statuses based on conflicts
	candidates = applyConflictsToCandidates(candidates, conflicts);

	// 6. Generate proposed actions
	const proposedActions = generateProposedActions(
		candidates,
		mappings,
		diagnostics,
	);

	// 7. Build summary and readiness
	const summary = computeSummary(
		candidates,
		conflicts,
		blockers,
		warnings,
		diagnostics,
		proposedActions,
	);
	const readiness = computeReadiness(candidates, blockers, summary);

	// 8. Build the plan
	const plan: DocumentationImportPlan = {
		blockers,
		candidateRoots: input.documentationRoots ?? [],
		candidates,
		conflicts,
		diagnostics,
		documentationRoot: input.documentationRoot,
		dryRun,
		evaluatedAt,
		mappings,
		profileId: input.profileId,
		profileVersion: input.profileVersion,
		proposedActions,
		readiness,
		readOnly: true,
		summary,
		warnings,
	};

	return { changedPaths: [], plan };
}

// ---------------------------------------------------------------------------
// Apply conflict-derived status updates
// ---------------------------------------------------------------------------

function applyConflictsToCandidates(
	candidates: DocumentationImportCandidate[],
	conflicts: DocumentationImportConflict[],
): DocumentationImportCandidate[] {
	return candidates.map((candidate) => {
		const candidateConflicts = conflicts.filter((c) =>
			c.candidateIds.includes(candidate.id),
		);

		if (candidateConflicts.length === 0) return candidate;
		if (candidate.status === 'blocked' || candidate.status === 'unsafe')
			return candidate;

		const hasError = candidateConflicts.some(
			(c) => c.severity === 'error' || c.severity === 'fatal',
		);
		if (hasError) {
			return {
				...candidate,
				status: 'conflicting' as DocumentationImportCandidateStatus,
			};
		}

		return candidate;
	});
}
