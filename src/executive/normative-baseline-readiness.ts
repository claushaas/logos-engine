/** Step 11.1 — Normative baseline readiness gate */

import { isAbsolute, relative } from 'node:path';
import type { CanonicalDocumentId } from '../profiles/documentation-contract.js';
import type {
	ExecutiveCompilationGateStatus,
	NormativeBaselineDocumentReadiness,
	NormativeBaselineExecutiveScopeCheck,
	NormativeBaselinePhaseReadiness,
	NormativeBaselineReadinessBlocker,
	NormativeBaselineReadinessDiagnostic,
	NormativeBaselineReadinessInput,
	NormativeBaselineReadinessOptions,
	NormativeBaselineReadinessResult,
	NormativeBaselineReadinessStatus,
	NormativeBaselineReadinessWarning,
	NormativeBaselineRegisterCoverage,
	NormativeBaselineSourceCoverage,
	NormativeBaselineStalenessCoverage,
	NormativeBaselineTraceabilityCoverage,
	NormativeBaselineValidationCoverage,
} from './executive-readiness-types.js';
import {
	BLOCKER_KIND_ORDER,
	DERIVED_ARTIFACT_TYPES,
	SEVERITY_ORDER,
	WARNING_KIND_ORDER,
} from './executive-readiness-types.js';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function _makeRelativePath(
	path: string | undefined,
	projectRoot: string,
): string | undefined {
	if (!path) return undefined;
	try {
		if (isAbsolute(path)) {
			const rel = relative(projectRoot, path);
			if (rel.startsWith('..')) return '[path-outside-project-root]';
			return rel;
		}
		return path;
	} catch {
		return path;
	}
}

function isPathSafe(
	path: string | undefined,
	documentationRoot: string,
): boolean {
	if (!path) return false;
	const normalizedPath = path.replace(/\\/g, '/');
	if (normalizedPath.includes('..')) return false;
	if (isAbsolute(normalizedPath)) return false;
	if (
		!normalizedPath.startsWith(
			`${documentationRoot.replace(/\\/g, '/').replace(/\/$/, '')}/`,
		) &&
		!normalizedPath.startsWith(
			documentationRoot.replace(/\\/g, '/').replace(/\/$/, ''),
		)
	) {
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Secret detection (delegates to existing validation patterns)
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
	if (/^(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl|AKIA)/.test(value)) {
		return true;
	}
	return (
		value.length > 40 &&
		!value.includes('_') &&
		/[a-zA-Z0-9+/]{30,}/.test(value)
	);
}

// ---------------------------------------------------------------------------
// Executive scope check
// ---------------------------------------------------------------------------

function buildExecutiveScopeCheck(
	input: NormativeBaselineReadinessInput,
): NormativeBaselineExecutiveScopeCheck {
	const cfg = input.executiveGenerationConfig;

	if (!cfg) {
		return {
			claimsBidirectionalSync: false,
			claimsHosted: false,
			claimsLiveTaskManager: false,
			executiveConfigLoaded: false,
			executiveConfigValid: false,
			executiveSchemaParsed: false,
			missingMappingIds: [],
			plannedMappings: [],
			requiredMappingsPresent: false,
			status: 'blocked',
		};
	}

	const requiredSupportedMappings = [
		'markdown',
		'github-issues',
		'html',
		'agent-pack',
	];
	const plannedAdapterMappings = ['linear', 'notion'];

	const loadedMappings = cfg.exportTargets ?? [];
	const missingMappings = cfg.missingMappings ?? [];
	const plannedMappings = cfg.plannedMappings ?? [];

	const supportedMappingIds: string[] = [];
	const missingRequired: string[] = [];

	for (const id of requiredSupportedMappings) {
		if (loadedMappings.includes(id)) {
			supportedMappingIds.push(id);
		} else if (missingMappings.includes(id)) {
			missingRequired.push(id);
		}
	}

	const plannedIds = plannedAdapterMappings.filter(
		(id) => loadedMappings.includes(id) || plannedMappings.includes(id),
	);

	let scopeStatus: 'satisfied' | 'blocked' = 'satisfied';

	if (!cfg.loaded || !cfg.valid) {
		scopeStatus = 'blocked';
	} else if (missingRequired.length > 0) {
		scopeStatus = 'blocked';
	}

	const status: 'satisfied' | 'blocked' = scopeStatus;

	return {
		claimsBidirectionalSync: false,
		claimsHosted: false,
		claimsLiveTaskManager: false,
		executiveConfigLoaded: cfg.loaded,
		executiveConfigValid: cfg.valid,
		executiveSchemaParsed: cfg.valid,
		missingMappingIds: missingRequired,
		plannedMappings: plannedIds,
		requiredMappingsPresent: missingRequired.length === 0,
		status,
	};
}

// ---------------------------------------------------------------------------
// Validation coverage
// ---------------------------------------------------------------------------

function buildValidationCoverage(
	input: NormativeBaselineReadinessInput,
): NormativeBaselineValidationCoverage {
	const findings = input.validationFindings ?? [];
	const fatal = findings.filter((f) => f.severity === 'fatal').length;
	const error = findings.filter((f) => f.severity === 'error').length;
	const warning = findings.filter((f) => f.severity === 'warning').length;
	const info = findings.filter((f) => f.severity === 'info').length;

	const releaseBlocking = findings.filter((f) => {
		if (f.severity === 'fatal' || f.severity === 'error') return true;
		if (f.code === 'secret_like_value' || f.code === 'path_traversal')
			return true;
		return false;
	}).length;

	const tokenLeak = findings.filter(
		(f) => f.code === 'secret_like_value',
	).length;

	const totalRuns = input.latestValidationRunId ? 1 : 0;

	return {
		errorCount: error,
		fatalCount: fatal,
		infoCount: info,
		latestValidationGateStatus: input.latestValidationGateStatus,
		latestValidationRunId: input.latestValidationRunId,
		releaseBlockingCount: releaseBlocking,
		tokenLeakCount: tokenLeak,
		totalValidationsRun: totalRuns,
		warningCount: warning,
	};
}

// ---------------------------------------------------------------------------
// Staleness coverage
// ---------------------------------------------------------------------------

function buildStalenessCoverage(
	input: NormativeBaselineReadinessInput,
): NormativeBaselineStalenessCoverage {
	const s = input.stalenessSummary;
	return {
		blockedCount: s?.blockedCount ?? 0,
		currentCount: s?.currentCount ?? 0,
		missingCount: s?.missingCount ?? 0,
		orphanedCount: s?.orphanedCount ?? 0,
		staleCount: s?.staleCount ?? 0,
		totalTargets: s?.total ?? 0,
		unknownCount: s?.unknownCount ?? 0,
	};
}

// ---------------------------------------------------------------------------
// Source coverage
// ---------------------------------------------------------------------------

function buildSourceCoverage(
	input: NormativeBaselineReadinessInput,
): NormativeBaselineSourceCoverage {
	const sources = input.sources ?? [];
	const claims = input.claims ?? [];

	const confirmed = sources.filter(
		(s) =>
			s.status === 'confirmed' ||
			s.sourceType === 'confirmed_decision' ||
			s.sourceType === 'document',
	).length;

	const inferred = sources.filter(
		(s) => s.status === 'inferred' || s.sourceType === 'conversation_answer',
	).length;

	const reviewRequired = sources.filter(
		(s) => s.status === 'requires_review' || s.status === 'proposed',
	).length;

	const external = sources.filter(
		(s) => s.sourceType === 'external_reference',
	).length;

	const missingSourceClaimCount = claims.filter(
		(c) => c.sourceLinks.length === 0,
	).length;

	return {
		confirmedCount: confirmed,
		externalCount: external,
		inferredCount: inferred,
		missingSourceClaimCount,
		reviewRequiredCount: reviewRequired,
		totalSources: sources.length,
	};
}

// ---------------------------------------------------------------------------
// Register coverage
// ---------------------------------------------------------------------------

function buildRegisterCoverage(
	input: NormativeBaselineReadinessInput,
): NormativeBaselineRegisterCoverage {
	const registers = input.registerCollections;
	const decisions = registers?.decisions ?? [];
	const assumptions = registers?.assumptions ?? [];
	const hypotheses = registers?.hypotheses ?? [];
	const risks = registers?.risks ?? [];
	const openQuestions = registers?.openQuestions ?? [];

	const confirmedDecisions = decisions.filter(
		(d) => d.status === 'confirmed',
	).length;
	const decisionsWithoutSource = decisions.filter(
		(d) =>
			d.status === 'confirmed' &&
			(!d.sourceLinks || d.sourceLinks.length === 0),
	).length;
	const activeAssumptions = assumptions.filter(
		(a) => a.status === 'confirmed' || a.status === 'active',
	).length;
	const validatedHypotheses = hypotheses.filter(
		(h) => h.status === 'validated',
	).length;
	const acceptedRisks = risks.filter((r) => r.status === 'accepted').length;
	const risksWithoutMitigation = risks.filter(
		(r) => r.status === 'accepted' && !r.mitigation,
	).length;
	const blockingOpenQuestions = openQuestions.filter(
		(q) => q.isBlocking === true && q.status === 'open',
	).length;
	const unresolvedOpenQuestions = openQuestions.filter(
		(q) => q.status === 'open',
	).length;

	const allItems = [
		...decisions,
		...assumptions,
		...hypotheses,
		...risks,
		...openQuestions,
	];
	const reviewRequiredItems = allItems.filter(
		(i) => i.reviewState === 'requires_review' || i.reviewState === 'in_review',
	).length;

	return {
		acceptedRisks,
		activeAssumptions,
		blockingOpenQuestions,
		confirmedDecisions,
		decisionsWithoutSource,
		reviewRequiredItems,
		risksWithoutMitigation,
		totalAssumptions: assumptions.length,
		totalDecisions: decisions.length,
		totalHypotheses: hypotheses.length,
		totalOpenQuestions: openQuestions.length,
		totalRisks: risks.length,
		unresolvedOpenQuestions,
		validatedHypotheses,
	};
}

// ---------------------------------------------------------------------------
// Traceability coverage
// ---------------------------------------------------------------------------

function buildTraceabilityCoverage(
	input: NormativeBaselineReadinessInput,
): NormativeBaselineTraceabilityCoverage {
	const entries = input.traceabilityEntries ?? [];
	const documentsWithSources = entries.filter((e) => e.sourceCount > 0).length;
	const documentsMissingSources = entries.filter(
		(e) => e.sourceCount === 0,
	).length;

	return {
		documentsMissingSources,
		documentsWithSources,
		trackedArtifacts: 0,
		trackedDocuments: entries.length,
	};
}

// ---------------------------------------------------------------------------
// Per-document readiness
// ---------------------------------------------------------------------------

function buildDocumentReadiness(
	input: NormativeBaselineReadinessInput,
	documentId: string,
	entry: NormativeBaselineReadinessInput['documentEntries'][number],
	_blockers: NormativeBaselineReadinessBlocker[],
): {
	readiness: NormativeBaselineDocumentReadiness;
	blockers: NormativeBaselineReadinessBlocker[];
	warnings: NormativeBaselineReadinessWarning[];
} {
	const docBlockers: NormativeBaselineReadinessBlocker[] = [];
	const docWarnings: NormativeBaselineReadinessWarning[] = [];

	// Check staleness
	const staleness = input.stalenessTargets?.find(
		(t) => t.documentCanonicalId === documentId,
	);
	const stalenessStatus = staleness?.status;
	const _isCurrent = stalenessStatus === 'current';
	const isStale = stalenessStatus === 'stale';
	const isMissing = stalenessStatus === 'missing';
	const isBlocked = stalenessStatus === 'blocked';
	const isUnknown = stalenessStatus === 'unknown';

	// Check canonical output
	const outputPath = entry.canonicalOutputPath;
	const hasOutput = outputPath !== undefined && outputPath !== '';
	const pathSafe =
		hasOutput && outputPath
			? isPathSafe(outputPath, input.documentationRoot)
			: !hasOutput;

	// Check validation findings for this document
	const docFindings = (input.validationFindings ?? []).filter(
		(f) => f.documentCanonicalId === documentId,
	);
	const hasReleaseBlockingFindings = docFindings.some(
		(f) => f.severity === 'fatal' || f.severity === 'error',
	);
	const hasNonBlockingFindings = docFindings.some(
		(f) => f.severity === 'warning',
	);

	// Check consistency findings for this document
	const docConsistencyFindings = (input.consistencyFindings ?? []).filter(
		(f) => f.documentCanonicalId === documentId,
	);
	const hasReleaseBlockingConsistency = docConsistencyFindings.some(
		(f) => f.severity === 'fatal' || f.severity === 'error',
	);

	// Check required sections - simplified: check if descriptor has a status
	const requiredSectionsPresent =
		entry.descriptorStatus !== undefined && entry.descriptorStatus !== '';

	let status: 'satisfied' | 'warning' | 'blocked' | 'unknown' = 'satisfied';

	if (isMissing || (entry.required && !hasOutput)) {
		status = 'blocked';
		if (isMissing || (entry.required && !hasOutput)) {
			docBlockers.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: documentId,
				executiveDeclarationId: undefined,
				expected: 'Present canonical output',
				kind: 'missing_canonical_document',
				message: `Required canonical document "${documentId}" is missing`,
				order: 0,
				phaseId: entry.phaseId,
				pointer: undefined,
				received: outputPath ?? 'none',
				recoveryHint: 'Generate the document with /generate',
				registerItemId: undefined,
				severity: 'fatal',
				sourceId: undefined,
				sourcePath: outputPath,
				validationFindingId: undefined,
			});
		}
	} else if (isBlocked) {
		status = 'blocked';
		docBlockers.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: documentId,
			executiveDeclarationId: undefined,
			expected: 'Unblocked document',
			kind: 'blocked_canonical_document',
			message: `Canonical document "${documentId}" is blocked`,
			order: 0,
			phaseId: entry.phaseId,
			pointer: undefined,
			received: stalenessStatus,
			recoveryHint: 'Resolve upstream blocking dependencies',
			registerItemId: undefined,
			severity: 'fatal',
			sourceId: undefined,
			sourcePath: outputPath,
			validationFindingId: undefined,
		});
	} else if (isStale) {
		status = 'blocked';
		docBlockers.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: documentId,
			executiveDeclarationId: undefined,
			expected: 'Current document',
			kind: 'stale_canonical_document',
			message: `Canonical document "${documentId}" is stale`,
			order: 0,
			phaseId: entry.phaseId,
			pointer: undefined,
			received: stalenessStatus,
			recoveryHint: 'Regenerate the document with /generate',
			registerItemId: undefined,
			severity: 'error',
			sourceId: undefined,
			sourcePath: outputPath,
			validationFindingId: undefined,
		});
	} else if (isUnknown) {
		status = 'unknown';
		docWarnings.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: documentId,
			kind: 'manual_review_recommended',
			message: `Canonical document "${documentId}" staleness is unknown`,
			order: 0,
			phaseId: entry.phaseId,
			pointer: undefined,
			recoveryHint: 'Regenerate to establish known state',
			registerItemId: undefined,
			sourceId: undefined,
			sourcePath: outputPath,
			validationFindingId: undefined,
		});
	} else if (hasReleaseBlockingFindings || hasReleaseBlockingConsistency) {
		status = 'blocked';
		if (hasReleaseBlockingFindings) {
			docBlockers.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: documentId,
				executiveDeclarationId: undefined,
				expected: 'No blocking validation findings',
				kind: 'release_blocking_validation_finding',
				message: `Document "${documentId}" has release-blocking validation findings`,
				order: 0,
				phaseId: entry.phaseId,
				pointer: undefined,
				received: 'Blocking findings present',
				recoveryHint: 'Address validation findings and re-validate',
				registerItemId: undefined,
				severity: 'fatal',
				sourceId: undefined,
				sourcePath: outputPath,
				validationFindingId: docFindings[0]?.id,
			});
		}
		if (hasReleaseBlockingConsistency) {
			docBlockers.push({
				claimId: undefined,
				consistencyFindingId: docConsistencyFindings[0]?.id,
				documentCanonicalId: documentId,
				executiveDeclarationId: undefined,
				expected: 'No blocking consistency findings',
				kind: 'release_blocking_consistency_finding',
				message: `Document "${documentId}" has release-blocking consistency findings`,
				order: 0,
				phaseId: entry.phaseId,
				pointer: undefined,
				received: 'Blocking findings present',
				recoveryHint: 'Resolve consistency violations',
				registerItemId: undefined,
				severity: 'fatal',
				sourceId: undefined,
				sourcePath: outputPath,
				validationFindingId: undefined,
			});
		}
	} else if (!pathSafe) {
		status = 'blocked';
		docBlockers.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: documentId,
			executiveDeclarationId: undefined,
			expected: 'Safe path within documentation root',
			kind: 'unsafe_path',
			message: `Canonical document "${documentId}" output path is unsafe or outside root`,
			order: 0,
			phaseId: entry.phaseId,
			pointer: undefined,
			received: outputPath,
			recoveryHint:
				'Ensure output path is under the configured documentation root',
			registerItemId: undefined,
			severity: 'fatal',
			sourceId: undefined,
			sourcePath: outputPath,
			validationFindingId: undefined,
		});
	} else if (hasNonBlockingFindings) {
		status = 'warning';
		docWarnings.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: documentId,
			kind: 'non_blocking_validation_finding',
			message: `Document "${documentId}" has non-blocking validation warnings`,
			order: 0,
			phaseId: entry.phaseId,
			pointer: undefined,
			recoveryHint: 'Review and address warnings',
			registerItemId: undefined,
			sourceId: undefined,
			sourcePath: outputPath,
			validationFindingId: undefined,
		});
	}

	return {
		blockers: docBlockers,
		readiness: {
			blockerCount: docBlockers.length,
			canonicalOutputPath: outputPath,
			descriptorStatus: entry.descriptorStatus,
			descriptorTitle: entry.descriptorTitle,
			documentCanonicalId: documentId,
			hasCanonicalOutput: hasOutput,
			hasReleaseBlockingFindings,
			pathIsSafe: pathSafe,
			phaseId: entry.phaseId,
			requiredSectionsPresent,
			stalenessStatus: stalenessStatus ?? 'unknown',
			status,
			warningCount: docWarnings.length,
		},
		warnings: docWarnings,
	};
}

// ---------------------------------------------------------------------------
// Check register items
// ---------------------------------------------------------------------------

function checkRegisters(
	input: NormativeBaselineReadinessInput,
	requiredDocIds: readonly string[],
): {
	blockers: NormativeBaselineReadinessBlocker[];
	warnings: NormativeBaselineReadinessWarning[];
} {
	const blockers: NormativeBaselineReadinessBlocker[] = [];
	const warnings: NormativeBaselineReadinessWarning[] = [];

	const openQuestions = input.registerCollections?.openQuestions ?? [];
	const decisions = input.registerCollections?.decisions ?? [];
	const risks = input.registerCollections?.risks ?? [];
	const assumptions = input.registerCollections?.assumptions ?? [];
	const hypotheses = input.registerCollections?.hypotheses ?? [];

	// Check blocking open questions
	for (const q of openQuestions) {
		if (q.isBlocking === true && q.status === 'open') {
			const affectsRequired = (q.affectedDocumentLinks ?? []).some((l) =>
				requiredDocIds.includes(l.documentCanonicalId),
			);
			if (affectsRequired) {
				blockers.push({
					claimId: undefined,
					consistencyFindingId: undefined,
					documentCanonicalId: undefined,
					executiveDeclarationId: undefined,
					expected: 'Resolved question',
					kind: 'unresolved_blocking_question',
					message: `Blocking open question "${q.title || q.id}" affects required normative documents`,
					order: 0,
					phaseId: undefined,
					pointer: undefined,
					received: 'open',
					recoveryHint:
						'Resolve the open question before compiling Executive Axis',
					registerItemId: q.id as string,
					severity: 'fatal',
					sourceId: undefined,
					sourcePath: undefined,
					validationFindingId: undefined,
				});
			}
		}
		if (q.status === 'open' && q.isBlocking !== true) {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'manual_review_recommended',
				message: `Non-blocking open question "${q.title || q.id}" may affect normative quality`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: 'Consider resolving before compiling',
				registerItemId: q.id as string,
				sourceId: undefined,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
	}

	// Check confirmed decisions without sources
	for (const d of decisions) {
		if (
			d.status === 'confirmed' &&
			(!d.sourceLinks || d.sourceLinks.length === 0)
		) {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'optional_source_missing',
				message: `Confirmed decision "${d.title || d.id}" has no source links`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: 'Add source links to trace the decision origin',
				registerItemId: d.id as string,
				sourceId: undefined,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
		if (d.reviewState === 'requires_review') {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'review_required_claim',
				message: `Decision "${d.title || d.id}" requires review`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: 'Complete review for this decision',
				registerItemId: d.id as string,
				sourceId: undefined,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
		if (d.status === 'rejected' || d.status === 'superseded') {
			const hasActiveSourceLink = (d.sourceLinks ?? []).length > 0;
			if (hasActiveSourceLink) {
				blockers.push({
					claimId: undefined,
					consistencyFindingId: undefined,
					documentCanonicalId: undefined,
					executiveDeclarationId: undefined,
					expected: 'No active source links from rejected items',
					kind: 'unresolved_contradiction',
					message: `Rejected/superseded decision "${d.title || d.id}" still has active source links`,
					order: 0,
					phaseId: undefined,
					pointer: undefined,
					received: 'rejected with source links',
					recoveryHint: 'Review source links on rejected items',
					registerItemId: d.id as string,
					severity: 'error',
					sourceId: undefined,
					sourcePath: undefined,
					validationFindingId: undefined,
				});
			}
		}
	}

	// Check accepted risks without mitigation
	for (const r of risks) {
		if (r.status === 'accepted' && !r.mitigation) {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'manual_review_recommended',
				message: `Accepted risk "${r.title || r.id}" has no mitigation plan`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: 'Add mitigation plan for accepted risk',
				registerItemId: r.id as string,
				sourceId: undefined,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
		if (r.reviewState === 'requires_review') {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'review_required_claim',
				message: `Risk "${r.title || r.id}" requires review`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: 'Complete review for this risk',
				registerItemId: r.id as string,
				sourceId: undefined,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
	}

	// Check hypotheses not validated
	for (const h of hypotheses) {
		if (h.status === 'active' || h.status === 'proposed') {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'manual_review_recommended',
				message: `Hypothesis "${h.title || h.id}" is not yet validated — will not be treated as fact`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: 'Validate or explicitly reject the hypothesis',
				registerItemId: h.id as string,
				sourceId: undefined,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
	}

	// Check inferred assumptions
	for (const a of assumptions) {
		if (
			a.confidence === 'inferred' &&
			(a.status === 'confirmed' || a.status === 'active')
		) {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'inferred_source',
				message: `Assumption "${a.title || a.id}" is inferred — treat as review-required`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint:
					'Confirm or replace inferred assumptions with explicit evidence',
				registerItemId: a.id as string,
				sourceId: undefined,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
	}

	return { blockers, warnings };
}

// ---------------------------------------------------------------------------
// Check source/provenance coverage
// ---------------------------------------------------------------------------

function checkProvenance(input: NormativeBaselineReadinessInput): {
	blockers: NormativeBaselineReadinessBlocker[];
	warnings: NormativeBaselineReadinessWarning[];
} {
	const blockers: NormativeBaselineReadinessBlocker[] = [];
	const warnings: NormativeBaselineReadinessWarning[] = [];

	const claims = input.claims ?? [];
	const sources = input.sources ?? [];

	for (const claim of claims) {
		// Check for missing source links
		if (claim.sourceLinks.length === 0) {
			if (
				claim.claimType === 'fact' ||
				claim.claimType === 'decision' ||
				claim.claimType === 'requirement'
			) {
				warnings.push({
					claimId: claim.claimId,
					consistencyFindingId: undefined,
					documentCanonicalId: claim.relatedDocumentCanonicalId,
					kind: 'optional_source_missing',
					message: `Claim "${claim.claimId}" has no source links`,
					order: 0,
					phaseId: claim.relatedPhaseId,
					pointer: undefined,
					recoveryHint: 'Add source evidence for the claim',
					registerItemId: undefined,
					sourceId: undefined,
					sourcePath: undefined,
					validationFindingId: undefined,
				});
			}
		}

		// Check inferred claims require review
		if (claim.isInferred || claim.status === 'requires_review') {
			warnings.push({
				claimId: claim.claimId,
				consistencyFindingId: undefined,
				documentCanonicalId: claim.relatedDocumentCanonicalId,
				kind: 'review_required_claim',
				message: `Claim "${claim.claimId}" is inferred or requires review`,
				order: 0,
				phaseId: claim.relatedPhaseId,
				pointer: undefined,
				recoveryHint: 'Review and confirm the claim',
				registerItemId: undefined,
				sourceId: undefined,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
	}

	// Check external sources
	for (const source of sources) {
		if (source.sourceType === 'external_reference') {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'inferred_source',
				message: `Source "${source.sourceId}" is an external reference — not verified by LOGOS`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint: 'External references must be manually verified',
				registerItemId: undefined,
				sourceId: source.sourceId,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
		if (source.sourceType === 'repository_scan') {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: undefined,
				kind: 'inferred_source',
				message: `Source "${source.sourceId}" references a repository scan — verify scan was performed`,
				order: 0,
				phaseId: undefined,
				pointer: undefined,
				recoveryHint:
					'Ensure scan metadata exists before relying on scan references',
				registerItemId: undefined,
				sourceId: source.sourceId,
				sourcePath: undefined,
				validationFindingId: undefined,
			});
		}
	}

	return { blockers, warnings };
}

// ---------------------------------------------------------------------------
// Check consistency findings
// ---------------------------------------------------------------------------

function checkConsistency(input: NormativeBaselineReadinessInput): {
	blockers: NormativeBaselineReadinessBlocker[];
	warnings: NormativeBaselineReadinessWarning[];
} {
	const blockers: NormativeBaselineReadinessBlocker[] = [];
	const warnings: NormativeBaselineReadinessWarning[] = [];

	const findings = input.consistencyFindings ?? [];

	for (const f of findings) {
		if (f.severity === 'fatal' || f.severity === 'error') {
			blockers.push({
				claimId: undefined,
				consistencyFindingId: f.id,
				documentCanonicalId: f.documentCanonicalId,
				executiveDeclarationId: undefined,
				expected: undefined,
				kind: 'release_blocking_consistency_finding',
				message: f.message,
				order: 0,
				phaseId: f.phaseId,
				pointer: undefined,
				received: undefined,
				recoveryHint: undefined,
				registerItemId: f.registerItemId as string | undefined,
				severity: f.severity,
				sourceId: undefined,
				sourcePath: f.sourcePath,
				validationFindingId: undefined,
			});
		} else if (f.severity === 'warning') {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: f.id,
				documentCanonicalId: f.documentCanonicalId,
				kind: 'non_blocking_consistency_finding',
				message: f.message,
				order: 0,
				phaseId: f.phaseId,
				pointer: undefined,
				recoveryHint: undefined,
				registerItemId: f.registerItemId as string | undefined,
				sourceId: undefined,
				sourcePath: f.sourcePath,
				validationFindingId: undefined,
			});
		}
	}

	return { blockers, warnings };
}

// ---------------------------------------------------------------------------
// Check security
// ---------------------------------------------------------------------------

function checkSecurity(input: NormativeBaselineReadinessInput): {
	blockers: NormativeBaselineReadinessBlocker[];
	findings: string[];
} {
	const blockers: NormativeBaselineReadinessBlocker[] = [];
	const findings: string[] = [];

	// Check validation findings for secret leaks
	const secretFindings = (input.validationFindings ?? []).filter(
		(f) => f.code === 'secret_like_value' || f.code === 'path_traversal',
	);

	for (const sf of secretFindings) {
		blockers.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: sf.documentCanonicalId,
			executiveDeclarationId: undefined,
			expected: 'No secrets in metadata',
			kind: 'secret_leak',
			message: sf.message,
			order: 0,
			phaseId: sf.phaseId,
			pointer: sf.location.pointer,
			received: undefined,
			recoveryHint:
				sf.recoveryHint?.message ??
				'Remove secret-like values from state and metadata',
			registerItemId: undefined,
			severity: 'fatal',
			sourceId: undefined,
			sourcePath: sf.source.path,
			validationFindingId: sf.id,
		});
		findings.push(`security: ${sf.message}`);
	}

	// Check path traversal on canonical outputs
	for (const entry of input.documentEntries) {
		const path = entry.canonicalOutputPath;
		if (path?.includes('..')) {
			blockers.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: entry.documentCanonicalId,
				executiveDeclarationId: undefined,
				expected: 'Safe path without traversal',
				kind: 'unsafe_path',
				message: `Canonical output path "${path}" contains path traversal`,
				order: 0,
				phaseId: entry.phaseId,
				pointer: undefined,
				received: path,
				recoveryHint: 'Correct the output path to prevent traversal',
				registerItemId: undefined,
				severity: 'fatal',
				sourceId: undefined,
				sourcePath: path,
				validationFindingId: undefined,
			});
			findings.push(`path_traversal: ${path}`);
		}
	}

	return { blockers, findings };
}

// ---------------------------------------------------------------------------
// Check derived artifact boundary
// ---------------------------------------------------------------------------

function checkDerivedArtifactBoundary(
	input: NormativeBaselineReadinessInput,
): string[] {
	const violations: string[] = [];
	const artifacts = input.artifactRegistryEntries ?? [];

	for (const artifact of artifacts) {
		const type = artifact.artifactType;

		// Check if derived artifact is marked canonical
		if (DERIVED_ARTIFACT_TYPES.has(type) && artifact.isCanonical) {
			violations.push(
				`Derived artifact "${artifact.artifactId}" (${type}) is incorrectly marked canonical`,
			);
		}

		// Check if canonical document depends on derived artifact
		if (
			artifact.isCanonical &&
			(artifact.sourceDocumentIds ?? []).some((sid) => {
				const sourceArtifact = (input.artifactRegistryEntries ?? []).find(
					(a) => a.artifactId === sid,
				);
				return (
					sourceArtifact &&
					DERIVED_ARTIFACT_TYPES.has(sourceArtifact.artifactType)
				);
			})
		) {
			violations.push(
				`Canonical artifact "${artifact.artifactId}" depends on a derived artifact`,
			);
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Check validation findings
// ---------------------------------------------------------------------------

function checkValidation(input: NormativeBaselineReadinessInput): {
	blockers: NormativeBaselineReadinessBlocker[];
	warnings: NormativeBaselineReadinessWarning[];
} {
	const blockers: NormativeBaselineReadinessBlocker[] = [];
	const warnings: NormativeBaselineReadinessWarning[] = [];
	const findings = input.validationFindings ?? [];

	for (const f of findings) {
		if (f.severity === 'fatal' || f.severity === 'error') {
			blockers.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: f.documentCanonicalId,
				executiveDeclarationId: undefined,
				expected: f.expected as string | undefined,
				kind: 'release_blocking_validation_finding',
				message: f.message,
				order: 0,
				phaseId: f.phaseId,
				pointer: f.location.pointer,
				received: f.received as string | undefined,
				recoveryHint: f.recoveryHint?.message,
				registerItemId: undefined,
				severity: f.severity,
				sourceId: undefined,
				sourcePath: f.source.path,
				validationFindingId: f.id,
			});
		} else if (f.severity === 'warning') {
			warnings.push({
				claimId: undefined,
				consistencyFindingId: undefined,
				documentCanonicalId: f.documentCanonicalId,
				kind: 'non_blocking_validation_finding',
				message: f.message,
				order: 0,
				phaseId: f.phaseId,
				pointer: f.location.pointer,
				recoveryHint: f.recoveryHint?.message,
				registerItemId: undefined,
				sourceId: undefined,
				sourcePath: f.source.path,
				validationFindingId: f.id,
			});
		}
	}

	// Check if validation was not run at all
	if (findings.length === 0 && !input.latestValidationRunId) {
		warnings.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: undefined,
			kind: 'manual_review_recommended',
			message:
				'Validation has not been run — cannot assess validation readiness',
			order: 0,
			phaseId: undefined,
			pointer: undefined,
			recoveryHint: 'Run /validate before compiling Executive Axis',
			registerItemId: undefined,
			sourceId: undefined,
			sourcePath: undefined,
			validationFindingId: undefined,
		});
	}

	return { blockers, warnings };
}

// ---------------------------------------------------------------------------
// Check executive profile
// ---------------------------------------------------------------------------

function checkExecutiveProfile(
	input: NormativeBaselineReadinessInput,
): NormativeBaselineReadinessBlocker[] {
	const blockers: NormativeBaselineReadinessBlocker[] = [];
	const cfg = input.executiveGenerationConfig;
	const safeSourcePath =
		input.executiveConfigSourcePath ?? 'executive/executive-generation.yml';

	if (!cfg) {
		blockers.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: undefined,
			executiveDeclarationId: 'executive-generation',
			expected: 'Loaded executive generation config',
			kind: 'executive_profile_invalid',
			message: 'Executive generation configuration could not be loaded',
			order: 0,
			phaseId: undefined,
			pointer: undefined,
			received: 'not loaded',
			recoveryHint: `Ensure ${safeSourcePath} is present and valid`,
			registerItemId: undefined,
			severity: 'fatal',
			sourceId: undefined,
			sourcePath: safeSourcePath,
			validationFindingId: undefined,
		});
		return blockers;
	}

	if (!cfg.valid) {
		blockers.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: undefined,
			executiveDeclarationId: 'executive-generation',
			expected: 'Valid executive generation config',
			kind: 'executive_profile_invalid',
			message: 'Executive generation configuration is invalid',
			order: 0,
			phaseId: undefined,
			pointer: undefined,
			received: 'invalid',
			recoveryHint: `Fix validation errors in ${safeSourcePath}`,
			registerItemId: undefined,
			severity: 'fatal',
			sourceId: undefined,
			sourcePath: safeSourcePath,
			validationFindingId: undefined,
		});
	}

	const diagnostics = cfg.diagnostics ?? [];
	for (const d of diagnostics) {
		blockers.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: undefined,
			executiveDeclarationId: 'executive-generation',
			expected: undefined,
			kind: 'executive_profile_invalid',
			message: d.message,
			order: 0,
			phaseId: undefined,
			pointer: undefined,
			received: undefined,
			recoveryHint: undefined,
			registerItemId: undefined,
			severity: 'error',
			sourceId: undefined,
			sourcePath: safeSourcePath,
			validationFindingId: undefined,
		});
	}

	return blockers;
}

// ---------------------------------------------------------------------------
// Determine compilation gate status
// ---------------------------------------------------------------------------

function determineCompilationGateStatus(
	readinessStatus: NormativeBaselineReadinessStatus,
	hasWarnings: boolean,
): ExecutiveCompilationGateStatus {
	switch (readinessStatus) {
		case 'ready':
			return hasWarnings ? 'allowed_with_warnings' : 'allowed';
		case 'ready_with_warnings':
			return 'allowed_with_warnings';
		case 'blocked':
			return 'blocked';
		case 'unknown':
			return 'unknown';
	}
}

// ---------------------------------------------------------------------------
// Build recommended next actions
// ---------------------------------------------------------------------------

function buildRecommendedActions(
	blockers: readonly NormativeBaselineReadinessBlocker[],
	warnings: readonly NormativeBaselineReadinessWarning[],
	status: NormativeBaselineReadinessStatus,
): string[] {
	const actions: string[] = [];

	if (status === 'blocked') {
		actions.push(
			'Address all blocking issues before Executive Axis compilation',
		);

		const missingDocs = blockers.filter(
			(b) => b.kind === 'missing_canonical_document',
		);
		if (missingDocs.length > 0) {
			actions.push(
				`Generate ${missingDocs.length} missing canonical document(s) with /generate`,
			);
		}

		const staleDocs = blockers.filter(
			(b) => b.kind === 'stale_canonical_document',
		);
		if (staleDocs.length > 0) {
			actions.push(
				`Regenerate ${staleDocs.length} stale canonical document(s) with /generate`,
			);
		}

		const blockingQuestions = blockers.filter(
			(b) => b.kind === 'unresolved_blocking_question',
		);
		if (blockingQuestions.length > 0) {
			actions.push(
				`Resolve ${blockingQuestions.length} blocking open question(s)`,
			);
		}

		const valFindings = blockers.filter(
			(b) => b.kind === 'release_blocking_validation_finding',
		);
		if (valFindings.length > 0) {
			actions.push(
				`Fix ${valFindings.length} release-blocking validation finding(s)`,
			);
		}

		const secretLeaks = blockers.filter((b) => b.kind === 'secret_leak');
		if (secretLeaks.length > 0) {
			actions.push(
				'Remove secret-like values from state, metadata, and generated documents',
			);
		}
	} else if (status === 'ready_with_warnings') {
		actions.push('Review warnings before proceeding');
		if (warnings.some((w) => w.kind === 'review_required_claim')) {
			actions.push('Review items marked as requiring review');
		}
		if (warnings.some((w) => w.kind === 'optional_source_missing')) {
			actions.push('Add source evidence where practical');
		}
		if (warnings.some((w) => w.kind === 'inferred_source')) {
			actions.push('Confirm or replace inferred claims with explicit evidence');
		}
	} else if (status === 'unknown') {
		actions.push(
			'Run /generate, /validate, and /diagnose to establish readiness evidence',
		);
	} else if (status === 'ready') {
		actions.push('Normative baseline is ready for Executive Axis compilation');
	}

	return actions;
}

// ---------------------------------------------------------------------------
// Determine overall readiness status
// ---------------------------------------------------------------------------

function determineReadinessStatus(
	blockers: readonly NormativeBaselineReadinessBlocker[],
	warnings: readonly NormativeBaselineReadinessWarning[],
	strictMode: boolean,
): NormativeBaselineReadinessStatus {
	const hasBlockers = blockers.length > 0;
	const hasWarnings = warnings.length > 0;

	if (hasBlockers) return 'blocked';
	if (strictMode && hasWarnings) return 'ready_with_warnings';
	if (hasWarnings) return 'ready_with_warnings';
	return 'ready';
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function sortBlockers(
	blockers: NormativeBaselineReadinessBlocker[],
	docOrder: Map<string, number>,
): NormativeBaselineReadinessBlocker[] {
	return [...blockers]
		.sort((a, b) => {
			const severity =
				(SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
			if (severity !== 0) return severity;
			const kindOrder =
				(BLOCKER_KIND_ORDER[a.kind] ?? 99) - (BLOCKER_KIND_ORDER[b.kind] ?? 99);
			if (kindOrder !== 0) return kindOrder;
			const phaseA = docOrder.get(a.documentCanonicalId ?? '') ?? 0;
			const phaseB = docOrder.get(b.documentCanonicalId ?? '') ?? 0;
			if (phaseA !== phaseB) return phaseA - phaseB;
			const docA = a.documentCanonicalId ?? '';
			const docB = b.documentCanonicalId ?? '';
			return docA.localeCompare(docB);
		})
		.map((b, i) => ({ ...b, order: i }));
}

function sortWarnings(
	warnings: NormativeBaselineReadinessWarning[],
	docOrder: Map<string, number>,
): NormativeBaselineReadinessWarning[] {
	return [...warnings]
		.sort((a, b) => {
			const kindOrder =
				(WARNING_KIND_ORDER[a.kind] ?? 99) - (WARNING_KIND_ORDER[b.kind] ?? 99);
			if (kindOrder !== 0) return kindOrder;
			const phaseA = docOrder.get(a.documentCanonicalId ?? '') ?? 0;
			const phaseB = docOrder.get(b.documentCanonicalId ?? '') ?? 0;
			if (phaseA !== phaseB) return phaseA - phaseB;
			const docA = a.documentCanonicalId ?? '';
			const docB = b.documentCanonicalId ?? '';
			return docA.localeCompare(docB);
		})
		.map((w, i) => ({ ...w, order: i }));
}

// ---------------------------------------------------------------------------
// Main gate function
// ---------------------------------------------------------------------------

export function evaluateNormativeBaselineReadiness(
	input: NormativeBaselineReadinessInput,
	options: NormativeBaselineReadinessOptions = {},
): NormativeBaselineReadinessResult {
	const allBlockers: NormativeBaselineReadinessBlocker[] = [];
	const allWarnings: NormativeBaselineReadinessWarning[] = [];
	const allDiagnostics: NormativeBaselineReadinessDiagnostic[] = [];
	const securityFindings: string[] = [];
	const derivedArtifactViolations: string[] = [];
	const docReadinessMap = new Map<
		CanonicalDocumentId,
		NormativeBaselineDocumentReadiness
	>();

	const strictMode = options.strictMode ?? false;

	// Build doc ordering map
	const docOrder = new Map<string, number>();
	for (const entry of input.documentEntries) {
		docOrder.set(
			entry.documentCanonicalId,
			entry.phaseOrder * 1000 + entry.documentOrder,
		);
	}

	// 1. Per-document readiness checks
	for (const docId of input.requiredDocumentIds) {
		const entry = input.documentEntries.find(
			(e) => e.documentCanonicalId === docId,
		);
		if (entry) {
			const { readiness, blockers, warnings } = buildDocumentReadiness(
				input,
				docId,
				entry,
				allBlockers,
			);
			docReadinessMap.set(docId, readiness);
			allBlockers.push(...blockers);
			allWarnings.push(...warnings);
		} else {
			docReadinessMap.set(docId, {
				blockerCount: 0,
				canonicalOutputPath: undefined,
				descriptorStatus: undefined,
				descriptorTitle: docId,
				documentCanonicalId: docId,
				hasCanonicalOutput: false,
				hasReleaseBlockingFindings: false,
				pathIsSafe: false,
				phaseId: '',
				requiredSectionsPresent: false,
				stalenessStatus: 'missing',
				status: 'unknown',
				warningCount: 0,
			});
		}
	}

	// 2. Validation checks
	const valResult = checkValidation(input);
	allBlockers.push(...valResult.blockers);
	allWarnings.push(...valResult.warnings);

	// 3. Register checks
	const regResult = checkRegisters(
		input,
		input.requiredDocumentIds as string[],
	);
	allBlockers.push(...regResult.blockers);
	allWarnings.push(...regResult.warnings);

	// 4. Provenance checks
	const provResult = checkProvenance(input);
	allBlockers.push(...provResult.blockers);
	allWarnings.push(...provResult.warnings);

	// 5. Consistency checks
	const consResult = checkConsistency(input);
	allBlockers.push(...consResult.blockers);
	allWarnings.push(...consResult.warnings);

	// 6. Executive profile checks
	const execBlockers = checkExecutiveProfile(input);
	allBlockers.push(...execBlockers);

	// 7. Security checks
	const secResult = checkSecurity(input);
	allBlockers.push(...secResult.blockers);
	securityFindings.push(...secResult.findings);

	// 8. Derived artifact boundary checks
	const boundaryViolations = checkDerivedArtifactBoundary(input);
	derivedArtifactViolations.push(...boundaryViolations);
	for (const violation of boundaryViolations) {
		allWarnings.push({
			claimId: undefined,
			consistencyFindingId: undefined,
			documentCanonicalId: undefined,
			kind: 'derived_artifact_out_of_date',
			message: violation,
			order: 0,
			phaseId: undefined,
			pointer: undefined,
			recoveryHint: 'Mark derived artifacts as non-canonical',
			registerItemId: undefined,
			sourceId: undefined,
			sourcePath: undefined,
			validationFindingId: undefined,
		});
	}

	// Sort blockers and warnings
	const sortedBlockers = sortBlockers(allBlockers, docOrder);
	const sortedWarnings = sortWarnings(allWarnings, docOrder);

	// Determine overall status
	const readinessStatus = determineReadinessStatus(
		sortedBlockers,
		sortedWarnings,
		strictMode,
	);
	const compileGateStatus = determineCompilationGateStatus(
		readinessStatus,
		sortedWarnings.length > 0,
	);

	// Build coverage summaries
	const validationCoverage = buildValidationCoverage(input);
	const stalenessCoverage = buildStalenessCoverage(input);
	const sourceCoverage = buildSourceCoverage(input);
	const registerCoverage = buildRegisterCoverage(input);
	const traceabilityCoverage = buildTraceabilityCoverage(input);
	const executiveScopeCheck = buildExecutiveScopeCheck(input);

	// Build phase readiness
	const phaseReadiness: NormativeBaselinePhaseReadiness[] = [];
	for (const phase of input.phaseEntries) {
		const docIds = input.documentEntries
			.filter((e) => e.phaseId === phase.phaseId)
			.map((e) => e.documentCanonicalId);

		const phaseDocs = docIds
			.map((id) => docReadinessMap.get(id))
			.filter(Boolean) as NormativeBaselineDocumentReadiness[];

		const satisfied = phaseDocs.filter((d) => d.status === 'satisfied').length;
		const warning = phaseDocs.filter((d) => d.status === 'warning').length;
		const blocked = phaseDocs.filter((d) => d.status === 'blocked').length;
		const unknown = phaseDocs.filter((d) => d.status === 'unknown').length;

		let phaseStatus: 'satisfied' | 'warning' | 'blocked' | 'unknown' =
			'satisfied';
		if (blocked > 0) phaseStatus = 'blocked';
		else if (warning > 0) phaseStatus = 'warning';
		else if (unknown > 0) phaseStatus = 'unknown';

		phaseReadiness.push({
			blockedCount: blocked,
			documentIds: docIds,
			phaseId: phase.phaseId,
			phaseOrder: phase.order,
			phaseTitle: phase.title,
			required: phase.required,
			satisfiedCount: satisfied,
			status: phaseStatus,
			unknownCount: unknown,
			warningCount: warning,
		});
	}

	// Build document readiness list
	const documentReadiness = input.requiredDocumentIds
		.map((id) => docReadinessMap.get(id))
		.filter(Boolean) as NormativeBaselineDocumentReadiness[];

	// Build summary
	const totalDocs = documentReadiness.length;
	const satisfiedDocs = documentReadiness.filter(
		(d) => d.status === 'satisfied',
	).length;
	const warningDocs = documentReadiness.filter(
		(d) => d.status === 'warning',
	).length;
	const blockedDocs = documentReadiness.filter(
		(d) => d.status === 'blocked',
	).length;
	const unknownDocs = documentReadiness.filter(
		(d) => d.status === 'unknown',
	).length;

	const totalPhases = phaseReadiness.length;
	const satisfiedPhases = phaseReadiness.filter(
		(p) => p.status === 'satisfied',
	).length;
	const warningPhases = phaseReadiness.filter(
		(p) => p.status === 'warning',
	).length;
	const blockedPhases = phaseReadiness.filter(
		(p) => p.status === 'blocked',
	).length;
	const unknownPhases = phaseReadiness.filter(
		(p) => p.status === 'unknown',
	).length;

	const staleNormativeDocs = sortedBlockers.filter(
		(b) =>
			b.kind === 'stale_canonical_document' ||
			b.kind === 'missing_canonical_document',
	).length;

	// Build recommended actions
	const recommendedActions = buildRecommendedActions(
		sortedBlockers,
		sortedWarnings,
		readinessStatus,
	);

	return {
		activeProfileId: input.profileId,
		blockers: sortedBlockers,
		changedPaths: [],
		derivedArtifactBoundaryViolations: derivedArtifactViolations,
		diagnostics: allDiagnostics,
		documentationRoot: input.documentationRoot,
		documentReadiness,
		dryRun: true,
		evaluatedAt: input.evaluatedAt,
		executiveCompilationGateStatus: compileGateStatus,
		executiveProfileVersion: input.executiveGenerationConfig?.version,
		executiveScopeCheck,
		phaseReadiness,
		profileVersion: input.profileVersion,
		readOnly: true,
		recommendedNextActions: recommendedActions,
		registerCoverage,
		requiredDocumentIds: input.requiredDocumentIds,
		requiredPhaseIds: input.requiredPhaseIds,
		securityFindings,
		sourceCoverage,
		stalenessCoverage,
		status: readinessStatus,
		summary: {
			blockedDocuments: blockedDocs,
			blockedPhases,
			blockerCount: sortedBlockers.length,
			blockingOpenQuestionCount: registerCoverage.blockingOpenQuestions,
			executiveCompilationGateStatus: compileGateStatus,
			readinessStatus,
			satisfiedDocuments: satisfiedDocs,
			satisfiedPhases,
			staleNormativeDocCount: staleNormativeDocs,
			totalDocuments: totalDocs,
			totalPhases,
			unknownDocuments: unknownDocs,
			unknownPhases,
			warningCount: sortedWarnings.length,
			warningDocuments: warningDocs,
			warningPhases,
		},
		traceabilityCoverage,
		validationCoverage,
		warnings: sortedWarnings,
	};
}

/**
 * Assert whether Executive Axis compilation is allowed based on readiness result.
 * Returns the gate status, or throws if explicitly blocked.
 */
export function assertExecutiveCompilationAllowed(
	result: NormativeBaselineReadinessResult,
): ExecutiveCompilationGateStatus {
	if (result.executiveCompilationGateStatus === 'blocked') {
		const blockerMessages = result.blockers
			.map((b) => `  - ${b.kind}: ${b.message}`)
			.join('\n');
		throw new Error(
			`Executive Axis compilation is blocked:\n${blockerMessages}`,
		);
	}
	return result.executiveCompilationGateStatus;
}
